# Jua 배포 글꼴 최적화 측정 기록

확인일: 2026-10-05. 비교 기준은 `71f3d4c`의 `defense_test/dist/StarGardenDefense.html`이며, 이때 파일 크기는 23,380,525바이트였다. 이 작업은 글꼴 배포 형식만 변경한다. 원본 `assets/Jua-Regular.ttf`는 재생성용 소스로 보존하고, 전체 글리프를 유지한 `assets/Jua-Regular.woff2`를 배포에 사용한다.

## 채택 결과와 크기

현재 문자열만 남기는 서브셋 대신 **전체 WOFF2 변환**을 채택했다. WOFF2는 fontTools 공식 `woff2.compress()`로 생성했다. 공식 문서는 이 API를 OpenType 글꼴의 WOFF2 압축 함수로 설명하며, 서브셋 기능은 별도의 문자·글리프 선택 작업이다. [fontTools WOFF2 API](https://fonttools.readthedocs.io/en/latest/ttLib/woff2.html), [fontTools subset 문서](https://fonttools.readthedocs.io/en/latest/subset/)

| 비교 대상 | 바이너리 바이트 | Base64 본문 바이트 | 원본 대비 사라진 코드포인트 | 현재 지원 문자의 추가 누락 |
|---|---:|---:|---:|---:|
| 원본 Jua TTF | 2,119,352 | 2,825,804 | 0 | 0 |
| **전체 Jua WOFF2, 배포 채택** | **368,996** | **491,996** | **0** | **0** |
| 현재 소스 문자열 서브셋, 비교 전용 | 168,980 | 225,308 | 1,540 | 0 |
| 원래 지원 한글·라틴·기호를 넓게 보존한 서브셋, 비교 전용 | 367,920 | 490,560 | 4 | 0 |

전체 WOFF2는 바이너리를 **1,750,356바이트, 82.5892%** 줄인다. 단일 HTML에 들어가는 Base64 본문은 **2,333,808바이트** 줄어든다. 원본 Base64는 기준 HTML의 12.0861%였고, 글꼴 본문 절감은 기준 HTML 전체 크기의 **9.9818%**에 해당한다. `data:font/ttf;base64,`에서 `data:font/woff2;base64,`로 바뀌는 접두사 2바이트 증가를 포함하면 글꼴 자체의 순 절감은 2,333,806바이트다. 최종 HTML에는 별도의 미디어 변경도 있으므로 이 수치를 최종 전체 파일의 전후 차이로 해석하지 않는다.

현재 문자열 서브셋을 쓰면 전체 WOFF2보다 Base64 266,688바이트를 추가로 줄일 수 있지만, 원본 지원 문자 1,540개를 제거한다. 앞으로 인연 이야기, 동료 이름, 사용자 입력이 늘 때마다 문자 집합을 갱신해야 하므로 채택하지 않았다. 한글과 주요 기호 범위를 넓게 보존한 서브셋은 전체 WOFF2보다 바이너리 1,076바이트, Base64 1,436바이트만 작았다. 전체 WOFF2가 이 서브셋의 총 Base64 절감량 중 **99.9385%**를 이미 달성한다. 작은 추가 절감을 위해 문자와 메타데이터 관리 의무를 만들지 않는 것이 적절하다.

넓은 서브셋 비교에는 현재 지원 문자와 원본 cmap 안의 다음 범위를 포함했다: 한글 음절 `AC00–D7A3`, 자모 `1100–11FF`, 호환 자모 `3130–318F`, 확장 자모 `A960–A97F` 및 `D7B0–D7FF`, 라틴 `0020–024F`, 구두점 `2000–206F`, 통화 `20A0–20CF`, 화살표·수학 기호 `2190–22FF`. 원본에 없는 글리프를 새로 추가하는 작업은 수행하지 않았다. 두 서브셋은 측정용 파일이며 배포하지 않는다.

## 실제 소스 문자열과 원래 폴백

현재 `src`의 16개 JavaScript 파일을 Acorn AST로 읽어 문자열 리터럴과 템플릿의 cooked 문자열을 수집했다. 코드 주석을 문자 범위의 근거로 사용하지 않았으며, 실행 시 디코딩되는 유니코드 escape도 실제 문자로 처리했다. 실제 `content.js`의 캐릭터 30종·유물 24종·보스 9종과 그 밖의 콘텐츠 테이블, `MEMORIAL_STORIES` 30개 이야기의 **242개 문단**, 정적 HTML, CSS `content:` 문자열도 포함했다. 화면 문자열 외에 내부 키와 마크업을 포함하는 안전한 상위 집합이다.

동적 표시값은 앱과 같은 한국어 `Intl.NumberFormat` 및 `toLocaleString` 규칙으로 따로 만들었다. 0부터 `Number.MAX_SAFE_INTEGER`, `1e50`, 음수와 비유한 값까지 확인했으며, `10만`, `1000만`, `1억`, `1조`, `9007.2조`, 쉼표·소수점·대시를 포함했다. 숫자 0–9, 영문 대소문자, 날짜·시간, 큰 레벨과 강화 수치, 백분율·연산자·통화 기호, 확장 한국어 단위도 함께 조사했다. 최종 감사 대상은 5,747개 문자열 항목, **998개 고유 코드포인트**다. 미디어 경로 변경 이후 소스를 다시 수집해도 코드포인트 집합은 같았다.

원본 Jua의 cmap은 **2,519개 코드포인트**이며, 이 중 한글 음절은 **2,367개**, 자모는 **51개**다. 원본부터 현대 한글 음절 11,172개 전부를 포함하지 않는다. 전체 WOFF2는 원래의 2,519개를 그대로 보존하므로 새 이야기나 사용자 텍스트의 기존 지원 범위를 축소하지 않는다. 원래 없는 글자는 기존 CSS 시스템 글꼴로 표시한다.

감사 집합 중 원본이 지원하는 979개는 변환 후에도 전부 지원했다. 나머지 19개는 원본 TTF에도 없으며, 이번 최적화로 생긴 누락이 아니다.

| 원본 미지원 종류 | 코드포인트 또는 문자 |
|---|---|
| 줄바꿈 제어 문자, 표시 글리프 불필요 | `U+000A`, `U+000D` |
| 기호 및 구두점 | `° ± · × ÷ – — … ₩ ← ↑ → ↓ − ∞ ♪ ✦` |

모든 감사 문자열에 Jua가 직접 그려진다고 주장하지 않는다. Jua는 제목·이름·일부 표시 숫자에 쓰이며, 본문은 기존 시스템 글꼴 스택을 사용한다. 표시 글꼴의 `Garden,'Apple SD Gothic Neo','Malgun Gothic',sans-serif`, 본문의 시스템 스택, `font-display:swap`을 그대로 보존했다.

## 윤곽·폭·화면 검증

fontTools로 원본과 전체 WOFF2를 각각 직접 열어 다음을 비교했다.

- glyph 수 2,520개와 cmap 2,519개가 같고, cmap의 문자·글리프 매핑도 완전히 같다.
- cmap의 모든 글리프에 대해 좌표·윤곽 끝점·on-curve 표식·힌팅 명령 바이트코드 차이가 0개다.
- 같은 글리프들의 horizontal advance와 bearing 차이가 0개다.
- `head`, `hhea`, `OS/2`의 단위, bounding box, ascent/descent, line gap, typo/win metrics, x-height/cap-height가 같다.
- copyright, family, full name, PostScript name, version, 라이선스 등 name 레코드가 같다.

Pillow/FreeType은 압축 WOFF2 파일을 **직접 읽는 데 성공**했다. 320·390px 폭 각각에서 14·19·24·26·34px 크기로 대표 문자열을 그린 10건 모두 원본과 픽셀 차이가 **0**, 문자 길이와 bounding box가 같았다. 이 독립적인 FreeType 탐침에는 시스템 폴백이 없으므로 원본 미지원 글자가 빈 상자로 보일 수 있다. 게임 화면의 표시 상태를 이 탐침으로 단정하지 않았다.

별도로 Chromium **147.0.7727.15**와 WebKit **26.4**에서 로컬 Data URI 글꼴을 사용한 독립 브라우저 화면을 검사했다. `document.fonts.load()`가 원본 TTF와 변환 WOFF2에 대해 각각 1개 face를 반환하고 `status=loaded`, `document.fonts.check()=true`인 것을 확인했다. 두 브라우저 × 320·390px 폭 × 위의 5개 글자 크기, 총 **20건**에서 다음 결과가 같았다.

- 전체 화면 픽셀 차이 **0**.
- 글자 폭과 actual bounding box, 줄별 좌표·폭·높이, 줄바꿈, scroll 크기, 전체 화면 높이 동일.
- 큰 레벨·재화·날짜 값, 실제 캐릭터·보스 이름, 등급·상태 이름 동일.
- 원래 Jua에 없는 기호와 한글을 포함했을 때도 기존 CSS 시스템 폴백 결과 동일.
- 페이지 오류 **0**, 외부 요청 **0**. 기존 설치된 브라우저를 사용했으며 브라우저를 설치하지 않았다.

이는 글꼴 교체만을 비교하는 독립 탐침이며 실제 게임 전체 스크린샷이나 물리적 Android/iOS 인증을 뜻하지 않는다. 최종 게임 단일 파일의 빌드와 실행 검증은 통합 작업의 기존 검증 범위에서 수행한다. 이 측정을 위한 새 테스트나 CI gate는 추가하지 않았다.

## 라이선스와 재생성

`assets/Jua-OFL.txt`의 `Copyright 2018 The Jua Project Authors`와 SIL Open Font License 1.1 전문을 보존한다. 이 파일의 copyright 뒤에 Reserved Font Name 선언이 없으며, 전체 WOFF2는 모든 원본 이름 메타데이터를 그대로 유지한다. 비교용 서브셋은 별도 `GardenJuaAuditSubset` 이름으로 변경했지만 배포에 사용하지 않는다. 원본 폰트와 저작권·라이선스 고지를 함께 보존하는 번들 배포 방침은 OFL의 공식 안내를 따른다. [OFL 사용 안내](https://openfontlicense.org/how-to-use-ofl-fonts/)

아래 명령은 저장소 루트에서 실행한다. 의존성은 기존 ignored `test-results` 아래에 한 번 설치하며 제품 의존성이나 배포 빌드 단계에 추가하지 않는다. 폰트 원본이 변경되지 않았다면 동일한 fontTools/Brotli 버전에서 같은 바이너리가 재생성된다. 실제로 두 번 변환하여 368,996바이트 및 SHA-256이 동일한 것을 확인했다.

```powershell
$fontAuditPython = 'C:\Users\romar\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$fontAuditLib = 'defense_test/test-results/font-audit/py-libs'
& $fontAuditPython -m pip install --disable-pip-version-check --no-warn-script-location --target $fontAuditLib 'fonttools==4.66.1' 'brotli==1.2.0'
& $fontAuditPython -c "import sys;sys.path.insert(0,'defense_test/test-results/font-audit/py-libs');from fontTools.ttLib.woff2 import compress;compress('defense_test/assets/Jua-Regular.ttf','defense_test/assets/Jua-Regular.woff2')"
Get-FileHash -Algorithm SHA256 'defense_test/assets/Jua-Regular.woff2'
```

| 파일 | SHA-256 |
|---|---|
| 보존한 `Jua-Regular.ttf` | `769677aef240bfc3b9965f2b50748075bff885e6c6992fc591a3fb268279f898` |
| 배포용 `Jua-Regular.woff2` | `cb995145eb03afc3ca5d714471d2183f58d56ed571001321e109170b421abcda` |

로컬 측정 증거는 ignored `defense_test/test-results/font-audit/`에 있다. `measurement.json`은 크기·coverage·윤곽·FreeType 결과, `browser-measurement.json`은 실제 face 로드와 20건의 브라우저 비교 결과를 기록한다. `corpus.mjs`, `measure.py`, `browser-font.cjs`는 이번 감사에 사용한 일회성 도구이며 반복 검증이나 CI에 연결하지 않는다. 24px 브라우저 비교 PNG도 같은 폴더에 남겼다.

적용 범위는 배포용 WOFF2 자산과 `@font-face`의 `format('woff2')`이다. 원본 TTF와 OFL 파일은 계속 보존한다. 빌드는 WOFF2 파일을 `data:font/woff2;base64,`로 한 번 포함하고 추가 글꼴 요청 없이 오프라인에서 사용한다.
