export const RIFT_PUZZLES = [
  {
    id: 'arena-relay',
    title: '모래 위의 발자국',
    spec: '2026-11-22',
    floor: 7,
    rentals: ['hellhound', 'trauma', 'time_ruler', 'discipline_captain', 'entropy'],
    // The daily's boss entrance, after three battles. Earlier turns are excluded from the score.
    setup: { seedOffset: 21, relics: ['big_bang'], blessings: { time_ruler: 0.4, hellhound: 0.3 } },
    goal: { survivors: 3 },
    note: '관중이 떠난 뒤에도 모래 위의 발자국은 남아 있다.'
  },
  {
    id: 'ember-clock',
    title: '식지 않는 잿불',
    spec: '2026-11-23',
    floor: 7,
    rentals: ['shooting_star_boy', 'night_rabbit', 'cinderella', 'forget_me_not', 'pudding_princess'],
    goal: { maxTurns: 12 },
    note: '꺼진 줄 알았던 잿불이 재 밑에서 다시 빛난다.'
  },
  {
    id: 'trench-heirlooms',
    title: '바다 밑의 메아리',
    spec: '2026-11-26',
    floor: 7,
    rentals: ['black_swan', 'sphinx', 'sylphid', 'legendary_captain', 'unicorn'],
    goal: { survivors: 3, heirloomUses: 2 },
    note: '물결이 잦아들자 먼 바다에서 종소리가 들려온다.'
  }
];
