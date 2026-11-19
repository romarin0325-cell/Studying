// Builds card_pixel/plan/renewal-plan.html (one offline file) from plan-content.md, src/page.css, src/page.js
// and the pilot sprites. Run from anywhere: node card_pixel/plan/build-plan.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const rd = p => fs.readFileSync(path.join(here, p));
const png = buf => 'data:image/png;base64,' + buf.toString('base64');

/* ---------- assets ---------- */
const meta = JSON.parse(rd('assets/sprites.json'));
const sp = {};
for (const [file, m] of Object.entries(meta)) {
  sp[file.replace('.png', '')] = { src: png(rd('assets/' + file)), w: m.width, h: m.height, cx: m.bodyCenterX, fy: m.feetBaselineY };
}
const pilot = {};
for (const n of ['ash', 'luna', 'red_dragon', 'guardian']) {
  pilot[n] = {};
  for (const r of ['R1', 'R2']) {
    const buf = rd(`pixel-pilot/sprites/${n}-right-${r}-64.png`);
    const md = await sharp(buf).metadata();
    pilot[n][r] = { src: png(buf), w: md.width, h: md.height };
  }
}
// Small character icons for the pool views: the trial's idle sprites, fitted into 64x64 cells.
// (Until 2026-11-18 these came from the old prototype's atlas in card_pixel/generated/, which is not committed.)
const slice = path.join(repo, 'card_pixel/game/assets');
const sliceMeta = JSON.parse(fs.readFileSync(path.join(slice, 'sprites.json'), 'utf8'));
const minis = [];
for (const [file, m] of Object.entries(sliceMeta).filter(([f, m]) => /-idle\.png$/.test(f) && (m.kind || 'ally') === 'ally').slice(0, 40)) {
  const scale = Math.min(1, 64 / m.height), w = Math.max(1, Math.round(m.width * scale)), h = Math.max(1, Math.round(m.height * scale));
  const icon = await sharp(path.join(slice, file)).resize(w, h, { kernel: 'nearest' }).toBuffer();
  minis.push(png(await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: icon, left: Math.round((64 - w) / 2), top: 64 - h }]).png().toBuffer()));
}

/* ---------- markdown ---------- */
const TAGS = { '사실': 't-fact', '해석': 't-view', '초안': 't-draft', '미확인': 't-unk', '결정 필요': 't-need' };
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = s => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\[(사실|해석|초안|미확인|결정 필요)\]/g, (_, t) => `<span class="tag ${TAGS[t]}">${t}</span>`)
  .replace(/https?:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);

const CONCLUSION = {
  0: '리뉴얼은 타당하다. 핵심은 도트가 아니라 릴레이를 보이게 하는 것이다.',
  1: '잘 팔린 인디는 3초 만에 이해되고, 숫자가 불어나고, 잃을 것이 있다.',
  2: '보상이 보이는 선택, 죽음의 무게, 출발 전 편성.',
  3: '재미는 이미 있다. 13번 눌러야 닿고, 글자 로그 속에 숨어 있을 뿐이다.',
  4: '타당. 전투 코어는 그대로 쓰고 원정 구조는 새로 짠다.',
  5: '릴레이 · 한 층 한 선택 · 살려서 데려온다.',
  6: '이미지 생성으로 3포즈를 만들고 격자를 바로잡는다. 움직임은 코드로.',
  7: '전투 한 판과 5층 입문 던전부터.'
};
const NAV = ['요약', '인기 인디', '로그라이트', '진단', '타당성', '설계', '아트', '순서'];
const START = { '5.2': ['v-loop'], '5.3': ['v-tl'], '5.5': ['v-battle'] };
const END = { '약점': ['v-path'], '5.4': ['v-doors', 'v-ph-doors'], '5.6': ['v-ph-summon'], '5.7': ['v-pool', 'v-ph-pool'], '5.8': ['v-ph-return'], '5.13': ['v-ph-hub'], '6.2': ['v-routes'] };
const MODE_COLOR = [['기본 기능이 됨', 'var(--gold)'], ['유지', 'var(--moss)'], ['흡수', 'var(--aqua)'], ['별책', 'var(--violet);color:#fff'], ['후순위', '#b9b3c4'], ['삭제', 'var(--coral)']];
const keyOf = title => { const m = title.match(/^(\d+\.\d+)/); return m ? m[1] : title.split(' ')[0]; };
const slots = ids => (ids || []).map(id => `<div id="${id}"></div>`).join('');

const lines = rd('plan-content.md').toString('utf8').split(/\r?\n/);
let out = '', pitch = '';
let chapter = null, sub = null, cardOpen = false;
const stack = [];
const closeLists = (indent = -1) => { while (stack.length && stack[stack.length - 1].indent > indent) out += '</li></' + stack.pop().type + '>'; };
const endSub = () => { closeLists(); if (sub) out += slots(END[sub]); if (cardOpen) { out += '</div></article>'; cardOpen = false; } sub = null; };
const endChapter = () => { endSub(); if (chapter !== null) out += '</div></section>'; };

