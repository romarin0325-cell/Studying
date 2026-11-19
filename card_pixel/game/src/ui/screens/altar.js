import { $, $$, esc, show, sleep } from '../dom.js';
import { head } from '../widgets.js';
import { GRADE } from '../../engine/roster.js';
import * as R from '../../engine/run.js';

export function altarScreen(run, roster, widgets, sfx, toMap) {
  const { card, sprite } = widgets;
  const node = $('#altar');
  let left = 3, current = null;
  function draw() {
    const c = current && card(current.id);
    node.innerHTML = head(run, '혼돈의 제단', '꿈길 ' + run.floor + '층') + '<div class="scroll">' +
      '<p class="lead">무작위 동료 한 명이 축복을 받는다. 등급이 낮을수록 크게 받고(노멀 +40% … 전설 +10%), 드물게 대박(2.5배)이 터진다. 세 번까지 굴릴 수 있고 마지막 결과가 남는다. 축복은 원정이 끝날 때까지 간다.</p>' +
      '<div class="altarslot win' + (current && current.jackpot ? ' jackpot' : '') + '" id="slot">' + (c ? '<span class="pic">' + sprite(current.id) + '</span><span class="txt"><b>' + esc(c.name) + '</b><strong>+' + Math.round(current.mult * 100) + '%</strong><small>' + (current.jackpot ? '대박! ' : '') + (GRADE[c.grade] || '') + ' · 체력·공격·방어 모두</small></span>' : '<span class="empty">?</span>') + '</div>' +
      '</div><div class="footer"><button class="btn" id="b-roll"' + (left ? '' : ' disabled') + '>굴린다 (남은 ' + left + ')</button><button class="btn go" id="b-keep"' + (current ? '' : ' disabled') + '>' + (current ? (left ? '이걸로 정한다' : '받아들인다') : '먼저 굴린다') + '</button></div>';
    $('#b-roll').addEventListener('click', roll);
    $('#b-keep').addEventListener('click', () => { R.altarKeep(run, current); sfx.awaken(); toMap(true); });
  }
  async function roll() {
    if (!left) return;
    left--; $$('#altar .btn').forEach(b => { b.disabled = true; });
    const slot = $('#slot');
    for (let i = 0; i < 12; i++) { const id = run.bench[i % run.bench.length]; slot.innerHTML = '<span class="pic">' + sprite(id) + '</span><span class="txt"><b>…</b></span>'; sfx.roll(); await sleep(45 + i * 10); }
    current = R.altarRoll(run, roster);
    (current.jackpot ? sfx.jackpot : sfx.buff)();
    draw();
  }
  draw(); show('altar');
}
