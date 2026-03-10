import { app, BrowserWindow, ipcMain, dialog, shell, clipboard, protocol, Menu, nativeTheme } from 'electron';
import { getFileIcon, type IconSize } from './fileIcon';
import { registerMediaProtocol } from './mediaProtocol';
import { registerReederrProtocol } from './reederrProtocol';
import { getMediaUrl, getMediaPathMap, disposeAllTemp, disposeMediaIdFromUrl } from './mediaUrlManager';
import { createHttpMediaServer } from './httpMediaServer';
import { existsSync, mkdirSync, renameSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile as readFileAsync, writeFile as writeFileAsync } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform } from 'node:os';
import { listDirectory, readFile, stat } from './vfs';
import { is7zAvailable } from './sevenZipPath';
import { cleanupTempExtract } from './vfs/rarFS';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: { secure: true, bypassCSP: true, stream: true },
  },
  {
    scheme: 'reederr',
    privileges: { secure: true, bypassCSP: true, stream: true, standard: true, supportFetchAPI: true },
  },
]);

let mainWindow: BrowserWindow | null = null;
let httpMediaServer: { getMediaUrl: (id: string) => string; close: () => void } | null = null;

function createWindow() {
  const savedSettings = loadSettings();
  const windowState = (savedSettings.windowState as any) || {
    width: 1200,
    height: 800,
  };

  nativeTheme.themeSource = 'light';

  mainWindow = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    backgroundColor: '#f3f3f3',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  const saveWindowState = async () => {
    if (!mainWindow) return;
    const isMaximized = mainWindow.isMaximized();
    const bounds = isMaximized ? windowState : mainWindow.getBounds();
    const newState = {
      ...bounds,
      isMaximized,
    };
    try {
      const path = join(app.getPath('userData'), SETTINGS_FILE);
      let current = {};
      try {
        const buf = await readFileAsync(path, 'utf-8');
        current = JSON.parse(buf);
      } catch {
        // file might not exist or invalid json
      }
      await writeFileAsync(path, JSON.stringify({ ...current, windowState: newState }, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save window state', err);
    }
  };

  let resizeTimeout: NodeJS.Timeout;
  const debouncedSave = () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(saveWindowState, 500);
  };

  mainWindow.on('resize', debouncedSave);
  mainWindow.on('move', debouncedSave);
  mainWindow.on('maximize', saveWindowState);
  mainWindow.on('unmaximize', saveWindowState);

  if (process.env.VITE_DEV_SERVER_URL) {
    const devUrl = 'http://127.0.0.1:5173/';
    const maxRetries = 10;
    let retryCount = 0;

    const tryLoad = () => {
      mainWindow?.loadURL(devUrl);
    };

    mainWindow.webContents.on('did-fail-load', (_e, errorCode, _descr, _url, isMainFrame) => {
      if (isMainFrame && errorCode === -106 && mainWindow && !mainWindow.isDestroyed() && retryCount < maxRetries) {
        retryCount += 1;
        setTimeout(tryLoad, 400 * retryCount);
      }
    });

    setTimeout(tryLoad, 800);
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('enter-full-screen', () => {
    mainWindow?.webContents.send('preview-fullscreen-changed', true);
  });

  mainWindow.on('leave-full-screen', () => {
    mainWindow?.webContents.send('preview-fullscreen-changed', false);
  });
}

function buildMenu() {
  const send = (ch: string, ...args: unknown[]) => {
    mainWindow?.webContents.send(ch, ...args);
  };

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'ファイル(&F)',
      submenu: [
        {
          label: 'ファイルを開く(&O)...',
          accelerator: 'Ctrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow!, {
              title: 'ファイルを開く',
              properties: ['openFile'],
              filters: [
                { name: '画像/動画/音声/アーカイブ', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'mp4', 'webm', 'avi', 'mkv', 'mov', 'wmv', 'm4v', 'mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'zip', 'cbz', 'rar', 'cbr'] },
                { name: 'すべてのファイル', extensions: ['*'] },
              ],
            });
            if (!result.canceled && result.filePaths.length > 0) {
              send('menu-open-file', result.filePaths[0]);
            }
          },
        },
        {
          label: 'フォルダを開く(&D)...',
          accelerator: 'Ctrl+Shift+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow!, {
              title: 'フォルダを開く',
              properties: ['openDirectory'],
            });
            if (!result.canceled && result.filePaths.length > 0) {
              send('menu-open-folder', result.filePaths[0]);
            }
          },
        },
        { type: 'separator' },
        {
          label: 'アプリケーションを終了(&X)',
          accelerator: 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: '編集(&E)',
      submenu: [
        {
          label: 'パスをコピー(&C)',
          accelerator: 'Ctrl+C',
          click: () => send('menu-copy-path'),
        },
      ],
    },
    {
      label: '移動(&M)',
      submenu: [
        { label: '戻る(&B)', accelerator: 'Alt+Left', click: () => send('menu-nav', 'back') },
        { label: '進む(&F)', accelerator: 'Alt+Right', click: () => send('menu-nav', 'forward') },
        { label: '上へ(&U)', accelerator: 'Alt+Up', click: () => send('menu-nav', 'up') },
        { type: 'separator' },
        { label: '先頭(&H)', accelerator: 'Home', click: () => send('menu-nav', 'first') },
        { label: '前のファイル(&P)', accelerator: 'Left', click: () => send('menu-nav', 'prev') },
        { label: '次のファイル(&N)', accelerator: 'Right', click: () => send('menu-nav', 'next') },
        { label: '末尾(&E)', accelerator: 'End', click: () => send('menu-nav', 'last') },
      ],
    },
    {
      label: 'イメージ(&I)',
      submenu: [
        { label: '拡大(&I)', accelerator: 'Ctrl+=', click: () => send('menu-zoom', 'in') },
        { label: '縮小(&O)', accelerator: 'Ctrl+-', click: () => send('menu-zoom', 'out') },
        { label: '等倍表示(&A)', accelerator: 'Ctrl+0', click: () => send('menu-zoom', 'reset') },
        { label: 'ウィンドウに合わせる(&F)', accelerator: 'Ctrl+Shift+0', click: () => send('menu-zoom', 'fit') },
      ],
    },
    {
      label: '表示(&V)',
      submenu: [
        { label: '1ページ表示(&1)', accelerator: '1', click: () => send('menu-view-mode', 'single') },
        { label: '見開き表示(&2)', accelerator: '2', click: () => send('menu-view-mode', 'spread') },
        { label: '自動表示(&3)', accelerator: '3', click: () => send('menu-view-mode', 'auto') },
        { type: 'separator' },
        { label: '全画面(&F)', accelerator: 'F11', click: () => send('menu-fullscreen') },
        { type: 'separator' },
        { label: '右綴じ(&R)', click: () => send('menu-binding', 'rtl') },
        { label: '左綴じ(&L)', click: () => send('menu-binding', 'ltr') },
      ],
    },
    {
      label: 'オプション(&O)',
      submenu: [
        { label: '設定(&S)...', accelerator: 'Ctrl+,', click: () => send('menu-settings') },
      ],
    },
    {
      label: 'ヘルプ(&H)',
      submenu: [
        {
          label: 'バージョン情報(&A)...',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'reederr について',
              message: 'reederr',
              detail: 'Electron製の画像・動画・音声ビューア\nBuilt with Electron + React + Vite',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  cleanupTempExtract();
  registerMediaProtocol(getMediaPathMap());
  registerReederrProtocol();
  httpMediaServer = await createHttpMediaServer(getMediaPathMap());
  createWindow();
  buildMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  disposeAllTemp();
  cleanupTempExtract();
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('is-7z-available', (): boolean => is7zAvailable());

ipcMain.handle(
  'get-media-url',
  async (_e, { vpath, preferHttp }: { vpath: string; preferHttp?: boolean }): Promise<string> => {
    if (!vpath) throw new Error('File not found');
    const archivePart = vpath.includes('!') ? vpath.split('!')[0] : vpath;
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
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: 'フォルダを選択',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return { path: result.filePaths[0] };
});

ipcMain.handle(
  'list-directory',
  async (
    _e,
    { path, recursive }: { path: string; recursive?: boolean }
  ): Promise<{ success: true; files: import('./vfs/types').DirectoryEntry[] } | { success: false; error: string; files: [] }> => {
    try {
      const files = await listDirectory(path, { recursive });
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
  async (_e, { path }: { path: string }): Promise<import('./vfs/types').FileStats | null> => {
    return stat(path);
  }
);

ipcMain.handle('get-path-userData', (): string => {
  return app.getPath('userData');
});

const SETTINGS_FILE = 'settings.json';
const CONFIG_FILE = 'config.json';

function loadSettings(): Record<string, unknown> {
  try {
    const path = join(app.getPath('userData'), SETTINGS_FILE);
    if (existsSync(path)) {
      const buf = readFileSync(path, 'utf-8');
      return JSON.parse(buf) as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return {};
}

ipcMain.handle('get-user-settings', (): Record<string, unknown> => {
  return loadSettings();
});

ipcMain.handle(
  'set-user-settings',
  (_e, { data }: { data: Record<string, unknown> }): void => {
    try {
      const path = join(app.getPath('userData'), SETTINGS_FILE);
      const current = loadSettings();
      const merged = { ...current, ...data };
      console.log('[Main] Saving settings (legacy):', Object.keys(data));
      writeFileSync(path, JSON.stringify(merged, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Main] Failed to save settings (legacy):', err);
    }
  }
);

// New Robust Persistence Handlers
function loadConfig(internal = true): Record<string, unknown> {
  try {
    const path = join(app.getPath('userData'), CONFIG_FILE);
    if (existsSync(path)) {
      const buf = readFileSync(path, 'utf-8');
      const data = JSON.parse(buf) as Record<string, unknown>;
      console.log(`[Persistence] ${internal ? 'Internal' : 'External'} Load:`, Object.keys(data));
      return data;
    }
  } catch (err) {
    console.warn('[Persistence] Failed to load config:', err);
  }
  return {};
}

ipcMain.handle('load-store', (): Record<string, unknown> => {
  return loadConfig(false);
});

ipcMain.handle(
  'save-store',
  (_e, { data }: { data: Record<string, unknown> }): void => {
    try {
      if (!data || Object.keys(data).length === 0) return;

      const path = join(app.getPath('userData'), CONFIG_FILE);
      const current = loadConfig(true);
      const merged = { ...current, ...data };
      console.log('[Persistence] Save to File:', Object.keys(data));
      writeFileSync(path, JSON.stringify(merged, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Persistence] Failed to save config:', err);
    }
  }
);

ipcMain.handle(
  'get-file-icon',
  async (_e, { absPath, size }: { absPath: string; size: IconSize }): Promise<string> => {
    return getFileIcon(absPath, size ?? 16);
  }
);

function getDrives(): Array<{ name: string; path: string }> {
  const drives: Array<{ name: string; path: string }> = [];
  if (platform() !== 'win32') return drives;
  for (let i = 65; i <= 90; i++) {
    const letter = String.fromCharCode(i) + ':';
    const path = letter + '\\';
    if (existsSync(path)) {
      const name = letter === 'C:' ? `Windows (${letter})` : `ボリューム (${letter})`;
      drives.push({ name, path });
    }
  }
  return drives;
}

ipcMain.handle(
  'get-special-folders',
  (): Array<{ name: string; path: string }> => {
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
        const p = app.getPath(key as 'desktop' | 'home' | 'downloads' | 'documents' | 'pictures' | 'music' | 'videos');
        if (p) folders.push({ name, path: p });
      } catch (e) {
        console.warn(`get-special-folders: ${key}`, e);
      }
    }
    return folders;
  }
);

ipcMain.handle('get-drives', (): Array<{ name: string; path: string }> => getDrives());

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
    const { dirname } = await import('node:path');
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
