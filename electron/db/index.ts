import type Database from 'better-sqlite3';

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const DatabaseConstructor = require('better-sqlite3');

import { join } from 'node:path';
import { app } from 'electron';
import { logger } from '../utils/logger';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const userDataPath = app.getPath('userData');
  const dbPath = join(userDataPath, 'reederr.db');
  
  db = new DatabaseConstructor(dbPath) as Database.Database;
  db.pragma('journal_mode = WAL');
  
  initSchema();
  
  return db;
}

function initSchema() {
  if (!db) return;

  logger.info('[DB] Initializing schema...');

  // Generic Key-Value store (settings, etc)
  db.exec(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // History entries
  db.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT UNIQUE,
      name TEXT,
      last_opened_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Favorite folders
  db.exec(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT UNIQUE,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Bookmarks (reading positions within files/archives)
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_path TEXT UNIQUE,
      position_data TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  logger.info('[DB] Schema initialized.');
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
