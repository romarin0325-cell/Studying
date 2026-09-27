# Release safety follow-up to PR 522

The review found valid defects: an unguarded `roundRect` call could stop the game loop, missing atlases left enemies/objectives/portraits invisible, and independently rounded minutes/seconds could print `2분 60초`. Desktop steady-state fps did not cover startup pixel processing. PR 522 was already merged when this follow-up began, so this change starts from current main.

## Runtime fixes

- A shared rounded path helper uses native roundRect when available and quadratic curves otherwise. Runtime `Object.hasOwn` and `Array.at` uses are also replaced for early Safari 15 compatibility.
- Ordinary enemies never query boss sprites. Every missing enemy/hero sprite has a body token; core and portal have explicit shapes. Portraits fall back to legacy portraits, then a labelled token.
- Atlas completion repaints independently. AssetManager times out after five seconds, reports `summary.failed`, deduplicates failed requests and ignores late resolutions. GameApp consumes the failure summary and requests old directional images only if needed.
- Menu decodes only the environment atlas. Formation loads two character atlases; battle loads four atlases. Legacy portraits/sprites are deferred until fallback is needed. Failures do not block gameplay.
- Result time rounds the total first, then divides into minutes/seconds.

## Prepared media

The 69 sprite files have edge-connected background removal applied outside the browser, using the previous mask thresholds. WebP quality 90 and alpha quality 100 reduce the embedded HTML from 15.41 MiB to approximately 5.15 MiB. The terrain also uses WebP. Original opaque generation files remain in Git history.

Run `npm run prepare:defense-art` after supplying opaque replacement sprites. Already prepared files are left byte-identical. Release builds verify alpha before embedding; the loader contains no getImageData, pixel arrays, flood-fill or putImageData. This removes that known startup work but does not certify physical-device memory or thermals.

## Regression and CI

`test:defense:resilience` runs Chromium and current Playwright WebKit against source and standalone HTML with roundRect, Object.hasOwn and Array.at removed. It verifies placement and checkpoint resume, live simulation, legacy portrait rendering, token bodies/objectives, rejected media and never-resolving media. Runtime pixel extraction deliberately throws. Current WebKit is not an actual Safari 15 device; the missing-feature tests cover the specified failure path.

The dedicated GitHub workflow runs lint, unit/integration, prepared-asset/offline bundle checks, six-viewport browser checks, complete Story/Trial experience checks and both-engine failure tests. The stable `Defense release gate` job fails if any required job fails/cancels. It reports success for unrelated changes, avoiding permanently pending path-filtered required checks. Root `npm run verify` continues to exclude Defense; AGENTS documents the explicit dedicated-CI exception requested in this review.

Branch protection registration and the actual GitHub run result are recorded in the PR delivery, separately from the workflow file. A workflow file alone is not proof that checks are enforced or passing.
