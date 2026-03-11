import { existsSync } from 'node:fs';
import { Readable } from 'node:stream';
import type { DirectoryEntry, FileStats } from './types';
import { get7zPath } from '../sevenZipPath';
import { getArchiveIndex } from './archiveIndexCache';
import { extractToStdout, extractToStream } from './sevenZip';
import { splitArchivePath } from './utils';

import { ARCHIVE_EXT_REGEX, isArchiveExtension } from './utils';

const RAR_EXT = ['.rar', '.cbr'];

function isRarArchive(path: string): boolean {
  const lower = path.toLowerCase();
  return RAR_EXT.some((ext) => lower.endsWith(ext));
}


function isArchivePath(path: string): boolean {
  return isArchiveExtension(path);
}

export function isArchiveListingPath(path: string): boolean {
  const split = splitArchivePath(path);
  if (split) {
    const archivePart = split[0];
    return existsSync(archivePart) && isArchivePath(archivePart);
  }
  return existsSync(path) && isArchivePath(path);
}

export async function listArchiveDirectory(
  path: string,
  options?: { recursive?: boolean }
): Promise<DirectoryEntry[]> {
  let archivePath = path;
  let prefix = '';

  const split = splitArchivePath(path);
  if (split) {
    archivePath = split[0];
    const innerPrefix = split[1].replace(/\\/g, '/');
    prefix = innerPrefix ? (innerPrefix.endsWith('/') ? innerPrefix : innerPrefix + '/') : '';
  }

  if (isRarArchive(archivePath)) {
    return []; // RAR は rarFS に委譲（composite で先に振り分け）
  }
  if (!get7zPath()) {
    throw new Error(
      '7-Zip (7z.exe) が見つかりません。ZIP/CBZ を開くには tools/7zip に 7z.exe と 7z.dll を配置してください。'
    );
  }
  return listZipVia7z(archivePath, prefix, options?.recursive ?? false);
}

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.jpe', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif']);
const VIDEO_EXT = new Set(['.mp4', '.webm', '.avi', '.mkv', '.mov', '.wmv', '.m4v']);
const AUDIO_EXT = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac']);

/** 拡張子は大文字小文字を区別しない（.JPG, .jpg ともに画像として認識） */
function isMediaPath(path: string): boolean {
  const dotIdx = path.lastIndexOf('.');
  if (dotIdx < 0) return false;
  const ext = ('.' + path.slice(dotIdx + 1)).toLowerCase();
  return IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext) || AUDIO_EXT.has(ext);
}

/** パスが prefix で始まるか（大文字小文字を区別しない、ZIP内パス用） */
function pathStartsWith(path: string, prefix: string): boolean {
  if (!prefix) return true;
  return path.toLowerCase().startsWith(prefix.toLowerCase());
}

function isJunkPath(name: string): boolean {
  return name === '__MACOSX' || name.startsWith('._') || name === '.DS_Store';
}

