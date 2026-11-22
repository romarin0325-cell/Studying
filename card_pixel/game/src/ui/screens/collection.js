import { $, $$, esc } from '../dom.js';
import { icon } from '../assets.js';
import { skillText, traitText, TYPE } from '../widgets.js';
import { DUNGEONS } from '../../content/dungeons.js';
import { EPISODES } from '../../content/episodes.js';
import { RELICS } from '../../content/relics.js';
import { episodePages, episodeState } from '../../engine/episodes.js';
import { GRADE } from '../../engine/roster.js';
import { appearanceRegions, knownCompanions, missionsView, unrecruitedCompanions } from '../../engine/meta.js';
import { restoreProfile } from '../../engine/save.js';
import { EPISODE, TERMS } from '../glossary.js';
import { backupSlots, LAST_GOOD_KEY, SESSION_KEY, storage } from '../storage.js';
import { outcomeText, storyLine } from '../story-lines.js';
import { josa } from '../text.js';

export function saveEpisodeFlags(profile, field, ids) {
  if (!ids.length) return true;
  const flags = Object.fromEntries(ids.map(id => [id, true]));
  const ui = (profile.ui ??= {});
  ui[field] = { ...ui[field], ...flags };
  const slots = backupSlots(storage);
  try {
    const slot = slots.active();
    const runs = profile.records.appliedRuns;
    // Patch only these UI flags so an active expedition keeps its serialized checkpoint.
    function write(key) {
      const session = JSON.parse(slots.read(slot, key));
      const saved = restoreProfile(session?.profile);
      const applied = saved?.records.appliedRuns;
      if (applied?.length !== runs.length || !runs.every((id, index) => applied[index] === id)
        || !ids.every(id => saved.recruits[id]?.since === profile.recruits[id]?.since)) return false;
      const savedUi = (session.profile.ui ??= {});
      savedUi[field] = { ...savedUi[field], ...flags };
      slots.write(slot, key, JSON.stringify(session));
      return true;
    }
    if (!write(SESSION_KEY)) return false;
    try { write(LAST_GOOD_KEY); } catch { /* Keep the primary save. */ }
    return true;
  } catch { return false; }
}

function readEpisode(sheets, profile, id) {
  const { title, appearance, voice, body } = EPISODES[id];
  const pages = episodePages(body);
  const saved = episodeState(profile, id) === 'read' || saveEpisodeFlags(profile, 'episodesRead', [id]);
  if (!Object.keys(EPISODES).some(other => episodeState(profile, other) === 'new')) $('#meta-episode-badge')?.remove();
  sheets.openSheet(title, `<div class="episode-reader">
    <div class="episode-scroll">
      ${appearance || voice ? `<details class="episode-notes">
        <summary>${EPISODE.settings}</summary>
        ${appearance ? `<p><b>${EPISODE.appearance}</b> ${esc(appearance)}</p>` : ''}
        ${voice ? `<p><b>${EPISODE.voice}</b> ${esc(voice)}</p>` : ''}
      </details>` : ''}
      <div class="episode-page" tabindex="0"></div>
    </div>
    ${saved ? '' : `<p role="status">${EPISODE.saveFailed}</p>`}
    <div class="episode-controls">
      <button class="btn" type="button" id="episode-prev">${EPISODE.previous}</button>
      <span class="episode-count" role="status"></span>
      <button class="btn" type="button" id="episode-next">${EPISODE.next}</button>
    </div>
  </div>`);
  const reader = $('.episode-reader');
  const scroll = $('.episode-scroll', reader);
  const page = $('.episode-page', reader);
  const count = $('.episode-count', reader);
  const previous = $('#episode-prev', reader);
  const next = $('#episode-next', reader);
  let index = 0;
  function showPage() {
    page.innerHTML = pages[index].map(paragraph => `<p>${esc(paragraph)}</p>`).join('');
    count.textContent = `${index + 1} / ${pages.length}`;
    const focused = document.activeElement;
    previous.disabled = index === 0;
    next.disabled = index === pages.length - 1;
    if (focused === previous && previous.disabled) next.focus({ preventScroll: true });
    if (focused === next && next.disabled) previous.focus({ preventScroll: true });
    scroll.scrollTop = 0;
  }
  previous.addEventListener('click', () => { index--; showPage(); });
  next.addEventListener('click', () => { index++; showPage(); });
  showPage();
}

function historyList(profile, id, card) {
  const history = [...(profile.history?.[id] ?? []), ...(profile.ui?.recent?.[id] ?? [])].slice(0, 5);
  if (!history.length) return profile.recruits[id] ? '<h4>함께한 기록</h4><p>원정 기록 없음</p>' : '';
  return `<h4>함께한 기록</h4><ul class="companion-records">${history.map(entry => {
    const label = [DUNGEONS[entry.dungeonId].name, `${entry.floor}층`, entry.result === 'win' ? '원정 승리' : '원정 실패', outcomeText(entry)]
      .filter(Boolean).join(' · ');
    const line = entry.runId && storyLine(entry, card);
    return `<li><small>${esc(label)}</small>${line ? `<span class="companion-story" title="${esc(line)}">${esc(line)}</span>` : ''}</li>`;
  }).join('')}</ul>`;
}

