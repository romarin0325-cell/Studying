/* H. Enemy modifiers. They replace "weaker numbers" as the way ordinary fights differ. */
export const AFFIXES = {
  tough: { name: '단단함', desc: '첫 3턴 동안 받는 피해 50% 감소' },
  frenzy: { name: '광폭', desc: 'HP 50% 이하 시 다음 턴부터 공격력·마법공격력 1.5배' },
  leech: { name: '흡혈', desc: '가한 피해의 50%만큼 HP 회복' },
  thorns: { name: '가시', desc: '물리 공격 피격 시 피해의 25% 반사 (아군 최소 HP 1 유지)' },
  treasure: { name: '보물', desc: '처치 시 꿈의 결정 +2' }
};
