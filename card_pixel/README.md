# card_pixel — 세 부분 지도 (엔진 · 게임 · 기획서)

「다음은 너」(RELAYMARE) v1은 `game/`에 있다. 엔진은 규칙을 돌리고, 게임은 그 규칙을 화면에 보여 주며, 기획서는 무엇을 왜 정했는지 남긴다. 작업 원칙과 소유자 결정은 [AGENTS.md](AGENTS.md), 날짜별 내역은 [history/](history/)에 있다.

## 한눈에

| | ① 엔진 | ② 게임 | ③ 기획서 |
|---|---|---|---|
| 한 줄 | 화면 없이 돌아가는 전투·원정·메타 규칙 | 관측소에서 출발해 창조의 탑 엔딩까지 하는 게임 | 설계·결정·다음 후보 |
| 위치 | `game/src/engine/`, `game/src/content/`, `game/tools/`, `game/tests/`의 규칙 테스트 | `game/src/ui/`, `game/src/stage/`, `game/src/audio/`, `game/src/styles/`, `game/assets/`, `game/dist/Relaymare.html`, `game/tests/play.mjs`, `art/` | `plan/`, `history/`, `AGENTS.md` |
| 다시 확인하는 법 | Node 테스트와 던전별 시뮬레이션 | 빌드와 브라우저 자동 플레이, 사람의 플레이 | 원문·결정 장부·작업 기록 대조 |
| 확인할 수 있는 것 | 규칙 계산, 같은 조건·시드의 재현, 저장 복원 | 화면에 규칙이 보이고 실제 입력으로 진행되는지 | 방향, 결정한 사람과 이유, 확인할 질문 |
| 별도 확인할 것 | 손맛과 실제 사람의 클리어율 | 개별 규칙 계산은 엔진 테스트로, 배치·연출·기기·소리는 직접 플레이로 | 구현 여부와 실제 수치는 코드·테스트로 |

의존 방향은 **③ 결정 → ① 엔진 → ② 화면**이다. 카드 전투의 공용 원본은 `card/game/`에 있다. RELAYMARE는 `data.js`, `logic.js`, `skill_display.js`, `battle_runtime.js`를 그대로 감싸 쓴다. 공용 전투 규칙을 바꾸면 카드 게임 화면 다섯 개도 영향을 받는다.

## ① 엔진 — 다시 확인할 수 있는 부분

브라우저 없이 Node에서 돌린다.

- `game/tools/core-bundle.mjs`는 원본을 `window.RelayCore`로 감싸고 타이머를 브리지에 연결한다.
- `game/src/engine/bridge.js`는 카드 전투를 실행해 순서 있는 사건과 정산용 요약을 돌려준다. 예고·교대·물러나기, 유품·최후의 일인·꿈의 변덕·접두사, 지역 규칙을 잇는다.
- `game/src/engine/run.js`와 `rooms.js`는 입문 5층·본편 8층의 문, 편성, 영구 사망, 결정, 사건·유물과 보상을 처리한다. 원정 상태는 엔진 명령으로 바꾼다.
- `game/src/engine/roster.js`는 카드와 실제 대기 스프라이트를 기준으로 던전 풀과 적을 구성한다. `meta.js`와 `save.js`는 영입·인연·해금과 프로필·원정 저장을 맡는다.

```sh
node --test card_pixel/game/tests/bridge.test.mjs card_pixel/game/tests/rules.test.mjs card_pixel/game/tests/run.test.mjs card_pixel/game/tests/music.test.mjs card_pixel/game/tests/skill-motions.test.mjs card_pixel/game/tests/text.test.mjs
node card_pixel/game/tools/sim.mjs --all
```

Node 테스트는 전투·원정·저장 규칙과 음악 스케줄을 확인한다. 시뮬레이션은 실제 스프라이트 명단을 읽고 단순 플레이어로 던전별 클리어율과 한 방 피해 등을 잰다. 사람의 체감 난이도는 직접 플레이로 판단한다.

## ② 게임 — 손으로 플레이하는 부분

[game/dist/Relaymare.html](game/dist/Relaymare.html)을 브라우저에서 연다. 그림·규칙·음악은 HTML에 들어 있고 Galmuri 글꼴은 CDN에서 읽는다.

