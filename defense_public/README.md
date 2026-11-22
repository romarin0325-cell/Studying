# 드림위버: 별빛 정원 — 공개판

웹 공개 테스트용 Star Garden입니다. 게임 내용(동료 42명, 보스 9종, 108스테이지, 도전 콘텐츠, 메모리얼)은 원본 `defense/`와 같고, **하루에 게임 대부분을 볼 수 있게 주기와 재화 수급을 바꾼 판**입니다. 학습 퀴즈·오답 노트·AI 해설과 API 키 입력은 없습니다.

## 바로 실행

- `dist/StarGardenPublic.html`(밤) 또는 `dist/StarGardenPublicBright.html`(맑음)을 브라우저로 엽니다. 그림·음악·폰트·코드가 모두 들어 있는 단일 파일(약 26MB)이라 정적 호스팅(GitHub Pages, itch.io 등)에 그대로 올릴 수 있습니다.
- 저장은 그 브라우저의 localStorage(`astra.star-garden.public.v1`)에 남습니다. 설정 → 백업 저장/불러오기로 옮깁니다.

## 원본과 다른 점 (자세히는 [PUBLIC_TEMPO.md](docs/PUBLIC_TEMPO.md))

| | 원본 | 공개판 |
|---|---|---|
| 파견 / 별똥별 / 선물 바구니 | 24시간 / 24시간 상한 / 8시간 | 1시간 / 4시간 상한 / 15분 |
| 픽업 / 수호자 | 매주 / 매달 | 2시간 / 4시간 |
| 드래프트 / 토벌 / 서약·쌍성 | 주간 / 월간 / 격주 교대 | 4시간 / 8시간 / 4시간 교대 |
| 첫 주 보상판 | 새싹 일주일(접속일) | 새싹 일곱 걸음(할 일을 마치면 다음 칸, UR 선택은 스테이지 21 뒤) |
| 소환 | UR 0.2%, 퀴즈 정답 시 UR 2배·행운 보너스 | UR 0.4% 고정, 유료 10회마다 10% 행운 보너스 10회 |
| 수입 | 방치·파견 중심 | 클리어 중심(첫 클리어 최대 3배, 스테이지 별가루 약 2배), 도전 보상 3배 |
| 호감도 | 인사·선물·부탁 | 5배, 원정을 함께 마치면 전투 인연 |
| 루미의 그림 7장 | 오답 복습, 하루 별 1개 | 메인 원정 승리마다 별 1개 |
| 신규 동료 12명 합류 | 스테이지 54 | 스테이지 27 |

## 개발

저장소 루트에서:

```powershell
npm run build:defense-public
npm run test:defense-public
npm run test:defense-public:browser
node defense_public/scripts/day-sim.mjs --plan dedicated
node defense_public/scripts/review-tempo.mjs
```

- 빌드 한 번으로 두 테마를 만들고 둘 다 커밋합니다. 밸런스 랩은 없습니다.
- `scripts/day-sim.mjs`: 새 계정이 실제 명령으로 하루를 사는 시뮬레이션(플레이 시간표, 오토 종류, 배속을 고른다). 주기·수입 수치를 바꾸면 돌려서 [PUBLIC_TEMPO.md](docs/PUBLIC_TEMPO.md)의 측정표를 갱신합니다.
- `scripts/review-tempo.mjs`: 원본과 공개판의 같은 화면을 같은 시각·계정으로 찍어 `docs/review/public-tempo-20261121/`에 전후 비교 페이지를 만듭니다.
- 작업 규칙은 [AGENTS.md](AGENTS.md). 게임 공통 지침은 `../defense/AGENTS.md`를 따릅니다.
