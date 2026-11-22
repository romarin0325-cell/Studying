export const RIFT_PUZZLES = [
  {
    id: 'arena-relay',
    title: '모래 위의 발자국',
    spec: '2026-11-22',
    floor: 7,
    rentals: ['hellhound', 'trauma', 'time_ruler', 'discipline_captain', 'entropy'],
    // The daily's boss entrance, after three battles. Earlier turns are excluded from the score.
    setup: { seedOffset: 21, relics: ['big_bang'], blessings: { time_ruler: 0.4, hellhound: 0.3 } },
    endings: [
      { id: 'save', title: '헬하운드를 살려서', goal: { survive: ['hellhound'] } },
      { id: 'heirloom', title: '헬하운드의 유품으로', goal: { fall: 'hellhound', heirloomUsed: 'hellhound' } }
    ],
    note: '관중이 떠난 뒤에도 모래 위의 발자국은 남아 있다.'
  },
  {
    id: 'ember-clock',
    title: '식지 않는 잿불',
    spec: '2026-11-23',
    floor: 7,
    rentals: ['shooting_star_boy', 'night_rabbit', 'cinderella', 'forget_me_not', 'pudding_princess'],
    endings: [
      { id: 'save', title: '신데렐라를 살려서', goal: { survive: ['cinderella'], maxTurns: 12 } },
      { id: 'heirloom', title: '신데렐라의 유품으로', goal: { fall: 'cinderella', heirloomUsed: 'cinderella', maxTurns: 12 } }
    ],
    note: '꺼진 줄 알았던 잿불이 재 밑에서 다시 빛난다.'
  },
  {
    id: 'trench-heirlooms',
    title: '바다 밑의 메아리',
    spec: '2026-11-26',
    floor: 7,
    rentals: ['black_swan', 'sphinx', 'sylphid', 'legendary_captain', 'unicorn'],
    setup: { blessings: { unicorn: 0.1 } },
    endings: [
      { id: 'save', title: '실피드를 살려서', goal: { survive: ['sylphid'] } },
      { id: 'heirloom', title: '실피드의 유품으로', goal: { fall: 'sylphid', heirloomUsed: 'sylphid' } }
    ],
    note: '물결이 잦아들자 먼 바다에서 종소리가 들려온다.'
  }
];
