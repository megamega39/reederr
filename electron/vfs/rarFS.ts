import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import type { DirectoryEntry, FileStats } from './types';
import type { SevenZipEntry } from './sevenZip';
import {
  extractToStdout,
  extractToTemp,
  isLargeFile,
  isMediaRequiringTempExtract,
} from './sevenZip';
import { get7zPath } from '../sevenZipPath';
import { getArchiveIndex } from './archiveIndexCache';
import { splitArchivePath } from './utils';

const RAR_EXT = ['.rar', '.cbr'];
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.jpe', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif']);
const VIDEO_EXT = new Set(['.mp4', '.webm', '.avi', '.mkv', '.mov', '.wmv', '.m4v']);
const AUDIO_EXT = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac']);
const MAX_TEMP_FILES = 200;
const MAX_TEMP_BYTES = 2 * 1024 * 1024 * 1024; // 2GB

function isRarArchive(path: string): boolean {
  const lower = path.toLowerCase();
  return RAR_EXT.some((ext) => lower.endsWith(ext));
}

function parseVpath(vpath: string): { archivePath: string; innerPath: string } | null {
  const split = splitArchivePath(vpath);
  if (!split) return null;
  const archivePath = split[0];
  const innerPath = split[1].replace(/\\/g, '/');
  return { archivePath, innerPath };
}

function isMediaPath(path: string): boolean {
  const dotIdx = path.lastIndexOf('.');
  if (dotIdx < 0) return false;
  const ext = ('.' + path.slice(dotIdx + 1)).toLowerCase();
  return IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext) || AUDIO_EXT.has(ext);
}

function isJunkPath(name: string): boolean {
  return name === '__MACOSX' || name.startsWith('._') || name === '.DS_Store';
}

const tempExtractCache = new Map<
  string,
  { path: string; size: number; lastAccess: number }
>();
let tempCacheTotalBytes = 0;
const TEMP_BASE = join(tmpdir(), 'reederr-extract');

function ensureTempDir(): string {
  if (!existsSync(TEMP_BASE)) {
    mkdirSync(TEMP_BASE, { recursive: true });
  }
  return TEMP_BASE;
}

function makeTempSubdir(archivePath: string, innerPath: string): string {
  const hash = createHash('sha1')
    .update(archivePath + innerPath)
    .digest('hex')
    .slice(0, 16);
  const sub = join(ensureTempDir(), hash);
  if (!existsSync(sub)) mkdirSync(sub, { recursive: true });
  return sub;
}

function getTempCacheKey(archivePath: string, innerPath: string): string {
  return `${archivePath}::${innerPath}`;
}

function evictTempCache(): void {
  const entries = [...tempExtractCache.entries()].sort(
    (a, b) => a[1].lastAccess - b[1].lastAccess
  );
  for (const [key, val] of entries) {
    if (tempExtractCache.size <= 1 && tempCacheTotalBytes < MAX_TEMP_BYTES * 0.5) break;
    try {
      unlinkSync(val.path);
    } catch {
      /* ignore */
    }
    tempExtractCache.delete(key);
    tempCacheTotalBytes -= val.size;
  }
}

const MEDIA_TEMP_BASE = join(tmpdir(), 'reederr-media');

