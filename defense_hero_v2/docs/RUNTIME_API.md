# 런타임·클래스 API 가이드

이 문서는 `defense_hero_v2`의 화면 전환, 고정 틱 전투, 상태 저장, 특성 DSL을 수정할 때 지켜야 하는 런타임 경계를 설명한다. 구현이 문서보다 우선하며, 각 제목의 소스 링크가 최종 계약이다.

## 1. 가장 먼저 기억할 경계

유지보수 코드가 의존해도 되는 상위 경계는 다음과 같다.

1. 앱 부팅과 화면 전환은 [GameApp](../js/app/GameApp.js)과 [SceneController](../js/app/SceneController.js)가 담당한다.
2. 화면에서 전투를 변경할 때는 [BattleSession](../js/battle/BattleSession.js)의 `applyNow()`, `enqueue()`, `step()`만 사용한다.
3. 화면과 렌더러는 `session.state`를 직접 바꾸지 않는다. 읽기에도 가능하면 `session.snapshot()`을 쓴다.
4. `battle/systems/*`의 export는 엔진 내부 조립 지점이다. 테스트에서는 직접 호출할 수 있지만, UI의 장기 안정성을 보장하는 public facade는 아니다.
5. 전투는 60Hz 고정 틱과 정해진 액션 순서에 의존한다. 시스템 호출 순서를 바꾸거나 정렬을 제거하면 같은 seed의 결과가 달라진다.
6. 체크포인트는 임의 틱 전체를 저장하는 save state가 아니라 **웨이브 경계 복구 데이터**다.
7. 시스템에 `if (hero.id === '...')` 같은 캐릭터 ID 분기를 추가하지 않는다. 캐릭터 차이는 콘텐츠 데이터와 조건/연산 DSL로 표현한다.

권장 의존 방향은 아래와 같다.

```text
main.js
  -> GameApp
     -> SceneController -> Screen
                        -> BattleScreen -> BattleSession
                                           -> BattleState
                                           -> battle/systems/*
                                              -> effects DSL
     -> SaveRepositoryV2
```

## 2. 앱과 화면 수명주기

### GameApp

소스: [js/app/GameApp.js](../js/app/GameApp.js)

```js
new GameApp({
  documentRef = globalThis.document,
  repository = null,
})
```

생성 시 `#scene-root`와 `#overlay-root`를 찾고, 저장소·설정·에셋 관리자·화면 컨트롤러를 준비한다. 두 DOM 루트가 없으면 즉시 예외가 발생한다. `repository`를 생략하면 `SaveRepositoryV2`를 만든다.

주요 API:

| API | 반환/효과 | 사용 시점 |
| --- | --- | --- |
| `start()` | 자기 자신 | 메뉴 에셋 preload, 스테이지 화면 표시, 자동검증용 `__heroDefenseV2Debug` 설치 |
| `showStages()` | 없음 | 체크포인트를 읽고 스테이지 화면으로 이동 |
| `showFormation(stageId?)` | 없음 | 선택 스테이지의 편성 화면으로 이동 |
| `showBattle(options?)` | 없음 | 선택 영웅/보스 에셋을 preload하고 전투 화면 생성 |
| `showResult(result)` | 없음 | 현재 스테이지 이름을 붙여 결과 화면 표시 |
| `openSettings()` | 없음 | overlay root에 설정 dialog 표시 |
| `getDebugState()` | 직렬화 가능한 진단 객체 | 브라우저 검증과 문제 재현 |
| `destroy()` | 없음 | 현재 화면과 overlay 정리, debug facade 제거 |

`start()`는 한 앱 인스턴스에서 한 번 호출하고, 호스트를 내릴 때 `destroy()`를 호출한다. 기존 [main.js](../js/main.js)가 이미 자동 부팅하므로 같은 페이지에서 두 번째 `GameApp`을 만들면 안 된다.

독립 호스트에서 쓸 최소 예제:

```js
import { GameApp } from './js/app/GameApp.js';

const app = new GameApp({ documentRef: document }).start();
window.addEventListener('pagehide', () => app.destroy(), { once: true });
```

### SceneController

소스: [js/app/SceneController.js](../js/app/SceneController.js)

```js
new SceneController(rootElement, {
  sceneName: ScreenConstructor,
})
```

화면 factory는 `new Factory(options)`, `mount(root)`, `destroy()` 계약을 따라야 한다.

| API | 동작 |
| --- | --- |
| `show(name, options = {})` | 이전 화면 `destroy()` → root 비우기 → 새 화면 생성 → `mount(root)`; 새 화면 반환 |
| `destroy()` | 현재 화면 `destroy()`, 참조 제거, root 비우기 |
| `current` | 현재 화면 인스턴스. 선택적 debug/settings 위임에만 사용 |
| `currentName` | 현재 factory 키 |

등록하지 않은 이름은 `RangeError`다. 화면을 직접 교체하거나 `root.innerHTML`을 컨트롤러 밖에서 덮지 말고 `show()`를 사용한다.

복사 가능한 화면 예제:

```js
import { SceneController } from './js/app/SceneController.js';

class MaintenanceScreen {
  constructor({ message = '점검 중' } = {}) {
    this.message = message;
    this.root = null;
  }

  mount(root) {
    this.root = root;
    root.textContent = this.message;
  }

  destroy() {
    this.root = null;
  }
}

const scene = new SceneController(document.querySelector('#scene-root'), {
  maintenance: MaintenanceScreen,
});
scene.show('maintenance', { message: '곧 돌아올게요' });
```