/** 7-Zip で ZIP 一覧取得。パス比較は大文字小文字を区別しない。 */
async function listZipVia7z(
  archivePath: string,
  prefix: string,
  recursive: boolean
): Promise<DirectoryEntry[]> {
  const index = await getArchiveIndex(archivePath);
  const prefixNorm = prefix.replace(/^\/+/, '');
  const prefixBase = prefix.replace(/\/$/, '');

  // デバッグ: フィルタ前のZIP内全エントリ数
  const totalRawEntries = index.length;
  const filesInIndex = index.filter((e) => !e.isDirectory).length;

  if (recursive) {
    const result: DirectoryEntry[] = [];
    for (const e of index) {
      if (e.isDirectory) continue;
      const p = e.path.replace(/\\/g, '/').replace(/^\/+/, '');
      if (prefixNorm && !pathStartsWith(p, prefixNorm)) continue;
      const rest = p.slice(prefixNorm.length).replace(/^\/+/, '');
      if (!rest) continue;
      const parts = rest.split('/').filter(Boolean);
      if (parts.length === 0) continue;
      if (isJunkPath(parts[0])) continue;
      if (!isMediaPath(e.path)) continue;
      const name = p.split('/').pop() ?? p;
      result.push({
        name,
        path: archivePath + '!' + p,
        isDirectory: false,
        isArchive: false,
        size: e.size,
        mtime: e.mtime,
      });
    }
    console.log('[Reederr VFS] listZipVia7z(recursive)', {
      totalRawEntries,
      filesInIndex,
      prefix: prefixNorm,
      matchingMediaCount: result.length,
    });
    result.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return result;
  }

  const seen = new Map<string, { isDir: boolean; size?: number; mtime?: number }>();
  let matchingCount = 0;
  for (const e of index) {
    const p = e.path.replace(/\\/g, '/').replace(/^\/+/, '');
    if (prefixNorm && !pathStartsWith(p, prefixNorm)) continue;
    const rest = p.slice(prefixNorm.length).replace(/^\/+/, '');
    if (!rest) continue;
    matchingCount++;
    const parts = rest.split('/').filter(Boolean);
    if (parts.length === 0) continue;
    const firstName = parts[0];
    if (isJunkPath(firstName)) continue;
    const isDir = e.isDirectory || parts.length > 1;

    if (!seen.has(firstName)) {
      seen.set(firstName, {
        isDir,
        size: e.isDirectory ? undefined : e.size,
        mtime: e.mtime,
      });
    } else {
      const prev = seen.get(firstName)!;
      if (isDir) prev.isDir = true;
    }
  }

  const result: DirectoryEntry[] = [];
  for (const [name, meta] of seen) {
    result.push({
      name,
      path: archivePath + '!' + (prefixBase ? prefixBase + '/' : '') + name,
      isDirectory: meta.isDir,
      isArchive: false,
      size: meta.size,
      mtime: meta.mtime,
    });
  }

  // Leeyes風: ルート直下にフォルダ1つだけでファイル0個の場合、自動で1階層潜る
  if (!prefixNorm && result.length === 1 && result[0].isDirectory && !recursive) {
    const soleDir = result[0].name;
    return listZipVia7z(archivePath, soleDir + '/', false);
  }

  console.log('[Reederr VFS] listZipVia7z', {
    totalRawEntries,
    filesInIndex,
    prefix: prefixNorm,
    matchingBeforeSeen: matchingCount,
    entriesAfterFilter: result.length,
    entryNames: result.map((r) => r.name),
  });

  result.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
  return result;
}

export async function readFileFromArchive(path: string): Promise<ArrayBuffer> {
  const split = splitArchivePath(path);
  if (!split) {
    throw new Error('Not an archive path');
  }
  const [archivePath, innerPathRaw] = split;
  const innerPath = innerPathRaw.replace(/\\/g, '/').replace(/^\/+/, '');

  if (isRarArchive(archivePath)) {
    throw new Error('RAR files must be read via rarFS');
  }

  if (!get7zPath()) {
    throw new Error(
      '7-Zip (7z.exe) が見つかりません。ZIP/CBZ を開くには tools/7zip に 7z.exe と 7z.dll を配置してください。'
    );
  }
  const buf = await extractToStdout(archivePath, innerPath);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

export async function statFromArchive(path: string): Promise<FileStats | null> {
  const split = splitArchivePath(path);
  if (!split) return null;
  const [archivePath, innerPathRaw] = split;
  const innerPath = innerPathRaw.replace(/\\/g, '/').replace(/^\/+/, '');

  const index = await getArchiveIndex(archivePath);
  const entry = index.find(e => e.path.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase() === innerPath.toLowerCase());
  if (!entry) return null;

  return {
    size: entry.size,
    isDirectory: entry.isDirectory,
    mtime: entry.mtime,
  };
}

export function streamFileFromArchive(path: string): Readable {
  const split = splitArchivePath(path);
  if (!split) {
    throw new Error('Not an archive path');
  }
  const [archivePath, innerPathRaw] = split;
  const innerPath = innerPathRaw.replace(/\\/g, '/').replace(/^\/+/, '');

  if (isRarArchive(archivePath)) {
    throw new Error('RAR streaming is not yet implemented in archiveFS');
  }

  return extractToStream(archivePath, innerPath);
}
