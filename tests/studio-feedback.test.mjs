import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');

test('Studio uses its own modal and toast feedback instead of native browser dialogs', () => {
  assert.match(app, /function studioDialog\(/);
  assert.match(app, /function studioToast\(/);
  assert.match(app, /function confirmDialog\(/);
  assert.match(app, /function promptDialog\(/);
  assert.doesNotMatch(app, /\b(?:alert|confirm|prompt)\s*\(/);
  assert.match(css, /\.studio-dialog-backdrop/);
  assert.match(css, /\.studio-toast-region/);
});

test('Semantic mapping failures use the Studio error dialog and restore the rendered legal state', () => {
  assert.match(app, /title:'Invalid Semantic colour choice'/);
  assert.match(app, /Studio kept the previous legal mapping/);
  assert.match(app, /semanticState\[mode\]=await api\(`\/api\/flavours\/\$\{encodeURIComponent\(currentFlavour\.id\)\}\/colour-semantics\/\$\{mode\}`\)/);
  assert.match(app, /renderBuilder\(\)/);
});
