import { create } from 'zustand';
import { FileSystemAPI } from '../services/api';
import { DirectoryEntry, HistoryEntry } from '../types';
import { normalizePath, getParentPath, isArchiveOpened, ensureOpenedPath } from './viewerStore.utils';
import { useAppStore } from './appStore';
import { useSettingsStore } from './settingsStore';
import { useTreeStore } from './treeStore';

export interface NavigationState {
  currentPath: string | null;
  entries: DirectoryEntry[];
  history: HistoryEntry[];
  historyIndex: number;
  isLoading: boolean;
  error: string | null;
  currentLoadId: number;

  loadDirectory: (path: string, opts?: { pushHistory?: boolean; skipSelect?: boolean; selectedPath?: string }) => Promise<void>;
  setCurrentPath: (path: string | null) => void;
  goBack: () => void;
  goForward: () => void;
  goUp: () => void;
  refresh: () => Promise<void>;
  jumpToHistory: (index: number) => void;
  nextFolder: () => void;
  prevFolder: () => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  canGoUp: () => boolean;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  currentPath: null,
  entries: [],
  history: [],
  historyIndex: -1,
  isLoading: false,
  error: null,
  currentLoadId: 0,

  nextFolder: () => {
    const { currentPath, loadDirectory } = get();
    const tree = useTreeStore.getState();
    if (!currentPath || !tree) return;
    const parent = getParentPath(currentPath);
    if (!parent) return;
    const siblings = tree.treeChildren[parent] || [];
    const idx = siblings.findIndex((e: any) => normalizePath(e.path) === normalizePath(currentPath));
    if (idx >= 0 && idx < siblings.length - 1) {
      loadDirectory(siblings[idx + 1].path);
    }
  },

  prevFolder: () => {
    const { currentPath, loadDirectory } = get();
    const tree = useTreeStore.getState();
    if (!currentPath || !tree) return;
    const parent = getParentPath(currentPath);
    if (!parent) return;
    const siblings = tree.treeChildren[parent] || [];
    const idx = siblings.findIndex((e: any) => normalizePath(e.path) === normalizePath(currentPath));
    if (idx > 0) {
      loadDirectory(siblings[idx - 1].path);
    }
  },

  canGoBack: () => get().historyIndex > 0,
  canGoForward: () => get().historyIndex < get().history.length - 1,
  canGoUp: () => {
    const { currentPath } = get();
    if (!currentPath) return false;
    if (currentPath === 'pc' || currentPath === 'network') return false;
    if (currentPath.includes('!')) return true; // Inside archive
    // Simple check for root like C: or / (Linux)
    return currentPath.split(/[/\\]/).filter(Boolean).length > 1;
  },

  setCurrentPath: (path) => set({ currentPath: path }),

  goBack: () => {
    const { historyIndex, history, loadDirectory } = get();
    if (historyIndex <= 0) return;
    const newIdx = historyIndex - 1;
    set({ historyIndex: newIdx });
    loadDirectory(history[newIdx].path, { pushHistory: false });
  },

  goForward: () => {
    const { historyIndex, history, loadDirectory } = get();
    if (historyIndex >= history.length - 1) return;
    const newIdx = historyIndex + 1;
    set({ historyIndex: newIdx });
    loadDirectory(history[newIdx].path, { pushHistory: false });
  },

  goUp: () => {
    const { currentPath, loadDirectory } = get();
    if (!currentPath) return;
    
    if (currentPath.includes('!')) {
      const archiveRoot = currentPath.slice(0, currentPath.indexOf('!'));
      const innerPath = currentPath.slice(currentPath.indexOf('!') + 1).replace(/\/+$/, '');
      if (innerPath === '') {
        const parent = getParentPath(archiveRoot);
        if (parent) loadDirectory(parent);
      } else {
        const parentInner = getParentPath(innerPath);
        loadDirectory(archiveRoot + '!' + (parentInner ? parentInner : ''));
      }
    } else {
      const parent = getParentPath(currentPath);
      if (parent) loadDirectory(parent);
    }
  },

  refresh: async () => {
    const { currentPath, loadDirectory } = get();
    if (!currentPath) return;
    // We'll need to coordinate with mediaStore to restore selection
    // For now, simple refresh
    await loadDirectory(currentPath, { pushHistory: false });
  },

  jumpToHistory: (index: number) => {
    const { history, loadDirectory } = get();
    if (index < 0 || index >= history.length) return;
    set({ historyIndex: index });
    loadDirectory(history[index].path, { pushHistory: false });
  },

  loadDirectory: async (path, opts = {}) => {
    const { pushHistory = true } = opts;
    const appStore = useAppStore.getState();
    const { currentLoadId } = get();
    const loadId = currentLoadId + 1;
    appStore.setFileListFilter('');
    set({ isLoading: true, error: null, currentLoadId: loadId });

    const normPath = normalizePath(path);

    if (pushHistory && normPath !== get().currentPath) {
      const { history, historyIndex } = get();
      const newHistory = history.slice(0, historyIndex + 1);
      let type: 'folder' | 'archive' | 'pc' | 'network' | 'other' = 'folder';
      if (normPath === 'pc') type = 'pc';
      else if (normPath === 'network') type = 'network';
      else if (isArchiveOpened(normPath)) type = 'archive';
      
      const name = normPath === 'pc' ? 'PC' : 
                   normPath === 'network' ? 'Network' :
                   (normPath.split(/[/\\]/).pop() || normPath).replace('!', '');
      newHistory.push({ path: normPath, name, type });
      set({ history: newHistory, historyIndex: newHistory.length - 1 });
    }

    const resolvedPath = ensureOpenedPath(normPath);
    set({ currentPath: resolvedPath, entries: [] });

    try {
      const isArchive = isArchiveOpened(resolvedPath);
      const recursive = useSettingsStore.getState().recursiveMedia && isArchive;
      const result = await FileSystemAPI.listDirectory(resolvedPath, { recursive });
      
      const current = get();
      if (current.currentLoadId !== loadId) {
        return;
      }

      if (!result.ok) {
        set({ entries: [], error: result.error || 'データの読み込みに失敗しました', isLoading: false });
        return;
      }

      const entries = Array.isArray(result.value) ? result.value : [];
      set({ entries, isLoading: false, error: null });
    } catch (err) {
      if (get().currentLoadId !== loadId) return;
      set({ entries: [], isLoading: false, error: err instanceof Error ? err.message : String(err) });
    }
  },
}));
