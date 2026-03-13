import { DirectoryEntry } from '../types';
import { MediaAPI } from '../services/api';

export class MediaLoader {
  private static imageWorker: Worker | null = null;
  private static decodingCount = 0;
  private static MAX_DECODE = 8;

  static getWorker(): Worker {
    if (!this.imageWorker) {
      this.imageWorker = new Worker(new URL('../workers/imageDecoder.worker.ts', import.meta.url), { type: 'module' });
    }
    return this.imageWorker;
  }

  static async preloadBatch(
    batch: DirectoryEntry[],
    onUrlFetched: (path: string, url: string) => void,
    onDimensionEnsured: (path: string, url: string) => void,
    isCancelled: () => boolean
  ) {
    if (isCancelled()) return;
    const paths = batch.map(e => e.path);
    try {
      const res = await MediaAPI.getMediaUrls(paths, true);
      if (isCancelled() || !res.ok) return;
      const urls = res.value;

      urls.forEach(async (url, i) => {
        if (!url) return;
        const path = paths[i];
        onUrlFetched(path, url);
        onDimensionEnsured(path, url);

        // Web Worker decoding
        if (this.decodingCount < this.MAX_DECODE) {
          this.decodingCount++;
          const worker = this.getWorker();
          const id = Math.random(); 
          worker.postMessage({ url, id });
          
          const onMsg = (ev: MessageEvent) => {
            if (ev.data.id === id) {
              this.decodingCount--;
              worker.removeEventListener('message', onMsg);
            }
          };
          worker.addEventListener('message', onMsg);
        } else {
          const img = new Image();
          img.src = url;
        }
      });
    } catch (e) {
      console.warn('[MediaLoader] Preload failed:', e);
    }
  }

  static async decodeImage(url: string): Promise<void> {
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
    } catch (e) {
      // ignore
    }
  }
}
