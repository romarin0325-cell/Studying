## 1. 던전별 출현 가능 수

현재는 **심야의 해구와 투기장이 각각 2종**으로 가장 적습니다. 두 곳에 각각 5종, 나머지 테마 던전에 각각 4종이 추가되도록 배분했습니다. 추가 후에는 **테마 던전마다 7종, 창조의 탑은 28종**입니다.

**현재 12종**

| 던전 | 출현 가능 | 해당 사건 |
|---|---:|---|
| 홍련 화산 | 3 | 지크와 해바라기의 온실, 번개의현자의 피뢰침, 체리프린스의 갑옷 시험 |
| 황혼 성당 | 3 | 눈토끼와 밤토끼의 두 발자국, 루나의 꺼진 천문대, 번개의현자의 피뢰침 |
| 별빛 정원 | 3 | 지크와 해바라기의 온실, 조커의 빈 배역, 루미의 축복 |
| 심야의 해구 | 2 | 눈토끼와 밤토끼의 두 발자국, 루미의 축복 |
| 투기장 | 2 | 루나의 꺼진 천문대, 체리프린스의 갑옷 시험 |
| 창조의 탑 | 12 | 기존 사건 전체 |

**16종 추가 후**

| 던전 | 추가 | 합계 | 추가 사건 번호 |
|---|---:|---:|---|
| 홍련 화산 | 4 | **7** | 8, 9, 10, 16 |
| 황혼 성당 | 4 | **7** | 3, 7, 11, 12 |
| 별빛 정원 | 4 | **7** | 13, 14, 15, 16 |
| 심야의 해구 | 5 | **7** | 1, 2, 3, 4, 8 |
| 투기장 | 5 | **7** | 2, 5, 6, 7, 8 |
| 창조의 탑 | 16 | **28** | 1~16 전체 |

표는 아군 대기 그림이 있는 캐릭터로 구성한 기본 풀 기준입니다. 별빛 정원과 투기장은 이미 네 등급을 모두 갖춰 `spriteFallback`이 발동하지 않습니다. 실제 원정에서는 대표·동행·꿈 조각·봉인과 사망·이탈에 따라 후보가 달라집니다. 두 사람이 등장하는 사건은 둘 다 풀이나 대기석에 있어야 합니다. [던전 풀 계산](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/roster.js:31>) · [사건 후보 판정](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/rooms.js:139>)

## 2. 사건 객체 16종

`events.js`의 `export const EVENTS = [` 바로 다음 줄에 그대로 붙일 수 있습니다. 번호는 객체 순서와 같습니다.

