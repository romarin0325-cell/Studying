import { $, esc, show } from './dom.js';
import * as assets from './assets.js';
import { openBackupSheet, settingsSnapshot, tools } from './settings.js';
import { sheetMarkup } from './sheet.js';
import { enterRun } from './run/index.js';
import { createDetails } from './battle/sheets.js';
import { openBattleLog } from './battle/log.js';
import { titleScreen } from './screens/title.js';
import { hubScreen } from './screens/hub.js';
import { departureDifficulty, dungeonsScreen, listedPool, preparationSheet } from './screens/dungeons.js';
import { missionRecruitSheet, recruitReceipt, recruitScreen } from './screens/recruit.js';
import { collectionScreen, companionSheet, rosterTable } from './screens/collection.js';
import { notebookScreen } from './screens/notebook.js';
import { recordsScreen } from './screens/records.js';
import { endingScreen } from './screens/ending.js';
import { createDailyNavigation } from './nav/daily.js';
import { bindRecoveryImport } from './nav/recovery.js';
import { basicTutorial, createTutorial } from './tutorial.js';
import { hasFinalConsonant } from './widgets.js';
import * as Meta from '../engine/meta.js';
import { createRun, finishRun } from '../engine/run.js';
import { DUNGEONS } from '../content/dungeons.js';
import { CONTRACTS } from '../content/contracts.js';

const { availableDungeons, applyRunEnd, createProfile, featureFlags, startView } = Meta;
const FIRST_MAIN = 'ember_volcano';

const PAGES = {
  hub: '꿈의 관측소', dungeons: '행선지', recruit: '', collection: '동료 도감',
  notebook: '꿈길 수첩', records: '기록', ending: '꿈길의 끝', 'daily-result': '오늘의 균열', recovery: '기록 복구'
};

export function mountPage() {
  $('#app').innerHTML = `<div id="frame">
    <section id="title" class="screen meta-screen"></section>
    ${Object.keys(PAGES).map(id => `<section id="${id}" class="screen meta-screen"></section>`).join('')}
    ${sheetMarkup()}
    <div id="session-notices" role="alert"></div>
  </div>`;
}

