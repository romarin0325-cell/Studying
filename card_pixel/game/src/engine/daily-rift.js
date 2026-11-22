import { AFFIXES, EVENTS as EVENT_IDS, QUIRKS, REGIONS, RULE_VERSION, SCALE, SKY } from '../content/daily-rift.js';
import { DUNGEONS } from '../content/dungeons.js';
import { EVENTS } from '../content/events.js';
import { ROOM_NAMES } from '../content/layouts.js';
import { RELICS } from '../content/relics.js';
import { heirloomSkill } from './bridge.js';
import { localDayKey } from './dates.js';
import { hasCleared } from './entry.js';
import { nextFloat, pick, shuffle } from './rng.js';

const MS_PER_DAY = 86_400_000;
const BATTLE_FLOORS = [1, 4, 6, 7];
const LOAN_GRADES = ['normal', 'rare', 'legend', 'rare', 'epic'];
const RISKS = [...QUIRKS, ...AFFIXES];
const eventFor = id => EVENTS.find(event => event.id === id);
const stream = (seed, k) => ({ state: (seed ^ Math.imul(k, 0x9e3779b9)) >>> 0 });
const sameList = (a, b) => a.length === b.length && b.every((value, i) => value === a[i]);

export { localDayKey as dayKey };

export function riftPuzzlesUnlocked(profile) {
  return !!profile?.records?.clears && hasCleared(profile, 'creation_tower');
}

export function puzzleGoalMet(goal, score) {
  return score.outcome === 'win'
    && score.livingIds.length >= (goal.survivors ?? 0)
    && score.turns <= (goal.maxTurns ?? Infinity)
    && score.heirloomsUsed >= (goal.heirloomUses ?? 0);
}

function dateIndex(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return NaN;
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.toISOString().slice(0, 10) === key ? date.getTime() / MS_PER_DAY : NaN;
}

const seedFor = key => Number(key.replaceAll('-', ''));
const regionFor = d => REGIONS[((d % REGIONS.length) + REGIONS.length) % REGIONS.length];

function favorsAttack(card, type) {
  const { atk, matk } = card.stats;
  return type === 'phy' ? atk >= matk : matk >= atk;
}

function pickLoans(roster, common, visitor, rng) {
  const candidates = common.filter(id => id !== visitor).map(id => roster.card(id))
    .map(card => ({ card, type: heirloomSkill(card)?.type })).filter(entry => entry.type);
  const selected = [];
  function draw(grade, matches = () => true) {
    const choice = pick(rng, candidates.filter(entry => entry.card.grade === grade && !selected.includes(entry) && matches(entry)));
    if (!choice) throw new RangeError('invalid_daily_options');
    selected.push(choice);
    return choice;
  }
  const first = draw('normal');
  draw('rare', ({ card, type }) => type === first.type && favorsAttack(card, type));
  draw('legend');
  const reserve = draw('rare', ({ type }) => type !== first.type);
  draw('epic', ({ card, type }) => type === reserve.type && favorsAttack(card, type));
  return selected.map(({ card }) => card.id);
}

function relicPool(cards) {
  const relics = ['double_attack', 'gale_storm', 'lucky_vicky', 'big_bang'];
  if (cards.some(card => card.skills.some(skill => skill.type === 'sup' && skill.cost > 0))) relics.push('support_boost');
  if (cards.some(card => card.element === 'water')) relics.push('frozen_body');
  if (cards.some(card => card.element === 'nature')) relics.push('reverse');
  return relics;
}

export function specFor(key, roster, ruleVersion = RULE_VERSION) {
  const day = dateIndex(key);
  if (!Number.isInteger(day) || ruleVersion !== RULE_VERSION) throw new RangeError('invalid_daily_options');
  const seed = seedFor(key);
  const dungeonId = regionFor(day);
  const dungeon = DUNGEONS[dungeonId];
  const eventId = pick(stream(seed, 3), EVENT_IDS);
  const visitor = eventFor(eventId).requires.present[0];
  const common = roster.pool('common').sort();
  const loanIds = pickLoans(roster, common, visitor, stream(seed, 1));
  const relicIds = shuffle(stream(seed, 2), relicPool(loanIds.map(roster.card))).slice(0, 4);

  const regional = roster.pool(dungeon.pool).sort();
  const gateRng = stream(seed, 4);
  const gateIds = ['rare', 'epic'].map(grade => {
    const allowed = id => id !== visitor && !loanIds.includes(id) && roster.card(id).grade === grade;
    const local = regional.filter(allowed);
    return pick(gateRng, local.length ? local : common.filter(allowed));
  });
  const wildRng = stream(seed, 5);
  const wildCount = dungeonId === 'ember_volcano' ? 2 : 1;
  const wildIds = Object.fromEntries([1, 6].map(floor => [floor,
    Array.from({ length: wildCount }, () => pick(wildRng, dungeon.wild))
  ]));
  const skyRng = stream(seed, 7);
  const sky = Object.fromEntries(BATTLE_FLOORS.map(floor => [floor,
    dungeonId !== 'starlit_garden' ? null : nextFloat(skyRng) < 0.5 ? SKY.slice() : []
  ]));
  return {
    ruleVersion, dayKey: key, seed, dungeonId, bossId: dungeon.boss, loanIds, gateIds, wildIds, relicIds,
    eventId, riskId: pick(stream(seed, 6), RISKS), sky, altarSeed: stream(seed, 8).state
  };
}

