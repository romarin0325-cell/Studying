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

`npm run verify` only runs the card suite when `card/` or `scripts/verify_card_*` changed. Do not run Defense for card-only work.

If game sources change, rebuild `card/dist/DREAMWEAVER.html` with the Card package build so the committed bundle stays in sync.

## Verification note
If a change cannot be fully verified by `npm run verify`, explicitly list what is still unverified.
