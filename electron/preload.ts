import { contextBridge, ipcRenderer } from 'electron';

export interface ReederrAPI {
  getFileIcon: (absPath: string, size?: 16 | 20) => Promise<string>;
  getSpecialFolders: () => Promise<Array<{ name: string; path: string }>>;
  getDrives: () => Promise<Array<{ name: string; path: string }>>;
  selectFolder: () => Promise<{ path: string } | null>;
  selectFile: () => Promise<{ path: string } | null>;
  listDirectory: (path: string, options?: { recursive?: boolean }) => Promise<
    | { success: true; files: Array<{ name: string; path: string; isDirectory: boolean; isArchive: boolean; size?: number; mtime?: number }> }
    | { success: false; error: string; files: [] }
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
  onShowToast: (cb: (message: string, type: 'info' | 'success' | 'warn' | 'error', duration?: number) => void) => () => void;
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
  loadStore: () => ipcRenderer.invoke('load-store').catch(e => { console.error('[Preload] loadStore error:', e); throw e; }),
  saveStore: (data) => ipcRenderer.invoke('save-store', { data }).catch(e => { console.error('[Preload] saveStore error:', e); throw e; }),
  onShowToast: (cb) => {
    const fn = (_: unknown, m: string, t: 'info' | 'success' | 'warn' | 'error', d?: number) => cb(m, t, d);
    ipcRenderer.on('show-toast', fn);
    return () => ipcRenderer.removeListener('show-toast', fn);
  },
};

contextBridge.exposeInMainWorld('reederr', api);
