import { DirectoryEntry } from '../types';
import { AnyPath, toAnyPath, toPhysicalPath, toVirtualPath, isVirtualPath } from '../types/paths';
import { useLayoutStore } from './layoutStore';

export const VIDEO_EXT = ['.mp4', '.webm', '.avi', '.mkv', '.mov', '.wmv', '.m4v'];
export const AUDIO_EXT = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'];
export const IMAGE_EXT = ['.jpg', '.jpeg', '.jpe', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif'];
export const MEDIA_EXT = [...IMAGE_EXT, ...VIDEO_EXT, ...AUDIO_EXT];

export function isMediaEntry(e: DirectoryEntry): boolean {
  if (e.isDirectory || e.isArchive) return false;
  if (isJunkFile(e.name)) return false;
  return isVideoPath(e.name) || isAudioPath(e.name) || isImagePath(e.name);
}

export function isVideoPath(path: string): boolean {
  const dotIdx = path.lastIndexOf('.');
  if (dotIdx < 0) return false;
  const ext = ('.' + path.slice(dotIdx + 1)).toLowerCase();
  return VIDEO_EXT.includes(ext);
}

export function isAudioPath(path: string): boolean {
  const dotIdx = path.lastIndexOf('.');
  if (dotIdx < 0) return false;
  const ext = ('.' + path.slice(dotIdx + 1)).toLowerCase();
  return AUDIO_EXT.includes(ext);
}

export function isImagePath(path: string): boolean {
  const dotIdx = path.lastIndexOf('.');
  if (dotIdx < 0) return false;
  const ext = ('.' + path.slice(dotIdx + 1)).toLowerCase();
  return IMAGE_EXT.includes(ext);
}

export const ARCHIVE_EXTS = ['.zip', '.rar', '.cbz', '.cbr', '.7z', '.7zip', '.tar', '.gz', '.bz2', '.xz', '.iso', '.lzh', '.lha', '.lzma'];
export const ARCHIVE_OPENED_REGEX = /\.(zip|rar|cbz|cbr|7z|7zip|tar|gz|bz2|xz|iso|lzh|lha|lzma)!/i;

export function isArchivePath(path: AnyPath): boolean {
  const norm = normalizePath(path);
  const lower = norm.toLowerCase();
  return ARCHIVE_EXTS.some((ext) => lower.endsWith(ext));
}

export function isArchiveOpened(path: AnyPath): boolean {
  return ARCHIVE_OPENED_REGEX.test(path);
}

/**
 * Returns the archive root part of a virtual path (e.g., "a.zip!b/c" -> "a.zip")
 * Robust against exclamation marks in filenames using ARCHIVE_OPENED_REGEX.
 */
export function resolveArchivePath(path: AnyPath): AnyPath | null {
  const norm = normalizePath(path);
  const match = norm.match(ARCHIVE_OPENED_REGEX);
  if (match) {
    const endIdx = match.index! + match[0].length - 1; // index of the '!' after extension
    return toAnyPath(norm.slice(0, endIdx));
  }
  return isArchivePath(path) ? path : null;
}

/**
 * Returns the inner part of an archive path (e.g., "a.zip!b/c" -> "b/c")
 */
export function getInnerPath(path: AnyPath): string {
  const norm = normalizePath(path);
  const match = norm.match(ARCHIVE_OPENED_REGEX);
  if (!match) return '';
  const endIdx = match.index! + match[0].length; // index after the '!'
  return norm.slice(endIdx).replace(/\\/g, '/').replace(/^\/+/, '');
}

/**
 * Normalizes a path for consistent comparison.
 * Ensures forward slashes and removes trailing slashes/exclamations.
 */
export function normalizePath(path: string | AnyPath | null | undefined): AnyPath {
  if (typeof path !== 'string') return toAnyPath('');
  // Convert backslashes to forward slashes, squash multiple slashes, remove trailing slash/exclamation
  let res = path.replace(/\\/g, '/').replace(/\/+/g, '/');
  if (res.length > 1 && res.endsWith('/')) res = res.slice(0, -1);
  if (res.endsWith('!')) res = res.slice(0, -1);
  return toAnyPath(res);
}

/**
 * Ensures an archive path has the trailing '!' if it's meant to be opened.
 */
export function ensureOpenedPath(path: AnyPath): AnyPath {
  const norm = normalizePath(path);
  if (isArchivePath(norm) && !ARCHIVE_OPENED_REGEX.test(path)) {
    return toAnyPath(norm + '!');
  }
  return path.includes('!') ? path : norm;
}

export function isJunkFile(name: string): boolean {
  if (name === '__MACOSX' || name === '.DS_Store' || name.startsWith('._')) return true;
  if (name.startsWith('~') || name.startsWith('7z')) return true;
  return false;
}

export function getParentPath(p: AnyPath | null | undefined): AnyPath | null {
  const normalized = normalizePath(p);
  if (!normalized || normalized === 'pc' || normalized === 'network') return null;
  
  // If we are inside an archive, check for inner parents first
  const archiveRoot = resolveArchivePath(normalized);
  if (archiveRoot && normalized.length > archiveRoot.length + 1) {
    const inner = getInnerPath(normalized);
    if (inner.includes('/')) {
      return toAnyPath(archiveRoot + '!' + inner.slice(0, inner.lastIndexOf('/')));
    }
    return toAnyPath(archiveRoot + '!');
  }
  
  // If we are at the root of an archive "xxx.zip!", the parent is the containing directory
  if (archiveRoot && (normalized === archiveRoot || normalized === toAnyPath(archiveRoot + '!'))) {
    const lastSlash = (archiveRoot as string).lastIndexOf('/');
    if (lastSlash < 0) return toAnyPath('pc'); // Root-level archive parent is PC
    return normalizePath(archiveRoot.slice(0, lastSlash));
  }

  const lastSlash = (normalized as string).lastIndexOf('/');
  if (lastSlash < 0) {
    // Top-level folders/drives (e.g., "C:") parent is PC
    return toAnyPath('pc');
  }
  return normalizePath(normalized.slice(0, lastSlash));
}

export function getFileTypeForSort(e: DirectoryEntry): string {
  if (e.isDirectory) return '_DIR';
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
