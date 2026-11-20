## 결론 — 완성까지 꼭 필요한 셋

1. **첫 생환 뒤에도 다음 한 판의 목적이 보여야 합니다.** 첫 전투의 `애쉬를 살린다 / 애쉬로 마지막 공격`은 행동과 대가가 한눈에 들어옵니다. 첫 귀환의 `애쉬와 떠날 곳 고르기`에는 그만큼 구체적인 약속이 없습니다. 관측소에는 다음 수첩 목표와 보상 하나를, 출발 준비에는 실제 출현 명단과 첫 본편부터 고를 수 있는 쉬운 난이도를 두는 것이 우선입니다.
2. **클리어와 수집 사이에 주간·월간 영입 경로가 필요합니다.** 이번 엔진 표본에서 본편 42승 중 16승은 새 영입 후보가 0명, 22승은 1명이었습니다. 생환 영입의 긴장은 살리되, 여러 판에 걸쳐 원하는 동료 한 명을 확실히 데려오는 길이 있어야 합니다. 오늘의 균열은 이미 제 역할을 하는 일일 퍼즐입니다.
3. **쌓은 동료와 기록을 되찾을 수 있어야 합니다.** 방 사이 자동 저장과 전투 입구 복원은 작동합니다. 반면 전체 저장이 깨지면 신규 이용자와 같은 경로로 들어가고, 일부만 깨진 프로필은 정상으로 읽힌 뒤 영입 확정에서 멈추는 경우를 재현했습니다. **저장 손상 판별과 마지막 정상본 복구를 출시 조건으로 잡겠습니다.**

검토 기준은 `claude/relaymare-v1`의 실제 HEAD `aef6505`와 `card_pixel/game/`입니다. 파일 변경이나 빌드 없이 현재 엔진, 배포 HTML, 화면 코드와 기존 캡처를 읽었습니다. 아래에서 **이번 실측**은 메모리에서 실행한 결과, **기존 감사**는 당시 버전의 기록, **제안**은 설계 판단입니다. 사람의 재도전 의향과 실제 휴대폰 성능은 이번에 측정하지 않았습니다. [소유자 최초 지시](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/history/feedback/2026-11-21-owner-first-impressions.md:57>) · [v1 결정 기록](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/plan/v1-decisions.md:1>) · [게임 작업 원칙](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/AGENTS.md:5>)

## 1. 최초 지시 항목별 점검

