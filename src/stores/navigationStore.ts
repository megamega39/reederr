import { create } from 'zustand';
import { FileSystemAPI } from '../services/api';
import { DirectoryEntry, HistoryEntry } from '../types';
import { normalizePath, getParentPath, isArchiveOpened, ensureOpenedPath } from './viewerStore.utils';
import { AnyPath, toAnyPath } from '../types/paths';
import { useAppStore } from './appStore';
import { useSettingsStore } from './settingsStore';
import { useTreeStore } from './treeStore';

export interface NavigationState {
  currentPath: AnyPath | null;
  entries: DirectoryEntry[];
  history: HistoryEntry[];
  historyIndex: number;
  isLoading: boolean;
  error: string | null;
  currentLoadId: number;

  loadDirectory: (path: AnyPath | string, opts?: { pushHistory?: boolean; skipSelect?: boolean; selectedPath?: AnyPath }) => Promise<void>;
  setCurrentPath: (path: AnyPath | null) => void;
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
    const str = currentPath as string;
    if (str === 'pc' || str === 'network') return false;
    if (str.includes('!')) return true; // Inside archive
    // Simple check for root like C: or / (Linux)
    return str.split(/[/\\]/).filter(Boolean).length > 1;
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
      const str = currentPath as string;
      const archiveRoot = toAnyPath(str.slice(0, str.indexOf('!')));
      const innerPath = toAnyPath(str.slice(str.indexOf('!') + 1).replace(/\/+$/, ''));
      if ((innerPath as string) === '') {
        const parent = getParentPath(archiveRoot);
        if (parent) loadDirectory(parent);
      } else {
        const parentInner = getParentPath(innerPath);
        loadDirectory(toAnyPath(archiveRoot + '!' + (parentInner ? parentInner : '')));
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
      const strNorm = normPath as string;
      if (strNorm === 'pc') type = 'pc';
      else if (strNorm === 'network') type = 'network';
      else if (isArchiveOpened(normPath)) type = 'archive';
      
      const name = strNorm === 'pc' ? 'PC' : 
                   strNorm === 'network' ? 'Network' :
                   (strNorm.split(/[/\\]/).pop() || strNorm).replace('!', '');
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

      const rawEntries = Array.isArray(result.value) ? result.value : [];
      const entries = rawEntries.map(e => ({
        ...e,
        path: normalizePath(e.path) as AnyPath
      }));
      set({ entries, isLoading: false, error: null });
    } catch (err) {
      if (get().currentLoadId !== loadId) return;
      set({ entries: [], isLoading: false, error: err instanceof Error ? err.message : String(err) });
    }
  },
}));
