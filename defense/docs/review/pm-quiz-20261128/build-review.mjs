// Builds index.html: every practice question in three versions (main before PR 708, PR 708, this rewrite) side by side,
// plus the set-wide numbers and the IPA control check. Run from the repo root:
//   node defense/docs/review/pm-quiz-20261128/build-review.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const REVS = {main: 'c2fae749', pr: '91b7fb0c'};
async function courseAt(rev) {
  const src = rev ? execFileSync('git', ['show', `${rev}:defense/src/course.js`], {cwd: repo, encoding: 'utf8', maxBuffer: 1 << 26})
    : fs.readFileSync(path.join(repo, 'defense/src/course.js'), 'utf8');
  const tmp = path.join(os.tmpdir(), `pm-course-${rev || 'now'}-${process.pid}.mjs`);
  fs.writeFileSync(tmp, src);
  try { return (await import(pathToFileURL(tmp).href)).COURSE; } finally { fs.rmSync(tmp, {force: true}); }
}
const flat = c => { const m = new Map(); for (const o of [...c.lectures, ...c.terms]) for (const q of o.quizzes) m.set(q.id, {...q, owner: o.id, ownerName: o.title || o.termJa}); return m; };
const [main, pr, now] = await Promise.all([courseAt(REVS.main), courseAt(REVS.pr), courseAt(null)]).then(a => a.map(flat));
const {setStats, SELF_SOURCE} = await import(pathToFileURL(path.join(repo, 'defense/scripts/pm-quiz-check.mjs')).href);
const kindOf = q => q.source === SELF_SOURCE ? 'self' : /재구성|변형/.test(q.source) ? 'adapted' : 'exam';
const pick = (m, kind) => [...m.values()].filter(q => kindOf(now.get(q.id)) === kind);
const statRow = (label, m) => { const s = setStats(pick(m, 'self')); return {label, ...s}; };
const stats = [statRow('main (PR 708 전, 한·일 혼용)', main), statRow('PR 708 (일본어 번역)', pr), statRow('이번 수정', now)];
const changed = id => JSON.stringify([pr.get(id).prompt, pr.get(id).choices, pr.get(id).answer]) !== JSON.stringify([now.get(id).prompt, now.get(id).choices, now.get(id).answer]);
const items = [...now.values()].map(q => ({id: q.id, owner: q.owner, ownerName: q.ownerName, source: q.source, kind: kindOf(q), changed: changed(q.id),
  v: {main: main.get(q.id), pr: pr.get(q.id), now: q}}));
