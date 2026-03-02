# AGENTS.override.md

## Scope
These rules apply to everything under `card/`.

## Priority
- Prioritize browser-visible correctness in `card/` first.
- Keep diffs minimal and avoid unrelated refactors.

## Mandatory checks
Run from repo root before completion:
- npm run verify

## Verification note
If a change cannot be fully verified by `npm run verify`, explicitly list what is still unverified.
