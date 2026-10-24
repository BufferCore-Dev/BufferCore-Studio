import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deltaE, oklch, enrichCandidateSet, deterministicSemanticSelections, buildSemanticDesignBatches, semanticVisualFindings } from './semantic-quality.mjs';

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

const GROUND_LIGHT_BASES = [
  '--bc-color-ground-ramp-1',
  '--bc-color-ground-ramp-2',
  '--bc-color-ground-ramp-3'
];
const GROUND_DARK_BASES = [
  '--bc-color-ground-dark-ramp-1',
  '--bc-color-ground-dark-ramp-2',
  '--bc-color-ground-dark-ramp-3'
];

function groundBasesForMode(flavour, mode) {
  if (mode !== 'dark') return GROUND_LIGHT_BASES;
  const dedicated = GROUND_DARK_BASES.filter((token) => available(flavour, token));
  return dedicated.length === GROUND_DARK_BASES.length ? GROUND_DARK_BASES : GROUND_LIGHT_BASES;
}

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
  if (mode === 'light') {
    if (baseRole) return candidatesExisting(flavour, [base]);
    const kind = subtle || soft ? 'tint' : 'shade';
    const amounts = subtle ? [70,80,90] : soft ? [30,40,50,60,70] : strong ? [10,20,30,40,50] : [40,50,60,70,80];
    return candidatesExisting(flavour, amounts.map((amount) => tone(base, kind, amount)));
  }

  // Dark fills are purpose-led rather than a mechanical Light inversion. A
  // source may already be extremely dark (Secondary is a common example), so
  // forcing Subtle/Soft into further shades can make the material disappear.
  // Give the family planner the full tonal run and let the five-level hierarchy
  // targets choose dark-but-visible → progressively stronger material.
  return candidatesExisting(flavour, [
    ...[90,80,70,60,50,40,30,20,10].map(a => tone(base, 'shade', a)),
    base,
    ...[10,20,30,40,50,60,70,80,90].map(a => tone(base, 'tint', a))
  ]);
}

function borderCandidates(flavour, mode, name) {
  const family = familyFromName(name) || 'neutral';
  const subtle = /Subtle/i.test(name), strong = /Strong/i.test(name), bold = /Bold/i.test(name);
  const wantsLightForeground = mode === 'dark';

  if (family === 'neutral') {
    const steps = wantsLightForeground
      ? (subtle ? [90,85,80,75,70] : bold ? [20,15,10,5,0] : strong ? [40,35,30,25,20,15] : [55,50,45,40,35,30])
      : (subtle ? [10,15,20,25,30] : bold ? [85,90,95,100] : strong ? [70,75,80,85,90] : [65,70,75,80,85]);
    return candidatesExisting(flavour, steps.map(neutral));
  }

  const base = FAMILY_BASES[family];
  const lightKind = wantsLightForeground ? 'tint' : 'shade';
  const oppositeKind = wantsLightForeground ? 'shade' : 'tint';

  if (subtle) {
    if (mode === 'dark') {
      // Quiet does not mean invisible. Extremely dark source families need
      // permission to lift slightly so a subtle boundary can still be seen on
      // a dark canvas/surface.
      return candidatesExisting(flavour, [
        ...[90,80,70,60,50,40,30,20,10].map(a => tone(base, 'shade', a)),
        base,
        ...[10,20,30].map(a => tone(base, 'tint', a))
      ]);
    }
    return candidatesExisting(flavour, [90,80,70,60].map(a => tone(base, oppositeKind, a)));
  }

  if (bold) {
    return candidatesExisting(flavour, [40,50,60,70,80,90].map(a => tone(base, lightKind, a)));
  }

  if (strong) {
    return candidatesExisting(flavour, [
      base,
      ...[10,20,30,40,50,60].map(a => tone(base, lightKind, a))
    ]);
  }

  // Base borders are allowed to move far enough into the readable side of the
  // family to clear 3:1. Invalid choices are removed by the contract filter.
  return candidatesExisting(flavour, [
    ...[40,30,20,10].map(a => tone(base, oppositeKind, a)),
    base,
    ...[10,20,30,40].map(a => tone(base, lightKind, a))
  ]);
}

