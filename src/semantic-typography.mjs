const ROLE_RE = /^--bc-type-(display|heading|paragraph|label|overline)-(\d+)-(font-family|font-size|font-weight|line-height|letter-spacing)$/;
const REF_RE = /var\(\s*(--bc-type-[A-Za-z0-9_-]+)\s*\)/;

const PROPERTY_SOURCE = {
  'font-family': /^--bc-type-font-family-/,
  'font-size': /^--bc-type-size-(\d+)$/,
  'font-weight': /^--bc-type-weight-(\d+)$/,
  'line-height': /^--bc-type-leading-(\d+)$/,
  'letter-spacing': /^--bc-type-tracking-(\d+)$/
};

function numberSuffix(value) {
  const m = String(value).match(/-(\d+)$/);
  return m ? Number(m[1]) : null;
}

function currentReference(token) {
  for (const variant of token?.variants || []) {
    const m = String(variant.rawValue || '').match(REF_RE);
    if (m) return m[1];
  }
  return null;
}

function nearby(sorted, current, radius = 1) {
  if (!sorted.length) return [];
  const index = sorted.indexOf(current);
  if (index < 0) return sorted;
  return sorted.slice(Math.max(0, index - radius), Math.min(sorted.length, index + radius + 1));
}

function candidatesFor(property, current, primitiveVariables) {
  const re = PROPERTY_SOURCE[property];
  const all = primitiveVariables.filter((name) => re.test(name));
  if (property === 'font-family') return all;
  all.sort((a, b) => (numberSuffix(a) ?? 0) - (numberSuffix(b) ?? 0));
  const radius = property === 'font-weight' ? 2 : 1;
  return nearby(all, current, radius);
}

export function buildTypographyCandidateSets(manifest, flavour = {}) {
  const tokens = Array.isArray(manifest?.tokens) ? manifest.tokens : [];
  const primitiveVariables = tokens.filter((t) => t.layer === 'primitive' && t.foundation === 'typography').map((t) => t.cssVariable);
  const overrides = flavour?.semanticMappings?.typography || {};
  return tokens
    .filter((t) => t.layer === 'semantic' && t.foundation === 'typography' && ROLE_RE.test(t.cssVariable))
    .map((token) => {
      const [, role, level, property] = token.cssVariable.match(ROLE_RE);
      const baseline = currentReference(token);
      const candidates = candidatesFor(property, baseline, primitiveVariables);
      const override = overrides[token.cssVariable] || null;
      const effective = override || baseline || null;
      return {
        token: token.cssVariable,
        role,
        level: Number(level),
        property,
        current: baseline,
        baseline,
        override,
        accepted: override,
        effective,
        inherited: !override,
        candidates,
        fixed: candidates.length === 1
      };
    })
    .sort((a, b) => {
      const roles = ['display','heading','paragraph','label','overline'];
      const props = ['font-family','font-size','font-weight','line-height','letter-spacing'];
      return roles.indexOf(a.role) - roles.indexOf(b.role) || a.level - b.level || props.indexOf(a.property) - props.indexOf(b.property);
    });
}

export function baselineTypographyMappings(manifest) {
  return Object.fromEntries(buildTypographyCandidateSets(manifest).filter((set) => set.baseline).map((set) => [set.token, set.baseline]));
}

export function effectiveTypographyMappings(manifest, flavour = {}) {
  return Object.fromEntries(buildTypographyCandidateSets(manifest, flavour).filter((set) => set.effective).map((set) => [set.token, set.effective]));
}

export function normaliseTypographyOverrides(manifest, mappings = {}) {
  const baseline = baselineTypographyMappings(manifest);
  const clean = validateTypographyMappings(manifest, mappings);
  for (const [semantic, primitive] of Object.entries(clean)) {
    if (baseline[semantic] === primitive) delete clean[semantic];
  }
  return clean;
}

export function validateTypographyMappings(manifest, mappings = {}) {
  const legal = new Map(buildTypographyCandidateSets(manifest).map((set) => [set.token, new Set(set.candidates)]));
  const clean = {};
  for (const [semantic, primitive] of Object.entries(mappings || {})) {
    if (!legal.has(semantic)) throw new Error(`${semantic} is not an editable BufferCore Typography Semantic role.`);
    if (!legal.get(semantic).has(primitive)) throw new Error(`${primitive} is not a legal Primitive source for ${semantic}.`);
    clean[semantic] = primitive;
  }
  return clean;
}

export function typographyCompletion(manifest, flavour = {}) {
  const sets = buildTypographyCandidateSets(manifest, flavour);
  const mappable = sets.filter((set) => set.candidates.length && set.baseline).length;
  const mapped = sets.filter((set) => set.candidates.length && set.effective && set.candidates.includes(set.effective)).length;
  const overridden = sets.filter((set) => !!set.override).length;
  return { mapped, mappable, overridden, inherited: Math.max(0, mapped - overridden), complete: mappable > 0 && mapped === mappable };
}
