import { createReadStream } from 'node:fs';
import { readdir, stat as statAsync, readFile as readFileAsync } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { join } from 'node:path';
import type { DirectoryEntry, FileStats, ListDirectoryOptions } from './types';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']);
const VIDEO_EXT = new Set(['.mp4', '.webm', '.avi', '.mkv', '.mov', '.wmv', '.m4v']);
const AUDIO_EXT = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac']);
const PARALLEL_STAT_LIMIT = 20;

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

export function streamFile(path: string, options?: { start?: number; end?: number }): Readable {
  return createReadStream(path, options);
}

export async function listDirectory(path: string, options?: ListDirectoryOptions): Promise<DirectoryEntry[]> {
  const entries = await readdir(path, { withFileTypes: true, encoding: 'utf-8' });
  
  // 1. Prepare base entries
  const result: DirectoryEntry[] = entries.map(e => {
    const isDir = e.isDirectory();
    const isArchive = !isDir && /\.(zip|cbz|rar|cbr|7z|7zip|tar|gz|bz2|xz|iso|lzh|lha|lzma)$/i.test(e.name);
    return {
      name: e.name,
      path: join(path, e.name),
      isDirectory: isDir,
      isArchive,
    };
  }).filter(e => {
    return e.isDirectory || e.isArchive || isImage(e.name) || isVideo(e.name) || isAudio(e.name);
  });

  // 2. Fetch stats in parallel for the whole list
  if (!options?.skipStats) {
    const PARALLEL_LIMIT = PARALLEL_STAT_LIMIT;
    for (let i = 0; i < result.length; i += PARALLEL_LIMIT) {
      const chunk = result.slice(i, i + PARALLEL_LIMIT);
      await Promise.all(
        chunk.map(async (target) => {
          try {
            const s = await statAsync(target.path);
            if (!target.isDirectory) target.size = s.size;
            target.mtime = s.mtimeMs;
          } catch {
            // ignore stat errors
          }
        })
      );
    }
  }

  result.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  return result;
}

export async function readFile(path: string): Promise<ArrayBuffer> {
  const buf = await readFileAsync(path);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

export async function stat(path: string): Promise<FileStats | null> {
  try {
    const s = await statAsync(path);
    return {
      size: s.size,
      isDirectory: s.isDirectory(),
      mtime: s.mtimeMs,
    };
  } catch {
    return null;
  }
}
