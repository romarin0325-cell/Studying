// Builds plan/entry-report.html: the owner's report for the 2026-11-21 night work (one offline file).
// Usage: node card_pixel/plan/build-entry-report.mjs [<before shots dir> <after shots dir>]
// With the two directories it first refreshes plan/entry-review/{before,after}/*.jpg (390 px, quality 82).
// Shots missing on one side are shown alone (new screens have no "before").
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { REPORT } from './entry-report-content.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const store = path.join(here, 'entry-review');
const [beforeDir, afterDir] = process.argv.slice(2);
const esc = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shotFile = (side, name) => path.join(store, side, name + '.jpg');
const dataUrl = file => 'data:image/jpeg;base64,' + fs.readFileSync(file).toString('base64');

async function refresh() {
  for (const side of ['before', 'after']) fs.mkdirSync(path.join(store, side), { recursive: true });
  for (const { before, after } of REPORT.screens) {
    for (const [side, dir, name] of [['before', beforeDir, before], ['after', afterDir, after]]) {
      if (!name) continue;
      const source = path.join(dir, name + '.png');
      if (!fs.existsSync(source)) throw new Error('missing ' + source);
      await sharp(source).resize({ width: 390 }).jpeg({ quality: 82, mozjpeg: true }).toFile(shotFile(side, name));
    }
  }
}

if (beforeDir && afterDir) await refresh();

const figure = (side, name, title) => name && fs.existsSync(shotFile(side, name))
  ? `<figure class="${side}"><figcaption>${side === 'before' ? '이전' : '이후'}</figcaption>` +
    `<img loading="lazy" alt="${esc(title)} ${side === 'before' ? '이전' : '이후'}" src="${dataUrl(shotFile(side, name))}"></figure>`
  : '';

const screens = REPORT.screens.map(({ before, after, title, note }, index) => `
  <article class="pair${before ? '' : ' only-after'}" id="s${index}">
    <header><b>${index + 1}. ${esc(title)}</b><span>${esc(note)}</span></header>
    <div class="shots">${figure('before', before, title)}${figure('after', after, title)}</div>
  </article>`).join('');

