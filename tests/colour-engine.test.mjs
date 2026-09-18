import test from 'node:test';
import assert from 'node:assert/strict';
import { completion, generatedOverrides, neutralScale, tones } from '../public/colour-engine.js';

test('Identity and Status source colours deterministically generate tint/base/shade families', () => {
  const family = generatedOverrides('--bc-color-identity-ramp-1', '#336699');
  assert.equal(Object.keys(family).length, 19);
  assert.equal(family['--bc-color-identity-ramp-1'], '#336699');
  assert.equal(family['--bc-color-identity-ramp-1-tint-90'], '#ebf0f5');
  assert.equal(family['--bc-color-identity-ramp-1-shade-90'], '#050a0f');
  assert.equal(tones('#336699').length, 19);
});

test('Neutral 50 generates the absolute 0 to 100 scale', () => {
  const scale = neutralScale('#808080');
  assert.equal(Object.keys(scale).length, 21);
  assert.equal(scale['--bc-color-neutral-0'], '#ffffff');
  assert.equal(scale['--bc-color-neutral-50'], '#808080');
  assert.equal(scale['--bc-color-neutral-100'], '#000000');
});

test('Ground source colours generate Canvas-only tone families while Interaction stays direct', () => {
  const ground = generatedOverrides('--bc-color-ground-ramp-1', '#f4efe6');
  assert.equal(Object.keys(ground).length, 19);
  assert.equal(ground['--bc-color-ground-ramp-1'], '#f4efe6');
  assert.equal(ground['--bc-color-ground-ramp-1-tint-90'], '#fefdfd');
  assert.equal(ground['--bc-color-ground-ramp-1-shade-90'], '#181817');
  assert.deepEqual(generatedOverrides('--bc-color-interaction-focus', '#ff00aa'), {'--bc-color-interaction-focus':'#ff00aa'});
});

test('Palette completion measures required source colours rather than generated token count', () => {
  const empty = completion({});
  assert.equal(empty.total, 17);
  assert.equal(empty.complete, 0);
  const overrides = Object.fromEntries(empty.missing.map(token => [token, '#123456']));
  assert.equal(completion(overrides).complete, 17);
});
