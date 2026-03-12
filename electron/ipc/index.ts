import { ipcMain, app, BrowserWindow, dialog, shell, clipboard } from 'electron';
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { platform } from 'node:os';
import { is7zAvailable } from '../sevenZipPath';
import { getFileIcon, type IconSize } from '../fileIcon';
import { splitArchivePath } from '../vfs/utils';
import { listDirectory, readFile, stat, prefetchArchiveIndex } from '../vfs';
import { getMediaUrl, disposeMediaIdFromUrl } from '../mediaUrlManager';
import { loadSettings, saveSettings, loadConfig, saveConfig } from '../settings';
import { getDrives, getSpecialFolders } from '../drives';
import { buildMenu } from '../menu';
import { FileWatcher } from '../vfs/watcher';
import type { ThumbnailGenerator } from '../thumbnails/generator';

let fileWatcher: FileWatcher | null = null;

export function registerIpcHandlers(
  getMainWindow: () => BrowserWindow | null, 
  httpMediaServer: any,
  thumbnailGenerator: ThumbnailGenerator
) {
  ipcMain.handle('is-7z-available', (): boolean => is7zAvailable());

  ipcMain.handle(
    'get-media-url',
    async (_e, { vpath, preferHttp }: { vpath: string; preferHttp?: boolean }): Promise<string> => {
      if (!vpath) throw new Error('File not found');
      const split = splitArchivePath(vpath);
      const archivePart = split ? split[0] : vpath;
      if (!existsSync(archivePart)) throw new Error('File not found');
      const idOrUrl = await getMediaUrl(vpath, { rawId: preferHttp });
      if (preferHttp && httpMediaServer) {
        return httpMediaServer.getMediaUrl(idOrUrl);
      }
      return idOrUrl;
    }
  );

  ipcMain.handle('release-media-url', (_e, { url }: { url: string }): void => {
    if (url.startsWith('http://127.0.0.1') && url.includes('?id=')) {
      try {
        const id = new URL(url).searchParams.get('id');
        if (id) disposeMediaIdFromUrl(`media://${id}`);
      } catch {
        /* ignore */
      }
    } else {
      disposeMediaIdFromUrl(url);
    }
  });

  ipcMain.handle('set-preview-fullscreen', (_e, { fullscreen }: { fullscreen: boolean }): void => {
    const win = BrowserWindow.fromWebContents(_e.sender);
    if (win && !win.isDestroyed()) {
      win.setFullScreen(fullscreen);
      win.setMenuBarVisibility(!fullscreen);
    }
  });
  ipcMain.handle('select-folder', async (): Promise<{ path: string } | null> => {
    const win = getMainWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'フォルダを選択',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return { path: result.filePaths[0] };
  });

  ipcMain.handle('select-file', async (): Promise<{ path: string } | null> => {
    const win = getMainWindow();
    if (!win) return null;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      title: 'ファイルを選択',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return { path: result.filePaths[0] };
  });

  ipcMain.handle(
    'list-directory',
    async (
      _e,
      { path, recursive }: { path: string; recursive?: boolean }
    ) => {
      try {
        const files = await listDirectory(path, { recursive });
        
        // Background prefetch for archives in the current directory
        if (Array.isArray(files) && !recursive) {
          const archives = files.filter(f => f.isArchive && !f.isDirectory);
          // Limit prefetch to first 5 archives to avoid heavy load
          archives.slice(0, 5).forEach(archive => {
            prefetchArchiveIndex(archive.path).catch(() => {});
          });
        }

        return { success: true, files: Array.isArray(files) ? files : [] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[list-directory] Error:', msg);
        return { success: false, error: msg, files: [] };
      }
    }
  );

  ipcMain.handle(
    'read-file',
    async (_e, { path }: { path: string }): Promise<ArrayBuffer> => {
      return readFile(path);
    }
  );

  ipcMain.handle(
    'stat',
    async (_e, { path }: { path: string }) => {
      return stat(path);
    }
  );

  ipcMain.handle('get-path-userData', (): string => {
    return app.getPath('userData');
  });

  ipcMain.handle('get-user-settings', (): Record<string, unknown> => {
    return loadSettings();
  });

  ipcMain.handle(
    'set-user-settings',
    (_e, { data }: { data: Record<string, unknown> }): void => {
      saveSettings(data);
    }
  );

  ipcMain.handle('load-store', (): Record<string, unknown> => {
    return loadConfig(false);
  });

  ipcMain.handle(
    'save-store',
    (_e, { data }: { data: Record<string, unknown> }): void => {
      saveConfig(data);
    }
  );

  ipcMain.handle(
    'get-file-icon',
    async (_e, { absPath, size }: { absPath: string; size: IconSize }): Promise<string> => {
      return getFileIcon(absPath, size ?? 16);
    }
  );

  ipcMain.handle('get-special-folders', () => getSpecialFolders());
  ipcMain.handle('get-drives', () => getDrives());
  ipcMain.handle('get-network-resources', () => {
    const { getNetworkResources } = require('../drives');
    return getNetworkResources();
  });

  ipcMain.handle('open-in-explorer', async (_e, { path: folderPath }: { path: string }): Promise<void> => {
    if (folderPath && existsSync(folderPath)) {
      await shell.openPath(folderPath);
    }
  });

  ipcMain.handle('copy-path', (_e, { path: text }: { path: string }): void => {
    clipboard.writeText(text);
  });

  ipcMain.handle('copy-parent-path', (_e, { path: folderPath }: { path: string }): void => {
    clipboard.writeText(dirname(folderPath));
  });

  ipcMain.handle('show-in-explorer', async (_e, { path: folderPath }: { path: string }): Promise<void> => {
    if (!folderPath || !existsSync(folderPath)) return;
    if (platform() === 'win32') {
      const { exec } = await import('child_process');
      exec(`explorer.exe /select,"${folderPath.replace(/"/g, '""')}"`, () => { });
    } else {
      await shell.openPath(folderPath);
    }
  });

  ipcMain.handle(
    'create-folder',
    async (_e, { parentPath, name }: { parentPath: string; name: string }): Promise<{ ok: boolean; error?: string }> => {
      try {
        const newPath = join(parentPath, name);
        if (existsSync(newPath)) return { ok: false, error: '同じ名前のフォルダが既に存在します' };
        mkdirSync(newPath, { recursive: true });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
  );

  ipcMain.handle('rename-folder', async (_e, { path: oldPath, newName }: { path: string; newName: string }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const newPath = join(dirname(oldPath), newName);
      if (existsSync(newPath)) return { ok: false, error: '同じ名前が既に存在します' };
      renameSync(oldPath, newPath);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('delete-folder', async (_e, { path: folderPath }: { path: string }): Promise<{ ok: boolean; error?: string }> => {
    try {
      await shell.trashItem(folderPath);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('rename-file', async (_e, { path: oldPath, newName }: { path: string; newName: string }): Promise<{ ok: boolean; error?: string }> => {
    try {
      const newPath = join(dirname(oldPath), newName);
      if (existsSync(newPath)) return { ok: false, error: '同じ名前が既に存在します' };
      renameSync(oldPath, newPath);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('delete-file', async (_e, { path: filePath }: { path: string }): Promise<{ ok: boolean; error?: string }> => {
    try {
      await shell.trashItem(filePath);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle(
    'open-with-app',
    async (_e, { path, appPath }: { path: string; appPath: string }): Promise<{ ok: boolean; error?: string }> => {
      try {
        const { spawn } = await import('child_process');
        // On Windows, if the path contains spaces, it needs proper quoting.
        // spawn handles most of this but we use shell: true for better compatibility with some apps
        const child = spawn(appPath, [path], {
          detached: true,
          stdio: 'ignore',
          shell: true,
        });
        child.unref();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
  );

  ipcMain.handle('rebuild-menu', (_e, { lang }: { lang: 'ja' | 'en' }): void => {
    const win = getMainWindow();
    if (win) {
      buildMenu(win, lang);
    }
  });

  ipcMain.handle('watch-directory', (_e, { path }: { path: string }): void => {
    if (!fileWatcher) {
      fileWatcher = new FileWatcher((changedPath) => {
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
          win.webContents.send('file-system-changed', { path: changedPath });
        }
      });
    }
    fileWatcher.watch(path);
  });

  ipcMain.handle('get-thumbnail', async (_e, { path, width, height }: { path: string; width: number; height: number }): Promise<string | null> => {
    try {
      const resultPath = await thumbnailGenerator.getThumbnail(path, { width, height });
      if (resultPath) {
        // Use a dummy host 'cache' to prevent Chromium's URL normalization 
        // from losing the Windows drive colon (e.g. C: -> c).
        return `thumb://cache/${resultPath.replace(/\\/g, '/')}`;
      }
      return null;
    } catch (err) {
      return null;
    }
  });
}
