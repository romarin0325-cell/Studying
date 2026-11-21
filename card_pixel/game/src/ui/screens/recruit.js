import { $, $$, esc } from '../dom.js';
import { background } from '../assets.js';
import { CONTRACTS } from '../../content/contracts.js';
import { DUNGEONS } from '../../content/dungeons.js';
import { hubLineup, sceneActors } from './hub.js';
import { runRecordSheet } from './records.js';
import { openBattleLog } from '../battle/log.js';
import { featureFlags } from '../../engine/meta.js';
import { TERMS } from '../glossary.js';

const TAGS = { boss: '보스전 출전', gate: '문지기 출전', battle: '일반전 출전', bench: '대기에서 귀환' };

export function recruitScreen(node, { run, rewards, profile, widgets, sheets, choices, preview, endingPending, changeChoices, confirm }) {
  const won = rewards.result === 'win';
  const dungeon = DUNGEONS[run.dungeonId];
  const selection = ids => won ? { recruits: ids } : { shard: ids[0] || null };
  const stamp = preview(selection(choices))?.stamp;
  const stampDungeon = DUNGEONS[stamp?.dungeonId];
  const stampContract = CONTRACTS[stamp?.contractId];
  const candidates = won ? rewards.recruitable : rewards.shardCandidates;
  const limit = won ? rewards.recruitLimit : 1;
  const mustRecruit = won && candidates.length > 0 && !profile.lead && run.firstIntroClear;
  const mustReserve = !won && candidates.length > 0;
  const { card, face } = widgets;
  const reason = id => won ? TAGS[rewards.recruitTags[id]] : '출전 기록 있음';

  node.classList.add('screen-split');
  node.innerHTML = `
    <div class="fixed-top">
      <div class="meta-scene meta-return-stage" style="background-image:url(${background(dungeon.background)})"></div>
      <div class="meta-recruit-body">
        <div class="meta-recruit-heading">
          <h2>${won ? '동료 영입' : '꿈 조각'}</h2>
          <button class="btn" id="meta-run-record">기록</button>
          ${run.lastBattleLog?.length ? '<button class="btn log-button" id="meta-battle-log">전투 기록</button>' : ''}
        </div>
        ${stampDungeon && stampContract ? `<p class="meta-contract-stamp">${esc(stampDungeon.name)} · ${esc(stampContract.name)}</p>` : ''}
        <p class="meta-mission-earned" hidden>동료 초대 가능</p>
        ${candidates.length ? `<p>${won ? `돌아온 동료 중 ${limit === 2 ? '두 명까지' : '한 명을'} 영입하세요.` : '다음 원정 후보 한 명 예약'}</p>`
          : `<p>${won ? '새로 영입할 동료가 없습니다.' : '예약할 동료가 없습니다.'}</p>`}
      </div>
    </div>
    <div class="scroll-list">
      <div class="meta-recruit-list">${candidates.map(id => `<button class="meta-panel meta-recruit-card" data-candidate="${id}">
        <span class="meta-face">${face(id, 44)}</span>
        <span><b>${esc(card(id).name)}</b>${won ? `<span class="companion-tag">${TERMS.returned.short}</span>` : ''}<small>${esc(reason(id))}</small></span>
        <span class="meta-recruit-mark" aria-hidden="true"></span>
      </button>`).join('')}</div>
    </div>
    <div class="meta-recruit-actions fixed-foot">
      <p class="meta-feedback" role="status"></p>
      <button class="btn go" id="meta-recruit-confirm"></button>
    </div>
  `;

  const feedback = $('.meta-feedback', node);
  const action = $('#meta-recruit-confirm', node);
  function renderSelection() {
    const active = choices.filter(id => candidates.includes(id));
    const actors = won
      ? hubLineup(profile.lead, [...active, ...run.bench]).map(id => run.bench.includes(id) ? id : null)
      : [];
    $('.meta-return-stage', node).innerHTML = sceneActors(actors, widgets);
    for (const button of $$('[data-candidate]', node)) {
      const selected = active.includes(button.dataset.candidate);
      button.setAttribute('aria-pressed', selected);
      $('.meta-recruit-mark', button).textContent = selected ? '선택' : '';
    }
    $('.meta-mission-earned', node).hidden = !featureFlags(profile).missions || !preview(selection(active))?.missions?.length;
    action.textContent = active.length
      ? won ? `${active.map(id => card(id).name).join(' · ')} · 관측소에 영입` : '다음 원정 후보로 예약'
      : endingPending ? '엔딩 보기' : '관측소로 돌아가기';
    if (!active.length && (mustRecruit || mustReserve)) action.textContent = won ? '영입할 동료 고르기' : '예약할 동료 고르기';
    action.disabled = !active.length && (mustRecruit || mustReserve);
  }
  $$('[data-candidate]', node).forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.candidate;
    if (choices.includes(id)) choices = choices.filter(candidate => candidate !== id);
    else if (limit === 1) choices = [id];
    else if (choices.length < limit) choices = [...choices, id];
    else {
      feedback.textContent = `최대 ${limit}명까지 영입할 수 있습니다.`;
      return;
    }
    feedback.textContent = '';
    changeChoices(choices);
    renderSelection();
  }));
  $('#meta-run-record', node).addEventListener('click', () => runRecordSheet(run, card, sheets.openSheet));
  $('#meta-battle-log', node)?.addEventListener('click', () => openBattleLog(sheets, widgets, run.lastBattleLog));
  action.addEventListener('click', () => {
    if (!confirm(selection(choices))) feedback.textContent = '선택을 다시 확인해 주세요.';
  });
  renderSelection();
}

