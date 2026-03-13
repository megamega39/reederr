import { existsSync, readFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { getDb } from './index';
import { logger } from '../utils/logger';

const CONFIG_FILE = 'config.json';
const SETTINGS_FILE = 'settings.json';

export function runMigration() {
  const userDataPath = app.getPath('userData');
  const db = getDb();

  // Check if migration already performed
  const isMigrated = db.prepare("SELECT value FROM kv_store WHERE key = 'migration_status'").get();
  if (isMigrated && (isMigrated as any).value === 'done') {
    return;
  }

  logger.info('[Migration] Starting data migration to SQLite...');

  try {
    // 1. Migrate settings.json
    const settingsPath = join(userDataPath, SETTINGS_FILE);
    if (existsSync(settingsPath)) {
      const data = JSON.parse(readFileSync(settingsPath, 'utf-8'));
      for (const [key, value] of Object.entries(data)) {
        db.prepare('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
      }
      renameSync(settingsPath, settingsPath + '.bak');
      logger.info('[Migration] settings.json migrated.');
    }

    // 2. Migrate config.json
    const configPath = join(userDataPath, CONFIG_FILE);
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));
      
      // 'viewer' key contains history and favorites
      const viewerData = config.viewer || {};
      
      // Favorites
      if (Array.isArray(viewerData.favorites)) {
        const stmt = db.prepare('INSERT OR IGNORE INTO favorites (path, name) VALUES (?, ?)');
        for (const fav of viewerData.favorites) {
          stmt.run(fav.path, fav.name);
        }
      }

      // History
      if (Array.isArray(viewerData.history)) {
        const stmt = db.prepare('INSERT OR IGNORE INTO history (path, name) VALUES (?, ?)');
        for (const entry of viewerData.history) {
          stmt.run(entry.path, entry.name || '');
        }
      }

      // Store entire viewer object in kv_store as fallback/state
      db.prepare('INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)').run('viewer_state', JSON.stringify(viewerData));

      renameSync(configPath, configPath + '.bak');
      logger.info('[Migration] config.json migrated.');
    }

    db.prepare("INSERT INTO kv_store (key, value) VALUES ('migration_status', 'done')").run();
    logger.info('[Migration] Migration completed successfully.');

  } catch (err) {
    logger.error('[Migration] Migration failed:', err);
  }
}
