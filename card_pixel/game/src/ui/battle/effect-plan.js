import { fieldInfo } from './fields.js';

const BOUNDARY = new Set([
  'act', 'turn', 'enemyTurn', 'await', 'stunned', 'heirloom', 'laststand',
  'relay', 'enter', 'retreat', 'enemyDown', 'enemyEnter', 'win', 'lose'
]);
const FIELD_CONSUMERS = new Set([
  'consume_field_all', 'consume_field_buff_dmg', 'remove_field_buff_dmg',
  'moon_to_sun', 'prism_shuffle_field', 'roulette_field'
]);

const same = (a, b) => a && b && a.side === b.side && a.idx === b.idx;
const place = (who, cast) => same(who, cast?.who) ? 'caster' :
  who.side === (cast?.who.side ?? 'ally') ? 'ally' : 'foe';

export function warningDue({ key, playedKey, fast, soundOn, immediate = false, intent, countdown }) {
  if (!soundOn || fast || key === playedKey) return false;
  return immediate || ['strong', 'boss'].includes(intent?.salience) || countdown?.inTurns === 1;
}

// Core skills report their cleanses as buff deltas. Prefer the detailed rule response when it exists.
export function actionCleanses(events, statusRules) {
  const { who, target, skill } = events[0];
  const effects = skill.effects ?? [];
  const targets = [];
  if (effects.includes('clear_self_debuffs')) targets.push(who);
  if (target && effects.some(effect => effect === 'clear_target_debuffs' || effect === 'wild_card_debuff') &&
      !targets.some(unit => same(unit, target))) targets.push(target);
  return targets.flatMap(unit => {
    if (events.some(e => e.t === 'rule' && e.rule === 'cleanse' && same(e.target ?? e.who, unit))) return [];
    const removed = events.filter(e => e.t === 'buff' && same(e.who, unit) && e.from > 0 && e.to === 0 && statusRules.isNegative(e.id));
    if (!removed.length) return [];
    const before = Object.fromEntries(removed.map(e => [e.id, e.from]));
    return [{ rule: 'cleanse', target: unit, before, after: {} }];
  });
}

export function actionEnd(events, start) {
  const turn = events[start].s.turn;
  let end = start + 1;
  while (end < events.length && !BOUNDARY.has(events[end].t) && events[end].s.turn === turn) end++;
  return end;
}

function scheduledTurns(cast, after) {
  if (!cast || cast.delayed || cast.who.side !== 'ally') return [];
  const matches = d => d.by === cast.who.idx && d.name === cast.skill.name;
  const before = cast.s.delayed.filter(matches).map(d => d.turn);
  const turns = [];
  for (const d of after.delayed.filter(matches)) {
    const index = before.indexOf(d.turn);
    if (index >= 0) before.splice(index, 1);
    else if (d.turn > cast.s.turn) turns.push(d.turn);
  }
  return turns.sort((a, b) => a - b);
}

// One cast's deltas, or a standalone buff/field change between casts.
// The next event's snapshot can be the first one to contain a new reservation.
export function planEffects(events, { core, artifacts, next } = {}) {
  if (!events.length) return [];
  const cast = events[0].t === 'act' ? events[0] : null;
  const turn = events[0].s.turn;
  const name = id => core.BUFF_NAMES[id] || id;
  const plan = [], buffs = new Map(), fields = [];
  for (const e of events) {
    if (e.t === 'hp' && e.delta !== 0) {
      const damage = e.delta < 0;
      const strike = !!(damage && cast && same(e.who, cast.target) && e.cause?.kind === 'act' &&
        same(e.cause.by, cast.who) && e.cause.skill === cast.skill.name && !!e.cause.delayed === !!cast.delayed);
      const label = (damage ? '' : '+') + e.amount.toLocaleString('en-US');
      plan.push({ at: place(e.who, cast), kind: damage ? 'damage' : 'heal', label, who: e.who, turn, strike, event: e });
    } else if (e.t === 'buff') {
      const key = e.who.side + '/' + e.who.idx + '/' + e.id;
      const from = buffs.get(key)?.from ?? e.from;
      buffs.set(key, { ...e, from });
    } else if (e.t === 'field') {
      fields.push(e);
    }
  }

  for (const { who, id, from, to } of buffs.values()) {
    if (to <= from) continue;
    let label = name(id) + (id === 'burn' || id === 'divine' ? ' ' + to : '');
    if (id === 'defProtocolPhy') label = '물리 방어 상승';
    if (id === 'defProtocolMag') label = '마법 방어 상승';
    plan.push({ at: place(who, cast), kind: 'buff', label, who, ids: [id], turn });
  }
  if (fields.length) {
    const last = fields.at(-1).list;
    const before = cast?.s.field ?? [];
    const added = [...new Set(fields.flatMap(e => e.add))].filter(id => last.includes(id) && !before.includes(id));
    const removed = [...new Set(fields.flatMap(e => e.remove))].filter(id => before.includes(id) && !last.includes(id));
    if (added.length) {
      let label = added.map(name).join(' · ');
      if (added.length === 1) {
        const line = fieldInfo(core, added[0], artifacts, true).split(' · ')[0];
        if (line) label += ' · ' + line.replace(/ \+\d+(?:\.\d+)?%p?/, ' 상승');
      }
      plan.push({ at: 'field', kind: 'field-add', label, ids: added, turn });
    }
    if (removed.length && cast?.skill.effects?.some(effect => FIELD_CONSUMERS.has(effect))) {
      const label = removed.map(id => name(id).replace(/의축복$/, '')).join('·') + ' 소모';
      plan.push({ at: 'field', kind: 'field-consume', label, ids: removed, turn });
    }
  }

  const turns = scheduledTurns(cast, next ?? events.at(-1).s);
  if (turns.length) {
    const offsets = [...new Set(turns)].map(due => due - turn);
    plan.push({ at: 'caster', kind: 'delay', label: offsets.join('·') + '턴 뒤', who: cast.who, turns, turn });
  }
  return plan;
}
