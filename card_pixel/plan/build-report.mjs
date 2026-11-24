// Builds an owner report page (one offline HTML file with before/after screenshots) from a content module.
// Usage: node card_pixel/plan/build-report.mjs [--content <module in plan/>] [<before shots dir> <after shots dir>]
//   default content: entry-report-content.mjs (the 2026-11-21 night report → entry-report.html)
// The content module exports REPORT = { title?, subtitle, out, store, toc, summary, answers?, requests, screens, decisions,
//   checked, unchecked, files }. With the two directories the builder first refreshes <store>/{before,after}/*.jpg
//   (390 px wide, quality 82) from <dir>/<name>.png. A shot missing on one side is shown alone. A screen with `wide: true`
//   (a composite such as a row of effect frames) is stored 780 px wide and spans the whole row.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { esc, pageShell } from './page-kit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const contentAt = args.indexOf('--content');
const contentFile = contentAt >= 0 ? args.splice(contentAt, 2)[1] : 'entry-report-content.mjs';
const { REPORT } = await import(pathToFileURL(path.join(here, contentFile)).href);
const [beforeDir, afterDir] = args;
const store = path.join(here, REPORT.store ?? 'entry-review');
const shotFile = (side, name) => path.join(store, side, name + '.jpg');
const dataUrl = file => 'data:image/jpeg;base64,' + fs.readFileSync(file).toString('base64');

async function refresh() {
  for (const side of ['before', 'after']) fs.mkdirSync(path.join(store, side), { recursive: true });
  for (const { before, after, wide } of REPORT.screens) {
    for (const [side, dir, name] of [['before', beforeDir, before], ['after', afterDir, after]]) {
      if (!name) continue;
      const source = path.join(dir, name + '.png');
      if (!fs.existsSync(source)) throw new Error('missing ' + source);
      await sharp(source).resize({ width: wide ? 780 : 390 }).jpeg({ quality: 82, mozjpeg: true }).toFile(shotFile(side, name));
    }
  }
}
if (beforeDir && afterDir) await refresh();

const figure = (side, name, title) => name && fs.existsSync(shotFile(side, name))
  ? `<figure class="${side}"><figcaption>${side === 'before' ? '이전' : '이후'}</figcaption>` +
    `<img loading="lazy" alt="${esc(title)} ${side === 'before' ? '이전' : '이후'}" src="${dataUrl(shotFile(side, name))}"></figure>`
  : '';
const screens = REPORT.screens.map(({ before, after, title, note, wide }, index) => `
  <article class="pair${before ? '' : ' only-after'}${wide ? ' wide' : ''}" id="s${index}">
    <header><b>${index + 1}. ${esc(title)}</b><span>${esc(note)}</span></header>
    <div class="shots">${figure('before', before, title)}${figure('after', after, title)}</div>
  </article>`).join('');
