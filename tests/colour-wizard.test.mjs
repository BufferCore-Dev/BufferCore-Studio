import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const styles = fs.readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
const app = fs.readFileSync(path.join(here, '..', 'public', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(here, '..', 'public', 'styles.css'), 'utf8');
const server = fs.readFileSync(path.join(here, '..', 'src', 'server.mjs'), 'utf8');

test('Colour follows Palette → Meaning → Light → Dark → Review with guided Semantic chapters', () => {
  assert.match(app, /colour-flow-nav/);
  assert.match(app, /colour-flow-subnav/);
  assert.match(app, /title:'Meaning'/);
  assert.match(app, /title:'Light Semantics'/);
  assert.match(app, /title:'Dark Semantics'/);
  assert.match(app, /title:'Colour Review'/);
  assert.match(app, /semantic-chapter-tabs/);
  assert.match(app, /semantic-visual-review/);
  assert.match(app, /semantic-technical/);
  assert.match(css, /\.colour-flow-nav/);
  assert.match(css, /\.semantic-family-lanes/);
});

test('Colour source editing generates families deterministically rather than asking users to fill every token', () => {
  assert.match(app, /generatedOverrides/);
  assert.match(app, /source-hex/);
  assert.match(app, /Generated Neutral 0–100/);
  assert.match(app, /deterministic/i);
});

test('Semantic Colour generation uses coherent perceptual plans rather than token-by-token AI mapping', () => {
  assert.match(app, /Build .*with AI/);
  assert.match(app, /OKLab\/OKLCH/);
  assert.match(app, /Local AI judges those options/);
  assert.match(server, /runSemanticColourPlanAssistant/);
  assert.match(server, /semanticDesignBatches/);
  assert.match(server, /buildProvenance/);
  assert.match(server, /buildMode === 'deterministic'/);
  assert.match(server, /applyFlavour/);
});

test('Colour AI remains contextual but proposals are explicitly reviewed', () => {
  assert.match(app, /data-colour-ai/);
  assert.match(app, /Ask AI/);
  assert.match(app, /Review this complete Primitive palette/);
});


test('Colour reset controls are scoped before the destructive whole-Foundation reset', () => {
  assert.match(app, /data-reset-colour-set="primitive"/);
  assert.match(app, /data-reset-colour-set="semantic-group"/);
  assert.match(app, /data-reset-colour-set="semantic-mode"/);
  assert.match(app, /Reset entire Colour Foundation/);
  assert.match(app, /This clears only the .* Semantic mappings/);
  assert.match(app, /The rest of your palette .* are kept/);
});


test('Semantic AI build saves the current Primitive palette before generation', () => {
  assert.match(app, /generateSemanticMode\(mode,buildMode='ai'\).*Unsaved changes.*await saveCurrent\(\).*colour-semantics\/\$\{mode\}\/generate/s);
});


test('Semantic Colour server is wired to the family-plan AI assistant and build provenance response', () => {
  assert.match(server, /runSemanticColourPlanAssistant/);
  assert.doesNotMatch(server, /runSemanticColourAssistant,/);
  assert.match(server, /semanticDesignBatches/);
  assert.match(server, /buildProvenance/);
  assert.match(server, /aiSelectionCount/);
  assert.match(server, /deterministicDefaultCount/);
});


test('Semantic Colour runtime state is declared before Light/Dark rendering uses it', () => {
  assert.match(app, /let semanticBuildStatus = \{ light:null, dark:null \};/);
  assert.match(app, /function semanticBuildProvenance\(mode\)/);
  assert.match(app, /semanticBuildStatus\[mode\]/);
});

test('scoped Colour resets use the Studio toast system rather than an undefined toast helper', () => {
  assert.doesNotMatch(app, /(^|[^\w])toast\(/m);
  assert.match(app, /studioToast\(affected\.length/);
  assert.match(app, /studioToast\(removed/);
  assert.match(app, /studioToast\(`\$\{modeTitle\} Semantics reset\./);
});


test('guided Semantic workspace prevents its toolbar from squeezing the explanatory copy', () => {
  assert.match(styles, /\.guided-semantic-workspace \.semantic-generation-head\{[\s\S]*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(styles, /\.guided-semantic-workspace \.semantic-generation-actions\{[\s\S]*flex-wrap:wrap/);
  assert.match(styles, /\.guided-semantic-workspace \.semantic-chapter-tabs\{[\s\S]*auto-fit/);
  assert.match(styles, /\.guided-semantic-workspace \.semantic-family-strip\{[\s\S]*auto-fit/);
});


test('Colour contract no longer contains redundant chromatic Text Base Inverse roles', () => {
  assert.doesNotMatch(app, /Text Primary Inverse Strong/);
  const contractSource = fs.readFileSync(new URL('../src/colour-contract.json', import.meta.url), 'utf8');
  assert.doesNotMatch(contractSource, /"name": "Text (Primary|Secondary|Accent|Success|Warning|Error|Info) Inverse"/);
  assert.match(contractSource, /"name": "Text Primary Strong Inverse"/);
});


test('AI Semantic rebuild is explicitly fresh and reports actual AI batch coverage', () => {
  assert.match(app, /fresh:true/);
  assert.match(app, /AI reviewed \$\{p\.aiSelectionCount\|\|0\}\/\$\{p\.batchCount\|\|0\} colour families/);
  assert.match(app, /semanticBuildStatus\[mode\]=null/);
  assert.match(server, /const buildBaseline = freshBuild \? \{\} : existing/);
  assert.match(server, /SEMANTIC_AI_INCOMPLETE/);
  assert.match(server, /answeredBatchIds\.size !== batches\.length/);
  assert.match(server, /Nothing was saved/);
  assert.match(server, /deterministicDefaultCount: buildMode === 'ai' \? 0 : batches\.length/);
});


test('AI Semantic success provenance includes the number of real Local AI passes', () => {
  assert.match(server, /aiRequestCount: buildMode === 'ai'/);
  assert.match(app, /colour families across \$\{p\.aiRequestCount\|\|1\} Local AI pass/);
});


test('Palette phase exposes source-only Colour import and export controls', () => {
  assert.match(app, /data-import-colour-palette/);
  assert.match(app, /data-export-colour-palette/);
  assert.match(app, /buffercore-colour-source-palette/);
  assert.match(app, /COLOUR_PALETTE_EXPORT_VERSION=1/);
  assert.match(app, /colourSourceTokens\(\)/);
});

test('Palette import validates all 17 canonical source colours and regenerates derived values', () => {
  assert.match(app, /Palette is incomplete/);
  assert.match(app, /Palette contains invalid HEX/);
  assert.match(app, /Palette contains unknown source token/);
  assert.match(app, /generatedOverrides\(token,value,all\)/);
  assert.match(app, /semanticState=\{light:null,dark:null\}/);
  assert.match(app, /Existing Light\/Dark mappings were preserved but should be rebuilt/);
});

test('Palette export contains source colours only rather than generated or Semantic mappings', () => {
  assert.match(app, /const sources=\{\}/);
  assert.match(app, /sources\[token\]=value/);
  assert.doesNotMatch(app, /function colourPaletteExportDocument\(\)[\s\S]{0,900}semanticMappings/);
  assert.match(app, /17 Colour source values only/);
});


test('Palette export does not shadow the browser document API', () => {
  assert.match(app, /const paletteDocument=colourPaletteExportDocument\(\)/);
  assert.match(app, /globalThis\.document\.createElement\('a'\)/);
  assert.match(app, /globalThis\.document\.body\.appendChild\(link\)/);
  assert.doesNotMatch(app, /const document=colourPaletteExportDocument\(\)/);
});

test('Palette import/export remains a Studio-only convenience layer', () => {
  assert.match(app, /COLOUR_PALETTE_EXPORT_TYPE='buffercore-colour-source-palette'/);
  assert.doesNotMatch(app, /api\/.*colour-palette.*export/);
  assert.doesNotMatch(app, /api\/.*colour-palette.*import/);
  assert.match(app, /new Blob\(\[json\],\{type:'application\/json'\}\)/);
});


test('final Colour Review exposes a Studio-only review snapshot export', () => {
  assert.match(app, /data-export-colour-review/);
  assert.match(app, /COLOUR_REVIEW_EXPORT_TYPE='buffercore-studio-colour-review'/);
  assert.match(app, /COLOUR_REVIEW_EXPORT_VERSION=1/);
  assert.match(app, /studioOnly:true/);
  assert.match(app, /Not a BufferCore Core, Flavour, Engine, Figma or Git artifact/);
});

test('Colour Review export carries palette mappings resolved values findings and provenance', () => {
  assert.match(app, /palette:\{/);
  assert.match(app, /sources:palette\.sources/);
  assert.match(app, /resolvedMappings\[target\]=\{/);
  assert.match(app, /value:colourSourceValue\(source\)\|\|null/);
  assert.match(app, /accessibility/);
  assert.match(app, /findings:Array\.isArray\(state\.findings\)/);
  assert.match(app, /buildProvenance:state\.buildProvenance/);
});

test('Colour Review export is browser-only and cannot mutate canonical BufferCore data', () => {
  assert.match(app, /new Blob\(\[json\],\{type:'application\/json'\}\)/);
  assert.match(app, /link\.download=`\$\{id\}-colour-review\.json`/);
  assert.doesNotMatch(app, /api\/.*colour-review.*export/);
  assert.doesNotMatch(app, /api\/.*colour-review.*import/);
});


test('AI Semantic build produces auditable deterministic-vs-AI family decisions', () => {
  assert.match(server, /const aiReview = buildMode === 'ai'/);
  assert.match(server, /deterministicOption/);
  assert.match(server, /selectedOption/);
  assert.match(server, /differedFromDeterministic/);
  assert.match(server, /choiceCounts/);
  assert.match(server, /differentFromDeterministic/);
  assert.match(server, /reason: String\(selection\.reason/);
});

test('final Colour Review surfaces compact AI audit evidence', () => {
  assert.match(app, /function colourAiReviewCard/);
  assert.match(app, /AI changed \$\{different\} of \$\{review\.familyCount\|\|0\}/);
  assert.match(app, /Prompt tokens/);
  assert.match(app, /Generated tokens/);
  assert.match(app, /Local AI passes/);
  assert.match(app, /Family decisions/);
});

test('Studio-only Colour Review export includes full AI audit without altering canonical exports', () => {
  assert.match(app, /aiReview:state\.aiReview\|\|semanticBuildStatus/);
  assert.match(app, /studioOnly:true/);
  assert.doesNotMatch(server, /updateFlavour.*aiReview/);
  assert.doesNotMatch(server, /semanticMappings.*aiReview/);
});


test('minimum-pass chromatic Strong is shown as a valid family-preserving PASS', () => {
  assert.match(app, /Minimum · family-preserving/);
  assert.match(app, /valid minimum-pass/);
});
