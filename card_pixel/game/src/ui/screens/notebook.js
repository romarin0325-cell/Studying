import { $, esc } from '../dom.js';
import { DUNGEONS } from '../../content/dungeons.js';
import { NOTEBOOK } from '../../content/notebook.js';
import { notebookView } from '../../engine/meta.js';

const GOALS = {
  1: '새벽의 숲에서 생환한다.',
  2: '대표 동료와 본편 원정을 출발한다.',
  3: '본편 원정의 문지기를 쓰러뜨린다.',
  4: '본편 원정에서 처음 생환한다.',
  5: '처음과 다른 대표로 문지기를 꺾고, 그 대표와 생환한다.',
  6: '서로 다른 세 지역에서 생환한다.',
  7: '창조의 탑을 격파한다.'
};

const FEATURES = {
  hub: '꿈의 관측소', recruiting: '동료 도감', lead: '대표 지정',
  companion_slot_1: '동행 1칸', relic_codex: '유물 도감',
  nightmare: '악몽 난이도', companion_slot_2: '동행 2칸',
  companion_slot_3: '동행 3칸', creation_tower: '창조의 탑', ending_record: '탑 격파 기록'
};

export function chapterTitle(id) {
  return `수첩 ${id}장 · ${NOTEBOOK.find(chapter => chapter.id === id).title}`;
}

export function notebookScreen(node, profile, card) {
  const chapters = notebookView(profile);
  const current = chapters.find(chapter => !chapter.completed) || chapters.at(-1);
  const clearedRegions = Object.values(DUNGEONS).filter(dungeon => {
    const clears = profile.records.clears[dungeon.id];
    return ['intro_clear', 'early_region_clear'].includes(dungeon.unlock.kind) && (clears?.normal || clears?.nightmare);
  });
  const firstLead = card(profile.notebook.firstLead)?.name;

  function openChapter(id) {
    const chapter = chapters.find(entry => entry.id === id);
    const progress = id === 6
      ? `생환 ${clearedRegions.length}개 지역 · 목표 ${DUNGEONS.creation_tower.unlock.count}<br>${esc(clearedRegions.map(region => region.name).join(' · ') || '생환한 지역 없음')}`
      : chapter.completed ? '완료' : '진행 중';
    $('.meta-chapter-detail', node).innerHTML = `
      <h2>${chapter.id}장 · ${esc(chapter.title)}</h2>
      <p>${GOALS[id]}</p>
      <p class="meta-progress">${progress}</p>
      ${id === 5 && firstLead ? `<p>첫 대표 · ${esc(firstLead)}</p>` : ''}
      <p><small>해금</small> ${chapter.opens.map(feature => FEATURES[feature]).join(' · ')}</p>
    `;
    for (const button of node.querySelectorAll('[data-chapter]')) button.setAttribute('aria-pressed', Number(button.dataset.chapter) === id);
  }

  node.innerHTML = `
    <article class="meta-panel meta-chapter-detail"></article>
    <div class="meta-chapters">
      ${chapters.map(chapter => `<button class="meta-panel" data-chapter="${chapter.id}">
        <span>${chapter.id}장 · ${esc(chapter.title)}</span>
        ${chapter.completed ? '<span class="meta-stamp">완료</span>' : ''}
        ${chapter.id === current.id && !chapter.completed ? '<small>현재</small>' : ''}
      </button>`).join('')}
    </div>
  `;
  for (const button of node.querySelectorAll('[data-chapter]')) {
    button.addEventListener('click', () => openChapter(Number(button.dataset.chapter)));
  }
  openChapter(current.id);
}
