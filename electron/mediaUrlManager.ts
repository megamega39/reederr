import { existsSync, unlinkSync } from 'node:fs';
import { extractToTemp } from './vfs/sevenZip';
import { splitArchivePath } from './vfs/utils';
import { tempManager } from './vfs/tempManager';
import { VIDEO_EXT, AUDIO_EXT } from './vfs/constants';

const MEDIA_ID_PREFIX = 'm';
let mediaIdCounter = 0;
const mediaPathMap = new Map<string, string>();
const idToTempPath = new Map<string, string>();

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

    const cacheKey = `media:${archivePath}!${innerPath}`;
    const cachedPath = tempManager.getFile(cacheKey);
    if (cachedPath) {
      const id = registerMediaPath(cachedPath, true);
      return _options?.rawId ? id : `media://${id}`;
    }

    const lowerInner = innerPath.toLowerCase();
    const isVideo = [...VIDEO_EXT].some(ext => lowerInner.endsWith(ext));
    const isAudio = [...AUDIO_EXT].some(ext => lowerInner.endsWith(ext));

    // 動画以外は VFS ストリーミングを優先（ただし ZIP/RAR のみ）
    // RAR は現状ストリーミング未対応なので除外
    if (!isVideo && isZipArchive(archivePath)) {
      const id = `${MEDIA_ID_PREFIX}v${++mediaIdCounter}-${Date.now()}`;
      mediaPathMap.set(id, vpath); // Virtual path (with !)
      return _options?.rawId ? id : `media://${id}`;
    }

    // 動画/音声、またはストリーミング非対応のアーカイブは一時フォルダに展開して配信
    const { isArchiveExtension } = await import('./vfs/utils');
    if (isVideo || isAudio || isArchiveExtension(archivePath)) {
      const subDir = tempManager.getTempDirForEntry(archivePath, innerPath);
      const extractedPath = await extractToTemp(archivePath, innerPath, subDir);
      
      tempManager.registerFile(cacheKey, extractedPath);
      const id = registerMediaPath(extractedPath, true);
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
      // Actual temp file deletion is managed by TempManager LRU,
      // but we remove the manual reference here.
      try {
        if (existsSync(tempPath)) {
          // If it was a one-off temp (not in TempManager), we might want to unlink,
          // but for consistency we let TempManager handle its pool.
        }
      } catch { /* ignore */ }
    }
  }
}

export function disposeAllTemp(): void {
  for (const id of idToTempPath.keys()) {
    mediaPathMap.delete(id);
  }
  idToTempPath.clear();
  tempManager.cleanupAll();
}
