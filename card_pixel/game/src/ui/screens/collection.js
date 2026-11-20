import { $, $$, esc } from '../dom.js';
import { icon } from '../assets.js';
import { TYPE } from '../widgets.js';
import { DUNGEONS } from '../../content/dungeons.js';
import { RELICS } from '../../content/relics.js';

export function companionSheet({ core, widgets, sheets, profile, id, setLead }) {
  const { card, sprite } = widgets;
  const character = card(id);
  if (!character) return;
  const recruit = profile.recruits[id];
  const recent = profile.ui?.recent?.[id] || [];
  const skills = character.skills.map(skill => {
    const body = core.SkillDisplay.body(skill, { entity: character });
    return `<div class="meta-skill">
      <b>${esc(skill.name)}</b> <small>${TYPE[skill.type] || ''} · MP ${skill.cost || 0}</small>
      <p>${esc(body || '')}</p>
    </div>`;
  }).join('');
  sheets.openSheet(character.name, `
    <div class="meta-sheet meta-companion">
      <div class="meta-companion-art">${sprite(id)}</div>
      ${recruit ? `<p>인연 ${recruit.bond}${profile.lead === id ? ' · 대표' : ''}</p>` : ''}
      ${recruit ? `<h4>최근 원정</h4><p>${recent.map(entry =>
        `${esc(DUNGEONS[entry.dungeonId].name)} · ${entry.floor}층 · ${entry.result === 'win' ? '원정 승리' : '원정 실패'} · ${entry.returned === true ? '생환' : entry.returned === false ? '미귀환' : '귀환 여부 미기록'}`
      ).join('<br>') || '원정 기록 없음'}</p>` : ''}
      <h4>특성</h4><p>${esc(character.trait.desc)}</p>
      <h4>기술</h4>${skills}
      ${setLead && recruit && profile.lead !== id ? '<button class="btn go" id="meta-set-lead">대표로 정하기</button>' : ''}
    </div>
  `);
  $('#meta-set-lead')?.addEventListener('click', () => setLead(id));
}

export function collectionScreen(node, { profile, roster, widgets, core, inspect }) {
  const seen = new Set([...profile.seenCharacters, ...Object.keys(profile.recruits)]);
  const canReadRelics = profile.notebook.chapters.includes(3);
  const dungeons = Object.values(DUNGEONS);
  const relics = core.ARTIFACT_LIST.filter(relic => Object.hasOwn(RELICS, relic.id));
  let dungeonId = profile.ui?.destination || dungeons[0].id;

  node.innerHTML = `
    <div class="meta-collection-bar">
      <label for="meta-pool">지역</label>
      <select id="meta-pool">
        ${dungeons.map(dungeon => `<option value="${dungeon.id}">${esc(dungeon.name)}</option>`).join('')}
        ${canReadRelics ? '<option value="relics">유물 도감</option>' : ''}
      </select>
      <span id="meta-collected"></span>
    </div>
    <div class="meta-collection-grid"></div>
  `;
  const grid = $('.meta-collection-grid', node);
  const poolSelect = $('#meta-pool', node);
  poolSelect.value = dungeonId;

  function render() {
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
    $('#meta-collected', node).textContent = `조우 ${pool.filter(id => seen.has(id)).length}/${pool.length}`;
    grid.innerHTML = pool.map(id => {
      const known = seen.has(id);
      const name = known ? esc(widgets.card(id).name) : '미조우';
      const recruit = profile.recruits[id];
      const face = `<span class="meta-face">${widgets.face(id, 44)}</span>`;
      return known
        ? `<button class="meta-cell" data-companion="${id}">${face}<b>${name}</b>${recruit ? `<small>인연 ${recruit.bond}</small>` : ''}</button>`
        : `<div class="meta-cell concealed">${face}<small>미조우</small></div>`;
    }).join('');
    $$('[data-companion]', grid).forEach(button => button.addEventListener('click', () => inspect(button.dataset.companion)));
  }

  poolSelect.addEventListener('change', () => {
    dungeonId = poolSelect.value;
    render();
  });
  render();
}
