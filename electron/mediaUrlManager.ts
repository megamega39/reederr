import { existsSync, unlinkSync } from 'node:fs';
import { extractToTemp } from './vfs/sevenZip';
import { splitArchivePath } from './vfs/utils';
import { tempManager } from './vfs/tempManager';
import { VIDEO_EXT, AUDIO_EXT } from './vfs/constants';
import { toLongPathIfNeeded } from './utils/longPath';

const MEDIA_ID_PREFIX = 'm';
let mediaIdCounter = 0;
const mediaPathMap = new Map<string, string>();
const idToTempPath = new Map<string, string>();

// Simple queue for archive extractions to prevent concurrent extractions to the same subdir
const extractionQueues = new Map<string, Promise<any>>();

async function enqueueExtraction<T>(archivePath: string, task: () => Promise<T>): Promise<T> {
  const EXTRACTION_TIMEOUT_MS = 60_000;
  const previous = extractionQueues.get(archivePath) || Promise.resolve();
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Extraction timed out for ${archivePath} after ${EXTRACTION_TIMEOUT_MS}ms`)), EXTRACTION_TIMEOUT_MS);
  });

  const next = (async () => {
    try {
      await previous;
    } catch {
      // ignore
    }
    return Promise.race([task(), timeoutPromise]);
  })();
  
  extractionQueues.set(archivePath, next);
  try {
    return await next;
  } finally {
    if (extractionQueues.get(archivePath) === next) {
      extractionQueues.delete(archivePath);
    }
  }
}

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
  const checkPath = toLongPathIfNeeded(realPath);
  if (!existsSync(checkPath)) {
    throw new Error(`File not found: ${realPath}`);
  }
  const id = `${MEDIA_ID_PREFIX}${++mediaIdCounter}-${Date.now()}`;
  mediaPathMap.set(id, realPath);
  if (isTemp) {
    idToTempPath.set(id, realPath);
  }
  return id;
}

export async function getMediaUrls(
  vpaths: string[],
  _options?: { rawId?: boolean }
): Promise<string[]> {
  if (vpaths.length === 0) return [];
  
  // Group by archive to batch extract
  const archiveGroups = new Map<string, string[]>();
  const physicalPaths: string[] = [];
  const results = new Array(vpaths.length).fill('');

  vpaths.forEach((v, i) => {
    const split = splitArchivePath(v);
    if (split) {
      const archivePath = split[0];
      const innerPath = split[1];
      if (!archiveGroups.has(archivePath)) archiveGroups.set(archivePath, []);
      archiveGroups.get(archivePath)!.push(innerPath);
    } else {
      physicalPaths.push(v);
    }
  });

  // Handle archives in batches
  for (const [archivePath, innerPaths] of archiveGroups.entries()) {
    const subDir = tempManager.getTempDirForEntry(archivePath, innerPaths[0]); // Use first as anchor

    // Use our queue to prevent concurrent extraction for the same archive
    const extractedPaths = await enqueueExtraction(archivePath, async () => {
       const { extractMultipleToTemp } = await import('./vfs/sevenZip');
       try {
         return await extractMultipleToTemp(archivePath, innerPaths, subDir);
       } catch (err) {
         console.error(`[mediaUrlManager] Batch extraction failed for ${archivePath}:`, err);
         throw err;
       }
    });
    
    innerPaths.forEach((inner, idx) => {
      const vpath = `${archivePath}!${inner}`;
      const realPath = extractedPaths[idx];
      if (!realPath) return; // Skip failed extractions

      const cacheKey = `media:${archivePath}!${inner}`;
      tempManager.registerFile(cacheKey, realPath);
      const id = registerMediaPath(realPath, true);
      
      // Find where this vpath was in the original request
      vpaths.forEach((orig, origIdx) => {
        if (orig === vpath) results[origIdx] = _options?.rawId ? id : `media://${id}`;
      });
    });
  }

  // Handle physical paths
  physicalPaths.forEach(v => {
    const id = registerMediaPath(v, false);
    vpaths.forEach((orig, origIdx) => {
      if (orig === v) results[origIdx] = _options?.rawId ? id : `media://${id}`;
    });
  });

  return results;
}

export async function getMediaUrl(
  vpath: string,
  _options?: { rawId?: boolean }
): Promise<string> {
  const urls = await getMediaUrls([vpath], _options);
  return urls[0];
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
