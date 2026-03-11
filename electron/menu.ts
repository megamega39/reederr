import { Menu, dialog, app, BrowserWindow } from 'electron';

export function buildMenu(mainWindow: BrowserWindow) {
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
            const result = await dialog.showOpenDialog(mainWindow, {
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
            const result = await dialog.showOpenDialog(mainWindow, {
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
          label: '使い方(&H)...',
          accelerator: 'F1',
          click: () => send('menu-help'),
        },
        { type: 'separator' },
        {
          label: 'バージョン情報(&A)...',
          click: () => {
            dialog.showMessageBox(mainWindow, {
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
