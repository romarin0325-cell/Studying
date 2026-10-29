# AGENTS.md

## Priority
Functional correctness of the browser app is more important than refactoring or style polish.

## Verification policy
검증은 이번 작업에서 바뀐 동작과 직접 관계있는 범위만 수행한다.
- 일반 문서는 제품 검증이 필요 없다.
- 배포 입력을 수정하면 해당 게임을 한 번 빌드한다.
- 동작 확인이 필요하면 가장 가까운 기존 테스트나 짧은 재현을 사용한다.
- 변경하지 않은 게임, 전체 회귀, 여러 브라우저, 장시간 시뮬레이션, 보고서 재생성은 기본 실행하지 않는다.
- 같은 입력에 대한 검증을 반복하지 않는다.
- 실행한 검사와 확인하지 못한 핵심 사항만 간단히 알린다.

## Targets
- `card/`: Card game (`card/dist/DREAMWEAVER.html`)
- `card_astra/`: Refined Astra UI; shares `card/game`, `card/src/astra.js` and base styles (`card_astra/dist/DREAMWEAVER-Astra.html`). Build with `npm run build:card-astra`; focused browser check: `npm run test:card-astra`.
- `card_lumen/`: Lumen UI (bright Postcard language shared with Star Garden Bright, chain challenge summons); shares `card/game` and `card/src/astra.js` but not the `card/src` base styles (`card_lumen/dist/DREAMWEAVER-Lumen.html`). Build with `npm run build:card-lumen`; focused browser check: `npm run test:card-lumen`.
- `card_claude/`: Claude UI comparison build of the card game; reads `card/game` and `card/assets` (`card_claude/dist/DREAMWEAVER-Claude.html`)
- `shooter/`: Astral Bloom shooter (`shooter/dist/AstralBloom.html`)
- `defense/`: Star Garden defense (`defense/dist/StarGardenDefense.html`, Bright skin `defense/dist/StarGardenDefenseBright.html`). Build both with `npm run build:defense`; rules for this game are in `defense/AGENTS.md`.
- `survivor/`: Astra Nocturne survivor game (`survivor/dist/AstraNocturne.html`)
- `rpg/`: Turn RPG: Legend Edition, one self-contained page (`rpg/new.html`: UI, rules, data, SVG fallbacks and WebAudio music; character/enemy art is the card game's 3:5 PNGs placed beside it); no build or tests.

The former `card_legacy/`, `defense_legacy/`, `idle/`, `english_vocab_version/` and the old Hero Core Defense were removed; recover them from Git history if ever needed. `defense/` was promoted from `defense_test/` (Star Garden) and is the only Defense.

## Core guidelines
- Prefer the smallest diff that restores working behavior (bug fixes). Design, UI and effect work in `defense/` follows `defense/AGENTS.md` instead (read it first when working there).
- If UI behavior cannot be fully verified, state exactly what remains unverified.
- For frontend tasks, use image inputs/output when helpful and compare against the requested behavior.
