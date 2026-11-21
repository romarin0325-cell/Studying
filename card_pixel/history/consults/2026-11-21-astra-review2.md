**높음 2건 · 중간 4건 · 낮음 4건, 총 10건입니다.** 출시 전에 먼저 고칠 문제는 **저장 공간이 찼을 때 기록 균열의 승리를 보존할 수 없는 것**과 **구버전에서 수락한 악몽 계약의 보상 ◆3이 사라지는 것**입니다.

`claude/relaymare-v1`의 로컬 HEAD `c518098`을 읽기 전용으로 검증했습니다. 기존 Node 테스트 **326개가 모두 통과**했고, 아래 10건은 실제 엔진이나 화면 함수를 Node에서 실행해 별도로 재현했습니다. 재현 경로에서 따로 지정하지 않은 전투와 보충은 `tools/sim.mjs`의 신중 선택을 사용했습니다.

| 심각도 | 문제 | 파일:줄 | 재현 | 도달 가능성 · 빈도 | 고치는 방향 한 줄 |
|---|---|---|---|---|---|
| 높음 | **기록 균열 승리 후 저장이 계속 실패하면 결과 화면에서 빠져나오거나 승리를 파일로 보존할 수 없습니다.** | [nav.js:265][rift-result] · [settings.js:96][backup-ui] | `2026-11-21`, 시드 `20261121`. 1층 저장 성공 뒤 저장소에 `QuotaExceededError`를 주입했습니다. 심야의 해구 7층을 33턴에 이겼지만 화면에는 `다시 저장`만 남았고, 재접속하면 1층이었습니다. 같은 시점의 메모리 상태로 만든 7층 백업은 검사를 통과했습니다. | 저장 공간 부족이 정산까지 지속될 때 발생합니다. 재접속 시 돌아가는 층은 마지막 저장 성공 지점입니다. | 실패 화면에 현재 균열을 담은 `기록 내보내기`를 제공합니다. |
| 높음 | **템포 v1에서 수락한 ‘마지막 유품’이 업데이트 후 6층 처치를 인정하지 않습니다.** | [run.js:419][contract] · [save.js:70][version] | 구버전 `1d0b276`, 홍련 화산 악몽 `0`. 4층에서 유품을 쓰지 않고 6층 정예 입구에서 저장했습니다. 같은 저장과 행동으로 헬하운드의 유품이 적을 처치했습니다. 구버전은 계약 달성·결정 **3→11**, 현행은 계약 실패·**3→8**이었습니다. | 구버전 계약을 진행 중인 이용자가 6층에서 처음 조건을 만족하면 매번 발생합니다. | 계약 수락 당시 버전으로 달성 조건을 판정합니다. |
| 중간 | **샘에서 미리 본 세 명을 무작위로 깨우면 지명 후보 세 자리가 전부 막힙니다.** | [run.js:646][offer-cache] · [spring.js:95][offer-disable] | 첫 본편 홍련 여정 `2`. 2층 위험 → 3층 제단 → 5층 보물 → 6층 정예 → 7층 샘. ◆10에서 `셋을 본다`를 닫고 무작위 깨우기 5회, 만석일 때는 첫 동료를 보냈습니다. 다시 열면 세 명 모두 선택 불가였습니다. **◆5와 합류 가능한 다른 동료 26명**이 남아 있었습니다. | 같은 샘에서 미리 본 후보를 무작위 합류로 모두 소진하면 발생합니다. 샘을 떠나는 것은 가능합니다. | 무작위 합류 뒤 자격을 잃은 후보 자리만 다시 채우고 새 거래 키를 발급합니다. |
| 중간 | **지도와 편성의 적 행동표가 보스 시범 턴에 다른 공격을 안내합니다.** | [run.js:312][beats] · [map.js:367][map-beats] · [order.js:195][order-beats] | 황혼 성당 여정 `0`, 2층 왼쪽 흑기사. 같은 문 상세에서 시범 설명은 MP 소멸, 적 행동표는 `2턴 · 암흑 베기(물리)`였습니다. 실제 2턴은 `소울드레인 예행`으로 **HP 피해 0, MP 65→53**이었습니다. | 2·6층 첫 적의 시범이 기본 행동을 대체하는 문에서 반복됩니다. | 지도·편성의 턴별 행동표에 실제 시범 동작을 반영합니다. |
| 중간 | **창조의 탑 조류 구간에서 전투 예고가 다음 공격의 종류와 위력을 모두 틀립니다.** | [bridge.js:799][tide-action] · [bridge.js:889][tide-preview] · [view.js:145][tide-banner] | 창조의 탑 여정 `1`, 2층 왼쪽 심연의 눈. 블랙스완으로 1·2턴 `회피태세`를 썼습니다. 2턴 HUD는 다음 턴 `조류의 일격 · 마법 ×2.5`, 실제 3턴은 **`잔물결 · 물리 ×0.75`**였습니다. | 탑의 조류 구간에서 시범을 맡은 적이 3턴까지 생존하면 발생합니다. | 다음 행동 예고와 지역 경고에 시범 직후의 잔물결 예외를 함께 적용합니다. |
| 중간 | **버프 오버로드를 장착해도 네 번째 시작 필드가 사라집니다.** | [run.js:276][sky-merge] · [bridge.js:448][sky-apply] | 별빛 정원 꿈결 `37`. 2층 왼쪽 → 3층 제단 → 4층 버프 오버로드 → 5층 ‘정원에 남은 두 의자’에서 등불 둘 → 6층 정예. 사건 필드 2개와 지역 필드 2개 중 **스타파우더가 빠져**, 전투가 5칸 중 3칸만 채운 채 시작했습니다. | 유물을 장착하고 사건·지역 시작 필드가 서로 다른 4개 이상일 때 발생합니다. | 시작 필드를 합칠 때와 전투에 적용할 때 모두 장착 유물의 실제 상한을 사용합니다. |
| 낮음 | **정예 유물과 내기 유물을 함께 받으면 승리 화면은 하나만 보여 줍니다.** | [run.js:530][double-relic] · [ui/run/index.js:135][receipt] | 황혼 성당 꿈결 `64`. 5층 ‘은하고래가 삼킨 종’에서 셋째 턴 처치 내기 → 6층 정예에서 행동 번호 `3→0→4`. 소지품에는 **빅뱅과 오버디바인**이 모두 추가됐고, 승리 화면에는 오버디바인만 표시됐습니다. | 유물을 건 5층 내기와 6층 정예 유물을 함께 획득할 때 발생합니다. | 정산에서 획득 유물 목록을 반환하고 승리 화면에 각각 표시합니다. |
| 낮음 | **‘보기 무료’인 지명 샘이 잔액 ◆0~2에서는 후보 공개도 거부합니다.** | [spring.js:22][free-label] · [run.js:647][free-check] | 새벽의 숲 `17`, `애쉬로 마지막 공격` → 4층 샘. ◆3에서 무작위로 세이렌을 깨워 ◆2가 된 뒤 처음 `셋을 본다`를 누르면 `결정이 부족하다`가 뜹니다. | 새 지명 후보를 열 때 잔액이 ◆3 미만이면 매번 발생합니다. | 잔액 검사를 합류 확정에만 적용합니다. |
| 낮음 | **직접 본 동료가 귀환 뒤에도 출현표와 도감에서 미조우로 남습니다.** | [run.js:677][seen-offer] · [rooms.js:401][seen-doors] · [collection.js:22][seen-ui] | 홍련 여정 `0`, 7층 샘에서 공허의기사·생크림메이드를 보고 닫은 뒤 생환해도 둘 다 미조우였습니다. 별빛 꿈결 `37`에서도 5층 사건에서 빅토리아를 만나 등불을 받은 뒤 생환했지만 빅토리아가 미조우로 남았습니다. | 처음 본 동료를 샘에서 지명하지 않거나 사건에서 합류시키지 않고, 이후 다른 경로에서도 만나지 않으면 발생합니다. | 샘 후보를 공개하거나 사건 인물이 실제 등장할 때 조우를 기록합니다. |
| 낮음 | **악몽 출발 준비 중 새로고침하면 선택한 계약만 풀립니다.** | [dungeons.js:217][prep-choice] · [nav.js:496][prep-resume] | 새벽 `17` → 홍련 여정 `0` 생환 후 악몽 준비에서 `마지막 유품` 선택. 바로 출발하면 계약이 적용됩니다. 저장을 다시 읽어 같은 준비 화면에서 출발하면 난이도는 악몽이고 계약은 `없음`입니다. | 계약을 선택한 뒤 출발 전에 새로고침할 때마다 발생합니다. 그대로 출발하면 해당 원정에서 계약을 다시 수락할 수 없습니다. | 준비 중인 행선지와 계약을 함께 저장하고 출발·준비 취소 때 비웁니다. |

