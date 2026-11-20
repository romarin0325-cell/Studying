import { $, $$, show } from '../dom.js';
import { chooseReplacements, head, replacementCount } from '../widgets.js';
import * as Run from '../../engine/run.js';
import { canJoin } from '../../engine/awakenings.js';
import { reveal } from '../reveal.js';

export function springScreen(run, ui) {
  ui.playMusic();
  const { widgets, audio, command, leave } = ui;
  const { sfx } = audio;
  const { card, cardRow, benchMinis } = widgets;
  const { COST } = Run;
  const node = $('#spring');
  const fresh = [];

  function base() {
    const full = replacementCount(run, 1) > 0;
    node.innerHTML = head(run, '소환의 샘', run.floor + '층') + '<div class="scroll">' +
      '<p class="lead">꿈의 결정을 바쳐 동료를 깨운다.</p>' +
      '<div class="svc"><button class="btn big" id="b-draw"><b>무작위 깨우기 · ◆' + COST.draw + '</b>' +
      (full ? '<small>보낼 동료를 먼저 정함</small>' : '') + '<small>노멀 40 · 레어 30 · 에픽 20 · 전설 10</small></button>' +
      '<button class="btn big" id="b-pick"><b>셋을 본다</b><small>보기 무료 · 합류 확정 시 ◆' + COST.pick +
      '</small><small>노멀 25 · 레어 30 · 에픽 25 · 전설 20</small></button></div>' +
      '<p class="run-status" id="spring-status" role="status"></p>' +
      '<div class="cards" id="fresh">' + fresh.map(id => cardRow(run, id, { skills: false, sheet: true })).join('') + '</div>' +
      '<h3>동료 <span class="sm" id="sp-count"></span></h3><div class="benchrow" id="sp-bench"></div></div>' +
      '<div class="footer"><button class="btn go" id="b-leave">샘을 떠난다</button></div>';
    show('spring');
    $('#b-draw', node).addEventListener('click', () => {
      function draw(replaceId = null) {
        const result = command(Run.springDraw, replaceId);
        if (result.ok) { base(); showWaking(result.id, true); }
        else showFailure(result.reason);
      }
      const count = replacementCount(run, 1);
      if (count) chooseReplacements(run, ui, count, ([id]) => draw(id), {
        label: ([id]) => card(id).name + ' 보내고 무작위 합류 · ◆' + COST.draw
      });
      else draw();
    });
    $('#b-pick', node).addEventListener('click', () => {
      openOffer();
    });
    $('#b-leave', node).addEventListener('click', () => {
      if (run.pending?.kind === 'spring' && !command(Run.springTake, null).ok) return;
      leave();
    });
    refresh();
  }

  function showFailure(reason) {
    $('#spring-status', node).textContent = reason === 'empty_pool' ? '깨울 수 있는 동료가 없다.' :
      reason === 'insufficient_crystals' ? '결정이 부족하다.' : '합류할 동료와 보낼 동료를 확인한다.';
  }

  function refresh() {
    $('#b-draw', node).disabled = run.crystals < COST.draw || run.pending?.kind === 'spring';
    $('#b-pick', node).disabled = !Run.getSpringOffer && run.crystals < COST.pick && run.pending?.kind !== 'spring';
    $('#b-leave', node).disabled = run.tempoVersion !== 2 && run.pending?.kind === 'spring';
    $('.gems', node).textContent = '◆ ' + run.crystals;
    $('#sp-count', node).textContent = run.bench.length + '명';
    $('#sp-bench', node).innerHTML = benchMinis(run);
  }

  async function showWaking(id, roll) {
    const box = $('#fresh', node);
    $$('.btn', node).filter(button => !button.classList.contains('ic')).forEach(button => { button.disabled = true; });
    $('#spring-status', node).textContent = '';
    $('.gems', node).textContent = '◆ ' + run.crystals;
    await reveal(run, widgets, sfx, box, id, { first: true, roll });
    fresh.unshift(id);
    if (box.isConnected && $('#fresh', node) === box) refresh();
  }

  function openOffer() {
    const offer = Run.getSpringOffer ? command(Run.getSpringOffer) :
      (run.pending?.kind === 'spring' ? { ok: true } : command(Run.springPick));
    if (!offer.ok) return showFailure(offer.reason);
    choose(Run.getSpringOffer ? offer : { ...run.pending, alreadyPaid: true });
  }

  function choose(offer) {
    const cost = offer.alreadyPaid ? 0 : offer.cost ?? COST.pick;
    const price = cost ? ' · ◆' + cost : ' · 결제 완료';
    node.innerHTML = head(run, '골라 깨우기', run.floor + '층') +
      '<div class="scroll"><div class="cards">' + (offer.candidates ?? []).map(id => cardRow(run, id, { offer: true })).join('') +
      '</div><p class="run-status" id="spring-status" role="status"></p></div>' +
      '<div class="footer"><button class="btn" id="b-spring-pass">닫기</button>' +
      '<button class="btn go" id="b-take" disabled>한 명을 고른다</button></div>';
    show('spring');
    let selected;
    const rows = $$('.cardrow', node);
    const take = $('#b-take', node);
    for (const row of rows) {
      row.disabled = !canJoin(run, row.dataset.id);
      row.addEventListener('click', () => {
        selected = row.dataset.id;
        sfx.tap();
        for (const other of rows) other.classList.toggle('sel', other === row);
        take.disabled = run.crystals < cost;
        take.textContent = card(selected).name + ' 합류' + price;
        if (take.disabled) showFailure('insufficient_crystals');
      });
    }
    function join(id, replaceId = null) {
      const result = Run.commitSpringOffer ? command(Run.commitSpringOffer, { key: offer.key, id, replaceId }) :
        command(Run.springTake, id, replaceId);
      if (!result.ok) return showFailure(result.reason);
      base();
      if (id) showWaking(id, false);
    }
    take.addEventListener('click', () => {
      const id = selected;
      const count = replacementCount(run, 1);
      if (count) chooseReplacements(run, ui, count, ([replaceId]) => join(id, replaceId), {
        incoming: [id], label: ([replaceId]) => card(replaceId).name + ' 보내고 ' + card(id).name + ' 합류' + price
      });
      else join(id);
    });
    $('#b-spring-pass', node).addEventListener('click', base);
  }

  base();
  if (run.pending?.kind === 'spring') openOffer();
}
