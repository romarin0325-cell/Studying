# AGENTS.md

## Priority
Functional correctness of the browser app is more important than refactoring or style polish.

## Mandatory checks
Before opening a PR or marking the task done, run:
- npm run verify

`npm run verify` inspects the current branch and working tree, then runs checks only for the games that changed. It prefers `origin/main` as the base and falls back to local `main` only when that remote ref is missing.

Current targets:
- `card/`, `card_remaster/`: card lint, smoke, and browser checks
- `idle_hero/`: idle smoke
- `defense_hero_v2/`: Defense V2 lint, tests, local bundle, and browser checks

Defense Hero V1 (`defense_hero/`) is unused. Do not run or restore its verification.

## Hard rules
- Do not say the task is complete if verify fails.
- Do not open a PR if verify fails.
- Do not run unused game suites. Card-only changes must not wait on Defense V1 or V2.
- Prefer the smallest diff that restores working behavior.
- If UI behavior cannot be fully verified, state exactly what remains unverified.
- For frontend tasks, use image inputs/output when helpful and compare against the requested behavior.
