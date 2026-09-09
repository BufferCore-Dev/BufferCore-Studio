import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAssistantPrompt, parseAssistantResponse } from '../src/ai.mjs';

test('AI prompt constrains suggestions to supplied primitive tokens', () => {
  const prompt = buildAssistantPrompt({ step: 'Colour', flavour: { displayName: 'Test', overrides: {} }, catalogue: [{ cssVariable: '--bc-color-identity-ramp-1', foundation: 'colour', path: ['identity','ramp-1'], valueType: 'color', value: 'initial' }], message: 'Make it warmer' });
  assert.match(prompt, /Primitive tokens only/);
  assert.match(prompt, /--bc-color-identity-ramp-1/);
  assert.match(prompt, /Make it warmer/);
});

test('AI response drops proposals for unknown or semantic variables', () => {
  const result = parseAssistantResponse(JSON.stringify({ reply: 'Done', proposals: [
    { cssVariable: '--bc-color-a', value: '#123456', reason: 'valid' },
    { cssVariable: '--bc-color-not-allowed', value: '#ffffff', reason: 'invalid' }
  ] }), ['--bc-color-a']);
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].cssVariable, '--bc-color-a');
});

test('AI prompt supports guidance-only wizard steps without inventing token changes', () => {
  const prompt = buildAssistantPrompt({ step: 'Identity', flavour: { displayName: 'Test', overrides: {} }, catalogue: [], message: 'Does this direction make sense?' });
  assert.match(prompt, /guidance-only/i);
  assert.match(prompt, /proposals: \[\]/i);
});

test('AI prompt carries recent conversation context for persistent wizard assistance', () => {
  const prompt = buildAssistantPrompt({ step: 'Shape', flavour: { displayName: 'Test', overrides: {} }, catalogue: [{ cssVariable: '--bc-radius-1', foundation: 'radius', path: ['radius','1'], valueType: 'dimension', value: '4px' }], message: 'A little softer', history: [{ role: 'user', content: 'Keep it restrained' }, { role: 'assistant', content: 'I will keep the direction restrained.' }] });
  assert.match(prompt, /Keep it restrained/);
  assert.match(prompt, /--bc-radius-1/);
});


test('Colour assistant carries the BufferCore palette contract instead of generic colour prompting', () => {
  const prompt = buildAssistantPrompt({ step: 'Colour', flavour: { displayName: 'Test', overrides: {} }, catalogue: [{ cssVariable: '--bc-color-identity-ramp-1', foundation: 'colour', path: ['identity','ramp-1'], valueType: 'color', value: 'initial' }], message: 'Build this palette' });
  assert.match(prompt, /Identity Ramp 1\/2\/3/);
  assert.match(prompt, /Ground is Canvas-only/);
  assert.match(prompt, /Tint\/Shade families are generated deterministically/);
  assert.match(prompt, /never invent Semantic mappings/i);
});

test('Colour AI receives source primitives only because Studio owns generated tone maths', () => {
  const catalogue = [
    { cssVariable:'--bc-color-identity-ramp-1', foundation:'colour', path:[], valueType:'color', value:'initial' },
    { cssVariable:'--bc-color-identity-ramp-1-tint-90', foundation:'colour', path:[], valueType:'color', value:'initial' },
    { cssVariable:'--bc-color-neutral-50', foundation:'colour', path:[], valueType:'color', value:'initial' },
    { cssVariable:'--bc-color-neutral-45', foundation:'colour', path:[], valueType:'color', value:'initial' }
  ];
  const prompt = buildAssistantPrompt({ step:'Colour', flavour:{overrides:{}}, catalogue, message:'help', history:[] });
  assert.match(prompt, /--bc-color-identity-ramp-1/);
  assert.match(prompt, /--bc-color-neutral-50/);
  assert.doesNotMatch(prompt, /--bc-color-identity-ramp-1-tint-90/);
  assert.doesNotMatch(prompt, /--bc-color-neutral-45/);
  assert.match(prompt, /generated deterministically by Studio/);
});

test('Semantic Colour AI response is constrained to per-target candidate lists', async () => {
  const { parseSemanticColourResponse } = await import('../src/ai.mjs');
  const sets=[{token:'--bc-color-fill-primary-strong',candidates:['--bc-color-identity-ramp-1-shade-20','--bc-color-identity-ramp-1-shade-30']}];
  const parsed=parseSemanticColourResponse(JSON.stringify({reply:'ok',mappings:[
    {semanticToken:'--bc-color-fill-primary-strong',primitiveToken:'--bc-color-identity-ramp-1-shade-30',reason:'best'},
    {semanticToken:'--bc-color-fill-primary-strong',primitiveToken:'--bc-color-neutral-50',reason:'illegal'},
    {semanticToken:'--bc-color-made-up',primitiveToken:'--bc-color-identity-ramp-1-shade-20'}
  ]}),sets);
  assert.deepEqual(parsed.mappings,[{semanticToken:'--bc-color-fill-primary-strong',primitiveToken:'--bc-color-identity-ramp-1-shade-30',reason:'best'}]);
});

