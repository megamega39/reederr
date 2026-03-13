import { app } from 'electron';
import { statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { platform } from 'node:os';
import { toLongPathIfNeeded } from './utils/longPath';

export type IconSize = 16 | 20;

const iconCache = new Map<string, string>();
const pendingCache = new Map<string, Promise<string>>();

const FOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FFB900" stroke="#CC9200" stroke-width="1">
  <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
</svg>`;

const FILE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#fff" stroke="#999" stroke-width="1">
  <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z"/>
  <path d="M14 2v6h6" fill="none"/>
</svg>`;

const IMAGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#E1F5FE" stroke="#0288D1" stroke-width="1">
  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
  <circle cx="8.5" cy="8.5" r="1.5"/>
  <polyline points="21 15 16 10 5 21"/>
</svg>`;

const ARCHIVE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FFF9C4" stroke="#FBC02D" stroke-width="1">
  <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
</svg>`;

const VIDEO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FCE4EC" stroke="#C2185B" stroke-width="1">
  <path d="M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z"/>
</svg>`;

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

const FALLBACK_FOLDER = svgToDataUrl(FOLDER_SVG);
const FALLBACK_FILE = svgToDataUrl(FILE_SVG);
const FALLBACK_IMAGE = svgToDataUrl(IMAGE_SVG);
const FALLBACK_ARCHIVE = svgToDataUrl(ARCHIVE_SVG);
const FALLBACK_VIDEO = svgToDataUrl(VIDEO_SVG);

/** 通常フォルダ用の黄色フォルダアイコン（Windows標準と同等、16/20px） */
function getFolderStockDataUrl(size: 16 | 20): string {
  const s = size;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${s}" height="${s}"><path fill="#FFB900" stroke="#CC9200" stroke-width="0.5" d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`;
  return svgToDataUrl(svg);
}

const FOLDER_STOCK_16 = getFolderStockDataUrl(16);
const FOLDER_STOCK_20 = getFolderStockDataUrl(20);

const SPECIAL_KEYS = ['desktop', 'home', 'downloads', 'documents', 'pictures', 'music', 'videos'] as const;

function isSpecialFolder(absPath: string): boolean {
  try {
    const normalized = absPath.replace(/\//g, '\\').toLowerCase();
    for (const key of SPECIAL_KEYS) {
      const p = app.getPath(key);
      if (p && p.replace(/\//g, '\\').toLowerCase() === normalized) return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** キャッシュキー: absPath + '@' + size（拡張子キー禁止） */
function getCacheKey(absPath: string, size: IconSize): string {
  const normalized = absPath.toLowerCase().replace(/\//g, '\\');
  return `${normalized}@${size}`;
}

function isDriveRoot(absPath: string): boolean {
  const normalized = absPath.replace(/\//g, '\\');
  const root = path.parse(normalized).root;
  return !!root && normalized === root;
}

function resizeToDataUrl(icon: Electron.NativeImage, size: IconSize): string {
  return icon.resize({ width: size, height: size }).toDataURL();
}

export async function getFileIcon(absPath: string, size: IconSize): Promise<string> {
  if (!absPath) return FALLBACK_FILE;

  const ext = path.extname(absPath).toLowerCase();
  const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.ico'].includes(ext);
  const isArchive = ['.zip', '.rar', '.7z', '.cbz', '.cbr', '.tar', '.gz'].includes(ext);
  const isVideo = ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.webm'].includes(ext);

  function getBestFallback(isDir: boolean): string {
    if (isDir) return FALLBACK_FOLDER;
    if (isImage) return FALLBACK_IMAGE;
    if (isArchive) return FALLBACK_ARCHIVE;
    if (isVideo) return FALLBACK_VIDEO;
    return FALLBACK_FILE;
  }

  const longPath = toLongPathIfNeeded(absPath);
  const exists = existsSync(longPath);

  // Handle virtual paths (inside archives) OR non-existent files
  if (!exists) {
    return getBestFallback(false);
  }

  let isDirectory: boolean;
  try {
    isDirectory = statSync(longPath).isDirectory();
  } catch {
    isDirectory = false;
  }

  const driveRoot = isDriveRoot(absPath);

  if (platform() !== 'win32') {
    return getBestFallback(isDirectory);
  }

  if (isDirectory && !driveRoot) {
    if (isSpecialFolder(absPath)) {
      const cacheKey = getCacheKey(absPath, size);
      const cached = iconCache.get(cacheKey);
      if (cached) return cached;
      try {
        const icon = await app.getFileIcon(absPath, { size: 'normal' });
        const dataUrl = resizeToDataUrl(icon, size);
        if (dataUrl?.startsWith('data:')) {
          iconCache.set(cacheKey, dataUrl);
          return dataUrl;
        }
      } catch (e) {
        console.warn('[getFileIcon] special folder failed:', absPath, e);
      }
    }
    return size === 16 ? FOLDER_STOCK_16 : FOLDER_STOCK_20;
  }

  const cacheKey = getCacheKey(absPath, size);
  const cached = iconCache.get(cacheKey);
  if (cached) return cached;

  let pending = pendingCache.get(cacheKey);
  if (!pending) {
    pending = (async () => {
      try {
        const icon = await app.getFileIcon(absPath, { size: 'normal' });
        const dataUrl = resizeToDataUrl(icon, size);
        if (dataUrl && dataUrl.startsWith('data:')) {
          iconCache.set(cacheKey, dataUrl);
          return dataUrl;
        }
      } catch (e) {
        if (absPath !== longPath) {
          try {
            const icon = await app.getFileIcon(longPath, { size: 'normal' });
            const dataUrl = resizeToDataUrl(icon, size);
            if (dataUrl && dataUrl.startsWith('data:')) {
              iconCache.set(cacheKey, dataUrl);
              return dataUrl;
            }
          } catch { /* ignore */ }
        }
        console.warn('[getFileIcon] fetch failed:', absPath, e);
      }
      const result = getBestFallback(isDirectory);
      iconCache.set(cacheKey, result);
      return result;
    })().finally(() => {
      pendingCache.delete(cacheKey);
    });
    pendingCache.set(cacheKey, pending);
  }
  return pending;
}
