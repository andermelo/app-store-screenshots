import fs from 'node:fs';
import path from 'node:path';
import { launchChrome } from './chrome.mjs';
import { safeFilename } from './config.mjs';
import { writeStoredZip } from './zip.mjs';

export class ProjectExporter {
  constructor({ store, server }) {
    this.store = store;
    this.server = server;
    this.browser = null;
  }

  async ensureBrowser() {
    if (!this.browser?.connected) this.browser = await launchChrome({ headless: true });
    return this.browser;
  }

  async exportProject({ projectId, locales = 'all', screenIds, outputDir, zip = true, concurrency = 4, strictLocalization = false } = {}) {
    const project = this.store.getProject(projectId);
    const selectedLocales = locales === 'all' || locales == null
      ? project.locales.map((item) => item.locale)
      : (Array.isArray(locales) ? locales : [locales]);
    const selectedScreens = Array.isArray(screenIds) && screenIds.length
      ? project.screens.filter((screen) => screenIds.includes(screen.id))
      : project.screens;
    if (!selectedScreens.length) throw new Error('The project has no screens to export.');
    if (!selectedLocales.length) throw new Error('The project has no locales to export.');

    const localizationWarnings = [];
    for (const locale of selectedLocales) {
      for (const screen of selectedScreens) {
        for (const layer of screen.layers.filter((item) => ['text', 'emoji'].includes(item.type))) {
          if (!layer.localizations?.[locale]?.text) localizationWarnings.push({ locale, screenId: screen.id, layerId: layer.id, kind: 'text' });
        }
      }
    }
    if (strictLocalization && localizationWarnings.length) {
      throw new Error(`Export blocked: ${localizationWarnings.length} localized layer value(s) are missing.`);
    }

    const folderName = `${safeFilename(project.name, 'showapp')}-${Date.now()}`;
    const root = outputDir ? path.resolve(outputDir) : path.join(this.store.paths.exportsDir, folderName);
    fs.mkdirSync(root, { recursive: true });
    const browser = await this.ensureBrowser();
    const exported = [];
    const tasks = selectedLocales.flatMap((locale) => selectedScreens.map((screen, index) => ({ locale, screen, index })));
    const workerCount = Math.max(1, Math.min(6, Number(concurrency) || 4, tasks.length));
    let cursor = 0;

    await Promise.all(Array.from({ length: workerCount }, async () => {
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: project.width, height: project.height, deviceScaleFactor: 1 });
        while (cursor < tasks.length) {
          const taskIndex = cursor++;
          const { locale, screen, index } = tasks[taskIndex];
          const localeDir = path.join(root, safeFilename(locale, 'locale'));
          fs.mkdirSync(localeDir, { recursive: true });
          const url = new URL(this.server.url);
          url.searchParams.set('render', '1');
          url.searchParams.set('project', projectId);
          url.searchParams.set('screen', screen.id);
          url.searchParams.set('locale', locale);
          await page.goto(url.toString(), { waitUntil: 'networkidle0', timeout: 60_000 });
          await page.waitForFunction(() => window.__SHOWAPP_RENDER_READY === true, { timeout: 30_000 });
          const artboard = await page.$('.render-artboard');
          if (!artboard) throw new Error(`Render surface was not created for screen ${screen.id}.`);
          const filename = `${String(index + 1).padStart(2, '0')}-${safeFilename(screen.name, 'screen')}.png`;
          const filePath = path.join(localeDir, filename);
          await artboard.screenshot({ path: filePath, type: 'png', omitBackground: false });
          exported.push({ order: taskIndex, locale, screenId: screen.id, filePath, name: `${safeFilename(locale)}/${filename}` });
        }
      } finally {
        await page.close();
      }
    }));
    exported.sort((a, b) => a.order - b.order).forEach((item) => delete item.order);

    let archivePath = null;
    if (zip) {
      archivePath = path.join(this.store.paths.exportsDir, `${folderName}.zip`);
      writeStoredZip(exported.map((item) => ({ name: item.name, path: item.filePath })), archivePath);
    }
    return {
      success: true,
      outputDir: root,
      count: exported.length,
      locales: selectedLocales,
      files: exported,
      localizationWarnings,
      localizationComplete: localizationWarnings.length === 0,
      archivePath,
      downloadUrl: archivePath ? `/api/exports/${path.basename(archivePath)}` : null,
    };
  }

  async close() {
    await this.browser?.close();
    this.browser = null;
  }
}
