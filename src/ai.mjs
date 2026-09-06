import { localAiRegistryConfig, registerLocalAiApp } from './local-ai-registry.mjs';

const DEFAULT_URL = 'http://127.0.0.1:11434';
const COLOUR_SOURCE_VARIABLES = new Set([
  '--bc-color-identity-ramp-1','--bc-color-identity-ramp-2','--bc-color-identity-ramp-3',
  '--bc-color-ground-ramp-1','--bc-color-ground-ramp-2','--bc-color-ground-ramp-3',
  '--bc-color-neutral-50',
  '--bc-color-status-success','--bc-color-status-warning','--bc-color-status-error','--bc-color-status-info',
  '--bc-color-interaction-link','--bc-color-interaction-link-inverse','--bc-color-interaction-link-visited','--bc-color-interaction-link-visited-inverse','--bc-color-interaction-focus','--bc-color-interaction-focus-inverse'
]);


function trimSlash(value) {
  return String(value || DEFAULT_URL).replace(/\/+$/, '');
}

export function aiConfig(env = process.env) {
  const shared = localAiRegistryConfig({ env });
  return {
    ...shared,
    url: trimSlash(shared.url || DEFAULT_URL),
    model: String(shared.model || '').trim()
  };
}

export function persistAiModel(model, env = process.env) {
  const config = aiConfig(env);
  if (!config.registryAvailable) return { ...config, persisted: false };
  const state = registerLocalAiApp({ registryPath: config.registryPath, model: String(model || '').trim() || null });
  return { ...aiConfig(env), persisted: state.available };
}

export async function discoverAiModels({ fetchImpl = fetch, config = aiConfig() } = {}) {
  try {
    const response = await fetchImpl(`${config.url}/api/tags`, { signal: AbortSignal.timeout(1400) });
    if (!response.ok) return { available: false, models: [], model: config.model || null };
    const data = await response.json();
    const models = Array.isArray(data.models) ? data.models.map((item) => item?.name).filter(Boolean) : [];
    return { available: true, models, model: config.model || models[0] || null };
  } catch {
    return { available: false, models: [], model: config.model || null };
  }
}

export function buildAssistantPrompt({ step, flavour, catalogue, message, history = [] }) {
  const sourceCatalogue = step === 'Colour' ? (catalogue || []).filter((token) => COLOUR_SOURCE_VARIABLES.has(token.cssVariable)) : (catalogue || []);
  const editable = sourceCatalogue.map((token) => ({
    cssVariable: token.cssVariable,
    foundation: token.foundation,
    path: token.path,
    valueType: token.valueType,
    currentValue: flavour?.overrides?.[token.cssVariable] ?? token.value ?? 'initial'
  }));
  const compactHistory = (history || []).slice(-10).map((item) => ({ role: item.role, content: String(item.content || '').slice(0, 1200) }));
  const proposalRule = editable.length
    ? 'You may propose concrete Primitive value changes, but only from the supplied editable token list.'
    : 'This step is guidance-only. Do not propose token changes; use proposals: [].';
  const stepRule = step === 'Colour'
    ? 'Colour-specific rules: work only with the supplied Primitive SOURCE colours. Identity Ramp 1/2/3 and Status Success/Warning/Error/Info are source bases whose Tint/Shade families are generated deterministically by Studio. Ground is Canvas-only and uses three base sources with no tonal family. Neutral 50 is the single character anchor for the deterministically generated absolute 0–100 neutral scale. Interaction colours are direct-purpose sources. Never propose generated tint/shade/neutral-step tokens, never invent Semantic mappings, and never use AI for colour maths that Studio owns deterministically. Judge palette character, distinction, cohesion and accessibility trade-offs instead.'
    : '';
  return `You are BufferCore Studio's persistent Flavour design assistant. Help the user make coherent design-system decisions and explain trade-offs clearly.\n\nA Flavour may override Primitive tokens only. Never propose Semantic tokens, new token names, or architectural changes. Treat existing BufferCore architecture as fixed. ${proposalRule} ${stepRule}\n\nCurrent wizard step: ${step}.\nFlavour: ${JSON.stringify({ id: flavour?.id || null, displayName: flavour?.displayName || 'New Flavour', description: flavour?.description || '', notes: flavour?.notes || '', overrides: flavour?.overrides || {} })}\nEditable primitive tokens for this step: ${JSON.stringify(editable)}\nRecent assistant conversation: ${JSON.stringify(compactHistory)}\n\nUser request: ${message}\n\nReturn JSON only with this shape:\n{"reply":"short useful explanation","proposals":[{"cssVariable":"--bc-...","value":"valid CSS value","reason":"short reason"}]}\nOnly include proposals when a concrete value change is genuinely useful. Keep proposals conservative and coherent. For colour, prefer modern valid CSS colour values or hex. For typography, preserve CSS-valid family/weight/size/line-height/tracking syntax. For shape, spacing, sizing, containers, shadows, effects and motion, preserve valid CSS syntax and the existing scale logic.`;
}

