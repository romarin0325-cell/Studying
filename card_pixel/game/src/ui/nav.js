import { $, esc, show } from './dom.js';
import * as assets from './assets.js';
import { tools } from './settings.js';
import { sheetMarkup } from './sheet.js';
import { enterRun } from './run/index.js';
import { titleScreen } from './screens/title.js';
import { hubScreen } from './screens/hub.js';
import { dungeonsScreen, preparationSheet } from './screens/dungeons.js';
import { recruitScreen } from './screens/recruit.js';
import { collectionScreen, companionSheet } from './screens/collection.js';
import { notebookScreen } from './screens/notebook.js';
import { recordsScreen } from './screens/records.js';
import { endingScreen } from './screens/ending.js';
import { availableDungeons, applyRunEnd, createProfile, setExpeditionParty, startView } from '../engine/meta.js';
import { createRun, finishRun } from '../engine/run.js';

const PAGES = {
  hub: '꿈의 관측소', dungeons: '행선지', recruit: '', collection: '동료 도감',
  notebook: '꿈길 수첩', records: '기록', ending: '꿈길의 끝'
};

export function mountPage() {
  $('#app').innerHTML = `<div id="frame">
    <section id="title" class="screen meta-screen"></section>
    ${Object.keys(PAGES).map(id => `<section id="${id}" class="screen meta-screen"></section>`).join('')}
    ${sheetMarkup()}
  </div>`;
}

