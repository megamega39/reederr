/**
 * VFS and Media shared constants
 */

export const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.jpe', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif']);
export const VIDEO_EXT = new Set(['.mp4', '.webm', '.avi', '.mkv', '.mov', '.wmv', '.m4v']);
export const AUDIO_EXT = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac']);

export const MEDIA_EXT = new Set([...IMAGE_EXT, ...VIDEO_EXT, ...AUDIO_EXT]);

export const ARCHIVE_EXTS = ['.zip', '.rar', '.cbz', '.cbr', '.7z', '.7zip', '.tar', '.gz', '.bz2', '.xz', '.iso', '.lzh', '.lha', '.lzma'];
export const ARCHIVE_OPENED_REGEX = /\.(zip|rar|cbz|cbr|7z|7zip|tar|gz|bz2|xz|iso|lzh|lha|lzma)!/i;

export const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.jpe': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.wmv': 'video/x-ms-wmv',
  '.m4v': 'video/x-m4v',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
};

// Cache and Temp Limits
export const MAX_TEMP_FILES = 200;
export const MAX_TEMP_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
export const SIZE_THRESHOLD_FOR_TEMP_EXTRACT = 200 * 1024 * 1024; // 200MB
