## 결론 10줄

1. **첫 플레이어가 가장 이해하기 어려운 것은 ‘어디를 누르나’보다 ‘누르면 누가 맞나’입니다.** 첫 선택에서 3인 순서, 적 예고, 후퇴의 대가, 생존, 유품이 한꺼번에 등장합니다.
2. 첫 전투에는 이미 좋은 정보가 있습니다. `애쉬 HP 40`, `적 공격 132`, `후퇴 시 눈토끼 HP 290 → 149`를 두 선택지 곁에서 함께 읽을 수 있게 하는 것이 가장 큰 개선입니다.
3. 3인 릴레이는 기존 첫 화면에 초상 셋과 진행 방향 하나로 보여 줄 수 있습니다. 설명 카드를 닫는 탭을 추가할 필요가 없습니다.
4. **편성 안내는 실제 조작과 충돌합니다.** 현재는 시작 버튼만 밝고 자리 교환은 막힙니다. 세 자리를 만져 볼 수 있게 열고, 기본 편성으로 즉시 시작하는 길도 함께 두는 편이 좋습니다.
5. 깨우기에는 **이번 원정**, 영입에는 **다음 원정에도**를 붙이면 비슷하게 생긴 두 선택의 차이를 설명할 수 있습니다.
6. 조사한 상용 모바일 게임은 스크롤을 씁니다. 홈·전투·결과는 주요 조작을 일정한 자리에 두고, 행선지·명단·상품처럼 길이가 변하는 내용에 스크롤을 쓰는 사례가 많았습니다.
7. RELAYMARE에서 화면 본문 전체가 세로로 움직일 수 있는 제품 화면은 **15종**입니다. 고정화의 우선순위는 깨우기·문·편성·귀환 영입입니다.
8. 소유자가 본 가림은 이전 캡처에서 확인됩니다. 360×740에서는 하단이 **374px, 화면의 50.5%**였고 상태가 많은 적 창은 **무대 높이의 53.5%**를 덮었습니다.
9. **11월 22일 02:53 빌드에서 이미 크게 개선됐습니다.** 같은 전투의 무대가 390×844에서 **428px**, 360×740에서 **392px**입니다. 하단 전체는 각각 **43.1%, 40.0%**입니다.
10. 새 일반 전투에서는 세 동료가 보입니다. 남은 가림은 **상태가 많은 전투의 왼쪽 전장 표시와 대기 동료**, 남은 이해도 문제는 **첫 선택의 인과관계와 편성 조작**에 집중돼 있습니다.

기준은 `claude/relaymare-ui` 작업 폴더의 소스와 저장 캡처입니다. 조사 중 배포본이 갱신되어, 전투 치수는 **02:53:39 배포본 이후 양쪽 해상도에서 찍힌 동일 장면**을 본표에 사용했습니다. 파일은 읽기만 했습니다.

## 1. 튜토리얼 이해도

### 현재 단계에서 놓치기 쉬운 것

개념 수는 해당 화면에서 올바르게 판단하기 위해 연결해야 하는 규칙이나 결과의 수입니다. 실제 초심자 이해율은 **미확인**입니다. 지난 재감사의 맞서기 경로는 입문 영입까지 15화면·24탭, 첫 본편 보스 결과까지 40화면·64탭이었습니다. 그 경로에서 본 기본 안내 10개는 이미 실제 버튼으로 진행됐습니다. 개선의 초점은 탭 수보다 **그 탭으로 무엇을 알게 되는가**입니다. [지난 재감사:15](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/history/consults/2026-11-22-astra-reaudit.md:15>) · [결정 장부 13절:265](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/plan/v1-decisions.md:265>)

