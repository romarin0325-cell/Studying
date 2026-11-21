import { $, $$, esc } from '../dom.js';
import { background, icon } from '../assets.js';
import { DUNGEONS } from '../../content/dungeons.js';
import { REGIONS } from '../../content/regions.js';
import { INTRO } from '../../content/intro.js';
import { CONTRACTS, CONTRACT_ESCROW, CONTRACT_PAYOUT } from '../../content/contracts.js';
import * as Meta from '../../engine/meta.js';
import * as Roster from '../../engine/roster.js';
import { rosterTable } from './collection.js';
import { DIFFICULTY_NAME } from './records.js';

const { availableDungeons, setExpeditionParty, setSeals, startView } = Meta;

export function departureDifficulty(profile, dungeonId) {
  const choice = profile.ui?.difficulty?.[dungeonId];
  const entry = availableDungeons(profile).find(dungeon => dungeon.id === dungeonId);
  return entry?.difficulties?.includes(choice) ? choice : 'normal';
}

export function listedPool(roster, dungeon, view) {
  const pool = Roster.expeditionPool?.(roster, dungeon.id, view);
  const baseIds = pool?.baseIds ?? roster.pool(dungeon.pool);
  const setName = pool?.setName ?? roster.poolName?.(dungeon.pool) ?? dungeon.name;
  if (pool?.effectiveIds) return { ...pool, baseIds, setName };
  const extra = dungeon.layout === 'intro' ? [view?.reserved] : [...(view?.companions ?? []), view?.lead, view?.reserved];
  const effectiveIds = roster.pool(dungeon.pool, { companions: extra.filter(Boolean), seals: view?.seals });
  return { setName, baseIds, effectiveIds, addedIds: effectiveIds.filter(id => !baseIds.includes(id)),
    sealedIds: baseIds.filter(id => !effectiveIds.includes(id)) };
}

function regionalRule(dungeon) {
  const region = REGIONS[dungeon.region?.id];
  if (region) return region.desc;
  return dungeon.region?.first ? '5층의 문에서 후반 지역 규칙 선택' : '1층 대여 전투 · 지역 규칙 없음';
}

const UNLOCK = {
  intro_clear: '새벽의 숲 생환',
  early_region_clear: '홍련 화산 또는 황혼 성당 생환',
  region_clear_count: '서로 다른 세 지역 생환'
};

export function dungeonsScreen(node, { profile, roster, widgets, prepare, openRoster, quickStart }) {
  const available = new Map(availableDungeons(profile).map(dungeon => [dungeon.id, dungeon]));
  const rows = Object.values(DUNGEONS).map(dungeon => {
    if (!available.has(dungeon.id)) return `
      <article class="meta-panel meta-dungeon-locked">
        <img class="px" src="${icon('gate')}" alt="" width="32" height="32">
        <div><b>${esc(dungeon.name)}</b><small>${UNLOCK[dungeon.unlock.kind]}</small>
          <button class="btn meta-roster-line" data-locked-roster="${dungeon.id}">기본 출현표</button></div>
      </article>
    `;
    const boss = dungeon.boss === 'shadow_pair' ? null : roster.bossOf(dungeon.boss);
    const bossFace = boss ? widgets.face(boss.sprite, 32) : `<img class="px" src="${icon('boss')}" alt="" width="32" height="32">`;
    const bossName = boss?.name || '그림자 둘';
    const clears = profile.records.clears[dungeon.id];
    const tag = prepare ? 'button' : 'article';
    return `<${tag} class="meta-panel meta-dungeon"${prepare ? ` data-dungeon="${dungeon.id}"` : ''}>
      <span class="meta-dungeon-art" data-region="${dungeon.id}" style="background-image:url(${background(dungeon.background)})"></span>
      <span class="meta-dungeon-copy">
        <b>${esc(dungeon.name)}</b>
        <span>${esc(regionalRule(dungeon))}</span>
        <small class="meta-clear-marks">${dungeon.layout !== 'intro' ? `<span class="${clears?.easy ? 'cleared' : ''}">꿈결 ${clears?.easy ? '생환' : '—'}</span>` : ''}
          <span class="${clears?.normal ? 'cleared' : ''}">여정 ${clears?.normal ? '생환' : '—'}</span>
          ${dungeon.nightmareRule ? `<span class="${clears?.nightmare ? 'cleared' : ''}">악몽 ${clears?.nightmare ? '생환' : available.get(dungeon.id).difficulties.includes('nightmare') ? '—' : '잠김'}</span>` : ''}
        </small>
      </span>
      <span class="meta-face boss" title="${esc(bossName)}" aria-label="${esc(bossName)}" role="img">${bossFace}</span>
    </${tag}>`;
  }).join('');
  node.innerHTML = (quickStart
    ? `<button class="btn" id="meta-quick-start">${esc(quickStart.name)} · ${DIFFICULTY_NAME[quickStart.difficulty]} · 바로 출발</button>` : '') + rows;
  $('#meta-quick-start', node)?.addEventListener('click', quickStart?.start);
  $$('[data-locked-roster]', node).forEach(button => button.addEventListener('click', () => openRoster(button.dataset.lockedRoster)));
  $$('[data-dungeon]', node).forEach(button => button.addEventListener('click', () => prepare(button.dataset.dungeon)));
}

