# 별의 수호자 · Starward

Portrait-first fantasy tower defense on the deterministic Defense V2 engine: four illustrated journeys, ten guardians and ten waves, with Story and Trial difficulties.

## Play

Open `defense/dist-local/HeroCoreDefense.html` directly. This 15.41 MiB file includes all art, code and styles and makes no network requests. Source development uses `npm run serve:defense` at http://127.0.0.1:4174/.

Choose one protagonist and four companions. Tap a card then a glowing position, or drag the card onto the battlefield. Automatic placement provides a starting formation. Spend crystals between waves; choose traits at Lv4 and Lv6. Aim **별의 기원** once per wave to stop a threatening group. Combat starts at 2× speed; pause, speed, sound and effect controls remain available.

Final bosses must be defeated: a breach ends the run. Midbosses inflict three core damage. Medals persist separately for each difficulty. Continue restarts an unfinished wave at its saved boundary.

## Art and documentation

Four atlases in `assets/moonlit/` provide 20 character poses, 10 enemies, 4 bosses, 2 props and 4 environments. Opaque white sprite backgrounds are removed once on load. The prior 66 portrait/directional assets remain fallback entries, giving 70 embedded release assets.

Read [current release and design notes](docs/STARWARD_RELEASE.md), [exact generation prompts](docs/STARWARD_ART_PROMPTS.md) and the [underlying engine wiki](docs/README.md).

## Build and validation

```powershell
npm run lint:defense
npm run test:defense
npm run test:defense:local
npm run test:defense:browser
npm run test:defense:experience
npm run verify
```

The local test rebuilds the HTML; run it before the experience test. Experience checks use real UI decisions and accelerated deterministic battle ticks. Root verification deliberately excludes Defense, so the explicit Defense checks above remain necessary.
