#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { repoState, commitAndPush } from './git.mjs';
import { createFlavour, deleteFlavour, discoverFlavourDocuments, duplicateFlavour, getFlavourDocument, primitiveCatalogue, updateFlavour, updateFlavourOverrides, updateFlavourSemanticColourMappings, updateFlavourSemanticTypographyMappings } from './flavours.mjs';
import { aiConfig, discoverAiModels, persistAiModel, runAssistant, runSemanticColourAssistant, runSemanticTypographyAssistant } from './ai.mjs';
import { reviewFlavour } from './review.mjs';
import { applyFlavour } from '../../BufferCore-Engine/packages/flavour-engine.mjs';
import { buildSemanticCandidateSets, fixedSemanticMappings, semanticCompletion, validateSemanticMappings } from './semantic-colour.mjs';
import { buildTypographyCandidateSets, baselineTypographyMappings, effectiveTypographyMappings, normaliseTypographyOverrides, typographyCompletion, validateTypographyMappings } from './semantic-typography.mjs';

const execFileAsync = promisify(execFile);
const studioRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const systemRoot = path.resolve(studioRoot, '..');
const figmaRoot = path.resolve(systemRoot, 'BufferCore-Figma');
const engineRoot = path.resolve(systemRoot, 'BufferCore-Engine');
const coreRoot = path.resolve(systemRoot, 'BufferCore');
const flavoursRoot = path.resolve(systemRoot, 'BufferCore-Flavours');
const publicRoot = path.join(studioRoot, 'public');
const manifestPath = path.join(figmaRoot, 'generated', 'figma', 'buffercore.figma.json');
const engineManifestPath = path.join(engineRoot, 'generated', 'manifest', 'buffercore.json');
const port = Number(process.env.BUFFERCORE_STUDIO_PORT || 3850);
let busy = false;

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(data), 'cache-control': 'no-store' });
  res.end(data);
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function flavourLibrary() {
  const catalogue = primitiveCatalogue(readJson(engineManifestPath));
  const byCss = new Map(catalogue.map((token) => [token.cssVariable, token]));
  return discoverFlavourDocuments(flavoursRoot).map((item) => {
    const foundationCounts = {};
    for (const cssVariable of Object.keys(item.overrides || {})) {
      const foundation = byCss.get(cssVariable)?.foundation || 'unknown';
      foundationCounts[foundation] = (foundationCounts[foundation] || 0) + 1;
    }
    return {
      id: item.id,
      displayName: item.displayName,
      description: item.description,
      notes: item.notes,
      path: item.relativePath,
      overrideCount: Object.keys(item.overrides || {}).length,
      foundationCounts
    };
  });
}

function foundationCatalogue() {
  const catalogue = primitiveCatalogue(readJson(engineManifestPath));
  const foundations = {};
  for (const token of catalogue) {
    const id = token.foundation || 'unknown';
    foundations[id] ||= { id, primitiveCount: 0, valueTypes: {}, tokens: [] };
    foundations[id].primitiveCount += 1;
    foundations[id].valueTypes[token.valueType] = (foundations[id].valueTypes[token.valueType] || 0) + 1;
    foundations[id].tokens.push(token);
  }
  return { primitiveCount: catalogue.length, foundations: Object.values(foundations).sort((a, b) => a.id.localeCompare(b.id)) };
}

function manifestSummary() {
  const figma = readJson(manifestPath);
  const engine = readJson(engineManifestPath);
  return {
    engine: engine ? {
      schemaVersion: engine.schemaVersion,
      generatedAt: engine.generatedAt,
      tokens: Array.isArray(engine.tokens) ? engine.tokens.length : 0,
      flavour: engine.flavour || null,
      repository: engine.repository || engine.source?.repository || null
    } : null,
    figma: figma ? {
      schemaVersion: figma.schemaVersion,
      generatedAt: figma.generatedAt,
      variables: Array.isArray(figma.variables) ? figma.variables.length : 0,
      styles: Array.isArray(figma.styles) ? figma.styles.length : 0,
      collections: Array.isArray(figma.collections) ? figma.collections.length : 0,
      flavour: figma.flavour || null,
      repository: figma.repository || figma.source?.repository || null
    } : null
  };
}

function currentPrimitiveCatalogue() {
  return primitiveCatalogue(readJson(engineManifestPath));
}

