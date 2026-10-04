# Shooter 소스 구조와 수정 위치

[문서 시작점](README.md) · [진행](GAMEPLAY.md) · [밸런스](BALANCE.md)

기준: `7635238`. `shooter/`의 ES module들이 원본이며 `dist/AstralBloom.html`과 `assets/prepared/`, `learning/data.js`, `docs/manual-data.js`는 생성 결과다.

## 실행 경로

`content.js` + `meta.js` → `engine.js`의 `Game` → `app.js`의 입력/프레임/이벤트 → `render.js`와 HUD. 전투 밖에서 `menus.js`의 `CampaignUI`가 프로필·상점·도서관을 표시하고 `learning.js`, `tutoring.js`, `tutoring-ui.js`를 연결한다.

`Game`은 전투 RNG와 플레이어/적/탄/장판/점수/스테이지 상태를 소유한다. `app.js`가 생성 시 `onEvent` 콜백을 넘겨 결과·퀴즈·UI·소리를 이어 간다. 일시정지/닫힌 모달의 입력과 캐릭터·의상 전환은 UI 책임이다.

## 수정 위치

| 수정 내용 | 첫 파일과 심볼 | 함께 확인할 계약/자료 |
| --- | --- | --- |
| 수호자·두 무기·봄 이름/컨셉 | [content.js](../content.js): `HEROES` | `engine.js` 실제 분기, `docs/manual-content.js` 설명 |
| 일반/챌린지/주간 던전 | [content.js](../content.js): `DUNGEONS`, `STAGES`, `EVENT_DUNGEONS` | `engine.js`의 구간·생성·보스, [매뉴얼](../docs/MANUAL.md) |
| 무기 발사·관통·근접·연쇄·장판 | [engine.js](../engine.js): `Game`의 공격/충돌 분기 | [combat 회귀](../tests/patch-combat.test.mjs), `manual.test.mjs` |
| 봄·홀리플레임·부활·보호막·피격 | [engine.js](../engine.js): 봄/피격/부활 및 유물 조건 | [유물 회귀](../tests/relics-patch.test.mjs), [실측](../docs/manual-data.js) |
| 심연 HP·탄막·보스 주기 | [engine.js](../engine.js): `ABYSS_*` 배열과 `isAbyss` 분기 | [abyss.test.mjs](../tests/abyss.test.mjs), [abyss-buffs](../tests/abyss-buffs.test.mjs) |
| 유물 데이터·조건·능력 조립 | [meta.js](../meta.js): `ARTIFACTS`, `COLLECTIBLE_ARTIFACTS`, `loadoutStats` | 실제 상황에 따른 `Game` 적용, `artifactText` 설명 |
| 뽑기·환급·상점·주간·요일 | [meta.js](../meta.js): `drawArtifact`, `claimDungeon`, `weekKey`, `consumeRandom`, 구매 함수 | [경제 회귀](../tests/patch-economy.test.mjs), 프로필 정규화 |
| 의상 데이터·구매·착용 | [meta.js](../meta.js): `COSTUMES`, `drawCostumeTicket`, `equipCostume` | [menus.js](../menus.js)의 `CampaignUI.wardrobe`, 아트 경로 |
| 캐릭터 전환/의상 연출 | [menus.js](../menus.js): `wardrobe`, 전환 취소 처리 | [wardrobe 흐름](../tests/relics-wardrobe-flow.mjs): 캐릭터는 즉시, 동일 캐릭터 의상은 1600ms |
| 메뉴·상점·도서관·오답장 | [menus.js](../menus.js): `CampaignUI` | [style.css](../style.css), `app.js`의 모달 열기/닫기 |
| 질문 생성·오답 기록·하루 복습 보상 | [learning.js](../learning.js): `makeQuestion`, `recordAnswer`, `claimReviewReward` | [learning.test.mjs](../tests/learning.test.mjs), 저장된 실제 문항 |
| 루미 AI·오프라인 해설·오류 | [tutoring.js](../tutoring.js): `LumiTutorClient`, `offlineTutorLesson` | API 키/모델·타임아웃·취소, [tutoring.test.mjs](../tests/tutoring.test.mjs) |
| 과외 화면·재풀이·비동기 수명 | [tutoring-ui.js](../tutoring-ui.js) | [tutoring 흐름](../tests/tutoring-flow.mjs), 모달 닫기/문항 전환 |
| 출격·입력·진행·정산·저장 | [app.js](../app.js): `startGame`, `handleEvent`, `frame`, `resolveStageQuiz`, `save` | `astral-bloom-v1`, 캠페인 정규화와 옛 던전 기록 이동 |
| 적/수호자/탄/장판·아트 로딩 | [render.js](../render.js): `Renderer`, `loadArt` | [art-manifest.js](../art-manifest.js), 피격점과 이미지 크기 |
| 음량·음악·효과음 | [audio.js](../audio.js): `AudioDirector` | UI 설정/일시정지·사용자 입력 후 오디오 활성 |
| 레이아웃·HUD·모달 | [index.html](../index.html), [style.css](../style.css) | 실제 화면 크기·스크롤·두 포인터 입력 |
| 학습 원본 동기화 | [sync-learning.mjs](../sync-learning.mjs) | 활성 `card/game/`, [provenance.json](../learning/provenance.json) |
| 이미지 캐시·단일 HTML | [prepare-assets.mjs](../prepare-assets.mjs), [build.mjs](../build.mjs) | 원본 SHA/processorHash, 준비 캐시·manifest·배포물 |
| 문서 실측 갱신 | [docs/generate-manual.mjs](../docs/generate-manual.mjs) | `MANUAL.md`, `manual-data.js`, `manual-content.js`, [manual.test](../tests/manual.test.mjs) |

## 바꾸면 같이 봐야 하는 경계

새 무기는 콘텐츠 문구·엔진 발사/명중·렌더·유물 공통 배율·봄과 지원체의 피해 경로·매뉴얼을 함께 대조한다. `power/reach` UI 지표는 DPS가 아니다. 생명·봄·피격 반경의 기본값은 난이도와 수호자 보너스, 유물에서 조립되므로 한 파일의 숫자만 고치면 설명과 실제 출격이 달라질 수 있다.

프로필 변경은 `createProfile`에서 옛 저장을 정규화한다. 예약 전설 유물 2개는 `COLLECTIBLE_ARTIFACTS`에 포함하지 않는다. 전투 UI의 상점/의상 결제는 실패 시 복구와 결과 공개/티켓 소모 시점을 보존한다. 과외 키 `astral-bloom-tutor-key`·모델 설정은 캠페인 저장과 별도이며, 요청 취소 후 오래된 응답을 반영하지 않는다.

캐릭터 전환은 즉시 반영하고 기존 전환을 취소하며 `aria-busy`를 해제한다. 같은 캐릭터의 의상 변경에만 로컬 1600ms 연출을 남긴다. 이 둘은 별도 사용자 행동이다.

## 검증과 배포

루트에서 `npm run verify:plan`, 필수 `npm run verify`로 변경에 대응하는 최소 검사를 사용한다. 이 PR과 같은 문서 변경은 게임 빌드/실측/브라우저 실행 대상이 아니다. 전투 숫자를 바꾸는 작업에서는 `node shooter/docs/generate-manual.mjs` 및 `--check`로 실측 문서를 갱신하고, 선택된 출시 입력 검증이 단일 HTML을 한 번 빌드·부팅한다. 다른 게임의 테스트를 추가하지 않는다.