export function cleanupTempExtract(): void {
  for (const base of [TEMP_BASE, MEDIA_TEMP_BASE]) {
    if (!existsSync(base)) continue;
    try {
      for (const name of readdirSync(base)) {
        const p = join(base, name);
        try {
          rmSync(p, { recursive: true });
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }
  try {
    for (const name of readdirSync(tmpdir())) {
      if (name.startsWith('reederr-') && name !== 'reederr-media' && name !== 'reederr-extract') {
        const p = join(tmpdir(), name);
        try {
          rmSync(p, { recursive: true });
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }
  tempExtractCache.clear();
  tempCacheTotalBytes = 0;
}

export function isRarListingPath(path: string): boolean {
  if (!path.includes('!')) {
    return existsSync(path) && isRarArchive(path);
  }
  const parsed = parseVpath(path);
  if (!parsed) return false;
  return existsSync(parsed.archivePath) && isRarArchive(parsed.archivePath);
}

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
  const prefix = parsed?.innerPath
    ? (parsed.innerPath.endsWith('/') ? parsed.innerPath : parsed.innerPath + '/')
    : '';

  if (!get7zPath()) {
    throw new Error('7-Zip (7z.exe) not found. Please place 7z.exe and 7z.dll in tools/7zip.');
  }

  const index = await getArchiveIndex(archivePath);
  const prefixNorm = prefix.replace(/^\/+/, '');
  const prefixBase = prefix.replace(/\/$/, '');
  const recursive = options?.recursive ?? false;

  if (recursive) {
    const result: DirectoryEntry[] = [];
    for (const e of index) {
      if (e.isDirectory) continue;
      const p = e.path.replace(/\\/g, '/').replace(/^\/+/, '');
      if (prefixNorm && !p.startsWith(prefixNorm)) continue;
      const rest = p.slice(prefixNorm.length);
      if (!rest) continue;
      const parts = rest.split('/').filter(Boolean);
      if (parts.length === 0) continue;
      if (isJunkPath(parts[0])) continue;
      if (!isMediaPath(e.path)) continue;
      const name = p.split('/').pop() ?? p;
      result.push({
        name,
        path: archivePath + '!' + p,
        isDirectory: false,
        isArchive: false,
        size: e.size,
        mtime: e.mtime,
      });
    }
    result.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return result;
  }

  const seen = new Map<string, { isDir: boolean; size?: number; mtime?: number }>();
  for (const e of index) {
    const p = e.path.replace(/\\/g, '/').replace(/^\/+/, '');
    if (prefixNorm && !p.startsWith(prefixNorm)) continue;
    const rest = p.slice(prefixNorm.length);
    if (!rest) continue;
    const parts = rest.split('/').filter(Boolean);
    if (parts.length === 0) continue;
    const firstName = parts[0];
    if (isJunkPath(firstName)) continue;
    const isDir = e.isDirectory || parts.length > 1;

    if (!seen.has(firstName)) {
      seen.set(firstName, {
        isDir,
        size: e.isDirectory ? undefined : e.size,
        mtime: e.mtime,
      });
    } else {
      const prev = seen.get(firstName)!;
      if (isDir) prev.isDir = true;
    }
  }

  const result: DirectoryEntry[] = [];
  for (const [name, meta] of seen) {
    result.push({
      name,
      path: archivePath + '!' + (prefixBase ? prefixBase + '/' : '') + name,
      isDirectory: meta.isDir,
      isArchive: false,
      size: meta.size,
      mtime: meta.mtime,
    });
  }

  result.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  return result;
}

/**
 * stat: インデックスから該当エントリを探して返す。
 */
export async function rarStat(vpath: string): Promise<FileStats | null> {
  const parsed = parseVpath(vpath);
  if (!parsed) return null;

  const index = await getArchiveIndex(parsed.archivePath);
  const normal = parsed.innerPath.replace(/\\/g, '/');
  const entry = index.find(
    (e) => (e.path === normal || e.path === normal + '/') && !e.isDirectory
  );
  if (!entry) return null;

  return {
    size: entry.size,
    isDirectory: false,
    mtime: entry.mtime,
  };
}

/**
 * readFile: 画像は -so、動画/音声/巨大は temp 抽出。
 */
export async function rarReadFile(vpath: string): Promise<ArrayBuffer> {
  const parsed = parseVpath(vpath);
  if (!parsed) throw new Error('Invalid RAR path');

  const index = await getArchiveIndex(parsed.archivePath);
  const normal = parsed.innerPath.replace(/\\/g, '/');
  const entry = index.find(
    (e) => (e.path === normal || e.path === normal + '/') && !e.isDirectory
  );
  if (!entry) throw new Error(`アーカイブ内に見つかりません: ${parsed.innerPath}`);
  if (entry.isEncrypted) throw new Error('Encrypted archive. Password-protected archives are not supported.');

  const useTemp =
    isLargeFile(entry.size) || isMediaRequiringTempExtract(entry.path);

  if (useTemp) {
    const cacheKey = getTempCacheKey(parsed.archivePath, parsed.innerPath);
    const cached = tempExtractCache.get(cacheKey);
    if (cached && existsSync(cached.path)) {
      cached.lastAccess = Date.now();
      const buf = readFileSync(cached.path);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    }

    const subdir = makeTempSubdir(parsed.archivePath, parsed.innerPath);
    const extractedPath = await extractToTemp(
      parsed.archivePath,
      parsed.innerPath,
      subdir
    );

    while (
      tempExtractCache.size >= MAX_TEMP_FILES ||
      tempCacheTotalBytes + entry.size > MAX_TEMP_BYTES
    ) {
      evictTempCache();
    }

    tempExtractCache.set(cacheKey, {
      path: extractedPath,
      size: entry.size,
      lastAccess: Date.now(),
    });
    tempCacheTotalBytes += entry.size;

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

  const cacheKey = getTempCacheKey(parsed.archivePath, parsed.innerPath);
  const cached = tempExtractCache.get(cacheKey);
  if (cached && existsSync(cached.path)) {
    return cached.path;
  }
  return null;
}
