# AGENTS.override.md

## Scope
These rules apply to everything under `card/`.

## Priority & Structure
- Prioritize browser-visible correctness in DREAMWEAVER (`card/dist/DREAMWEAVER.html`).
- Keep game rules in `card/game/` and presentation hooks in `card/src/`.
- `card_legacy/` is a frozen snapshot. Do not use it as the active Card source.
- When deployment inputs change, build `card/dist/DREAMWEAVER.html` once with the Card package build (`npm run build:card`).
- Keep diffs minimal and avoid unrelated refactors.
- If a change cannot be fully verified, explicitly state what is still unverified.
