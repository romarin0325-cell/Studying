import { $, esc, show } from './dom.js';
import * as assets from './assets.js';
import { openBackupSheet, settingsSnapshot, tools } from './settings.js';
import { sheetMarkup } from './sheet.js';
import { enterRun } from './run/index.js';
import { createDetails } from './battle/sheets.js';
import { openBattleLog } from './battle/log.js';
import { titleScreen } from './screens/title.js';
import { hubScreen } from './screens/hub.js';
import { dungeonsScreen, listedPool, preparationSheet } from './screens/dungeons.js';
import { missionRecruitSheet, recruitReceipt, recruitScreen } from './screens/recruit.js';
import { collectionScreen, companionSheet, rosterTable, saveEpisodeFlags } from './screens/collection.js';
import { notebookScreen } from './screens/notebook.js';
import { recordsScreen } from './screens/records.js';
import { endingScreen } from './screens/ending.js';
import { createDailyNavigation } from './nav/daily.js';
import { bindRecoveryImport } from './nav/recovery.js';
import { basicTutorial, createTutorial } from './tutorial.js';
import { hasFinalConsonant } from './widgets.js';
import { withSessionWrite } from './storage.js';
import * as Meta from '../engine/meta.js';
import { episodeState } from '../engine/episodes.js';
import { createRun, finishRun } from '../engine/run.js';
import { DUNGEONS } from '../content/dungeons.js';
import { CONTRACTS } from '../content/contracts.js';
import { EPISODES } from '../content/episodes.js';