const table = (head, rows) => `<div class="tbl"><table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>` +
  `<tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

let commit = '';
try { commit = execSync('git rev-parse --short HEAD', { cwd: here }).toString().trim(); } catch { commit = ''; }

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>다음은 너 · 변경 보고서</title>
<style>
:root { --navy: #29266a; --navy2: #3f3a8f; --ink: #26244f; --ink2: #5e5b8c; --paper: #fff; --paper2: #f7f5ff; --line: #cdc4f0;
  --aqua: #1fc6c1; --aqua-lo: #0f9aaa; --gold: #ffc23a; --coral: #e23a52; }
* { box-sizing: border-box; }
body { margin: 0; background: #ebe5ff; color: var(--ink); font: 15px/1.6 system-ui, 'Malgun Gothic', sans-serif; }
header.top { background: var(--navy); color: #fff; padding: 18px 16px 16px; }
header.top h1 { margin: 0 0 6px; font-size: 22px; }
header.top p { margin: 0; color: #d9d4ff; font-size: 13px; }
main { max-width: 1180px; margin: 0 auto; padding: 12px 16px 40px; }
nav.toc { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 14px; }
nav.toc a { padding: 4px 10px; background: #fff; color: var(--navy); text-decoration: none; box-shadow: 0 0 0 2px var(--navy); font-size: 13px; }
section { margin: 18px 0; }
h2 { display: inline-block; margin: 0 0 10px; padding: 4px 22px 4px 12px; color: #fff; font-size: 17px;
  background: var(--navy); clip-path: polygon(0 0, 100% 0, calc(100% - 12px) 100%, 0 100%); }
.card { background: var(--paper); box-shadow: 0 0 0 2px var(--navy), 0 4px 0 2px rgba(41,38,106,.18); padding: 12px 14px; margin: 10px 2px; }
.card p { margin: 6px 0; }
ul.plain { margin: 6px 0; padding-left: 20px; }
ul.plain li { margin: 4px 0; }
.tbl { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; background: #fff; font-size: 14px; }
th, td { border: 2px solid var(--line); padding: 6px 8px; text-align: left; vertical-align: top; }
th { background: var(--paper2); color: var(--navy2); white-space: nowrap; }
.modes { position: sticky; top: 0; z-index: 2; display: flex; gap: 6px; padding: 8px 0; background: #ebe5ff; }
.modes button { padding: 6px 12px; border: 0; background: #fff; color: var(--navy); font: inherit; font-size: 13px; box-shadow: 0 0 0 2px var(--navy); cursor: pointer; }
.modes button[aria-pressed="true"] { background: var(--aqua); color: #fff; box-shadow: 0 0 0 2px var(--aqua-lo); }
.pairs { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 540px), 1fr)); gap: 14px; }
.pair { background: #fff; box-shadow: 0 0 0 2px var(--navy); padding: 10px; }
.pair header { display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; }
.pair header b { color: var(--navy); }
.pair header span { color: var(--ink2); font-size: 13px; }
.shots { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.pair.only-after .shots { grid-template-columns: minmax(0, 260px); justify-content: center; }
figure { margin: 0; }
figcaption { font-size: 12px; color: var(--ink2); margin-bottom: 2px; }
figure.after figcaption { color: var(--aqua-lo); font-weight: 700; }
figure img { width: 100%; display: block; cursor: zoom-in; box-shadow: 0 0 0 2px var(--line); }
body.mode-after figure.before, body.mode-before figure.after { display: none; }
body.mode-after .shots, body.mode-before .shots { grid-template-columns: minmax(0, 320px); justify-content: center; }
#zoom { position: fixed; inset: 0; background: rgba(20,16,60,.88); display: none; align-items: center; justify-content: center; z-index: 9; }
#zoom.on { display: flex; }
#zoom img { max-width: 96vw; max-height: 96vh; image-rendering: pixelated; }
.tag { display: inline-block; padding: 0 6px; font-size: 12px; color: #fff; background: var(--aqua-lo); }
.tag.warn { background: var(--coral); }
small.path { color: var(--ink2); word-break: break-all; }
</style></head>
<body class="mode-both">
<header class="top"><h1>다음은 너 · 이번 작업 보고서</h1>
<p>${esc(REPORT.subtitle)}${commit ? ' · 커밋 ' + esc(commit) : ''}</p></header>
<main>
<nav class="toc">${REPORT.toc.map(([id, label]) => `<a href="#${id}">${esc(label)}</a>`).join('')}</nav>

<section id="summary"><h2>한눈에</h2><div class="card"><ul class="plain">${REPORT.summary.map(line => `<li>${esc(line)}</li>`).join('')}</ul></div></section>

<section id="requests"><h2>요청별 처리</h2>${table(['요청', '한 일', '어디서 보나', '상태'], REPORT.requests)}</section>

<section id="screens"><h2>화면 전후</h2>
<div class="modes" role="group" aria-label="보기 방식">
<button type="button" data-mode="both" aria-pressed="true">나란히</button><button type="button" data-mode="after" aria-pressed="false">이후만</button><button type="button" data-mode="before" aria-pressed="false">이전만</button></div>
<div class="pairs">${screens}</div></section>

<section id="decisions"><h2>제가 판단한 것</h2>${table(['항목', '결정', '이유', '바꾸고 싶으면'], REPORT.decisions)}</section>

<section id="checks"><h2>확인한 것 · 못 한 것</h2>
<div class="card"><b>확인한 것</b><ul class="plain">${REPORT.checked.map(line => `<li>${esc(line)}</li>`).join('')}</ul>
<b>확인하지 못한 것</b><ul class="plain">${REPORT.unchecked.map(line => `<li>${esc(line)}</li>`).join('')}</ul></div></section>

<section id="files"><h2>파일</h2><div class="card"><ul class="plain">${REPORT.files.map(([label, file]) => `<li>${esc(label)}<br><small class="path">${esc(file)}</small></li>`).join('')}</ul></div></section>
</main>
<div id="zoom" role="dialog" aria-label="확대"><img alt=""></div>
<script>
for (const button of document.querySelectorAll('.modes button')) button.addEventListener('click', () => {
  document.body.className = 'mode-' + button.dataset.mode;
  for (const other of document.querySelectorAll('.modes button')) other.setAttribute('aria-pressed', String(other === button));
});
const zoom = document.querySelector('#zoom');
for (const img of document.querySelectorAll('figure img')) img.addEventListener('click', () => { zoom.querySelector('img').src = img.src; zoom.classList.add('on'); });
zoom.addEventListener('click', () => zoom.classList.remove('on'));
addEventListener('keydown', event => { if (event.key === 'Escape') zoom.classList.remove('on'); });
</script>
</body></html>
`;
fs.writeFileSync(path.join(here, 'entry-report.html'), html);
console.log('entry-report.html', (Buffer.byteLength(html) / 1024).toFixed(0) + ' KB', REPORT.screens.length + ' screens');
