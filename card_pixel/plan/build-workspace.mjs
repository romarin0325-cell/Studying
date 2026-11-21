// Builds plan/workspace.html: one page that shows where everything of RELAYMARE is, in time order and by role.
// Data: plan/workspace-map.json (facts gathered by GPT Sol, 2026-11-22). Design: Claude.
// Usage: node card_pixel/plan/build-workspace.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, pageShell } from './page-kit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const map = JSON.parse(fs.readFileSync(path.join(here, 'workspace-map.json'), 'utf8'));
const sources = list => (Array.isArray(list) ? list : list ? [list] : []).map(s => `<code>${esc(s)}</code>`).join(' ');
const day = iso => String(iso ?? '').slice(0, 10);

const KIND_COLOR = { '소유자 지시': 'pink', '소유자 결정': 'pink', '소유자 피드백': 'pink', 'PR': 'navy', '구현': 'aqua', '결정': 'gold', '검수': 'violet', '기록 공백': 'grey' };
const STATUS_ORDER = ['현재', '기록', '대체됨', '폐기', '출처 불명'];
const STATUS_COLOR = { '현재': 'aqua', '기록': 'navy', '대체됨': 'gold', '폐기': 'coral', '출처 불명': 'grey' };
const RISK_COLOR = { '높음': 'coral', '중간': 'gold', '낮음': 'aqua' };