export function preparationSheet({ dungeonId, currentProfile, updateProfile, savePreparation, roster, widgets, sheets, start }) {
  const dungeon = DUNGEONS[dungeonId];
  const { card } = roster;
  let sealsOpen = false;
  let leadRow;

  function scrollPosition() {
    return { top: $('#sh-body').scrollTop, leads: leadRow?.scrollLeft, seals: $('.meta-seal-options')?.scrollTop };
  }

  function render(message = '', focusLead, scroll = scrollPosition()) {
    const profile = currentProfile();
    const entry = availableDungeons(profile).find(dungeon => dungeon.id === dungeonId);
    const view = startView(profile, dungeonId);
    const draft = profile.ui?.preparation;
    const saved = draft?.dungeonId === dungeonId ? draft : null;
    const difficulty = entry?.difficulties?.includes(saved?.difficulty) ? saved.difficulty : departureDifficulty(profile, dungeonId);
    const pool = listedPool(roster, dungeon, view);
    const contracts = Meta.contractsFor?.(profile, dungeonId);
    const canContract = difficulty === 'nightmare' && contracts?.unlocked;
    const intro = dungeon.layout === 'intro';
    const lead = view.lead;
    const selected = view.companions;
    const name = id => esc(card(id).name);
    const option = (id, chosen) => `<option value="${id}"${id === chosen ? ' selected' : ''}>${name(id)}</option>`;
    const leadChoices = view.leadCandidates.filter(id => !view.seals.includes(id));
    const contractChoice = canContract && Object.hasOwn(CONTRACTS, saved?.contract) ? CONTRACTS[saved.contract] : null;

    sheets.openSheet(`${dungeon.name} · 준비`, `<div class="meta-sheet meta-prep">
      <section class="meta-prep-section">
        <h4 id="meta-lead-heading">대표</h4>
        ${intro ? `<p>대여 편성 · ${INTRO.party.map(name).join(', ')}</p>` : leadChoices.length
          ? `<div class="meta-prep-leads" role="group" aria-labelledby="meta-lead-heading">
            <button class="btn" type="button" data-lead="" aria-pressed="${lead === null}">미지정</button>
            ${leadChoices.map(id => `<button class="btn" type="button" data-lead="${esc(id)}" aria-pressed="${id === lead}">
              <span class="meta-face">${widgets.face(id, 44)}</span><span>${name(id)}</span>
            </button>`).join('')}
          </div>`
          : '<p>지정할 동료 없음</p>'}
      </section>
      ${!intro && view.companionSlots ? `<section class="meta-prep-section">
        <h4>동행</h4>
        <div class="meta-prep-slots">${Array.from({ length: view.companionSlots }, (_, index) => {
          const chosen = selected[index];
          const choices = view.companionCandidates.filter(id => id === chosen || !selected.includes(id));
          return `<select data-slot="${index}" aria-label="동행 ${index + 1}"><option value="">빈자리</option>${choices.map(id => option(id, chosen)).join('')}</select>`;
        }).join('')}</div>
        <p><small>첫 골라 깨우기 후보 한 자리 보장</small></p>
        ${lead && profile.recruits[lead].bond >= 1 && selected.length > 1 ? `<label class="meta-preferred">우선 후보
          <select id="meta-prep-preferred"><option value="">자동</option>${selected.map(id => option(id, view.preferredCompanion)).join('')}</select>
        </label>` : ''}
      </section>` : ''}
      ${view.sealSlots ? `<details class="meta-prep-section" id="meta-seals"${sealsOpen ? ' open' : ''}>
        <summary>봉인 <small>${view.seals.length}/${view.sealSlots} · ${view.seals.map(name).join(', ') || '선택 없음'}</small></summary>
        <div class="meta-seal-options">${roster.pool(dungeon.pool).map(id => `<button class="btn" data-seal="${id}" aria-pressed="${view.seals.includes(id)}">
          ${name(id)}</button>`).join('')}</div>
      </details>` : ''}
      <button class="btn meta-roster-line" id="meta-roster-open">${esc(pool.setName)} · 기본 ${pool.baseIds.length}명 · 출현표</button>
      ${!intro ? `<section class="meta-prep-section">
        <h4>난이도</h4><div class="meta-prep-slots">${Object.keys(DIFFICULTY_NAME).map(id => `<button class="btn" data-difficulty="${id}"
          aria-pressed="${id === difficulty}"${entry?.difficulties?.includes(id) ? '' : ' disabled'}>${DIFFICULTY_NAME[id]}</button>`).join('')}</div>
        <p><small>꿈결 · 적 공격·마공 35% 감소</small></p>
        ${entry?.difficulties?.includes('nightmare') ? '' : '<p><small>이 지역을 여정으로 생환하면 악몽이 열립니다.</small></p>'}
      </section>` : ''}
      ${canContract ? `<button class="btn meta-prep-contract" id="meta-contract-choice">
        악몽 계약 · ${esc(contractChoice?.name || '없음')}
      </button>` : ''}
      <section class="meta-prep-section">
        <h4>지역 규칙</h4><p>${esc(regionalRule(dungeon))}</p>
      </section>
      <p class="meta-feedback" role="status">${esc(message)}</p>
      <button class="btn go" id="meta-start-expedition">출발</button>
    </div>`);
    $('#sh-body').scrollTop = scroll.top;
    const sealOptions = $('.meta-seal-options');
    if (sealOptions) sealOptions.scrollTop = scroll.seals ?? 0;

    leadRow = $('.meta-prep-leads');
    if (leadRow) {
      const buttons = $$('[data-lead]', leadRow);
      const active = buttons.find(button => button.getAttribute('aria-pressed') === 'true');
      leadRow.scrollLeft = scroll.leads ?? (active ? Math.max(0, active.offsetLeft + active.offsetWidth - leadRow.clientWidth) : 0);
      buttons.find(button => button.dataset.lead === focusLead)?.focus({ preventScroll: true });
      for (const button of buttons) button.addEventListener('click', () => {
        const nextLead = button.dataset.lead || null;
        const companions = profile.companions.filter(id => id !== nextLead);
        const preferred = nextLead === profile.lead ? profile.preferredCompanion : null;
        updateParty(nextLead, companions, preferred, button.dataset.lead);
      });
    }
    for (const select of $$('.meta-prep [data-slot]')) select.addEventListener('change', () => {
      const index = Number(select.dataset.slot);
      const next = selected.slice();
      next[index] = select.value;
      const companions = next.filter(Boolean);
      const preferred = companions.includes(view.preferredCompanion) ? view.preferredCompanion : null;
      updateParty(profile.lead, companions, preferred);
    });
    $('#meta-prep-preferred')?.addEventListener('change', event => updateParty(profile.lead, selected, event.target.value || null));
    $('#meta-roster-open').addEventListener('click', () => {
      sealsOpen = $('#meta-seals')?.open || false;
      const scroll = scrollPosition();
      rosterTable({ dungeon, pool, currentProfile, updateProfile, widgets, sheets, back() {
        render(message, undefined, scroll);
        $('#meta-roster-open')?.focus({ preventScroll: true });
      } });
    });
    for (const button of $$('.meta-prep [data-seal]')) button.addEventListener('click', () => {
      const id = button.dataset.seal;
      const ids = view.seals.includes(id) ? view.seals.filter(sealed => sealed !== id) : [...view.seals, id];
      const result = setSeals(profile, dungeonId, ids, roster);
      if (result.announce.ok) updateProfile(result.profile);
      const errors = { empty_grade: '등급마다 최소 1명은 남겨야 합니다.', invalid_seals: `최대 ${view.sealSlots}명까지 봉인할 수 있습니다.` };
      sealsOpen = true;
      render(errors[result.announce.reason]);
    });
    for (const button of $$('.meta-prep [data-difficulty]')) button.addEventListener('click', () => {
      sealsOpen = $('#meta-seals')?.open || false;
      const difficulty = button.dataset.difficulty;
      savePreparation({ dungeonId, difficulty, contract: difficulty === 'nightmare' ? contractChoice?.id ?? null : null });
      render();
    });
    $('#meta-contract-choice')?.addEventListener('click', () => {
      sealsOpen = $('#meta-seals')?.open || false;
      const scroll = scrollPosition();
      function back() {
        render('', undefined, scroll);
        $('#meta-contract-choice')?.focus({ preventScroll: true });
      }
      sheets.openSheet('악몽 계약', `<div class="meta-sheet meta-contract-options">
        <button class="btn" data-contract="" aria-pressed="${!contractChoice}">계약 없음</button>
        ${Object.values(CONTRACTS).map(entry => `<button class="btn big" data-contract="${entry.id}" aria-pressed="${entry.id === contractChoice?.id}">
          <b>${esc(entry.name)}</b><small>${esc(entry.rule)}</small>
          <small>문지기 보상에서 ◆${CONTRACT_ESCROW} 맡김 · 6층까지 달성하면 ◆${CONTRACT_PAYOUT}</small>
          <small class="${contracts.stamps?.[entry.id] ? 'gain' : ''}">${contracts.stamps?.[entry.id] ? '도장 획득' : '도장 없음'}</small>
        </button>`).join('')}
        <button class="btn" id="meta-contract-back">준비로 돌아가기</button>
      </div>`, { onClose: back });
      for (const button of $$('.meta-contract-options [data-contract]')) button.addEventListener('click', () => {
        savePreparation({ dungeonId, difficulty, contract: button.dataset.contract || null });
        back();
      });
      $('#meta-contract-back').addEventListener('click', back);
    });
    $('#meta-start-expedition').addEventListener('click', () => start(dungeonId, difficulty, contractChoice?.id ?? null));

    function updateParty(nextLead, companions, preferredCompanion, focusLead) {
      sealsOpen = $('#meta-seals')?.open || false;
      const result = setExpeditionParty(profile, { lead: nextLead, companions, preferredCompanion });
      if (result.announce.ok) updateProfile(result.profile);
      render(result.announce.ok ? '' : '편성을 다시 확인해 주세요.', focusLead);
    }
  }

  render('', undefined, { top: 0 });
}
