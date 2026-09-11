# Card RPG 시스템 구현 매뉴얼 (DREAMWEAVER 동기화판)

이 문서는 활성 소스 `card/`의 **현재 동작**과 맞춘 구현 명세입니다.  
규칙·데이터·저장의 소스 오브 트루스는 `card/game/`이고, 세로 모바일 화면과 단일 HTML 배포는 `card/src/`와 `card/build.mjs`입니다.

카드·적·스킬의 수치와 문구는 `card/game/data.js`가 정본입니다. 스킬 표를 이 문서에 복제하지 않습니다.

관련 문서:

- 실행·배포: [README.md](./README.md)
- 화면 설계: [DESIGN.md](./DESIGN.md)
- 모듈 구조: [card_game_structure.md](./card_game_structure.md)
- 수정 위치: [CODING_GUIDE.md](./CODING_GUIDE.md)

`card_legacy/`는 승격 시점 스냅샷이며 활성 소스가 아닙니다.

---

## 0. 코드 동기화 정오표 (필독)

레거시 `card_legacy/GAME_MANUAL.md` 대비 현재 코드에서 바로잡아야 하는 점입니다.

- 경로: 예전 `card/index.html`, `card/logic.js` 등은 이제 `card/game/` 아래에 있습니다.
- 배포물: 플레이어가 여는 파일은 `card/dist/DREAMWEAVER.html` 한 장입니다. `card/game/index.html`은 빌드 계약·레거시 DOM ID의 소스입니다.
- **MP 자동 회복은 없습니다.** 턴 시작/피격/행동 +MP 상수도 `GAME_CONSTANTS`에 없습니다. 있는 것은 `MAX_MP: 100`입니다.
- **달의축복(`moon_bless`) 자체에는 관통이 없습니다.** 기본 효과는 `MATK +30%`, 회피율 `+15`입니다. 관통은 스킬/특성/아티팩트, 그리고 초월 루미 `꿈의형태`처럼 버프를 소모하는 개별 처리에서만 발생합니다.
- 대미지 방어 상수는 `100`입니다. `finalDmg = floor(val * finalMult * (100 / (100 + def)))`.
- 아이스브레이크(`ice_break`)는 스턴 대상 **2배**입니다. 레거시 매뉴얼의 3배는 틀립니다. 신기 포세이돈이 있으면 2.5배로 대체합니다.
- 필드버프 정의에는 `valentine`, `arena`, `destiny_oath`가 포함됩니다. 레거시 매뉴얼 목록은 불완전합니다.
- 기본 아티팩트는 26종이고, 보스 처치 저확률 해금 **신기/마신기 10종**이 일부 기본 아티팩트를 대체합니다.
- 실전마법연습 루미 질문은 Part 5/6/7 모두에서 열립니다. Part 6/7만 해당한다는 서술은 구버전입니다.
- Gemini Flash 모델 ID는 `gemini-3.8-flash`, Lite는 `gemini-3.5-flash-lite`, Pro는 `gemini-2.5-pro`입니다.
- 문법/TOEIC 보기는 정답이 한 개만 남도록 유일성을 강제합니다.
- `overdrive`는 상수·보상 분기에 남아 있지만 모드 선택 UI에는 없습니다. 선택 가능한 모드는 아래 6장을 따릅니다.

---

## 1. 제품 구조

| 층 | 위치 | 역할 |
|---|---|---|
| 규칙·데이터 | `card/game/` | 카드/적, 전투 공식, 저장, 미션, 학습 데이터, 기존 DOM 계약 |
| 화면 어댑터 | `card/src/` | DREAMWEAVER 로비/편성/도감/학습/전투 셸, 초상화 폴더, 기록 내보내기 |
| 조립 | `card/build.mjs` | `game/` 스크립트와 `src/` 셸을 `dist/DREAMWEAVER.html`로 인라인 |
| 검증 | `card/tests/` + 루트 `scripts/verify_card_*.js` | 단일 HTML·레거시 계약·전투 회귀 |

`Astra`는 기존 `RPG` 메소드를 훅합니다. 전투 공식·카드 수치·저장 스키마를 `astra.js`에 두지 않습니다.

