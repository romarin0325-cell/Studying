export const REGIONS = {
  ember_carry: { id: 'ember_carry', name: '잿불 계승', desc: '적 처치 시 다음 적에게 작열을 최대 2스택 전이' },
  twilight_bell: {
    id: 'twilight_bell', name: '황혼의 종', desc: '3·6·9턴 시작 시 적에게 디바인 2스택 부여',
    turns: [3, 6, 9], stacks: 2
  },
  starlit_sky: { id: 'starlit_sky', name: '별빛 하늘', desc: '문에 표시된 필드 효과로 전투 시작' },
  tide_cycle: {
    id: 'tide_cycle', name: '심야의 조류', desc: '보스 외의 적은 4턴 주기: 3턴 마법 2.5배 · 4턴 휴식 및 받는 피해 1.5배',
    hit: '조류의 일격', rest: '물러간 조류', opening: '조류가 빠진 틈'
  },
  arena_charge: { id: 'arena_charge', name: '투기장의 기세', desc: '일반 공격 2회 적중 시 다음 공격 스킬 피해 2배 (전투당 1회)' }
};
