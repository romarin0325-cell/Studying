import { $, $$, esc, show } from '../dom.js';
import { head } from '../widgets.js';
import { chooseStartPick, START } from '../../engine/run.js';

export function awakenScreen(run, ui) {
  ui.playMusic();
  const { card, cardRow } = ui.widgets;
  const { sfx } = ui.audio;
  const node = $('#awaken');
  const pending = run.pending;
  const intro = run.dungeonId === 'dawn_forest';
  const observed = intro ? { ...run, heirlooms: { ...run.introHeirlooms, ...run.heirlooms } } : run;

  if (!pending) {
    node.innerHTML = head(run, '첫 깨우기', '2층') + '<div class="scroll"><h3>이번 원정 합류</h3><div class="cards">' +
      run.bench.map(id => cardRow(run, id, { sheet: true, skills: false })).join('') +
      '</div></div><div class="footer"><button class="btn go" id="b-depart">꿈길로</button></div>';
    show('awaken');
    $('#b-depart', node).addEventListener('click', ui.leave);
    return;
  }

  const near = pending.near && card(pending.near);
  const info = intro ? '깨운 동료는 이번 원정에 합류한다.' :
    '동료를 고르면 무작위로 ' + START.draws + '명이 더 깨어난다.';
  const allies = run.bench.length ? '<h3>이번 원정 합류</h3><div class="cards">' +
    run.bench.map(id => cardRow(run, id, { sheet: true, skills: false, tag: id === run.lead ? '대표' : '' })).join('') + '</div>' : '';

  const candidates = intro ? pending.candidates.slice().sort((a, b) =>
    Number(run.introCandidates.includes(b)) - Number(run.introCandidates.includes(a))) : pending.candidates;
  const cards = candidates.map(id => {
    const tag = run.introCandidates.includes(id) ? '대여 전투 생환' :
      id === run.profileShard ? '예약 후보' : near && card(id).element === near.element ? '같은 속성' : '';
    return cardRow(observed, id, { tag });
  }).join('');
  node.innerHTML = head(run, '첫 깨우기', '남은 선택 ' + pending.remaining) + '<div class="scroll"><p class="lead">' + info +
    '</p>' + allies + '<div class="cards" id="wake-choices">' + cards + '</div></div>' +
    '<div class="footer"><button class="btn go" id="b-wake"' + (cards ? ' disabled' : '') + '>' +
    (cards ? '한 명을 고른다' : '계속한다') + '</button></div>';
  show('awaken');
  let selected = null;
  const button = $('#b-wake', node);
  const choices = $$('#wake-choices .cardrow', node);
  for (const choice of choices) {
    choice.addEventListener('click', () => {
      selected = choice.dataset.id;
      sfx.tap();
      for (const row of choices) row.classList.toggle('sel', row === choice);
      button.disabled = false;
      button.textContent = card(selected).name + ' 깨우기';
    });
  }
  button.addEventListener('click', () => {
    if (!ui.command(chooseStartPick, selected).ok) return;
    sfx.awaken();
    ui.route();
  });
}