---

## 2. 스탯과 전투 인스턴스

### 2-1. 스탯

- **HP**: 0 이하이면 사망.
- **MP**: 스킬 비용. 최대 100. 자동 회복 없음.
- **ATK / MATK**: 물리/마법 스킬 기반 대미지.
- **DEF / MDEF**: 물리/마법 방어.
- **Crit**: 기본 10. 발동 시 치명 배율 적용.
- **Evasion**: `baseEva + 5`에서 시작. 발동 시 해당 공격 무효.

### 2-2. 카드 원본

`data.js`의 `CARDS`, `BONUS_CARDS`, `TRANSCENDENCE_CARDS`, `SPECIAL_CARDS` 등.

스키마:

- `id, name, grade, element, role`
- `stats: { hp, atk, matk, def, mdef }`
- `trait: { type, val?, ... }`
- `skills: [{ name, type(phy/mag/sup), tier, cost, val?, desc, effects[] }]`

### 2-3. 전투 복사본

대략 `hp, maxHp, mp, atk, matk, def, mdef, baseCrit(기본 10), baseEva(기본 0), buffs, isDead, proto`.

---

## 3. 스탯 계산 (`Logic.calculateStats`)

1. `crit = baseCrit(없으면 10)`, `evasion = baseEva + 5`.
2. 혼돈 축복 카드: crit +10, evasion +5. 전투 시작 전 스탯 배수는 이미 반영된 상태일 수 있습니다.
3. 조건형 특성(합연산).
4. 배율 묶음 `m = { atk:1, matk:1, def:1, mdef:1 }`.
5. 필드버프는 플레이어에게만 스탯 반영. `flood`면 필드버프 수치 2배. `nature_blessing`/`divine_flora`는 `earth_bless`, `milkshake`/`divine_thor`는 `star_powder`를 강화.
6. 개인 버프/디버프. `curse` 모드면 디버프 계수 2배.
7. 아티팩트 보정 (`assassin_nail`, `shadow_ball`, `veil_of_darkness`, `rabbit_hole`, `shadow_stab`, 신기 그레이 등).
8. `finalStat = floor(base * max(0, m))`.

합연산·곱연산 단계 차이는 [CODING_GUIDE.md](./CODING_GUIDE.md)를 따릅니다.

---

## 4. 필드버프

동시 상한 **3**, 아티팩트 `buff_overload`면 **5**. 초과 시 가장 오래된 버프를 제거합니다(FIFO). 효과는 합산됩니다.

`GAME_CONSTANTS.FIELD_BUFF_STATS` 기준:

| ID | 표시 | 스탯 효과 | 부가 |
|---|---|---|---|
| `sun_bless` | 태양의축복 | ATK/MATK +30% | 치명 배율 +0.6 |
| `moon_bless` | 달의축복 | MATK +30%, 회피 +15 | 버프 자체 관통 없음 |
| `sanctuary` | 성역 | MATK/MDEF +30% | |
| `goddess_descent` | 여신강림 | ATK/MATK/DEF/MDEF +30% | |
| `destiny_oath` | 운명의서약 | ATK/MATK/DEF/MDEF +30% | `꿈의형태` 소모 시 +10.0배 |
| `earth_bless` | 대지의축복 | ATK/MATK +25% | |
| `twinkle_party` | 트윙클파티 | ATK +20%, 치명 +15 | |
| `star_powder` | 스타파우더 | DEF/MDEF +40% | |
| `valentine` | 발렌타인 | DEF/MDEF +50% | `꿈의형태` 소모 시 +5.0배 |
| `arena` | 아레나 | 스탯 가산 없음 | 일반공격 2배. `flood` 배율 제외. `꿈의형태` 소모 시 +4.0배 |
| `reaper_realm` | 사신강림 | 치명 +40 | 치명 배율 +0.4. `꿈의형태` 소모 시 마방 50% 관통 |
| `gale` | 질풍 | 치명 +20, 회피 +20 | |

