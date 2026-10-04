# Survivor 소스 구조와 수정 위치

[문서 시작점](README.md) · [진행](GAMEPLAY.md) · [밸런스](BALANCE.md)

기준: `7635238`의 Nightfall. 실행 원본은 `survivor/src/`, 작성/검증 도구는 `survivor/scripts/`·`tests/`, 배포물은 `survivor/dist/AstraNocturne.html`이다.

## 실행 경로

`content.js` 정의 → `engine.js`의 `Game` → `app.js` 입력과 고정 step → `drainEvents()`/UI/오디오 → `render.js`.

엔진은 `reverie.js`의 원정/사건/비밀, `ordeal.js`의 보스, `nightfall.js`의 주기 유물/추가 무기/융합/밸런스 보정을 호출한다. 화면은 `motion.js`로 60Hz 전투 좌표를 보간한다. 프로필과 저장소는 `profile.js`에서 처리한다. 공유 아트를 준비할 때 다른 게임 소스를 읽을 수 있지만 해당 게임의 런타임이나 검증을 호출하지 않는다.

## 수정 위치

| 수정 내용 | 첫 파일과 심볼 | 함께 확인할 계약/자료 |
| --- | --- | --- |
| 수호자/무기/유물/지역/난이도/기억 | [content.js](../src/content.js): `HEROES`, `WEAPONS`, `RELICS`, `STAGES`, `DIFFICULTIES`, `META` | `engine.js` 실제 적용, [능력](CHARACTERS.md), [수치](BALANCE.md) |
| 성장 요구량·출현·공격·명중 | [engine.js](../src/engine.js): `xpNeed`, `director`, `fire`, `hit`, `updateShots/Fields` | [engine.test.mjs](../tests/engine.test.mjs), 공간 조회와 이동 경로 충돌 |
| 캐릭터 패시브와 공통 배율 | [engine.js](../src/engine.js): `recompute`, `hit`, `freezeEnemy` | 표시 패시브, 화상·보스 제어 제한·토끼 무기 연계 |
| 회피·필살기·재개 상태 | [engine.js](../src/engine.js): `dash`, `castSkill`, `updateUltimate` | `app.js` 두 포인터·중복 클릭, 저장된 잔여 이동/무적 |
| 성장 후보·리롤·제외·보물 | [engine.js](../src/engine.js): `candidates`, `offers`, `applyOption`, `openTreasure` | 6무기/4유물·진화·소모된 재료 후보 제외 |
| 공명·각성 | [content.js](../src/content.js): `BONDS`, `AWAKENINGS`; 엔진 `recompute/triggerBond` | 무기 단계·진화 여부·유물 3단계 |
| 홀리벨·아쿠아웨이브·융합 | [nightfall.js](../src/nightfall.js): `fireNightfall`, `updateNightfallField`, `fuseWeapons` | `content.js`의 `HIDDEN_UNIONS`, 재료 제거와 타격 이력 승계 |
| 주기 유물 | [nightfall.js](../src/nightfall.js): `relicInterval`, `updatePeriodicRelics` | 생성 한도에서 상자를 잃지 않기, 타이머 저장 |
| 짧은/무한·징조·사건·비밀 | [reverie.js](../src/reverie.js): `initializeRun`, `beforeCombat/afterCombat`, 사건 선택 | 엔진 종료·한계돌파·보스 저항, [Ordeal 검사](../tests/ordeal.test.mjs) |
| 보스 시각·등장·예고·판정 | [ordeal.js](../src/ordeal.js): `BOSSES`, `bossMilestone/Arrival/Pattern`, `groundDanger` | 엔진 `bossAttack/updateHazards`, 렌더의 같은 도형 |
| 지역 종료 조건 | [content.js](../src/content.js): `duration/finalAt/deadline/goal`; 엔진 `step/hit` | 앞 3지역 처치 승리와 새 2지역 4분 생존을 구분 |
| 영구 성장 가격·효과·보상 | [profile.js](../src/profile.js): `memoryEffect`, `metaCost`, `buyMeta`, `settle` | 엔진 `metaGain`, [profile.test.mjs](../tests/profile.test.mjs) |
| 원정 직렬화·복원·밸런스 이동 | 엔진 `snapshot/Game.restore`, [nightfall.js](../src/nightfall.js): `validateNightfall/migrateBalance` | [reverie.js](../src/reverie.js)의 `validateRunState`, 이전 v1 호환 |
| 홈/메모리/조합 지도/백업/입력 | [app.js](../src/app.js), [index.html](../index.html) | `Storage`, 선택 상태, `browser.mjs`/`browser-webkit.mjs` |
| 월드·캐릭터·공격·보스 경고 | [render.js](../src/render.js) | [motion.js](../src/motion.js)의 `FIXED_DT`, 좌표/보행 보간 |
| 아이템·메뉴 아트·전체화면 | [ui-art.js](../src/ui-art.js): `itemArt`, `menuArt`, `bindFullscreen` | manifest ID·내장 그림·플랫폼 fallback |
| 화면·서체·스크롤 | [style.css](../src/style.css), [prepare-font.py](../scripts/prepare-font.py) | 짧은 가로 화면/좁은 세로 화면·큰 결정 숫자 |
| 음악/효과음 | [audio.js](../src/audio.js) | 프로필 음량·정지/재개·사용자 입력 |
| 원본 그림→캐시/보행→배포 | [prepare-assets.mjs](../scripts/prepare-assets.mjs), [art-normalization.mjs](../scripts/art-normalization.mjs), [build.mjs](../scripts/build.mjs) | 아트 manifest·body-profile·출처·[assets.test](../tests/assets.test.mjs) |
| 체형/보행 시각 검토 | [review-art.mjs](../scripts/review-art.mjs), [Nightfall 아트 계약](../docs/nightfall/README.md) | 원본 전체 균등 배율·발축·4방향·4단계·게임 크기 |

## 중요한 데이터 경계

`HEROES`의 9명만 선택 가능하다. `OWNER_NAMES`에 있는 5명은 무기 정체성/도감용이며 영웅 능력치가 없다. `WEAPONS` 16개와 `HIDDEN_WEAPONS` 3개를 구분한다. 융합 무기를 일반 성장 후보에 넣거나 이미 소모된 재료를 다시 주지 않는다.

`stats`는 파생값, `grid`는 공간 조회 캐시, `events`는 표시 이벤트다. `snapshot()`은 이 셋을 제외한다. 복원은 런 자료를 검증한 뒤 파생 상태를 다시 구성하고 Nightfall 이동을 한 번만 적용한다. 프로필 `astra.nocturne.profile.v1`과 런 `astra.nocturne.run.v1`은 분리하며 `runId` 정산 이력으로 중복 보상을 막는다.

적탄/무기 조준은 캐릭터 몸 위치를, 바닥 위험은 지면 위치를 사용한다. 원의 안쪽 안전지대 등은 렌더 표현만이 아니라 `groundDanger`의 실제 충돌 제외 영역이다. 공격 그림만 바꾸며 명중 위치를 따로 이동시키지 않는다.

## 변경과 검증

데이터 → 실제 적용 → 표시 설명/조합 지도 → 복원/마이그레이션 → 관련 검사 순서로 읽는다. 루트 `npm run verify:plan`을 확인하고 필수 `npm run verify`를 실행한다. 문서만 바뀌면 게임 빌드·브라우저·경제 시뮬레이션은 실행하지 않는다. 실제 출시 입력 변경은 선택된 단일 HTML 빌드와 오프라인 부팅을 따른다. 자동 입력 표본은 필요할 때 사용하는 설계 자료이며 매 문서 변경의 필수 실행 목록이 아니다.
