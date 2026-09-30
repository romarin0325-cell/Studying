# QA and known boundaries

## Deterministic simulation

Fifteen Node tests cover nine-room/three-chapter content, no canon-linked
backstory, movement normalization and limits, ward charging/decay/one-time
recovery, erasure timing and health, repeat-choice rejection, attack cooldown,
ambush damage, dash invulnerability, enemy telegraphs, terminal-state protection,
all upgrades, checkpoint restoration and anti-farming, corrupt/future save
rejection, preserved-name boss health, and three complete no-cheat routes.
Repeated seeded full routes are deterministic. Winning cannot be replaced by a
late projectile damage event.

## Browser checks

`tests/browser.mjs` boots the built single HTML through `file://` while offline.
It checks actual keyboard movement, held attacks, dash, veil, pause/resume,
released pointer movement, visibility/input reset, saved settings, reload and
continue, checkpoint download, ward feedback, repeated upgrade clicks, death
retry, and fixture-driven boss victory for all three ending screens.

Failure cases include a denied storage getter, quota failure during a room
transition, future/corrupt JSON with original export/reset, and a failed new
ending-record write. New in-memory progress stays resumable during the current
session, and ending failure leaves the last room's durable save intact.

Viewport checks cover 360×640, 390×844, and 1280×720. A Chromium CDP safe-area
fixture overrides the notch to 44px and bottom home area to 34px at 360×640.
It verifies stage/button containment, pairwise action-button separation, and
combat sprite clearance above the controls. See `browser-evidence.json` for the
actual browser version and completed checks. Screenshot files are generated
outside the repository rather than silently committed as source.

## Boundaries

- Desktop Chromium automation and safe-area fixtures are not physical-device
  tests. Safari/WebKit, iOS audio activation, browser-specific `file://` storage,
  hardware multitouch, and device haptics have not been verified
- Browser ending tests use valid checkpoint fixtures and a test-only damage
  override to exercise the UI quickly; the simulation tests complete all nine
  rooms with normal attacks, movement, and health
- The `?qa=1` flag exposes the local test bridge only when explicitly selected;
  normal play has no test bridge
- Offline storage is tied to this browser and file/origin. The game is not a
  cross-device account-backed save service
- A JSON checkpoint export is available for retention and troubleshooting;
  a player-facing import UI is not part of this version