### 네 개 Screen

화면 소스:

- [StageSelectScreen](../js/app/screens/StageSelectScreen.js)
- [FormationScreen](../js/app/screens/FormationScreen.js)
- [BattleScreen](../js/app/screens/BattleScreen.js)
- [ResultScreen](../js/app/screens/ResultScreen.js)

모든 화면은 생성자에서 옵션을 보관하고, `mount(root)`에서 DOM을 만들고 이벤트를 연결하며, `destroy()`에서 장기 자원을 해제한다.

#### StageSelectScreen

```js
new StageSelectScreen({
  checkpoint,
  onFormation, // (stageId) => void
  onContinue,  // () => void
  onSettings,  // () => void
})
```

`mount(root)`가 스테이지 카드와 선택 가능한 Easy 난도를 표시한다. 체크포인트가 있으면 계속하기 배너가 추가된다. 공개 수명주기 메서드는 `mount(root)`, `destroy()`다.

#### FormationScreen

```js
new FormationScreen({
  stageId,
  initialFormation,
  assetManager,
  onBack,  // () => void
  onReady, // ({ mainId, heroIds }) => void
})
```

메인 1명과 일반 4명을 선택한다. `onReady`에는 복사한 `heroIds`가 전달된다. 초상화 preload는 비동기지만, 화면 선택 상태는 콘텐츠 ID로 유지된다. 공개 수명주기 메서드는 `mount(root)`, `destroy()`다.

#### BattleScreen

```js
new BattleScreen({
  stageId,
  formation,
  checkpoint = null,
  repository,
  assetManager,
  settings,
  onSettings,
  onBack,
  onResult, // ({ result, snapshot }) => void
})
```

`mount(root)`에서 세션, 렌더러, 이펙트 렌더러, `GameLoop`, resize 감시를 생성한다. UI 명령은 `BattleSession.applyNow()`로 들어가며 캔버스 pointer는 논리 좌표로 변환한 뒤 `place_hero` 명령을 적용한다.

| API | 용도 |
| --- | --- |
| `mount(root)` | 전투 전체 생성 및 루프 시작 |
| `updateSettings(settings)` | 이펙트 간소화와 대미지 숫자 설정 즉시 반영 |
| `getDebugState()` | snapshot, layout, effect cap, 성능 샘플 조회 |
| `debugAutoPlace()`, `debugStartWave()`, `debugStepTicks(n)` | 자동 브라우저 검증 전용 |
| `destroy()` | 루프·세션·observer·timer·audio context·전투 CSS 상태 정리 |

`debug*` 메서드와 전역 `__heroDefenseV2Debug`는 플레이 기능을 구현하는 API가 아니다. 운영 UI 로직은 DOM 이벤트 → 세션 명령 경로를 유지한다.

2배속은 `GameLoop`의 고정 간격을 바꾸지 않고 한 프레임 update에서 `BattleSession.step(1/60)`을 두 번 호출한다. 이 방식을 유지해야 물리 시간과 타이머가 결정론적으로 진행된다.

#### ResultScreen

```js
new ResultScreen({
  result,
  stageName,
  onRetry,
  onFormation,
  onStages,
})
```

`result.victory`, `result.wave`, `result.elapsedSeconds`를 읽어 결과와 세 이동 버튼을 표시한다. 공개 수명주기 메서드는 `mount(root)`, `destroy()`다.

## 3. Core 클래스

### GameLoop

소스: [js/core/GameLoop.js](../js/core/GameLoop.js)

```js
new GameLoop({
  update,                 // (fixedDelta, simulationTime) => void
  render = () => {},      // (alpha, frameMeta) => void
  now,
  requestFrame,
  cancelFrame,
})
```

- 고정 update 간격은 `1 / 60`초다.
- 한 실제 프레임의 delta는 최대 0.1초로 제한된다.
- 한 프레임에서 최대 5회 catch-up update를 수행한다.
- 남은 과도한 update는 버리고 `droppedUpdates`에 누적한다.
- `render`의 `alpha`는 0~1 사이 보간 비율이다.
- update/render가 예외를 던지면 루프를 정지한 뒤 예외를 다시 던진다.

| API | 반환/주의 |
| --- | --- |
| `start()` | 새로 시작하면 `true`, 이미 실행 중이면 `false` |
| `stop()` | 정지했으면 `true`, 이미 정지면 `false` |
| `reset()` | 누적 시간·시뮬레이션 시간·drop 수를 초기화하지만 실행 상태는 바꾸지 않음 |
| `tick(timestamp?)` | 실행 중일 때 한 프레임 처리 결과, 아니면 `null`; 주로 테스트 주입용 |
| `running`, `simulationTime`, `droppedUpdates` | 읽기 전용 getter |

### EventBus

소스: [js/core/EventBus.js](../js/core/EventBus.js)

`new EventBus()`는 인자를 받지 않으며, 모든 listener는 인스턴스 내부에만 보관된다.

| API | 계약 |
| --- | --- |
| `on(type, listener)` | 구독하고 unsubscribe 함수 반환 |
| `once(type, listener)` | 첫 호출 전에 자체 구독 해제 |
| `off(type, listener)` | 제거 여부 boolean |
| `emit(type, ...args)` | emit 시작 시점 listener snapshot을 호출하고 호출 수 반환 |
| `clear(type?)` | 한 종류 또는 전체 listener 제거 |
| `listenerCount(type)` | 현재 listener 수 |

