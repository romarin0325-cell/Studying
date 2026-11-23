import { $, $$, esc, show } from '../dom.js';
import { chooseReplacements, head, replacementCount } from '../widgets.js';
import { relicEffect, relicIcon } from '../relics.js';
import { chooseGateReward } from '../../engine/run.js';
import { RELIC_LIMIT } from '../../engine/rooms.js';
import { treasureScreen } from './treasure.js';
import { TERMS } from '../glossary.js';
import { drawCard } from '../reveal.js';

export function gatePickScreen(run, ui, { node = $('#pick'), inline = false, onRelic } = {}) {
  if (!inline) ui.playMusic();
  const { card, cardRow } = ui.widgets;
  const { sfx } = ui.audio;
  const { candidates, relic, partner } = run.pending;
  const lead = partner ? '보상은 하나만 고를 수 있습니다.' :
    '문지기전에서 이긴 그림자 1명을 데려오거나 유물을 장착하세요.';
  const relicChoice = (id, combo) => {
    const artifact = ui.artifacts.get(id);
    if (!artifact) return '';
    const hint = combo ? ui.artifacts.get(combo.held).name + ' 조합 · ' + combo.hint : '';
    return '<button class="win run-relic-choice" data-relic="' + esc(id) + '">' + relicIcon(id, 32) +
      '<span><b>' + esc(artifact.name) + '</b><small>' + esc(relicEffect(artifact)) + '</small>' +
      (hint ? '<small class="relic-combo-hint"><strong>' + esc(hint) + '</strong></small>' : '') + '</span></button>';
  };
  node.innerHTML = (inline ? '<h4>문지기 보상</h4>' : head(run, '문지기 보상', run.floor + '층')) +
    '<div class="' + (inline ? 'decision-body' : 'scroll') + '">' +
    '<p class="lead">' + lead + '</p><div class="cards">' +
    candidates.map(id => cardRow(run, id, { tag: TERMS.join.firstUse, offer: true })).join('') +
    relicChoice(relic) + relicChoice(partner?.id, partner) +
    '</div></div><div class="footer"><button class="btn" id="b-leave">두고 가기</button>' +
    '<button class="btn go" id="b-gate-take" disabled>보상 선택</button></div>';
  if (!inline) show('pick');
  let choice;
  const take = $('#b-gate-take', node);
  const rows = $$('[data-id], [data-relic]', node);
  for (const row of rows) row.addEventListener('click', event => {
    const id = row.dataset.id || row.dataset.relic;
    choice = { kind: row.dataset.id ? 'join' : 'relic', id };
    sfx.tap();
    for (const other of rows) other.classList.toggle('sel', other === row);
    take.disabled = false;
    take.textContent = choice.kind === 'join' ? card(id).name + ' · ' + TERMS.join.short :
      run.relics.length === RELIC_LIMIT ? '교체할 유물 고르기' : ui.artifacts.get(id).name + ' 받기';
    // A keyboard pick (Enter/Space reports detail 0) moves on to the confirm button it just enabled (audit 7).
    if (event.detail === 0) take.focus();
  });
  function apply(selected) {
    if (!selected) return;
    const result = ui.command(chooseGateReward, selected);
    if (!result.ok) return;
    if (selected.kind === 'join') {
      sfx.awaken();
      node.innerHTML = (inline ? '<h4>문지기 보상</h4>' : head(run, '문지기 보상', run.floor + '층')) +
        '<div class="' + (inline ? 'decision-body' : 'scroll') + '">' +
        drawCard(run, ui.widgets, { kind: 'join', id: result.joined }) + '</div>' +
        '<div class="footer"><button class="btn go" id="b-gate-done">계속하기</button></div>';
      $('#b-gate-done', node).addEventListener('click', ui.leave, { once: true });
    } else {
      if (result.relic.equipped) sfx.gem();
      if (onRelic) onRelic(selected.id);
      else treasureScreen(run, ui, selected.id, { equipped: result.relic.equipped });
    }
  }
  take.addEventListener('click', () => {
    const selected = choice;
    const count = selected?.kind === 'join' ? replacementCount(run, 1) : 0;
    if (count) chooseReplacements(run, ui, count, ([replaceId]) => apply({ ...selected, replaceId }), { incoming: [selected.id] });
    else apply(selected);
  });
  $('#b-leave', node).addEventListener('click', ui.leave);
}
