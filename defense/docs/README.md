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

- [SD_CAST_GUIDE.md](SD_CAST_GUIDE.md): Sol Cast V2 현행 제작 기준, 이전 일괄 교체의 기록, 실제 구조 마스터·화풍 참조, 머리/얼굴 검수와 보존 경로.

- [2026-10-27 확정 밸런스 패치](archive/2026-10-27-BALANCE_FINAL.md): 수치·카오스·사과·보호·문구·측정 도구 반영.
- [STATUS_RULES.md](STATUS_RULES.md): 독·노출·화상·제어 규칙.
- [CHARACTER_TRAITS.md](CHARACTER_TRAITS.md): 위력 계산 경로와 특성 판정 기준.
- [골드드래곤 편입·별빛 수급](archive/2026-10-29-GOLD_DRAGON.md):45해금 UR,5초 차지·개전 강화·고정 십자. [아트·재현 도구](art/gold-dragon-20261029/README.md).
- [BOSS_AND_BUFF_RENEWAL.md](BOSS_AND_BUFF_RENEWAL.md): 버프 종류별 중첩 규칙, 보스 패턴.
- [SINGLE_HTML_OPTIMIZATION.md](SINGLE_HTML_OPTIMIZATION.md): 지금의 빌드·압축·원본 보존·검증 범위.
- [ASSET_PIPELINE.md](ASSET_PIPELINE.md): 에셋·사운드 제작과 검수 절차.
- [CAST_V2_AND_BALANCE.md](CAST_V2_AND_BALANCE.md): 승인된 전체 40종 SD 설치, 성급·훈련·강화 변경과 통합 검증.
- [SOL_ASSET_AND_VFX.md](SOL_ASSET_AND_VFX.md): Sol 최종 SD 8명 설치, 역할에 따른 공격·필살기 판단표, 실제 렌더러 전후 비교와 확장 규칙. 신규 8명의 이펙트 그림은 15차에 GPT 발광 아틀라스로 바뀌었다(맨 위 변경 블록).
- [GPT_IMAGE_SD_BRIEF.md](GPT_IMAGE_SD_BRIEF.md): 나노바나나로 만든 동료 6명의 SD를 GPT Image 2.5(Manus)로 다시 그리는 지시서. 참조·프롬프트·거르기·패킹 순서.
- [ASSET_CONSISTENCY.md](ASSET_CONSISTENCY.md): 동료 SD·메모리얼 일관성 평가표. 측정 도구는 `scripts/art/consistency-report.mjs`, `consistency-table.mjs`.
- [PARTNER_LINES.md](PARTNER_LINES.md): 대사.

`art/HEAD_PROFILE.json`은 키 그룹(tall·medium·short)별 머리 크기 기준이고, `art/units-manifest.json`은 `scripts/art/review-sd.mjs`가 읽는 아틀라스 프레임 목록이다. 둘 다 에셋 제작 도구의 입력이며 게임 빌드에는 들어가지 않는다.

## 3. 기획 (plans/)

- [신규 콘텐츠 테스트 빌드](plans/CONTENT_PREVIEW_TEST.md): 2026-10-29. 별빛 서약·쌍성 원정·동료의 부탁(3명분). `build.mjs --preview`의 밝음 테스트본에만 들어간다.
- [동료 의뢰·오토 전략·미션](plans/COMPANION_REQUESTS_AUTO_STRATEGY_MISSIONS.md):2026-10-29 사용자 요청. 선호 선물·전용 대화,5인 사전 전략과 최고 기록의 시간당 효율, 조합/상황 미션. 후속 구현 과제.
- [UPCOMING_COMPANIONS.md](plans/UPCOMING_COMPANIONS.md): 추가 예정 동료. 구현되면 해당 항목에 구현 날짜와 확정 수치를 적는다.
- [FINAL_UR_AND_RELIC_IDEAS.md](plans/FINAL_UR_AND_RELIC_IDEAS.md): 마지막 UR 동료와 신규 유물 아이디어(2026-10-26). GPT 안 평가, Claude 안, Grok 답. 구현 전 제안.
- [SUNFLOWER_SUNMOON_PLAN.md](plans/SUNFLOWER_SUNMOON_PLAN.md): 해바라기·일월검희 구현 계획(2026-10-19). 해바라기는 구현됨, 일월검희는 구현 전.
- [UPCOMING_BALANCE.md](plans/UPCOMING_BALANCE.md): 추가 예정 동료의 더미 구현 측정과 수치 제안서(2026-10-18). 확정 전이며, 측정 도구는 브랜치 `claude/upcoming-dummy-bench`에 있다(옛 폴더명 `defense_test/` 기준).
- [CHARACTER_BALANCE_PROPOSAL.md](plans/CHARACTER_BALANCE_PROPOSAL.md): 캐릭터 밸런스 종합 제안서(2026-10-16). 일부는 8차에서 지시를 받아 반영됐다.

캐릭터 밸런스는 사용자가 의도와 수치를 검증한 뒤 지시할 때만 바꾼다. 그 전의 안은 여기에 제안서로 둔다.

## 4. 날짜 기록 (archive/)

