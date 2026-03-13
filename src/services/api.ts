import { Result } from '../types/result';

export const FileSystemAPI = {
  getDrives: (): Promise<Result<any[]>> => window.reederr.getDrives(),
  getSpecialFolders: (): Promise<Result<{ name: string; path: string }[]>> => window.reederr.getSpecialFolders(),
  listDirectory: (path: string, options?: { recursive?: boolean; skipStats?: boolean }): Promise<Result<any[]>> =>
    window.reederr.listDirectory(String(path || ''), options),
  getFileIcon: (absPath: string, size?: 16 | 20): Promise<Result<string>> => window.reederr.getFileIcon(String(absPath || ''), size),
  readFile: (path: string): Promise<Result<ArrayBuffer>> => window.reederr.readFile(String(path || '')),
  stat: (path: string): Promise<Result<any>> => window.reederr.stat(String(path || '')),
  getNetworkResources: (): Promise<Result<any[]>> => window.reederr.getNetworkResources(),
  createFolder: (parentPath: string, name: string): Promise<Result<void>> => window.reederr.createFolder(String(parentPath || ''), name),
  renameFolder: (path: string, newName: string): Promise<Result<void>> => window.reederr.renameFolder(String(path || ''), newName),
  deleteFolder: (path: string): Promise<Result<void>> => window.reederr.deleteFolder(String(path || '')),
  renameFile: (path: string, newName: string): Promise<Result<void>> => window.reederr.renameFile(String(path || ''), newName),
  deleteFile: (path: string): Promise<Result<void>> => window.reederr.deleteFile(String(path || '')),
  watchDirectory: (path: string): Promise<Result<void>> => window.reederr.watchDirectory(String(path || '')),
  onFileSystemChanged: (cb: (payload: { path: string }) => void) => window.reederr.onFileSystemChanged(cb),
  getThumbnail: (path: string, width: number, height: number): Promise<Result<string | null>> => window.reederr.getThumbnail(String(path || ''), width, height),
};

export const SystemAPI = {
  getPathUserData: (): Promise<Result<string>> => window.reederr.getPathUserData(),
  openInExplorer: (path: string): Promise<Result<void>> => window.reederr.openInExplorer(String(path || '')),
  copyPath: (path: string): Promise<Result<void>> => window.reederr.copyPath(String(path || '')),
  copyParentPath: (path: string): Promise<Result<void>> => window.reederr.copyParentPath(String(path || '')),
  showInExplorer: (path: string): Promise<Result<void>> => window.reederr.showInExplorer(String(path || '')),
  openWithApp: (path: string, appPath: string): Promise<Result<void>> => window.reederr.openWithApp(String(path || ''), String(appPath || '')),
  is7zAvailable: (): Promise<Result<boolean>> => window.reederr.is7zAvailable(),
  selectFolder: (): Promise<Result<{ path: string } | null>> => window.reederr.selectFolder(),
  selectFile: (): Promise<Result<{ path: string } | null>> => window.reederr.selectFile(),
};

export const MediaAPI = {
  getMediaUrl: (vpath: string, preferHttp?: boolean): Promise<Result<string>> => window.reederr.getMediaUrl(String(vpath || ''), preferHttp),
  getMediaUrls: (vpaths: string[], preferHttp?: boolean): Promise<Result<string[]>> => window.reederr.getMediaUrls(vpaths, preferHttp),
  releaseMediaUrl: (url: string): Promise<Result<void>> => window.reederr.releaseMediaUrl(String(url || '')),
  setPreviewFullscreen: (fullscreen: boolean): Promise<Result<void>> => window.reederr.setPreviewFullscreen(fullscreen),
  onPreviewFullscreenChanged: (cb: (f: boolean) => void) => window.reederr.onPreviewFullscreenChanged(cb),
};

export const PersistenceAPI = {
  loadStore: (): Promise<Result<Record<string, unknown>>> => window.reederr.loadStore(),
  saveStore: (data: Record<string, unknown>): Promise<Result<void>> => window.reederr.saveStore(data),
  getUserSettings: (): Promise<Result<Record<string, unknown>>> => window.reederr.getUserSettings(),
  setUserSettings: (data: Record<string, unknown>): Promise<Result<void>> => window.reederr.setUserSettings(data),
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
  rebuildMenu: (lang: string): Promise<Result<void>> => window.reederr.rebuildMenu(lang),
};

export const NotificationAPI = {
  // @ts-ignore - bridge exists but TS might be slow to pick up preload changes
  onShowToast: (cb: (m: string, t: any, d?: number) => void) => (window.reederr as any).onShowToast(cb),
};
