import { DirectoryEntry, HistoryEntry } from '../types';

export interface TreeRoot {
  name: string;
  path: string;
}

export interface FavoriteEntry {
  path: string;
  name: string;
}

export type ImageDimensions = { w: number; h: number };

export interface ViewerState {
  // State
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
  isHydrated: boolean;
  isRestoring: boolean;
  editingNodeId: string | null;
  fileListFilter: string;
  language: 'ja' | 'en';

  // Actions
  setLanguage: (lang: 'ja' | 'en') => void;
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
  goPrevPage: () => void;
  goNextPage: () => void;
  prevFolder: () => Promise<void>;
  nextFolder: () => Promise<void>;
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
  setHydrated: (v: boolean) => void;
  setRestoring: (v: boolean) => void;
  setEditingNodeId: (id: string | null) => void;
  setFileListFilter: (v: string) => void;
}
