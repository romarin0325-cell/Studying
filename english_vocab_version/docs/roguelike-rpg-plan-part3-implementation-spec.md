# 로그라이크 RPG 제작사양서 Part 3. 구현 방식/파일 설계

## 1. 구현 목표

- 기존 `english_vocab_version/new.html`의 안정 동작을 깨지 않는 것이 우선이다.
- 따라서 신규 로그라이크 모드는 `기존 페이지 직접 대수술`보다 `신규 엔트리 추가`가 안전하다.
- 권장 구현 방향:
  - 기존 RPG를 레퍼런스로 두고
  - 새 파일군으로 로그라이크 모드를 추가
  - 영어 퀴즈, 보스 AI, 일부 전투 유틸은 공용 재사용

## 2. 권장 파일 구조

```text
english_vocab_version/
  roguelike.html
  roguelike_data.js
  roguelike_ai.js
  roguelike_runtime.js
  roguelike_ui.js
  roguelike_save.js
  data.js              // 기존 자산 참조용
  vocab.js             // 영어 퀴즈 재사용
  new.html             // 기존 RPG 유지
```

### 2-1. 파일별 역할

| 파일 | 역할 |
| --- | --- |
| `roguelike.html` | 모달, 상태 패널, 전투 영역, 드래프트/상점 UI 뼈대 |
| `roguelike_data.js` | 난이도, 루트, 스킬 풀, 장비 풀, 아티팩트 풀, 전직 가중치 |
| `roguelike_ai.js` | 기존 보스 AI를 로그라이크 전투 엔진용 함수로 래핑 |
| `roguelike_runtime.js` | 런 상태, 전투 진입, 레벨업, 드래프트, 상점, 전직 로직 |
| `roguelike_ui.js` | 상태 칩, 드래프트 모달, 상점 리스트, 장착 스킬 UI |
| `roguelike_save.js` | 저장/불러오기, 마이그레이션, 세이브 검증 |

## 3. 데이터 사양

### 3-1. 핵심 정적 데이터

```js
const DIFFICULTY_PRESETS = {
  easy:   { hp: 0.90, atk: 0.88, matk: 0.88, def: 0.90, exp: 0.95, gold: 0.95, bossPatternBonus: -0.10 },
  normal: { hp: 1.00, atk: 1.00, matk: 1.00, def: 1.00, exp: 1.00, gold: 1.00, bossPatternBonus:  0.00 },
  hard:   { hp: 1.18, atk: 1.20, matk: 1.20, def: 1.10, exp: 1.10, gold: 1.15, bossPatternBonus:  0.10 }
};

const BASE_RUMI = {
  hp: 540, mp: 180, atk: 52, matk: 52, def: 32, mdef: 32,
  crit: 0.08, critDmg: 1.5, eva: 0.05
};

const LEVEL_EXP_TABLE = [140,150,170,190,220,250,290,330,370,420,470,520,570,630,690,760,830,910,1000];
```

### 3-2. 스킬 정의 포맷

```js
const SKILLS = {
  guard: {
    id: "guard",
    name: "가드",
    job: "knight",
    type: "support",
    family: "starter_defense",
    costMp: 10,
    power: 0,
    scaleTag: "support",
    preferredWeapons: ["sword", "mace", "spear"],
    effect: { kind: "guard", reduction: 0.70, turns: 1 },
    isUltimate: false
  }
};
```

### 3-3. 장비 정의 포맷

```js
const WEAPONS = [
  {
    id: "training_shortsword",
    name: "훈련용 숏소드",
    type: "sword",
    price: 220,
    unlockStage: 1,
    stats: { atk: 8, matk: 4 },
    passive: { kind: "basic_attack_bonus", value: 0.05 }
  }
];
```

### 3-4. 아티팩트 정의 포맷

```js
const ARTIFACTS = [
  {
    id: "vit_stone",
    name: "생명의 돌",
    rarity: "common",
    unlock: { type: "default" },
    effects: [{ kind: "stat_percent", stat: "hp", value: 0.15 }]
  }
];
```

