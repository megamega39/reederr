import { existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractToTemp } from './vfs/sevenZip';
import { splitArchivePath } from './vfs/utils';

const MEDIA_ID_PREFIX = 'm';
let mediaIdCounter = 0;
const mediaPathMap = new Map<string, string>();
const idToTempPath = new Map<string, string>();

const MAX_TEMP_FILES = 200;
const MAX_TEMP_BYTES = 2 * 1024 * 1024 * 1024; // 2GB

const extractCache = new Map<
  string,
  { path: string; size: number; lastAccess: number; mediaId: string }
>();
let extractCacheTotalBytes = 0;
const accessOrder: string[] = [];

function isRarArchive(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith('.rar') || lower.endsWith('.cbr');
}

function isZipArchive(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith('.zip') || lower.endsWith('.cbz');
}

export function getMediaPathMap(): Map<string, string> {
  return mediaPathMap;
}

export function registerMediaPath(realPath: string, isTemp = false): string {
  if (!existsSync(realPath)) {
    throw new Error(`File not found: ${realPath}`);
  }
  const id = `${MEDIA_ID_PREFIX}${++mediaIdCounter}-${Date.now()}`;
  mediaPathMap.set(id, realPath);
  if (isTemp) {
    idToTempPath.set(id, realPath);
  }
  return id;
}

function evictExtractCache(): void {
  const sorted = [...accessOrder].sort(
    (a, b) => (extractCache.get(a)?.lastAccess ?? 0) - (extractCache.get(b)?.lastAccess ?? 0)
  );
  for (const key of sorted) {
    if (extractCache.size <= 1 && extractCacheTotalBytes < MAX_TEMP_BYTES * 0.5) break;
    const ent = extractCache.get(key);
    if (!ent) continue;
    try {
      unlinkSync(ent.path);
    } catch {
      /* ignore */
    }
    mediaPathMap.delete(ent.mediaId);
    idToTempPath.delete(ent.mediaId);
    extractCache.delete(key);
    const idx = accessOrder.indexOf(key);
    if (idx >= 0) accessOrder.splice(idx, 1);
    extractCacheTotalBytes -= ent.size;
  }
}

export async function getMediaUrl(
  vpath: string,
  _options?: { rawId?: boolean }
): Promise<string> {
  const split = splitArchivePath(vpath);
  if (split) {
    const archivePath = split[0];
    const innerPath = split[1];
    if (!archivePath || !innerPath || !existsSync(archivePath)) {
      throw new Error('Archive or path not found');
    }

    const cacheKey = `${archivePath}!${innerPath}`;
    const cached = extractCache.get(cacheKey);
    if (cached && existsSync(cached.path)) {
      cached.lastAccess = Date.now();
      const idx = accessOrder.indexOf(cacheKey);
      if (idx >= 0) accessOrder.splice(idx, 1);
      accessOrder.push(cacheKey);
      return _options?.rawId ? cached.mediaId : `media://${cached.mediaId}`;
    }

    const lowerInner = innerPath.toLowerCase();
    const isVideo = ['.mp4', '.webm', '.avi', '.mkv', '.mov', '.wmv', '.m4v'].some(ext => lowerInner.endsWith(ext));
    const isAudio = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'].some(ext => lowerInner.endsWith(ext));

    // 動画以外は VFS ストリーミングを優先（ただし ZIP/RAR のみ）
    // RAR は現状ストリーミング未対応なので除外
    // また巨大ファイル（200MB超）も一応抽出を検討するが、画像ならストリーミングで良い
    if (!isVideo && !isRarArchive(archivePath)) {
      const id = `${MEDIA_ID_PREFIX}v${++mediaIdCounter}-${Date.now()}`;
      mediaPathMap.set(id, vpath); // Virtual path (with !)
      return _options?.rawId ? id : `media://${id}`;
    }

    if (isRarArchive(archivePath)) {
      const tempBase = join(tmpdir(), 'reederr-media');
      if (!existsSync(tempBase)) mkdirSync(tempBase, { recursive: true });
      const subDir = join(tempBase, `extract-${Date.now()}`);
      mkdirSync(subDir, { recursive: true });
      const extractedPath = await extractToTemp(archivePath, innerPath, subDir);
      let size = 0;
      try {
        size = statSync(extractedPath).size;
      } catch {
        /* ignore */
      }
      while (
        extractCache.size >= MAX_TEMP_FILES ||
        extractCacheTotalBytes + size > MAX_TEMP_BYTES
      ) {
        evictExtractCache();
      }
      const id = registerMediaPath(extractedPath, true);
      extractCache.set(cacheKey, {
        path: extractedPath,
        size,
        lastAccess: Date.now(),
        mediaId: id,
      });
      accessOrder.push(cacheKey);
      extractCacheTotalBytes += size;
      return _options?.rawId ? id : `media://${id}`;
    }

    if (isZipArchive(archivePath)) {
      const tempBase = join(tmpdir(), 'reederr-media');
      if (!existsSync(tempBase)) mkdirSync(tempBase, { recursive: true });
      const subDir = join(tempBase, `zip-${Date.now()}`);
      mkdirSync(subDir, { recursive: true });
      const tempPath = await extractToTemp(archivePath, innerPath, subDir);
      let size = 0;
      try {
        size = statSync(tempPath).size;
      } catch {
        /* ignore */
      }
      while (
        extractCache.size >= MAX_TEMP_FILES ||
        extractCacheTotalBytes + size > MAX_TEMP_BYTES
      ) {
        evictExtractCache();
      }
      const id = registerMediaPath(tempPath, true);
      extractCache.set(cacheKey, {
        path: tempPath,
        size,
        lastAccess: Date.now(),
        mediaId: id,
      });
      accessOrder.push(cacheKey);
      extractCacheTotalBytes += size;
      return _options?.rawId ? id : `media://${id}`;
    }
  }
  if (!existsSync(vpath)) throw new Error('File not found');
  const id = registerMediaPath(vpath, false);
  return _options?.rawId ? id : `media://${id}`;
}

export function disposeMediaIdFromUrl(url: string): void {
  if (!url.startsWith('media://')) return;
  const id = url.slice(7); // 'media://'.length
  if (id) disposeMediaId(id, true);
}

export function disposeMediaId(id: string, deleteTemp = false): void {
  mediaPathMap.delete(id);
  if (deleteTemp) {
    const tempPath = idToTempPath.get(id);
    if (tempPath) {
      idToTempPath.delete(id);
      for (const [key, ent] of extractCache) {
        if (ent.mediaId === id) {
          extractCache.delete(key);
          const idx = accessOrder.indexOf(key);
          if (idx >= 0) accessOrder.splice(idx, 1);
          extractCacheTotalBytes -= ent.size;
          break;
        }
      }
      try {
        unlinkSync(tempPath);
      } catch {
        /* ignore */
      }
    }
  }
}

export function disposeAllTemp(): void {
  for (const [id, tempPath] of idToTempPath) {
    mediaPathMap.delete(id);
    try {
      unlinkSync(tempPath);
    } catch {
      /* ignore */
    }
  }
  idToTempPath.clear();
  for (const ent of extractCache.values()) {
    mediaPathMap.delete(ent.mediaId);
    try {
      unlinkSync(ent.path);
    } catch {
      /* ignore */
    }
  }
  extractCache.clear();
  accessOrder.length = 0;
  extractCacheTotalBytes = 0;
}
