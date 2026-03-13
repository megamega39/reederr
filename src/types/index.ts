import { AnyPath } from './paths';

export interface DirectoryEntry {
  name: string;
  path: AnyPath;
  isDirectory: boolean;
  isArchive: boolean;
  size?: number;
  mtime?: number;
}

export interface HistoryEntry {
  path: AnyPath;
  name: string;
  type: 'folder' | 'archive' | 'pc' | 'network' | 'other';
}
