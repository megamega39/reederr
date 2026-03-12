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

export function getFileType(entry: DirectoryEntry | null | undefined, t: (key: string, data?: any) => string): string {
  if (!entry) return t('fileType.file');
  if (entry.isDirectory) return t('fileType.folder');
  if (entry.isArchive) {
    const dotIdx = (entry.name ?? '').lastIndexOf('.');
    const ext = (dotIdx >= 0 ? entry.name.slice(dotIdx + 1) : '').toUpperCase();
    return ext ? t('fileType.extArchive', { ext }) : t('fileType.archive');
  }
  const dotIdx = (entry.name ?? '').lastIndexOf('.');
  const ext = (dotIdx >= 0 ? '.' + (entry.name ?? '').slice(dotIdx + 1) : '').toLowerCase();
  const typeMap: Record<string, string> = {
    '.jpg': t('fileType.image'),
    '.jpeg': t('fileType.image'),
    '.png': t('fileType.image'),
    '.gif': t('fileType.image'),
    '.webp': t('fileType.image'),
    '.bmp': t('fileType.image'),
    '.mp4': t('fileType.video'),
    '.webm': t('fileType.video'),
    '.avi': t('fileType.video'),
    '.mkv': t('fileType.video'),
    '.mov': t('fileType.video'),
    '.wmv': t('fileType.video'),
    '.m4a': t('fileType.audio'),
    '.m4v': t('fileType.video'),
    '.mp3': t('fileType.extAudio', { ext: 'MP3' }),
    '.wav': t('fileType.extAudio', { ext: 'WAV' }),
    '.ogg': t('fileType.extAudio', { ext: 'OGG' }),
    '.flac': t('fileType.extAudio', { ext: 'FLAC' }),
    '.aac': t('fileType.extAudio', { ext: 'AAC' }),
  };
  return typeMap[ext] ?? (ext ? t('fileType.extFile', { ext: ext.slice(1).toUpperCase() }) : t('fileType.file'));
}

export function getParentPath(p: string): string | null {
  const m = p.match(/^(.+)[/\\][^/\\]*$/);
  return m ? m[1] : null;
}