`type`은 문자열 또는 symbol이어야 한다. listener 예외는 삼키지 않으므로 발행자까지 전파된다. 화면이나 세션 종료 시 직접 등록한 구독은 반환된 함수로 해제한다.

```js
const unsubscribe = session.events.on('wave_completed', ({ wave, reward }) => {
  console.log({ wave, reward });
});

// 화면/테스트 종료 시
unsubscribe();
```

### SeededRng

소스: [js/core/SeededRng.js](../js/core/SeededRng.js)

```js
const rng = new SeededRng('stage:wave:test');
```

| API | 결과 |
| --- | --- |
| `next()` | `[0, 1)` 실수 |
| `int(max)` | `[0, max)` 정수 |
| `int(min, max)` | `[min, max)` 정수 |
| `pick(array)` | 비어 있지 않은 배열의 한 항목 |
| `shuffle(array)` | 입력을 바꾸지 않은 셔플 복사본 |
| `fork(label)` | 부모를 소비하지 않는 독립 stream |
| `snapshot()` | seed와 4개 uint32 상태를 담은 frozen snapshot |
| `restore(snapshot)` | 현재 인스턴스 복원 후 자기 자신 반환 |
| `SeededRng.restore(snapshot)` | 복원된 새 인스턴스 |

결정론 경계 안에서는 `Math.random()`을 사용하지 않는다. 새 하위 시스템이 독립적인 난수 소비를 가져야 하면 고정 label로 `fork()`한다. label을 동적 표시명이나 번역 문자열로 만들지 않는다.

### CommandQueue

소스: [js/core/CommandQueue.js](../js/core/CommandQueue.js)

`new CommandQueue()`는 인자를 받지 않고 sequence 0과 빈 대기열에서 시작한다.

| API | 계약 |
| --- | --- |
| `enqueue(type, payload = {}, tick = 0)` | `{ type, payload, tick, sequence }` frozen command 반환 |
| `drainThrough(tick = Infinity)` | 해당 tick까지의 명령을 `tick → sequence` 순서로 제거·반환 |
| `clear()` | 대기 명령 제거; sequence 번호는 되감지 않음 |

command freeze는 얕다. enqueue 뒤 `payload`를 수정하면 재현성이 깨지므로 payload도 불변 값처럼 다룬다.

## 4. BattleState와 체크포인트

소스: [js/battle/BattleState.js](../js/battle/BattleState.js)

### validateFormation(formation)

`{ mainId, heroIds }`를 검증하고 frozen 복사본을 반환한다.

- main position 영웅 1명
- normal position 영웅 정확히 4명
- 총 5 ID 중복 금지

실패하면 `TypeError` 또는 `RangeError`가 발생한다.

### createBattleState(options)

```js
createBattleState({
  stageId,
  difficultyId = 'easy',
  formation,
  seed,
  checkpoint = null,
})
```

반환값은 시스템이 공동으로 수정하는 **mutable 내부 상태**다. UI DTO가 아니다.

중요한 canonical 값:

- `state.heroes`: 영웅 런타임 객체 배열. slot 순서는 편성 순서다.
- `state.registry`: 적과 풀링 엔티티의 소유자.
- `state.enemies`: `state.registry.enemies`와 같은 Map.
- `state.rng`: 세션 RNG. 웨이브 시작 시 별도 `state.waveRng`가 고정 seed로 생성된다.
- `state.events`: 시스템이 append하고 세션이 flush하는 이벤트 배열.
- `state.phase`: `PREPARATION | WAVE_RUNNING | INTERMISSION | VICTORY | DEFEAT`.

화면은 이 객체를 직접 mutate하지 않는다. 새 시스템을 작성할 때도 기존 상태 필드를 임의로 추가하기 전에 checkpoint, snapshot, 테스트 영향 여부를 확인한다.

### createCheckpointFromState(state)

저장하는 항목:

- session/stage/difficulty/formation
- 배치, 레벨, Lv4·Lv6 선택 특성
- 다음 웨이브, 코어 내구도, 꿈의 결정
- RNG snapshot
- 다음 웨이브용 flag

저장하지 않는 항목:

- 현재 살아 있는 적과 spawn 진행
- 영웅 attack/skill timer, 방향, 마지막 target
- 누적 영웅 통계
- tick, 이전 플레이의 elapsedSeconds
- 화면 이펙트와 렌더 상태

따라서 체크포인트는 arbitrary mid-wave snapshot으로 사용하면 안 된다. 지원 경계는 **5명 배치가 끝난 준비 상태와 웨이브 사이 상태**다. `BattleSession`은 전체 배치, 레벨업, 웨이브 시작 경계, 웨이브 완료 시점에 저장하며 승패 시 삭제한다.

복원 후 다음 웨이브 시작은 `startWave()`가 영웅 timer, target, 방향을 정규화한다. 이 경계 규칙은 [checkpoint-continuity.test.mjs](../tests/integration/checkpoint-continuity.test.mjs)로 보호된다. 엔티티 ID, 과거 통계, 과거 경과 시간까지 동일하다는 보장은 없다.

복사 가능한 checkpoint round-trip:

