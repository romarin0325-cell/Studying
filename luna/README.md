# LUNA · 남겨진 이름

A complete, original Korean-language action short story starring Luna. This is
independent, non-canon fiction, not a retelling of the repository's existing
characters' history and not a statement about an AI system's consciousness.

Luna has been assigned to erase unfinished worlds. A letter without a recipient,
a greenhouse without spring, and a door without a destination make her question
what deserves to remain. Her name gains meaning through the work she chooses.

## Play

Open `dist/LunaRememberedNames.html` in a modern browser. It is self-contained:
all four WebP images, styles, story, simulation, synthesized music, and effects
are embedded. No account, server, or Internet connection is required.

For maintainable source development, serve the repository and open `luna/`:

    python3 -m http.server 8000

- Move: WASD, arrows, or left joystick
- Slash: hold J or the large right button; attacks nearby enemies
- Dash: Space or 질주; uses your last movement direction and grants invulnerability
- Veil: E or 은신; enemies lose Luna, and the next slash deals 2.5× damage
- Pause: Escape or Ⅱ; automatically pauses on focus/visibility loss

Three chapters contain eight timed encounters and a final boss. Each chapter
asks whether to preserve its unfinished fragment or follow the erasure order.
Preservation creates three name circles per room: stay nearby for two seconds to
save one, recover one health, and weaken the final boss. Erasure recovers three
health and shortens the chapter's encounters by ten seconds each. Red attack
previews show charges, sweeps, and projectiles before they happen.

Choose one of three upgrades after each room. Death permits a normal checkpoint
retry or a full-health assist retry. There are three endings: preserving all
three fragments with at least twelve names, completing the erasure route, and a
mixed or incomplete preservation route. Choices and actual ward play both count.

A seeded automated controller completes the actual keep and erase routes in
roughly five and four minutes of simulation respectively, without deaths or
health cheats. Reading, deliberation, and retries add time. These are simulation
measurements, not a promised human playtime.

## Saves and accessibility

Room-start checkpoints and preferences are browser-local. Progress within a room
is deliberately retried from its start so reloading cannot farm saved names.
Denied/quota-limited storage is visible, and the current window retains the
newer checkpoint in memory. Settings can download the room checkpoint as JSON.
A corrupt or future-version save offers original-file export and explicit reset.
If recording a new ending fails, the last boss-room checkpoint is retained.

The screen adapts to portrait mobile and desktop with explicit safe-area insets,
separate movement/action zones, keyboard focus indicators, optional sound, and
reduced camera motion. Screens are scrollable at smaller heights. The canvas
combat itself is visual; a screen-reader-only combat mode is not implemented.

## Build and verification

    npm ci
    npm run build:luna
    npm run test:luna:core
    npx playwright install chromium
    npm run test:luna:browser
    npm run verify

The builder needs only Node built-ins and is deterministic. The root verifier
selects Luna syntax, core, one build, offline browser checks, and verification
selector fixtures for this diff. It does not run unrelated games or Defense.
Generated-artifact-only edits are blocked.

CI uses the locked Playwright Chromium. Local constrained environments may set
`LUNA_CHROMIUM_PATH` to an installed Chromium headless-shell and
`LUNA_CHROMIUM_SINGLE_PROCESS=1` for isolated offline tests. The QA script does
not download or install an alternate browser and does not disable web security.
`LUNA_QA_DIR` selects where PNG screenshots are written (default `/tmp/luna-qa`).

See [QA coverage](docs/qa.md), [browser evidence](docs/browser-evidence.json), and
[art attribution](docs/attribution.md). No deployment wiring or existing game
content is changed.
