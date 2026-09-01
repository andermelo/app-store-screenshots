import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundlePath = path.join(pluginRoot, 'dist', 'showapp.mjs');
const source = fs.readFileSync(bundlePath, 'utf8');
fs.writeFileSync(bundlePath, source.replace(/[ \t]+$/gm, ''));
