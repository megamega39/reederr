import { app, BrowserWindow, nativeTheme } from 'electron';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile as writeFileAsync, readFile as readFileAsync } from 'node:fs/promises';
import { getDb } from '../db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export let mainWindow: BrowserWindow | null = null;

export function createWindow() {
  const db = getDb();
  const row = db.prepare("SELECT value FROM kv_store WHERE key = 'windowState'").get();
  const windowState = row ? JSON.parse((row as any).value) : {
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
      preload: join(__dirname, './preload.cjs'),
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
      const db = getDb();
      db.prepare('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)').run('windowState', JSON.stringify(newState));
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

    setTimeout(tryLoad, 100);
  } else {
    mainWindow.loadFile(join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('enter-full-screen', () => {
    mainWindow?.webContents.send('preview-fullscreen-changed', true);
  });

  mainWindow.on('leave-full-screen', () => {
    mainWindow?.webContents.send('preview-fullscreen-changed', false);
  });

  return mainWindow;
}

export function getMainWindow() {
    return mainWindow;
}
