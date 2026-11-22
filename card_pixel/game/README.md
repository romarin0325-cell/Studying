# 다음은 너 (RELAYMARE)

[dist/Relaymare.html](dist/Relaymare.html)을 브라우저로 연다. 규칙·그림·소리·Galmuri 글꼴을 담은 단일 HTML이라 오프라인에서도 실행된다.

1. 첫 실행에서 제목을 누르면 새벽의 숲 대여 전투가 시작된다. 적의 다음 행동을 읽고, 애쉬를 물러나게 하거나 쓰러진 뒤의 유품을 써 본다.
2. 살아남은 동료를 깨우고, 문과 출전 순서를 고른다. 원정에서 쓰러진 동료는 그 원정의 풀에서 빠진다. 방 사이 선택은 브라우저에 저장되며 전투 중 닫으면 그 방의 편성부터 다시 시작한다.
3. 클리어하면 문지기나 보스전에 출전하고 생환한 동료를 영입한다. 관측소에서 대표와 다음 행선지를 고른다. 본편은 꿈결과 여정으로 시작하고, 각 던전의 여정 첫 클리어 뒤 악몽이 열린다. 창조의 탑을 깨면 엔딩을 본다.

새 원정의 시드를 고정하려면 URL에 `?seed=7`을 붙인다. 브라우저 검토 훅 `window.__game`과 `window.__slice`는 같은 객체다.

## 빌드와 확인

저장소 루트에서 실행한다.

```sh
node card_pixel/game/build.mjs
node --test card_pixel/game/tests/bridge.test.mjs card_pixel/game/tests/rules.test.mjs card_pixel/game/tests/run.test.mjs card_pixel/game/tests/music.test.mjs card_pixel/game/tests/daily.test.mjs card_pixel/game/tests/assets.test.mjs card_pixel/game/tests/rulebook.test.mjs card_pixel/game/tests/effect-plan.test.mjs
node card_pixel/game/tests/play.mjs --seeds=7,21 --runs=2
node card_pixel/game/tests/play.mjs --no-build --intro-only --tutorial=both
```

- 빌드는 esbuild로 `src/main.js`와 모듈을 묶어 `dist/Relaymare.html`을 만든다.
- Node 테스트 384개(하위 사례 포함)는 진입 파일 8개에서 실행한다. 전투 연결(`bridge`), 릴레이 추가 규칙(`rules`), 원정·메타·저장(`run`), 음악 스케줄과 미리듣기 소스 일치(`music`), 오늘의 균열의 생성·정산·저장(`daily`), 캐릭터 그림의 포즈·크기·기준점·얼굴 상자(`assets`), 원본 대비 규칙 목록(`rulebook`), 복합 기술의 연출 계획(`effect-plan`)을 확인한다.
- 자동 플레이는 먼저 빌드한다. Playwright Chromium을 쓰고, 없으면 설치된 Chrome, Edge 순으로 시도한다. `CHROMIUM_PATH`로 실행 파일을 지정할 수 있다. `--seeds=7,21`과 `--runs=2`가 기본값이며 시드마다 입문 1판 뒤 본편 2판을 돈다. `--headed`를 붙이면 창을 띄운다.
- 자동 플레이는 본편 이어하기, 브라우저 오류·멈춤, 행동 뒤 대기 시간과 전투 프레임을 확인한다. `--intro-only --tutorial=both`는 새 프로필로 루미의 튜토리얼을 한 판은 따라가고(follow) 한 판은 건너뛰어(skip) 입문을 끝까지 돈다. 화면은 `tests/shots/`에 남긴다.
- `node card_pixel/game/tests/screens.mjs`는 전투·원정·저장·균열·튜토리얼·기능 안내 화면 사례 100개를 Chrome에서 확인하고 `tests/shots/screens/`에 화면과 모아 보기 `sheet.png`를 남긴다. `node card_pixel/game/tests/screens-map.mjs`는 지도 화면 사례 8개를 확인하고 `tests/shots/screens-map/`에 화면을 남긴다. 두 명령 모두 `--case <이름>`으로 하나만 돌거나 `--validate-only`로 화면에 필요한 상태만 확인할 수 있다.
- `RELAY_VIEWPORT=360x740`은 화면 갤러리의 뷰포트를 360×740으로 바꾸고 `tests/shots/screens-360x740/`에 저장한다.
- `RELAY_TEXT_SCALE=1.25`는 저장된 글자 설정을 125%로 시작한다. 기본 크기는 `tests/shots/screens-390x844-text125/`, 두 옵션을 함께 쓰면 `tests/shots/screens-360x740-text125/`에 저장한다.
- 화면 갤러리는 촬영마다 가로 넘침과 뷰포트 밖 버튼을 검사해 결과 표 뒤에 `OVERFLOW`로 표시한다. `--strict-overflow`는 경고가 나온 사례를 실패로 처리한다.
- `--case tours`는 아래 14개 기능 안내를 확인한다. 각 사례는 대상 강조와 말풍선 위치, 안내 문구, 확인 후 저장, 다시 열었을 때의 미표시를 검사한다.
  - `tour-heirloom` — 유품 기술 버튼
  - `tour-last-stand` — 최후의 일인의 기본 공격 버튼
  - `tour-relic` — 보물방의 첫 유물 장착 버튼
  - `tour-relic-replace` — 네 칸이 찬 상태의 첫 유물 교체 칸
  - `tour-spring-draw` — 샘의 ◆1 뽑기 버튼
  - `tour-spring-pick` — 샘의 ◆3 후보 보기 버튼
  - `tour-preparation` — 준비 편집의 첫 출현 명단 칸
  - `tour-difficulty` — 준비 화면의 여정 난이도 버튼
  - `tour-region` — 준비 화면의 홍련 화산 지역 규칙 버튼
  - `tour-modified-door` — 광폭 변덕이 붙은 문
  - `tour-altar` — 제단 굴리기 버튼
  - `tour-wager` — 점성술사의 별판 내기 선택지
  - `tour-mission` — 수첩의 주간 임무 안내 버튼
  - `tour-daily-rift` — 오늘의 균열 첫 도전 버튼