**유물 교체 화면의 도달성**도 확인했습니다. 홍련 여정 `0`에서 3층 피뢰침 구매 → 4층 문지기 유물 → 5층 보물 → 6층 정예로 실제 네 칸을 채웠습니다. 현행 본편의 7·8층에는 영구 유물 지급처가 없고, 앞선 층에서도 한 원정의 영구 유물은 최대 4개입니다. 교체 비교는 다섯 번째 유물에서 열립니다. 따라서 **현재 본편에서는 플레이로 교체 비교 화면에 도달할 수 없습니다.** 화면 테스트는 유물 네 개를 직접 넣은 뒤 다섯 번째를 지급합니다. 이 항목은 위 10건과 별도인 콘텐츠 도달성 확인입니다. [층 배치][layout] · [교체 발동 조건][relic-cap] · [화면 테스트 상태 생성][fixture]

**참고 — 손상 데이터를 주입한 재현 2건**

| 심각도 | 문제 | 파일:줄 | 재현 | 도달 가능성 | 고치는 방향 한 줄 |
|---|---|---|---|---|---|
| 참고 | **균열 저장 하나가 손상되면 정상 본편의 내보내기와 정상 귀환본 복구까지 막힙니다.** | [save.js:195][validate-daily] · [save.js:267][restore-good] | 새벽 `17`·홍련 `0` 생환 뒤 본편 2층과 `2026-11-21` 균열 1층을 함께 저장했습니다. 균열 JSON만 잘라 내자 본편 로드는 `ok`, 내보내기는 `invalid_daily`였습니다. 주 저장까지 손상시켜 복구 화면 조건을 만들면 직전 귀환본은 `ok`인데 복구가 `invalid_daily`로 실패했습니다. | 저장 내용을 인위적으로 훼손했습니다. 자연 발생 빈도는 확인할 수 없습니다. | 정상 본편·귀환본을 복원하고 손상된 균열만 별도로 처리합니다. |
| 참고 | **잘못된 귀환자 목록을 가진 백업이 가져오기 검사를 통과하고 관측소에서 멈춥니다.** | [save.js:110][validate-ui] · [save.js:223][import-good] · [hub.js:8][hub-crash] | 새벽 `17` 생환 백업의 `profile.ui.returners`만 배열에서 `{}`로 바꿨습니다. 검사·가져오기가 모두 성공하고 직전 귀환본까지 교체된 뒤, 관측소 구성 중 `TypeError: recent is not iterable`이 발생했습니다. | 손으로 변형한 백업 파일에서 재현했습니다. | 가져오기 확정 전에 귀환자 목록의 배열 타입과 원소를 검증합니다. |

