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
    context: set.context,
    sourceRule: set.sourceRule,
    appearanceRule: set.appearanceRule,
    relationshipRule: set.relationshipRule,
    notes: set.notes,
    rules: set.rules,
    accessibilityMinimum: set.accessibilityMinimum || null,
    accessibilityRecommended: set.accessibilityRecommended || null,
    candidates: set.candidates
  }));
  return `You are BufferCore Studio's Semantic Colour selector. BufferCore owns the Semantic token architecture. The Flavour owns only which LEGAL Primitive token each existing Semantic role maps to. Never invent colours, token names, Semantic roles or Primitive sources. Never output raw colour values. Choose exactly one candidate token from the supplied candidate list for each target. For roles with an accessibilityMinimum, every supplied candidate already clears that hard minimum against BufferCore's representative normal/inverse Surface. Treat accessibilityRecommended as a preferred target, not a hard requirement. Follow purpose, context, sourceRule, appearanceRule, relationshipRule, notes and the supplied global/group rules for every target. Prefer the weakest/closest viable candidate that satisfies the role. Preserve Muted/Subtle/Default and Subtle/Soft/Base/Strong/Bold hierarchy, keep adjacent roles perceptually distinct, preserve family character, and avoid unnecessary drift towards pure white/black or the most extreme ramp tone merely to maximise contrast.\n\nMode: ${mode}.\nExisting accepted mappings: ${JSON.stringify(existing)}\nTargets requiring design judgement: ${JSON.stringify(ambiguous)}\nDesigner instruction: ${message || 'Choose the most coherent mapping for each role while preserving hierarchy, family character and practical UI readability.'}\n\nReturn JSON only: {"reply":"short review","mappings":[{"semanticToken":"--bc-color-...","primitiveToken":"--bc-color-...","reason":"short reason"}]}. Every primitiveToken must be one of that target's candidates.`;
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

export function buildSemanticColourPlanPrompt({ mode, batches = [], existing = {}, message = '' }) {
  const compact = batches.map(batch => ({
    id: batch.id,
    group: batch.group,
    label: batch.label,
    roles: batch.items.map(set => ({ token:set.token, name:set.name, purpose:set.purpose, minimum:set.accessibilityMinimum||null, recommended:set.accessibilityRecommended||null })),
    options: batch.options.slice(0,3).map(option => ({
      id: option.id,
      score: option.score,
      allMinimumsMet: option.allMinimumsMet,
      quality: option.visualQuality,
      mappings: option.choices.map(choice => ({
        token: choice.token,
        source: choice.source,
        value: choice.value,
        contrast: choice.contrast == null ? null : Number(choice.contrast.toFixed(2)),
        recommended: choice.meetsRecommended,
        chromaRetention: choice.perceptual ? Number(choice.perceptual.chromaRetention.toFixed(2)) : null,
        hueDrift: choice.perceptual ? Number((choice.perceptual.hueDrift || 0).toFixed(1)) : null,
        baseDistance: choice.perceptual ? Number((choice.perceptual.baseDistance || 0).toFixed(1)) : null
      }))
    }))
  }));
  return `You are BufferCore Studio's Semantic Colour family judge. BufferCore already enforced the canonical architecture, allowed Primitive families, hard accessibility minimums and generated the top coherent options for each design family. Do NOT construct mappings token-by-token. Choose one supplied optionId for each batch.

Judge whole families: semantic hierarchy, meaningful sibling separation, preserved family character, recommended contrast when it fits naturally, and avoidance of unnecessary black/white endpoint collapse. For chromatic Text Strong / Strong Inverse, use this strict priority: (1) hard accessibility minimum is non-negotiable, (2) preserve recognisable family identity/chroma and avoid cross-family convergence, (3) maintain Base-to-Strong separation of at least ΔE 5, preferably 7+, then (4) prefer the recommended 7:1 target only when it does not materially damage family character. A 4.5–6.99:1 candidate is a valid PASS and SHOULD beat a 7:1+ candidate when the latter becomes muddy, generic, endpoint-heavy, or materially less recognisable as the source family. BufferCore supplies a quality frontier of viable Strong options: some stay closer to Base, while others deliberately buy more semantic strength or recommended contrast without materially damaging family identity. Do not automatically prefer the closest tone, the darkest tone, or the later O-number. Choose the best trade-off for a genuinely Strong, recognisable family role. Minimum contrast is a hard floor where defined. Recommended contrast is guidance, never a reason to sacrifice personality. Prefer lower deterministic score unless the visual evidence gives a clear reason to choose another supplied option.

Mode: ${mode}
Designer instruction: ${message || 'Choose the most coherent production-ready option for each family.'}
Existing mappings are already considered by BufferCore and need not be repeated.
Batches: ${JSON.stringify(compact)}

Return JSON only: {"reply":"short review","batchSelections":[{"batchId":"B1","optionId":"O1","reason":"short reason"}]}. You MUST return exactly one explicit selection for EVERY supplied batch, including O1 when the deterministic O1 default is your preferred choice. Never omit a batch, never invent colours, tokens, batches or option IDs.`;
}

