import { app } from 'electron';
import { platform } from 'node:os';
import { existsSync } from 'node:fs';

export function getDrives(): Array<{ name: string; path: string }> {
  const drives: Array<{ name: string; path: string }> = [];
  if (platform() !== 'win32') return drives;
  for (let i = 65; i <= 90; i++) {
    const letter = String.fromCharCode(i) + ':';
    const path = letter + '\\';
    if (existsSync(path)) {
      const name = letter === 'C:' ? `Windows (${letter})` : `ボリューム (${letter})`;
      drives.push({ name, path });
    }
  }
  return drives;
}

export function getSpecialFolders(): Array<{ name: string; path: string }> {
  const folders: Array<{ name: string; path: string }> = [];
  const items: Array<[string, string]> = [
    ['デスクトップ', 'desktop'],
    ['ダウンロード', 'downloads'],
    ['ドキュメント', 'documents'],
    ['ピクチャ', 'pictures'],
    ['ミュージック', 'music'],
    ['ビデオ', 'videos'],
  ];
  for (const [name, key] of items) {
    try {
      const p = app.getPath(key as any);
      if (p) folders.push({ name, path: p });
    } catch (e) {
      console.warn(`get-special-folders: ${key}`, e);
    }
  }
  return folders;
}
