# 네 게임 문서 조사와 보완 기록

조사 기준: 2026-10-04, 최신 `origin/main` **`76352385724bc3ae6dbf61b055e87e9a2d8d32e1`**. 저장소와 각 게임의 Git 추적 문서를 조사했고 활성 소스의 최종 데이터 및 실행 분기를 대조했다. 로컬 미추적 참고 파일이나 과거 `*_legacy` 문서를 현재 게임의 규칙으로 사용하지 않았다.

## 기존 자료가 있었는가

| 게임 | 진행·설계 | 소스 구조·수정 위치 | 밸런스·능력 | 확인한 부족/오래된 부분 |
| --- | --- | --- | --- | --- |
| Defense | `README.md`, `docs/CONFLUENCE_DESIGN.md` | `doc/SOURCE_DESIGN.md` | `doc/BALANCE_DESIGN.md`, `BOSS_ECONOMY_REVIEW.md`, 확장 기록 | 21명/20유물 시점 표, 시작 별빛 75·셔플 백·준비 2.5초 설명. 현재는 30명/24유물/90/독립 추첨/1.4초 |
| Card | `GAME_MANUAL.md`, `DESIGN.md`, 루트 `card_manual/` | `CODING_GUIDE.md`, `card_game_structure.md` | `card_manual/03~09`, `11`과 구현 매뉴얼 | 현 최종 161개 정의 중 59개 이름이 옛 일반/특수 도감에 없음. 기능·원본·예외의 연결을 보완 |
| Shooter | `README.md`, `docs/MANUAL.md`, 기능별 패치 문서 | README 파일 요약·검증/아트 기록 | 생성 매뉴얼과 실측 데이터가 상세하게 존재 | 책임별 수정 지도와 최신 개인과외/오답 보상 흐름 부족. 기존 실측은 재사용 |
| Survivor | README, Renewal/Reverie/Ordeal/Nightfall 기록 | README 구성 요약·패치별 설명 | 과거 시뮬레이션/검증 JSON, Nightfall 변경 기록 | 현재 진행·종료·성장·전체 무기/유물/능력/수정 위치를 함께 읽는 문서 부족 |

문서가 전혀 없다는 결론은 아니다. 기존 자료를 보존·연결하고 부족한 범위만 현재 코드 기준으로 보완했다. Card의 이름 누락은 문자열 대조 결과이며, 기존 도감의 모든 스킬 설명을 검증했다는 뜻은 아니다.

## 목적별 문서 위치

| 게임 | 진행·기능 의도 | 소스 지도 | 밸런스 | 캐릭터 |
| --- | --- | --- | --- | --- |
| [Defense 색인](../defense/doc/README.md) | [GAMEPLAY](../defense/doc/GAMEPLAY.md) | [SOURCE_DESIGN](../defense/doc/SOURCE_DESIGN.md) | [BALANCE](../defense/doc/BALANCE.md) | [CHARACTERS](../defense/doc/CHARACTERS.md) |
| [Card 색인](../card/doc/README.md) | [GAMEPLAY](../card/doc/GAMEPLAY.md) | [SOURCE_MAP](../card/doc/SOURCE_MAP.md) | [BALANCE](../card/doc/BALANCE.md) | [CHARACTERS](../card/doc/CHARACTERS.md) |
| [Shooter 색인](../shooter/doc/README.md) | [GAMEPLAY](../shooter/doc/GAMEPLAY.md) | [SOURCE_MAP](../shooter/doc/SOURCE_MAP.md) | [BALANCE](../shooter/doc/BALANCE.md) | [CHARACTERS](../shooter/doc/CHARACTERS.md) |
| [Survivor 색인](../survivor/doc/README.md) | [GAMEPLAY](../survivor/doc/GAMEPLAY.md) | [SOURCE_MAP](../survivor/doc/SOURCE_MAP.md) | [BALANCE](../survivor/doc/BALANCE.md) | [CHARACTERS](../survivor/doc/CHARACTERS.md) |

## 문서화한 콘텐츠 범위

| 게임 | 최종 등록 기준 | 주의할 분류 |
| --- | --- | --- |
| Defense | 동료 30명, 변신 1형태, 보스 9종, 지역 7개, 유물 24개, 축복 6개 | 트라우마는 독립 편성 동료가 아님. 기존 초기 21명 검증과 확장 범위 구분 |
| Card | 수집 정의 161개: 기본 50·보너스 74·시즌 특별 25·기본 초월 7·보너스 초월 5, 전투 전용 3형태, 적 정의 15종 | 같은 인물의 형태를 별개 인물 수로 주장하지 않음. 실제 획득은 풀/해금/모드 조건을 따름 |
| Shooter | 수호자 9명·18무기 스타일·고유 봄, 12던전/보스, 수집 유물 48개 | 예약 전설 2개 제외. 일반 6던전·챌린지 1·순환 이벤트 5를 구분 |
| Survivor | 선택 9명, 무기 소유 컨셉 추가 5명, 보스 6종, 지역 5개, 기본 무기 16·융합 3, 유물 12, 공명 4·각성 3 | 무기 컨셉 소유자는 선택 영웅이 아님. 진화·공명·융합의 조건/소모가 다름 |

능력표는 최종 배열의 확장/override를 반영했다. Card 스킬은 `SkillDisplay`의 구조화 해설을 사용하고, 문구와 실행에 차이가 있는 루터 조건·Survivor 범위/지속 패시브·보스 빙결 제한 등은 별도로 설명했다. 전투 컨셉은 현재 역할·기믹과 기존 설계에 근거한 설명이며 원작 설정을 새로 만드는 작업이 아니다.

## 수치 출처와 검증의 경계

Defense/Card/Survivor 표는 데이터·계산식에서 읽거나 계산한 자료이며 새 실측 DPS나 승률이 아니다. Shooter는 기존 `docs/MANUAL.md`/`manual-data.js`의 60Hz·seed41·준비3초·측정15초·거리200/80·반경38·유물 없음 실측을 연결한다. 원본 5개 파일의 SHA-256이 저장된 기준과 일치함을 대조했으며, 문서 변경 때문에 전투를 재측정하지 않았다.

문서 작업의 확인 항목은 상대 링크/앵커, 원본 ID와 등록 수, 추출 기본 수치·스킬/특성, 표의 계산 예시, 런타임/생성물 변경 없음, 필수 루트 검증이다. `npm run verify:plan`과 `npm run verify`는 실제 문서 diff에 적용한다. 문서 전용 변경은 정책상 설치·게임 빌드·브라우저·런타임 테스트를 선택하지 않는다. 게임 UI·기기 동작·플레이 재미를 이번 작업에서 새로 검증한 것으로 기록하지 않는다.

## 이후 유지보수

각 게임의 `doc/README.md`를 시작점으로 삼고, 수치/규칙 변경 때 해당 진행·밸런스·능력표와 실제 구현/저장/표시를 함께 갱신한다. 과거 패치의 측정 결과는 해당 시점 자료로 보존한다. 별도 새 원작 컨셉 자료를 추가할 경우 실제 전투 능력과 원작 설정의 출처/상태를 구분한다.
