import { create } from 'zustand';
import type { DirectoryEntry, HistoryEntry } from '../types';
import { useLayoutStore } from './layoutStore';

const MEDIA_EXT = [
  '.jpg', '.jpeg', '.jpe', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif',
  '.mp4', '.webm', '.avi', '.mkv', '.mov', '.wmv', '.m4v',
  '.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac',
];
/** 拡張子は大文字小文字を区別しない */
function isMediaEntry(e: DirectoryEntry): boolean {
  if (e.isDirectory || e.isArchive) return false;
  const dotIdx = e.name.lastIndexOf('.');
  if (dotIdx < 0) return false;
  const ext = ('.' + e.name.slice(dotIdx + 1)).toLowerCase();
  return MEDIA_EXT.some((x) => ext === x);
}

interface TreeRoot {
  name: string;
  path: string;
}

export interface FavoriteEntry {
  path: string;
  name: string;
}

export type ImageDimensions = { w: number; h: number };

interface ViewerState {
  treeRoots: TreeRoot[];
  currentPath: string | null;
  entries: DirectoryEntry[];
  imageEntries: DirectoryEntry[];
  selectedPath: string | null;
  selectedPaths: string[];
  mediaBlobUrl: string | null;
  mediaBlobUrls: (string | null)[];
  mediaType: 'image' | 'video' | 'audio' | null;
  currentLoadId: number;
  isLoading: boolean;
  error: string | null;
  expandedPaths: Record<string, boolean>;
  treeChildren: Record<string, DirectoryEntry[]>;
  imageDimensions: Record<string, ImageDimensions>;
  wrapNavigation: boolean;
  history: HistoryEntry[];
  historyIndex: number;
  slideshowActive: boolean;
  slideshowInterval: number;
  favorites: FavoriteEntry[];

