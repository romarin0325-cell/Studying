/* H. Enemy modifiers. They replace "weaker numbers" as the way ordinary fights differ. */
export const AFFIXES = {
  tough: { name: '단단함', desc: '처음 3턴 동안 받는 피해 절반' },
  frenzy: { name: '광폭', desc: 'HP가 절반 이하가 되면 다음 턴부터 공격력 1.5배' },
  leech: { name: '흡혈', desc: '준 피해의 절반만큼 HP 회복' },
  thorns: { name: '가시', desc: '물리 공격한 아군이 준 피해의 25%를 돌려받는다 (HP 1 아래로는 안 내려간다)' },
  treasure: { name: '보물', desc: '쓰러뜨리면 꿈의 결정 +2' }
};