### 3-5. 선형 루트 정의 포맷

```js
const ROUTE_NODES = [
  { id: "stage1_battle1", kind: "battle", stage: 1, enemyPool: ["slime", "kobold"], reward: { exp: 120, gold: 50 } },
  { id: "stage1_boss", kind: "boss", stage: 1, enemyPool: ["ghost_king"], reward: { exp: 220, gold: 150 }, shopAfter: true },
  { id: "event_dungeon", kind: "event_chain", stage: "event", eventPool: ["dessert", "magic", "dragon", "ruins", "time"] }
];
```

## 4. 런타임 상태 사양

### 4-1. 런 상태 객체

```js
const runState = {
  seed: "",
  difficulty: "normal",
  nodeIndex: 0,
  level: 1,
  exp: 0,
  gold: 450,
  protagonist: "rumi",
  job: "none",
  stats: {},
  baseStats: {},
  growthLedger: [],
  ownedSkills: ["basic"],
  equippedSkills: ["basic"],
  ultimateSkills: [],
  artifacts: [],
  weaponInventory: [],
  armorInventory: [],
  equippedWeaponId: null,
  equippedArmorId: null,
  draftState: null,
  shopState: null,
  hiddenUnlocks: {},
  clearedEvents: [],
  selectedEventDungeon: null,
  quizReroll: { remaining: 0 },
  battle: null
};
```

### 4-2. battle 상태 객체

```js
const battleState = {
  enemyId: "",
  enemy: {},
  turn: 1,
  playerBuffs: {},
  enemyBuffs: {},
  statusChips: [],
  usedOnceFlags: {}
};
```

## 5. 구현 함수 목록

### 5-1. 런 시작/진행

| 함수 | 역할 |
| --- | --- |
| `startRoguelikeRun(difficulty)` | 새 런 생성, 루미 기본값 세팅 |
| `advanceRoute()` | 다음 노드 계산 |
| `resolveNode(node)` | 전투/상점/전직/아티팩트 노드 분기 |
| `enterLinearBattle()` | 현재 노드 기준 전투 시작 |
| `finishBossNode()` | 상점 호출, 저장 가능 상태 갱신 |

### 5-2. 스탯/레벨

| 함수 | 역할 |
| --- | --- |
| `rebuildLevelGrowth(jobId)` | 현재 레벨까지 성장분 재계산 |
| `recalcPlayerStats()` | 장비/아티팩트/버프 포함 최종 스탯 계산 |
| `gainExp(amount)` | 경험치 획득 |
| `tryLevelUp()` | 다중 레벨업 처리 |
| `getExpNeeded(level)` | 경험치 테이블 조회 |

### 5-3. 드래프트/퀴즈

| 함수 | 역할 |
| --- | --- |
| `openSkillDraft(source)` | 시작/레벨업 드래프트 표시 |
| `buildSkillDraftOptions(context)` | 3개 후보 생성 |
| `rerollDraftWithQuiz(mode)` | 퀴즈 후 전체 또는 부분 재롤 |
| `selectDraftOption(optionId)` | 스킬/아티팩트 확정 |
| `openArtifactDraft(level)` | 5/10/15/20 레벨 아티팩트 드래프트 |

### 5-4. 상점/장비

| 함수 | 역할 |
| --- | --- |
| `openBossShop()` | 3칸 상점 생성 |
| `rollShopStock()` | 무기/방어구 3개 생성 |
| `rerollShopWithQuiz()` | 상점 재롤 |
| `purchaseEquipment(itemId)` | 골드 차감, 장비 획득 |
| `equipItem(itemId)` | 현재 장비 교체 |

### 5-5. 전직/히든

| 함수 | 역할 |
| --- | --- |
| `openPromotionChoice()` | 이벤트 보스 격파 후 전직 선택 |
| `promoteTo(jobId)` | 성장 재계산 + 궁극기 지급 |
| `unlockHiddenReward(key)` | 아티팩트/장비 해금 |
| `evaluateMissionTriggers(context)` | 이벤트/난이도/미션 조건 판정 |

