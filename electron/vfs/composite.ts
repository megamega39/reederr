import * as localFS from './localFS';
import { isArchiveListingPath, listArchiveDirectory, readFileFromArchive, streamFileFromArchive, statFromArchive } from './archiveFS';
import { isRarListingPath, rarList, rarReadFile, rarStat } from './rarFS';
import type { DirectoryEntry, FileStats } from './types';
import { splitArchivePath } from './utils';
import { Readable } from 'node:stream';
import { logger } from '../utils/logger';
import { createReadStream } from 'node:fs';
import { getDrives, getNetworkResources } from '../drives';

const ARCHIVE_EXT = ['.zip', '.cbz', '.rar', '.cbr', '.7z', '.7zip', '.tar', '.gz', '.bz2', '.xz', '.iso', '.lzh', '.lha', '.lzma'];

function isRarPath(path: string): boolean {
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
  onChunk?: (files: DirectoryEntry[]) => void;
  skipStats?: boolean;
}

export async function listDirectory(
  path: string,
  options?: ListDirectoryOptions
): Promise<DirectoryEntry[]> {
  const normPath = path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/[/\!]+$/, '').toLowerCase();
  
  if (normPath === 'pc') {
    const drives = await getDrives();
    return drives.map(d => ({
      name: d.name,
      path: d.path,
      isDirectory: true,
      isArchive: false
    }));
  }
  if (normPath === 'network') {
    const resources = await getNetworkResources();
    return resources.map(r => ({
      name: r.name,
      path: r.path,
      isDirectory: true,
      isArchive: false
    }));
  }

  const split = splitArchivePath(path);
  if (split) {
    if (isRarListingPath(path)) {
      const entries = await rarList(path, options);
      logger.info(`[Reederr VFS] archiveFS.list(RAR): ${split[0]} (${entries.length} entries)`);
      return entries;
    }
    const entries = await listArchiveDirectory(path, options);
    logger.info(`[Reederr VFS] archiveFS.list(ZIP): ${split[0]} (${entries.length} entries)`);
    return entries;
  }
  if (isArchiveFilepath(path)) {
    logger.error('[Reederr VFS] LocalFS.list called with archive path:', path);
    throw new Error(`アーカイブは開けていません。パスを zip! 形式で指定してください: ${path}`);
  }
  return localFS.listDirectory(path, options);
}

export async function readFile(path: string): Promise<ArrayBuffer> {
  const split = splitArchivePath(path);
  if (split) {
    // Use the optimized batch extractor for all archive files (ZIP, RAR, 7z, etc.)
    const { archiveExtractor } = await import('./archiveExtractor');
    return archiveExtractor.readFile(path);
  }
  return localFS.readFile(path);
}

export async function stat(path: string): Promise<FileStats | null> {
  const split = splitArchivePath(path);
  if (split) {
    if (isRarPath(path)) return rarStat(path);
    return await statFromArchive(path);
  }
  return localFS.stat(path);
}

export function streamFile(path: string, options?: { start?: number; end?: number }): Readable {
  const split = splitArchivePath(path);
  if (split) {
    if (isRarPath(path)) {
      throw new Error('RAR streaming is not yet supported');
    }
    // Note: Archive streaming currently doesn't support ranges, 
    // it will return the full stream for the inner file.
    return streamFileFromArchive(path);
  }
  return localFS.streamFile(path, options);
}
