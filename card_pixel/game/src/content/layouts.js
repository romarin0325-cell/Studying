export const LAYOUTS = {
  expedition: [
    [{ type: 'wild', reward: 1 }],
    [{ type: 'wild', reward: 1 }, { type: 'wild', risk: true, reward: 2 }],
    [{ type: 'spring' }, { type: 'altar' }, { type: 'event' }],
    [{ type: 'gate', reward: 3 }],
    [{ type: 'event' }, { type: 'treasure' }],
    [{ type: 'wild', reward: 1 }, { type: 'elite', reward: 3 }],
    [{ type: 'spring' }, { type: 'altar' }],
    [{ type: 'boss' }]
  ],
  intro: [
    [{ type: 'borrowed' }],
    [{ type: 'awakening' }],
    [{ type: 'wild', intent: 'phy', creature: 'emerald_beetle', reward: 1 },
      { type: 'wild', intent: 'mag', creature: 'gold_moth', reward: 1 }],
    [{ type: 'spring' }, { type: 'treasure' }],
    [{ type: 'gate', final: true, reward: 3 }]
  ]
};

export const ROOM_NAMES = {
  borrowed: '대여 전투', awakening: '첫 깨우기', wild: '몽마', elite: '정예',
  gate: '문지기', boss: '꿈의 주인', spring: '소환의 샘', altar: '혼돈의 제단',
  event: '사건', treasure: '보물방'
};
