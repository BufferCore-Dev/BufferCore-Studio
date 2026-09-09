import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createFlavour, deleteFlavour, discoverFlavourDocuments, duplicateFlavour, getFlavourDocument, primitiveCatalogue, slugifyFlavourId, updateFlavour, updateFlavourOverrides } from '../src/flavours.mjs';

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'buffercore-studio-flavours-'));
}

test('slugifies Flavour names into canonical kebab-case ids', () => {
  assert.equal(slugifyFlavourId('Wallwood Premium & Playful'), 'wallwood-premium-playful');
});

test('creates, reads and updates canonical Flavour documents without touching overrides', () => {
  const root = tempRoot();
  const created = createFlavour(root, { displayName: 'Wallwood', description: 'Green and gold.' });
  assert.equal(created.id, 'wallwood');
  const file = path.join(root, 'flavours', 'wallwood', 'flavour.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(raw.type, 'buffercore-flavour');
  assert.deepEqual(raw.overrides, {});
  raw.overrides['--bc-radius-md'] = '12px';
  fs.writeFileSync(file, JSON.stringify(raw, null, 2));
  updateFlavour(root, 'wallwood', { displayName: 'Wallwood Home', notes: 'Keep playful.' });
  const updated = getFlavourDocument(root, 'wallwood');
  assert.equal(updated.displayName, 'Wallwood Home');
  assert.equal(updated.overrides['--bc-radius-md'], '12px');
});

test('duplicates a Flavour with a new canonical identity and preserves primitive overrides', () => {
  const root = tempRoot();
  createFlavour(root, { displayName: 'Original' });
  const file = path.join(root, 'flavours', 'original', 'flavour.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  raw.overrides['--bc-radius-md'] = '10px';
  fs.writeFileSync(file, JSON.stringify(raw, null, 2));
  const copy = duplicateFlavour(root, 'original', { displayName: 'Original Soft' });
  assert.equal(copy.id, 'original-soft');
  assert.equal(copy.overrides['--bc-radius-md'], '10px');
});

test('deletes only the selected leaf Flavour', () => {
  const root = tempRoot();
  createFlavour(root, { displayName: 'One' });
  createFlavour(root, { displayName: 'Two' });
  deleteFlavour(root, 'one');
  assert.equal(getFlavourDocument(root, 'one'), null);
  assert.deepEqual(discoverFlavourDocuments(root).map((item) => item.id), ['two']);
});

test('primitive catalogue exposes only Engine primitive tokens for the wizard', () => {
  const catalogue = primitiveCatalogue({ tokens: [
    { id: 'a', cssVariable: '--bc-a', layer: 'primitive', foundation: 'colour', path: ['a'], group: 'a', valueType: 'color', variants: [{ rawValue: '#fff' }] },
    { id: 'b', cssVariable: '--bc-b', layer: 'semantic', foundation: 'colour', path: ['b'], group: 'b', valueType: 'color', variants: [{ rawValue: 'var(--bc-a)' }] }
  ] });
  assert.deepEqual(catalogue.map((token) => token.cssVariable), ['--bc-a']);
});

test('updates only known primitive overrides and treats initial as inheritance', () => {
  const root = tempRoot();
  createFlavour(root, { displayName: 'Editable' });
  const primitives = [{ cssVariable: '--bc-color-a', foundation: 'colour' }];
  updateFlavourOverrides(root, 'editable', { '--bc-color-a': '#123456' }, primitives);
  assert.equal(getFlavourDocument(root, 'editable').overrides['--bc-color-a'], '#123456');
  updateFlavourOverrides(root, 'editable', { '--bc-color-a': 'initial' }, primitives);
  assert.equal(getFlavourDocument(root, 'editable').overrides['--bc-color-a'], undefined);
  assert.throws(() => updateFlavourOverrides(root, 'editable', { '--bc-semantic-a': '#fff' }, primitives), /not an editable BufferCore Primitive/);
});


test('repairs a legacy non-kebab Flavour id from its display name during discovery', () => {
  const root = tempRoot();
  const dir = path.join(root, 'flavours', 'Old Flavour');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'flavour.json'), JSON.stringify({
    schemaVersion: 1,
    type: 'buffercore-flavour',
    id: 'Old Flavour',
    displayName: 'Old Flavour',
    overrides: {},
    semanticMappings: {}
  }, null, 2));

  const docs = discoverFlavourDocuments(root);
  assert.equal(docs.length, 1);
  assert.equal(docs[0].id, 'old-flavour');
  assert.equal(fs.existsSync(path.join(root, 'flavours', 'old-flavour', 'flavour.json')), true);
  assert.equal(fs.existsSync(dir), false);
  const repaired = JSON.parse(fs.readFileSync(path.join(root, 'flavours', 'old-flavour', 'flavour.json'), 'utf8'));
  assert.equal(repaired.id, 'old-flavour');
});


test('normalises a mixed-case supplied id instead of rejecting it', () => {
  const root = tempRoot();
  const created = createFlavour(root, { id: 'My New Flavour', displayName: 'My New Flavour' });
  assert.equal(created.id, 'my-new-flavour');
  assert.equal(fs.existsSync(path.join(root, 'flavours', 'my-new-flavour', 'flavour.json')), true);
});

test('legacy mixed-case route ids resolve to their canonical flavour', () => {
  const root = tempRoot();
  createFlavour(root, { displayName: 'My New Flavour' });
  const loaded = getFlavourDocument(root, 'My New Flavour');
  assert.equal(loaded.id, 'my-new-flavour');
});


test('guided Colour contract primitives remain editable if the generated Studio catalogue temporarily lags', () => {
  const root = tempRoot();
  createFlavour(root, { displayName: 'Colour Contract' });
  const updated = updateFlavourOverrides(root, 'colour-contract', {
    '--bc-color-identity-ramp-3': '#ff401a'
  }, []);
  assert.equal(updated.overrides['--bc-color-identity-ramp-3'], '#ff401a');
});

test('unknown non-contract variables are still rejected', () => {
  const root = tempRoot();
  createFlavour(root, { displayName: 'Strict Unknowns' });
  assert.throws(() => updateFlavourOverrides(root, 'strict-unknowns', {
    '--bc-color-made-up-random-thing': '#fff000'
  }, []), /not an editable BufferCore Primitive/);
});