export function parseSemanticColourPlanResponse(text, batches = []) {
  const source = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed;
  try { parsed = JSON.parse(source); } catch { throw new Error('Local AI returned invalid Semantic Colour plan JSON.'); }
  const legal = new Map((batches || []).map(batch => [batch.id, new Set((batch.options || []).map(option => option.id))]));
  const batchSelections = [];
  for (const item of Array.isArray(parsed.batchSelections) ? parsed.batchSelections : []) {
    if (!legal.get(item?.batchId)?.has(item?.optionId)) continue;
    batchSelections.push({ batchId: item.batchId, optionId: item.optionId, reason: String(item.reason || '').trim() });
  }
  return { reply: String(parsed.reply || '').trim(), batchSelections };
}

export async function runSemanticColourPlanAssistant({ mode, batches, existing = {}, message = '', model, fetchImpl = fetch, config = aiConfig() }) {
  const discovered = await discoverAiModels({ fetchImpl, config });
  const chosen = String(model || config.model || discovered.models[0] || '').trim();
  if (!discovered.available) throw new Error(`Local AI is not reachable at ${config.url}.`);
  if (!chosen) throw new Error('No local AI model is installed or selected.');
  if (config.registryAvailable) registerLocalAiApp({ registryPath: config.registryPath, model: chosen });

  const chunkSize = 8;
  const chunks = [];
  for (let i = 0; i < batches.length; i += chunkSize) chunks.push(batches.slice(i, i + chunkSize));

  const batchSelections = [];
  const replies = [];
  const passes = [];
  let requestCount = 0;

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const passMessage = `${message || 'Choose the most coherent production-ready option for each family.'}
This is Local AI review pass ${index + 1}/${chunks.length}. You must explicitly decide every family supplied in this pass.`;

    const prompt = buildSemanticColourPlanPrompt({ mode, batches: chunk, existing, message: passMessage });
    const passStartedAt = Date.now();
    const response = await fetchImpl(`${config.url}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: chosen,
        prompt,
        stream: false,
        format: 'json',
        options: { temperature: 0.2 }
      }),
      signal: AbortSignal.timeout(180000)
    });
    requestCount += 1;
    if (!response.ok) throw new Error(`Local AI request failed (${response.status}) during family review pass ${index + 1}/${chunks.length}.`);

    const data = await response.json();
    const wallMs = Date.now() - passStartedAt;
    passes.push({
      pass: index + 1,
      batchCount: chunk.length,
      batchIds: chunk.map(batch => batch.id),
      wallMs,
      promptChars: prompt.length,
      prompt_eval_count: Number(data.prompt_eval_count || 0),
      eval_count: Number(data.eval_count || 0),
      prompt_eval_duration: Number(data.prompt_eval_duration || 0),
      eval_duration: Number(data.eval_duration || 0),
      total_duration: Number(data.total_duration || 0)
    });
    const parsed = parseSemanticColourPlanResponse(data.response, chunk);
    const required = new Set(chunk.map(batch => batch.id));
    const returned = new Set(parsed.batchSelections.map(item => item.batchId));

    if (returned.size !== required.size || [...required].some(id => !returned.has(id))) {
      const missing = chunk.filter(batch => !returned.has(batch.id)).map(batch => batch.label || batch.id);
      throw new Error(
        `Local AI returned ${returned.size}/${required.size} explicit family decisions during pass ${index + 1}/${chunks.length}. ` +
        `Missing: ${missing.join(', ')}.`
      );
    }

    batchSelections.push(...parsed.batchSelections);
    if (parsed.reply) replies.push(parsed.reply);
  }

  const totals = passes.reduce((sum, pass) => ({
    wallMs: sum.wallMs + pass.wallMs,
    promptChars: sum.promptChars + pass.promptChars,
    prompt_eval_count: sum.prompt_eval_count + pass.prompt_eval_count,
    eval_count: sum.eval_count + pass.eval_count,
    prompt_eval_duration: sum.prompt_eval_duration + pass.prompt_eval_duration,
    eval_duration: sum.eval_duration + pass.eval_duration,
    total_duration: sum.total_duration + pass.total_duration
  }), {
    wallMs: 0,
    promptChars: 0,
    prompt_eval_count: 0,
    eval_count: 0,
    prompt_eval_duration: 0,
    eval_duration: 0,
    total_duration: 0
  });

  return {
    model: chosen,
    reply: replies.join(' '),
    batchSelections,
    requestCount,
    chunkSize,
    passes,
    totals
  };
}
