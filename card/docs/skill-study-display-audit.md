# DREAMWEAVER skill and study display audit

Work baseline: `origin/main` at `1c5e3c8c06304eddbfc634c9572575bc5bccde9d`, fetched on 2026-10-01 (Asia/Tokyo). The reported failures were still present. Active changes are confined to Card and its focused verification scripts.

## Runtime paths and causes

`data.js` creates base, bonus, transcendence, event and seasonal cards, applies `SPECIAL_CARD_OVERRIDES`, clones shared skills, and creates hidden/seasonal enemies. The audit enumerates the final `GameUtils.getAllCards()`, `getBattleOnlyForms()` and `ENEMIES` results, without merging entries by skill name. `buildBattleEnemy`, `getCurrentStageEnemyData`, `buildBattlePlayer`, `cloneSkillsWithCostModifiers`, `decideEnemyAction` and resolved delayed skills were also checked.

`showCardInfo` and both branches of `showBattleStat` previously combined a free-form description with a trailing `(x val)`. That repeated base type/power, mixed base and conditional multipliers, placed power after side effects, and rendered absent enemy costs as `MP undefined`. The boss Pharaoh's two actual skill types were `mag` before and after; a type defect was not reproduced. Its curse uses the dedicated five-turn AI policy, and enemy execution replaces the base multiplier with 3 when `tookDamageThisTurn` is true.

`SkillDisplay` now generates headings, body text, accessible names and HTML from structured fields. Each effect and damage condition has an explicit template, and unknown effects/conditions fail the focused test. It does not parse old descriptions, mutate inputs or call RNG. The 482 static skill descriptions (including the shared seasonal Magic Guard definition) and the separate normal-attack description were removed to avoid maintaining numeric prose as another source of truth. Trait/artifact terminology was normalized while retaining IDs and numeric fields. `guard` and `damage_half` retain their distinct status identities, durations and Guardian rules.

The normal attack and all Card details share the same formatter. Player battle details and accessible names use the current skill object's cost; enemy details omit cost/tier. Battle controls retain four compact name/MP buttons, their physical/magic/support frames and one-action guard. Stat details use the full Korean stat names. Field details use the same terms, including Arena's existing normal-attack multiplier.

## Skill inventory

| Category | Entities | Skills |
| --- | ---: | ---: |
| Final collectible cards, including seasonal overrides | 161 | 483 |
| Battle-only forms | 3 | 9 |
| Base/hidden/seasonal bosses | 15 | 38 |
| Shared normal attack | 1 | 1 |
| Total audit rows | 180 | 531 |

Every display row changed to the common structure: 531 changed, 0 retained, 0 unhandled. There are 70 effect/condition template keys. The attached `skill-display-audit.csv` contains entity ID, position-qualified skill identifier, before/after display, template and exception reason for every row.

33 rows use documented explicit exceptions, rather than a generic fallback: dedicated enemy AI schedules/runtime multiplier replacement, or hardcoded operations such as Dream Form fusion, Nightmare, roulette pools, conditional debuff consumption and field replacement. These are handled rows, not unresolved cases. Dream Form describes all twelve field contributions, including additive power, defense penetration, guaranteed critical hit, HP/MP recovery and stun. Their values are hardcoded in the existing engine; its display template mirrors those switches. Structured `val`, effect bounds, stack additions and costs are read directly rather than copied into new numeric fields.

| Example | Before | After |
| --- | --- | --- |
| Deep Kiss | `마법 2.5배율 (x2.5)` | `딥키스 · 마법 · MP 30 · 3티어` / `위력 2.5배.` |
| Dragon Claw | `2배 물리 피해 (자신의 생명력이 100%일시 위력 2배) (x2)` | `위력 2배. 자신의 HP가 100%이면 위력 4배.` |
| Milky Way Ecstasy | `필드버프 스타파우더 발동 (x3)` | `위력 3배. 필드 버프 ‘스타파우더’ 부여.` |
| Pharaoh's curse | `MP undefined: 5턴 주기 공격 (x1)` | `고대의저주 · 마법` / `위력 1배. 5턴마다 발동. 해당 턴에 자신이 피해를 받았으면 위력 3배.` |
| Enemy Gray's Soul Slash | `2~4배율 랜덤 마법공격 (x2)` | `위력 2~4배.` with its four-turn selection rule |
| Ignis Smash | `작열스택을 전부 소모하고 소모당 2.0배율 추가 (x2)` | `위력 2배. 적의 작열을 모두 소모. 소모한 1스택당 배율 +2.` |

The baseline fingerprint covers final cards/forms/enemies, artifacts, constants, storage keys and every non-description field, including skill type/cost/val/tier/rate, ordered effects, status IDs and durations. It is unchanged. Learning data are independently compared in full, permitting only the three canonical spelling replacements. No combat calculations, AI probabilities/order, RNG, turns, rewards, answers, shuffle or save format were changed.

## Learning spelling audit

