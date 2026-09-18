import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT = JSON.parse(fs.readFileSync(path.join(here, 'colour-contract.json'), 'utf8'));

const FAMILY_BASES = {
  primary: '--bc-color-identity-ramp-1',
  secondary: '--bc-color-identity-ramp-2',
  accent: '--bc-color-identity-ramp-3',
  success: '--bc-color-status-success',
  warning: '--bc-color-status-warning',
  error: '--bc-color-status-error',
  info: '--bc-color-status-info',
  neutral: '--bc-color-neutral-50'
};

function familyFromName(name='') {
  const lower = name.toLowerCase();
  for (const key of Object.keys(FAMILY_BASES)) if (lower.includes(key)) return key;
  return null;
}

function tone(base, kind, amount) {
  return kind === 'base' ? base : `${base}-${kind}-${amount}`;
}

function neutral(step) { return `--bc-color-neutral-${step}`; }

function available(flavour, token) {
  return typeof flavour?.overrides?.[token] === 'string' && flavour.overrides[token].trim() && flavour.overrides[token].trim() !== 'initial';
}

function candidatesExisting(flavour, tokens) {
  return [...new Set(tokens)].filter((token) => available(flavour, token));
}

function fillCandidates(flavour, mode, name) {
  const family = familyFromName(name) || 'neutral';
  const subtle = /Subtle/i.test(name), soft = /Soft/i.test(name), strong = /Strong/i.test(name), bold = /Bold/i.test(name);
  const baseRole = !subtle && !soft && !strong && !bold;
  if (family === 'neutral') {
    const steps = mode === 'light'
      ? (subtle ? [5,10] : soft ? [20,25,30] : baseRole ? [50] : strong ? [65,70,75] : [85,90,95])
      : (subtle ? [95,90] : soft ? [80,75,70] : baseRole ? [50] : strong ? [35,30,25] : [15,10,5]);
    return candidatesExisting(flavour, steps.map(neutral));
  }
  const base = FAMILY_BASES[family];
  if (baseRole) return candidatesExisting(flavour, [base]);
  const kind = mode === 'light'
    ? (subtle || soft ? 'tint' : 'shade')
    : (subtle || soft ? 'shade' : 'tint');
  const amounts = subtle ? [80,90] : soft ? [50,60] : strong ? [20,30,40] : [50,60,70];
  return candidatesExisting(flavour, amounts.map((amount) => tone(base, kind, amount)));
}

function borderCandidates(flavour, mode, name) {
  const family = familyFromName(name) || 'neutral';
  const subtle = /Subtle/i.test(name), strong = /Strong/i.test(name), bold = /Bold/i.test(name);
  if (family === 'neutral') {
    const steps = mode === 'light'
      ? (subtle ? [5,10,15,20,25,30] : bold ? [80,85,90,95] : strong ? [55,60,65,70,75,80] : [35,40,45,50,55,60])
      : (subtle ? [95,90,85,80,75,70] : bold ? [20,15,10,5] : strong ? [45,40,35,30,25,20] : [65,60,55,50,45,40]);
    return candidatesExisting(flavour, steps.map(neutral));
  }
  const base = FAMILY_BASES[family];
  const kindSubtle = mode === 'light' ? 'tint' : 'shade';
  const kindStrong = mode === 'light' ? 'shade' : 'tint';
  if (subtle) return candidatesExisting(flavour, [60,70,80,90].map(a => tone(base, kindSubtle, a)));
  if (bold) return candidatesExisting(flavour, [30,40,50,60,70,80].map(a => tone(base, kindStrong, a)));
  if (strong) return candidatesExisting(flavour, [base, ...[10,20,30,40,50].map(a => tone(base, kindStrong, a))]);
  return candidatesExisting(flavour, [...[10,20,30,40,50].map(a => tone(base, kindSubtle, a)), base, tone(base, kindStrong, 10)]);
}

