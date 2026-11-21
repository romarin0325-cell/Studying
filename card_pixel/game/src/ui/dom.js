export const $ = (q, r) => (r || document).querySelector(q);
export const $$ = (q, r) => Array.from((r || document).querySelectorAll(q));
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const svg = d => '<svg viewBox="0 0 12 12" width="14" height="14" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="' + d + '"/></svg>';
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export function show(id) {
  $$('.screen').forEach(screen => {
    const on = screen.id === id;
    if (!on && screen.classList.contains('on') && !['title', 'battle'].includes(screen.id)) {
      screen.innerHTML = '';
    }
    screen.classList.toggle('on', on);
  });
}
