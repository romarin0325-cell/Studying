import { $, $$, esc } from '../dom.js';
import { DUNGEONS } from '../../content/dungeons.js';
import { REGIONS } from '../../content/regions.js';

export const shortRiftDate = dayKey => dayKey?.slice(5).replace('-', '.') || '';

const REGION_HINT = {
  ember_carry: '교대 시 적 작열 최대 2 계승',
  twilight_bell: '3·6·9턴 적 디바인 +2',
  starlit_sky: '문에서 시작 하늘 확인',
  tide_cycle: '3턴 강화 · 4턴 빈틈 · 보스 제외',
  arena_charge: '일반 공격 2회 명중 → 기술 피해 ×2'
};

function koreanRiftDate(dayKey) {
  if (!dayKey) return '';
  const [, month, day] = dayKey.split('-');
  return `${Number(month)}월 ${Number(day)}일`;
}

export function dailyRow(view) {
  if (!view?.unlocked) return '';
  const { active, official, dayKey } = view;
  const action = active ? (active.floor ? `${active.floor}층 이어가기` : '이어가기')
    : official ? '연습하기' : '첫 도전';
  const summary = [shortRiftDate(active?.dayKey || dayKey), action].filter(Boolean).join(' · ');
  return `<button class="btn daily-row" id="meta-daily-rift"><span>오늘의 균열</span><small>${esc(summary)}</small></button>`;
}

function face(widgets, id, name, options = {}) {
  const { shadow = false, boss = false } = options;
  return `<span class="meta-face${boss ? ' boss' : ''}${shadow ? ' rift-shadow' : ''}"${name ? ` role="img" aria-label="${esc(name)}"` : ''}>${widgets.face(id, boss ? 32 : 44)}</span>`;
}

export function openDailyPreparation(view, ui) {
  const { spec, official, dayKey = spec?.dayKey } = view;
  const { widgets, roster, sheets, start, inspectLoan, message } = ui;
  if (!spec) return sheets.sheet('오늘의 균열', '오늘의 편성을 불러오지 못했다.');

  const dungeon = DUNGEONS[spec.dungeonId];
  const region = REGIONS[dungeon?.region?.id];
  const boss = spec.bossId && roster.bosses.includes(spec.bossId) ? roster.bossOf(spec.bossId) : null;
  const loans = spec.loanIds ?? [];
  const kind = official ? 'practice' : 'official';
  const render = () => openDailyPreparation(view, ui);
  const row = (label, ids) => `<h4>${label}</h4><div class="rift-loans">
    ${ids.map(id => `<button class="btn rift-companion" data-rift-loan="${esc(id)}">
      ${face(widgets, id)}<span>${esc(widgets.card(id)?.name || id)}</span>
    </button>`).join('')}
  </div>`;
  const date = koreanRiftDate(dayKey);
  sheets.openSheet([date, '오늘의 균열'].filter(Boolean).join(' · '), `<div class="meta-sheet rift-prep">
    ${message ? `<p class="rift-date-notice" role="status">${esc(message)}</p>` : ''}
    <p>${esc([dungeon?.name, '7층', '전투 4회'].filter(Boolean).join(' · '))}</p>
    ${boss ? `<div class="rift-opponents">${face(widgets, boss.sprite, '', { boss: true })}<span>7층 · ${esc(boss.name)}</span></div>` : ''}
    ${region ? `<p class="rift-region">${esc(region.name)} · ${esc(REGION_HINT[region.id] ?? region.desc)}</p>` : ''}
    ${spec.gateIds?.length ? `<div class="rift-opponents">
      ${spec.gateIds.map(id => face(widgets, id, '', { shadow: true })).join('')}
      <span>4층 · ${esc(spec.gateIds.map(id => widgets.card(id)?.name || id).join(' → '))}</span>
    </div>` : ''}
    ${row('첫 출전', loans.slice(0, 3))}
    ${row('대기', loans.slice(3))}
    ${official ? '' : '<p class="rift-prep-note">첫 도전은 오늘의 기록에 남는다. 이후에는 같은 균열을 연습할 수 있다.</p>'}
    <button class="btn go" id="meta-daily-start">${official ? '연습하기' : '첫 기록에 도전'}</button>
  </div>`);
  $('#meta-daily-start').addEventListener('click', () => start(dayKey, kind));
  for (const button of $$('#sh-body [data-rift-loan]')) button.addEventListener('click', () => {
    inspectLoan(button.dataset.riftLoan, render);
  });
}

export function openEarlierRift(active, { sheets, resume, abandon }) {
  const date = shortRiftDate(active.dayKey);
  const title = [date, '균열'].filter(Boolean).join(' ');
  const prompt = () => openEarlierRift(active, { sheets, resume, abandon });
  sheets.openSheet(title, `<div class="meta-sheet rift-actions">
    <button class="btn go" id="meta-rift-resume">${esc(title)} 이어가기</button>
    <button class="btn meta-danger" id="meta-rift-abandon">${esc([date, '도전을 포기'].filter(Boolean).join(' '))}</button>
  </div>`);
  $('#meta-rift-resume').addEventListener('click', resume);
  $('#meta-rift-abandon').addEventListener('click', () => {
    sheets.openSheet('이 도전을 ‘포기’로 기록할까요?', `<div class="meta-sheet rift-actions">
      <button class="btn meta-danger" id="meta-rift-confirm-abandon">포기</button>
    </div>`, { onClose: prompt });
    $('#meta-rift-confirm-abandon').addEventListener('click', () => abandon(active.runId));
  });
}

