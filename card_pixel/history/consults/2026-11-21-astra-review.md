**높음 2건 · 중간 13건 · 낮음 7건, 총 22건입니다.** 가장 먼저 고칠 문제는 **보스를 사망 반격으로 처치해도 원정이 패배하는 판정**과 **다른 탭의 저장이 확정된 영입과 해금을 되돌리는 문제**입니다.

PR #693의 `claude/relaymare-v1` 브랜치, 커밋 `74e66a2`를 읽기 전용으로 검토했습니다. 기존 Node 테스트 88개는 모두 통과했습니다. 아래의 ‘원정’은 실제 엔진 명령으로 진행한 재현이고, ‘화면’은 Node에서 화면 함수가 생성한 문구를 확인한 재현입니다. 실제 브라우저에서의 렌더링과 음향은 확인하지 않았습니다.

| 심각도 | 문제 | 파일:줄 | 재현 여부 | 도달 가능성 | 고치는 방향 |
|---|---|---|---|---|---|
| 높음 | **보스를 죽이고도 원정 패배.** 홍련 화산 시드 `0`, 레드문 대표로 샘과 문지기 보상을 건너뛰고 5층 보물을 받습니다. 8층에 에인션트드래곤·레드문을 내보내면 10턴 아포칼립스에 레드문이 쓰러지면서 873 반격으로 아이리스를 처치합니다. 보스 처치가 기록되고 대기석도 비었지만 결과는 `lose`입니다. | [bridge.js:172][ko] · [run.js:261][ko-end] | 원정 1~8층 | 드묾. 마지막 출전자의 사망 반격이 마지막 적을 처치할 때 | 마지막 적의 처치를 먼저 판정한 뒤 보스전의 동시 전멸 승리 규칙을 적용합니다. |
| 높음 | **오래된 탭이 영입·해금을 되돌립니다.** 새벽의 숲 3층을 두 탭에서 열고, A에서 5층을 깨 눈토끼를 영입한 뒤 B에서 3층 문을 고릅니다. 다시 열면 3층이고 영입 명단과 수첩 1장이 모두 비어 있습니다. | [save.js:55][save-write] · [nav.js:31][nav-load] | 원정 + 같은 저장소를 공유하는 두 탭 모의 | 같은 저장을 두 탭에서 열고 뒤처진 탭이 한 번이라도 저장하면 발생 | 저장본에 개정 번호를 두고 오래된 탭의 덮어쓰기를 막습니다. |
| 중간 | **내기 보상과 문지기 유물이 겹치면 문지기 선택권이 사라집니다.** 투기장 시드 `1103811`, 루나 대표·언더독 동행. 3층 ‘무명 선수권’에서 같은 등급 셋에 걸고 생크림메이드·공허의기사·헬하운드로 이기면 더블어택을 받습니다. 문지기 화면에서 다시 ‘더블어택 받기’를 누르면 추가 지급 없이 그림자 선택권까지 닫힙니다. | [run.js:274][gate-set] · [run.js:301][gate-take] · [rooms.js:63][duplicate] | 원정·보상 선택 | 드묾. 두 보상이 같은 판에서 해당 유물을 고를 때마다 발생 | 내기 지급 후 문지기 보상을 갱신하고, 중복 지급이면 선택권을 유지합니다. |
| 중간 | **입문 패배 때 예약한 꿈 조각이 다음 입문에 적용되지 않습니다.** 시드 `13`의 새벽의 숲 3층에서 패배한 뒤 세이렌을 예약했습니다. 다음 입문 시드 `7`의 첫 후보는 눈토끼·은토끼·해바라기였습니다. 세이렌 예약은 프로필에 남아 있습니다. | [run.js:44][shard] · [run.js:150][intro-pick] · [recruit.js:56][reserve-ui] | 연속 두 원정 | 첫 클리어 전에는 다음 행선지도 입문입니다. 패배 화면은 후보가 있으면 예약을 필수로 요구합니다. | 입문 2층 첫 깨우기의 우선 후보에도 예약 동료를 넣습니다. |
| 중간 | **지정한 동행이 문지기로 뽑히면 첫 유료 깨우기 보장이 깨집니다.** 홍련 시드 `91`, 애쉬 대표·눈토끼 동행으로 시작해 지크를 고르면 눈토끼가 문지기로 예약됩니다. 3층 첫 유료 후보 셋에는 살아 있고 아직 합류하지 않은 눈토끼가 없습니다. | [run.js:111][gate-reserve] · [run.js:322][spring] · [dungeons.js:92][spring-ui] | 원정·유료 구매 | 동행이 시작 후보에 나왔고, 고르지 않은 그 동행이 문지기로 예약될 때 | 다른 후보를 문지기로 우선 예약해 동행 보장과 문지기 재등장을 함께 충족합니다. |
| 중간 | **변신한 동료의 유품이 다음 전투에서 다른 기술로 바뀝니다.** 홍련 시드 `0`, 미라클라바를 오로라윙으로 변신시킨 뒤 쓰러뜨리면 처형인이 ‘뷰티토네이도’를 받습니다. 다음 전투에서 실제 유품은 ‘실크바인드’입니다. 변신 직후의 ‘동료 · 지금’ 상세에도 미라클라바의 기술이 나옵니다. | [bridge.js:343][heir-save] · [bridge.js:305][heir-load] · [sheets.js:89][form-sheet] | 연속 전투·화면 | 변신 후 유품을 넘겼고 받은 동료가 생존하면 발생. 상세 오류는 변신 직후부터 발생 | 유품에 사망 당시 형태와 기술을 저장하고, 전투 상세도 현재 형태를 읽습니다. |
| 중간 | **살아서 물러난 시전자의 예약 공격이 ‘시전자 사망’으로 취소됩니다.** 투기장 시드 `1`, 프리즘트윈이 1턴에 일루미네이션을 쓰고 2턴에 물러나면 4턴에 발동 실패가 뜹니다. 같은 전투의 정산에는 프리즘트윈이 생존·후퇴로 기록됩니다. | [bridge.js:781][retreat] · [battle_runtime.js:467][delay-death] | 전투·로그·정산 | 예약 발동 전에 시전자가 물러나고 전투가 발동 턴까지 계속될 때 | 행동 순서에서 빠진 상태와 사망 상태를 예약 공격 판정에서 구별합니다. |
| 중간 | **투기장의 ‘다음 직접 공격 ×2’를 예약 공격이 먼저 씁니다.** 같은 프리즘트윈으로 1턴 일루미네이션, 2·3턴 일반 공격을 선택하면 4턴 입력 전에 예약타가 364 피해를 주고 기세가 0이 됩니다. 다음 직접 기술에는 배율이 남지 않습니다. | [bridge.js:499][charge] · [v1-decisions.md:82][arena-design] | 전투·배율·기세 확인 | 일반 공격 두 번과 예약 발동이 이 순서로 겹칠 때 | 기세 소모 조건에서 예약 발동을 제외합니다. |
| 중간 | **여정 일반 위험 문에 변덕과 접두사가 함께 붙습니다.** 홍련 시드 `2`의 2층 오른쪽 일반전은 ‘유리 대포’에 첫 적 ‘광폭’까지 붙습니다. 설계상 지역 규칙 외 추가 변수는 최대 하나입니다. | [rooms.js:112][quirk] · [rooms.js:126][affix] · [v1-decisions.md:57][risk-design] | 원정·문 생성 | 흔함. 2층 위험 문의 변덕 7종 중 ‘넘침’을 제외한 6종에서 발생 | 여정 일반 위험 문은 변덕과 접두사 중 하나를 뽑도록 합니다. |
| 중간 | **저장 실패를 알리지 않아 새로고침 때 진행이 사라집니다.** 1층 저장 후 2층에서 `QuotaExceededError`를 발생시키면 플레이는 계속되고 재접속은 1층입니다. 처음부터 `SecurityError`인 경우에는 재접속할 저장 자체가 없습니다. | [storage.js:6][storage] · [nav.js:54][persist] | Node에서 두 저장 예외 주입 | 저장 공간이 찼거나 브라우저에서 저장을 차단한 동안 매번 발생 | 저장 성공 여부를 호출자에 전달하고, 실패한 시점에 이어하기가 가능한 범위를 표시합니다. |
| 중간 | **수첩 2·3장과 유물 도감이 달성 후에도 잠겨 있습니다.** 입문에서 영입한 눈토끼를 대표로 홍련 시드 `0`에 출발해 4층 문지기를 잡은 뒤 새로고침하면, 관측소 수첩은 여전히 1장만 완료입니다. 문지기 승리는 저장돼 있지만 두 장은 원정 종료 때 함께 반영됩니다. | [nav.js:40][progress-save] · [meta.js:96][progress] · [meta.js:135][progress-end] | 원정·저장 복원, 관측소 경로 대조 | 첫 대표 출발 및 첫 본편 문지기 격파 후, 귀환 전 관측소를 열면 확인 가능 | 대표 출발과 문지기 승리를 저장할 때 해당 수첩 장도 함께 반영합니다. |
| 중간 | **전투 도중 새로고침하면 빈 출전 자리의 위치가 바뀝니다.** 황혼 시드 `0`의 6층에서 `빈자리 / 마왕 / 밤토끼`로 출전한 뒤 복원하면 편성 화면이 `마왕 / 밤토끼 / 빈자리`로 열립니다. 그대로 확정하면 자리 특성 계산도 달라질 수 있습니다. | [save.js:25][battle-save] · [order.js:16][order] | 원정·저장 복원·편성 화면 | 두 명 이하로 앞이나 가운데를 비운 전투에서 새로고침할 때 | 방 입구로 되돌릴 때 직전에 확정한 세 자리와 빈칸 위치를 보존합니다. |
| 중간 | **무작위 위력 기술에 확정 ‘처치’ 표시가 뜹니다.** 별빛 시드 `3`, 아발란체메이드 대표로 시작한 1층 10턴에 미이라의 유품 아이스에이지가 HP 112인 적에게 ‘132·처치’로 예고됐습니다. 실제 피해는 44였고 적은 HP 68로 반격했습니다. | [bridge.js:705][random-preview] · [tiles.js:78][heir-tile] | 전투 예고·실제 피해 | 무작위 기술의 최저 피해와 미리보기에 쓰는 중간 피해 사이에 적 HP가 있을 때 | 피해 범위를 표시하고 최저 피해로도 쓰러뜨릴 때만 확정 처치를 표시합니다. |
| 중간 | **처치 턴 내기의 화면 조건과 지급 조건이 다릅니다.** 별빛 시드 `2`, 3층 ‘점성술사의 별판’에서 ‘3턴에 마지막 적 처치’를 선택했습니다. 4층 첫 그림자를 3턴, 마지막 그림자를 8턴에 처치했는데도 내기 성공으로 결정 2개가 추가됐습니다. | [event.js:78][bet-ui] · [bridge.js:194][bet-rule] · [bridge.test.mjs:519][bet-test] | 원정·화면·지급 | 연전에서 지정 턴에 중간 적을 처치하고 이후 승리할 때 | 기존 규칙과 테스트에 맞춰 ‘해당 턴에 적 하나 처치 후 승리’로 표시합니다. |
| 중간 | **플로라의 피해 절반 예고가 한 턴 빠릅니다.** 보스 설명은 5·10턴에 큰 기술을 아끼라고 합니다. 실제 플레이어의 5·10턴에는 감면이 없고, 그 턴의 적 행동 후인 6·11턴에 감면이 적용됩니다. | [bosses.js:12][flora] · [logic.js:3070][flora-core] | 실제 보스 전투의 턴별 상태 확인 | 별빛 정원 악몽 보스전이 해당 턴까지 이어질 때마다 발생 | 시전하는 적 턴과 피해가 줄어드는 플레이어 턴을 각각 적습니다. |
| 낮음 | **즉시 발동하는 기술이 ‘예약’으로 표시됩니다.** 홍련 시드 `1`, 가디언 대표·시간의마술사 동행으로 셋을 편성하면 1층 첫 판게아리버스의 예고는 ‘예약’입니다. 실제로는 즉시 293 피해를 줍니다. | [bridge.js:689][instant] · [tiles.js:63][delay-tile] | 원정·전투 예고 | 시간의마술사가 출전 덱에 있고 지연 기술을 볼 때마다 발생 | 타일이 덱의 지연 기술 즉시 발동 특성을 반영하도록 합니다. |
| 낮음 | **별빛 정원 문이 실제 시작 하늘을 잘못 공개합니다.** 시드 `0`, 3층 ‘슈가파우더의 왕관 케이크’에서 스타파우더를 택하면 4층 문은 ‘시작 하늘 · 비어 있음’으로 표시됩니다. 전투 첫 상태에는 스타파우더가 있습니다. | [map.js:62][sky-map] · [run.js:175][sky-actual] | 원정·지도 문구·전투 첫 상태 | 사건이 다음 전투의 필드를 바꾼 별빛 문에서 발생 | 지도와 전투가 사건 효과까지 합친 같은 시작 필드를 읽도록 합니다. |
| 낮음 | **위험 문의 적 HP와 확정 결정이 기본값으로 표시됩니다.** 홍련 시드 `3`의 2층 오른쪽 문은 용암 갑충 HP 455, 결정 +2라고 표시합니다. 실제 HP는 ‘메아리’ 적용 후 546입니다. ‘보물’ 접두사로 승리 보상은 최소 4개이고, 재현 전투에서는 5개를 받았습니다. | [map.js:171][hp-map] · [map.js:73][reward-map] · [bridge.js:314][hp-actual] | 원정·문 상세·지급 | HP 변덕이나 보물 접두사가 붙은 문에서 해당 수치가 어긋남 | 변덕 적용 후 HP를 표시하고, 확정 결정과 생존 특성에 따른 추가분을 구분합니다. |
| 낮음 | **창조신의 차징 예고가 다음 공격명을 잘못 알려 줍니다.** 전투 시드 `2`에서 3턴 카운트다운은 ‘다음 턴 차지!’입니다. 다음 턴 실제 행동은 물리 4배 디바인블레이드입니다. | [bridge.js:590][charge-name] · [hud.js:89][countdown] | 보스 전투·HUD 문구 | 창조신이 무작위 차징에 들어갈 때마다 발생 | 차징 동작명과 차징 완료 후 기술명을 별도로 전달합니다. |
| 낮음 | **전투 상세가 유물로 늘어난 상한을 기본값으로 설명합니다.** 버프오버로드로 필드 5개를 유지한 상태에서 상세는 ‘최대 3개’, 오버플레임으로 작열 5스택인 적의 상세도 ‘최대 3’입니다. | [sheets.js:16][status-sheet] · [sheets.js:118][field-sheet] · [battle_runtime.js:1225][field-core] | 실제 유물 규칙·상세 화면 함수 | 해당 유물을 장착하고 필드나 적 상태 상세를 열 때마다 발생 | 현재 장착 유물을 반영한 필드·상태 상한을 표시합니다. |
| 낮음 | **승리 결산에서 새로고침하면 사망·유품·보상 내역이 사라집니다.** 입문 1층에서 애쉬가 쓰러지고 눈토끼가 아마겟돈을 받은 뒤 새로고침하면 ‘돌파 / 살아남은 동료 깨우기’만 남습니다. 유품 지급 자체는 유지됩니다. | [view.js:578][receipt] · [view.js:531][receipt-rows] | 원정·저장 복원·결산 화면 | 일반 승리 결산에서 다음 버튼을 누르기 전에 새로고침할 때 | 최근 전투의 정산 결과를 방과 함께 저장해 결산 화면을 복원합니다. |
| 낮음 | **죽은 동료의 개인 기록에 ‘생환’이 남습니다.** 눈토끼를 대표로 홍련 시드 `21`에 출발해 눈토끼가 쓰러진 뒤 나머지 동료로 보스를 잡았습니다. 눈토끼 상세의 최근 기록은 ‘홍련 화산 · 8층 · 생환’입니다. | [nav.js:200][personal] · [collection.js:25][collection] | 원정·귀환 저장·동료 상세 화면 | 영입된 출전자가 사망한 원정을 다른 동료가 승리할 때마다 발생 | 원정 승패와 해당 동료의 생존 여부를 각각 기록합니다. |

