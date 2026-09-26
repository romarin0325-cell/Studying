# AGENTS.override.md

## Scope
These rules apply to everything under `card/`.

## Priority
- Prioritize browser-visible correctness in DREAMWEAVER (`card/dist/DREAMWEAVER.html`) first.
- Keep game rules in `card/game/` and presentation hooks in `card/src/`.
- `card_legacy/` is a frozen snapshot. Do not use it as the active Card source.
- Keep diffs minimal and avoid unrelated refactors.

## Mandatory checks
Run from repo root before completion:
- npm run verify

`npm run verify` selects only the Card checks mapped to changed Card behavior. Use `npm run verify:plan` to review the mapping. Do not run Shooter or Defense for Card-only work, and do not run the full Card suite unless the user explicitly requests it.

If a deployment input changes, build `card/dist/DREAMWEAVER.html` once with the Card package build and run the selected bundle boot check so the committed artifact stays in sync. Documentation-only and test-only changes do not build.

## Verification note
If a change cannot be fully verified by `npm run verify`, explicitly list what is still unverified.
