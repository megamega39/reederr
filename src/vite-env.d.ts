/// <reference types="vite/client" />

interface ReederrAPI {
  getFileIcon: (absPath: string, size?: 16 | 20) => Promise<string>;
  getSpecialFolders: () => Promise<Array<{ name: string; path: string }>>;
  getDrives: () => Promise<Array<{ name: string; path: string }>>;
  selectFolder: () => Promise<{ path: string } | null>;
  listDirectory: (path: string, options?: { recursive?: boolean }) => Promise<
    Array<{
      name: string;
      path: string;
      isDirectory: boolean;
      isArchive: boolean;
    }>
  >;
  readFile: (path: string) => Promise<ArrayBuffer>;
  stat: (path: string) => Promise<{
    size: number;
    isDirectory: boolean;
    mtime?: number;
  } | null>;
  getPathUserData: () => Promise<string>;
  openInExplorer: (path: string) => Promise<void>;
  copyPath: (path: string) => Promise<void>;
  copyParentPath: (path: string) => Promise<void>;
  showInExplorer: (path: string) => Promise<void>;
  createFolder: (parentPath: string, name: string) => Promise<{ ok: boolean; error?: string }>;
  renameFolder: (path: string, newName: string) => Promise<{ ok: boolean; error?: string }>;
  deleteFolder: (path: string) => Promise<{ ok: boolean; error?: string }>;
  renameFile: (path: string, newName: string) => Promise<{ ok: boolean; error?: string }>;
  deleteFile: (path: string) => Promise<{ ok: boolean; error?: string }>;
  getMediaUrl: (vpath: string, preferHttp?: boolean) => Promise<string>;
  releaseMediaUrl: (url: string) => Promise<void>;
  setPreviewFullscreen: (fullscreen: boolean) => Promise<void>;
  onPreviewFullscreenChanged: (callback: (fullscreen: boolean) => void) => () => void;
  getUserSettings: () => Promise<Record<string, unknown>>;
  setUserSettings: (data: Record<string, unknown>) => Promise<void>;
  is7zAvailable: () => Promise<boolean>;
  onMenuNav: (cb: (action: string) => void) => () => void;
  onMenuViewMode: (cb: (mode: string) => void) => () => void;
  onMenuBinding: (cb: (b: string) => void) => () => void;
  onMenuSettings: (cb: () => void) => () => void;
  onMenuFullscreen: (cb: () => void) => () => void;
  onMenuOpenFile: (cb: (path: string) => void) => () => void;
  onMenuOpenFolder: (cb: (path: string) => void) => () => void;
  onMenuCopyPath: (cb: () => void) => () => void;
  onMenuZoom: (cb: (action: string) => void) => () => void;
  loadStore: () => Promise<Record<string, unknown>>;
  saveStore: (data: Record<string, unknown>) => Promise<void>;
  openWithApp: (path: string, appPath: string) => Promise<{ ok: boolean; error?: string }>;
  selectFile: () => Promise<{ path: string } | null>;
  onShowToast: (cb: (message: string, type: 'info' | 'success' | 'warn' | 'error', duration?: number) => void) => () => void;
}

interface Window {
  reederr: ReederrAPI;
}
