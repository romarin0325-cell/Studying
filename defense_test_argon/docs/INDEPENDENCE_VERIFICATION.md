# 독립 소스 트리와 생성 JSON 무결성 보완

작성일: 2026-10-05. 기준: PR #575가 머지된 `origin/main`의 `42967eccb75844adc0d7896464ccbbae5f7102e8`.

## 소유권과 초기 복사 범위

별빛 정원은 향후 기존 Defense와 다른 밸런스·게임 방향으로 개발한다. 기존 게임에서 필요한 부분만 초기 값으로 복사했으며, 현재 빌드·런타임·보고서·테스트는 다른 게임의 데이터나 파일을 읽지 않는다. 이후 기존 Defense에 변경이 생겨도 자동으로 동기화하지 않는다.

| 유지할 내용 | 독립 소스 위치 | 초기 복사 범위 |
|---|---|---|
| 캐릭터·유물·축복·보스·그림 영역 정의 | `src/data.js` | 초기 정의를 평가한 결과만 옮겨 원본의 역할 후처리 코드·기존 편성·7단계 성장 수치에 대한 live import 제거 |
| 수집 등급·경제 계수·45단계 구성 | `src/content.js`, `src/economy.js` | 별빛 정원 규칙으로 별도 유지; 전장 테마만 필요한 표시 필드 보존 |
| 전투·효과·렌더링·음향 | `src/combat/` | 이미 복사된 구현 유지, 모든 import는 로컬 콘텐츠 사용 |
| 이미지 | `assets/merge/`, `assets/moonlit/` | 실제 사용되는 43개 텍스처만 복사; 원본과 초기 바이트 동일 |
| 글꼴·라이선스 | `assets/Jua-Regular.ttf`, `assets/Jua-OFL.txt` | Jua와 SIL OFL 1.1 문구를 함께 복사하고 HTML에 내장 |

초기 수치 자체는 이번 독립화에서 재밸런싱하지 않았다. 기존 Defense의 현재 수치와 항상 같아야 한다는 전투 테스트는 제거했다. 이후 캐릭터·유물 수치는 `src/data.js`, 수집/성장 수치는 `TUNING`과 경제 구현, 전투 흐름은 로컬 엔진에서 독립적으로 바꿀 수 있다.

`ASSET_PROVENANCE.json`의 `initialArtCommit`은 아트의 역사적 출처이며 현재 빌드 입력이 아니다. `assets[].source`, `font.source`, 라이선스 경로와 해시는 모두 로컬 복사본을 가리킨다.

## P1: 공용 입력 변경과 배포물 불일치

공용 입력을 추가 매핑하는 대신 live dependency 자체를 제거했다. 기존 Defense/Card 파일을 바꿨을 때 별빛 정원 검증이 선택되지 않는 것은 이제 의도된 독립 소유권이다. 별빛 정원이 실제 읽는 입력을 바꾸면 검증이 선택된다.

| 변경 경로 | 검증 선택 |
|---|---|
| `defense_test/src/data.js`, `src/content.js` | 로컬 데이터·전투·경제·저장·독립성 계약, JSON 비교, 1회 빌드, Chromium/WebKit 오프라인 UI |
| `defense_test/assets/**`의 사용 이미지·폰트·라이선스 | 에셋·독립성 계약, JSON 비교, 1회 빌드, Chromium/WebKit 오프라인 UI |
| `defense_test/scripts/local-inputs.mjs`, `build.mjs` | 로컬 입력 경계·계약, JSON 비교, 1회 빌드, Chromium/WebKit |
| 기존 `defense/merge/content.js`, `defense/assets/**`, `card/assets/Jua-Regular.ttf` | 별빛 정원 검사 없음; 각 소유 게임의 기존 정책 적용 |

`local-inputs.mjs`는 에셋 경로가 `defense_test/assets` 밖으로 벗어나면 실패한다. 독립성 테스트는 이미지·폰트의 실제 경로와 모든 소스/빌드/보고서/테스트의 상대 import 경계를 검사한다. 빌드는 esbuild의 실제 입력 그래프도 검사해 다른 게임 소스가 번들에 들어오면 실패한다. 전투·성장 코드의 임시 복사본은 다른 게임 폴더가 전혀 없는 위치에서 로드하고 실제 전투 tick을 실행해 독립 동작을 확인한다.

## P2: 생성 JSON의 검증 누락

다음 두 파일을 일반 문서에서 제외해 별도의 생성물 검사 대상으로 등록했다.

- `docs/BALANCE_SNAPSHOT.json`
- `docs/ASSET_PROVENANCE.json`

재생성:

```powershell
node defense_test/scripts/generated-reports.mjs
```

검사:

```powershell
node defense_test/scripts/generated-reports.mjs --check
```

검사는 현재 로컬 구현과 실제 에셋/폰트에서 두 결과를 메모리로 다시 생성하고 저장된 JSON 전체를 비교한다. Git checkout의 CRLF/LF 차이만 정규화한다. 값·해시·파일 목록·경로·서식이 생성 결과와 다르거나 파일이 없으면 실패하고 재생성 명령을 안내한다. 검사 중 JSON을 쓰거나 복구하지 않는다.

HTML 빌드는 더 이상 provenance JSON을 쓰지 않는다. 따라서 검증 계획에서 빌드가 먼저 실행되어도 수동 편집이나 오래된 JSON이 새 값으로 덮여 검사에서 숨겨지지 않는다. 수치 분석도 실제 `TUNING` 계수와 SR 풀 크기를 읽도록 해 예전 확률/성장 계수가 보고서 생성기에 상수로 남는 문제를 줄였다.

JSON만 변경·삭제·이름 변경된 경우에는 재생성 비교만 선택한다. 보고서 생성기 변경은 변조/누락 회귀 검사와 비교를 선택한다. 이 두 경우에는 게임 빌드와 브라우저 설치/실행을 선택하지 않는다. 연구 Markdown만 수정한 경우에는 일반 문서 정책을 그대로 따른다.

## 검증 구성과 근거

- 게임 회귀 검사 31개: 기존 24개에 생성 보고서 검사 4개, 독립 소스 경계/실제 전투 검사 3개 추가. 정상 생성, CRLF, 수치 변조, 이미지/폰트 해시 변조, 파일 경로/목록 변조, 생성 파일 누락을 검사하고 검사 전후 파일 내용이 그대로인지 확인한다.
- 선택기 fixture 32개: 기존 28개에 로컬 입력 6종의 선택, 기존 공용 입력과의 분리, JSON 단독 변경/삭제/이름 변경, 생성기 변경의 최소 검사 선택을 추가했다. 실제 타 게임 명령은 실행하지 않는다.
- `npm run verify:plan`: 범위는 `defense_test`와 검증 선택기뿐이며 기존 Defense/Card/Shooter/Idle/Survivor 런타임 명령을 선택하지 않는다.
- `npm run verify`: 배포 입력을 1회 빌드한 뒤 Git에 커밋된 HTML과 정규화 비교하고, 실제 단일 파일을 Chromium/WebKit에서 오프라인으로 실행한다. UI·저장·파견·드래프트·월간전·백업 경계는 기존 집중 검사를 유지한다.

물리 모바일 기기 성능이나 장기 수치 밸런스를 새로 인증하는 변경은 아니다. 이번 변경의 판정 대상은 독립 소스/입력 소유권과 생성 JSON 검증 누락의 해소다.
