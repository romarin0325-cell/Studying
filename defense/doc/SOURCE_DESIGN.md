# 루미의 별빛 원정 — 소스 설계

현재 실행본은 `defense/merge/`다. PR #546의 Confluence 기반을 확장했다.
`defense_legacy/`는 PR #546 직전 게임의 보존 스냅샷이며 수정·빌드·검증 대상이 아니다.
현재 숫자와 규칙은 [밸런스 설계](BALANCE_DESIGN.md), 이미지 제작 기록은 [에셋 기록](ART_ASSETS.md)을 따른다.

## 파일별 수정 위치

| 변경하려는 것 | 우선 볼 파일 | 함께 확인할 곳 |
| --- | --- | --- |
| 21명 수치·역할·사거리·공격 형태·설명 | `merge/content.js`의 HEROES, roles | engine.js의 실제 효과, 밸런스 문서 |
| 유물 20개, 축복 6개, 지역·보스, 출시 에셋 | `merge/content.js` | engine.js, main.js, 에셋 수 검사 |
| 상태·합성·경제·장판·스킬·보스·웨이브 | `merge/engine.js` | unit/confluence.test.mjs |
| 명중 범위와 방향 | engine.js의 attackGeometry / geometryContains / canTarget | effects.js의 drawAttackRange |
| 21명 투사체·명중·상태·스킬 이펙트 | `merge/effects.js`의 CombatFX, FX_PROFILES | effects.webp, 단위 테스트·브라우저 proof |
| 캐릭터·적·중립 타일·합성 표시·카메라 | `merge/render.js` | ART_DIRECTION.md |
| 포인터·모달·저장·초상화·UI·화면 전환 | `merge/main.js` | index.html, style.css |
| 배치·화면 높이·고정 모달 영역 | `merge/style.css` | main.js의 fitArena / showModal |
| 효과음·음악·볼륨 | `merge/audio.js` | main.js의 Sound 연결 |
| 영웅 얼굴 crop / 승인된 방향도 | `merge/art-frames.js`, assets/merge/units | docs/art의 원본·두개부 기록 |
| 단일 HTML 생성 | `scripts/build_defense_local.mjs` | content.js의 ASSET_MANIFEST |
| 입력·스크롤·실제 화면·네트워크 차단 검사 | `scripts/defense_browser_suite.cjs` | scripts/verify_plan.js의 선택 정책 |

경로는 별도 표시가 없으면 `defense/` 기준이다. `scripts/`는 저장소 루트 기준이다.
배포 HTML과 prepared-manifest는 생성물이므로 직접 수정하지 않는다.

## 상태와 한 프레임

1. newRun은 선택한 동료 6명, 유물 최대 3개, seed로 시작한다. 25칸 중 초기 세 칸을 배치하고 무료 소환 3회·45G·별빛 75를 제공한다.
2. main.js가 60Hz 고정 간격으로 step을 호출한다. UI·이펙트 렌더는 requestAnimationFrame이며, 전투와 렌더의 시간은 분리된다.
3. step: 버프 → 합류 대기 → 생성 → 적 상태/이동/보스 → 장판 → 동료 준비/발사 → 투사체 명중 → 사망/완료 순서.
4. 명중·소환·합성·수입·스킬은 events를 만든다. main.js가 시각/소리에 전달하고 비운다. 엔진에는 DOM·Canvas·오디오 의존성이 없다.
5. 생존 적과 대기열이 모두 없어지면 reward로 이동한다. 매 물결 여섯 축복 중 서로 다른 세 가지를 제공한다.

`combat → reward → intermission(2.5초) → 다음 combat`

12번째 축복을 고르면 victory다. 끝없는 수호를 선택하면 13번째 전투로 진행한다.
health가 0이면 defeat. 보상 선택과 결과 창은 전투 시간을 진행시키지 않는다.

전투 RNG는 상태에 저장한 xorshift32다. 소환은 6명 셔플 백, 축복은 6개 셔플의 처음 3개다.
렌더 파티클의 난수는 전투 결과에 관여하지 않는다. serialize는 events만 제외하고 저장한다.
복원 후 동일 입력/시간에 같은 전투 상태가 나오는지를 단위 테스트한다.

## 입력·모달 계약

- 동료 탭은 선택과 간략 정보만 표시한다. 두 동료를 차례로 탭해도 합성되지 않는다.
- 움직임 12 논리 px 이후에만 드래그다. 드롭 목적지에 따라 이동·교환·합성을 한다.
- 두 번째 포인터·마우스 우클릭을 무시한다. 취소/영역 밖 드롭에서는 배치를 보존하고 선택 패널을 복구한다.
- 빈칸 탭은 다음 소환 위치를 지정한다. 실제 소환은 소환 버튼이나 Space로 한다.
- 합성 가능한 동료에는 코너/별 표시, 선택 중에는 실제 합성 대상 강조를 추가한다. 빈 배치 칸에는 모두 같은 중립 표시만 쓴다.
- 편성 창의 제목·동료 미리보기·하단 확정 버튼은 고정이다. `.modal-scroll`만 스크롤한다.
- 동행 강화도 같은 모달 프레임을 쓴다. 재렌더 시 scrollTop과 선택 버튼을 보존한다.
- 전투 루트는 100dvh(100vh fallback). fitArena가 헤더·컨트롤·정보 영역을 뺀 높이에 720:780 전장을 맞춘다.
- 740px 이하 높이에서는 정보 패널을 임시 오버레이로 표시한다. 일반 높이에서는 별도 정보 영역으로 전장을 가리지 않는다.
- 화면 비활성화는 자동 저장/정지. 모달은 포커스 trap과 복귀를 제공한다.

