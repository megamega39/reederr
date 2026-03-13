import { Result } from '../types/result';

export const FileSystemAPI = {
  getDrives: () => window.reederr.getDrives(),
  getSpecialFolders: () => window.reederr.getSpecialFolders(),
  listDirectory: (path: string, options?: { recursive?: boolean; skipStats?: boolean }): Promise<Result<any[]>> =>
    window.reederr.listDirectory(String(path || ''), options),
  getFileIcon: (absPath: string, size?: 16 | 20) => window.reederr.getFileIcon(String(absPath || ''), size),
  readFile: (path: string) => window.reederr.readFile(String(path || '')),
  stat: (path: string) => window.reederr.stat(String(path || '')),
  getNetworkResources: () => window.reederr.getNetworkResources(),
  createFolder: (parentPath: string, name: string): Promise<Result<void>> => window.reederr.createFolder(String(parentPath || ''), name),
  renameFolder: (path: string, newName: string): Promise<Result<void>> => window.reederr.renameFolder(String(path || ''), newName),
  deleteFolder: (path: string): Promise<Result<void>> => window.reederr.deleteFolder(String(path || '')),
  renameFile: (path: string, newName: string): Promise<Result<void>> => window.reederr.renameFile(String(path || ''), newName),
  deleteFile: (path: string): Promise<Result<void>> => window.reederr.deleteFile(String(path || '')),
  watchDirectory: (path: string) => window.reederr.watchDirectory(String(path || '')),
  onFileSystemChanged: (cb: (payload: { path: string }) => void) => window.reederr.onFileSystemChanged(cb),
  getThumbnail: (path: string, width: number, height: number) => window.reederr.getThumbnail(String(path || ''), width, height),
};

export const SystemAPI = {
  getPathUserData: () => window.reederr.getPathUserData(),
  openInExplorer: (path: string) => window.reederr.openInExplorer(String(path || '')),
  copyPath: (path: string) => window.reederr.copyPath(String(path || '')),
  copyParentPath: (path: string) => window.reederr.copyParentPath(String(path || '')),
  showInExplorer: (path: string) => window.reederr.showInExplorer(String(path || '')),
  openWithApp: (path: string, appPath: string): Promise<Result<void>> => window.reederr.openWithApp(String(path || ''), String(appPath || '')),
  is7zAvailable: () => window.reederr.is7zAvailable(),
  selectFolder: () => window.reederr.selectFolder(),
  selectFile: () => window.reederr.selectFile(),
};

export const MediaAPI = {
  getMediaUrl: (vpath: string, preferHttp?: boolean): Promise<Result<string>> => window.reederr.getMediaUrl(String(vpath || ''), preferHttp),
  getMediaUrls: (vpaths: string[], preferHttp?: boolean): Promise<Result<string[]>> => window.reederr.getMediaUrls(vpaths, preferHttp),
  releaseMediaUrl: (url: string) => window.reederr.releaseMediaUrl(String(url || '')),
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
  rebuildMenu: (lang: string) => window.reederr.rebuildMenu(lang),
};

export const NotificationAPI = {
  // @ts-ignore - bridge exists but TS might be slow to pick up preload changes
  onShowToast: (cb: (m: string, t: any, d?: number) => void) => (window.reederr as any).onShowToast(cb),
};
