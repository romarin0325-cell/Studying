# 단일 HTML 최적화와 현재 빌드 규칙

2026-10-23, 기준 `07effc4`(PR #623). 일반판 30,342,850 B / Bright 30,375,098 B에서 시작했다. 화질은 사용자가 압축 전후를 보고 판단한다. 이 작업은 그림을 재생성하지 않고 인코딩과 배포 경로만 바꾼다.

## 압축 패스와 사용처

| 패스 | 설정·대상 | 배포 사용처 |
| --- | --- | --- |
| 1. 미사용 내장 제외 | `blessings`, `relics`, `relics-expansion`, `relics-new` 4장 | 빌드 원본으로 보존; HTML·전투 preload에서 제외 |
| 2. 동료 전투 아틀라스 | 동료 39명+변신 1장, 1024→640, WebP q90 / alpha100 / effort6 | 전투 방향별 스프라이트. 원본 좌표는 유지하며 렌더러가 실제 너비에서 셀을 계산 |
| 3. 정적 이미지 | 필살기 WebP q90, 다른 아틀라스·밝은 배경 q85, 서재 그림 q82 / effort6 | 전투 이펙트·보스·배경·홈·소환·온실·서재 |
| 4. 메모리얼 | 720×1080 유지, AVIF q45 / effort6 / 4:4:4, WebP q76 / effort6 | 일반·Bright 본편 AVIF; 호환판 WebP; 웹 폴더판 양 포맷 |
| 5. UI 파생 이미지 | 초상화 240² q84, 전신 512² q85, 유물 240² q82, 앨범 240×360 q68 | 원본 보관본에서 직접 생성. 작은 목록용 그림을 유지 |
| 6. 텍스트·빌드 | CSS minify, JS minify 유지, 일반/Bright 공통 에셋·JS 한 번 처리 | 정식 단일 HTML 두 파일. 폰트·음악은 기존 WOFF2·Ogg Opus 유지 |

출력이 입력보다 작을 때만 별도 압축본을 채택한다. 현재 이미지 입력 158개 중 4개는 빌드 전용, 148개는 더 작은 별도 파일, 6개는 기존 바이트 유지다. 한 HTML에 본편 AVIF와 본편 WebP를 동시에 넣지 않는다. 압축 문자열 내장과 실제 이미지 디코딩은 별개다.

## 원본 보존과 경로 색인

제작 PNG가 Git에 없으므로 기존 `assets/merge`, `moonlit`, `bright`, `library`, `memorial`, `memorial-webp` 파일 전부를 압축 전 보관본으로 그대로 남겼다. 압축본은 `assets/optimized/` 아래 같은 하위 경로에 둔다. 소스·압축본을 둘 다 Git에 보관한다. 이는 원본 삭제나 Git 이력 재작성으로 용량을 줄이는 작업이 아니다.

- [전체 이미지별 경로·용도·설정·해시·해상도·바이트](ASSET_OPTIMIZATION.json): 실제 파일 검증에 사용하는 단일 목록.
- [압축 전후 비교 페이지](asset-optimization-review.html): 두 파일 링크, 밝은/어두운 바닥, 동료 정면 비교. `docs` 폴더 위치에서 열어야 상대 경로가 맞는다.
- `scripts/image-policy.mjs`: 압축 프로필, UI 파생 설정, Bright 교체 경로와 각 원본의 사용처.
- `src/asset-policy.js`: 빌드 전용 4장과 런타임 목록을 구분한다. 내장 제외 파일을 preload가 상대 경로로 요청하지 않게 한다.
- 폰트 원본 `assets/Jua-Regular.ttf`, 배포 `Jua-Regular.woff2` 둘 다 유지. BGM `assets/audio/*.ogg`는 그대로다.

## 변경 종류별 빌드 판단

| 바뀐 입력 | 실행과 커밋 |
| --- | --- |
| 원본 이미지·압축 프로필·이미지 목록 | `node defense/scripts/optimize-images.mjs` 한 번; 생성 압축본·목록·비교 HTML을 함께 커밋하고 게임 빌드 한 번 |
| 게임 코드·CSS·문구 | 압축 패스 생략. 게임 빌드 한 번 |
| 일반 문서 | 제품 빌드·테스트 생략 |
| 원본 수치·그림·폰트 자체 | 해당 원본 provenance/수치 보고서만 갱신. 배포 압축만 바꾸면 과거 보고서 재생성 불필요 |

정식 빌드는 `node defense/scripts/build.mjs` 한 번으로 일반판과 Bright를 둘 다 출력한다. 공통 파생 그림·음악·JS를 한 번 만들고 테마 CSS와 배경만 바꾼다. 영속 캐시는 만들지 않는다. CI와 `--check`는 두 커밋 파일을 현재 입력과 비교하고 불일치하면 실패한다. 줄바꿈은 LF로 정규화한다. 기존 `--bright`, `--solo`, `--compat`, `--web`, `--unlocked` 모드는 유지한다. 호환판 Base64 예산은 기존 WebP 바이너리 4 MiB 예산에 맞춰 5.5 MiB로 분리했다.

일반 빌드는 압축본과 보관본의 해시·코덱·해상도·알파·이미지 목록/프로필 일치를 검사한다. 변경된 원본을 이전 압축본과 섞지 않으며 갱신 명령을 안내하고 중단한다. 메모리얼 수동 준비 도구의 31명 고정 검사를 현재 HEROES 목록 비교로 바꿨다.

## 측정과 확인 범위

현재 결과는 `test-results/build-size-standalone.json`, `build-size-standalone-bright.json`에서 범주별로 확인한다.

| 배포판 | 이전 | 현재 | 절감 |
| --- | ---: | ---: | ---: |
| 일반 | 30,342,850 B / 28.937 MiB | 18,438,239 B / 17.584 MiB | 39.23% |
| Bright | 30,375,098 B / 28.968 MiB | 18,513,710 B / 17.656 MiB | 39.05% |

일반판 내장 아틀라스는 20,046,909→9,406,164 B, 초상화 1,199,737→1,048,729 B, 전신 2,459,999→2,050,563 B, 유물 아이콘 734,119→638,427 B, 메모리얼 본편 2,321,442→1,806,622 B, 썸네일 656,330→596,430 B다. 두 테마 공통 생성은 로컬 204.97초였다. 이 수치는 빌드 속도 개선의 전후 비교가 아니다.

`npm run verify`의 빌드·에셋 검사 4개가 통과했다. 빌드 판단 변경은 선택기 검사 35개로 확인했다. `docs/ASSET_OPTIMIZATION.json`은 일반 문서가 아닌 배포 입력이며, `image-policy.mjs`, `image-pack.mjs`, `theme-bright.mjs`만 바뀌어도 해당 게임 빌드 한 번을 선택한다. 일반 Markdown와 과거 분석 JSON은 여전히 제품 검증을 선택하지 않는다.

오프라인 확인 명령은 `node defense/scripts/review-optimized-release.mjs`다. Chromium 390×844에서 일반/Bright의 홈·동료 상세·메모리얼·실제 필살기를 발동한 전투 8개 화면을 확인했다. 페이지 오류 0, HTTP/HTTPS 및 외부 에셋 파일 요청 0, 가로 overflow 0이었다. 메모리얼은 720×1080으로 디코딩됐다. 해당 화면 캡처와 요약은 고정된 `test-results/optimized-release/`에 저장한다. 파일 크기 감소나 RGBA 픽셀 수 감소를 FPS 개선 측정으로 해석하지 않는다. 화질 승인과 실제 Android/iOS 성능은 별도다.

과거 측정 `MEDIA_EFFICIENCY.md`, `FONT_OPTIMIZATION.md`, `MEMORIAL_MEDIA.md`는 당시 결과로 유지하고 현재 수치의 근거로 사용하지 않는다. 일반 문서·빌드 규칙 변경 때문에 과거 시뮬레이션이나 다른 게임 검증을 실행하지 않는다.