const { availableDungeons, applyRunEnd, createProfile, departureDifficulty, featureFlags, startView } = Meta;
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
    <dialog id="stale-session" class="win meta-sheet" aria-labelledby="stale-session-title" aria-describedby="stale-session-copy">
      <h3 id="stale-session-title">다른 창에서 진행 중</h3>
      <p id="stale-session-copy">이 창의 화면은 오래된 상태입니다. 최신 진행을 불러와 이 창에서 이어 할 수 있어요.</p>
      <button class="btn go" id="stale-session-resume" autofocus>이 창에서 이어하기</button>
    </dialog>
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
  let staleTab = false;
  let settling = false;
  let reloading = false;
  let sessionEpoch = 0;
  const details = createDetails(core, widgets, sheets.openSheet);
  const tutorial = createTutorial({ currentProfile: () => profile, updateProfile, widgets, stage, core, roster });

  const host = {
    save(current) {
      if (staleTab || current !== run) return;
      if (run.result === 'win' && run.crystals > crystalCount) gainedAtReturn = true;
      crystalCount = run.crystals;
      // The write is queued behind other tabs' writes; callers that must not move on before it lands await this.
      return persist();
    },
    finish(current) {
      if (!staleTab && current === run && current.phase === 'done') showRecruit();
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

  const staleNotice = $('#stale-session');
  staleNotice.addEventListener('cancel', event => event.preventDefault());
  $('#stale-session-resume', staleNotice).addEventListener('click', () => location.reload());
  store.watchStale?.(window, showStaleTab);

  function showStaleTab() {
    if (staleTab) return;
    staleTab = true;
    preparationOpen = false;
    sheets.closeSheet();
    tutorial.reset();
    stage.pause(true);
    staleNotice.showModal();
  }

  function sessionNotice(message) {
    const notice = document.createElement('p');
    notice.className = 'win';
    notice.textContent = message;
    $('#session-notices').append(notice);
    setTimeout(() => notice.remove(), 10000);
  }

  async function writeSession(write, onFailure = warnSave) {
    const epoch = sessionEpoch;
    try {
      return await withSessionWrite(() => {
        if (staleTab || reloading || sessionEpoch !== epoch) return false;
        const result = write();
        if (result?.reason === 'stale_tab') showStaleTab();
        else if (result === false || result?.ok === false) onFailure();
        else return true;
        return false;
      });
    } catch {
      if (!staleTab) onFailure();
      return false;
    }
  }

  function persist() {
    return writeSession(() => store.save({ profile, run }));
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
    return writeSession(() => saveProfile({ ...profile, ui: { ...profile.ui, ...patch } }));
  }

  function saveProfile(next, activeRun = run) {
    const result = store.save({ profile: next, run: activeRun });
    if (result !== false && result?.ok !== false) profile = next;
    return result;
  }

  function saveFlags(field, ids) {
    return writeSession(() => {
      let result;
      const saved = saveEpisodeFlags(profile, field, ids, (current, key, flags) => {
        result = store.saveEpisodeFlags(current, key, flags);
        return result;
      });
      if (saved && field === 'episodesRead' && !Object.keys(EPISODES).some(id => episodeState(profile, id) === 'new')) {
        $('#meta-episode-badge')?.remove();
      }
      return saved || result || false;
    }, field === 'episodesRead' ? () => {} : warnSave);
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
      profile, run, widgets, inspect, openDungeons, destinationId, resume: enterExpedition, goal, arriving, flags, firstMain, saveFlags,
      depart: firstMain ? () => startExpedition(FIRST_MAIN, departureDifficulty(profile, FIRST_MAIN))
        : () => followGoal(target),
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
    const goal = Meta.nextGoal?.(profile, current, roster);
    const name = profile.lead && roster.card(profile.lead)?.name;
    const text = name && goal?.text === '시작 동료와 본편 출발'
      ? name + (hasFinalConsonant(name) ? '과' : '와') + ' 본편 출발'
      : goal?.text;
    const reward = goal?.reward.includes('샘 초대') && !featureFlags(profile).prepEditing ? '' : goal?.reward;
    return goal && { ...goal, text, reward };
  }

  function followGoal(target, fromNotebook = false) {
    if (target?.screen === 'resume') return enterExpedition();
    if (target?.screen === 'recruit') return showRecruit();
    if (target?.screen === 'collection') return openMeta('collection');
    if (!target?.dungeonId || (fromNotebook && (!featureFlags(profile).prepEditing || target.dungeonId === 'dawn_forest'))) {
      return openDungeons({ target });
    }
    return prepare(target.dungeonId, target);
  }

  function openMeta(id, { mission } = {}) {
    const flags = featureFlags(profile);
    const content = page(id, { back: showHub });
    if (id === 'collection') collectionScreen(content, { profile, roster, widgets, core, inspect });
    else if (id === 'notebook') {
      if (mission) content.dataset.screenTabActive = 'missions';
      function renderNotebook() {
        const scroll = $('.scroll-list', content)?.scrollTop ?? 0;
        const goal = currentGoal(run);
        notebookScreen(content, profile, roster.card, {
          goal, followGoal: () => followGoal(goal?.target, true),
          flags, missions: flags.missions ? Meta.missionsView(profile, roster) : null,
          openMission: !run ? kind => invite(kind) : null,
          describeMission: (label, line) => sheets.sheet(label, line)
        });
        $('.scroll-list', content).scrollTop = scroll;
      }
      function invite(kind, key) {
        const periods = Meta.missionsView?.(profile, roster)?.claimable?.filter(period => period.kind === kind) ?? [];
        if (run || !periods.length) return;
        const index = Math.max(0, periods.findIndex(period => period.key === key));
        const period = periods[index];
        missionRecruitSheet({
          period, widgets, sheets, remaining: periods.length,
          next: () => invite(kind, periods[(index + 1) % periods.length].key),
          claim(id) {
            const result = Meta.claimMission(profile, period.key, id, roster);
            if (!result?.announce?.ok) return false;
            const button = $('#meta-mission-claim');
            button.disabled = true;
            writeSession(() => saveProfile(result.profile)).then(saved => {
              if (!saved || staleTab) {
                button.disabled = false;
                return;
              }
              if (result.announce.recruits.length) audio.sfx.join();
              else audio.sfx.stamp();
              sheets.closeSheet();
              renderNotebook();
              sessionNotice(id ? `${roster.card(id).name} · 관측소에 영입` : '임무 완료 도장 획득');
            });
            return true;
          }
        });
      }
      renderNotebook();
      if (mission) invite(mission.kind, mission.key);
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
      async finish() {
        if (!profile.ui?.endingSeen && !await updateUi({ endingSeen: true })) return;
        if (staleTab) return;
        showHub(arriving);
      }
    });
  }

  function inspect(id) {
    companionSheet({
      core, roster, widgets, sheets, profile, id, saveFlags,
      openDestination: run ? null : dungeonId => {
        sheets.closeSheet();
        openDungeons({ target: { dungeonId } });
      },
      openMission: run ? null : mission => {
        sheets.closeSheet();
        openMeta('notebook', { mission });
      }
    });
  }

  function openDungeons({ scrollTop, target } = {}) {
    const node = page('dungeons', { back: showHub });
    const destinations = availableDungeons(profile);
    const mainDestinations = destinations.filter(dungeon => dungeon.id !== 'dawn_forest');
    const selected = target?.dungeonId ? destinations.find(dungeon => dungeon.id === target.dungeonId)
      : mainDestinations.find(dungeon => dungeon.id === profile.ui?.destination)
        ?? mainDestinations.find(dungeon => dungeon.id === currentGoal()?.target?.dungeonId) ?? mainDestinations[0];
    const difficulty = selected && (selected.difficulties.includes(target?.difficulty) ? target.difficulty : departureDifficulty(profile, selected.id));
    const quickStart = !run && selected ? { id: selected.id, name: selected.name, difficulty,
      start: () => startExpedition(selected.id, difficulty) } : null;
    dungeonsScreen(node, {
      profile, roster, widgets, prepare: run ? null : dungeonId => prepare(dungeonId, target?.dungeonId === dungeonId ? target : undefined),
      quickStart, scrollTop, selectedId: target?.dungeonId ?? quickStart?.id,
      openRoster(dungeonId) {
        const dungeon = DUNGEONS[dungeonId];
        rosterTable({ dungeon, pool: listedPool(roster, dungeon), profile, widgets, sheets, inspect });
      }
    });
    tutorial.sync(run);
  }

  function prepare(dungeonId, { difficulty, contractId } = {}) {
    const destination = availableDungeons(profile).find(dungeon => dungeon.id === dungeonId);
    if (run || !destination) return;
    const chosenDifficulty = destination.difficulties.includes(difficulty) ? difficulty : departureDifficulty(profile, dungeonId);
    if (!featureFlags(profile).prepEditing || dungeonId === 'dawn_forest') {
      return startExpedition(dungeonId, chosenDifficulty);
    }
    const initialContract = Object.hasOwn(CONTRACTS, contractId) && chosenDifficulty === 'nightmare' ? contractId : null;
    const saved = profile.ui?.preparation;
    if (difficulty || saved?.dungeonId !== dungeonId) {
      savePreparation({ dungeonId, difficulty: chosenDifficulty, contract: initialContract });
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
    else if ($('#dungeons').classList.contains('on')) openDungeons({ scrollTop: $('#dungeons .scroll-list').scrollTop });
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
      changeChoices: ids => {
        if (!settling) updateUi({ recruitChoices: { runId: run.id, ids } });
      },
      confirm: confirmReturn
    });
    tutorial.sync(run);
  }

  function confirmReturn(choices) {
    if (!run || staleTab) return false;
    if (settling) return true;
    const result = applyRunEnd(profile, run, choices);
    const { announce } = result;
    if (!announce.ok && announce.reason !== 'already_applied') return false;
    const current = run;
    const button = $('#meta-recruit-confirm');
    settling = true;
    button.disabled = true;
    writeSession(() => settleReturn(result, current)).then(saved => {
      settling = false;
      if (!saved || staleTab) {
        button.disabled = false;
        return;
      }
      const recruits = announce.ok ? announce.recruits : [];
      if (announce.stamp) audio.sfx.stamp();
      else if (recruits.length) audio.sfx.crit();
      if (endingDue()) showEnding(recruits);
      else showHub(recruits);
    });
    return true;
  }

  function settleReturn({ profile: next, announce }, current) {
    const result = saveProfile(announce.ok ? returnProfile(next, announce, current)
      : { ...profile, ui: { ...profile.ui, recruitChoices: null } }, null);
    if (result !== false && result?.ok !== false) {
      run = null;
      review = null;
    }
    return result;
  }

  function returnProfile(next, announce, run) {
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
    return { ...next, ui: {
      ...next.ui, recruitChoices: null, entryBattle: null, entryDoor: null, returners, announcement, latestRun
    } };
  }

  async function resetData() {
    if (!await writeSession(() => {
      const result = store.clear();
      if (result !== true) return result;
      if (!store.loadDetailed) dailyStore?.clear?.();
      sessionEpoch++;
      return true;
    }) || staleTab) return;
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

  function finishRestore(restore, onFailure) {
    return writeSession(() => {
      const result = restore();
      if (result?.ok) reloading = true;
      return result;
    }, onFailure);
  }

  function backupActions() {
    let restoring;
    return { sheets, currentBackup, store: !store.restoreBackup ? store : {
      ...store,
      restoreBackup(data) {
        // The import sheet disables its button and hands completion to recovered().
        restoring = finishRestore(() => store.restoreBackup(data), () => {
          const feedback = $('.meta-backup .meta-feedback');
          if (feedback) feedback.textContent = '파일 기록을 저장하지 못했습니다.';
        });
        return { ok: true };
      }
    }, async recovered() {
      if (await restoring) reloadAfterRestore();
      else if (!staleTab) {
        const button = $('#meta-backup-confirm');
        if (button) button.disabled = false;
      }
    } };
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
      bindRecoveryImport(node, backupActions());
    } else importAction.disabled = true;
    $('#meta-last-good', node)?.addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      const recovered = await finishRestore(() => store.restoreLastGood(), () => {
        $('.meta-feedback', node).textContent = '직전 기록을 복구하지 못했습니다.';
      });
      if (recovered) reloadAfterRestore();
      else button.disabled = false;
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
    if (mode) openBackupSheet({ mode, ...backupActions() });
  });
  document.addEventListener('click', () => queueMicrotask(() => { if (!staleTab) tutorial.sync(run); }));

  async function replayTutorial() {
    if (run || daily.run || !$('#title.on, #hub.on')) return;
    const entry = { ...profile.ui.entry, done: [], skipped: false };
    if (!await updateUi({ entry, tutorialReplay: 'queued', entryDoor: null, entryBattle: null }) || staleTab) return;
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
