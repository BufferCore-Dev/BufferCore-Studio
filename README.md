# BufferCore Studio

BufferCore Studio is the local authoring and sync surface for BufferCore. The current build introduces the first real Flavour workflow while keeping the Git/Figma control surface available under Sync.

## Run

```powershell
npm install
npm test
npm start
```

Open `http://127.0.0.1:3850`.

## Current Studio foundation

- Flavour library backed directly by `BufferCore-Flavours/flavours/**/flavour.json`.
- Create, edit identity, duplicate and delete canonical Flavours.
- Eight-step Flavour wizard framework: Identity, Colour, Typography, Shape, Spacing & Scale, Depth, Motion and Review.
- Wizard Foundation status is derived from the current Engine primitive catalogue; semantic tokens are never offered as Flavour overrides.
- Persistent AI assistant shell with current Flavour/step context. Provider-backed AI and proposal actions arrive with the Colour/Typography authoring build.
- Existing repository Pull + build, validation and commit/push controls remain under Sync.

Studio does not own a second design-system format. It authors the canonical Flavour JSON consumed by BufferCore-Engine.

## Colour, Typography and local AI

The Flavour wizard edits canonical Primitive overrides directly. Colour and Typography are visual editors; untouched values inherit the BufferCore baseline and semantic tokens remain owned by BufferCore.

Studio can use an Ollama-compatible local model server for proposal-only assistance. By default it checks `http://127.0.0.1:11434`. Override with `BUFFERCORE_AI_URL` and optionally `BUFFERCORE_AI_MODEL`. AI responses are filtered to the Primitive tokens supplied for the active step and must be explicitly accepted before they become local unsaved overrides.

## Shared LocalAI

On Windows, Studio discovers the shared local AI service from `C:\LocalAI\registry.json` by default. The registry owns runtime/model discovery; Studio owns BufferCore-specific prompts, proposal validation, and Flavour context. Selecting or using an Ollama model registers `BufferCore Studio` under the registry `apps` map without changing other applications. `BUFFERCORE_LOCALAI_REGISTRY`, `BUFFERCORE_AI_URL`, and `BUFFERCORE_AI_MODEL` remain available as development overrides.

## Flavour completion flow

The Review step validates the canonical primitive-only Flavour, can build the resolved Engine + Figma manifests locally without pulling, and can commit/push the BufferCore-Flavours repository. Figma remains the application surface: select the Flavour in the development plugin, Pull + build, Inspect, then Apply.
