/* Bosses keep the card game's enemy id, so their real turn patterns run (rule A shows them).
   Numbers are set for a three-fighter relay. `note` is what the map shows before the run. */
export const BOSSES = {
  artificial_demon_god: { stats: { hp: 2900, atk: 120, matk: 155, def: 60, mdef: 60 }, note: "10턴 '파괴의형태' 발동 · 피격 유형(물리·마법)의 방어력이 다음 턴 50% 상승" },
  demon_god: { stats: { hp: 2900, atk: 115, matk: 115, def: 75, mdef: 75 }, note: "7·14턴 '제노사이드' 발동 · 짝수 턴 물리방어, 홀수 턴 마법방어 +50%" },
  ares: { stats: { hp: 3100, atk: 115, matk: 115, def: 70, mdef: 70 }, note: '3·8턴 충전 후 다음 턴 위력 4배 일격' },
  iris_love: { stats: { hp: 3225, atk: 80, matk: 135, def: 60, mdef: 90 }, note: "7턴 '소울드레인' 발동 · 선두 동료의 현재 MP 전량 소멸" },
  iris_curse: { stats: { hp: 2550, atk: 125, matk: 100, def: 80, mdef: 60 }, note: "10턴 '아포칼립스' 발동 · 선두 동료에게 물리 5배 피해" },
  pharaoh: { stats: { hp: 2900, atk: 110, matk: 110, def: 75, mdef: 75 }, note: "5턴마다 '고대의저주' 발동 · 해당 턴 피격 시 위력 3배 반격" },
  gray: { stats: { hp: 2600, atk: 115, matk: 115, def: 60, mdef: 60 }, note: "4턴마다 무작위 위력 2~4배 '절단' · 14턴 '디멘션제로' 발동" },
  thor: { stats: { hp: 3000, atk: 120, matk: 100, def: 85, mdef: 55 }, note: "10턴 '썬더러쉬' 후 공·마공 및 물방·마방 교환 · 시작 시 높은 물리방어, 낮은 마법방어" },
  flora: { stats: { hp: 2800, atk: 100, matk: 120, def: 70, mdef: 70 }, note: "적의 5턴·10턴 '제네시스블룸'으로 디버프 해제 · 플레이어의 6턴·11턴 동안 받는 피해 50% 감소" },
  // Keep Poseidon's magic defense ahead of physical. Higher HP absorbs the bigger hits allowed by lower armor.
  poseidon: { stats: { hp: 3800, atk: 115, matk: 105, def: 30, mdef: 50 }, note: "5턴 디버프 해제 · 10턴 '어비스프레셔' (마법 3배) · 15턴 필드 효과 1종 해제" },
  creator_god: { stats: { hp: 3600, atk: 120, matk: 135, def: 80, mdef: 80 }, note: "2턴 '저지먼트' (마법 3.5배) · 확률적 충전 후 다음 턴 '디바인블레이드' (물리 4배)" }
};
