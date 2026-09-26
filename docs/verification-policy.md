# Minimal PR verification

The default verifier proves the behavior changed by a pull request without
silently expanding to unrelated games or large full-regression suites.

## Scope

CI passes the pull request base SHA and head SHA to the verifier. The verifier:

1. resolves both SHAs as commits;
2. calculates their merge base;
3. reads the null-delimited name-status diff from that merge base to the PR
   head; and
4. classifies both the old and new paths of renames and copies.

Missing refs, a failed Git command, malformed output, or a missing merge base is
BLOCKED_SCOPE. It is never treated as an empty successful diff.

The plan records the PR head and the checkout SHA separately. This matters when
GitHub Actions runs a synthetic merge checkout while selection is based on the
actual PR head.

Local verification uses origin/main when available, falls back to the local
default branch only when necessary, and adds staged, unstaged, and untracked
files from the current worktree. It does not inspect or combine changes from
other worktrees.

## Selection

npm run verify is the required default command. It selects small checks from
the changed paths and prints the failure each check is intended to catch.

- Non-deployment documentation selects no install, build, browser, or game
  command.
- Changed tests run directly.
- Changed JavaScript is parsed.
- Known data, economy, combat, input, and learning modules add the nearest
  contract or regression checks.
- A changed deployment input builds that game once and boots its committed
  single-file artifact.
- A distribution-only edit is BLOCKED_SELECTION; generated output must have a
  mapped input.
- Unknown executable or configuration paths are BLOCKED_SELECTION; zero
  accidentally selected checks is not reported as a pass.
- Shared dependency changes report compatibility for untouched games as
  unverified instead of automatically running every game.

Card and Shooter are the active targets of the root verifier. Defense remains
excluded from root verification by repository policy. The dedicated Defense
workflow calls the same planner with --only defense and is the only automatic
path allowed to run Defense commands.

The default plan never selects a full balance matrix, all-stage completion,
multi-seed soak, every viewport, or another game's suite. Use fixtures that
enter the relevant state and then execute the real decision function or combat
tick.

## Commands

    npm run verify
    npm run verify:plan
    npm run verify:full -- --game card
    npm run verify:full -- --game shooter
    npm run verify:full -- --game defense

verify:plan prints selection without running it. verify:full is manual and
requires an explicit game. Full verification is not used by the ordinary PR or
main workflows.

Every run reports:

- PLAN: selected command and the behavior it covers;
- PASS: a selected command completed successfully;
- SKIP: deliberately unrelated scope, not a passing test;
- UNVERIFIED: a compatibility or physical-device boundary not claimed;
- FAIL: a selected command failed;
- BLOCKED_SCOPE or BLOCKED_SELECTION: required verification could not be
  determined safely.

Only PASS and intentional SKIP may finish successfully.

## Build and browser boundaries

Changing a deployment input selects one build for that game:

- Card: card/dist/DREAMWEAVER.html
- Shooter: shooter/dist/AstralBloom.html
- Defense: defense/dist-local/HeroCoreDefense.html

Test-only and documentation-only changes do not build. Asset cache checks do
not force regeneration when the source and cache contract still match.

Browser installation is conditional. UI/input changes select Chromium and the
closest relevant screen or event path. WebKit is reserved for an explicit
Safari/API risk or an explicit full Defense run. A DOM node's existence alone
does not prove visual layout; visual changes still require a screenshot review
of the changed state.

Browser emulation does not certify physical Android/iOS multi-touch, thermal
behavior, memory pressure, or browser-specific fullscreen performance. Those
boundaries must be reported when relevant.

## Time and transition

The initial targets are three minutes for selected checks and five minutes when
the selected deployment build is included. CI has an eight-minute hard timeout.
These are budgets, not permission to delete required checks. A necessary change
that cannot be checked within the budget should be split into an independently
verifiable pull request.

The new PR minimal gate must be observed successfully on the implementation PR
and landed on main before repository branch protection requires it. Until then,
keep the currently required Defense release gate so existing pull requests do
not become permanently blocked. Because root verification does not run Defense,
the intended final required checks are:

- PR minimal gate
- Defense release gate

Do not remove or rename a required check before its replacement exists on main.
