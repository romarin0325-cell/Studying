/* G. Battle-wide twists shown on the door before the player picks it. Each one bends the
   numbers toward excess on both sides; `foe` scales the enemies so the twist is not free. */
export const QUIRKS = {
  glass: { name: '유리 대포', desc: '모두의 공격력·마법공격력 +60%, 방어력 0', foe: { atk: 1.6, def: 0 }, ally: { atk: 1.6, def: 0 } },
  overheat: { name: '과열', desc: '아군 치명타율 +20%, 치명타 피해 3배. 적 공격력 +25%', foe: { atk: 1.25 }, ally: { crit: 20 }, critMult: 3.0 },
  surge: { name: '마나 폭주', desc: '아군 MP 200으로 시작. 적 HP +35%', foe: { hp: 1.35 }, ally: { mp: 200 } },
  starfall: { name: '별의 비', desc: '매 턴 시작에 하늘에 무작위 필드 버프가 걸린다' },
  overflow: { name: '넘침', desc: '적이 한 명 더 나온다. 쓰러뜨리고 남은 피해는 다음 적에게 넘어간다' },
  martyr: { name: '순교', desc: '아군이 쓰러질 때마다 남은 아군 공격력·마법공격력 +40%' },
  echo: { name: '메아리', desc: '아군의 3티어 공격이 절반 위력으로 한 번 더 울린다. 적 HP +20%', foe: { hp: 1.2 } }
};
