# 메모리얼 검증 자료 보관·재현

2026-10-05 효율 개선 기준. 최종 숫자는 [summary.json](summary.json), 채택/보류 근거는 [메모리얼·배포 효율 개선](../../MEDIA_EFFICIENCY.md)에 있다.

저장소에는 이 설명, 간결한 최종 요약JSON1개, 대표320×568·390×844 독서 화면 각1개를 남긴다. 대표 화면은 Chromium 기본 AVIF판의 실제 버튼 조작 캡처다. 반복 화면, 전체 canvas true-peak, Playwright 좌표 dump는 Git 제외 `defense_test/test-results/`로 이동했다. 기존 PR #580 자료는 로컬 `test-results/archived-pr580-review/`에 남는다. 이미 merge된 과거 Git history를 다시 쓰지 않는다.

일반 빌드에는 원본 PNG, Python, 휴대폰, 미디어 준비 도구가 필요 없다.

```powershell
node defense_test/scripts/build.mjs
node defense_test/scripts/build.mjs --compat
node defense_test/scripts/build.mjs --web
npm run verify:plan
npm run verify
```

기존 검증이 생성한 최상위 PNG/JSON은 GitHub Actions의 `defense-memorial-review` artifact로7일 보관한다. 이 업로드에는 테스트·새 요구 체크가 추가되지 않으며, 원본 PNG·전체 후보·임시 라이브러리·복수HTML은 제외한다. 배포 HTML과 Git HEAD 빌드 결과 대조는 기존 브라우저 검사에 그대로 있다.

이번에만 추가 측정한 준비/폰트/빌드단계/heap/전투 고부하 실험은 `test-results/.media-review/`, `font-audit/`, `runtime-bench/`, `memorial-memory-audit.json`, `memorial-build-phase.json`에 있다. 이 임시 도구를 일반 빌드/CI에 등록하지 않았다. 전체 기존 unit90개와 selector fixture33개도 이번에 실행했다. 새 unit case나 브라우저 case를 추가하지 않았다.

브라우저는320×568·390×844·1280×900에서 이미지 비율/본문90px/고정 조작/가로 스크롤/30장 순회/읽던 위치/지연 decode 닫기/AVIF 오류/폴더 WebP fallback/호환판/전투 복귀를 기존 검사로 확인한다. 초기·잠금·목록에는 CG0개, 열린 CG최대1개다. 프로필에는 문단/읽음만 보관하고, CG는 전투 아틀라스·LocalStorage에 저장하지 않는다.

CDP의 `HeapProfiler.collectGarbage`, `Memory.getDOMCounters`, `Performance.getMetrics`로 같은 홈 상태의 전후 DOM/JS heap을 측정했다. GC후 수치는 브라우저의 압축 이미지 캐시나 GPU 메모리를 포함하지 않는다. 앱 참조·DOM이 누적되는지의 보조 지표이며 전체 메모리의 즉시 해제나 물리적 휴대폰 성능을 인증하지 않는다.

이 PC에서 실제 Galaxy·iPhone 검증 장비를 확인하지 못했다. Windows Chromium147/WebKit26.4 통과를 실제 Android/iOS 인증으로 대체하지 않는다. 기기명·OS·브라우저·판본·30장순회·백그라운드복귀·강제종료·화질·전투복귀를 추후 실제 기기에서 기록할 수 있으나 새 반복 게이트로 추가하지 않았다.