| 최초 지시 | 지금 플레이어가 만나는 것 | 판정과 결정 근거 |
|---|---|---|
| 카드 게임을 도트 RPG로 재구성하고 3인 퍼머데스·특성·스킬·캐릭터성 보존 | 도트 동료 130명이 실제 출현 풀에 들어갑니다. 선봉·중견·대장, 적 행동 예고, 물러나기, 사망 시 유품 계승이 전투를 구성합니다. 사망자는 해당 원정에서 제외되고 계정의 영입 기록은 보존됩니다. | **구현.** §2~4에서 원작 전투 코어를 감싸고 원정 규칙을 더했습니다. 희생의 대가를 살리기 위해 원정 중 부활은 제외했습니다. [코어 연결](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/tools/core-bundle.mjs:1>) · [전투 정산](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/run.js:466>) |
| 튜토리얼과 시작 훅 | 제목에서 바로 5층 입문 원정으로 갑니다. 첫 선택에 `눈토끼 HP 290 → 149`와 `쓰러지면 눈토끼가 아마겟돈을 받는다`가 표시됩니다. 결과가 첫 깨우기에 이어지고, 입문 첫 클리어 전 5층 패배는 편성을 바꿔 재도전합니다. | **구현.** §4.5·5.3·9에서 직접 선택하는 도입을 채택했습니다. 첫 전투 앞에 설명 화면을 더할 이유가 작습니다. [첫 선택 화면](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/battle/tiles.js:102>) |
| 새싹미션처럼 처음부터 안내하고 메뉴를 한눈에 | 꿈길 수첩 7장이 있고, 장별 조건·완료 도장·해금 보상을 보여 줍니다. 첫 생환 뒤 거점에 대표와 출발 버튼이 서고 동료·수첩·기록이 열립니다. | **부분 구현.** §4.6·5.2의 단계 해금은 작동합니다. 현재 장의 **다음 행동과 보상**은 수첩을 열어야 보입니다. 첫 귀환 화면에는 방금 열린 지역과 완료한 장이 먼저 나옵니다. [관측소](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/screens/hub.js:32>) · [수첩](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/screens/notebook.js:27>) |
| 던전마다 다른 규칙, 층·문지기·비전투 이벤트 | 입문 5층, 테마 5곳과 창조의 탑 각 8층입니다. 홍련은 작열 이월, 황혼은 종, 별빛은 시작 하늘, 심야는 조류, 투기장은 공격 충전입니다. 탑은 지역 규칙이 바뀝니다. 본편 3·5층에 사건 선택지가 있고, 4층 문지기·8층 보스로 이어집니다. | **구현.** §4.1~4.4에서 모바일 한 판을 위해 10층 초안을 줄이고 상점·시련·서재 기능을 사건 선택지에 합쳤습니다. 현재 등록 사건은 **40종**입니다. 초기 28종에 템포 v2용 12종이 더해졌고, 지역·인물 조건으로 출현이 갈립니다. [동선](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/content/layouts.js:1>) · [사건 목록](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/content/events.js:386>) |
| 이지·노멀·하드 등 난이도 선택 | 입문은 고정입니다. 본편은 `여정`, 해당 지역 여정 첫 승리 뒤 `악몽`입니다. 첫 본편 승리 전에는 문지기·보스 완충과 편성 제안이 있습니다. 악몽에는 추가 접두사, 테마 5곳의 숨은 보스, 영입 최대 2명이 있습니다. | **의도적으로 2단계, 선택형 이지는 미구현.** §4.1은 여정→악몽을 명시합니다. 최초 기획의 `꿈결`을 뺀 별도 이유는 결정 장부에 없습니다. 자동 완충은 첫 승 뒤 사라져 반복해서 고를 수 없습니다. [최초 3단계안](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/plan/plan-content.md:333>) · [난이도 판정](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/run.js:49>) |
| 꿈의 결정으로 소환하고 보유 동료를 조합 | 본편은 지명 2명과 무작위 3명, 결정 1개로 시작합니다. 대표가 있으면 지명 한 자리를 차지합니다. 샘에서 무작위 ◆1, 지명 ◆3이며 현행 본편 지명은 합류 확정 때 결제합니다. 본편 1·2·6층 승리 후에는 후보가 있으면 무료 보충, 보유 한도는 6명입니다. | **구현.** §4.6·9·10에서 초반부터 편성 재료를 주고, 승리 뒤 다음 전투의 셋을 다시 고르게 했습니다. **이번 원정 합류**와 **영구 영입**은 구분됩니다. [시작 편성](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/run.js:153>) · [샘 결제](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/run.js:636>) |
| 던전별 기본 덱·보너스 카드 방식과 출현 캐릭터 공개 | 테마 기본 덱에 대표·동행·예약 후보를 더하고 봉인을 뺍니다. 지역 도감은 조우 수와 실루엣을 표시합니다. 준비 화면의 봉인 목록에서도 기본 이름을 볼 수 있지만 그 지역을 깨서 봉인 칸이 열린 뒤입니다. | **편성 방식은 변형 구현, 출발 전 공개는 부분 구현.** §4.6은 보너스 편성의 역할을 대표·동행 최대 3칸·봉인으로 옮겼고, §5.2는 미조우 실루엣을 택했습니다. 첫 방문 준비에는 **기본 덱 이름과 실제 명단 전체를 여는 경로**가 없습니다. [풀 계산](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/roster.js:38>) · [준비 화면](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/screens/dungeons.js:79>) · [지역 도감](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/screens/collection.js:57>) |
| 클리어·미션으로 동료 해금 | 승리한 원정에서 문지기나 보스에 출전하고 끝까지 살아남은 미영입 동료를 여정 1명·악몽 2명까지 영입합니다. 기존 동료는 조건을 채우면 원정당 인연 +1입니다. 패배의 꿈 조각은 출전했던 한 명을 다음 첫 지명 후보로 예약합니다. | **클리어 영입 구현.** §4.2·4.6은 살려 온 동료에게 보상을 집중했습니다. 수첩은 동행 칸·도감·지역 등 기능을 엽니다. 장 보상으로 별도 동료를 주는 초안은 채택하지 않았습니다. [영입·인연 정산](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/meta.js:138>) · [수첩 보상 결정의 이유](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/history/consults/2026-11-20-astra-design.md:41>) |
| 주간·월간 미션, 일일 반복 동기 | 첫 본편 생환 뒤 `오늘의 균열`이 열립니다. 같은 날짜의 대여 5명·7층·4전, 기록 도전 1회와 이후 연습, 날짜별 성적·돌파 도장이 있습니다. | **일일 구현, 주간·월간 영입 미구현.** 원안 §5.14에는 주간 3개·월간 3개와 영입 보상이 있습니다. v1 §8이 명시적으로 제외한 것은 **균열의 본편 보상과 연속 출석 보상**입니다. 본편 주간·월간 임무를 폐기한다는 결정은 찾지 못했습니다. [최초 임무안](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/plan/plan-content.md:352>) · [균열 운영 결정](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/plan/v1-decisions.md:180>) |
| 혼돈의 축복으로 약한 캐릭터도 쓸 이유 제공 | 혼돈의 제단은 최대 3번 굴려 한 명에게 원정 축복을 주며, 저등급의 기본 증가량이 큽니다. 별도로 현행 본편은 전투 전에 노멀·레어를 우선해 한 명을 축복합니다. 노멀 +60%, 레어 +45%이며, 원정 축복과 이번 축복 중 큰 값을 적용합니다. | **구현·확장.** §9·10에서 전투마다 편성을 재검토하게 했습니다. 같은 동료가 두 전투 연속 지명되면 다른 보유자가 있을 때 다음 추첨에서 제외합니다. [제단 확률](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/awakenings.js:5>) · [전투 축복](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/rooms.js:119>) |
| 아티팩트 | 유물 14종, 장착 4칸, 문지기·정예·보물·사건 획득, 도감이 있습니다. 네 칸이 차면 들어오는 유물과 빠질 유물의 효과를 나란히 보고 교체합니다. | **구현.** §4.1에서 신기는 악몽 공적의 후속 후보로 미뤘습니다. §9에서 다음 단계로 적은 **장착 띠와 교체 비교는 현재 화면에 이미 있습니다.** [유물 14종](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/content/relics.js:1>) · [실제 비교 화면](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/screens/treasure.js:17>) |
| “틀고 나서 하고 싶다, 다음이 보고 싶다” | 걷는 갈림길, 지도 안 편성, 2·6층의 보스 규칙 예행, 승리 화면에서 보충·포로·유물 선택, 마지막 일격과 턴별 기록이 있습니다. | **장치는 구현, 감정은 미검증.** §9 뒤 기존 감사에서 일반전 평균은 6.88→4.55턴, 자발적 편성 교체는 26→82%였습니다. 현재판 초행자가 첫 귀환 뒤 자발적으로 두 번째 원정을 누르는지는 따로 봐야 합니다. [재설계 결과와 2단계 결정](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/plan/v1-decisions.md:206>) |

