# 드림위버: 별빛 정원 — DREAMWEAVER 외전 디펜스

동료 39명과 보스 9종이 나오는 수집/성장 디펜스 게임입니다. 저장소의 정식 Defense이며(`defense_test/`에서 승격, 옛 Hero Core Defense는 삭제), 데이터·에셋·폰트·전투 코드는 모두 이 폴더에 있습니다. 현재 배포·압축·원본 보존 안내는 [단일 HTML 빌드](docs/SINGLE_HTML_OPTIMIZATION.md), 작업 규칙은 [AGENTS.md](AGENTS.md)를 봅니다.

## 바로 실행

- `dist/StarGardenDefense.html`(일반판) 또는 `dist/StarGardenDefenseBright.html`(Bright)를 브라우저로 엽니다. 그림·BGM·폰트·게임 코드가 포함된 오프라인 단일 파일입니다.
- 초기 동료는 별똥별소년·눈토끼·밤토끼·세이렌·명탐정 각 1명이며 항상 5명을 편성합니다.
- 새 전투는 그중 랜덤 3명으로 시작합니다. 위치 이동·교환·합성은 드래그로만 하며, 탭은 동료 정보를 표시합니다. 별빛 기본 최대치는 120이고, 별이슬 샘 레벨마다 1씩 늘어납니다.
- 하단 메뉴: 홈 / 동료 / 모험 / 소환 / 파견.
- 홈에서 파트너와 대화하고, 인사·선물·별똥별(방치 보상)·꿈의 온실을 합니다. 동료 메뉴에서 성장·중복 강화·유물 장착을 합니다.
- 전투 자동 보조는 처음에 켜져 있습니다. 소환·합성·훈련·보스 스킬을 보조하며 직접 배치, 합성, 타깃 우선순위와 스킬을 조작할 수 있습니다. 전투는 일시정지·2배속·저장 후 귀환·중도 정산을 지원합니다.
- 주간·월간 도전은 쉬움이 메인 3스테이지, 어려움이 36, 심연이 72에서 열립니다. 라인업은 메인에서 만난 보스만 씁니다. 만난 순서로 최대 9종이고, 이번 주 스테이지는 주 번호를 만난 수로 나눈 나머지에 1을 더한 값입니다. 파견 슬롯은 9·18·27·36스테이지 클리어에서 열립니다.
- 주간 입장은 주 1회입니다. 월간 보스전은 무제한 도전으로 최고 기록을 갱신하고, 그 기록의 보상을 월 1회 직접 확정합니다. 저장된 동일 원정은 이어갈 수 있습니다.
- 설정에서 JSON 백업을 저장하고 가져올 수 있습니다. 파일을 다른 기기나 다른 브라우저로 옮길 때 백업도 옮깁니다.

## 개발

저장소 루트의 잠긴 의존성을 설치한 뒤 실행합니다.

```powershell
npm ci
npm run verify:plan
npm run verify
node defense/scripts/serve.mjs
```

단위·계약 테스트는 `npm run test:defense`, 오프라인 브라우저 검증은 `npm run test:defense:browser`, 빌드는 `npm run build:defense`입니다.

빌드 서버: http://127.0.0.1:4178/ . 폴더의 원본 `index.html`은 빌드 템플릿이므로 완성된 HTML로 실행합니다.

루트 검증(`npm run verify`)은 이 게임의 관련 계약·브라우저 검증만 선택하고 다른 게임의 런타임 검증을 호출하지 않습니다. 캐릭터·유물·보스·그림 영역의 정의는 `src/data.js`, 원본 그림은 `assets/merge`와 `assets/moonlit`, 폰트와 SIL OFL 라이선스는 `assets/Jua-Regular.ttf`와 `assets/Jua-OFL.txt`에 있습니다. 빌드·보고서·테스트에서 다른 게임 폴더를 읽지 않습니다.

