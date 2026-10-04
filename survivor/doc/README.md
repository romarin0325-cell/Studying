# Survivor 문서 시작점

기준: 2026-10-04, `origin/main`의 `7635238`에 병합된 Nightfall. 활성 제품은 **ASTRA: NOCTURNE — 별을 지키는 밤**이다.

| 알고 싶은 것 | 읽을 문서 | 범위 |
| --- | --- | --- |
| 진행 방식과 기능 의도 | [GAMEPLAY.md](GAMEPLAY.md) | 이동·성장·회피·필살기·보물·제단·2가지 원정·영구 성장 |
| 코드 수정 위치 | [SOURCE_MAP.md](SOURCE_MAP.md) | 엔진·지역/보스·Reverie·Nightfall·저장·렌더·보행·빌드 |
| 코드 없이 밸런스 판단 | [BALANCE.md](BALANCE.md) | 피해·XP·등장·지역·난이도·16무기·12유물·진화/공명/융합·기억 |
| 캐릭터 능력과 컨셉 | [CHARACTERS.md](CHARACTERS.md) | 선택 수호자 9명·무기 소유 컨셉 5명·보스 6종 |

## 기존 자료 조사 결과

[README](../README.md)에 플레이와 구조 요약은 있었고, `docs/`에 Renewal/Reverie/Ordeal/Atelier/Nightfall 변경의 조사·아트·검증 기록이 있었다. 그러나 현재 모든 규칙을 모아 설명하는 진행·수정 위치·밸런스·능력 문서는 부족했다. 이번 `doc/`는 기록을 보존하면서 현재 코드의 설명을 제공한다.

| 기존 자료 | 구분과 사용 |
| --- | --- |
| [Nightfall README](../docs/nightfall/README.md) | 최신 2지역·2무기·2유물·3융합·20단계 기억·체력/XP 변경·아트 계약 |
| [VALIDATION.md](../docs/VALIDATION.md), [Nightfall 검증 JSON](../docs/nightfall/VALIDATION.json) | 해당 패치 당시 검증 근거 |
| [ART.md](../docs/ART.md), [Nightfall 검토 화면](../docs/nightfall/review/index.html) | 정체성·원본·방향/보행·체형 검토 |
| [REVERIE-RESEARCH.md](../docs/REVERIE-RESEARCH.md) | 짧은/무한 원정·비밀·성장·보간 도입 배경 |
| [Ordeal 보고서](../docs/ordeal/report.md), [밸런스 표본](../docs/ordeal/balance-final.jsonl) | 당시 보스/아트/경험 조사와 자동 입력 표본 |
| [RENEWAL-RESEARCH.md](../docs/RENEWAL-RESEARCH.md) | 초기 15개 자료 조사와 성장 구조의 배경 |

이전 측정 파일은 해당 시점의 보관본이다. Nightfall의 XP 1.5배·적 HP 1.3배 이전 표본을 현재 클리어율로 사용하지 않는다. 이번 문서 작업에서는 전투 시뮬레이션이나 기기 플레이를 다시 실행하지 않았다.

## 갱신 규칙

현재 수치의 최종 기준은 `src/content.js`와 엔진의 실제 적용이다. 설명 문구만 바꾸거나 다른 게임의 동명 인물 능력을 복제하지 않는다. 데이터·엔진·별도 기능 모듈·저장 복원·도감 설명을 함께 확인한다. 문서만 변경하면 루트 `npm run verify`의 문서 범위를 사용하고, 실제 출시 입력이 바뀔 때는 선택된 단일 파일 빌드/오프라인 검사까지 따른다.
