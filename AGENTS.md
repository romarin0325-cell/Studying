# AGENTS.md

## Priority
Functional correctness of the browser app is more important than refactoring or style polish.

## Mandatory checks
Before opening a PR or marking the task done, run:
- npm run verify

## Hard rules
- Do not say the task is complete if verify fails.
- Do not open a PR if verify fails.
- Prefer the smallest diff that restores working behavior.
- If UI behavior cannot be fully verified, state exactly what remains unverified.
- For frontend tasks, use image inputs/output when helpful and compare against the requested behavior.
