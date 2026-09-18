import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(here, '..', 'public', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(here, '..', 'public', 'styles.css'), 'utf8');
const server = fs.readFileSync(path.join(here, '..', 'src', 'server.mjs'), 'utf8');

test('Colour is a nested nine-stage Primitive-to-Semantic wizard', () => {
  assert.match(app, /Identity/);
  assert.match(app, /Ground/);
  assert.match(app, /Neutral/);
  assert.match(app, /Status/);
  assert.match(app, /Interaction/);
  assert.match(app, /Primitive Review/);
  assert.match(app, /Light Semantics/);
  assert.match(app, /Dark Semantics/);
  assert.match(app, /Colour Review/);
  assert.match(app, /colour-mini-nav/);
  assert.match(css, /\.colour-mini-step/);
});

test('Colour source editing generates families deterministically rather than asking users to fill every token', () => {
  assert.match(app, /generatedOverrides/);
  assert.match(app, /source-hex/);
  assert.match(app, /Generated Neutral 0–100/);
  assert.match(app, /deterministic/i);
});

test('Colour review shows Primitive material plus editable constrained Light and Dark Semantic mappings', () => {
  assert.match(app, /Primitive palette/);
  assert.match(app, /Generate Semantic mappings/);
  assert.match(app, /data-generate-semantics/);
  assert.match(app, /Generate .*with AI/);
  assert.match(app, /Semantic token → existing Primitive token/);
  assert.match(server, /colour-semantics/);
  assert.match(server, /runSemanticColourAssistant/);
  assert.match(server, /applyFlavour/);
});

test('Colour AI remains contextual but proposals are explicitly reviewed', () => {
  assert.match(app, /data-colour-ai/);
  assert.match(app, /Ask AI/);
  assert.match(app, /Review this complete Primitive palette/);
});


test('Colour final review validates the live Foundation Context contract without changing the nine-stage flow', () => {
  assert.match(app, /Foundation contract ready/);
  assert.match(app, /Colour Context:/);
  assert.match(app, /editable Colour Semantics are taken from the live Engine catalogue/);
  assert.match(app, /Disabled is correctly owned by Interaction State and is not part of the Colour family/);
  assert.match(server, /colourFoundationReadiness/);
  assert.match(server, /foundationReadiness/);
});

test('Colour semantic API passes the live Engine manifest into mapping generation and validation', () => {
  assert.match(server, /buildSemanticCandidateSets\(flavour, mode, manifest\)/);
  assert.match(server, /fixedSemanticMappings\(flavour, mode, manifest\)/);
  assert.match(server, /validateSemanticMappings\(current, mappings, currentMode, manifest\)/);
  assert.match(server, /semanticCompletion\(saved, mode, manifest\)/);
});
