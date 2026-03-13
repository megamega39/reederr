import { existsSync } from 'node:fs';
import { Readable } from 'node:stream';
import type { DirectoryEntry, FileStats } from './types';
import { get7zPath } from '../sevenZipPath';
import { getArchiveIndex } from './archiveIndexCache';
import { extractToStdout, extractToStream } from './sevenZip';
import { splitArchivePath, isArchiveExtension, isRarArchive } from './utils';
import { logger } from '../utils/logger';


function isArchivePath(path: string): boolean {
  return isArchiveExtension(path);
}

export function isArchiveListingPath(path: string): boolean {
  const split = splitArchivePath(path);
  if (split) {
    const archivePart = split[0];
    return existsSync(archivePart) && isArchivePath(archivePart);
  }
  return existsSync(path) && isArchivePath(path);
}

import { listArchiveEntries, statArchiveEntry } from './archiveCommon';

export async function listArchiveDirectory(
  path: string,
  options?: { recursive?: boolean }
): Promise<DirectoryEntry[]> {
  let archivePath = path;
  let prefix = '';

  const split = splitArchivePath(path);
  if (split) {
    archivePath = split[0];
    prefix = split[1];
  }

  if (isRarArchive(archivePath)) {
    return []; // RAR は rarFS に委譲（composite で先に振り分け）
  }
  if (!get7zPath()) {
    throw new Error(
      '7-Zip (7z.exe) が見つかりません。ZIP/CBZ を開くには tools/7zip に 7z.exe と 7z.dll を配置してください。'
    );
  }

  const index = await getArchiveIndex(archivePath);
  return listArchiveEntries(archivePath, index, prefix, options?.recursive ?? false);
}

export async function readFileFromArchive(path: string): Promise<ArrayBuffer> {
  const split = splitArchivePath(path);
  if (!split) {
    throw new Error('Not an archive path');
  }
  const [archivePath, innerPathRaw] = split;
  const innerPath = innerPathRaw.replace(/\\/g, '/').replace(/^\/+/, '');

  if (isRarArchive(archivePath)) {
    throw new Error('RAR files must be read via rarFS');
  }

  if (!get7zPath()) {
    throw new Error(
      '7-Zip (7z.exe) が見つかりません。ZIP/CBZ を開くには tools/7zip に 7z.exe と 7z.dll を配置してください。'
    );
  }
  
  try {
    logger.debug(`[ArchiveFS] Reading: ${archivePath}!${innerPath}`);
    const buf = await extractToStdout(archivePath, innerPath);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  } catch (err) {
    logger.error(`[ArchiveFS] Failed to read ${innerPath} from ${archivePath}:`, err);
    throw err;
  }
}

export async function statFromArchive(path: string): Promise<FileStats | null> {
  const split = splitArchivePath(path);
  if (!split) return null;
  const [archivePath, innerPath] = split;

  const index = await getArchiveIndex(archivePath);
  return statArchiveEntry(index, innerPath);
}

export function streamFileFromArchive(path: string): Readable {
  const split = splitArchivePath(path);
  if (!split) {
    throw new Error('Not an archive path');
  }
  const [archivePath, innerPathRaw] = split;
  const innerPath = innerPathRaw.replace(/\\/g, '/').replace(/^\/+/, '');

  if (isRarArchive(archivePath)) {
    throw new Error('RAR streaming is not yet implemented in archiveFS');
  }

  return extractToStream(archivePath, innerPath);
}
