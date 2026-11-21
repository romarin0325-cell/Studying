import { $, $$, esc } from '../dom.js';
import { background, icon } from '../assets.js';
import { DUNGEONS } from '../../content/dungeons.js';
import { REGIONS } from '../../content/regions.js';
import { CONTRACTS, CONTRACT_ESCROW, CONTRACT_PAYOUT } from '../../content/contracts.js';
import * as Meta from '../../engine/meta.js';
import * as Roster from '../../engine/roster.js';
import { DIFFICULTY_NAME } from './records.js';
import { pixelIcon } from '../pixel-icons.js';
import { TERMS } from '../glossary.js';

const { availableDungeons, departureDifficulty, setExpeditionParty, setSeals, startView } = Meta;

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

export function dungeonsScreen(node, { profile, roster, widgets, prepare, openRoster, quickStart, scrollTop, selectedId = quickStart?.id }) {
  const flags = Meta.featureFlags(profile);
  const available = new Map(availableDungeons(profile).map(dungeon => [dungeon.id, dungeon]));
  const next = Object.values(DUNGEONS).find(dungeon => !available.has(dungeon.id));
  const rows = Object.values(DUNGEONS).map(dungeon => {
    const selected = dungeon.id === selectedId;
    if (!available.has(dungeon.id)) return (profile.ui.entry.legacy || dungeon === next || selected) ? `
      <article class="meta-panel meta-dungeon-locked"${selected ? ' aria-current="true"' : ''}>
        ${pixelIcon('lock')}
        <div><b>${esc(dungeon.name)}</b><small>${UNLOCK[dungeon.unlock.kind]}</small>
          <button class="btn meta-roster-line" data-locked-roster="${dungeon.id}">기본 출현 명단</button></div>
      </article>
    ` : '';
    const boss = dungeon.boss === 'shadow_pair' ? null : roster.bossOf(dungeon.boss);
    const bossFace = boss ? widgets.face(boss.sprite, 32) : `<img class="px" src="${icon('boss')}" alt="" width="32" height="32">`;
    const bossName = boss?.name || '그림자 둘';
    const clears = profile.records.clears[dungeon.id];
    const tag = prepare ? 'button' : 'article';
    return `<${tag} class="meta-panel meta-dungeon"${prepare ? ` data-dungeon="${dungeon.id}" aria-pressed="${selected}"` : ''}>
      <span class="meta-dungeon-art" data-region="${dungeon.id}" style="background-image:url(${background(dungeon.background)})"></span>
      <span class="meta-dungeon-copy">
        <b>${esc(dungeon.name)}</b>
        ${flags.regionRules ? `<span>${esc(regionalRule(dungeon))}</span>` : ''}
        ${flags.difficultyChoice ? `<small class="meta-clear-marks">${dungeon.layout !== 'intro' ? `<span class="${clears?.easy ? 'cleared' : ''}">꿈결 ${clears?.easy ? '생환' : '—'}</span>` : ''}
          <span class="${clears?.normal ? 'cleared' : ''}">여정 ${clears?.normal ? '생환' : '—'}</span>
          ${dungeon.nightmareRule ? `<span class="${clears?.nightmare ? 'cleared' : ''}">악몽 ${clears?.nightmare ? '생환' : available.get(dungeon.id).difficulties.includes('nightmare') ? '—' : '잠김'}</span>` : ''}
        </small>` : clears?.normal || clears?.easy ? '<small class="meta-clear-marks">클리어</small>' : ''}
      </span>
      <span class="meta-face boss" title="${esc(bossName)}" aria-label="${esc(bossName)}" role="img">${bossFace}</span>
    </${tag}>`;
  }).join('');
  node.classList.add('screen-split');
  node.innerHTML = `<div class="scroll-list">${rows}</div>
    ${quickStart ? `<div class="fixed-foot">
      ${flags.prepEditing && quickStart.id !== 'dawn_forest' ? '<button class="btn" id="meta-prepare-destination">준비</button>' : ''}
      <button class="btn go" id="meta-quick-start">${esc(quickStart.name)}${flags.difficultyChoice ? ' · ' + DIFFICULTY_NAME[quickStart.difficulty] : ''} · 바로 출발</button>
    </div>` : ''}`;
  $('#meta-quick-start', node)?.addEventListener('click', quickStart?.start);
  $('#meta-prepare-destination', node)?.addEventListener('click', () => prepare(quickStart.id));
  $$('[data-locked-roster]', node).forEach(button => button.addEventListener('click', () => openRoster(button.dataset.lockedRoster)));
  $$('[data-dungeon]', node).forEach(button => button.addEventListener('click', () => prepare(button.dataset.dungeon)));
  const list = $('.scroll-list', node);
  if (scrollTop != null) list.scrollTop = scrollTop;
  const selected = $('[data-dungeon][aria-pressed="true"], .meta-dungeon-locked[aria-current="true"]', list);
  if (selected) {
    const row = selected.getBoundingClientRect();
    const port = list.getBoundingClientRect();
    if (row.top < port.top) list.scrollTop += row.top - port.top - 2;
    else if (row.bottom > port.bottom) list.scrollTop += row.bottom - port.bottom + 8;
  }
}

