import { $, $$, esc } from '../dom.js';
import { CONTRACTS } from '../../content/contracts.js';
import { DUNGEONS } from '../../content/dungeons.js';
import * as Meta from '../../engine/meta.js';
import { bindScreenTabs } from '../nav/screen-tabs.js';

export const DIFFICULTY_NAME = { easy: '꿈결', normal: '여정', nightmare: '악몽' };
const amount = value => value.toLocaleString('ko-KR');
export const hitText = (hit, card) => hit ? `${amount(hit.amount)} · ${card(hit.by)?.name || hit.by} · ${hit.skill}` : '기록 없음';
export const longestText = (longest, card) => longest
  ? `${card(longest.id)?.name || longest.id} · 인연 ${longest.bond ?? 0}`
  : '기록 없음';

export function recordTable(rows) {
  return `<table class="meta-record-table"><tbody>
    ${rows.map(([label, value]) => `<tr><th scope="row">${esc(label)}</th><td>${esc(value)}</td></tr>`).join('')}
  </tbody></table>`;
}

export function runRecordSheet(run, card, openSheet, showBattleLog) {
  const stats = run.stats;
  openSheet('원정 기록', `<div class="meta-sheet">
    <p>${esc(DUNGEONS[run.dungeonId].name)} · ${DIFFICULTY_NAME[run.difficulty]} · ${run.result === 'win' ? '생환' : '실패'}</p>
    ${recordTable([
      ['도달 층', `${run.floor} / ${run.floors}`],
      ['전투', `${stats.battles}회 · ${stats.turns}턴`],
      ['최고 피해', hitText(stats.bestHit, card)],
      ['쓰러진 동료', run.fallen.map(id => card(id)?.name || id).join(', ') || '없음'],
      ...(run.features?.heirlooms === false ? [] : [['유품 사용', `${stats.heirloomsUsed}회`]]),
      ...(run.features?.lastStand === false ? [] : [['최후의 일인', `${stats.lastStands}회`]]),
      ...(run.features?.altar === false ? [] : [['축복 대성공', `${stats.jackpots}회`]])
    ])}
    ${showBattleLog && run.lastBattleLog?.length ? '<button class="btn" id="meta-latest-battle">마지막 전투 기록</button>' : ''}
  </div>`);
  $('#meta-latest-battle')?.addEventListener('click', () => showBattleLog(run.lastBattleLog));
}

export function recordsScreen(node, profile, card, openSheet, replayEnding, renderDailyHistory, showBattleLog) {
  const { records } = profile;
  const longest = records.longestServing;
  const bestPlace = records.bestHit && DUNGEONS[records.bestHit.dungeonId];
  const latest = profile.ui?.latestRun;
  const showDifficulty = Meta.featureFlags(profile).difficultyChoice;
  node.classList.add('screen-split');
  node.innerHTML = `
    ${renderDailyHistory ? `<div class="fixed-top screen-tabs" role="group" aria-label="기록 종류">
      <button class="btn" data-screen-tab="expedition">원정 기록</button>
      <button class="btn" data-screen-tab="rift">균열 기록</button>
    </div>` : ''}
    <div class="scroll-list">
    <section class="meta-panel" data-screen-panel="expedition">
      ${recordTable([
        ['원정', `${records.runs}회`],
        ['최고 피해', hitText(records.bestHit, card)],
        ...(bestPlace ? [['최고 피해 지역', bestPlace.name + (showDifficulty ? ' · ' + DIFFICULTY_NAME[records.bestHit.difficulty] : '')]] : []),
        ['인연이 가장 높은 동료', longestText(longest, card)]
      ])}
    </section>
    <section class="meta-panel" data-screen-panel="expedition">
      <h2>지역별 생환</h2>
      <table class="meta-record-table meta-clear-table">
        <thead><tr><th scope="col">지역</th>${showDifficulty
          ? '<th scope="col">꿈결</th><th scope="col">여정</th><th scope="col">악몽</th>' : '<th scope="col">클리어</th>'}</tr></thead>
        <tbody>${Object.values(DUNGEONS).map(dungeon => {
          const clear = records.clears[dungeon.id];
          if (!showDifficulty) return `<tr><th scope="row">${esc(dungeon.name)}</th><td>${(clear?.easy || 0) + (clear?.normal || 0)}회</td></tr>`;
          const count = (clear?.nightmare || 0) + '회';
          const nightmare = !dungeon.nightmareRule ? '—' : Meta.contractsFor
            ? `<button class="btn meta-nightmare-record" data-nightmare-record="${dungeon.id}" aria-label="${esc(dungeon.name)} 악몽 ${count} · 계약 도장">${count}</button>`
            : count;
          const easy = dungeon.layout === 'intro' ? '—' : (clear?.easy ?? 0) + '회';
          return `<tr><th scope="row">${esc(dungeon.name)}</th><td>${easy}</td><td>${clear?.normal || 0}회</td><td>${nightmare}</td></tr>`;
        }).join('')}</tbody>
      </table>
    </section>
    ${renderDailyHistory ? '<section class="meta-panel" id="meta-daily-history" data-screen-panel="rift"></section>' : ''}
    </div>
    ${latest || profile.ui?.endingSeen ? `<div class="fixed-foot">
    ${latest ? `<button class="btn" id="meta-latest-record">최근 원정 · ${esc(DUNGEONS[latest.dungeonId].name)}</button>` : ''}
    ${profile.ui?.endingSeen ? '<button class="btn" id="meta-replay-ending">엔딩 다시 보기</button>' : ''}
    </div>` : ''}
  `;
  if (renderDailyHistory) {
    const hasDailyHistory = renderDailyHistory($('#meta-daily-history', node));
    bindScreenTabs(node, hasDailyHistory && !latest ? 'rift' : 'expedition');
  }
  for (const button of $$('[data-nightmare-record]', node)) button.addEventListener('click', () => {
    const dungeonId = button.dataset.nightmareRecord;
    const stamps = Meta.contractsFor?.(profile, dungeonId)?.stamps;
    openSheet(`${DUNGEONS[dungeonId].name} · 계약 도장`, `<div class="meta-sheet">${recordTable(
      Object.values(CONTRACTS).map(({ id, name }) => [name, stamps?.[id] ? '획득' : '미획득'])
    )}</div>`);
  });
  $('#meta-latest-record', node)?.addEventListener('click', () => runRecordSheet(latest, card, openSheet, showBattleLog));
  $('#meta-replay-ending', node)?.addEventListener('click', replayEnding);
}
