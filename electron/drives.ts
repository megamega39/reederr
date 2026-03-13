import { app } from 'electron';
import { platform } from 'node:os';
import { existsSync } from 'node:fs';
import { exec } from 'node:child_process';

const NETWORK_TIMEOUT_MS = 10_000;

export async function getDrives(): Promise<Array<{ name: string; path: string }>> {
  const drives: Array<{ name: string; path: string }> = [];
  if (platform() !== 'win32') return drives;

  return new Promise((resolve) => {
    
    const timeout = 5000;
    let resolved = false;

    // Use PowerShell for modern, robust drive detection
    const psCommand = `powershell -NoProfile -Command "[System.IO.DriveInfo]::GetDrives() | ForEach-Object { if ($_.DriveType -ne 'NoRootDirectory') { \\"$($_.Name)|$($_.VolumeLabel)\\" } }"`;

    const child = exec(psCommand, (error: any, stdout: string) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);

      if (error) {
        console.error('[Drives] PowerShell getDrives failed:', error);
        fallbackScan(drives, resolve);
        return;
      }

      const lines = stdout.split(/\r?\n/).filter(line => line.trim());
      if (lines.length === 0) {
        fallbackScan(drives, resolve);
        return;
      }

      for (const line of lines) {
        const parts = line.split('|');
        const path = parts[0].trim();
        const volumeLabel = parts[1] ? parts[1].trim() : '';
        const driveLetter = path.slice(0, 2); // e.g. "C:"
        
        const name = volumeLabel 
          ? `${volumeLabel} (${driveLetter})` 
          : (driveLetter === 'C:' ? `Windows (${driveLetter})` : `ボリューム (${driveLetter})`);
          
        drives.push({ name, path: path.endsWith('\\') ? path : path + '\\' });
      }
      resolve(drives);
    });

    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      child.kill();
      console.warn('[Drives] getDrives (PS) timed out, falling back to A-Z scan');
      fallbackScan(drives, resolve);
    }, timeout);
  });
}

function fallbackScan(drives: Array<{ name: string; path: string }>, resolve: (d: any) => void) {
  for (let i = 65; i <= 90; i++) {
    const letter = String.fromCharCode(i) + ':';
    const path = letter + '\\';
    try {
      if (existsSync(path)) {
        drives.push({ name: letter === 'C:' ? `Windows (${letter})` : `ボリューム (${letter})`, path });
      }
    } catch { /* ignore restricted drives */ }
  }
  resolve(drives);
}

export function getSpecialFolders(): Array<{ name: string; path: string }> {
  /* ... unchanged ... */
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

export async function getNetworkResources(): Promise<Array<{ name: string; path: string }>> {
  if (platform() !== 'win32') return [];
  
  return new Promise((resolve) => {
    const command = `powershell -NoProfile -Command "$s = New-Object -ComObject Shell.Application; $n = $s.NameSpace(18); if ($n) { $n.Items() | ForEach-Object { if ($_.Path.StartsWith('\\\\')) { \\"$($_.Name)|$($_.Path)\\" } } }"`;
    
    const child = exec(command, (error: any, stdout: string) => {
      clearTimeout(timer);
      if (error) {
        console.warn('getNetworkResources error:', error);
        resolve([]);
        return;
      }
      
      const resources = stdout.split(/\r?\n/)
        .filter(line => line.trim())
        .map(line => {
          const [name, path] = line.split('|');
          return { name: name || path, path };
        });
      
      resolve(resources);
    });

    const timer = setTimeout(() => {
      child.kill();
      console.warn('getNetworkResources: timeout reached');
      resolve([]);
    }, NETWORK_TIMEOUT_MS);
  });
}
