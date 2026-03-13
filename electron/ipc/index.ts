import { ipcMain, app, BrowserWindow, dialog, shell, clipboard } from 'electron';
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { platform } from 'node:os';
import { toLongPathIfNeeded } from '../utils/longPath';
import { processManager } from '../utils/processRunner';
import { is7zAvailable } from '../sevenZipPath';
import { getFileIcon, type IconSize } from '../fileIcon';
import { splitArchivePath } from '../vfs/utils';
import { listDirectory, readFile, stat, prefetchArchiveIndex } from '../vfs';
import { getMediaUrl, disposeMediaIdFromUrl } from '../mediaUrlManager';
import { getDb } from '../db';
import { getDrives, getSpecialFolders, getNetworkResources } from '../drives';
import { buildMenu } from '../menu';
import { FileWatcher } from '../vfs/watcher';
import type { ThumbnailGenerator } from '../thumbnails/generator';

let fileWatcher: FileWatcher | null = null;

export function registerIpcHandlers(
  getMainWindow: () => BrowserWindow | null, 
  httpMediaServer: any,
  thumbnailGenerator: ThumbnailGenerator
) {
  ipcMain.handle('is-7z-available', async (): Promise<{ ok: true; value: boolean } | { ok: false; error: string }> => {
    try {
      return { ok: true, value: is7zAvailable() };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(
    'get-media-urls',
    async (_e, { vpaths, preferHttp }: { vpaths: string[]; preferHttp?: boolean }): Promise<{ ok: true; value: string[] } | { ok: false; error: string }> => {
      try {
        if (!Array.isArray(vpaths)) return { ok: false, error: 'Invalid paths format' };
        const { getMediaUrls } = await import('../mediaUrlManager');
        const idsOrUrls = await getMediaUrls(vpaths, { rawId: preferHttp });
        let res = idsOrUrls;
        if (preferHttp && httpMediaServer) {
          res = idsOrUrls.map(id => httpMediaServer.getMediaUrl(id));
        }
        return { ok: true, value: res };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle(
    'get-media-url',
    async (_e, { vpath, preferHttp }: { vpath: string; preferHttp?: boolean }): Promise<{ ok: true; value: string } | { ok: false; error: string }> => {
      try {
        if (typeof vpath !== 'string' || !vpath) return { ok: false, error: 'Invalid path format or path missing' };
        const split = splitArchivePath(vpath);
        const archivePart = split ? split[0] : vpath;
        if (!existsSync(toLongPathIfNeeded(archivePart))) return { ok: false, error: 'File not found' };
        const idOrUrl = await getMediaUrl(vpath, { rawId: preferHttp });
        let res = idOrUrl;
        if (preferHttp && httpMediaServer) {
          res = httpMediaServer.getMediaUrl(idOrUrl);
        }
        return { ok: true, value: res };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle('release-media-url', (_e, { url }: { url: string }): { ok: true; value: void } | { ok: false; error: string } => {
    try {
      if (typeof url !== 'string') return { ok: true, value: undefined };
      if (url.startsWith('http://127.0.0.1') && url.includes('?id=')) {
        const id = new URL(url).searchParams.get('id');
        if (id) disposeMediaIdFromUrl(`media://${id}`);
      } else {
        disposeMediaIdFromUrl(url);
      }
      return { ok: true, value: undefined };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('set-preview-fullscreen', (_e, { fullscreen }: { fullscreen: boolean }): { ok: true; value: void } | { ok: false; error: string } => {
    try {
      const win = BrowserWindow.fromWebContents(_e.sender);
      if (win && !win.isDestroyed()) {
        win.setFullScreen(fullscreen);
        win.setMenuBarVisibility(!fullscreen);
      }
      return { ok: true, value: undefined };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  ipcMain.handle('select-folder', async (): Promise<{ ok: true; value: { path: string } | null } | { ok: false; error: string }> => {
    try {
      const win = getMainWindow();
      if (!win) return { ok: false, error: 'Window not found' };
      const result = await dialog.showOpenDialog(win, {
        properties: ['openDirectory'],
        title: 'フォルダを選択',
      });
      if (result.canceled || result.filePaths.length === 0) return { ok: true, value: null };
      return { ok: true, value: { path: result.filePaths[0] } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('select-file', async (): Promise<{ ok: true; value: { path: string } | null } | { ok: false; error: string }> => {
    try {
      const win = getMainWindow();
      if (!win) return { ok: false, error: 'Window not found' };
      const result = await dialog.showOpenDialog(win, {
        properties: ['openFile'],
        title: 'ファイルを選択',
      });
      if (result.canceled || result.filePaths.length === 0) return { ok: true, value: null };
      return { ok: true, value: { path: result.filePaths[0] } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(
    'list-directory',
    async (
      _e,
      { path, recursive, skipStats }: { path: string; recursive?: boolean; skipStats?: boolean }
    ) => {
      try {
        if (typeof path !== 'string') {
          return { ok: false, error: 'Invalid path type: expected string' };
        }
        const files = await listDirectory(path, { skipStats });
        
        // Background prefetch for archives in the current directory
        if (Array.isArray(files) && !recursive) {
          const archives = files.filter(f => f.isArchive && !f.isDirectory);
          // Limit prefetch to first 5 archives to avoid heavy load
          archives.slice(0, 5).forEach(archive => {
            prefetchArchiveIndex(archive.path).catch(() => {});
          });
        }

        return { ok: true, value: Array.isArray(files) ? files : [] };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[list-directory] Error:', msg);
        return { ok: false, error: msg };
      }
    }
  );

  ipcMain.handle(
    'read-file',
    async (_e, { path }: { path: string }): Promise<{ ok: true; value: ArrayBuffer } | { ok: false; error: string }> => {
      try {
        if (typeof path !== 'string') return { ok: false, error: 'Invalid path format' };
        const buf = await readFile(path);
        return { ok: true, value: buf };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle(
    'stat',
    async (_e, { path }: { path: string }): Promise<{ ok: true; value: any } | { ok: false; error: string }> => {
      try {
        if (typeof path !== 'string') return { ok: true, value: null };
        const res = await stat(path);
        return { ok: true, value: res };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle('get-path-userData', async (): Promise<{ ok: true; value: string } | { ok: false; error: string }> => {
    try {
      return { ok: true, value: app.getPath('userData') };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('get-user-settings', async (): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false; error: string }> => {
    try {
      const db = getDb();
      // Exclude system keys like migration_status if needed, but for now just return all for consistency
      const rows = db.prepare("SELECT key, value FROM kv_store WHERE key NOT IN ('migration_status')").all();
      const settings: Record<string, unknown> = {};
      for (const row of rows as any[]) {
        try {
          settings[row.key] = JSON.parse(row.value);
        } catch {
          settings[row.key] = row.value;
        }
      }
      return { ok: true, value: settings };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(
    'set-user-settings',
    (_e, { data }: { data: Record<string, unknown> }): { ok: true; value: void } | { ok: false; error: string } => {
      try {
        const db = getDb();
        const upsert = db.prepare('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)');
        const transaction = db.transaction((items: Record<string, unknown>) => {
          for (const [key, value] of Object.entries(items)) {
            upsert.run(key, JSON.stringify(value));
          }
        });
        transaction(data);
        return { ok: true, value: undefined };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle('load-store', async (): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false; error: string }> => {
    try {
      const db = getDb();
      const rows = db.prepare("SELECT key, value FROM kv_store").all();
      const data: Record<string, unknown> = {};
      for (const row of rows as any[]) {
        try {
          data[row.key] = JSON.parse(row.value);
        } catch {
          data[row.key] = row.value;
        }
      }
      return { ok: true, value: data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(
    'save-store',
    (_e, { data }: { data: Record<string, unknown> }): { ok: true; value: void } | { ok: false; error: string } => {
      try {
        const db = getDb();
        const upsert = db.prepare('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)');
        const transaction = db.transaction((items: Record<string, unknown>) => {
          for (const [key, value] of Object.entries(items)) {
            upsert.run(key, JSON.stringify(value));
          }
        });
        transaction(data);
        return { ok: true, value: undefined };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle(
    'get-file-icon',
    async (_e, { absPath, size }: { absPath: string; size: IconSize }): Promise<{ ok: true; value: string } | { ok: false; error: string }> => {
      try {
        const icon = await getFileIcon(absPath, size ?? 16);
        return { ok: true, value: icon };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle('get-special-folders', async (): Promise<{ ok: true; value: any[] } | { ok: false; error: string }> => {
    try {
      const res = await getSpecialFolders();
      return { ok: true, value: res };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  ipcMain.handle('get-drives', async (): Promise<{ ok: true; value: any[] } | { ok: false; error: string }> => {
    try {
      const res = await getDrives();
      return { ok: true, value: res };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
  ipcMain.handle('get-network-resources', async (): Promise<{ ok: true; value: any[] } | { ok: false; error: string }> => {
    try {
      const res = await getNetworkResources();
      return { ok: true, value: res };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('open-in-explorer', async (_e, { path: folderPath }: { path: string }): Promise<{ ok: true; value: void } | { ok: false; error: string }> => {
    try {
      if (folderPath && existsSync(toLongPathIfNeeded(folderPath))) {
        await shell.openPath(folderPath);
      }
      return { ok: true, value: undefined };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('copy-path', (_e, { path: text }: { path: string }): { ok: true; value: void } | { ok: false; error: string } => {
    try {
      clipboard.writeText(text);
      return { ok: true, value: undefined };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('copy-parent-path', (_e, { path: folderPath }: { path: string }): { ok: true; value: void } | { ok: false; error: string } => {
    try {
      clipboard.writeText(dirname(folderPath));
      return { ok: true, value: undefined };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('show-in-explorer', async (_e, { path: folderPath }: { path: string }): Promise<{ ok: true; value: void } | { ok: false; error: string }> => {
    try {
      if (!folderPath || !existsSync(toLongPathIfNeeded(folderPath))) return { ok: true, value: undefined };
      if (platform() === 'win32') {
        return new Promise((resolve) => {
          processManager.exec(`explorer.exe /select,"${folderPath.replace(/"/g, '""')}"`, {}, (err) => {
            if (err) resolve({ ok: false, error: err.message });
            else resolve({ ok: true, value: undefined });
          });
        });
      } else {
        await shell.openPath(folderPath);
        return { ok: true, value: undefined };
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(
    'create-folder',
    async (_e, { parentPath, name }: { parentPath: string; name: string }): Promise<{ ok: true; value: void } | { ok: false; error: string }> => {
      try {
        const newPath = join(parentPath, name);
        if (existsSync(toLongPathIfNeeded(newPath))) return { ok: false, error: '同じ名前のフォルダが既に存在します' };
        mkdirSync(newPath, { recursive: true });
        return { ok: true, value: undefined };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
  );

  ipcMain.handle('rename-folder', async (_e, { path: oldPath, newName }: { path: string; newName: string }): Promise<{ ok: true; value: void } | { ok: false; error: string }> => {
    try {
      const newPath = join(dirname(oldPath), newName);
      if (existsSync(toLongPathIfNeeded(newPath))) return { ok: false, error: '同じ名前が既に存在します' };
      renameSync(oldPath, newPath);
      return { ok: true, value: undefined };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('delete-folder', async (_e, { path: folderPath }: { path: string }): Promise<{ ok: true; value: void } | { ok: false; error: string }> => {
    try {
      await shell.trashItem(folderPath);
      return { ok: true, value: undefined };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('rename-file', async (_e, { path: oldPath, newName }: { path: string; newName: string }): Promise<{ ok: true; value: void } | { ok: false; error: string }> => {
    try {
      const newPath = join(dirname(oldPath), newName);
      if (existsSync(toLongPathIfNeeded(newPath))) return { ok: false, error: '同じ名前が既に存在します' };
      renameSync(oldPath, newPath);
      return { ok: true, value: undefined };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle('delete-file', async (_e, { path: filePath }: { path: string }): Promise<{ ok: true; value: void } | { ok: false; error: string }> => {
    try {
      await shell.trashItem(filePath);
      return { ok: true, value: undefined };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });

  ipcMain.handle(
    'open-with-app',
    async (_e, { path, appPath }: { path: string; appPath: string }): Promise<{ ok: true; value: void } | { ok: false; error: string }> => {
      try {
        const child = processManager.spawn(appPath, [path], {
          detached: true,
          stdio: 'ignore',
          shell: true,
        });
        child.unref();
        return { ok: true, value: undefined };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
  );

  ipcMain.handle('rebuild-menu', (_e, { lang }: { lang: 'ja' | 'en' }): { ok: true; value: void } | { ok: false; error: string } => {
    try {
      const win = getMainWindow();
      if (win) {
        buildMenu(win, lang);
      }
      return { ok: true, value: undefined };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('watch-directory', (_e, { path }: { path: string }): { ok: true; value: void } | { ok: false; error: string } => {
    try {
      if (!fileWatcher) {
        fileWatcher = new FileWatcher((changedPath) => {
          const win = getMainWindow();
          if (win && !win.isDestroyed()) {
            win.webContents.send('file-system-changed', { path: changedPath });
          }
        });
      }
      fileWatcher.watch(path);
      return { ok: true, value: undefined };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('get-thumbnail', async (_e, { path, width, height }: { path: string; width: number; height: number }): Promise<{ ok: true; value: string | null } | { ok: false; error: string }> => {
    try {
      const resultPath = await thumbnailGenerator.getThumbnail(path, { width, height });
      if (resultPath) {
        // Use a dummy host 'cache' to prevent Chromium's URL normalization 
        // from losing the Windows drive colon (e.g. C: -> c).
        return { ok: true, value: `thumb://cache/${resultPath.replace(/\\/g, '/')}` };
      }
      return { ok: true, value: null };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
