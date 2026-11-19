export const EVENTS = [
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
