/* RelayRoster: the shared structure every dungeon will use.
   - which characters exist (card data) and which of them have battle sprites,
   - pools: the common pool now, one pool per dungeon later (the card game's themed base sets),
   - enemy builders in the card game's enemy format: wild creatures, shadows of characters, bosses.
   Nothing here decides a run; run.js does. */
import { WILD, LARGE } from '../content/wild.js';
import { BOSSES } from '../content/bosses.js';

export const ELEMENT = { fire: '불', water: '물', nature: '자연', light: '빛', dark: '어둠' };
export const GRADE = { normal: '노멀', rare: '레어', epic: '에픽', legend: '전설', transcendence: '초월', event: '이벤트' };
export const POSITION = ['선봉', '중견', '대장'];

const power = s => (s.tier || 1) * 10 + (Number.isFinite(s.val) ? s.val : 2);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function create(core, assets) {
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
