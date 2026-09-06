import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(here, '..', 'public', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(here, '..', 'public', 'styles.css'), 'utf8');

test('wizard exposes real editors for Shape, Spacing & Scale, Depth and Motion', () => {
  assert.match(app, /foundations:\['radius','borders','stroke'\]/);
  assert.match(app, /foundations:\['spacing','sizing','containers'\]/);
  assert.match(app, /foundations:\['shadows','effects'\]/);
  assert.match(app, /foundations:\['motion'\]/);
});

test('later wizard editors preserve primitive inheritance and Foundation reset controls', () => {
  assert.match(app, /renderGuidedFoundationEditor/);
  assert.match(app, /data-reset-foundation/);
  assert.match(app, /inherit Core/);
});

test('Shape, scale, depth and motion have visual previews rather than raw token tables only', () => {
  assert.match(app, /shapePreview/);
  assert.match(app, /scalePreview/);
  assert.match(app, /depthPreview/);
  assert.match(app, /motionPreview/);
  assert.match(css, /\.design-preview/);
  assert.match(css, /@keyframes bc-motion-preview/);
});

test('persistent AI assistant is available across the complete Flavour wizard', () => {
  assert.match(app, /assistantPlaceholder/);
  assert.match(app, /Shape/);
  assert.match(app, /Spacing & Scale/);
  assert.match(app, /Depth/);
  assert.match(app, /Motion/);
  assert.match(app, /guidance-only/);
  assert.match(app, /aiHistory/);
});


test('later Foundation steps use guided decision sections rather than a flat editor dump', () => {
  assert.match(app, /renderGuidedFoundationEditor/);
  assert.match(app, /guidedFoundationSection/);
  assert.match(app, /Spacing rhythm/);
  assert.match(app, /Shadow language/);
  assert.match(app, /Duration & easing/);
  assert.match(css, /\.guided-foundation-section/);
});

test('guided Foundation sections expose contextual AI without changing semantic ownership', () => {
  assert.match(app, /data-foundation-ai/);
  assert.match(app, /Keep BufferCore semantics intact/);
  assert.match(app, /Core semantic motion roles stay inherited/);
});
