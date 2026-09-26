# AGENTS.md

## Priority
Functional correctness of the browser app is more important than refactoring or style polish.

## Mandatory checks
Before opening a PR or marking the task done, run:
- npm run verify

`npm run verify` uses the merge base between the trusted base and HEAD, adds only
the current worktree's staged, unstaged, and untracked files for local runs, and
runs the smallest mapped checks for the changed behavior. Missing refs, unknown
runtime/config paths, and generated-output-only edits are blocking failures, not
successful empty scopes.

Use `npm run verify:plan` to inspect selection without running it. Use
`npm run verify:full -- --game <card|shooter|defense>` only when the user
explicitly requests a full suite for that game.

Current targets:
- `card/`: focused Card syntax, contract, build, and browser checks
- `shooter/`: focused Shooter unit, build, and browser checks

`card_legacy/` is a preserved snapshot. Do not use it as the active Card source.
`defense/` is intentionally excluded from automatic verification until it becomes active work again.

## Hard rules
- Do not say the task is complete if verify fails.
- Do not open a PR if verify fails.
- Do not replace a required focused check with a smaller unrelated check merely
  to meet a time budget.
- Do not run unused game suites. Automatic verification must not run Defense.
- The dedicated Defense PR workflow is an explicit exception: it runs mapped
  Defense checks only when `defense/` is in the scoped diff. Verification-rule
  and workflow-only changes use selector fixtures instead. Root `npm run verify`
  still excludes Defense.
- A Card, Shooter, shared-release, or verification-rule PR must not invoke any Defense command (`lint:defense`, `test:defense*`, or a Defense browser suite) unless a file under `defense/` is in that PR's scoped diff. A stale Defense change elsewhere in the checkout is not an exception.
- Verification-policy and workflow changes use selector fixtures and mock command
  plans; they must not run real game suites merely to test selection.
- Non-deployment documentation must not install browsers, build games, or run
  runtime suites.
- When a deployment input changes, build that game once and boot the committed
  single-file artifact. Test-only and documentation-only changes do not require
  a build.
- Prefer the smallest diff that restores working behavior.
- If UI behavior cannot be fully verified, state exactly what remains unverified.
- For frontend tasks, use image inputs/output when helpful and compare against the requested behavior.