| 현재 화면 | 개념 수 | 처음 보면 놓치기 쉬운 점과 현재 문구의 ‘왜’ |
|---|---:|---|
| 제목 → 꿈길 입장 | 1 | 출발 목적과 버튼이 일치합니다. 여기서 전투 규칙까지 미리 설명할 이유는 적습니다. [tutorial.js:11](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/ui/tutorial.js:11>) |
| 첫 대여전 선택 | 5 | 세 명 중 한 명씩 싸움, 내 행동 뒤 적 행동, 후퇴하면 다음 동료가 맞음, 애쉬 생존, 쓰러지면 기술 계승. 버튼 안에는 결과가 꽤 잘 적혀 있습니다. 다만 코치는 두 버튼만 밝히고 적의 `132`는 위쪽에 어둡게 남깁니다. 이때 파티 칩과 메시지는 숨겨집니다. 세 캐릭터 그림을 보고 **셋이 함께 싸운다**고 해석해도 화면이 바로잡아 주기 어렵습니다. [첫 선택 캡처](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/entry-stand-opening.png>) · [tiles.js:106](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/ui/battle/tiles.js:106>) · [battle.css:212](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/styles/battle.css:212>) |
| 맞서기 → 유품 | 2 | “눈토끼가 애쉬의 아마겟돈을 받았어”는 누가 무엇을 받았는지 잘 말합니다. **애쉬가 쓰러졌기 때문에** 받았다는 원인, 평소 기술과 다른 **MP 0·전투당 한 번**은 버튼과 앞 화면을 연결해야 알 수 있습니다. [계승 캡처](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/entry-stand-inherit.png>) · [rulebook.js:27](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/content/rulebook.js:27>) |
| 물러나기 → 구조 후 공격 | 2 | “애쉬는 살아 있어”는 선택의 보상을 설명합니다. 그 대가로 **이번 턴을 썼고 눈토끼가 공격을 받았다**는 사실은 약합니다. 다음 안내는 그냥 공격하라고 하지만 실제로는 사용 가능하면 `실버스톰` 한 칸을 지정합니다. [구조 캡처](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/entry-rescue-rescue.png>) · [tutorial.js:119](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/ui/tutorial.js:119>) · [rulebook.js:22](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/content/rulebook.js:22>) |
| 깨우기 → 확정 | 3 → 0 | 앞 전투에서 이어진 동료, 직접 고를 한 명, 추가 무작위 세 명이 한 화면에 나옵니다. “이번 원정”은 좋은 표현입니다. 반면 “나머지도 함께 깨어나”는 **화면에 보이는 탈락 후보도 모두 받는다**고 읽힐 수 있습니다. 확정 안내는 선택 내용을 거의 반복합니다. [깨우기 캡처](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/entry-stand-awakening.png>) · [awaken.js:65](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/ui/screens/awaken.js:65>) · [rulebook.js:97](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/content/rulebook.js:97>) |
| 3층 문 | 2 | 경로 선택과 적 비교를 동시에 요구합니다. “문에 적의 공격이 보여”라고 하지만 입문 캡처에서 두드러지는 것은 **적 이름과 결정 +1**입니다. `정보`는 별도 버튼이고 코치는 문 진입 버튼만 허용합니다. 두 문 중 하나를 고를 이유를 찾는 사람이 상세를 열기 어렵습니다. [문 캡처](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/entry-stand-doors.png>) · [map.js:312](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/ui/screens/map.js:312>) · [coach.js:138](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/ui/coach.js:138>) |
| 편성 | 2 | “선봉부터 싸워”는 첫 자리의 의미를 말합니다. **두 자리를 차례로 누르면 순서가 바뀐다**는 실제 조작을 배울 기회가 없습니다. 코치가 `이대로 전투 시작`만 허용하기 때문입니다. [편성 캡처](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/entry-stand-formation.png>) · [order.js:59](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/ui/screens/order.js:59>) · [tutorial.js:18](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/ui/tutorial.js:18>) |
| 생환 → 영입 확정 | 2 → 0 | “다음에도 만날 수 있어”는 장기적 이득을 암시합니다. 깨우기와 비슷한 후보 목록에서 다시 한 명을 고르므로 **이미 받은 동료를 왜 또 고르는가**가 남습니다. 여기서는 살아 돌아온 미영입 동료를 관측소에 등록합니다. 후보가 한 명이면 이미 선택된 상태로 시작합니다. [영입 캡처](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/entry-stand-recruit.png>) · [nav.js:299](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/ui/nav.js:299>) · [결정 장부:256](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/plan/v1-decisions.md:256>) |
| 관측소 → 첫 본편 | 1 | 실제 버튼에는 동료와 지역 이름이 있어 결과가 분명합니다. 코치의 “이 동료”도 같은 이름을 쓰면 방금 영입한 인물과 출발 버튼이 연결됩니다. [출발 캡처](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/entry-rescue-departure.png>) · [meta.js:319](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/engine/meta.js:319>) |

지난 재감사가 지적한 **360×740·글자 125%에서 깨우기 말풍선과 건너뛰기가 잘리던 문제**는 새 저장 캡처에서 개선됐습니다. 첫 후보와 건너뛰기가 보이고, 아래 후보는 목록을 움직여 보는 구조입니다. 현재 코드도 보이는 후보의 경계를 계산하고 말풍선 공간을 확보합니다. 손가락으로 모든 후보를 선택하는 실기 결과는 **미확인**입니다. [이전 캡처](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens-360x740/entry-rescue-failure.png>) · [개선 후 캡처](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens-360x740/entry-rescue-awakening.png>) · [coach.js:84](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/ui/coach.js:84>)