  setTreeRoots: (roots: TreeRoot[]) => void;
  setWrapNavigation: (v: boolean) => void;
  setCurrentPath: (path: string | null) => void;
  setEntries: (entries: DirectoryEntry[]) => void;
  setImageEntries: (entries: DirectoryEntry[]) => void;
  setSelectedPath: (path: string | null) => void;
  setSelectedPaths: (paths: string[]) => void;
  setMediaBlobUrl: (url: string | null) => void;
  setMediaBlobUrls: (urls: string[]) => void;
  setMediaType: (t: 'image' | 'video' | 'audio' | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  toggleExpand: (path: string) => void;
  expandPath: (path: string) => void;
  ensureTreeChildren: (path: string) => Promise<void>;
  refreshTreeChildren: (path: string) => void;

  ensureImageDimension: (path: string, url: string) => void;
  setImageDimensions: (path: string, dims: ImageDimensions) => void;
  setSlideshowActive: (v: boolean) => void;
  setSlideshowInterval: (v: number) => void;
  addFavorite: (path: string, name: string) => void;
  removeFavorite: (path: string) => void;
  isFavorite: (path: string) => boolean;

  canGoBack: () => boolean;
  canGoForward: () => boolean;
  goBack: () => void;
  goForward: () => void;
  goUp: () => void;
  refresh: () => Promise<void>;
  jumpToHistory: (index: number) => void;

  initTree: () => Promise<void>;
  loadDirectory: (path: string, opts?: { pushHistory?: boolean; skipSelect?: boolean; selectedPath?: string | null }) => Promise<void>;
  loadMedia: (path: string) => Promise<void>;
  move: (delta: number) => void;
  goPrev: () => void;
  goNext: () => void;
  goToFirst: () => void;
  goToLast: () => void;

  selectedEntry: () => DirectoryEntry | null;
  prevEntry: () => DirectoryEntry | null;
  nextEntry: () => DirectoryEntry | null;
  getSelectedPosition: () => { pos: number; total: number };
  expandAncestors: (path: string) => void;
  initExpandedFolders: () => Promise<void>;
  revealPath: (path: string) => Promise<void>;

  getPagesPerView: () => number;
  getVisibleEntries: () => DirectoryEntry[];
  isHydrated: boolean;
  setHydrated: (v: boolean) => void;
  isRestoring: boolean;
  setRestoring: (v: boolean) => void;
}

export const useViewerStore = create<ViewerState>((set, get) => ({
  treeRoots: [],
  currentPath: null,
  entries: [],
  imageEntries: [],
  selectedPath: null,
  selectedPaths: [],
  mediaBlobUrl: null,
  mediaBlobUrls: [],
  mediaType: null,
  currentLoadId: 0,
  isLoading: false,
  error: null,
  expandedPaths: {},
  treeChildren: {},
  imageDimensions: {},
  wrapNavigation: true,
  history: [],
  historyIndex: -1,
  slideshowActive: false,
  slideshowInterval: 3,
  favorites: [],
  isHydrated: false,
  isRestoring: false,

  setHydrated: (v) => set({ isHydrated: v }),
  setRestoring: (v) => set({ isRestoring: v }),
  setTreeRoots: (roots) => set({ treeRoots: roots }),
  setWrapNavigation: (v) => set({ wrapNavigation: v }),
  setCurrentPath: (path) => set({ currentPath: path }),
  setEntries: (entries) => set({ entries }),
  setImageEntries: (entries) =>
    set({
      imageEntries: entries,
      selectedPath: entries.length > 0 ? entries[0].path : null,
      selectedPaths: entries.length > 0 ? [entries[0].path] : [],
    }),
  setSelectedPath: (path) =>
    set({
      selectedPath: path,
      selectedPaths: path ? [path] : [],
    }),
  setSelectedPaths: (paths) => set({ selectedPaths: paths }),
  setMediaBlobUrl: (url) => set({ mediaBlobUrl: url }),
  setMediaBlobUrls: (urls: string[]) => set({ mediaBlobUrls: urls }),
  setMediaType: (t) => set({ mediaType: t }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  toggleExpand: (path) =>
    set((s) => ({
      expandedPaths: { ...s.expandedPaths, [path]: !s.expandedPaths[path] },
    })),
  expandPath: (path) =>
    set((s) => ({
      expandedPaths: { ...s.expandedPaths, [path]: true },
    })),

  ensureImageDimension: (path, url) => {
    const { imageDimensions, setImageDimensions } = get();
    if (imageDimensions[path]) return;
    const img = new Image();
    img.onload = () => {
      setImageDimensions(path, { w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = url;
  },

  setImageDimensions: (path, dims) =>
    set((s) => ({ imageDimensions: { ...s.imageDimensions, [path]: dims } })),
  setSlideshowActive: (v) => set({ slideshowActive: v }),
  setSlideshowInterval: (v) => set({ slideshowInterval: Math.max(1, v) }),
  addFavorite: (path, name) => {
    const { favorites } = get();
    if (favorites.some((f) => f.path === path)) return;
    set({ favorites: [...favorites, { path, name }] });
    saveViewerToStorage();
  },
  removeFavorite: (path) => {
    set({ favorites: get().favorites.filter((f) => f.path !== path) });
    saveViewerToStorage();
  },
  isFavorite: (path) => get().favorites.some((f) => f.path === path),

  refreshTreeChildren: (path) => {
    set((s) => {
      const next = { ...s.treeChildren };
      delete next[path];
      return { treeChildren: next };
    });
  },

  ensureTreeChildren: async (path) => {
    const { treeChildren } = get();
    if (treeChildren[path]) return;
    try {
      let children: { name: string; path: string; isDirectory: boolean; isArchive?: boolean }[];
      if (path === 'pc') {
        const drives = await window.reederr.getDrives();
        children = drives.map((d) => ({ ...d, isDirectory: true }));
      } else {
        const ARCHIVE_EXT = ['.zip', '.cbz', '.rar', '.cbr'];
        const isArchiveFile = ARCHIVE_EXT.some((ext) => path.toLowerCase().endsWith(ext)) && !path.endsWith('!');
        const resolvedPath = isArchiveFile ? path + '!' : path;

        const result = await window.reederr.listDirectory(resolvedPath);
        const resultFiles = result && typeof result === 'object' && 'files' in result ? (result as { files: DirectoryEntry[] }).files : [];
        const files = Array.isArray(resultFiles) ? resultFiles : [];
        children = files
          .filter((e) => e && (e.isDirectory || e.isArchive))
          .map((e) => ({ name: e.name, path: e.path, isDirectory: e.isDirectory, isArchive: e.isArchive ?? false }));
      }
      set((s) => ({
        treeChildren: { ...s.treeChildren, [path]: children as DirectoryEntry[] },
      }));
    } catch {
      set((s) => ({ treeChildren: { ...s.treeChildren, [path]: [] } }));
    }
  },

  initTree: async () => {
    const { treeRoots, setTreeRoots } = get();
    if (treeRoots.length > 0) return;

    const tryInit = async (retries = 10): Promise<void> => {
      try {
        if (!window.reederr?.getSpecialFolders) {
          if (retries > 0) {
            await new Promise((r) => setTimeout(r, 200));
            return tryInit(retries - 1);
          }
          get().setError('Electron API が利用できません。アプリを再起動してください。');
          return;
        }
        const roots = await window.reederr.getSpecialFolders();
        const pc = { name: 'PC', path: 'pc' };
        setTreeRoots([...roots, pc]);

        // Only load default (Downloads) if no path was restored from session
        if (!get().currentPath && roots.length >= 3) {
          const downloadsPath = roots[2].path;
          console.log('[Persistence] No session path, defaulting to Downloads:', downloadsPath);
          set({ expandedPaths: { [downloadsPath]: true } });
          await get().loadDirectory(downloadsPath);
        }
      } catch (err) {
        get().setError(err instanceof Error ? err.message : String(err));
      }
    };

    await tryInit();
  },

  loadDirectory: async (path, opts = {}) => {
    const { pushHistory = true, skipSelect = false, selectedPath: targetSelectedPath = null } = opts;
    const { setEntries, setLoading, setError } = get();
    setLoading(true);
    setError(null);
    // Don't clear imageEntries immediately to avoid UI flicker/crash during rapid navigation

    if (pushHistory && path !== get().currentPath) {
      const { history, historyIndex } = get();
      const newHistory = history.slice(0, historyIndex + 1);

      let type: 'folder' | 'archive' | 'pc' | 'other' = 'folder';
      if (path === 'pc') type = 'pc';
      else if (path.includes('!')) type = 'archive';

      const name = path === 'pc' ? 'PC' : (path.split(/[/\\]/).pop() || path).replace('!', '');

      newHistory.push({ path, name, type });
      set({ history: newHistory, historyIndex: newHistory.length - 1 });
    }

    const ARCHIVE_EXT = ['.zip', '.cbz', '.rar', '.cbr'];
    const isArchiveFile =
      ARCHIVE_EXT.some((ext) => path.toLowerCase().endsWith(ext)) && !path.endsWith('!');
    const resolvedPath = isArchiveFile ? path + '!' : path;

    const sepIdx = Math.max(resolvedPath.lastIndexOf('/'), resolvedPath.lastIndexOf('\\'));
    if (sepIdx > 0) {
      // Don't reveal parent if the current path is already an exact root node
      const isRootNode = get().treeRoots.some(r => r.path === resolvedPath) ||
        get().favorites.some(f => f.path === resolvedPath);
      if (!isRootNode) {
        get().revealPath(resolvedPath.slice(0, sepIdx));
      }
    }
    set({ currentPath: resolvedPath });

    try {
      const isArchive = resolvedPath.includes('!');
      const recursive = useLayoutStore.getState().recursiveMedia && isArchive;
      const result = await window.reederr.listDirectory(resolvedPath, { recursive });

      if (get().currentPath !== resolvedPath) return;

      if (!result || typeof result !== 'object' || ('success' in result && result.success === false)) {
        setEntries([]);
        setError(result && typeof result === 'object' && 'error' in result ? String((result as { error: unknown }).error) : 'データの読み込みに失敗しました');
        return;
      }
      const resultFiles = 'files' in result ? (result as { files: DirectoryEntry[] }).files : [];
      const rawEntries = Array.isArray(resultFiles) ? resultFiles : [];
      const entries = rawEntries.filter((e): e is DirectoryEntry => e != null && typeof e === 'object' && typeof e.name === 'string' && typeof e.path === 'string');

      let treePath = resolvedPath;
      if (isArchive && resolvedPath.endsWith('!') && entries.length > 0) {
        const first = entries[0];
        const firstInner = first?.path ? String(first.path).slice(resolvedPath.length) : '';
        const slashIdx = firstInner.indexOf('/');
        if (slashIdx > 0) {
          const soleDirName = firstInner.slice(0, slashIdx);
          const effectivePath = resolvedPath + soleDirName;
          set(() => ({ currentPath: effectivePath }));
          treePath = effectivePath;
          set((s) => ({
            treeChildren: {
              ...s.treeChildren,
              [resolvedPath]: [{ name: soleDirName, path: effectivePath, isDirectory: true, isArchive: false }],
            },
          }));
        }
      }

      const subdirs = entries.filter((e) => e?.isDirectory);
      const archives = entries.filter((e) => e?.isArchive);
      set((s) => ({
        treeChildren: {
          ...s.treeChildren,
          [treePath]: [...subdirs, ...archives].map((e) => ({
            name: e.name,
            path: e.path,
            isDirectory: e.isDirectory,
            isArchive: e.isArchive,
          })),
        },
      }));

      const media = entries.filter(isMediaEntry);

      // Determine what to select
      let toSelect = null;
      if (!skipSelect) {
        if (targetSelectedPath) {
          // Try exact match
          const found = media.find(m => m.path === targetSelectedPath);
          if (found) {
            toSelect = found;
          } else {
            // Fallback to filename
            const targetName = targetSelectedPath.split(/[/\\]/).pop();
            const foundByName = media.find(m => m.name === targetName);
            if (foundByName) toSelect = foundByName;
          }
        }
        // Final fallback to first image
        if (!toSelect && media.length > 0) {
          toSelect = media[0];
        }
      }

      // Bulk update state to reduce re-renders and potential races
      set({
        imageEntries: media,
        entries: entries,
        selectedPath: toSelect?.path || null,
        selectedPaths: toSelect?.path ? [toSelect.path] : [],
        error: null,
      });

      if (toSelect?.path) {
        await get().loadMedia(toSelect.path);
      } else if (media.length === 0) {
        set({
          mediaBlobUrl: null,
          mediaBlobUrls: [],
          mediaType: null,
        });
      }
    } catch (err) {
      set({ entries: [], imageEntries: [] });
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  },

  loadMedia: async (path) => {
    if (!path) return;
    const loadId = Math.random();
    set({ currentLoadId: loadId });

    // Determine type first to avoid intermediate null states
    const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
    const videoExt = ['.mp4', '.webm', '.avi', '.mkv', '.mov', '.wmv', '.m4v'];
    const audioExt = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'];
    const isVideo = videoExt.includes(ext);
    const isAudio = audioExt.includes(ext);
    const isImage = !isVideo && !isAudio;

    const createReederrUrl = (targetPath: string) => `reederr://get-media?path=${encodeURIComponent(targetPath)}`;

    try {
      if (isVideo || isAudio) {
        const mediaUrl = createReederrUrl(path);
        if (get().currentLoadId !== loadId) return;
        set({
          mediaBlobUrl: mediaUrl,
          mediaBlobUrls: [],
          mediaType: isVideo ? 'video' : 'audio',
          error: null
        });
      } else {
        const visible = get().getVisibleEntries();
        const urls = visible.map((ent) => createReederrUrl(ent.path));

        if (get().currentLoadId !== loadId) return;
        set({
          mediaBlobUrl: urls[0] ?? null,
          mediaBlobUrls: urls,
          mediaType: 'image',
          error: null
        });

        // Ensure dimensions for current visible images
        visible.forEach(ent => get().ensureImageDimension(ent.path, createReederrUrl(ent.path)));
      }

      // Sliding Window Preloading (Fire and forget)
      const allEntries = isVideo || isAudio ? get().entries : get().imageEntries;
      const currentIndex = allEntries.findIndex((e) => e.path === path);

      if (currentIndex >= 0) {
        // Preload next 2 pages (or next 4 if spread view)
        const pagesPerView = isImage ? get().getPagesPerView() : 1;
        const preloadCount = pagesPerView * 2;
        const preloads = [];
        for (let i = pagesPerView; i < pagesPerView + preloadCount; i++) {
          const idx = currentIndex + i;
          if (idx < allEntries.length) preloads.push(allEntries[idx]);
        }

        preloads.forEach((ent) => {
          const e = ent.path.slice(ent.path.lastIndexOf('.')).toLowerCase();
          const pIsVideo = videoExt.includes(e);
          const pIsAudio = audioExt.includes(e);
          const url = createReederrUrl(ent.path);

          if (pIsVideo || pIsAudio) {
            const media = document.createElement(pIsVideo ? 'video' : 'audio');
            media.preload = 'metadata';
            media.src = url;
          } else {
            get().ensureImageDimension(ent.path, url);
            const img = new Image();
            img.src = url;
            img.decode().catch(() => { });
          }
        });
      }

    } catch (err) {
      get().setError(err instanceof Error ? err.message : String(err));
    }
  },

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

    const sepIdx = currentPath.indexOf('!');
    if (sepIdx >= 0) {
      // Inside archive
      const archivePath = currentPath.slice(0, sepIdx);
      const innerPath = currentPath.slice(sepIdx + 1).replace(/\\/g, '/').replace(/\/+$/, '');
      if (innerPath === '' || innerPath === '/') {
        // At archive root -> go to archive's parent folder
        const parentFolder = archivePath.replace(/[/\\][^/\\]+$/, '');
        if (parentFolder && parentFolder !== archivePath) {
          get().loadDirectory(parentFolder);
        }
      } else {
        // Go up one level inside archive
        const parentInner = innerPath.replace(/\/[^/]+$/, '');
        const newPath = archivePath + '!' + (parentInner ? parentInner : '');
        get().loadDirectory(newPath);
      }
    } else {
      // Regular file system
      const parent = currentPath.replace(/[/\\][^/\\]+$/, '');
      if (parent && parent !== currentPath) {
        get().loadDirectory(parent);
      }
    }
  },

  refresh: async () => {
    const { currentPath, selectedPath } = get();
    if (!currentPath) return;

    // Remember the current file before reloading
    const rememberedPath = selectedPath;

    // Reload the directory (this resets selection to first media)
    await get().loadDirectory(currentPath, { pushHistory: false });

    // After reload, try to restore position
    if (rememberedPath) {
      const newImageEntries = get().imageEntries;
      const idx = newImageEntries.findIndex((e) => e.path === rememberedPath);
      if (idx >= 0) {
        // Found the same file — restore selection and media
        get().setSelectedPath(newImageEntries[idx].path);
        await get().loadMedia(newImageEntries[idx].path);
      }
      // If not found (idx === -1), loadDirectory already set it to the first image
    }
  },

  jumpToHistory: (index: number) => {
    const { history } = get();
    if (index < 0 || index >= history.length) return;
    set({ historyIndex: index });
    get().loadDirectory(history[index].path, { pushHistory: false });
  },

  goToFirst: () => {
    const { imageEntries } = get();
    const sorted = getSortedEntries(imageEntries);
    if (sorted.length === 0) return;
    const entry = sorted[0];
    get().setSelectedPath(entry.path);
    get().loadMedia(entry.path);
  },

  goToLast: () => {
    const { imageEntries } = get();
    const sorted = getSortedEntries(imageEntries);
    if (sorted.length === 0) return;
    const entry = sorted[sorted.length - 1];
    get().setSelectedPath(entry.path);
    get().loadMedia(entry.path);
  },

  move: (delta) => {
    const { imageEntries, selectedPath, wrapNavigation } = get();
    const sorted = getSortedEntries(imageEntries);
    const len = sorted.length;
    if (len === 0) return;
    const idx = sorted.findIndex((e) => e.path === selectedPath);
    const cur = idx < 0 ? 0 : idx;
    let newIdx: number;
    if (wrapNavigation) {
      newIdx = ((cur + delta) % len + len) % len;
    } else {
      newIdx = Math.max(0, Math.min(len - 1, cur + delta));
    }
    if (newIdx < 0 || newIdx >= len) return;
    const entry = sorted[newIdx];
    if (entry.path === selectedPath) return;
    get().setSelectedPath(entry.path);
    get().loadMedia(entry.path);
  },

  goPrev: () => {
    get().move(-1);
  },

  goNext: () => {
    get().move(1);
  },

  selectedEntry: () => {
    const { imageEntries, selectedPath } = get();
    return imageEntries.find((e) => e.path === selectedPath) ?? null;
  },
  prevEntry: () => {
    const { imageEntries, selectedPath, wrapNavigation } = get();
    const sorted = getSortedEntries(imageEntries);
    if (sorted.length === 0) return null;
    const idx = sorted.findIndex((e) => e.path === selectedPath);
    const cur = idx < 0 ? 0 : idx;
    const len = sorted.length;
    let newIdx: number;
    if (wrapNavigation) {
      newIdx = (cur - 1 + len) % len; // Simple fallback to -1 for entry cache, prev actual logic is in goPrev
    } else {
      newIdx = Math.max(0, cur - 1);
      if (newIdx === cur) return null;
    }
    return sorted[newIdx];
  },
  nextEntry: () => {
    const { imageEntries, selectedPath, wrapNavigation } = get();
    const sorted = getSortedEntries(imageEntries);
    if (sorted.length === 0) return null;
    const idx = sorted.findIndex((e) => e.path === selectedPath);
    const cur = idx < 0 ? 0 : idx;
    const len = sorted.length;
    const step = get().getVisibleEntries().length;
    let newIdx: number;
    if (wrapNavigation) {
      newIdx = (cur + step) % len;
    } else {
      newIdx = Math.min(len - 1, cur + step);
      if (newIdx === cur) return null;
    }
    return sorted[newIdx];
  },

  getSelectedPosition: () => {
    const { imageEntries, selectedPath } = get();
    const sorted = getSortedEntries(imageEntries);
    const idx = sorted.findIndex((e) => e.path === selectedPath);
    return {
      pos: idx >= 0 ? idx + 1 : 0,
      total: sorted.length,
    };
  },

  expandAncestors: (path: string) => {
    if (!path || path === 'pc') return;
    set((s) => ({ expandedPaths: { ...s.expandedPaths, [path]: true } }));
    const sepIdx = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    if (sepIdx > 0) {
      get().expandAncestors(path.slice(0, sepIdx));
    }
  },

  initExpandedFolders: async () => {
    const { expandedPaths, ensureTreeChildren } = get();
    const paths = Object.keys(expandedPaths).filter(p => expandedPaths[p]);
    console.log('[Persistence] Thawing expanded folders:', paths.length);
    // Load concurrently to speed up startup
    await Promise.all(paths.map(p => ensureTreeChildren(p)));
  },

  revealPath: async (path: string) => {
    if (!path || path === 'pc') return;

    const { treeRoots, favorites, ensureTreeChildren } = get();

    // 1. Collect all possible "Root" candidates from treeRoots and favorites
    // We filter for results that have a physical path
    // We add a "type" to properly enforce Priority: Favorite > Special
    const candidates = [
      ...favorites.map(f => ({ name: f.name, path: f.path, type: 'favorite' })),
      ...treeRoots.filter(r => r.path !== 'pc').map(r => ({ name: r.name, path: r.path, type: 'special' }))
    ];

    // 2. Longest Prefix Match
    // Normalize paths for comparison (optional but good for stability)
    const normPath = path.toLowerCase().replace(/\\/g, '/');
    let bestMatch: { name: string, path: string, type: string } | null = null;

    for (const cand of candidates) {
      const normCand = cand.path.toLowerCase().replace(/\\/g, '/');
      const normCandWithSlash = normCand.endsWith('/') ? normCand : normCand + '/';

      // Match if identical or if cand is a parent folder
      if (normPath === normCand || normPath.startsWith(normCandWithSlash)) {
        if (!bestMatch || cand.path.length > bestMatch.path.length) {
          bestMatch = cand;
        } else if (cand.path.length === bestMatch.path.length && cand.type === 'favorite') {
          // If equal length, prefer favorite type over special type
          bestMatch = cand;
        }
      }
    }

    let ancestors: string[] = [];

    if (bestMatch) {
      console.log('[Persistence] Reveal starting from special/favorite root:', bestMatch.name, bestMatch.path);
      const prefix = bestMatch.type === 'favorite' ? 'favorite' : 'special';
      ancestors.push(`${prefix}-${bestMatch.path}`);

      // We only process the remaining path, appending it to bestMatch.path
      const remainingPath = path.slice(bestMatch.path.length);
      if (remainingPath) {
        const parts = remainingPath.split(/([/\\]|!)/).filter(p => p !== '');
        let current = bestMatch.path;
        for (const part of parts) {
          current += part;
          const isSeparator = part === '\\' || part === '/' || part === '!';
          if (!isSeparator && current !== bestMatch.path) {
            ancestors.push(`${prefix}-${current}`);
          }
        }
      }
    } else {
      // Fallback to PC root for absolute paths
      if (path.includes(':') || path.startsWith('\\') || path.startsWith('/')) {
        console.log('[Persistence] Reveal starting from PC root');
        ancestors.push('pc-pc');
        const parts = path.split(/([/\\]|!)/).filter(p => p !== '');
        let current = '';
        for (const part of parts) {
          current += part;
          const isSeparator = part === '\\' || part === '/' || part === '!';
          const isDriveRoot = /^[a-zA-Z]:[/\\]$/.test(current);
          
          if (isDriveRoot) {
            ancestors.push(`pc-${current}`);
          } else if (!isSeparator) {
            ancestors.push(`pc-${current}`);
          }
        }
      } else {
        return; // Relative path or unknown
      }
    }

    // Deduplicate ancestors sequentially
    ancestors = Array.from(new Set(ancestors));

    console.log('[Persistence] Revealing path ancestors:', ancestors);

    for (const anc of ancestors) {
      // Expand first so UI can start rendering branches while loading children
      set((s) => ({ expandedPaths: { ...s.expandedPaths, [anc]: true } }));
      await ensureTreeChildren(anc);
    }
  },

  getPagesPerView: () => {
    return get().getVisibleEntries().length;
  },

  getVisibleEntries: () => {
    const { imageEntries, selectedPath, imageDimensions } = get();
    const { viewMode, binding, autoSpreadCover } = useLayoutStore.getState();
    const sorted = getSortedEntries(imageEntries);
    const idx = sorted.findIndex((e) => e.path === selectedPath);
    if (idx < 0) return [];

    let isDouble = false;
    const hasNext = idx + 1 < sorted.length;

    if (viewMode === 'spread') {
      isDouble = hasNext;
    } else if (viewMode === 'auto') {
      if (idx === 0 && autoSpreadCover) {
        // Rule A (Cover)
        isDouble = false;
      } else {
        const currentDims = imageDimensions[sorted[idx].path];
        if (currentDims && currentDims.w > currentDims.h) {
          // Rule B (Landscape current)
          isDouble = false;
        } else if (hasNext) {
          // Rule C (Portrait current + Check Next)
          const nextDims = imageDimensions[sorted[idx + 1].path];
          if (nextDims && nextDims.w > nextDims.h) {
            // Next is landscape -> Current stays single
            isDouble = false;
          } else {
            // Both are portrait (or dimensions not yet loaded, default to double)
            isDouble = true;
          }
        }
      }
    }

    if (!isDouble) return [sorted[idx]];

    return binding === 'rtl'
      ? [sorted[idx + 1], sorted[idx]]
      : [sorted[idx], sorted[idx + 1]];
  },
}));

const VIEWER_KEY = 'viewer';

export async function loadViewerFromStorage(): Promise<void> {
  try {
    const raw = await window.reederr.loadStore();
    const data = raw[VIEWER_KEY] as any;
    if (data) {
      console.log('[Persistence] Loaded viewer state:', Object.keys(data));
      useViewerStore.setState(() => ({
        ...(data.currentPath && { currentPath: data.currentPath }),
        ...(data.selectedPath && { selectedPath: data.selectedPath }),
        ...(Array.isArray(data.history) && { history: data.history }),
        ...(data.historyIndex != null && { historyIndex: data.historyIndex }),
        ...(Array.isArray(data.favorites) && { favorites: data.favorites }),
        ...(data.expandedPaths && { expandedPaths: data.expandedPaths }),
        isHydrated: true,
      }));
    } else {
      useViewerStore.getState().setHydrated(true);
    }
  } catch (err) {
    console.error('[Persistence] Failed to load viewer state:', err);
    useViewerStore.getState().setHydrated(true);
  }
}

export function saveViewerToStorage(): void {
  const state = useViewerStore.getState();
  if (state.isRestoring || !state.isHydrated) {
    console.log('[Persistence] Save skipped (restoring or not hydrated)');
    return;
  }
  const { currentPath, selectedPath, history, historyIndex, favorites, expandedPaths } = state;
  const data = {
    currentPath,
    selectedPath,
    history,
    historyIndex,
    favorites,
    expandedPaths,
  };
  console.log('[Persistence] Saving viewer state:', Object.keys(data));
  window.reederr.saveStore({
    [VIEWER_KEY]: data,
  });
}

function getSortedEntries(entries: DirectoryEntry[]): DirectoryEntry[] {
  const { fileListSortBy, fileListSortOrder } = useLayoutStore.getState();
  const mul = fileListSortOrder === 'asc' ? 1 : -1;
  return [...entries].sort((a, b) => {
    let cmp = 0;
    if (fileListSortBy === 'name') {
      cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    } else if (fileListSortBy === 'size') {
      cmp = (a.size ?? 0) - (b.size ?? 0);
    } else if (fileListSortBy === 'mtime') {
      cmp = (a.mtime ?? 0) - (b.mtime ?? 0);
    } else {
      cmp = getFileTypeForSort(a).localeCompare(getFileTypeForSort(b));
    }
    return cmp * mul;
  });
}

function getFileTypeForSort(e: DirectoryEntry): string {
  if (e.isDirectory) return 'フォルダ';
  if (e.isArchive) return e.name.slice(e.name.lastIndexOf('.')).toUpperCase();
  const ext = e.name.slice(e.name.lastIndexOf('.')).toLowerCase();
  const map: Record<string, string> = {
    '.jpg': 'a', '.jpeg': 'b', '.png': 'c', '.gif': 'd', '.webp': 'e', '.bmp': 'f',
    '.mp4': 'g', '.webm': 'h', '.avi': 'i', '.mkv': 'j', '.mov': 'k', '.wmv': 'l', '.m4v': 'm',
    '.mp3': 'n', '.wav': 'o', '.ogg': 'p', '.flac': 'q', '.m4a': 'r', '.aac': 's',
  };
  return map[ext] ?? ext;
}
