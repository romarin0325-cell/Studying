import { $, $$, esc } from '../dom.js';
import { DUNGEONS } from '../../content/dungeons.js';
import { NOTEBOOK } from '../../content/notebook.js';
import { notebookView } from '../../engine/meta.js';
import { bindScreenTabs } from '../nav/screen-tabs.js';

const GOALS = {
  1: '새벽의 숲에서 생환',
  2: '시작 동료와 함께 본편 원정 출발',
  3: '본편 원정의 4층 문지기 격파',
  4: '본편 원정 첫 생환 달성',
  5: '다른 시작 동료로 문지기를 격파하고 생환',
  6: '서로 다른 3개 지역에서 생환',
  7: '창조의 탑 최종 보스 격파'
};

const FEATURES = {
  hub: '꿈의 관측소', recruiting: '동료 도감', lead: '시작 동료',
  companion_slot_1: '샘 초대 1칸', relic_codex: '유물 도감',
  daily_rift: '오늘의 균열', recruit_missions: '영입 임무', companion_slot_2: '샘 초대 2칸',
  companion_slot_3: '샘 초대 3칸', creation_tower: '창조의 탑', ending_record: '탑 격파 기록'
};
const FEATURE_FLAGS = { companion_slot_1: 'prepEditing', companion_slot_2: 'prepEditing', companion_slot_3: 'prepEditing',
  daily_rift: 'dailyRift', recruit_missions: 'missions' };

export function chapterTitle(id) {
  return `수첩 ${id}장 · ${NOTEBOOK.find(chapter => chapter.id === id).title}`;
}

const MISSION_COPY = {
  weekly: ['이번 주', '본편 문지기', '동료 1명 초대'],
  monthly: ['이번 달', '서로 다른 테마 생환', '전설 1명 초대']
};

function missionRows(missions, claimEnabled) {
  return (missions?.current ?? []).map(period => {
    const [label, goal, recruitReward] = MISSION_COPY[period.kind];
    const stampOnly = period.state === 'claimed' && !period.claimedId ||
      period.state === 'earned' && !period.candidates.length;
    const reward = stampOnly ? '완료 도장' : recruitReward;
    const earned = missions.claimable?.filter(entry => entry.kind === period.kind).length ?? 0;
    const progress = period.kind === 'weekly' ? (period.gates ?? 0) + '회' : (period.regionIds?.length ?? 0) + '곳';
    const target = period.target + (period.kind === 'weekly' ? '회' : '곳');
    const line = `${label} · ${goal} ${progress}/${target} → ${reward}`;
    if (earned && claimEnabled) return `<button class="btn meta-mission-line" data-mission="${period.kind}">${line} · 수령 ${earned}건</button>`;
    return `<button class="btn meta-mission-line" data-mission-guide="${period.kind}">${line}${earned
      ? ' · 귀환 후 수령' : period.state === 'claimed' ? ' · 완료' : ''}</button>`;
  }).join('');
}

export function notebookScreen(node, profile, card, { missions, openMission, describeMission, goal, followGoal, flags = {} } = {}) {
  const chapters = notebookView(profile);
  const current = chapters.find(chapter => !chapter.completed) || chapters.at(-1);
  const clearedRegions = Object.values(DUNGEONS).filter(dungeon => {
    const clears = profile.records.clears[dungeon.id];
    return ['intro_clear', 'early_region_clear'].includes(dungeon.unlock.kind) && (clears?.easy || clears?.normal || clears?.nightmare);
  });
  const firstLead = card(profile.notebook.firstLead)?.name;
  const goalText = esc([goal?.text, goal?.reward].filter(Boolean).join(' · '));

  function openChapter(id) {
    const chapter = chapters.find(entry => entry.id === id);
    const progress = id === 6
      ? `생환 ${clearedRegions.length}개 지역 · 목표 ${DUNGEONS.creation_tower.unlock.count}<br>${esc(clearedRegions.map(region => region.name).join(' · ') || '생환한 지역 없음')}`
      : chapter.completed ? '완료' : '진행 중';
    const opens = chapter.opens.filter(feature => flags[FEATURE_FLAGS[feature]] !== false);
    $('.meta-chapter-detail', node).innerHTML = `
      <h2>${chapter.id}장 · ${esc(chapter.title)}</h2>
      <p>${GOALS[id]}</p>
      <p class="meta-progress">${progress}</p>
      ${id === 5 && firstLead ? `<p>첫 시작 동료 · ${esc(firstLead)}</p>` : ''}
      ${opens.length ? `<p><small>해금</small> ${opens.map(feature => FEATURES[feature]).filter(Boolean).join(' · ')}</p>` : ''}
    `;
    node.dataset.chapter = id;
    for (const button of node.querySelectorAll('[data-chapter]')) button.setAttribute('aria-pressed', Number(button.dataset.chapter) === id);
  }

  node.classList.add('screen-split');
  node.innerHTML = `
    <div class="fixed-top">
      ${missions?.unlocked ? `<div class="screen-tabs" role="group" aria-label="수첩 종류">
        <button class="btn" data-screen-tab="chapters">수첩 장</button>
        <button class="btn" data-screen-tab="missions">영입 임무</button>
      </div>` : ''}
    </div>
    <div class="scroll-list">
      <div data-screen-panel="chapters">
        <article class="meta-panel meta-chapter-detail"></article>
        <div class="meta-chapters">
          ${chapters.map(chapter => `<button class="meta-panel" data-chapter="${chapter.id}">
            <span>${chapter.id}장 · ${esc(chapter.title)}</span>
            ${chapter.completed ? '<span class="meta-stamp">완료</span>' : ''}
            ${chapter.id === current.id && !chapter.completed ? '<small>현재</small>' : ''}
          </button>`).join('')}
        </div>
      </div>
      ${missions?.unlocked ? `<div data-screen-panel="missions"><div class="meta-missions">${missionRows(missions, !!openMission)}</div></div>` : ''}
    </div>
    ${goalText ? `<div class="fixed-foot">${followGoal
      ? `<button class="btn meta-next-goal" id="meta-follow-goal">${goalText}</button>`
      : `<p class="meta-next-goal">${goalText}</p>`}</div>` : ''}
  `;
  $('#meta-follow-goal', node)?.addEventListener('click', followGoal);
  if (missions?.unlocked) bindScreenTabs(node, node.dataset.screenTabActive ?? 'chapters');
  const list = $('.scroll-list', node);
  for (const button of node.querySelectorAll('[data-chapter]')) {
    button.addEventListener('click', () => {
      openChapter(Number(button.dataset.chapter));
      list.scrollTop = 0;
    });
  }
  $$('[data-mission]', node).forEach(button => button.addEventListener('click', () => openMission(button.dataset.mission)));
  $$('[data-mission-guide]', node).forEach(button => button.addEventListener('click', () =>
    describeMission(button.dataset.missionGuide === 'weekly' ? '주간 영입 임무' : '월간 영입 임무', button.textContent)));
  openChapter(chapters.some(chapter => chapter.id === Number(node.dataset.chapter)) ? Number(node.dataset.chapter) : current.id);
}
