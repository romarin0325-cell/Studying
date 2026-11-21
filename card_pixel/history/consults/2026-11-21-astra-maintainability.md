`claude/relaymare-v1`의 `403f181` 기준, `src/`는 73파일 13,326줄이고 `tests/`는 9파일 8,799줄입니다. 오늘 순증은 각각 5,402줄과 6,520줄입니다.  
**첫 정리 대상은 테스트입니다.** 오늘 늘어난 테스트의 75%가 `screens.mjs`와 `run.test.mjs` 두 파일에 몰렸습니다.  
**제품 코드에서는 보유 6명 한도와 계약 예치금의 중복 계산이 우선입니다.** 이번에는 소스와 Git 기록만 읽었습니다. 파일 수정, 빌드, 브라우저 실행, 시뮬레이션은 하지 않았습니다.

### 점검 결과

경로는 `card_pixel/game/` 기준이며 소스 경로의 `src/`는 생략했습니다. 줄 수에는 빈 줄과 주석을 포함합니다.

| 파일과 줄 수 | 책임과 발견 사항 |
|---|---|
| [tests/screens.mjs](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/tests/screens.mjs:2552>) **2,862** · [tests/run.test.mjs](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/tests/run.test.mjs:1244>) **2,581** | 전자는 게임 상태 생성, 화면 사례 72개, Chrome 조작, 캡처 합성, CLI를 모두 맡습니다. 후자는 원정·사건·메타·저장 복구를 한 파일에서 검증합니다. 두 파일과 `screens-map.mjs`가 카드 코어 VM과 스프라이트 명단을 같은 방식으로 만듭니다. |
| [engine/run.js](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/run.js:275>) **804** · `engine/rooms.js` **402** | `run.js`에 생성·편성·전투 미리보기·정산·계약·샘 결제가 모였습니다. 특히 `getSpringOffer`는 이름만 보면 조회처럼 보이지만 후보 키와 발견 기록을 씁니다. `rooms.js`도 문 생성부터 사건 선택지 계산과 실제 지급까지 맡습니다. |
| [engine/bridge.js](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/bridge.js:235>) **1,235** · `ui/battle/view.js` **773** | `bridge.create()` 하나가 1,001줄입니다. 코어 훅, 행동 예고, 전투 실행, 상태 차이의 이벤트 변환, 정산 요약이 같은 상태를 공유합니다. 화면 쪽도 배치·입력·이벤트 재생·승패 연출이 한 클로저에 있습니다. |
| [ui/nav.js](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/nav.js:192>) **563** · [ui/run/index.js](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/run/index.js:210>) **246** | `nav.js`가 본편·균열 전환, 영입, 저장 실패 재시도, 백업·복구까지 맡습니다. README의 “원정 상태는 엔진 명령만 바꾼다”에는 예외가 있습니다. 원정 UI가 `lastBattleLog`, `lastBattleRelic`, `lastBattleRelics`를 직접 기록하고 저장합니다. |
| [engine/save.js](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/save.js:4>) **326** · [engine/daily-store.js](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/daily-store.js:7>) **262** | 실제 순환 import가 있습니다. 본편 백업 검사는 균열 저장소를 가져오고, 균열 저장소는 원정 직렬화·복원을 위해 다시 `save.js`를 가져옵니다. |
| **엔진·화면 중복** | 교체 인원 산식은 `awakenings.validateReplacements`, `rooms.addEventChoiceDetails`, `widgets.replacementCount`에 있습니다. 사건의 합류 인원 합산도 `rooms.js` 두 곳과 `screens/event.js`에 반복됩니다. 4층 문지기 계약금은 지도 안에서 두 번 계산하고 승리 정산에서 다시 판정합니다. [교체 검증](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/awakenings.js:37>) · [사건 화면](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/screens/event.js:89>) · [지도 예치금](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/screens/map.js:76>) |
| **죽은 코드와 문서 차이** | `battle/view.js`의 `$$`, `ui/run/index.js`의 `show`는 미사용 import입니다. `widgets.DOOR`는 게임 안에서 선언만 발견됐습니다. 현 번들에서는 `Run.enterBattleDoor`가 항상 있어 `enterFormation`의 이전 API 분기도 도달하지 않습니다. README에는 화면 사례가 **13개**로 적혀 있고, 모듈 지도에서 **JS 15개와 `map.css`**가 빠졌습니다. 유물 설명도 UI가 14종의 문구를 따로 갖고 있습니다. [이전 API 분기](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/run/index.js:112>) · [README](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/README.md:25>) · [유물 문구](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/relics.js:5>) |

