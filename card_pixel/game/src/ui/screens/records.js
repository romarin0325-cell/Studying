import { $, esc } from '../dom.js';
import { DUNGEONS } from '../../content/dungeons.js';

export const DIFFICULTY_NAME = { normal: '여정', nightmare: '악몽' };
const amount = value => value.toLocaleString('ko-KR');
export const hitText = (hit, card) => hit ? `${amount(hit.amount)} · ${card(hit.by)?.name || hit.by} · ${hit.skill}` : '기록 없음';
export const longestText = (longest, card) => longest
  ? `${card(longest.id)?.name || longest.id} · 인연 ${longest.bond ?? 0}` + (Number.isFinite(longest.since) ? ` · ${longest.since}번째 원정에서 영입` : '')
  : '기록 없음';

export function recordTable(rows) {
  return `<table class="meta-record-table"><tbody>
    ${rows.map(([label, value]) => `<tr><th scope="row">${esc(label)}</th><td>${esc(value)}</td></tr>`).join('')}
  </tbody></table>`;
}

export function runRecordSheet(run, card, openSheet) {
  const stats = run.stats;
  openSheet('원정 기록', `<div class="meta-sheet">
    <p>${esc(DUNGEONS[run.dungeonId].name)} · ${DIFFICULTY_NAME[run.difficulty]} · ${run.result === 'win' ? '생환' : '실패'}</p>
    ${recordTable([
      ['도달한 층', `${run.floor} / ${run.floors}`],
      ['전투', `${stats.battles}회 · ${stats.turns}턴`],
      ['최고 피해', hitText(stats.bestHit, card)],
      ['쓰러진 동료', run.fallen.map(id => card(id)?.name || id).join(', ') || '없음'],
      ['유품 사용', `${stats.heirloomsUsed}회`],
      ['최후의 일인', `${stats.lastStands}회`],
      ['대박 축복', `${stats.jackpots}회`]
    ])}
  </div>`);
}

export function recordsScreen(node, profile, card, openSheet, replayEnding) {
  const { records } = profile;
  const longest = records.longestServing;
  const bestPlace = records.bestHit && DUNGEONS[records.bestHit.dungeonId];
  const latest = profile.ui?.latestRun;
  node.innerHTML = `
    <section class="meta-panel">
      ${recordTable([
        ['원정', `${records.runs}회`],
        ['최고 피해', hitText(records.bestHit, card)],
        ...(bestPlace ? [['최고 피해 지역', `${bestPlace.name} · ${DIFFICULTY_NAME[records.bestHit.difficulty]}`]] : []),
        ['가장 오래 함께한 동료', longestText(longest, card)]
      ])}
    </section>
    <section class="meta-panel">
      <h2>지역별 생환</h2>
      <table class="meta-record-table meta-clear-table">
        <thead><tr><th scope="col">지역</th><th scope="col">여정</th><th scope="col">악몽</th></tr></thead>
        <tbody>${Object.values(DUNGEONS).map(dungeon => {
          const clear = records.clears[dungeon.id];
          const nightmare = dungeon.nightmareRule ? (clear?.nightmare || 0) + '회' : '—';
          return `<tr><th scope="row">${esc(dungeon.name)}</th><td>${clear?.normal || 0}회</td><td>${nightmare}</td></tr>`;
        }).join('')}</tbody>
      </table>
    </section>
    ${latest ? `<button class="btn" id="meta-latest-record">최근 원정 · ${esc(DUNGEONS[latest.dungeonId].name)}</button>` : ''}
    ${profile.ui?.endingSeen ? '<button class="btn" id="meta-replay-ending">엔딩 다시 보기</button>' : ''}
  `;
  $('#meta-latest-record', node)?.addEventListener('click', () => runRecordSheet(latest, card, openSheet));
  $('#meta-replay-ending', node)?.addEventListener('click', replayEnding);
}
