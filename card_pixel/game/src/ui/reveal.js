import { $, esc, sleep } from './dom.js';
import { TERMS } from './glossary.js';

/** A short row of summons. Skip and reduced motion land the same three faces. */
export function revealLine(box, skip, sfx, done) {
  const slots = [...box.querySelectorAll('.wake-slot')];
  let timer;
  function finish() {
    clearTimeout(timer);
    for (const slot of slots) slot.classList.add('landed');
    done();
  }
  if (!slots.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return finish();
  skip.addEventListener('click', finish, { once: true });
  let index = 0;
  function next() {
    if (!box.isConnected) return;
    slots[index++].classList.add('landed');
    sfx.awaken();
    timer = setTimeout(index < slots.length ? next : finish, 210);
  }
  timer = setTimeout(next, 140);
}

const DRAW_BONUS = TERMS.boost.detail;
export function drawText(draw, card) {
  const name = card(draw.id)?.name ?? draw.id;
  if (draw.kind === 'join') return name + ' · ' + TERMS.join.firstUse;
  if (draw.kind === 'memory') {
    if (!draw.targetId) return name + '의 기억 · 받을 동료 없음';
    const target = card(draw.targetId)?.name ?? draw.targetId;
    return name + '의 기억 → ' + target + ' · ' + DRAW_BONUS;
  }
  return name + ' · ' + TERMS.boost.firstUse + ' ★' + draw.stacks + ' · ' + DRAW_BONUS;
}

export function drawCard(run, widgets, draw) {
  return '<div class="draw-result" data-draw-kind="' + esc(draw.kind) + '"><p class="draw-receipt" role="status">' +
    esc(drawText(draw, widgets.card)) + '</p>' +
    widgets.cardRow(run, draw.targetId ?? draw.id, { skills: false, sheet: true }) + '</div>';
}

export function allowsSummonFlash(flashOn, reducedMotion) {
  return flashOn && !reducedMotion;
}

/** A summon. Silhouettes roll, then rare and better glow in their grade colour before the face shows,
    then the card lands with its grade's effect. The card is placed once and stays (no second pop). */
export async function reveal(run, widgets, sfx, box, draw, o) {
  const { id } = draw;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (draw.kind !== 'join' || reducedMotion.matches) {
    box.insertAdjacentHTML(o?.first ? 'afterbegin' : 'beforeend', drawCard(run, widgets, draw));
    (o?.first ? box.firstElementChild : box.lastElementChild).scrollIntoView({ block: 'nearest' });
    sfx.awaken();
    return;
  }
  const { card, sprite } = widgets;
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
  wrap.innerHTML = (g === 'legend' ? '<i class="rays"></i>' : '') + drawCard(run, widgets, draw) +
    (sparks ? '<span class="sparkle">' + Array.from({ length: sparks }, () => {
      const a = Math.random() * Math.PI * 2, r = 26 + Math.random() * 46;
      return '<b style="left:' + Math.round(8 + Math.random() * 84) + '%;top:' + Math.round(15 + Math.random() * 70) + '%;--dx:' + Math.round(Math.cos(a) * r) + 'px;--dy:' + Math.round(Math.sin(a) * r) + 'px;animation-delay:' + Math.round(Math.random() * 160) + 'ms"></b>';
    }).join('') + '</span>' : '');
  slot.replaceWith(wrap);
  if (g === 'legend') sfx.jackpot();
  else sfx.awaken();
  const flashOn = !document.documentElement.classList.contains('meta-no-flash');
  if (allowsSummonFlash(flashOn, reducedMotion.matches)) {
    if (g === 'legend') flashFrame('gold');
    else if (g === 'epic') flashFrame('violet');
  }
  await sleep(g === 'legend' ? 900 : g === 'epic' ? 420 : 240);
}
function flashFrame(kind) { const f = document.createElement('div'); f.className = 'flash ' + kind; $('#frame').appendChild(f); setTimeout(() => f.remove(), 800); }
