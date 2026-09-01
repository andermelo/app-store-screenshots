import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ShowAppStore } from '../src/core/store.mjs';

function fixture() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'showapp-test-'));
  const store = new ShowAppStore({ dataDir });
  return {
    store,
    dataDir,
    cleanup() {
      store.close();
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

test('persists editable screens, layers, and localized content', () => {
  const scope = fixture();
  try {
    const project = scope.store.createProject({ name: 'Localized app', seed: false });
    scope.store.addLocale(project.id, 'pt-BR', 'Português');
    scope.store.addLocale(project.id, 'ja-JP', '日本語');
    const screen = scope.store.createScreen({ projectId: project.id, name: 'Hero' });
    const layer = scope.store.createLayer({
      screenId: screen.id,
      type: 'text',
      props: { x: 48, fontSize: 110 },
      localizations: {
        'en-US': { text: 'Ship beautifully.' },
        'pt-BR': { text: 'Publique com beleza.' },
        'ja-JP': { text: '美しく公開。' },
      },
    });
    scope.store.updateLayer(layer.id, { props: { y: 18, color: '#112233' } });
    const restored = scope.store.getProject(project.id);
    assert.equal(restored.screens[0].layers[0].localizations['pt-BR'].text, 'Publique com beleza.');
    assert.equal(restored.screens[0].layers[0].props.x, 48);
    assert.equal(restored.screens[0].layers[0].props.y, 18);
    assert.equal(restored.screens[0].layers[0].props.color, '#112233');
  } finally {
    scope.cleanup();
  }
});

test('supports hundreds of project locales without a product limit', () => {
  const scope = fixture();
  try {
    const project = scope.store.createProject({ name: 'Global app', seed: false });
    for (let index = 0; index < 240; index += 1) {
      scope.store.addLocale(project.id, `en-x-l${String(index).padStart(3, '0')}`, `Locale ${index + 1}`);
    }
    assert.equal(scope.store.getProject(project.id).locales.length, 241);
  } finally {
    scope.cleanup();
  }
});

test('stores image bytes on disk and deduplicates assets by hash', () => {
  const scope = fixture();
  try {
    const project = scope.store.createProject({ name: 'Assets', seed: false });
    const dataUrl = `data:image/png;base64,${Buffer.from('fake-png-fixture').toString('base64')}`;
    const first = scope.store.importAsset({ projectId: project.id, dataUrl, name: 'first.png' });
    const second = scope.store.importAsset({ projectId: project.id, dataUrl, name: 'second.png' });
    assert.equal(first.id, second.id);
    assert.equal(fs.readFileSync(first.path, 'utf8'), 'fake-png-fixture');
    assert.equal(scope.store.db.prepare('SELECT COUNT(*) AS count FROM assets').get().count, 1);
  } finally {
    scope.cleanup();
  }
});

test('keeps shared background settings across every screen', () => {
  const scope = fixture();
  try {
    const project = scope.store.createProject({ name: 'Panorama', seed: false });
    scope.store.createScreen({ projectId: project.id, name: 'One' });
    scope.store.createScreen({ projectId: project.id, name: 'Two' });
    scope.store.updateProject(project.id, { settings: { sharedBackground: { type: 'gradient', colors: ['#ff0000', '#0000ff'], angle: 90 } } });
    const result = scope.store.getProject(project.id);
    assert.deepEqual(result.settings.sharedBackground.colors, ['#ff0000', '#0000ff']);
    assert.ok(result.screens.every((screen) => screen.layout.backgroundMode === 'shared'));
  } finally {
    scope.cleanup();
  }
});

test('applies one composition layout to every screen without replacing layers', () => {
  const scope = fixture();
  try {
    const project = scope.store.createProject({ name: 'Campaign', seed: false });
    const source = scope.store.createScreen({ projectId: project.id, name: 'Source', layout: { device: { frame: 'iphone', tilt: -9, rotateY: 12 } } });
    const target = scope.store.createScreen({ projectId: project.id, name: 'Target' });
    scope.store.createLayer({ screenId: target.id, type: 'text', localizations: { 'en-US': { text: 'Keep me' } } });
    scope.store.applyLayoutToAll(source.id);
    const restored = scope.store.getProject(project.id);
    assert.equal(restored.screens[1].layout.device.tilt, -9);
    assert.equal(restored.screens[1].layout.device.rotateY, 12);
    assert.equal(restored.screens[1].layers[0].localizations['en-US'].text, 'Keep me');
  } finally {
    scope.cleanup();
  }
});
