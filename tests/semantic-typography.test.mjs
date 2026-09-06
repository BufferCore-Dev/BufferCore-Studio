import test from 'node:test';
import assert from 'node:assert/strict';
import { baselineTypographyMappings, buildTypographyCandidateSets, effectiveTypographyMappings, normaliseTypographyOverrides, typographyCompletion, validateTypographyMappings } from '../src/semantic-typography.mjs';

function token(cssVariable, layer, rawValue) {
  return { cssVariable, layer, foundation:'typography', variants:[{rawValue,context:{modes:{},conditions:[]}}] };
}
function manifest(){
  return {tokens:[
    token('--bc-type-font-family-primary','primitive','"Primary", sans-serif'),
    token('--bc-type-font-family-secondary','primitive','"Secondary", sans-serif'),
    ...[1,2,3,4,5].map(n=>token(`--bc-type-size-${n}`,'primitive',`${n}rem`)),
    ...[400,500,600,700].map(n=>token(`--bc-type-weight-${n}`,'primitive',String(n))),
    ...[130,140,150,160].map(n=>token(`--bc-type-leading-${n}`,'primitive',String(n/100))),
    ...[0,1,2,3,10].map(n=>token(`--bc-type-tracking-${n}`,'primitive',`${n/100}em`)),
    token('--bc-type-paragraph-2-font-family','semantic','var(--bc-type-font-family-secondary)'),
    token('--bc-type-paragraph-2-font-size','semantic','var(--bc-type-size-3)'),
    token('--bc-type-paragraph-2-font-weight','semantic','var(--bc-type-weight-400)'),
    token('--bc-type-paragraph-2-line-height','semantic','var(--bc-type-leading-150)'),
    token('--bc-type-paragraph-2-letter-spacing','semantic','var(--bc-type-tracking-2)')
  ]};
}

test('Typography role candidates stay within the matching Primitive property family',()=>{
  const sets=buildTypographyCandidateSets(manifest(),{});
  const family=sets.find(s=>s.property==='font-family');
  const size=sets.find(s=>s.property==='font-size');
  assert.deepEqual(family.candidates,['--bc-type-font-family-primary','--bc-type-font-family-secondary']);
  assert.deepEqual(size.candidates,['--bc-type-size-2','--bc-type-size-3','--bc-type-size-4']);
});

test('Typography mapping validator rejects a Primitive from the wrong property family',()=>{
  assert.throws(()=>validateTypographyMappings(manifest(),{'--bc-type-paragraph-2-font-size':'--bc-type-weight-400'}),/not a legal Primitive source/);
});

test('Typography is complete from the Core baseline before a Flavour adds any semantic override',()=>{
  const result=typographyCompletion(manifest(),{});
  assert.equal(result.complete,true);
  assert.equal(result.overridden,0);
  assert.equal(result.inherited,result.mapped);
});

test('effective typography uses Core baseline plus sparse Flavour overrides',()=>{
  const m=manifest();
  const target='--bc-type-paragraph-2-font-weight';
  const flavour={semanticMappings:{typography:{[target]:'--bc-type-weight-500'}}};
  assert.equal(baselineTypographyMappings(m)[target],'--bc-type-weight-400');
  assert.equal(effectiveTypographyMappings(m,flavour)[target],'--bc-type-weight-500');
  assert.equal(effectiveTypographyMappings(m,flavour)['--bc-type-paragraph-2-font-size'],'--bc-type-size-3');
});

test('normalisation stores only differences from the Core typography baseline',()=>{
  const m=manifest();
  const clean=normaliseTypographyOverrides(m,{
    '--bc-type-paragraph-2-font-size':'--bc-type-size-3',
    '--bc-type-paragraph-2-font-weight':'--bc-type-weight-500'
  });
  assert.deepEqual(clean,{'--bc-type-paragraph-2-font-weight':'--bc-type-weight-500'});
});