## 2. 출시 전에 채워야 할 경험

**첫 1시간의 목표는 ‘다음 판에 데려갈 동료를 내가 정했다’입니다.** 첫 5분에는 애쉬를 살리거나 유품을 넘기고, 첫 생환에는 한 명을 영입합니다. 이후 20분에는 대표와 홍련·황혼 중 한 곳을 골라 4층 문지기에 도전합니다. 첫 1시간 안에는 첫 본편 생환, 또는 패배해도 **예약한 동료를 다시 골라 편성을 바꾸는 재도전**까지 경험하면 됩니다. 두 경로 모두 다음 행동을 한 문장으로 설명할 수 있어야 합니다. 이 시간은 설계 목표입니다. *Monster Train*은 주·보조 클랜을 고르면 사용할 카드군이 정해지고, 출발 때 중간 보스도 미리 보여 줍니다. RELAYMARE에서 이 역할을 맡을 곳은 행선지 준비 화면입니다. [Monster Train 개발사 제품 설명](https://store.steampowered.com/app/1102190/Monster_Train/)

**10시간의 목표는 ‘탑을 깬 뒤 다른 조합으로 이길 이유를 하나 고를 수 있다’입니다.** 현재 탑 엔딩에는 기록과 영입 동료 행진, 다시 보기가 있습니다. 이후에도 남은 테마 지역, 숨은 보스 5명, 악몽 계약 3종×6지역의 도장 18개, 동료·유물 수집이 남습니다. 다만 엔딩 버튼은 `관측소로`이고 계약 도장은 기록의 지역별 악몽 횟수를 눌러야 보입니다. 엔딩 후 첫 거점에 `홍련 화산 · 마지막 유품 도전` 또는 `원하는 동료의 출현 지역 보기` 중 현재 가능한 목표 하나를 꺼내면 기존 콘텐츠가 다음 판이 됩니다. [엔딩 화면](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/screens/ending.js:7>) · [계약 도장 기록](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/screens/records.js:52>)

**이번 실측에서도 엔딩과 수집의 속도가 갈렸습니다.** 새 프로필 8개를 각 8원정씩 진행했습니다. 신중한 자동 전투로 미생환 지역과 탑을 우선하고, 가능한 경우 다른 대표를 썼습니다. 8개 모두 입문을 포함한 **5~7번째 원정에서 탑을 격파**했지만 8원정 뒤 영입자는 **3~6명**이었습니다. 본편 56회 중 42승이었고, 새 영입 후보가 둘 이상이었던 승리는 4회였습니다. 이 표본은 영입 목표를 보여 줄 근거가 됩니다. 사람의 엔딩 도달 시간이나 10시간 유지율로 환산할 수는 없습니다. [사용한 전투·경로 정책](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/tools/sim.mjs:243>)

| 출시 항목 | 이 게임에 필요한 수준 |
|---|---|
| 난이도 선택 | 첫 본편 출발부터 `꿈결`을 선택하게 하고, 이야기·영입·탑 엔딩까지 이어 줍니다. 같은 초행 시드로 비교한 서투른 기본 편성은 홍련·황혼 각 24판에서 현행 **14승·13승**이었습니다. 초행 완충 적용 후 적 공격·마공만 메모리에서 ×0.80으로 바꾸면 **15승·16승**, ×0.65에서는 **17승·18승**이었습니다. ×0.65를 첫 시안으로 쓸 근거이며 후반 부하와 사람의 체감은 별도입니다. *Hades*도 초행 지원과 후반 제약 도전을 함께 제공합니다. [첫 본편 측정 경로](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/tools/sim.mjs:398>) · [Supergiant의 Hades FAQ](https://www.supergiantgames.com/blog/hades-faq/) |
| 일일·주간 반복과 보상 | 균열은 고정 조건의 실력 퍼즐로 충분합니다. 주간·월간은 **본편에서 보통 하던 행동**으로 채우고, 원하는 영입자를 고르는 보상을 줍니다. 같은 날 몰아서 달성할 수 있고 이미 번 보상은 다음 주에도 받을 수 있어야 합니다. *Slay the Spire*도 일일 도전을 별도 비교 플레이로 제공합니다. [Slay the Spire 개발사 제품 설명](https://store.steampowered.com/app/646570/Slay_the_Spire/) |
| 수집·도감 | 지역 도감의 `조우 21/40` 같은 표시는 이미 좋습니다. 여기에 **영입 수**를 구분하고 준비 화면에서 같은 명단을 역으로 열게 합니다. 이번 실측의 기본 풀은 **새벽 14 / 홍련 39 / 황혼 40 / 별빛 39 / 심야 40 / 투기장 37 / 탑 130**명입니다. 원작 테마 덱의 일괄 `40명`을 안내에 쓰면 세 지역에서 틀립니다. [던전별 풀 지정](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/content/dungeons.js:17>) |
| 소리·속도·글자·색 | 효과음·BGM 독립 켜기/끄기, 윤곽선, 전투 1·2배, 연출 중 탭 가속, 지도 건너뛰기와 일부 OS 동작 줄이기 대응이 있습니다. 우선 보완할 것은 **배속 기억, 큰 글자, 색 없이도 보이는 선택·위험 표식**입니다. 현재 설정 저장은 소리·음악·윤곽선 3개이고 배포 HTML은 사용자 확대를 제한합니다. *Dicey Dungeons*도 상태 설명·적 행동 미리보기·재생 속도를 함께 제공해 배우는 속도를 플레이어에게 맡겼습니다. [현재 설정](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/settings.js:36>) · [배포 viewport](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/build.mjs:47>) · [Dicey Dungeons 개발 기록](https://diceydungeons.com/blog/2018/12/25/version-15.html) |
| 저장·복원·오류 복구 | **재현 결과**, 원정만 손상시키면 `run_restore_failed`로 프로필이 남습니다. 전체 JSON 손상과 저장 없음은 모두 `null`입니다. `records.appliedRuns`만 빠진 프로필은 복원 검사를 통과했지만 실제 입문 승리 후 영입 정산에서 `TypeError`가 났습니다. 현재 쓰기 실패 경고와 균열 정산의 `다시 저장`은 살리고, 전체 손상 안내·직전 정상본·파일 백업을 더해야 합니다. 실행기도 같은 브라우저와 HTML 경로를 써야 이어지므로 파일 복원에는 실제 용도가 있습니다. [복원 검사](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/save.js:56>) · [부팅·오류 처리](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/ui/nav.js:388>) · [실행기 저장 위치](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/launcher/README.md:3>) |
| 성능·오프라인 | 배포 HTML을 직접 세면 **5,980,571바이트, 약 5.70 MiB**이고 Galmuri 3종이 내장돼 있습니다. README 첫 문장의 CDN 설명은 현재 배포본과 다릅니다. 첫 원정 화면을 만들 때 스프라이트 451장의 로딩을 시작합니다. 실제 병목 판정은 저사양 휴대폰 한 대에서 콜드 시작과 첫 전투만 재면 됩니다. 느릴 때 첫 전투에 쓰는 그림을 먼저 읽도록 조정합니다. [폰트 내장 빌드](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/build.mjs:39>) · [스프라이트 로딩](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/stage/stage.js:96>) |

## 3. 재미 증가 ÷ 작업량 우선순위

재미는 5점 척도의 설계 판단이고, 작업량은 엔진·화면을 합친 인일 추정입니다. **6번 저장 복구는 직접 재미 점수와 관계없이 배포 전에 통과해야 합니다.**

| 순위 | 구현할 규칙과 화면 문구 | 재미 / 인일 |
|---|---|---:|
| 1 | **수첩의 다음 행동 한 줄.** 첫 귀환부터 기존 출발 버튼 곁에 `애쉬와 본편 출발 · 동행 1칸 열림`, 다음에는 `4층 문지기 격파 · 유물 도감 열림`을 표시합니다. 진행 중에는 이어가기가 우선입니다. 탑 뒤에는 미생환 지역이나 미획득 계약 하나를 연결합니다. 추가 확인 탭은 0개입니다. | 5 / 0.75 = **6.7** |
| 2 | **출발 전 실제 명단.** `홍련의 계승 · 기본 39명 · 출현표`를 한 번 누르면 기본·추가·봉인과 최종 인원이 보입니다. 이 표에서는 미조우자도 이름과 등급을 공개하고 그림은 실루엣으로 둡니다. 한 명에게 `만나고 싶은 동료` 표시를 붙일 수 있습니다. 표시는 추첨 확률에 영향을 주지 않습니다. | 4 / 1 = **4.0** |
| 3 | **쉬운 본편 `꿈결`.** 입문 뒤부터 `꿈결 / 여정 / 악몽`을 표시합니다. 꿈결은 기존 초행 문지기·보스 완충을 계속 적용하고, 생성된 적의 공격·마공을 ×0.65로 잡습니다. HP·예고·계승·사망 규칙은 여정과 같습니다. 영입 1명, 수첩·지역·균열·엔딩 진행을 인정합니다. 악몽과 지역 봉인 첫 칸은 해당 지역 여정 생환 보상입니다. 화면에는 `꿈결 · 적 공격·마공 35% 감소`와 악몽 해금 조건을 씁니다. | 5 / 2 = **2.5** |
| 4 | **본편 주간·월간 영입.** 수첩 4장을 달성한 판부터 `이번 주 · 본편 문지기 2회 → 동료 1명 초대`, `이번 달 · 서로 다른 테마 3곳 생환 → 전설 1명 초대`를 엽니다. 주간은 서로 다른 원정에서 문지기를 이기면 최종 패배도 인정합니다. 주간은 미영입 노멀·레어, 월간은 미영입 전설을 최대 3명 제시해 한 명을 영구 영입합니다. 원안의 주 3개·월 3개를 각각 목표 하나로 줄인 제안입니다. | 5 / 2.5 = **2.0** |
| 5 | **읽기와 배속 설정.** `글자 보통 / 크게(125%)`, `표식 강조`, `전투 속도 1배 / 2배`를 저장합니다. 선택은 `✓`, 위험은 `!`와 짧은 문구로도 읽히게 합니다. 기존 효과음·음악 스위치와 전투 중 배속 버튼을 그대로 이용합니다. | 3 / 2 = **1.5** |
| 6 | **마지막 정상 기록과 파일 복원.** 정상 귀환본 1세대를 보존합니다. 설정에 `기록 내보내기 / 가져오기`, 복구 화면에 `직전 기록으로 복구 · 동료 8명`처럼 실제 복구 범위를 표시합니다. 가져오기 전 현재 기록과 파일의 동료 수·진행 층을 비교합니다. | 2 / 3 = **0.7** |

**이번에 피할 작업**은 전체 지역 재조정, 새 전투 HUD 줄, 강제 출석, 별도 미션 로비, 무한 던전입니다. 현재 일반전 템포와 승리 패널을 다시 늘리면 소유자가 지적한 조작량이 되살아납니다. 귀환 후보 자동 대기는 §7에서 이미 검토했고 편성 화면에 생환 자격이 표시됩니다. 무한 던전은 사망자가 빠지는 풀의 고갈을 먼저 풀어야 합니다. 40종의 사건, 14종의 유물, 18개 계약 도장을 플레이어가 발견하도록 연결하는 편이 먼저입니다. [제외 결정과 이유](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/plan/v1-decisions.md:163>) · [원정 길이·부활 결정](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/plan/v1-decisions.md:39>)

### 구현 계약 — 엔진·저장 담당

경로는 `card_pixel/game/src/` 기준입니다. 공유 `card/game`에는 변경이 필요 없습니다.

```text
1  content/notebook.js · engine/meta.js
   nextGoal(profile, run) → {text, reward, target:{screen,dungeonId?,contractId?}}
   notebookView와 실제 해금 조건에서 계산한다. 별도 완료 플래그는 저장하지 않는다.
   다른 대표가 필요한 5장은 후보가 없으면 영입 또는 진행 가능한 지역 목표를 안내한다.
   엔딩 뒤에는 미생환 테마 → 열린 악몽의 미획득 계약 → 동료 수집 순으로 찾는다.

2  engine/roster.js · engine/run.js
   expeditionPool(roster, dungeonId, startView) → {setName,baseIds,addedIds,sealedIds,effectiveIds}
   createRun과 출현표가 같은 roster.pool 계산을 쓴다. 대표·동행·예약의 중복은 한 명이다.
   잠긴 지역은 기본 명단까지 읽을 수 있다. 열람은 RNG·조우 기록을 변경하지 않는다.
   profile.ui.wantedCompanionId = id | null. 영입하면 표시를 해제한다.

3  content/tempo.js · engine/rooms.js · engine/run.js · engine/meta.js · engine/save.js
   difficulty = 'easy' | 'normal' | 'nightmare'
   easy는 본편 여정의 문 생성·위험 문 규칙을 쓰고 최종 atk/matk에 0.65를 한 번 곱해 반올림한다.
   지역 진행용 생환과 악몽 해금용 여정 생환을 별도로 판정한다.
   꿈결 선행 클리어 뒤 첫 여정에도 기존 초행 지원을 제공한다.
   records.clears[dungeonId].easy 기본 0. 기존 난이도 기록과 진행 중인 옛 원정은 그대로 읽는다.

4  content/missions.js · engine/run.js · engine/meta.js
   creditMissions(profile, finishedRun) → profile
   claimMission(profile, periodKey, companionId, roster) → {profile,announce}
   run.endDayKey를 첫 정산 진입 때 고정한다. 기기 현지 날짜, 월요일 시작 주·달력 월 기준.
   profile.missions.periods[key] = {gates,regionIds,state,offerOrder,claimedId}
   실제 applyRunEnd 성공 경로에서 appliedRuns로 한 번만 집계한다. 균열·입문은 제외한다.
   달성 시 열린 지역 기본 풀로 후보 순서를 고정한다. 수령 전 영입한 ID는 건너뛴다.
   해당 등급 소진 시 같은 풀의 다른 미영입자, 전원 보유면 완료 도장을 준다.
   획득한 수령권은 기간이 바뀌어도 남긴다. 옛 저장에는 빈 임무 기록을 적용한다.

5  engine/save.js · stage/stage.js
   normalizeSettings(raw) → {sound,music,rim,speed:1|2,textScale:1|1.25,markers:boolean}
   기존 relaymare.settings를 확장한다. 빠진 값은 1배·보통 글자·표식 켜짐으로 읽는다.
   배속은 stage.clock.speed에 적용하고, 상세 시트의 전투 일시정지를 우선한다.

6  engine/save.js · engine/daily-store.js · ui/storage.js
   loadDetailed() → {status:'empty'|'ok'|'runDamaged'|'profileDamaged'|'unavailable',profile?,run?}
   exportBackup(live) → {format:'relaymare',version:1,session,daily,settings}
   inspectBackup(data) → {ok,summary,reason?}       restoreBackup(data) → {ok,reason?}
   저장 실패 중 내보내기는 메모리의 최신 체크포인트를 쓴다. 전투는 기존대로 방 입구로 직렬화한다.
   본편·균열·설정을 각각 검증한다. 중복 정산 원장이 손상되면 정상 사본 복구로 보낸다.
   가져오기는 비활성 저장 슬롯에 전부 기록·재검증한 뒤 활성 슬롯 포인터 하나를 전환한다.
   중간 실패 시 기존 슬롯이 유효하다. 명시적 전체 삭제는 복구 사본도 함께 정리한다.
```

### 구현 계약 — 화면 담당

```text
1  ui/screens/hub.js · notebook.js · ending.js · ui/nav.js
   기존 출발 버튼 옆 한 줄에 nextGoal을 표시한다. 결과에서 거점 복귀 후 다음 행동이 보인다.
   수첩 4장은 '오늘의 균열'과 실제로 열린 보상을 표시한다. 꿈결 승리에 악몽 해금을 표시하지 않는다.

2  ui/screens/dungeons.js · collection.js
   준비 시트에 '홍련의 계승 · 기본 39명 · 출현표'. 상세에 '조우 / 영입 / 이번 원정 후보'.
   기존 지역 도감과 얼굴 격자를 공유한다. 닫으면 준비 화면의 편성·스크롤 위치로 돌아간다.

3  ui/screens/dungeons.js · records.js · notebook.js · ending.js · ui/nav.js
   기본 선택은 여정. 지역별 선택을 기억하며 '바로 출발'도 표시된 난이도를 사용한다.
   기록에서 꿈결 횟수를 구분하고 수첩·엔딩의 생환 지역 수에는 포함한다.

4  ui/screens/notebook.js · recruit.js · hub.js
   수첩 안에서 주간·월간 각 한 줄을 표시한다. 달성한 귀환에서만 '동료 초대 가능'을 알린다.
   본편 원정 사이에 이름을 골라 확정한다. '이번 원정 합류'와 '관측소에 영입'을 구별한다.

5  ui/settings.js · ui/battle/view.js · src/styles의 base/battle/meta · game/build.mjs
   설정과 전투 중 배속 버튼이 같은 값을 읽고 쓴다. 브라우저 확대 제한을 푼다.
   큰 글자에서도 기술 타일은 두 줄, 긴 설명은 누르면 멈추는 기존 시트에서 읽는다.

6  ui/settings.js · ui/nav.js
   제목과 거점에서 가져오기·내보내기를 연다. 전체 손상 시 첫 출발보다 복구 선택을 먼저 표시한다.
   '원정만 손상 · 동료와 수첩 유지'와 '전체 기록 복구 필요'를 구분한다.
   균열 공식 성적·진행 중 도전의 복원 범위도 가져오기 확인 화면에 표시한다.
```

### 합격 테스트

1. **첫 귀환과 재도전.** 390×844에서 새 이용자 5명 중 4명 이상이 도움 없이 첫 15초 안에 행동을 선택하고, 귀환 뒤에는 “누가 영구 동료인지, 다음에 무엇을 하면 무엇이 열리는지” 말할 수 있어야 합니다. 중단해도 된다고 안내한 뒤 3명 이상이 자발적으로 다음 원정을 시작하는 것을 첫 설계 통과선으로 둡니다. 엔딩 직후 저장에서도 도전 가능한 다음 목표 하나가 나와야 합니다.
2. **출현표의 진실성.** 기본 7지역의 인원수가 위 실측과 일치하고, 대표와 동행의 중복·지역 밖 예약 동료·봉인이 함께 있는 사례에서 `effectiveIds`와 실제 `run.pool`이 일치해야 합니다. 미조우 이름을 보고 닫아도 조우 수, 원정 시드, 다음 추첨 결과가 같아야 합니다.
3. **꿈결의 효과와 진행.** 새 시드로 홍련·황혼 각 32쌍을 비교해 서투른 기본 편성의 합산 첫 생환율이 여정보다 **10%p 이상** 높아지는 것을 목표로 합니다. 고정 시드 한 건은 적 HP·행동 순서·유품이 같고 공격·마공만 약속대로 바뀌어야 합니다. 꿈결만으로 세 테마→탑→엔딩이 열리고, 해당 지역 악몽은 여정 생환 때 열려야 합니다.
4. **영입 보상의 정확성.** 같은 원정 정산 두 번, 일요일에서 월요일로 넘어가는 정산, 월말 저장 후 재개, 후보를 먼저 일반 영입한 경우, 전원 보유를 각각 확인합니다. 기간 경계에서도 획득권은 1개이고 영입은 한 번만 발생해야 합니다. 균열 공식·연습을 끝냈을 때 본편 임무 증가량은 0이어야 합니다.
5. **읽기·템포·성능.** 390px, 글자 125%, 무음·흑백에서 첫 선택, 위험 예고, 유물 교체를 구별할 수 있어야 합니다. 2배로 다시 열어도 상세를 읽는 동안 턴이 진행되면 실패입니다. 저사양 휴대폰 한 대에서 오프라인 콜드 시작→제목 조작 **3초 이내**, 첫 전투 프레임 간격 **95백분위 34ms 이하**를 제안 기준으로 삼습니다.
6. **복구 후 실제로 한 판 더.** 구형 정상 저장, 원정만 손상, 전체 JSON 손상, `appliedRuns` 누락, 저장 공간 부족을 각각 열어 봅니다. 정상본이나 파일을 복원한 뒤 샘의 지명 후보·결정·수첩·영입자·균열 공식 도전 횟수가 일치해야 합니다. 마지막으로 **복원한 프로필에서 실제 영입 정산을 한 번 성공**시켜야 출시 합격입니다.