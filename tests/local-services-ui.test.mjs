import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'src', 'server.mjs'), 'utf8');

test('Studio exposes a reusable Local Services surface with Figma Bridge status', () => {
  assert.match(html, /data-view="services"/);
  assert.match(html, /id="figmaBridgeShortcut"/);
  assert.match(html, /id="localServices"/);
  assert.match(app, /\/api\/services/);
  assert.match(app, /Start automatically with Studio/);
  assert.match(app, /Running externally/);
});

test('Studio server exposes service lifecycle and settings endpoints', () => {
  assert.match(server, /createLocalServiceManager/);
  assert.match(server, /\/api\/services/);
  assert.match(server, /\(start\|stop\|restart\)/);
  assert.match(server, /\/settings/);
  assert.match(server, /localServices\.autoStart\(\)/);
});