function surfaceCandidates(flavour, mode, name) {
  if (/General/i.test(name)) {
    const i = /Secondary/i.test(name) ? 1 : /Tertiary/i.test(name) ? 2 : 0;
    const strong = /Strong/i.test(name);
    const light = [5,10,15], dark = [95,90,85];
    // Surface semantics are stable across themes: Surface is light material;
    // Surface Strong is its dark/opposing material.
    const step = strong ? dark[i] : light[i];
    return candidatesExisting(flavour, [neutral(step)]);
  }
  const family = familyFromName(name);
  if (!family) return [];
  const base = FAMILY_BASES[family];
  const strong = /Strong/i.test(name);

  // Keep a broad family-aware source band, then enforce actual background
  // suitability perceptually. Very dark source colours may legitimately use a
  // slight tint for Strong; bright colours generally need a shade.
  const tokens = strong
    ? [
        ...[10,20,30].map(a => tone(base, 'tint', a)),
        base,
        ...[10,20,30,40,50,60,70,80].map(a => tone(base, 'shade', a))
      ]
    : [90,80,70,60,50,40].map(a => tone(base, 'tint', a));

  const existing = candidatesExisting(flavour, tokens);
  const baseValue = primitiveHex(flavour, base);
  const basePerceptual = baseValue ? oklch(baseValue) : null;
  const suitable = existing.filter((token) => {
    const value = primitiveHex(flavour, token);
    const perceptual = value ? oklch(value) : null;
    if (!perceptual || typeof perceptual.L !== 'number') return false;
    const retention = basePerceptual?.C > 0.008 ? perceptual.C / basePerceptual.C : 1;
    const backgroundFit = strong ? perceptual.L <= 0.34 : perceptual.L >= 0.78;
    return backgroundFit && retention >= 0.14;
  });
  return suitable.length ? suitable : existing;
}

