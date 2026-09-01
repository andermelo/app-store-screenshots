import crypto, { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { openDatabase } from './database.mjs';
import { json, nowIso, parseJson, safeFilename } from './config.mjs';

const DEFAULT_SETTINGS = Object.freeze({
  sharedBackground: {
    type: 'gradient',
    colors: ['#f4f5f7', '#dfe8ff'],
    angle: 135,
    assetId: null,
    positionX: 50,
    positionY: 50,
    scale: 100,
  },
  canvas: { gap: 64 },
});

const DEFAULT_LAYOUT = Object.freeze({
  backgroundMode: 'shared',
  background: { type: 'solid', color: '#f5f5f7', colors: ['#f5f5f7', '#e8eefc'], angle: 135 },
  device: { frame: 'iphone', color: '#111111', scale: 72, x: 50, y: 61, tilt: 0, radius: 72 },
});

const DEFAULT_LAYER_PROPS = Object.freeze({
  text: {
    x: 50, y: 13, width: 84, fontSize: 102, fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
    fontWeight: 760, color: '#111111', align: 'center', lineHeight: 1.02, rotation: 0, opacity: 1,
  },
  image: { x: 50, y: 60, width: 72, height: 70, fit: 'contain', rotation: 0, opacity: 1, cornerRadius: 54, frame: 'iphone' },
  shape: { x: 50, y: 50, width: 32, height: 12, color: '#007aff', cornerRadius: 40, rotation: 0, opacity: 1 },
  emoji: { x: 50, y: 50, width: 16, fontSize: 180, rotation: 0, opacity: 1 },
});

function createId(prefix) {
  return `${prefix}_${randomUUID().replaceAll('-', '')}`;
}

function merge(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return { ...base };
  return { ...base, ...patch };
}

function normalizeLocale(locale) {
  const value = String(locale || '').trim().replace('_', '-');
  if (!value || value.length > 48 || !/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(value)) {
    throw new Error(`Invalid BCP-47 locale: ${locale}`);
  }
  try {
    return Intl.getCanonicalLocales(value)[0];
  } catch {
    throw new Error(`Invalid BCP-47 locale: ${locale}`);
  }
}

function localeLabel(locale) {
  try {
    const language = locale.split('-')[0];
    return new Intl.DisplayNames([locale, 'en'], { type: 'language' }).of(language) || locale;
  } catch {
    return locale;
  }
}

function imageMimeFromName(name) {
  const ext = path.extname(name).toLowerCase();
  return ({
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.avif': 'image/avif',
  })[ext] || 'application/octet-stream';
}

function extensionForMime(mime, originalName = '') {
  const known = ({
    'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif',
    'image/svg+xml': '.svg', 'image/avif': '.avif',
  })[mime];
  return known || path.extname(originalName).toLowerCase() || '.bin';
}

function decodeDataUrl(dataUrl) {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(String(dataUrl || ''));
  if (!match) throw new Error('Asset must be a base64 data URL.');
  return { mime: match[1].toLowerCase(), buffer: Buffer.from(match[2], 'base64') };
}

export class ShowAppStore {
  constructor({ dataDir } = {}) {
    const opened = openDatabase(dataDir);
    this.db = opened.db;
    this.paths = opened.paths;
  }

  close() {
    this.db.close();
  }

  transaction(callback) {
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const result = callback();
      this.db.exec('COMMIT;');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  listProjects() {
    return this.db.prepare(`
      SELECT p.id, p.name, p.width, p.height, p.created_at AS createdAt, p.updated_at AS updatedAt,
             COUNT(DISTINCT s.id) AS screenCount, COUNT(DISTINCT l.locale) AS localeCount
      FROM projects p
      LEFT JOIN screens s ON s.project_id = p.id
      LEFT JOIN project_locales l ON l.project_id = p.id
      GROUP BY p.id ORDER BY p.updated_at DESC
    `).all();
  }

  createProject({ name = 'Untitled App', width = 1320, height = 2868, defaultLocale = 'en-US', seed = true } = {}) {
    const id = createId('project');
    const createdAt = nowIso();
    const locale = normalizeLocale(defaultLocale);
    const safeWidth = Math.max(320, Math.min(4096, Number(width) || 1320));
    const safeHeight = Math.max(320, Math.min(4096, Number(height) || 2868));

    this.transaction(() => {
      this.db.prepare(`INSERT INTO projects (id, name, width, height, settings_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, String(name).slice(0, 140), safeWidth, safeHeight, json(DEFAULT_SETTINGS), createdAt, createdAt);
      this.db.prepare(`INSERT INTO project_locales (project_id, locale, label, is_default, sort_order)
        VALUES (?, ?, ?, 1, 0)`).run(id, locale, localeLabel(locale));
    });

    if (seed) {
      const screen = this.createScreen({ projectId: id, name: 'Welcome' });
      this.createLayer({
        screenId: screen.id,
        type: 'text',
        name: 'Headline',
        props: { y: 13, fontSize: 112, fontWeight: 780 },
        localizations: { [locale]: { text: 'Make it impossible to scroll past.' } },
      });
      this.createLayer({
        screenId: screen.id,
        type: 'text',
        name: 'Subheadline',
        props: { y: 22, fontSize: 48, fontWeight: 520, color: '#56565c', lineHeight: 1.2 },
        localizations: { [locale]: { text: 'Beautiful App Store screenshots, built with your agent.' } },
      });
      this.createLayer({
        screenId: screen.id,
        type: 'emoji',
        name: 'Favorite',
        props: { x: 50, y: 56, fontSize: 360 },
        localizations: { [locale]: { text: '✨' } },
      });
    }

    return this.getProject(id);
  }

  getProject(projectId) {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!row) throw new Error(`Project not found: ${projectId}`);

    const locales = this.db.prepare(`SELECT locale, label, is_default AS isDefault, sort_order AS sortOrder
      FROM project_locales WHERE project_id = ? ORDER BY sort_order, locale`).all(projectId)
      .map((item) => ({ ...item, isDefault: Boolean(item.isDefault) }));
    const screens = this.db.prepare(`SELECT * FROM screens WHERE project_id = ? ORDER BY sort_order, created_at`).all(projectId);
    const selectLayers = this.db.prepare('SELECT * FROM layers WHERE screen_id = ? ORDER BY z_index, created_at');
    const selectLocalizations = this.db.prepare('SELECT locale, content_json FROM layer_localizations WHERE layer_id = ?');
    const selectScreenAssets = this.db.prepare(`SELECT sa.locale, a.id, a.name, a.kind, a.mime, a.width, a.height
      FROM screen_assets sa JOIN assets a ON a.id = sa.asset_id WHERE sa.screen_id = ?`);

    return {
      id: row.id,
      name: row.name,
      width: row.width,
      height: row.height,
      settings: merge(DEFAULT_SETTINGS, parseJson(row.settings_json, {})),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      locales,
      screens: screens.map((screen) => ({
        id: screen.id,
        projectId: screen.project_id,
        name: screen.name,
        sortOrder: screen.sort_order,
        layout: merge(DEFAULT_LAYOUT, parseJson(screen.layout_json, {})),
        assets: Object.fromEntries(selectScreenAssets.all(screen.id).map((asset) => [asset.locale, {
          ...asset,
          url: `/api/assets/${asset.id}`,
        }])),
        layers: selectLayers.all(screen.id).map((layer) => ({
          id: layer.id,
          screenId: layer.screen_id,
          type: layer.type,
          name: layer.name,
          zIndex: layer.z_index,
          visible: Boolean(layer.visible),
          locked: Boolean(layer.locked),
          props: merge(DEFAULT_LAYER_PROPS[layer.type] || {}, parseJson(layer.props_json, {})),
          localizations: Object.fromEntries(selectLocalizations.all(layer.id).map((entry) => [entry.locale, parseJson(entry.content_json, {})])),
        })),
      })),
    };
  }

  updateProject(projectId, patch = {}) {
    const current = this.getProject(projectId);
    const settings = patch.settings ? merge(current.settings, patch.settings) : current.settings;
    if (patch.settings?.sharedBackground) {
      settings.sharedBackground = merge(current.settings.sharedBackground || DEFAULT_SETTINGS.sharedBackground, patch.settings.sharedBackground);
    }
    this.db.prepare(`UPDATE projects SET name = ?, width = ?, height = ?, settings_json = ?, updated_at = ? WHERE id = ?`).run(
      patch.name !== undefined ? String(patch.name).slice(0, 140) : current.name,
      patch.width !== undefined ? Math.max(320, Math.min(4096, Number(patch.width))) : current.width,
      patch.height !== undefined ? Math.max(320, Math.min(4096, Number(patch.height))) : current.height,
      json(settings), nowIso(), projectId,
    );
    return this.getProject(projectId);
  }

  deleteProject(projectId) {
    const assets = this.db.prepare('SELECT relative_path FROM assets WHERE project_id = ?').all(projectId);
    this.db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
    for (const asset of assets) {
      const file = path.resolve(this.paths.dataDir, asset.relative_path);
      if (file.startsWith(`${this.paths.assetsDir}${path.sep}`)) fs.rmSync(file, { force: true });
    }
    return { success: true, projectId };
  }

  addLocale(projectId, locale, label) {
    this.getProject(projectId);
    const code = normalizeLocale(locale);
    const nextOrder = Number(this.db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS value FROM project_locales WHERE project_id = ?').get(projectId).value);
    this.db.prepare(`INSERT INTO project_locales (project_id, locale, label, is_default, sort_order)
      VALUES (?, ?, ?, 0, ?) ON CONFLICT(project_id, locale) DO UPDATE SET label = excluded.label`).run(
      projectId, code, String(label || localeLabel(code)).slice(0, 100), nextOrder,
    );
    this.touchProject(projectId);
    return this.getProject(projectId).locales;
  }

  removeLocale(projectId, locale) {
    const code = normalizeLocale(locale);
    const row = this.db.prepare('SELECT is_default AS isDefault FROM project_locales WHERE project_id = ? AND locale = ?').get(projectId, code);
    if (!row) return this.getProject(projectId).locales;
    if (row.isDefault) throw new Error('The default locale cannot be removed.');
    this.transaction(() => {
      this.db.prepare('DELETE FROM project_locales WHERE project_id = ? AND locale = ?').run(projectId, code);
      this.db.prepare(`DELETE FROM layer_localizations WHERE locale = ? AND layer_id IN (
        SELECT l.id FROM layers l JOIN screens s ON s.id = l.screen_id WHERE s.project_id = ?
      )`).run(code, projectId);
      this.db.prepare(`DELETE FROM screen_assets WHERE locale = ? AND screen_id IN (
        SELECT id FROM screens WHERE project_id = ?
      )`).run(code, projectId);
    });
    this.touchProject(projectId);
    return this.getProject(projectId).locales;
  }

  createScreen({ projectId, name = 'New screen', layout = {}, assetId, locale } = {}) {
    this.getProject(projectId);
    const id = createId('screen');
    const timestamp = nowIso();
    const sortOrder = Number(this.db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS value FROM screens WHERE project_id = ?').get(projectId).value);
    const normalizedLayout = merge(DEFAULT_LAYOUT, layout);
    this.db.prepare(`INSERT INTO screens (id, project_id, name, sort_order, layout_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, projectId, String(name).slice(0, 140), sortOrder, json(normalizedLayout), timestamp, timestamp);
    if (assetId) this.assignScreenAsset(id, locale || this.defaultLocale(projectId), assetId);
    this.touchProject(projectId);
    return this.getProject(projectId).screens.find((screen) => screen.id === id);
  }

  updateScreen(screenId, patch = {}) {
    const current = this.screenRow(screenId);
    const layout = patch.layout ? merge(parseJson(current.layout_json, DEFAULT_LAYOUT), patch.layout) : parseJson(current.layout_json, DEFAULT_LAYOUT);
    if (patch.layout?.background) layout.background = merge(parseJson(current.layout_json, DEFAULT_LAYOUT).background || {}, patch.layout.background);
    if (patch.layout?.device) layout.device = merge(parseJson(current.layout_json, DEFAULT_LAYOUT).device || {}, patch.layout.device);
    this.db.prepare('UPDATE screens SET name = ?, sort_order = ?, layout_json = ?, updated_at = ? WHERE id = ?').run(
      patch.name !== undefined ? String(patch.name).slice(0, 140) : current.name,
      patch.sortOrder !== undefined ? Number(patch.sortOrder) : current.sort_order,
      json(layout), nowIso(), screenId,
    );
    this.touchProject(current.project_id);
    return this.getProject(current.project_id).screens.find((screen) => screen.id === screenId);
  }

  deleteScreen(screenId) {
    const current = this.screenRow(screenId);
    this.db.prepare('DELETE FROM screens WHERE id = ?').run(screenId);
    this.compactScreenOrder(current.project_id);
    this.touchProject(current.project_id);
    return { success: true, screenId };
  }

  reorderScreens(projectId, screenIds = []) {
    const existing = new Set(this.db.prepare('SELECT id FROM screens WHERE project_id = ?').all(projectId).map((row) => row.id));
    if (screenIds.length !== existing.size || screenIds.some((id) => !existing.has(id))) throw new Error('Screen order must include every project screen exactly once.');
    this.transaction(() => screenIds.forEach((id, index) => this.db.prepare('UPDATE screens SET sort_order = ? WHERE id = ?').run(index, id)));
    this.touchProject(projectId);
    return this.getProject(projectId).screens;
  }

  applyLayoutToAll(screenId) {
    const source = this.screenRow(screenId);
    const timestamp = nowIso();
    this.db.prepare('UPDATE screens SET layout_json = ?, updated_at = ? WHERE project_id = ?').run(source.layout_json, timestamp, source.project_id);
    this.touchProject(source.project_id);
    return this.getProject(source.project_id).screens;
  }

  createLayer({ screenId, type = 'text', name, props = {}, localizations = {} } = {}) {
    const screen = this.screenRow(screenId);
    if (!['text', 'image', 'shape', 'emoji'].includes(type)) throw new Error(`Unsupported layer type: ${type}`);
    const id = createId('layer');
    const timestamp = nowIso();
    const zIndex = Number(this.db.prepare('SELECT COALESCE(MAX(z_index), -1) + 1 AS value FROM layers WHERE screen_id = ?').get(screenId).value);
    this.transaction(() => {
      this.db.prepare(`INSERT INTO layers (id, screen_id, type, name, z_index, visible, locked, props_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?, ?)`).run(
        id, screenId, type, String(name || ({ text: 'Text', image: 'Image', shape: 'Shape', emoji: 'Emoji' })[type]), zIndex,
        json(merge(DEFAULT_LAYER_PROPS[type] || {}, props)), timestamp, timestamp,
      );
      this.upsertLocalizations(id, localizations);
    });
    this.touchProject(screen.project_id);
    return this.getLayer(id);
  }

  getLayer(layerId) {
    const row = this.db.prepare('SELECT * FROM layers WHERE id = ?').get(layerId);
    if (!row) throw new Error(`Layer not found: ${layerId}`);
    const localizations = Object.fromEntries(this.db.prepare('SELECT locale, content_json FROM layer_localizations WHERE layer_id = ?').all(layerId)
      .map((entry) => [entry.locale, parseJson(entry.content_json, {})]));
    return {
      id: row.id, screenId: row.screen_id, type: row.type, name: row.name, zIndex: row.z_index,
      visible: Boolean(row.visible), locked: Boolean(row.locked), props: merge(DEFAULT_LAYER_PROPS[row.type] || {}, parseJson(row.props_json, {})), localizations,
    };
  }

  updateLayer(layerId, patch = {}) {
    const row = this.db.prepare(`SELECT l.*, s.project_id FROM layers l JOIN screens s ON s.id = l.screen_id WHERE l.id = ?`).get(layerId);
    if (!row) throw new Error(`Layer not found: ${layerId}`);
    const props = patch.props ? merge(parseJson(row.props_json, {}), patch.props) : parseJson(row.props_json, {});
    this.transaction(() => {
      this.db.prepare(`UPDATE layers SET name = ?, z_index = ?, visible = ?, locked = ?, props_json = ?, updated_at = ? WHERE id = ?`).run(
        patch.name !== undefined ? String(patch.name).slice(0, 140) : row.name,
        patch.zIndex !== undefined ? Number(patch.zIndex) : row.z_index,
        patch.visible !== undefined ? Number(Boolean(patch.visible)) : row.visible,
        patch.locked !== undefined ? Number(Boolean(patch.locked)) : row.locked,
        json(props), nowIso(), layerId,
      );
      if (patch.localizations) this.upsertLocalizations(layerId, patch.localizations);
    });
    this.touchProject(row.project_id);
    return this.getLayer(layerId);
  }

  deleteLayer(layerId) {
    const row = this.db.prepare(`SELECT l.screen_id, s.project_id FROM layers l JOIN screens s ON s.id = l.screen_id WHERE l.id = ?`).get(layerId);
    if (!row) return { success: true, layerId };
    this.db.prepare('DELETE FROM layers WHERE id = ?').run(layerId);
    this.compactLayerOrder(row.screen_id);
    this.touchProject(row.project_id);
    return { success: true, layerId };
  }

  reorderLayers(screenId, layerIds = []) {
    const screen = this.screenRow(screenId);
    const existing = new Set(this.db.prepare('SELECT id FROM layers WHERE screen_id = ?').all(screenId).map((row) => row.id));
    if (layerIds.length !== existing.size || layerIds.some((id) => !existing.has(id))) throw new Error('Layer order must include every screen layer exactly once.');
    this.transaction(() => layerIds.forEach((id, index) => this.db.prepare('UPDATE layers SET z_index = ? WHERE id = ?').run(index, id)));
    this.touchProject(screen.project_id);
    return this.getProject(screen.project_id).screens.find((item) => item.id === screenId).layers;
  }

  importAsset({ projectId, filePath, dataUrl, name, kind = 'screenshot', mime, width, height } = {}) {
    this.getProject(projectId);
    let buffer;
    let detectedMime = mime;
    let originalName = name;
    if (filePath) {
      const resolved = path.resolve(filePath);
      buffer = fs.readFileSync(resolved);
      originalName ||= path.basename(resolved);
      detectedMime ||= imageMimeFromName(resolved);
    } else {
      const decoded = decodeDataUrl(dataUrl);
      buffer = decoded.buffer;
      detectedMime ||= decoded.mime;
      originalName ||= `asset${extensionForMime(detectedMime)}`;
    }
    if (!detectedMime?.startsWith('image/')) throw new Error('Only image assets are supported.');
    if (!buffer.length || buffer.length > 80 * 1024 * 1024) throw new Error('Asset must be between 1 byte and 80 MB.');

    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const ext = extensionForMime(detectedMime, originalName);
    const relativePath = path.join('assets', `${hash}${ext}`);
    const target = path.join(this.paths.dataDir, relativePath);
    if (!fs.existsSync(target)) fs.writeFileSync(target, buffer, { flag: 'wx' });
    const existing = this.db.prepare('SELECT * FROM assets WHERE project_id = ? AND hash = ?').get(projectId, hash);
    if (existing) return this.assetResponse(existing);

    const id = createId('asset');
    this.db.prepare(`INSERT INTO assets (id, project_id, kind, name, mime, relative_path, hash, width, height, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, projectId, String(kind).slice(0, 40), safeFilename(originalName, 'asset'), detectedMime, relativePath, hash,
      width ? Number(width) : null, height ? Number(height) : null, nowIso(),
    );
    this.touchProject(projectId);
    return this.getAsset(id);
  }

  getAsset(assetId) {
    const row = this.db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId);
    if (!row) throw new Error(`Asset not found: ${assetId}`);
    return this.assetResponse(row);
  }

  assetResponse(row) {
    return {
      id: row.id, projectId: row.project_id, kind: row.kind, name: row.name, mime: row.mime,
      hash: row.hash, width: row.width, height: row.height, path: path.join(this.paths.dataDir, row.relative_path),
      url: `/api/assets/${row.id}`,
    };
  }

  assignScreenAsset(screenId, locale, assetId) {
    const screen = this.screenRow(screenId);
    const code = normalizeLocale(locale || this.defaultLocale(screen.project_id));
    const asset = this.getAsset(assetId);
    if (asset.projectId !== screen.project_id) throw new Error('Asset and screen must belong to the same project.');
    this.db.prepare(`INSERT INTO screen_assets (screen_id, locale, asset_id) VALUES (?, ?, ?)
      ON CONFLICT(screen_id, locale) DO UPDATE SET asset_id = excluded.asset_id`).run(screenId, code, assetId);
    this.touchProject(screen.project_id);
    return { screenId, locale: code, asset };
  }

  defaultLocale(projectId) {
    return this.db.prepare('SELECT locale FROM project_locales WHERE project_id = ? ORDER BY is_default DESC, sort_order LIMIT 1').get(projectId)?.locale || 'en-US';
  }

  screenRow(screenId) {
    const row = this.db.prepare('SELECT * FROM screens WHERE id = ?').get(screenId);
    if (!row) throw new Error(`Screen not found: ${screenId}`);
    return row;
  }

  upsertLocalizations(layerId, localizations = {}) {
    const statement = this.db.prepare(`INSERT INTO layer_localizations (layer_id, locale, content_json) VALUES (?, ?, ?)
      ON CONFLICT(layer_id, locale) DO UPDATE SET content_json = excluded.content_json`);
    for (const [locale, content] of Object.entries(localizations)) {
      statement.run(layerId, normalizeLocale(locale), json(content));
    }
  }

  compactScreenOrder(projectId) {
    this.db.prepare('SELECT id FROM screens WHERE project_id = ? ORDER BY sort_order, created_at').all(projectId)
      .forEach((row, index) => this.db.prepare('UPDATE screens SET sort_order = ? WHERE id = ?').run(index, row.id));
  }

  compactLayerOrder(screenId) {
    this.db.prepare('SELECT id FROM layers WHERE screen_id = ? ORDER BY z_index, created_at').all(screenId)
      .forEach((row, index) => this.db.prepare('UPDATE layers SET z_index = ? WHERE id = ?').run(index, row.id));
  }

  touchProject(projectId) {
    this.db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(nowIso(), projectId);
  }
}

export { DEFAULT_LAYOUT, DEFAULT_SETTINGS, normalizeLocale };
