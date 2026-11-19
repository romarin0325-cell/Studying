import { $, $$, esc, show } from '../dom.js';
import { head } from '../widgets.js';
import * as R from '../../engine/run.js';

export function endScreen(run, wiped, widgets, audio, newRun) {
  const { card, cardRow } = widgets;
  const { sfx } = audio;
  const node = $('#end'), won = run.result === 'win', st = run.stats;
  const canRecruit = won && run.bench.length > 0;
  const lastFall = '마지막 동료가 적과 함께 쓰러졌다.';
  let lead = wiped ? lastFall : '모두 쓰러졌다. 출전 순서와 유품, 물러나기를 바꿔 다시 들어가 보자.';
  if (won) {
    lead = '꿈의 주인을 쓰러뜨렸다.';
    if (wiped) lead += ' ' + lastFall;
    if (canRecruit) lead += ' 살아 돌아온 동료 가운데 한 명을 영입한다.';
  }
  const rows = [['도달한 층', Math.min(run.floor, R.FLOORS) + ' / ' + R.FLOORS], ['전투', st.battles + '회 · ' + st.turns + '턴'], ['최고 피해', st.best ? st.best.toLocaleString('en-US') + (st.bestBy ? ' (' + st.bestBy + ')' : '') : '-'],
    ['쓰러진 동료', run.fallen.map(id => card(id).name).join(', ') || '없음'], ['유품 사용', st.heirloomsUsed + '회'], ['최후의 일인', st.lastStands + '회'], ['대박 축복', st.jackpots + '회']];
  node.innerHTML = head(run, won ? '원정 성공' : '꿈에서 깨어났다') + '<div class="scroll">' +
    '<p class="lead">' + lead + '</p>' +
    (canRecruit ? '<div class="cards">' + run.bench.map(id => cardRow(run, id, { skills: false })).join('') + '</div><p class="gain" id="recruited"></p>' : '') +
    '<table class="sumtable">' + rows.map(r => '<tr><td>' + r[0] + '</td><td>' + esc(String(r[1])) + '</td></tr>').join('') + '</table>' +
    (canRecruit ? '<p class="note">시험판이라 영입과 결정은 저장되지 않는다. 본편에서는 영입한 동료를 다른 던전에 데려간다.</p>' : '') + '</div>' +
    '<div class="footer"><button class="btn go" id="b-again">다시 들어간다</button></div>';
  show('end');
  if (canRecruit) $$('.cardrow', node).forEach(b => b.addEventListener('click', () => { sfx.awaken(); $$('.cardrow', node).forEach(x => x.classList.toggle('sel', x === b)); $('#recruited').textContent = card(b.dataset.id).name + ' 영입 — 살려서 데려온 동료다.'; }));
  $('#b-again').addEventListener('click', () => { audio.unlockAudio(); newRun(); });
}
