# Astral Bloom — dungeon and learning expansion

Source request: pasted-text-1.txt, 2026-09-12. All requirements below remain delivery gates until verified.

- Four selectable dungeons, three stages each, easy/normal/hard; later dungeons harder. Stage 1 formation encounter, stage 2 dungeon sentinel, stage 3 existing final boss. A common sentinel archetype has four dungeon-specific attacks and artwork.
- Empire enemies explode after death with a readable warning; Light enemies split into exactly three fast offspring; Dark enemies release a barrage if not killed before their visible countdown; Chaos enemies fire slow large projectiles that split near the player.
- Character concepts use english_vocab_version/data.js and active card/game/data.js: Rumi celestial forms, Luna darkness/evasion, Zeke flame enchantment, Jasmine sanctuary; bosses use ice/destruction, holy rays, apocalypse, darkness/genocide respectively.
- Six heroes with two styles each. Snow Rabbit: frost control and snowflake ricochet; Cinderella: crystal piercing and midnight marks. Preserve reference costumes and current SD tone; replace Luna portrait and battle art.
- Local calendar rotation: Mon/Tue Rumi + Luna; Wed/Thu Zeke + Jasmine; Fri/Sat Snow Rabbit + Cinderella; Sunday all. Grammar success grants selected off-day hero for that calendar day. Recheck when launching.
- Library: searchable vocabulary, collocations, grammar lectures, practice, saved mistakes and progress. Card data is source of truth, exported deterministically into a local offline snapshot with hashes/provenance. No invented replacement questions. Grammar prompts offer the associated lecture before starting.
- Remove stage blessings. Stage 1 vocabulary, stage 2 collocation, stage 3 grammar quiz; correct answers choose +1 life or +1 bomb, wrong answers explain and continue without recovery. No recovery above run caps. Final quiz completion opens the dungeon reward.
- Weekly Monday reset: four dungeon first-clear claims maximum, shared across difficulties. Ticket records difficulty: rare 10% easy / 25% normal / 45% hard; otherwise normal, uniform within rarity. Duplicates remain owned once and yield a named collection result (no hidden rerolls). Three starter normal artifacts allow first-run loadout; choose up to three unique owned artifacts.
- Implement all nine normal and six rare artifacts; stacking additive within attack or bomb bonuses. Permanent and conditional attack bonuses form one additive group applied once to weapon, support and bomb damage; bomb-only and hero-specific multipliers remain separate. Shield consumes a bomb on hit. Mask consumes one life for an empty-stock bomb only while life > 1, cannot refund that cost through Jasmine, cannot overlap an active bomb, and is capped at three uses per stage. World Tree fairy deals real auxiliary damage. Base max life 4 (previous healing cap 6 minus 2), starting life normal 3/easy 4; hard max/start 3. Every heal respects modified max.
- One grammar revival attempt per run, restored to min(2,maxLife); decline/wrong ends run. No retry loophole within that run.
- Jasmine chain has no petal fallback; retarget every .05 sec while idle. Rumi beam drawn from current player each render; damage every .075 sec; focus resets after >.15 sec gap, caps at +65%.
- Preserve offline single HTML, bounded objects and mobile touch controls. Verify actual rendered UI, all dungeon/pattern transitions, learning/reward/persistence edges, all artifacts, six heroes, laser/chain regressions, offline network silence, mobile sizes, performance. Run root npm run verify before commit/push/Ready PR.

## Evidence map

- `tests/engine.test.mjs`: twelve actual weapon damage paths, each dungeon's three-room ending, four bosses and all phases, recovery caps, seeded simulation.
- `tests/expansion.test.mjs`: laser render-position records and focus continuity, chain silence, all artifacts, each special monster, one revival, calendar/week boundaries, reward persistence and odds thresholds, all source question answers/lecture links, frost/bounce/marks.
- `verify.mjs`: actual offline distributable on 320x568, 390x844, 430x932 and landscape; selection, library, equipment, touch movement/bombs, pause/resume, fourth dungeon, storage denied, zero external requests.
- `tests/flow.mjs`: test-only instrumented copy of built HTML, real first-room timer and UI callbacks; day unlock/lecture, all three quizzes, sentinel gate, first-clear ticket/draw, reload, wrong-answer review and one revival. Combat setup shortcuts are isolated to this test, never shipped.
- `tests/balance.mjs`: 144 seeded autopilot runs across all 12 weapons, 4 dungeons and 3 difficulties. This is a comparison probe, not a human difficulty guarantee.
- `tests/stress.mjs`: live renderer at 390x844, 360 bullets/180 particles with new hero and fairy; diagnostic output in ignored `artifacts/`.
- Visual review: companion atlas corrected for exactly two rabbit ears, bare legs, Luna's reference top, isolated cell boundaries; actual sortie, dungeon, sentinel, quiz, artifact and result screenshots in `artifacts/`.
- Physical phone/browser file associations remain device-dependent and have not been tested on physical hardware. The standalone HTML is tested under desktop Chromium mobile emulation with network disabled.

Publication gate: rerun root `npm run verify` after final integration, inspect exact staged diff, commit/push and verify an OPEN non-draft PR.
