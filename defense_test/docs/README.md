# 문서 안내 (defense_test/docs)

숫자는 코드가 기준이다. 문서를 읽기 전에 어느 종류인지 본다.

## 1. 지금 값 (자동 생성, 테스트가 코드와 맞는지 검사한다)

- [CURRENT_VALUES.md](CURRENT_VALUES.md): 모든 동료·유물·필살기 상수와 핵심 규칙.
- `BALANCE_SNAPSHOT.json`, `ASSET_PROVENANCE.json`: 확률·성장 곡선과 에셋 해시.
- 다시 만들기: `node defense_test/scripts/generated-reports.mjs`. 확인만: `--check`.

## 2. 규칙·절차 (코드와 같이 고친다)

- [STATUS_RULES.md](STATUS_RULES.md): 독·노출·화상·제어 규칙.
- [CHARACTER_TRAITS.md](CHARACTER_TRAITS.md): 위력 계산 경로와 특성 판정 기준.
- [BOSS_AND_BUFF_RENEWAL.md](BOSS_AND_BUFF_RENEWAL.md): 버프 종류별 중첩 규칙, 보스 패턴.
- [ASSET_PIPELINE.md](ASSET_PIPELINE.md): 에셋·사운드 제작과 검수 절차.
- [SOL_ASSET_AND_VFX.md](SOL_ASSET_AND_VFX.md): Sol 최종 SD 8명 설치, 역할에 따른 공격·필살기 판단표, 실제 렌더러 전후 비교와 확장 규칙.
- [GPT_IMAGE_SD_BRIEF.md](GPT_IMAGE_SD_BRIEF.md): 나노바나나로 만든 동료 6명의 SD를 GPT Image 2.5(Manus)로 다시 그리는 지시서. 참조·프롬프트·거르기·패킹 순서.
- [ASSET_CONSISTENCY.md](ASSET_CONSISTENCY.md): 동료 37명의 SD·메모리얼 일관성 평가표(2026-10-19). 크게 어긋난 곳과 나중에 손볼 곳. 측정 도구는 `scripts/art/consistency-report.mjs`, `consistency-table.mjs`.
- [PARTNER_LINES.md](PARTNER_LINES.md): 대사.

## 3. 날짜 기록 (그날의 설계·측정)

STAT_RENEWAL, SMART_AUTO_AND_CHALLENGES, RELIC_RENEWAL, GROWTH_BALANCE, BALANCE_PASS5·8·14, RELIC_PASS7, POLISH_PASS6, PASS9, CHARACTER_BALANCE_PROPOSAL, 그리고 미디어·성능·UI 문서들.
- 표의 숫자는 그날 값이라 지금과 다를 수 있다. 맨 위 "변경" 블록이 이후 달라진 곳을 적는다.
- 지금 값이 궁금하면 1번을 본다.

## 4. 기획

- [UPCOMING_COMPANIONS.md](UPCOMING_COMPANIONS.md): 추가 예정 동료. 구현되면 해당 항목에 구현 날짜와 확정 수치를 적는다.
- [DAWN_GARDEN.md](DAWN_GARDEN.md): 제2부(스테이지 46~90)와 새벽 온실(치명타·별똥별 가속)의 규칙, 곡선, 측정, 테스트 도구(2026-10-19, 10차).
- [SUNFLOWER_SUNMOON_PLAN.md](SUNFLOWER_SUNMOON_PLAN.md): 해바라기·일월검희 구현 계획(2026-10-19). 해바라기는 구현됨(확정 수치와 햇빛 표시 설계는 3장), 일월검희는 구현 전.
- [UPCOMING_BALANCE.md](UPCOMING_BALANCE.md): 추가 예정 동료의 더미 구현 측정과 수치 제안서(2026-10-18). 확정 전이며, 측정 도구는 브랜치 `claude/upcoming-dummy-bench`.

## 고칠 때 순서

1. 코드의 수치·규칙을 바꾼다.
2. `generated-reports.mjs`로 1번 문서를 다시 만든다(안 하면 테스트가 실패한다).
3. 2번 문서에서 그 규칙을 말하는 문장을 고친다.
4. 3번 문서는 본문을 고치지 말고 맨 위 "변경" 블록에 한 줄을 더한다.
