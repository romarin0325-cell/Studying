# ASTRA · 별빛 정원 — Defense collection test

기존 Defense에서 필요한 30명 캐릭터, 9종 보스, 공격 형태, 배치·합성 전투와 그림을 한 번 복사해 시작한 독립 수집/성장 테스트 게임입니다. 데이터·에셋·폰트·전투 코드가 모두 이 폴더에 있으며, 향후 밸런스와 방향은 이 소스 트리에서 별도로 관리합니다.

## 바로 실행

- `dist/StarGardenDefense.html`을 브라우저로 엽니다. 그림·음악 생성 코드·폰트·게임 코드가 포함된 오프라인 단일 파일입니다.
- 초기 동료는 별똥별소년·눈토끼·밤토끼·세이렌·명탐정 각 1명이며 항상 5명을 편성합니다.
- 새 전투는 그중 랜덤 3명으로 시작합니다. 위치 이동·교환·합성은 드래그로만 하며, 탭은 동료 정보를 표시합니다. 별빛 최대치는 120입니다.
- 하단 메뉴: 홈 / 동료 / 모험 / 소환 / 파견.
- 홈에서 파트너를 바꾸고 인사·방치 보상을 받습니다. 동료 메뉴에서 성장·중복 강화·유물 장착을 합니다.
- 전투 자동 보조는 처음에 켜져 있습니다. 소환·합성·훈련·보스 스킬을 보조하며 직접 배치, 합성, 타깃 우선순위와 스킬을 조작할 수 있습니다. 전투는 일시정지·2배속·저장 후 귀환·중도 정산을 지원합니다.
- 주간·월간 도전은 메인 3스테이지, 파견 슬롯은 9·18·27·36스테이지 클리어에서 열립니다.
- 주간 입장은 주 1회입니다. 월간 보스전은 무제한 도전으로 최고 기록을 갱신하고, 그 기록의 보상을 월 1회 직접 확정합니다. 저장된 동일 원정은 이어갈 수 있습니다.
- 설정에서 JSON 백업을 저장하고 가져올 수 있습니다. 파일을 다른 기기나 다른 브라우저로 옮길 때 백업도 옮깁니다.

## 개발

저장소 루트의 잠긴 의존성을 설치한 뒤 실행합니다.

```powershell
npm ci
node defense_test/scripts/generated-reports.mjs
node defense_test/scripts/build.mjs
node defense_test/scripts/serve.mjs
npm run verify:plan
npm run verify
```

빌드 서버: http://127.0.0.1:4178/ . 폴더의 원본 `index.html`은 빌드 템플릿이므로 완성된 HTML로 실행합니다.

루트 검증은 이 신규 게임의 관련 계약·브라우저 검증만 선택합니다. 활성 Defense나 다른 게임의 런타임 검증을 호출하지 않습니다. 캐릭터·유물·보스·그림 영역의 정의는 `src/data.js`, 원본 그림은 `assets/merge`와 `assets/moonlit`, 폰트와 SIL OFL 라이선스는 `assets/Jua-Regular.ttf`와 `assets/Jua-OFL.txt`에 있습니다. 빌드·보고서·테스트에서 다른 게임 폴더를 읽지 않습니다.

`build.mjs`는 HTML만 생성합니다. 수치나 데이터·에셋을 바꾸면 `generated-reports.mjs`로 두 JSON 보고서를 재생성하고 함께 커밋합니다. `node defense_test/scripts/generated-reports.mjs --check`는 현재 구현·이미지·폰트에서 결과를 다시 계산해 저장된 JSON과 비교하며 파일을 덮어쓰지 않습니다. JSON 단독 변경·삭제·이름 변경도 루트 검증에서 비교 검사를 선택합니다.

## 설계와 검증 자료

- [UI·에셋 조사와 화면별 설계](docs/UI_ASSET_RESEARCH.md)
- [능력치 리뉴얼 v1: 등급 예산·성장 경로·전체 캐릭터 시트](docs/STAT_RENEWAL.md)
- [기여도 시뮬레이션: 측정 방법과 리뉴얼 전후 결과](docs/STAT_SIMULATION.md) · `node defense_test/scripts/simulate.mjs`
- [성장·확률·경제 공식과 설정 이유](docs/GROWTH_BALANCE.md)
- [기능별 합격 기준과 실제 검증](docs/ACCEPTANCE.md)
- [독립 소스 트리와 생성물 검증 보완](docs/INDEPENDENCE_VERIFICATION.md)
- [월간 기록·캐릭터별 전투 연출·조작 설계](docs/COMBAT_POLISH.md)
- [전용 필살기 에셋 생성 기록](docs/ULTIMATE_ASSET_PROMPT.md)
- [단발 성능 측정과 적용 판단](docs/PERFORMANCE_REVIEW.md)
- [실제 구현에서 재생성한 수치](docs/BALANCE_SNAPSHOT.json): `node defense_test/scripts/analyze.mjs`
- [원본 에셋 경로·크기·SHA-256](docs/ASSET_PROVENANCE.json)

수치 조정의 출발점은 `src/data.js`의 캐릭터·유물·보스 정의, `src/content.js`의 `TUNING`과 스테이지 구성, `src/economy.js`, `src/combat/engine.js`의 `wavePlan`입니다. 초기 복사본의 능력치를 유지했지만 기존 Defense 데이터와 동일해야 한다는 테스트 제약은 제거했습니다. 저장 키는 `astra.star-garden.test.v1`입니다. 서버가 없는 테스트라 기간과 파견은 기기 시계를 사용하며, 실제 단말 성능과 장기 잔존율은 별도 플레이테스트 대상입니다.
