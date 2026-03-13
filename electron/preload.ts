import { contextBridge, ipcRenderer } from 'electron';

export interface ReederrAPI {
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
  onDirectoryChunk: (cb: (payload: { path: string; files: any[] }) => void) => () => void;
}

const api: ReederrAPI = {
  getFileIcon: (absPath, size = 16) =>
    ipcRenderer.invoke('get-file-icon', { absPath, size: size ?? 16 }),
  getSpecialFolders: () => ipcRenderer.invoke('get-special-folders'),
  getDrives: () => ipcRenderer.invoke('get-drives'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFile: () => ipcRenderer.invoke('select-file'),
  listDirectory: (path, options) =>
    ipcRenderer.invoke('list-directory', { path, recursive: options?.recursive }),
  readFile: (path) => ipcRenderer.invoke('read-file', { path }),
  stat: (path) => ipcRenderer.invoke('stat', { path }),
  getPathUserData: () => ipcRenderer.invoke('get-path-userData'),
  openInExplorer: (path) => ipcRenderer.invoke('open-in-explorer', { path }),
  copyPath: (path) => ipcRenderer.invoke('copy-path', { path }),
  copyParentPath: (path) => ipcRenderer.invoke('copy-parent-path', { path }),
  showInExplorer: (path) => ipcRenderer.invoke('show-in-explorer', { path }),
  createFolder: (parentPath, name) => ipcRenderer.invoke('create-folder', { parentPath, name }),
  renameFolder: (path, newName) => ipcRenderer.invoke('rename-folder', { path, newName }),
  deleteFolder: (path) => ipcRenderer.invoke('delete-folder', { path }),
  renameFile: (path, newName) => ipcRenderer.invoke('rename-file', { path, newName }),
  deleteFile: (path) => ipcRenderer.invoke('delete-file', { path }),
  getMediaUrl: (vpath, preferHttp) => ipcRenderer.invoke('get-media-url', { vpath, preferHttp }),
  getMediaUrls: (vpaths, preferHttp) => ipcRenderer.invoke('get-media-urls', { vpaths, preferHttp }),
  releaseMediaUrl: (url) => ipcRenderer.invoke('release-media-url', { url }),
  setPreviewFullscreen: (fullscreen) => ipcRenderer.invoke('set-preview-fullscreen', { fullscreen }),
  onPreviewFullscreenChanged: (callback) => {
    const fn = (_: unknown, fullscreen: boolean) => callback(fullscreen);
    ipcRenderer.on('preview-fullscreen-changed', fn);
    return () => ipcRenderer.removeListener('preview-fullscreen-changed', fn);
  },
  getUserSettings: () => ipcRenderer.invoke('get-user-settings'),
  setUserSettings: (data) => ipcRenderer.invoke('set-user-settings', { data }),
  openWithApp: (path, appPath) => ipcRenderer.invoke('open-with-app', { path, appPath }),
  is7zAvailable: () => ipcRenderer.invoke('is-7z-available'),
  getNetworkResources: () => ipcRenderer.invoke('get-network-resources'),
  onMenuNav: (cb) => {
    const fn = (_: unknown, a: string) => cb(a);
    ipcRenderer.on('menu-nav', fn);
    return () => ipcRenderer.removeListener('menu-nav', fn);
  },
  onMenuViewMode: (cb) => {
    const fn = (_: unknown, m: string) => cb(m);
    ipcRenderer.on('menu-view-mode', fn);
    return () => ipcRenderer.removeListener('menu-view-mode', fn);
  },
  onMenuBinding: (cb) => {
    const fn = (_: unknown, b: string) => cb(b);
    ipcRenderer.on('menu-binding', fn);
    return () => ipcRenderer.removeListener('menu-binding', fn);
  },
  onMenuSettings: (cb) => {
    const fn = () => cb();
    ipcRenderer.on('menu-settings', fn);
    return () => ipcRenderer.removeListener('menu-settings', fn);
  },
  onMenuFullscreen: (cb) => {
    const fn = () => cb();
    ipcRenderer.on('menu-fullscreen', fn);
    return () => ipcRenderer.removeListener('menu-fullscreen', fn);
  },
  onMenuOpenFile: (cb) => {
    const fn = (_: unknown, p: string) => cb(p);
    ipcRenderer.on('menu-open-file', fn);
    return () => ipcRenderer.removeListener('menu-open-file', fn);
  },
  onMenuOpenFolder: (cb) => {
    const fn = (_: unknown, p: string) => cb(p);
    ipcRenderer.on('menu-open-folder', fn);
    return () => ipcRenderer.removeListener('menu-open-folder', fn);
  },
  onMenuCopyPath: (cb) => {
    const fn = () => cb();
    ipcRenderer.on('menu-copy-path', fn);
    return () => ipcRenderer.removeListener('menu-copy-path', fn);
  },
  onMenuZoom: (cb) => {
    const fn = (_: unknown, a: string) => cb(a);
    ipcRenderer.on('menu-zoom', fn);
    return () => ipcRenderer.removeListener('menu-zoom', fn);
  },
  onMenuHelp: (cb) => {
    const fn = () => cb();
    ipcRenderer.on('menu-help', fn);
    return () => ipcRenderer.removeListener('menu-help', fn);
  },
  loadStore: () => ipcRenderer.invoke('load-store'),
  saveStore: (data) => ipcRenderer.invoke('save-store', { data }),
  onShowToast: (cb) => {
    const fn = (_: unknown, m: string, t: 'info' | 'success' | 'warn' | 'error', d?: number) => cb(m, t, d);
    ipcRenderer.on('show-toast', fn);
    return () => ipcRenderer.removeListener('show-toast', fn);
  },
  rebuildMenu: (lang) => ipcRenderer.invoke('rebuild-menu', { lang }),
  watchDirectory: (path) => ipcRenderer.invoke('watch-directory', { path }),
  onFileSystemChanged: (cb) => {
    const fn = (_: unknown, payload: { path: string }) => cb(payload);
    ipcRenderer.on('file-system-changed', fn);
    return () => ipcRenderer.removeListener('file-system-changed', fn);
  },
  getThumbnail: (path: string, width: number, height: number) => ipcRenderer.invoke('get-thumbnail', { path, width, height }),
  onDirectoryChunk: (cb) => {
    const fn = (_: unknown, payload: { path: string; files: any[] }) => cb(payload);
    ipcRenderer.on('directory-chunk', fn);
    return () => ipcRenderer.removeListener('directory-chunk', fn);
  },
};

contextBridge.exposeInMainWorld('reederr', api);