```js
import { BattleSession } from './js/battle/BattleSession.js';
import { DEFAULT_FORMATION } from './js/content/heroes.js';
import {
  MemoryStorage,
  SaveRepositoryV2,
} from './js/persistence/SaveRepositoryV2.js';

const repository = new SaveRepositoryV2({
  storage: new MemoryStorage(),
  logger: { warn() {} },
});

const original = new BattleSession({
  stageId: 'ancient_ruins',
  formation: DEFAULT_FORMATION,
  seed: 'maintenance-example',
  repository,
});

original.applyNow('auto_place'); // 5명 배치 완료 시 checkpoint 저장
const checkpoint = repository.loadCheckpoint();
const restored = new BattleSession({ checkpoint, repository });

console.log(restored.snapshot().phase); // PREPARATION
original.destroy();
restored.destroy();
```

스키마를 바꿀 때는 [schemas.js](../js/persistence/schemas.js)의 `CHECKPOINT_SCHEMA_VERSION`, validation, repository 백업 동작, 연속성 테스트를 함께 갱신한다. 구버전 필드를 조용히 다른 의미로 재사용하지 않는다.

## 5. BattleSession: 화면이 사용하는 전투 facade

소스: [js/battle/BattleSession.js](../js/battle/BattleSession.js)

```js
new BattleSession({
  stageId,
  difficultyId = 'easy',
  formation,
  seed,
  checkpoint = null,
  repository = null,
})
```

생성자는 상태, `EventBus`, `CommandQueue`, visual event buffer를 만들고 aura를 최초 계산한다.

| API | 입력/반환 | 주의 |
| --- | --- | --- |
| `applyNow(type, payload?)` | 변경 성공 boolean | UI 명령용. 일부 경계에서 checkpoint 저장 후 aura 재계산 |
| `enqueue(type, payload?)` | command | 현재 `state.tick`에 명령 예약 |
| `step(delta = 1/60, { landscape = false }?)` | snapshot | 실행 중 wave에서만 simulation 진행 |
| `snapshot()` | 렌더/UI용 plain object | 정의 객체나 mutable Map을 노출하지 않음 |
| `consumeVisualEvents()` | event 배열 | 읽은 뒤 내부 buffer를 비우는 destructive read |
| `recordRenderDuration(ms)` | 유효하면 boolean | 최근 600개 render 표본 유지 |
| `saveCheckpoint(reason?)` | 저장값 또는 `null` | repository가 있고 승패 상태가 아닐 때만 저장 |
| `destroy()` | 없음 | command, listener, visual buffer 정리; 이후 인스턴스 재사용 금지 |

지원 명령:

| type | payload | 허용 조건 |
| --- | --- | --- |
| `place_hero` | `{ heroId, x, y }` | 준비/웨이브 사이, 합법 셀 |
| `auto_place` | 없음 | 배치 시스템이 5명 배치 |
| `start_wave` | 없음 | 준비/웨이브 사이, 5명 모두 배치 |
| `level_up` | `{ heroId, traitId }` | 준비/웨이브 사이, 결정 보유, Lv4/Lv6은 유효 trait 필수 |
| `set_speed` | `{ speed: 1 | 2 }` | 값 검증 후 설정 |
| `toggle_pause` | 없음 | pause 반전 |

`enqueue()` 명령은 `step()` 시작부에서만 drain된다. `step()`은 전투 wave가 아니거나 pause 상태면 일찍 반환하므로 준비 화면의 즉시 UI 동작에는 `applyNow()`를 사용한다.

Node에서 실행 가능한 headless 예제:

```js
import { BattleSession } from './js/battle/BattleSession.js';
import { DEFAULT_FORMATION } from './js/content/heroes.js';
import { FIXED_TICK_SECONDS } from './js/core/enums.js';

const session = new BattleSession({
  stageId: 'ancient_ruins',
  formation: DEFAULT_FORMATION,
  seed: 'headless-example',
});

const off = session.events.on('wave_completed', (event) => {
  console.log('completed', event.wave, event.reward);
});

try {
  session.applyNow('auto_place');
  session.applyNow('start_wave');
  for (let tick = 0; tick < 600; tick += 1) {
    session.step(FIXED_TICK_SECONDS);
  }
  console.log(session.snapshot());
} finally {
  off();
  session.destroy();
}
```

### 한 step의 절대 순서

`BattleSession.step()`의 순서는 다음과 같다. 새 시스템을 끼울 때는 어느 단계의 결과를 읽어야 하는지 먼저 결정한다.

1. pause/phase guard
2. 현재 tick까지 command drain 및 실행
3. 웨이브 spawn
4. status 시간 감소와 poison tick
5. 적 이동, 코어 도달 및 패배 판정
6. aura 재계산
7. 모든 영웅의 action **생성 및 target lock**
8. 정렬된 action resolve
9. 죽거나 코어에 도달한 적 cleanup
10. 웨이브 완료·보상·승리·checkpoint 처리
11. tick과 elapsedSeconds 증가
12. state event flush, update 시간 기록, snapshot 반환

### 60Hz action ordering

한 tick에서 모든 action을 먼저 생성해 target을 잠근 뒤 하나씩 resolve한다. 앞선 action이 target을 죽여도 뒤 action은 다른 적으로 재탐색하지 않고 잠긴 target에 소비된다.

정렬 키는 반드시 다음 순서다.

```text
tick
  -> hero.slot
  -> actionKind (skill 먼저, basic 나중)
  -> primary target.spawnOrder
  -> target.id
```

