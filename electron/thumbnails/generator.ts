import * as path from 'path';
import * as fs from 'fs/promises';
import { nativeImage } from 'electron';
import { logger } from '../utils/logger';
import { run7zBase } from '../vfs/sevenZip';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

export interface ThumbnailOptions {
  width: number;
  height: number;
}

export class ThumbnailGenerator {
  private cacheDir: string;

  constructor(userDataPath: string) {
    this.cacheDir = path.join(userDataPath, 'thumbnails');
  }

  async ensureCacheDir() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (err) {
      logger.error('Failed to create thumbnail cache dir:', err);
    }
  }

  private getCacheKey(filePath: string, width: number, height: number): string {
    // Use SHA256 hash to avoid Windows MAX_PATH issues with long paths
    const normalizedPath = path.normalize(filePath).replace(/\\/g, '/');
    const hash = createHash('sha256').update(normalizedPath).digest('hex');
    return `${hash}_${width}x${height}.png`;
  }

  async getThumbnail(filePath: string, options: ThumbnailOptions): Promise<string | null> {
    logger.debug(`[Thumbnail] Request for ${filePath} (${options.width}x${options.height})`);
    const cacheKey = this.getCacheKey(filePath, options.width, options.height);
    const cachePath = path.join(this.cacheDir, cacheKey);

    // Check cache
    try {
      await fs.access(cachePath);
      return cachePath;
    } catch {
      // Not in cache, generate it
    }

    let resultPath: string | null = null;
    const ext = path.extname(filePath).toLowerCase();

    try {
      const { stat } = await import('../vfs');
      const s = await stat(filePath);
      
      if (s?.isDirectory) {
        resultPath = await this.generateDirectoryThumbnail(filePath, cachePath, options);
      } else if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext)) {
        resultPath = await this.generateImageThumbnail(filePath, cachePath, options);
      } else if (['.zip', '.rar', '.7z', '.cbz', '.cbr'].includes(ext)) {
        resultPath = await this.generateArchiveThumbnail(filePath, cachePath, options);
      }
    } catch (err) {
      logger.error(`Thumbnail generation failed for ${filePath}:`, err);
    }

    return resultPath;
  }

  private async generateImageThumbnail(filePath: string, cachePath: string, options: ThumbnailOptions): Promise<string | null> {
    try {
      let img: Electron.NativeImage;
      let arrayBuffer: ArrayBuffer | undefined;
      const normalizedPath = path.normalize(filePath);

      if (filePath.includes('!')) {
        // Virtual path (inside archive)
        const { readFile } = await import('../vfs');
        arrayBuffer = await readFile(filePath);
        const buf = Buffer.from(arrayBuffer);
        
        // Show 12 magic bytes to detect if 7z output is clean
        const magic = buf.slice(0, 12).toString('hex').toLowerCase();
        logger.debug(`[Thumbnail] Virtual read success: ${filePath} (${buf.length} bytes, magic: ${magic})`);
        
        // Primary attempt: createFromBuffer
        img = nativeImage.createFromBuffer(buf);

        // Fallback 1: createFromDataURL
        if (img.isEmpty()) {
          logger.debug(`[Thumbnail] createFromBuffer failed, trying createFromDataURL fallback...`);
          let mime = 'image/png';
          if (magic.startsWith('ffd8')) mime = 'image/jpeg';
          else if (magic.startsWith('52494646') && magic.endsWith('57454250')) mime = 'image/webp';
          else if (magic.startsWith('47494638')) mime = 'image/gif';

          const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
          img = nativeImage.createFromDataURL(dataUrl);
        }

        // Fallback 2: extractToTemp and createFromPath with CLEAN name
        if (img.isEmpty()) {
          logger.debug(`[Thumbnail] DataURL fallback failed, trying temp extract with clean name...`);
          const { splitArchivePath } = await import('../vfs/utils');
          const { extractToTemp } = await import('../vfs/sevenZip');
          const { tempManager } = await import('../vfs/tempManager');
          
          const split = splitArchivePath(filePath);
          if (split) {
            const [archivePath, innerPath] = split;
            const tempDir = tempManager.getTempDirForEntry(archivePath, innerPath);
            try {
              const tempPath = await extractToTemp(archivePath, innerPath, tempDir);
              
              // Rename to a very simple name to avoid ANY path/filename issues in Electron
              const ext = path.extname(tempPath) || '.webp';
              const cleanPath = path.join(tempDir, 'thumb_src' + ext);
              
              if (tempPath !== cleanPath) {
                try { await fs.unlink(cleanPath); } catch {}
                await fs.rename(tempPath, cleanPath);
              }
              
              img = nativeImage.createFromPath(cleanPath);
              logger.debug(`[Thumbnail] Temp extract fallback result: ${img.isEmpty() ? 'FAILED' : 'SUCCESS'}`);
            } catch (err) {
              logger.error(`[Thumbnail] Temp extract fallback failed:`, err);
            }
          }
        }
      } else {
        // Physical path - should use createFromPath directly
        img = nativeImage.createFromPath(normalizedPath);
      }

      if (img.isEmpty()) {
        logger.warn(`[Thumbnail] All nativeImage methods failed for ${filePath}. Using raw data fallback.`);
        // Last resort: If we have the buffer but nativeImage failed, the browser might still be able to decode it.
        // We write the raw buffer to the cache path as-is.
        // Note: Even if it's named .png in cache, browsers often identify by content.
        if (filePath.includes('!') && typeof arrayBuffer !== 'undefined') {
          await fs.writeFile(cachePath, Buffer.from(arrayBuffer));
          logger.debug(`[Thumbnail] Saved raw data to cache as fallback: ${cachePath}`);
          return cachePath;
        }
        return null;
      }

      const thumbnail = img.resize({ width: options.width, height: options.height, quality: 'better' });
      const pngBuffer = thumbnail.toPNG();
      
      await fs.writeFile(cachePath, pngBuffer);
      logger.debug(`[Thumbnail] Success: ${cachePath} (${pngBuffer.length} bytes)`);
      return cachePath;
    } catch (err) {
      logger.error(`[Thumbnail] generateImageThumbnail failed for ${filePath}:`, err);
      return null;
    }
  }

  private async generateDirectoryThumbnail(
    dirPath: string,
    cachePath: string,
    options: ThumbnailOptions
  ): Promise<string | null> {
    try {
      const { listDirectory } = await import('../vfs');
      const entries = await listDirectory(dirPath);
      
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
      const archiveExtensions = ['.zip', '.rar', '.7z', '.cbz', '.cbr'];
      
      // 1. Look for direct image first
      const firstImage = entries.find(e => !e.isDirectory && imageExtensions.includes(path.extname(e.name).toLowerCase()));
      if (firstImage) {
        logger.debug(`[Thumbnail] Directory thumbnail source found (image): ${firstImage.path}`);
        return await this.generateImageThumbnail(firstImage.path, cachePath, options);
      }
      
      // 2. Look for first archive if no image found
      const firstArchive = entries.find(e => !e.isDirectory && archiveExtensions.includes(path.extname(e.name).toLowerCase()));
      if (firstArchive) {
        logger.debug(`[Thumbnail] Directory thumbnail source found (archive): ${firstArchive.path}`);
        return await this.generateArchiveThumbnail(firstArchive.path, cachePath, options);
      }

      return null;
    } catch (err) {
      logger.error(`[Thumbnail] generateDirectoryThumbnail failed for ${dirPath}:`, err);
      return null;
    }
  }

  private async generateArchiveThumbnail(
    filePath: string,
    cachePath: string,
    options: ThumbnailOptions
  ): Promise<string | null> {
    try {
      const { listArchive } = await import('../vfs/sevenZip');
      const entries = await listArchive(filePath);

      // Find first image
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
      const firstImageEntry = entries.find((e) => {
        if (e.isDirectory) return false;
        const normalized = e.path.replace(/\\/g, '/');
        const filename = normalized.split('/').pop() || '';
        
        // Skip junk files (MacOS metadata etc)
        if (normalized.includes('__MACOSX') || filename.startsWith('._') || filename === '.DS_Store') {
          return false;
        }

        const ext = path.extname(normalized).toLowerCase();
        return imageExtensions.includes(ext);
      });

      if (!firstImageEntry) {
        return null;
      }

      // Construct virtual path
      // Handle special characters for 7-zip by escaping them if needed
      // Actually, archiveFS handle extraction, we just need to provide a clean path
      const cleanInnerPath = firstImageEntry.path.replace(/\\/g, '/');
      const virtualPath = `${filePath}!${cleanInnerPath}`;

      logger.debug(`[Thumbnail] Archive candidate found: ${cleanInnerPath}`);

      // Re-use current implementation which already handles virtual paths via VFS
      return await this.generateImageThumbnail(virtualPath, cachePath, options);
    } catch (err) {
      logger.error(`[Thumbnail] generateArchiveThumbnail failed for ${filePath}:`, err);
      return null;
    }
  }
}
