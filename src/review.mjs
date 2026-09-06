export function reviewFlavour(flavour, primitiveCatalogue = []) {
  if (!flavour) throw new Error('Flavour not found.');
  const primitives = new Map((primitiveCatalogue || []).map((token) => [token.cssVariable, token]));
  const overrides = flavour.overrides && typeof flavour.overrides === 'object' ? flavour.overrides : {};
  const byFoundation = {};
  const issues = [];

  for (const [cssVariable, value] of Object.entries(overrides)) {
    const token = primitives.get(cssVariable);
    if (!token) {
      issues.push({ level: 'error', code: 'unknown-override', cssVariable, message: `${cssVariable} is not a current BufferCore Primitive.` });
      continue;
    }
    const clean = String(value ?? '').trim();
    if (!clean || clean === 'initial') {
      issues.push({ level: 'warning', code: 'inherited-override', cssVariable, message: `${cssVariable} should inherit Core rather than being stored as ${clean || 'empty'}.` });
      continue;
    }
    byFoundation[token.foundation] = (byFoundation[token.foundation] || 0) + 1;
  }

  return {
    ok: !issues.some((issue) => issue.level === 'error'),
    id: flavour.id,
    displayName: flavour.displayName,
    overrideCount: Object.keys(overrides).length,
    foundationCounts: byFoundation,
    issues
  };
}
