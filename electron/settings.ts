import { app } from 'electron';
import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { logger } from './utils/logger';

export const SETTINGS_FILE = 'settings.json';
export const CONFIG_FILE = 'config.json';

export function loadSettings(): Record<string, unknown> {
  try {
    const path = join(app.getPath('userData'), SETTINGS_FILE);
    if (existsSync(path)) {
      const buf = readFileSync(path, 'utf-8');
      return JSON.parse(buf) as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return {};
}

export function saveSettings(data: Record<string, unknown>): void {
  try {
    const path = join(app.getPath('userData'), SETTINGS_FILE);
    const current = loadSettings();
    const merged = { ...current, ...data };
    writeFileSync(path, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err) {
    logger.error('[Settings] Failed to save settings:', err);
  }
}

export function loadConfig(internal = true): Record<string, unknown> {
  try {
    const path = join(app.getPath('userData'), CONFIG_FILE);
    if (existsSync(path)) {
      const buf = readFileSync(path, 'utf-8');
      const data = JSON.parse(buf) as Record<string, unknown>;
      return data;
    }
  } catch (err) {
    logger.warn('[Persistence] Failed to load config:', err);
  }
  return {};
}

export function saveConfig(data: Record<string, unknown>): void {
  try {
    if (!data || Object.keys(data).length === 0) return;

    const path = join(app.getPath('userData'), CONFIG_FILE);
    const current = loadConfig(true);
    const merged = { ...current, ...data };
    writeFileSync(path, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err) {
    logger.error('[Persistence] Failed to save config:', err);
  }
}
