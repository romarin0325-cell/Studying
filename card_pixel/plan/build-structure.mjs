// Build an offline structure map from the checked-in facts. Run with Node 24.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const facts = JSON.parse(await fs.readFile(path.join(here, 'structure.json'), 'utf8'));
const esc = value => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[c]);
const byId = new Map(facts.layers.map(layer => [layer.id, layer]));

// Fail early rather than silently dropping an arrow or an impact target.
if (byId.size !== facts.layers.length) throw new Error('Duplicate layer id');
for (const key of ['layers', 'flows', 'assets', 'checks', 'docs', 'routing', 'unverified']) {
  if (!Array.isArray(facts[key]) || !facts[key].length) throw new Error(`Missing list: ${key}`);
}
for (const layer of facts.layers) {
  if (!layer.title || !layer.role || !layer.files.length) throw new Error(`Incomplete layer: ${layer.id}`);
  for (const id of layer.changes_here_affect) {
    if (!byId.has(id) || id === layer.id) throw new Error(`Invalid impact: ${layer.id} -> ${id}`);
  }
}
for (const flow of facts.flows) {
  if (!byId.has(flow.from) || !byId.has(flow.to) || !flow.label) throw new Error('Invalid flow');
}

// Fixed rows keep the reading order stable; only this panel scrolls on phones.
const layout = {
  rules: [40, 30, 635], uis: [750, 30],
  bundle: [40, 200], bridge: [395, 200], art: [750, 200],
  roster: [40, 370], run: [395, 370], sprites: [750, 370],
  stage: [40, 540], screens: [395, 540],
  build: [40, 710], page: [395, 710], tests: [750, 710],
  sim: [750, 880]
};
const colors = {
  rules: 'gold', uis: 'gold', bundle: 'aqua', bridge: 'aqua',
  roster: 'violet', run: 'violet', stage: 'coral', screens: 'coral',
  build: 'gold', page: 'gold', art: 'aqua', sprites: 'aqua', tests: 'violet', sim: 'violet'
};
const boxes = Object.fromEntries(facts.layers.map(layer => {
  const position = layout[layer.id];
  if (!position) throw new Error(`Missing layout: ${layer.id}`);
  const [x, y, w = 280] = position;
  return [layer.id, { x, y, w, h: 110 }];
}));
const center = id => {
  const b = boxes[id];
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
};

// Special routes use the gaps between rows and columns, never a node interior.
function route(flow) {
  const a = boxes[flow.from], b = boxes[flow.to];
  const ac = center(flow.from), bc = center(flow.to);
  const key = `${flow.from}:${flow.to}`;
  const special = {
    'rules:bundle': { points: [[180, 140], [180, 200]], label: [180, 170] },
    'bridge:screens': { points: [[675, 265], [708, 265], [708, 595], [675, 595]], label: [708, 505] },
    'screens:build': { points: [[490, 650], [490, 680], [250, 680], [250, 710]], label: [370, 680] },
    'sprites:roster': { points: [[780, 480], [780, 510], [180, 510], [180, 480]], label: [350, 510] },
    'sprites:stage': { points: [[750, 425], [730, 425], [730, 525], [290, 525], [290, 540]], label: [600, 525] },
    'bundle:tests': { points: [[80, 310], [80, 330], [1050, 330], [1050, 765], [1030, 765]], label: [1050, 560] },
    'run:sim': { points: [[610, 480], [610, 500], [1080, 500], [1080, 935], [1030, 935]], label: [1080, 650] }
  };
  if (special[key]) return special[key];
  if (a.y === b.y) {
    const right = ac.x < bc.x;
    const points = [[right ? a.x + a.w : a.x, ac.y], [right ? b.x : b.x + b.w, bc.y]];
    return { points, label: [(points[0][0] + points[1][0]) / 2, ac.y] };
  }
  const points = [[ac.x, a.y + a.h], [bc.x, b.y]];
  return { points, label: [(ac.x + bc.x) / 2, (a.y + a.h + b.y) / 2] };
}

const arrows = facts.flows.map((flow, index) => {
  const { points, label: [x, y] } = route(flow);
  const d = points.map(([px, py], i) => `${i ? 'L' : 'M'}${px},${py}`).join(' ');
  return `<g class="edge" data-from="${esc(flow.from)}" data-to="${esc(flow.to)}">
    <title>${esc(flow.label)}</title><path d="${d}" marker-end="url(#arrow)"/>
    <rect x="${x - 12}" y="${y - 12}" width="24" height="24"/>
    <text x="${x}" y="${y + 5}">${index + 1}</text></g>`;
}).join('');

