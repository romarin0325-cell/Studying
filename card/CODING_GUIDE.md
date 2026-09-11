# Card RPG 코딩 가이드

기능의 정답은 브라우저에서 보이는 DREAMWEAVER 동작입니다. 구조 개선 때문에 기존 동작이나 저장 데이터가 바뀌면 안 됩니다. `card_legacy/`는 읽기 전용 스냅샷입니다.

## 먼저 읽을 파일

1. 배포·실행: `card/README.md`
2. 규칙 명세: `card/GAME_MANUAL.md`
3. 모듈 연결: `card/card_game_structure.md`
4. 화면·레이아웃: `card/src/shell.html`, `card/src/astra.css`, `card/src/astra.js`
5. 버튼·레거시 DOM 계약: `card/game/index.html`
6. 저장·미션·모드: `card/game/rpg_features.js`
7. 턴·스킬 실행: `card/game/battle_runtime.js`
8. 스탯·대미지·특성: `card/game/logic.js`
9. 카드·적 문구: `card/game/data.js`
10. Lumi/Gemini: `card/game/api.js`

## 책임 경계

| 위치 | 넣어야 하는 처리 | 넣지 말아야 하는 처리 |
|---|---|---|
| `card/game/data.js` | 카드·적의 정적 수치, ID, 표시 문구 | DOM, 저장, 턴 진행 |
| `card/game/logic.js` | 순수 계산, 효과 핸들러, 저장 형식 보정 | 화면 표시, 모달 열기 |
| `card/game/battle_runtime.js` | 전투 상태 변경, 턴 순서, 스킬 실행 | 카드 목록 DOM |
| `card/game/rpg_features.js` | 런/전역 상태와 모드·미션 규칙 | 미션 목록 DOM, 이미지 경로 |
| `card/game/index.html` | RPG 조립, 레거시 DOM ID, 퀴즈/TOEIC 진입 | 새 DREAMWEAVER 레이아웃, 새 전투 공식 |
| `card/src/astra.js` | 화면 훅, 로비/도감/편성 렌더, 초상화, 백업 | 대미지식, 카드 수치, 저장 스키마 |
| `card/build.mjs` | 단일 HTML 조립과 계약 검사 | 게임 규칙 |

`RPG`의 `executeSkill`, `calcDamage`, `applySkillEffects`는 호환 어댑터입니다. 새 전투 로직은 `BattleRuntime` 또는 `Logic`에 작성합니다.

## 이름과 서식

- 앱 JavaScript는 들여쓰기 4칸, 작은따옴표, 세미콜론.
- 런타임은 `camelCase`, 클래스는 `PascalCase`, 상수는 `UPPER_SNAKE_CASE`.
- `get...` / `is...`/`has...`/`can...` / `open...`/`close...` / `render...` / `normalize...`/`serialize...`.
- 저장된 레거시 `snake_case` 필드와 카드·아티팩트·모드·버프 ID는 마이그레이션 없이 바꾸지 않습니다.

## 주석

코드가 보장해야 하는 이유나 제약을 남깁니다. `Fix:`, `버그수정`, 코드 번역 주석은 쓰지 않습니다.

## 저장 데이터

다음 키는 이름을 바꾸지 않습니다.

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

DREAMWEAVER 초상화 경로는 `astraPortraitPath`입니다. 백업 포맷 `astra-progress` v1에는 API 키를 넣지 않습니다.

런 저장은 `SaveDataMigrator.normalizeRunState` / `serializeRunState`를 거칩니다.

1. 알 수 없는 필드는 삭제하지 않습니다. 카드 ID 목록처럼 검증 함수가 있으면 유효 값만 남깁니다.
2. 더 높은 `saveSchemaVersion`은 추측해서 낮추지 않습니다.
3. 누락·잘못된 배열만 안전한 기본값으로 보정합니다.
4. UI 전용 `currentToeicSession`은 직렬화에서 제외합니다.
5. JSON 손상을 “저장 없음”으로 취급하지 않습니다.
6. 글로벌 해금은 복구본을 주 저장소에 쓴 뒤에만 성공입니다.
7. `cardRpgRecords`의 `최대 스테이지: N` 문자열은 파서가 읽는 형식입니다.
8. 학습 진도는 런 저장과 전용 키가 겹칩니다. 로드 시 전용 키가 우선합니다.

