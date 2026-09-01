import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ShowAppStore } from '../core/store.mjs';
import { StudioServer } from '../core/http-server.mjs';
import { AgentBrowser } from '../core/chrome.mjs';
import { DEFAULT_PORT } from '../core/config.mjs';

const jsonText = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] });
const looseObject = z.record(z.string(), z.unknown());
const localizedRecord = z.record(z.string(), looseObject);

export async function startMcpServer({ dataDir, port = Number(process.env.SHOWAPP_PORT) || DEFAULT_PORT } = {}) {
  const store = new ShowAppStore({ dataDir });
  const studio = new StudioServer({ store, port });
  const browser = new AgentBrowser({ store });
  const mcp = new McpServer({ name: 'showapp-mcp', version: '0.1.0' });
  let studioStarted = false;

  const ensureStudio = async () => {
    if (!studioStarted) {
      await studio.start();
      studioStarted = true;
    }
    return studio;
  };

  const changed = (projectId) => studioStarted && studio.broadcast('project-changed', { projectId });

  mcp.registerTool('showapp.project_list', {
    title: 'List ShowApp projects',
    description: 'List every local ShowApp project with screen and locale counts.',
    inputSchema: {},
  }, async () => jsonText({ projects: store.listProjects() }));

  mcp.registerTool('showapp.project_create', {
    title: 'Create a ShowApp project',
    description: 'Create a local App Store screenshot project. Supports any valid BCP-47 locale.',
    inputSchema: {
      name: z.string().min(1).max(140),
      width: z.number().int().min(320).max(4096).optional(),
      height: z.number().int().min(320).max(4096).optional(),
      default_locale: z.string().optional(),
      locales: z.array(z.object({ locale: z.string(), label: z.string().optional() })).max(500).optional(),
      seed: z.boolean().optional(),
    },
  }, async ({ name, width, height, default_locale, locales = [], seed = false }) => {
    const project = store.createProject({ name, width, height, defaultLocale: default_locale, seed });
    for (const entry of locales) store.addLocale(project.id, entry.locale, entry.label);
    return jsonText({ project: store.getProject(project.id) });
  });

  mcp.registerTool('showapp.project_get', {
    title: 'Inspect a ShowApp project',
    description: 'Return the complete project, screens, layers, assets, and localized content.',
    inputSchema: { project_id: z.string() },
  }, async ({ project_id }) => jsonText({ project: store.getProject(project_id) }));

  mcp.registerTool('showapp.project_update', {
    title: 'Update a ShowApp project',
    description: 'Update project name, dimensions, canvas behavior, or shared background.',
    inputSchema: {
      project_id: z.string(),
      name: z.string().max(140).optional(),
      width: z.number().int().optional(),
      height: z.number().int().optional(),
      settings: looseObject.optional(),
    },
  }, async ({ project_id, ...patch }) => {
    const project = store.updateProject(project_id, patch);
    changed(project_id);
    return jsonText({ project });
  });

  mcp.registerTool('showapp.editor_open', {
    title: 'Open ShowApp Studio',
    description: 'Start the light local studio and open the selected project in the default browser.',
    inputSchema: { project_id: z.string().optional(), mode: z.enum(['focus', 'canvas']).optional() },
  }, async ({ project_id, mode = 'focus' }) => {
    await ensureStudio();
    const url = studio.open(project_id, mode);
    return jsonText({ success: true, url, project_id, mode });
  });

  mcp.registerTool('showapp.locale_add_many', {
    title: 'Add project locales',
    description: 'Add up to 500 BCP-47 locales in one call. There is no product-level language limit.',
    inputSchema: {
      project_id: z.string(),
      locales: z.array(z.object({ locale: z.string(), label: z.string().optional() })).min(1).max(500),
    },
  }, async ({ project_id, locales }) => {
    let result;
    for (const entry of locales) result = store.addLocale(project_id, entry.locale, entry.label);
    changed(project_id);
    return jsonText({ success: true, locales: result });
  });

  mcp.registerTool('showapp.screen_create', {
    title: 'Create a screenshot canvas',
    description: 'Create an editable screenshot. Optionally import and assign a source image for one locale.',
    inputSchema: {
      project_id: z.string(),
      name: z.string().optional(),
      layout: looseObject.optional(),
      image_path: z.string().optional(),
      locale: z.string().optional(),
    },
  }, async ({ project_id, name, layout, image_path, locale }) => {
    let asset;
    if (image_path) asset = store.importAsset({ projectId: project_id, filePath: image_path, kind: 'screenshot' });
    const screen = store.createScreen({ projectId: project_id, name, layout, assetId: asset?.id, locale });
    changed(project_id);
    return jsonText({ screen, asset });
  });

  mcp.registerTool('showapp.screen_update', {
    title: 'Update a screenshot canvas',
    description: 'Update a screen name, background behavior, device frame, position, crop, or layout properties.',
    inputSchema: { screen_id: z.string(), name: z.string().optional(), sort_order: z.number().int().optional(), layout: looseObject.optional() },
  }, async ({ screen_id, sort_order, ...patch }) => {
    const screen = store.updateScreen(screen_id, { ...patch, ...(sort_order !== undefined ? { sortOrder: sort_order } : {}) });
    changed(screen.projectId);
    return jsonText({ screen });
  });

  mcp.registerTool('showapp.screen_delete', {
    title: 'Delete a screenshot canvas',
    description: 'Delete one screenshot canvas and its layers.',
    inputSchema: { screen_id: z.string() },
  }, async ({ screen_id }) => {
    const screen = store.screenRow(screen_id);
    const result = store.deleteScreen(screen_id);
    changed(screen.project_id);
    return jsonText(result);
  });

  mcp.registerTool('showapp.layout_apply_to_all', {
    title: 'Apply one layout to every screen',
    description: 'Copy the selected screen background and device composition to every screen without replacing localized copy or source images.',
    inputSchema: { source_screen_id: z.string() },
  }, async ({ source_screen_id }) => {
    const screen = store.screenRow(source_screen_id);
    const screens = store.applyLayoutToAll(source_screen_id);
    changed(screen.project_id);
    return jsonText({ success: true, screens });
  });

  mcp.registerTool('showapp.asset_import', {
    title: 'Import a ShowApp asset',
    description: 'Import a local image file into the content-addressed project asset library.',
    inputSchema: { project_id: z.string(), file_path: z.string(), name: z.string().optional(), kind: z.string().optional() },
  }, async ({ project_id, file_path, name, kind }) => {
    const asset = store.importAsset({ projectId: project_id, filePath: file_path, name, kind });
    changed(project_id);
    return jsonText({ asset });
  });

  mcp.registerTool('showapp.screen_assets_set_many', {
    title: 'Assign localized screenshot images',
    description: 'Import and assign different source screenshots for many locales in one call.',
    inputSchema: {
      screen_id: z.string(),
      entries: z.array(z.object({ locale: z.string(), file_path: z.string(), name: z.string().optional() })).min(1).max(500),
    },
  }, async ({ screen_id, entries }) => {
    const screen = store.screenRow(screen_id);
    const assigned = [];
    for (const entry of entries) {
      const asset = store.importAsset({ projectId: screen.project_id, filePath: entry.file_path, name: entry.name, kind: 'localized-screenshot' });
      assigned.push(store.assignScreenAsset(screen_id, entry.locale, asset.id));
    }
    changed(screen.project_id);
    return jsonText({ success: true, assigned });
  });

  mcp.registerTool('showapp.layer_create', {
    title: 'Create an editable layer',
    description: 'Create a text, image, shape, or emoji layer with localized content.',
    inputSchema: {
      screen_id: z.string(),
      type: z.enum(['text', 'image', 'shape', 'emoji']),
      name: z.string().optional(),
      props: looseObject.optional(),
      localizations: localizedRecord.optional(),
    },
  }, async ({ screen_id, type, name, props, localizations }) => {
    const layer = store.createLayer({ screenId: screen_id, type, name, props, localizations });
    const screen = store.screenRow(screen_id);
    changed(screen.project_id);
    return jsonText({ layer });
  });

  mcp.registerTool('showapp.layer_update', {
    title: 'Update an editable layer',
    description: 'Update layer geometry, style, visibility, lock state, or localized content.',
    inputSchema: {
      layer_id: z.string(),
      name: z.string().optional(),
      props: looseObject.optional(),
      localizations: localizedRecord.optional(),
      visible: z.boolean().optional(),
      locked: z.boolean().optional(),
      z_index: z.number().int().optional(),
    },
  }, async ({ layer_id, z_index, ...patch }) => {
    const layer = store.updateLayer(layer_id, { ...patch, ...(z_index !== undefined ? { zIndex: z_index } : {}) });
    const screen = store.screenRow(layer.screenId);
    changed(screen.project_id);
    return jsonText({ layer });
  });

  mcp.registerTool('showapp.layer_localize_many', {
    title: 'Apply localized layer content in bulk',
    description: 'Apply thousands of translated text or emoji values efficiently without any AI provider key in ShowApp.',
    inputSchema: {
      entries: z.array(z.object({ layer_id: z.string(), locale: z.string(), content: looseObject })).min(1).max(5000),
    },
  }, async ({ entries }) => {
    const grouped = new Map();
    for (const entry of entries) {
      const localizations = grouped.get(entry.layer_id) || {};
      localizations[entry.locale] = entry.content;
      grouped.set(entry.layer_id, localizations);
    }
    const projects = new Set();
    for (const [layerId, localizations] of grouped) {
      const layer = store.updateLayer(layerId, { localizations });
      projects.add(store.screenRow(layer.screenId).project_id);
    }
    for (const projectId of projects) changed(projectId);
    return jsonText({ success: true, updated_layers: grouped.size, localized_entries: entries.length });
  });

  mcp.registerTool('showapp.layer_delete', {
    title: 'Delete a layer',
    description: 'Delete one layer from a screenshot.',
    inputSchema: { layer_id: z.string() },
  }, async ({ layer_id }) => {
    const layer = store.getLayer(layer_id);
    const screen = store.screenRow(layer.screenId);
    const result = store.deleteLayer(layer_id);
    changed(screen.project_id);
    return jsonText(result);
  });

  mcp.registerTool('showapp.browser_open', {
    title: 'Open a capture session in Chrome',
    description: 'Launch the installed Google Chrome, visibly by default, and navigate to an app or website for agent-driven capture.',
    inputSchema: {
      url: z.string().url(), width: z.number().int().optional(), height: z.number().int().optional(), visible: z.boolean().optional(),
    },
  }, async (args) => jsonText(await browser.open(args)));

  mcp.registerTool('showapp.browser_navigate', {
    title: 'Navigate the capture browser',
    description: 'Navigate the active Chrome capture tab.',
    inputSchema: { url: z.string().url() },
  }, async ({ url }) => jsonText(await browser.navigate(url)));

  mcp.registerTool('showapp.browser_inspect', {
    title: 'Inspect the capture page',
    description: 'Return the current URL, headings, and primary actions so an agent can plan the next interaction.',
    inputSchema: {},
  }, async () => jsonText(await browser.inspect()));

  mcp.registerTool('showapp.browser_click', {
    title: 'Click in the capture browser',
    description: 'Click an element by CSS selector or visible action text.',
    inputSchema: { selector: z.string().optional(), text: z.string().optional() },
  }, async (args) => jsonText(await browser.click(args)));

  mcp.registerTool('showapp.browser_type', {
    title: 'Type in the capture browser',
    description: 'Fill an input or textarea selected by CSS.',
    inputSchema: { selector: z.string(), text: z.string(), clear: z.boolean().optional() },
  }, async (args) => jsonText(await browser.type(args)));

  mcp.registerTool('showapp.browser_press', {
    title: 'Press a browser key',
    description: 'Press Enter, Escape, Tab, ArrowDown, or another Puppeteer-compatible key.',
    inputSchema: { key: z.string() },
  }, async ({ key }) => jsonText(await browser.press(key)));

  mcp.registerTool('showapp.browser_wait', {
    title: 'Wait for browser state',
    description: 'Wait for a selector or a bounded number of milliseconds.',
    inputSchema: { selector: z.string().optional(), milliseconds: z.number().int().min(0).max(30000).optional() },
  }, async (args) => jsonText(await browser.wait(args)));

  mcp.registerTool('showapp.browser_capture', {
    title: 'Capture the current Chrome screen',
    description: 'Take a PNG of the current agent-controlled Chrome state and immediately add it as an editable ShowApp screen.',
    inputSchema: {
      project_id: z.string(), name: z.string().optional(), locale: z.string().optional(), full_page: z.boolean().optional(),
      frame: z.enum(['none', 'iphone', 'ipad', 'android']).optional(),
    },
  }, async ({ project_id, full_page, ...args }) => {
    const result = await browser.capture({ projectId: project_id, fullPage: full_page, ...args });
    changed(project_id);
    return jsonText(result);
  });

  mcp.registerTool('showapp.browser_close', {
    title: 'Close the capture browser',
    description: 'Close the dedicated Chrome capture session.',
    inputSchema: {},
  }, async () => jsonText(await browser.close()));

  mcp.registerTool('showapp.export', {
    title: 'Export App Store screenshots',
    description: 'Render selected or all screens for selected or all locales through installed Chrome and optionally produce a ZIP.',
    inputSchema: {
      project_id: z.string(),
      locales: z.union([z.literal('all'), z.array(z.string()).min(1)]).optional(),
      screen_ids: z.array(z.string()).optional(),
      output_dir: z.string().optional(),
      zip: z.boolean().optional(),
      concurrency: z.number().int().min(1).max(6).optional(),
      strict_localization: z.boolean().optional(),
    },
  }, async ({ project_id, screen_ids, strict_localization, ...args }) => {
    await ensureStudio();
    if (!studio.exporter) {
      const { ProjectExporter } = await import('../core/exporter.mjs');
      studio.exporter = new ProjectExporter({ store, server: studio });
    }
    return jsonText(await studio.exporter.exportProject({ projectId: project_id, screenIds: screen_ids, strictLocalization: strict_localization, ...args }));
  });

  const shutdown = async () => {
    await browser.close().catch(() => {});
    await studio.stop().catch(() => {});
    store.close();
  };
  process.once('SIGINT', () => shutdown().finally(() => process.exit(0)));
  process.once('SIGTERM', () => shutdown().finally(() => process.exit(0)));

  await mcp.connect(new StdioServerTransport());
  return { mcp, store, studio, browser };
}
