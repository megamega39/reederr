import { Menu, dialog, app, BrowserWindow } from 'electron';

// Minimal translation for menu to avoid importing from src (cross-boundary)
const menuLabels = {
  ja: {
    file: 'ファイル(&F)',
    openFile: 'ファイルを開く(&O)...',
    openFolder: 'フォルダを開く(&D)...',
    exit: '終了(&X)',
    edit: '編集(&E)',
    copyPath: 'パスをコピー',
    move: '移動(&M)',
    back: '戻る',
    forward: '進む',
    up: '上の階層へ',
    firstPage: '最初のページ',
    prevPage: '前のページ',
    nextPage: '次のページ',
    lastPage: '最後のページ',
    zoomIn: '拡大',
    zoomOut: '縮小',
    resetZoom: 'サイズリセット',
    fitWindow: 'ウィンドウに合わせる',
    view: '表示(&V)',
    single: '単一ページ',
    spread: '見開き',
    auto: '自動判別',
    fullscreen: '全画面表示',
    bindingRTL: '右から左(漫画)',
    bindingLTR: '左から右',
    options: 'オプション(&O)',
    settings: '設定(&S)...',
    help: 'ヘルプ(&H)',
    usage: '使い方(&U)',
    about: 'このアプリについて(&A)',
    aboutTitle: '情報',
    aboutDetail: 'Reederr - シンプルなメディアビューア'
  },
  en: {
    file: 'File(&F)',
    openFile: 'Open File(&O)...',
    openFolder: 'Open Folder(&D)...',
    exit: 'Exit(&X)',
    edit: 'Edit(&E)',
    copyPath: 'Copy Path',
    move: 'Move(&M)',
    back: 'Back',
    forward: 'Forward',
    up: 'Up',
    firstPage: 'First Page',
    prevPage: 'Prev Page',
    nextPage: 'Next Page',
    lastPage: 'Last Page',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    resetZoom: 'Reset Zoom',
    fitWindow: 'Fit Window',
    view: 'View(&V)',
    single: 'Single Page',
    spread: 'Spread',
    auto: 'Auto',
    fullscreen: 'Fullscreen',
    bindingRTL: 'Right to Left',
    bindingLTR: 'Left to Right',
    options: 'Options(&O)',
    settings: 'Settings(&S)...',
    help: 'Help(&H)',
    usage: 'Usage(&U)',
    about: 'About(&A)',
    aboutTitle: 'About',
    aboutDetail: 'Reederr - Simple Media Viewer'
  }
};

export function buildMenu(mainWindow: BrowserWindow, lang: 'ja' | 'en' = 'ja') {
  const t = menuLabels[lang] || menuLabels.ja;
  const send = (ch: string, ...args: unknown[]) => {
    mainWindow?.webContents.send(ch, ...args);
  };

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: t.file,
      submenu: [
        {
          label: t.openFile,
          accelerator: 'Ctrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              title: t.openFile.replace('(&O)...', ''),
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
          label: t.openFolder,
          accelerator: 'Ctrl+Shift+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              title: t.openFolder.replace('(&D)...', ''),
              properties: ['openDirectory'],
            });
            if (!result.canceled && result.filePaths.length > 0) {
              send('menu-open-folder', result.filePaths[0]);
            }
          },
        },
        { type: 'separator' },
        {
          label: t.exit,
          accelerator: 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: t.edit,
      submenu: [
        {
          label: t.copyPath,
          accelerator: 'Ctrl+C',
          click: () => send('menu-copy-path'),
        },
      ],
    },
    {
      label: t.move,
      submenu: [
        { label: t.back, accelerator: 'Alt+Left', click: () => send('menu-nav', 'back') },
        { label: t.forward, accelerator: 'Alt+Right', click: () => send('menu-nav', 'forward') },
        { label: t.up, accelerator: 'Alt+Up', click: () => send('menu-nav', 'up') },
        { type: 'separator' },
        { label: t.firstPage, accelerator: 'Home', click: () => send('menu-nav', 'first') },
        { label: t.prevPage, accelerator: 'Left', click: () => send('menu-nav', 'prev') },
        { label: t.nextPage, accelerator: 'Right', click: () => send('menu-nav', 'next') },
        { label: t.lastPage, accelerator: 'End', click: () => send('menu-nav', 'last') },
      ],
    },
    {
      label: t.move === 'Move(&M)' ? 'Image(&I)' : 'イメージ(&I)',
      submenu: [
        { label: t.zoomIn, accelerator: 'Ctrl+=', click: () => send('menu-zoom', 'in') },
        { label: t.zoomOut, accelerator: 'Ctrl+-', click: () => send('menu-zoom', 'out') },
        { label: t.resetZoom, accelerator: 'Ctrl+0', click: () => send('menu-zoom', 'reset') },
        { label: t.fitWindow, accelerator: 'Ctrl+Shift+0', click: () => send('menu-zoom', 'fit') },
      ],
    },
    {
      label: t.view,
      submenu: [
        { label: t.single, accelerator: '1', click: () => send('menu-view-mode', 'single') },
        { label: t.spread, accelerator: '2', click: () => send('menu-view-mode', 'spread') },
        { label: t.auto, accelerator: '3', click: () => send('menu-view-mode', 'auto') },
        { type: 'separator' },
        { label: t.fullscreen, accelerator: 'F11', click: () => send('menu-fullscreen') },
        { type: 'separator' },
        { label: t.bindingRTL, click: () => send('menu-binding', 'rtl') },
        { label: t.bindingLTR, click: () => send('menu-binding', 'ltr') },
      ],
    },
    {
      label: t.options,
      submenu: [
        { label: t.settings, accelerator: 'Ctrl+,', click: () => send('menu-settings') },
      ],
    },
    {
      label: t.help,
      submenu: [
        {
          label: t.usage,
          accelerator: 'F1',
          click: () => send('menu-help'),
        },
        { type: 'separator' },
        {
          label: t.about,
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: t.aboutTitle,
              message: 'reederr',
              detail: t.aboutDetail,
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
