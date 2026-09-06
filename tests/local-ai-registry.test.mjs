import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { localAiRegistryConfig, registerLocalAiApp, LOCAL_AI_APP_ID } from '../src/local-ai-registry.mjs';

test('shared LocalAI registry supplies Ollama URL and app-selected model', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-localai-'));
  const file = path.join(dir, 'registry.json');
  fs.writeFileSync(file, JSON.stringify({ version: 2, ollama: { url: 'http://127.0.0.1:11434', modelStore: 'C:/LocalAI/Models/Ollama' }, apps: { [LOCAL_AI_APP_ID]: { selectedModels: { ollama: 'qwen3:14b' } } } }));
  const config = localAiRegistryConfig({ env: {}, registryPath: file });
  assert.equal(config.source, 'shared-registry');
  assert.equal(config.url, 'http://127.0.0.1:11434');
  assert.equal(config.model, 'qwen3:14b');
  assert.equal(config.modelStore, 'C:/LocalAI/Models/Ollama');
});

test('BufferCore Studio registers its selected model without disturbing other apps', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-localai-'));
  const file = path.join(dir, 'registry.json');
  fs.writeFileSync(file, JSON.stringify({ version: 2, ollama: { url: 'http://127.0.0.1:11434' }, apps: { Framli: { selectedModels: { ollama: 'qwen3:14b' } } } }));
  registerLocalAiApp({ registryPath: file, model: 'qwen3:8b', now: '2026-09-06T14:00:00.000Z' });
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(saved.apps.Framli.selectedModels.ollama, 'qwen3:14b');
  assert.equal(saved.apps[LOCAL_AI_APP_ID].selectedModels.ollama, 'qwen3:8b');
  assert.equal(saved.apps[LOCAL_AI_APP_ID].lastSeen, '2026-09-06T14:00:00.000Z');
});

test('environment overrides remain available for portable/dev setups', () => {
  const config = localAiRegistryConfig({ env: { BUFFERCORE_AI_URL: 'http://localhost:9999', BUFFERCORE_AI_MODEL: 'test:model' }, registryPath: 'Z:/missing/registry.json' });
  assert.equal(config.source, 'environment');
  assert.equal(config.url, 'http://localhost:9999');
  assert.equal(config.model, 'test:model');
});
