export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isArchive: boolean;
}

export interface FileStats {
  size: number;
  isDirectory: boolean;
  mtime?: number;
}
