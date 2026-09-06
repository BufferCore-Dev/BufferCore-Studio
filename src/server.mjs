#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { repoState, commitAndPush } from './git.mjs';

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

function listFlavours() {
  const base = path.join(flavoursRoot, 'flavours');
  if (!fs.existsSync(base)) return [];
  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name === 'flavour.json') {
        const data = readJson(full) || {};
        found.push({
          id: data.id || path.basename(path.dirname(full)),
          displayName: data.displayName || data.name || data.id || path.basename(path.dirname(full)),
          path: path.relative(base, path.dirname(full)).split(path.sep).join('/')
        });
      }
    }
  };
  walk(base);
  return found.sort((a, b) => a.displayName.localeCompare(b.displayName));
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
    flavours: listFlavours(),
    manifests: manifestSummary()
  };
}

async function npm(cwd, args) {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return execFileAsync(command, args, { cwd, windowsHide: true, maxBuffer: 24 * 1024 * 1024 });
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
