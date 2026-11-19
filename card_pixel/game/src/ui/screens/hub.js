import { $, $$, esc } from '../dom.js';
import { background, icon } from '../assets.js';
import { DUNGEONS } from '../../content/dungeons.js';
import { chapterTitle } from './notebook.js';

export function hubLineup(lead, recent) {
  return [...new Set([lead, ...recent].filter(Boolean))].slice(0, 3);
}

export function sceneActors(ids, widgets, { interactive = false, lead = null, arriving = [] } = {}) {
  return ids.map((id, index) => {
    if (!id) return '';
    const meta = widgets.spr(id);
    if (!meta) return '';
    const name = esc(widgets.card(id)?.name || id);
    const tag = interactive ? 'button' : 'span';
    const target = interactive ? ` data-companion="${id}" aria-label="${name}"` : '';
    const feet = 2 * (meta.h - meta.fy);
    const center = 2 * (meta.facing === 'left' ? meta.w - meta.cx : meta.cx);
    const sprite = widgets.sprite(id, {
      flip: meta.facing === 'left',
      style: `width:${meta.w * 2}px;height:${meta.h * 2}px`
    });
    return `<${tag} class="meta-actor actor-${index}${arriving.includes(id) ? ' arriving' : ''}${id === lead ? ' lead' : ''}"${target}
      style="--actor-width:${meta.w * 2}px;--actor-height:${meta.h * 2}px;--actor-center:${center}px;--actor-feet:${feet}px">
      <span class="meta-actor-bob">${sprite}</span>
    </${tag}>`;
  }).join('');
}

export function hubScreen(node, { profile, run, widgets, inspect, openDungeons, prepare, resume, arriving = [] }) {
  const lead = profile.lead && widgets.card(profile.lead);
  const destination = DUNGEONS[profile.ui?.destination];
  const finalConsonant = name => {
    const code = name.charCodeAt(name.length - 1);
    return code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 : 0;
  };
  const title = lead ? lead.name + (finalConsonant(lead.name) ? '과' : '와') : '';
  const ending = destination ? finalConsonant(destination.name) : 0;
  const direction = destination ? destination.name + (ending && ending !== 8 ? '으로' : '로') : '떠날 곳 고르기';
  const action = run ? `${DUNGEONS[run.dungeonId].name} ${Math.max(run.floor, 1)}층 이어가기`
    : [title, direction].filter(Boolean).join(' ');
  const canBrowse = profile.notebook.chapters.includes(1);
  const announcement = profile.ui?.announcement;
  const unlocks = announcement ? [
    ...announcement.dungeons.map(id => DUNGEONS[id].name),
    ...announcement.nightmares.map(id => DUNGEONS[id].name + ' · 악몽'),
    ...announcement.chapters.map(chapterTitle)
  ] : [];
  const lineup = hubLineup(profile.lead, profile.ui?.returners || []);

  node.innerHTML = `
    <div class="meta-scene meta-observatory" style="background-image:url(${background('observatory')})">
      <button id="meta-telescope" aria-label="망원경으로 행선지 고르기" title="행선지 고르기"></button>
      ${sceneActors(lineup, widgets, { interactive: true, lead: profile.lead, arriving })}
      ${unlocks.length ? `<aside class="meta-unlocks" aria-label="해금">
        ${unlocks.map(label => `<div><span class="meta-bolt"><img class="px" src="${icon('gate')}" alt="" width="32" height="32"></span>${esc(label)}</div>`).join('')}
      </aside>` : ''}
    </div>
    <div class="meta-hub-actions">
      <button class="btn go" id="meta-depart">${esc(action)}</button>
      ${destination && !run ? '<button class="btn" id="meta-change-destination">행선지 바꾸기</button>' : ''}
    </div>
    ${canBrowse ? `<nav class="meta-hub-links" aria-label="관측소">
      <button class="btn" data-meta-page="collection">동료</button>
      <button class="btn" data-meta-page="notebook">수첩</button>
      <button class="btn" data-meta-page="records">기록</button>
    </nav>` : ''}
  `;
  $('#meta-depart', node).addEventListener('click', run ? resume : destination ? () => prepare(destination.id) : openDungeons);
  $('#meta-telescope', node).addEventListener('click', openDungeons);
  $('#meta-change-destination', node)?.addEventListener('click', openDungeons);
  $$('[data-companion]', node).forEach(button => button.addEventListener('click', () => inspect(button.dataset.companion)));
}