### 참고 — 저장 손상·버전 변경을 주입한 경우

- **원정 부분만 읽을 수 없어도 정상 프로필까지 불러오지 못합니다.** 메모리 저장본에서 원정 버전만 `2`로 바꾸자 프로필 단독 복원은 성공했지만 세션 전체 로드는 `null`이었습니다. 이 상태에서 새 게임을 저장하면 기존 영입 기록까지 덮어쓸 수 있습니다. 프로필과 원정의 복구 가능 여부를 독립적으로 판정하는 편이 좋습니다. [save.js:62][bad-session]
- **손상된 자료 일부는 검사를 통과하고 다음 화면에서 실패합니다.** `profile.records={}`인 저장은 로드된 뒤 원정 준비에서 `records.clears` 접근 오류가 났습니다. `phase='room'`인데 `room=null`인 저장도 복원에 성공했고, 화면 분기에는 이 상태를 처리할 경로가 없습니다. 두 경우 모두 메모리 저장본을 변형해 확인했으며 일반 플레이 발생 건수에서 제외했습니다. [save.js:35][bad-run] · [save.js:47][bad-profile] · [ui/run/index.js:124][bad-route]

[ko]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/bridge.js:172>
[ko-end]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/run.js:261>
[save-write]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/save.js:55>
[nav-load]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/nav.js:31>
[gate-set]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/run.js:274>
[gate-take]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/run.js:301>
[duplicate]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/rooms.js:63>
[shard]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/run.js:44>
[intro-pick]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/run.js:150>
[reserve-ui]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/screens/recruit.js:56>
[gate-reserve]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/run.js:111>
[spring]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/run.js:322>
[spring-ui]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/screens/dungeons.js:92>
[heir-save]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/bridge.js:343>
[heir-load]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/bridge.js:305>
[form-sheet]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/battle/sheets.js:89>
[retreat]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/bridge.js:781>
[delay-death]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card/game/battle_runtime.js:467>
[charge]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/bridge.js:499>
[arena-design]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/plan/v1-decisions.md:82>
[quirk]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/rooms.js:112>
[affix]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/rooms.js:126>
[risk-design]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/plan/v1-decisions.md:57>
[storage]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/storage.js:6>
[persist]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/nav.js:54>
[progress-save]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/nav.js:40>
[progress]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/meta.js:96>
[progress-end]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/meta.js:135>
[battle-save]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/save.js:25>
[order]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/screens/order.js:16>
[random-preview]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/bridge.js:705>
[heir-tile]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/battle/tiles.js:78>
[bet-ui]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/screens/event.js:78>
[bet-rule]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/bridge.js:194>
[bet-test]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/tests/bridge.test.mjs:519>
[flora]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/content/bosses.js:12>
[flora-core]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card/game/logic.js:3070>
[instant]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/bridge.js:689>
[delay-tile]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/battle/tiles.js:63>
[sky-map]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/screens/map.js:62>
[sky-actual]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/run.js:175>
[hp-map]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/screens/map.js:171>
[reward-map]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/screens/map.js:73>
[hp-actual]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/bridge.js:314>
[charge-name]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/bridge.js:590>
[countdown]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/battle/hud.js:89>
[status-sheet]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/battle/sheets.js:16>
[field-sheet]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/battle/sheets.js:118>
[field-core]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card/game/battle_runtime.js:1225>
[receipt]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/battle/view.js:578>
[receipt-rows]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/battle/view.js:531>
[personal]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/nav.js:200>
[collection]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/screens/collection.js:25>
[bad-session]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/save.js:62>
[bad-run]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/save.js:35>
[bad-profile]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/save.js:47>
[bad-route]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/run/index.js:124>