- Windows 실행 파일 `dist/Relaymare.exe`는 `node card_pixel/game/launcher/build-launcher.mjs`로 만든다. 같은 폴더의 `Relaymare.html`을 Chrome(없으면 Edge)의 앱 창으로 연다. 자세한 내용은 [launcher/README.md](launcher/README.md).

## 시뮬레이션·음악·그림 도구

```sh
node card_pixel/game/tools/sim.mjs --all
node card_pixel/game/tools/sim.mjs --all --difficulty=nightmare
node card_pixel/game/tools/sim.mjs --easy-audit
node card_pixel/game/tools/sim.mjs --daily-from=2026-11-21 --days=60
node card_pixel/game/tools/build-sprites.mjs
node card_pixel/game/tools/cut-icons.mjs card_pixel/art/icons/sheets.tsv card_pixel/art/icons card_pixel/game/assets/icons 32
```

- 시뮬레이션은 실제 `assets/sprites.json`의 명단과 원정 명령을 써서 클리어율, 1,000 이상 한 방, 전투·사망·유품·영입 후보 수를 잰다. 기본은 홍련 화산 여정 300판이다. 횟수는 숫자 인수로, 던전은 `--dungeon=ember_volcano`처럼 지정한다. `--all`은 던전마다 그 횟수만큼 돌며, 악몽에서는 입문을 건너뛴다. `--plain`, `--no-heirloom`, `--no-laststand`로 비교한다.
- [tools/music-preview.html](tools/music-preview.html)을 브라우저에서 바로 열어 합성 배경음 12곡을 듣는다. 전투·보스 곡은 던전을 골라 들어 볼 수 있다.
- `node card_pixel/game/tools/music-levels.mjs`는 설치된 Chrome에서 12곡과 효과음 몇 개를 재생해 최고·평균(RMS) 음량, -1 dBFS 이상 비율, 가장 긴 무음 구간을 표와 JSON으로 남긴다.
- 스프라이트 도구는 `../art/pixel-v2/`(2026-11-21 GPT 도트 150종, 수정 6명 포함)의 대기·공격·피격 원본을 불투명 경계로 잘라 `assets/`와 `sprites.json`을 갱신한다. 픽셀과 배율은 원본 그대로이고, 기준점(몸 중심·발선)과 얼굴 상자(`face`: 머리 중심·정수리·머리 길이)를 함께 적는다. `sprites.json`의 키 순서와 `kind`·`size`·`facing`은 유지한다(키 순서가 동료 풀 순서다). `--import "<원본 묶음 폴더>"`는 원본 묶음에서 `art/pixel-v2/`로 다시 복사한다. 예전 띠(`../art/strips`)와 자르기 도구는 쓰지 않는다(도구는 git 기록에 있다).
- 아이콘 도구는 `sheets.tsv`에 지정된 2×2 시트를 잘라 `assets/icons/`에 32×32 PNG로 저장한다.

