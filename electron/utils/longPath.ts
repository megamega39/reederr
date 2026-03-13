import { platform } from 'node:os';

const WINDOWS_MAX_PATH = 260;

/**
 * Ensures a path is compatible with Windows MAX_PATH (260 chars) by adding the \\?\ prefix.
 * This is only applicable to Windows and absolute paths.
 */
export function toLongPathIfNeeded(absPath: string): string {
  if (platform() !== 'win32') return absPath;
  if (absPath.length < WINDOWS_MAX_PATH) return absPath;
  if (absPath.startsWith('\\\\?\\')) return absPath;
  
  const normalized = absPath.replace(/\//g, '\\');
  if (normalized.startsWith('\\\\')) {
    // UNC path
    return '\\\\?\\UNC\\' + normalized.slice(2);
  }
  return '\\\\?\\' + normalized;
}