- [유물 패치·조커 카오스 룰렛·드래그 상태판](archive/2026-10-30-RELIC_JOKER_PATCH.md): UR 3종 승급, 파도의 소라 리뉴얼, 신규 유물 3종(스포트라이트·로열 크라운·꿈의 결정), 카오스 룰렛 6배와 진입 순서.
- [지크 A안 어깨에 받친 대검](art/zeke-shoulder-20261029/README.md): 사용자 선택 구도의4방향 완성, 실제 오른손 구조 가이드, 두개골/발·눈 기준·셀 클리핑 검수와 실제 게임 적용.

- [마왕 초상화 상하 정렬](art/demon-portrait-20261029/README.md): 기존 PR #645에서 높은 얼굴 배치를 UI 크롭으로 보정하고 두 테마의 실제 동료·편성 화면을 비교했다.

- [토피애플 실루엣 후보 적용](art/toffee-20261028/README.md): 사용자 선택 후보의 원본·실제 입력·공통 머리/발 기준·전후 비교·배포와 초상화 검수.
- [20차: 라그나로크·애쉬·루나·원형 평타 크기·필살기 이름·컷인 설정·유물 확률](archive/2026-10-28-PASS20.md): 원형 평타의 보이는 가장자리를 판정 반경 안으로, 새 GPT 그림 세 장(라그나로크 검, 검은 태양, 루나 단검), 컷인 띠를 피한 라그나로크 낙하, 아스테아 즉사 면역, 비교 페이지 review/pass20-vfx.
- [19차: 도전 난이도·관통 사거리·지크 광폭·조커 카오스·토피애플 반경 폭발·파견 귀환·해바라기](archive/2026-10-28-PASS19.md): 배지는 다른 특성 배지와 같은 평면 기호, 화려한 그림은 카오스 룰렛과 햇빛 3개 솔라플레어에만. 전후 재생기는 [review/pass19-vfx](review/pass19-vfx/index.html).
- [주간·월간 난이도 재조정](archive/2026-10-28-CHALLENGE_RETUNE.md): 완주를 다음 해금 근처의 목표로 두고, 앵커마다 멈추는 웨이브가 갈리게 곡선을 다시 맞췄다. 해금과 보상 배율은 그대로다.
- [18차: 눈토끼·데스핸드·지크 원형과 이펙트·메모리얼·밝은 테마](archive/2026-10-26-PASS18.md): 지크 원형 측정, 마왕·미라클·지크·베히모스·별바다 장판 이펙트, 메모리얼 8편 교체와 18편 문단 재구성·대사 표시, 원정 포기·신규 동료·새벽 개방 화면. 전후 재생기는 [review/pass18-vfx](review/pass18-vfx/index.html).
- [감속·가격·베히모스 소환과 대사 수정](archive/2026-10-25-BALANCE_DIALOGUE_FIXES.md): 어비스윙 강화 중복 제거, 가격 역전 없는 연결, 베히모스 정규 UR 전환, 첨부 대사 71개·메모리얼 11편·루미 프롬프트 적용.
- [마왕 R·미라클라바 SR 구현과 비교](archive/2026-10-25-DEMON_MIRACLE.md): 네 형태·디버프 7종·별빛 기회비용·기본 치명타 5%/정원 곡선의 판단, 실제 엔진의 동일 등급 비교와 한계.
- [마왕·미라클 에셋 제작과 검수](art/demon-miracle/README.md): 원화·3D 구조 참조·2D 최종본의 구분, 지팡이 없는 자세, 후면 가림 순서와 같은 크기 비교.
- [팬텀 의상 복원과 초상화 검수](art/phantom-20261024/README.md): 2026-10-24 원화·이전 SD·수정 전후 비교, 생성 프롬프트, 기준점과 실제 UI 검증.

그날의 설계·측정·검수 기록이다. 구현이 끝난 기능의 설계(제2부 새벽 온실, 능력치 리뉴얼, 합리 오토, 메모리얼, 단일 HTML 압축 등), 밸런스 차수별 기록(5·8·9·14차, 유물 7차), 미디어·성능·UI 조사가 들어 있다.

- 표의 숫자는 그날 값이라 지금과 다를 수 있다. 맨 위 "변경" 블록이 이후 달라진 곳을 적는다. 지금 값이 궁금하면 1장을 본다.
- 이 폴더의 문서는 이 게임이 `defense_test/`라는 이름이던 때 쓰였다. 본문의 경로는 지금 이름(`defense/`)으로 고쳐 두었지만, "기존 디펜스"는 삭제된 옛 Hero Core Defense를 가리킨다.
- 파일 목록은 폴더를 직접 본다. 새 기록은 날짜를 적어 이 폴더에 더한다.

## 고칠 때 순서

1. 코드의 수치·규칙을 바꾼다.
2. `generated-reports.mjs`로 1장 문서를 다시 만든다(안 하면 테스트가 실패한다).
3. 2장 문서에서 그 규칙을 말하는 문장을 고친다.
4. archive 문서는 본문을 고치지 말고 맨 위 "변경" 블록에 한 줄을 더한다.

- [밸런스 랩](BALANCE_LAB.md): 비교·조정·모션 재생 및 제안 패치 시나리오.
