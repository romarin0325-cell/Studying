# Starward release · 2026-09-20

This document supersedes the original V2 wiki where UI, art, difficulty, boss-breach rules or release counts differ.

## Design and controls

Warm ivory panels, sage accents and a large illustrated battlefield replace the old technical board. Four environment paintings and ten original-reference guardians establish a coherent visual direction. Grok screenshots informed mobile hierarchy only.

A run asks where to place five guardians, how to spend growth crystals and when to interrupt a dangerous group. Main characters specialize in support shotgun, boss assassination, holy crowd control, or sword/flame attacks. Zeke's Ignis Smash now uses flame, making the advertised regeneration counter available.

Tap-select/place and card dragging share the same placement validator. The UI snaps within 0.85 logical cells of an available position. Auto placement offers a starting formation. Growth uses one crystal per level with trait branches at Lv4 and Lv6. Repositioning is free between waves.

Combat starts at 2×, with a 1× toggle. Starfall (별의 기원) targets a 2.6-cell radius once per wave, with 1.5 seconds of stun and 4 seconds of slow. Existing stun immunity still applies. Empty/invalid/paused casts do not spend its charge.

Ordinary breaches cost one core point; midbosses cost three, subject to World Shield. Final boss breaches always lose. Pharaoh base HP is 3200 to support the must-defeat objective. Story retains Easy parameters. Trial enables Normal: HP 1.25×, movement 1.06×, spawn interval 0.9×, boss HP 1.05×. Hard stays reserved and disabled.

The pause curtain, settings auto-pause and hidden-page auto-pause protect the run. Exiting an active wave returns to its boundary checkpoint. Optional elapsed time and cumulative report fields extend version-1 saves compatibly. Medals keep best stars/time independently by stage and difficulty. Legacy V1 run storage remains isolated.

## Renderer and release

Presentation copy lives in `presentation.js`; atlas frames in `Illustrations.js`. Companion crop bounds are measured per pose because generated cells are not perfectly aligned. Source PNGs are opaque white, not true alpha; AssetManager removes edge-connected white once on load.

BattleRenderer displays the active logical 12×12 battlefield. The engine retains its 12×16 coordinate contract; the unused lower rows are no longer a canvas UI band. Battlefield ViewportLayout fits the available surface and rotates display/input together in landscape. Legacy layout helper contracts remain intact.

Cached terrain/path, depth-sorted sprites, idle bob, attack poses, lunge, elemental trails, petals and sparse motes supply motion. Reduced effects disables decorative movement. Damage numbers and sound can be disabled. UI refresh is 10 Hz; simulation stays fixed at 60 Hz; DPR is capped at 2 and effect pools are bounded. Sounds are procedural and rate-limited; this release has no music track.

The 15.41 MiB HTML embeds all 70 manifest entries and needs no adjacent files or server. Art provenance and exact prompts are in [STARWARD_ART_PROMPTS.md](./STARWARD_ART_PROMPTS.md).

## Validation boundaries

The unit/integration suite covers 60 formations × four Story stages, termination and clear-rate gates, boss breaches, Starfall, Trial and persistence. The browser suite covers six viewports (360×800 through 1366×768), rotation, input coordinates and measured active-wave performance.

The experience suite plays Story and Trial through ten waves in the standalone `file://` artifact. Formation, drag, targeting, pause, growth, traits, continue, victory and medals use actual UI controls; battle ticks are accelerated between decisions. It also checks 320×568 document fit. Offline smoke checks zero external resources, persistence and blocked-storage fallback.

Root `npm run verify` remains mandatory and deliberately excludes Defense from automatic game selection. Physical Android/iOS hardware, Safari/WebView differences, long-session thermals and player enjoyment remain unverified. Automated checks do not certify commercial readiness.

## Recorded checks

Final deterministic run: 100 tests passed. Story auto-placement with balanced growth, without player Starfall assistance:

| Journey | Victories / 60 formations | Estimated median minutes at 2×, including 69 seconds of decisions |
| --- | --- | --- |
| Dawn garden | 56 / 60 | 3.62 |
| Moonshade forest | 60 / 60 | 5.05 |
| Observatory | 57 / 60 | 3.63 |
| Golden return | 58 / 60 | 3.62 |

Browser active-wave probes measured 58.7–60.0 fps, update p95 0.2 ms and render p95 0.4–0.6 ms on the desktop Chromium test host. These are sampled automated probes, not a worst-case boss benchmark or phone performance guarantee. Offline smoke and both complete experience runs passed with zero external HTTP requests and zero page errors. The repository gate passed with no automatically selected game suites, as expected for Defense-only work.
