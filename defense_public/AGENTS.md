# Star Garden 공개판 (defense_public/) 작업 규칙

웹 공개 테스트용 Star Garden이다. 2026-11-21에 `defense/`(origin/main 5e3ad20)를 복사해 만들었고, 그 뒤로는 이 폴더에서 따로 고친다.

- 게임 규칙·화면·에셋의 작업 지침은 `../defense/AGENTS.md`를 그대로 따른다(UI 390×844, 문구, 밸런스 예산, 에셋 일관성, 도구). 이 파일에는 공개판에만 있는 규칙을 적는다.
- **원본과 다른 곳과 그 의도는 [docs/ORIGINAL_DIFFERENCES.md](docs/ORIGINAL_DIFFERENCES.md)에 있다.** 어느 판본을 고치든 먼저 이 문서로 적용 범위(두 판본 / 공개판만 / 원본만)를 정하고, 차이를 새로 만들거나 없애면 이 문서를 같이 고친다.
- **템포와 재화 수급은 [docs/PUBLIC_TEMPO.md](docs/PUBLIC_TEMPO.md)가 기준이다.** 주기(`src/tempo.js`)나 수입 수치(`src/content.js`의 `TUNING`, `src/economy.js`, `src/bond.js`, 도전 보상)를 바꾸면 같은 변경에서 `node defense_public/scripts/day-sim.mjs`를 돌려 문서의 측정표를 갱신한다.
- 학습 콘텐츠(강의·용어 퀴즈, 오답 노트, 루미 AI 해설)와 API 키 입력은 공개판에 없다. 되살리지 않는다.
- `defense/`에서 새 동료·그림·전투 수정을 가져올 때는 파일을 통째로 덮어쓰지 않는다. 공개판이 바꾼 파일(`src/app.js`, `src/profile.js`, `src/economy.js`, `src/content.js`의 메인 스테이지·난이도·`TUNING`, `src/battle.js`, `src/combat/engine.js`, `src/combat/render.js`, `src/beginner.js`, `src/bond.js`, `src/monthly.js`, `src/library.js`, `src/preview/*.js`, `src/tempo.js`)은 차이를 보고 옮긴다. 그 밖의 전투 파일, `src/data.js`, 에셋은 그대로 옮겨도 된다. 옮긴 뒤 테스트·빌드·하루 시뮬레이션을 돌린다.
- 빌드: `node defense_public/scripts/build.mjs` 한 번으로 `dist/StarGardenPublic.html`(밤)과 `dist/StarGardenPublicBright.html`(맑음)을 만들고 둘 다 커밋한다. 밸런스 랩은 없다. 테스트: `npm run test:defense-public`, 화면: `npm run test:defense-public:browser`.
- 저장 키는 `astra.star-garden.public.v1`(테스트 빌드는 `public-unlocked`·`public-preview`·`public-solo`)이다. 같은 브라우저에서 `defense/` 빌드와 저장이 섞이지 않는다.
- 공개 웹은 [docs/PUBLIC_WEB_RELEASE.md](docs/PUBLIC_WEB_RELEASE.md)를 따른다. `--public-web` 산출물은 `dist-public/`에 격리하며 원본·소스맵·테스트 도구를 배포하지 않는다. 집계에는 사용자·기기·세션 식별자나 세이브를 추가하지 않는다. 공개 번들 검사는 `npm run test:defense-public:web`, 수집기 로컬 검사는 `node defense_public/tests/collector-smoke.mjs`다. 이 검사는 실제 배포하지 않는다.
