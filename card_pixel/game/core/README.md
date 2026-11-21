# RELAYMARE 전투 규칙

`card/game`의 규칙 파일 네 개를 2026-11-21에 바이트 그대로 복사했다. 복사 시점의 `git rev-parse HEAD` 값은 `e98c361194d85b6116a2819e4b4fe50f1a00c758`이다.

이 폴더는 이제 RELAYMARE 전용 원본이며 `card/`와 독립적으로 관리한다. RELAYMARE 빌드, 테스트, 시뮬레이션은 모두 `tools/core-bundle.mjs`를 통해 이 폴더에서 규칙을 읽는다. 이 파일을 고치면 RELAYMARE의 전투 데이터, 판정, 기술 설명 또는 턴 진행이 바뀐다. DREAMWEAVER의 다섯 빌드(card, legacy, astra, lumen, claude)는 계속 `card/game`의 규칙을 사용한다.

| 파일 | 역할 |
| --- | --- |
| `data.js` | 카드, 적, 기술, 기본 카드 세트 등 전투 데이터를 정의한다. |
| `logic.js` | 능력치, 피해량, 상태 효과와 유물 등 공통 전투 규칙을 정의한다. |
| `skill_display.js` | 기술의 효과, 비용과 조건을 표시할 문구로 변환한다. |
| `battle_runtime.js` | 전투 참가자를 구성하고 행동 처리와 턴 진행을 담당한다. |

## 검증 명령

저장소 루트에서 실행한다.

```sh
node card_pixel/game/tools/sim.mjs 60 --dungeon=ember_volcano
node --test --test-isolation=none card_pixel/game/tests/bridge.test.mjs card_pixel/game/tests/rules.test.mjs card_pixel/game/tests/run.test.mjs card_pixel/game/tests/music.test.mjs card_pixel/game/tests/daily.test.mjs
node card_pixel/game/build.mjs
```