function surfaceCandidates(flavour, mode, name) {
  if (/General/i.test(name)) {
    const i = /Secondary/i.test(name) ? 1 : /Tertiary/i.test(name) ? 2 : 0;
    const strong = /Strong/i.test(name);
    const light = [5,10,15], dark = [95,90,85];
    const step = mode === 'light' ? (strong ? dark[i] : light[i]) : (strong ? light[i] : dark[i]);
    return candidatesExisting(flavour, [neutral(step)]);
  }
  const family = familyFromName(name);
  if (!family) return [];
  const base = FAMILY_BASES[family];
  const strong = /Strong/i.test(name);
  const wantsLight = (mode === 'light' && !strong) || (mode === 'dark' && strong);
  const kind = wantsLight ? 'tint' : 'shade';
  const amounts = wantsLight ? [90,80,70] : [90,80,70,60,50];
  return candidatesExisting(flavour, amounts.map(a => tone(base, kind, a)));
}

function textCandidates(flavour, mode, name) {
  const family = familyFromName(name);
  const strong = /Strong/i.test(name);
  const inverse = /Inverse/i.test(name);
  if (family && family !== 'neutral' && !strong) return candidatesExisting(flavour, [FAMILY_BASES[family]]);
  if (family && family !== 'neutral') {
    const base = FAMILY_BASES[family];
    // Strong Inverse is the readable same-family treatment for the opposing
    // context, so it deliberately uses the opposite side of the family ramp.
    const wantsShade = (mode === 'light') !== inverse;
    const kind = wantsShade ? 'shade' : 'tint';
    return candidatesExisting(flavour, [90,80,70,60,50,40,30,20,10].map(a => tone(base, kind, a)));
  }
  const preferLight = (mode === 'dark') !== inverse;
  if (/Default/i.test(name)) return candidatesExisting(flavour, preferLight ? [neutral(0),neutral(10)] : [neutral(90),neutral(100)]);
  if (/Muted/i.test(name)) return candidatesExisting(flavour, preferLight ? [neutral(55),neutral(60),neutral(65),neutral(70)] : [neutral(45),neutral(40),neutral(35),neutral(30)]);
  return candidatesExisting(flavour, preferLight ? [neutral(25),neutral(30),neutral(35),neutral(40),neutral(45)] : [neutral(75),neutral(70),neutral(65),neutral(60),neutral(55)]);
}

function interactionCandidates(flavour, mode, name) {
  const lower = name.toLowerCase();
  if (lower.includes('link visited')) {
    const inverse = lower.includes('inverse');
    const useInverse = mode === 'dark' ? !inverse : inverse;
    return candidatesExisting(flavour, [`--bc-color-interaction-link-visited${useInverse?'-inverse':''}`]);
  }
  if (lower.includes('link')) {
    const inverse = lower.includes('inverse');
    const useInverse = mode === 'dark' ? !inverse : inverse;
    return candidatesExisting(flavour, [`--bc-color-interaction-link${useInverse?'-inverse':''}`]);
  }
  if (lower.includes('focus')) {
    const inverse = lower.includes('inverse');
    const useInverse = mode === 'dark' ? !inverse : inverse;
    return candidatesExisting(flavour, [`--bc-color-interaction-focus${useInverse?'-inverse':''}`]);
  }
  return textCandidates(flavour, mode, name);
}

