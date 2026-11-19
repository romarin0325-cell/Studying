import { $, $$, show } from '../dom.js';
import { head } from '../widgets.js';

export function pickScreen(run, choices, widgets, sfx, toMap) {
  const { card, cardRow } = widgets;
  const node = $('#pick');
  node.innerHTML = head(run, '그림자가 깨어났다') + '<div class="scroll"><p class="lead">쓰러뜨린 그림자가 꿈으로 돌아왔다. 한 명이 동료가 된다.</p><div class="cards">' + choices.map(id => cardRow(run, id)).join('') + '</div></div>' +
    '<div class="footer"><button class="btn back" id="b-gate-skip">데려가지 않는다</button><button class="btn go" id="b-gate-take" disabled>한 명을 고른다</button></div>';
  show('pick');
  let sel = null;
  $$('.cardrow', node).forEach(button => button.addEventListener('click', () => {
    sel = button.dataset.id;
    sfx.tap();
    $$('.cardrow', node).forEach(row => row.classList.toggle('sel', row === button));
    const take = $('#b-gate-take');
    take.disabled = false;
    take.textContent = card(sel).name + '을(를) 데려간다';
  }));
  $('#b-gate-take').addEventListener('click', () => { if (!sel) return; run.bench.push(sel); sfx.awaken(); toMap(true); });
  $('#b-gate-skip').addEventListener('click', () => { sfx.tap(); toMap(true); });
}