const table = (head, rows) => `<div class="table"><table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>` +
  `<tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const list = lines => `<ul class="plain">${lines.map(line => `<li>${esc(line)}</li>`).join('')}</ul>`;
// Owner questions answered in plain words; sources are shown as text because links do not open for the owner.
const answers = (REPORT.answers ?? []).map(({ q, a, sources = [] }) => `
  <article class="card answer"><h3>${esc(q)}</h3>${a.map(line => `<p>${esc(line)}</p>`).join('')}
    ${sources.length ? `<p class="src">근거: ${sources.map(([label, where]) => `${esc(label)} <code>${esc(where)}</code>`).join(' · ')}</p>` : ''}</article>`).join('');

let commit = '';
try { commit = execSync('git rev-parse --short HEAD', { cwd: here }).toString().trim(); } catch { commit = ''; }

const body = `
<section id="summary"><h2>한눈에</h2><div class="card">${list(REPORT.summary)}</div></section>
${answers ? `<section id="answers"><h2>질문에 대한 답</h2><div class="cards">${answers}</div></section>` : ''}
<section id="requests"><h2>요청별 처리</h2>${table(['요청', '한 일', '어디서 보나', '상태'], REPORT.requests)}</section>
<section id="screens"><h2>화면 전후</h2>
<div class="modes" role="group" aria-label="보기 방식">
<button type="button" data-mode="both" aria-pressed="true">나란히</button><button type="button" data-mode="after" aria-pressed="false">이후만</button><button type="button" data-mode="before" aria-pressed="false">이전만</button></div>
<div class="pairs">${screens}</div></section>
<section id="decisions"><h2>제가 판단한 것</h2>${table(['항목', '결정', '이유', '바꾸고 싶으면'], REPORT.decisions)}</section>
<section id="checks"><h2>확인한 것 · 못 한 것</h2>
<div class="card"><b>확인한 것</b>${list(REPORT.checked)}<b>확인하지 못한 것</b>${list(REPORT.unchecked)}</div></section>
<section id="files"><h2>파일</h2><div class="card"><ul class="plain">${REPORT.files.map(([label, file]) => `<li>${esc(label)}<br><small class="path">${esc(file)}</small></li>`).join('')}</ul></div></section>
<div id="zoom" role="dialog" aria-label="확대"><img alt=""></div>`;

const css = `
ul.plain { margin: 6px 0; padding-left: 20px; } ul.plain li { margin: 4px 0; }
.answer h3 { font-size: 15.5px; color: var(--navy); } .answer p { margin: 6px 0; }
.table th { white-space: nowrap; } .table td { font-size: 14px; }
.modes { position: sticky; top: 46px; z-index: 2; display: flex; gap: 6px; padding: 8px 0; background: #ebe5ffee; }
.modes button { padding: 6px 12px; border: 0; background: #fff; color: var(--navy); font: inherit; font-size: 13px; box-shadow: 0 0 0 var(--u) var(--navy); cursor: pointer; }
.modes button[aria-pressed="true"] { background: var(--aqua); color: #fff; box-shadow: 0 0 0 var(--u) var(--aqua-lo); }
.pairs { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 540px), 1fr)); gap: 14px; }
.pair { background: #fff; box-shadow: 0 0 0 var(--u) var(--navy); padding: 10px; }
.pair header { display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; }
.pair header b { color: var(--navy); } .pair header span { color: var(--ink2); font-size: 13px; }
.shots { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.pair.only-after .shots { grid-template-columns: minmax(0, 260px); justify-content: center; }
.pair.wide { grid-column: 1 / -1; } .pair.wide .shots { grid-template-columns: minmax(0, 780px); }
figure { margin: 0; } figcaption { font-size: 12px; color: var(--ink2); margin-bottom: 2px; }
figure.after figcaption { color: var(--aqua-lo); font-weight: 700; }
figure img { width: 100%; display: block; cursor: zoom-in; box-shadow: 0 0 0 var(--u) var(--line); }
body.mode-after figure.before, body.mode-before figure.after { display: none; }
body.mode-after .shots, body.mode-before .shots { grid-template-columns: minmax(0, 320px); justify-content: center; }
#zoom { position: fixed; inset: 0; background: rgba(20,16,60,.88); display: none; align-items: center; justify-content: center; z-index: 9; }
#zoom.on { display: flex; } #zoom img { max-width: 96vw; max-height: 96vh; image-rendering: pixelated; }
small.path { color: var(--ink2); word-break: break-all; }
`;
const script = `
document.body.classList.add('mode-both');
for (const button of document.querySelectorAll('.modes button')) button.addEventListener('click', () => {
  document.body.classList.remove('mode-both', 'mode-after', 'mode-before'); document.body.classList.add('mode-' + button.dataset.mode);
  for (const other of document.querySelectorAll('.modes button')) other.setAttribute('aria-pressed', String(other === button));
});
const zoom = document.querySelector('#zoom');
for (const img of document.querySelectorAll('figure img')) img.addEventListener('click', () => { zoom.querySelector('img').src = img.src; zoom.classList.add('on'); });
zoom.addEventListener('click', () => zoom.classList.remove('on'));
addEventListener('keydown', event => { if (event.key === 'Escape') zoom.classList.remove('on'); });
`;

const html = pageShell({
  title: REPORT.title ?? '다음은 너 · 이번 작업 보고서',
  subtitle: REPORT.subtitle + (commit ? ' · 커밋 ' + commit : ''),
  toc: REPORT.toc,
  css,
  body,
  script
});
const out = REPORT.out ?? 'entry-report.html';
fs.writeFileSync(path.join(here, out), html);
console.log(out, (Buffer.byteLength(html) / 1024).toFixed(0) + ' KB', REPORT.screens.length + ' screens');