추가로 **6명 만석에서 2인 사건 → 문지기 포로 → 보충 → 샘 지명**을 이어도 인원은 6명을 유지했고, 저장·복원 뒤 지명 비용은 한 번만 차감됐습니다. 주·월 경계의 미션 집계와 지난주 보상 중복 수령 방지, 꿈결 승리 후 악몽 잠금 유지, 본편·균열 동시 저장 왕복, 계약·균열 도입 전 저장 복원, 읽기 설정·배속 재적용도 확인했습니다. 실제 브라우저의 화면 배치와 파일 선택·다운로드 동작은 확인하지 않았습니다. 파일 수정은 없습니다.

[rift-result]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/nav.js:265>
[backup-ui]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/settings.js:96>
[contract]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/run.js:419>
[version]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/save.js:70>
[offer-cache]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/run.js:646>
[offer-disable]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/screens/spring.js:95>
[beats]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/run.js:312>
[map-beats]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/screens/map.js:367>
[order-beats]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/screens/order.js:195>
[tide-action]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/bridge.js:799>
[tide-preview]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/bridge.js:889>
[tide-banner]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/battle/view.js:145>
[sky-merge]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/run.js:276>
[sky-apply]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/bridge.js:448>
[double-relic]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/run.js:530>
[receipt]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/run/index.js:135>
[free-label]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/screens/spring.js:22>
[free-check]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/run.js:647>
[seen-offer]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/run.js:677>
[seen-doors]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/rooms.js:401>
[seen-ui]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/screens/collection.js:22>
[prep-choice]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/screens/dungeons.js:217>
[prep-resume]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/nav.js:496>
[layout]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/content/layouts.js:5>
[relic-cap]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/rooms.js:70>
[fixture]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/tests/screens.mjs:506>
[validate-daily]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/save.js:195>
[restore-good]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/save.js:267>
[validate-ui]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/save.js:110>
[import-good]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/save.js:223>
[hub-crash]: <C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/screens/hub.js:8>