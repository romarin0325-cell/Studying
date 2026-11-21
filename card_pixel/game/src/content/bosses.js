/* Bosses keep the card game's enemy id, so their real turn patterns run (rule A shows them).
   Numbers are set for a three-fighter relay. `note` is what the map shows before the run. */
export const BOSSES = {
  artificial_demon_god: { stats: { hp: 2900, atk: 120, matk: 155, def: 60, mdef: 60 }, note: '10턴째 파괴의형태. 맞은 종류(물리·마법)의 방어가 다음 턴 50% 오른다.' },
  demon_god: { stats: { hp: 2900, atk: 115, matk: 115, def: 75, mdef: 75 }, note: '7턴·14턴 제노사이드. 짝수 턴은 물리, 홀수 턴은 마법 방어가 50% 오른다.' },
  ares: { stats: { hp: 3100, atk: 115, matk: 115, def: 70, mdef: 70 }, note: '3턴·8턴에 힘을 모았다가 다음 턴에 위력 4배의 일격.' },
  iris_love: { stats: { hp: 3225, atk: 80, matk: 135, def: 60, mdef: 90 }, note: '7턴째 소울드레인: 앞에 선 동료의 MP를 모두 빼앗는다. 그 전에 큰 기술을 써 둔다.' },
  iris_curse: { stats: { hp: 2550, atk: 125, matk: 100, def: 80, mdef: 60 }, note: '10턴째 아포칼립스(물리 5배). 그 턴에 앞에 설 동료를 정해 둔다.' },
  pharaoh: { stats: { hp: 2900, atk: 110, matk: 110, def: 75, mdef: 75 }, note: '5턴마다 고대의저주: 그 턴에 맞았다면 3배로 되갚는다. 저주 턴에는 때리지 말고 막는다.' },
  gray: { stats: { hp: 2600, atk: 115, matk: 115, def: 60, mdef: 60 }, note: '4턴마다 위력 2~4배의 절단(무작위). 14턴째 디멘션제로.' },
  thor: { stats: { hp: 3000, atk: 120, matk: 100, def: 85, mdef: 55 }, note: '10턴째 썬더러쉬 뒤 물리·마법 공격력이 뒤바뀐다. 물리 방어가 높고 마법 방어가 낮다.' },
  flora: { stats: { hp: 2800, atk: 100, matk: 120, def: 70, mdef: 70 }, note: '적의 5턴·10턴: 제네시스블룸으로 디버프를 지운다. 플레이어의 6턴·11턴에는 플로라가 받는 피해가 절반이 된다.' },
  // Keep Poseidon's magic defense ahead of physical. Higher HP absorbs the bigger hits allowed by lower armor.
  poseidon: { stats: { hp: 3800, atk: 115, matk: 105, def: 30, mdef: 50 }, note: '10턴째 어비스프레셔(마법 3배). 15턴째 하늘의 필드 버프 하나를 지운다.' },
  creator_god: { stats: { hp: 3600, atk: 120, matk: 135, def: 80, mdef: 80 }, note: '2턴째 저지먼트(마법 3.5배). 가끔 힘을 모았다가 다음 턴 디바인블레이드(물리 4배).' }
};