export function dailyResultTitle(score) {
  if (score.outcome === 'win') return [shortRiftDate(score.dayKey), '균열 돌파'].filter(Boolean).join(' ');
  return `${score.floor ?? 1}층에서 균열이 닫혔다`;
}

function stamp(dayKey) {
  return `<span class="meta-stamp rift-stamp">${esc(shortRiftDate(dayKey))} · 돌파 도장</span>`;
}

function survival(score, total = 5) {
  return `생존 ${score.livingIds?.length ?? 0}/${total}명`;
}

export function dailyResultScreen(node, { spec, score, official }, { widgets, today, practice, openToday, hub }) {
  const sameDay = score.dayKey && today === score.dayKey;
  const living = new Set(score.livingIds ?? []);
  const loans = spec?.loanIds ?? [];
  const stamped = score.outcome === 'win' && (score.kind === 'official' || (official && official.runId === score.runId));
  const survivors = survival(score, loans.length || 5);
  node.innerHTML = `<section class="meta-panel rift-result">
    <div class="rift-result-cast">
      ${loans.map(id => `<div class="rift-companion${living.has(id) ? '' : ' fallen'}">
        ${face(widgets, id)}<b>${esc(widgets.card(id)?.name || id)}</b>${living.has(id) ? '' : '<small>쓰러짐</small>'}
      </div>`).join('')}
    </div>
    ${score.outcome === 'win' && !living.size ? `<p>보스 격파 · ${survivors}</p><p>${score.turns ?? 0}턴</p>`
      : `<p>${survivors} · ${score.turns ?? 0}턴</p>`}
    <p>유품 사용 ${score.heirloomsUsed ?? 0}회</p>
    ${stamped ? stamp(score.dayKey) : ''}
  </section>
  <div class="rift-actions">
    <button class="btn go" id="meta-rift-again">${sameDay ? '같은 편성으로 연습' : '오늘 균열 보기'}</button>
    <button class="btn" id="meta-rift-hub">관측소로</button>
  </div>`;
  $('#meta-rift-again', node).addEventListener('click', sameDay ? () => practice(score.dayKey) : () => openToday());
  $('#meta-rift-hub', node).addEventListener('click', () => hub());
}

function scoreLabel(score) {
  if (!score) return '기록 없음';
  if (score.outcome === 'win') return '돌파';
  if (score.outcome === 'abandon') return '포기';
  return `${score.floor ?? 1}층 실패`;
}

function openRiftRecord(row, sheets) {
  const dayKey = row.dayKey ?? row.spec?.dayKey;
  const total = row.spec?.loanIds?.length || 5;
  const dungeon = DUNGEONS[row.spec?.dungeonId];
  const entry = (label, score) => {
    const summary = score?.outcome === 'win'
      ? [row.official?.outcome === 'win' ? '' : '돌파', survival(score, total), `${score.turns ?? 0}턴`].filter(Boolean).join(' · ')
      : scoreLabel(score);
    return `<div class="rift-record-score"><h4>${label}</h4><p>${esc(summary)}</p></div>`;
  };
  sheets.openSheet([shortRiftDate(dayKey), '균열 기록'].filter(Boolean).join(' '), `<div class="meta-sheet">
    ${dungeon ? `<p>${esc(dungeon.name)}</p>` : ''}
    ${entry('첫 기록', row.official)}
    ${entry('연습 최고', row.bestPractice)}
    ${row.official?.outcome === 'win' ? stamp(dayKey) : ''}
  </div>`);
}

export function openDailyHistory({ rows = [], nextBefore = null } = {}, ui) {
  const { node, sheets, next, previous } = ui;
  node.innerHTML = `<h2>균열 기록</h2>
    <div class="rift-record-list">
      ${rows.map((row, index) => {
        const date = shortRiftDate(row.dayKey ?? row.spec?.dayKey);
        const dungeon = DUNGEONS[row.spec?.dungeonId]?.name;
        const label = [date, dungeon, scoreLabel(row.official ?? row.bestPractice)].filter(Boolean).join(' · ');
        return `<button class="btn" data-rift-record="${index}">${esc(label)}</button>`;
      }).join('') || '<p>기록 없음</p>'}
    </div>
    ${previous || nextBefore ? `<div class="rift-record-pages">
      <button class="btn" id="meta-rift-previous"${previous ? '' : ' disabled'}>이전</button>
      <button class="btn" id="meta-rift-next"${nextBefore ? '' : ' disabled'}>다음</button>
    </div>` : ''}`;
  for (const button of $$('[data-rift-record]', node)) button.addEventListener('click', () => {
    openRiftRecord(rows[Number(button.dataset.riftRecord)], sheets);
  });
  if (previous) $('#meta-rift-previous', node)?.addEventListener('click', previous);
  if (nextBefore) $('#meta-rift-next', node)?.addEventListener('click', () => next(nextBefore));
}
