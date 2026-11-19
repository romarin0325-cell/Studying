# 다음은 너 (RELAYMARE)

루트에서 빌드하고 `dist/Relaymare.html`을 브라우저로 연다. 에셋과 규칙을 포함한 HTML 한 파일이며, 글꼴은 CDN을 쓴다. 타이틀에서 꿈길에 들어가 동료를 깨운 뒤 문과 출전 순서를 고른다. URL에 `?seed=7`처럼 시드를 붙이면 같은 원정으로 시작한다.

```sh
node card_pixel/game/build.mjs
node --test card_pixel/game/tests/bridge.test.mjs card_pixel/game/tests/rules.test.mjs
node card_pixel/game/tools/sim.mjs 100
node card_pixel/game/tests/play.mjs
```

자동 플레이는 설치된 Chrome을 쓰며 스크린샷은 `tests/shots/`에 남긴다. 페이지 검토 훅은 `window.__slice`와 `window.__game`에서 같은 객체로 열린다.

## 모듈 지도

| 위치 | 담당 |
| --- | --- |
| `src/main.js` | 초기화, 설정, 첫 화면 연결 |
| `src/engine/` | 시드 난수, 전투 브리지, 원정 규칙, 동료·적 생성 |
| `src/content/` | 꿈의 변덕, 적 접두사, 야생 몽마, 보스 데이터 |
| `src/ui/nav.js`, `src/ui/screens/` | 원정 시작·화면 전환, 각 화면의 HTML과 버튼 |
| `src/ui/battle/` | 무대 배치·사건 재생, HUD, 명령, 연출, 상세 시트 |
| `src/ui/`, `src/stage/`, `src/styles/` | 공용 위젯·설정·하단 시트, 캔버스·효과음, 공용·화면·전투 CSS |
| `tools/`, `assets/`, `tests/` | 카드 규칙 래퍼, 시뮬레이션, 스프라이트, 규칙 테스트와 자동 플레이 |

`node card_pixel/game/tools/cut-sprites.mjs`는 `../art/manifest.json`의 사용 가능한 세 포즈를 `assets/`에 잘라 담는다. 동료 `height`는 `small`(58), `medium`(64), `normal`(72, 기본), `tall`(80)이다. `heightPx`로 높이를 지정할 수 있다. 분리된 파츠는 본체 면적의 1.5% 이상이면 유지한다. `keepParts: false`는 기존 본체 분리 방식을 사용한다.
