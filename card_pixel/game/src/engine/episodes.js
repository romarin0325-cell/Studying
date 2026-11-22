import { EPISODES } from '../content/episodes.js';

const FIELDED = new Set(['battle', 'gate', 'boss']);

export function episodeState(profile, id) {
  if (!Object.hasOwn(EPISODES, id)) return 'none';
  const recruit = profile?.recruits?.[id];
  if (!recruit) return 'locked';
  if (profile.ui?.episodesRead?.[id] === true) return 'read';
  if (profile.ui?.episodesUnlocked?.[id] === true) return 'new';
  const runs = profile.records?.appliedRuns ?? [];
  // Older history without a participation tag records the roster, including standby slots.
  const fought = Number.isInteger(recruit.since) && profile.history?.[id]?.some(entry => entry.fielded === true
    && FIELDED.has(entry.participation) && runs.lastIndexOf(entry.runId) >= recruit.since);
  return fought ? 'new' : 'locked';
}

const PAGE_CHARS = 300;
const PAGE_PARAGRAPHS = 4;

export function episodePages(body) {
  const pages = [];
  let page = [];
  let length = 0;
  function finishPage() {
    if (page.length) pages.push(page);
    page = [];
    length = 0;
  }
  for (let paragraph of body) {
    if (page.length === PAGE_PARAGRAPHS || length + paragraph.length + (page.length ? 2 : 0) > PAGE_CHARS) finishPage();
    while (paragraph.length > PAGE_CHARS) {
      const window = paragraph.slice(0, PAGE_CHARS);
      const breakAt = window.lastIndexOf('\n') + 1;
      const spaceAt = window.lastIndexOf(' ') + 1;
      const boundary = breakAt >= PAGE_CHARS * 0.7 ? breakAt : spaceAt >= PAGE_CHARS * 0.7 ? spaceAt : PAGE_CHARS;
      const end = /[\uD800-\uDBFF]/.test(window[boundary - 1]) ? boundary - 1 : boundary;
      pages.push([paragraph.slice(0, end)]);
      paragraph = paragraph.slice(end);
    }
    length += paragraph.length + (page.length ? 2 : 0);
    page.push(paragraph);
  }
  finishPage();
  return pages;
}
