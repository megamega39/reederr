/// <reference types="vite/client" />

interface ReederrAPI {
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

interface Window {
  reederr: ReederrAPI;
}
