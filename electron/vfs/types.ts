export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isArchive: boolean;
  size?: number;
  mtime?: number;
}

export interface FileStats {
  size: number;
  isDirectory: boolean;
  mtime?: number;
}
export interface ListDirectoryOptions {
  onChunk?: (files: DirectoryEntry[]) => void;
  skipStats?: boolean;
  recursive?: boolean;
}