const slim = q => q && {prompt: q.prompt, choices: q.choices, answer: q.answer, explain: q.explain, source: q.source};
const data = items.map(i => ({...i, v: {main: slim(i.v.main), pr: slim(i.v.pr), now: slim(i.v.now)}}));
const controls = [
  ['令和7年度秋期 問15', 'pm-l19-pm-2025-am2-q15', '본문·보기 글자 단위 일치'],
  ['令和7年度秋期 問21', 'T042-q1', '본문·보기 글자 단위 일치 (2025년 시험 당시 법률명 下請代金支払遅延等防止法 그대로)'],
  ['令和6年度秋期 問12', 'pm-l27-pm-2024-am2-q12', '표를 글로 옮김. 월별 인원 36칸과 조건 7개 숫자 모두 일치'],
  ['令和6年度秋期 問15', 'pm-l04-pm-2024-am2-q15', '일치 (괄호 전각/반각 1곳만 다름)'],
  ['令和6年度秋期 問17', 'pm-l03-pm-2024-am2-q17', '본문·보기 글자 단위 일치'],
];
const pct = x => (x * 100).toFixed(1) + '%';
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PM 문제 검수</title><style>
:root{--bg:#f6f5f1;--card:#fff;--ink:#1d1d1f;--mute:#6b6b70;--line:#e3e1da;--ok:#1f7a4d;--okbg:#e6f4ec;--bad:#b3261e;--badbg:#fbe9e7;--acc:#3d5afe;--chip:#efeee9}
@media (prefers-color-scheme:dark){:root{--bg:#141416;--card:#1e1e22;--ink:#ececf0;--mute:#9a9aa3;--line:#2e2e35;--ok:#6fd39b;--okbg:#17321f;--bad:#ff8a80;--badbg:#3a1a18;--acc:#8c9eff;--chip:#2a2a30}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 system-ui,"Segoe UI","Malgun Gothic","Yu Gothic UI",sans-serif;word-break:keep-all;overflow-wrap:anywhere}
main{max-width:1180px;margin:0 auto;padding:24px 16px 80px}h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 10px}.sub{color:var(--mute);margin:0 0 16px}
table{border-collapse:collapse;width:100%;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden;font-size:14px}th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{color:var(--mute);font-weight:600}
.wrap{overflow-x:auto}.bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:12px 0;position:sticky;top:0;background:var(--bg);padding:10px 0;z-index:2}
button,select,input{font:inherit;color:inherit;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:6px 10px}button.on{background:var(--acc);border-color:var(--acc);color:#fff}input{min-width:160px;flex:1}
.q{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin:12px 0}.qh{display:flex;gap:8px;flex-wrap:wrap;align-items:center;color:var(--mute);font-size:13px;margin-bottom:8px}
.chip{background:var(--chip);border-radius:99px;padding:1px 8px}.cols{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:12px}@media (max-width:820px){.cols{grid-template-columns:1fr}}
.col h4{margin:0 0 6px;font-size:13px;color:var(--mute)}.prompt{white-space:pre-line;margin:0 0 8px}.ch{list-style:none;margin:0;padding:0}.ch li{display:flex;gap:6px;padding:5px 8px;border-radius:8px;margin:2px 0}.ch li b{flex:none}
.ch li .len{margin-left:auto;color:var(--mute);font-size:12px;flex:none}.reveal .ch li.ans{background:var(--okbg);color:var(--ok)}.ex{display:none;margin-top:8px;font-size:14px;color:var(--mute);border-top:1px dashed var(--line);padding-top:8px}.reveal .ex{display:block}
.note{font-size:13px;color:var(--mute)}.good{color:var(--ok)}.badc{color:var(--bad)}[lang=ja]{font-family:"Yu Gothic UI","Meiryo",system-ui,sans-serif;word-break:normal}
</style></head><body><main>
<h1>PM 학습 문제 검수 (PR 708 후속)</h1>
<p class="sub">2026-11-28 · 기출 원문은 공식 IPA 문제지·정답표로 대조해 그대로 두고, 창작 문항 197개와 재구성 문항 7개를 시험 형식으로 다시 만들었어요.</p>
<h2>창작 문항 197개의 정답 단서</h2>
<div class="wrap"><table><tr><th>판</th><th>정답이 가장 긴 보기</th><th>정답 길이 ÷ 오답 평균</th><th>정답 위치 ① / ② / ③ / ④</th></tr>
${stats.map(s => `<tr><td>${s.label}</td><td>${pct(s.longestRate)}</td><td>${s.lengthRatio.toFixed(2)}배</td><td>${s.positions.map(pct).join(' / ')}</td></tr>`).join('')}
</table></div>
<p class="note">무작위라면 "정답이 가장 긴 보기"는 약 25%, 정답 위치는 각 25%예요.</p>
<h2>기출 대조군 (공식 IPA 문제지 PDF와 비교)</h2>
<div class="wrap"><table><tr><th>회차·문항</th><th>게임 문제 ID</th><th>결과</th></tr>${controls.map(c => `<tr><td lang="ja">${c[0]}</td><td>${c[1]}</td><td class="good">${c[2]}</td></tr>`).join('')}
<tr><td>정답표 6개 회차</td><td>기출 56문항</td><td class="good">令和7·6·5·4년도 秋期, 令和2년도 10월, 平成28년도 春期 공식 정답표와 56/56 일치</td></tr></table></div>
<h2>문항 비교</h2>
<div class="bar"><select id="kind"><option value="changed">이번에 바뀐 문항</option><option value="self">창작 (개념 확인)</option><option value="adapted">재구성·변형</option><option value="exam">기출 원문</option><option value="all">전체</option></select>
<button id="vMain">main</button><button id="vPr" class="on">PR 708</button><button id="vNow" class="on">이번</button><button id="rev">정답·해설 보기</button><input id="find" placeholder="ID나 낱말로 찾기"><span id="count" class="note"></span></div>
<div id="list"></div>
</main><script>
const DATA=${JSON.stringify(data).replace(/</g, '\\u003c')};
const M='①②③④',st={kind:'changed',show:{main:false,pr:true,now:true},reveal:false,q:''};
try{const s=JSON.parse(localStorage.getItem('pmq')||'null');if(s)Object.assign(st,s);}catch{}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const LABEL={main:'main (PR 708 전)',pr:'PR 708',now:'이번'};
function col(k,q){if(!q)return '<div class="col"><h4>'+LABEL[k]+'</h4><p class="note">없음</p></div>';
 return '<div class="col"><h4>'+LABEL[k]+'</h4><p class="prompt" lang="ja">'+esc(q.prompt)+'</p><ul class="ch">'+q.choices.map((c,i)=>'<li class="'+(i===q.answer?'ans':'')+'" lang="ja"><b>'+M[i]+'</b><span>'+esc(c)+'</span><span class="len">'+[...c].length+'</span></li>').join('')+'</ul><p class="ex">'+esc(q.explain)+'</p></div>';}
function render(){
 const keys=Object.keys(st.show).filter(k=>st.show[k]),f=st.q.trim().toLowerCase();
 const rows=DATA.filter(d=>(st.kind==='all'||(st.kind==='changed'?d.changed:d.kind===st.kind))&&(!f||(d.id+' '+d.v.now.prompt+' '+d.v.now.choices.join(' ')+' '+(d.ownerName||'')).toLowerCase().includes(f)));
 document.getElementById('count').textContent=rows.length+'문항';
 document.getElementById('list').innerHTML=rows.map(d=>'<section class="q'+(st.reveal?' reveal':'')+'"><div class="qh"><b>'+esc(d.id)+'</b><span class="chip">'+esc(d.ownerName||d.owner)+'</span><span class="chip" lang="ja">'+esc(d.source)+'</span>'+(d.changed?'<span class="chip badc">바뀜</span>':'')+'</div><div class="cols" style="--n:'+Math.max(1,keys.length)+'">'+keys.map(k=>col(k,d.v[k])).join('')+'</div></section>').join('');
 for(const [id,k] of [['vMain','main'],['vPr','pr'],['vNow','now']])document.getElementById(id).classList.toggle('on',st.show[k]);
 document.getElementById('rev').classList.toggle('on',st.reveal);document.getElementById('kind').value=st.kind;document.getElementById('find').value=st.q;
 try{localStorage.setItem('pmq',JSON.stringify(st));}catch{}
}
for(const [id,k] of [['vMain','main'],['vPr','pr'],['vNow','now']])document.getElementById(id).onclick=()=>{st.show[k]=!st.show[k];render();};
document.getElementById('rev').onclick=()=>{st.reveal=!st.reveal;render();};
document.getElementById('kind').onchange=e=>{st.kind=e.target.value;render();};
document.getElementById('find').oninput=e=>{st.q=e.target.value;render();};
render();
</script></body></html>
`;
fs.writeFileSync(path.join(here, 'index.html'), html);
console.log('wrote index.html', items.filter(i => i.changed).length, 'changed', stats.map(s => s.label + ' ' + pct(s.longestRate)).join(' | '));
