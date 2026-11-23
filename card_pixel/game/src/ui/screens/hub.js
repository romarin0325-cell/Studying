import { $, $$, esc } from '../dom.js';
import { background, icon } from '../assets.js';
import { DUNGEONS } from '../../content/dungeons.js';
import { EPISODES } from '../../content/episodes.js';
import { episodeState } from '../../engine/episodes.js';
import { EPISODE } from '../glossary.js';
import { chapterTitle } from './notebook.js';
import { dailyRow } from './daily-rift.js';
import { pixelIcon } from '../pixel-icons.js';
import { josa, keepSeparators } from '../text.js';

export function hubLineup(lead, recent) {
  const ids = Array.isArray(recent) ? recent : [];
  return [...new Set([lead, ...ids].filter(id => typeof id === 'string' && id))].slice(0, 3);
}

export function sceneActors(ids, widgets, { interactive = false, lead = null, arriving = [] } = {}) {
  return ids.map((id, index) => {
    if (!id) return '';
    const meta = widgets.spr(id);
    if (!meta) return '';
    const name = esc(widgets.card(id)?.name || id);
    const tag = interactive ? 'button' : 'span';
    const target = interactive ? ` data-companion="${esc(id)}" aria-label="${name}"` : '';
    const feet = 2 * (meta.h - meta.fy);
    const center = 2 * (meta.facing === 'left' ? meta.w - meta.cx : meta.cx);
    const sprite = widgets.sprite(id, {
      flip: meta.facing === 'left',
      style: `width:${meta.w * 2}px;height:${meta.h * 2}px`
    });
    return `<${tag} class="meta-actor actor-${index}${arriving.includes(id) ? ' arriving' : ''}${id === lead ? ' lead' : ''}"${target}
      style="--actor-index:${index};--actor-width:${meta.w * 2}px;--actor-height:${meta.h * 2}px;--actor-center:${center}px;--actor-feet:${feet}px">
      <span class="meta-actor-bob">${sprite}</span>
    </${tag}>`;
  }).join('');
}

export function hubScreen(node, { profile, run, widgets, inspect, openDungeons, depart, destinationId, departureLabel, resume, goal,
  arriving = [], daily, openDaily, flags, firstMain, saveFlags }) {
  const lead = profile.lead && widgets.card(profile.lead);
  const destination = DUNGEONS[destinationId];
  const title = lead ? josa(lead.name, '과/와') : '';
  const direction = destination ? josa(destination.name, '으로/로') : '떠날 곳 고르기';
  const action = run ? goal.text
    : departureLabel ?? [title, direction].filter(Boolean).join(' ');
  const canBrowse = flags.introCleared && profile.notebook.chapters.includes(1);
  const unread = Object.keys(EPISODES).filter(id => episodeState(profile, id) === 'new');
  const newlyUnlocked = unread.filter(id => profile.ui?.episodesUnlocked?.[id] !== true);
  if (newlyUnlocked.length) saveFlags('episodesUnlocked', newlyUnlocked);
  const episodeBadge = unread.length
    ? `<span class="companion-tag" id="meta-episode-badge" style="position:absolute;right:100%;white-space:nowrap">${EPISODE.unread}</span>` : '';
  const announcement = profile.ui?.announcement;
  const unlocks = announcement ? [
    ...(announcement.dungeons ?? []).map(id => DUNGEONS[id].name),
    ...(announcement.nightmares ?? []).map(id => DUNGEONS[id].name + ' · 악몽'),
    ...(announcement.chapters ?? []).map(chapterTitle),
    ...(announcement.missionEarned ? ['동료 초대 가능'] : [])
  ] : [];
  const lineup = hubLineup(profile.lead, profile.ui?.returners || []);
  const leadSprite = profile.lead && widgets.spr(profile.lead);
  // The home screen: the party stands in the observatory, menu bubbles on the right, the trip ticket below.
  const orb = (attributes, art, label, badge = '') => `<button class="orb" ${attributes}><span class="orb-art">${art}</span><b class="outlined">${label}</b>${badge}</button>`;
  const orbs = [
    destination && !run && !firstMain ? orb('id="meta-change-destination" aria-label="행선지 바꾸기"', pixelIcon('telescope'), '행선지') : '',
    ...(canBrowse ? [
      orb('data-meta-page="collection"', profile.lead ? widgets.face(profile.lead, 40) : `<img class="px" src="${icon('companion')}" alt="" width="32" height="32">`, '동료', episodeBadge),
      orb('data-meta-page="notebook"', pixelIcon('book'), '수첩'),
      orb('data-meta-page="records"', `<img class="px" src="${icon('boss')}" alt="" width="32" height="32">`, '기록')
    ] : [])
  ].join('');
  const ticketId = run?.dungeonId ?? destination?.id;
  const ticketArt = ticketId ? `<span class="depart-art" data-region="${esc(ticketId)}" style="background-image:url(${background(DUNGEONS[ticketId].background)})"></span>` : '';

  node.innerHTML = `
    <div class="meta-scene meta-observatory" style="--lead-h:${(leadSprite?.h ?? 60) * 2}px">
      <span class="meta-room" style="background-image:url(${background('observatory')})" aria-hidden="true"></span>
      <button id="meta-telescope" aria-label="망원경으로 행선지 고르기" title="행선지 고르기"></button>
      ${sceneActors(lineup, widgets, { interactive: true, lead: profile.lead, arriving })}
      ${!run && goal?.text ? `<p class="meta-next-goal bubble">${esc([goal.text, goal.reward].filter(Boolean).join(' · '))}</p>` : ''}
      ${orbs ? `<nav class="meta-hub-links" aria-label="관측소">${orbs}</nav>` : ''}
      ${announcement?.firstMain ? '<p class="meta-first-unlock win" role="status">이제 여정·지역 규칙·샘 초대를 쓸 수 있어</p>' : unlocks.length ? `<aside class="meta-unlocks" aria-label="해금">
        ${unlocks.map(label => `<div><span class="meta-bolt"><img class="px" src="${icon('gate')}" alt="" width="32" height="32"></span>${esc(label)}</div>`).join('')}
      </aside>` : ''}
    </div>
    <div class="meta-hub-actions">
      ${dailyRow(daily)}
      <button class="btn go${ticketArt ? ' ticket' : ''}" id="meta-depart" data-coach="departure">${ticketArt}<span class="ticket-label">${keepSeparators(esc(action))}</span></button>
      ${firstMain ? '<button class="btn" id="meta-other-region">다른 지역</button>' : ''}
    </div>
  `;
  $('#meta-depart', node).addEventListener('click', run ? resume : depart);
  $('#meta-telescope', node).addEventListener('click', () => openDungeons());
  $('#meta-change-destination', node)?.addEventListener('click', () => openDungeons());
  $('#meta-other-region', node)?.addEventListener('click', () => openDungeons());
  $('#meta-daily-rift', node)?.addEventListener('click', () => openDaily());
  $$('[data-companion]', node).forEach(button => button.addEventListener('click', () => inspect(button.dataset.companion)));
}
