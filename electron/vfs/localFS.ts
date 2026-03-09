import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DirectoryEntry, FileStats } from './types';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']);

function isImage(name: string): boolean {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  return IMAGE_EXT.has(ext);
}

export function listDirectory(path: string): DirectoryEntry[] {
  const entries = readdirSync(path, { withFileTypes: true, encoding: 'utf-8' });
  const result: DirectoryEntry[] = [];

  for (const e of entries) {
    const fullPath = join(path, e.name);
    const isDir = e.isDirectory();
    const isArchive = ['.zip', '.rar', '.cbz', '.cbr'].some(
      (ext) => e.name.toLowerCase().endsWith(ext)
    );
    const include =
      isDir ||
      isArchive ||
      isImage(e.name);

    if (include) {
      result.push({
        name: e.name,
        path: fullPath,
        isDirectory: isDir,
        isArchive,
      });
    }
  }

  result.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  return result;
}

export function readFile(path: string): ArrayBuffer {
  const buf = readFileSync(path);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

export function stat(path: string): FileStats | null {
  try {
    const s = statSync(path);
    return {
      size: s.size,
      isDirectory: s.isDirectory(),
      mtime: s.mtimeMs,
    };
  } catch {
    return null;
  }
}
