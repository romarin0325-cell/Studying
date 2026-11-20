import { $, $$, esc } from '../dom.js';

const number = value => value.toLocaleString('en-US');
const attackKey = (side, idx, name) => [side, idx, name].join(':');

export function battleLog(events, party, enemies) {
  const turns = new Map();
  const casts = new Map();
  const scheduled = new Map();
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
      return ref.side === 'enemy' ? { id: enemy?.sprite, name: state?.name ?? enemy?.name }
        : { id: state?.form || party[ref.idx], name: state?.name };
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
      case 'act': {
        const { who, skill } = event;
        source = who;
        const key = attackKey(who.side, who.idx, skill.name);
        const origin = event.delayed ? scheduled.get(key + ':' + turn)?.shift() : null;
        const faces = [person(who)];
        if (event.heirFrom) faces.push({ id: event.heirFrom });
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
      case 'retreat': add('물러남 · 생환', [person(event.who)], 'retreat'); break;
      case 'heirloom': add(event.skill.name, [person(event.from), person(event.to)], 'heirloom'); break;
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

export function openBattleLog(sheets, widgets, turns = []) {
  if (!Array.isArray(turns)) turns = [];
  const portraits = faces => faces.filter(face => face?.id).map(({ id, name }) => widgets.faceBadge(id, name)).join(' → ');
  const content = turns.map(({ turn, rows }, index) =>
    '<section class="battle-log-turn" tabindex="-1"' + (index === turns.length - 1 ? ' data-latest-turn' : '') +
    '><h4>' + turn + '턴</h4>' + rows.map(row => {
      const { key, kind, text, faces, amount, origin, hits } = row;
      const heading = kind.startsWith('heirloom') ? '유품 · ' + text : kind === 'reserve' ? turn + '턴 ' + text + ' 예약' :
        kind === 'trigger' ? turn + '턴 발동' : kind === 'charge' ? text + ' · 차징' : text;
      const jump = origin ? '<button class="log-jump" data-log-jump="' + origin + '">' + esc(text) + ' 예약 ↑</button>' :
        (hits ?? []).map(hit => '<button class="log-jump" data-log-jump="' + hit.key + '">' + hit.turn + '턴 발동 ↓</button>').join('');
      return '<div class="battle-log-row ' + kind + '" id="log-entry-' + key + '" tabindex="-1">' +
        (faces?.length ? '<div class="log-faces">' + portraits(faces) + '</div>' : '') +
        '<p>' + esc(heading + (amount == null ? '' : ' · ' + number(amount))) + '</p>' + jump + '</div>';
    }).join('') + '</section>').join('');
  sheets.openSheet('전투 기록', content || '<p>기록 없음</p>', { variant: 'battle-log', latest: '[data-latest-turn]' });
  for (const button of $$('#sh-body [data-log-jump]')) button.addEventListener('click', () => {
    const row = $('#log-entry-' + button.dataset.logJump);
    row?.focus({ preventScroll: true });
    row?.scrollIntoView({ block: 'nearest' });
  });
}
