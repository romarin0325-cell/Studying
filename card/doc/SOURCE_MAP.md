# Card 소스 구조와 수정 위치

[문서 시작점](README.md) · [상세 구조 지도](../card_game_structure.md) · [코딩 계약](../CODING_GUIDE.md)

기준: `7635238`. 활성 규칙은 `card/game/`, DREAMWEAVER 화면은 `card/src/`다. `card_legacy/`와 `dist/`를 수정 원본으로 쓰지 않는다.

## 실행 경로

`game/data.js`와 학습 데이터 → `Logic`/`GameUtils`/`SkillDisplay` → `BattleRuntime` 및 `RPG` 기능 → `src/astra.js` 화면 훅 → `src/shell.html`/CSS.

개발 원본 `game/index.html`은 스크립트 로딩, `RPG` 조립, 기존 DOM ID와 `TurnManager`를 가진다. `build.mjs`는 이 계약과 `src/` 화면을 조립해 `dist/DREAMWEAVER.html` 한 파일을 만든다. 단순 번들러의 임의 순서로 전역을 재배치하면 기존 계약이 깨진다.

## 무엇을 바꿀 때 어디를 읽는가

아래 링크는 `card/doc/` 기준이다. 함께 볼 검사는 관련 계약을 찾기 위한 지도이며 모든 검사를 수동 실행하라는 목록이 아니다.

| 수정 내용 | 첫 파일과 심볼 | 함께 확인할 곳 |
| --- | --- | --- |
| 카드·적의 수치/특성/스킬 | [data.js](../game/data.js): `CARDS`, `BONUS_CARDS`, `SPECIAL_CARDS`, `TRANSCENDENCE_CARDS`, `BONUS_TRANSCENDENCE_CARDS`, `ENEMIES` | [능력표](CHARACTERS.md), `Logic`, `SkillDisplay` |
| 전투 전 슬롯·덱 시너지 | [logic.js](../game/logic.js): `calculateInitialStats`, `GameUtils` | 데이터 특성, [전투 회귀](../../scripts/verify_card_combat_regressions.js) |
| 전투 중 스탯·대미지 | [logic.js](../game/logic.js): `calculateStats`, `calculateDamage`, `DAMAGE_EFFECT_HANDLERS` | [battle_runtime.js](../game/battle_runtime.js), [밸런스](BALANCE.md) |
| 새 버프·디버프·부가효과 | [logic.js](../game/logic.js): `StatusRules`, `SideEffects.handlers` | `data.js`의 `BUFF_NAMES`, `skill_display.js`의 해설 처리 |
| 턴 순서·MP 지불·사망·변신 | [battle_runtime.js](../game/battle_runtime.js): `BattleRuntime` | `game/index.html`의 `TurnManager`와 호환 래퍼 |
| 보유/해금/출현 카드풀 | [logic.js](../game/logic.js): `GameUtils.getAllCards`, `getCardById`, 풀 생성 | 모드별 활성/해금, `card_pool_rules.js` |
| 기본 세트·revision·프리셋 | [data.js](../game/data.js): `BASIC_CARD_SETS`, [card_pool_rules.js](../game/card_pool_rules.js) | [기본 세트 검사](../tests/basic-sets.mjs), 저장 프리셋 마이그레이션 |
| 카드풀 편집 화면 | [card_pool_view.js](../game/card_pool_view.js), [card_pool_editor.css](../game/card_pool_editor.css) | 데이터 규칙은 `card_pool_rules.js`에 유지 |
| 모드·시작·보상·미션·글로벌 상태 | [rpg_features.js](../game/rpg_features.js): `startGame`, 기능 모듈과 진행 분기 | `game/index.html`의 `RPG`, [구현 매뉴얼](../GAME_MANUAL.md) |
| 저장 스키마·마이그레이션 | [logic.js](../game/logic.js): `Storage`, `SaveDataMigrator`, `ModeRecords` | `rpg_features.js`, [리팩터 계약](../../scripts/verify_card_refactor.js) |
| 스킬 설명·접근성 레이블 | [skill_display.js](../game/skill_display.js): `SkillDisplay.text/body/heading` | 데이터의 `type/cost/tier/val/effects`, [표시 검사](../tests/skill-study-display.mjs) |
| 로비·편성·도감·백업·초상화 | [astra.js](../src/astra.js) | [shell.html](../src/shell.html), 기존 `RPG` 메서드/DOM ID |
| 전투 헤더·카드·모바일 배치 | [astra.css](../src/astra.css), [mobile.css](../src/mobile.css), [polish.css](../src/polish.css), `shell.html` | [헤더 검사](../tests/battle-header.mjs), 실제 요소 높이와 넘침 |
| 테마별 색·배경·프레임 | [themes.css](../src/themes.css), [assets](../assets/) | 배치/카드 크기는 공통, 실제 초상화 보존 |
| 단어·연어·문법 | [vocab_data.js](../game/vocab_data.js), [collocation_data.js](../game/collocation_data.js), [grammar_data.js](../game/grammar_data.js) | `index.html` 학습 흐름, Shooter 스냅샷의 동기화 |
| TOEIC·해설·리스닝 | [toeic.js](../game/toeic.js), [toeic_explanations.js](../game/toeic_explanations.js), [listening_data.js](../game/listening_data.js) | Part 5/6/7 세트·정답 유일성·오답/꿈의회랑 상태 |
| 루미/Gemini | [api.js](../game/api.js) | `index.html` 질문·과외·데이트, API 키 저장/백업 제외 |
| 음악·포춘쿠키 | [music_player.js](../game/music_player.js), [music_data.js](../game/music_data.js), [fortune_cookie.js](../game/fortune_cookie.js) | 전용 저장 키·로컬 파일 이름 |
| 배포 조립 | [build.mjs](../build.mjs) | 스크립트 의존/마크업 계약, `dist/DREAMWEAVER.html` |

