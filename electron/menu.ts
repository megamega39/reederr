import { Menu, dialog, app, BrowserWindow } from 'electron';
import { ja } from '../src/i18n/ja';
import { en } from '../src/i18n/en';

export function buildMenu(mainWindow: BrowserWindow, lang: 'ja' | 'en' = 'ja') {
  const t = lang === 'en' ? en : ja;
  const send = (ch: string, ...args: unknown[]) => {
    mainWindow?.webContents.send(ch, ...args);
  };

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: t.menu.file,
      submenu: [
        {
          label: t.menu.openFile,
          accelerator: 'Ctrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              title: t.menu.openFile.replace('(&O)...', ''),
              properties: ['openFile'],
              filters: [
                { name: 'Media/Archive', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'mp4', 'webm', 'avi', 'mkv', 'mov', 'wmv', 'm4v', 'mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'zip', 'cbz', 'rar', 'cbr'] },
                { name: 'All Files', extensions: ['*'] },
              ],
            });
            if (!result.canceled && result.filePaths.length > 0) {
              send('menu-open-file', result.filePaths[0]);
            }
          },
        },
        {
          label: t.menu.openFolder,
          accelerator: 'Ctrl+Shift+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              title: t.menu.openFolder.replace('(&D)...', ''),
              properties: ['openDirectory'],
            });
            if (!result.canceled && result.filePaths.length > 0) {
              send('menu-open-folder', result.filePaths[0]);
            }
          },
        },
        { type: 'separator' },
        {
          label: t.menu.exit,
          accelerator: 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: t.menu.edit,
      submenu: [
        {
          label: t.menu.copyPath,
          accelerator: 'Ctrl+C',
          click: () => send('menu-copy-path'),
        },
      ],
    },
    {
      label: t.menu.move,
      submenu: [
        { label: t.navigation.back, accelerator: 'Alt+Left', click: () => send('menu-nav', 'back') },
        { label: t.navigation.forward, accelerator: 'Alt+Right', click: () => send('menu-nav', 'forward') },
        { label: t.navigation.up, accelerator: 'Alt+Up', click: () => send('menu-nav', 'up') },
        { type: 'separator' },
        { label: t.toolbar.firstPage, accelerator: 'Home', click: () => send('menu-nav', 'first') },
        { label: t.toolbar.prevPage, accelerator: 'Left', click: () => send('menu-nav', 'prev') },
        { label: t.toolbar.nextPage, accelerator: 'Right', click: () => send('menu-nav', 'next') },
        { label: t.toolbar.lastPage, accelerator: 'End', click: () => send('menu-nav', 'last') },
      ],
    },
    {
      label: t.menu.move === 'Move(&M)' ? 'Image(&I)' : 'イメージ(&I)',
      submenu: [
        { label: t.menu.zoomIn, accelerator: 'Ctrl+=', click: () => send('menu-zoom', 'in') },
        { label: t.menu.zoomOut, accelerator: 'Ctrl+-', click: () => send('menu-zoom', 'out') },
        { label: t.menu.resetZoom, accelerator: 'Ctrl+0', click: () => send('menu-zoom', 'reset') },
        { label: t.menu.fitWindow, accelerator: 'Ctrl+Shift+0', click: () => send('menu-zoom', 'fit') },
      ],
    },
    {
      label: t.menu.view,
      submenu: [
        { label: t.toolbar.scaleSingle, accelerator: '1', click: () => send('menu-view-mode', 'single') },
        { label: t.toolbar.scaleSpread, accelerator: '2', click: () => send('menu-view-mode', 'spread') },
        { label: t.toolbar.scaleAuto, accelerator: '3', click: () => send('menu-view-mode', 'auto') },
        { type: 'separator' },
        { label: t.toolbar.fullscreen, accelerator: 'F11', click: () => send('menu-fullscreen') },
        { type: 'separator' },
        { label: t.toolbar.bindingRTL, click: () => send('menu-binding', 'rtl') },
        { label: t.toolbar.bindingLTR, click: () => send('menu-binding', 'ltr') },
      ],
    },
    {
      label: t.menu.options,
      submenu: [
        { label: t.menu.settings, accelerator: 'Ctrl+,', click: () => send('menu-settings') },
      ],
    },
    {
      label: t.menu.help,
      submenu: [
        {
          label: t.menu.usage,
          accelerator: 'F1',
          click: () => send('menu-help'),
        },
        { type: 'separator' },
        {
          label: t.menu.about,
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: t.menu.aboutTitle,
              message: 'reederr',
              detail: t.menu.aboutDetail,
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
