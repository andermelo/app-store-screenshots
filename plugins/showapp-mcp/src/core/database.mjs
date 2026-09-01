import { DatabaseSync } from 'node:sqlite';
import { resolvePaths } from './config.mjs';

const SCHEMA_VERSION = 1;

export function openDatabase(dataDir) {
  const paths = resolvePaths(dataDir);
  const db = new DatabaseSync(paths.databasePath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  migrate(db);
  return { db, paths };
}

function migrate(db) {
  const version = Number(db.prepare('PRAGMA user_version').get().user_version || 0);
  if (version >= SCHEMA_VERSION) return;

  db.exec(`
    BEGIN;

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      width INTEGER NOT NULL DEFAULT 1320,
      height INTEGER NOT NULL DEFAULT 2868,
      settings_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_locales (
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      locale TEXT NOT NULL,
      label TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (project_id, locale)
    );

    CREATE TABLE IF NOT EXISTS screens (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      layout_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS layers (
      id TEXT PRIMARY KEY,
      screen_id TEXT NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      z_index INTEGER NOT NULL DEFAULT 0,
      visible INTEGER NOT NULL DEFAULT 1,
      locked INTEGER NOT NULL DEFAULT 0,
      props_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS layer_localizations (
      layer_id TEXT NOT NULL REFERENCES layers(id) ON DELETE CASCADE,
      locale TEXT NOT NULL,
      content_json TEXT NOT NULL DEFAULT '{}',
      PRIMARY KEY (layer_id, locale)
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      mime TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      hash TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS screen_assets (
      screen_id TEXT NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
      locale TEXT NOT NULL,
      asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      PRIMARY KEY (screen_id, locale)
    );

    CREATE INDEX IF NOT EXISTS idx_screens_project_order ON screens(project_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_layers_screen_order ON layers(screen_id, z_index);
    CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id);

    PRAGMA user_version = ${SCHEMA_VERSION};
    COMMIT;
  `);
}