범위 impact는 target spawn order 순으로, shotgun damage impact는 target spawn order와 pellet index 순으로 처리한다. skill timer와 basic timer는 독립이며 둘 다 준비되면 같은 tick에 skill과 basic이 모두 생성된다.

아래 변경은 금지한다.

- `state.heroes`나 적 Map의 우연한 순회 순서를 action order로 사용
- action resolve 중 살아 있는 적을 다시 검색해 retarget
- `Math.random()` 또는 wall-clock을 전투 결과에 사용
- 2배속을 큰 `deltaSeconds` 한 번으로 처리
- 렌더러가 전투 상태나 RNG를 변경

회귀 계약은 [action-pipeline.test.mjs](../tests/unit/action-pipeline.test.mjs)를 참고한다.

## 6. EntityRegistry

소스: [js/battle/EntityRegistry.js](../js/battle/EntityRegistry.js)

`new EntityRegistry()`는 인자를 받지 않고 collection, ID sequence, 재사용 pool을 함께 만든다.

collection:

`allies`, `enemies`, `projectiles`, `areaEffects`, `particles`, `damagePopups`

활성 cap은 적 45, projectile 160, area effect 64, particle 250, damage popup 40이다. projectile/effect/particle/popup은 제거 후 제한된 pool로 돌아간다.

| API | 계약 |
| --- | --- |
| `nextId(type)` | type별 증가 ID 생성 |
| `add(type, entity)` | cap/중복 검사 후 registry 소유 객체 반환 |
| `remove(type, id)` | Map에서 제거하고 가능한 종류는 pool 반환; 제거 객체 반환 |
| `get(id)` | 모든 collection에서 첫 일치 객체 |
| `activeEnemyCount()` | dead/reachedCore가 아닌 적 수 |
| `clear()` | collection, sequence, pool 모두 초기화 |
| `poolStats()` | pool/active/cap 통계 |
| `snapshot()` | underscore 필드를 제외한 plain clone |

`add()`는 pool 객체를 재사용할 수 있으므로 반드시 반환값을 canonical entity로 사용한다.

```js
const projectile = state.registry.add('projectiles', {
  x: 1,
  y: 2,
  ttl: 0.25,
});

// projectile.id로 추적
state.registry.remove('projectiles', projectile.id);
```

제거한 객체 참조를 보관하면 이후 다른 entity로 재활용될 수 있다. 현재 영웅 시스템의 canonical 배열은 `state.heroes`, 적의 canonical collection은 `state.enemies`다. UI에서는 registry Map 대신 session snapshot을 사용한다.

## 7. Battle system 모듈 레퍼런스

이 절의 함수는 모두 엔진 내부용이다. 새 화면 코드에서 직접 호출하지 말고 `BattleSession` 명령/step 경계를 통과한다. 순수 계산 unit test나 새 system 조립 테스트에서는 직접 호출할 수 있다.

### CommandSystem

소스: [CommandSystem.js](../js/battle/systems/CommandSystem.js)

- `executeCommand(state, command) -> boolean`: command type을 placement/wave/level/settings 동작으로 분배한다. 알 수 없는 type은 `RangeError`.
- `levelUpHero(state, heroId, traitId = null) -> boolean`: 결정 1개를 소비해 최대 Lv6까지 성장. Lv4/Lv6에서는 해당 영웅·레벨의 trait ID가 필수다.

명령 부수효과 뒤 aura/checkpoint를 처리하는 책임은 `BattleSession.applyNow()`에 있다. 시스템을 직접 호출하면 그 후처리가 자동으로 일어나지 않는다.

### PlacementSystem

소스: [PlacementSystem.js](../js/battle/systems/PlacementSystem.js)

- `stageBlockedCells(stage) -> Set<string>`: path와 obstacle 셀 키.
- `canPlaceHero(state, heroId, x, y) -> boolean`: phase, 정수 좌표, 12×16 범위, 막힌 셀, 영웅 중복을 검증.
- `placeHero(state, heroId, x, y) -> boolean`: 존재하지 않는 편성 영웅은 예외, 불가능한 셀은 false.
- `allHeroesPlaced(state) -> boolean`: 정확히 5명이고 모두 배치되었는지 확인.
- `autoPlaceHeroes(state) -> Array<{ id, x, y }>`: 추천 좌표 우선, 이후 path 가까운 합법 셀을 안정 정렬해 배치.

### WaveSystem

소스: [WaveSystem.js](../js/battle/systems/WaveSystem.js)

- `buildFixedSpawnSequence(entries) -> string[]`: 고정 composition을 결정론적 spawn ID 순서로 변환.
- `startWave(state) -> boolean`: phase/배치 확인, queue와 wave RNG 설정, 영웅 timer/target/direction 초기화, `wave_started` event 생성.
- `updateWaveSpawning(state, deltaSeconds)`: interval과 적 cap을 지키며 spawn.
- `isWaveClear(state) -> boolean`: queue 소진과 active 적 0 확인.
- `completeWave(state) -> boolean`: 결정 보상, 이전 wave 코어 피해 flag, intermission/victory, `wave_completed` event 처리.

spawn 순서와 `spawnOrder`는 targeting/action/RNG 순서의 일부다. 보기 좋게 섞는다는 이유로 랜덤화하지 않는다.

### MovementSystem

