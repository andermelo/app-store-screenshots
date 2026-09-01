#!/usr/bin/env node
import process from 'node:process';
import { ShowAppStore } from '../src/core/store.mjs';
import { StudioServer } from '../src/core/http-server.mjs';
import { AgentBrowser, findChromeExecutable } from '../src/core/chrome.mjs';
import { DEFAULT_PORT } from '../src/core/config.mjs';

function flags(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) result._.push(token);
    else {
      const key = token.slice(2).replaceAll('-', '_');
      const next = argv[index + 1];
      if (next && !next.startsWith('--')) {
        result[key] = next;
        index += 1;
      } else result[key] = true;
    }
  }
  return result;
}

function help() {
  console.log(`ShowApp MCP — local App Store screenshot studio

Usage:
  showapp studio [project-id] [--port 43123] [--no-open]
  showapp create <name> [--locale en-US]
  showapp capture --project <id> --url <url> [--name Home] [--locale en-US]
  showapp export --project <id> [--locales all] [--out ./out]
  showapp doctor
  showapp mcp
`);
}

async function main() {
  const [command = 'studio', ...rest] = process.argv.slice(2);
  const args = flags(rest);

  if (command === 'help' || args.help) return help();
  if (command === 'mcp') {
    const { startMcpServer } = await import('../src/mcp/server.mjs');
    await startMcpServer();
    return;
  }

  const store = new ShowAppStore();
  if (command === 'doctor') {
    const chrome = findChromeExecutable();
    const probe = store.createProject({ name: 'Doctor probe', seed: false });
    store.deleteProject(probe.id);
    console.log(JSON.stringify({
      ok: Boolean(chrome),
      node: process.version,
      sqlite: true,
      chrome: chrome || null,
      dataDir: store.paths.dataDir,
      message: chrome ? 'ShowApp is ready.' : 'SQLite is ready, but Chrome was not found.',
    }, null, 2));
    store.close();
    process.exitCode = chrome ? 0 : 1;
    return;
  }

  if (command === 'create') {
    const name = args._.join(' ') || 'Untitled App';
    const project = store.createProject({ name, defaultLocale: args.locale || 'en-US' });
    console.log(JSON.stringify(project, null, 2));
    store.close();
    return;
  }

  const port = Number(args.port) || Number(process.env.SHOWAPP_PORT) || DEFAULT_PORT;
  if (command === 'studio') {
    const studio = new StudioServer({ store, port });
    await studio.start();
    const projectId = args._[0];
    const url = args.no_open ? studio.url : studio.open(projectId, 'focus');
    console.log(`ShowApp Studio: ${url}`);
    const close = async () => {
      await studio.stop();
      store.close();
      process.exit(0);
    };
    process.once('SIGINT', close);
    process.once('SIGTERM', close);
    return;
  }

  if (command === 'capture') {
    if (!args.project || !args.url) throw new Error('capture requires --project and --url.');
    const browser = new AgentBrowser({ store });
    await browser.open({ url: args.url, width: Number(args.width) || 430, height: Number(args.height) || 932, visible: !args.headless });
    if (args.wait) await browser.wait({ milliseconds: Number(args.wait) });
    const result = await browser.capture({ projectId: args.project, name: args.name || 'Captured screen', locale: args.locale, fullPage: Boolean(args.full_page), frame: args.frame || 'iphone' });
    console.log(JSON.stringify(result, null, 2));
    await browser.close();
    store.close();
    return;
  }

  if (command === 'export') {
    if (!args.project) throw new Error('export requires --project.');
    const studio = new StudioServer({ store, port: 0 });
    await studio.start();
    const { ProjectExporter } = await import('../src/core/exporter.mjs');
    const exporter = new ProjectExporter({ store, server: studio });
    const localeOption = args.locales && args.locales !== 'all' ? args.locales.split(',') : 'all';
    const result = await exporter.exportProject({ projectId: args.project, locales: localeOption, outputDir: args.out, zip: true });
    console.log(JSON.stringify(result, null, 2));
    await exporter.close();
    await studio.stop();
    store.close();
    return;
  }

  store.close();
  help();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(`ShowApp error: ${error.message}`);
  process.exitCode = 1;
});
