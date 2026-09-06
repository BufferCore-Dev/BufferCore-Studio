import test from 'node:test';
import assert from 'node:assert/strict';
import { SOURCE_GROUPS, generatedOverrides } from '../public/colour-engine.js';
import { buildSemanticCandidateSets, fixedSemanticMappings, validateSemanticMappings } from '../src/semantic-colour.mjs';

function completeFlavour(){
  const overrides={};
  const bases={
    '--bc-color-identity-ramp-1':'#2f6fed','--bc-color-identity-ramp-2':'#7d4cff','--bc-color-identity-ramp-3':'#e04f9d',
    '--bc-color-ground-ramp-1':'#f7f7f5','--bc-color-ground-ramp-2':'#f0f1ed','--bc-color-ground-ramp-3':'#e8eae4',
    '--bc-color-neutral-50':'#7b7f82','--bc-color-status-success':'#238636','--bc-color-status-warning':'#b7791f','--bc-color-status-error':'#c9372c','--bc-color-status-info':'#2774c8',
    '--bc-color-interaction-link':'#1f63d6','--bc-color-interaction-link-inverse':'#8db8ff','--bc-color-interaction-link-visited':'#7447bf','--bc-color-interaction-link-visited-inverse':'#c3a5ff','--bc-color-interaction-focus':'#ff8a00','--bc-color-interaction-focus-inverse':'#ffd08a'
  };
  const all=[];
  for(const source of Object.values(SOURCE_GROUPS))all.push(...source);
  for(const [token,value] of Object.entries(bases))Object.assign(overrides,generatedOverrides(token,value));
  return {id:'test',overrides,semanticMappings:{}};
}

test('semantic colour generator constrains roles to Primitive candidates',()=>{
  const flavour=completeFlavour();
  const sets=buildSemanticCandidateSets(flavour,'light');
  const fill=sets.find(s=>s.token==='--bc-color-fill-primary-strong');
  assert.ok(fill);
  assert.deepEqual(fill.candidates.sort(),[
    '--bc-color-identity-ramp-1-shade-20','--bc-color-identity-ramp-1-shade-30','--bc-color-identity-ramp-1-shade-40'
  ].sort());
});

test('Canvas mappings are fixed to Ground bases',()=>{
  const flavour=completeFlavour();
  const fixed=fixedSemanticMappings(flavour,'dark');
  assert.equal(fixed['--bc-color-canvas-primary'],'--bc-color-ground-ramp-1');
  assert.equal(fixed['--bc-color-canvas-secondary'],'--bc-color-ground-ramp-2');
  assert.equal(fixed['--bc-color-canvas-tertiary'],'--bc-color-ground-ramp-3');
});

test('manual semantic mappings cannot escape legal candidate bands',()=>{
  const flavour=completeFlavour();
  assert.throws(()=>validateSemanticMappings(flavour,{'--bc-color-fill-primary-strong':'--bc-color-neutral-50'},'light'),/not a legal light Primitive source/);
  const clean=validateSemanticMappings(flavour,{'--bc-color-fill-primary-strong':'--bc-color-identity-ramp-1-shade-30'},'light');
  assert.equal(clean['--bc-color-fill-primary-strong'],'--bc-color-identity-ramp-1-shade-30');
});
