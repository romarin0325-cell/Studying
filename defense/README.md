# Hero Core Defense

`defense/` is the active deterministic tower-defense implementation promoted from the V2 codebase. The previous Defense implementations were removed.

## Maintainer wiki

Start with [`docs/README.md`](./docs/README.md). It links the architecture overview, class/runtime API, content authoring guide, and UI/rendering/release handbook. The documentation is written for future maintainers and includes extension examples, invariants, test commands, and release checklists.

## Run

From the repository root:

```powershell
npm run serve:defense
```

Open `http://127.0.0.1:4174/`. The source entry uses ES modules and therefore needs HTTP.

## Mobile single-file build

```powershell
npm run build:defense-local
```

The self-contained output is `defense/dist-local/HeroCoreDefense.html`. It is the supported `file://` entry for mobile browsers and WebViews.

## Art assets

The release manifest contains 66 individual 512×512 WebP files: 10 portraits, 40 directional hero sprites, and 16 directional boss sprites. The generated source atlases are kept under `assets/source-atlases/` for traceability. The image generator returned opaque checkerboard pixels instead of an alpha channel, so the manifest records `hasAlpha: false` and the loader removes only the bright background connected to each image edge at runtime. Development still retains the specified front/token fallback; release validation requires all 66 files.

## Validation

```powershell
npm run lint:defense
npm run test:defense
npm run test:defense:local
npm run test:defense:browser
```

The repository completion gate remains `npm run verify`.