test('Semantic Typography AI response cannot escape per-property Primitive candidates', async () => {
  const { parseSemanticTypographyResponse, buildSemanticTypographyPrompt } = await import('../src/ai.mjs');
  const sets=[{token:'--bc-type-paragraph-2-font-size',role:'paragraph',level:2,property:'font-size',current:'--bc-type-size-3',candidates:['--bc-type-size-2','--bc-type-size-3','--bc-type-size-4']}];
  const prompt=buildSemanticTypographyPrompt({candidateSets:sets,message:'Keep Paragraph 2 as the baseline'});
  assert.match(prompt,/Labels are not required to match Paragraph sizes/);
  assert.match(prompt,/Overline 1 should have clear visual prominence/);
  const parsed=parseSemanticTypographyResponse(JSON.stringify({reply:'ok',mappings:[
    {semanticToken:'--bc-type-paragraph-2-font-size',primitiveToken:'--bc-type-size-3',reason:'baseline'},
    {semanticToken:'--bc-type-paragraph-2-font-size',primitiveToken:'--bc-type-weight-700',reason:'illegal'}
  ]}),sets);
  assert.deepEqual(parsed.mappings,[{semanticToken:'--bc-type-paragraph-2-font-size',primitiveToken:'--bc-type-size-3',reason:'baseline'}]);
});


test('Semantic Colour plan prompt gives Local AI whole-family options with HEX and measured evidence', async () => {
  const { buildSemanticColourPlanPrompt } = await import('../src/ai.mjs');
  const batches=[{id:'B1',group:'Text',label:'general-normal',items:[
    {token:'--bc-color-text-muted',name:'Text Muted',purpose:'Low-emphasis readable text',accessibilityMinimum:'4.5:1',accessibilityRecommended:'7:1'}
  ],options:[{id:'O1',score:1.2,allMinimumsMet:true,visualQuality:{minSiblingDistance:5,averageChromaRetention:1,endpointCollapses:0},choices:[
    {token:'--bc-color-text-muted',source:'--bc-color-neutral-70',value:'#6f7072',contrast:4.7,meetsRecommended:false,perceptual:{chromaRetention:1}}
  ]}]}];
  const prompt=buildSemanticColourPlanPrompt({mode:'light',batches});
  assert.match(prompt,/whole families/i);
  assert.match(prompt,/#6f7072/);
  assert.match(prompt,/4\.7/);
  assert.match(prompt,/minSiblingDistance/);
  assert.match(prompt,/deterministic O1 default/);
  assert.doesNotMatch(prompt,/Choose exactly one candidate token from the supplied candidate list for each target/);
});

test('Semantic Colour plan parser rejects invented batch and option ids', async () => {
  const { parseSemanticColourPlanResponse } = await import('../src/ai.mjs');
  const batches=[{id:'B1',options:[{id:'O1'},{id:'O2'}]}];
  const parsed=parseSemanticColourPlanResponse(JSON.stringify({reply:'ok',batchSelections:[
    {batchId:'B1',optionId:'O2',reason:'valid'},
    {batchId:'B1',optionId:'O9',reason:'invented'},
    {batchId:'B99',optionId:'O1',reason:'invented batch'}
  ]}),batches);
  assert.deepEqual(parsed.batchSelections,[{batchId:'B1',optionId:'O2',reason:'valid'}]);
});


test('Semantic Colour plan prompt requires an explicit decision for every supplied family', async () => {
  const { buildSemanticColourPlanPrompt } = await import('../src/ai.mjs');
  const prompt = buildSemanticColourPlanPrompt({
    mode: 'light',
    batches: [{
      id:'B1', group:'Text', label:'Primary normal',
      items:[], options:[{id:'O1',score:0,allMinimumsMet:true,visualQuality:{},choices:[]}]
    }]
  });
  assert.match(prompt, /MUST return exactly one explicit selection for EVERY supplied batch/);
  assert.match(prompt, /including O1/);
  assert.doesNotMatch(prompt, /Return a selection only where/);
});

test('Semantic Colour Local AI review is chunked into explicit family-review passes', () => {
  const source = readFileSync(new URL('../src/ai.mjs', import.meta.url), 'utf8');
  assert.match(source, /const chunkSize = 8/);
  assert.match(source, /for \(let index = 0; index < chunks\.length; index \+= 1\)/);
  assert.match(source, /returned\.size !== required\.size/);
  assert.match(source, /requestCount/);
});


test('Semantic Colour Local AI captures real Ollama generation metrics per pass', () => {
  const source = readFileSync(new URL('../src/ai.mjs', import.meta.url), 'utf8');
  assert.match(source, /prompt_eval_count/);
  assert.match(source, /eval_count/);
  assert.match(source, /prompt_eval_duration/);
  assert.match(source, /eval_duration/);
  assert.match(source, /total_duration/);
  assert.match(source, /passStartedAt/);
  assert.match(source, /wallMs/);
  assert.match(source, /promptChars/);
  assert.match(source, /passes/);
  assert.match(source, /totals/);
});


test('Semantic Colour AI explicitly prefers family-preserving minimum-pass Strong over destructive 7:1 chasing', () => {
  const source = readFileSync(new URL('../src/ai.mjs', import.meta.url), 'utf8');
  assert.match(source, /4\.5–6\.99:1 candidate is a valid PASS/);
  assert.match(source, /preserve recognisable family identity\/chroma/);
  assert.match(source, /hueDrift/);
  assert.match(source, /baseDistance/);
});


test('Semantic Colour AI is told to judge the Strong quality frontier rather than blindly preferring closest or darkest', () => {
  const source = readFileSync(new URL('../src/ai.mjs', import.meta.url), 'utf8');
  assert.match(source, /quality frontier of viable Strong options/);
  assert.match(source, /Do not automatically prefer the closest tone, the darkest tone, or the later O-number/);
  assert.match(source, /genuinely Strong, recognisable family role/);
});
