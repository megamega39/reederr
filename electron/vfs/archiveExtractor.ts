import { join } from 'node:path';
import { existsSync, readFileSync, promises as fs } from 'node:fs';
import { extractToTemp } from './sevenZip';
import { tempManager } from './tempManager';
import { logger } from '../utils/logger';
import { splitArchivePath } from './utils';

interface ExtractionRequest {
  archivePath: string;
  innerPath: string;
  resolve: (data: ArrayBuffer) => void;
  reject: (err: any) => void;
}

class ArchiveExtractor {
  private queue: Map<string, ExtractionRequest[]> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private DEBOUNCE_MS = 50;

  async readFile(vpath: string): Promise<ArrayBuffer> {
    const split = splitArchivePath(vpath);
    if (!split) throw new Error('Not an archive path');
    const [archivePath, innerPath] = split;
    
    // Check cache first
    const cacheKey = `media:${archivePath}!${innerPath}`;
    const cachedPath = tempManager.getFile(cacheKey);
    if (cachedPath && existsSync(cachedPath)) {
      const buf = readFileSync(cachedPath);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    }

    return new Promise((resolve, reject) => {
      const request: ExtractionRequest = { archivePath, innerPath, resolve, reject };
      
      if (!this.queue.has(archivePath)) {
        this.queue.set(archivePath, []);
      }
      this.queue.get(archivePath)!.push(request);

      if (!this.timers.has(archivePath)) {
        this.timers.set(archivePath, setTimeout(() => this.processQueue(archivePath), this.DEBOUNCE_MS));
      }
    });
  }

  private async processQueue(archivePath: string) {
    const requests = this.queue.get(archivePath) || [];
    this.queue.delete(archivePath);
    this.timers.delete(archivePath);

    if (requests.length === 0) return;

    if (requests.length === 1) {
      // Single request optimization (still using the unified extractToTemp)
      const req = requests[0];
      try {
        const subDir = tempManager.getTempDirForEntry(req.archivePath, req.innerPath);
        const extractedPath = await extractToTemp(req.archivePath, req.innerPath, subDir);
        tempManager.registerFile(`media:${req.archivePath}!${req.innerPath}`, extractedPath);
        const buf = await fs.readFile(extractedPath);
        req.resolve(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
      } catch (err) {
        req.reject(err);
      }
      return;
    }

    // ACTUAL BATCH EXTRACTION: Extract multiple files in one process
    logger.info(`[ArchiveExtractor] Batch extracting ${requests.length} files from ${archivePath}`);
    const innerPaths = requests.map(r => r.innerPath);
    
    try {
      // Create a unique temp directory for this batch
      const batchDir = join(tempManager.getBaseTempDir(), `batch-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      await fs.mkdir(batchDir, { recursive: true });

      const { extractMultipleToTemp } = await import('./sevenZip');
      const extractedPaths = await extractMultipleToTemp(archivePath, innerPaths, batchDir);
      
      for (let i = 0; i < requests.length; i++) {
        const req = requests[i];
        const path = extractedPaths?.[i];
        try {
          if (path && existsSync(path)) {
            tempManager.registerFile(`media:${req.archivePath}!${req.innerPath}`, path);
            const buf = await fs.readFile(path);
            req.resolve(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
          } else {
            req.reject(new Error(`Extracted file not found: ${req.innerPath}`));
          }
        } catch (e) {
          req.reject(e);
        }
      }
    } catch (err) {
      logger.error(`[ArchiveExtractor] Batch failed for ${archivePath}:`, err);
      requests.forEach(r => r.reject(err));
    }
  }
}

export const archiveExtractor = new ArchiveExtractor();
