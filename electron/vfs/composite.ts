import * as localFS from './localFS';
import { isArchiveListingPath, listArchiveDirectory, readFileFromArchive } from './archiveFS';
import { isRarListingPath, rarList, rarReadFile, rarStat } from './rarFS';
import type { DirectoryEntry, FileStats } from './types';
import { splitArchivePath } from './utils';

const ARCHIVE_EXT = ['.zip', '.cbz', '.rar', '.cbr'];

function isRarPath(path: string): boolean {
  if (!path.includes('!')) return false;
  const split = splitArchivePath(path);
  if (!split) return false;
  const archivePart = split[0];
  const lower = archivePart.toLowerCase();
  return lower.endsWith('.rar') || lower.endsWith('.cbr');
}

function isArchiveFilepath(path: string): boolean {
  return ARCHIVE_EXT.some((ext) => path.toLowerCase().endsWith(ext));
}

export interface ListDirectoryOptions {
  recursive?: boolean;
}

export async function listDirectory(
  path: string,
  options?: ListDirectoryOptions
): Promise<DirectoryEntry[]> {
  const split = splitArchivePath(path);
  if (split) {
    if (isRarListingPath(path)) {
      const entries = await rarList(path, options);
      console.log('[Reederr VFS] archiveFS.list(RAR)', {
        containerPath: split[0],
        innerDir: split[1],
        entriesCount: entries.length,
      });
      return entries;
    }
    const entries = await listArchiveDirectory(path, options);
    console.log('[Reederr VFS] archiveFS.list(ZIP)', {
      containerPath: split[0],
      innerDir: split[1],
      entriesCount: entries.length,
    });
    return entries;
  }
  if (isArchiveFilepath(path)) {
    console.error('[Reederr VFS] BUG: LocalFS.list called with archive path (archive not opened correctly):', path);
    throw new Error(`アーカイブは開けていません。パスを zip! 形式で指定してください: ${path}`);
  }
  return Promise.resolve(localFS.listDirectory(path));
}

export async function readFile(path: string): Promise<ArrayBuffer> {
  const split = splitArchivePath(path);
  if (split) {
    if (isRarPath(path)) return rarReadFile(path);
    return readFileFromArchive(path);
  }
  return Promise.resolve(localFS.readFile(path));
}

export async function stat(path: string): Promise<FileStats | null> {
  const split = splitArchivePath(path);
  if (split) {
    if (isRarPath(path)) return rarStat(path);
    return null;
  }
  return Promise.resolve(localFS.stat(path));
}