```js
  {
    id: 'jellyfish_vials', name: '젤리피쉬프린세스의 독병', text: '촉수에서 떨어진 독 한 방울이 유리 접시를 파먹는다.',
    requires: { present: ['jellyfish_princess'] },
    choices: [
      { id: 'stun', text: '마비독을 한 방울 뜬다', ops: [{ type: 'start', enemyDebuffs: { stun: 1 } }] },
      { id: 'mixture', text: '약화독과 부식독을 섞는다', ops: [{ type: 'start', enemyDebuffs: { weak: 1, corrosion: 1 } }] }
    ]
  },
  {
    id: 'captains_ledger', name: '대해적선장의 승선 명부', text: '선장이 갑판의 결투선 옆에 선원 명부를 펼친다.',
    requires: { present: ['legendary_captain'] },
    choices: [
      { id: 'ropes', text: '결투용 밧줄을 챙긴다', ops: [{ type: 'field', ids: ['arena'] }] },
      { id: 'crew', text: '품삯을 받고 한 명을 배에 남긴다', target: 'release', ops: [{ type: 'release' }, { type: 'crystals', amount: 1 }] }
    ]
  },
  {
    id: 'three_chamber_clock', name: '시간의지배자의 모래시계', text: '모래가 셋째 칸에 닿자 유리에 비친 표적이 갈라진다.',
    requires: { present: ['time_ruler'] },
    choices: [
      { id: 'shadows', text: '표적에 그림자 셋을 겹친다', ops: [{ type: 'start', enemyDebuffs: { curse: 1, silence: 1, darkness: 1 } }] },
      { id: 'on_time', text: '예약 공격이 제때 맞는 데 건다', cost: 1, ops: [{ type: 'bet', kind: 'delayed_on_time', reward: { crystals: 4 } }] }
    ]
  },
  {
    id: 'phantom_screen', name: '팬텀의 그림자극', text: '팬텀이 등잔을 가리자 그림자만 막 위를 걷는다.',
    requires: { present: ['phantom'] },
    choices: [
      { id: 'shadow', text: '그림자를 적에게 붙인다', ops: [{ type: 'start', enemyDebuffs: { darkness: 1 } }] },
      { id: 'blackout', text: '빈 하늘로 끝까지 싸운다', ops: [{ type: 'bet', kind: 'empty_sky', reward: { crystals: 3 } }] }
    ]
  },
  {
    id: 'sparring_wraps', name: '엠버타이거와 프리즘트윈의 대련', text: '둘이 번갈아 말뚝을 칠 때마다 주먹붕대가 한 뼘씩 풀린다.',
    requires: { present: ['ember_tiger', 'prism_twin'] },
    choices: [
      { id: 'train_one', text: '한 명의 주먹을 단련한다', target: 'bench', ops: [{ type: 'bless', multiplier: 0.20 }] },
      { id: 'team_wraps', text: '다음 시합에 쓸 붕대를 나눠 감는다', ops: [{ type: 'relic', id: 'double_attack', temporary: true }] }
    ]
  },
  {
    id: 'red_moon_scabbard', name: '레드문의 금 간 칼집', text: '레드문이 검을 뽑자 칼집의 금에서 불씨가 떨어진다.',
    requires: { present: ['red_moon'] },
    choices: [
      { id: 'embers', text: '칼집에서 불씨를 턴다', ops: [{ type: 'start', enemyDebuffs: { burn: 2 } }] },
      { id: 'blade', text: '한 명이 데이브레이커를 물려받는다', cost: 3, target: 'bench', ops: [{ type: 'heirloom', from: 'red_moon', name: '데이브레이커' }] }
    ]
  },
  {
    id: 'fox_wedding', name: '구미호의 혼례상', text: '구미호가 혼례상에 등잔 둘과 꼭 닮은 술잔 셋을 놓는다.',
    requires: { present: ['gumiho'] },
    choices: [
      { id: 'wicks', text: '두 심지에 불을 붙인다', ops: [{ type: 'start', enemyDebuffs: { burn: 1, divine: 1 } }] },
      { id: 'guests', text: '같은 등급 셋으로 이겨 축의금을 받는다', ops: [{ type: 'bet', kind: 'same_grade_full', reward: { crystals: 3 } }] }
    ]
  },
  {
    id: 'dragon_thaw', name: '레드드래곤의 언 샘', text: '레드드래곤이 불을 뿜자 얼음 밑에서 결정 하나가 떠오른다.',
    requires: { present: ['red_dragon'] },
    choices: [
      { id: 'crystal', text: '떠오른 결정을 건진다', ops: [{ type: 'crystals', amount: 1 }] },
      { id: 'wake', text: '이름을 묻지 않고 한 명을 깨운다', ops: [{ type: 'join', random: true }] },
      { id: 'dragon', text: '레드드래곤에게 동행을 청한다', cost: 2, ops: [{ type: 'join', ids: ['red_dragon'] }] }
    ]
  },
  {
    id: 'glass_pawprints', name: '사막여우의 유리 발자국', text: '사막여우가 모래를 차자 발자국 셋이 붉은 유리로 굳는다.',
    requires: { present: ['desert_fox'] },
    choices: [
      { id: 'coals', text: '불씨 셋을 고스란히 뜬다', ops: [{ type: 'start', enemyDebuffs: { burn: 3 } }] },
      { id: 'sand', text: '유리 모래를 갈아 뿌린다', ops: [{ type: 'start', enemyDebuffs: { corrosion: 1, curse: 1 } }] }
    ]
  },
  {
    id: 'cracked_star_core', name: '초신성의 금 간 노심', text: '노심 안에서 결정 두 개가 벌겋게 달아오른다.',
    requires: { present: ['supernova'] },
    choices: [
      { id: 'cool', text: '식혀서 결정 둘을 꺼낸다', ops: [{ type: 'crystals', amount: 2 }] },
      { id: 'overload', text: '노심을 연다 · 기술 사용 시 사망 위험 30%', ops: [{ type: 'relic', id: 'death_roulette', temporary: true }] }
    ]
  },
  {
    id: 'three_seal_gate', name: '블레싱테일과 자스민의 성문', text: '블레싱테일이 꼬리로 성문을 세 번 두드리자 자스민이 빗장을 든다.',
    requires: { present: ['blessing_tail', 'jasmine'] },
    choices: [
      { id: 'seals', text: '인장 셋을 표적에 옮긴다', ops: [{ type: 'start', enemyDebuffs: { divine: 3 } }] },
      { id: 'sanctuary', text: '빗장을 열고 성역을 펼친다', ops: [{ type: 'field', ids: ['sanctuary'] }] }
    ]
  },
  {
    id: 'gilded_icon', name: '타천사의 벗겨진 성화', text: '타천사가 성화 귀퉁이를 들추자 금박 밑에서 검은 낙인이 드러난다.',
    requires: { present: ['fallen_angel'] },
    choices: [
      { id: 'peel', text: '금박을 팔고 낙인을 남긴다', ops: [{ type: 'crystals', amount: 1 }, { type: 'start', enemyDebuffs: { darkness: 1 } }] },
      { id: 'regild', text: '금을 덧입혀 성물을 만든다', cost: 3, ops: [{ type: 'relic', id: 'over_divine' }] }
    ]
  },
  {
    id: 'hidden_cake_crown', name: '슈가파우더의 왕관 케이크', text: '슈가파우더가 별가루를 털고 반죽 속에 작은 왕관을 숨긴다.',
    requires: { present: ['sugar_powder'] },
    choices: [
      { id: 'powder', text: '별가루를 받아 간다', ops: [{ type: 'field', ids: ['star_powder'] }] },
      { id: 'share', text: '케이크를 나눠 왕을 뽑는다', cost: 2, ops: [{ type: 'field', ids: ['twinkle_party'] }, { type: 'altar' }] }
    ]
  },
  {
    id: 'odd_even_chart', name: '점성술사의 별판', text: '점성술사가 셋째 칸에 지팡이를, 넷째 칸에 칼을 눕힌다.',
    requires: { present: ['astrologer'] },
    choices: [
      { id: 'moon', text: '달빛을 받아 간다', ops: [{ type: 'field', ids: ['moon_bless'] }] },
      { id: 'third', text: '셋째 턴 처치에 건다 · 상금 2', ops: [{ type: 'bet', kind: 'kill_on_turn', turn: 3, reward: { crystals: 2 } }] },
      { id: 'fourth', text: '넷째 턴 처치에 건다 · 상금 4', cost: 1, ops: [{ type: 'bet', kind: 'kill_on_turn', turn: 4, reward: { crystals: 4 } }] }
    ]
  },
  {
    id: 'five_socket_wheel', name: '대일여래의 다섯 홈', text: '대일여래가 법륜의 다섯 홈 중 두 곳에 구슬을 끼운다.',
    requires: { present: ['dainichi_nyorai'] },
    choices: [
      { id: 'beads', text: '구슬 둘을 굴린다', ops: [{ type: 'field', ids: ['earth_bless', 'star_powder'] }] },
      { id: 'wheel', text: '법륜을 통째로 산다', cost: 3, ops: [{ type: 'relic', id: 'buff_overload' }] }
    ]
  },
  {
    id: 'sun_moon_whetstone', name: '일월검희의 숫돌', text: '일월검희가 칼을 눕히자 양날에 해와 달이 따로 비친다.',
    requires: { present: ['sun_moon_sword_maiden'] },
    choices: [
      { id: 'sun', text: '해가 비친 날을 간다', ops: [{ type: 'field', ids: ['sun_bless'] }] },
      { id: 'moon', text: '달이 비친 날을 간다', ops: [{ type: 'field', ids: ['moon_bless'] }] },
      { id: 'both', text: '두 날을 함께 벼린다', cost: 2, ops: [{ type: 'field', ids: ['sun_bless', 'moon_bless'] }] }
    ]
  },
```

