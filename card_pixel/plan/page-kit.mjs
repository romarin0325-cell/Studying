// Shared look for the offline review pages in card_pixel/plan (workspace map, skill motion audit, …).
// Pixel frames drawn with box-shadow in 2px units, navy stair plates for headings, the game's pastel sky.
// Usage: import { esc, pageShell } from './page-kit.mjs'; pageShell({ title, subtitle, toc, css, body, script })

export const esc = text => String(text ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const BASE_CSS = `
:root { --u: 2px; --navy: #29266a; --navy2: #3f3a8f; --ink: #26244f; --ink2: #5e5b8c; --paper: #fff; --paper2: #f7f5ff; --line: #cdc4f0;
  --aqua: #1fc6c1; --aqua-lo: #0f9aaa; --gold: #ffc23a; --gold-ink: #6b3a00; --coral: #e23a52; --pink: #ff5c9d; --violet: #8a6cff; }
* { box-sizing: border-box; }
body { margin: 0; color: var(--ink); font: 15px/1.6 system-ui, 'Malgun Gothic', sans-serif;
  background: linear-gradient(180deg, #d6eaff 0 12%, #e2e5ff 12% 30%, #ebe5ff 30% 60%, #f6e5f6 60% 100%) fixed; }
header.top { background: var(--navy); color: #fff; padding: 18px 16px 14px; box-shadow: 0 var(--u) 0 #1b1850; }
header.top h1 { margin: 0; font-size: 22px; letter-spacing: .5px; }
header.top p { margin: 4px 0 0; color: #d9d4ff; font-size: 13px; }
nav.toc { position: sticky; top: 0; z-index: 3; display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 16px; background: #ebe5ffee; box-shadow: 0 var(--u) 0 var(--line); }
nav.toc a { padding: 3px 10px; background: #fff; color: var(--navy); text-decoration: none; font-size: 13px; box-shadow: 0 0 0 var(--u) var(--navy); }
main { max-width: 1180px; margin: 0 auto; padding: 8px 16px 48px; }
section { margin: 22px 0; scroll-margin-top: 90px; }
h2 { display: inline-block; margin: 0 0 10px; padding: 4px 24px 4px 12px; color: #fff; font-size: 17px; background: var(--navy);
  clip-path: polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%); }
h3 { margin: 0 0 6px; font-size: 15px; color: var(--navy2); }
.cards { display: grid; gap: 12px; }
.cards.three { grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); }
.cards.two { grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr)); }
.card { background: var(--paper); padding: 10px 12px; margin: var(--u); box-shadow: 0 0 0 var(--u) var(--navy), 0 calc(3 * var(--u)) 0 var(--u) rgba(41,38,106,.18); }
.card.slim p { margin: 4px 0; }
.card ul { margin: 4px 0; padding-left: 18px; }
p { margin: 4px 0; }
.dim { color: var(--ink2); font-size: 13px; }
.src { color: var(--ink2); font-size: 12px; word-break: break-all; }
.warn { color: #b45309; font-weight: 700; } .ok { color: var(--aqua-lo); font-weight: 700; } .need { color: var(--coral); font-size: 13px; }
.arrow { color: var(--aqua-lo); font-weight: 700; }
code { font: 12.5px/1.4 ui-monospace, Consolas, monospace; background: var(--paper2); padding: 0 3px; word-break: break-all; }
.tag { display: inline-block; padding: 0 7px; font-size: 12px; font-weight: 700; color: #fff; background: var(--ink2);
  clip-path: polygon(2px 0, calc(100% - 2px) 0, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 0 calc(100% - 2px), 0 2px); }
.tag.aqua { background: var(--aqua-lo); } .tag.navy { background: var(--navy2); } .tag.gold { background: var(--gold); color: var(--gold-ink); }
.tag.coral { background: var(--coral); } .tag.pink { background: var(--pink); } .tag.violet { background: var(--violet); } .tag.grey { background: #9aa1b8; }
.split { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); gap: 14px; }
.filters { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 8px; }
.filters input { flex: 1 1 220px; min-width: 0; padding: 6px 8px; font: inherit; border: 0; box-shadow: 0 0 0 var(--u) var(--navy); }
.filters button { padding: 4px 10px; border: 0; background: #fff; color: var(--navy); font: inherit; font-size: 13px; cursor: pointer; box-shadow: 0 0 0 var(--u) var(--navy); }
.filters button[aria-pressed="true"] { background: var(--navy); color: #fff; }
.table { overflow-x: auto; background: #fff; box-shadow: 0 0 0 var(--u) var(--navy); }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { padding: 5px 8px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
th { position: sticky; top: 0; background: var(--paper2); color: var(--navy2); }
tr[hidden], [hidden] { display: none !important; }
`;

// One standalone page: shared base styles first, then the page's own rules.
export function pageShell({ title, subtitle, toc = [], css = '', body, script = '' }) {
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>${BASE_CSS}${css}</style></head>
<body>
<header class="top"><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></header>
${toc.length ? `<nav class="toc">${toc.map(([id, label]) => `<a href="#${id}">${esc(label)}</a>`).join('')}</nav>` : ''}
<main>${body}</main>
${script ? `<script>${script}</script>` : ''}
</body></html>
`;
}

// Tiny pixel icons: draw on an n×n grid with a few primitives, then emit one crisp SVG.
// Colours are keys of `palette`; later draws overwrite earlier ones.
export function pixelIcon(n, palette, draw, scale = 3) {
  const cells = Array.from({ length: n }, () => Array(n).fill(null));
  const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < n && y < n) cells[y][x] = c; };
  const line = (x0, y0, x1, y1, c) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++) set(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps, c);
  };
  const ring = (cx, cy, r, c, from = 0, to = 360, width = 1) => {
    for (let w = 0; w < width; w++) for (let a = from; a <= to; a += 2) {
      const t = a * Math.PI / 180; set(cx + Math.cos(t) * (r - w), cy + Math.sin(t) * (r - w), c);
    }
  };
  const disc = (cx, cy, r, c) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) set(cx + x, cy + y, c); };
  draw({ set, line, ring, disc });
  let rects = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n;) {
    const c = cells[y][x];
    if (!c) { x++; continue; }
    let w = 1; while (x + w < n && cells[y][x + w] === c) w++;
    rects += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${palette[c]}"/>`; x += w;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" class="px-icon" viewBox="0 0 ${n} ${n}" width="${n * scale}" height="${n * scale}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}
