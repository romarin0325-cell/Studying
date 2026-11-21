import { $, $$, esc, show } from '../dom.js';
import { blessingText, enemyActionText, head, foeFlip, repeatBadge, tempoBeatText, traitText } from '../widgets.js';
import { ELEMENT, POSITION } from '../../engine/roster.js';
import { heirloomPreview } from '../../engine/bridge.js';
import * as Run from '../../engine/run.js';
import { QUIRKS } from '../../content/quirks.js';
import { AFFIXES } from '../../content/affixes.js';
import { DUNGEONS } from '../../content/dungeons.js';
import { TERMS } from '../glossary.js';

const STAT = { atk: '공격', matk: '마공', def: '방어', mdef: '마방' };

function traitCondition(trait, name) {
  const [, first, second] = trait.type.split('_');
  if (ELEMENT[first] && ELEMENT[second]) return ELEMENT[first] + '·' + ELEMENT[second] + ' 동료';
  if (ELEMENT[first] && /^[23]$/.test(second)) return ELEMENT[first] + ' 동료 ' + second + '명';
  if (trait.type === 'syn_dark_full_party_crit') return '어둠 동료 3명';
  if (trait.type === 'syn_christmas_rabbit_trio_gift') return '눈토끼·밤토끼 동료';
  const rabbit = trait.type.match(/^syn_(?:rabbit_valentine_)?(night|snow|silver)(?:_rabbit)?$/)?.[1];
  return rabbit ? ['snow', 'night', 'silver'].filter(id => id !== rabbit).map(id => name(id + '_rabbit')).join(' 또는 ') : '';
}

