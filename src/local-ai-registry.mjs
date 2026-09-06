import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const LOCAL_AI_APP_ID = 'BufferCore Studio';

export function defaultRegistryPath(env = process.env, platform = process.platform) {
  if (env.BUFFERCORE_LOCALAI_REGISTRY) return path.resolve(env.BUFFERCORE_LOCALAI_REGISTRY);
  if (platform === 'win32') return 'C:\\LocalAI\\registry.json';
  return path.join(os.homedir(), 'LocalAI', 'registry.json');
}

export function readLocalAiRegistry(registryPath = defaultRegistryPath()) {
  try {
    const raw = fs.readFileSync(registryPath, 'utf8');
    const registry = JSON.parse(raw);
    return { available: true, path: registryPath, registry };
  } catch (error) {
    return { available: false, path: registryPath, registry: null, error: error?.message || String(error) };
  }
}

function atomicWriteJson(file, value) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

export function registerLocalAiApp({ registryPath = defaultRegistryPath(), model = null, now = new Date().toISOString() } = {}) {
  const state = readLocalAiRegistry(registryPath);
  if (!state.available) return state;
  const registry = state.registry;
  registry.apps ||= {};
  const existing = registry.apps[LOCAL_AI_APP_ID] || {};
  const selectedModels = { ...(existing.selectedModels || {}) };
  if (model) selectedModels.ollama = model;
  registry.apps[LOCAL_AI_APP_ID] = {
    ...existing,
    selectedModels,
    lastSeen: now
  };
  atomicWriteJson(registryPath, registry);
  return { available: true, path: registryPath, registry };
}

export function localAiRegistryConfig({ env = process.env, registryPath = defaultRegistryPath(env) } = {}) {
  const state = readLocalAiRegistry(registryPath);
  const configuredUrl = String(env.BUFFERCORE_AI_URL || '').trim();
  const configuredModel = String(env.BUFFERCORE_AI_MODEL || '').trim();
  const registry = state.registry || {};
  const app = registry.apps?.[LOCAL_AI_APP_ID] || {};
  return {
    registryAvailable: state.available,
    registryPath,
    registryVersion: registry.version ?? null,
    url: configuredUrl || registry.ollama?.url || 'http://127.0.0.1:11434',
    modelStore: registry.ollama?.modelStore || null,
    model: configuredModel || app.selectedModels?.ollama || '',
    appRegistered: Boolean(registry.apps?.[LOCAL_AI_APP_ID]),
    source: configuredUrl || configuredModel ? 'environment' : state.available ? 'shared-registry' : 'fallback'
  };
}
