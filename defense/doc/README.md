# Defense 문서 시작점

기준: 2026-10-04, `origin/main`의 `7635238`. 활성 게임은 **루미의 별빛 원정 · ASTRA**이며 실행 소스는 `defense/merge/`다.

| 알고 싶은 것 | 읽을 문서 | 범위 |
| --- | --- | --- |
| 게임 진행과 기능이 존재하는 이유 | [GAMEPLAY.md](GAMEPLAY.md) | 편성 → 소환·합성·강화 → 물결 → 축복 → 승리/무한 |
| 코드를 어디서 고칠지 | [SOURCE_DESIGN.md](SOURCE_DESIGN.md) | 데이터·엔진·UI·판정·저장·아트·빌드와 수정 순서 |
| 코드를 읽지 않고 수치를 비교 | [BALANCE.md](BALANCE.md) | 성장·경제·별빛·유물 24개·축복 6개·지역 7개·보스 |
| 모든 동료의 능력과 전투 컨셉 | [CHARACTERS.md](CHARACTERS.md) | 선택 동료 30명, 트라우마 변신형, 보스 9종 |

## 기존 자료 조사 결과

소스 설명과 밸런스 문서는 이미 있었다. 다만 [기존 밸런스 설계](BALANCE_DESIGN.md)는 21명·20유물 시점의 일부 수치가 남아 있고, 기존 소스 문서에는 시작 별빛 75·셔플 백 소환·물결 사이 2.5초 등 현재 구현과 다른 설명이 있었다. `SOURCE_DESIGN.md`를 현재 코드에 맞추고, 최신 전체 능력표·진행 의도·밸런스 자료를 보완했다. 이번 문서의 전투 컨셉은 현재 역할과 기믹을 설명하는 것이며 별도 원작 설정을 새로 정하지 않는다.

| 기존 자료 | 사용 방법 |
| --- | --- |
| [BALANCE_DESIGN.md](BALANCE_DESIGN.md), [BOSS_ECONOMY_REVIEW.md](BOSS_ECONOMY_REVIEW.md) | 첫 출시 및 revision 2 조정 배경. 현재 수치는 `BALANCE.md` 우선 |
| [CELESTIAL_EXPANSION.md](CELESTIAL_EXPANSION.md) | 천상 지역·캐릭터 추가 당시 제작·검증 기록 |
| [docs/slow-effects.md](../docs/slow-effects.md) | 감속 만료와 중첩의 현재 처리 계약 |
| [ART_ASSETS.md](ART_ASSETS.md), [ART_DIRECTION.md](../ART_DIRECTION.md) | 아트 출처·외형·판정과 연출의 일치 |
| [기존 docs 색인](../docs/README.md), [Confluence 기록](../docs/CONFLUENCE_DESIGN.md) | 보존한 자료와 PR #546 당시 설계 |

`defense_legacy/`는 보존본이다. 문서의 수치와 실제 코드가 다르면 [content.js](../merge/content.js)의 최종 데이터와 [engine.js](../merge/engine.js)의 실행 규칙을 확인하고 이 문서를 함께 갱신한다. 카드 이름이 같아도 Card·Shooter·Survivor의 능력을 Defense에 복사하지 않는다.

## 갱신 규칙

동료를 추가하거나 수치를 바꿀 때 `CHARACTERS.md`의 기본 수치·특성·필살기와 `BALANCE.md`의 연계 조건을 함께 고친다. 경제·물결·저장 규칙 변경은 `GAMEPLAY.md`와 `SOURCE_DESIGN.md`에도 반영한다. 문서만 바뀌면 루트 `npm run verify:plan`, `npm run verify`를 실행하며 게임 빌드나 런타임 검사를 추가 실행하지 않는다. 실제 출시 입력 변경 시에는 루트와 Defense 전용 검증 정책을 따른다.
