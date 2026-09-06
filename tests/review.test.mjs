import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewFlavour } from '../src/review.mjs';

const catalogue = [
  { cssVariable: '--bc-color-primary', foundation: 'colour' },
  { cssVariable: '--bc-radius-md', foundation: 'radius' }
];

test('review summarises primitive overrides by Foundation', () => {
  const result = reviewFlavour({ id: 'demo', displayName: 'Demo', overrides: { '--bc-color-primary': '#123456', '--bc-radius-md': '8px' } }, catalogue);
  assert.equal(result.ok, true);
  assert.equal(result.overrideCount, 2);
  assert.deepEqual(result.foundationCounts, { colour: 1, radius: 1 });
  assert.deepEqual(result.issues, []);
});

test('review rejects overrides that are no longer current primitives', () => {
  const result = reviewFlavour({ id: 'demo', displayName: 'Demo', overrides: { '--bc-semantic-text': '#fff' } }, catalogue);
  assert.equal(result.ok, false);
  assert.equal(result.issues[0].code, 'unknown-override');
});
