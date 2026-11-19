export const EVENTS = [
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
  {
    id: 'greenhouse', name: '지크와 해바라기의 온실', text: '해시계 옆에 화분이 놓여 있다.',
    requires: { present: ['zeke', 'sunflower'] },
    choices: [
      { id: 'sundial', text: '해시계를 가져간다', ops: [{ type: 'field', ids: ['sun_bless'] }] },
      { id: 'sunflower', text: '화분을 데려간다', ops: [{ type: 'join', ids: ['sunflower'] }] }
    ]
  },
  {
    id: 'rabbit_tracks', name: '눈토끼와 밤토끼의 두 발자국', text: '두 줄의 발자국이 굴로 이어진다.',
    requires: { present: ['snow_rabbit', 'night_rabbit'] },
    choices: [
      { id: 'snow', text: '먼저 나온 눈토끼를 안는다', ops: [{ type: 'join', ids: ['snow_rabbit'] }] },
      { id: 'both', text: '굴 안까지 따라간다', cost: 1, ops: [{ type: 'join', ids: ['snow_rabbit', 'night_rabbit'] }] }
    ]
  },
  {
    id: 'observatory', name: '루나의 꺼진 천문대', text: '등불 하나가 망원경 옆에 남았다.',
    requires: { present: ['luna'] },
    choices: [
      { id: 'dark', text: '등불을 끈다', ops: [{ type: 'bet', kind: 'empty_sky', reward: { crystals: 2 } }] },
      { id: 'moon', text: '달을 띄운다', ops: [{ type: 'field', ids: ['moon_bless'] }] }
    ]
  },
  {
    id: 'lightning_rod', name: '번개의현자의 피뢰침', text: '피뢰침 끝에서 불꽃이 튄다.',
    requires: { present: ['lightning_sage'] },
    choices: [
      { id: 'borrow', text: '빌린다', ops: [{ type: 'relic', id: 'companion', temporary: true }] },
      { id: 'buy', text: '사들인다', cost: 2, ops: [{ type: 'relic', id: 'companion' }] }
    ]
  },
  {
    id: 'late_letter', name: '시간의마술사의 늦은 편지', text: '봉투에 지난 시각이 적혀 있다.',
    requires: { present: ['time_magician'] },
    choices: [
      { id: 'hire', text: '마술사를 고용한다', cost: 2, ops: [{ type: 'join', ids: ['time_magician'] }] },
      { id: 'deliver', text: '정시에 배달한다', ops: [{ type: 'bet', kind: 'delayed_on_time', reward: { crystals: 3 } }] }
    ]
  },
  {
    id: 'armor_test', name: '체리프린스의 갑옷 시험', text: '모루 위에 갑옷 한 벌이 놓여 있다.',
    requires: { present: ['cherry_prince'] },
    choices: [
      { id: 'heat', text: '갑옷을 달군다', ops: [{ type: 'start', enemyDebuffs: { burn: 2 } }] },
      { id: 'bellows', text: '풀무를 산다', cost: 2, ops: [{ type: 'relic', id: 'over_flame' }] }
    ]
  },
  {
    id: 'last_die', name: '엔트로피의 마지막 주사위', text: '주사위가 제단 끝에 멈춰 있다.',
    requires: { present: ['entropy'] },
    choices: [
      { id: 'name', text: '한 명을 지목한다', target: 'bench', ops: [{ type: 'bless', multiplier: 'grade' }] },
      { id: 'roll', text: '주사위를 던진다', ops: [{ type: 'altar' }] }
    ]
  },
  {
    id: 'fifth_bell', name: '명탐정의 다섯 번째 종', text: '시곗바늘이 다섯에 멈춰 있다.',
    requires: { present: ['great_detective'] },
    choices: [
      { id: 'fee', text: '착수금을 받는다', ops: [{ type: 'crystals', amount: 1 }] },
      { id: 'timing', text: '범행 시각을 맞힌다', ops: [{ type: 'bet', kind: 'kill_on_turn', turn: 5, reward: { crystals: 3 } }] }
    ]
  },
  {
    id: 'empty_role', name: '조커의 빈 배역', text: '빈 의자에 가면 두 개가 놓여 있다.',
    requires: { present: ['joker'] },
    choices: [
      { id: 'cast', text: '조커를 캐스팅한다', ops: [{ type: 'join', ids: ['joker'] }] },
      { id: 'mask', text: '가면을 뒤집는다', ops: [{ type: 'join', random: true }] }
    ]
  },
  {
    id: 'championship', name: '언더독의 무명 선수권', text: '출전표에 같은 등급 세 자리가 그려져 있다.',
    requires: { present: ['underdog'] },
    choices: [
      { id: 'fee', text: '출전 수당을 받는다', ops: [{ type: 'crystals', amount: 1 }] },
      { id: 'team', text: '무명 팀을 내보낸다', ops: [{ type: 'bet', kind: 'same_grade_full', reward: { relic: 'double_attack' } }] }
    ]
  },
  {
    id: 'grand_merchant', name: '대상인의 거래', text: '대상인이 값을 적은 물건을 펼친다.',
    requires: { present: ['grand_merchant'] },
    choices: [
      { id: 'relic', text: '유물을 산다', cost: 4, ops: [{ type: 'relic', id: 'offered' }] },
      { id: 'waking', text: '한 명을 깨운다', cost: 2, ops: [{ type: 'join', random: true }] },
      { id: 'release', text: '동료 한 명을 보낸다', target: 'release', ops: [{ type: 'release' }] }
    ]
  },
  {
    id: 'rumi', name: '루미의 축복', text: '루미가 축복을 받을 동료를 기다린다.',
    requires: { present: ['rumi'] },
    choices: [
      { id: 'all', text: '모두 함께 축복받는다', ops: [{ type: 'bless', all: true, multiplier: 0.10 }] },
      { id: 'one', text: '한 명에게 축복을 모은다', target: 'bench', ops: [{ type: 'bless', multiplier: 0.40 }] }
    ]
  }
];
