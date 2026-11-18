# 도트 릴레이 시험판

일곱 층 원정을 카드 게임의 실제 전투 규칙으로 플레이한다. 원칙과 결정은 `../AGENTS.md`, 규칙 설계는 `../plan/experimental-rules.md`에 있다.

## 실행
- 빌드: `node card_pixel/slice/build.mjs` → `card_pixel/slice/dist/RelaySlice.html`
  - 한 파일이고 오프라인에서 열린다
  - 글꼴만 CDN에서 받고, 받지 못하면 기본 글꼴로 나온다
- 주소 뒤 옵션: `?seed=숫자` (같은 원정을 다시 재현)

## 흐름
타이틀 → 첫 깨우기(셋 중 하나 ×2, 두 번째는 첫 동료와 같은 속성 후보 1명 포함 + 무작위 셋, 결정 1) → 지도(7층, 층마다 문 1~3개) → 출전 순서 → 릴레이 전투 → 결과 → …

- 자세히 보기: 전투에서 적 이름표·동료 칸·하늘 칸·장면의 캐릭터를 누르면 지금 수치와 상태 설명이 열리고, 보는 동안 전투가 멈춘다. 지도·샘의 동료 얼굴을 누르면 특성·유품·기술 전문이 열린다
- 설정(오른쪽 위 아이콘): 소리, 윤곽선 강조, 전체화면(지원하는 브라우저만)

- 4층: 문지기(그림자 릴레이). 이기면 한 명 영입
- 6층: 소환의 샘 / 혼돈의 제단
- 7층: 보스(원정 시작 때 11종 가운데 무작위, 지도에 처음부터 보인다)

## 검사
- 규칙: `node --test card_pixel/slice/tests/bridge.test.mjs card_pixel/slice/tests/rules.test.mjs`
- 숫자: `node card_pixel/slice/tools/sim.mjs 300` (비교용 옵션 `--plain`, `--no-heirloom`, `--no-laststand`)
- 실시간: `node card_pixel/slice/tests/play.mjs` (설치된 Chrome으로 원정 세 판 자동 플레이, 화면은 `tests/shots/`)

## 구조
| 파일 | 하는 일 |
|---|---|
| `tools/core-bundle.mjs` | `card/game`의 `data.js`, `logic.js`, `skill_display.js`, `battle_runtime.js`를 고치지 않고 한 덩어리로 감싼다 |
| `src/bridge.js` | 규칙을 화면 없이 돌리고 순서 있는 사건 목록을 돌려준다. 채택 규칙 A~D, 실험 규칙 E~H |
| `src/roster.js` | 공용 구조: 캐릭터·풀·적(야생 생물, 그림자, 보스) |
| `src/run.js` | 원정: 층과 문, 깨우기, 제단, 영구 사망, 유품 보관, 보상 |
| `src/stage.js` | 저해상도 캔버스 무대(2배 정수 확대), 가상 시계, 2배 카메라, 코드로 그린 배경·이펙트, 합성 효과음 |
| `src/game.js` | 화면과 전투 사건 재생기 |
| `src/style.css` | 화면 모양 |
| `tools/cut-sprites.mjs` | `../art/strips/`의 생성 띠를 3포즈로 잘라 `assets/`에 쓴다 |
| `assets/` | 캐릭터·생물·보스마다 대기·공격·피격 3장 + `sprites.json` |

## 아직 임시인 것
- 영입과 결정은 저장되지 않는다
- 적·보스 수치는 시뮬레이션으로만 맞췄다
- 대표 기술·전용 연출은 아직 없다(큰 공용 연출만 있다)
