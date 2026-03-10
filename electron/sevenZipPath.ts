import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

let cachedPath: string | null = null;
let cacheChecked = false;

/**
 * 7z.exe の絶対パスを取得。
 * - dev: プロジェクト内 tools/7zip/7z.exe
 * - prod: process.resourcesPath 配下の tools/7zip/7z.exe
 */
export function get7zPath(): string | null {
  if (cacheChecked) return cachedPath;
  cacheChecked = true;

  const candidates: string[] = [];

  if (app.isPackaged && process.resourcesPath) {
    candidates.push(join(process.resourcesPath, 'tools', '7zip', '7z.exe'));
  }

  try {
    const __filename = fileURLToPath(import.meta.url);
    const electronDir = dirname(__filename);
    const projectRoot = join(electronDir, '..');
    candidates.push(join(projectRoot, 'tools', '7zip', '7z.exe'));
  } catch {
    /* ignore */
  }

  for (const p of candidates) {
    if (existsSync(p)) {
      cachedPath = p;
      return p;
    }
  }

  return null;
}

/**
 * 7-Zip が利用可能かどうか。
 */
export function is7zAvailable(): boolean {
  return get7zPath() !== null;
}