새 저장 필드는 `scripts/verify_card_refactor.js`와 필요하면 `card/tests/`에 테스트를 추가합니다.

## 이미지

- 정적 이미지는 `data-image-src`, 동적 초상화는 `ImageAssets.load` 경로를 유지합니다.
- `data-image-src` / `imageFile`이 있으면 우선하고, 없으면 `${entity.name}.png`.
- Astra가 상대 폴더와 세션 폴더 선택, 실패 시 카드 문양 SVG를 처리합니다.
- `onerror="this.src=''"`나 화면별 파일명 조합을 추가하지 않습니다.
- 초상화·음원은 빌드/Git에 넣지 않고 HTML 옆에 둡니다.

## 로더와 빌드

`game/index.html`의 14개 순차 로더는 개발·모바일 원본 계약입니다. 새 스크립트를 추가하면 다음을 함께 고칩니다.

1. `scripts` 배열과 `build.mjs`의 `dependencies`
2. `getMissingRequiredData()` 필수 전역
3. `_scriptLoadComplete` 전에는 시작 버튼을 켜지 않음
4. `scripts/verify_card_mobile.js`와 `card/tests/verify.mjs`

배포 HTML은 외부 JS/CSS/웹폰트가 없어야 합니다. 소스를 바꾸면 `npm run build:card`로 `dist/DREAMWEAVER.html`을 다시 만들고 커밋합니다.

## 카드·특성·효과

`name`을 바꾸면 일부 적 AI와 시너지가 달라질 수 있습니다. 새 `effect.type`은 한곳에만 둡니다.

- 대미지 배율·관통: `DAMAGE_EFFECT_HANDLERS`
- 버프·디버프·필드: `SideEffects.handlers`
- 지연 스킬: `buildResolvedDelayedSkill`
- 전투 흐름: `BattleRuntime`

기존 타입은 별칭으로 공통 처리에 연결합니다. 새 복합 효과는 `chance`, `mult`, `ratio`, `threshold`처럼 의미가 드러나는 필드를 씁니다.

## 합연산·곱연산

1. 초기 자기 특성과 배치 특성은 곱하고 정수화.
2. 같은 파티 보너스 `%`는 합한 뒤 한 번 곱고 정수화.
3. peer 보너스와 혼돈 축복은 앞 결과에 다시 곱함.
4. 전투 중 필드/특성/디버프는 같은 계수에 가감한 뒤 기본 스탯에 곱함.
5. 스킬 “배율 추가”는 `ctx.mult +=`, “N배”는 `ctx.mult *=`.
6. 특성 대미지 보너스는 `(val - 1)` 합 후 `skillMultiplier * (1 + traitBonus)`.
7. 치명·속성·방어·가드 후 최종 정수화.

치명/회피는 퍼센트포인트 합산입니다. Guardian은 이름이 정확히 `가드`인 스킬만 75% 감소입니다.

## 완료 전 검사

저장소 루트:

```powershell
npm run verify
```

`card/`가 바뀌면 루트 검증은 Card 린트, `scripts/verify_card_*.js` 스모크/브라우저(원본 `game/index.html`), 그리고 `card/` 패키지 검증(`astra.js` 문법, 빌드, `tests/verify.mjs`, `tests/flows.mjs`, `tests/dreamweaver.mjs`)을 실행합니다. Defense는 돌리지 않습니다.

실제 Android WebView, 비공개 초상화/음원 전체, 유료 Gemini 응답은 자동 검증에 없습니다. 그 경우 미검증 항목을 명시합니다.
