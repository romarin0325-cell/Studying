import { $, $$, esc } from '../dom.js';
import { BLOCKED_BY } from './hud.js';
import { TERMS } from '../glossary.js';

const number = value => value.toLocaleString('en-US');
const attackKey = (side, idx, name) => [side, idx, name].join(':');
const PREVIEW = {
  mana_drain: 'MP 소멸', cleanse: '정화', retaliation: '피격에 따른 반격', charge: '충전',
  defense_protocol: '방어 전환', alternating_defense: '교대 방어', lesson_guard: '피해 감소', swap_stats: '능력치 교환'
};
const RESPONSES = { ...BLOCKED_BY, enemy_down: '적 처치', no_hit: '피격 없음' };

function ruleResponse(event) {
  const { rule, before, after, preventedBy } = event;
  if (preventedBy) {
    const response = RESPONSES[preventedBy] ?? preventedBy;
    return response + (preventedBy === 'no_hit' ? ' · 발동 안 함' :
      ['magic_guard', 'barrier', 'evasion'].includes(preventedBy) ? '로 차단' : '로 중단');
  }
  if (rule === 'mana_drain' && Number.isFinite(before) && Number.isFinite(after)) return 'MP ' + before + ' → ' + after;
  if (Number.isFinite(before?.hp) && Number.isFinite(after?.hp)) return 'HP ' + before.hp + ' → ' + after.hp;
  if (rule === 'cleanse') return Object.keys(before ?? {}).length ? '약화 해제' : '해제할 약화 없음';
  if (rule === 'charge') return '충전 완료';
  return '발동';
}

