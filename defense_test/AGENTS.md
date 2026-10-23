# Star Garden build and asset delivery

상위 `AGENTS.md`의 기능·범위별 검증 원칙을 따른다. 2026-10-23 이후의 배포 규칙은 다음과 같다.

- 압축 전 `assets/merge`, `moonlit`, `bright`, `library`, `memorial`, `memorial-webp` 파일을 덮어쓰거나 삭제하지 않는다. 제작 PNG가 Git 밖에 있으므로 복구 가능한 보관본이다. 새 그림도 원본이 Git에 없으면 가공 전 파일과 압축본을 모두 보관한다.
- 배포 압축본은 `assets/optimized/`, 설정·용도는 `scripts/image-policy.mjs`, 실제 경로·해시·해상도·용량·보존 판단은 `docs/ASSET_OPTIMIZATION.json`에서 관리한다. 이전 압축 결과를 재압축하지 않는다.
- `docs/ASSET_OPTIMIZATION.json`은 배포 입력이다. 일반 문서로 취급해 빌드를 생략하지 않는다. 압축 정책/검증 도구 및 Bright CSS 변환 도구 변경도 해당 게임 빌드를 선택한다.
- 이미지/압축 설정을 바꿀 때만 `node defense_test/scripts/optimize-images.mjs`를 한 번 실행한다. 일반 빌드는 커밋된 압축본을 검증해서 읽는다.
- `node defense_test/scripts/build.mjs` 한 번으로 일반판과 Bright를 함께 갱신하고 둘 다 커밋한다. `--bright`나 `--unlocked` 출력은 정식 두 파일 갱신을 대신하지 않는다. CI와 `--check`는 커밋된 파일의 입력 일치를 검사한다.
- 초상화·전신·유물 아이콘은 보관한 원본에서 직접 자른다. 축소 전투용 압축본에서 다시 자르지 않는다. 단일 HTML에는 메모리얼 본편 한 코덱만 넣고 작은 앨범 썸네일을 유지한다.
- `src/asset-policy.js`의 런타임/빌드 전용 구분을 내장과 preload에 같이 적용한다. 내장 제외 파일의 오프라인 상대 경로 요청을 만들지 않는다.
- 배포 압축만 바뀌면 밸런스·원본 provenance 보고서를 재생성하지 않는다. 원본 데이터나 그림이 바뀌었을 때만 해당 보고서를 갱신한다. 현재 안내는 `docs/SINGLE_HTML_OPTIMIZATION.md`; 과거 측정은 날짜가 있는 기록으로 유지한다.
- 변경 이미지와 두 테마를 Chromium 390×844에서 짧게 확인한다. 다른 게임·여러 브라우저·장시간 전투는 기본 실행하지 않는다. 파일 크기, 실제 FPS, 화질 승인을 구별해 보고한다.
- 작업 전에 여유 공간을 확인한다. 기존 worktree를 우선 사용하고, 디스크가 부족하면 필요한 게임만 sparse checkout하고 의존성을 재사용한다. 불필요한 저장소/node_modules/검토 자료 복제를 피한다. 임시 결과는 고정 `test-results/` 경로를 재사용하며 정규 빌드에 영속 이미지 캐시나 날짜별 사본을 추가하지 않는다. 기존 자료는 사용자 지시에 따라 관리하며 무단 삭제하지 않는다.
