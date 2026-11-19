import { $, sleep } from './dom.js';

/** A summon. Silhouettes roll, then rare and better glow in their grade colour before the face shows,
    then the card lands with its grade's effect. The card is placed once and stays (no second pop). */
export async function reveal(run, widgets, sfx, box, id, o) {
  const { card, cardRow, sprite } = widgets;
  const opt = o || {}, c = card(id), g = ['legend', 'transcendence'].includes(c.grade) ? 'legend' : (['rare', 'epic'].includes(c.grade) ? c.grade : 'normal');
  const slot = document.createElement('div');
  slot.className = 'revealing win g-' + g;
  if (opt.first) box.prepend(slot); else box.appendChild(slot);
  slot.scrollIntoView({ block: 'nearest' });
  if (opt.roll !== false) {
    const pool = run.pool;
    for (let i = 0; i < 9; i++) { slot.innerHTML = '<span class="pic">' + sprite(pool[Math.floor(Math.random() * pool.length)], { cls: 'sil' }) + '</span>'; sfx.roll(); await sleep(55 + i * 12); }
  }
  if (g !== 'normal') {
    slot.classList.add('tease');
    slot.innerHTML = '<span class="pic">' + sprite(id, { cls: 'sil' }) + '</span>';
    (g === 'legend' ? sfx.warn : sfx.charge)();
    await sleep(g === 'legend' ? 650 : g === 'epic' ? 380 : 200);
  }
  const sparks = { legend: 16, epic: 10, rare: 5 }[g] || 0;
  const wrap = document.createElement('div');
  wrap.className = 'landing g-' + g + ' l-' + g;
  wrap.innerHTML = (g === 'legend' ? '<i class="rays"></i>' : '') + cardRow(run, id, { skills: false, cls: 'pop', sheet: true }) +
    (sparks ? '<span class="sparkle">' + Array.from({ length: sparks }, () => {
      const a = Math.random() * Math.PI * 2, r = 26 + Math.random() * 46;
      return '<b style="left:' + Math.round(8 + Math.random() * 84) + '%;top:' + Math.round(15 + Math.random() * 70) + '%;--dx:' + Math.round(Math.cos(a) * r) + 'px;--dy:' + Math.round(Math.sin(a) * r) + 'px;animation-delay:' + Math.round(Math.random() * 160) + 'ms"></b>';
    }).join('') + '</span>' : '');
  slot.replaceWith(wrap);
  if (g === 'legend') { sfx.jackpot(); flashFrame('gold'); }
  else if (g === 'epic') { sfx.awaken(); flashFrame('violet'); }
  else sfx.awaken();
  await sleep(g === 'legend' ? 900 : g === 'epic' ? 420 : 240);
}
function flashFrame(kind) { const f = document.createElement('div'); f.className = 'flash ' + kind; $('#frame').appendChild(f); setTimeout(() => f.remove(), 800); }
