# Reederr

Unicode 対応 Leeyes 風 画像/メディアビューア（Windows 10/11 向け）

## 特徴

- Unicode パス対応（♥/❤️/絵文字入りファイル名 OK）
- ZIP/RAR を展開せず閲覧（予定）
- Leeyes 風 3 ペイン UI（左上フォルダ、左下ファイル一覧、右ビュー）
- Electron + TypeScript + React + Vite

## 技術スタック

- Electron + TypeScript（strict）
- Vite + React（renderer）
- 状態管理：Zustand
- セキュリティ：nodeIntegration=false, contextIsolation=true

## セットアップ

```bash
npm install
npm run dev
```

初回の `npm install` では Electron バイナリのダウンロードに時間がかかることがあります。WSL/Linux で開発する場合、Electron の postinstall でバイナリが取得できないことがあります。その場合は Windows 上でビルド・実行してください。

## スクリプト

- `npm run dev` - 開発サーバー起動（Electron + Vite HMR）
- `npm run build` - 本番ビルド
- `npm run preview` - ビルド結果のプレビュー（renderer のみ）

## MVP（現在の実装）

- [x] LocalFS のみ
- [x] フォルダ選択ダイアログ
- [x] ファイル一覧（画像フィルタ）
- [x] クリックで画像表示（readFile → Blob URL）
- [x] 3 ペイン UI（フォルダツリー / ファイル一覧 / 画像ビュー）
- [x] キー操作：←/→ で前後移動
- [x] ステータスバー

## 今後の実装予定

詳細は [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) を参照。

1. 仮想スクロール + サムネイル
2. 見開き / 綴じ / 自動判定
3. 先読み・キャッシュ
4. ZipFS / RarFS（7-Zip CLI）
5. 動画・音声プレイヤー
6. 外部プレイヤーフォールバック
