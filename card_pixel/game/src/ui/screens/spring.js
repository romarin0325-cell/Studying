import { $, $$, show } from '../dom.js';
import { head } from '../widgets.js';
import { COST, springDraw, springPick, springTake } from '../../engine/run.js';
import { reveal } from '../reveal.js';

export function springScreen(run, ui) {
  const { widgets, audio, command, leave } = ui;
  const { sfx } = audio;
  const { card, cardRow, benchMinis } = widgets;
  const node = $('#spring');
  const fresh = [];

  function base() {
    node.innerHTML = head(run, '소환의 샘', run.floor + '층') + '<div class="scroll">' +
      '<p class="lead">꿈의 결정을 바쳐 동료를 깨운다.</p>' +
      '<div class="svc"><button class="btn big" id="b-draw"><b>깨우기</b><small>결정 ' + COST.draw + ' · 무작위 한 명</small><small>노멀 40 · 레어 30 · 에픽 20 · 전설 10</small></button>' +
      '<button class="btn big" id="b-pick"><b>골라 깨우기</b><small>결정 ' + COST.pick + ' · 셋 중 하나</small><small>노멀 25 · 레어 30 · 에픽 25 · 전설 20</small></button></div>' +
      '<p class="run-status" id="spring-status" role="status"></p>' +
      '<div class="cards" id="fresh">' + fresh.map(id => cardRow(run, id, { skills: false, sheet: true })).join('') + '</div>' +
      '<h3>동료 <span class="sm" id="sp-count"></span></h3><div class="benchrow" id="sp-bench"></div></div>' +
      '<div class="footer"><button class="btn go" id="b-leave">샘을 떠난다</button></div>';
    show('spring');
    $('#b-draw', node).addEventListener('click', () => {
      const result = command(springDraw);
      if (result.ok) showWaking(result.id, true);
      else showFailure(result.reason);
    });
    $('#b-pick', node).addEventListener('click', () => {
      const result = command(springPick);
      if (result.ok) choose();
      else showFailure(result.reason);
    });
    $('#b-leave', node).addEventListener('click', leave);
    refresh();
  }

  function showFailure(reason) {
    $('#spring-status', node).textContent = reason === 'empty_pool' ? '깨울 수 있는 동료가 없다.' : '결정이 부족하다.';
  }

  function refresh() {
    $('#b-draw', node).disabled = run.crystals < COST.draw;
    $('#b-pick', node).disabled = run.crystals < COST.pick;
    $('#b-leave', node).disabled = false;
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

  function choose() {
    node.innerHTML = head(run, '골라 깨우기', run.floor + '층') +
      '<div class="scroll"><div class="cards">' + run.pending.candidates.map(id => cardRow(run, id)).join('') + '</div></div>' +
      '<div class="footer"><button class="btn go" id="b-take" disabled>한 명을 고른다</button></div>';
    show('spring');
    let selected;
    const rows = $$('.cardrow', node);
    const take = $('#b-take', node);
    for (const row of rows) row.addEventListener('click', () => {
      selected = row.dataset.id;
      sfx.tap();
      for (const other of rows) other.classList.toggle('sel', other === row);
      take.disabled = false;
      take.textContent = card(selected).name + ' 깨우기';
    });
    take.addEventListener('click', () => {
      if (!command(springTake, selected).ok) return;
      base();
      showWaking(selected, false);
    });
  }

  if (run.pending?.kind === 'spring') choose();
  else base();
}
