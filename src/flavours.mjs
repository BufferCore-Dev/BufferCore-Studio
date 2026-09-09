import fs from 'node:fs';
import path from 'node:path';

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const COLOUR_CONTRACT_PRIMITIVE = /^--bc-color-(?:identity-ramp-[123](?:-(?:tint|shade)-(?:10|20|30|40|50|60|70|80|90))?|ground-ramp-[123]|neutral-(?:0|5|10|15|20|25|30|35|40|45|50|55|60|65|70|75|80|85|90|95|100)|status-(?:success|warning|error|info)(?:-(?:tint|shade)-(?:10|20|30|40|50|60|70|80|90))?|interaction-(?:link|link-inverse|link-visited|link-visited-inverse|focus|focus-inverse))$/;

function normaliseCssVariable(value) {
  return String(value || '').trim();
}

function isCanonicalStudioColourPrimitive(cssVariable) {
  return COLOUR_CONTRACT_PRIMITIVE.test(normaliseCssVariable(cssVariable));
}

function normalise(value) {
  return String(value || '').trim();
}

export function slugifyFlavourId(value) {
  return normalise(value)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function flavourBase(root) {
  return path.join(root, 'flavours');
}

function canonicalFlavourId(id) {
  const raw = normalise(id);
  const canonical = ID_PATTERN.test(raw) ? raw : slugifyFlavourId(raw);
  if (!ID_PATTERN.test(canonical)) throw new Error('Flavour needs a valid name.');
  return canonical;
}

function flavourFile(root, id) {
  return path.join(flavourBase(root), canonicalFlavourId(id), 'flavour.json');
}

function validateIdentity(input, existingId = null) {
  const displayName = normalise(input.displayName);
  if (!displayName) throw new Error('Flavour name is required.');
  const id = canonicalFlavourId(input.id || displayName);
  const canonicalExistingId = existingId ? canonicalFlavourId(existingId) : null;
  if (canonicalExistingId && id !== canonicalExistingId) throw new Error('A Flavour id is canonical and cannot be changed after creation. Duplicate the Flavour to use a new id.');
  return { id, displayName };
}


export function repairLegacyFlavourIdentity(root, document, sourceDirectory) {
  const currentId = normalise(document?.id);
  if (ID_PATTERN.test(currentId)) return { document, changed: false };

  const repairedId = slugifyFlavourId(document?.displayName || currentId);
  if (!ID_PATTERN.test(repairedId)) {
    throw new Error('Flavour needs a valid name before its canonical id can be repaired.');
  }

  const base = flavourBase(root);
  const targetDirectory = path.join(base, repairedId);
  const source = path.resolve(sourceDirectory);
  const target = path.resolve(targetDirectory);
  const baseResolved = path.resolve(base);

  if (!source.startsWith(baseResolved + path.sep) || !target.startsWith(baseResolved + path.sep)) {
    throw new Error('Flavour path is outside the BufferCore-Flavours root.');
  }
  if (source !== target && fs.existsSync(target)) {
    throw new Error(`Cannot repair Flavour id to "${repairedId}" because that Flavour already exists.`);
  }

  const repaired = { ...document, id: repairedId };
  if (source !== target) {
    fs.renameSync(source, target);
  }
  fs.writeFileSync(path.join(target, 'flavour.json'), `${JSON.stringify(repaired, null, 2)}\n`, 'utf8');

  return { document: repaired, changed: true, previousId: currentId, id: repairedId };
}

export function discoverFlavourDocuments(root) {
  const base = flavourBase(root);
  if (!fs.existsSync(base)) return [];
  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile() && entry.name === 'flavour.json') {
        try {
          let document = readJson(absolute);
          if (!document?.id) continue;
          const repaired = repairLegacyFlavourIdentity(root, document, path.dirname(absolute));
          document = repaired.document;
          found.push({
            id: document.id,
            displayName: document.displayName || document.id,
            description: typeof document.description === 'string' ? document.description : '',
            notes: typeof document.notes === 'string' ? document.notes : '',
            overrides: document.overrides && typeof document.overrides === 'object' ? document.overrides : {},
            semanticMappings: document.semanticMappings && typeof document.semanticMappings === 'object' ? document.semanticMappings : {},
            file: absolute,
            relativePath: path.relative(base, path.dirname(absolute)).split(path.sep).join('/')
          });
        } catch {
          // Invalid files are surfaced by Engine validation; library discovery stays resilient.
        }
      }
    }
  };
  walk(base);
  return found.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function getFlavourDocument(root, id) {
  const canonicalId = canonicalFlavourId(id);
  const file = flavourFile(root, canonicalId);
  if (!fs.existsSync(file)) return null;
  const document = readJson(file);
  return {
    ...document,
    description: typeof document.description === 'string' ? document.description : '',
    notes: typeof document.notes === 'string' ? document.notes : '',
    overrides: document.overrides && typeof document.overrides === 'object' ? document.overrides : {},
    semanticMappings: document.semanticMappings && typeof document.semanticMappings === 'object' ? document.semanticMappings : {}
  };
}

function writeDocument(root, document) {
  const file = flavourFile(root, document.id);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  return file;
}

export function createFlavour(root, input) {
  const { id, displayName } = validateIdentity(input);
  const file = flavourFile(root, id);
  if (fs.existsSync(file)) throw new Error(`Flavour "${id}" already exists.`);
  const document = {
    schemaVersion: 1,
    type: 'buffercore-flavour',
    id,
    displayName,
    description: normalise(input.description),
    notes: normalise(input.notes),
    overrides: {},
    semanticMappings: {}
  };
  writeDocument(root, document);
  return document;
}

