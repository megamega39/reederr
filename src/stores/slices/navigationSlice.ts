import { StateCreator } from 'zustand';
import { ViewerState } from '../viewerStore.types';
import { FileSystemAPI } from '../../services/api';
import { DirectoryEntry } from '../../types';
import { useLayoutStore } from '../layoutStore';
import { isMediaEntry, normalizePath, getParentPath, isArchivePath, isArchiveOpened } from '../viewerStore.utils';

export interface NavigationSlice {
  currentPath: ViewerState['currentPath'];
  history: ViewerState['history'];
  historyIndex: ViewerState['historyIndex'];
  setCurrentPath: ViewerState['setCurrentPath'];
  canGoBack: ViewerState['canGoBack'];
  canGoForward: ViewerState['canGoForward'];
  goBack: ViewerState['goBack'];
  goForward: ViewerState['goForward'];
  goUp: ViewerState['goUp'];
  refresh: ViewerState['refresh'];
  jumpToHistory: ViewerState['jumpToHistory'];
  loadDirectory: ViewerState['loadDirectory'];
  prevFolder: () => Promise<void>;
  nextFolder: () => Promise<void>;
}

export const createNavigationSlice: StateCreator<
  ViewerState,
  [],
  [],
  NavigationSlice
> = (set, get) => ({
  currentPath: null,
  history: [],
  historyIndex: -1,

  setCurrentPath: (path) => set({ currentPath: path }),

  canGoBack: () => get().historyIndex > 0,
  canGoForward: () => get().historyIndex < get().history.length - 1,

  goBack: () => {
    const { historyIndex, history } = get();
    if (historyIndex <= 0) return;
    const newIdx = historyIndex - 1;
    set({ historyIndex: newIdx });
    get().loadDirectory(history[newIdx].path, { pushHistory: false });
  },

  goForward: () => {
    const { historyIndex, history } = get();
    if (historyIndex >= history.length - 1) return;
    const newIdx = historyIndex + 1;
    set({ historyIndex: newIdx });
    get().loadDirectory(history[newIdx].path, { pushHistory: false });
  },

  goUp: () => {
    const { currentPath } = get();
    if (!currentPath) return;
    
    if (currentPath.includes('!')) {
      const archiveRoot = currentPath.slice(0, currentPath.indexOf('!'));
      const innerPath = currentPath.slice(currentPath.indexOf('!') + 1).replace(/\/+$/, '');
      if (innerPath === '') {
        const parent = getParentPath(archiveRoot);
        if (parent) get().loadDirectory(parent);
      } else {
        const parentInner = getParentPath(innerPath);
        get().loadDirectory(archiveRoot + '!' + (parentInner ? parentInner : ''));
      }
    } else {
      const parent = getParentPath(currentPath);
      if (parent) get().loadDirectory(parent);
    }
  },

  refresh: async () => {
    const { currentPath, selectedPath } = get();
    if (!currentPath) return;
    const rememberedPath = selectedPath;
    await get().loadDirectory(currentPath, { pushHistory: false });
    if (rememberedPath) {
      const idx = get().imageEntries.findIndex((e) => e.path === rememberedPath);
      if (idx >= 0) {
        get().setSelectedPath(get().imageEntries[idx].path);
        await get().loadMedia(get().imageEntries[idx].path);
      }
    }
  },

  jumpToHistory: (index: number) => {
    const { history } = get();
    if (index < 0 || index >= history.length) return;
    set({ historyIndex: index });
    get().loadDirectory(history[index].path, { pushHistory: false });
  },

  loadDirectory: async (path, opts = {}) => {
    const { pushHistory = true, skipSelect = false, selectedPath: targetSelectedPath = null } = opts;
    const { setEntries, setLoading, setError, setFileListFilter } = get();
    setFileListFilter('');
    setLoading(true);
    setError(null);

    const normPath = normalizePath(path);

    if (pushHistory && normPath !== get().currentPath) {
      const { history, historyIndex } = get();
      const newHistory = history.slice(0, historyIndex + 1);
      let type: 'folder' | 'archive' | 'pc' | 'other' = 'folder';
      if (normPath === 'pc') type = 'pc';
      else if (isArchiveOpened(normPath)) type = 'archive';
      const name = normPath === 'pc' ? 'PC' : (normPath.split(/[/\\]/).pop() || normPath).replace('!', '');
      newHistory.push({ path: normPath, name, type });
      set({ history: newHistory, historyIndex: newHistory.length - 1 });
    }

    const resolvedPath = (isArchivePath(normPath) && !isArchiveOpened(normPath)) ? normPath + '!' : normPath;

    set({ currentPath: resolvedPath });

    try {
      const isArchive = isArchiveOpened(resolvedPath);
      const recursive = useLayoutStore.getState().recursiveMedia && isArchive;
      const result = await FileSystemAPI.listDirectory(resolvedPath, { recursive });

      if (get().currentPath !== resolvedPath) return;
      if (!result || typeof result !== 'object' || ('success' in result && result.success === false)) {
        setEntries([]);
        setError(result && typeof result === 'object' && 'error' in result ? String((result as { error: unknown }).error) : 'データの読み込みに失敗しました');
        return;
      }
      const resultFiles = 'files' in result ? (result as { files: DirectoryEntry[] }).files : [];
      const entries = Array.isArray(resultFiles) ? resultFiles : [];

      let treePath = resolvedPath;
      if (isArchive && resolvedPath.endsWith('!') && entries.length > 0) {
        const firstInner = entries[0]?.path ? String(entries[0].path).slice(resolvedPath.length) : '';
        const slashIdx = firstInner.indexOf('/');
        if (slashIdx > 0) {
          const soleDirName = firstInner.slice(0, slashIdx);
          treePath = resolvedPath + soleDirName;
          set(() => ({ currentPath: treePath }));
          set((s) => ({ treeChildren: { ...s.treeChildren, [resolvedPath]: [{ name: soleDirName, path: treePath, isDirectory: true, isArchive: false }] } }));
        }
      }

      set((s) => ({ treeChildren: { ...s.treeChildren, [treePath]: entries.filter(e => e.isDirectory || e.isArchive).map(e => ({ name: e.name, path: e.path, isDirectory: e.isDirectory, isArchive: e.isArchive })) } }));
      
      const media = entries.filter(isMediaEntry);
      let toSelect = null;
      if (!skipSelect) {
        if (targetSelectedPath) {
          toSelect = media.find(m => m.path === targetSelectedPath) || media.find(m => m.name === targetSelectedPath.split(/[/\\]/).pop());
        }
        if (!toSelect && media.length > 0) toSelect = media[0];
      }

      set({ imageEntries: media, entries, selectedPath: toSelect?.path || null, selectedPaths: toSelect?.path ? [toSelect.path] : [], error: null });
      if (toSelect?.path) await get().loadMedia(toSelect.path);
      else if (media.length === 0) set({ mediaBlobUrl: null, mediaBlobUrls: [], mediaType: null });
    } catch (err) {
      set({ entries: [], imageEntries: [] });
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  },

  prevFolder: async () => {
    const { currentPath } = get();
    if (!currentPath) return;
    const parent = getParentPath(currentPath);
    if (!parent) return;

    try {
      const result = await FileSystemAPI.listDirectory(parent);
      if (!result || typeof result !== 'object' || !('files' in result)) return;
      const files = (result as { files: DirectoryEntry[] }).files;
      const folders = files.filter(f => f.isDirectory || f.isArchive);
      const idx = folders.findIndex(f => normalizePath(f.path) === currentPath || normalizePath(f.path + '!') === currentPath);
      if (idx > 0) {
        await get().loadDirectory(folders[idx - 1].path);
      }
    } catch { /* ignore */ }
  },

  nextFolder: async () => {
    const { currentPath } = get();
    if (!currentPath) return;
    const parent = getParentPath(currentPath);
    if (!parent) return;

    try {
      const result = await FileSystemAPI.listDirectory(parent);
      if (!result || typeof result !== 'object' || !('files' in result)) return;
      const files = (result as { files: DirectoryEntry[] }).files;
      const folders = files.filter(f => f.isDirectory || f.isArchive);
      const idx = folders.findIndex(f => normalizePath(f.path) === currentPath || normalizePath(f.path + '!') === currentPath);
      if (idx >= 0 && idx < folders.length - 1) {
        await get().loadDirectory(folders[idx + 1].path);
      }
    } catch { /* ignore */ }
  },
});
