import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function probe(url, timeoutMs = 450) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        if ((res.statusCode || 500) >= 400) return finish({ ok: false, statusCode: res.statusCode });
        try { finish({ ok: true, body: raw ? JSON.parse(raw) : null, statusCode: res.statusCode }); }
        catch { finish({ ok: true, body: null, statusCode: res.statusCode }); }
      });
    });
    req.on('timeout', () => { req.destroy(); finish({ ok: false, timeout: true }); });
    req.on('error', () => finish({ ok: false }));
  });
}

export function defaultServiceDefinitions(systemRoot) {
  const figmaRoot = path.resolve(systemRoot, 'BufferCore-Figma');
  return [{
    id: 'figma-bridge',
    name: 'Figma Bridge',
    description: 'Connects the BufferCore Figma plugin to the local repositories and generated manifests.',
    kind: 'node',
    cwd: figmaRoot,
    script: path.join(figmaRoot, 'tools', 'repository-bridge.mjs'),
    port: Number(process.env.BUFFERCORE_FIGMA_BRIDGE_PORT || 3847),
    healthUrl: `http://127.0.0.1:${Number(process.env.BUFFERCORE_FIGMA_BRIDGE_PORT || 3847)}/status`
  }];
}

export function createLocalServiceManager({ studioRoot, systemRoot, definitions = defaultServiceDefinitions(systemRoot), spawnProcess = spawn } = {}) {
  if (!studioRoot || !systemRoot) throw new Error('studioRoot and systemRoot are required.');
  const settingsPath = path.join(studioRoot, '.local', 'services.json');
  const owned = new Map();
  const logs = new Map();
  const definitionById = new Map(definitions.map((service) => [service.id, service]));

  const settings = () => {
    const data = readJson(settingsPath, { schemaVersion: 1, services: {} });
    return { schemaVersion: 1, services: data?.services && typeof data.services === 'object' ? data.services : {} };
  };

  const writeSettings = (next) => {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(next, null, 2) + '\n', 'utf8');
  };

  const appendLog = (id, stream, chunk) => {
    const entries = logs.get(id) || [];
    for (const line of String(chunk || '').split(/\r?\n/).filter(Boolean)) {
      entries.push({ at: new Date().toISOString(), stream, line });
    }
    if (entries.length > 80) entries.splice(0, entries.length - 80);
    logs.set(id, entries);
  };

  const def = (id) => {
    const service = definitionById.get(id);
    if (!service) throw new Error(`Unknown local service: ${id}`);
    return service;
  };

  const ownedEntry = (id) => {
    const entry = owned.get(id);
    if (entry && entry.child?.exitCode !== null) {
      owned.delete(id);
      return null;
    }
    return entry || null;
  };

  async function statusFor(id) {
    const service = def(id);
    const entry = ownedEntry(id);
    const health = await probe(service.healthUrl);
    let state = 'stopped';
    if (health.ok) state = entry ? 'running' : 'external';
    else if (entry) state = Date.now() - entry.startedAt < 8000 ? 'starting' : 'error';
    const config = settings().services[id] || {};
    return {
      id: service.id,
      name: service.name,
      description: service.description,
      state,
      running: health.ok,
      managed: Boolean(entry),
      pid: entry?.child?.pid || null,
      port: service.port,
      healthUrl: service.healthUrl,
      autoStart: Boolean(config.autoStart),
      stopWithStudio: Boolean(config.stopWithStudio),
      startedAt: entry?.startedAt ? new Date(entry.startedAt).toISOString() : null,
      health: health.body || null,
      logs: (logs.get(id) || []).slice(-24)
    };
  }

  async function list() {
    return Promise.all(definitions.map((service) => statusFor(service.id)));
  }

  async function waitForHealth(id, attempts = 40) {
    const service = def(id);
    for (let i = 0; i < attempts; i += 1) {
      const health = await probe(service.healthUrl, 300);
      if (health.ok) return true;
      const entry = ownedEntry(id);
      if (!entry) return false;
      await sleep(100);
    }
    return false;
  }

  async function start(id) {
    const service = def(id);
    const current = await statusFor(id);
    if (current.running) return current;
    if (!fs.existsSync(service.script)) throw new Error(`${service.name} entrypoint was not found: ${service.script}`);

    appendLog(id, 'system', `Starting ${service.name}…`);
    const child = spawnProcess(process.execPath, [service.script], {
      cwd: service.cwd,
      windowsHide: true,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const entry = { child, startedAt: Date.now() };
    owned.set(id, entry);
    child.stdout?.on('data', (chunk) => appendLog(id, 'stdout', chunk));
    child.stderr?.on('data', (chunk) => appendLog(id, 'stderr', chunk));
    child.on('error', (error) => appendLog(id, 'stderr', error?.message || String(error)));
    child.on('exit', (code, signal) => {
      appendLog(id, 'system', `${service.name} exited${code !== null ? ` with code ${code}` : ''}${signal ? ` (${signal})` : ''}.`);
      if (owned.get(id)?.child === child) owned.delete(id);
    });

    const healthy = await waitForHealth(id);
    if (!healthy) {
      const result = await statusFor(id);
      if (result.state === 'error' || result.state === 'stopped') throw new Error(`${service.name} did not become available. Check the service log in Studio.`);
      return result;
    }
    appendLog(id, 'system', `${service.name} is available on port ${service.port}.`);
    return statusFor(id);
  }

  async function stop(id) {
    def(id);
    const entry = ownedEntry(id);
    if (!entry) {
      const current = await statusFor(id);
      if (current.running) throw new Error(`${current.name} is running externally. Studio will not terminate a process it did not start.`);
      return current;
    }
    appendLog(id, 'system', `Stopping ${def(id).name}…`);
    entry.child.kill();
    for (let i = 0; i < 30 && ownedEntry(id); i += 1) await sleep(100);
    if (ownedEntry(id)) {
      entry.child.kill('SIGKILL');
      await sleep(100);
    }
    owned.delete(id);
    return statusFor(id);
  }

  async function restart(id) {
    const current = await statusFor(id);
    if (current.state === 'external') throw new Error(`${current.name} is running externally. Stop that process first, or keep using the external bridge.`);
    if (current.managed) await stop(id);
    return start(id);
  }

  async function configure(id, patch = {}) {
    def(id);
    const next = settings();
    const current = next.services[id] || {};
    next.services[id] = {
      ...current,
      ...(Object.hasOwn(patch, 'autoStart') ? { autoStart: Boolean(patch.autoStart) } : {}),
      ...(Object.hasOwn(patch, 'stopWithStudio') ? { stopWithStudio: Boolean(patch.stopWithStudio) } : {})
    };
    writeSettings(next);
    return statusFor(id);
  }

  async function autoStart() {
    const config = settings();
    for (const service of definitions) {
      if (!config.services[service.id]?.autoStart) continue;
      try { await start(service.id); }
      catch (error) { appendLog(service.id, 'stderr', `Auto-start failed: ${error?.message || String(error)}`); }
    }
    return list();
  }

  async function shutdown() {
    const config = settings();
    for (const [id] of owned) {
      if (!config.services[id]?.stopWithStudio) continue;
      try { await stop(id); } catch {}
    }
  }

  return { list, statusFor, start, stop, restart, configure, autoStart, shutdown, settingsPath };
}
