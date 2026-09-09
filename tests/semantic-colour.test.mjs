import fs from 'node:fs';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { SOURCE_GROUPS, generatedOverrides } from '../public/colour-engine.js';
import { buildSemanticCandidateSets, completeSemanticSelections, fixedSemanticMappings, semanticDesignBatches, semanticFindings, validateSemanticMappings } from '../src/semantic-colour.mjs';
import { deltaE } from '../src/semantic-quality.mjs';

const contract = JSON.parse(fs.readFileSync(new URL('../src/colour-contract.json', import.meta.url), 'utf8'));

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
  assert.deepEqual(fill.candidates,[
    '--bc-color-identity-ramp-1-shade-10','--bc-color-identity-ramp-1-shade-20','--bc-color-identity-ramp-1-shade-30','--bc-color-identity-ramp-1-shade-40','--bc-color-identity-ramp-1-shade-50'
  ]);
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

test('semantic candidate sets carry accessibility thresholds only where the Colour contract defines them',()=>{
  const flavour=completeFlavour();
  const sets=buildSemanticCandidateSets(flavour,'light');
  const text=sets.find(s=>s.token==='--bc-color-text');
  const fill=sets.find(s=>s.token==='--bc-color-fill-primary');
  const border=sets.find(s=>s.token==='--bc-color-border-primary');
  assert.equal(text.accessibilityMinimum,'4.5:1');
  assert.equal(text.accessibilityRecommended,'7:1');
  assert.equal(border.accessibilityMinimum,'3:1');
  assert.equal(border.accessibilityRecommended,'4.5:1');
  assert.equal(fill.accessibilityMinimum,'');
  assert.equal(fill.accessibilityRecommended,'');
});


test('accessible Semantic candidates never include an adjustable Primitive that misses the hard minimum', () => {
  const flavour = completeFlavour();
  for (const mode of ['light','dark']) {
    const sets = buildSemanticCandidateSets(flavour, mode);
    for (const set of sets.filter(s => s.accessibilityMinimum && !s.fixed)) {
      assert.ok(set.candidates.length > 0, `${mode} ${set.name} should retain at least one legal accessible candidate`);
      assert.ok(set.rawCandidateCount >= set.candidates.length);
    }
  }
});

test('inverse Strong family text uses the opposing lightness direction', () => {
  const flavour = completeFlavour();
  const light = buildSemanticCandidateSets(flavour, 'light');
  const normal = light.find(s => s.name === 'Text Primary Strong');
  const inverse = light.find(s => s.name === 'Text Primary Strong Inverse');
  assert.ok(normal.candidates.every(v => v.includes('-shade-')));
  assert.ok(inverse.candidates.every(v => v.includes('-tint-')));
});


test('Semantic generation safely completes roles omitted by Local AI', () => {
  const sets = [
    { token: '--bc-color-a', candidates: ['--bc-color-neutral-80', '--bc-color-neutral-90'], fixed: false },
    { token: '--bc-color-b', candidates: ['--bc-color-neutral-20', '--bc-color-neutral-30'], fixed: false },
  ];
  const result = completeSemanticSelections(
    sets,
    {},
    { '--bc-color-a': '--bc-color-neutral-90' },
    []
  );
  assert.equal(result.selected['--bc-color-a'], '--bc-color-neutral-90');
  assert.equal(result.selected['--bc-color-b'], '--bc-color-neutral-20');
  assert.deepEqual(result.autoCompleted, ['--bc-color-b']);
  assert.deepEqual(result.unresolved, []);
});

test('legal AI Semantic choices override existing choices while illegal output is ignored', () => {
  const sets = [
    { token: '--bc-color-a', candidates: ['--bc-color-neutral-80', '--bc-color-neutral-90'], fixed: false },
  ];
  const legal = completeSemanticSelections(
    sets, {}, { '--bc-color-a': '--bc-color-neutral-80' },
    [{ semanticToken: '--bc-color-a', primitiveToken: '--bc-color-neutral-90' }]
  );
  assert.equal(legal.selected['--bc-color-a'], '--bc-color-neutral-90');

  const illegal = completeSemanticSelections(
    sets, {}, { '--bc-color-a': '--bc-color-neutral-80' },
    [{ semanticToken: '--bc-color-a', primitiveToken: '--bc-color-neutral-10' }]
  );
  assert.equal(illegal.selected['--bc-color-a'], '--bc-color-neutral-80');
});

test('Semantic generation only remains unresolved when BufferCore has no legal candidate', () => {
  const result = completeSemanticSelections(
    [{ token: '--bc-color-a', candidates: [], fixed: false }],
    {}, {}, []
  );
  assert.deepEqual(result.unresolved, ['--bc-color-a']);
});