function companionGrid(grid, { ids, profile, seen, widgets, select, pool }) {
  grid.innerHTML = ids.map(id => {
    const character = widgets.card(id);
    if (!character) return '';
    const known = seen.has(id);
    const recruit = profile.recruits[id];
    const face = `<span class="meta-face">${widgets.face(id, 44)}</span>`;
    const name = esc(character.name);
    if (pool) {
      const status = pool.sealedIds?.includes(id) ? TERMS.exclude.short : pool.addedIds?.includes(id) ? '추가' : '기본';
      const content = `${face}<b>${name}</b><small>${GRADE[character.grade] ?? ''} · ${status}</small>
        ${recruit ? '<small>영입</small>' : ''}`;
      const classes = 'meta-cell' + (known ? '' : ' concealed');
      return `<button class="${classes}" data-companion="${esc(id)}">${content}</button>`;
    }
    return `<button class="meta-cell${known ? '' : ' concealed'}" data-companion="${esc(id)}">
      ${face}<b>${name}</b>${recruit ? `<small>인연 ${recruit.bond}</small>` : known ? '' : '<small>미조우</small>'}</button>`;
  }).join('');
  $$('[data-companion]', grid).forEach(button => button.addEventListener('click', () => select(button.dataset.companion)));
}

export function rosterTable({ dungeon, pool, profile, widgets, sheets, inspect }) {
  const ids = [...new Set([...pool.baseIds, ...pool.effectiveIds, ...(pool.addedIds ?? [])])];
  const seen = knownCompanions(profile);
  const recruited = ids.filter(id => profile.recruits[id]);
  sheets.openSheet(`${dungeon.name} · 출현 명단`, `<div class="meta-sheet meta-roster">
    <p>조우 ${ids.filter(id => seen.has(id)).length}/${ids.length} · 영입 ${recruited.length}/${ids.length}</p>
    <p><small>기본 ${pool.baseIds.length}명</small></p>
    <div class="meta-collection-grid"></div>
  </div>`);
  const grid = $('.meta-roster .meta-collection-grid');
  companionGrid(grid, { ids, pool, profile, seen, widgets, select: inspect });
}

export function companionSheet({ core, roster, widgets, sheets, profile, id, openDestination, openMission }) {
  const { card, sprite } = widgets;
  const character = card(id);
  if (!character) return;
  const recruit = profile.recruits[id];
  const episode = episodeState(profile, id);
  const regions = appearanceRegions(roster, id);
  const met = !recruit && knownCompanions(profile).has(id);
  const unlocked = regions.filter(region => profile.unlockedDungeons.includes(region));
  const destination = met && openDestination && (unlocked.find(region => !profile.seals[region]?.includes(id)) ?? unlocked[0] ?? regions[0]);
  const departureHint = destination && (!unlocked.length ? '지역 해금 필요'
    : profile.seals[destination]?.includes(id) ? '준비에서 출현 제외 해제 필요' : '');
  const mission = met && openMission && missionsView(profile, roster).claimable.find(period => period.candidates.includes(id));
  const skills = character.skills.map(skill => {
    const body = skillText(core.SkillDisplay.body(skill, { entity: character }));
    return `<div class="meta-skill">
      <b>${esc(skill.name)}</b> <small>${TYPE[skill.type] || ''} · MP ${skill.cost || 0}</small>
      <p>${esc(body || '')}</p>
    </div>`;
  }).join('');
  sheets.openSheet(character.name, `
    <div class="meta-sheet meta-companion">
      <div class="meta-companion-art">${sprite(id)}</div>
      <p>나오는 지역: ${esc(regions.map(region => DUNGEONS[region].name).join(' · ') || '지역 기본 명단에 없음')}</p>
      ${destination || mission ? `<div class="meta-companion-links">
        ${destination ? `<button class="btn" data-companion-depart="${destination}">${esc(josa(DUNGEONS[destination].name, '으로/로'))} 출발</button>` : ''}
        ${departureHint ? `<small>${departureHint}</small>` : ''}
        ${mission ? `<button class="btn" id="meta-companion-mission">${mission.kind === 'weekly' ? '주간' : '월간'} 영입 임무</button>` : ''}
      </div>` : ''}
      ${recruit ? `<p title="${TERMS.bond.firstUse}">인연 ${recruit.bond}${profile.lead === id ? ' · ' + TERMS.startCompanion.short : ''}</p>` : ''}
      ${episode === 'none' ? '' : `<div class="episode-entry">
        <button class="btn" type="button" id="meta-episode"${episode === 'locked' ? ' aria-disabled="true" aria-describedby="meta-episode-condition"' : ''}>${esc(EPISODE.title(EPISODES[id].title))}</button>
        ${episode === 'locked' ? `<small id="meta-episode-condition">${EPISODE.locked}</small>` : ''}
      </div>`}
      ${historyList(profile, id, card)}
      <h4>특성</h4><p>${esc(traitText(character.trait))}</p>
      <h4>스킬</h4>${skills}
    </div>
  `);
  $('[data-companion-depart]', $('#sh-body'))?.addEventListener('click', () => openDestination(destination));
  $('#meta-companion-mission')?.addEventListener('click', () => openMission(mission));
  if (episode === 'new' || episode === 'read') $('#meta-episode').addEventListener('click', () => readEpisode(sheets, profile, id));
}