## 실제 공격과 시각 효과

공격 준비 0.13초 후 사거리 안의 표적을 다시 확인해 발사한다. 투사체가 도착해야 피해가 들어간다.
근접/타일/십자는 0.12초, 관통은 0.2초, 기타는 거리/650(명탐정 1400)으로 비행 시간이 정해진다.
발사 칸의 origin을 저장하므로 비행 중 동료를 옮겨도 공격 출발점이 순간이동하지 않는다.
이동하는 표적에는 도착 시점 좌표를 사용하고 동일 geometry로 범위 피해와 방향을 계산한다.

공격 형태: single, cleave(90°), splash, beam, chain, bounce, pulse, cross, zone.
관통은 원점에서 전방 사거리까지, 십자는 사거리 원 안의 같은 행·열이다.
프리뷰와 충돌 모두 attackGeometry / geometryContains를 사용한다. 별도의 화면용 판정 수치를 만들지 않는다.

FX_PROFILES의 21개 frame과 motion은 모두 다르다. 색상만 바꾸는 공용 공격이 아니다.
검격·단검·도약·바람·용염·발톱·혜성은 목표 각도와 원본 그림의 offset을 합쳐 회전한다.
방사형 눈송이·음표·꽃·시계 등에는 억지로 회전을 적용하지 않는다.
지원 스킬은 아군 위에 상승하는 문양과 발밑 링을 표시하고, 루나/밤토끼의 제한 표적 공격은 실제 타격 대상에만 표시한다.

장판은 적 그림 아래에 그린다. 테두리는 실제 판정 반경, 중심 이미지의 낮은 알파는 시각 표현이다.
불은 잔불, 독은 포자, 기절은 얼음, 감속은 발밑 링, 노출은 브래킷으로 구분한다.
일반 명중 0.3초, 스킬 0.65초. 공격 이펙트 96, 장판 75, 기존 효과 90, 파티클 280의 상한을 둔다.
줄인 효과 설정은 흔들림/섬광/선택 파티클을 줄이되 표적·범위·보스 경고를 지우지 않는다.

## 저장과 호환성

프로필 키 `astra.confluence.profile.v1`, 진행 키 `astra.confluence.run.v1`을 유지한다.
프로필의 편성·기록·음량은 보존하고 새 artifacts 필드는 빈 배열로 기본화한다.
진행 데이터의 schema VERSION은 2다. 이전 VERSION 1의 진행 중 전투는 새 경제/축복 규칙으로 **추정 변환하지 않는다**.
홈에서 규칙 변경 안내 후 새 원정을 시작한다. 프로필까지 초기화하거나 과거 V2 저장을 건드리지 않는다.

restore는 25칸, 중복 UID, 범위 밖 수치, 알려지지 않은 영웅·유물·축복, 장판·큐·투사체 모양 등을 검사한다.
실패하면 이어하기 대신 새 원정을 제공한다. 저장소 접근 실패는 경고와 메모리 실행으로 대체한다.
이미지는 실패/4.5초 무응답 시 대체 그림을 쓴다. 런타임 getImageData나 흰색 키 제거는 없다.
roundRect, Array.at 등 구형 환경의 기존 fallback을 유지한다.

## 빌드·검증·변경 순서

```powershell
npm run verify:plan
npm run verify
npm run verify -- --only defense
```

루트 verify는 Defense를 자동 실행하지 않는다. `--only defense`는 scoped diff에 매핑된 검사를 고른다.
출시 입력이 바뀌면 한 번 빌드하고 실제 생성 HTML의 추가 네트워크를 전부 차단해 실행한다.
현재 출력 `defense/dist-local/HeroCoreDefense.html`은 코드·스타일·27개 출시 이미지를 포함한다.
기존 파일명은 경로 호환성을 위해 유지하지만 document.title과 게임 표제는 **루미의 별빛 원정 · ASTRA**다.

기본 브라우저 검사는 390×844, 360×800, 320×568, 390×667 화면, 드래그 전용 이동, 유물 상한/저장,
편성/강화 스크롤, 축복, 21공격/4방향 proof, 25동료 렌더 부하를 다룬다.
전체 경험·밸런스·복원력 묶음은 사용자가 전체 Defense 검증을 요청할 때만 실행한다.
실제 Android/iPhone의 손가락 입력·주소창 변화·메모리·발열은 데스크톱 브라우저 검사로 인증하지 않는다.
