import { $, $$, esc, show } from '../dom.js';
import { head } from '../widgets.js';
import { ELEMENT } from '../../engine/roster.js';
import * as R from '../../engine/run.js';
import { reveal } from '../reveal.js';

/* The start: two picks (the second offers one candidate of the first's element, since many traits
   count an element), then three free random wakings. A wider start lets each run find its own combo. */
export function awakenScreen(run, roster, widgets, sfx, toMap) {
  const { card, cardRow, benchMinis } = widgets;
  const node = $('#awaken');
  let step = 0;
  function pickStep() {
    const near = step ? run.bench[0] : null, nearEl = near && card(near).element;
    const choices = R.pickChoices(run, roster, 3, near ? { near } : null);
    node.innerHTML = head(run, '첫 깨우기', (step + 1) + ' / ' + R.START.picks) + '<div class="scroll"><p class="lead">' +
      (near ? '한 명 더 고른다. 첫 동료 ' + esc(card(near).name) + '의 ' + ELEMENT[nearEl] + ' 속성이 하나는 꼭 섞여 있다 — 같은 속성을 세는 특성이 많다.'
        : '셋 가운데 한 명을 깨운다. 고르지 않은 꿈은 악몽이 되어 4층 문지기로 설 수 있다.') + '</p>' +
      (near ? '<div class="benchrow">' + benchMinis(run) + '</div>' : '') +
      '<div class="cards">' + choices.map(id => cardRow(run, id, { tag: near && card(id).element === nearEl ? '같은 속성' : '' })).join('') + '</div></div>' +
      '<div class="footer"><button class="btn go" id="b-wake" disabled>한 명을 고른다</button></div>';
    show('awaken');
    let pickId = null;
    $$('.cards .cardrow', node).forEach(b => b.addEventListener('click', () => {
      pickId = b.dataset.id; sfx.tap();
      $$('.cards .cardrow', node).forEach(x => x.classList.toggle('sel', x === b));
      const go = $('#b-wake'); go.disabled = false; go.textContent = card(pickId).name + '을(를) 깨운다';
    }));
    $('#b-wake').addEventListener('click', () => {
      if (!pickId) return;
      R.takePick(run, choices, pickId); sfx.awaken();
      step++;
      if (step < R.START.picks) pickStep(); else revealStep();
    });
  }
  async function revealStep() {
    node.innerHTML = head(run, '첫 깨우기') + '<div class="scroll"><p class="lead">꿈이 ' + R.START.draws + '명을 더 데려왔다. 모두 출발 동료다. 누르면 기술을 자세히 본다.</p><div class="cards" id="reveal"></div></div>' +
      '<div class="footer"><button class="btn go" id="b-depart" disabled>꿈길로</button></div>';
    const box = $('#reveal');
    for (const id of run.bench) box.insertAdjacentHTML('beforeend', cardRow(run, id, { skills: false, sheet: true }));
    for (let i = 0; i < R.START.draws; i++) { const id = R.drawAwaken(run, roster, true); if (id) await reveal(run, widgets, sfx, box, id); }
    const go = $('#b-depart'); go.disabled = false; go.addEventListener('click', () => { sfx.tap(); toMap(true); });
  }
  pickStep();
}