## 데이터 정의와 실행 처리의 차이

카드에 새 `effect.type`을 적는 것만으로 능력이 실행되지는 않는다. 대미지 효과는 `DAMAGE_EFFECT_HANDLERS`, 상태 효과는 `SideEffects`, 턴·사망·변신은 `BattleRuntime` 경로를 확인한다. 표시도 `SkillDisplay`가 같은 필드를 지원해야 한다. `RPG.executeSkill/calcDamage/applySkillEffects` 등 기존 호출은 호환 어댑터이므로 새 계산식을 화면 어댑터에 작성하지 않는다.

`data.js`의 배열은 뒤에서 확장/복제/override를 적용한다. 첫 정의만 읽지 말고 최종 `GameUtils.getAllCards()` 목록과 `BATTLE_ONLY_FORMS`를 구분한다. 보너스·이벤트·초월 정의가 있어도 계정 해금·모드·카드풀 활성 조건 없이 항상 뽑히는 것은 아니다.

## 저장·화면 계약

`cardRpgSave`, `cardRpgGlobal`, 학습 전용 키, `cardRpgRecords`/`cardRpgModeRecords`, 음악 설정 등을 유지한다. 런은 `SaveDataMigrator.normalizeRunState/serializeRunState`를 거친다. 알 수 없는 저장 필드를 일괄 삭제하거나 더 높은 스키마를 추정 변환하지 않는다. 기본 세트 revision 변경 시 모든 세트·프리셋의 유효한 기존 선택을 보존한다.

`astra.js`의 `astra-progress` 백업 v1은 API 키를 포함하지 않는다. 로컬 초상화 경로 `astraPortraitPath`와 테마 내부 키 `strawberry`도 호환 계약이다. 기존 DOM ID, 화면 훅, 초상화 실패 fallback을 함께 유지한다.

## 수정 후 검증 범위

저장소 루트에서 `npm run verify:plan`으로 변경 파일에 맞는 선택을 확인한 뒤 필수 `npm run verify`를 실행한다. 문서만 바뀌면 런타임 명령을 선택하지 않는 것이 정상이다. 출시 입력 변경 시 선택된 빌드 한 번과 실제 커밋할 HTML 부팅 검사를 수행한다. 생성 HTML을 직접 수정하거나 작은 관련 없는 검사로 필수 검사를 대체하지 않는다. 전체 게임 검증은 사용자 요청이 있을 때만 실행한다.
