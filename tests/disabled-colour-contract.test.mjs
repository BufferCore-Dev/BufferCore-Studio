import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const contract=JSON.parse(fs.readFileSync(path.join(here,'..','src','colour-contract.json'),'utf8'));
const server=fs.readFileSync(path.join(here,'..','src','server.mjs'),'utf8');
const app=fs.readFileSync(path.join(here,'..','public','app.js'),'utf8');

const disabled=[
  '--bc-color-disabled-text',
  '--bc-color-disabled-text-inverse',
  '--bc-color-disabled-fill',
  '--bc-color-disabled-fill-inverse',
  '--bc-color-disabled-border',
  '--bc-color-disabled-border-inverse'
];

test('Disabled is not a Colour semantic family',()=>{
  const tokens=new Set((contract.semantic||[]).map(row=>row.token));
  for(const token of disabled)assert.equal(tokens.has(token),false,token);
  assert.doesNotMatch(JSON.stringify(contract.rules?.groups?.Interaction||[]),/Disabled colours are intentionally de-emphasised/);
});

test('Studio filters stale Colour mappings against the live semantic contract',()=>{
  assert.match(server,/function activeColourMappings\(/);
  assert.match(server,/allowed\.get\(target\)\?\.has\(source\)/);
  assert.match(server,/const mappings = activeColourMappings\(flavour, mode\)/);
  assert.match(server,/const existing = activeColourMappings\(flavour, mode\)/);
});

test('Colour Review export excludes mappings no longer present in candidate sets',()=>{
  assert.match(app,/const activeTargets=new Set\(\(state\.candidateSets\|\|\[\]\)\.map\(set=>set\.token\)\)/);
  assert.match(app,/if\(activeTargets\.size&&!activeTargets\.has\(target\)\)continue/);
});

test('fixed accessibility failures identify the exact Primitive source that must change',()=>{
  assert.match(app,/fixedFailures:\[\]/);
  assert.match(app,/summary\.fixedFailures\.push/);
  assert.match(app,/must be corrected in Primitives:/);
});