- 첫 실행은 새벽의 숲 대여 전투로 들어간다. 입문에서 생환한 동료를 영입한 뒤 관측소에서 본편에 출발한다. 이어하기, 동료·유물 도감, 꿈길 수첩, 기록과 엔딩을 포함한다.
- `game/src/ui/`는 화면과 입력, `game/src/stage/`는 캔버스·효과음, `game/src/audio/`는 배경음을 맡는다. `game/assets/`에 포즈·배경·아이콘이 있고, 그림 원본과 생성 자료는 `art/`에 있다.
- 플레이 방법, 옵션, 도구, 모듈 지도는 [game/README.md](game/README.md)에 있다.

```sh
node card_pixel/game/build.mjs
node card_pixel/game/tests/play.mjs
```

첫 줄은 단일 HTML을 만든다. 둘째 줄은 자체 빌드 뒤 시드별로 입문과 본편을 돌며 진행·이어하기·오류·대기 시간·프레임을 확인하고 `game/tests/shots/`에 화면을 남긴다. 실제 휴대폰 터치·Safari·소리와 배치·연출은 직접 플레이로 확인한다.

## ③ 기획서 — 방향과 이유

출처와 `[초안]` `[미확인]` 표시를 따라 읽는다. 구현과 수치는 해당 코드와 검사 결과를 확인한다.

| 위치 | 내용 |
|---|---|
| [plan/plan-content.md](plan/plan-content.md), [plan/renewal-plan.html](plan/renewal-plan.html) | 초기 리뉴얼 기획서와 시각 페이지 |
| [plan/experimental-rules.md](plan/experimental-rules.md) | E~H 설계와 시험 당시의 시뮬레이션 수치 |
| [plan/v1-decisions.md](plan/v1-decisions.md) | v1에 반영한 Claude 판단과 이유. 소유자 확인 전 |
| [plan/roadmap.md](plan/roadmap.md) | v1 이후 질문과 확장 후보 |
| [plan/structure.html](plan/structure.html) (`structure.json`) | 초기 구조도 |
| [plan/source-inventory.md](plan/source-inventory.md), [plan/pixel-pilot/](plan/pixel-pilot/) | 조사와 도트 변환 실험 자료 |
| [AGENTS.md](AGENTS.md) | 작업 원칙과 소유자 결정 장부 |
| [history/](history/) | 날짜별 작업·검증 기록과 GPT 위임 평가 |

## 헷갈리기 쉬운 것 — 초기 기획과 v1

| 항목 | 초기 기획 | v1 엔진·게임 |
|---|---|---|
| 원정 길이·난이도 | 10층과 꿈결·여정·악몽 초안 | 새벽의 숲 5층, 테마 5곳과 창조의 탑 8층. 본편은 여정·악몽 |
| 출발 | 대표 1명 + 결정 8 | 본편 골라 깨우기 2명 + 무작위 3명, 결정 1. 대표가 있으면 첫 선택을 대신한다 |
| 풀·보스 | 던전별 기본 덱 + 동행, 지정 보스 | 던전별 풀에 대표·동행·예약 후보와 봉인 반영. 악몽에는 일부 던전의 숨은 보스 |
| 원정 규칙 | 유품·최후의 일인·변덕·접두사는 이후 실험 문서에 정리 | 네 규칙 모두 쓰며, 지역 규칙·사건 28종·유물 14종(장착 4칸) 포함 |
| 원정 밖 진행 | 거점·영입·전역 재화·가챠 초안 | 관측소·영입·인연·동행·봉인·수첩과 저장. 꿈 조각은 다음 원정 후보 예약에 쓴다 |

## 한 부분을 바꿨을 때 다시 볼 것

| 바꾼 것 | 다시 볼 것 |
|---|---|
| `card/game/`, `game/src/engine/`, `game/src/content/` | 바뀐 규칙에 가장 가까운 테스트와 빌드. 숫자를 바꿨다면 해당 던전 시뮬레이션 |
| `game/src/ui/`, `game/src/stage/`, `game/src/audio/`, `game/src/styles/`, 그림 | 빌드와 바뀐 화면·소리 확인 |
| `plan/`, `history/`, `AGENTS.md` | 결정 장부와 문서 대조 |

## 이 폴더 바로 아래의 옛 파일

`build.mjs`, `serve.mjs`, `src/`, `dist/`, `generated/`, `scripts/`, `tests/`는 2026-11-15 이전 시험판(`DREAM_TOWER`)의 미추적 파일이다. RELAYMARE v1의 빌드와 플레이는 `game/`에서 한다.
