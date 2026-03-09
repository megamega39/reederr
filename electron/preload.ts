import { contextBridge, ipcRenderer } from 'electron';

export interface ReederrAPI {
  selectFolder: () => Promise<{ path: string } | null>;
  listDirectory: (path: string) => Promise<
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
}

const api: ReederrAPI = {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  listDirectory: (path) => ipcRenderer.invoke('list-directory', { path }),
  readFile: (path) => ipcRenderer.invoke('read-file', { path }),
  stat: (path) => ipcRenderer.invoke('stat', { path }),
  getPathUserData: () => ipcRenderer.invoke('get-path-userData'),
};

contextBridge.exposeInMainWorld('reederr', api);