export function preparationSheet({ dungeonId, currentProfile, updateProfile, savePreparation, roster, widgets, sheets, start }) {
  const dungeon = DUNGEONS[dungeonId];
  if (!Meta.featureFlags(currentProfile()).prepEditing) return;
  const name = id => esc(roster.card(id)?.name ?? id ?? '미지정');
  const status = row => row.excluded ? ['excluded', '×', TERMS.exclude.short] :
    row.start ? ['start', '★', '시작'] : row.invited ? ['invited', '↪', TERMS.springInvite.short] :
      row.added ? ['added', '+', '추가'] : ['base', '·', '기본'];

  function scrollPosition() {
    return { top: $('#sh-body').scrollTop, grid: $('.meta-prep-pool')?.scrollTop ?? 0 };
  }

  function render(message = '', scroll = scrollPosition(), focus) {
    const profile = currentProfile();
    const flags = Meta.featureFlags(profile);
    const entry = availableDungeons(profile).find(dungeon => dungeon.id === dungeonId);
    const { start: lead, invite, exclude, pool } = Meta.prepView(profile, dungeonId, roster);
    const leadChoices = lead.candidates.filter(id => !exclude.ids.includes(id) && id !== lead.id);
    const draft = profile.ui.preparation?.dungeonId === dungeonId ? profile.ui.preparation : null;
    const difficulty = entry?.difficulties?.includes(draft?.difficulty) ? draft.difficulty : departureDifficulty(profile, dungeonId);
    const contracts = Meta.contractsFor(profile, dungeonId);
    const canContract = difficulty === 'nightmare' && contracts.unlocked;
    const contractChoice = canContract && Object.hasOwn(CONTRACTS, draft?.contract) ? CONTRACTS[draft.contract] : null;
    const outsidePool = Meta.startView(profile, dungeonId).companionCandidates.filter(id => !pool.some(row => row.id === id));
    const cell = row => {
      const [key, symbol, label] = status(row);
      return `<button class="meta-cell meta-prep-cell" type="button" data-prep-id="${esc(row.id)}" data-status="${key}"${row.canInvite && !row.invited ? ' data-can-invite' : ''} aria-haspopup="dialog">
        <span class="meta-face">${widgets.face(row.id, 44)}</span><b>${name(row.id)}</b>
        <small><span aria-hidden="true">${symbol}</span> ${label}</small>
      </button>`;
    };
    const rule = regionalRule(dungeon);
    const lockedNightmare = !entry.difficulties.includes('nightmare') && dungeon.nightmareRule;
    sheets.openSheet(`${dungeon.name} · 준비`, `<div class="meta-sheet meta-prep">
      ${flags.difficultyChoice ? `<div class="meta-prep-slots" role="group" aria-label="난이도">${Object.keys(DIFFICULTY_NAME)
        .filter(id => id !== 'nightmare' || dungeon.nightmareRule).map(id => `<button class="btn" data-difficulty="${id}"
          aria-pressed="${id === difficulty}"${entry.difficulties.includes(id) ? '' : ' disabled'}>${id === 'nightmare' && lockedNightmare
          ? pixelIcon('lock', 16) : ''}${DIFFICULTY_NAME[id]}</button>`).join('')}</div>
        <p class="sm">꿈결 · 적 공격·마공 35% 감소</p>
        ${lockedNightmare ? '<p class="sm">이 지역을 여정으로 클리어하면 악몽이 열립니다.</p>' : ''}` : ''}
      ${canContract ? `<button class="btn meta-prep-contract" id="meta-contract-choice">악몽 계약 · ${esc(contractChoice?.name || '없음')}</button>` : ''}
      ${flags.regionRules ? `<button class="btn" id="meta-region-rule" data-rule="${esc(rule)}">지역 규칙</button>` : ''}
      <p id="meta-prep-summary" aria-live="polite">시작 ${name(lead.id)} · 샘 초대 ${invite.ids.length}/${invite.slots} · 출현 제외 ${exclude.ids.length}/${exclude.slots}</p>
      <section class="meta-prep-section">
        <h4>시작 동료 1명</h4>
        <div class="meta-prep-lead">${lead.id ? `<span class="meta-face">${widgets.face(lead.id, 44)}</span>` : ''}
          <b>${name(lead.id)}</b><button class="btn" id="meta-change-lead"${leadChoices.length ? '' : ' disabled'}>바꾸기</button>
        </div>
      </section>
      <section class="meta-prep-section">
        <h4>이 지역 출현 명단</h4>
        <p class="sm">${TERMS.springInvite.firstUse}</p>
        ${outsidePool.length && invite.ids.length < invite.slots ? '<button class="btn" id="meta-find-invites">명단 밖 동료 초대</button>' : ''}
        <div class="meta-collection-grid meta-prep-pool">${pool.map(cell).join('')}</div>
        <div class="meta-prep-menu win" id="meta-prep-menu" popover role="dialog" aria-label="동료 준비"></div>
      </section>
      <p class="meta-feedback" role="status">${esc(message)}</p>
      <button class="btn go" id="meta-start-expedition">출발</button>
    </div>`);
    $('#sh-body').scrollTop = scroll.top;
    $('.meta-prep-pool').scrollTop = scroll.grid;
    if (focus) $(focus)?.focus({ preventScroll: true });

    function back(message, focus) {
      const previous = scrollPosition();
      return () => render(message, previous, focus);
    }

    function apply(result, focus) {
      const errors = {
        invalid_companions: '샘 초대 자리를 확인해 주세요.',
        invalid_seals: '이 지역의 출현 제외 자리를 확인해 주세요.',
        empty_grade: TERMS.exclude.detail,
        lead_excluded: '시작 동료는 제외할 수 없습니다.'
      };
      if (result.announce.ok) updateProfile(result.profile);
      render(errors[result.announce.reason] ?? '', scrollPosition(), focus);
    }

    function party(id, invited, focus) {
      const preferred = id === profile.lead && invited.includes(profile.preferredCompanion) ? profile.preferredCompanion : null;
      apply(setExpeditionParty(profile, { lead: id, companions: invited, preferredCompanion: preferred }), focus);
    }

    function setLead(id, focus) {
      party(id, invite.ids.filter(candidate => candidate !== id), focus);
    }

    function chooseCompanion(button, ids, verb, select) {
      const menu = $('#meta-prep-menu');
      menu.innerHTML = `<b>${verb}</b><div class="meta-prep-choices">${ids.map(id =>
        `<button class="btn" data-choose-prep="${esc(id)}">${name(id)}</button>`).join('')}</div>`;
      for (const choice of $$('[data-choose-prep]', menu)) {
        choice.addEventListener('click', () => select(choice.dataset.choosePrep));
      }
      showMenu(menu, button);
    }

    $('#meta-change-lead').addEventListener('click', event => {
      chooseCompanion(event.currentTarget, leadChoices, '시작 동료로 바꾸기', id => setLead(id, '#meta-change-lead'));
    });
    $('#meta-find-invites')?.addEventListener('click', event => {
      chooseCompanion(event.currentTarget, outsidePool, TERMS.springInvite.short,
        id => party(lead.id, [...invite.ids, id], `[data-prep-id="${CSS.escape(id)}"]`));
    });

    for (const [index, button] of $$('.meta-prep-cell').entries()) {
      button.addEventListener('click', () => {
        const row = pool[index];
        const { id } = row;
        const focus = `[data-prep-id="${CSS.escape(id)}"]`;
        const actions = [];
        if (!row.start && !row.excluded && lead.candidates.includes(id)) actions.push(['시작 동료로', () => setLead(id, focus)]);
        if (row.canInvite && !row.invited) actions.push([TERMS.springInvite.short, () => party(lead.id, [...invite.ids, id], focus)]);
        if (row.canExclude && !row.excluded) actions.push([TERMS.exclude.short, () => apply(setSeals(profile, dungeonId, [...exclude.ids, id], roster), focus)]);
        if (row.excluded) actions.push(['해제', () => apply(setSeals(profile, dungeonId, exclude.ids.filter(other => other !== id), roster), focus)]);
        else if (row.invited) actions.push(['해제', () => party(lead.id, invite.ids.filter(other => other !== id), focus)]);
        else if (row.start) actions.push(['해제', () => setLead(null, focus)]);
        const menu = $('#meta-prep-menu');
        menu.innerHTML = `<b>${name(id)}</b>${actions.map(([label], action) => `<button class="btn" data-action="${action}">${label}</button>`).join('')}
          ${row.reason ? `<p>${esc(row.reason)}</p>` : ''}`;
        for (const choice of $$('[data-action]', menu)) choice.addEventListener('click', actions[choice.dataset.action][1]);
        showMenu(menu, button);
      });
    }
    for (const button of $$('.meta-prep [data-difficulty]')) button.addEventListener('click', () => {
      const next = button.dataset.difficulty;
      savePreparation({ dungeonId, difficulty: next, contract: next === 'nightmare' ? contractChoice?.id ?? null : null });
      render('', scrollPosition(), `[data-difficulty="${next}"]`);
    });
    $('#meta-region-rule')?.addEventListener('click', () => {
      sheets.openSheet('지역 규칙', `<p>${esc(rule)}</p>`, { onClose: back('', '#meta-region-rule') });
    });
    $('#meta-contract-choice')?.addEventListener('click', () => {
      const restore = back('', '#meta-contract-choice');
      sheets.openSheet('악몽 계약', `<div class="meta-sheet meta-contract-options">
        <button class="btn" data-contract="" aria-pressed="${!contractChoice}">계약 없음</button>
        ${Object.values(CONTRACTS).map(contract => `<button class="btn big" data-contract="${contract.id}" aria-pressed="${contract.id === contractChoice?.id}">
          <b>${esc(contract.name)}</b><small>${esc(contract.rule)}</small>
          <small>문지기 보상에서 ◆${CONTRACT_ESCROW} 맡김 · 6층까지 달성하면 ◆${CONTRACT_PAYOUT}</small>
          <small class="${contracts.stamps[contract.id] ? 'gain' : ''}">${contracts.stamps[contract.id] ? '도장 획득' : '도장 없음'}</small>
        </button>`).join('')}
        <button class="btn" id="meta-contract-back">준비로 돌아가기</button>
      </div>`, { onClose: restore });
      for (const button of $$('.meta-contract-options [data-contract]')) button.addEventListener('click', () => {
        savePreparation({ dungeonId, difficulty, contract: button.dataset.contract || null });
        restore();
      });
      $('#meta-contract-back').addEventListener('click', restore);
    });
    $('#meta-start-expedition').addEventListener('click', () => start(dungeonId, difficulty, contractChoice?.id ?? null));
  }

  render('', { top: 0, grid: 0 });
}

function showMenu(menu, anchor) {
  if (menu.matches(':popover-open')) menu.hidePopover();
  menu.showPopover();
  const { left, top, bottom } = anchor.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(left, innerWidth - menu.offsetWidth - 8)) + 'px';
  const above = bottom + menu.offsetHeight + 8 > innerHeight;
  menu.style.top = Math.max(8, above ? top - menu.offsetHeight - 6 : bottom + 6) + 'px';
  menu.querySelector('button')?.focus({ preventScroll: true });
}
