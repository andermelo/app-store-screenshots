import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME_CANDIDATES = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ],
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
};

export function findChromeExecutable() {
  const configured = process.env.SHOWAPP_CHROME_PATH?.trim();
  if (configured && fs.existsSync(configured)) return configured;
  return (CHROME_CANDIDATES[process.platform] || []).find((candidate) => fs.existsSync(candidate)) || null;
}

export async function launchChrome({ headless = false, userDataDir, viewport = { width: 430, height: 932 } } = {}) {
  const executablePath = findChromeExecutable();
  if (!executablePath) throw new Error('Google Chrome was not found. Set SHOWAPP_CHROME_PATH to its executable.');
  return puppeteer.launch({
    executablePath,
    headless,
    userDataDir,
    defaultViewport: viewport,
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-features=Translate,MediaRouter',
      ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
    ],
  });
}

export class AgentBrowser {
  constructor({ store }) {
    this.store = store;
    this.browser = null;
    this.page = null;
    this.viewport = { width: 430, height: 932 };
  }

  async open({ url, width = 430, height = 932, visible = true } = {}) {
    if (!/^https?:\/\//i.test(String(url || ''))) throw new Error('Capture URL must start with http:// or https://.');
    this.viewport = {
      width: Math.max(240, Math.min(2560, Number(width) || 430)),
      height: Math.max(320, Math.min(4096, Number(height) || 932)),
    };
    if (!this.browser?.connected) {
      this.browser = await launchChrome({ headless: !visible, userDataDir: this.store.paths.browserDir, viewport: this.viewport });
    }
    this.page = (await this.browser.pages()).find((page) => page.url() === 'about:blank') || await this.browser.newPage();
    await this.page.setViewport(this.viewport);
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    return this.status();
  }

  async navigate(url) {
    this.requirePage();
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    return this.status();
  }

  async click({ selector, text } = {}) {
    this.requirePage();
    if (selector) {
      await this.page.locator(selector).setTimeout(15_000).click();
    } else if (text) {
      const handle = await this.page.evaluateHandle((needle) => {
        const elements = [...document.querySelectorAll('button, a, [role="button"], input[type="submit"]')];
        return elements.find((element) => element.textContent?.trim().includes(needle)) || null;
      }, text);
      const element = handle.asElement();
      if (!element) throw new Error(`Clickable text not found: ${text}`);
      await element.click();
      await handle.dispose();
    } else {
      throw new Error('Provide selector or text.');
    }
    return this.status();
  }

  async type({ selector, text, clear = true } = {}) {
    this.requirePage();
    if (!selector) throw new Error('A selector is required.');
    const locator = this.page.locator(selector).setTimeout(15_000);
    if (clear) await locator.fill('');
    await locator.fill(String(text ?? ''));
    return this.status();
  }

  async press(key) {
    this.requirePage();
    await this.page.keyboard.press(key);
    return this.status();
  }

  async wait({ milliseconds = 800, selector } = {}) {
    this.requirePage();
    if (selector) await this.page.locator(selector).setTimeout(Math.max(1000, milliseconds)).wait();
    else await new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.min(30_000, milliseconds))));
    return this.status();
  }

  async inspect() {
    this.requirePage();
    return this.page.evaluate(() => ({
      title: document.title,
      url: location.href,
      headings: [...document.querySelectorAll('h1,h2,h3')].slice(0, 20).map((element) => element.textContent?.trim()).filter(Boolean),
      actions: [...document.querySelectorAll('button,a,[role="button"]')].slice(0, 80).map((element) => ({
        text: element.textContent?.trim().slice(0, 120) || '',
        selectorHint: element.id ? `#${element.id}` : element.getAttribute('aria-label') || element.tagName.toLowerCase(),
      })).filter((item) => item.text),
    }));
  }

  async capture({ projectId, name = 'Captured screen', locale, fullPage = false, frame = 'iphone' } = {}) {
    this.requirePage();
    const project = this.store.getProject(projectId);
    const targetLocale = locale || project.locales.find((item) => item.isDefault)?.locale || project.locales[0]?.locale;
    const buffer = await this.page.screenshot({ type: 'png', fullPage: Boolean(fullPage) });
    const asset = this.store.importAsset({
      projectId,
      dataUrl: `data:image/png;base64,${Buffer.from(buffer).toString('base64')}`,
      name: `${name}.png`,
      kind: 'capture',
      width: this.viewport.width,
      height: fullPage ? null : this.viewport.height,
    });
    const screen = this.store.createScreen({ projectId, name, assetId: asset.id, locale: targetLocale });
    this.store.updateScreen(screen.id, { layout: { device: { ...screen.layout.device, frame } } });
    return { asset, screen: this.store.getProject(projectId).screens.find((item) => item.id === screen.id), locale: targetLocale };
  }

  status() {
    this.requirePage();
    return { url: this.page.url(), viewport: this.viewport, title: null };
  }

  requirePage() {
    if (!this.page || this.page.isClosed()) throw new Error('No active Chrome capture session. Call showapp.browser_open first.');
  }

  async close() {
    await this.browser?.close();
    this.browser = null;
    this.page = null;
    return { success: true };
  }
}
