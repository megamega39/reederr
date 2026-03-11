/**
 * Application API Layer
 * Abstracts backend (Electron IPC) calls from the UI components.
 * This makes it easier to mock or replace the backend in the future (e.g. for a web-only version).
 */

export const FileSystemAPI = {
  getDrives: () => window.reederr.getDrives(),
  getSpecialFolders: () => window.reederr.getSpecialFolders(),
  listDirectory: (path: string, options?: { recursive?: boolean }) =>
    window.reederr.listDirectory(path, options),
  getFileIcon: (absPath: string, size?: 16 | 20) => window.reederr.getFileIcon(absPath, size),
  readFile: (path: string) => window.reederr.readFile(path),
  stat: (path: string) => window.reederr.stat(path),
  createFolder: (parentPath: string, name: string) => window.reederr.createFolder(parentPath, name),
  renameFolder: (path: string, newName: string) => window.reederr.renameFolder(path, newName),
  deleteFolder: (path: string) => window.reederr.deleteFolder(path),
  renameFile: (path: string, newName: string) => window.reederr.renameFile(path, newName),
  deleteFile: (path: string) => window.reederr.deleteFile(path),
};

export const SystemAPI = {
  getPathUserData: () => window.reederr.getPathUserData(),
  openInExplorer: (path: string) => window.reederr.openInExplorer(path),
  copyPath: (path: string) => window.reederr.copyPath(path),
  copyParentPath: (path: string) => window.reederr.copyParentPath(path),
  showInExplorer: (path: string) => window.reederr.showInExplorer(path),
  openWithApp: (path: string, appPath: string) => window.reederr.openWithApp(path, appPath),
  is7zAvailable: () => window.reederr.is7zAvailable(),
  selectFolder: () => window.reederr.selectFolder(),
  selectFile: () => window.reederr.selectFile(),
};

export const MediaAPI = {
  getMediaUrl: (vpath: string, preferHttp?: boolean) => window.reederr.getMediaUrl(vpath, preferHttp),
  releaseMediaUrl: (url: string) => window.reederr.releaseMediaUrl(url),
  setPreviewFullscreen: (fullscreen: boolean) => window.reederr.setPreviewFullscreen(fullscreen),
  onPreviewFullscreenChanged: (cb: (f: boolean) => void) => window.reederr.onPreviewFullscreenChanged(cb),
};

export const PersistenceAPI = {
  loadStore: () => window.reederr.loadStore(),
  saveStore: (data: Record<string, unknown>) => window.reederr.saveStore(data),
  getUserSettings: () => window.reederr.getUserSettings(),
  setUserSettings: (data: Record<string, unknown>) => window.reederr.setUserSettings(data),
};

export const MenuAPI = {
  onMenuNav: (cb: (action: string) => void) => window.reederr.onMenuNav(cb),
  onMenuViewMode: (cb: (mode: string) => void) => window.reederr.onMenuViewMode(cb),
  onMenuBinding: (cb: (b: string) => void) => window.reederr.onMenuBinding(cb),
  onMenuSettings: (cb: () => void) => window.reederr.onMenuSettings(cb),
  onMenuFullscreen: (cb: () => void) => window.reederr.onMenuFullscreen(cb),
  onMenuOpenFile: (cb: (path: string) => void) => window.reederr.onMenuOpenFile(cb),
  onMenuOpenFolder: (cb: (path: string) => void) => window.reederr.onMenuOpenFolder(cb),
  onMenuCopyPath: (cb: () => void) => window.reederr.onMenuCopyPath(cb),
  onMenuZoom: (cb: (action: string) => void) => window.reederr.onMenuZoom(cb),
  onMenuHelp: (cb: () => void) => window.reederr.onMenuHelp(cb),
};

export const NotificationAPI = {
  // @ts-ignore - bridge exists but TS might be slow to pick up preload changes
  onShowToast: (cb: (m: string, t: any, d?: number) => void) => (window.reederr as any).onShowToast(cb),
};
