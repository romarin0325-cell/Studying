import { $, $$, esc, show } from '../dom.js';
import { head } from '../widgets.js';
import { chooseStartPick, START } from '../../engine/run.js';
import { revealLine } from '../reveal.js';
import { TERMS } from '../glossary.js';

export function awakenScreen(run, ui) {
  ui.playMusic();
  const { card, cardRow, faceBadge } = ui.widgets;
  const { sfx } = ui.audio;
  const node = $('#awaken');
  const pending = run.pending;
  const intro = run.dungeonId === 'dawn_forest';
  const lead = intro ? run.openingLead : null;
  const introCandidates = run.introCandidates ?? [];
  const observed = intro ? { ...run, heirlooms: { ...run.introHeirlooms, ...run.heirlooms } } : run;
  const leadPlate = id => '<div class="wake-lead win">' + faceBadge(id) +
    '<span>첫 동행' + (observed.heirlooms[id] ? '<small>유품 · ' + esc(observed.heirlooms[id].name) + '</small>' : '') + '</span></div>';

  function line(ids) {
    return ids.map(id => '<button class="wake-face win g-' + esc(card(id).grade) + '" data-sheet="' + esc(id) + '">' +
      faceBadge(id) + '</button>').join('');
  }

  function completed(chosen, awakened, animate) {
    const summary = '선택 동료 ' + chosen.length + '명 · 추가 합류 ' + awakened.length + '명 · 결정 ' + run.crystals;
    node.innerHTML = head(run, '이번 원정 동료 고르기', '2층') + '<div class="scroll">' +
      (lead ? leadPlate(lead) : '') + '<h3>선택한 동료</h3><div class="wake-line">' + line(chosen.filter(id => id !== lead)) + '</div>' +
      '<h3>추가 합류 동료</h3><div class="wake-line" id="wake-draws">' + awakened.map(id =>
        '<div class="wake-slot g-' + esc(card(id).grade) + '">' + line([id]) + '</div>').join('') +
      '</div><p class="wake-summary win" aria-live="polite"></p></div>' +
      '<div class="footer"><button class="btn" id="b-wake-skip">건너뛰기</button>' +
      '<button class="btn go" id="b-depart" hidden>원정 출발</button></div>';
    show('awaken');
    const skip = $('#b-wake-skip', node);
    const depart = $('#b-depart', node);
    depart.addEventListener('click', ui.leave, { once: true });
    const box = $('#wake-draws', node);
    function done() {
      if (!box.isConnected) return;
      $('.wake-summary', node).textContent = summary;
      skip.hidden = true;
      depart.hidden = false;
    }
    if (animate) revealLine(box, skip, sfx, done);
    else {
      for (const slot of box.children) slot.classList.add('landed');
      done();
    }
  }

  if (!pending) {
    if (lead && run.bench.includes(lead)) {
      const split = Math.max(1, run.bench.length - START.draws);
      return completed(run.bench.slice(0, split), run.bench.slice(split), false);
    }
    node.innerHTML = head(run, '이번 원정 동료 고르기', '2층') + '<div class="scroll"><h3>이번 원정 합류</h3><div class="cards">' +
      run.bench.map(id => cardRow(run, id, { sheet: true, skills: false })).join('') +
      '</div></div><div class="footer"><button class="btn go" id="b-depart">원정 출발</button></div>';
    show('awaken');
    $('#b-depart', node).addEventListener('click', ui.leave);
    return;
  }

  const near = pending.near && card(pending.near);
  const info = lead ? '함께 출발할 동료 1명을 선택하세요.' : intro ? TERMS.join.detail :
    '동료를 선택하면 무작위로 ' + START.draws + '명이 추가 합류합니다.';
  const allies = lead ? leadPlate(lead) : run.bench.length ? '<h3>이번 원정 합류</h3><div class="cards">' +
    run.bench.map(id => cardRow(run, id, { sheet: true, skills: false, tag: id === run.lead ? '대표' : '' })).join('') + '</div>' : '';

  const candidates = intro ? pending.candidates.slice().sort((a, b) =>
    Number(introCandidates.includes(b)) - Number(introCandidates.includes(a))) : pending.candidates;
  const cards = candidates.map(id => {
    const tag = introCandidates.includes(id) ? '대여 전투 생환' :
      id === run.profileShard ? '예약 후보' : near && card(id).element === near.element ? '같은 속성' : '';
    return cardRow(observed, id, { tag, offer: true, coach: 'awakening-candidate' });
  }).join('');
  node.innerHTML = head(run, '이번 원정 동료 고르기', '남은 선택 ' + pending.remaining) + '<div class="scroll">' + allies +
    '<p class="lead">' + info + '</p><div class="cards" id="wake-choices">' + cards + '</div></div>' +
    '<div class="footer"><button class="btn go" id="b-wake" data-coach="awakening-confirm"' + (cards ? ' disabled' : '') + '>' +
    (cards ? '동료 선택' : '계속하기') + '</button></div>';
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
      button.textContent = card(selected).name + ' · ' + TERMS.join.short;
    });
  }
  button.addEventListener('click', () => {
    const result = ui.command(chooseStartPick, selected);
    if (!result.ok) return;
    sfx.awaken();
    if (intro && !run.pending && Array.isArray(result.awakened)) {
      return completed(run.bench.filter(id => !result.awakened.includes(id)), result.awakened, true);
    }
    if (!intro && !run.pending) ui.showAwakened(result.awakened);
    ui.route();
  });
}