소스: [MovementSystem.js](../js/battle/systems/MovementSystem.js)

- `coreDamageMultiplier(state) -> number`: 팀에서 dedupe된 core damage 특성의 곱.
- `damageCore(state, amount = 1) -> number`: 실제 피해 적용, wave flag/event, 내구도 0이면 패배 설정.
- `updateMovement(state, deltaSeconds, landscape = false)`: stun 제외, slow 배율 적용, path 보간, core 도달, 보스 방향 갱신.

`landscape`는 논리 이동 경로를 바꾸지 않고 화면 방향 sprite 판정에만 영향을 준다.

### DirectionSystem

소스: [DirectionSystem.js](../js/battle/systems/DirectionSystem.js)

- `directionFromScreenVector(dx, dy, fallback?)`
- `directionFromLogicalVector(dx, dy, landscape?, fallback?)`
- `updateHeroDirection(hero, target, landscape?)`
- `updateBossDirection(enemy, movementVector, landscape?)`

영웅 기준점은 셀 좌상단이 아니라 `x + 0.5, y + 0.5`다. landscape에서는 논리 벡터를 화면 벡터로 변환한 뒤 front/back/left/right를 고른다. stun 보스는 기존 방향을 유지한다.

### TargetingSystem

소스: [TargetingSystem.js](../js/battle/systems/TargetingSystem.js)

- `distanceSquared(left, right)`
- `getEffectiveRange(state, hero, attackKind = 'basic')`: 기본 range + aura + trait.
- `targetPriority(left, right)`: progress 큰 적 → spawnOrder 작은 적 → ID.
- `spawnOrderPriority(left, right)`: spawnOrder → ID.
- `findTarget(state, hero, attackKind?)`: 사거리 안 primary target.
- `targetsInRadius(state, point, radius)`: 살아 있는 적을 spawn order로 반환.

target tie-break를 변경하면 action lock과 RNG 소비 순서가 바뀐다. comparator를 공유하고 새로 복제하지 않는다.

### ActionSystem

소스: [ActionSystem.js](../js/battle/systems/ActionSystem.js)

- `actionPriority(left, right)`: tick → slot → skill/basic → target spawn order → ID.
- `createBattleActions(state, deltaSeconds, { landscape }?) -> action[]`: slot 정렬 영웅에서 skill/basic action을 만들고 전체 정렬.
- `resolveBattleActions(state, actions) -> number`: 정렬된 action을 kind별 resolver로 전달.
- `BATTLE_ACTION_KIND_PRIORITY`: `{ skill: 0, basic: 1 }`.

새 action kind를 추가하려면 comparator priority, 생성 시점, resolver, event contract, 회귀 테스트를 한 번에 추가한다. unknown kind는 예외여야 하며 조용히 무시하지 않는다.

### BasicAttackSystem

소스: [BasicAttackSystem.js](../js/battle/systems/BasicAttackSystem.js)

- `getAttackInterval(state, hero)`: 기본 interval × aura × trait.
- `resolveShotgunHits(source, target, enemies, { includeMisses = false, ...options }?)`: pellet별 가장 가까운 충돌을 계산. 기본 반환에는 적중 pellet만 포함되고, `includeMisses: true`일 때 target이 없는 miss descriptor도 포함.
- `createBasicAttackAction(state, hero, delta, landscape?)`: timer 감소, target/impact/pellet lock, 통계와 다음 timer 설정.
- `resolveBasicAttackAction(state, action)`: 잠긴 impact에 피해·상태·visual event 적용.
- `updateBasicAttackForHero(...)`: create+resolve 편의 함수. 전체 전투 pipeline에서는 사용하지 말고 ActionSystem을 사용.
- `applyOnHitStatuses(...)`: skill과 공유하는 after-hit 상태 적용 함수.

shotgun은 pellet마다 독립 target, critical roll, status roll을 가진다. visual trail event와 damage event가 분리되고 damage event는 중복 이펙트를 막기 위해 `suppressEffect`를 쓸 수 있다.

### SkillSystem

소스: [SkillSystem.js](../js/battle/systems/SkillSystem.js)

- `getSkillCooldown(state, hero)`: 기본 cooldown × aura × trait.
- `createSkillAction(state, hero, delta, landscape?)`: 독립 skill timer 감소, target/area impacts lock.
- `resolveSkillAction(state, action)`: 잠긴 target에 직접 피해와 on-hit 상태 적용.
- `updateSkillForHero(...)`: create+resolve 편의 함수. 전체 pipeline에서는 ActionSystem 사용.

skill 준비 시 basic timer를 소비하거나 재설정하지 않는다.

### DamageSystem

소스: [DamageSystem.js](../js/battle/systems/DamageSystem.js)

- `getMatchupMultiplier(attackType, defenseType)`: 누락 matchup은 예외.
- `calculateDirectDamage(options) -> result`: HP·event는 바꾸지 않지만 critical RNG stream은 소비하는 직접 피해 계산.
- `applyDirectDamage(options) -> result`: HP·영웅 통계·사망·hit/critical/advantage event 반영.
- `applyPoisonDamage(state, target, amount) -> number`: direct damage 공식을 거치지 않는 poison tick.
- `directDamageStatusSnapshot(target)`: corrosion/curse/darkness 활성 상태 요약.

direct damage 계산 순서:

```text
base
* level
* attack/defense matchup
* (1 + aura bonus)
* (1 + status taken bonus)
* trait multiplier
* critical multiplier
```

