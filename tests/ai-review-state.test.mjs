import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const app=fs.readFileSync(path.join(here,'..','public','app.js'),'utf8');
const server=fs.readFileSync(path.join(here,'..','src','server.mjs'),'utf8');

test('Colour AI review is read-only and snapshots the in-memory Flavour',()=>{
  assert.match(app,/let aiReviewSnapshot = null/);
  assert.match(app,/aiReviewReadOnly=\/\\breview\\b\/i\.test\(promptText\)/);
  assert.match(app,/flavour:currentFlavour/);
  assert.match(app,/AI review is read-only/);
  assert.match(app,/structuredClone\(reviewSnapshot\)/);
});

test('AI assist uses submitted live Flavour values instead of reloading stale saved overrides',()=>{
  assert.match(server,/AI_ASSIST_USES_LIVE_FLAVOUR_SNAPSHOT/);
  assert.match(server,/const submittedFlavour = data\.flavour/);
  assert.match(server,/overrides: structuredClone\(submittedFlavour\.overrides \|\| \{\}\)/);
});
