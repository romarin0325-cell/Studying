import { $, esc, show, sleep } from '../dom.js';
import { head } from '../widgets.js';
import { GRADE } from '../../engine/roster.js';
import { altarKeep, altarRoll } from '../../engine/run.js';

export function altarScreen(run, ui, kept = null) {
  ui.playMusic();
  const { card, sprite } = ui.widgets;
  const { sfx } = ui.audio;
  const node = $('#altar');
  const pending = run.pending;
  const current = pending?.roll || kept;
  const left = pending ? 3 - pending.rolls : 0;
  const fighter = current && card(current.id);
  const slot = fighter ? '<span class="pic">' + sprite(current.id) + '</span><span class="txt"><b>' + esc(fighter.name) +
    '</b><strong>+' + Math.round(current.multiplier * 100) + '%</strong><small>' +
    (current.jackpot ? '대박 · ' : '') + (GRADE[fighter.grade] || '') + ' · 체력·공격·방어</small></span>' :
    '<span class="empty">?</span>';
  const actions = pending ? '<button class="btn" id="b-roll"' + (left && run.bench.length ? '' : ' disabled') +
    '>굴리기 (' + left + ')</button><button class="btn' + (current ? ' go' : '') + '" id="b-keep"' +
    (current ? '' : ' disabled') + '>축복 받기</button>' : '';
  node.innerHTML = head(run, '혼돈의 제단', run.floor + '층') + '<div class="scroll">' +
    '<p class="lead">무작위 동료 한 명이 원정 끝까지 축복을 받는다. 최대 세 번 굴리고 마지막 결과를 받는다.</p>' +
    '<div class="altarslot win' + (current?.jackpot ? ' jackpot' : '') + '" id="slot">' + slot + '</div></div>' +
    '<div class="footer">' + actions + (!pending || !current ? '<button class="btn" id="b-leave">' +
    (pending ? '떠나기' : '다음 층으로') + '</button>' : '') + '</div>';
  show('altar');
  $('#b-leave', node)?.addEventListener('click', ui.leave);
  $('#b-keep', node)?.addEventListener('click', () => {
    const result = ui.command(altarKeep);
    if (result.ok) {
      sfx.awaken();
      if (run.room.type === 'event') ui.route();
      else altarScreen(run, ui, result);
    }
  });
  $('#b-roll', node)?.addEventListener('click', async event => {
    const result = ui.command(altarRoll);
    if (!result.ok) return;
    event.currentTarget.disabled = true;
    $('#b-keep', node).disabled = true;
    const leave = $('#b-leave', node);
    if (leave) leave.disabled = true;
    const box = $('#slot', node);
    for (let i = 0; i < 8 && box.isConnected; i++) {
      const id = run.bench[i % run.bench.length];
      box.innerHTML = '<span class="pic">' + sprite(id) + '</span><span class="txt"><b>…</b></span>';
      sfx.roll();
      await sleep(45 + i * 10);
    }
    if (box.isConnected) {
      (result.jackpot ? sfx.jackpot : sfx.buff)();
      altarScreen(run, ui);
    }
  });
}