export function recruitReceipt(ids, { card, face }) {
  return '<div class="recruit-receipts" role="status">' + ids.map(id =>
    '<div class="recruit-receipt win" data-recruited="' + esc(id) + '"><span class="run-face">' + face(id, 28) + '</span>' +
    '<b>' + esc(card(id).name) + '</b><span class="companion-tag">' + TERMS.recruit.short + '</span></div>').join('') + '</div>';
}

export function missionRecruitSheet({ period, widgets, sheets, claim, next, remaining }) {
  let chosen = null;
  const candidates = (period.candidates ?? []).filter(id => widgets.card(id));
  sheets.openSheet('동료 초대', `<div class="meta-sheet meta-mission-claim">
    <p>${period.kind === 'weekly' ? '주간' : '월간'} · ${esc(period.key.split(':')[1])}${remaining > 1 ? ` · 수령 ${remaining}건` : ''}</p>
    ${candidates.length ? `<div class="meta-recruit-list">${candidates.map(id => `<button class="meta-panel meta-recruit-card" data-invite="${esc(id)}" aria-pressed="false">
      <span class="meta-face">${widgets.face(id, 44)}</span><b>${esc(widgets.card(id).name)}</b>
    </button>`).join('')}</div>` : '<p>완료 도장을 받을 수 있습니다.</p>'}
    <p class="meta-feedback" role="status"></p>
    <button class="btn go" id="meta-mission-claim"${candidates.length ? ' disabled' : ''}>${candidates.length ? '관측소에 영입' : '완료 도장 받기'}</button>
    ${remaining > 1 ? '<button class="btn" id="meta-mission-next">다른 기간 보기</button>' : ''}
  </div>`);
  const action = $('#meta-mission-claim');
  const buttons = $$('[data-invite]');
  for (const button of buttons) button.addEventListener('click', () => {
    chosen = button.dataset.invite;
    for (const other of buttons) other.setAttribute('aria-pressed', String(button === other));
    action.disabled = false;
  });
  action.addEventListener('click', () => {
    if (!claim(chosen)) $('.meta-mission-claim .meta-feedback').textContent = '초대할 동료를 다시 확인해 주세요.';
  });
  $('#meta-mission-next')?.addEventListener('click', next);
}
