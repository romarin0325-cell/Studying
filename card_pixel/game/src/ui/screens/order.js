import { $, $$, esc, show } from '../dom.js';
import { blessingText, head, foeFlip, TYPE } from '../widgets.js';
import { POSITION } from '../../engine/roster.js';
import { HEIRLOOM_POWER, heirloomPreview } from '../../engine/bridge.js';
import * as Run from '../../engine/run.js';
import { QUIRKS } from '../../content/quirks.js';
import { AFFIXES } from '../../content/affixes.js';

export function formationMoves(party, target, name) {
  const seats = party.slice();
  const moves = [];
  for (const [i, id] of target.entries()) {
    if (id === seats[i] || !id) continue;
    const j = seats.indexOf(id);
    if (j >= 0) {
      moves.push(seats[i]
        ? POSITION[i] + ' ' + name(seats[i]) + ' ↔ ' + POSITION[j] + ' ' + name(id)
        : POSITION[j] + ' ' + name(id) + ' → ' + POSITION[i]);
      [seats[i], seats[j]] = [seats[j], seats[i]];
    }
  }
  for (const [i, id] of target.entries()) {
    if (id && id !== seats[i]) moves.push('대기 ' + name(id) + ' 투입');
  }
  return moves;
}

export function mountFormation(node, run, ui, { party: initial, door, onChange, onEnter, entryLabel } = {}) {
  const { core, widgets, audio, sheets } = ui;
  const { card, spr, sprite, faceBadge } = widgets;
  const { sfx } = audio;
  const seats = ids => POSITION.map((_, i) => ids?.[i] ?? null);
  let party = seats(initial ?? Run.defaultParty(run));
  const all = core.GameUtils.getAllCards();
  const name = id => card(id)?.name || id;
  let selected = null;
  let beforeHint = null;
  const blessingViews = new Map();

  function view(id) {
    if (!id || !door) return;
    if (!blessingViews.has(id)) blessingViews.set(id, Run.getBlessingView?.(run, door.index, party, id));
    return blessingViews.get(id);
  }

  function orderHint(alternateSeats) {
    if (beforeHint) return '<button class="btn relay-undo" id="b-alternate-order">되돌리기</button>';
    if (!alternateSeats) return '';
    const moves = formationMoves(party, alternateSeats, name);
    if (!moves.length) return '';
    const priority = moves.findIndex(move => move.startsWith('대기 '));
    if (priority > 0) moves.unshift(moves.splice(priority, 1)[0]);
    return '<button class="btn relay-alternative" id="b-alternate-order">' +
      moves.map((move, i) => '<b>' + esc((i === 0 ? '기초 전력 제안 · ' : '') + move) + '</b>').join('') + '</button>';
  }

  function traitLine(fighter, index) {
    const trait = fighter?.trait;
    if (!trait) return '';
    if (trait.type === 'pos_stat_boost') {
      return trait.pos === index ? '자리 효과 발동' : POSITION[trait.pos] + ' 전용';
    }
    if (/^syn_/.test(trait.type)) {
      return core.Logic.calculateInitialStats(fighter, party, all, index).activeTrait ? '시너지 발동' : '시너지 조건 부족';
    }
    return trait.desc;
  }

  function select(choice) {
    sfx.tap();
    if (!selected || selected.bench && choice.bench || selected.slot === choice.slot) {
      selected = selected?.slot === choice.slot && selected?.bench === choice.bench ? null : choice;
    } else {
      const slot = choice.slot ?? selected.slot;
      const bench = choice.bench ?? selected.bench;
      if (bench) party[slot] = bench;
      else [party[selected.slot], party[slot]] = [party[slot], party[selected.slot]];
      selected = null;
      blessingViews.clear();
      onChange?.(party);
    }
    render();
  }

  function render() {
    const tempo = door && Run.getTempoView?.(run, door.index);
    const alternative = door?.type === 'boss' && run.guide?.bossOrder
      ? tempo?.suggestedParty ?? Run.suggestOrder(run) : null;
    const alternateSeats = alternative?.some(Boolean) ? seats(alternative) : null;
    const blessing = tempo?.blessing ?? door?.tempo?.blessing;
    const blessingLine = id => {
      if (!id || id !== blessing?.id && !run.blessings?.[id]) return '';
      const info = view(id);
      return info && (info.expeditionBonus || info.battleBonus) ? '<small class="seat-blessing">' + esc(blessingText(info)) + '</small>' : '';
    };
    const previews = heirloomPreview(core, party);
    const slots = party.map((id, i) => {
      const fighter = id && card(id);
      const trait = traitLine(fighter, i);
      const active = selected?.slot === i;
      const art = id ? sprite(id, { flip: spr(id)?.facing === 'left' }) : '';
      return '<button class="relay-seat win' + (active ? ' sel' : '') + '" data-slot="' + i + '" aria-pressed="' + active + '">' +
        '<small>' + POSITION[i] + '</small><span class="relay-seat-art">' + art + '</span>' +
        '<b>' + esc(fighter?.name || '빈 자리') + '</b><small class="relay-trait" title="' + esc(trait) + '">' +
        esc(trait) + '</small>' + blessingLine(id) + '</button>';
    });
    const links = previews.slice(0, 2).map((entry, i) =>
      '<button class="relay-link" data-link="' + i + '" aria-label="' + POSITION[i] + ' 유품 흐름"' +
      (entry.skill ? '' : ' disabled') + '>→</button>');
    const board = slots.map((slot, i) => slot + (links[i] ?? '')).join('');
    const bench = run.bench.filter(id => !party.includes(id));
    const qualifies = !run.daily && ['gate', 'boss'].includes(door?.type);
    const returning = qualifies ? party.filter(id => id && run.recruited?.includes(id)) : [];
    const recruits = qualifies ? party.filter(id => id && !returning.includes(id)) : [];
    const survival = [
      recruits.length && (returning.length ? recruits.map(name).join(' · ') + ' · ' : '') + '생환 시 영입 후보',
      returning.length && returning.map(name).join(' · ') + ' · 생환 시 인연'
    ].filter(Boolean).map(line => '<small class="recruit-flag">' + esc(line) + '</small>').join('');
    const boost = !Run.getBlessingView && blessing?.id
      ? '<div class="relay-blessing win">' + faceBadge(blessing.id) + '<span>이번 전투 축복</span></div>' : '';
    const focused = selected?.bench ?? party[selected?.slot];
    const action = entryLabel ?? (door?.final && run.stats.retries ? '편성을 바꿔 재도전' : '출전 (' + party.filter(Boolean).length + '명)');
    node.innerHTML =
      boost + '<div class="relay-seats">' + board + '</div>' +
      (survival ? '<div class="relay-survival">' + survival + '</div>' : '') + orderHint(alternateSeats) +
      '<h3>대기 동료</h3><div class="reserve-cards">' + (bench.map(id => '<button class="win' +
        (selected?.bench === id ? ' sel' : '') + '" data-bench="' + esc(id) + '" aria-pressed="' + (selected?.bench === id) +
        '">' + faceBadge(id, name(id), 48) + blessingLine(id) + '</button>').join('') || '<p class="sm">없음</p>') +
      '</div>' + (onEnter ? '<div class="formation-actions">' +
        (focused ? '<button class="btn" id="b-formation-info">동료 정보</button>' : '') +
        '<button class="btn go" id="b-go"' + (party.some(Boolean) ? '' : ' disabled') + '>' + action + '</button></div>' : '');
    $('#b-alternate-order', node)?.addEventListener('click', () => {
      if (beforeHint) {
        party = beforeHint;
        beforeHint = null;
      } else {
        beforeHint = party.slice();
        party = alternateSeats.slice();
      }
      selected = null;
      sfx.tap();
      blessingViews.clear();
      onChange?.(party);
      render();
    });
    for (const button of $$('[data-slot]', node)) button.addEventListener('click', () => select({ slot: Number(button.dataset.slot) }));
    for (const button of $$('[data-bench]', node)) button.addEventListener('click', () => select({ bench: button.dataset.bench }));
    for (const button of $$('[data-link]', node)) button.addEventListener('click', () => {
      const { from, to, skill } = previews[Number(button.dataset.link)];
      const replaced = run.heirlooms?.[to]?.name;
      sfx.tap();
      sheets.openSheet('쓰러지면 유품 계승', '<div class="relay-flow">' + faceBadge(from) + ' → ' +
        faceBadge(to) + '</div><p>' + esc(skill.name) + ' · 위력 ×' + HEIRLOOM_POWER + ' · MP 0</p>' +
        (replaced ? '<p>' + esc(replaced) + ' 유품 교체</p>' : ''));
    });
    $('#b-formation-info', node)?.addEventListener('click', () => ui.companion?.(focused, view(focused)));
    $('#b-go', node)?.addEventListener('click', () => {
      audio.unlockAudio();
      sfx.tap();
      onEnter(party);
    });
  }
  render();
  return {
    selectDoor(next) { door = next; selected = beforeHint = null; blessingViews.clear(); render(); },
    blessingView: view
  };
}

