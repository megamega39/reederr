import { existsSync, mkdirSync, readdirSync, rmSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { MAX_TEMP_BYTES, MAX_TEMP_FILES } from './constants';

const TEMP_BASE = join(tmpdir(), 'reederr-cache');

interface TempEntry {
  path: string;
  size: number;
  lastAccess: number;
}

/**
 * Unified Temp File Manager
 * Handles extraction, LRU caching, and cleanup of temporary files.
 */
class TempManager {
  private cache = new Map<string, TempEntry>();
  private totalBytes = 0;

  constructor() {
    this.ensureDir(TEMP_BASE);
  }

  getBaseTempDir(): string {
    return TEMP_BASE;
  }

  private ensureDir(path: string) {
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }
  }

  /**
   * Generates a deterministic temp subdir name for an archive entry
   */
  getTempDirForEntry(archivePath: string, innerPath: string): string {
    const hash = createHash('sha1')
      .update(archivePath + '::' + innerPath)
      .digest('hex')
      .slice(0, 16);
    const sub = join(TEMP_BASE, hash);
    this.ensureDir(sub);
    return sub;
  }

  registerFile(key: string, path: string) {
    try {
      const stats = statSync(path);
      const size = stats.size;

      // If key already exists, "remove" its old size from totalBytes before evict checking
      const existing = this.cache.get(key);
      if (existing) {
        this.totalBytes -= existing.size;
        this.cache.delete(key);
      }

      while (this.cache.size >= MAX_TEMP_FILES || this.totalBytes + size > MAX_TEMP_BYTES) {
        if (!this.evictOldest()) break;
      }

      const entry: TempEntry = {
        path,
        size,
        lastAccess: Date.now(),
      };
      this.cache.set(key, entry);
      this.totalBytes += size;
    } catch (err) {
      /* ignore */
    }
  }

  getFile(key: string): string | null {
    const entry = this.cache.get(key);
    if (entry && existsSync(entry.path)) {
      entry.lastAccess = Date.now();
      return entry.path;
    }
    if (entry) {
      this.totalBytes -= entry.size;
      this.cache.delete(key);
    }
    return null;
  }

  private evictOldest(): boolean {
    const entries = [...this.cache.entries()].sort((a, b) => a[1].lastAccess - b[1].lastAccess);
    if (entries.length === 0) return false;
    
    // We keep at least one if we are under half capacity, to avoid aggressive thrashing
    if (this.cache.size <= 1 && this.totalBytes < MAX_TEMP_BYTES * 0.5) return false;

    const [key, entry] = entries[0];
    try {
      unlinkSync(entry.path);
    } catch {
      /* ignore */
    }
    this.totalBytes -= entry.size;
    this.cache.delete(key);
    return true;
  }

  /**
   * Full cleanup of all temp directories managed by Reederr
   */
  cleanupAll() {
    this.cache.clear();
    this.totalBytes = 0;

    // Cleanup our main cache dir
    if (existsSync(TEMP_BASE)) {
      try {
        rmSync(TEMP_BASE, { recursive: true, force: true });
      } catch { /* ignore */ }
    }
    this.ensureDir(TEMP_BASE);

    // Cleanup legacy dirs if they exist
    const legacyDirs = [
      join(tmpdir(), 'reederr-extract'),
      join(tmpdir(), 'reederr-media')
    ];
    for (const dir of legacyDirs) {
      if (existsSync(dir)) {
        try {
          rmSync(dir, { recursive: true, force: true });
        } catch { /* ignore */ }
      }
    }
  }
}

export const tempManager = new TempManager();
