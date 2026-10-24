import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createLocalServiceManager } from '../src/local-services.mjs';

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'buffercore-services-'));
  const studioRoot = path.join(root, 'BufferCore-Studio');
  const serviceRoot = path.join(root, 'Fake-Service');
  fs.mkdirSync(studioRoot, { recursive: true });
  fs.mkdirSync(serviceRoot, { recursive: true });
  return { root, studioRoot, serviceRoot };
}

test('local service manager starts, observes and stops an owned service', async (t) => {
  const { root, studioRoot, serviceRoot } = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const port = await freePort();
  const script = path.join(serviceRoot, 'server.mjs');
  fs.writeFileSync(script, `import http from 'node:http';\nhttp.createServer((req,res)=>{res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true}));}).listen(${port},'127.0.0.1');\n`, 'utf8');
  const manager = createLocalServiceManager({
    studioRoot,
    systemRoot: root,
    definitions: [{ id: 'fixture', name: 'Fixture', description: 'Test service', cwd: serviceRoot, script, port, healthUrl: `http://127.0.0.1:${port}/status` }]
  });
  const before = await manager.statusFor('fixture');
  assert.equal(before.state, 'stopped');
  const started = await manager.start('fixture');
  assert.equal(started.state, 'running');
  assert.equal(started.managed, true);
  assert.ok(started.pid);
  const stopped = await manager.stop('fixture');
  assert.equal(stopped.state, 'stopped');
  assert.equal(stopped.managed, false);
});

test('local service manager detects external services and will not terminate them', async (t) => {
  const { root, studioRoot, serviceRoot } = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const port = await freePort();
  const external = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}'); });
  await new Promise((resolve) => external.listen(port, '127.0.0.1', resolve));
  t.after(() => external.close());
  const manager = createLocalServiceManager({
    studioRoot,
    systemRoot: root,
    definitions: [{ id: 'fixture', name: 'Fixture', description: 'Test service', cwd: serviceRoot, script: path.join(serviceRoot, 'missing.mjs'), port, healthUrl: `http://127.0.0.1:${port}/status` }]
  });
  const status = await manager.statusFor('fixture');
  assert.equal(status.state, 'external');
  await assert.rejects(() => manager.stop('fixture'), /running externally/i);
});

test('local service preferences persist outside tracked Studio source', async (t) => {
  const { root, studioRoot, serviceRoot } = fixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const port = await freePort();
  const manager = createLocalServiceManager({
    studioRoot,
    systemRoot: root,
    definitions: [{ id: 'fixture', name: 'Fixture', description: 'Test service', cwd: serviceRoot, script: path.join(serviceRoot, 'missing.mjs'), port, healthUrl: `http://127.0.0.1:${port}/status` }]
  });
  const result = await manager.configure('fixture', { autoStart: true, stopWithStudio: true });
  assert.equal(result.autoStart, true);
  assert.equal(result.stopWithStudio, true);
  assert.equal(manager.settingsPath, path.join(studioRoot, '.local', 'services.json'));
  const saved = JSON.parse(fs.readFileSync(manager.settingsPath, 'utf8'));
  assert.deepEqual(saved.services.fixture, { autoStart: true, stopWithStudio: true });
});
