/* G. Battle-wide twists shown on the door before the player picks it. Each one bends the
   numbers toward excess on both sides; `foe` scales the enemies so the twist is not free. */
export const QUIRKS = {
  glass: { name: '유리 대포', desc: '아군·적 공격력·마법공격력 +60%, 모든 방어력 0', foe: { atk: 1.6, def: 0 }, ally: { atk: 1.6, def: 0 } },
  overheat: { name: '과열', desc: '아군 치명타율 +20%p, 치명타 피해 3배 · 적 공격력·마법공격력 +25%', foe: { atk: 1.25 }, ally: { crit: 20 }, critMult: 3.0 },
  surge: { name: '마나 폭주', desc: '아군 최대·시작 MP 200 · 적 HP +35%', foe: { hp: 1.35 }, ally: { mp: 200 } },
  starfall: { name: '별의 비', desc: '매 턴 시작 시 무작위 필드 효과 발동' },
  overflow: { name: '넘침', desc: '적 1명 추가 출현 · 처치 시 초과 피해가 다음 적에게 전이' },
  martyr: { name: '순교', desc: '아군이 쓰러질 때마다 남은 아군 공격력·마법공격력 +40%' },
  echo: { name: '메아리', desc: '아군의 3티어 공격 스킬이 50% 위력으로 1회 추가 발동 · 적 HP +20%', foe: { hp: 1.2 } }
};