export function updateFlavour(root, id, input) {
  const canonicalId = canonicalFlavourId(id);
  const current = getFlavourDocument(root, canonicalId);
  if (!current) throw new Error(`Flavour "${canonicalId}" was not found.`);
  const identity = validateIdentity({ ...current, ...input, id: canonicalId }, canonicalId);
  const document = {
    ...current,
    schemaVersion: 1,
    type: 'buffercore-flavour',
    id: canonicalId,
    displayName: identity.displayName,
    description: normalise(input.description ?? current.description),
    notes: normalise(input.notes ?? current.notes),
    overrides: current.overrides || {},
    semanticMappings: current.semanticMappings || {}
  };
  writeDocument(root, document);
  return document;
}

export function duplicateFlavour(root, id, input = {}) {
  const current = getFlavourDocument(root, id);
  if (!current) throw new Error(`Flavour "${id}" was not found.`);
  const displayName = normalise(input.displayName) || `${current.displayName} Copy`;
  const newId = normalise(input.id) || slugifyFlavourId(displayName);
  const identity = validateIdentity({ id: newId, displayName });
  if (fs.existsSync(flavourFile(root, identity.id))) throw new Error(`Flavour "${identity.id}" already exists.`);
  const copy = {
    ...current,
    id: identity.id,
    displayName: identity.displayName,
    description: normalise(input.description ?? current.description),
    notes: normalise(input.notes ?? current.notes),
    overrides: { ...(current.overrides || {}) },
    semanticMappings: structuredClone(current.semanticMappings || {})
  };
  writeDocument(root, copy);
  return copy;
}

export function deleteFlavour(root, id) {
  const file = flavourFile(root, id);
  if (!fs.existsSync(file)) throw new Error(`Flavour "${id}" was not found.`);
  const directory = path.dirname(file);
  fs.rmSync(directory, { recursive: true, force: true });
  return true;
}

export function updateFlavourOverrides(root, id, overrides, primitiveTokens) {
  const current = getFlavourDocument(root, id);
  if (!current) throw new Error(`Flavour "${id}" was not found.`);
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) throw new Error('Overrides must be an object.');
  const editable = new Map((primitiveTokens || []).map((token) => [normaliseCssVariable(token.cssVariable), token]));
  const next = { ...(current.overrides || {}) };
  for (const [rawCssVariable, rawValue] of Object.entries(overrides)) {
    const cssVariable = normaliseCssVariable(rawCssVariable);
    const alreadyStored = Object.prototype.hasOwnProperty.call(current.overrides || {}, cssVariable);
    const validGuidedColourPrimitive = isCanonicalStudioColourPrimitive(cssVariable);
    if (!editable.has(cssVariable) && !alreadyStored && !validGuidedColourPrimitive) {
      throw new Error(`${cssVariable} is not an editable BufferCore Primitive.`);
    }
    const value = String(rawValue ?? '').trim();
    if (!value || value === 'initial') delete next[cssVariable];
    else next[cssVariable] = value;
  }
  const colourKeys = new Set([
    ...[...editable.keys()].filter((key) => key.startsWith('--bc-color-')),
    ...Object.keys(current.overrides || {}).filter((key) => key.startsWith('--bc-color-')),
    ...Object.keys(overrides || {}).map(normaliseCssVariable).filter((key) => key.startsWith('--bc-color-'))
  ]);
  const colourChanged = [...colourKeys].some((key) => (current.overrides || {})[key] !== next[key]);
  const typographyChanged = [...editable.keys()].filter((key) => key.startsWith('--bc-type-')).some((key) => (current.overrides || {})[key] !== next[key]);
  const semanticMappings = structuredClone(current.semanticMappings || {});
  if (colourChanged && semanticMappings.colour) delete semanticMappings.colour;
  if (typographyChanged && semanticMappings.typography) delete semanticMappings.typography;
  const document = { ...current, overrides: next, semanticMappings };
  writeDocument(root, document);
  return document;
}

export function primitiveCatalogue(engineManifest) {
  if (!engineManifest?.tokens || !Array.isArray(engineManifest.tokens)) return [];
  return engineManifest.tokens
    .filter((token) => token.layer === 'primitive')
    .map((token) => ({
      id: token.id,
      cssVariable: token.cssVariable,
      foundation: token.foundation,
      path: token.path,
      group: token.group,
      valueType: token.valueType,
      units: token.units || [],
      value: token.variants?.[0]?.rawValue ?? null
    }));
}


export function updateFlavourSemanticColourMappings(root, id, mode, mappings, validator) {
  const current = getFlavourDocument(root, id);
  if (!current) throw new Error(`Flavour "${id}" was not found.`);
  if (!['light','dark'].includes(mode)) throw new Error('Semantic colour mode must be light or dark.');
  const clean = validator ? validator(current, mappings || {}, mode) : { ...(mappings || {}) };
  const semanticMappings = structuredClone(current.semanticMappings || {});
  semanticMappings.colour ||= {};
  semanticMappings.colour[mode] = clean;
  const document = { ...current, semanticMappings };
  writeDocument(root, document);
  return document;
}


export function updateFlavourSemanticTypographyMappings(root, id, mappings, validator) {
  const current = getFlavourDocument(root, id);
  if (!current) throw new Error(`Flavour "${id}" was not found.`);
  const clean = validator ? validator(mappings || {}) : { ...(mappings || {}) };
  const semanticMappings = structuredClone(current.semanticMappings || {});
  semanticMappings.typography = clean;
  const document = { ...current, semanticMappings };
  writeDocument(root, document);
  return document;
}
