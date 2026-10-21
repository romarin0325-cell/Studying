# DREAMWEAVER · Synapse Edition (DeepSeek)

세 번째 UI 비교 빌드입니다. `card/`(Astra)와 `card_claude/`(Argon)가 **같은 규칙·데이터·저장 형식**을 공유하듯, 이 폴더도 `card/game`의 컨트롤러를 그대로 쓰고 **표현 계층만** 딥시크(DeepSeek)의 시각 언어로 다시 설계했습니다. 게임 로직은 한 줄도 바꾸지 않았습니다.

```sh
node card_deepseek/build.mjs          # -> card_deepseek/dist/DREAMWEAVER-DeepSeek.html (약 2.71 MiB)
node card_deepseek/tests/smoke.mjs    # 6개 뷰포트 · 5개 시나리오 자동 검증
```

- 산출물은 **단일 HTML**이며 CDN·외부 폰트·이미지 요청이 없습니다. `file://`에서 그대로 열립니다.
- 폰트는 `card_claude/assets/dreamsans-subset.woff2`(Noto Sans KR 서브셋, 400–900)를 재사용하고, 라벨에는 시스템 모노스페이스, 워드마크에는 세리프를 씁니다.
- 카드 뒷면 3종(`card-back-*.svg`)은 세로 360×600(3:5)으로 새로 그렸습니다. 도감·파티·전투의 3:5 아트 웰에 `object-fit:cover`로 빈틈 없이 채워집니다.

## 컨셉트: SYNAPSE

"심해 신경 기록관" — 플레이어는 단어를 실로 엮어 기록을 복원하는 방직공(WEAVER)입니다.

| 요소 | 값 | 쓰임 |
| --- | --- | --- |
| DeepSeek blue | `#4d6bfe` | 주 액션, 활성 내비게이션, 링크 |
| Cyan | `#5ce1ff` | HUD 수치, 마이크로 라벨, 포커스 |
| Void navy | `#04060d` ~ `#101a30` | 배경과 패널 |
| Violet | `#a78bfa` | 마법 계열 스킬 |
| Gold | `#ffcf6b` | 전설 등급, 특성 칩 |

모든 표면은 `body.ds` 프리픽스 아래에서만 동작하는 추가 레이어입니다. `card/src`의 레이아웃 규칙(astra/mobile/polish)은 상속하되, 밝은 테마 전용 색을 강제하던 `themes.css`는 번들에서 제외하고 딥시크 팔레트로 대체했습니다.

## 화면별 설계

1. **타이틀** — 세리프 워드마크 + CSS로만 그린 키 비주얼(부채꼴 카드 3장, 홀로그램 플레이트, 틱 눈금). 900px 이상에서는 좌측 카피 / 우측 키 비주얼의 2단 히어로로 전환됩니다.
2. **로비** — 파티 카드를 두꺼운 프레임의 히어로로 키우고, `NEXT ENCOUNTER` 패널에 단계·진행 트랙·출전 버튼을 한 덩어리로 묶었습니다. 데스크톱에서는 좌우 2단으로 정렬됩니다.
3. **편성/도감** — 카탈로그 그리드의 3:5 아트 웰과 등급/속성/역할 배지를 유지하면서, 검색·등급·보유 필터바를 HUD 스타일로 재구성했습니다.
4. **카드 상세** — `label: value / label: value` 한 줄로 출력되던 스탯을 런타임에서 파싱해 2열 스탯 그리드로 쪼개고, 특성은 금색 칩으로 승격했습니다. 원문이 형식에 맞지 않으면 컨트롤러가 쓴 그대로 둡니다.
5. **학습** — 4개 학습 카드 아래에 실제 저장 데이터(`quiz_stats`, `inventory`)만 읽는 `STUDY LEDGER`와 LUMI NOTE를 배치해 세로 여백을 정보로 채웠습니다.
6. **전투** — 무대에 플랫폼 글로우와 원근 그리드를 깔고 액터를 중앙 정렬, 로그는 고정 높이 스크롤 영역으로 분리해 스테이지와 로그의 균형을 맞췄습니다.
7. **모드 선택/뽑기/설정** — 01–12 번호가 붙은 HUD 목록, 등급 연출, 설정 시트까지 같은 프레임 언어를 유지합니다.

## 기능 보존 경계

- `card/game/*.js`와 `card/game/index.html`의 컨트롤러를 **빌드 시점에 그대로 인라인**합니다. 데이터·밸런스·세이브 스키마·핸들러 ID는 `card/`와 동일합니다.
- `src/deepseek.js`는 `Astra`와 `RPG`의 **렌더 결과만 장식**합니다. 세이브를 읽거나 쓰지 않고, 기존 콜백을 대체하지 않습니다.
- 화면 전환, 중첩 모달 포커스, 필수 퀴즈 선택, 전체화면, 음악 플레이어, 포춘쿠키 등 기존 동작을 그대로 씁니다.

## 구조

| 경로 | 역할 |
| --- | --- |
| `build.mjs` | 셸 + 컨트롤러 + 상속 CSS + 자산을 단일 HTML로 인라인 (자산 탐색: `card_deepseek` → `card` → `card_claude`) |
| `src/shell.html` | 화면 골격. 기존 ID/핸들러를 유지한 채 HUD 장식만 추가 |
| `src/deepseek.css` | 딥시크 시각 레이어 (`body.ds` 프리픽스, 데스크톱/모바일 브레이크포인트 포함) |
| `src/deepseek.js` | 표현 어댑터 (테마 크롬, 카드 태깅, 스탯 분해, 학습 원장, 리플) |
| `assets/` | 3:5 카드 뒷면 3종 + `ds-mark.svg` |
| `tests/smoke.mjs` | Playwright 검증 (오프라인 부팅, 뽑기, 편성, 저장/복원, 도감, 학습, 전투, 6개 뷰포트) |

## 검증 범위

`tests/smoke.mjs`는 다음을 실제 브라우저에서 확인하고 `test-results/`에 스크린샷과 `verification.json`을 남깁니다.

- 외부 참조 없는 단일 파일 부팅, `DS_EDITION` 존재, `card/game/index.html`과의 레거시 ID 파리티
- 신규 게임 → 뽑기 → 덱 선택 → 저장/새로고침 복원
- 도감 검색, 카드 상세, 스탯 셀, 3:5 대체 아트(`object-fit:cover`)
- 학습 원장 수치(`quiz_stats`/`inventory`와 일치), 문법 콘텐츠, 중첩 모달 복귀
- 전투 진입, 스킬 실행, 로그 증가
- 360/390/412/1024/1440 뷰포트에서 **한 번에 한 화면만 표시**, 가로 오버플로 없음

> `루미.png`와 `*.mp3`는 원래 런타임이 `card/` 옆에서 찾는 외부 자산이라 404가 정상이며, 테스트는 이 두 가지만 허용합니다.

## 비교용 빌드

| 폴더 | 모델 | 산출물 |
| --- | --- | --- |
| `card/` | Astra | `card/dist/DREAMWEAVER.html` |
| `card_claude/` | Gemini Argon + Opus 5.5 | `card_claude/dist/DREAMWEAVER-Claude.html` |
| `card_deepseek/` | DeepSeek | `card_deepseek/dist/DREAMWEAVER-DeepSeek.html` |
