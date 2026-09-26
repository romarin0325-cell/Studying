# Six realms revision — implementation and validation

## Delivered behavior

The battle uses a fixed square 12×12 plane in both orientations. A responsive
command deck uses the remaining space for five skill-charge cards, selected-hero
information, actual aura connections and touch controls. Permanent boss/enemy
information sits outside the combat plane. Fifteen placement markers remain
identical and neutral; no position advice or recommended-hero labels are shown.

Attack windup, release, flight and impact run inside the fixed-tick simulation.
HP, hit reactions, sounds and damage numbers resolve on the impact tick. Beams,
fans, melee and novas release and hit together. Basic attack intervals and damage
increase together to preserve nominal DPS; longer skill cooldowns provide larger,
more legible casts. Presentation afterglows remain readable at either game speed.
The element table applies +20% advantage and -20% resistance.

The six ten-wave realms are 마도제국 / 인조마신, 빛의 신전 / 사랑의 여신 아이리스,
어둠의 신전 / 저주의 여신 아이리스, 요정의 숲 / 꽃의 여신 플로라,
해저 신전 / 해신 포세이돈 and 혼돈의 틈 / 마신 벨제뷔트. Each guardian has
an interruptible warning and a distinct completed ability. Four old stage IDs
remain stable; the forest and underwater routes are new.

Queen (female nature main), Galaxy Whale (male light dealer), Silver Rabbit
(male light dealer), Ancient Dragon (female nature debuffer with flame attacks)
and Time Ruler (female dark debuffer) expand the roster to 5 mains and 16
companions. All 84 final trait builds execute real basic and skill impacts.
Innate Flame Sage/Siren auras and trait auras expose actual providers, recipients
and effects through the same engine relationships used in combat.

Portrait canvases respect their displayed aspect ratio and DPR up to 3. Snow
Rabbit's original teal bunny costume is restored, with compact ears/head scale;
Cinderella and Lightning Sage were redrawn against the common cast reference.
The full 21-character idle/attack cast was reviewed at 64px and 96px on dark and
pale backgrounds, and all six bosses at 128px. Core/portal identity is preserved.
Silver Rabbit had no supplied/found original: his original male design follows
CARD's rabbit/light role and the approved common style. Exact authoring prompts
and the ongoing visual acceptance rules are recorded separately.

Music bus gain is .70 instead of .45, with unchanged SFX gain. No earlier Gemini
credential was reused. Canvas, fixed-tick simulation and offline single HTML
remain the technology stack; no external runtime service is required.

## Reproducible validation

| Check | Local evidence |
| --- | --- |
| Root `npm run verify` | Passed; unrelated Card/Shooter suites remain excluded for this scoped Defense change |
| Defense lint | 60 runtime modules and 142 release assets validated |
| Full unit/integration/balance suite | 150 passed after six-realm encounter tuning; later clock-presentation and hit-mask cache regressions also passed in the final 137-test focused run |
| Full formation simulations | 690 complete battles: 115 pairwise formations per realm; all 9,100 valid formations checked structurally |
| Browser input/performance | Seven viewports from 320×568 to 1366×768; rotation, pointer input, square geometry and original performance gates passed |
| Offline experience | Six real boss warnings and aimed interrupts, DPR-3 portrait/landscape, roster swaps, fullscreen, audio/mute, Easy/Normal ten-wave growth/traits/resume/victory |
| Old API and image resilience | Chromium and WebKit: absent roundRect/hasOwn/at, primary-atlas failures, all-image failures, hanging images, placed checkpoint reload and local HTML |
| Prepared-asset reuse | 140 alpha records reused with zero Sharp inspections on unchanged builds; CI also forces uncached validation |
| Local release | 142 embedded assets; HTML 9.94 MiB; no network requests required |

The complete updated test suite and every release check run again in the
Defense workflow. Its aggregate Defense release gate fails if any required
Defense step fails. Generated HTML and the committed asset manifest must match
the checkout after a clean build.

The seven-viewport desktop Chromium run measured update p95 .2–.5 ms and render
p95 1.5–3.9 ms, with 56.3–58.7 measured fps. A repeated per-hit canvas brightness
filter was replaced with a cached alpha silhouette; this retains the hit flash
without rebuilding a filtered full image on every hit frame.

## Encounter balance evidence

Automated Easy policy: auto-place once, spread growth by lowest level (slot tie
break), choose the first Lv4 trait, and never aim Starfall. This is a repeatable
baseline, not a human playtest or a promise that every formation wins.

| Realm ID | Clears / 115 | Clear rate | Median estimated wall minutes | Median core HP |
| --- | --- | --- | --- | --- |
| ancient_ruins | 112 | 97.4% | 3.84 | 10 |
| crossroads | 103 | 89.6% | 4.90 | 10 |
| long_boulevard | 114 | 99.1% | 3.75 | 10 |
| fairy_forest | 115 | 100% | 3.50 | 10 |
| sunken_temple | 110 | 95.7% | 4.06 | 10 |
| chaos_rift | 112 | 97.4% | 4.27 | 6 |

Estimated wall time is simulation time at 2× plus 69 seconds of assumed input
allowance, not measured human completion time. Original clear-rate thresholds
were retained. Peak simulated counts were 26 enemies and 5 projectiles, within
the 45/160 caps. Balance checks do not establish long-term replay value.

## Review boundaries and supporting documents

Physical iOS/Android startup latency, memory pressure, thermals, native Safari 15
and platform-specific fullscreen behavior remain unverified. Desktop WebKit
plus explicitly removed APIs exercises compatibility paths, but does not replace
those devices. Automated checks and visual review do not certify commercial
launch readiness or subjective enjoyment.

- [Combat and encounter decisions](SIX_REALMS_COMBAT.md)
- [Art direction](../ART_DIRECTION.md)
- [Exact art prompts](SIX_REALMS_ART_PROMPTS.md)
- [Prepared asset cache](PREPARED_ASSET_CACHE.md)
- [Primary-source reference notes](DEFENSE_REFERENCE_NOTES.md)