export function createNavigation({ core, roster, widgets, stage, audio, music, sheets, store, dailyStore }) {
  const detail = store.loadDetailed?.();
  const stored = detail ?? store.load();
  let recovery = ['profileDamaged', 'unavailable'].includes(detail?.status) ? detail.status : null;
  let profile = stored?.profile || createProfile();
  let run = stored?.run || null;
  let review = null;
  let preparationOpen = false;
  let crystalCount = 0;
  let gainedAtReturn = false;
  let warnedSave = false;
  const details = createDetails(core, widgets, sheets.openSheet);
  const tutorial = createTutorial({ currentProfile: () => profile, updateProfile, widgets, stage, core, roster });

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
    tutorial,
    assets,
    runtime: { stage, audio, music, sheets }
  };
  const daily = createDailyNavigation({
    currentProfile: host.profile, dailyStore, roster, widgets, details, assets, runtime: host.runtime,
    page, showHub, warnSave, sessionNotice, setReview: current => { review = current; }
  });

  function sessionNotice(message) {
    const notice = document.createElement('p');
    notice.className = 'win';
    notice.textContent = message;
    $('#session-notices').append(notice);
    setTimeout(() => notice.remove(), 10000);
  }

  function persist() {
    try {
      if (store.save({ profile, run }) !== false) return true;
    } catch { /* The current session remains in memory. */ }
    warnSave();
    return false;
  }

  function warnSave() {
    if (warnedSave) return;
    warnedSave = true;
    sessionNotice('저장에 실패했습니다. 새로고침하면 현재 진행 상황이 사라집니다.');
  }

  function updateProfile(next) {
    profile = next;
    return persist();
  }

  function updateUi(patch) {
    updateProfile({ ...profile, ui: { ...profile.ui, ...patch } });
  }

  function page(id, { title = PAGES[id], back, track = 'hub' } = {}) {
    music.play(track);
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
    const goal = currentGoal(run);
    const target = goal?.target;
    const flags = featureFlags(profile);
    const firstMain = !run && (flags.introCleared && !flags.firstMainCleared || profile.ui.tutorialReplay === 'active');
    const collecting = !firstMain && target?.screen === 'collection';
    const destinationId = firstMain ? FIRST_MAIN : !collecting && (target?.dungeonId ?? profile.ui?.destination);
    hubScreen(node, {
      profile, run, widgets, inspect, openDungeons, destinationId, resume: enterExpedition, goal, arriving, flags, firstMain,
      depart: firstMain ? () => startExpedition(FIRST_MAIN, departureDifficulty(profile, FIRST_MAIN))
        : collecting ? () => openMeta('collection')
        : destinationId ? () => prepare(destinationId, target?.contractId) : openDungeons,
      departureLabel: collecting ? '동료 도감 보기' : null,
      daily: flags.dailyRift ? daily.hubView() : null, openDaily: daily.showDaily
    });
    if (arriving.length) $('.meta-hub-actions', node).insertAdjacentHTML('afterbegin', recruitReceipt(arriving, widgets, profile.history));
    if (profile.ui?.announcement) updateUi({ announcement: null });
    for (const button of node.querySelectorAll('[data-meta-page]')) button.addEventListener('click', () => {
      openMeta(button.dataset.metaPage);
    });
    tutorial.sync(run);
  }

  function currentGoal(current = null) {
    const goal = Meta.nextGoal?.(profile, current);
    const name = profile.lead && roster.card(profile.lead)?.name;
    const text = name && goal?.text === '시작 동료와 본편 출발'
      ? name + (hasFinalConsonant(name) ? '과' : '와') + ' 본편 출발'
      : goal?.text;
    const reward = goal?.reward.includes('샘 초대') && !featureFlags(profile).prepEditing ? '' : goal?.reward;
    return goal && { ...goal, text, reward };
  }

  function openMeta(id) {
    const flags = featureFlags(profile);
    const content = page(id, { back: showHub });
    if (id === 'collection') collectionScreen(content, { profile, roster, widgets, core, inspect });
    else if (id === 'notebook') {
      function renderNotebook() {
        const scroll = $('.scroll-list', content)?.scrollTop ?? 0;
        notebookScreen(content, profile, roster.card, {
          goal: currentGoal(run), flags, missions: flags.missions ? Meta.missionsView(profile, roster) : null,
          openMission: !run ? kind => invite(kind) : null,
          describeMission: (label, line) => sheets.sheet(label, line)
        });
        $('.scroll-list', content).scrollTop = scroll;
      }
      function invite(kind, index = 0) {
        const periods = Meta.missionsView?.(profile, roster)?.claimable?.filter(period => period.kind === kind) ?? [];
        if (run || !periods.length) return;
        const period = periods[index];
        missionRecruitSheet({
          period, widgets, sheets, remaining: periods.length,
          next: () => invite(kind, (index + 1) % periods.length),
          claim(id) {
            const result = Meta.claimMission(profile, period.key, id, roster);
            if (!result?.announce?.ok) return false;
            if (updateProfile(result.profile)) {
              if (result.announce.recruits.length) audio.sfx.join();
              else audio.sfx.stamp();
            }
            sheets.closeSheet();
            renderNotebook();
            sessionNotice(id ? `${roster.card(id).name} · 관측소에 영입` : '임무 완료 도장 획득');
            return true;
          }
        });
      }
      renderNotebook();
    } else if (id === 'records') recordsScreen(content, profile, roster.card, sheets.openSheet, () => showEnding(),
      flags.dailyRift && dailyStore?.history ? daily.showDailyHistory : null, log => openBattleLog(sheets, widgets, log));
    tutorial.sync(run);
  }

  function endingDue() {
    return profile.notebook.chapters.includes(7) && !profile.ui?.endingSeen;
  }

  function showEnding(arriving = []) {
    const node = page('ending');
    endingScreen(node, {
      profile, widgets, goal: currentGoal(),
      finish() {
        if (!profile.ui?.endingSeen) updateUi({ endingSeen: true });
        showHub(arriving);
      }
    });
  }

  function inspect(id) {
    companionSheet({ core, roster, widgets, sheets, profile, id });
  }

  function openDungeons(scrollTop) {
    const node = page('dungeons', { back: showHub });
    const destinations = availableDungeons(profile);
    const mainDestinations = destinations.filter(dungeon => dungeon.id !== 'dawn_forest');
    const quick = !run && (mainDestinations.find(dungeon => dungeon.id === profile.ui?.destination)
      ?? mainDestinations.find(dungeon => dungeon.id === currentGoal()?.target?.dungeonId) ?? mainDestinations[0]);
    const difficulty = quick ? departureDifficulty(profile, quick.id) : 'normal';
    const quickStart = quick ? { id: quick.id, name: quick.name, difficulty, start: () => startExpedition(quick.id, difficulty) } : null;
    dungeonsScreen(node, {
      profile, roster, widgets, prepare: run ? null : prepare, quickStart, scrollTop,
      openRoster(dungeonId) {
        const dungeon = DUNGEONS[dungeonId];
        rosterTable({ dungeon, pool: listedPool(roster, dungeon), profile, widgets, sheets, inspect });
      }
    });
    tutorial.sync(run);
  }

  function prepare(dungeonId, contractId) {
    if (run || !availableDungeons(profile).some(dungeon => dungeon.id === dungeonId)) return;
    if (!featureFlags(profile).prepEditing || dungeonId === 'dawn_forest') {
      return startExpedition(dungeonId, departureDifficulty(profile, dungeonId));
    }
    const initialContract = Object.hasOwn(CONTRACTS, contractId) && profile.nightmareUnlocks.includes(dungeonId) ? contractId : null;
    const saved = profile.ui?.preparation;
    if (initialContract || saved?.dungeonId !== dungeonId) {
      savePreparation({ dungeonId, difficulty: initialContract ? 'nightmare' : departureDifficulty(profile, dungeonId), contract: initialContract });
    }
    preparationOpen = true;
    preparationSheet({ dungeonId, currentProfile: () => profile, updateProfile, savePreparation, roster, widgets, sheets, start: startExpedition });
    tutorial.sync(run);
  }

  function savePreparation(draft) {
    const { dungeonId, difficulty } = draft;
    const next = { ...profile, ui: { ...profile.ui, destination: dungeonId,
      difficulty: { ...profile.ui?.difficulty, [dungeonId]: difficulty } } };
    updateProfile(Meta.setPreparation?.(next, draft) ?? { ...next, ui: { ...next.ui, preparation: draft } });
  }

  function withoutPreparation() {
    const next = Meta.clearPreparation?.(profile) ?? profile;
    return { ...next, ui: { ...next.ui, preparation: null, preparing: false } };
  }

  function closePreparation() {
    if (!preparationOpen || $('#sheet').classList.contains('on')) return;
    preparationOpen = false;
    updateProfile(withoutPreparation());
    if ($('#hub').classList.contains('on')) showHub();
    else if ($('#dungeons').classList.contains('on')) openDungeons($('#dungeons .scroll-list').scrollTop);
  }

  function startExpedition(destination, difficulty = 'normal', contract = null) {
    const dungeonId = destination || 'dawn_forest';
    const requestedSeed = new URLSearchParams(location.search).get('seed');
    const seed = requestedSeed !== null && /^\d+$/.test(requestedSeed)
      ? Number(requestedSeed) >>> 0 : Math.floor(Math.random() * 0x100000000);
    run = createRun({ core, roster, dungeonId, difficulty, contract, seed, profileView: startView(profile, dungeonId) });
    preparationOpen = false;
    let next = withoutPreparation();
    if (basicTutorial(next)) next = Meta.markEntryStep(next, dungeonId === 'dawn_forest' ? 'title' : 'departure');
    updateProfile({ ...next, ui: {
      ...next.ui, destination: destination || next.ui.destination, announcement: null,
      entryDoor: null, entryBattle: null, tutorialReplay: dungeonId === 'dawn_forest' && next.ui.tutorialReplay ? 'active' : null,
      ...(destination && { difficulty: { ...next.ui.difficulty, [dungeonId]: difficulty } })
    } });
    tutorial.reset();
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
    const choices = saved?.runId === run.id && Array.isArray(saved.ids) ? saved.ids.filter(id => candidates.includes(id)) : initial;
    const node = page('recruit', { title: rewards.result === 'win' ? '생환' : '원정 실패' });
    recruitScreen(node, {
      run, rewards, profile, widgets, sheets, choices, preview: selection => applyRunEnd(profile, run, selection).announce,
      endingPending: run.dungeonId === 'creation_tower' && rewards.result === 'win' && !profile.ui?.endingSeen,
      changeChoices: ids => updateUi({ recruitChoices: { runId: run.id, ids } }),
      confirm: confirmReturn
    });
    tutorial.sync(run);
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
    let next = result.profile;
    if (basicTutorial(next) && run.dungeonId === 'dawn_forest' && announce.recruits.length) {
      next = Meta.markEntryStep(next, 'recruit');
    }
    const entry = { dungeonId: run.dungeonId, floor: run.floor, result: run.result };
    const recruits = announce.recruits;
    const hubReturners = announce.returned.filter(id => next.recruits[id]);
    const previousReturners = Array.isArray(next.ui?.returners) ? next.ui.returners : [];
    const returners = [...new Set([...recruits, ...hubReturners, ...previousReturners])].slice(0, 3);
    const announcement = {
      dungeons: announce.dungeons, nightmares: announce.nightmares, chapters: announce.chapters, missionEarned: !!announce.missions?.length,
      firstMain: !featureFlags(profile).firstMainCleared && featureFlags(next).firstMainCleared
    };
    const latestRun = { ...entry, difficulty: run.difficulty, floors: run.floors, stats: run.stats, fallen: run.fallen, features: run.features,
      lastBattleLog: run.lastBattleLog };
    run = null;
    review = null;
    const saved = updateProfile({ ...next, ui: {
      ...next.ui, recruitChoices: null, entryBattle: null, entryDoor: null, returners, announcement, latestRun
    } });
    if (announce.stamp) {
      if (saved) audio.sfx.stamp();
    } else if (recruits.length) audio.sfx.crit();
    if (endingDue()) showEnding(recruits);
    else showHub(recruits);
    return true;
  }

  function resetData() {
    try {
      if (store.clear() === false) return warnSave();
      if (!store.loadDetailed) dailyStore?.clear?.();
    } catch { return warnSave(); }
    recovery = null;
    profile = createProfile();
    run = null;
    daily.reset();
    review = null;
    preparationOpen = false;
    sheets.closeSheet();
    stage.clock.waiters.length = 0;
    stage.clock.tweens.length = 0;
    stage.clock.fast = false;
    stage.clock.slow = 1;
    stage.clear();
    tutorial.reset();
    showTitle();
  }

  function currentBackup({ lastGood = false } = {}) {
    const settings = settingsSnapshot(stage, audio, music);
    if (!recovery) return store.exportBackup({ profile, run, dailyRun: daily.backupRun, settings });
    const good = lastGood ? store.loadLastGood?.() : null;
    return store.exportBackup(good?.status === 'ok' ? { profile: good.profile, settings } : { settings });
  }

  function reloadAfterRestore() {
    if (audio.sfx.restored()) setTimeout(() => location.reload(), 110);
    else location.reload();
  }

  function showRecovery() {
    const good = store.loadLastGood?.();
    const hasGood = good?.status === 'ok';
    const unavailable = recovery === 'unavailable';
    const riftDamaged = !unavailable && store.exportBackup && currentBackup({ lastGood: true }).damagedDaily != null;
    const node = page('recovery');
    node.classList.add('screen-split', 'meta-recovery');
    node.innerHTML = `<div class="meta-panel fixed-top">
        <h2>${unavailable ? '저장 공간 접근 불가' : '전체 기록 복구 필요'}</h2>
        ${riftDamaged ? '<p>균열 기록도 손상되었습니다. 직전 기록으로 복구하면 손상된 균열은 별도 보관합니다.</p>' : ''}
      </div>
      <div class="fixed-foot">
        ${hasGood ? `<button class="btn go" id="meta-last-good">직전 기록으로 복구 · 동료 ${Object.keys(good.profile?.recruits ?? {}).length}명</button>` : ''}
        <button class="btn${hasGood ? '' : ' go'}" data-backup-action="import">기록 가져오기</button>
        <input id="meta-recovery-file" type="file" accept=".json,application/json" hidden>
        <button class="btn" id="meta-recovery-new">${unavailable ? '기록 없이 시작' : '새 기록 시작'}</button>
        ${unavailable ? '' : `<div id="meta-recovery-confirm" hidden>
          <p>남아 있는 동료, 수첩, 균열과 복구 사본이 모두 삭제됩니다.</p>
          <div class="screen-tabs">
            <button class="btn" id="meta-recovery-cancel">취소</button>
            <button class="btn meta-danger" id="meta-recovery-erase">모든 기록 지우기</button>
          </div>
        </div>`}
        <p class="meta-feedback" role="status"></p>
      </div>`;
    const importAction = $('[data-backup-action="import"]', node);
    if (store.exportBackup && store.inspectBackup && store.restoreBackup) {
      bindRecoveryImport(node, { sheets, store, currentBackup, recovered: reloadAfterRestore });
    } else importAction.disabled = true;
    $('#meta-last-good', node)?.addEventListener('click', event => {
      const result = store.restoreLastGood?.();
      if (result?.ok) {
        event.currentTarget.disabled = true;
        reloadAfterRestore();
      } else $('.meta-feedback', node).textContent = '직전 기록을 복구하지 못했습니다.';
    });
    const startNew = $('#meta-recovery-new', node);
    const confirmation = $('#meta-recovery-confirm', node);
    startNew.addEventListener('click', () => {
      if (unavailable) {
        recovery = null;
        return showTitle();
      }
      confirmation.hidden = false;
      startNew.hidden = true;
      $('#meta-recovery-cancel', node).focus();
    });
    $('#meta-recovery-cancel', node)?.addEventListener('click', () => {
      confirmation.hidden = true;
      startNew.hidden = false;
      startNew.focus();
    });
    $('#meta-recovery-erase', node)?.addEventListener('click', resetData);
  }

  $('#frame').addEventListener('click', event => {
    const action = event.target.closest('[data-backup-action]');
    const mode = action?.closest('#recovery') ? null : action?.dataset.backupAction;
    if (mode) openBackupSheet({ mode, sheets, store, currentBackup, recovered: reloadAfterRestore });
  });
  document.addEventListener('click', () => queueMicrotask(() => tutorial.sync(run)));

  function replayTutorial() {
    if (run || daily.run || !$('#title.on, #hub.on')) return;
    const entry = { ...profile.ui.entry, done: [], skipped: false };
    updateUi({ entry, tutorialReplay: 'queued', entryDoor: null, entryBattle: null });
    sheets.closeSheet();
    tutorial.reset();
    showTitle(profile);
  }

  function showTitle(savedProfile, notice) {
    music.play('hub');
    titleScreen({
      profile: savedProfile, widgets, notice,
      start() {
        if (profile.ui.tutorialReplay === 'queued' || !savedProfile || !profile.records.runs && !profile.notebook.chapters.length) startExpedition();
        else if (endingDue()) showEnding();
        else {
          showHub();
          const destination = profile.ui?.preparation?.dungeonId ?? (profile.ui?.preparing ? profile.ui.destination : null);
          if (destination && featureFlags(profile).prepEditing) prepare(destination);
        }
      }
    });
    tutorial.sync(run);
  }

  function boot() {
    if (recovery) showRecovery();
    else if (run?.phase === 'done') showRecruit();
    // The observatory opens with the first return: until then a reload goes straight back into the intro.
    else if (run && (!Object.keys(profile.recruits).length || run.dungeonId === 'dawn_forest' && basicTutorial(profile))) enterExpedition();
    else if (run) showHub();
    else if (featureFlags(profile).introCleared && profile.ui.tutorialReplay !== 'queued' &&
      (basicTutorial(profile) || profile.ui.tutorialReplay === 'active' || profile.ui.announcement?.firstMain)) showHub();
    else showTitle(stored?.profile, detail?.status === 'runDamaged' || stored?.runError ? '원정만 손상 · 동료와 수첩 유지' : '');
  }

  return { boot, closePreparation, resetData, inspect, replayTutorial,
    get run() { return daily.run ?? run; }, get review() { return review; } };
}
