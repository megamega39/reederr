import { existsSync, readdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { DirectoryEntry, FileStats } from './types';
import {
  extractToStdout,
  extractToTemp,
  isLargeFile,
  isMediaRequiringTempExtract,
} from './sevenZip';
import { get7zPath } from '../sevenZipPath';
import { getArchiveIndex } from './archiveIndexCache';
import { splitArchivePath, isRarArchive } from './utils';
import { ARCHIVE_EXTS } from './constants';
import { tempManager } from './tempManager';

function parseVpath(vpath: string): { archivePath: string; innerPath: string } | null {
  const split = splitArchivePath(vpath);
  if (!split) return null;
  const archivePath = split[0];
  const innerPath = split[1].replace(/\\/g, '/');
  return { archivePath, innerPath };
}


export function cleanupTempExtract(): void {
  tempManager.cleanupAll();
}

export function isRarListingPath(path: string): boolean {
  const split = splitArchivePath(path);
  if (!split) {
    return existsSync(path) && isRarArchive(path);
  }
  const archivePath = split[0];
  return existsSync(archivePath) && isRarArchive(archivePath);
}

import { listArchiveEntries, statArchiveEntry } from './archiveCommon';

/**
 * list: インデックスキャッシュから prefix に合うエントリを返す。
 * recursive=true のときはメディアのみフラットに返す。
 */
export async function rarList(
  vpath: string,
  options?: { recursive?: boolean }
): Promise<DirectoryEntry[]> {
  const parsed = parseVpath(vpath);
  const archivePath = parsed ? parsed.archivePath : vpath;
  const prefix = parsed?.innerPath || '';

  if (!get7zPath()) {
    throw new Error('7-Zip (7z.exe) not found. Please place 7z.exe and 7z.dll in tools/7zip.');
  }

  const index = await getArchiveIndex(archivePath);
  return listArchiveEntries(archivePath, index, prefix, options?.recursive ?? false);
}

/**
 * stat: インデックスから該当エントリを探して返す。
 */
export async function rarStat(vpath: string): Promise<FileStats | null> {
  const parsed = parseVpath(vpath);
  if (!parsed) return null;

  const index = await getArchiveIndex(parsed.archivePath);
  return statArchiveEntry(index, parsed.innerPath);
}

/**
 * readFile: 画像は -so、動画/音声/巨大は temp 抽出。
 */
export async function rarReadFile(vpath: string): Promise<ArrayBuffer> {
  const parsed = parseVpath(vpath);
  if (!parsed) throw new Error('Invalid RAR path');

  const index = await getArchiveIndex(parsed.archivePath);
  const normal = parsed.innerPath.replace(/\\/g, '/').toLowerCase();
  const entry = index.find(
    (e) => {
       const p = e.path.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase();
       return p === normal && !e.isDirectory;
    }
  );
  if (!entry) throw new Error(`アーカイブ内に見つかりません: ${parsed.innerPath}`);
  if (entry.isEncrypted) throw new Error('Encrypted archive. Password-protected archives are not supported.');

  const cacheKey = `vfs:${parsed.archivePath}!${parsed.innerPath}`;
  const useTemp =
    isLargeFile(entry.size) || isMediaRequiringTempExtract(entry.path);

  if (useTemp) {
    let extractedPath = tempManager.getFile(cacheKey);
    if (!extractedPath) {
      const subdir = tempManager.getTempDirForEntry(parsed.archivePath, parsed.innerPath);
      extractedPath = await extractToTemp(
        parsed.archivePath,
        parsed.innerPath,
        subdir
      );
      tempManager.registerFile(cacheKey, extractedPath);
    }

    const buf = readFileSync(extractedPath);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  }

  const buf = await extractToStdout(parsed.archivePath, parsed.innerPath);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/**
 * resolveRealPath: temp 抽出済みの場合はそのパスを返す。
 */
export function rarResolveRealPath(vpath: string): string | null {
  const parsed = parseVpath(vpath);
  if (!parsed) return null;

  const cacheKey = `vfs:${parsed.archivePath}!${parsed.innerPath}`;
  return tempManager.getFile(cacheKey);
}