function titleWords(value='') {
  return String(value)
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normaliseLegacyContractRow(row) {
  const copy = { ...row };
  const familyInverseStrong = String(copy.token || '').match(/^--bc-color-text-(primary|secondary|accent|success|warning|error|info)-inverse-strong$/);
  if (familyInverseStrong) {
    copy.token = `--bc-color-text-${familyInverseStrong[1]}-strong-inverse`;
    copy.name = `Text ${titleWords(familyInverseStrong[1])} Strong Inverse`;
  }
  return copy;
}

function editableSemanticGroup(cssVariable='') {
  if (String(cssVariable).includes('-context')) return null;
  if (/^--bc-color-canvas-/.test(cssVariable)) return 'Canvas';
  if (/^--bc-color-surface-/.test(cssVariable)) return 'Surface';
  if (/^--bc-color-fill-/.test(cssVariable)) return 'Fill';
  if (/^--bc-color-border-/.test(cssVariable)) return 'Border';
  if (/^--bc-color-text(?:-|$)/.test(cssVariable)) return 'Text';
  if (/^--bc-color-(?:link|focus|placeholder)(?:-|$)/.test(cssVariable)) return 'Interaction';
  return null;
}

function generatedSemanticName(cssVariable, group) {
  const suffix = String(cssVariable).replace(/^--bc-color-/, '');
  if (group === 'Interaction') return titleWords(suffix);
  if (group === 'Text' && suffix === 'text') return 'Text Default';
  if (group === 'Text' && suffix === 'text-inverse') return 'Text Inverse Default';
  return titleWords(suffix);
}

function contractMetadataByToken() {
  const map = new Map();
  for (const source of CONTRACT.semantic || []) {
    const row = normaliseLegacyContractRow(source);
    if (!row.token || row.token.includes('*')) continue;
    // The old large contract contained family Base Inverse rows and Disabled
    // colours. Those are intentionally retired by the current lean contract.
    if (/^--bc-color-text-(?:primary|secondary|accent|success|warning|error|info)-inverse$/.test(row.token)) continue;
    if (/^--bc-color-disabled-/.test(row.token)) continue;
    map.set(row.token, row);
  }
  return map;
}

export function semanticRows(manifest=null) {
  // The live Engine manifest is the authority. The JSON contract now supplies
  // human-facing purpose/accessibility copy only; it no longer decides which
  // Semantic tokens exist.
  if (manifest?.tokens) {
    const metadata = contractMetadataByToken();
    return manifest.tokens
      .filter(token => token?.layer === 'semantic' && token?.foundation === 'colour')
      .map(token => ({ token, group: editableSemanticGroup(token.cssVariable) }))
      .filter(item => item.group)
      .map(({ token, group }) => {
        const meta = metadata.get(token.cssVariable) || {};
        return {
          group,
          name: meta.name || generatedSemanticName(token.cssVariable, group),
          token: token.cssVariable,
          purpose: meta.purpose || '',
          notes: meta.notes || '',
          accessibilityMinimum: meta.accessibilityMinimum || '',
          accessibilityRecommended: meta.accessibilityRecommended || ''
        };
      })
      .sort((a,b) => {
        const order = ['Canvas','Surface','Fill','Border','Text','Interaction'];
        return order.indexOf(a.group) - order.indexOf(b.group) || a.token.localeCompare(b.token);
      });
  }

  // Fallback keeps isolated/unit use working, while still applying the current
  // lean naming/removal rules.
  return [...contractMetadataByToken().values()]
    .filter(row => ['Canvas','Surface','Fill','Border','Text','Interaction'].includes(row.group));
}

export function colourFoundationReadiness(manifest) {
  const declared = manifest?.foundationContracts?.context?.colour || null;
  const extracted = manifest?.contextContracts?.domains?.colour || null;
  const disabled = manifest?.foundationContracts?.interactionStates?.disabled || null;

  const requiredSlots = declared?.requiredSlots || [];
  const requiredTargets = declared?.requiredTargets || [];
  const slotReady = requiredSlots.filter(slot => extracted?.slots?.[slot]).length;
  const targetResults = requiredTargets.map(id => {
    const target = extracted?.targets?.[id];
    const mapped = requiredSlots.filter(slot => target?.mappings?.[slot]).length;
    return { id, mapped, required: requiredSlots.length, complete: Boolean(target) && mapped === requiredSlots.length };
  });
  const targetReady = targetResults.filter(item => item.complete).length;

  const rows = semanticRows(manifest);
  const semanticIds = new Set(
    (manifest?.tokens || [])
      .filter(token => token?.layer === 'semantic' && token?.foundation === 'colour')
      .map(token => token.cssVariable)
  );
  const staleEditable = rows.filter(row => !semanticIds.has(row.token)).map(row => row.token);

  const complete = Boolean(
    declared
    && extracted
    && slotReady === requiredSlots.length
    && targetReady === requiredTargets.length
    && staleEditable.length === 0
  );

  return {
    complete,
    source: declared && extracted ? 'engine-contract' : 'unavailable',
    context: {
      slots: { ready: slotReady, required: requiredSlots.length },
      targets: { ready: targetReady, required: requiredTargets.length, items: targetResults }
    },
    semantics: {
      editable: rows.length,
      stale: staleEditable
    },
    stateSeparation: {
      disabledOwnedByInteraction: Boolean(disabled),
      semantic: disabled?.semantic || null
    }
  };
}

export function semanticCandidateSet(flavour, mode, row) {
  let candidates = [], fixed = false;
  if (row.group === 'Tones / Design Material') {
    const key = String(row.name || '').toLowerCase();
    const base = FAMILY_BASES[key];
    candidates = base ? candidatesExisting(flavour, [base]) : [];
    fixed = true;
  } else if (row.group === 'Canvas') {
    const source = /Primary/i.test(row.name) ? '--bc-color-ground-ramp-1' : /Secondary/i.test(row.name) ? '--bc-color-ground-ramp-2' : '--bc-color-ground-ramp-3';
    candidates = candidatesExisting(flavour, [source]); fixed = true;
  } else if (row.group === 'Surface') {
    candidates = surfaceCandidates(flavour, mode, row.name); fixed = candidates.length === 1;
  } else if (row.group === 'Fill') {
    candidates = fillCandidates(flavour, mode, row.name); fixed = candidates.length === 1;
  } else if (row.group === 'Border') {
    candidates = borderCandidates(flavour, mode, row.name); fixed = candidates.length === 1;
  } else if (row.group === 'Text') {
    candidates = textCandidates(flavour, mode, row.name); fixed = candidates.length === 1;
  } else if (row.group === 'Interaction') {
    candidates = interactionCandidates(flavour, mode, row.name); fixed = candidates.length === 1;
  }
  return { token: row.token, group: row.group, name: row.name, purpose: row.purpose || '', notes: row.notes || '', mode, candidates, fixed };
}

export function buildSemanticCandidateSets(flavour, mode, manifest=null) {
  if (!['light','dark'].includes(mode)) throw new Error('Semantic colour mode must be light or dark.');
  return semanticRows(manifest).map((row) => semanticCandidateSet(flavour, mode, row));
}

export function fixedSemanticMappings(flavour, mode, manifest=null) {
  const out = {};
  for (const set of buildSemanticCandidateSets(flavour, mode, manifest)) if (set.fixed && set.candidates[0]) out[set.token] = set.candidates[0];
  return out;
}

export function validateSemanticMappings(flavour, mappings, mode, manifest=null) {
  const allowedByTarget = new Map(buildSemanticCandidateSets(flavour, mode, manifest).map((set) => [set.token, new Set(set.candidates)]));
  const clean = {};
  for (const [target, source] of Object.entries(mappings || {})) {
    if (!allowedByTarget.has(target)) throw new Error(`${target} is not an editable BufferCore colour Semantic.`);
    if (!allowedByTarget.get(target).has(source)) throw new Error(`${source} is not a legal ${mode} Primitive source for ${target}.`);
    clean[target] = source;
  }
  return clean;
}

export function semanticCompletion(flavour, mode, manifest=null) {
  const sets = buildSemanticCandidateSets(flavour, mode, manifest);
  const mappings = flavour?.semanticMappings?.colour?.[mode] || {};
  const complete = sets.filter(s => s.candidates.length).every(s => mappings[s.token] && s.candidates.includes(mappings[s.token]));
  return { complete, total: sets.length, mappable: sets.filter(s=>s.candidates.length).length, mapped: Object.keys(mappings).length, missing: sets.filter(s=>s.candidates.length && !mappings[s.token]).map(s=>s.token), unavailable: sets.filter(s=>!s.candidates.length).map(s=>s.token) };
}