export function battleLog(events, party, enemies) {
  const turns = new Map();
  const casts = new Map();
  const scheduled = new Map();
  const forecasts = new Map();
  let queue = new Map();
  let turn = 1;
  let serial = 0;
  let action;
  let source;

  function add(text, faces = [], kind = '') {
    const row = { key: ++serial, text, faces, kind };
    if (!turns.has(turn)) turns.set(turn, []);
    turns.get(turn).push(row);
    return row;
  }

  for (const event of events) {
    turn = event.t === 'turn' ? event.n : event.s?.turn ?? turn;
    function person(ref) {
      if (!ref) return null;
      const enemy = enemies[ref.idx];
      const state = ref.side === 'enemy' ? event.s?.enemy : event.s?.allies?.[ref.idx];
      return ref.side === 'enemy' ? { id: enemy?.sprite, name: state?.name ?? enemy?.name, side: 'enemy' }
        : { id: state?.form || party[ref.idx], name: state?.name, side: 'ally' };
    }

    const nextQueue = new Map();
    for (const { by, name, turn: due } of event.s?.delayed ?? []) {
      const castKey = attackKey('ally', by, name);
      const key = castKey + ':' + due;
      const count = (nextQueue.get(key) ?? 0) + 1;
      nextQueue.set(key, count);
      if (count <= (queue.get(key) ?? 0)) continue;
      const cast = casts.get(castKey);
      if (!cast) continue;
      cast.kind = 'reserve';
      if (!scheduled.has(key)) scheduled.set(key, []);
      scheduled.get(key).push(cast);
    }
    queue = nextQueue;

    switch (event.t) {
      case 'await': {
        const intent = event.intent;
        if (!intent?.rule || !intent.actionId || forecasts.has(intent.actionId)) break;
        const idx = event.s?.enemy?.idx ?? 0;
        const text = PREVIEW[intent.rule] ?? intent.name;
        const row = add(text + ' 예고', [person({ side: 'enemy', idx })], 'forecast');
        forecasts.set(intent.actionId, { row, text });
        break;
      }
      case 'rule': {
        if (!event.actionId) break;
        const forecast = forecasts.get(event.actionId);
        const text = forecast?.text ?? PREVIEW[event.rule] ?? event.actionId.split('/').at(-1);
        const updated = text + (forecast ? ' 예고 → ' : ' · ') + ruleResponse(event);
        if (forecast) {
          forecast.row.text = updated;
          const target = person(event.target);
          if (target?.id && target.id !== forecast.row.faces[0]?.id) forecast.row.faces.push(target);
        } else add(updated, [person(event.target)], 'forecast');
        break;
      }
      case 'act': {
        const { who, skill } = event;
        source = who;
        const key = attackKey(who.side, who.idx, skill.name);
        const origin = event.delayed ? scheduled.get(key + ':' + turn)?.shift() : null;
        const faces = [person(who)];
        if (event.heirFrom) faces.push({ id: event.heirFrom, side: 'ally' });
        action = add(skill.name, faces, origin ? 'trigger' : event.charge ? 'charge' : event.heirFrom ? 'heirloom-use' : '');
        if (origin) {
          action.origin = origin.key;
          (origin.hits ??= []).push({ key: action.key, turn });
        } else if (!event.delayed) casts.set(key, action);
        break;
      }
      case 'hp':
        if (event.delta < 0 && event.cause?.kind === 'act' && action?.text === event.cause.skill &&
          source?.side === event.cause.by?.side && source?.idx === event.cause.by?.idx) {
          action.amount = (action.amount ?? 0) + event.amount;
        } else if (event.delta) {
          add((event.delta > 0 ? '회복 +' : '피해 ') + number(event.amount), [person(event.who)]);
        }
        break;
      case 'down':
      case 'enemyDown': add('쓰러짐', [person(event.who)], 'down'); break;
      case 'retreat': add('후퇴 · 생환', [person(event.who)], 'retreat'); break;
      case 'heirloom': add(event.skill.name, [person(event.from), person(event.to)], 'heirloom'); break;
      case 'laststand': add('최후의 일인', [{ id: party[event.who.idx], side: 'ally' }], 'last-stand'); break;
      case 'log': {
        const actor = action?.faces[0];
        const duplicate = actor?.name && event.text?.startsWith(actor.name + '의 ' + action.text + '!');
        if (event.text && !duplicate && !/^(===|---|적에게 [\d,]+ 피해)| 준비\.\.\. \(| 발동!$/.test(event.text)) add(event.text);
        break;
      }
    }
  }
  return [...turns].map(([turn, rows]) => ({ turn, rows }));
}

export function appendSettlement(turns, { bet, lastBattleResult } = {}) {
  if (!bet && !lastBattleResult?.survivorIds.length) return turns;
  if (!turns.length) turns.push({ turn: 1, rows: [] });
  const rows = turns.at(-1).rows;
  let key = rows.at(-1)?.key ?? 0;
  if (lastBattleResult?.survivorIds.length) rows.push({
    key: ++key, text: '생환', kind: 'survivors', faces: lastBattleResult.survivorIds.map(id => ({ id, side: 'ally' }))
  });
  if (bet) rows.push({ key: ++key, text: bet.won ? '내기 성공' : '내기 실패', kind: 'wager' });
  return turns;
}

export function openBattleLog(sheets, widgets, turns = []) {
  if (!Array.isArray(turns)) turns = [];
  const names = people => people.filter(person => person?.id || person?.name).map(({ id, name, side }) => {
    const cardName = widgets.card(id)?.name;
    const ally = side ? side === 'ally' : !!cardName && (!name || name === cardName);
    const label = esc(name || cardName || id);
    return '<span class="log-name ' + (ally ? 'ally' : 'enemy') + '" aria-label="' + (ally ? '아군 ' : '적 ') +
      label + '">' + label + '</span>';
  }).join(' → ');
  const content = turns.map(({ turn, rows }, index) =>
    '<section class="battle-log-turn" tabindex="-1"' + (index === turns.length - 1 ? ' data-latest-turn' : '') +
    '><h4>' + turn + '턴</h4>' + rows.map(row => {
      const { key, kind, text, faces, amount, origin, hits } = row;
      const heading = kind.startsWith('heirloom') ? TERMS.heirloom.short + ' · ' + text : kind === 'reserve' ? turn + '턴 ' + text + ' 예약' :
        kind === 'trigger' ? turn + '턴 발동' : kind === 'charge' ? text + ' · 충전' : text;
      const jump = origin ? '<button class="log-jump" data-log-jump="' + origin + '">' + esc(text) + ' 예약 ↑</button>' :
        (hits ?? []).map(hit => '<button class="log-jump" data-log-jump="' + hit.key + '">' + hit.turn + '턴 발동 ↓</button>').join('');
      return '<div class="battle-log-row ' + kind + '" id="log-entry-' + key + '" tabindex="-1">' +
        (faces?.length ? '<div class="log-names">' + names(faces) + '</div>' : '') +
        '<p>' + esc(heading + (amount == null ? '' : ' · ' + number(amount))) + '</p>' + jump + '</div>';
    }).join('') + '</section>').join('');
  sheets.openSheet('전투 기록', content || '<p>기록 없음</p>', { variant: 'battle-log', latest: '[data-latest-turn]' });
  for (const button of $$('#sh-body [data-log-jump]')) button.addEventListener('click', () => {
    const row = $('#log-entry-' + button.dataset.logJump);
    row?.focus({ preventScroll: true });
    row?.scrollIntoView({ block: 'nearest' });
  });
}