## 모듈 지도

| 위치 | 담당 |
| --- | --- |
| `build.mjs` | `core/`의 전투 규칙·게임 모듈·CSS·그림을 단일 HTML로 묶는다 |
| `core/` | RELAYMARE 전용 전투 규칙 원본(`data.js`, `logic.js`, `skill_display.js`, `battle_runtime.js`). 2026-11-21 `card/game`에서 복사했고 이후 독립. 출처는 `core/README.md` |
| `src/` | 게임 소스 |
| `src/main.js` | 엔진·무대·저장·음악 초기화와 첫 화면 연결 |
| `src/engine/` | 전투·원정·프로필 규칙 |
| `src/engine/bridge.js` | 카드 전투 연결, 예고·미리보기, 릴레이·유품·지역 효과, 전투 사건과 정산용 요약 |
| `src/engine/run.js` | 원정 생성과 진행 명령, 출전 순서, 전투 정산, 보상 |
| `src/engine/run-battle.js` | 원정 전투 옵션과 문·적·템포·축복 미리보기 |
| `src/engine/rooms.js` | 문과 적 구성, 사건 조건·효과, 유물 제안·장착 한도 |
| `src/engine/awakenings.js` | 깨우기 확률·비용(복원추출, 표기 = 실제 `ratesView`), 합류·강화·기억 판정, 제단 축복 뽑기 |
| `src/engine/entry.js` | 새 플레이어의 단계 해금(`featureFlags`), 튜토리얼·기능 안내 기록(`profile.ui.entry`) |
| `src/engine/meta.js` | 프로필, 영입·인연, 준비 모델(`prepView`: 시작 동료·샘 초대·출현 제외), 해금과 수첩·기록 |
| `src/engine/history.js` | 원정 기록(`run.chronicle`: 전투별 계승·사용·형태·막타)과 동료별 귀환 이력(`profile.history`: 출전·대기·생환·쓰러짐) |
| `src/engine/resume.js` | 이어가기 지점 판정(`resumePoint`: 전투 입구·결과판·지도·방) |
| `src/engine/episodes.js` | 인연 에피소드 해금(영입 → 실제 출전 → 그 원정 정산)과 읽음 표시 |
| `src/engine/save.js` | 본편 세션·프로필 저장과 전체 기록 백업·복원 |
| `src/engine/run-codec.js` | 본편과 균열에서 쓰는 원정 직렬화·검증·복원 |
| `src/engine/daily-rift.js` | 날짜별 균열 생성, 시도 검증과 채점 |
| `src/engine/daily-store.js` | 균열 체크포인트와 첫 도전·연습 기록 저장 |
| `src/content/rift-puzzles.js` | 엔딩 뒤 균열 퍼즐 3판(재사용하는 균열 날짜, 대여 5인, 목표, 한 줄 이야기). 해답은 `tests/daily.test.mjs`에만 있다 |
| `src/engine/dates.js` | 달력 날짜 변환과 검증 |
| `src/engine/opening.js` | 첫 전투 선택지의 결과 미리보기 |
| `src/engine/roster.js` | 카드와 스프라이트로 동료 풀·야생·그림자·보스 구성 |
| `src/engine/rng.js` | 시드 난수, 추첨과 섞기 |
| `src/content/` | 던전·방·규칙·적 자료 |
| `src/content/dungeons.js` | 던전별 층수·풀·배경·난이도·보스·지역·해금 |
| `src/content/layouts.js` | 입문·본편의 층별 문 구성, 방 이름 |
| `src/content/regions.js` | 지역 규칙 이름과 설명, 일부 기본값 |
| `src/content/events.js` | 사건 대사·출현 조건·선택지와 효과 |
| `src/content/relics.js` | 원정에서 나오는 유물 ID와 제안 조건 |
| `src/content/notebook.js` | 꿈길 수첩 7장의 제목과 해금 항목 |
| `src/content/intro.js` | 대여 편성·첫 전투 시작값·입문 마지막 그림자 |
| `src/content/quirks.js` | 전투 전체에 걸리는 꿈의 변덕 |
| `src/content/affixes.js` | 적에게 붙는 접두사 |
| `src/content/wild.js` | 야생 몽마 수치·크기·기술 |
| `src/content/bosses.js` | 보스 수치와 예고 문구. 기술은 `core/`의 전투 규칙에서 읽는다 |
| `src/content/boss-lessons.js` | 보스 행동표와 예행 전투 규칙 |
| `src/content/contracts.js` | 악몽 계약 조건과 예치금·지급액 |
| `src/content/daily-rift.js` | 균열 층 수와 지역·사건·전투 보정 자료 |
| `src/content/missions.js` | 주간·월간 임무 해금과 보상 후보 기준 |
| `src/content/tempo.js` | 템포 버전, 전투 시작값과 편성·증원 규칙 |
| `src/content/skill-motions.js` | 기술별 연출 자료(원래 칸 키 `역할/주인/칸`: 계열·변형·자세·발사 지점·속성색)와 변신 형태 윤곽선(`FORM_MARKERS`) |
| `src/content/sprite-sockets.js` | 자동 추출한 발사 지점(`assets/sprite-sockets.json`)을 덮어쓰는 보정값 |
| `src/content/episodes.js` | 소유자 시나리오 31편 원문. `tools/import-episodes.mjs`로 만들고 직접 고치지 않는다 |
| `src/content/episode-greetings.js` | 영입 인사 예외(첫 원문 대사 대신 같은 에피소드의 다른 원문 대사를 쓰는 12명) |
| `src/content/rulebook.js` | 카드 원본 대비 바뀐 규칙 검수 자료(`plan/changes-review.html`). 게임은 불러오지 않는다 |
| `src/ui/` | 화면·입력·표시 |
| `src/ui/nav.js` | 제목·관측소·행선지·생환·엔딩 전환과 세션 저장 연결 |
| `src/ui/nav/daily.js` | 오늘의 균열 기록·준비·재개·결과 화면과 미저장 결과의 재시도·백업 연결 |
| `src/ui/nav/recovery.js` | 저장 손상 때의 복구 화면과 백업 가져오기 연결 |
| `src/ui/nav/screen-tabs.js` | 탭이 있는 화면(수첩·기록·엔딩)의 공용 탭 전환 |
| `src/ui/run/` | 원정 화면의 진행 연결 |
| `src/ui/run/index.js` | 원정 화면 등록·전환, 엔진 명령 호출과 저장 |
| `src/ui/screens/` | 장면별 HTML과 버튼 |
| `src/ui/screens/title.js` | 제목과 첫 출발 |
| `src/ui/screens/hub.js` | 관측소, 돌아온 동료, 출발·이어가기 |
| `src/ui/screens/dungeons.js` | 행선지 목록과 준비 화면(시작 동료 + 지역 출현 명단 격자, 난이도) |
| `src/ui/screens/awaken.js` | 원정 시작과 입문의 깨우기 |
| `src/ui/screens/map.js` | 층 지도, 문 미리보기, 문으로 걷는 장면 |
| `src/ui/screens/order.js` | 독립 편성 화면(적 요약·세 자리·대기·고정 시작 버튼)과 유품 미리보기 |
| `src/ui/screens/spring.js` | 소환의 샘에서 새 동료 깨우기 |
| `src/ui/screens/reinforce.js` | 원정 중 증원과 합류·교체 선택 |
| `src/ui/screens/altar.js` | 혼돈의 제단에서 축복 뽑기·확정 |
| `src/ui/screens/event.js` | 사건 대사, 비용·대상·선택 결과 |
| `src/ui/screens/gate-pick.js` | 문지기 보상에서 그림자 또는 유물 선택 |
| `src/ui/screens/treasure.js` | 유물 받기와 장착 교체 |
| `src/ui/screens/recruit.js` | 생환 영입(출전 이력 태그) 또는 패배 뒤 다음 후보 예약 |
| `src/ui/screens/collection.js` | 동료·유물 도감과 동료 상세(나오는 지역) |
| `src/ui/screens/notebook.js` | 꿈길 수첩 장과 달성 표시 |
| `src/ui/screens/records.js` | 원정과 누적 기록, 엔딩 다시 보기 진입 |
| `src/ui/screens/ending.js` | 꿈길의 끝 기록 요약과 영입 동료 행진 |
| `src/ui/screens/daily-rift.js` | 오늘의 균열 준비·결과·기록 화면 |
| `src/ui/battle/` | 전투 화면과 사건 재생 |
| `src/ui/battle/view.js` | 전투 조립, 엔진 사건 재생과 결과 전달 |
| `src/ui/battle/hud.js` | 적·동료·하늘과 행동 예고 표시 |
| `src/ui/battle/tiles.js` | 기술·유품·물러나기 명령 타일 |
| `src/ui/battle/moves.js` | 공격·피격·교대 등 전투 연출 |
| `src/ui/battle/sheets.js` | 적·동료·필드·유물의 상세 정보 |
| `src/ui/battle/fields.js` | 전투 필드와 기술이 만드는 필드 설명 |
| `src/ui/battle/log.js` | 전투 사건을 턴별 기록으로 정리하고 표시(아군·적 색 표식) |
| `src/ui/battle/effect-plan.js` | 한 시전의 사건을 "타격 → 실제로 바뀐 곳의 효과" 그리기 계획으로 바꾸는 순수 함수 |
| `src/ui/battle/motion.js` | 기술 연출 판정(`resolveMotion`: 유품·룰렛·그림자·변신도 원래 칸으로)과 접점·발사 지점 계산 |
| `src/ui/assets.js` | 내장 스프라이트·배경·아이콘 조회 |
| `src/ui/storage.js` | 브라우저 `localStorage` 접근 |
| `src/ui/settings.js` | 음악·효과음·윤곽선 설정, 전체화면·기록 초기화, 튜토리얼 다시 보기 |
| `src/ui/coach.js` | 실제 버튼에 구멍을 내는 코치 표시(디펜스 방식, 도트 스타일) |
| `src/ui/tutorial.js` | 루미의 첫 세션 안내 단계와 기능 안내(명령 성공으로 진행) |
| `src/ui/glossary.js` | 화면 공통 용어(`short`·`firstUse`·`detail`·`scope`) 한 곳 |
| `src/ui/text.js` | 조사 고르기(`josa`)와 줄 첫머리에 "·"가 오지 않게 하는 `keepSeparators` |
| `src/ui/story-lines.js` | 원정 기록을 동료별 한 줄 문장으로(지어내지 않고 실제 사건만) |
| `src/ui/credits.js` | 만든 사람과 글꼴·도구 라이선스 시트 |
| `src/ui/sheet.js` | 공용 하단 시트와 열려 있는 동안의 전투 시계 정지 |
| `src/ui/widgets.js` | 헤더·스프라이트·배지·수치표 등 공용 표시 |
| `src/ui/dom.js` | DOM 조회·화면 전환(전환 띠 포함)과 HTML 이스케이프 |
| `src/ui/pixel-icons.js` | 그림 아이콘이 없는 메뉴용 16×16 도트 아이콘(SVG, 줄 지도로 그림) |
| `src/ui/reveal.js` | 등급별 소환 공개 연출 |
| `src/ui/relics.js` | 유물 상세 문구와 장착 비교 표시 |
| `src/stage/` | 캔버스 무대와 합성 효과음 |
| `src/stage/stage.js` | 저해상도 캔버스, 가상 시계·카메라·이펙트 |
| `src/stage/audio.js` | 무대 시계에 맞춘 합성 효과음 |
| `src/stage/walking-map.js` | 도트 지도 배치와 문까지 걷는 연출 |
| `src/audio/` | 배경 음악 |
| `src/audio/music.js` | 12곡 악보와 WebAudio 재생·전환 |
| `src/styles/` | 공용(`base`: 색·모양·글꼴 토큰, 버튼, 시트, 장식)·전투(`battle`)·원정 화면(`screens`)·타이틀·관측소와 메타 화면(`meta`) CSS. 디자인 근거는 `plan/ui-direction.md` |
| `src/styles/map.css` | 걷는 지도와 문·편성 패널 스타일 |
| `assets/` | 포즈 PNG와 `sprites.json`, `backgrounds/`, `icons/` |
| `tools/` | `core/`의 전투 규칙을 감싸는 `core-bundle.mjs`, 시뮬레이션(`sim.mjs`), 미리듣기, 그림 만들기, 발사 지점 추출(`sprite-sockets.mjs`), 시나리오 가져오기(`import-episodes.mjs`) |
| `tests/` | Node 테스트 진입 파일 13개, 화면·지도 갤러리, 브라우저 자동 플레이(튜토리얼 따라가기·건너뛰기 포함), 성능 측정(`perf.mjs`) |
| `tests/screens/entry.mjs` | `screens.mjs`에서 등록하는 튜토리얼·단계 해금·준비 화면 사례 |
| `tests/support/core.mjs` | 테스트별 카드 코어 VM과 스프라이트 명단 생성 |
| `tests/run/tempo-events.mjs` | `run.test.mjs`에서 등록하는 템포 2 사건 사례 |
| `tests/screens/rift.mjs` | `screens.mjs`에서 등록하는 균열 화면 사례 |
| `tests/screens/*.mjs` | 갤러리 묶음(`--case <묶음>`): `tours`·`coach` 안내, `motion` 연출, `resume` 이어가기, `history` 귀환 기록, `access` 키보드·편안함, `goals` 엔딩 뒤 목표, `episodes` 인연, `relics` 유물 문, `patterns` 야생 패턴, `promise` 약속, `puzzles` 균열 퍼즐 |
| `dist/` | 플레이용 단일 HTML |

