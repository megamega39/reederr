import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DirectoryEntry, FileStats } from './types';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']);
const VIDEO_EXT = new Set(['.mp4', '.webm', '.avi', '.mkv', '.mov', '.wmv', '.m4v']);
const AUDIO_EXT = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac']);

function isImage(name: string): boolean {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  return IMAGE_EXT.has(ext);
}

function isVideo(name: string): boolean {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  return VIDEO_EXT.has(ext);
}

function isAudio(name: string): boolean {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  return AUDIO_EXT.has(ext);
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
      isImage(e.name) ||
      isVideo(e.name) ||
      isAudio(e.name);

    if (include) {
      let size: number | undefined;
      let mtime: number | undefined;
      try {
        const s = statSync(fullPath);
        if (!isDir) size = s.size;
        mtime = s.mtimeMs;
      } catch {
        size = undefined;
        mtime = undefined;
      }
      result.push({
        name: e.name,
        path: fullPath,
        isDirectory: isDir,
        isArchive,
        size,
        mtime,
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
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
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
