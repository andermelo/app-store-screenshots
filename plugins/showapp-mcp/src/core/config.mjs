import os from 'node:os';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

export const DEFAULT_PORT = 43123;

export function resolveDataDir() {
  const configured = process.env.SHOWAPP_DATA_DIR?.trim();
  const root = configured || path.join(os.homedir(), '.showapp');
  mkdirSync(root, { recursive: true });
  return path.resolve(root);
}

export function resolvePaths(dataDir = resolveDataDir()) {
  const assetsDir = path.join(dataDir, 'assets');
  const exportsDir = path.join(dataDir, 'exports');
  const browserDir = path.join(dataDir, 'browser');
  for (const directory of [assetsDir, exportsDir, browserDir]) {
    mkdirSync(directory, { recursive: true });
  }
  return {
    dataDir,
    databasePath: path.join(dataDir, 'showapp.sqlite'),
    assetsDir,
    exportsDir,
    browserDir,
  };
}

export function studioUrl({ port = DEFAULT_PORT, projectId, mode } = {}) {
  const url = new URL(`http://127.0.0.1:${port}/`);
  if (projectId) url.searchParams.set('project', projectId);
  if (mode) url.searchParams.set('mode', mode);
  return url.toString();
}

export function safeFilename(value, fallback = 'untitled') {
  const normalized = String(value || fallback)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
  return normalized || fallback;
}

export function nowIso() {
  return new Date().toISOString();
}

export function parseJson(value, fallback = {}) {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function json(value) {
  return JSON.stringify(value ?? null);
}