function stepCatalogue(step) {
  const foundationsByStep = {
    Colour: ['colour'],
    Typography: ['typography'],
    Shape: ['radius', 'borders', 'stroke'],
    'Spacing & Scale': ['spacing', 'sizing', 'containers'],
    Depth: ['shadows', 'effects'],
    Motion: ['motion']
  };
  const foundations = foundationsByStep[step] || [];
  return currentPrimitiveCatalogue().filter((token) => foundations.includes(token.foundation));
}

function status() {
  return {
    ok: true,
    busy,
    repositories: {
      core: repoState(coreRoot),
      flavours: repoState(flavoursRoot),
      engine: repoState(engineRoot),
      figma: repoState(figmaRoot),
      studio: repoState(studioRoot)
    },
    flavours: flavourLibrary(),
    catalogue: foundationCatalogue(),
    ai: (() => { const config = aiConfig(); return { url: config.url, source: config.source, registryPath: config.registryPath, modelStore: config.modelStore, registryAvailable: config.registryAvailable, appRegistered: config.appRegistered }; })(),
    manifests: manifestSummary()
  };
}

async function npm(cwd, args) {
  const invocation = process.env.npm_execpath
    ? { command: process.execPath, args: [process.env.npm_execpath, ...args] }
    : process.platform === 'win32'
      ? { command: process.env.ComSpec || process.env.COMSPEC || 'cmd.exe', args: ['/d', '/s', '/c', 'npm', ...args] }
      : { command: 'npm', args };
  return execFileAsync(invocation.command, invocation.args, { cwd, windowsHide: true, maxBuffer: 24 * 1024 * 1024 });
}

async function pullBuild(flavour) {
  if (busy) throw new Error('Another Studio operation is already running.');
  busy = true;
  try {
    const args = ['run', 'repo:sync'];
    if (flavour) args.push('--', '--flavour', flavour);
    const { stdout, stderr } = await npm(figmaRoot, args);
    return { ok: true, stdout, stderr, status: status() };
  } finally { busy = false; }
}

async function validate() {
  if (busy) throw new Error('Another Studio operation is already running.');
  busy = true;
  try {
    const engine = await npm(engineRoot, ['run', 'core:validate']);
    const figma = await npm(figmaRoot, ['run', 'figma:validate']);
    return { ok: true, engine: engine.stdout, figma: figma.stdout, status: status() };
  } finally { busy = false; }
}


async function buildFlavourForFigma(flavourId) {
  if (busy) throw new Error('Another Studio operation is already running.');
  const flavour = getFlavourDocument(flavoursRoot, flavourId);
  if (!flavour) throw new Error(`Flavour "${flavourId}" was not found.`);
  const review = reviewFlavour(flavour, currentPrimitiveCatalogue());
  if (!review.ok) throw new Error('Flavour review contains blocking errors.');
  busy = true;
  try {
    const engine = await npm(engineRoot, ['run', 'core:build', '--', '--core', coreRoot, '--flavours-root', flavoursRoot, '--flavour', flavourId]);
    const figma = await npm(figmaRoot, ['run', 'figma:build', '--', '--engine', engineRoot]);
    return { ok: true, review, engine: engine.stdout, figma: figma.stdout, status: status() };
  } finally { busy = false; }
}

function semanticColourPreview(flavourInput) {
  const manifest = readJson(engineManifestPath);
  if (!manifest?.tokens) throw new Error('Build the BufferCore Engine manifest before previewing colour semantics.');
  const flavour = {
    schemaVersion: 1,
    type: 'buffercore-flavour',
    id: String(flavourInput?.id || 'studio-preview'),
    displayName: String(flavourInput?.displayName || 'Studio preview'),
    overrides: flavourInput?.overrides && typeof flavourInput.overrides === 'object' ? flavourInput.overrides : {},
    file: path.join(flavoursRoot, String(flavourInput?.id || 'studio-preview'), 'flavour.json')
  };
  const resolved = applyFlavour(manifest, flavour, { engineRoot });
  if (resolved.diagnostics?.errors?.length) throw new Error(resolved.diagnostics.errors.map(item => item.message).join(' '));
  const modes = { light: [], dark: [] };
  for (const token of resolved.tokens.filter(item => item.layer === 'semantic' && item.foundation === 'colour')) {
    for (const variant of token.variants || []) {
      const values = Object.values(variant.context?.modes || {}).map(value => String(value).toLowerCase());
      const mode = values.includes('dark') ? 'dark' : values.includes('light') ? 'light' : null;
      if (!mode) continue;
      const pathParts = Array.isArray(token.path) ? token.path.map(part => String(part)) : [];
      const colourIndex = pathParts.findIndex(part => part.toLowerCase() === 'colour');
      const meaningful = colourIndex >= 0 ? pathParts.slice(colourIndex + 1) : pathParts;
      const group = meaningful[0] ? meaningful[0].replace(/(^|[-_])(\w)/g, (_, p, c) => `${p ? ' ' : ''}${c.toUpperCase()}`) : 'Other';
      const label = meaningful.slice(1).join(' / ').replace(/[-_]/g, ' ') || token.cssVariable.replace(/^--bc-color-/, '').replace(/-/g, ' ');
      modes[mode].push({ cssVariable: token.cssVariable, group, label, value: variant.resolved || variant.rawValue || 'initial' });
    }
  }
  for (const mode of Object.keys(modes)) modes[mode].sort((a, b) => a.group.localeCompare(b.group) || a.cssVariable.localeCompare(b.cssVariable));
  return { ok: true, modes };
}

