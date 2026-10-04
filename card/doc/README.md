# Card 문서 시작점

기준: 2026-10-04, `origin/main`의 `7635238`. 활성 제품은 **DREAMWEAVER**다. 규칙·데이터는 `card/game/`, 화면은 `card/src/`에 있다.

| 알고 싶은 것 | 읽을 문서 | 범위 |
| --- | --- | --- |
| 진행 방식과 기능 의도 | [GAMEPLAY.md](GAMEPLAY.md) | 3칸 편성·턴 전투·수집·학습·16개 모드·기본 카드 세트 |
| 수정 파일과 실행 경로 | [SOURCE_MAP.md](SOURCE_MAP.md) | 데이터 → 계산 → 턴 처리 → RPG 상태 → 화면 어댑터 → 빌드 |
| 코드 없이 밸런스 비교 | [BALANCE.md](BALANCE.md) | 스탯·MP·피해·상태·확률·보상·비교 조건 |
| 모든 카드의 능력과 컨셉 | [CHARACTERS.md](CHARACTERS.md) | 수집 가능 161개 정의와 전투 전용 3형태, 수치·특성·구조화 스킬 |

## 기존 자료 조사 결과

Card는 네 게임 중 문서가 가장 많이 갖춰져 있었다. [구현 매뉴얼](../GAME_MANUAL.md), [구조 지도](../card_game_structure.md), [코딩 가이드](../CODING_GUIDE.md), 저장소 루트 [플레이 매뉴얼](../../card_manual/README.md)이 이미 있다. 이를 유지하고 목적별 시작점을 만들었다.

옛 `card_manual/04_general_card_data.md`와 `05_special_card_data.md`의 이름 목록에는 현재 전체 수집 정의 중 59개 이름이 등장하지 않는다. 단순 이름 대조이며 기존 문서의 모든 문장을 최신으로 검증했다는 의미는 아니다. 새 능력 자료는 실제 최종 데이터와 `SkillDisplay`의 구조화 스킬 해설을 사용한다. 소스 문서의 오래된 전체 검증 설명은 루트 [검증 정책](../../docs/verification-policy.md)과 현재 `AGENTS.md`를 우선한다.

| 기존 자료 | 재사용 범위 |
| --- | --- |
| [GAME_MANUAL.md](../GAME_MANUAL.md) | 세부 전투·모드·아티팩트·저장·화면 계약. 필독 정오표 포함 |
| [CODING_GUIDE.md](../CODING_GUIDE.md), [구조 지도](../card_game_structure.md) | 책임 경계·코딩 계약과 로딩 순서 |
| [DESIGN.md](../DESIGN.md), [README](../README.md) | 제품 화면 의도·테마·실행 방식 |
| [card_manual](../../card_manual/README.md) | 플레이어 관점 설명, 전투 공식 및 기존 도감. 수치 패치 때 별도 대조 |
| [스킬 표시 감사](../docs/skill-study-display-audit.md) | 데이터에서 설명을 만드는 표시 계약 |

`card_legacy/`는 읽기 전용 보존본이다. 이 문서의 컨셉은 속성·역할·조건·스킬로 드러나는 전투 설계이며 새로운 세계관 설정을 작성하지 않는다. 의상 카드나 초월형은 같은 이름의 기본형과 능력이 다를 수 있다.

## 갱신 규칙

카드·적·효과를 수정하면 해당 능력표, 비교 공식 및 기존 플레이 매뉴얼을 함께 대조한다. `desc`에 스킬 숫자를 별도로 복제하지 않고 구조화 필드와 `SkillDisplay`에서 설명을 얻는다. 저장 ID·카드풀 revision을 변경하는 작업은 [SOURCE_MAP.md](SOURCE_MAP.md)의 저장 계약을 따른다. 문서만 수정한 경우 루트 `npm run verify`를 실행하되 게임을 빌드하거나 런타임 검사를 별도로 돌리지 않는다.
