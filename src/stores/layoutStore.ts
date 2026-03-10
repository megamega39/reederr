import { create } from 'zustand';

export type FileListSortBy = 'name' | 'size' | 'type' | 'mtime';
export type FileListSortOrder = 'asc' | 'desc';
export type FileListColumnId = 'name' | 'size' | 'type' | 'mtime';
export type ViewMode = 'single' | 'spread' | 'auto';
export type Binding = 'rtl' | 'ltr';
export type ScaleMode = 'fit-window' | 'fit-width' | 'fit-height' | 'original';

interface LayoutState {
  leftPaneWidth: number;
  folderPaneHeight: number;
  isPreviewFullscreen: boolean;
  viewMode: ViewMode;
  binding: Binding;
  autoThreshold: number;
  scaleMode: ScaleMode;
  catalogMode: boolean;
  autoSpreadCover: boolean;
  /** サブフォルダも含めて画像を再帰表示 */
  recursiveMedia: boolean;
  fileListSortBy: FileListSortBy;
  fileListSortOrder: FileListSortOrder;
  fileListColName: number;
  fileListColSize: number;
  fileListColType: number;
  fileListColMtime: number;
  fileListColumnOrder: FileListColumnId[];

  setLeftPaneWidth: (px: number) => void;
  togglePreviewFullscreen: () => void;
  setPreviewFullscreen: (v: boolean) => void;
  setFolderPaneHeight: (px: number) => void;
  setViewMode: (m: ViewMode) => void;
  setBinding: (b: Binding) => void;
  setAutoThreshold: (t: number) => void;
  setScaleMode: (m: ScaleMode) => void;
  setCatalogMode: (v: boolean) => void;
  setAutoSpreadCover: (v: boolean) => void;
  setRecursiveMedia: (v: boolean) => void;
  setFileListSort: (by: FileListSortBy, order?: FileListSortOrder) => void;
  setFileListColName: (px: number) => void;
  setFileListColSize: (px: number) => void;
  setFileListColType: (px: number) => void;
  setFileListColMtime: (px: number) => void;
  setFileListColumnOrder: (order: FileListColumnId[]) => void;
  isHydrated: boolean;
  setHydrated: (v: boolean) => void;
  isRestoring: boolean;
  setRestoring: (v: boolean) => void;
}

const MIN_LEFT = 40;
const DEFAULT_LEFT = 300;

const MIN_FOLDER = 40;
const DEFAULT_FOLDER = 140;

const MIN_COL = 30;
const DEFAULT_NAME = 120;
const DEFAULT_SIZE = 70;
const DEFAULT_TYPE = 100;
const DEFAULT_MTIME = 120;

const DEFAULT_AUTO_THRESHOLD = 1.35;
const LAYOUT_KEY = 'layout';

export const useLayoutStore = create<LayoutState>((set) => ({
  leftPaneWidth: DEFAULT_LEFT,
  folderPaneHeight: DEFAULT_FOLDER,
  isPreviewFullscreen: false,
  viewMode: 'auto',
  binding: 'rtl',
  autoThreshold: DEFAULT_AUTO_THRESHOLD,
  scaleMode: 'fit-window',
  catalogMode: false,
  autoSpreadCover: true,
  recursiveMedia: false,
  fileListSortBy: 'name',
  fileListSortOrder: 'asc',
  fileListColName: DEFAULT_NAME,
  fileListColSize: DEFAULT_SIZE,
  fileListColType: DEFAULT_TYPE,
  fileListColMtime: DEFAULT_MTIME,
  fileListColumnOrder: ['name', 'size', 'type', 'mtime'],

  setLeftPaneWidth: (px) =>
    set({ leftPaneWidth: Math.max(MIN_LEFT, px) }),

  setFolderPaneHeight: (px) =>
    set({ folderPaneHeight: Math.max(MIN_FOLDER, px) }),

  togglePreviewFullscreen: () =>
    set((s) => ({ isPreviewFullscreen: !s.isPreviewFullscreen })),

  setPreviewFullscreen: (v) =>
    set({ isPreviewFullscreen: v }),

  setViewMode: (m) => set({ viewMode: m }),
  setBinding: (b) => set({ binding: b }),
  setAutoThreshold: (t) =>
    set({ autoThreshold: Math.max(1.1, Math.min(1.8, t)) }),
  setScaleMode: (m) => set({ scaleMode: m }),
  setCatalogMode: (v) => set({ catalogMode: v }),
  setAutoSpreadCover: (v) => set({ autoSpreadCover: v }),
  setRecursiveMedia: (v) => set({ recursiveMedia: v }),

  setFileListSort: (by, order) =>
    set((s) => ({
      fileListSortBy: by,
      fileListSortOrder:
        order ?? (s.fileListSortBy === by && s.fileListSortOrder === 'asc' ? 'desc' : 'asc'),
    })),

  setFileListColName: (px) =>
    set({ fileListColName: Math.max(MIN_COL, px) }),
  setFileListColSize: (px) =>
    set({ fileListColSize: Math.max(MIN_COL, px) }),
  setFileListColType: (px) =>
    set({ fileListColType: Math.max(MIN_COL, px) }),
  setFileListColMtime: (px) =>
    set({ fileListColMtime: Math.max(MIN_COL, px) }),

  setFileListColumnOrder: (order) =>
    set({ fileListColumnOrder: order }),

  isHydrated: false,
  setHydrated: (v) => set({ isHydrated: v }),
  isRestoring: false,
  setRestoring: (v) => set({ isRestoring: v }),
}));

export async function loadLayoutFromStorage(): Promise<void> {
  try {
    const raw = await window.reederr.loadStore();
    const data = raw[LAYOUT_KEY] as any;
    if (data) {
      console.log('[Persistence] Loaded layout state:', Object.keys(data));
      useLayoutStore.setState((state) => ({
        ...state,
        ...data,
        isHydrated: true,
      }));
    } else {
      useLayoutStore.getState().setHydrated(true);
    }
  } catch (err) {
    console.error('[Persistence] Failed to load layout state:', err);
    useLayoutStore.getState().setHydrated(true);
  }
}

export function saveLayoutToStorage(): void {
  const state = useLayoutStore.getState();
  if (state.isRestoring || !state.isHydrated) {
    console.log('[Persistence] Layout save skipped (restoring or not hydrated)');
    return;
  }
  const {
    leftPaneWidth,
    folderPaneHeight,
    viewMode,
    binding,
    autoThreshold,
    scaleMode,
    catalogMode,
    recursiveMedia,
    fileListSortBy,
    fileListSortOrder,
    fileListColumnOrder,
    fileListColName,
    fileListColSize,
    fileListColType,
    fileListColMtime,
  } = state;

  const data = {
    leftPaneWidth,
    folderPaneHeight,
    viewMode,
    binding,
    autoThreshold,
    scaleMode,
    catalogMode,
    recursiveMedia,
    fileListSortBy,
    fileListSortOrder,
    fileListColumnOrder,
    fileListColName,
    fileListColSize,
    fileListColType,
    fileListColMtime,
  };

  console.log('[Persistence] Saving layout state:', Object.keys(data));
  window.reederr.saveStore({
    [LAYOUT_KEY]: data,
  });
}