export function parseAssistantResponse(text, allowedVariables = []) {
  const source = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed;
  try { parsed = JSON.parse(source); } catch { throw new Error('Local AI returned invalid JSON. Try again or adjust the model.'); }
  const allowed = new Set(allowedVariables);
  const proposals = Array.isArray(parsed.proposals) ? parsed.proposals
    .filter((item) => item && allowed.has(item.cssVariable) && typeof item.value === 'string' && item.value.trim())
    .map((item) => ({ cssVariable: item.cssVariable, value: item.value.trim(), reason: String(item.reason || '').trim() })) : [];
  return { reply: String(parsed.reply || '').trim(), proposals };
}

export async function runAssistant({ step, flavour, catalogue, message, history = [], model, fetchImpl = fetch, config = aiConfig() }) {
  const discovered = await discoverAiModels({ fetchImpl, config });
  const chosen = String(model || config.model || discovered.models[0] || '').trim();
  if (!discovered.available) throw new Error(`Local AI is not reachable at ${config.url}.`);
  if (!chosen) throw new Error('No local AI model is installed or selected.');
  if (config.registryAvailable) registerLocalAiApp({ registryPath: config.registryPath, model: chosen });
  const prompt = buildAssistantPrompt({ step, flavour, catalogue, message, history });
  const response = await fetchImpl(`${config.url}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: chosen, prompt, stream: false, format: 'json' }),
    signal: AbortSignal.timeout(120000)
  });
  if (!response.ok) throw new Error(`Local AI request failed (${response.status}).`);
  const data = await response.json();
  return { model: chosen, ...parseAssistantResponse(data.response, (catalogue || []).map((token) => token.cssVariable)) };
}

export function buildSemanticColourPrompt({ mode, candidateSets, existing = {}, message = '' }) {
  const ambiguous = (candidateSets || []).filter((set) => !set.fixed && set.candidates?.length > 1).map((set) => ({
    token: set.token,
    group: set.group,
    name: set.name,
    purpose: set.purpose,
    notes: set.notes,
    candidates: set.candidates
  }));
  return `You are BufferCore Studio's Semantic Colour selector. BufferCore owns the Semantic token architecture. The Flavour owns only which LEGAL Primitive token each existing Semantic role maps to. Never invent colours, token names, Semantic roles or Primitive sources. Never output raw colour values. Choose exactly one candidate token from the supplied candidate list for each target.\n\nMode: ${mode}.\nExisting accepted mappings: ${JSON.stringify(existing)}\nTargets requiring design judgement: ${JSON.stringify(ambiguous)}\nDesigner instruction: ${message || 'Choose the most coherent mapping for each role while preserving hierarchy, family character and practical UI readability.'}\n\nReturn JSON only: {"reply":"short review","mappings":[{"semanticToken":"--bc-color-...","primitiveToken":"--bc-color-...","reason":"short reason"}]}. Every primitiveToken must be one of that target's candidates.`;
}

export function parseSemanticColourResponse(text, candidateSets = []) {
  const source = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed;
  try { parsed = JSON.parse(source); } catch { throw new Error('Local AI returned invalid Semantic Colour JSON.'); }
  const legal = new Map((candidateSets || []).map((set) => [set.token, new Set(set.candidates || [])]));
  const mappings = [];
  for (const item of Array.isArray(parsed.mappings) ? parsed.mappings : []) {
    if (!legal.has(item?.semanticToken) || !legal.get(item.semanticToken).has(item?.primitiveToken)) continue;
    mappings.push({ semanticToken: item.semanticToken, primitiveToken: item.primitiveToken, reason: String(item.reason || '').trim() });
  }
  return { reply: String(parsed.reply || '').trim(), mappings };
}

export async function runSemanticColourAssistant({ mode, candidateSets, existing = {}, message = '', model, fetchImpl = fetch, config = aiConfig() }) {
  const discovered = await discoverAiModels({ fetchImpl, config });
  const chosen = String(model || config.model || discovered.models[0] || '').trim();
  if (!discovered.available) throw new Error(`Local AI is not reachable at ${config.url}.`);
  if (!chosen) throw new Error('No local AI model is installed or selected.');
  if (config.registryAvailable) registerLocalAiApp({ registryPath: config.registryPath, model: chosen });
  const prompt = buildSemanticColourPrompt({ mode, candidateSets, existing, message });
  const response = await fetchImpl(`${config.url}/api/generate`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: chosen, prompt, stream: false, format: 'json' }),
    signal: AbortSignal.timeout(120000)
  });
  if (!response.ok) throw new Error(`Local AI request failed (${response.status}).`);
  const data = await response.json();
  return { model: chosen, ...parseSemanticColourResponse(data.response, candidateSets) };
}

export function buildSemanticTypographyPrompt({ candidateSets, existing = {}, message = '' }) {
  const targets = (candidateSets || []).filter((set) => set.candidates?.length).map((set) => ({
    token: set.token, role: set.role, level: set.level, property: set.property,
    baseline: set.baseline || set.current || null,
    currentEffective: set.effective || set.override || set.current || null,
    currentOverride: set.override || null,
    candidates: set.candidates
  }));
  return `You are BufferCore Studio's Typography refinement assistant. BufferCore already owns a complete baseline Semantic Typography role mapping. Do NOT regenerate or remap the whole system by default. Start from the baseline/current effective mapping and propose only the smallest targeted changes genuinely needed to satisfy the designer instruction. The Flavour may only map an existing Semantic typography property to one LEGAL Primitive token from that target's candidate list. Never invent sizes, weights, families, line heights, tracking values, tokens or roles. Preserve a coherent descending hierarchy across Display and Heading, readable Paragraph roles, independently prominent Labels, and strong Overlines. Labels are not required to match Paragraph sizes. Overline 1 should have clear visual prominence. If no mapping changes are needed, return an empty mappings array.

Existing Flavour overrides only: ${JSON.stringify(existing)}
Baseline/current targets: ${JSON.stringify(targets)}
Designer instruction: ${message || 'Review the inherited BufferCore typography mapping and suggest only changes that materially improve the requested design direction.'}

Return JSON only: {"reply":"short review of the inherited system and any targeted changes","mappings":[{"semanticToken":"--bc-type-...","primitiveToken":"--bc-type-...","reason":"short reason"}]}. Every primitiveToken must be one of that target's candidates. Return ONLY changed targets, never every target by default.`;
}

export function parseSemanticTypographyResponse(text, candidateSets = []) {
  const source = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed;
  try { parsed = JSON.parse(source); } catch { throw new Error('Local AI returned invalid Semantic Typography JSON.'); }
  const legal = new Map((candidateSets || []).map((set) => [set.token, new Set(set.candidates || [])]));
  const mappings = [];
  for (const item of Array.isArray(parsed.mappings) ? parsed.mappings : []) {
    if (!legal.has(item?.semanticToken) || !legal.get(item.semanticToken).has(item?.primitiveToken)) continue;
    mappings.push({ semanticToken: item.semanticToken, primitiveToken: item.primitiveToken, reason: String(item.reason || '').trim() });
  }
  return { reply: String(parsed.reply || '').trim(), mappings };
}

export async function runSemanticTypographyAssistant({ candidateSets, existing = {}, message = '', model, fetchImpl = fetch, config = aiConfig() }) {
  const discovered = await discoverAiModels({ fetchImpl, config });
  const chosen = String(model || config.model || discovered.models[0] || '').trim();
  if (!discovered.available) throw new Error(`Local AI is not reachable at ${config.url}.`);
  if (!chosen) throw new Error('No local AI model is installed or selected.');
  if (config.registryAvailable) registerLocalAiApp({ registryPath: config.registryPath, model: chosen });
  const response = await fetchImpl(`${config.url}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: chosen, prompt: buildSemanticTypographyPrompt({ candidateSets, existing, message }), stream: false, format: 'json' }),
    signal: AbortSignal.timeout(180000)
  });
  if (!response.ok) throw new Error(`Local AI request failed (${response.status}).`);
  const data = await response.json();
  return { model: chosen, ...parseSemanticTypographyResponse(data.response, candidateSets) };
}