## 6. 드래프트 생성 알고리즘

### 6-1. 스킬 후보 생성 순서

1. 후보 풀 = `궁극기 제외`, `이미 소유한 스킬 제외`
2. `starter_defense` 여부 확인
3. 직군 대표 여부 계산
4. 미대표 직군에 높은 가중치 부여
5. 동일 드래프트 내 중복 직군 최대 2개 제한
6. 3개 선택

### 6-2. 의사코드

```js
function buildSkillDraftOptions(context) {
  const pool = getEligibleSkills(context);
  const weighted = pool.map(skill => ({
    skill,
    weight: hasJob(skill.job) ? 35 : 65
  }));

  return weightedSampleWithoutReplacement(weighted, 3, (picked, candidate) => {
    return countSameJob(picked, candidate.job) < 2;
  });
}
```

## 7. 피해 계산 구현 포인트

### 7-1. 공격력 산출

```js
function getScaledOffense(skill, player) {
  if (skill.scaleTag === "physical") return player.atk * 1.0 + player.matk * 0.2;
  if (skill.scaleTag === "magical") return player.matk * 1.0 + player.atk * 0.2;
  if (skill.scaleTag === "hybrid") return player.atk * 0.65 + player.matk * 0.65;
  return 0;
}
```

### 7-2. 방어 감쇠

```js
function calcMitigation(defense, targetLevel) {
  return Math.min(0.65, defense / (defense + 120 + targetLevel * 8));
}
```

### 7-3. 핵심 주의사항

- `DEF/MDEF 성장 0`이므로 장비/아티팩트가 최종 방어의 대부분을 차지한다.
- 따라서 `recalcPlayerStats()`는 전투 중 버프 적용 전후를 명확히 분리해야 한다.
- 현재 `new.html`의 `% 누적 방식`을 그대로 가져오지 말고, 로그라이크 모드에서는 `플랫 방어 + 제한적 버프` 위주로 재작성하는 편이 안전하다.

## 8. 기존 AI 재사용 범위

### 8-1. 그대로 재사용할 AI 키

- `basic`
- `charge`
- `ghost_king`
- `mawang`
- `tree`
- `mashin`
- `witch`
- `goddess`
- `cream_maid`
- `candy_boy`
- `pudding_princess`
- `flame_sage`
- `lightning_sage`
- `artificial_god`
- `red_dragon`
- `gold_dragon`
- `sphinx`
- `pharaoh`
- `silent_librarian`
- `night_rabbit`
- `time_ruler`

### 8-2. 부분 수정이 필요한 AI

| AI | 수정 포인트 |
| --- | --- |
| `goddess` | 로그라이크용 최종 보스 수치/턴 수에 맞게 고정 패턴 타이밍만 재조정 |
| `witch` | Hard 난이도 패턴 강화와 부활 HP만 난이도 연동 |
| `mashin` | 이벤트 보스가 아닌 메인 보스로 쓰는 경우 패턴 경고 문구만 조정 |

## 9. UI 사양

### 9-1. 신규 화면 요소

| 컴포넌트 | 설명 |
| --- | --- |
| 난이도 선택 모달 | Easy/Normal/Hard 시작 선택 |
| 선형 루트 패널 | 현재 장/보스/이벤트 위치 표시 |
| 드래프트 모달 | 스킬/아티팩트 3지선다 + 리셋 버튼 |
| 장착 스킬 패널 | 8개 일반 슬롯 + 궁극기 2슬롯 |
| 상태 칩 바 | 적용 중인 상태만 표시 |
| 상점 패널 | 장비 3개, 재롤 버튼, 현재 장비 비교치 |
| 전직 선택 모달 | 5직업 비교, 전직 후 예상 스탯 미리보기 |

### 9-2. 상태 칩 렌더 규칙