function textCandidates(flavour, mode, name) {
  const family = familyFromName(name);
  const strong = /Strong(?:\s+Inverse)?$/i.test(name);
  const inverse = /Inverse/i.test(name);
  const wantsLightForeground = (mode === 'dark') !== inverse;

  if (family && family !== 'neutral' && !strong) {
    const base = FAMILY_BASES[family];
    if (mode === 'light') return candidatesExisting(flavour, [base]);
    // Dark mode cannot blindly reuse a very dark/light family Base as readable
    // text. Start at the approved Base and move only towards lighter family
    // tones; accessibility filtering then removes anything that cannot work on
    // the dark normal-context surface.
    return candidatesExisting(flavour, [
      base,
      ...[10,20,30,40,50,60,70,80].map(a => tone(base, 'tint', a))
    ]);
  }

  if (family && family !== 'neutral') {
    const base = FAMILY_BASES[family];
    const kind = wantsLightForeground ? 'tint' : 'shade';
    // Weakest family-preserving option first; accessibility filtering below
    // removes anything that cannot clear the contract minimum.
    return candidatesExisting(flavour, [10,20,30,40,50,60,70,80,90].map(a => tone(base, kind, a)));
  }

  if (/Default/i.test(name)) {
    return candidatesExisting(flavour, wantsLightForeground
      ? [neutral(15), neutral(10), neutral(5), neutral(0)]
      : [neutral(85), neutral(90), neutral(95), neutral(100)]);
  }

  // Muted and Subtle deliberately share a broad readable side of the Neutral
  // scale. The sequence solver chooses them together so Muted can sit just over
  // minimum while Subtle remains meaningfully stronger without jumping to an endpoint.
  return candidatesExisting(flavour, wantsLightForeground
    ? [neutral(75), neutral(70), neutral(65), neutral(60), neutral(55), neutral(50), neutral(45), neutral(40), neutral(35), neutral(30), neutral(25), neutral(20), neutral(15), neutral(10), neutral(5), neutral(0)]
    : [neutral(25), neutral(30), neutral(35), neutral(40), neutral(45), neutral(50), neutral(55), neutral(60), neutral(65), neutral(70), neutral(75), neutral(80), neutral(85), neutral(90), neutral(95), neutral(100)]);
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

export function semanticRows() {
  return (CONTRACT.semantic || []).filter((row) => ['Tones / Design Material','Canvas','Surface','Fill','Border','Text','Interaction'].includes(row.group));
}


function normaliseHexValue(value) {
  const raw = String(value || '').trim();
  const short = raw.match(/^#([0-9a-f]{3})$/i);
  if (short) return `#${short[1].split('').map(c => c + c).join('')}`.toLowerCase();
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw.toLowerCase() : null;
}

function primitiveHex(flavour, token) {
  return normaliseHexValue(flavour?.overrides?.[token]);
}

function contrastRatioForHex(a, b) {
  a = normaliseHexValue(a); b = normaliseHexValue(b);
  if (!a || !b) return null;
  const luminance = (hex) => {
    const rgb = [1,3,5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(v => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };
  const l1 = luminance(a), l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function ratioThreshold(value) {
  const n = parseFloat(String(value || '').replace(':1', ''));
  return Number.isFinite(n) ? n : null;
}

function isChromaticTextBaseRow(row) {
  return row?.group === 'Text'
    && !!familyFromName(row?.name || '')
    && familyFromName(row?.name || '') !== 'neutral'
    && !/Strong/i.test(row?.name || '');
}

function effectiveAccessibility(row, mode) {
  if (mode === 'dark' && isChromaticTextBaseRow(row)) {
    return { minimum: '4.5:1', recommended: '7:1' };
  }
  return {
    minimum: row.accessibilityMinimum || '',
    recommended: row.accessibilityRecommended || ''
  };
}

function accessibilityBackgroundToken(mode, name) {
  const inverse = /Inverse/i.test(name || '');
  // Surface meaning does not flip between themes, but the *normal text context*
  // does: Light mode normal text sits on light Surface; Dark mode normal text
  // sits on dark Surface Strong. Inverse text uses the opposing material.
  const useStrong = mode === 'dark' ? !inverse : inverse;
  return useStrong
    ? '--bc-color-surface-general-primary-strong'
    : '--bc-color-surface-general-primary';
}

function accessibilityBackgroundPrimitive(flavour, mode, name) {
  const token = accessibilityBackgroundToken(mode, name);
  const candidates = surfaceCandidates(
    flavour,
    mode,
    token.endsWith('-strong') ? 'Surface General Primary Strong' : 'Surface General Primary'
  );
  return candidates[0] || null;
}

function filterCandidatesByAccessibility(flavour, mode, row, candidates, fixed) {
  const minimum = ratioThreshold(effectiveAccessibility(row, mode).minimum);
  if (!minimum || fixed || !candidates.length) return candidates;

  const backgroundPrimitive = accessibilityBackgroundPrimitive(flavour, mode, row.name);
  const background = backgroundPrimitive ? primitiveHex(flavour, backgroundPrimitive) : null;
  if (!background) return candidates;

  return candidates.filter((candidate) => {
    const foreground = primitiveHex(flavour, candidate);
    const ratio = contrastRatioForHex(foreground, background);
    return ratio !== null && ratio >= minimum;
  });
}

function filterDarkMaterialVisibility(flavour, mode, row, candidates, fixed) {
  if (mode !== 'dark' || fixed || !candidates.length) return candidates;
  const name = String(row?.name || '');
  const isFillSubtle = row?.group === 'Fill' && /Subtle/i.test(name);
  const isFillSoft = row?.group === 'Fill' && /Soft/i.test(name);
  const isBorderSubtle = row?.group === 'Border' && /Subtle/i.test(name);
  if (!isFillSubtle && !isFillSoft && !isBorderSubtle) return candidates;

  const dedicatedDark = GROUND_DARK_BASES.every((token) => available(flavour, token));
  const canvasSource = dedicatedDark ? GROUND_DARK_BASES[0] : null;
  const canvasValue = canvasSource ? primitiveHex(flavour, canvasSource) : null;
  if (!canvasValue) return candidates;

  const minimumDelta = isFillSoft ? 12 : isFillSubtle ? 8 : 6;
  const visible = candidates.filter((candidate) => {
    const value = primitiveHex(flavour, candidate);
    const distance = value ? deltaE(value, canvasValue) : null;
    return distance !== null && distance >= minimumDelta;
  });
  return visible.length ? visible : candidates;
}

function filterCandidatesByTextStrongSeparation(flavour, row, candidates, fixed) {
  if (fixed || row.group !== 'Text' || !/ Strong(?: Inverse)?$/i.test(row.name || '')) return candidates;
  const family = familyFromName(row.name);
  if (!family || family === 'neutral') return candidates;
  const minimum = Number(row.selection?.visual?.minimumSiblingDeltaE || 0);
  if (!minimum) return candidates;
  const base = primitiveHex(flavour, FAMILY_BASES[family]);
  if (!base) return candidates;
  return candidates.filter((candidate) => {
    const value = primitiveHex(flavour, candidate);
    const distance = value ? deltaE(base, value) : null;
    return distance !== null && distance >= minimum;
  });
}

export function semanticCandidateSet(flavour, mode, row) {
  let candidates = [], fixed = false;
  if (row.group === 'Tones / Design Material') {
    const key = String(row.name || '').toLowerCase();
    const base = FAMILY_BASES[key];
    candidates = base ? candidatesExisting(flavour, [base]) : [];
    fixed = true;
  } else if (row.group === 'Canvas') {
    const index = /Secondary/i.test(row.name) ? 1 : /Tertiary/i.test(row.name) ? 2 : 0;
    const dedicatedDark = mode === 'dark'
      && GROUND_DARK_BASES.every((token) => available(flavour, token));

    if (mode === 'light') {
      // Authored Light Ground values are the Canvas values. Do not let the
      // semantic planner tint, shade, reorder or collapse them.
      candidates = candidatesExisting(flavour, [GROUND_LIGHT_BASES[index]]);
      fixed = candidates.length === 1;
    } else if (dedicatedDark) {
      // A complete authored Dark Ground palette owns Dark Canvas literally.
      candidates = candidatesExisting(flavour, [GROUND_DARK_BASES[index]]);
      fixed = candidates.length === 1;
    } else {
      // Dedicated Dark Ground is optional. Only the no-Dark-palette fallback
      // may derive candidates from Light Ground tonal families.
      const groundTokens = groundBasesForMode(flavour, mode).flatMap((base) => [
        ...[90,80,70,60,50,40,30,20,10].map((amount) => tone(base, 'tint', amount)),
        base,
        ...[10,20,30,40,50,60,70,80,90].map((amount) => tone(base, 'shade', amount))
      ]);
      candidates = candidatesExisting(flavour, groundTokens);
      fixed = false;
    }
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
  const rawCandidateCount = candidates.length;
  candidates = filterCandidatesByAccessibility(flavour, mode, row, candidates, fixed);
  candidates = filterDarkMaterialVisibility(flavour, mode, row, candidates, fixed);
  candidates = filterCandidatesByTextStrongSeparation(flavour, row, candidates, fixed);
  const accessibility = effectiveAccessibility(row, mode);
  const accessibilityBackground = accessibility.minimum
    ? accessibilityBackgroundPrimitive(flavour, mode, row.name)
    : null;
  const set = {
    token: row.token,
    group: row.group,
    name: row.name,
    purpose: row.purpose || '',
    context: row.context || '',
    sourceRule: row.sourceRule || '',
    appearanceRule: row.appearanceRule || '',
    relationshipRule: row.relationshipRule || '',
    selection: row.selection || {},
    notes: row.notes || '',
    rules: {
      global: CONTRACT.rules?.global || [],
      group: CONTRACT.rules?.groups?.[row.group] || []
    },
    accessibilityMinimum: accessibility.minimum,
    accessibilityRecommended: accessibility.recommended,
    accessibilityBackground,
    accessibilityFiltered: rawCandidateCount !== candidates.length,
    rawCandidateCount,
    mode,
    candidates,
    fixed
  };
  return enrichCandidateSet(flavour, set);
}

export function buildSemanticCandidateSets(flavour, mode) {
  if (!['light','dark'].includes(mode)) throw new Error('Semantic colour mode must be light or dark.');
  return semanticRows().map((row) => semanticCandidateSet(flavour, mode, row));
}

export function fixedSemanticMappings(flavour, mode) {
  const out = {};
  for (const set of buildSemanticCandidateSets(flavour, mode)) if (set.fixed && set.candidates[0]) out[set.token] = set.candidates[0];
  return out;
}

export function validateSemanticMappings(flavour, mappings, mode) {
  const allowedByTarget = new Map(buildSemanticCandidateSets(flavour, mode).map((set) => [set.token, new Set(set.candidates)]));
  const clean = {};
  for (const [target, source] of Object.entries(mappings || {})) {
    if (!allowedByTarget.has(target)) throw new Error(`${target} is not an editable BufferCore colour Semantic.`);
    if (!allowedByTarget.get(target).has(source)) throw new Error(`${source} is not a legal ${mode} Primitive source for ${target}.`);
    clean[target] = source;
  }
  return clean;
}

export function semanticCompletion(flavour, mode) {
  const sets = buildSemanticCandidateSets(flavour, mode);
  const mappings = flavour?.semanticMappings?.colour?.[mode] || {};
  const complete = sets.filter(s => s.candidates.length).every(s => mappings[s.token] && s.candidates.includes(mappings[s.token]));
  return { complete, total: sets.length, mappable: sets.filter(s=>s.candidates.length).length, mapped: Object.keys(mappings).length, missing: sets.filter(s=>s.candidates.length && !mappings[s.token]).map(s=>s.token), unavailable: sets.filter(s=>!s.candidates.length).map(s=>s.token) };
}



// Neutral Text spacing is derived from the current legal candidate evidence.
// No Neutral step is hard-coded here. The generator spreads Muted / Subtle /
// Default across the usable contrast range after accessibility filtering, while
// still allowing the manual mapping UI to choose any legal candidate.
function adaptiveGeneralTextHierarchy(candidateSets, selected) {
  const generalRole = (set) => {
    if (set?.group !== 'Text') return null;
    const name = String(set?.name || '');
    if (/Primary|Secondary|Accent|Success|Warning|Error|Info/i.test(name)) return null;
    const role = /Muted$/i.test(name) ? 'muted'
      : /Subtle$/i.test(name) ? 'subtle'
      : /Default$/i.test(name) ? 'default'
      : null;
    if (!role) return null;
    return { role, inverse: /Inverse/i.test(name) };
  };

  const evidenceFor = (set, source) =>
    (set?.candidateEvidence || []).find((candidate) => candidate.source === source) || null;

  const groups = new Map();
  for (const set of candidateSets || []) {
    const info = generalRole(set);
    if (!info || !set?.candidates?.length) continue;
    const key = info.inverse ? 'inverse' : 'normal';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ set, ...info });
  }

  for (const rows of groups.values()) {
    const order = { muted: 0, subtle: 1, default: 2 };
    rows.sort((a, b) => order[a.role] - order[b.role]);
    if (rows.length < 2) continue;

    const usable = rows.map((row) => ({
      ...row,
      candidates: (row.set.candidates || [])
        .map((source) => ({ source, evidence: evidenceFor(row.set, source) }))
        .filter((item) => typeof item.evidence?.contrast === 'number' && item.evidence?.value)
    }));
    if (usable.some((row) => !row.candidates.length)) continue;

    const allMetrics = usable.flatMap((row) => row.candidates.map((item) => item.evidence.contrast));
    const minMetric = Math.min(...allMetrics);
    const maxMetric = Math.max(...allMetrics);
    const span = maxMetric - minMetric;
    if (!(span > 0)) continue;

    const combinations = [];
    const walk = (index, choices) => {
      if (index === usable.length) {
        combinations.push(choices);
        return;
      }
      for (const candidate of usable[index].candidates) {
        if (choices.some((choice) => choice.source === candidate.source)) continue;
        const previous = choices[choices.length - 1];
        if (previous && candidate.evidence.contrast <= previous.evidence.contrast) continue;
        walk(index + 1, [...choices, candidate]);
      }
    };
    walk(0, []);
    if (!combinations.length) continue;

    const rank = (choices) => {
      const positions = choices.map((choice) =>
        (choice.evidence.contrast - minMetric) / span
      );
      const targets = positions.map((_, index) =>
        positions.length === 1 ? 1 : index / (positions.length - 1)
      );
      const targetDeviation = positions.reduce(
        (sum, position, index) => sum + Math.abs(position - targets[index]),
        0
      );
      const gaps = positions.slice(1).map((position, index) => position - positions[index]);
      const gapImbalance = gaps.length > 1 ? Math.max(...gaps) - Math.min(...gaps) : 0;
      const siblingDistances = choices.slice(1).map((choice, index) =>
        deltaE(choices[index].evidence.value, choice.evidence.value)
      ).filter((value) => value !== null);
      const minSiblingDistance = siblingDistances.length ? Math.min(...siblingDistances) : 0;

      // Lexicographic ranking: use the available legal range first, then favour
      // even hierarchy spacing, then maximise visible sibling separation.
      return { targetDeviation, gapImbalance, minSiblingDistance };
    };

    combinations.sort((a, b) => {
      const A = rank(a), B = rank(b);
      return A.targetDeviation - B.targetDeviation
        || A.gapImbalance - B.gapImbalance
        || B.minSiblingDistance - A.minSiblingDistance;
    });

    const best = combinations[0];
    usable.forEach((row, index) => {
      selected[row.set.token] = best[index].source;
    });
  }

  return selected;
}

export function completeSemanticSelections(candidateSets = [], fixedMappings = {}, existingMappings = {}, aiMappings = []) {
  const explicitBatchSelections = Array.isArray(aiMappings?.batchSelections) ? aiMappings.batchSelections : [];
  const directAiMappings = Array.isArray(aiMappings) ? aiMappings : (aiMappings?.mappings || []);
  const deterministic = deterministicSemanticSelections(candidateSets, existingMappings, explicitBatchSelections);
  const selected = { ...(fixedMappings || {}), ...deterministic.selected };
  const legalByToken = new Map((candidateSets || []).map((set) => [set.token, new Set(set.candidates || [])]));
  for (const item of directAiMappings) {
    if (!item?.semanticToken || !item?.primitiveToken) continue;
    if (legalByToken.get(item.semanticToken)?.has(item.primitiveToken)) selected[item.semanticToken] = item.primitiveToken;
  }
  const unresolved = candidateSets.filter(set => set.candidates?.length && !selected[set.token]).map(set => set.token);
  const unavailable = candidateSets.filter(set => !set.candidates?.length).map(set => set.token);
  const autoCompleted = candidateSets.filter(set => selected[set.token] && !fixedMappings?.[set.token] && !(existingMappings?.[set.token] && existingMappings[set.token] === selected[set.token]) && !directAiMappings.some(item => item?.semanticToken===set.token && item?.primitiveToken===selected[set.token])).map(set=>set.token);
  adaptiveGeneralTextHierarchy(candidateSets, selected);
  return { selected, autoCompleted, unresolved:[...unresolved,...unavailable], batches: deterministic.batches };
}

export function semanticDesignBatches(flavour, mode) {
  return buildSemanticDesignBatches(buildSemanticCandidateSets(flavour, mode));
}

export function semanticFindings(flavour, mode, mappings = flavour?.semanticMappings?.colour?.[mode] || {}) {
  const sets = buildSemanticCandidateSets(flavour, mode);
  return semanticVisualFindings(flavour, mode, mappings, sets);
}
