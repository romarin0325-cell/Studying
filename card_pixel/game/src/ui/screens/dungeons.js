import { $, $$, esc } from '../dom.js';
import { background, icon } from '../assets.js';
import { DUNGEONS } from '../../content/dungeons.js';
import { REGIONS } from '../../content/regions.js';
import { INTRO } from '../../content/intro.js';
import { availableDungeons, setExpeditionParty, setSeals, startView } from '../../engine/meta.js';
import { DIFFICULTY_NAME } from './records.js';

function regionalRule(dungeon) {
  const region = REGIONS[dungeon.region?.id];
  if (region) return region.desc;
  return dungeon.region?.first ? '5층의 문에서 후반 지역 규칙을 고른다.' : '1층 대여 전투 · 지역 규칙 없음';
}

const UNLOCK = {
  intro_clear: '새벽의 숲 생환',
  early_region_clear: '홍련 화산 또는 황혼 성당 생환',
  region_clear_count: '서로 다른 세 지역 생환'
};

export function dungeonsScreen(node, { profile, roster, widgets, prepare, quickStart }) {
  const available = new Map(availableDungeons(profile).map(dungeon => [dungeon.id, dungeon]));
  const rows = Object.values(DUNGEONS).map(dungeon => {
    if (!available.has(dungeon.id)) return `
      <article class="meta-panel meta-dungeon-locked">
        <img class="px" src="${icon('gate')}" alt="" width="32" height="32">
        <div><b>${esc(dungeon.name)}</b><small>${UNLOCK[dungeon.unlock.kind]}</small></div>
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
        <small class="meta-clear-marks"><span class="${clears?.normal ? 'cleared' : ''}">여정 ${clears?.normal ? '생환' : '—'}</span>
          ${dungeon.nightmareRule ? `<span class="${clears?.nightmare ? 'cleared' : ''}">악몽 ${clears?.nightmare ? '생환' : available.get(dungeon.id).difficulties.includes('nightmare') ? '—' : '잠김'}</span>` : ''}
        </small>
      </span>
      <span class="meta-face boss" title="${esc(bossName)}" aria-label="${esc(bossName)}" role="img">${bossFace}</span>
    </${tag}>`;
  }).join('');
  node.innerHTML = (quickStart
    ? `<button class="btn" id="meta-quick-start">${esc(quickStart.name)} · 바로 출발</button>` : '') + rows;
  $('#meta-quick-start', node)?.addEventListener('click', quickStart.start);
  $$('[data-dungeon]', node).forEach(button => button.addEventListener('click', () => prepare(button.dataset.dungeon)));
}

export function preparationSheet({ dungeonId, currentProfile, updateProfile, roster, sheets, start }) {
  const dungeon = DUNGEONS[dungeonId];
  const { card } = roster;
  let sealsOpen = false;

  function render(message = '') {
    const profile = currentProfile();
    const entry = availableDungeons(profile).find(dungeon => dungeon.id === dungeonId);
    const view = startView(profile, dungeonId);
    const difficulty = profile.ui?.difficulty?.[dungeonId] || 'normal';
    const intro = dungeon.layout === 'intro';
    const lead = view.lead;
    const selected = view.companions;
    const name = id => esc(card(id).name);
    const option = (id, chosen) => `<option value="${id}"${id === chosen ? ' selected' : ''}>${name(id)}</option>`;
    const leadChoices = view.leadCandidates.filter(id => !view.seals.includes(id));
    const scroll = $('#sh-body').scrollTop;

    sheets.openSheet(`${dungeon.name} · 준비`, `<div class="meta-sheet meta-prep">
      <section class="meta-prep-section">
        <h4>대표</h4>
        ${intro ? `<p>대여 편성 · ${INTRO.party.map(name).join(', ')}</p>` : leadChoices.length
          ? `<select id="meta-prep-lead" aria-label="대표"><option value="">미지정</option>${leadChoices.map(id => option(id, lead)).join('')}</select>`
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
      ${entry.difficulties.length > 1 ? `<section class="meta-prep-section">
        <h4>난이도</h4><div class="meta-prep-slots">${entry.difficulties.map(id => `<button class="btn" data-difficulty="${id}"
          aria-pressed="${id === difficulty}">${DIFFICULTY_NAME[id]}</button>`).join('')}</div>
      </section>` : ''}
      <section class="meta-prep-section">
        <h4>지역 규칙</h4><p>${esc(regionalRule(dungeon))}</p>
      </section>
      <p class="meta-feedback" role="status">${esc(message)}</p>
      <button class="btn go" id="meta-start-expedition">출발</button>
    </div>`);
    $('#sh-body').scrollTop = scroll;

    $('#meta-prep-lead')?.addEventListener('change', event => {
      const nextLead = event.target.value || null;
      const companions = profile.companions.filter(id => id !== nextLead);
      updateParty(nextLead, companions, nextLead === profile.lead ? profile.preferredCompanion : null);
    });
    for (const select of $$('.meta-prep [data-slot]')) select.addEventListener('change', () => {
      const index = Number(select.dataset.slot);
      const next = selected.slice();
      next[index] = select.value;
      const companions = next.filter(Boolean);
      const preferred = companions.includes(view.preferredCompanion) ? view.preferredCompanion : null;
      updateParty(profile.lead, companions, preferred);
    });
    $('#meta-prep-preferred')?.addEventListener('change', event => updateParty(profile.lead, selected, event.target.value || null));
    for (const button of $$('.meta-prep [data-seal]')) button.addEventListener('click', () => {
      const id = button.dataset.seal;
      const ids = view.seals.includes(id) ? view.seals.filter(sealed => sealed !== id) : [...view.seals, id];
      const result = setSeals(profile, dungeonId, ids, roster);
      if (result.announce.ok) updateProfile(result.profile);
      const errors = { empty_grade: '각 등급에서 한 명 이상 남겨야 한다.', invalid_seals: `최대 ${view.sealSlots}명까지 봉인할 수 있다.` };
      sealsOpen = true;
      render(errors[result.announce.reason]);
    });
    for (const button of $$('.meta-prep [data-difficulty]')) button.addEventListener('click', () => {
      sealsOpen = $('#meta-seals')?.open || false;
      updateProfile({ ...profile, ui: { ...profile.ui, difficulty: { ...profile.ui?.difficulty, [dungeonId]: button.dataset.difficulty } } });
      render();
    });
    $('#meta-start-expedition').addEventListener('click', () => start(dungeonId, difficulty));

    function updateParty(nextLead, companions, preferredCompanion) {
      sealsOpen = $('#meta-seals')?.open || false;
      const result = setExpeditionParty(profile, { lead: nextLead, companions, preferredCompanion });
      if (result.announce.ok) updateProfile(result.profile);
      render(result.announce.ok ? '' : '편성을 다시 확인해 주세요.');
    }
  }

  render();
}