const shortFile = file => file.replace(/^card_pixel\/slice\//, '').replace(/^card_pixel\//, '');
const nodes = facts.layers.map(layer => {
  const { x, y, w, h } = boxes[layer.id];
  return `<g class="node" data-id="${esc(layer.id)}" role="button" tabindex="0" aria-pressed="false"
    aria-label="${esc(layer.title)}의 변경 영향 보기" transform="translate(${x},${y})">
    <title>${esc(layer.role)} ${esc(layer.files.join(' · '))}</title>
    <rect class="paper" width="${w}" height="${h}"/>
    <rect class="stripe" width="${w}" height="7" style="fill:var(--${colors[layer.id]})"/>
    <text class="node-title" x="14" y="35">${esc(layer.title)}</text>
    ${layer.files.slice(0, 2).map((file, i) => `<text class="node-file" x="14" y="${64 + i * 22}">${esc(shortFile(file))}</text>`).join('')}
    </g>`;
}).join('');

function table(headers, rows, className = '') {
  return `<table class="${className}"><thead><tr>${headers.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(row => `<tr>${row.map((cell, i) => i === 0 ? `<th scope="row">${cell}</th>` : `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function section(number, title, content) {
  return `<section id="s${number}" class="card"><h2><span>${number}</span>${title}</h2><div class="body">${content}</div></section>`;
}
const titleOf = id => byId.get(id).title;
const impacts = ids => ids.length ? ids.map(id => esc(titleOf(id))).join(' · ') : '이 지도 안에 후속 연결 없음';
const flowKey = `<ol class="flow-key">${facts.flows.map(flow => `<li><b>${esc(titleOf(flow.from))} → ${esc(titleOf(flow.to))}</b><br>${esc(flow.label)}</li>`).join('')}</ol>`;
const diagram = `<p>상자를 누르면 그곳을 바꿀 때 영향을 받는 곳이 남습니다. 한 번 더 누르거나 전체 보기를 누르면 돌아옵니다.</p>
  <div class="controls"><button id="reset" type="button">전체 보기</button><span>선택한 곳: 굵은 테두리 · 영향받는 곳: 밝게</span></div>
  <div id="selection" class="selection" aria-live="polite">상자를 선택하면 역할과 전체 파일 경로가 여기에 나옵니다.</div>
  <p class="small">아래로: 규칙 → 연결 → 원정 → 화면 → 제작 결과. 오른쪽: 다른 카드 화면·그림·검사. 화살표는 자료 전달과 파일 읽기를 나타냅니다.</p>
  <div class="diagram-scroll" tabindex="0" role="region" aria-label="구조 그림. 좁은 화면에서는 좌우로 움직일 수 있습니다.">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1110 1020" width="1110" height="1020" aria-labelledby="map-title map-desc">
    <title id="map-title">카드 리뉴얼 구조</title><desc id="map-desc">공용 규칙부터 시험판까지의 연결. 각 상자는 키보드로도 선택할 수 있습니다. 화살표 번호의 설명은 그림 아래에 있습니다.</desc>
    <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#f3e9d2"/></marker></defs>
    ${arrows}${nodes}
  </svg></div><p class="small">상자 안 경로에서 card_pixel/slice/는 생략했습니다. 번호별 화살표 설명:</p>${flowKey}`;

const layerRows = facts.layers.map(layer => [
  `<b>${esc(layer.title)}</b><p>${esc(layer.role)}</p><div class="files">${layer.files.map(file => `<code>${esc(file)}</code>`).join('')}</div>`,
  impacts(layer.changes_here_affect)
]);
const pipeline = `<ol class="pipeline">${facts.assets.map(step => `<li><h3>${esc(step.step)}</h3><code>${esc(step.tool)}</code><p><b>입력</b><br>${esc(step.input)}</p><p><b>결과</b><br>${esc(step.output)}</p></li>`).join('')}</ol>`;
const checkRows = facts.checks.map(check => [`<code>${esc(check.command)}</code>`, esc(check.what_it_proves), esc(check.takes)]);
const docRows = facts.docs.map(doc => [`<code>${esc(doc.path)}</code>`, esc(doc.holds)]);
const routingRows = facts.routing.map(row => [esc(row.kind_of_work), esc(row.who), esc(row.how_checked)]);

// The checked-in facts are also the only source for the interaction state.
const payload = JSON.stringify(facts.layers).replace(/</g, '\\u003c');
const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'">
<title>카드 리뉴얼 · 구조 지도</title>
<style>
:root{--bg:#15112a;--bg2:#211a3d;--paper:#f3e9d2;--paper2:#e8dbbe;--ink:#2b2140;--ink2:#5d5173;--aqua:#4fd8c8;--gold:#ffc857;--coral:#ff6b5e;--violet:#8b6cff;--shadow:#0b0818;--px:'Galmuri11','Malgun Gothic',system-ui,sans-serif;--body:'Malgun Gothic',system-ui,sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 var(--body)}
main{max-width:1200px;margin:auto;padding:28px 18px 60px;min-width:0}header{color:var(--paper);margin-bottom:24px}
h1{font:700 clamp(26px,5vw,38px)/1.35 var(--px);color:var(--gold);margin:0 0 10px}p{margin:8px 0}a{color:inherit}
nav{display:flex;flex-wrap:wrap;gap:6px;margin-top:16px}nav a{border:2px solid #675884;padding:4px 9px;text-decoration:none;font-size:14px}nav a:hover,nav a:focus-visible{border-color:var(--aqua)}
.card{border:2px solid var(--ink);background:var(--paper);box-shadow:5px 5px 0 var(--shadow);margin-bottom:26px;min-width:0}
h2{display:flex;gap:12px;align-items:center;background:var(--gold);border-bottom:2px solid var(--ink);padding:12px 18px;margin:0;font:700 22px/1.4 var(--px)}
h2 span{background:var(--ink);color:var(--gold);padding:2px 8px;font-size:18px;flex:none}
.card:nth-of-type(3n+2) h2{background:var(--aqua)}.card:nth-of-type(3n+3) h2{background:var(--coral)}
.body{padding:16px 20px 22px;min-width:0}.small{font-size:14px;color:var(--ink2)}
button{font:700 15px/1.3 var(--body);border:2px solid var(--ink);padding:9px 14px;background:var(--aqua);color:var(--ink);cursor:pointer}
button:focus-visible{outline:3px solid var(--violet);outline-offset:3px}.controls{display:flex;gap:12px;flex-wrap:wrap;align-items:center;font-size:14px;margin:14px 0}
.selection{border:2px solid var(--ink);border-left:7px solid var(--violet);background:var(--paper2);padding:12px;min-height:56px;overflow-wrap:anywhere}
.selection b{display:block}.selection .files{margin-top:8px}.diagram-scroll{width:100%;max-width:100%;overflow-x:auto;background:var(--bg2);border:2px solid var(--ink);margin:14px 0;overscroll-behavior-x:contain}
svg{display:block;max-width:none;font-family:var(--body)}.edge{transition:opacity .12s}.edge>path{fill:none;stroke:var(--paper);stroke-width:2}.edge>rect{fill:var(--bg);stroke:var(--paper);stroke-width:1}.edge>text{text-anchor:middle;fill:var(--paper);font:700 14px var(--body)}
.node{cursor:pointer;outline:none;transition:opacity .12s}.node .paper{fill:var(--paper);stroke:var(--ink);stroke-width:2}
.node-title{font-size:19px;font-weight:700;fill:var(--ink)}.node-file{font:14px Consolas,monospace;fill:var(--ink)}
.node.selected .paper{stroke:var(--gold);stroke-width:6}.node:focus-visible .paper{stroke:var(--aqua);stroke-width:6}.node.dim{opacity:.2}.edge.dim{opacity:.12}
.flow-key{display:grid;grid-template-columns:1fr 1fr;gap:10px 32px;padding-left:26px;font-size:14px}.flow-key li{padding-left:3px;break-inside:avoid}.flow-key li::marker{font-weight:700;color:var(--ink2)}
table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:15px}th,td{border:2px solid #cdbf9f;padding:10px 12px;vertical-align:top;text-align:left;overflow-wrap:anywhere}thead th{background:var(--ink);border-color:var(--ink2);color:var(--paper)}tbody th{font-weight:400}tbody tr:nth-child(odd){background:#efe3c8}td p,th p{font-weight:400}
.layers th:first-child{width:52%}.checks th:first-child{width:32%}.checks th:last-child{width:16%}.routing th:first-child{width:47%}.routing th:nth-child(2){width:23%}
code{font:13px/1.55 Consolas,'Malgun Gothic',monospace;overflow-wrap:anywhere;white-space:normal}.files{display:flex;flex-direction:column;gap:3px}.files code{color:var(--ink2)}
.pipeline{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:22px;counter-reset:steps}.pipeline li{position:relative;border:2px solid var(--ink);background:var(--paper2);padding:12px;counter-increment:steps;min-width:0;overflow-wrap:anywhere}.pipeline li+li::before{content:'→';position:absolute;left:-22px;top:12px;font-size:20px;font-weight:700}.pipeline h3{font-size:17px;margin:0 0 8px;border-bottom:2px solid var(--ink);padding-bottom:7px}.pipeline h3::before{content:counter(steps) '. ';color:var(--ink2)}.pipeline p{font-size:14px}
.unverified{padding-left:22px;margin:0}.unverified li+li{margin-top:12px}footer{color:var(--paper);font-size:13px;overflow-wrap:anywhere}
@media(max-width:700px){main{padding:18px 12px 40px}.body{padding:12px}h2{padding:10px 12px;font-size:20px;gap:8px}.flow-key{grid-template-columns:1fr}.pipeline{grid-template-columns:1fr}.pipeline li+li::before{content:'↓';left:14px;top:-27px}table{font-size:14px}th,td{padding:8px 6px}.checks thead{display:none}.checks,.checks tbody,.checks tr,.checks th,.checks td{display:block;width:100%!important}.checks tr{border:2px solid var(--ink);margin-bottom:12px}.checks th,.checks td{border:0}.checks th{background:var(--paper2);border-bottom:2px solid var(--ink)}.checks td:last-child{color:var(--ink2);font-size:13px}.routing th:first-child{width:42%}.routing th:nth-child(2){width:25%}.controls span{font-size:13px}}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style></head><body><main>
<header><h1>카드 리뉴얼 · 구조 지도</h1><p>공용 전투 규칙에서 도트 시험판까지. 실제 읽는 파일과 전달하는 자료를 기준으로 정리했습니다.</p>
<nav aria-label="페이지 안에서 이동">${['한눈에', '변경 영향', '그림 경로', '확인 방법', '계획과 내역', '담당', '미확인'].map((label, i) => `<a href="#s${i + 1}">${label}</a>`).join('')}</nav></header>
${section(1, '한눈에', diagram)}
${section(2, '바꾸면 어디까지 가나', '<p>직접 읽는 곳과 그 뒤로 이어지는 곳입니다. 제작 결과는 해당 명령으로 다시 만들어야 바뀝니다. 그림 변화는 실제 그림을 쓰는 시험판에 반영되며, 가짜 그림 목록을 쓰는 모의 실행에는 반영되지 않습니다.</p>' + table(['바꾸는 곳·역할·파일', '영향받는 곳'], layerRows, 'layers'))}
${section(3, '그림이 게임에 들어가는 길', pipeline)}
${section(4, '확인하는 방법', '<p>아래는 코드에 있는 확인 명령입니다. 이 지도 작업에서 게임 검사를 실행한 결과는 아닙니다. 시간은 미측정 추정입니다.</p>' + table(['명령', '무엇을 확인하나', '걸리는 시간'], checkRows, 'checks'))}
${section(5, '계획과 내역은 어디에', table(['경로', '담는 것·현재 상태'], docRows))}
${section(6, '누가 무엇을', table(['일', '담당', '확인 근거'], routingRows, 'routing'))}
${section(7, '확인하지 못한 것', '<ul class="unverified">' + facts.unverified.map(item => `<li>${esc(item)}</li>`).join('') + '</ul>')}
<footer>자료: card_pixel/plan/structure.json<br>다시 만들기: node card_pixel/plan/build-structure.mjs</footer>
</main><script>
'use strict';
const layers = ${payload};
const nodes = Array.from(document.querySelectorAll('.node'));
const edges = Array.from(document.querySelectorAll('.edge'));
const panel = document.getElementById('selection');
let selected = null;
function select(id) {
  selected = selected === id ? null : id;
  const layer = layers.find(item => item.id === selected);
  const lit = new Set(layer ? [layer.id, ...layer.changes_here_affect] : layers.map(item => item.id));
  for (const node of nodes) {
    const on = node.dataset.id === selected;
    node.classList.toggle('dim', !lit.has(node.dataset.id));
    node.classList.toggle('selected', on);
    node.setAttribute('aria-pressed', String(on));
  }
  for (const edge of edges) edge.classList.toggle('dim', !lit.has(edge.dataset.from) || !lit.has(edge.dataset.to));
  panel.replaceChildren();
  if (!layer) {
    panel.textContent = '상자를 선택하면 역할과 전체 파일 경로가 여기에 나옵니다.';
    return;
  }
  const title = document.createElement('b');
  title.textContent = layer.title;
  const role = document.createElement('p');
  role.textContent = layer.role;
  const files = document.createElement('div');
  files.className = 'files';
  for (const file of layer.files) {
    const code = document.createElement('code');
    code.textContent = file;
    files.append(code);
  }
  const affects = document.createElement('p');
  affects.textContent = '영향: ' + (layer.changes_here_affect.map(target => layers.find(item => item.id === target).title).join(' · ') || '이 지도 안에 후속 연결 없음');
  panel.append(title, role, files, affects);
}
for (const node of nodes) {
  node.addEventListener('click', () => select(node.dataset.id));
  node.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select(node.dataset.id);
    }
  });
}
document.getElementById('reset').addEventListener('click', () => select(null));
document.addEventListener('keydown', event => { if (event.key === 'Escape') select(null); });
</script></body></html>`;

await fs.writeFile(path.join(here, 'structure.html'), html, 'utf8');
console.log(`structure.html: ${facts.layers.length} layers, ${facts.flows.length} arrows`);
