import { app } from 'electron';
import { platform } from 'node:os';
import { existsSync } from 'node:fs';

const NETWORK_TIMEOUT_MS = 10_000;

export async function getDrives(): Promise<Array<{ name: string; path: string }>> {
  const drives: Array<{ name: string; path: string }> = [];
  if (platform() !== 'win32') return drives;

  return new Promise((resolve) => {
    const { exec } = require('node:child_process');
    // Using wmic to get logical disks is more robust than just checking existsSync(A-Z)
    exec('wmic logicaldisk get deviceid,volumename', (error: any, stdout: string) => {
      if (error) {
        // Fallback to simple A-Z check if wmic fails
        for (let i = 65; i <= 90; i++) {
          const letter = String.fromCharCode(i) + ':';
          const path = letter + '\\';
          if (existsSync(path)) {
            drives.push({ name: letter === 'C:' ? `Windows (${letter})` : `ボリューム (${letter})`, path });
          }
        }
        resolve(drives);
        return;
      }

      const lines = stdout.split(/\r?\n/).filter(line => line.trim() && !line.toLowerCase().includes('deviceid'));
      for (const line of lines) {
        const parts = line.trim().split(/\s{2,}/);
        const deviceId = parts[0];
        const volumeName = parts[1] || (deviceId === 'C:' ? 'Windows' : 'ボリューム');
        const path = deviceId + '\\';
        drives.push({ name: `${volumeName} (${deviceId})`, path });
      }
      resolve(drives);
    });
  });
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
    const { exec } = require('node:child_process');
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
