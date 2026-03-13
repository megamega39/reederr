import { DirectoryEntry } from '../types';
import { MediaLoader } from '../stores/mediaLoader';
import { useMediaCacheStore } from '../stores/mediaCacheStore';

export class PrefetchService {
  /**
   * 現在の表示位置に基づいて、前後数ページのメディアを先読みします。
   * 
   * @param path 現在表示しているメインのパス
   * @param allEntries 対象となる全エントリ（画像リスト、またはすべてのファイルリスト）
   * @param pagesPerView 1度に表示される枚数（見開きなら2）
   * @param isImage 画像モードかどうか（画像以外は1ページずつ予測）
   * @param checkCancelled 読み込みが最新でなくなったかを確認する関数
   */
  static startPrefetch(
    path: string,
    allEntries: DirectoryEntry[],
    pagesPerView: number,
    checkCancelled: () => boolean
  ) {
    if (!path || allEntries.length === 0) return;

    const curIdx = allEntries.findIndex((e) => e.path === path);
    if (curIdx < 0) return;

    // 画像の場合は見開き枚数を考慮した先読み範囲に設定
    const lookahead = pagesPerView * 15;
    const lookbehind = pagesPerView * 5;

    const preloads: DirectoryEntry[] = [];
    
    // 前方（次ページ側）を優先して予測
    for (let i = pagesPerView; i < pagesPerView + lookahead; i++) {
      const idx = curIdx + i;
      if (idx < allEntries.length) preloads.push(allEntries[idx]);
    }
    
    // 後方（戻る側）も少し予測
    for (let i = 1; i <= lookbehind; i++) {
      const idx = curIdx - i;
      if (idx >= 0) preloads.push(allEntries[idx]);
    }

    if (preloads.length === 0) return;

    const cacheState = useMediaCacheStore.getState();

    // 5件ずつのバッチで処理（APIの同時リクエスト数を抑える）
    // バッチ間にディレイを設けて、メインのメディア読み込みを優先させる
    for (let i = 0; i < preloads.length; i += 5) {
      const wait = i === 0 ? 100 : i * 100; // 段階的にディレイを増やす
      setTimeout(() => {
        if (checkCancelled()) return;
        MediaLoader.preloadBatch(
          preloads.slice(i, i + 5),
          (p, url) => {
            if (!cacheState.getMediaUrl(p)) {
              cacheState.setMediaUrl(p, url);
            }
          },
          (p, url) => cacheState.ensureImageDimension(p, url),
          checkCancelled
        );
      }, wait);
    }
  }
}
