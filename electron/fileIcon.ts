import { app } from 'electron';
import { statSync } from 'node:fs';
import path from 'node:path';
import { platform } from 'node:os';

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

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

const FALLBACK_FOLDER = svgToDataUrl(FOLDER_SVG);

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
const FALLBACK_FILE = svgToDataUrl(FILE_SVG);

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

function getFallback(isDir: boolean): string {
  return isDir ? FALLBACK_FOLDER : FALLBACK_FILE;
}

function resizeToDataUrl(icon: Electron.NativeImage, size: IconSize): string {
  return icon.resize({ width: size, height: size }).toDataURL();
}

export async function getFileIcon(absPath: string, size: IconSize): Promise<string> {
  if (!absPath) return FALLBACK_FILE;

  let isDirectory: boolean;
  try {
    isDirectory = statSync(absPath).isDirectory();
  } catch {
    isDirectory = false;
  }

  const driveRoot = isDriveRoot(absPath);

  if (platform() !== 'win32') {
    return getFallback(isDirectory);
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
        console.warn('[getFileIcon] fetch failed:', absPath, e);
      }
      const result = getFallback(isDirectory);
      iconCache.set(cacheKey, result);
      return result;
    })().finally(() => {
      pendingCache.delete(cacheKey);
    });
    pendingCache.set(cacheKey, pending);
  }
  return pending;
}

