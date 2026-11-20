import { $, $$, esc, show } from '../dom.js';
import { head } from '../widgets.js';
import { chooseGateReward } from '../../engine/run.js';
import { treasureScreen } from './treasure.js';

export function gatePickScreen(run, ui) {
  ui.playMusic();
  const { card, cardRow } = ui.widgets;
  const { sfx } = ui.audio;
  const { candidates, relic } = run.pending;
  const artifact = ui.artifacts.get(relic);
  const node = $('#pick');
  node.innerHTML = head(run, '문지기 보상', run.floor + '층') + '<div class="scroll">' +
    '<p class="lead">그림자 한 명을 깨우거나 유물을 장착한다.</p><div class="cards">' +
    candidates.map(id => cardRow(run, id, { tag: '이번 원정 합류' })).join('') +
    (artifact ? '<button class="win run-relic-choice" data-relic="' + esc(relic) + '">' + ui.icon(relic) +
      '<span><b>' + esc(artifact.name) + '</b><small>' + esc(artifact.desc) + '</small></span></button>' : '') +
    '</div></div><div class="footer"><button class="btn" id="b-leave">두고 가기</button>' +
    '<button class="btn go" id="b-gate-take" disabled>보상을 고른다</button></div>';
  show('pick');
  let choice;
  const take = $('#b-gate-take', node);
  const rows = $$('[data-id], [data-relic]', node);
  for (const row of rows) row.addEventListener('click', () => {
    const id = row.dataset.id || row.dataset.relic;
    choice = { kind: row.dataset.id ? 'join' : 'relic', id };
    sfx.tap();
    for (const other of rows) other.classList.toggle('sel', other === row);
    take.disabled = false;
    take.textContent = choice.kind === 'join' ? card(id).name + ' 깨우기' : artifact.name + ' 받기';
  });
  take.addEventListener('click', () => {
    if (!choice || !ui.command(chooseGateReward, choice).ok) return;
    if (choice.kind === 'join') {
      sfx.awaken();
      ui.leave();
    } else {
      sfx.gem();
      treasureScreen(run, ui, choice.id, { equipped: run.relics.includes(choice.id) });
    }
  });
  $('#b-leave', node).addEventListener('click', ui.leave);
}