## 3. 사건별 고민과 캐릭터 근거

시작 상태는 다음 전투의 첫 적에게 걸립니다. 내기 보상은 조건을 채우고 그 전투에서 승리해야 지급됩니다. [사건 해석기](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/rooms.js:206>) · [승리 보상 판정](<C:/Users/BOMHANA/Downloads/게임/Studying-card-pixel/card_pixel/game/src/engine/run.js:239>)

| 번호 | 사건 | 노리는 고민과 원본 근거 |
|---:|---|---|
| 1 | 독병 | 기절로 첫 행동을 끊고 **어비스스팅**의 위력을 높일지, **아쿠아텐타클**이 평소 하나만 뽑는 약화·부식을 함께 걸어 물리전을 유리하게 만들지 고른다. |
| 2 | 승선 명부 | **선상결투**의 아레나로 다음 전투의 일반 공격을 키우거나, 동료 한 명을 이번 원정에서 떠나보내고 등급별 품삯에 결정 1개를 얹어 총 2~5개를 받는다. |
| 3 | 모래시계 | **섀도우트위스트**의 저주·침묵·암흑을 확정하거나, 결정 1개를 걸고 **종언의예고**처럼 예약한 공격을 제때 맞혀 결정 4개를 노린다. |
| 4 | 그림자극 | **소울디스트로이어**가 소모할 암흑을 챙기거나, 필드 효과를 받지 않는 팬텀에 맞춰 전투 내내 하늘을 비우고 결정 3개를 노린다. |
| 5 | 대련 | 프리즘트윈은 자기 일반 공격을, 엠버타이거는 전원의 일반 공격을 2배로 만든다. 한 명의 원정 축복을 20%로 정할지, 다음 한 전투만 전원에게 더블어택을 줄지 고른다. |
| 6 | 금 간 칼집 | **이터널플레임**의 연료인 작열 2를 받거나, 결정 3개로 한 명의 유품을 **데이브레이커**로 바꾼다. 이 기술은 쓸 때마다 시전자의 현재 HP 30%를 소모한다. |
| 7 | 혼례상 | **요화천벌**이 소모할 작열·디바인을 하나씩 챙기거나, 같은 등급 편성에서 마공이 2배가 되는 구미호에 맞춰 세 자리를 채우고 결정 3개를 노린다. |
| 8 | 언 샘 | **파이어브레스**로 녹인 샘에서 결정 1개를 건질지, 무작위 한 명을 깨울지, 결정 2개로 선봉 물공 +50%인 레드드래곤을 확정할지 고른다. |
| 9 | 유리 발자국 | 사막여우의 사망 특성이 남기는 작열 3을 홍련의 다음 적까지 이어 가거나, **황금폭풍**이 뽑을 수 있는 부식·저주를 확정해 첫 적의 물방·마방을 낮춘다. |
| 10 | 금 간 노심 | 결정 2개를 건지거나, 자폭기 **파이널버스트**처럼 목숨을 건다. 데스룰렛은 다음 한 전투 동안 기술 피해를 2배로 만들고 시전자에게 사망 위험을 준다. |
| 11 | 성문 | 블레싱테일의 사망 특성인 디바인 3으로 자스민의 피해 2배 조건을 즉시 채우거나, **홀리블레싱**의 성역을 열어 마공·마방을 높인다. |
| 12 | 벗겨진 성화 | **타락의낙인**이 만드는 암흑과 결정 1개를 챙기거나, 결정 3개로 오버디바인을 사서 이후 **다크레이**에 쓸 디바인을 더 쌓는다. |
| 13 | 왕관 케이크 | **그랜드케이크**에 쓸 스타파우더를 확보하거나, 결정 2개를 내고 **캔디메테오**에 쓸 트윙클파티와 제단의 무작위 축복을 함께 받는다. |
| 14 | 별판 | **스텔라리딩**에 쓸 달빛을 챙기거나, 홀수 턴에는 마공, 짝수 턴에는 물공이 강해지는 특성에 맞춰 정확히 3턴에 적 하나 처치(상금 2) 또는 4턴에 처치(결정 1을 걸어 상금 4)를 고른다. |
| 15 | 다섯 홈 | **파쇄륜**은 필드를 전부 소모한다. 다음 전투에 대지의축복·스타파우더 두 개를 바로 깔지, 결정 3개로 필드 상한을 다섯까지 늘려 큰 한 방을 준비할지 고른다. |
| 16 | 숫돌 | **솔라크레센트**의 해나 **루나크레센트**의 달을 무료로 고른다. 결정 2개를 쓰면 양쪽 위력 조건을 갖추고, 물리·마법을 번갈아 쓸 때의 MP 10 회복도 살릴 수 있다. |

**새 `op`는 0종입니다.** 파일 작성 없이 객체를 메모리에서 기존 목록에 삽입해 여섯 풀의 출현 수와 아군 그림을 대조했습니다. 현재 엔진의 `chooseDoor`와 `chooseEvent`로 35개 선택지의 비용과 효과를 확인했습니다. 보상 수치는 플레이테스트 전 초안입니다.