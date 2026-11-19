import { $, $$, show } from '../dom.js';
import { head } from '../widgets.js';
import * as R from '../../engine/run.js';
import { reveal } from '../reveal.js';

/* The spring keeps every card woken on this visit (newest first) and updates its buttons, crystals
   and bench in place, so a summon shows exactly once. */
export function springScreen(run, roster, widgets, sfx, toMap) {
  const { card, cardRow, benchMinis } = widgets;
  const node = $('#spring'), seen = [];
  const lock = () => $$('#spring .btn').forEach(b => { b.disabled = true; });
  function base() {
    node.innerHTML = head(run, '소환의 샘', '꿈길 ' + run.floor + '층') + '<div class="scroll">' +
      '<p class="lead">꿈의 결정을 바쳐 잠든 동료를 깨운다. 같은 동료는 둘 깨울 수 없다.</p>' +
      '<div class="svc"><button class="btn big" id="b-draw"><b>깨우기</b><small>◆ ' + R.COST.draw + ' · 무작위 한 명</small><small>노멀 40 · 레어 30 · 에픽 20 · 전설 10</small></button>' +
      '<button class="btn big" id="b-pick"><b>골라 깨우기</b><small>◆ ' + R.COST.pick + ' · 셋 중 하나</small><small>노멀 25 · 레어 30 · 에픽 25 · 전설 20</small></button></div>' +
      '<div class="cards" id="fresh">' + seen.map(id => cardRow(run, id, { skills: false, sheet: true })).join('') + '</div>' +
      '<h3>동료 <span class="sm" id="sp-count"></span></h3><div class="benchrow" id="sp-bench"></div></div>' +
      '<div class="footer"><button class="btn go" id="b-leave">샘을 떠난다</button></div>';
    show('spring');
    $('#b-draw').addEventListener('click', drawOne);
    $('#b-pick').addEventListener('click', pickOne);
    $('#b-leave').addEventListener('click', () => { sfx.tap(); toMap(true); });
    refresh();
  }
  function refresh() {
    $('#b-draw').disabled = run.crystals < R.COST.draw; $('#b-pick').disabled = run.crystals < R.COST.pick; $('#b-leave').disabled = false;
    $('.gems', node).textContent = '◆ ' + run.crystals;
    $('#sp-count').textContent = run.bench.length + '명 · 누르면 자세히';
    $('#sp-bench').innerHTML = benchMinis(run);
  }
  async function drawOne() {
    const id = R.drawAwaken(run, roster, false); if (!id) return;
    lock(); $('.gems', node).textContent = '◆ ' + run.crystals;
    await reveal(run, widgets, sfx, $('#fresh'), id, { first: true });
    seen.unshift(id); refresh();
  }
  function pickOne() {
    const choices = R.pickChoices(run, roster, 3);
    if (!choices.length || !R.payPick(run)) return;
    sfx.tap();
    node.innerHTML = head(run, '골라 깨우기') + '<div class="scroll"><p class="lead">한 명을 고른다. 고르지 않은 꿈은 악몽이 되어 문지기로 설 수 있다.</p><div class="cards">' + choices.map(id => cardRow(run, id)).join('') + '</div></div>' +
      '<div class="footer"><button class="btn go" id="b-take" disabled>한 명을 고른다</button></div>';
    let sel = null;
    $$('.cardrow', node).forEach(b => b.addEventListener('click', () => { sel = b.dataset.id; sfx.tap(); $$('.cardrow', node).forEach(x => x.classList.toggle('sel', x === b)); const go = $('#b-take'); go.disabled = false; go.textContent = card(sel).name + '을(를) 깨운다'; }));
    $('#b-take').addEventListener('click', async () => {
      if (!sel) return;
      R.takePick(run, choices, sel);
      base(); lock();
      await reveal(run, widgets, sfx, $('#fresh'), sel, { first: true, roll: false });
      seen.unshift(sel); refresh();
    });
  }
  base();
}