`flood` 모드는 필드버프 스탯뿐 아니라 태양/사신 치명 배율 가산도 2배입니다. 카드의 `fieldBuffStatMult`(예: 빅토리아 대장)가 있으면 그 배율도 곱합니다.

초월 루미 `꿈의형태`는 현재 필드버프를 제거하고 버프별로 배율/치명/관통을 적립합니다. **달의축복 관통은 필드버프가 아니라 이 융합 분기에서만** 붙습니다.

| 소모 버프 | 꿈의형태 적립 |
|---|---|
| `sun_bless` | +2.0배, 확정 치명 |
| `moon_bless` | 마방 30% 관통, +1.0배 |
| `star_powder` | +1.0배 |
| `earth_bless` | +2.0배 |
| `sanctuary` | +2.0배 |
| `goddess_descent` | +4.0배 |
| `valentine` | +5.0배 |
| `destiny_oath` | +10.0배 |
| `arena` | +4.0배 |
| `reaper_realm` | 마방 50% 관통, +1.0배 |

---

## 5. 개인 버프·디버프

- **암흑 / 부식**: 각각 DEF -20%. 동시이면 -40%.
- **약화**: ATK -20%.
- **침묵**: MATK -20%.
- **저주 / 유혹**: MDEF -20%. 서로 중첩. 계산식에서도 둘 다 `mdef`를 깎습니다.
- **작열 / 디바인**: 기본 최대 3스택, 아티팩트 시 5스택. 스킬이 스택을 소모해 배율을 만듭니다.
- **기절**: 부여된 턴 행동 불가.
- **가드**: 받는 대미지 50% 감소. 이름이 정확히 `가드`인 스킬만 Guardian 특성으로 75% 감소.
- **매직가드**: 마법 피해 무효.
- **배리어**: 물리 피해 무효.
- **회피태세**: 회피율 +50.

일반공격 특성 디버프는 피해 전, 스킬 데이터의 일반 `debuff`는 피해 후에 적용됩니다. 베히모스처럼 별도 훅은 예외입니다.

---

## 6. 대미지 공식

1. 스킬 배율과 효과 핸들러(`DAMAGE_EFFECT_HANDLERS`)로 `mult` 구성.
2. 특성 보너스는 `(val - 1)`을 합한 뒤 `skillMultiplier * (1 + traitBonus)`.
3. 치명타: 기본 1.5. `sun_bless` +0.6, `reaper_realm` +0.4. `flood`면 이 가산도 2배.
4. 속성 우위 1.2배.
5. 방어: `finalDmg = floor(val * finalMult * (100 / (100 + def)))`.
6. 가드 감소는 그 다음 정수화.

관통은 원 방어력 기준 합산이 기본입니다. 꿈의형태 계열은 유효 마방 기준 예외가 있습니다.

---

## 7. 전투 턴 루프

1. 플레이어 턴 시작: 기절이면 행동 불가 후 해제, 지연 스킬, `kaleidoscope`/`gale_storm` 등 턴 시작 효과.
2. 플레이어 행동: 스킬/일반공격, MP 검사, 회피 → 배리어(물리 무효) → 매직가드(마법 무효) → 가드, 대미지, 부가효과. 무효면 그 공격은 종료됩니다.
3. 적 턴: 보스 AI/방어 프로토콜 후 동일 계산.
4. 사망: `handleDeathTraits`, 다음 슬롯 교대.
5. 적 전멸 시 승리, 아군 전멸 시 패배.

진입점은 `BattleRuntime.startBattleInit`입니다. `index.html`의 동명 메소드는 호환 래퍼입니다.

MP 예외:

- 시작 MP 100, 사용 시 `cost` 차감.
- `blue_moon`: 30% 확률 미소모.
- `support_boost`: `sup` 비용 0.
- `lucky_vicky`: 치명 또는 회피 시 MP +10.
- 일부 변환 효과로 즉시 MP 증가.

---

## 8. 모드

게임 타입은 엔드리스 / 챌린지 / (그 외 일반 해금 세트)입니다. UI에 실제로 뜨는 모드:

