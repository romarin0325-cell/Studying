import { $, $$, esc } from '../dom.js';
import { background } from '../assets.js';
import { DUNGEONS } from '../../content/dungeons.js';
import { LAYOUTS } from '../../content/layouts.js';
import { hubLineup, sceneActors } from './hub.js';
import { runRecordSheet } from './records.js';

export function recruitScreen(node, { run, rewards, profile, widgets, sheets, choices, endingPending, changeChoices, confirm }) {
  const won = rewards.result === 'win';
  const dungeon = DUNGEONS[run.dungeonId];
  const candidates = won ? rewards.recruitable : rewards.shardCandidates;
  const limit = won ? rewards.recruitLimit : 1;
  const mustRecruit = won && candidates.length > 0 && !profile.lead && run.firstIntroClear;
  const mustReserve = !won && candidates.length > 0;
  const gateFloor = LAYOUTS[dungeon.layout].findIndex(doors => doors.some(door => door.type === 'gate')) + 1;
  const { card, face } = widgets;
  const reason = id => won ? `${run.room?.party?.includes(id) ? run.floor : gateFloor}층 출전 · 생환` : '출전 기록 있음';

  node.innerHTML = `
    <div class="meta-scene meta-return-stage" style="background-image:url(${background(dungeon.background)})"></div>
    <div class="meta-recruit-body">
      <div class="meta-recruit-heading">
        <h2>${won ? '동료 영입' : '꿈 조각'}</h2>
        <button class="btn" id="meta-run-record">기록</button>
      </div>
      ${candidates.length ? `<p>${won ? `생환자 중 최대 ${limit}명 영입` : '다음 원정 후보 한 명 예약'}</p>`
        : `<p>${won ? '새로 영입할 동료가 없다.' : '예약할 동료가 없다.'}</p>`}
      <div class="meta-recruit-list">${candidates.map(id => `<button class="meta-panel meta-recruit-card" data-candidate="${id}">
        <span class="meta-face">${face(id, 44)}</span>
        <span><b>${esc(card(id).name)}</b><small>${esc(reason(id))}</small></span>
        <span class="meta-recruit-mark" aria-hidden="true"></span>
      </button>`).join('')}</div>
      <p class="meta-feedback" role="status"></p>
    </div>
    <div class="meta-recruit-actions">
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
    action.textContent = active.length
      ? won ? `${active.map(id => card(id).name).join(' · ')} 영입` : '다음 원정 후보로 예약'
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
      feedback.textContent = `최대 ${limit}명까지 영입할 수 있다.`;
      return;
    }
    feedback.textContent = '';
    changeChoices(choices);
    renderSelection();
  }));
  $('#meta-run-record', node).addEventListener('click', () => runRecordSheet(run, card, sheets.openSheet));
  action.addEventListener('click', () => {
    if (!confirm(won ? { recruits: choices } : { shard: choices[0] || null })) feedback.textContent = '선택을 다시 확인해 주세요.';
  });
  renderSelection();
}