<details>
<summary>전체 82개 파일의 줄 수와 담당 영역</summary>

`†`는 README 모듈 지도에서 빠진 항목입니다. 아래 소스 파일은 `.js`, 스타일은 `.css`, 테스트는 `.mjs`입니다.

| 경로·담당 | 파일별 줄 수 |
|---|---|
| 기동·음악·무대 | `main` 115 부팅·검토 훅 · `audio/music` 654 악보·재생 · `stage/stage` 493 캔버스·시계 · `stage/audio` 65 효과음 · `stage/walking-map` 182† 지도 이동 |
| `content/` 규칙·원본 자료 | `affixes` 8 · `boss-lessons` 78† · `bosses` 16 · `contracts` 19† · `daily-rift` 8† · `dungeons` 68 · `events` 412 · `intro` 10 · `layouts` 26 · `missions` 6† · `notebook` 19 · `quirks` 11 · `regions` 13 · `relics` 16 · `tempo` 55† · `wild` 13 |
| `engine/` 판정·저장 | `awakenings` 92 깨우기·합류 · `bridge` 1,235 전투 · `daily-rift` 174† 균열 생성·채점 · `daily-store` 262† 균열 기록 · `dates` 12† 날짜 · `meta` 374 프로필·해금·임무 · `opening` 13† 첫 선택 예고 · `rng` 26 난수 · `rooms` 402 문·사건·유물 · `roster` 107 명단·적 생성 · `run` 804 원정 · `save` 326 복원·백업 |
| `ui/` 공용·전환 | `assets` 12 · `dom` 15 · `nav` 563 · `relics` 66† 유물 표시 · `reveal` 57 소환 공개 · `settings` 253 · `sheet` 55 · `storage` 62 저장 슬롯 · `widgets` 166 · `run/index` 246 원정 라우팅 |
| `ui/battle/` 전투 표시 | `fields` 71† 필드 설명 · `hud` 186 상태·예고 · `log` 149† 턴별 기록 · `moves` 175 동작 · `sheets` 181 상세 · `tiles` 283 명령 · `view` 773 재생·결과 |
| `ui/screens/` 장면별 화면·입력 | `altar` 56 · `awaken` 106 · `collection` 140 · `daily-rift` 172† · `dungeons` 233 · `ending` 31 · `event` 186 · `gate-pick` 55 · `hub` 80 · `map` 391 · `notebook` 87 · `order` 199 · `records` 80 · `recruit` 113 · `reinforce` 76† · `spring` 130 · `title` 22 · `treasure` 85 |
| `styles/` 화면별 스타일 | `base` 123 · `battle` 249 · `map` 219† · `meta` 723 · `screens` 343 |
| `tests/` Node 검증 | `bridge.test` 1,073줄·56개 · `daily.test` 454줄·12개 · `music.test` 468줄·11개 · `rules.test` 221줄·13개 · `run.test` 2,581줄·249개. 하위 사례 포함 **341개** |
| `tests/` 브라우저 검증 | `screens` 2,862줄·72개 · `screens-map` 314줄·7개 · `play` 600줄 원정·이어하기 · `perf` 226줄 저사양 측정 |

</details>

### 동작 보존 정리 순서