| ID | 이름 | 시작 티켓 | 클리어 스테이지 | 비고 |
|---|---|---|---|---|
| `origin` | 오리진 | 20 | 무한 | 기본 |
| `restriction` | 제약의 시련 | 10 | 18 | 레어 이하 |
| `balance` | 균형의 도전 | 10 | 18 | 에픽 이하 |
| `suffering` | 고난의 여정 | 10 | 24 | 클리어 보상 0, 축복 +2장 |
| `puzzle` | 퍼즐 | 0 | 12 | 시작 퀴즈로 36장, 사용 카드 소멸 |
| `archive` | 아카이브 | 10 | 18 | 스테이지 후 문법 퀴즈, 정답률 80% |
| `curse` | 저주의 증폭 | 10 | 24 | 디버프 계수 2배, 적 강화 |
| `flood` | 축복의 범람 | 10 | 24 | 필드버프 2배, 적 강화 |
| `chaos` | 카오스 | 0 | 24 | 매 전투 덱 초기화, 15장 풀. 패배 시 런 삭제 |
| `artifact_chaos` | 아티팩트카오스 | 0 | 24 | 카오스 + 스테이지마다 아티팩트 4개. 챌린지 전용 |
| `draft` | 드래프트 | 5 | 24 | 뽑기 대신 드래프트. 패배 시 런 삭제 |
| `factory` | 팩토리 | 20 | 24 | 40장 번들 드래프트. 패배 시 런 삭제 |
| `artifact` | 아티팩트 | 10 | 30 | 창조신 처치 시 아티팩트, 최대 4개 |
| `artifact_reserve` | 아티팩트리저브 | 20 | 24 | 세트 선택 4회로 12개 풀, 각 2회, 전투 전 최대 4개 활성 |
| `perfect_plan` | 퍼펙트플랜 | 20 | 무한 | 등급별 10장씩 40장 전용 풀, 적 1.1배. 엔드리스 |
| `dream_corridor` | 꿈의회랑 | 20 | 무한 | 히든. 실전마법연습 3회 후 출현. 오답 3회 유예 |

엔드리스에서 열리는 모드: `origin`, `draft`, `chaos`, `artifact`, `artifact_reserve`, `perfect_plan`, (해금 시) `dream_corridor`.  
챌린지에서는 `origin`/`archive`/`perfect_plan`을 빼고, `artifact_chaos`를 포함합니다.

가챠 등급은 모드별 `GACHA_RATES`를 씁니다. 챌린지 뽑기는 상위 등급 확률이 높습니다.

---

## 9. 초월·축복·퀴즈 보상

- 카오스 룰렛: `chaosTickets` 1장 소모, 아직 대기열에 없는 초월 카드 1장.
- 혼돈의 축복: 전투 강화, 사용 횟수 제한.
- 대현자의 축복: 최대 12장 강화 + 티켓 보상.

퀴즈 연동:

- 일반 승리 후 퀴즈 성공 시 티켓 +1.
- `creator_god` 처치: 일반 모드 문법 퀴즈 성공 시 티켓 +3, `artifact` 모드면 아티팩트 선택.
- chaos/draft: 콜로케이션 퀴즈 성공 시 티켓 +1.

꿈의회랑은 전투 후 퀴즈가 자동으로 이어지고, 오답은 즉시 저장됩니다. 3회 소진 시 런 실패입니다.

---

## 10. 미션·보너스 풀

월간 미션 3개:

- `endless35`: 무한 35스테이지 1회 (`endless40` 저장은 이 키로 마이그레이션)
- `challenge3`: 챌린지 클리어 3회
- `toeic3`: 실전마법연습 3회

보상은 미해금 보너스 카드 우선. 같은 달 1회만 수령.

주간 미션:

- `challenge1`: 챌린지 클리어 1회
- `toeic1`: 실전마법연습 1회
- `attendance3`: 3일 출석

주간 보상은 카오스 티켓 3장입니다.

보너스 풀 프리셋은 최대 3개. 런 시작 시 `state.activeBonusPoolIds`로 복사됩니다.

보너스 초월: `flora`/`gray`/`thor`/`poseidon`/`ares` 보상 라우트에서 미해금이면 10% 확률로 해금되어 카오스 룰렛 풀에 합류합니다.