export function orderScreen(run, ui, { draft, onBack, onEnter } = {}) {
  ui.playMusic();
  const { core, widgets, audio, sheets } = ui;
  const { card, spr, sprite, faceBadge } = widgets;
  const node = $('#order');
  const door = draft ? run.doors[draft.doorIndex] : run.room;
  const tempo = Run.getTempoView(run, door.index);
  const all = core.GameUtils.getAllCards();
  const name = id => card(id)?.name || id;
  const party = POSITION.map((_, i) => (draft?.partyIds ?? door.party ?? tempo.party)[i] ?? null);
  if (draft) draft.partyIds = party;
  let selected = null;
  let entered = false;

  function blessingView(id) {
    return Run.getBlessingView(run, door.index, party, id);
  }

  function blessingLine(id) {
    if (!id || id !== tempo.blessing?.id && !run.blessings?.[id]) return '';
    return '<small class="seat-blessing">' + esc(blessingText(blessingView(id))) + '</small>';
  }

  function traitLine(fighter, index) {
    const trait = fighter?.trait;
    if (!trait) return '';
    if (trait.type === 'pos_stat_boost') {
      const stat = [trait.stat].flat().map(id => STAT[id]).join('·');
      return POSITION[trait.pos] + '에서 ' + stat + ' +' + trait.val + '%' + (trait.pos === index ? '' : ' · 미발동');
    }
    const condition = traitCondition(trait, name);
    if (!condition) return traitText(trait);
    const active = core.Logic.calculateInitialStats(fighter, party, all, index).activeTrait === trait.type;
    return condition + (active ? ' 출전 · 발동' : ' 필요 · 미발동');
  }

  function select(choice) {
    audio.sfx.tap();
    if (!selected || selected.bench && choice.bench || selected.slot === choice.slot) {
      selected = selected?.slot === choice.slot && selected?.bench === choice.bench ? null : choice;
    } else {
      const slot = choice.slot ?? selected.slot;
      const bench = choice.bench ?? selected.bench;
      if (bench) party[slot] = bench;
      else [party[selected.slot], party[slot]] = [party[slot], party[selected.slot]];
      selected = null;
    }
    render();
  }

  const first = door.enemies[0];
  const firstBeats = tempo.enemies[0]?.beats.filter(beat => beat.turn === 1) ?? [];
  const firstAction = firstBeats.length === 1 ? enemyActionText(firstBeats[0]) : '';
  const title = run.daily ? '균열' : DUNGEONS[run.dungeonId].name;

  node.innerHTML = head(run, '출전 순서', null, { back: !!draft }) + '<div class="scroll">' +
    '<button class="win run-opponents" id="b-opponents"><span><b>' + esc(title) + ' ' + run.floor + '층 · 적 ' +
    door.enemies.length + '명</b><small>첫 적 ' + esc(first.name) + (firstAction ? ' · 첫 행동 ' + esc(firstAction) : '') +
    '</small></span><span class="opponent-info">정보</span></button><div class="formation"></div></div>' +
    '<div class="footer formation-actions"><button class="btn" id="b-formation-info" hidden>동료 정보</button>' +
    '<button class="btn go" id="b-go" data-coach="formation-confirm">이대로 전투 시작</button></div>';
  show('order');

  const formation = $('.formation', node);
  const info = $('#b-formation-info', node);
  const go = $('#b-go', node);
  const focused = () => selected?.bench ?? party[selected?.slot];

  function render() {
    const previews = heirloomPreview(core, party);
    const slots = party.map((id, i) => {
      const fighter = id && card(id);
      const active = selected?.slot === i;
      const source = id && spr(id);
      const art = source ? sprite(id, {
        flip: source.facing === 'left',
        style: 'margin-bottom:' + (source.fy + 3 - source.h) + 'px'
      }) : '';
      const trait = traitLine(fighter, i);
      return '<button class="relay-seat win" data-slot="' + i + '" aria-pressed="' + active + '">' +
        '<small>' + POSITION[i] + '</small><span class="relay-seat-art">' + art + '</span>' +
        '<b>' + esc(fighter?.name || '빈 자리') + repeatBadge(run, id) + '</b>' +
        (trait ? '<small class="relay-trait" title="' + esc(traitText(fighter.trait)) + '">' + esc(trait) + '</small>' : '') +
        blessingLine(id) + '</button>';
    });
    const links = slots.slice(1).map((_, i) => {
      const entry = previews[i];
      return '<button class="relay-link" data-link="' + i + '" aria-label="' + POSITION[i] +
        ' 유품 흐름"' + (entry?.skill ? '' : ' disabled') + '>→</button>';
    });
    const bench = run.bench.filter(id => !party.includes(id));
    formation.innerHTML = '<div class="relay-seats">' + slots.map((slot, i) => slot + (links[i] ?? '')).join('') +
      '</div><h3>대기 ' + bench.length + '명</h3><div class="reserve-cards">' + bench.map(id =>
        '<button class="win" data-bench="' + esc(id) + '" aria-pressed="' + (selected?.bench === id) + '">' +
        faceBadge(id, name(id), 40, run) + blessingLine(id) + '</button>').join('') + '</div>';
    info.hidden = !focused();
    go.disabled = !party.some(Boolean);
    for (const button of $$('[data-slot]', formation)) button.addEventListener('click', () => select({ slot: Number(button.dataset.slot) }));
    for (const button of $$('[data-bench]', formation)) button.addEventListener('click', () => select({ bench: button.dataset.bench }));
    for (const button of $$('[data-link]', formation)) button.addEventListener('click', () => {
      const { from, to, skill } = previews[Number(button.dataset.link)];
      const replaced = run.heirlooms?.[to]?.name;
      audio.sfx.tap();
      sheets.openSheet(TERMS.heirloom.firstUse, '<div class="relay-flow">' + faceBadge(from) + ' → ' + faceBadge(to) +
        '</div><p><b>' + esc(skill.name) + '</b> · ' + TERMS.heirloom.detail + '</p>' +
        (replaced ? '<p>' + esc(replaced) + ' 유품 교체</p>' : ''));
    });
  }

  render();
  info.addEventListener('click', () => ui.companion(focused(), blessingView(focused())));
  $('#b-order-back', node)?.addEventListener('click', () => {
    audio.sfx.tap();
    onBack();
  });
  go.addEventListener('click', () => {
    if (entered) return;
    audio.unlockAudio();
    audio.sfx.tap();
    entered = true;
    const result = onEnter ? onEnter(party) : ui.command(Run.confirmOrder, party);
    if (result.ok) ui.route();
    else entered = false;
  });
  $('#b-opponents', node).addEventListener('click', () => {
    const quirk = run.features?.quirks !== false && QUIRKS[door.quirk];
    sheets.openSheet(TERMS[door.type]?.short ?? door.name, door.enemies.map((enemy, index) => '<div class="run-foe-detail">' +
      sprite(enemy.sprite, { flip: foeFlip(enemy), cls: enemy.look === 'shadow' ? 'shadow-tint' : '' }) +
      '<div><h4>' + esc(enemy.name) + '</h4>' + (enemy.note ? '<p>' + esc(enemy.note) + '</p>' : '') +
      (run.features?.affixes === false ? [] : enemy.affixes ?? []).map(id => '<p>' + esc(AFFIXES[id]?.desc || '') + '</p>').join('') +
      (tempo.enemies[index]?.beats ?? []).map(beat =>
        '<p>' + esc(tempoBeatText(beat, tempo.lesson?.steps?.[beat.turn - 1])) + '</p>').join('') +
      '</div></div>').join('') + (quirk ? '<p>' + esc(quirk.name + ' · ' + quirk.desc) + '</p>' : ''));
  });
}
