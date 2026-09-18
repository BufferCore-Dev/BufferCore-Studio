const COLOUR_CONTRACT_PRIMITIVE = /^--bc-color-(?:identity-ramp-[123](?:-(?:tint|shade)-(?:10|20|30|40|50|60|70|80|90))?|ground-(?:dark-)?ramp-[123](?:-(?:tint|shade)-(?:10|20|30|40|50|60|70|80|90))?|neutral-(?:0|5|10|15|20|25|30|35|40|45|50|55|60|65|70|75|80|85|90|95|100)|status-(?:success|warning|error|info)(?:-(?:tint|shade)-(?:10|20|30|40|50|60|70|80|90))?|interaction-(?:link|link-inverse|link-visited|link-visited-inverse|focus|focus-inverse))$/;

export function reviewFlavour(flavour, primitiveCatalogue = []) {
  if (!flavour) throw new Error('Flavour not found.');
  const primitives = new Map((primitiveCatalogue || []).map((token) => [token.cssVariable, token]));
  const overrides = flavour.overrides && typeof flavour.overrides === 'object' ? flavour.overrides : {};
  const byFoundation = {};
  const issues = [];

  for (const [cssVariable, value] of Object.entries(overrides)) {
    const token = primitives.get(cssVariable);
    if (!token) {
      if (COLOUR_CONTRACT_PRIMITIVE.test(String(cssVariable).trim())) {
        issues.push({ level: 'warning', code: 'catalogue-lag-colour-override', cssVariable, message: `${cssVariable} is a valid BufferCore Colour Primitive contract token but is missing from the currently generated Studio catalogue. Rebuild Engine before final Figma build if this persists.` });
        byFoundation.colour = (byFoundation.colour || 0) + 1;
        continue;
      }
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
