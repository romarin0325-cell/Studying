# Hero Core Defense V2 유지보수 Wiki

이 문서는 `defense_hero_v2/`를 처음 수정하는 사람이 안전하게 구조를 파악하고, 변경 종류에 맞는 검증까지 끝낼 수 있도록 만든 시작점이다. V2는 기존 [`defense_hero/`](../../defense_hero/)와 저장 키, 런타임, 빌드 스크립트를 공유하지 않는 독립 앱이다. V2 작업 때문에 V1 파일이나 V1 저장 데이터를 변경하면 안 된다.

## 어디서 시작할까

| 하려는 일 | 먼저 읽을 문서 | 주로 수정할 위치 |
| --- | --- | --- |
| 화면 전환, 전투 루프, 시스템 또는 클래스를 수정 | [런타임·클래스 API](./RUNTIME_API.md) | [`js/app/`](../js/app/), [`js/battle/`](../js/battle/), [`js/core/`](../js/core/) |
| 영웅, 특성, 적, 웨이브, 밸런스를 수정 | [콘텐츠 제작·수정 가이드](./CONTENT_AUTHORING.md) | [`js/content/`](../js/content/) |
| 전체 의존 관계와 틱 순서를 파악 | [아키텍처](./ARCHITECTURE.md) | 런타임 전체 |
| CSS, 캔버스, 방향 스프라이트, 모바일 또는 배포를 수정 | [UI·렌더링·배포](./UI_RENDERING_AND_RELEASE.md) | [`css/`](../css/), [`js/render/`](../js/render/), [`index.html`](../index.html) |
| 체크포인트와 설정을 수정 | [런타임·클래스 API의 BattleState](./RUNTIME_API.md#4-battlestate와-체크포인트) | [`js/persistence/`](../js/persistence/), [`js/battle/BattleState.js`](../js/battle/BattleState.js) |
| 에셋을 교체하거나 추가 | [콘텐츠 가이드의 66개 에셋 계약](./CONTENT_AUTHORING.md#10-66개-출시-에셋-계약) | [`assets/`](../assets/), [`js/content/assets.js`](../js/content/assets.js) |

## 가장 중요한 경계

1. UI는 전투 상태를 직접 바꾸지 않고 [`BattleSession.applyNow()` 또는 `enqueue()`](../js/battle/BattleSession.js)를 통해 command만 전달한다.
2. 렌더러는 snapshot과 display event를 읽기만 한다. 피해량 계산이나 HP 변경을 렌더링 코드에 넣지 않는다.
3. 영웅별 차이는 콘텐츠의 trait 조건·효과로 표현한다. 전투 시스템에서 `hero.id`로 분기하지 않는다.
4. 모든 게임 진행은 60Hz 고정 틱과 [`SeededRng`](../js/core/SeededRng.js)를 사용한다. `Math.random()`과 프레임 시간 기반 전투 로직은 금지된다.
5. 체크포인트는 웨이브 경계 상태만 저장한다. 진행 중 적, 투사체, 일시 효과를 저장 형식에 임의로 추가하지 않는다.
6. 세 화면 방향이 아니라 두 레이아웃이 있다. 논리 보드는 항상 12×16이고, landscape에서는 표시 좌표만 회전한다.
7. 완성 기준은 저장소 루트의 `npm run verify` 통과다.

## 로컬에서 10분 안에 확인하기

저장소 루트에서 실행한다.

```powershell
npm run serve:defense-hero-v2
```

브라우저에서 `http://127.0.0.1:4174/`를 연다. 원본은 ES module이므로 `defense_hero_v2/index.html`을 `file://`로 직접 열지 않는다. 파일 하나로 실행해야 할 때는 다음 명령으로 오프라인 배포본을 만든다.

```powershell
npm run build:defense-hero-v2-local
```

생성물은 [`dist-local/HeroCoreDefenseV2.html`](../dist-local/HeroCoreDefenseV2.html)이다. 이 파일은 생성물이므로 직접 수정하지 않는다.

## 변경 순서

1. 이 Wiki에서 변경 영역의 계약을 확인한다.
2. 데이터 변경이면 validator와 소비 시스템을 함께 확인하고, 런타임 변경이면 시스템 입력·출력과 틱 순서를 확인한다.
3. 가장 가까운 unit 또는 integration test에 회귀 사례를 먼저 추가하거나 함께 수정한다.
4. 아래의 좁은 검증부터 실행한다.
5. 모바일/UI 변경은 실제 브라우저 검증까지 실행한다.
6. 마지막에 저장소 루트의 전체 검증을 실행한다.

```powershell
npm run lint:defense-hero-v2
npm run test:defense-hero-v2
npm run test:defense-hero-v2:local
npm run test:defense-hero-v2:browser
npm run verify
```

`test:defense-hero-v2`에는 모든 60개 편성×2개 스테이지의 실제 60Hz 시뮬레이션이 포함되어 있어 다른 명령보다 오래 걸릴 수 있다.

## 디렉터리 지도

```text
defense_hero_v2/
├─ assets/                 출시 이미지와 생성 원본 atlas
├─ css/                    토큰, 앱 shell, 전투 반응형 레이아웃
├─ docs/                   이 유지보수 Wiki
├─ js/
│  ├─ app/                 화면 전환과 DOM 수명주기
│  ├─ battle/              상태, session, registry, 전투 systems
│  ├─ content/             영웅·적·웨이브·효과·에셋 선언
│  ├─ core/                고정 틱, RNG, event, command queue
│  ├─ persistence/         V2 설정·체크포인트 저장과 schema
│  └─ render/              viewport, sprite, canvas, visual effects
├─ tests/                  unit 및 integration acceptance tests
├─ dist-local/             생성된 단일 HTML 배포본
├─ index.html              HTTP 개발 진입점
└─ README.md               실행 방법과 프로젝트 요약
```

저장소 루트의 `scripts/*hero_defense_v2*`는 정적 검사, 로컬 서버, 오프라인 빌드, 브라우저 acceptance 검증을 담당한다. V1용 스크립트와 이름이 비슷하므로 대상을 확인한 뒤 수정한다.

## 수정 유형별 최소 검증

| 변경 | 최소 검증 | 추가 확인 |
| --- | --- | --- |
| 콘텐츠 값, trait, status | `npm run lint:defense-hero-v2`, 관련 unit/integration test | 밸런스 영향이면 전체 V2 test |
| BattleSession 또는 system | 전체 `npm run test:defense-hero-v2` | 결정론·체크포인트 연속성 |
| CSS, screen, viewport, renderer | unit/integration + `npm run test:defense-hero-v2:browser` | 6개 필수 viewport와 회전 |
| 에셋 manifest 또는 이미지 | lint + local bundle + browser | 66개 파일, 방향, pivot, 투명 배경 |
| 저장 schema | persistence + checkpoint continuity | 이전 primary/backup 및 storage 차단 |
| 빌드/배포 스크립트 | local bundle + browser | HTTP 원본과 `file://` 단일 파일 모두 |

## 완료 정의

- 변경한 계약을 설명하는 테스트가 있다.
- `git diff --check`가 통과한다.
- `npm run verify`가 통과한다.
- V1 `defense_hero/`에 의도하지 않은 변경이 없다.
- UI 변경이면 360×800, 390×844, 800×360, 844×390, 768×1024, 1366×768에서 실제 동작을 확인했다.
- 에셋 변경이면 개발 fallback만 믿지 않고 release-required 파일과 오프라인 embedding을 확인했다.
- 새 제약이나 알려진 한계가 생겼으면 이 Wiki도 함께 갱신했다.

## 빠른 문제 해결

- 원본 HTML을 더블 클릭했는데 실행되지 않음: 원본은 ES module이다. 개발 서버를 사용하거나 단일 HTML을 빌드한다.
- 이어하기가 보이지 않음: 브라우저 저장소가 차단되었는지 상단 경고와 `SaveRepositoryV2.isPersistent`를 확인한다.
- portrait에서는 맞는데 landscape 클릭 위치가 어긋남: DOM 좌표를 직접 보드 좌표로 계산하지 말고 [`ViewportLayout.clientToLogical()`](../js/render/ViewportLayout.js)을 사용한다.
- 새 영웅이 보이지만 공격하지 않음: content ID를 battle system에 하드코딩하지 말고 trait registry 지원 범위, formation, asset, validator를 함께 확인한다.
- 개발에서는 이미지가 보이지만 빌드가 실패함: 개발은 front/token fallback을 허용하지만 release build는 66개 물리 파일을 모두 요구한다.
- 결과 화면 직전에 저장을 닫았더니 재개 상태가 남음: 체크포인트 삭제는 전투 종료 경로의 책임이다. [`BattleSession`](../js/battle/BattleSession.js)과 [`GameApp`](../js/app/GameApp.js)의 종료 순서를 함께 확인한다.
