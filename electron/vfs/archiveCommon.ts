import { DirectoryEntry, FileStats } from './types';
import { IMAGE_EXT, VIDEO_EXT, AUDIO_EXT } from './constants';

/** 拡張子は大文字小文字を区別しない */
export function isMediaPath(path: string): boolean {
  const dotIdx = path.lastIndexOf('.');
  if (dotIdx < 0) return false;
  const ext = ('.' + path.slice(dotIdx + 1)).toLowerCase();
  return IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext) || AUDIO_EXT.has(ext);
}

/** OS固有の隠しファイルやジャンクファイルを除外 */
export function isJunkPath(name: string): boolean {
  return name === '__MACOSX' || name.startsWith('._') || name === '.DS_Store';
}

/** パスが prefix で始まるか（大文字小文字を区別せず、ディレクトリ区切りを考慮） */
export function pathStartsWith(path: string, prefix: string): boolean {
  if (!prefix) return true;
  return path.toLowerCase().startsWith(prefix.toLowerCase());
}

/** 
 * アーカイブ内のエントリ一覧から、指定した階層（または再帰的）なリストを取得する 
 */
export function listArchiveEntries(
  archivePath: string,
  index: any[], // アーカイブインデックス（getArchiveIndexの戻り値）
  prefix: string,
  recursive: boolean
): DirectoryEntry[] {
  const prefixNorm = prefix.replace(/\\/g, '/').replace(/^\/+/, '');
  const prefixBase = prefixNorm.replace(/\/$/, '');
  const prefixForMatch = prefixNorm ? (prefixNorm.endsWith('/') ? prefixNorm : prefixNorm + '/') : '';

  if (recursive) {
    const result: DirectoryEntry[] = [];
    for (const e of index) {
      if (e.isDirectory) continue;
      const p = e.path.replace(/\\/g, '/').replace(/^\/+/, '');
      if (prefixForMatch && !pathStartsWith(p, prefixForMatch)) continue;
      
      const rest = p.slice(prefixForMatch.length).replace(/^\/+/, '');
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
    result.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return result;
  }

  const seen = new Map<string, { isDir: boolean; size?: number; mtime?: number }>();
  for (const e of index) {
    const p = e.path.replace(/\\/g, '/').replace(/^\/+/, '');
    if (prefixForMatch && !pathStartsWith(p, prefixForMatch)) continue;

    const rest = p.slice(prefixForMatch.length).replace(/^\/+/, '');
    if (!rest) continue;

    const parts = rest.split('/').filter(Boolean);
    if (parts.length === 0) continue;

    const firstName = parts[0];
    if (isJunkPath(firstName)) continue;
    const isDir = e.isDirectory || parts.length > 1;

    if (!seen.has(firstName)) {
      seen.set(firstName, {
        isDir,
        size: isDir ? undefined : e.size,
        mtime: e.mtime,
      });
    } else {
      const prev = seen.get(firstName)!;
      if (isDir) {
        prev.isDir = true;
        prev.size = undefined;
      }
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
    return listArchiveEntries(archivePath, index, soleDir + '/', false);
  }

  result.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  return result;
}

/** 
 * アーカイブ内の特定エントリの情報を取得する 
 */
export function statArchiveEntry(index: any[], innerPath: string): FileStats | null {
  const innerLower = innerPath.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
  
  // 完全一致を探す
  const entry = index.find(e => {
    const p = e.path.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
    return p === innerLower;
  });

  if (!entry) return null;

  return {
    size: entry.size,
    isDirectory: entry.isDirectory,
    mtime: entry.mtime,
  };
}