export function createNavigation({ core, roster, widgets, stage, audio, music, sheets, store }) {
  const stored = store.load();
  let profile = stored?.profile || createProfile();
  let run = stored?.run || null;
  let review = null;
  let preparationOpen = false;
  let crystalCount = 0;
  let gainedAtReturn = false;

  const host = {
    save(current) {
      if (current !== run) return;
      if (run.result === 'win' && run.crystals > crystalCount) gainedAtReturn = true;
      crystalCount = run.crystals;
      persist();
    },
    finish(current) {
      if (current === run && current.phase === 'done') showRecruit();
    },
    profile: () => profile,
    assets,
    runtime: { stage, audio, music, sheets }
  };

  function persist() {
    store.save({ profile, run });
  }

  function updateProfile(next) {
    profile = next;
    persist();
  }

  function updateUi(patch) {
    updateProfile({ ...profile, ui: { ...profile.ui, ...patch } });
  }

  function page(id, { title = PAGES[id], back } = {}) {
    music.play('hub');
    const section = $('#' + id);
    const crystals = id === 'recruit' && run ? `<span class="meta-crystals">
      <img class="px" src="${assets.icon('crystal')}" alt="결정" width="32" height="32">${run.crystals}
      ${gainedAtReturn ? `<img class="px meta-crystal-flight" src="${assets.icon('crystal')}" alt="" width="32" height="32">` : ''}
    </span>` : '';
    section.innerHTML = `<header class="meta-top">
      ${back ? '<button class="btn meta-back" aria-label="관측소로 돌아가기">←</button>' : ''}
      <h1>${esc(title)}</h1><div class="meta-tools">${crystals}${tools()}</div>
    </header><div class="meta-page"></div>`;
    if (back) $('.meta-back', section).addEventListener('click', () => back());
    show(id);
    return $('.meta-page', section);
  }

  function showHub(arriving = []) {
    sheets.closeSheet();
    const node = page('hub');
    hubScreen(node, { profile, run, widgets, inspect, openDungeons, prepare, resume: enterExpedition, arriving });
    if (profile.ui?.announcement) updateUi({ announcement: null });
    for (const button of node.querySelectorAll('[data-meta-page]')) button.addEventListener('click', () => {
      const id = button.dataset.metaPage;
      const content = page(id, { back: showHub });
      if (id === 'collection') collectionScreen(content, { profile, roster, widgets, core, inspect });
      else if (id === 'notebook') notebookScreen(content, profile, roster.card);
      else if (id === 'records') recordsScreen(content, profile, roster.card, sheets.openSheet, () => showEnding());
    });
  }

  function endingDue() {
    return profile.notebook.chapters.includes(7) && !profile.ui?.endingSeen;
  }

  function showEnding(arriving = []) {
    const node = page('ending');
    endingScreen(node, {
      profile, widgets,
      finish() {
        if (!profile.ui?.endingSeen) updateUi({ endingSeen: true });
        showHub(arriving);
      }
    });
  }

  function inspect(id) {
    companionSheet({ core, widgets, sheets, profile, id, setLead });
  }

  function setLead(lead) {
    const companions = profile.companions.filter(id => id !== lead);
    const result = setExpeditionParty(profile, { lead, companions });
    if (result.announce.ok) updateProfile(result.profile);
    if ($('#hub').classList.contains('on')) showHub();
    inspect(lead);
  }

  function openDungeons() {
    const node = page('dungeons', { back: showHub });
    const destinations = availableDungeons(profile);
    const mainDestinations = destinations.filter(dungeon => dungeon.id !== 'dawn_forest');
    const quick = stored && !run && !profile.ui?.destination
      ? mainDestinations.find(dungeon => !profile.records.clears[dungeon.id]?.normal) || mainDestinations[0] || destinations[0]
      : null;
    const quickStart = quick ? { name: quick.name, start: () => startExpedition(quick.id) } : null;
    dungeonsScreen(node, { profile, roster, widgets, prepare: run ? null : prepare, quickStart });
  }

  function prepare(dungeonId) {
    if (run || !availableDungeons(profile).some(dungeon => dungeon.id === dungeonId)) return;
    if (profile.ui?.destination !== dungeonId || !profile.ui?.preparing) updateUi({ destination: dungeonId, preparing: true });
    preparationOpen = true;
    preparationSheet({ dungeonId, currentProfile: () => profile, updateProfile, roster, widgets, sheets, start: startExpedition });
  }

  function closePreparation() {
    if (!preparationOpen) return;
    preparationOpen = false;
    updateUi({ preparing: false });
    if ($('#hub').classList.contains('on')) showHub();
  }

  function startExpedition(destination, difficulty = 'normal') {
    const dungeonId = destination || 'dawn_forest';
    const requestedSeed = new URLSearchParams(location.search).get('seed');
    const seed = requestedSeed !== null && /^\d+$/.test(requestedSeed)
      ? Number(requestedSeed) >>> 0 : Math.floor(Math.random() * 0x100000000);
    run = createRun({ core, roster, dungeonId, difficulty, seed, profileView: startView(profile, dungeonId) });
    preparationOpen = false;
    updateUi({ destination: destination || profile.ui?.destination, preparing: false, announcement: null });
    enterExpedition();
  }

  function enterExpedition() {
    sheets.closeSheet();
    audio.unlockAudio();
    crystalCount = run.crystals;
    gainedAtReturn = false;
    review = enterRun(run, host) || null;
  }

  function showRecruit() {
    const needsPending = run.pending?.kind !== 'recruit';
    const rewards = finishRun(run);
    if (needsPending) persist();
    const saved = profile.ui?.recruitChoices;
    const candidates = rewards.result === 'win' ? rewards.recruitable : rewards.shardCandidates;
    const initial = candidates.length === 1 ? candidates : [];
    const choices = saved?.runId === run.id ? saved.ids.filter(id => candidates.includes(id)) : initial;
    const node = page('recruit', { title: rewards.result === 'win' ? '생환' : '원정 실패' });
    recruitScreen(node, {
      run, rewards, profile, widgets, sheets, choices,
      endingPending: run.dungeonId === 'creation_tower' && rewards.result === 'win' && !profile.ui?.endingSeen,
      changeChoices: ids => updateUi({ recruitChoices: { runId: run.id, ids } }),
      confirm: confirmReturn
    });
  }

  function confirmReturn(choices) {
    if (!run) return false;
    const result = applyRunEnd(profile, run, choices);
    const { announce } = result;
    if (!announce.ok) {
      if (announce.reason !== 'already_applied') return false;
      run = null;
      review = null;
      updateUi({ recruitChoices: null });
      if (endingDue()) showEnding();
      else showHub();
      return true;
    }
    const next = result.profile;
    const recent = { ...next.ui?.recent };
    const entry = { dungeonId: run.dungeonId, floor: run.floor, result: run.result };
    const recruits = announce.recruits;
    for (const id of new Set([...run.participated, ...recruits])) {
      if (next.recruits[id]) recent[id] = [entry, ...(recent[id] || [])].slice(0, 3);
    }
    const returned = run.result === 'win' ? run.bench.filter(id => next.recruits[id]) : [];
    const returners = [...new Set([...recruits, ...returned, ...(next.ui?.returners || [])])].slice(0, 3);
    const announcement = { dungeons: announce.dungeons, nightmares: announce.nightmares, chapters: announce.chapters };
    const latestRun = { ...entry, difficulty: run.difficulty, floors: run.floors, stats: run.stats, fallen: run.fallen };
    run = null;
    review = null;
    updateProfile({ ...next, ui: { ...next.ui, recruitChoices: null, recent, returners, announcement, latestRun } });
    if (recruits.length) audio.sfx.crit();
    if (endingDue()) showEnding(recruits);
    else showHub(recruits);
    return true;
  }

  function resetData() {
    store.clear();
    profile = createProfile();
    run = null;
    review = null;
    preparationOpen = false;
    sheets.closeSheet();
    stage.clock.waiters.length = 0;
    stage.clock.tweens.length = 0;
    stage.clock.fast = false;
    stage.clock.slow = 1;
    stage.clear();
    showTitle();
  }

  function showTitle(savedProfile) {
    music.play('hub');
    titleScreen({
      profile: savedProfile, widgets,
      start() {
        if (!savedProfile) startExpedition();
        else if (endingDue()) showEnding();
        else {
          showHub();
          if (profile.ui?.preparing) prepare(profile.ui.destination);
        }
      }
    });
  }

  function boot() {
    if (run?.phase === 'done') showRecruit();
    // The observatory opens with the first return: until then a reload goes straight back into the intro.
    else if (run && !Object.keys(profile.recruits || {}).length) enterExpedition();
    else if (run) showHub();
    else showTitle(stored?.profile);
  }

  return { boot, closePreparation, resetData, inspect, get run() { return run; }, get review() { return review; } };
}
