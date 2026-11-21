const ORIGINAL_EVENTS = [
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

const TEMPO_EVENTS = [
  {
    id: 'kobold_boot_exchange', name: '코볼트의 두 켤레',
    text: '코볼트가 기습 연습을 마치자 흙 묻은 장화 옆에 새 장화가 놓인다. 새 장화의 주인은 천막 밖에서 기다린다.',
    requires: { present: ['kobold'] },
    choices: [
      { id: 'mend', text: '한 명의 장화를 기운다 · 원정 축복을 20%로 교체',
        target: 'bench', ops: [{ type: 'bless', multiplier: 0.20 }] },
      { id: 'exchange', text: '한 명을 보내고 무작위 후임을 받는다',
        cost: 1, target: 'release', ops: [{ type: 'release', randomReplacement: true }] }
    ]
  },
  {
    id: 'mimic_paybox', name: '미믹의 일당 상자',
    text: '미믹이 가드로 뚜껑을 닫자 결정 둘이 달그락거린다. 뚜껑 안쪽에는 “같이 나가서 살아오면 한 닢씩”이라고 적혀 있다.',
    requires: { present: ['mimic'] },
    choices: [
      { id: 'cash', text: '붙어 있는 결정 둘을 뗀다',
        ops: [{ type: 'crystals', amount: 2 }] },
      { id: 'porter', text: '미믹을 깨운다 · 출전 생환 일당 1',
        ops: [{ type: 'join', ids: ['mimic'] }] }
    ]
  },
  {
    id: 'ash_split_wick', name: '애쉬의 갈라진 심지',
    dungeons: ['ember_volcano', 'creation_tower'],
    text: '애쉬가 한 심지의 양 끝에 불을 붙인다. 한쪽 불은 손을 감싸고, 다른 쪽 불은 손목까지 타고 오른다.',
    requires: { present: ['ash'] },
    choices: [
      { id: 'veil', text: '드림파이어를 준다 · 사용 시 회피 1턴',
        target: 'bench', ops: [{ type: 'heirloom', from: 'ash', name: '드림파이어' }] },
      { id: 'flare', text: '아마겟돈을 준다 · 사용 시 자기 HP 절반 소모와 기절',
        cost: 2, target: 'bench', ops: [{ type: 'heirloom', from: 'ash', name: '아마겟돈' }] }
    ]
  },
  {
    id: 'miko_lottery_cups', name: '용혈의무녀의 제비 잔',
    dungeons: ['ember_volcano', 'creation_tower'],
    text: '용혈의무녀가 드래곤스파클의 불꽃으로 제비를 밝힌다. 무녀의 잔 하나가 아직 원 밖에 있다.',
    requires: { present: ['dragon_miko'] },
    choices: [
      { id: 'old_circle', text: '지금 동료들끼리 제비를 뽑는다',
        ops: [{ type: 'altar' }] },
      { id: 'one_more', text: '무녀도 깨워 함께 제비를 뽑는다',
        cost: 1, ops: [{ type: 'join', ids: ['dragon_miko'] }, { type: 'altar' }] }
    ]
  },
  {
    id: 'holy_bomb_last_verse', name: '홀리밤의 마지막 소절',
    dungeons: ['twilight_cathedral', 'creation_tower'],
    text: '홀리밤이 악보 끝에 쓴 자기 이름을 지운다. “마지막 소절을 부를 사람이 여기에 서명해.”',
    requires: { present: ['holy_bomb'] },
    choices: [
      { id: 'singer', text: '홀리밤을 깨워 악보를 돌려준다',
        cost: 1, ops: [{ type: 'join', ids: ['holy_bomb'] }] },
      { id: 'sign', text: '한 명이 라스트캐럴에 서명한다 · 사용 시 자폭',
        target: 'bench', ops: [{ type: 'heirloom', from: 'holy_bomb', name: '라스트캐럴' }] }
    ]
  },
  {
    id: 'whale_third_peal', name: '은하고래가 삼킨 종',
    dungeons: ['twilight_cathedral', 'creation_tower'],
    text: '은하고래의 입에서 작은 종이 굴러 나온다. 그 안에 셋째 울림과 어둠을 꿰뚫는 흰 음표가 들어 있다.',
    requires: { present: ['galaxy_whale'] },
    choices: [
      { id: 'peal', text: '셋째 턴 처치로 오버디바인의 값을 치른다',
        ops: [
          { type: 'start', enemyDebuffs: { divine: 1 } },
          { type: 'bet', kind: 'kill_on_turn', turn: 3, reward: { relic: 'over_divine' } }
        ] },
      { id: 'buy_bell', text: '종값을 내고 오버디바인을 받는다',
        cost: 3, ops: [{ type: 'relic', id: 'over_divine' }] },
      { id: 'white_note', text: '앱솔루트라이트의 흰 음표를 베낀다',
        cost: 2, target: 'bench',
        ops: [{ type: 'heirloom', from: 'galaxy_whale', name: '앱솔루트라이트' }] }
    ]
  },
  {
    id: 'two_garden_chairs', name: '정원에 남은 두 의자',
    dungeons: ['starlit_garden', 'creation_tower'],
    text: '미이라가 가운데 의자의 다리를 붕대로 묶는다. 빅토리아가 맨 뒤 의자에 앉자 등불이 두 배로 밝아진다.',
    requires: { present: ['mummy', 'victoria'] },
    choices: [
      { id: 'middle', text: '중견을 맡을 미이라를 깨운다',
        cost: 1, ops: [{ type: 'join', ids: ['mummy'] }] },
      { id: 'rear', text: '대장을 맡을 빅토리아를 깨운다',
        cost: 3, ops: [{ type: 'join', ids: ['victoria'] }] },
      { id: 'lanterns', text: '의자를 접고 등불 둘만 가져간다',
        ops: [{ type: 'field', ids: ['goddess_descent', 'twinkle_party'] }] }
    ]
  },
  {
    id: 'dainichi_alms_bowl', name: '대일여래의 빈 발우',
    dungeons: ['starlit_garden', 'creation_tower'],
    text: '대일여래가 발우를 기울이자 결정 둘이 바닥을 구른다. 발우 안쪽에는 누구의 이마에 대도 같은 높이까지 닿는 금이 그어져 있다.',
    requires: { present: ['dainichi_nyorai'] },
    choices: [
      { id: 'level', text: '결정 둘을 받고 모두의 원정 축복을 10%로 맞춘다',
        ops: [{ type: 'bless', all: true, multiplier: 0.10 }, { type: 'crystals', amount: 2 }] },
      { id: 'mantra', text: '지금 원정 축복을 지킨다 · 다음 전투 보조 MP 0',
        ops: [{ type: 'relic', id: 'support_boost', temporary: true }] }
    ]
  },
  {
    id: 'penguin_ice_seam', name: '눈꽃펭귄의 마지막 빙판',
    dungeons: ['midnight_trench', 'creation_tower'],
    text: '눈꽃펭귄이 제트슬라이드를 멈춘 자리에서 얼음 한 장이 통째로 들린다. 발로 밟을 수도, 등에 묶을 수도 있다.',
    requires: { present: ['snow_penguin'] },
    choices: [
      { id: 'break', text: '첫 적 발밑에서 얼음을 깬다',
        ops: [{ type: 'start', enemyDebuffs: { stun: 1 } }] },
      { id: 'carry', text: '물 동료가 쓰러질 때 깰 얼음을 남긴다',
        ops: [{ type: 'relic', id: 'frozen_body', temporary: true }] }
    ]
  },
  {
    id: 'venom_five_knots', name: '베놈의 다섯 매듭',
    dungeons: ['midnight_trench', 'creation_tower'],
    text: '베놈이 뱃전에 플레이그의 매듭을 다섯 개 묶는다. 손을 놓자 아직 풀리지 않은 매듭이 물밑으로 가라앉는다.',
    requires: { present: ['venom'] },
    choices: [
      { id: 'hold', text: '플레이그를 준다 · 물러나면 남은 예약 소멸',
        cost: 2, target: 'bench', ops: [{ type: 'heirloom', from: 'venom', name: '플레이그' }] },
      { id: 'brace', text: '대신 맞을 동료의 원정 축복을 25%로 교체한다',
        target: 'bench', ops: [{ type: 'bless', multiplier: 0.25 }] }
    ]
  },
  {
    id: 'arena_chalk_lines', name: '분필로 그은 결투선',
    dungeons: ['arena', 'creation_tower'],
    text: '가디언이 배틀필드에 짧은 획을 둘 긋는다. 팔라딘이 그 끝에 칼을 대자 흰 선이 칼날 속으로 빨려 든다.',
    requires: { present: ['guardian', 'paladin'] },
    choices: [
      { id: 'grind', text: '첫 적의 갑옷을 긁고 선을 남긴다',
        ops: [{ type: 'field', ids: ['arena'] }, { type: 'start', enemyDebuffs: { corrosion: 1 } }] },
      { id: 'cut', text: '한 명에게 선을 베는 듀얼브레이커를 준다',
        cost: 2, target: 'bench',
        ops: [{ type: 'field', ids: ['arena'] }, { type: 'heirloom', from: 'paladin', name: '듀얼브레이커' }] }
    ]
  },
  {
    id: 'rollcall_ends', name: '앞뒤가 빈 출석부',
    dungeons: ['arena', 'creation_tower'],
    text: '선도부장이 첫 줄에 서명한다. 웨어베어의 커다란 발도장은 가운데 한 줄을 비워 두고 맨 끝에 찍힌다.',
    requires: { present: ['discipline_captain', 'werebear'] },
    choices: [
      { id: 'pair', text: '선도부장과 웨어베어를 함께 깨운다',
        cost: 1, ops: [{ type: 'join', ids: ['discipline_captain', 'werebear'] }] },
      { id: 'rebuke', text: '첫 적에게 침묵과 약화를 건다',
        ops: [{ type: 'start', enemyDebuffs: { silence: 1, weak: 1 } }] }
    ]
  }
];

export const EVENTS = [...ORIGINAL_EVENTS, ...TEMPO_EVENTS.map(event => ({ ...event, minTempoVersion: 2 }))];

export function eventForRun(event, run) {
  if (!event || !run.lessonVersion) return event;
  const updated = structuredClone(event);
  const choice = id => updated.choices.find(entry => entry.id === id);
  switch (event.id) {
    case 'mimic_paybox':
      choice('porter').text = '미믹 합류 · 계약금 ◆1 · 첫 출전 생환 추가 ◆1 · 생환 일당 ◆1';
      choice('porter').ops.push({ type: 'crystals', amount: 1 }, { type: 'firstSurvivalPay', id: 'mimic', amount: 1 });
      break;
    case 'venom_five_knots':
      choice('hold').text = '플레이그 · 다음 턴부터 매턴 1회·최대 5회·물러나면 남은 예약 소멸';
      choice('hold').cost = run.floor === 5 ? 1 : 2;
      break;
    case 'rollcall_ends':
      updated.choices.unshift(
        { id: 'captain', text: '선도부장 한 명 합류 · 무료', ops: [{ type: 'join', ids: ['discipline_captain'] }] },
        { id: 'werebear', text: '웨어베어 한 명 합류 · 무료', ops: [{ type: 'join', ids: ['werebear'] }] }
      );
      break;
    case 'whale_third_peal':
      choice('peal').text = '다음 전투 3턴에 적 하나 처치 후 승리 · 오버디바인';
      break;
  }
  return updated;
}