test('Semantic candidate sets carry complete role context and design guidance for AI and UI',()=>{
  const flavour=completeFlavour();
  const text=buildSemanticCandidateSets(flavour,'light').find(s=>s.token==='--bc-color-text-muted');
  assert.ok(text.purpose);
  assert.ok(text.context);
  assert.ok(text.sourceRule);
  assert.ok(text.appearanceRule);
  assert.ok(text.relationshipRule);
  assert.ok(text.rules.global.some(rule=>/Neutral 0\/100/i.test(rule)));
  assert.ok(text.rules.group.some(rule=>/Muted/i.test(rule)));
});

test('every editable Semantic Colour role has purpose, context, source and appearance rules',()=>{
  const flavour=completeFlavour();
  for(const mode of ['light','dark']){
    for(const set of buildSemanticCandidateSets(flavour,mode)){
      assert.ok(set.purpose,`${mode} ${set.name} missing purpose`);
      assert.ok(set.context,`${mode} ${set.name} missing context`);
      assert.ok(set.sourceRule,`${mode} ${set.name} missing source rule`);
      assert.ok(set.appearanceRule,`${mode} ${set.name} missing appearance rule`);
    }
  }
});


test('Semantic candidate evidence carries real colour, contrast and perceptual metrics into the design engine',()=>{
  const flavour=completeFlavour();
  const set=buildSemanticCandidateSets(flavour,'light').find(s=>s.token==='--bc-color-text-muted');
  assert.ok(set.candidateEvidence.length);
  for(const candidate of set.candidateEvidence){
    assert.match(candidate.value,/^#[0-9a-f]{6}$/i);
    assert.equal(typeof candidate.contrast,'number');
    assert.equal(candidate.meetsMinimum,true);
    assert.equal(typeof candidate.perceptual.lightness,'number');
    assert.equal(typeof candidate.perceptual.chroma,'number');
    assert.equal(typeof candidate.perceptual.distanceWhite,'number');
    assert.equal(typeof candidate.perceptual.distanceBlack,'number');
  }
});

test('family plan options include fixed Base anchors and preserve perceptual separation around them',()=>{
  const flavour=completeFlavour();
  for(const mode of ['light','dark']){
    const batch=semanticDesignBatches(flavour,mode).find(b=>b.group==='Fill'&&b.label==='primary');
    assert.ok(batch);
    const best=batch.options[0];
    assert.ok(best.choices.some(c=>c.name==='Fill Primary'&&c.source==='--bc-color-identity-ramp-1'));
    assert.equal(best.allMinimumsMet,true);
    assert.ok(best.visualQuality.minSiblingDistance >= 4);
    assert.equal(best.visualQuality.endpointCollapses,0);
  }
});

test('deterministic general Text hierarchy stays distinct and clears every hard minimum without endpoint collapse',()=>{
  const flavour=completeFlavour();
  for(const mode of ['light','dark']){
    const batch=semanticDesignBatches(flavour,mode).find(b=>b.group==='Text'&&b.label==='general-normal');
    assert.ok(batch?.options?.[0]);
    const choices=batch.options[0].choices;
    assert.deepEqual(choices.map(c=>c.name),['Text Muted','Text Subtle','Text Default']);
    assert.ok(choices.every(c=>c.meetsMinimum!==false));
    assert.ok(choices[0].contrast < choices[1].contrast && choices[1].contrast < choices[2].contrast);
    assert.notEqual(choices[0].source,choices[1].source);
    assert.notEqual(choices[1].source,choices[2].source);
  }
});

test('deterministic best plan produces no visual-quality findings for the representative complete palette',()=>{
  const flavour=completeFlavour();
  for(const mode of ['light','dark']){
    const sets=buildSemanticCandidateSets(flavour,mode);
    const result=completeSemanticSelections(sets,fixedSemanticMappings(flavour,mode),{}, {batchSelections:[]});
    assert.deepEqual(result.unresolved,[]);
    assert.deepEqual(semanticFindings(flavour,mode,result.selected),[]);
  }
});


test('AI Semantic builds never silently fall back to deterministic output', () => {
  const serverSource = readFileSync(new URL('../src/server.mjs', import.meta.url), 'utf8');
  const appSource = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.doesNotMatch(serverSource, /Local AI judgement was unavailable, so BufferCore kept/);
  assert.match(serverSource, /buildMode === 'deterministic'/);
  assert.match(serverSource, /SEMANTIC_AI_UNAVAILABLE/);
  assert.match(appSource, /AI build verified/);
  assert.match(appSource, /Build deterministic/);
  assert.match(appSource, /Use deterministic build/);
});


test('chromatic Text families expose Base + Strong + Strong Inverse without redundant Base Inverse roles', () => {
  const rows = contract.semantic.filter(row => row.group === 'Text');
  for (const family of ['Primary','Secondary','Accent','Success','Warning','Error','Info']) {
    assert.ok(rows.some(row => row.name === `Text ${family}`));
    assert.ok(rows.some(row => row.name === `Text ${family} Strong`));
    assert.ok(rows.some(row => row.name === `Text ${family} Strong Inverse`));
    assert.ok(!rows.some(row => row.name === `Text ${family} Inverse`));
    assert.ok(!rows.some(row => row.name === `Text ${family} Inverse Strong`));
  }
  assert.equal(rows.length, 27);
});

test('chromatic Text Base is literal while only Strong variants carry accessibility guarantees', () => {
  for (const family of ['Primary','Secondary','Accent','Success','Warning','Error','Info']) {
    const base = contract.semantic.find(row => row.name === `Text ${family}`);
    const strong = contract.semantic.find(row => row.name === `Text ${family} Strong`);
    const inverse = contract.semantic.find(row => row.name === `Text ${family} Strong Inverse`);
    assert.equal(base.selection.mappingPolicy, 'fixed');
    assert.equal(base.accessibilityMinimum, '');
    assert.equal(strong.accessibilityMinimum, '4.5:1');
    assert.equal(inverse.accessibilityMinimum, '4.5:1');
    assert.equal(strong.selection.modeContext, 'normal');
    assert.equal(inverse.selection.modeContext, 'inverse');
  }
});

test('chromatic Text Strong candidates must clear both accessibility and Base separation', () => {
  const flavour = completeFlavour();
  for (const mode of ['light','dark']) {
    const sets = buildSemanticCandidateSets(flavour, mode);
    for (const family of ['Primary','Secondary','Accent','Success','Warning','Error','Info']) {
      for (const suffix of ['Strong','Strong Inverse']) {
        const set = sets.find(s => s.name === `Text ${family} ${suffix}`);
        const baseSet = sets.find(s => s.name === `Text ${family}`);
        assert.ok(set?.candidates?.length, `${mode} ${family} ${suffix} needs legal candidates`);
        const baseValue = flavour.overrides[baseSet.candidates[0]];
        for (const source of set.candidates) assert.ok(deltaE(baseValue, flavour.overrides[source]) >= 5, `${mode} ${set.name} ${source} is too close to Base`);
        assert.equal(set.selection.visual.minimumSiblingDeltaE, 5);
        assert.equal(set.selection.visual.preferredSiblingDeltaE, 7);
      }
    }
  }
});

test('deterministic chromatic Text Strong selections are visibly distinct from Base', () => {
  const flavour = completeFlavour();
  for (const mode of ['light','dark']) {
    const sets = buildSemanticCandidateSets(flavour, mode);
    const result = completeSemanticSelections(sets, fixedSemanticMappings(flavour,mode), {}, {batchSelections:[]});
    for (const family of ['Primary','Secondary','Accent','Success','Warning','Error','Info']) {
      const base = sets.find(s => s.name === `Text ${family}`);
      const strong = sets.find(s => s.name === `Text ${family} Strong`);
      const inverse = sets.find(s => s.name === `Text ${family} Strong Inverse`);
      const baseValue = flavour.overrides[result.selected[base.token]];
      assert.ok(deltaE(baseValue, flavour.overrides[result.selected[strong.token]]) >= 5);
      assert.ok(deltaE(baseValue, flavour.overrides[result.selected[inverse.token]]) >= 5);
    }
  }
});

test('quality findings do not compare Fill and Text merely because they share a colour family', () => {
  const flavour = completeFlavour();
  const mode = 'light';
  const sets = buildSemanticCandidateSets(flavour, mode);
  const result = completeSemanticSelections(sets, fixedSemanticMappings(flavour,mode), {}, {batchSelections:[]});
  const findings = semanticFindings(flavour, mode, result.selected);
  assert.ok(!findings.some(f => {
    const names = f.tokens.map(token => sets.find(s => s.token === token)?.name || '');
    return names.some(n => n.startsWith('Fill ')) && names.some(n => n.startsWith('Text '));
  }));
});


test('server refuses to label a partial family response as a successful AI Semantic build', () => {
  const serverSource = readFileSync(new URL('../src/server.mjs', import.meta.url), 'utf8');
  assert.match(serverSource, /answeredBatchIds\.size !== batches\.length/);
  assert.match(serverSource, /Local AI only returned valid decisions for/);
  assert.match(serverSource, /SEMANTIC_AI_INCOMPLETE/);
  assert.match(serverSource, /buildBaseline = freshBuild \? \{\} : existing/);
});


function harshClientFlavour(){
  const overrides={};
  const bases={
    '--bc-color-identity-ramp-1':'#e7ff00',
    '--bc-color-identity-ramp-2':'#6b4f2a',
    '--bc-color-identity-ramp-3':'#ff1493',
    '--bc-color-ground-ramp-1':'#fff8e7',
    '--bc-color-ground-ramp-2':'#f3faff',
    '--bc-color-ground-ramp-3':'#071c18',
    '--bc-color-neutral-50':'#d9d5d0',
    '--bc-color-status-success':'#66cdaa',
    '--bc-color-status-warning':'#ffe08a',
    '--bc-color-status-error':'#ff2d20',
    '--bc-color-status-info':'#00aeef',
    '--bc-color-interaction-link':'#0066ff',
    '--bc-color-interaction-link-inverse':'#79c8ff',
    '--bc-color-interaction-link-visited':'#7d28d8',
    '--bc-color-interaction-link-visited-inverse':'#d7a8ff',
    '--bc-color-interaction-focus':'#ff7a00',
    '--bc-color-interaction-focus-inverse':'#ffd08a'
  };
  for(const [token,value] of Object.entries(bases))Object.assign(overrides,generatedOverrides(token,value));
  return {id:'harsh-client',overrides,semanticMappings:{}};
}

test('harsh yellow Text Primary Strong may prefer minimum-pass family retention over 7:1 endpoint chasing', () => {
  const flavour=harshClientFlavour();
  const sets=buildSemanticCandidateSets(flavour,'light');
  const result=completeSemanticSelections(sets,fixedSemanticMappings(flavour,'light'),{}, {batchSelections:[]});
  const strong=sets.find(s=>s.name==='Text Primary Strong');
  const source=result.selected[strong.token];
  const evidence=strong.candidateEvidence.find(candidate=>candidate.source===source);
  assert.ok(evidence, 'selected Strong needs evidence');
  assert.ok(evidence.contrast>=4.5, `hard accessibility floor must still pass, got ${evidence.contrast}`);
  assert.ok(evidence.perceptual.chromaRetention>=.48, `yellow Strong should retain useful family chroma, got ${evidence.perceptual.chromaRetention}`);
  assert.notEqual(source,'--bc-color-identity-ramp-1-shade-70', 'do not force the muddy 7:1+ shade when a closer legal family-preserving pass exists');
});

test('chromatic Strong scoring treats recommended contrast as secondary to family identity after minimum', () => {
  const source=readFileSync(new URL('../src/semantic-quality.mjs', import.meta.url),'utf8');
  assert.match(source, /p\.chromaRetention<\.55/);
  assert.match(source, /p\.hueDrift>12/);
  assert.match(source, /p\.baseDistance<18/);
  assert.match(source, /const frontier=eligible\.filter/);
  assert.match(source, /if\(isChromaticTextStrong\(set\)\)return rec/);
  assert.match(source, /strength:Math\.min\(c\.perceptual\?\.baseDistance\?\?0,26\)/);
});


test('harsh yellow quality frontier keeps the faithful minimum-pass Strong and excludes personality-collapse tones', () => {
  const flavour=harshClientFlavour();
  const batch=semanticDesignBatches(flavour,'light').find(item=>item.label==='primary-normal');
  assert.ok(batch);
  const strongChoices=batch.options.flatMap(option=>option.choices)
    .filter(choice=>choice.name==='Text Primary Strong')
    .map(choice=>choice.source);
  assert.ok(strongChoices.includes('--bc-color-identity-ramp-1-shade-60'));
  assert.ok(!strongChoices.includes('--bc-color-identity-ramp-1-shade-70'));
  assert.ok(!strongChoices.includes('--bc-color-identity-ramp-1-shade-80'));
  assert.ok(!strongChoices.includes('--bc-color-identity-ramp-1-shade-90'));
  assert.equal(batch.options[0].choices.find(choice=>choice.name==='Text Primary Strong')?.source,
    '--bc-color-identity-ramp-1-shade-60');
});

test('hot pink quality frontier keeps and prefers the stronger magenta shade when family character survives', () => {
  const flavour=harshClientFlavour();
  const batch=semanticDesignBatches(flavour,'light').find(item=>item.label==='accent-normal');
  assert.ok(batch);
  const strongChoices=batch.options.flatMap(option=>option.choices)
    .filter(choice=>choice.name==='Text Accent Strong')
    .map(choice=>choice.source);
  assert.ok(strongChoices.includes('--bc-color-identity-ramp-3-shade-40'),
    'shade-40 should remain a viable Strong trade-off for the hot-pink family');
  assert.equal(batch.options[0].choices.find(choice=>choice.name==='Text Accent Strong')?.source,
    '--bc-color-identity-ramp-3-shade-40',
    'recommended contrast should win when the stronger shade still clearly preserves magenta personality');
});


test('family-preservation pruning does not change manual legal candidate bands', () => {
  const flavour=harshClientFlavour();
  const sets=buildSemanticCandidateSets(flavour,'light');
  const strong=sets.find(set=>set.name==='Text Primary Strong');
  assert.ok(strong.candidates.includes('--bc-color-identity-ramp-1-shade-70'),
    'manual review must retain the full legal accessible family band');
});
