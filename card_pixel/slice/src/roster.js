/* RelayRoster: the shared structure every dungeon will use.
   - which characters exist (card data) and which of them have battle sprites,
   - pools: the common pool now, one pool per dungeon later (the card game's themed base sets),
   - enemy builders in the card game's enemy format: wild creatures, shadows of characters, bosses.
   Nothing here decides a run; run.js does. */
(function (root) {
  'use strict';

  const ELEMENT = { fire: '불', water: '물', nature: '자연', light: '빛', dark: '어둠' };
  const GRADE = { normal: '노멀', rare: '레어', epic: '에픽', legend: '전설', transcendence: '초월', event: '이벤트' };
  const POSITION = ['선봉', '중견', '대장'];

  /* Wild creatures (Defense creature sheet). One skill each; the affixes give them their twist. */
  const WILD = {
    golem: { name: '악몽 골렘', element: 'nature', size: 'large', stats: { hp: 900, atk: 110, matk: 60, def: 80, mdef: 40 }, skill: ['강타', 'phy', 1.8] },
    emerald_beetle: { name: '에메랄드 갑충', element: 'nature', size: 'small', stats: { hp: 760, atk: 100, matk: 50, def: 95, mdef: 45 }, skill: ['껍질 돌진', 'phy', 1.8] },
    magma_beetle: { name: '용암 갑충', element: 'fire', size: 'small', stats: { hp: 700, atk: 108, matk: 86, def: 75, mdef: 55 }, skill: ['용암 분출', 'mag', 1.8] },
    gold_moth: { name: '황금 나방', element: 'light', size: 'small', stats: { hp: 560, atk: 60, matk: 118, def: 50, mdef: 90 }, skill: ['빛가루', 'mag', 1.7] },
    treant: { name: '고목 수호자', element: 'nature', size: 'large', stats: { hp: 1050, atk: 100, matk: 70, def: 85, mdef: 70 }, skill: ['뿌리 휘감기', 'phy', 1.7] },
    wraith: { name: '망령', element: 'dark', size: 'medium', stats: { hp: 620, atk: 60, matk: 122, def: 45, mdef: 95 }, skill: ['저주의 손길', 'mag', 1.8] },
    night_bat: { name: '밤박쥐', element: 'dark', size: 'small', stats: { hp: 520, atk: 112, matk: 60, def: 50, mdef: 50 }, skill: ['흡혈 이빨', 'phy', 1.6] },
    dark_knight: { name: '흑기사', element: 'dark', size: 'large', stats: { hp: 980, atk: 122, matk: 70, def: 95, mdef: 60 }, skill: ['암흑 베기', 'phy', 2.0] },
    abyss_eye: { name: '심연의 눈', element: 'water', size: 'medium', stats: { hp: 660, atk: 60, matk: 122, def: 55, mdef: 85 }, skill: ['마안', 'mag', 1.8] }
  };
  const LARGE = ['golem', 'treant', 'dark_knight'];

  /* Bosses keep the card game's enemy id, so their real turn patterns run (rule A shows them).
     Numbers are set for a three-fighter relay. `note` is what the map shows before the run. */
  const BOSSES = {
    artificial_demon_god: { stats: { hp: 2900, atk: 120, matk: 155, def: 60, mdef: 60 }, note: '10턴째 파괴의형태. 맞은 종류(물리·마법)의 방어가 다음 턴 50% 오른다.' },
    demon_god: { stats: { hp: 2900, atk: 115, matk: 115, def: 75, mdef: 75 }, note: '7턴·14턴 제노사이드. 짝수 턴은 물리, 홀수 턴은 마법 방어가 50% 오른다.' },
    ares: { stats: { hp: 3100, atk: 115, matk: 115, def: 70, mdef: 70 }, note: '3턴·8턴에 힘을 모았다가 다음 턴에 위력 4배의 일격.' },
    iris_love: { stats: { hp: 3000, atk: 80, matk: 135, def: 60, mdef: 90 }, note: '7턴째 소울드레인: 앞에 선 동료의 MP를 모두 빼앗는다. 그 전에 큰 기술을 써 둔다.' },
    iris_curse: { stats: { hp: 2800, atk: 125, matk: 100, def: 80, mdef: 60 }, note: '10턴째 아포칼립스(물리 5배). 그 턴에 앞에 설 동료를 정해 둔다.' },
    pharaoh: { stats: { hp: 2900, atk: 110, matk: 110, def: 75, mdef: 75 }, note: '5턴마다 고대의저주: 그 턴에 맞았다면 3배로 되갚는다. 저주 턴에는 때리지 말고 막는다.' },
    gray: { stats: { hp: 2600, atk: 115, matk: 115, def: 60, mdef: 60 }, note: '4턴마다 위력 2~4배의 절단(무작위). 14턴째 디멘션제로.' },
    thor: { stats: { hp: 3000, atk: 120, matk: 100, def: 85, mdef: 55 }, note: '10턴째 썬더러쉬 뒤 물리·마법 공격력이 뒤바뀐다. 물리 방어가 높고 마법 방어가 낮다.' },
    flora: { stats: { hp: 2800, atk: 100, matk: 120, def: 70, mdef: 70 }, note: '5턴·10턴에 제네시스블룸: 디버프를 지우고 그 턴 받는 피해가 절반이 된다. 그 턴에는 큰 기술을 아낀다.' },
    poseidon: { stats: { hp: 3000, atk: 115, matk: 105, def: 70, mdef: 85 }, note: '10턴째 어비스프레셔(마법 3배). 15턴째 하늘의 필드 버프 하나를 지운다.' },
    creator_god: { stats: { hp: 3200, atk: 120, matk: 135, def: 80, mdef: 80 }, note: '2턴째 저지먼트(마법 3.5배). 가끔 힘을 모았다가 다음 턴 디바인블레이드(물리 4배).' }
  };

  const power = s => (s.tier || 1) * 10 + (Number.isFinite(s.val) ? s.val : 2);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function create(core, assets) {
    const sp = assets.sp;
    const has = id => !!sp[id + '-idle'];
    const card = id => core.GameUtils.getCardById(id);
    const facing = id => (sp[id + '-idle'] && sp[id + '-idle'].facing) || (id === 'golem' || id === 'emerald_beetle' ? 'left' : 'right');
    const allies = core.GameUtils.getAllCards().filter(c => {
      const idle = sp[c.id + '-idle'];
      return !c.battleOnly && idle && idle.kind !== 'boss' && !WILD[c.id];
    }).map(c => c.id);
    const wild = Object.keys(WILD).filter(has);
    const bosses = Object.keys(BOSSES);

    /** Pools: `common` = every character with a sprite; `set:<id>` = a card-game themed base set. */
    function pool(name) {
      if (!name || name === 'common') return allies.slice();
      const m = /^set:(.+)$/.exec(name);
      if (m) {
        const set = core.BASIC_CARD_SETS.find(s => s.id === m[1]);
        if (set && set.cardsByGrade) return Object.values(set.cardsByGrade).flat().filter(id => allies.includes(id));
      }
      return allies.slice();
    }

    function wildOf(id, mul, extra) {
      const w = WILD[id], s = w.stats;
      return Object.assign({
        id: 'wild_' + id, sprite: id, look: 'base', kind: '야생', name: w.name, element: w.element, facing: facing(id), size: w.size,
        stats: { hp: Math.round(s.hp * mul), atk: Math.round(s.atk * mul), matk: Math.round(s.matk * mul), def: s.def, mdef: s.mdef },
        skills: [{ name: w.skill[0], type: w.skill[1], val: w.skill[2], rate: 0.3 }]
      }, extra || {});
    }
    /** Shadow = the nightmare copy of a character: its own stats, its signature attack in enemy form. */
    function shadowOf(id, mul, extra) {
      const c = card(id), s = c.stats;
      const sig = (c.skills || []).filter(k => k.type === 'phy' || k.type === 'mag').sort((x, y) => power(y) - power(x))[0];
      return Object.assign({
        id: 'shadow_' + id, sprite: id, look: 'shadow', kind: '그림자', name: '그림자 ' + c.name, element: c.element, facing: facing(id), source: id, grade: c.grade,
        stats: { hp: Math.round((300 + s.hp * 0.9) * mul), atk: Math.round(s.atk * 0.95 * mul), matk: Math.round(s.matk * 0.95 * mul), def: s.def, mdef: s.mdef },
        skills: sig ? [{ name: sig.name, type: sig.type, val: clamp(Number.isFinite(sig.val) ? sig.val : 2, 1.6, 2.4), rate: 0.3 }] : []
      }, extra || {});
    }
    function bossOf(id) {
      const base = core.ENEMIES.find(e => e.id === id), b = BOSSES[id];
      const sprite = has(id) ? id : 'golem';
      return {
        id, sprite, look: has(id) ? 'base' : 'boss', aura: 'boss', kind: '보스', name: base.name, element: base.element, facing: facing(sprite),
        stats: Object.assign({}, b.stats), skills: JSON.parse(JSON.stringify(base.skills)), note: b.note, boss: true
      };
    }
    return { allies, wild, bosses, has, card, facing, pool, wildOf, shadowOf, bossOf, LARGE: LARGE.filter(has) };
  }

  root.RelayRoster = { create, ELEMENT, GRADE, POSITION, WILD, BOSSES };
})(typeof window !== 'undefined' ? window : globalThis);