poison은 direct damage가 아니므로 direct 전용 특성·상성·critical을 적용하지 않는다.

### StatusSystem

소스: [StatusSystem.js](../js/battle/systems/StatusSystem.js)

- `hasStatus(target, statusId)`
- `applyStatus(target, statusId, options?) -> boolean`
- `movementSpeedMultiplier(target)`
- `isStunned(target)`
- `updateStatuses(state, deltaSeconds, applyPoisonDamage)`

poison은 최대 stack까지 누적하고 재적용 시 남은 tick cadence는 유지한다. stun 종료 시 stun immunity를 자동 부여하며, immunity 중 stun 적용은 false다. 상태 정의를 추가하면 [content/statuses.js](../js/content/statuses.js), validation, damage/movement 소비 지점도 확인한다.

### AuraSystem

소스: [AuraSystem.js](../js/battle/systems/AuraSystem.js)

- `increaseAuraRange(range, steps = 1)`: 선언된 tier만 허용하고 최대 tier에서 clamp.
- `recomputeAuras(state)`: 매번 hero buff Map을 비운 뒤 선택 trait의 aura를 거리 기준 재구성.
- `buffEffects(hero, effectType)`: 현재 buff들의 해당 effect 목록.

aura는 캐시를 증분 수정하지 않고 source of truth에서 재계산한다. 이동·배치·레벨업 후 세션이 재계산하도록 두고 화면이 buff Map을 직접 수정하지 않는다.

### TraitSystem

소스: [TraitSystem.js](../js/battle/systems/TraitSystem.js)

- `collectHeroTraitModifiers(state, hero, hook, context?)`: 한 영웅 선택 특성을 accumulator로 평가.
- `collectUniqueTeamTraitEffects(state, hook)`: `dedupeKey ?? trait.id` 기준 팀 효과 중복 제거.
- `hasSelectedTrait(hero, traitId)`: 선택 정의에 trait ID가 있는지 확인.

팀 효과는 배치된 영웅만 제공한다. Rabbit Hole, core damage 감소처럼 팀 전체에서 한 번만 적용할 효과는 안정적인 `dedupeKey`를 콘텐츠에 둔다.

### CleanupSystem

소스: [CleanupSystem.js](../js/battle/systems/CleanupSystem.js)

- `cleanupEntities(state) -> removedIds`: dead 또는 reachedCore 적을 registry에서 제거.

cleanup은 모든 action resolve 뒤에 실행된다. action 생성 전에 제거하거나 action 사이에 제거하면 이미 잠근 target에 대한 동작과 event 순서가 달라진다.

## 8. 특성 DSL: ConditionRegistry, OperationRegistry, TraitCompiler

소스:

- [ConditionRegistry.js](../js/battle/effects/ConditionRegistry.js)
- [OperationRegistry.js](../js/battle/effects/OperationRegistry.js)
- [TraitCompiler.js](../js/battle/effects/TraitCompiler.js)
- 선언/검증 ID: [content/effects.js](../js/content/effects.js)

### ConditionRegistry

`evaluateCondition(condition, context)`은 `condition.type`으로 evaluator를 찾고 boolean을 반환한다. 미등록 type은 `RangeError`다. `evaluateConditions()`는 모든 조건이 true인지 평가한다.

현재 실행 registry key:

- `target_element`
- `target_defense_type`
- `target_has_status`
- `target_has_any_debuff`
- `source_has_buff`
- `source_has_no_named_buff`
- `core_below_ratio`
- `is_boss`
- `attack_kind`
- `core_damaged_previous_wave`
- `source_has_tag`

`countActiveDebuffs(target)`는 active, non-internal, debuff 상태의 고유 ID 수를 센다.

### OperationRegistry

`createModifierAccumulator()`가 기본값을 만들고, `applyOperation(effect, accumulator, context)`가 같은 accumulator를 수정해 반환한다. 미등록 type은 `RangeError`다.

현재 실행 registry key:

- `multiply_damage`
- `multiply_damage_by_debuff_count`
- `add_crit_chance`
- `add_range`
- `multiply_skill_cooldown`
- `multiply_attack_interval`
- `apply_status`
- `provide_aura`
- `increase_aura_range_tier`
- `floor_matchup_multiplier`
- `multiply_core_damage`
- `random_damage_multiplier`
- `set_next_wave_flag`

operation은 accumulator를 만들 뿐 실제 전투 상태를 자동으로 모두 적용하지 않는다. 각 consumer가 필요한 필드를 읽어야 한다.

### TraitCompiler

- `selectedTraitDefinitions(hero)`: `selectedTraits`의 ID와 일치하는 정의만 반환.
- `compileTraits(hero)`: `{ id, hooks, conditions, effects }` 배열로 compile.
- `evaluateTraitHook(hero, hook, context, accumulator?)`: 조건을 먼저 평가하고 해당 hook effect를 순서대로 accumulator에 적용.

effect에 명시적 `hook`이 없으면 type으로 추론한다.

| effect | 추론 hook |
| --- | --- |
| `provide_aura` | `provide_aura` |
| `increase_aura_range_tier`, `add_team_crit_chance` | `team_modifier` |
| `multiply_core_damage` | `core_damage` |
| `apply_status` | `after_hit` |
| `add_range`, `multiply_skill_cooldown`, `multiply_attack_interval` | `stat_modifier` |
| 그 외 | `before_damage` |

