import { $, esc, show, sleep } from '../dom.js';
import { head } from '../widgets.js';
import { altarKeep, altarRoll } from '../../engine/run.js';
import { describeAltarRoll } from '../service-offers.js';

export function altarScreen(run, ui, kept = null) {
  ui.playMusic();
  const { card, sprite } = ui.widgets;
  const { sfx } = ui.audio;
  const node = $('#altar');
  const pending = run.pending;
  const current = pending?.roll || kept;
  const left = pending ? 3 - pending.rolls : 0;
  const blessing = current && describeAltarRoll(run, current, card, kept?.previous);
  const slot = blessing ? '<span class="pic">' + sprite(current.id) + '</span><span class="txt"><b>' + esc(blessing.name) +
    '</b><small>' + esc(blessing.previous) + '</small><strong>' + esc(blessing.next) + '</strong><small>' +
    esc(blessing.effect) + '</small></span>' :
    '<span class="empty">?</span>';
  const actions = pending ? '<button class="btn" id="b-roll"' + (left && run.bench.length ? '' : ' disabled') +
    '>굴리기 (' + left + ')</button><button class="btn' + (current ? ' go' : '') + '" id="b-keep"' +
    (current ? '' : ' disabled') + '>축복 받기</button>' : '';
  node.innerHTML = head(run, '혼돈의 제단', run.floor + '층') + '<div class="screen-split"><div class="fixed-top">' +
    '<p class="lead">세 번까지 굴려. 받으면 그 동료의 기존 축복을 바꿔.</p>' +
    '<div class="altarslot win' + (current?.jackpot ? ' jackpot' : '') + '" id="slot">' + slot + '</div></div>' +
    '<div class="footer fixed-foot">' + actions + (!pending || !current ? '<button class="btn' +
    (pending ? '' : ' go') + '" id="b-leave">' + (pending ? '떠나기' : '다음 층으로') + '</button>' : '') + '</div></div>';
  show('altar');
  $('#b-leave', node)?.addEventListener('click', ui.leave);
  $('#b-keep', node)?.addEventListener('click', () => {
    const previous = run.blessings[current.id] ?? 0;
    const result = ui.command(altarKeep);
    if (result.ok) {
      sfx.awaken();
      if (run.room.type === 'event') ui.route();
      else altarScreen(run, ui, { ...result, previous });
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