### 상용 게임의 첫 전투에서 확인한 방식

| 게임 | 실제 화면과 조작 | RELAYMARE에 주는 근거 |
|---|---|---|
| 파이어 엠블렘 히어로즈 | 첫 맵에서 안나와 이동 칸을 포인터·화살표로 연결합니다. 플레이어가 직접 이동한 뒤, 다음 단계에서 적을 사각형으로 강조하고 직접 공격하게 합니다. 무기 상성처럼 세 관계를 한눈에 봐야 하는 규칙에는 뒤에서 작은 도식을 씁니다. | 화살표는 **원인과 결과 두 곳을 연결할 때**, 짧은 그림은 **동시에 봐야 할 관계가 있을 때** 효과적입니다. [첫 플레이 녹화와 단계별 기록](https://mgt.stelabouras.com/fire-emblem-heroes/) |
| 퍼즐앤드래곤 | 첫 튜토리얼에서 아래 드롭판을 직접 밀어 같은 색 세 개를 맞춥니다. 바로 위에 아군 초상과 HP, 위쪽에 적이 있어 한 번의 손동작이 공격으로 이어지는 것을 봅니다. 공식 안내도 던전 화면·공격과 팀 편성·육성을 다른 편으로 다룹니다. | 첫 행동으로 전투 규칙을 경험하고, 팀을 고르는 설명은 실제 편성 시점에 붙일 수 있습니다. [첫 플레이 기록](https://omoshiro-hasshin.hatenablog.com/entry/2014/06/27/005351) · [공식 튜토리얼 영상](https://pad.gungho.jp/member/tutorial/) |
| 블루 아카이브 | 출시 초기 플레이 기록에서는 첫 전투가 자동 진행되고 설명이 뜨면 탭해 계속합니다. 이후 첫 모집, 편성 안내, 두 번째 전투로 이어집니다. 전투 화면의 직접 조작은 오른쪽 아래 스킬 카드와 공용 코스트에 모입니다. | 첫 전투에 편성까지 넣지 않아도 됩니다. RELAYMARE에서는 이미 실제 선택이 있는 물러나기와 유품 사용이 안내를 끝내기에 적합합니다. [초기 플레이 순서와 실제 화면](https://intindex.stars.ne.jp/archives/7446) |

### 제안 단계표

`{이름}`, `{피해}`, `{남은 HP}`는 그 전투의 실제 값입니다. 아래 첫 두 행은 같은 화면에서 이어지며 추가 확인 탭은 없습니다.

| 화면 | 문구 | 가리키는 곳 | 끝나는 조건 | 새 시각 요소 |
|---|---|---|---|---|
| 꿈길 입장 → 대여전 등장 | “앞에서 한 명씩 싸워. 지금은 애쉬 차례야.” | 애쉬 → 눈토끼 → 은토끼 | 기존 `꿈길 입장`으로 전투가 열리고 두 선택지가 활성화됨 | 기존 애쉬 초상 옆에 작은 초상 둘과 진행 방향 하나. 현재 출전만 밝게 |
| 적 첫 예고와 두 선택 | “내 행동 뒤 골렘이 132 피해를 줘. 애쉬의 HP는 40이야.” | 적 예고 `132`, 애쉬 `40`, 두 선택 버튼 | 실제로 `물러나기` 또는 `애쉬로 마지막 공격` 중 하나를 누름 | 두 숫자를 동시에 강조. 후퇴 버튼에는 `눈토끼 290 → 149`, 맞서기에는 `쓰러지면 아마겟돈 계승` 유지 |
| 구조 분기 | “애쉬는 살았어. 대신 맞은 눈토끼로 실버스톰을 써 봐.” | 눈토끼의 바뀐 HP와 실제 사용 가능한 기술 | 해당 기술이 발동 | 애쉬에 `생존`, 눈토끼에 피해 변화 한 번. 기술명은 실제 지정 기술과 일치 |
| 맞서기 분기 | “쓰러진 애쉬가 아마겟돈을 남겼어. 눈토끼로 써 봐.” | 애쉬 초상에서 유품 버튼으로 | 유품 공격이 실제 발동 | 짧은 전달 화살표와 버튼의 `MP 0 · 1회`. 구조를 택한 사람에게는 첫 실제 계승 때 표시 |
| 깨우기 | “이번 원정에 데려갈 한 명을 골라.” | 후보 카드, 선택 후 이름이 들어간 확정 버튼 | 후보 선택 후 `{이름} 합류`를 누름 | 직접 고른 동료와 `무작위 합류 3명`을 결과에서 구분 |
| 첫 전투 문 | “두 문은 만날 적이 달라. 싸울 적을 골라.” | 두 문의 적 이름, `정보`, 문 진입 버튼 | 문을 눌러 그 전투의 편성으로 이동. 정보 열람은 선택 | 두 문에 실제로 다른 정보 하나를 같은 위치에 표시. 첫 행동 데이터가 있으면 그 값을 사용 |
| 첫 편성 | “선봉부터 싸워. 바꾸려면 두 자리를 차례로 눌러.” | 세 자리와 `이대로 전투 시작` | 교환 여부와 관계없이 전투 시작이 승인됨 | 첫 자리를 누르면 교환 가능한 자리만 강조. 선봉·중견·대장 명칭 유지 |
| 귀환 영입 | “관측소에 영입할 한 명을 골라. 다음 원정에도 쓸 수 있어.” | 생환 후보와 `{이름} 영입` | 관측소 명단에 실제 등록됨 | 후보에 `생환`, 확정 뒤 같은 초상에 `영입`. 후보 한 명이면 기존 자동 선택 유지 |
| 첫 본편 출발 | “{이름}와 {지역}으로 떠나자.” | 동료와 지역이 적힌 출발 버튼 | 해당 원정 시작 | 방금 영입한 초상을 출발 버튼에 재사용 |

**그림이 가장 필요한 곳은 첫 릴레이 한 곳입니다.** 첫 화면에서는 파티 칩이 숨고, 구조와 계승 중 한쪽만 직접 경험합니다. 초상 셋을 선택지 옆에 두면 플레이어는 *누가 다음 사람인지* 본 상태에서 결정할 수 있습니다. 깨우기·문·편성에는 이미 조작할 카드와 자리가 있으므로 그 위에서 안내를 끝낼 수 있습니다. [입문 파티와 초기 HP](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/content/intro.js:2>) · [분기별 실제 명령 처리](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/ui/tutorial.js:209>)

## 2. 상용 모바일의 화면 이동과 RELAYMARE의 스크롤

### 실제 게임 5종

| 게임 | 확인한 화면 이동과 스크롤 |
|---|---|
| 파이어 엠블렘 히어로즈 | 세로 홈의 하단 메뉴에서 전투·동료·소환·상점 등으로 이동합니다. 홈 배너를 누르면 상세로 들어가고, 전투는 전술 맵으로 전환됩니다. 늘어나는 동료는 병영 명단과 필터에서 찾습니다. 확인한 홈은 고정 목적지 방식입니다. [닌텐도 홈·전투·상점 화면](https://new-guide.fire-emblem-heroes.com/en-US/feh-1010.html) · [공식 병영 필터 안내](https://faq.fire-emblem-heroes.com/hc/en-us/articles/9586216217369-I-can-t-find-a-Hero-I-obtained-What-should-I-do) |
| Fate/Grand Order | 가로 터미널에서 오른쪽 퀘스트 배너 목록에 세로 스크롤 표시가 있고, 오른쪽 아래 `MENU`는 별도 위치에 있습니다. 메뉴에서 편성·상점 등으로 이동하며 파티 편성은 슬롯 중심의 독립 화면입니다. **행선지 목록과 전역 메뉴를 동시에 유지하는 사례**입니다. [터미널 원본 캡처](https://github.com/Granbluemaster/FGO/blob/master/doc/16-9.png) · [공식 메인 메뉴](https://www.fate-go.jp/howto/manual/2.html) · [공식 편성 화면](https://www.fate-go.jp/howto/manual/3.html) |
| 블루 아카이브 | 가로 홈 오른쪽 아래 `업무`로 임무에 들어가고, 학생 명단·편성·전투는 각각 다른 화면입니다. 홈 오른쪽 위 우편으로 보상을 받습니다. 전투 중에는 오른쪽 아래가 스킬 조작 자리입니다. 학생 명단에서 스크롤할 때 어느 장식까지 함께 움직이는지는 인용한 화면만으로 **미확인**입니다. [홈에서 임무·편성으로 가는 실제 플레이](https://intindex.stars.ne.jp/archives/7446) · [전투 원본 캡처](https://github.com/pur1fying/blue_archive_auto_script/blob/master/docs/assets/auto_fight/yolo_demo2.png) |
| 서머너즈 워 | 상점에 카테고리 탭, 상품 칸, 자원 표시가 함께 있고 자원 부족 확인은 가운데 팝업으로 뜹니다. 거인의 던전 승리 화면에서는 결과·획득 자원·아군 경험치를 한 장에서 확인합니다. 상점 끝 상품이 잘린 구성은 보이지만 스와이프 제스처 자체는 **미확인**입니다. [상점과 확인 팝업](https://github.com/justindannguyen/sw-bot/blob/master/src/test/resources/sampleScreen.png) · [승리·보상 원본](https://github.com/Natanhel/SummonerBot/blob/master/dataset/gb10_victory_pre_sell.jpg) |
| 클래시 로얄 | **긴 세로 상점**의 사례입니다. 2025년 플레이어 기록에서는 상품을 아래로 스크롤하며 하단 상점 탭을 다시 누르면 일일 특가로 이동합니다. 상품 카탈로그가 길어도 목적지 버튼은 남습니다. 현재 버전의 탭 재선택 동작은 **미확인**입니다. [실제 상점 이동 기록](https://www.reddit.com/r/ClashRoyale/comments/1j5jpyo/livehack_quicker_navigation_through_the_shop/) · [Supercell 상점 안내](https://support.clashroyale.com/hc/en-us/articles/49484889956251-Shop-Offers) |

이 표본에서 **고정할 가치가 큰 것은 화면 전체보다 다음 행동의 위치**입니다. 전투에서는 명령, 편성에서는 출전, 결과에서는 다음 목적지가 그 자리에 해당합니다. 반대로 도감·상품·기록은 항목 수가 늘기 때문에 목록 스크롤이 자연스럽습니다. 하단 탭바는 홈의 동급 목적지를 오갈 때 유용하고, 전투 중에는 그 자리를 전투 명령에 돌려주는 사례가 보입니다. RELAYMARE에도 **고정된 관측소·독립 편성·전투 결과 시트·스크롤되는 도감**을 함께 쓰는 구성이 맞습니다.

### RELAYMARE 전수 조사

브라우저 문서 자체가 세로로 밀리는 제품 화면은 **0종**입니다. `#frame`은 넘침을 숨기고 각 화면이 프레임을 채웁니다. 사용자가 ‘페이지 전체를 스크롤한다’고 느끼는 것은 **헤더 아래 본문 전체가 하나의 스크롤 영역**인 경우입니다. 실제 제품 경로에서 `.scroll` 5종, `.run-route`·`.run-event` 2종, `.meta-page` 8종을 찾았습니다. 본문에 `overflow`가 있어도 짧은 상태에서는 전부 한 화면에 들어갑니다. [base.css:52](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/styles/base.css:52>) · [screens.css:127](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/styles/screens.css:127>) · [meta.css:48](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/styles/meta.css:48>) · [전체 메타 화면 등록:27](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/ui/nav.js:27>)

아래 비용은 상대치입니다. **소**는 기존 배치와 스크롤 영역 조정, **중**은 선택 상태·포커스·복귀 위치 조정, **대**는 지도 연출과 진입 동선까지 바꾸는 경우입니다. 파일명이 단독으로 적힌 원정 화면 코드는 `card_pixel/game/src/ui/screens/` 기준입니다.

| 화면 | 고정 화면으로 바꾸는 안 | 우선·비용 | 코드와 저장 캡처 |
|---|---|---|---|
| 깨우기·추가 합류 | 기존 확정 버튼 유지. 생존 동료는 작은 고정 줄, 후보만 목록 스크롤. 합류 결과는 한 장 | 1·중 | `awaken.js:27,57,78` · [후보 화면](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/entry-rescue-awakening.png>) |
| 편성 | 적 요약·세 자리·시작 버튼 고정. 대기 명단만 스크롤 | 1·중 | `order.js:80` · [편성판](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/formation-board.png>) |
| 샘·세 후보 | 결정 수와 구매·나가기 고정. 한 번 뽑기와 후보 선택을 나누고 후보 칸만 스크롤 | 2·중 | `spring.js:32,114` · [샘](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/spring-rates.png>) · [세 후보](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/spring-commit.png>) |
| 제단 | 현재 축복과 굴린 축복을 같은 자리에 표시. 받기·다시 굴리기 고정 | 3·소 | `altar.js:24` · [제단](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/tour-altar.png>) |
| 보물·유물 교체 | 새 유물과 장착 버튼 고정. 네 칸이 찼을 때만 비교 시트 | 2·중 | `treasure.js:32`, `ui/run/index.js:274` · [보물](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/tour-relic.png>) · [교체 비교](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/relic-compare.png>) |
| 원정 지도·문 | 층 표시와 걷는 무대를 고정하고, 문 선택을 같은 하단 영역에 둠. 적 상세는 기존 시트 이용 | 1·대 | `map.js:270,301,312` · [지도와 문](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/map-seats.png>) |
| 사건 | 장면과 사건 제목 고정. 설명이 길면 대화 칸, 선택지가 많으면 선택지 칸만 스크롤 | 2·중 | `event.js:153` · [사건과 선택지](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/event-values.png>) |
| 행선지 | 지역 목록만 스크롤. 선택 지역의 준비·출발을 고정하고 뒤로 오면 같은 지역 유지 | 2·중 | `ui/nav.js:216,267`, `dungeons.js:44` · [행선지](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/destinations.png>) |
| 생환·실패 정산과 영입 | 귀환 요약과 확정 버튼 고정. 영입·예약 후보만 스크롤. 현재 확정 버튼은 본문 안에 있음 | 1·중 | `ui/nav.js:299`, `recruit.js:45` · [긴 후보 목록](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/entry-recruit-unlock-recruit-tags.png>) · [실패 정산](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/run-lost-recruit.png>) |
| 동료 도감 | 검색·필터 고정, 초상 격자만 스크롤. 상세를 닫으면 같은 동료 위치로 복귀 | 2·소 | `ui/nav.js:159`, `collection.js:77` · [격자와 상세 시트](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/entry-appearance.png>) |
| 꿈길 수첩 | 장·임무 탭을 고정하고 선택 탭의 항목만 스크롤 | 2·중 | `ui/nav.js:160`, `notebook.js:50` · [수첩](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/missions-invitations.png>) |
| 기록 | 원정·균열 등 기록 종류를 고정하고 이력만 스크롤. 회차 상세는 시트 | 2·중 | `records.js:37` · [기록 목록](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/rift-records.png>) |
| 엔딩 | 장면·관측소 복귀 고정. 정산과 꿈 기록은 탭이나 넘기기 | 3·중 | `ui/nav.js:201`, `ending.js:7` · [엔딩](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/ending-goal.png>) |
| 일일 균열 결과 | 점수와 다음 행동 고정. 기록 상세만 펼침. 승리·실패·기록 복구 분기가 같은 본문 틀을 사용 | 3·소 | `ui/nav/daily.js:109,135` · [균열 결과](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/rift-result-win.png>) |
| 저장 복구 | 복구·가져오기 등 선택을 한 화면에 유지. 긴 백업 비교만 시트 | 3·소 | `ui/nav.js:396` · [복구 화면](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/save-recovery.png>) |

코드 검색에서 추가로 잡히는 **동료 보충과 문지기 보상**에는 독립 화면용 `.scroll` 분기가 남아 있습니다. 현재 제품 호출은 둘 다 `inline: true`여서 **승리 결과 시트 내부**에 나타납니다. 일반 전투 결과는 최대 높이 90%의 시트, 준비 화면은 시트 본문과 출현 명단, 큰 글자 전투는 명령 패널 안에서 스크롤합니다. 관측소 홈은 `.meta-page`의 `overflow`를 별도로 숨깁니다. 독립 상점 화면은 현재 화면 등록표에 없습니다. [보충 템플릿:59](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/ui/screens/reinforce.js:59>) · [문지기 템플릿:17](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/ui/screens/gate-pick.js:17>) · [실제 제품 호출:162](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/ui/run/index.js:162>) · [결과 안 보충](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/reinforcement-board.png>) · [결과 안 보상](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/relic-compare-gate.png>) · [홈 예외:97](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/styles/meta.css:97>) · [결과 시트:239](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/styles/battle.css:239>)

## 3. 전투 화면 크기

### 상용 전투 화면에서 잰 비율

분모는 해당 캡처의 게임 화면 높이입니다. 분산된 표시는 실제 표시 한 개의 높이를 재고, 서로 겹치는 항목은 합산하지 않았습니다. 아래 수치는 특정 전투 장면의 근삿값입니다.

| 게임·측정 장면 | 적 정보 | 아군 정보 | 명령 | 화면 구성과 출처 |
|---|---:|---:|---:|---|
| **블루 아카이브**, 가로 보스전 1274×718 | 중앙 상단 이름·HP 약 **7%**, 얼굴 표식 포함 약 **11~12%** | 머리 위 상태 아이콘 약 **3%**. 고정 파티 띠 **0%** | 오른쪽 아래 스킬 카드 약 **14%**, 코스트까지 **18%** | 명령은 오른쪽 일부만 점유합니다. 원본에 덧그린 인식용 사각형과 이름은 측정에서 제외했습니다. [원본 전투 캡처](https://github.com/pur1fying/blue_archive_auto_script/blob/master/docs/assets/auto_fight/yolo_demo2.png) |
| **에픽세븐**, 가로 미궁 전투의 기술 연출 중 | 개별 레벨·HP 표식 약 **3%** | 왼쪽 아래 현재 영웅 이름·수치 약 **9%**, 초상 포함 약 **23%** | 오른쪽 아래 소울·동료 조작군 약 **14%** | 왼쪽 턴 순서, 각 유닛 위 HP, 아래 양쪽 정보를 분산합니다. 원본 높이 1132px 기준이며 이 장면의 평상시 수동 스킬 버튼과 캡처 단말은 **미확인**입니다. [원본 전투 캡처](https://github.com/Kangkangnice/epic7-automation/blob/main/tests/fixtures/epic7_labyrinth_stone/battle.png) |
| **퍼즐앤드래곤**, 세로 턴제 전투 | 적 카운트다운 약 **2.5%**, 적 아래 HP 약 **1.3%** | 아군 초상과 HP 약 **13%** | 6×5 드롭판 약 **48%** | 에뮬레이터·OS 테두리를 뺀 게임 높이 약 976px 기준입니다. 하단 절반이 매 턴 손가락으로 조작하는 보드이며 적 캐릭터는 그 위에 따로 서 있습니다. [원본 전투 캡처](https://github.com/kukaiN/PAD_AlgorithmicSolver/blob/master/TestFile/puzzleanddragonboard.png) · [공식 화면 자료](https://www.gungho.co.jp/jp/news/uploads/pdf/286.pdf#page=2) |

따라서 **상용 게임의 적정 하단 비율을 하나로 정할 근거는 없습니다.** 세 사례의 공통점은 적 정보가 누구의 것인지 위치로 읽히고, 필요한 명령이 매번 같은 곳에 있으며, 큰 조작 영역을 쓸 때 캐릭터가 설 공간을 따로 확보한다는 점입니다.

### RELAYMARE 실제 치수

두 캡처 모두 별빛 정원 시드 1, 2턴, 배리어 사용 뒤 같은 적 예고가 뜬 장면입니다. 기본 글자 크기, 캡처 배율 1, 안전 영역 여백 0 기준입니다. 도트 외곽선·그림자는 박스 바깥으로 약 2px 나올 수 있습니다. [390×844 원본](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/tempo-telegraph.png>) · [360×740 원본](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens-360x740/tempo-telegraph.png>) · [같은 장면의 입력:1302](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/screens.mjs:1302>)

| 요소 | 390×844 | 360×740 | 판독 |
|---|---:|---:|---|
| 상단 `#bar` | **52px · 6.2%** | **52px · 7.0%** | 두 화면 모두 y=0~52 |
| 무대 `#stage` | **428px · 50.7%** | **392px · 53.0%** | y=52~480 / 52~444. CSS와 JS가 별도 높이를 확보 |
| 적 상태창 `#foebar` 본체 | **86px · 10.2%** | **86px · 11.6%** | y=66~152. 폭 약 257/238px. 위로 나온 종류 탭은 별도 |
| 파티 칩 줄 `#party` | **78px · 9.2%** | **78px · 10.5%** | 칩 한 장은 양쪽 **70px**. 이 편성에서는 긴 이름이 두 줄 |
| 메시지 `#msg` | **30px · 3.6%** | **30px · 4.1%** | y=562~592 / 526~556. 위 여백 4px 별도. 여러 줄 후퇴 결과는 늘어날 수 있음 |
| 명령 패널 `#panel` 전체 | **252px · 29.9%** | **184px · 24.9%** | y=592~844 / 556~740. 아래 두 행과 여백을 포함 |
| 명령 타일 2×2 | **148px · 17.5%**, 한 칸 71px | **118px · 15.9%**, 한 칸 56px | 실제 보이는 타일 끝 기준. 360에서는 `#acts`에 배정된 약 114px보다 두 행의 최소 높이가 4px 더 큼 |
| 물러나기·유품 줄 `#row2` | **50px · 5.9%** | **50px · 6.8%** | y=752~802 / 682~732. 360에서는 위 타일과의 실제 간격이 약 2px |
| **무대 아래 전체** | **364px · 43.1%** | **296px · 40.0%** | 물러나기 줄 아래 남는 공간은 각각 **42px / 8px** |

무대 높이는 JS가 정하고, 적 상태창은 그 무대 **안에** 얹습니다. 하단 명령부는 무대 **아래에** 별도 공간을 차지합니다. 즉 적 창을 줄이면 그 밑의 그림이 드러나고, 하단 버튼을 줄이면 JS의 무대 높이 계산과 상한까지 함께 바뀌어야 캐릭터 공간이 늘어납니다. [무대 계산:65](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/ui/battle/view.js:65>) · [적 창:36](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/styles/battle.css:36>) · [파티 칩:98](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/styles/battle.css:98>) · [메시지:124](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/styles/battle.css:124>) · [명령 타일:147](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/styles/battle.css:147>) · [물러나기 줄:193](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/styles/battle.css:193>)

### 캐릭터가 실제로 가려지는 정도

| 조건 | 확인값 |
|---|---|
| **이전 360×740 일반 전투** | 무대 314px, 거의 전폭인 적 창 123px, 하단 374px였습니다. 적 창만으로 선봉·중견·대장 그림의 위쪽이 각각 **약 19·41·69px** 겹쳤습니다. 왼쪽 전장 표시까지 더해 정지 스프라이트의 불투명 픽셀로 계산하면 약 **20%·39%·57%**가 두 표시 아래에 있었습니다. [이전 일반 전투 캡처](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens-360x740/tile-range.png>) · [스프라이트 기준점:272](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/stage/stage.js:272>) |
| **이전 360×740 복합 상태** | 적 창이 **168px**, 무대 314px의 **53.5%**였습니다. 바로 아래 왼쪽 전장 표시가 y=258까지 내려와 선봉의 얼굴도 가렸습니다. 소유자의 지적을 가장 잘 재현하는 화면입니다. [이전 복합 상태 캡처](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens-360x740/truthful-hud-hud.png>) |
| **새 빌드, 두 해상도의 같은 일반 전투** | 적 창 본체가 차지하는 무대 *면적*은 약 **13.3% / 14.5%**입니다. 선봉·중견·대장의 정지 스프라이트와 적 창·왼쪽 전장 표시를 대조하면 이 장면에서는 두 해상도 모두 가려지는 불투명 픽셀이 **0**입니다. 공격 연출 중 순간 가림은 별도입니다. [390 캡처](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/tempo-telegraph.png>) · [360 캡처](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens-360x740/tempo-telegraph.png>) · [세 자리의 좌표:79](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/ui/battle/view.js:79>) |
| **압축 후 390×844 복합 상태** | 흑기사의 두 예고와 두 상태가 뜬 캡처에서 적 창은 **145px**, 왼쪽 전장 표시는 **y=209~251**입니다. 대기 중인 공허의기사 그림이 y≈234에서 시작해 위쪽 **약 17px**가 표시와 겹칩니다. 전장 표시의 세로 위치는 여전히 JS가 `적 창 높이 + 12px`로 정합니다. **02:53 빌드의 동일 복합 상태 360 캡처는 미확인**입니다. [390 복합 상태 캡처](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/tests/shots/screens/truthful-hud-hud.png>) · [hud.js:135](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel-ui/card_pixel/game/src/ui/battle/hud.js:135>) |

### Claude가 비교할 수 있는 전투 선택지

| 선택지 | 장점 | 단점 |
|---|---|---|
| **현재 우측 적 창을 유지하고 긴 상태만 상세로 이동** | 적 이름·HP·이번 예고를 같은 자리에서 읽습니다. 복합 상태에서 86px가 145px로 커지는 원인을 직접 줄입니다. | 상시 표시에서 빠지는 효과는 한 번 더 눌러야 합니다. 현재 타격을 바꾸는 정보와 부가 설명을 구분해야 합니다. |
| **왼쪽 전장 표시의 높이와 위치를 적 창에서 독립** | 오른쪽 적 설명이 한 줄 늘어도 왼쪽 대기 캐릭터 화면은 그대로 쓸 수 있습니다. 현재 남은 17px 겹침과 직접 연결됩니다. | 전장명·지역 효과가 길어질 때 표시할 줄 수와 상세를 여는 조작을 정해야 합니다. |
| **하단 여유를 화면 높이에 따라 무대에 배분** | 390은 물러나기 아래 42px 중 일부를 무대로 돌릴 여지가 있습니다. 360은 이미 여백 8px, 타일 한 칸 56px이므로 현재 터치 면적을 지킬 수 있습니다. | 무대는 현재 428px 상한이 있습니다. 상한·정수 배율·버튼 최소 높이를 함께 맞춰야 하며, 360의 타일과 물러나기 사이 2px도 고려해야 합니다. |

직접 확인한 범위는 소스, 저장된 화면, 공개된 상용 게임 원본입니다. **초심자가 두 선택의 결과를 실제로 예측하는지, 실기 터치에서 2px 간격이 오입력으로 이어지는지, 기기별 안전 영역을 더한 치수**는 미확인입니다.