export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isArchive: boolean;
  size?: number;
  mtime?: number;
}

export interface HistoryEntry {
  path: string;
  name: string;
  type: 'folder' | 'archive' | 'pc' | 'network' | 'other';
}
