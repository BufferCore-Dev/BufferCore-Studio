import fs from 'node:fs';
import path from 'node:path';

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

function flavourFile(root, id) {
  if (!ID_PATTERN.test(id)) throw new Error('Flavour id must use lowercase kebab-case.');
  return path.join(flavourBase(root), id, 'flavour.json');
}

function validateIdentity(input, existingId = null) {
  const displayName = normalise(input.displayName);
  const id = normalise(input.id || slugifyFlavourId(displayName));
  if (!displayName) throw new Error('Flavour name is required.');
  if (!ID_PATTERN.test(id)) throw new Error('Flavour id must use lowercase kebab-case.');
  if (existingId && id !== existingId) throw new Error('A Flavour id is canonical and cannot be changed after creation. Duplicate the Flavour to use a new id.');
  return { id, displayName };
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
          const document = readJson(absolute);
          if (!document?.id) continue;
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
  const file = flavourFile(root, id);
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
  const current = getFlavourDocument(root, id);
  if (!current) throw new Error(`Flavour "${id}" was not found.`);
  const identity = validateIdentity({ ...current, ...input, id }, id);
  const document = {
    ...current,
    schemaVersion: 1,
    type: 'buffercore-flavour',
    id,
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
  const editable = new Map((primitiveTokens || []).map((token) => [token.cssVariable, token]));
  const next = { ...(current.overrides || {}) };
  for (const [cssVariable, rawValue] of Object.entries(overrides)) {
    if (!editable.has(cssVariable)) throw new Error(`${cssVariable} is not an editable BufferCore Primitive.`);
    const value = String(rawValue ?? '').trim();
    if (!value || value === 'initial') delete next[cssVariable];
    else next[cssVariable] = value;
  }
  const colourChanged = [...editable.keys()].filter((key) => key.startsWith('--bc-color-')).some((key) => (current.overrides || {})[key] !== next[key]);
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
