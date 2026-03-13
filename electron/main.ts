import { app, BrowserWindow, protocol } from 'electron';
import { registerMediaProtocol } from './mediaProtocol';
import { registerReederrProtocol } from './reederrProtocol';
import { registerThumbnailProtocol } from './thumbnails/protocol';
import { ThumbnailGenerator } from './thumbnails/generator';
import { disposeAllTemp, getMediaPathMap } from './mediaUrlManager';
import { initArchiveCache } from './vfs/archiveIndexCache';
import { cleanupTempExtract } from './vfs/rarFS';
import { createHttpMediaServer } from './httpMediaServer';
import { createWindow, getMainWindow } from './window';
import { buildMenu } from './menu';
import { registerIpcHandlers } from './ipc';
import { logger } from './utils/logger';

// Log unhandled errors
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: { secure: true, bypassCSP: true, stream: true },
  },
  {
    scheme: 'reederr',
    privileges: { secure: true, bypassCSP: true, stream: true, standard: true, supportFetchAPI: true },
  },
  {
    scheme: 'thumb',
    privileges: { secure: true, bypassCSP: true, stream: true, standard: true },
  },
]);

let httpMediaServer: { getMediaUrl: (id: string) => string; close: () => void } | null = null;

app.whenReady().then(async () => {
  logger.info('Application starting...');
  const userDataPath = app.getPath('userData');

  // 1. Core protocols (Fast)
  registerMediaProtocol(getMediaPathMap());
  registerReederrProtocol();
  registerThumbnailProtocol();

  // 2. Start background services in parallel
  const tg = new ThumbnailGenerator(userDataPath);
  const bgPromise = Promise.all([
    (async () => {
      cleanupTempExtract();
      initArchiveCache(userDataPath);
    })(),
    tg.ensureCacheDir(),
    createHttpMediaServer(getMediaPathMap())
  ]);

  // 3. Create window IMMEDIATELY to show the UI as fast as possible
  const mainWindow = createWindow();
  buildMenu(mainWindow);

  // 4. Wait for background services and register IPC handlers
  // Note: We register handlers as soon as services are ready.
  // If the renderer calls an IPC too early, it will wait for these.
  const [_, __, hms] = await bgPromise;
  httpMediaServer = hms;
  registerIpcHandlers(() => getMainWindow(), hms, tg);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const win = createWindow();
      registerIpcHandlers(() => getMainWindow(), httpMediaServer, tg);
      buildMenu(win);
    }
  });
});

app.on('window-all-closed', () => {
  logger.info('All windows closed, quitting...');
  disposeAllTemp();
  cleanupTempExtract();
  if (process.platform !== 'darwin') app.quit();
});