export function orderScreen(run, ui) {
  ui.playMusic();
  const { face, sprite } = ui.widgets;
  const node = $('#order');
  const room = run.room;
  const tempo = Run.getTempoView?.(run, room.index);
  const quirk = QUIRKS[room.quirk];
  const hazards = [quirk?.name, ...new Set(room.enemies.flatMap(enemy => (enemy.affixes || []).map(id => AFFIXES[id]?.name)))].filter(Boolean);
  node.innerHTML = head(run, '출전 순서', run.floor + '층') + '<div class="scroll">' +
    '<button class="win run-opponents" id="b-opponents"><span>' +
    room.enemies.map(enemy => '<span class="run-face">' + face(enemy.sprite, 32) + '</span>').join('') + '</span><span><b>' +
    esc(room.enemies.map(enemy => enemy.name).join(' → ')) + '</b><small>' +
    esc((room.enemies.length > 1 ? room.enemies.length + '연전 · ' : '') + room.name +
      (hazards.length ? ' · ' + hazards.join(' · ') : '')) + '</small></span></button><div class="formation"></div></div>';
  show('order');
  mountFormation($('.formation', node), run, ui, {
    party: room.party ?? tempo?.party, door: room,
    onEnter: party => { if (ui.command(Run.confirmOrder, party).ok) ui.route(); }
  });
  $('#b-opponents', node).addEventListener('click', () => {
      ui.sheets.openSheet(room.name, room.enemies.map((enemy, index) => '<div class="run-foe-detail">' +
        sprite(enemy.sprite, { flip: foeFlip(enemy), cls: enemy.look === 'shadow' ? 'shadow-tint' : '' }) +
        '<div><h4>' + esc(enemy.name) + '</h4>' +
        (enemy.note ? '<p>' + esc(enemy.note) + '</p>' : '') +
        (enemy.affixes || []).map(id => '<p>' + esc(AFFIXES[id]?.desc || '') + '</p>').join('') +
        (tempo?.enemies?.[index]?.beats ?? []).map(beat =>
          '<p>' + esc(beat.turn + '박 · ' + beat.name + ' · ' + (TYPE[beat.type] || '')) + '</p>').join('') +
        '</div></div>').join('') + (quirk ? '<p>' + esc(quirk.name + ' · ' + quirk.desc) + '</p>' : ''));
  });
}
