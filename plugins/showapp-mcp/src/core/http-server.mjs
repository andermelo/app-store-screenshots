import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { DEFAULT_PORT, safeFilename, studioUrl } from './config.mjs';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = [path.resolve(moduleDir, '../web'), path.resolve(moduleDir, '../../web')]
  .find((candidate) => fs.existsSync(path.join(candidate, 'index.html')))
  || path.resolve(moduleDir, '../../web');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.zip': 'application/zip',
};

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  response.end(body);
}

function sendError(response, error, status = 400) {
  sendJson(response, status, { error: error?.message || String(error) });
}

function readJson(request, maxBytes = 90 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Request body is too large.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });
    request.on('error', reject);
  });
}

function serveFile(response, filePath, { downloadName } = {}) {
  const stat = fs.statSync(filePath);
  const headers = {
    'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': filePath.startsWith(webRoot) ? 'no-cache' : 'private, max-age=31536000, immutable',
  };
  if (downloadName) headers['Content-Disposition'] = `attachment; filename="${safeFilename(downloadName)}"`;
  response.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(response);
}

function openExternal(url) {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.unref();
}

export class StudioServer {
  constructor({ store, port = DEFAULT_PORT, host = '127.0.0.1' }) {
    this.store = store;
    this.port = port;
    this.host = host;
    this.server = null;
    this.clients = new Set();
    this.exporter = null;
    this.captureBrowser = null;
  }

  get url() {
    return studioUrl({ port: this.port });
  }