기본 해금 보너스 카드: `ancient_soul`, `sun_priestess`, `cotton_candy_sheep`, `joker`.

---

## 11. 아티팩트

아티팩트 모드 보유 상한 4개.

### 기본 26종

| ID | 효과 |
|---|---|
| `nature_blessing` | `earth_bless` 2배 |
| `reverse` | 자연 카드 사망 시 `earth_bless` |
| `milkshake` | `star_powder` 2배 |
| `buff_overload` | 필드버프 상한 5 |
| `shadow_ball` | 암흑이 MDEF도 감소 |
| `assassin_nail` | 암흑/부식 감소 2배 |
| `veil_of_darkness` | 어둠 속성 crit/evasion +10 |
| `rabbit_hole` | 눈/밤/은토끼 crit/evasion +20 |
| `lucky_vicky` | 치명 또는 회피 시 MP +10 |
| `over_flame` | 작열 최대 5, 부여 2스택 |
| `over_divine` | 디바인 최대 5, 부여 2스택 |
| `holy_flame_burst` | 작열/디바인 전소모 추가위력 2배 |
| `flame_piercing` | 작열 스택당 물리방어 10% 관통 |
| `divine_piercing` | 디바인 스택당 마방 10% 관통 |
| `gale_storm` | 전투 시작 후 3턴 `gale` |
| `frozen_body` | 물 속성 사망 시 적 스턴 |
| `ice_break` | 스턴 대상 대미지 2배 |
| `support_boost` | 보조스킬 MP 0 |
| `double_attack` | 일반공격 2배 |
| `death_roulette` | 스킬 대미지 2배, 사용 시 30% 즉사 |
| `shadow_stab` | 회피 +20, DEF/MDEF -30% |
| `dragon_heart` | 드래곤 MATK +100% |
| `big_bang` | 전설/초월 사망 시 물리 3배 자폭 |
| `companion` | 사망 유발 대미지 2배 |
| `kaleidoscope` | 턴 시작 시 모든 필드버프 변경 |
| `blue_moon` | 스킬 30% 미소모 |

### 신기/마신기 (저확률 해금)

| ID | 대체 | 효과 |
|---|---|---|
| `divine_iris` | `divine_piercing` | 디바인 스택당 물방/마방 10% 관통 |
| `demon_iris` | `flame_piercing` | 작열 스택당 물방/마방 10% 관통 |
| `divine_pharaoh` | 없음 | DEF/MDEF +60%, 회피 -30% |
| `demon_beelzebub` | `big_bang` | 전설/초월 사망 시 물리 4배 자폭 |
| `divine_thor` | `milkshake` | `star_powder` 2.5배 |
| `divine_flora` | `nature_blessing` | `earth_bless` 2.5배 |
| `divine_gray` | `veil_of_darkness` | 어둠 속성 치명 +20, 회피 +10 |
| `divine_poseidon` | `ice_break` | 스턴 대상 2.5배 |
| `divine_ares` | `double_attack` | 일반공격 2.5배 |
| `divine_astea` | `holy_flame_burst` | 작열/디바인 전소모 추가위력 3배, 해금 확률 0.1% |

그 외 신기 해금 확률은 1%입니다.

---

## 12. 카드 데이터

정본은 `card/game/data.js`입니다. 현재 풀 규모(특수 시즌 변주 포함 집계는 파일 내 배열 기준):

- 일반 풀·보너스·초월을 합치면 등급별 대략 노말 26 / 레어 28 / 에픽 30 / 전설 33 / 초월 12 / 이벤트 5.
- 보너스 확장파(`BONUS_CARD_EXPANSION`)에는 둠, 큐어마스터, 퍼펙트아우로라, 명탐정, 푸른달의사제, **브륄레위치** 등이 포함됩니다.
- 브륄레위치(`brulee_witch`): 에픽 자연 디버퍼. 사망 시 트윙클파티. 스킬 `버닝시럽`, `홀리글레이즈`, `매직가드`.
- 특수 시즌 변주(발렌타인/수영복/할로윈/크리스마스)는 `SPECIAL_CARD_VARIANTS`로 기본 카드를 복제합니다.