// Validate a pinned spec without re-drawing it from today's roster order.
export function validAttempt(daily, roster) {
  const { spec, kind, attemptNo } = daily || {};
  if (!spec || !Number.isSafeInteger(attemptNo)
    || (kind === 'official' ? attemptNo !== 1 : kind !== 'practice' || attemptNo < 2)) return false;
  const day = dateIndex(spec.dayKey);
  const dungeon = DUNGEONS[spec.dungeonId];
  if (spec.ruleVersion !== RULE_VERSION || !Number.isInteger(day) || spec.dungeonId !== regionFor(day)
    || spec.seed !== seedFor(spec.dayKey) || spec.bossId !== dungeon.boss || spec.altarSeed !== stream(spec.seed, 8).state
    || !EVENT_IDS.includes(spec.eventId) || !RISKS.includes(spec.riskId)) return false;

  const visitor = eventFor(spec.eventId).requires.present[0];
  const { loanIds, gateIds, relicIds, sky, wildIds } = spec;
  const validIds = (ids, count, allowed) => Array.isArray(ids) && ids.length === count
    && new Set(ids).size === count && Array.from(ids).every(allowed);
  const available = id => id !== visitor && roster.allies.includes(id);
  if (!validIds(loanIds, 5, available) || !validIds(gateIds, 2, id => available(id) && !loanIds.includes(id))
    || !validIds(relicIds, 4, id => Object.hasOwn(RELICS, id))) return false;
  const cards = loanIds.map(roster.card);
  if (!sameList(cards.map(card => card.grade), LOAN_GRADES)
    || !sameList(gateIds.map(id => roster.card(id).grade), ['rare', 'epic'])) return false;
  const types = cards.map(card => heirloomSkill(card)?.type);
  if (!types.every(Boolean) || types[0] !== types[1] || types[0] === types[3] || types[3] !== types[4]
    || !favorsAttack(cards[1], types[1]) || !favorsAttack(cards[4], types[4])) return false;
  const wildCount = spec.dungeonId === 'ember_volcano' ? 2 : 1;
  return [1, 6].every(floor => Array.isArray(wildIds?.[floor]) && wildIds[floor].length === wildCount
    && Array.from(wildIds[floor]).every(id => dungeon.wild.includes(id)))
    && BATTLE_FLOORS.every(floor => spec.dungeonId === 'starlit_garden'
      ? Array.isArray(sky?.[floor]) && (!sky[floor].length || sameList(sky[floor], SKY))
      : sky?.[floor] === null);
}

export function doorsFor(spec, floor, roster) {
  const dungeon = DUNGEONS[spec.dungeonId];
  const doors = [];
  function add(type, details = {}) {
    doors.push({
      type, index: doors.length, name: ROOM_NAMES[type], bg: dungeon.background,
      region: structuredClone(dungeon.region), enemies: [], quirk: null, start: null, relic: null, ...details
    });
  }
  const [a, b, c, d] = spec.relicIds;
  const tier = SCALE[floor];
  const start = spec.sky[floor] ? { field: spec.sky[floor].slice() } : null;
  if (floor === 1 || floor === 6) {
    const multiplier = tier * (spec.dungeonId === 'ember_volcano' ? 0.65 : 1);
    const enemies = spec.wildIds[floor].map(id => roster.wildOf(id, multiplier));
    add('wild', { enemies, start });
    if (floor === 6) {
      const riskEnemies = structuredClone(enemies);
      const quirk = QUIRKS.includes(spec.riskId) ? spec.riskId : null;
      if (!quirk) riskEnemies[0].affixes = [spec.riskId];
      add('elite', { name: '위험한 문', risk: true, enemies: riskEnemies, quirk, start: structuredClone(start), relic: d });
    }
  } else if (floor === 2) {
    add('treasure', { relic: a });
    add('treasure', { relic: b });
  } else if (floor === 3) {
    const event = structuredClone(eventFor(spec.eventId));
    add('event', { event, name: event.name });
  } else if (floor === 4) {
    add('gate', { enemies: spec.gateIds.map(id => roster.shadowOf(id, tier)), start });
  } else if (floor === 5) {
    add('treasure', { relic: c });
    add('altar');
  } else if (floor === 7) {
    add('boss', { enemies: [roster.bossOf(spec.bossId, tier)], start });
  }
  return doors;
}

export function compare(a, b) {
  const rank = { abandon: 0, lose: 1, win: 2 };
  if (a.outcome !== b.outcome) return Math.sign(rank[a.outcome] - rank[b.outcome]);
  if (a.outcome === 'win') {
    return Math.sign(a.livingIds.length - b.livingIds.length) || Math.sign(b.turns - a.turns);
  }
  return a.outcome === 'lose' ? Math.sign(a.floor - b.floor) : 0;
}