- 빈 상태는 렌더하지 않음
- 같은 종류는 합쳐서 렌더
- 권장 포맷:

```text
[가드 1T] [회피+40% 2T] [암흑 3] [형태: 달 2T]
```

## 10. 저장 사양

### 10-1. 저장 키

- `turnRoguelikeSaveData`
- 기존 `turnRpgSaveData`와 분리

### 10-2. 저장 필드

```js
{
  version: 1,
  timestamp: 0,
  runState: {},
  nodeHistory: [],
  hiddenUnlocks: {},
  options: { sound: true, fastText: false }
}
```

### 10-3. 마이그레이션

- 기존 RPG 저장을 자동 변환하지 않는다.
- 이유:
  - 게임 규칙이 다름
  - 스킬 습득 방식이 다름
  - 노드/상점/전직 상태가 호환되지 않음

## 11. 구현 순서

### Phase 1. 데이터 뼈대

- `roguelike_data.js` 작성
- 난이도, 루트, 레벨 테이블, 스킬/장비/아티팩트 정의
- 완료 기준:
  - 콘솔에서 데이터 검증 가능
  - 중복 ID 없음

### Phase 2. 전투 엔진 이식

- `roguelike_runtime.js` 작성
- 기본 공격, 스킬 사용, 적 턴, 승패 판정, 경험치/레벨업
- 완료 기준:
  - 1장부터 2장 보스까지 전투 가능

### Phase 3. 드래프트/상점

- 시작 드래프트 3회
- 레벨업 드래프트
- 보스 상점
- 퀴즈 리셋
- 완료 기준:
  - 리셋 2회 제한 정상 동작

### Phase 4. 이벤트/전직/히든

- 천계 직전 이벤트 던전 1개 랜덤 선택
- 전직 팝업
- 히든 장비/아티팩트 해금
- 완료 기준:
  - 전직 후 성장 재계산
  - 궁극기 2개 지급

### Phase 5. 세이브/로딩/밸런스

- 저장/불러오기
- Hard 난이도
- 장비/아티팩트 수치 보정
- 완료 기준:
  - 세이브/로드 후 진행 노드 유지

## 12. 테스트 사양

### 12-1. 자동 확인 대상

- 데이터 중복 ID 검사
- 레벨업 경험치 누적 검사
- 전직 후 스탯 재계산 검사
- 드래프트 후보 중복 금지 검사
- 상점 3칸 생성 규칙 검사

### 12-2. 수동 확인 대상

- Easy/Normal/Hard 시작 선택
- 시작 드래프트 3회 동작
- 스킬 리셋 2회 제한
- 아티팩트 레벨 타이밍
- 이벤트 던전이 천계 직전 1회만 나오는지
- 전직 후 궁극기 2개 자동 장착
- 상태 칩이 적용 중인 것만 표시되는지

### 12-3. 완료 전 필수 명령

```text
npm run verify
```

- 추가 권장:
  - 로그라이크 신규 스모크 스크립트 1개 작성
  - 최소 시나리오: 시작 -> 1장 보스 -> 상점 -> 세이브/로드

## 13. 주요 리스크

| 리스크 | 설명 | 대응 |
| --- | --- | --- |
| 기존 페이지와 CSS 충돌 | `new.html`에 직접 얹으면 회귀 위험 큼 | 신규 `roguelike.html` 분리 |
| 스킬 버튼 과밀 | 레벨 20까지 가면 스킬 수가 너무 많음 | 장착 슬롯 8개 제한 |
| 방어 아티팩트 과성장 | 기존 퍼센트 누적 방식이면 탱커화 재발 | 방어 성장 0 + 플랫 방어 아이템 |
| 전직 재계산 버그 | 현재 레벨까지 일괄 재적용이 누락될 수 있음 | `growthLedger` 대신 매번 재빌드 |
| 퀴즈 UI 중복 | 기존 퀴즈 모달과 충돌 가능 | 퀴즈 콜백 래퍼 함수 분리 |
