import * as chokidar from 'chokidar';
import { logger } from '../utils/logger';

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private currentPath: string | null = null;
  private onChange: (path: string) => void;

  constructor(onChange: (path: string) => void) {
    this.onChange = onChange;
  }

  watch(path: string) {
    if (this.currentPath === path) return;

    this.stop();

    // Do not watch virtual paths (inside archives) or special roots
    if (path.includes('!') || path === 'pc' || path === 'network') {
      return;
    }

    try {
      this.currentPath = path;
      this.watcher = chokidar.watch(path, {
        depth: 0, // Only watch the immediate directory
        ignoreInitial: true,
        persistent: true,
      });

      this.watcher.on('all', (event: string, targetPath: string) => {
        logger.info(`[Watcher] Event: ${event} on ${targetPath}`);
        this.onChange(path);
      });

      logger.info(`[Watcher] Started watching: ${path}`);
    } catch (err) {
      logger.error(`[Watcher] Failed to start watching ${path}:`, err);
    }
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.currentPath = null;
      logger.info('[Watcher] Stopped.');
    }
  }
}