### 특성 추가 예제

기존 DSL 조합으로 표현할 수 있으면 registry 코드는 수정하지 않는다.

```js
{
  id: 'example_slow_hunter',
  level: 4,
  name: '슬로우 헌터',
  conditions: [
    { type: 'target_has_status', statusId: 'slow' },
  ],
  effects: [
    { type: 'multiply_damage', value: 1.5 },
  ],
}
```

금지:

```js
// 금지: 캐릭터가 늘 때마다 전투 시스템에 분기가 퍼진다.
if (hero.id === 'example_hero') {
  damage *= 1.5;
}
```

새 condition/operation이 정말 필요하면 아래를 모두 변경한다.

1. [content/effects.js](../js/content/effects.js)의 allowlist 선언
2. ConditionRegistry 또는 OperationRegistry의 실행 함수
3. [validateContent.js](../js/content/validateContent.js)의 필드·범위·참조 검증
4. 영웅 콘텐츠의 condition/effect 데이터
5. [traits.test.mjs](../tests/unit/traits.test.mjs)의 registry/compile 단위 테스트
6. [trait-matrix-runtime.test.mjs](../tests/integration/trait-matrix-runtime.test.mjs)와 필요한 상호작용 회귀 테스트

### 현재 계약의 주의점

선언 allowlist와 실행 registry가 완전히 같은 집합은 아니다.

- `always`는 condition allowlist에 있지만 현재 ConditionRegistry에는 없다.
- `source_has_tag`는 ConditionRegistry에는 있지만 allowlist에는 없다.
- `multiply_attack_interval`은 OperationRegistry에는 있지만 operation allowlist에는 없다.
- `add_team_crit_chance`는 allowlist에는 있지만 일반 OperationRegistry가 아니라 `collectUniqueTeamTraitEffects()`에서 특수 처리한다.
- `set_next_wave_flag`는 accumulator에 값을 넣지만 현재 그 배열을 state에 반영하는 consumer가 없다.
- `random_damage_multiplier.weights`는 validation되지만 현재 runtime 선택은 `choices` 균등 추첨이다. 서로 다른 weight 동작을 약속하면 안 된다.
- 선언된 hook 이름 일부와 runtime 호출 이름(`stat_modifier`, `team_modifier`, `core_damage`)이 다르다. 현재 영웅 데이터처럼 hook 추론을 쓰고, 명시적 `hooks`를 추가하려면 선언·compiler·호출부를 먼저 하나의 계약으로 맞춘다.

따라서 “목록에 이름이 있다”만으로 새 콘텐츠에서 사용할 수 있다고 판단하지 않는다. 실행 registry, validator, 실제 consumer, 테스트 네 곳이 모두 연결됐는지 확인한다. 이 불일치를 정리할 때도 기존 특성 결과와 RNG draw 수를 바꾸지 않도록 별도 변경으로 다룬다.

## 9. 수정 유형별 안전한 절차

### 전투 수치만 바꿀 때

1. [content/combat.js](../js/content/combat.js), 영웅/적/스테이지 정의 중 source of truth를 수정한다.
2. 시스템에 ID 분기를 추가하지 않는다.
3. 해당 수치의 unit test와 전체 simulation을 실행한다.

### 새 전투 시스템을 추가할 때

1. 입력과 출력 state 필드, event를 먼저 정의한다.
2. 60Hz step의 어느 단계에 들어갈지 정한다.
3. iteration은 slot/spawnOrder/ID comparator로 안정 정렬한다.
4. RNG는 `state.waveRng ?? state.rng` 또는 명시적 fork를 사용하고 draw 수를 테스트한다.
5. renderer는 snapshot/event만 읽게 한다.
6. checkpoint에 필요한 영속 상태인지 검토한다.

### 새 command를 추가할 때

1. CommandSystem에서 payload validation과 phase 규칙을 구현한다.
2. BattleSession의 checkpoint/aura 후처리 필요 여부를 명시한다.
3. UI는 새 command를 `applyNow()` 또는 `enqueue()`로 호출한다.
4. invalid payload, invalid phase, deterministic order를 테스트한다.

### checkpoint 필드를 추가할 때

1. state → checkpoint 변환과 restore 양쪽을 함께 수정한다.
2. schema version과 validator, backup/migration 정책을 정한다.
3. JSON round-trip 후 다음 wave 결과를 uninterrupted session과 비교한다.
4. 저장 경계를 mid-wave로 넓히려면 적·timer·spawn·wave RNG·elapsed 등 누락 필드를 모두 설계한다. 일부만 저장하지 않는다.

## 10. 완료 전 확인표

- 화면이 `session.state`를 직접 mutate하지 않는가?
- 시스템에 hero/enemy ID별 분기가 생기지 않았는가?
- 60Hz step 순서와 action comparator가 유지되는가?
- Map/Set 순회 결과를 명시적 정렬 없이 RNG나 피해 순서에 쓰지 않는가?
- skill/basic timer가 독립인가?
- checkpoint가 지원 wave 경계에서만 의미 있게 저장되는가?
- destroy 시 loop, listener, observer, timer, audio 자원이 정리되는가?
- 새 DSL type이 선언·실행·검증·consumer·테스트까지 연결됐는가?
- 변경된 동작의 focused test와 저장소 루트의 `npm run verify`가 통과하는가?
