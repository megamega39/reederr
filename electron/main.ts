import { app, BrowserWindow, protocol } from 'electron';
import { registerMediaProtocol } from './mediaProtocol';
import { registerReederrProtocol } from './reederrProtocol';
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
]);

let httpMediaServer: { getMediaUrl: (id: string) => string; close: () => void } | null = null;

app.whenReady().then(async () => {
  logger.info('Application starting...');
  cleanupTempExtract();
  initArchiveCache(app.getPath('userData'));
  registerMediaProtocol(getMediaPathMap());
  registerReederrProtocol();
  
  httpMediaServer = await createHttpMediaServer(getMediaPathMap());
  
  // Register handlers BEFORE creating the window so they are ready when renderer loads
  const windowGetter = () => getMainWindow();
  registerIpcHandlers(windowGetter, httpMediaServer);
  
  const mainWindow = createWindow();
  buildMenu(mainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const win = createWindow();
      registerIpcHandlers(windowGetter, httpMediaServer);
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
