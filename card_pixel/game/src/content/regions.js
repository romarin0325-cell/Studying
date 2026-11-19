export const REGIONS = {
  ember_carry: { id: 'ember_carry', name: '잿불 계승', desc: '적이 쓰러지면 다음 적에게 작열을 최대 2스택 옮긴다.' },
  twilight_bell: {
    id: 'twilight_bell', name: '황혼의 종', desc: '3·6·9턴 시작에 적에게 디바인 2스택을 부여한다.',
    turns: [3, 6, 9], stacks: 2
  },
  starlit_sky: { id: 'starlit_sky', name: '별빛 하늘', desc: '문에 공개된 필드 버프로 전투를 시작한다.' },
  tide_cycle: {
    id: 'tide_cycle', name: '심야의 조류', desc: '보스 외의 적은 4턴 주기: 셋째 턴 마법 2.5배, 넷째 턴 쉬면서 받는 피해 1.5배',
    hit: '조류의 일격', rest: '물러간 조류', opening: '조류가 빠진 틈'
  },
  arena_charge: { id: 'arena_charge', name: '투기장의 기세', desc: '일반 공격을 두 번 맞히면 다음 물리·마법 기술이 피해 2배를 준다. 전투당 한 번.' }
};
