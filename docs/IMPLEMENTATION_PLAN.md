# 実装計画：Reederr（Unicode Leeyes風 画像/メディアビューア）

## 1. ファイル構成

```
reederr/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── electron-builder.yml          # 将来的なビルド用
├── electron/
│   ├── main.ts                  # Electron メインプロセス
│   ├── preload.ts               # contextBridge による IPC ブリッジ
│   └── vfs/
│       ├── index.ts             # VFS ファクトリ
│       ├── types.ts             # VFS 共通型
│       ├── localFS.ts           # ローカルファイルシステム
│       ├── zipFS.ts             # ZIP コンテナ（7-Zip CLI）
│       └── rarFS.ts             # RAR コンテナ（7-Zip CLI）
├── src/
│   ├── main.tsx                 # React エントリ
│   ├── App.tsx
│   ├── index.html
│   ├── types/
│   │   └── index.ts
│   ├── stores/
│   │   └── viewerStore.ts       # Zustand
│   ├── components/
│   │   ├── FolderTree.tsx       # 左上フォルダツリー
│   │   ├── FileList.tsx         # 左下ファイル一覧
│   │   ├── ImageView.tsx        # 画像ビュー
│   │   ├── VideoView.tsx        # 動画プレイヤー
│   │   ├── AudioView.tsx        # 音声プレイヤー
│   │   ├── StatusBar.tsx        # ステータスバー
│   │   └── MediaView.tsx        # 右ペイン（統合）
│   └── hooks/
│       ├── usePreload.ts        # IPC ハンドル
│       └── useKeyboard.ts       # キーボードショートカット
└── docs/
    └── IMPLEMENTATION_PLAN.md   # 本ドキュメント
```

## 2. IPC API 設計

### 2.1 チャンネル一覧（contextBridge 経由）

| チャンネル | 方向 | 引数 | 戻り値 | 説明 |
|-----------|------|------|--------|------|
| `select-folder` | renderer→main | なし | `{ path: string } \| null` | フォルダ選択ダイアログ、UTF-8 パス返却 |
| `list-directory` | renderer→main | `{ path: string }` | `DirectoryEntry[]` | 指定パスの一覧（サブフォルダ＋ファイル） |
| `read-file` | renderer→main | `{ path: string }` | `ArrayBuffer` | ファイル内容を ArrayBuffer で返却 |
| `stat` | renderer→main | `{ path: string }` | `FileStats \| null` | ファイル/フォルダの情報 |
| `open-in-explorer` | renderer→main | `{ path: string }` | `void` | エクスプローラで親フォルダを開く |
| `get-path-userData` | renderer→main | なし | `string` | userData のパス |

### 2.2 型定義

```ts
interface DirectoryEntry {
  name: string;      // ファイル名（Unicode）
  path: string;      // 絶対/仮想パス
  isDirectory: boolean;
  isArchive: boolean; // .zip/.rar/.cbz/.cbr
}

interface FileStats {
  size: number;
  isDirectory: boolean;
  mtime?: number;
}
```

### 2.3 仮想パス（アーカイブ対応後）

- ローカル: `C:\Test\01♥.jpg`
- ZIP 内: `C:\Test\archive.zip!/images/01♥.jpg` （`!` で区切り）

### 2.4 パス・URL ルール

- `pathToFileURL` で file:// URL 化（renderer は Blob URL のみ使用、v1 は readFile→Blob URL）
- ANSI/Shift_JIS 変換禁止

## 3. MVP スコープ（ステップ 1）

- LocalFS のみ
- フォルダ選択ダイアログ
- ファイル一覧（画像のみフィルタ可）
- クリックで画像表示（readFile → Blob URL）
- 3 ペイン UI の骨組み（ツリーは単一ルート、一覧＋ビュー）

## 4. 今後のステップ対応

| ステップ | 追加ファイル/変更 |
|----------|-------------------|
| 2 | FolderTree 仮想スクロール、サムネ表示 |
| 3 | MediaView に見開き/綴じロジック |
| 4 | PreloadCache、LRU キャッシュ |
| 5 | zipFS.ts、VFS ファクトリ拡張 |
| 6 | rarFS.ts |
| 7 | VideoView、AudioView、外部プレイヤーフォールバック |
| 8 | bomb 対策、cleanup、README |
