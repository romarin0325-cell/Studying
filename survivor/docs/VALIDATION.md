# Nightfall 현재 검증

2026-10-04 JST / 2026-10-03 UTC, 최신 main `34a0c13`을 기준으로 전투 보행·신규 지역·무기·유물·융합을 통합했습니다. `npm run verify`가 97.25초에 통과했습니다: 계약/회귀 59개, 실제 통합 HTML 빌드, Chromium 5화면, WebKit 3화면, 변경 JavaScript 문법 검사입니다.

배포 HTML은 **8,367,880 bytes / 7.9802 MiB / 39 embedded textures** 입니다. 위 용량·SHA는 실제 검사한 Windows 저장 파일 기준입니다. Git의 LF 파일은 8,367,648bytes / SHA-256 `f652bc33d1232075ca9b9f9b812b0be94c421a57ad25d6040ea982367f5e8385`이며 줄바꿈을 정규화한 내용은 동일합니다. 작성 검수용 캐시 48개와 배포의 39개는 구분합니다. 논리 RGBA 카탈로그는 86.4785 MiB이며 8 MiB 파일/88 MiB 카탈로그 계약을 유지합니다.

[현재 상세 검증](nightfall/VALIDATION.json) · [실제 명령 출력](nightfall/verify-local.txt) · [현재 아트/기획/저장 규칙](nightfall/README.md) · [지크·루나 좌우 보행](nightfall/review/combat-walk-96.gif) · [수치 19/20단계와 게임 화면](nightfall/screens/). 머리의 의미는 두개골·턱 기준이며 귀·머리카락·무기를 제외합니다. 양손 대검과 단검의 보행은 전체 측면 주기를 반전해 단계가 대응하며, 반전된 손 표현과 수동 계측의 불확실성을 문서화했습니다.

실제 Windows 데스크톱 브라우저 검증입니다. 물리적 휴대폰의 성능·발열·터치 지연과 재미 평가는 별도입니다. 아래 기록은 이전 Atelier 패치의 검증을 보존한 것입니다.

---

# Survivor 전신 재생성 후속 검증

2026-10-03 UTC, PR #570이 병합된 최신 main `b674af6d4e944afb828046d260a82f4823ca705d`에서 최종 검증했습니다. 제작/이미지 비교 기준은 `c958f64`이며, 작업 중 병합된 Defense PR #571을 보존해 새 main에 재배치했습니다. 필수 `npm run verify`가 **계약·회귀 검사 50개, 배포 HTML 빌드 1회, 실제 Chromium 5화면/WebKit 3화면, 변경 JS 문법 검사 모두 통과**했습니다. 총 57.62초입니다. [원자료 JSON](ATELIER-VALIDATION.json) · [실제 명령 출력](atelier/verify-local.txt) · [검증 계획](atelier/verify-plan.txt).

```sh
LD_LIBRARY_PATH=/workspace/review/webkit-libs/root/usr/lib/x86_64-linux-gnu \
PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 npm run verify
```

이 환경의 기존 Debian13 사용자 디렉터리 WebKit 라이브러리를 사용했습니다. Playwright 시스템 패키지 목록 검사만 생략했고 실제 WebKit은 실행했습니다. 일반 명령만으로 성공했다고 주장하지 않습니다. CI는 기존 `--with-deps`를 그대로 사용합니다.

검증한 실제 `dist/AstraNocturne.html`: **8,171,951bytes / 7.7934MiB / 텍스처 44개**, SHA-256 `e12270bc6e6625ef5882c368b756eb6b682fb978f923d40fc816ffb125e1ea08`. 외부 HTTP 요청·브라우저 오류 0입니다. 다른 게임 실행 코드나 검증 정책은 변경하지 않았고 Card·Shooter·Defense 검사를 실행하지 않았습니다.

| 실제 배포 파일 검사 | 화면 | 확인 내용 |
| --- | --- | --- |
| Chromium | 390×844, 360×640, 320×568, 844×390, 1280×900 | 9인 선택, 메뉴/하단 도크·팝업 경계, 터치 이동·두 번째 손가락 우측 회피, 도감·설정, 저장·새로고침·이어가기·창 전환 |
| Chromium | 390×844 | 실제 전체화면 진입/해제, F키 및 버튼 상태 동기화 |
| WebKit | 390×844, 844×390, 1280×900 | 터치·키보드·회피, 창 전환·재개, 실제 파일 백업 복원, 화면 회전 |

[새 모바일 로비](atelier/home-390-initial.png) · [PC 로비](atelier/home-1280-initial.png) · [일반 입력 후 일시정지](atelier/pause-390-input-play.png). 이 사진은 실제 배포 파일의 일반 키보드/버튼 입력입니다. 필살기/후반/6보스·진화·희귀 상태 검사는 별도 테스트 HTML의 제어된 fixture도 사용하며 실제 기본 흐름과 구별합니다.

아트 계약 10개는 14인의 원본 해시·불투명 흰 의상·네 방향과 빈 셀 테두리, 9인의 실제 보행·프레임별 발축·전신 균등 배율·clip 거절·무기 손별 측면 출처·정확한 알파 반전·같은 passing 전신/도감 캐시·논리 메모리 예산을 검사합니다. 표정·해부학·손 정체성의 의미는 픽셀 검사만으로 보증하지 않습니다. 수동 검토로 원화·후보·64/96px 밝고 어두운 바닥·좌우 주기·전 인물을 확인했습니다.

전신 재생성 18개 중 선택 원본 9개와 탈락 후보 9개를 기록했습니다. BODY_PROFILE v3의 원본 비율을 보존하며 머리/몸통/다리를 잘라 늘리지 않습니다. 명목 머리144px와 별도로 실제 정지 포즈의 턱 아래 높이는 은토끼 141.1px, 눈토끼 163.8px, 밤토끼 172.0px, 자스민 200.3px, 시간의지배자 225.1px입니다. 귀·무기·옷이 포함된 bbox로 신체 크기를 계산하지 않습니다. 가려진 두개골/골반은 수동 추정이며 등신 가이드의 정확한 강제나 업계 오차 기준을 주장하지 않습니다.

[전체 14명](atelier/cast-all.png) · [이전 main/현재 비교](atelier/comparison.png) · [좌우 GIF](atelier/walking-dark.gif) · [18개 원본/후보 해시](atelier/candidate-hashes.json) · [30개 추가 시도 기록](atelier/trials.txt). GIF는 작성용 160ms 간격이며 게임 FPS가 아닙니다.

전체 캐시의 논리 RGBA 크기는 86.9043MiB로 기존88MiB 계약 이하, 보행은 최근2명만 디코딩합니다. 캐시·시트 크기와 런타임 렌더링 코드는 유지했고 매 프레임 픽셀 처리를 추가하지 않았습니다. 현재 클라우드 Chromium의 260적 동기 작업 90프레임 표본은 평균 9.36ms입니다. 휴대폰의 장시간 FPS·열·터치 지연이나 브라우저/GPU 총 메모리로 표시하지 않습니다.

이전 UI·우측 회피·6개 보스·중간/새벽 이후60초 보스·밸런스와 48개 방법/11개 게임 조사는 병합된 PR #570의 [ORDEAL 기록](ORDEAL-VALIDATION.json)과 [조사 자료](ordeal/research-games.md)에 보존했습니다. 이번 코드는 그 전투/진행/저장 구현을 보존하며 필수 회귀 검증을 실제 다시 실행했습니다. 이전 조사·인풋 파일럿 수치를 이번에 새로 실행했다고 주장하지 않습니다.