Scope: the six bundled learning files (`toeic.js`, `toeic_explanations.js`, `vocab_data.js`, `grammar_data.js`, `collocation_data.js`, `listening_data.js`), with 762 vocabulary entries, 35 grammar lessons / 350 quizzes, 130 collocations / 520 quizzes, 78 TOEIC sets / 289 questions, explanations and listening data.

| File | resume before | résumé before | resume after | résumé after | café before/after |
| --- | ---: | ---: | ---: | ---: | ---: |
| toeic.js | 4 | 2 | 6 | 0 | 0 / 0 |
| toeic_explanations.js | 0 | 1 | 1 | 0 | 0 / 0 |
| vocab_data.js | 1 | 0 | 1 | 0 | 0 / 0 |
| grammar_data.js | 0 | 0 | 0 | 0 | 1 / 1 |
| collocation_data.js | 1 | 0 | 1 | 0 | 0 / 0 |
| listening_data.js | 0 | 0 | 0 | 0 | 0 / 0 |
| Total | 6 | 3 | 9 | 0 | 1 / 1 |

Counts are occurrences in active learning source, case-insensitive. The three edits are Part 5 `68-3`, Part 6 set 57's “Additional Materials for Your Application” passage, and set 68's explanation. The project canonical spelling is **resume**, to match its TOEIC study policy and existing vocabulary. General English also permits résumé; other accents are preserved.

Part 5 options remain `itinerary / contract / resume / inventory` in source order; the correct answer remains `itinerary`, the ID remains `68-3`, and the sentence retains `tomorrow’s`. Part 6 changes only `review of your résumé` to `review of your resume`; questions `57-1` to `57-4` retain `so / if / documentation / [2]`. The existing vocabulary entry still has `(동) 재개하다; (명) 이력서`, without introducing a duplicate sense or changing the word-keyed wrong-answer/tutoring storage. The actual grammar lesson 35 café question and all other learning data are unchanged.

## Fonts and browser evidence

The existing offline body stack, `Inter, "Segoe UI", "Malgun Gothic", sans-serif`, is reused via `--study-font` and `.study-text`. Questions/options, passages, explanations/reviews/results, vocabulary/collocation books, lectures and tutoring content use it. Theme menu/title chrome retains its existing decorative font. Question/option weight is 500, with existing readable sizes preserved. Content can wrap without shrinking text or truncating effects. No new font, CDN or network dependency was introduced.

Before the patch, Chromium's actual rendered font for the strawberry TOEIC option was **Jua** (`Jua-Regular`, custom font); the question used **Segoe UI Semibold**. After the patch, both used **Segoe UI Semibold**. The actual café sentence, including é, used one Segoe UI Semibold face. These are CDP `CSS.getPlatformFontsForNode` measurements, alongside computed CSS and screenshots, not an inference from the font-family declaration. Astra and dreamsky were also checked; the platform fallback on another OS can differ while retaining the same body stack.

The focused browser scenario records 15 study paths for each of strawberry/astra/dreamsky at 320×568, 390×844, 430×932 and 844×390: Part 5; Part 6/7 passages and questions; review and explanation; ordinary/reverse vocabulary; collocation; café grammar; vocabulary book and wrong-word review; tutoring review quiz; grammar lecture. It also checks long skill descriptions, Dream Form's scrollable full effects, MP-short buttons, player/current-cost details and Pharaoh. Before/after screenshots and font/geometry measurements are saved under ignored `card/test-results/skill-study/`.

The final actual card renderer processes every collectible card and form. All 15 boss objects are built through the real builder and shown through `showBattleStat` in five modes (75 renders), with hidden and seasonal selection branches additionally exercised. Generated charge actions retain their actual `phy`/`sup` type and display no attack power of zero. Resolved delayed skill objects are covered by the pure contract test. Actual option clicks preserve the `68-3` correct/wrong record and vocabulary `resume` wrong-word storage. Repeated clicks commit one combat action.

## Verification and deployment

- `npm run verify:plan`: Card-only mapped checks; includes the new `scripts/verify_card_display.js` contract and `card/tests/skill-study-display.mjs` browser scenario.
- `npm run verify`: required basic-set contract, Card build, file:// bundle smoke, combat/display/learning contracts, changed JavaScript syntax and focused browser scenario.
- `git diff --check`: clean.
- Final HTML is generated by `card/build.mjs`, not edited by hand. `card/dist/DREAMWEAVER.html` boots with HTTP(S) requests blocked and offline file:// conditions.
- Distribution string checks: `résumé` 0, `café` 1, `MP undefined` 0, `[object Object]` 0. Runtime user strings have no `NaN`; raw JavaScript contains existing `isNaN`/numeric validation tokens, so a blanket removal would damage code. Raw `resume` matches also include existing JavaScript audio resume methods; source content counts are reported separately above.

Limits: this is Chromium/browser viewport evidence on Windows plus PR CI on its configured host. It does not certify physical Android/iOS touch, Safari/Firefox, or real external tutoring API answers. The offline tutoring review builder and common content component are covered; no external tutoring request was sent. No separate combat logic defect was changed.
