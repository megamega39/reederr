import { existsSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import type { SevenZipEntry } from './sevenZip';
import { listArchive } from './sevenZip';

const MAX_CACHE_SIZE = 50; // Increased for persistence
const CACHE_FILENAME = 'archive_index_cache.json';
let cacheDirPath = '';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.jpe', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif']);
const VIDEO_EXT = new Set(['.mp4', '.webm', '.avi', '.mkv', '.mov', '.wmv', '.m4v']);
const AUDIO_EXT = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac']);
const MAX_SINGLE_FILE = 2 * 1024 * 1024 * 1024; // 2GB

interface CacheEntry {
  entries: SevenZipEntry[];
  fetchedAt: number;
}

let cache = new Map<string, CacheEntry>();
let accessOrder: string[] = [];

/**
 * 初期化時にメインプロセスから呼び出される
 */
export function initArchiveCache(userDataPath: string) {
  cacheDirPath = userDataPath;
  loadCacheFromDisk();
}

function loadCacheFromDisk() {
  try {
    const path = join(cacheDirPath, CACHE_FILENAME);
    if (existsSync(path)) {
      const data = JSON.parse(readFileSync(path, 'utf-8'));
      cache = new Map(Object.entries(data.cache));
      accessOrder = data.order || [];
      console.log(`[ArchiveCache] Loaded ${cache.size} entries from disk.`);
    }
  } catch (err) {
    console.warn('[ArchiveCache] Failed to load cache from disk:', err);
  }
}

function saveCacheToDisk() {
  if (!cacheDirPath) return;
  try {
    const path = join(cacheDirPath, CACHE_FILENAME);
    const data = {
      cache: Object.fromEntries(cache),
      order: accessOrder
    };
    writeFileSync(path, JSON.stringify(data), 'utf-8');
  } catch (err) {
    console.error('[ArchiveCache] Failed to save cache to disk:', err);
  }
}

function makeCacheKey(archivePath: string): string {
  const abs = resolve(archivePath);
  if (!existsSync(abs)) return '';
  try {
    const st = statSync(abs);
    return `${abs}|${st.mtimeMs}|${st.size}`;
  } catch {
    return '';
  }
}

function trimCache(): void {
  while (accessOrder.length > MAX_CACHE_SIZE) {
    const oldest = accessOrder.shift();
    if (oldest) cache.delete(oldest);
  }
}

function touch(key: string): void {
  const idx = accessOrder.indexOf(key);
  if (idx >= 0) accessOrder.splice(idx, 1);
  accessOrder.push(key);
}

export async function getArchiveIndex(archivePath: string): Promise<SevenZipEntry[]> {
  const key = makeCacheKey(archivePath);
  if (!key) throw new Error('Archive not found');

  const cached = cache.get(key);
  if (cached) {
    touch(key);
    return cached.entries;
  }

  const raw = await listArchive(archivePath);
  const filtered: SevenZipEntry[] = [];

  for (const e of raw) {
    if (e.isDirectory) {
      filtered.push(e);
      continue;
    }
    if (e.size > MAX_SINGLE_FILE) continue;
    filtered.push(e);
  }

  console.log('[ArchiveCache] Fetching from 7z:', archivePath);

  cache.set(key, { entries: filtered, fetchedAt: Date.now() });
  accessOrder.push(key);
  trimCache();
  saveCacheToDisk();

  return filtered;
}

/**
 * バックグラウンドでアーカイブのインデックスを先行取得する
 */
export async function prefetchArchiveIndex(archivePath: string): Promise<void> {
  const key = makeCacheKey(archivePath);
  if (!key || cache.has(key)) return;

  try {
    console.log('[ArchiveCache:Prefetch] Starting prefetch:', archivePath);
    await getArchiveIndex(archivePath);
  } catch (err) {
    console.warn('[ArchiveCache:Prefetch] Failed to prefetch:', archivePath, err);
  }
}
