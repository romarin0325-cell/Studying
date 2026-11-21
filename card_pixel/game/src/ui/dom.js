export const $ = (q, r) => (r || document).querySelector(q);
export const $$ = (q, r) => Array.from((r || document).querySelectorAll(q));
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const svg = d => '<svg viewBox="0 0 12 12" width="14" height="14" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="' + d + '"/></svg>';
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export function show(id) {
  const before = $('.screen.on')?.id;
  $$('.screen').forEach(screen => {
    const on = screen.id === id;
    if (!on && screen.classList.contains('on') && !['title', 'battle'].includes(screen.id)) {
      screen.innerHTML = '';
    }
    screen.classList.toggle('on', on);
  });
  if (before && before !== id) wipe();
}

/* A navy band sweeps across when the screen changes. It never takes clicks. */
function wipe() {
  const frame = $('#frame');
  if (!frame || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  frame.querySelector(':scope > .wipe')?.remove();
  const band = document.createElement('div');
  band.className = 'wipe';
  band.setAttribute('aria-hidden', 'true');
  frame.append(band);
  setTimeout(() => band.remove(), 520);
}
