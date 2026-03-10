# 7-Zip 同梱用

RAR/CBR 対応のため、7-Zip の `7z.exe` と `7z.dll` をこのディレクトリに配置してください。

## 取得方法

1. [7-Zip ダウンロードページ](https://www.7-zip.org/download.html) から **7-Zip Extra** をダウンロード
2. 7z***_extra.7z を展開
3. `7z.exe` と `7z.dll` をこのフォルダにコピー

```
tools/7zip/
├── 7z.exe
├── 7z.dll
└── README.md
```

## 注意

- RAR 対応には 7-Zip 19.00 以降（RAR5 サポート付き）を推奨
- 開発時は `tools/7zip/7z.exe` を参照
- ビルド後は `resources/tools/7zip/7z.exe` に同梱されます
