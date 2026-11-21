import { $, $$, esc } from '../dom.js';
import { icon } from '../assets.js';
import { skillText, traitText, TYPE } from '../widgets.js';
import { DUNGEONS } from '../../content/dungeons.js';
import { RELICS } from '../../content/relics.js';
import { GRADE } from '../../engine/roster.js';
import { appearanceRegions } from '../../engine/meta.js';
import { TERMS } from '../glossary.js';
import { outcomeText, storyLine } from '../story-lines.js';

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

function companionGrid(grid, { ids, profile, widgets, select, pool }) {
  const seen = new Set([...(profile.seenCharacters ?? []), ...Object.keys(profile.recruits)]);
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
  const counts = (profile, ids) => {
    const recruited = ids.filter(id => profile.recruits[id]);
    const seen = new Set([...(profile.seenCharacters ?? []), ...recruited]);
    return `조우 ${ids.filter(id => seen.has(id)).length}/${ids.length} · 영입 ${recruited.length}/${ids.length}`;
  };
  sheets.openSheet(`${dungeon.name} · 출현 명단`, `<div class="meta-sheet meta-roster">
    <p>${counts(profile, ids)}</p>
    <p><small>기본 ${pool.baseIds.length}명</small></p>
    <div class="meta-collection-grid"></div>
  </div>`);
  const grid = $('.meta-roster .meta-collection-grid');
  companionGrid(grid, { ids, pool, profile, widgets, select: inspect });
}

export function companionSheet({ core, roster, widgets, sheets, profile, id }) {
  const { card, sprite } = widgets;
  const character = card(id);
  if (!character) return;
  const recruit = profile.recruits[id];
  const regions = appearanceRegions(roster, id).map(region => DUNGEONS[region].name);
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
      <p>나오는 지역: ${esc(regions.join(' · ') || '지역 기본 명단에 없음')}</p>
      ${recruit ? `<p title="${TERMS.bond.firstUse}">인연 ${recruit.bond}${profile.lead === id ? ' · ' + TERMS.startCompanion.short : ''}</p>` : ''}
      ${historyList(profile, id, card)}
      <h4>특성</h4><p>${esc(traitText(character.trait))}</p>
      <h4>스킬</h4>${skills}
    </div>
  `);
}

export function collectionScreen(node, { profile, roster, widgets, core, inspect }) {
  const seen = new Set([...profile.seenCharacters, ...Object.keys(profile.recruits)]);
  const canReadRelics = profile.notebook.chapters.includes(3);
  const dungeons = Object.values(DUNGEONS);
  const relics = core.ARTIFACT_LIST.filter(relic => Object.hasOwn(RELICS, relic.id));
  let dungeonId = Object.hasOwn(DUNGEONS, profile.ui?.destination) ? profile.ui.destination : dungeons[0].id;

  node.classList.add('screen-split');
  node.innerHTML = `
    <div class="meta-collection-bar fixed-top">
      <label for="meta-pool">지역</label>
      <select id="meta-pool">
        ${dungeons.map(dungeon => `<option value="${dungeon.id}">${esc(dungeon.name)}</option>`).join('')}
        ${canReadRelics ? '<option value="relics">유물 도감</option>' : ''}
      </select>
      <span id="meta-collected"></span>
      <input id="meta-companion-search" type="search" aria-label="동료 이름 검색" placeholder="동료 이름 검색">
    </div>
    <div class="scroll-list"><div class="meta-collection-grid"></div></div>
  `;
  const grid = $('.meta-collection-grid', node);
  const poolSelect = $('#meta-pool', node);
  const search = $('#meta-companion-search', node);
  const list = $('.scroll-list', node);
  poolSelect.value = dungeonId;

  function render() {
    search.hidden = dungeonId === 'relics';
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
    const pool = roster.pool(DUNGEONS[dungeonId].pool);
    $('#meta-collected', node).textContent = `조우 ${pool.filter(id => seen.has(id)).length}/${pool.length} · 영입 ${pool.filter(id => profile.recruits[id]).length}/${pool.length}`;
    const query = search.value.trim().toLocaleLowerCase('ko');
    const matches = pool.filter(id => widgets.card(id)?.name.toLocaleLowerCase('ko').includes(query));
    companionGrid(grid, { ids: matches, profile, widgets, select: inspect });
    if (!matches.length) grid.innerHTML = '<p>검색 결과 없음</p>';
  }

  poolSelect.addEventListener('change', () => {
    dungeonId = poolSelect.value;
    render();
  });
  search.addEventListener('input', render);
  render();
}