function table(rows) {
  const cells = rows.filter(r => !/^\|\s*:?-{2,}/.test(r)).map(r => r.replace(/^\||\|\s*$/g, '').split('|').map(c => c.trim()));
  const head = cells[0];
  const isModes = head.includes('기존 모드') && head.includes('처리');
  let tally = '';
  if (isModes) {
    const count = {};
    for (const r of cells.slice(1)) { const k = MODE_COLOR.find(([w]) => r[2].startsWith(w)); if (k) count[k[0]] = (count[k[0]] || 0) + 1; }
    tally = '<div class="tally">' + MODE_COLOR.filter(([w]) => count[w]).map(([w, c]) => `<span class="chip" style="background:${c}">${w} ${count[w]}</span>`).join('') + '</div>';
  }
  const body = cells.slice(1).map(r => '<tr>' + r.map((c, i) => {
    if (isModes && i === 2) { const k = MODE_COLOR.find(([w]) => c.startsWith(w)); return `<td><span class="chip" style="background:${k ? k[1] : '#ddd'}">${inline(c)}</span></td>`; }
    return `<td>${inline(c)}</td>`;
  }).join('') + '</tr>').join('');
  return tally + '<div class="tablewrap"><table><thead><tr>' + head.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' + body + '</tbody></table></div>';
}

for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l.startsWith('|')) { closeLists(); const rows = []; while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]); i--; if (chapter !== null) out += table(rows); continue; }
  const li = l.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
  if (li && chapter !== null) {
    const indent = li[1].length, type = /\d/.test(li[2]) ? 'ol' : 'ul';
    closeLists(indent);
    if (stack.length && stack[stack.length - 1].indent === indent) out += '</li>';
    else { stack.push({ indent, type }); out += `<${type}${chapter === 'src' ? ' class="src"' : ''}>`; }
    out += `<li${li[3].startsWith('**가져올 것**') ? ' class="take"' : ''}>` + inline(li[3]);
    continue;
  }
  closeLists();
  if (!l.trim() || l.trim() === '---') continue;
  const h = l.match(/^(#{1,3})\s+(.*)$/);
  if (h) {
    const level = h[1].length, title = h[2];
    if (level === 1) continue;
    if (level === 2) {
      endChapter();
      const m = title.match(/^(\d+)\.\s*(.*)$/);
      chapter = m ? +m[1] : 'src';
      out += `<section class="chapter" id="ch${chapter}"><div class="band"><span class="no">${m ? m[1] : '※'}</span><div><h2>${inline(m ? m[2] : title)}</h2>${m ? `<p>${CONCLUSION[chapter]}</p>` : ''}</div></div><div class="body">`;
      continue;
    }
    endSub();
    sub = keyOf(title);
    if (chapter === 1 || chapter === 2) { out += `<article class="rcard${title.startsWith('구조 참고') ? ' small' : ''}"><h3>${inline(title)}</h3><div class="in">`; cardOpen = true; }
    else out += `<h3>${inline(title)}</h3>`;
    out += slots(START[sub]);
    continue;
  }
  if (chapter === null) continue; // intro lines are rebuilt in the hero
  if (l.startsWith('> ')) { if (!pitch) pitch = l.slice(2); out += `<blockquote>${inline(l.slice(2))}</blockquote>`; continue; }
  out += `<p>${inline(l)}</p>`;
}
endChapter();

/* ---------- page ---------- */
const img = (k, h) => { const m = sp[k]; const s = h / m.h; return `<img alt="" src="${m.src}" width="${Math.round(m.w * s)}" height="${Math.round(m.h * s)}">`; };
const hero = `<header class="hero">
<div class="kicker">DREAMWEAVER · card → card_pixel</div>
<h1>리뉴얼 기획서</h1>
<div class="sub">도트 릴레이 던전</div>
<div class="meta">작성 2026-11-15 · 글 원본 card_pixel/plan/plan-content.md</div>
<div class="lineup"><span class="w3">${img('luna-idle', 96)}</span><span class="arrow">◀</span><span class="w2">${img('ash-idle', 96)}</span><span class="arrow">◀</span><span>${img('red_dragon-idle', 144)}</span></div>
<div class="pitch">${inline(pitch)}</div>
<div class="legend"><span><span class="tag t-fact">사실</span> 코드·자료에서 확인</span><span><span class="tag t-view">해석</span> 내 판단</span><span><span class="tag t-draft">초안</span> 시험 전 수치</span><span><span class="tag t-unk">미확인</span> 확인하지 못함</span><span><span class="tag t-need">결정 필요</span> 사용자 결정</span></div>
</header>`;
const nav = '<nav class="nav">' + NAV.map((n, i) => `<a href="#ch${i}"><b>${i}</b>${n}</a>`).join('') + '</nav>';
const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DREAMWEAVER 리뉴얼 기획서 — 도트 릴레이 던전</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/galmuri/dist/galmuri.css">
<style>${rd('src/page.css').toString('utf8')}</style></head>
<body>${nav}<main>${hero}${out}<footer>글 원본: card_pixel/plan/plan-content.md · 이 페이지는 build-plan.mjs로 다시 만들 수 있다.</footer></main>
<script>const A=${JSON.stringify({ sp, pilot, minis })};</script>
<script>${rd('src/page.js').toString('utf8')}</script>
</body></html>`;
fs.writeFileSync(path.join(here, 'renewal-plan.html'), html);
console.log('renewal-plan.html', (html.length / 1024).toFixed(0) + ' KB', 'minis', minis.length);
