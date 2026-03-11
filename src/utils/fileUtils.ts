import { DirectoryEntry } from '../types';

export function formatSize(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return '-';
  if (bytes < 1024) return `${bytes.toLocaleString()} B`;
  if (bytes < 1024 * 1024) {
    const kb = Math.round(bytes / 1024);
    return `${kb.toLocaleString()} KB`;
  }
  const mb = (bytes / (1024 * 1024)).toFixed(2);
  return `${mb} MB`;
}

export function formatMtime(ms?: number): string {
  if (ms == null) return '-';
  const d = new Date(ms);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${mo}/${day} ${h}:${mi}`;
}

export function getFileType(entry: DirectoryEntry | null | undefined): string {
  if (!entry) return 'ファイル';
  if (entry.isDirectory) return 'フォルダ';
  if (entry.isArchive) {
    const dotIdx = (entry.name ?? '').lastIndexOf('.');
    const ext = (dotIdx >= 0 ? entry.name.slice(dotIdx + 1) : '').toUpperCase();
    return ext ? `${ext} アーカイブ` : 'アーカイブ';
  }
  const dotIdx = (entry.name ?? '').lastIndexOf('.');
  const ext = (dotIdx >= 0 ? '.' + (entry.name ?? '').slice(dotIdx + 1) : '').toLowerCase();
  const typeMap: Record<string, string> = {
    '.jpg': 'JPG ファイル',
    '.jpeg': 'JPEG ファイル',
    '.png': 'PNG ファイル',
    '.gif': 'GIF ファイル',
    '.webp': 'WebP ファイル',
    '.bmp': 'BMP ファイル',
    '.mp4': 'MP4 ファイル',
    '.webm': 'WebM ファイル',
    '.avi': 'AVI ファイル',
    '.mkv': 'MKV ファイル',
    '.mov': 'MOV ファイル',
    '.wmv': 'WMV ファイル',
    '.m4a': 'M4A ファイル',
    '.m4v': 'M4V ファイル',
    '.mp3': 'MP3 オーディオ',
    '.wav': 'WAV オーディオ',
    '.ogg': 'OGG オーディオ',
    '.flac': 'FLAC オーディオ',
    '.aac': 'AAC オーディオ',
  };
  return typeMap[ext] ?? (ext ? `${ext.slice(1).toUpperCase()} ファイル` : 'ファイル');
}

export function getParentPath(p: string): string | null {
  const m = p.match(/^(.+)[/\\][^/\\]*$/);
  return m ? m[1] : null;
}