export function collectionScreen(node, { profile, roster, widgets, core, inspect }) {
  const seen = knownCompanions(profile);
  const unrecruited = new Set(unrecruitedCompanions(profile, roster));
  const canReadRelics = profile.notebook.chapters.includes(3);
  const dungeons = Object.values(DUNGEONS);
  const relics = core.ARTIFACT_LIST.filter(relic => Object.hasOwn(RELICS, relic.id));
  let lastRegion = Object.hasOwn(DUNGEONS, profile.ui?.destination) ? profile.ui.destination : dungeons[0].id;
  let metOnly = false;

  node.classList.add('screen-split');
  node.innerHTML = `
    <div class="meta-collection-bar fixed-top">
      <label for="meta-pool">지역</label>
      <select id="meta-pool">
        <option value="all" disabled hidden>전체 지역</option>
        ${dungeons.map(dungeon => `<option value="${dungeon.id}">${esc(dungeon.name)}</option>`).join('')}
        ${canReadRelics ? '<option value="relics">유물 도감</option>' : ''}
      </select>
      <span id="meta-collected"></span>
      <div class="meta-collection-filters">
        <input id="meta-companion-search" type="search" aria-label="동료 이름 검색" placeholder="동료 이름 검색">
        <button class="btn" type="button" id="meta-unrecruited" aria-pressed="false">영입 전</button>
      </div>
    </div>
    <div class="scroll-list"><div class="meta-collection-grid"></div></div>
  `;
  const grid = $('.meta-collection-grid', node);
  const poolSelect = $('#meta-pool', node);
  const search = $('#meta-companion-search', node);
  const metFilter = $('#meta-unrecruited', node);
  const allRegions = $('option[value="all"]', poolSelect);
  const list = $('.scroll-list', node);
  poolSelect.value = lastRegion;

  function render() {
    const dungeonId = poolSelect.value;
    search.parentElement.hidden = dungeonId === 'relics';
    list.scrollTop = 0;
    if (dungeonId === 'relics') {
      const known = relics.filter(relic => profile.seenRelics.includes(relic.id));
      $('#meta-collected', node).textContent = `발견 ${known.length}/${relics.length}`;
      grid.classList.add('relics');
      grid.innerHTML = relics.map(relic => profile.seenRelics.includes(relic.id)
        ? `<article class="meta-relic"><img class="px" src="${icon(relic.id)}" alt="" width="32" height="32">
          <div><b>${esc(relic.name)}</b><p>${esc(relic.desc || '')}</p></div></article>`
        : '<article class="meta-relic">미발견 유물</article>').join('');
      return;
    }
    grid.classList.remove('relics');
    const pool = dungeonId === 'all' ? roster.allies : roster.pool(DUNGEONS[dungeonId].pool);
    const candidates = metOnly ? pool.filter(id => unrecruited.has(id)) : pool;
    $('#meta-collected', node).textContent = metOnly ? `영입 전 ${candidates.length}명`
      : `조우 ${pool.filter(id => seen.has(id)).length}/${pool.length} · 영입 ${pool.filter(id => profile.recruits[id]).length}/${pool.length}`;
    const query = search.value.trim().toLocaleLowerCase('ko');
    const matches = candidates.filter(id => widgets.card(id)?.name.toLocaleLowerCase('ko').includes(query));
    companionGrid(grid, { ids: matches, profile, seen, widgets, select: inspect });
    if (!matches.length) grid.innerHTML = `<p class="meta-collection-empty">${metOnly && !query ? '영입 전 동료가 없습니다' : '검색 결과 없음'}</p>`;
  }

  poolSelect.addEventListener('change', () => {
    if (Object.hasOwn(DUNGEONS, poolSelect.value)) lastRegion = poolSelect.value;
    render();
  });
  metFilter.addEventListener('click', () => {
    metOnly = !metOnly;
    metFilter.setAttribute('aria-pressed', String(metOnly));
    allRegions.disabled = allRegions.hidden = !metOnly;
    poolSelect.value = metOnly ? 'all' : lastRegion;
    render();
  });
  search.addEventListener('input', render);
  render();
}
