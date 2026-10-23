# 문서 안내 (defense/docs)

숫자는 코드가 기준이다. 문서를 읽기 전에 어느 종류인지 본다.

```
docs/
├── README.md                 이 색인
├── CURRENT_VALUES.md         지금 값 (자동 생성)
├── STATUS_RULES.md           전투 상태 효과 규칙
├── ASSET_PIPELINE.md         에셋·사운드 제작 절차
├── (규칙·절차 문서)           아래 2장
├── *.json                    생성 보고서·배포 입력 (아래 1장)
├── plans/                    아직 구현하지 않은 기획·제안
├── archive/                  그날의 설계·측정 기록
└── art/ review/ performance/ 제작 보정 데이터, 검수 캡처, 성능 측정 원본
```

## 1. 지금 값 (자동 생성, 테스트가 코드와 맞는지 검사한다)

- [CURRENT_VALUES.md](CURRENT_VALUES.md): 모든 동료·유물·필살기 상수와 핵심 규칙.
- `BALANCE_SNAPSHOT.json`, `ASSET_PROVENANCE.json`: 확률·성장 곡선과 에셋 해시.
- 다시 만들기: `node defense/scripts/generated-reports.mjs`. 확인만: `--check`.
- `ASSET_OPTIMIZATION.json`: 압축본 경로·해시·용도 목록. **배포 입력이므로 일반 문서가 아니다.** `node defense/scripts/optimize-images.mjs`가 만든다.
- `ASSET_CONSISTENCY_DATA.json`: 에셋 일관성 측정값. `scripts/art/consistency-report.mjs`가 만든다.

## 2. 규칙·절차 (코드와 같이 고친다)

- [STATUS_RULES.md](STATUS_RULES.md): 독·노출·화상·제어 규칙.
- [CHARACTER_TRAITS.md](CHARACTER_TRAITS.md): 위력 계산 경로와 특성 판정 기준.
- [BOSS_AND_BUFF_RENEWAL.md](BOSS_AND_BUFF_RENEWAL.md): 버프 종류별 중첩 규칙, 보스 패턴.
- [SINGLE_HTML_OPTIMIZATION.md](SINGLE_HTML_OPTIMIZATION.md): 지금의 빌드·압축·원본 보존·검증 범위.
- [ASSET_PIPELINE.md](ASSET_PIPELINE.md): 에셋·사운드 제작과 검수 절차.
- [SOL_ASSET_AND_VFX.md](SOL_ASSET_AND_VFX.md): Sol 최종 SD 8명 설치, 역할에 따른 공격·필살기 판단표, 실제 렌더러 전후 비교와 확장 규칙.
- [GPT_IMAGE_SD_BRIEF.md](GPT_IMAGE_SD_BRIEF.md): 나노바나나로 만든 동료 6명의 SD를 GPT Image 2.5(Manus)로 다시 그리는 지시서. 참조·프롬프트·거르기·패킹 순서.
- [ASSET_CONSISTENCY.md](ASSET_CONSISTENCY.md): 동료 SD·메모리얼 일관성 평가표. 측정 도구는 `scripts/art/consistency-report.mjs`, `consistency-table.mjs`.
- [PARTNER_LINES.md](PARTNER_LINES.md): 대사.

`art/HEAD_PROFILE.json`은 키 그룹(tall·medium·short)별 머리 크기 기준이고, `art/units-manifest.json`은 `scripts/art/review-sd.mjs`가 읽는 아틀라스 프레임 목록이다. 둘 다 에셋 제작 도구의 입력이며 게임 빌드에는 들어가지 않는다.

## 3. 기획 (plans/)

- [UPCOMING_COMPANIONS.md](plans/UPCOMING_COMPANIONS.md): 추가 예정 동료. 구현되면 해당 항목에 구현 날짜와 확정 수치를 적는다.
- [SUNFLOWER_SUNMOON_PLAN.md](plans/SUNFLOWER_SUNMOON_PLAN.md): 해바라기·일월검희 구현 계획(2026-10-19). 해바라기는 구현됨, 일월검희는 구현 전.
- [UPCOMING_BALANCE.md](plans/UPCOMING_BALANCE.md): 추가 예정 동료의 더미 구현 측정과 수치 제안서(2026-10-18). 확정 전이며, 측정 도구는 브랜치 `claude/upcoming-dummy-bench`에 있다(옛 폴더명 `defense_test/` 기준).
- [CHARACTER_BALANCE_PROPOSAL.md](plans/CHARACTER_BALANCE_PROPOSAL.md): 캐릭터 밸런스 종합 제안서(2026-10-16). 일부는 8차에서 지시를 받아 반영됐다.

캐릭터 밸런스는 사용자가 의도와 수치를 검증한 뒤 지시할 때만 바꾼다. 그 전의 안은 여기에 제안서로 둔다.

## 4. 날짜 기록 (archive/)

그날의 설계·측정·검수 기록이다. 구현이 끝난 기능의 설계(제2부 새벽 온실, 능력치 리뉴얼, 합리 오토, 메모리얼, 단일 HTML 압축 등), 밸런스 차수별 기록(5·8·9·14차, 유물 7차), 미디어·성능·UI 조사가 들어 있다.

- 표의 숫자는 그날 값이라 지금과 다를 수 있다. 맨 위 "변경" 블록이 이후 달라진 곳을 적는다. 지금 값이 궁금하면 1장을 본다.
- 이 폴더의 문서는 이 게임이 `defense_test/`라는 이름이던 때 쓰였다. 본문의 경로는 지금 이름(`defense/`)으로 고쳐 두었지만, "기존 디펜스"는 삭제된 옛 Hero Core Defense를 가리킨다.
- 파일 목록은 폴더를 직접 본다. 새 기록은 날짜를 적어 이 폴더에 더한다.

## 고칠 때 순서

1. 코드의 수치·규칙을 바꾼다.
2. `generated-reports.mjs`로 1장 문서를 다시 만든다(안 하면 테스트가 실패한다).
3. 2장 문서에서 그 규칙을 말하는 문장을 고친다.
4. archive 문서는 본문을 고치지 말고 맨 위 "변경" 블록에 한 줄을 더한다.
