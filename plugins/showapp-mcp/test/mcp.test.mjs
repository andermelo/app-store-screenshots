import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('exposes protocol-clean tools over MCP stdio', async () => {
  const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'showapp-mcp-'));
  const client = new Client({ name: 'showapp-test-client', version: '0.1.0' });
  const transport = new StdioClientTransport({
    command: 'sh',
    args: ['-c', 'exec node "${CLAUDE_PLUGIN_ROOT:-.}/dist/showapp.mjs" mcp'],
    cwd: pluginRoot,
    env: { ...process.env, SHOWAPP_DATA_DIR: dataDir, NODE_NO_WARNINGS: '1' },
  });
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    const names = new Set(listed.tools.map((tool) => tool.name));
    assert.ok(names.has('showapp.project_create'));
    assert.ok(names.has('showapp.browser_capture'));
    assert.ok(names.has('showapp.layer_localize_many'));
    assert.ok(names.has('showapp.export'));
    const result = await client.callTool({ name: 'showapp.project_create', arguments: { name: 'MCP project', seed: false } });
    assert.match(result.content[0].text, /MCP project/);
  } finally {
    await client.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
