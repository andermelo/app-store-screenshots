import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ShowAppStore } from '../src/core/store.mjs';
import { ProjectExporter } from '../src/core/exporter.mjs';

test('strict export reports missing locale content before launching Chrome', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'showapp-export-'));
  const store = new ShowAppStore({ dataDir });
  try {
    const project = store.createProject({ name: 'Coverage', seed: false });
    store.addLocale(project.id, 'pt-BR', 'Português');
    const screen = store.createScreen({ projectId: project.id, name: 'Hero' });
    store.createLayer({ screenId: screen.id, type: 'text', localizations: { 'en-US': { text: 'Complete' } } });
    const exporter = new ProjectExporter({ store, server: { url: 'http://127.0.0.1:1/' } });
    await assert.rejects(
      () => exporter.exportProject({ projectId: project.id, locales: 'all', strictLocalization: true }),
      /1 localized layer value\(s\) are missing/,
    );
  } finally {
    store.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