선택기는 변경한 게임의 필요한 검사와 빌드만 수행합니다. 직접 빌드할 때는 `node defense/scripts/build.mjs` 한 번으로 일반판과 Bright를 함께 생성합니다. 이미 빌드했다면 같은 입력을 다시 빌드하지 않습니다. CI는 정식 두 파일과 현재 입력을 비교합니다. `--solo`, `--compat`, `--web`, `--unlocked` 테스트 출력은 CI에서도 생성합니다. 명시적 `--check`는 지정한 출력의 비교 검사입니다.

이미지나 압축 설정을 바꿀 때만 먼저 `node defense/scripts/optimize-images.mjs`를 실행해 별도 압축본과 경로·용도 목록을 갱신합니다. 원본 그림은 보존합니다. `build.mjs`는 정적 압축본과 `assets/optimized/ui/`의 초상화·전신·유물 아이콘·앨범 썸네일을 검증해 읽고 HTML과 `test-results/build-size-*.json`을 출력합니다. 일반 코드를 수정할 때 압축 팩을 다시 생성하지 않습니다. UI 자르기 좌표나 UI 프로필만 바꾸면 `node defense/scripts/optimize-images.mjs --derived-only`를 실행합니다.

자동화에서 `node defense/scripts/build.mjs --solo --outdir <임시폴더>`처럼 출력 위치를 격리할 수 있습니다. `node --test defense/tests/build.test.mjs`는 빈 출력 폴더의 CI 테스트 빌드, 일반/Bright 비교 검사, 이미지 재인코딩 금지를 확인합니다.

원본 수치·데이터·그림이 실제로 바뀔 때만 해당 `generated-reports.mjs` 보고서를 갱신합니다. 배포 압축만 바뀌는 작업에 밸런스 보고서 재생성을 요구하지 않습니다.

| 작업 | 소스/기록 |
| --- | --- |
| 규칙·캐릭터·유물 | `src/content.js`, `src/data.js`, `src/combat/engine.js` |
| 화면·테마 | `src/app.js`, `src/style.css`, `src/theme-bright.css`, `scripts/theme-bright.mjs` |
| 원본·압축본 경로/용도/해시 | [ASSET_OPTIMIZATION.json](docs/ASSET_OPTIMIZATION.json) |
| 압축 설정·대상·UI 자르기/사용처 | `scripts/image-policy.mjs`, `scripts/optimize-images.mjs` |
| 내장/preload 대상 | `src/asset-policy.js` |
| 단일 HTML·용량 보고서 | `scripts/build.mjs` |
| 메모리얼 선택/스토리 | `src/memorial-media.js`, `src/memorial.js` |

## 문서

[docs/README.md](docs/README.md)가 색인입니다. 지금 수치는 [CURRENT_VALUES.md](docs/CURRENT_VALUES.md), 상태 효과 규칙은 [STATUS_RULES.md](docs/STATUS_RULES.md), 에셋 제작 절차는 [ASSET_PIPELINE.md](docs/ASSET_PIPELINE.md), 빌드·압축 규칙은 [SINGLE_HTML_OPTIMIZATION.md](docs/SINGLE_HTML_OPTIMIZATION.md)에 있습니다. 구현 전 기획은 `docs/plans/`, 과거 설계·측정 기록은 `docs/archive/`입니다. 수치 재생성: `node defense/scripts/analyze.mjs`(밸런스 스냅샷), `node defense/scripts/simulate.mjs`(기여도 시뮬레이션).

수치 조정의 출발점은 `src/data.js`의 캐릭터·유물·보스 정의, `src/content.js`의 `TUNING`과 스테이지 구성, `src/economy.js`, `src/combat/engine.js`의 `wavePlan`입니다. 저장 키는 `astra.star-garden.test.v1`입니다. 서버가 없는 테스트라 기간과 파견은 기기 시계를 사용하며, 실제 단말 성능과 장기 잔존율은 별도 플레이테스트 대상입니다.
