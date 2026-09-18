import test from 'node:test';
import assert from 'node:assert/strict';
import { SOURCE_GROUPS, generatedOverrides } from '../public/colour-engine.js';
import { buildSemanticCandidateSets, colourFoundationReadiness, fixedSemanticMappings, semanticRows, validateSemanticMappings } from '../src/semantic-colour.mjs';

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


test('live Engine manifest owns the lean editable Semantic catalogue',()=>{
  const manifest={
    tokens:[
      {layer:'semantic',foundation:'colour',cssVariable:'--bc-color-text-primary',id:'color.text.primary'},
      {layer:'semantic',foundation:'colour',cssVariable:'--bc-color-text-primary-strong',id:'color.text.primary.strong'},
      {layer:'semantic',foundation:'colour',cssVariable:'--bc-color-text-primary-strong-inverse',id:'color.text.primary.strong.inverse'},
      {layer:'semantic',foundation:'colour',cssVariable:'--bc-color-text-context',id:'color.text.context'},
      {layer:'semantic',foundation:'colour',cssVariable:'--bc-color-fill-primary',id:'color.fill.primary'},
      {layer:'semantic',foundation:'colour',cssVariable:'--bc-color-disabled-fill',id:'legacy.disabled.fill'}
    ]
  };
  const rows=semanticRows(manifest);
  assert.deepEqual(rows.map(row=>row.token).sort(),[
    '--bc-color-fill-primary',
    '--bc-color-text-primary',
    '--bc-color-text-primary-strong',
    '--bc-color-text-primary-strong-inverse'
  ].sort());
  assert.equal(rows.find(row=>row.token==='--bc-color-text-primary-strong-inverse')?.name,'Text Primary Strong Inverse');
  assert.equal(rows.some(row=>row.token.includes('context')),false);
  assert.equal(rows.some(row=>row.token.includes('disabled')),false);
});

test('Strong Inverse uses the opposing side of the family ramp',()=>{
  const flavour=completeFlavour();
  const manifest={
    tokens:[
      {layer:'semantic',foundation:'colour',cssVariable:'--bc-color-text-primary-strong-inverse',id:'color.text.primary.strong.inverse'}
    ]
  };
  const light=buildSemanticCandidateSets(flavour,'light',manifest)[0];
  const dark=buildSemanticCandidateSets(flavour,'dark',manifest)[0];
  assert.ok(light.candidates.every(token=>token.includes('-tint-')));
  assert.ok(dark.candidates.every(token=>token.includes('-shade-')));
});

test('Colour Foundation readiness validates Context slots, all Core targets and Disabled separation',()=>{
  const requiredSlots=['a','b'];
  const requiredTargets=['primary','accent'];
  const manifest={
    tokens:[
      {layer:'semantic',foundation:'colour',cssVariable:'--bc-color-fill-primary',id:'color.fill.primary'}
    ],
    foundationContracts:{
      context:{colour:{requiredSlots,requiredTargets}},
      interactionStates:{disabled:{semantic:'--bc-interaction-disabled-opacity'}}
    },
    contextContracts:{
      domains:{colour:{
        slots:{a:{},b:{}},
        targets:{
          primary:{mappings:{a:'x',b:'y'}},
          accent:{mappings:{a:'x',b:'y'}}
        }
      }}
    }
  };
  const result=colourFoundationReadiness(manifest);
  assert.equal(result.complete,true);
  assert.deepEqual(result.context.slots,{ready:2,required:2});
  assert.deepEqual(result.context.targets.ready,2);
  assert.equal(result.stateSeparation.disabledOwnedByInteraction,true);
});
