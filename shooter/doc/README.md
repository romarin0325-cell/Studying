# Shooter 문서 시작점

기준: 2026-10-04, `origin/main`의 `7635238`. 활성 게임은 **별의 잔향 · ASTRAL BLOOM**이며 실행 소스는 `shooter/` 바로 아래에 있다.

| 알고 싶은 것 | 읽을 문서 | 범위 |
| --- | --- | --- |
| 진행과 기능 의도 | [GAMEPLAY.md](GAMEPLAY.md) | 출격·스테이지·퀴즈·부활·챌린지·주간·의상·루미 과외 |
| 수정 파일과 실행 경로 | [SOURCE_MAP.md](SOURCE_MAP.md) | 콘텐츠·전투·캠페인·메뉴·학습·AI·에셋·빌드 |
| 코드 없이 밸런스 판단 | [BALANCE.md](BALANCE.md) | 비교 조건·난이도·자원·보상·유물·수치 변경의 영향 |
| 수호자의 능력과 컨셉 | [CHARACTERS.md](CHARACTERS.md) | 9명·18무기·고유 봄·보스/지원체 역할과 최신 매뉴얼 연결 |

## 기존 자료 조사 결과

[docs/MANUAL.md](../docs/MANUAL.md)에 진행 방식, 9명 전체 능력, 조건을 명시한 DPS/봄 실측, 12던전×3구간×4난이도, 수집 유물 48종이 이미 있다. 이 수치 자료를 복제·재측정하지 않고 계속 사용한다. 해당 생성 데이터의 5개 원본 SHA-256은 이번 기준 소스와 일치함을 파일 해시로 대조했다.

반면 기능별 책임과 수정 경로를 한 번에 설명하는 유지보수 지도는 부족했고 최신 오답 복습·개인과외 흐름은 매뉴얼에 충분히 담기지 않았다. `doc/`에 이를 보완하고 목적별 읽기 경로를 묶었다.

| 기존 자료 | 사용 방법 |
| --- | --- |
| [MANUAL.md](../docs/MANUAL.md), [manual-data.js](../docs/manual-data.js) | 현재 수치·측정 조건·소스 해시 |
| [manual-content.js](../docs/manual-content.js) | 무기·봄·보스의 서술 설명 원본 |
| [RELICS_WARDROBE_PATCH.md](../docs/RELICS_WARDROBE_PATCH.md) | 유물 처리와 캐릭터/의상 전환 계약 |
| [LEARNING_EXPANSION.md](../docs/LEARNING_EXPANSION.md) | 오답장 등 학습 기능의 추가 배경 |
| [COSTUME_ASSET_AUDIT.md](../docs/COSTUME_ASSET_AUDIT.md) | 현재 의상과 화면 크기 검토 |
| [VERIFICATION.md](../VERIFICATION.md), [README](../README.md) | 실행·검증 자료. 실행 범위는 현재 루트 정책 우선 |
| [CHALLENGE_PATCH.md](../CHALLENGE_PATCH.md), [WEEKLY_EVENTS_PATCH.md](../WEEKLY_EVENTS_PATCH.md) | 기능 도입 당시 기록 |

코스튬은 외형만 바꾸고 피격과 능력은 바꾸지 않는다. Shooter의 시간의마술사와 Survivor/Defense의 시간의지배자를 같은 캐릭터로 합치지 않는다.

## 갱신 규칙

전투 수치를 바꿀 때 기존 `docs/generate-manual.mjs`로 매뉴얼·측정 데이터를 함께 갱신하고 설명 원본도 대조한다. 이 작업처럼 문서만 바꾸면 재측정·게임 빌드는 하지 않는다. 공통 학습 데이터는 `card/game/`에서 `sync-learning.mjs`로 가져오는 구조를 유지한다. 필수 검증은 루트 `npm run verify:plan`, `npm run verify`다.