// 1. Now: the open PR, the branch and the pages a reader opens first.
const openPr = map.prs.find(pr => pr.state === 'OPEN');
const now = `
  <div class="cards three">
    <article class="card"><h3>지금 작업</h3><p>브랜치 <code>claude/relaymare-ui</code>${openPr ? ` · PR #${openPr.number} 열림` : ''}</p>
      <p class="dim">작업 폴더 <code>C:\\Users\\BOMHANA\\Downloads\\게임\\Studying-card-pixel-ui</code></p></article>
    <article class="card"><h3>먼저 볼 것</h3><ul>
      <li><code>card_pixel/plan/entry-report.html</code> 이번 작업 보고서</li>
      <li><code>card_pixel/plan/v1-decisions.md</code> 결정 장부(13절이 최신)</li>
      <li><code>card_pixel/plan/changes-review.html</code> 원본 대비 검수</li>
      <li><code>card_pixel/plan/skill-motion.html</code> 스킬 연출 전수조사와 공용 이펙트 계획</li>
      <li><code>card_pixel/history/README.md</code> 이력 목차</li></ul></article>
    <article class="card"><h3>규모</h3><p>파일·묶음 ${map.items.length}개 · 이정표 ${map.timeline.length}건 · 작업 공간 ${map.worktrees.length}곳 · 남은 과제 ${map.openTasks.length}건</p>
      <p class="dim">자료 생성 ${esc(day(map.generatedAt))} · 커밋 ${esc(String(map.commit).slice(0, 7))}</p></article>
  </div>`;

// 2. Timeline grouped by date.
const byDate = new Map();
for (const event of map.timeline) (byDate.get(event.date) ?? byDate.set(event.date, []).get(event.date)).push(event);
const timeline = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, events]) => `
  <li class="tl-day"><b class="tl-date">${esc(date.slice(5).replace('-', '.'))}</b><div class="tl-events">${events.map(event => `
    <article class="tl-event"><span class="tag ${KIND_COLOR[event.kind] ?? 'grey'}">${esc(event.kind)}</span>
      <b>${esc(event.title)}</b><p>${esc(event.detail)}</p><p class="src">${sources(event.source)}</p></article>`).join('')}
  </div></li>`).join('');

// 3. Worktrees.
const worktrees = map.worktrees.map(tree => `
  <article class="card tree${tree.dirty ? ' dirty' : ''}"><h3>${esc(path.basename(tree.path))}</h3>
    <p><code>${esc(tree.branch ?? '(detached)')}</code> · ${esc(day(tree.lastDate))}</p>
    <p class="dim">${esc(tree.lastTitle)}</p>
    ${tree.role ? `<p>${esc(tree.role)}</p>` : ''}${tree.notes ? `<p class="dim">${esc(tree.notes)}</p>` : ''}${tree.junctionTarget ? `<p class="dim">node_modules 연결 → <code>${esc(tree.junctionTarget)}</code></p>` : ''}
    ${tree.dirty ? `<p class="warn">정리되지 않은 변경 ${esc(tree.changeCount ?? '')}건</p>` : '<p class="ok">깨끗함</p>'}
  </article>`).join('');

// 4. Discarded concepts beside the current direction.
const discarded = map.discarded.map(item => `
  <article class="card slim"><b>${esc(item.concept)}</b><p class="dim">${esc(item.when)}</p><p>${esc(item.why)}</p>
    ${item.replacedBy ? `<p class="arrow">→ ${esc(item.replacedBy)}</p>` : ''}<p class="src">${sources(item.source)}</p></article>`).join('');
const direction = map.direction.map(item => `<li><b>${esc(item.principle)}</b><p class="src">${sources(item.source)}</p></li>`).join('');

// 5. Open tasks grouped by priority.
const priorities = [...new Set(map.openTasks.map(task => task.priority))].sort();
const tasks = priorities.map(priority => `
  <h3 class="prio">${esc(priority)}</h3><div class="cards two">${map.openTasks.filter(task => task.priority === priority).map(task => `
    <article class="card slim"><span class="tag ${task.owner === '소유자 확인' ? 'pink' : task.owner === 'GPT' ? 'violet' : 'aqua'}">${esc(task.owner)}</span>
      <p>${esc(task.task)}</p>${task.notes ? `<p class="dim">${esc(task.notes)}</p>` : ''}<p class="src">${sources(task.source)}</p></article>`).join('')}</div>`).join('');

// 6. Cleanup candidates: nothing is deleted without the owner's approval.
const cleanup = map.cleanup.map(item => `
  <article class="card slim"><span class="tag ${RISK_COLOR[item.risk] ?? 'grey'}">위험 ${esc(item.risk)}</span>
    <p><code>${esc(item.path)}</code></p><p>${esc(item.suggestion)}</p><p class="dim">${esc(item.reason)}</p><p class="need">필요: ${esc(item.needs)}</p></article>`).join('');

// 7. Every file and folder, filterable by status and searchable.
const statusCounts = Object.fromEntries(STATUS_ORDER.map(status => [status, map.items.filter(item => item.status === status).length]));
const rows = map.items.slice().sort((a, b) => a.path.localeCompare(b.path)).map(item => `
  <tr data-status="${esc(item.status)}" data-text="${esc([item.path, item.kind, item.role, item.notes, item.supersededBy].join(' ').toLowerCase())}">
    <td><code>${esc(item.path)}</code>${item.entryType && item.entryType !== '파일' ? ` <small>${esc(item.entryType)}</small>` : ''}</td>
    <td>${esc(item.kind)}</td><td><span class="tag ${STATUS_COLOR[item.status] ?? 'grey'}">${esc(item.status)}</span></td>
    <td>${esc(item.role)}${item.supersededBy ? `<br><small>→ ${esc(item.supersededBy)}</small>` : ''}</td>
    <td class="nowrap">${esc(item.first ?? '')}<br>${esc(item.last ?? '')}</td></tr>`).join('');

const external = map.external.map(item => `<li><code>${esc(item.path)}</code> — ${esc(item.role)} ${item.usedByCurrentGame ? '<span class="tag aqua">게임이 씀</span>' : '<span class="tag grey">게임이 읽지 않음</span>'}</li>`).join('');

const css = `
h3.prio { margin: 14px 0 6px; }
.card.tree.dirty { box-shadow: 0 0 0 var(--u) var(--gold), 0 calc(3 * var(--u)) 0 var(--u) rgba(240,146,15,.25); }
.timeline { list-style: none; margin: 0; padding: 0; }
.tl-day { display: grid; grid-template-columns: 64px 1fr; gap: 10px; margin-bottom: 12px; }
.tl-date { align-self: start; padding: 4px 0; text-align: center; color: #fff; background: var(--navy); font-size: 15px; }
.tl-events { display: grid; gap: 8px; border-left: calc(2 * var(--u)) solid var(--line); padding-left: 10px; }
.tl-event { background: #fff; padding: 8px 10px; box-shadow: 0 0 0 var(--u) var(--line); }
.tl-event b { display: block; margin-top: 2px; }
.direction { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; }
.direction li { background: #fff; padding: 8px 10px; box-shadow: inset calc(3 * var(--u)) 0 0 var(--aqua), 0 0 0 var(--u) var(--line); }
td.nowrap { white-space: nowrap; color: var(--ink2); }
@media (max-width: 520px) { .tl-day { grid-template-columns: 48px 1fr; } td:nth-child(2), th:nth-child(2) { display: none; } }
`;
const html = pageShell({
  title: '다음은 너 · 작업 공간 지도',
  subtitle: '무엇이 어디에 있고, 언제 생겼고, 지금 쓰는지 · 폐기된 것과 남은 일',
  toc: [['now', '지금'], ['timeline', '시간순'], ['trees', '작업 공간'], ['concepts', '폐기·현재 방향'], ['tasks', '남은 과제'], ['cleanup', '정리 후보'], ['files', '문서·도구 전체']],
  css,
  body: `
<section id="now"><h2>지금</h2>${now}</section>
<section id="timeline"><h2>시간순 이정표</h2><ol class="timeline">${timeline}</ol></section>
<section id="trees"><h2>작업 공간 (git worktree)</h2><p class="dim">금색 테두리는 저장하지 않은 변경이 남은 곳입니다. 지우기 전에는 반드시 확인이 필요합니다.</p><div class="cards three">${worktrees}</div>
  <h3 style="margin-top:14px">작업 공간 밖의 원본</h3><ul>${external}</ul></section>
<section id="concepts"><h2>폐기된 컨셉 · 지금의 방향</h2><div class="split">
  <div><h3>폐기·대체된 것 (${map.discarded.length})</h3><div class="cards">${discarded}</div></div>
  <div><h3>지금 지키는 원칙 (${map.direction.length})</h3><ul class="direction">${direction}</ul></div></div></section>
<section id="tasks"><h2>남은 과제</h2>${tasks}</section>
<section id="cleanup"><h2>정리 후보 (소유자 승인 전에는 지우지 않음)</h2><div class="cards two">${cleanup}</div></section>
<section id="files"><h2>문서·도구 전체 (${map.items.length})</h2>
  <div class="filters"><input type="search" id="q" placeholder="경로·역할 검색"><button type="button" data-status="" aria-pressed="true">전체</button>
  ${STATUS_ORDER.map(status => `<button type="button" data-status="${status}" aria-pressed="false">${status} ${statusCounts[status]}</button>`).join('')}</div>
  <div class="table"><table><thead><tr><th>경로</th><th>종류</th><th>상태</th><th>역할</th><th>처음·마지막</th></tr></thead><tbody>${rows}</tbody></table></div></section>
`,
  script: `
const q = document.querySelector('#q'); let status = '';
function apply() { const term = q.value.trim().toLowerCase();
  for (const row of document.querySelectorAll('tbody tr')) row.hidden = !!(status && row.dataset.status !== status) || !!(term && !row.dataset.text.includes(term)); }
q.addEventListener('input', apply);
for (const button of document.querySelectorAll('.filters button')) button.addEventListener('click', () => {
  status = button.dataset.status; for (const other of document.querySelectorAll('.filters button')) other.setAttribute('aria-pressed', String(other === button)); apply(); });
`
});
fs.writeFileSync(path.join(here, 'workspace.html'), html);
console.log('workspace.html', (Buffer.byteLength(html) / 1024).toFixed(0) + ' KB');
