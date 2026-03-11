import { DirectoryEntry } from '../types';
import { useLayoutStore } from './layoutStore';

export const MEDIA_EXT = [
  '.jpg', '.jpeg', '.jpe', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif',
  '.mp4', '.webm', '.avi', '.mkv', '.mov', '.wmv', '.m4v',
  '.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac',
];

export function isMediaEntry(e: DirectoryEntry): boolean {
  if (e.isDirectory || e.isArchive) return false;
  const dotIdx = e.name.lastIndexOf('.');
  if (dotIdx < 0) return false;
  const ext = ('.' + e.name.slice(dotIdx + 1)).toLowerCase();
  return MEDIA_EXT.some((x) => ext === x);
}

export const ARCHIVE_EXTS = ['.zip', '.rar', '.cbz', '.cbr', '.7z', '.7zip', '.tar', '.gz', '.bz2', '.xz', '.iso', '.lzh', '.lha', '.lzma'];
export const ARCHIVE_OPENED_REGEX = /\.(zip|rar|cbz|cbr|7z|7zip|tar|gz|bz2|xz|iso|lzh|lha|lzma)!/i;

export function isArchivePath(path: string): boolean {
  const lower = path.toLowerCase();
  return ARCHIVE_EXTS.some((ext) => lower.endsWith(ext));
}

export function isArchiveOpened(path: string): boolean {
  return ARCHIVE_OPENED_REGEX.test(path);
}

/**
 * Returns the archive root part of a virtual path (e.g., "a.zip!b/c" -> "a.zip")
 * Robust against exclamation marks in filenames using ARCHIVE_OPENED_REGEX.
 */
export function resolveArchivePath(path: string): string | null {
  const norm = normalizePath(path);
  const match = norm.match(ARCHIVE_OPENED_REGEX);
  if (match) {
    const endIdx = match.index! + match[0].length - 1; // index of the '!' after extension
    return norm.slice(0, endIdx);
  }
  return isArchivePath(norm) ? norm : null;
}

/**
 * Returns the inner part of an archive path (e.g., "a.zip!b/c" -> "b/c")
 */
export function getInnerPath(path: string): string {
  const norm = normalizePath(path);
  const match = norm.match(ARCHIVE_OPENED_REGEX);
  if (!match) return '';
  const endIdx = match.index! + match[0].length; // index after the '!'
  return norm.slice(endIdx).replace(/\\/g, '/').replace(/^\/+/, '');
}

/**
 * Normalizes a path for consistent comparison.
 */
export function normalizePath(path: string): string {
  if (!path) return '';
  return path.replace(/\\/g, '/').replace(/[/\!]+$/, '');
}

export function isJunkFile(name: string): boolean {
  if (name === '__MACOSX' || name === '.DS_Store' || name.startsWith('._')) return true;
  if (name.startsWith('~') || name.startsWith('7z')) return true;
  return false;
}

export function getParentPath(p: string): string | null {
  const normalized = normalizePath(p);
  
  // If we are inside an archive, check for inner parents first
  const archiveRoot = resolveArchivePath(normalized);
  if (archiveRoot && normalized.length > archiveRoot.length + 1) {
    const inner = getInnerPath(normalized);
    if (inner.includes('/')) {
      return archiveRoot + '!' + inner.slice(0, inner.lastIndexOf('/'));
    }
    return archiveRoot + '!';
  }
  
  // If we are at the root of an archive "xxx.zip!", the parent is the containing directory
  if (archiveRoot && (normalized === archiveRoot || normalized === archiveRoot + '!')) {
    const physicalParent = archiveRoot.match(/^(.+)[/\\][^/\\]*$/);
    return physicalParent ? normalizePath(physicalParent[1]) : null;
  }

  const m = normalized.match(/^(.+)[/\\][^/\\]*$/);
  return m ? normalizePath(m[1]) : null;
}

export function getFileTypeForSort(e: DirectoryEntry): string {
  if (e.isDirectory) return 'フォルダ';
  if (e.isArchive) return e.name.slice(e.name.lastIndexOf('.')).toUpperCase();
  const ext = e.name.slice(e.name.lastIndexOf('.')).toLowerCase();
  const map: Record<string, string> = {
    '.jpg': 'a', '.jpeg': 'b', '.png': 'c', '.gif': 'd', '.webp': 'e', '.bmp': 'f',
    '.mp4': 'g', '.webm': 'h', '.avi': 'i', '.mkv': 'j', '.mov': 'k', '.wmv': 'l', '.m4v': 'm',
    '.mp3': 'n', '.wav': 'o', '.ogg': 'p', '.flac': 'q', '.m4a': 'r', '.aac': 's',
  };
  return map[ext] ?? ext;
}

export function getSortedEntries(entries: DirectoryEntry[]): DirectoryEntry[] {
  const { fileListSortBy, fileListSortOrder } = useLayoutStore.getState();
  const mul = fileListSortOrder === 'asc' ? 1 : -1;
  return [...entries].sort((a, b) => {
    let cmp = 0;
    if (fileListSortBy === 'name') {
      cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    } else if (fileListSortBy === 'size') {
      cmp = (a.size ?? 0) - (b.size ?? 0);
    } else if (fileListSortBy === 'mtime') {
      cmp = (a.mtime ?? 0) - (b.mtime ?? 0);
    } else {
      cmp = getFileTypeForSort(a).localeCompare(getFileTypeForSort(b));
    }
    return cmp * mul;
  });
}

export const VIEWER_KEY = 'viewer';
