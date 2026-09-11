# AGENTS.md

## Priority
Functional correctness of the browser app is more important than refactoring or style polish.

## Mandatory checks
Before opening a PR or marking the task done, run:
- npm run verify

`npm run verify` inspects the current branch and working tree, then runs checks only for the games that changed. It prefers `origin/main` as the base and falls back to local `main` only when that remote ref is missing.

Current targets:
- `card/`: Card ASTRA lint, smoke, and browser checks
- `shooter/`: shooter checks

`card_legacy/` is a preserved snapshot. Do not use it as the active Card source.
`defense/` is intentionally excluded from automatic verification until it becomes active work again.

## Hard rules
- Do not say the task is complete if verify fails.
- Do not open a PR if verify fails.
- Do not run unused game suites. Automatic verification must not run Defense.
- Prefer the smallest diff that restores working behavior.
- If UI behavior cannot be fully verified, state exactly what remains unverified.
- For frontend tasks, use image inputs/output when helpful and compare against the requested behavior.