| 순위 | 정확한 이동과 공개 이름 유지 방법 | 위험과 기존 검증 |
|---|---|---|
| 1 | `tests/support/core.mjs`에 `createCoreRoster()`를 추출해 세 테스트 파일이 각각 새 VM을 생성하게 합니다. `tests/screens/rift.mjs`로 `riftLocked`부터 `riftRecords`까지, `tests/run/tempo-events.mjs`로 `testTempoEvent`와 12개 사건 등록을 옮깁니다. 기존 두 진입 파일에서 원래 순서로 등록하고 README의 지도·사례 수도 바로잡습니다. | **낮음.** VM 공유, 사례 누락·중복, 캡처 순서가 위험입니다. Node 341개, 화면 72개의 이름·순서·`--case`·PNG 이름과 지도 7개를 대조합니다. `--validate-only`는 화면 상태 준비까지만 확인합니다. |
| 2 | `replacementCount`를 기존 `engine/awakenings.js`로 옮기고 `widgets.js`에서 동명 재수출합니다. `rooms.js`의 합류 인원 합산을 `joinCount(ops)`로 추출해 사건 화면과 공유합니다. `content/contracts.js`의 `gateEscrow(floor, type)`을 지도 두 곳과 정산에서 사용합니다. | **낮음~중간.** `usesTempo`·`lessonVersion` 적용 조건, 지도 예고와 실제 승리 시 차감 시점을 보존합니다. `run.test`의 6명 교체·계약 1회 정산, 화면 `event-values`·`reinforcement-board`·`contract-payout`이 대응합니다. |
| 3 | `ui/nav/daily.js`로 `dailyHost`와 `showDailyHistory`부터 `finishDaily`까지 옮깁니다. `createNavigation`이 현재 프로필 조회와 화면 전환을 넘기고, 기존 `run`·`review` getter를 계속 제공합니다. | **중간.** 저장 실패 뒤 `unsavedDailyResult`가 재시도·백업까지 살아 있어야 합니다. `daily.test`, 화면 `rift-yesterday`·`rift-save-failure`·`save-import`로 확인합니다. |
| 4 | `engine/run-battle.js`로 `battleStart`부터 `optionsForDoor`까지의 전투 옵션·미리보기 함수와 `enemyAttackScale`을 옮깁니다. `run.js`의 `doorStart`, `doorEnemies`, `getTempoView`, `getBlessingView`, `battleOptions`는 기존 인수로 호출되며 같은 `WeakMap`의 코어·명단을 전달합니다. | **중간.** 시드, 빈 편성 자리, 필드 순서, 축복 미리보기와 실전의 일치가 기준입니다. `run.test`의 읽기 전용 예고·축복 실효값, 화면 `blessing-parity`·`door-hp`, `screens-map`의 `formation-preview`가 대응합니다. |
| 5 | `engine/run-codec.js`로 `RUN_VERSION`, `runData`, `serializeRun`, `restoreRun`, `validDoor`와 필요한 읽기 보조 함수를 옮깁니다. `daily-store.js`가 직접 가져오고 `save.js`는 기존 공개 이름을 재수출해 순환을 끊습니다. | **중간.** 전투 중 저장을 편성으로 복원하는 처리와 구버전 기본값이 핵심입니다. `run.test`의 왕복·백업 복구, `daily.test`의 체크포인트, 화면 `damaged-rift-recovery`·`malformed-profile-import`로 확인합니다. |
| 6 | `engine/battle-events.js`로 `unitSnap`, `snapshot`, `describeCause`, `noteLog`를 옮깁니다. `bridge.js`가 현재 전투와 이벤트 기록 함수를 전달하고 `create()`, `scheduleTimer`, `battle.state()`는 기존 경로로 제공합니다. | **중간.** 스냅숏을 뜨는 순간과 이벤트 순서가 화면에 그대로 드러납니다. `bridge.test`의 시작 이벤트·HP 차이·동일 시드 재생, `rules.test`, 화면 `battle-log`·`last-hit`가 대응합니다. |

**수치 보존 기준.** 엔진을 옮긴 단계에서는 `403f181`과 같은 시드·난이도·템포·옵션으로 `tools/sim.mjs`의 출력 수치를 대조합니다. 홍련 시드 `6115841`의 문·편성·보상은 `--entry-audit`와 `play.mjs --entry-count`에 고정돼 있습니다. 11월 21일부터 균열 60일의 기존 기대값은 서투름 **33승·2,040턴**, 신중 **37승·2,229턴**입니다. 브라우저 흐름은 `play.mjs --seeds=7,21 --runs=2`가 선빌드와 본편 이어하기까지 확인합니다. [고정 원정](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/tests/play.mjs:16>) · [균열 기대값](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/tests/daily.test.mjs:437>)

**보류할 정리**

| 보류 대상 | 이유 |
|---|---|
| `card/game` 수정, `bridge.create()` 전면 재작성·비동기화 | `active`, 코어별 훅, `Math.random` 복원, 타이머 처리 순서가 같은 시드의 예고와 실제 행동을 결정합니다. |
| 구버전 분기·공개 훅 일괄 삭제 | 선결제된 샘, 계약 v1, 빈 편성 자리는 실제 복원 대상입니다. `window.__game`·`__slice`와 `Run` 공개 이름은 브라우저 검토 진입점입니다. |
| 테스트 진행 도우미·기대값 일괄 통합 | `screens.mjs`는 기본 템포 1과 앞 세 명을 쓰고, `screens-map.mjs`는 현행 템포와 `defaultParty`를 씁니다. 준비 경로까지 합치면 두 테스트가 서로 다른 동작을 검사하는 성질을 잃습니다. |
| 줄 수만 보고 음악·사건 자료 재배열 | 음악 미리듣기는 모듈 본문 일치를 검사합니다. 사건 배열 순서는 시드 추첨 결과에 영향을 줍니다. |