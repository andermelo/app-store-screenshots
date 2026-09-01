import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ShowAppStore } from '../src/core/store.mjs';
import { StudioServer } from '../src/core/http-server.mjs';

test('serves the studio and project API from localhost', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'showapp-http-'));
  const store = new ShowAppStore({ dataDir });
  const server = new StudioServer({ store, port: 0 });
  try {
    await server.start();
    const health = await fetch(`${server.url}api/health`).then((response) => response.json());
    assert.equal(health.ok, true);
    const created = await fetch(`${server.url}api/projects`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'API project', seed: false }),
    }).then((response) => response.json());
    assert.equal(created.project.name, 'API project');
    const html = await fetch(server.url).then((response) => response.text());
    assert.match(html, /ShowApp Studio/);
  } finally {
    await server.stop();
    store.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
