import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SevenZipEntry } from './sevenZip';
import { listArchive } from './sevenZip';

const MAX_CACHE_SIZE = 20;
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.jpe', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif']);
const VIDEO_EXT = new Set(['.mp4', '.webm', '.avi', '.mkv', '.mov', '.wmv', '.m4v']);
const AUDIO_EXT = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac']);
const MAX_SINGLE_FILE = 2 * 1024 * 1024 * 1024; // 2GB
const MAX_TOTAL_SIZE = 10 * 1024 * 1024 * 1024; // 10GB

/** 拡張子は大文字小文字を区別しない */
function isMediaPath(path: string): boolean {
  const dotIdx = path.lastIndexOf('.');
  if (dotIdx < 0) return false;
  const ext = ('.' + path.slice(dotIdx + 1)).toLowerCase();
  return IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext) || AUDIO_EXT.has(ext);
}

interface CacheEntry {
  entries: SevenZipEntry[];
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const accessOrder: string[] = [];

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

/**
 * アーカイブのインデックスを取得（キャッシュ付き）。
 * ディレクトリと全ファイルを返し、サブフォルダ構造を正しく推論できるようにする。
 * メディアの抽出用に isMediaPath でフィルタする必要がある場合は呼び出し側で実施。
 */
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

  console.log('[Reederr VFS] getArchiveIndex', {
    archivePath,
    rawEntriesFrom7z: raw.length,
    afterFilter: filtered.length,
    dirs: filtered.filter((e) => e.isDirectory).length,
    files: filtered.filter((e) => !e.isDirectory).length,
  });

  trimCache();
  cache.set(key, { entries: filtered, fetchedAt: Date.now() });
  accessOrder.push(key);

  return filtered;
}
