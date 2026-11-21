/* RelayRoster: the shared structure every dungeon will use.
   - which characters exist (card data) and which of them have battle sprites,
   - pools: the card game's themed base sets and explicit dungeon rosters,
   - enemy builders in the card game's enemy format: wild creatures, shadows of characters, bosses.
   Nothing here decides a run; run.js does. */
import { WILD, LARGE } from '../content/wild.js';
import { BOSSES } from '../content/bosses.js';
import { DUNGEONS } from '../content/dungeons.js';

export const ELEMENT = { fire: '불', water: '물', nature: '자연', light: '빛', dark: '어둠' };
export const GRADE = { normal: '노멀', rare: '레어', epic: '에픽', legend: '전설', transcendence: '초월', event: '이벤트' };
export const POSITION = ['선봉', '중견', '대장'];
export const GRADE_BUCKETS = ['normal', 'rare', 'epic', 'legend'];
export const gradeOf = grade => GRADE_BUCKETS.includes(grade) ? grade : 'legend';

const gradeRank = { normal: 0, rare: 1, epic: 2, legend: 3, transcendence: 3, event: 2 };

export function strength(card) {
  const { hp, atk, matk } = card.stats;
  return hp / 4 + Math.max(atk, matk) + gradeRank[card.grade] * 30;
}

const power = s => (s.tier || 1) * 10 + (Number.isFinite(s.val) ? s.val : 2);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function expeditionPool(roster, dungeonId, startView = {}) {
  if (!Object.hasOwn(DUNGEONS, dungeonId)) throw new RangeError('Unknown dungeon: ' + dungeonId);
  const dungeon = DUNGEONS[dungeonId];
  const { seals = [], companions = [], lead, reserved } = startView;
  const additions = dungeon.layout === 'intro' ? [reserved] : [...companions, lead, reserved];
  const baseIds = roster.pool(dungeon.pool);
  const availableIds = roster.pool(dungeon.pool, { companions: additions });
  const effectiveIds = roster.pool(dungeon.pool, { companions: additions, seals });
  return {
    setName: roster.poolName(dungeon.pool),
    baseIds,
    addedIds: effectiveIds.filter(id => !baseIds.includes(id)),
    sealedIds: availableIds.filter(id => seals.includes(id)),
    effectiveIds
  };
}

export function create(core, assets) {
  const sp = assets.sp;
  const has = id => !!sp[id + '-idle'];
  const card = id => core.GameUtils.getCardById(id);
  const facing = id => (sp[id + '-idle'] && sp[id + '-idle'].facing) || (id === 'golem' || id === 'emerald_beetle' ? 'left' : 'right');
  const allies = core.GameUtils.getAllCards().filter(c => {
    const idle = sp[c.id + '-idle'];
    return !c.battleOnly && idle && (!idle.kind ? !WILD[c.id] : idle.kind === 'ally');
  }).map(c => c.id);
  const spriteFor = (role, id) => has(role + '_' + id) ? role + '_' + id : id;
  const wild = Object.keys(WILD).filter(id => has(spriteFor('wild', id)));
  const bosses = Object.keys(BOSSES);
  const poolName = spec => spec.name ?? core.BASIC_CARD_SETS.find(entry => entry.id === spec.set)?.name;

  function pool(spec = 'common', { seals = [], companions = [] } = {}) {
    if (typeof spec === 'string') {
      spec = spec.startsWith('set:') ? { set: spec.slice(4) } : { all: spec === 'common' };
    }
    const set = core.BASIC_CARD_SETS.find(entry => entry.id === spec.set);
    const ids = spec.all ? allies : spec.ids || Object.values(set?.cardsByGrade || {}).flat();
    const candidates = ids.filter(id => allies.includes(id));
    const fallback = (spec.spriteFallback || []).filter(id => allies.includes(id) && !candidates.includes(id));
    const missingGrades = GRADE_BUCKETS.filter(grade => !candidates.some(id => gradeOf(card(id).grade) === grade));
    for (const grade of missingGrades) {
      const match = fallback.find(id => gradeOf(card(id).grade) === grade);
      if (match) candidates.push(match);
    }
    for (const id of fallback) {
      if (candidates.length >= 12) break;
      if (!candidates.includes(id)) candidates.push(id);
    }
    return [...new Set([...candidates, ...companions])].filter(id => allies.includes(id) && !seals.includes(id));
  }

  function wildOf(id, mul = 1, extra) {
    const w = WILD[id], s = w.stats;
    const sprite = spriteFor('wild', id);
    return Object.assign({
      id: 'wild_' + id, sprite, look: 'base', kind: '야생', name: w.name, element: w.element, facing: facing(sprite), size: w.size,
      stats: { hp: Math.round(s.hp * mul), atk: Math.round(s.atk * mul), matk: Math.round(s.matk * mul), def: s.def, mdef: s.mdef },
      skills: [{ name: w.skill[0], type: w.skill[1], val: w.skill[2], rate: 0.3 }]
    }, extra || {});
  }
  /** Shadow = the nightmare copy of a character: its own stats, its signature attack in enemy form. */
  function shadowOf(id, mul = 1, extra) {
    const c = card(id), s = c.stats;
    const sig = (c.skills || []).filter(k => k.type === 'phy' || k.type === 'mag').sort((x, y) => power(y) - power(x))[0];
    return Object.assign({
      id: 'shadow_' + id, sprite: id, look: 'shadow', kind: '그림자', name: '그림자 ' + c.name, element: c.element, facing: facing(id), source: id, grade: c.grade,
      stats: { hp: Math.round((300 + s.hp * 0.9) * mul), atk: Math.round(s.atk * 0.95 * mul), matk: Math.round(s.matk * 0.95 * mul), def: s.def, mdef: s.mdef },
      skills: sig ? [{ name: sig.name, type: sig.type, val: clamp(Number.isFinite(sig.val) ? sig.val : 2, 1.6, 2.4), rate: 0.3 }] : []
    }, extra || {});
  }
  function bossOf(id, mul = 1) {
    const base = core.ENEMIES.find(e => e.id === id), b = BOSSES[id];
    const preferred = spriteFor('boss', id);
    const sprite = has(preferred) ? preferred : spriteFor('wild', 'golem');
    return {
      id, sprite, look: has(preferred) ? 'base' : 'boss', aura: 'boss', kind: '보스', name: base.name, element: base.element, facing: facing(sprite),
      stats: Object.fromEntries(Object.entries(b.stats).map(([key, value]) => [key, Math.round(value * mul)])),
      skills: JSON.parse(JSON.stringify(base.skills)), note: b.note, boss: true
    };
  }
  return { allies, wild, bosses, has, card, facing, pool, poolName, wildOf, shadowOf, bossOf, LARGE: LARGE.filter(id => wild.includes(id)) };
}