## 어디를 고치면 무엇이 바뀌나

아래 경로는 `src/` 기준이다. 그림 경로는 `game/` 기준이다.

| 추가할 것 | 손댈 곳 |
| --- | --- |
| 던전 | `content/dungeons.js`에 풀·보스·난이도·지역·해금을 등록한다. 층별 문이 달라지면 `content/layouts.js`, 새 해금 조건이면 `engine/meta.js`를 고친다. 배경 ID에 맞춘 PNG는 `assets/backgrounds/`에 둔다 |
| 사건 | `content/events.js`에 등장 인물 조건과 선택지·비용·`ops`를 넣는다. 새 효과는 `engine/rooms.js`, 다음 전투에서 판정하는 새 조건은 `engine/bridge.js`에 잇는다 |
| 유물 | `core/logic.js`의 `ARTIFACT_LIST`에서 ID를 찾아 `content/relics.js`에 제안 조건과 함께 추가한다. 이름·설명·전투 효과는 `core/`의 전투 규칙에서 읽는다. 같은 ID의 아이콘은 `assets/icons/`에 둔다 |
| 캐릭터 스프라이트 | `../art/strips/<id>-strip.png`와 `../art/manifest.json`을 준비해 자른 뒤 빌드한다. 동료는 카드 ID와 `kind: "ally"`를 쓰고, 동료와 ID가 겹치는 적은 `wild_<id>`·`boss_<id>`를 우선 조회한다. 던전 풀은 `content/dungeons.js`에서 확인한다 |
| 지역 규칙 | `content/regions.js`에 설명을 두고 `content/dungeons.js`에서 던전에 연결한다. 전투 중 판정·예고는 `engine/bridge.js`, 문·적·시작 필드 생성은 `engine/rooms.js`를 본다 |
| 화면 | `ui/screens/`에 화면을 두고, 거점 흐름은 `ui/nav.js`, 원정 중 흐름은 `ui/run/index.js`에 연결한다. 버튼은 엔진 명령을 호출한다 |

- **원정 상태는 엔진 명령만 바꾼다.** 화면과 시뮬레이션은 같은 명령으로 출전·방 선택·전투 정산·보상을 처리한다. 저장은 그 상태를 되살린다.
- **RELAYMARE 전투 규칙의 원본은 `core/`다.** `tools/core-bundle.mjs`가 이 파일들을 읽어 `RelayCore`로 감싸고 타이머를 연결한다. `card/game`과는 2026-11-21부터 독립이다. 릴레이 진행과 전투 연동은 엔진 연결층에 둔다.
