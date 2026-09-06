# BufferCore Studio

Temporary BufferCore control surface while the final Studio is rebuilt on BufferCore itself.

## Run

```powershell
cd D:\BufferCoreSystem\BufferCore-Studio
npm start
```

Open `http://127.0.0.1:3850`.

The surface reads the sibling BufferCore repositories, exposes repository state and uncommitted changes, selects a Flavour, runs the existing safe repository pull/build pipeline, validates Engine/Figma output, and can explicitly commit + push a selected repository.

Commit + push never happens implicitly. Pull/build uses the safe fast-forward-only repository workflow owned by BufferCore-Figma.
