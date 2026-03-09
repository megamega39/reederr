import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listDirectory, readFile, stat } from './vfs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
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
  async (_e, { path }: { path: string }): Promise<import('./vfs/types').DirectoryEntry[]> => {
    return listDirectory(path);
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