스킬·특성·수치를 바꿀 때는 매뉴얼이 아니라 `data.js`와 전투 회귀 테스트를 고칩니다.

---

## 13. 학습·루미·Gemini

- 단어/연어/문법/튜터링은 `QuizEngine`.
- 실전마법연습은 `toeic.js` + `toeic_explanations.js`. 해설은 `TOEIC_EXPLANATIONS[set.id]`.
- Part 5/6/7 해설 화면에서 루미 질문 가능. 일반 세션과 TOEIC 세션은 분리됩니다.
- 완료 세트는 `state.completedToeicSets`에 남기고 미완료 세트만 고릅니다. 소진되면 초기화 확인을 띄웁니다.
- 문법·TOEIC 보기는 정답이 유일해야 합니다.
- API 키는 `cardRpgApiKey`. 루미 질문, TOEIC 질문, 과외, 데이트, 포춘쿠키가 공유합니다.
- 모델: Pro `gemini-2.5-pro`, Flash `gemini-3.8-flash`, Lite `gemini-3.5-flash-lite`. 데이트/포춘쿠키는 Flash → Lite 폴백.
- 실전마법연습 누적 3회(꿈의회랑 제외)면 `hiddenStudyReady`.

기본 전투와 내장 학습 데이터는 API 없이 동작합니다.

---

## 14. 저장 키

이름을 바꾸지 않습니다.

- `cardRpgSave`
- `cardRpgGlobal`
- `cardRpgVocab`
- `cardRpgCollocation`
- `cardRpgCollocationDetails`
- `cardRpgApiKey`
- `cardRpgRecords`
- `cardRpgMusicPrefs`
- `fortuneCookieLastUsedDate`
- `fortuneCookieLastResult`

DREAMWEAVER 전용: `astraPortraitPath`(초상화 상대 경로). 폴더 선택으로 연결한 파일은 세션 동안만 유지됩니다.

내보내기 형식은 `{ format:'astra-progress', version:1, values }`. API 키는 제외합니다. 기존 `cardRpgSave` JSON도 가져올 수 있습니다. 타이틀에서는 빈 여정이 저장을 덮지 않도록 게임 메뉴를 막습니다.

런 저장은 `SaveDataMigrator.normalizeRunState` / `serializeRunState`를 거칩니다. UI 전용 `currentToeicSession`은 직렬화에서 빠집니다.

---

## 15. DREAMWEAVER 화면 계약

- 하단 내비: 로비 / 편성 / 도감 / 학습 / 설정.
- 전투와 필수 드래프트 중에는 내비를 숨겨 전투를 이탈하지 않습니다.
- 빈 파티는 출전 버튼을 막고 소환→편성→출전을 안내합니다.
- 전체도감은 카드를 지급하지 않습니다.
- Escape는 실제 닫기/취소 버튼만 누르므로 보상·전투 선택을 우회하지 않습니다.
- 초상화 실패 시 카드 문양 SVG. 초상화/음원은 HTML 옆 로컬 파일이며 빌드에 넣지 않습니다.

---

## 16. 구현 체크리스트

- [ ] 카드/적/effect/trait 키는 `data.js`와 동일
- [ ] 스탯 계산 순서와 `100/(100+def)` 대미지식
- [ ] 회피 → 배리어/매직가드/가드 우선순위
- [ ] 필드버프 상한 3/5와 `valentine`/`arena`/`destiny_oath` 포함
- [ ] MP 자동회복 없음
- [ ] 카오스 룰렛/초월/퀴즈 보상 분기
- [ ] 아티팩트 26종 + 신기 대체 규칙
- [ ] 모드 목록(퍼펙트플랜, 아티팩트리저브, 꿈의회랑)과 티켓/클리어 조건
- [ ] 저장 키와 `astra-progress` 백업(API 키 제외)
- [ ] DREAMWEAVER 셸은 규칙을 복제하지 않고 `RPG`를 훅
- [ ] `npm run verify` 통과, 소스 변경 시 `dist/DREAMWEAVER.html` 재빌드
