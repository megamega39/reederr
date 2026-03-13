/// <reference types="vite/client" />

interface ReederrAPI {
  getFileIcon: (absPath: string, size?: 16 | 20) => Promise<{ ok: true; value: string } | { ok: false; error: string }>;
  getSpecialFolders: () => Promise<{ ok: true; value: Array<{ name: string; path: string }> } | { ok: false; error: string }>;
  getDrives: () => Promise<{ ok: true; value: Array<{ name: string; path: string }> } | { ok: false; error: string }>;
  getNetworkResources: () => Promise<{ ok: true; value: any[] } | { ok: false; error: string }>;
  selectFolder: () => Promise<{ ok: true; value: { path: string } | null } | { ok: false; error: string }>;
  selectFile: () => Promise<{ ok: true; value: { path: string } | null } | { ok: false; error: string }>;
  listDirectory: (path: string, options?: { recursive?: boolean; skipStats?: boolean }) => Promise<
     { ok: true; value: Array<{ name: string; path: string; isDirectory: boolean; isArchive: boolean; size?: number; mtime?: number }> }
    | { ok: false; error: string }
  >;
  readFile: (path: string) => Promise<{ ok: true; value: ArrayBuffer } | { ok: false; error: string }>;
  stat: (path: string) => Promise<{ ok: true; value: { size: number; isDirectory: boolean; mtime?: number } | null } | { ok: false; error: string }>;
  getPathUserData: () => Promise<{ ok: true; value: string } | { ok: false; error: string }>;
  openInExplorer: (path: string) => Promise<{ ok: true; value: void } | { ok: false; error: string }>;
  copyPath: (path: string) => Promise<{ ok: true; value: void } | { ok: false; error: string }>;
  copyParentPath: (path: string) => Promise<{ ok: true; value: void } | { ok: false; error: string }>;
  showInExplorer: (path: string) => Promise<{ ok: true; value: void } | { ok: false; error: string }>;
  createFolder: (parentPath: string, name: string) => Promise<{ ok: true; value: void } | { ok: false; error: string }>;
  renameFolder: (path: string, newName: string) => Promise<{ ok: true; value: void } | { ok: false; error: string }>;
  deleteFolder: (path: string) => Promise<{ ok: true; value: void } | { ok: false; error: string }>;
  renameFile: (path: string, newName: string) => Promise<{ ok: true; value: void } | { ok: false; error: string }>;
  deleteFile: (path: string) => Promise<{ ok: true; value: void } | { ok: false; error: string }>;
  getMediaUrl: (vpath: string, preferHttp?: boolean) => Promise<{ ok: true; value: string } | { ok: false; error: string }>;
  getMediaUrls: (vpaths: string[], preferHttp?: boolean) => Promise<{ ok: true; value: string[] } | { ok: false; error: string }>;
  releaseMediaUrl: (url: string) => Promise<{ ok: true; value: void } | { ok: false; error: string }>;
  setPreviewFullscreen: (fullscreen: boolean) => Promise<{ ok: true; value: void } | { ok: false; error: string }>;
  onPreviewFullscreenChanged: (callback: (fullscreen: boolean) => void) => () => void;
  getUserSettings: () => Promise<{ ok: true; value: Record<string, unknown> } | { ok: false; error: string }>;
  setUserSettings: (data: Record<string, unknown>) => Promise<{ ok: true; value: void } | { ok: false; error: string }>;
  is7zAvailable: () => Promise<{ ok: true; value: boolean } | { ok: false; error: string }>;
  onMenuNav: (cb: (action: string) => void) => () => void;
  onMenuViewMode: (cb: (mode: string) => void) => () => void;
  onMenuBinding: (cb: (b: string) => void) => () => void;
  onMenuSettings: (cb: () => void) => () => void;
  onMenuFullscreen: (cb: () => void) => () => void;
  onMenuOpenFile: (cb: (path: string) => void) => () => void;
  onMenuOpenFolder: (cb: (path: string) => void) => () => void;
  onMenuCopyPath: (cb: () => void) => () => void;
  onMenuZoom: (cb: (action: string) => void) => () => void;
  onMenuHelp: (cb: () => void) => () => void;
  loadStore: () => Promise<{ ok: true; value: Record<string, unknown> } | { ok: false; error: string }>;
  saveStore: (data: Record<string, unknown>) => Promise<{ ok: true; value: void } | { ok: false; error: string }>;
  openWithApp: (path: string, appPath: string) => Promise<{ ok: true; value: void } | { ok: false; error: string }>;
  onShowToast: (cb: (message: string, type: 'info' | 'success' | 'warn' | 'error', duration?: number) => void) => () => void;
  rebuildMenu: (lang: string) => Promise<{ ok: true; value: void } | { ok: false; error: string }>;
  watchDirectory: (path: string) => Promise<{ ok: true; value: void } | { ok: false; error: string }>;
  onFileSystemChanged: (cb: (payload: { path: string }) => void) => () => void;
  getThumbnail: (path: string, width: number, height: number) => Promise<{ ok: true; value: string | null } | { ok: false; error: string }>;
}

interface Window {
  reederr: ReederrAPI;
}