  async start() {
    if (this.server?.listening) return this;
    this.server = http.createServer((request, response) => this.handle(request, response));
    await new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.port, this.host, () => {
        this.server.off('error', reject);
        const address = this.server.address();
        if (typeof address === 'object' && address) this.port = address.port;
        resolve();
      });
    });
    return this;
  }

  async stop() {
    for (const client of this.clients) client.end();
    this.clients.clear();
    await this.exporter?.close();
    await this.captureBrowser?.close();
    if (!this.server?.listening) return;
    await new Promise((resolve) => this.server.close(resolve));
  }

  open(projectId, mode = 'focus') {
    const url = studioUrl({ port: this.port, projectId, mode });
    openExternal(url);
    return url;
  }

  broadcast(event, payload = {}) {
    const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.clients) client.write(message);
  }

  async handle(request, response) {
    const url = new URL(request.url, this.url);
    try {
      if (url.pathname === '/api/events' && request.method === 'GET') {
        response.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        response.write(`event: connected\ndata: {}\n\n`);
        this.clients.add(response);
        request.on('close', () => this.clients.delete(response));
        return;
      }

      if (url.pathname === '/api/health' && request.method === 'GET') {
        return sendJson(response, 200, { ok: true, product: 'ShowApp MCP', version: '0.1.0' });
      }

      if (url.pathname === '/api/projects' && request.method === 'GET') {
        return sendJson(response, 200, { projects: this.store.listProjects() });
      }
      if (url.pathname === '/api/projects' && request.method === 'POST') {
        const project = this.store.createProject(await readJson(request));
        this.broadcast('project-changed', { projectId: project.id });
        return sendJson(response, 201, { project });
      }

      let match = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
      if (match && request.method === 'GET') return sendJson(response, 200, { project: this.store.getProject(match[1]) });
      if (match && request.method === 'PATCH') {
        const project = this.store.updateProject(match[1], await readJson(request));
        this.broadcast('project-changed', { projectId: project.id });
        return sendJson(response, 200, { project });
      }
      if (match && request.method === 'DELETE') {
        const result = this.store.deleteProject(match[1]);
        this.broadcast('project-deleted', result);
        return sendJson(response, 200, result);
      }

      match = url.pathname.match(/^\/api\/projects\/([^/]+)\/locales$/);
      if (match && request.method === 'POST') {
        const body = await readJson(request);
        const locales = this.store.addLocale(match[1], body.locale, body.label);
        this.broadcast('project-changed', { projectId: match[1] });
        return sendJson(response, 201, { locales });
      }
      match = url.pathname.match(/^\/api\/projects\/([^/]+)\/locales\/bulk$/);
      if (match && request.method === 'POST') {
        const body = await readJson(request);
        if (!Array.isArray(body.locales) || body.locales.length < 1 || body.locales.length > 500) {
          throw new Error('Provide between 1 and 500 locales.');
        }
        let locales;
        for (const entry of body.locales) locales = this.store.addLocale(match[1], entry.locale, entry.label);
        this.broadcast('project-changed', { projectId: match[1] });
        return sendJson(response, 201, { locales });
      }
      match = url.pathname.match(/^\/api\/projects\/([^/]+)\/locales\/([^/]+)$/);
      if (match && request.method === 'DELETE') {
        const locales = this.store.removeLocale(match[1], decodeURIComponent(match[2]));
        this.broadcast('project-changed', { projectId: match[1] });
        return sendJson(response, 200, { locales });
      }

      match = url.pathname.match(/^\/api\/projects\/([^/]+)\/screens$/);
      if (match && request.method === 'POST') {
        const screen = this.store.createScreen({ ...(await readJson(request)), projectId: match[1] });
        this.broadcast('project-changed', { projectId: match[1] });
        return sendJson(response, 201, { screen });
      }
      match = url.pathname.match(/^\/api\/projects\/([^/]+)\/screens\/order$/);
      if (match && request.method === 'PUT') {
        const body = await readJson(request);
        const screens = this.store.reorderScreens(match[1], body.screenIds);
        this.broadcast('project-changed', { projectId: match[1] });
        return sendJson(response, 200, { screens });
      }

      match = url.pathname.match(/^\/api\/screens\/([^/]+)$/);
      if (match && request.method === 'PATCH') {
        const screen = this.store.updateScreen(match[1], await readJson(request));
        this.broadcast('project-changed', { projectId: screen.projectId });
        return sendJson(response, 200, { screen });
      }
      if (match && request.method === 'DELETE') {
        const screen = this.store.screenRow(match[1]);
        const result = this.store.deleteScreen(match[1]);
        this.broadcast('project-changed', { projectId: screen.project_id });
        return sendJson(response, 200, result);
      }
      match = url.pathname.match(/^\/api\/screens\/([^/]+)\/apply-layout$/);
      if (match && request.method === 'POST') {
        const screen = this.store.screenRow(match[1]);
        const screens = this.store.applyLayoutToAll(match[1]);
        this.broadcast('project-changed', { projectId: screen.project_id });
        return sendJson(response, 200, { success: true, screens });
      }

      match = url.pathname.match(/^\/api\/screens\/([^/]+)\/layers$/);
      if (match && request.method === 'POST') {
        const layer = this.store.createLayer({ ...(await readJson(request)), screenId: match[1] });
        const screen = this.store.screenRow(match[1]);
        this.broadcast('project-changed', { projectId: screen.project_id });
        return sendJson(response, 201, { layer });
      }
      match = url.pathname.match(/^\/api\/screens\/([^/]+)\/layers\/order$/);
      if (match && request.method === 'PUT') {
        const body = await readJson(request);
        const layers = this.store.reorderLayers(match[1], body.layerIds);
        const screen = this.store.screenRow(match[1]);
        this.broadcast('project-changed', { projectId: screen.project_id });
        return sendJson(response, 200, { layers });
      }
      match = url.pathname.match(/^\/api\/screens\/([^/]+)\/asset$/);
      if (match && request.method === 'PUT') {
        const body = await readJson(request);
        const assignment = this.store.assignScreenAsset(match[1], body.locale, body.assetId);
        const screen = this.store.screenRow(match[1]);
        this.broadcast('project-changed', { projectId: screen.project_id });
        return sendJson(response, 200, assignment);
      }

      match = url.pathname.match(/^\/api\/layers\/([^/]+)$/);
      if (match && request.method === 'PATCH') {
        const layer = this.store.updateLayer(match[1], await readJson(request));
        const screen = this.store.screenRow(layer.screenId);
        this.broadcast('project-changed', { projectId: screen.project_id });
        return sendJson(response, 200, { layer });
      }
      if (match && request.method === 'DELETE') {
        const layer = this.store.getLayer(match[1]);
        const screen = this.store.screenRow(layer.screenId);
        const result = this.store.deleteLayer(match[1]);
        this.broadcast('project-changed', { projectId: screen.project_id });
        return sendJson(response, 200, result);
      }

      if (url.pathname === '/api/assets' && request.method === 'POST') {
        const asset = this.store.importAsset(await readJson(request));
        this.broadcast('project-changed', { projectId: asset.projectId });
        return sendJson(response, 201, { asset });
      }

      if (url.pathname === '/api/capture' && request.method === 'POST') {
        const body = await readJson(request);
        const { AgentBrowser } = await import('./chrome.mjs');
        this.captureBrowser ||= new AgentBrowser({ store: this.store });
        await this.captureBrowser.open({
          url: body.url,
          width: body.width,
          height: body.height,
          visible: body.visible !== false,
        });
        await this.captureBrowser.wait({ milliseconds: 900 });
        const result = await this.captureBrowser.capture({
          projectId: body.projectId,
          name: body.name,
          locale: body.locale,
          fullPage: body.fullPage,
          frame: body.frame || 'iphone',
        });
        await this.captureBrowser.close();
        this.broadcast('project-changed', { projectId: body.projectId });
        return sendJson(response, 201, result);
      }
      match = url.pathname.match(/^\/api\/assets\/([^/]+)$/);
      if (match && request.method === 'GET') {
        const asset = this.store.getAsset(match[1]);
        return serveFile(response, asset.path);
      }

      match = url.pathname.match(/^\/api\/projects\/([^/]+)\/export$/);
      if (match && request.method === 'POST') {
        const body = await readJson(request);
        if (!this.exporter) {
          const { ProjectExporter } = await import('./exporter.mjs');
          this.exporter = new ProjectExporter({ store: this.store, server: this });
        }
        const result = await this.exporter.exportProject({ projectId: match[1], ...body });
        return sendJson(response, 200, result);
      }
      match = url.pathname.match(/^\/api\/exports\/([^/]+)$/);
      if (match && request.method === 'GET') {
        const filename = safeFilename(match[1], 'showapp-export.zip');
        const filePath = path.join(this.store.paths.exportsDir, filename);
        if (!fs.existsSync(filePath)) return sendError(response, new Error('Export not found.'), 404);
        return serveFile(response, filePath, { downloadName: filename });
      }

      if (request.method === 'GET' || request.method === 'HEAD') {
        const requested = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
        const filePath = path.resolve(webRoot, requested);
        if (!filePath.startsWith(`${webRoot}${path.sep}`) && filePath !== path.join(webRoot, 'index.html')) {
          return sendError(response, new Error('Not found.'), 404);
        }
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return serveFile(response, filePath);
      }

      return sendError(response, new Error('Not found.'), 404);
    } catch (error) {
      const status = /not found/i.test(error.message) ? 404 : 400;
      return sendError(response, error, status);
    }
  }
}

export { openExternal };