async function body(req) {
  let raw = '';
  req.setEncoding('utf8');
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw new Error('Invalid JSON request.'); }
}

function serveStatic(req, res) {
  const route = req.url === '/' ? '/index.html' : req.url;
  const file = path.normalize(path.join(publicRoot, route));
  if (!file.startsWith(publicRoot) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  const ext = path.extname(file);
  const type = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.css' ? 'text/css; charset=utf-8' : ext === '.js' ? 'text/javascript; charset=utf-8' : 'application/octet-stream';
  res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/api/status') return sendJson(res, 200, status());
    if (req.method === 'GET' && req.url.match(/^\/api\/flavours\/[^/]+\/typography-semantics$/)) {
      const id = decodeURIComponent(req.url.split('/')[3]);
      const flavour = getFlavourDocument(flavoursRoot, id);
      if (!flavour) return sendJson(res, 404, { ok: false, error: 'Flavour not found.' });
      const manifest = readJson(engineManifestPath);
      return sendJson(res, 200, { ok: true, mappings: flavour.semanticMappings?.typography || {}, baselineMappings: baselineTypographyMappings(manifest), effectiveMappings: effectiveTypographyMappings(manifest, flavour), candidateSets: buildTypographyCandidateSets(manifest, flavour), completion: typographyCompletion(manifest, flavour) });
    }
    if (req.method === 'POST' && req.url.match(/^\/api\/flavours\/[^/]+\/typography-semantics\/generate$/)) {
      const id = decodeURIComponent(req.url.split('/')[3]);
      const data = await body(req);
      const flavour = getFlavourDocument(flavoursRoot, id);
      if (!flavour) return sendJson(res, 404, { ok: false, error: 'Flavour not found.' });
      const manifest = readJson(engineManifestPath);
      const sets = buildTypographyCandidateSets(manifest, flavour);
      const existing = flavour.semanticMappings?.typography || {};
      const ai = await runSemanticTypographyAssistant({ candidateSets: sets, existing, message: String(data.message || '').trim(), model: data.model });
      const proposed = { ...existing };
      for (const item of ai.mappings || []) proposed[item.semanticToken] = item.primitiveToken;
      const selected = normaliseTypographyOverrides(manifest, proposed);
      const saved = updateFlavourSemanticTypographyMappings(flavoursRoot, id, selected, (mappings) => validateTypographyMappings(manifest, mappings));
      return sendJson(res, 200, { ok: true, flavour: saved, reply: ai.reply, model: ai.model, mappings: saved.semanticMappings?.typography || {}, baselineMappings: baselineTypographyMappings(manifest), effectiveMappings: effectiveTypographyMappings(manifest, saved), completion: typographyCompletion(manifest, saved), candidateSets: buildTypographyCandidateSets(manifest, saved), status: status() });
    }
    if (req.method === 'PATCH' && req.url.match(/^\/api\/flavours\/[^/]+\/typography-semantics$/)) {
      const id = decodeURIComponent(req.url.split('/')[3]);
      const data = await body(req);
      const flavour = getFlavourDocument(flavoursRoot, id);
      if (!flavour) return sendJson(res, 404, { ok: false, error: 'Flavour not found.' });
      const manifest = readJson(engineManifestPath);
      const normalised = normaliseTypographyOverrides(manifest, data.mappings || {});
      const saved = updateFlavourSemanticTypographyMappings(flavoursRoot, id, normalised, (mappings) => validateTypographyMappings(manifest, mappings));
      return sendJson(res, 200, { ok: true, flavour: saved, mappings: saved.semanticMappings?.typography || {}, baselineMappings: baselineTypographyMappings(manifest), effectiveMappings: effectiveTypographyMappings(manifest, saved), candidateSets: buildTypographyCandidateSets(manifest, saved), completion: typographyCompletion(manifest, saved), status: status() });
    }
    if (req.method === 'GET' && req.url.match(/^\/api\/flavours\/[^/]+\/colour-semantics\/(light|dark)$/)) {
      const parts = req.url.split('/');
      const id = decodeURIComponent(parts[3]);
      const mode = parts[5];
      const flavour = getFlavourDocument(flavoursRoot, id);
      if (!flavour) return sendJson(res, 404, { ok: false, error: 'Flavour not found.' });
      return sendJson(res, 200, { ok: true, mode, mappings: flavour.semanticMappings?.colour?.[mode] || {}, candidateSets: buildSemanticCandidateSets(flavour, mode), completion: semanticCompletion(flavour, mode) });
    }
    if (req.method === 'POST' && req.url.match(/^\/api\/flavours\/[^/]+\/colour-semantics\/(light|dark)\/generate$/)) {
      const parts = req.url.split('/');
      const id = decodeURIComponent(parts[3]);
      const mode = parts[5];
      const data = await body(req);
      const flavour = getFlavourDocument(flavoursRoot, id);
      if (!flavour) return sendJson(res, 404, { ok: false, error: 'Flavour not found.' });
      const sets = buildSemanticCandidateSets(flavour, mode);
      const fixed = fixedSemanticMappings(flavour, mode);
      const existing = flavour.semanticMappings?.colour?.[mode] || {};
      const ambiguous = sets.filter((set) => !set.fixed && set.candidates.length > 1);
      let ai = { reply: 'All available mappings were fixed by the BufferCore contract.', mappings: [], model: null };
      if (ambiguous.length) ai = await runSemanticColourAssistant({ mode, candidateSets: sets, existing, message: String(data.message || '').trim(), model: data.model });
      const selected = { ...fixed };
      for (const set of sets) {
        if (!selected[set.token] && set.candidates.length === 1) selected[set.token] = set.candidates[0];
      }
      for (const item of ai.mappings || []) selected[item.semanticToken] = item.primitiveToken;
      const missingAi = sets.filter((set) => set.candidates.length > 1 && !selected[set.token]);
      if (missingAi.length) throw new Error(`Local AI did not return legal selections for ${missingAi.length} Semantic colour role(s). Regenerate or review the model output.`);
      const saved = updateFlavourSemanticColourMappings(flavoursRoot, id, mode, selected, validateSemanticMappings);
      return sendJson(res, 200, { ok: true, flavour: saved, mode, reply: ai.reply, model: ai.model, completion: semanticCompletion(saved, mode), candidateSets: buildSemanticCandidateSets(saved, mode), status: status() });
    }
    if (req.method === 'PATCH' && req.url.match(/^\/api\/flavours\/[^/]+\/colour-semantics\/(light|dark)$/)) {
      const parts = req.url.split('/');
      const id = decodeURIComponent(parts[3]);
      const mode = parts[5];
      const data = await body(req);
      const flavour = getFlavourDocument(flavoursRoot, id);
      if (!flavour) return sendJson(res, 404, { ok: false, error: 'Flavour not found.' });
      const saved = updateFlavourSemanticColourMappings(flavoursRoot, id, mode, data.mappings || {}, validateSemanticMappings);
      return sendJson(res, 200, { ok: true, flavour: saved, completion: semanticCompletion(saved, mode), status: status() });
    }
    if (req.method === 'GET' && req.url.startsWith('/api/flavours/')) {
      const id = decodeURIComponent(req.url.slice('/api/flavours/'.length));
      const flavour = getFlavourDocument(flavoursRoot, id);
      if (!flavour) return sendJson(res, 404, { ok: false, error: 'Flavour not found.' });
      return sendJson(res, 200, { ok: true, flavour });
    }
    if (req.method === 'POST' && req.url === '/api/flavours') {
      const data = await body(req);
      const flavour = createFlavour(flavoursRoot, data);
      return sendJson(res, 201, { ok: true, flavour, status: status() });
    }
    if (req.method === 'PATCH' && req.url.match(/^\/api\/flavours\/[^/]+\/overrides$/)) {
      const id = decodeURIComponent(req.url.split('/')[3]);
      const data = await body(req);
      const flavour = updateFlavourOverrides(flavoursRoot, id, data.overrides || {}, currentPrimitiveCatalogue());
      return sendJson(res, 200, { ok: true, flavour, status: status() });
    }
    if (req.url.startsWith('/api/flavours/')) {
      const suffix = req.url.slice('/api/flavours/'.length);
      const duplicate = suffix.endsWith('/duplicate');
      const id = decodeURIComponent(duplicate ? suffix.slice(0, -'/duplicate'.length) : suffix);
      if (req.method === 'PATCH' && !duplicate) {
        const data = await body(req);
        const flavour = updateFlavour(flavoursRoot, id, data);
        return sendJson(res, 200, { ok: true, flavour, status: status() });
      }
      if (req.method === 'POST' && duplicate) {
        const data = await body(req);
        const flavour = duplicateFlavour(flavoursRoot, id, data);
        return sendJson(res, 201, { ok: true, flavour, status: status() });
      }
      if (req.method === 'DELETE' && !duplicate) {
        deleteFlavour(flavoursRoot, id);
        return sendJson(res, 200, { ok: true, status: status() });
      }
    }
    if (req.method === 'GET' && req.url === '/api/ai/status') {
      const config = aiConfig();
      const state = await discoverAiModels({ config });
      return sendJson(res, 200, { ok: true, ...state, url: config.url, source: config.source, registryPath: config.registryPath, modelStore: config.modelStore, registryAvailable: config.registryAvailable, appRegistered: config.appRegistered });
    }
    if (req.method === 'POST' && req.url === '/api/ai/model') {
      const data = await body(req);
      const config = persistAiModel(String(data.model || '').trim());
      return sendJson(res, 200, { ok: true, model: config.model || null, source: config.source, registryAvailable: config.registryAvailable, appRegistered: config.appRegistered });
    }
    if (req.method === 'POST' && req.url === '/api/colour-preview') {
      const data = await body(req);
      return sendJson(res, 200, semanticColourPreview(data.flavour || {}));
    }
    if (req.method === 'POST' && req.url === '/api/ai/assist') {
      const data = await body(req);
      const allowedSteps = new Set(['Identity', 'Colour', 'Typography', 'Shape', 'Spacing & Scale', 'Depth', 'Motion', 'Review']);
      const step = allowedSteps.has(data.step) ? data.step : 'Identity';
      const flavour = data.flavourId ? getFlavourDocument(flavoursRoot, data.flavourId) : data.flavour;
      if (!flavour) return sendJson(res, 400, { ok: false, error: 'Save or provide the Flavour before asking AI for design guidance.' });
      const result = await runAssistant({ step, flavour, catalogue: stepCatalogue(step), message: String(data.message || '').trim(), history: Array.isArray(data.history) ? data.history : [], model: data.model });
      return sendJson(res, 200, { ok: true, ...result });
    }
    if (req.method === 'GET' && req.url.match(/^\/api\/flavours\/[^/]+\/review$/)) {
      const id = decodeURIComponent(req.url.split('/')[3]);
      const flavour = getFlavourDocument(flavoursRoot, id);
      if (!flavour) return sendJson(res, 404, { ok: false, error: 'Flavour not found.' });
      return sendJson(res, 200, { ok: true, review: reviewFlavour(flavour, currentPrimitiveCatalogue()) });
    }
    if (req.method === 'POST' && req.url.match(/^\/api\/flavours\/[^/]+\/build-figma$/)) {
      const id = decodeURIComponent(req.url.split('/')[3]);
      return sendJson(res, 200, await buildFlavourForFigma(id));
    }
    if (req.method === 'POST' && req.url === '/api/pull-build') {
      const data = await body(req);
      return sendJson(res, 200, await pullBuild(data.flavour || null));
    }
    if (req.method === 'POST' && req.url === '/api/validate') return sendJson(res, 200, await validate());
    if (req.method === 'POST' && req.url === '/api/commit-push') {
      const data = await body(req);
      const allowed = new Map([
        ['core', coreRoot], ['flavours', flavoursRoot], ['engine', engineRoot], ['figma', figmaRoot], ['studio', studioRoot]
      ]);
      const repo = allowed.get(data.repository);
      if (!repo) return sendJson(res, 400, { ok: false, error: 'Unknown repository.' });
      const result = commitAndPush(repo, data.message || '');
      return sendJson(res, 200, { ok: true, repository: data.repository, state: result, status: status() });
    }
    if (serveStatic(req, res)) return;
    return sendJson(res, 404, { ok: false, error: 'Not found.' });
  } catch (error) {
    return sendJson(res, 409, { ok: false, error: error?.message || String(error), status: status() });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`BufferCore Studio sync surface: http://127.0.0.1:${port}`);
});
