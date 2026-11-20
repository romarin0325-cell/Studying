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
import { missionRecruitSheet, recruitScreen } from './screens/recruit.js';
import { collectionScreen, companionSheet, rosterTable } from './screens/collection.js';
import { notebookScreen } from './screens/notebook.js';
import { recordsScreen } from './screens/records.js';
import { endingScreen } from './screens/ending.js';
import { dailyResultScreen, dailyResultTitle, openDailyHistory, openDailyPreparation, openEarlierRift, shortRiftDate } from './screens/daily-rift.js';
import * as Meta from '../engine/meta.js';
import { createRun, finishRun } from '../engine/run.js';
import { DUNGEONS } from '../content/dungeons.js';
import { CONTRACTS } from '../content/contracts.js';

const { availableDungeons, applyRunEnd, createProfile, setExpeditionParty, startView } = Meta;

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
  let dailyRun = null;
  let review = null;
  let preparationOpen = false;
  let crystalCount = 0;
  let gainedAtReturn = false;
  let warnedSave = false;
  const details = createDetails(core, widgets, sheets.openSheet);

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
  const dailyHost = {
    ...host,
    save(current) {
      if (current === dailyRun && !dailyStore?.save?.(current)?.ok) warnSave();
    },
    finish: finishDaily
  };

  function sessionNotice(message) {
    const notice = document.createElement('p');
    notice.className = 'win';
    notice.textContent = message;
    $('#session-notices').append(notice);
    setTimeout(() => notice.remove(), 10000);
  }

  function persist() {
    try {
      if (store.save({ profile, run }) !== false) return;
    } catch { /* The current session remains in memory. */ }
    warnSave();
  }

  function warnSave() {
    if (warnedSave) return;
    warnedSave = true;
    sessionNotice('저장에 실패했다. 새로고침하면 지금부터의 진행이 사라진다.');
  }

  function updateProfile(next) {
    profile = next;
    persist();
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
    const completedTower = profile.notebook.chapters.includes(7);
    const collecting = completedTower && target?.screen === 'collection';
    const destinationId = !collecting && (target?.dungeonId ?? profile.ui?.destination);
    hubScreen(node, {
      profile, run, widgets, inspect, openDungeons, destinationId, resume: enterExpedition, goal, arriving,
      depart: collecting ? () => openMeta('collection', true)
        : destinationId ? () => prepare(destinationId, target?.contractId) : openDungeons,
      departureLabel: collecting ? '동료 출현 지역 보기' : null,
      daily: dailyStore?.view?.(profile, new Date()), openDaily: showDaily
    });
    if (profile.ui?.announcement) updateUi({ announcement: null });
    for (const button of node.querySelectorAll('[data-meta-page]')) button.addEventListener('click', () => {
      openMeta(button.dataset.metaPage);
    });
  }

  function currentGoal(current = null) {
    const goal = Meta.nextGoal?.(profile, current);
    const name = profile.lead && roster.card(profile.lead)?.name;
    const text = name && goal?.text === '대표 동료와 본편 출발'
      ? goal.text.replace('대표 동료와', name + (/[가-힣]$/.test(name) && (name.charCodeAt(name.length - 1) - 0xac00) % 28 ? '과' : '와'))
      : goal?.text;
    return goal && { ...goal, text };
  }

  function openMeta(id, showWanted = false) {
    const content = page(id, { back: showHub });
    if (id === 'collection') collectionScreen(content, { profile, roster, widgets, core, inspect, showWanted });
    else if (id === 'notebook') {
      function renderNotebook() {
        const scroll = content.scrollTop;
        notebookScreen(content, profile, roster.card, {
          goal: currentGoal(run), missions: Meta.missionsView?.(profile, roster),
          openMission: !run && Meta.claimMission ? kind => invite(kind) : null
        });
        content.scrollTop = scroll;
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
            updateProfile(result.profile);
            sheets.closeSheet();
            renderNotebook();
            sessionNotice(id ? `${roster.card(id).name} · 관측소에 영입` : '임무 완료 도장 획득');
            return true;
          }
        });
      }
      renderNotebook();
    } else if (id === 'records') recordsScreen(content, profile, roster.card, sheets.openSheet, () => showEnding(),
      dailyStore?.history ? showDailyHistory : null, log => openBattleLog(sheets, widgets, log));
  }

  function showDailyHistory(node) {
    const cursors = [null];
    function render() {
      openDailyHistory(dailyStore.history({ before: cursors.at(-1), limit: 7 }) ?? {}, {
        node, sheets,
        next(cursor) { cursors.push(cursor); render(); },
        previous: cursors.length > 1 ? () => { cursors.pop(); render(); } : null
      });
    }
    render();
  }

  function showDaily(message) {
    const view = dailyStore?.view?.(profile, new Date());
    if (!view?.unlocked) return;
    if (view.active) {
      const today = view.dayKey ?? view.spec?.dayKey;
      if (view.active.dayKey && today && view.active.dayKey !== today) return promptDailyResume(view.active);
      return resumeDaily();
    }
    openDailyPreparation(view, {
      roster, widgets, sheets, message, start: startDaily,
      inspectLoan: (id, onClose) => details.charSheet(null, id, { loaned: true, onClose })
    });
  }

  function promptDailyResume(active) {
    openEarlierRift(active, { sheets, resume: resumeDaily, abandon: abandonDaily });
  }

  function startDaily(expectedDayKey, kind) {
    const now = new Date();
    const result = dailyStore?.start?.({ profile, now, expectedDayKey, kind });
    if (result?.ok && result.run) return enterDaily(result.run);
    if (result?.reason === 'date_changed') {
      const view = dailyStore.view?.(profile, now);
      const date = shortRiftDate(view?.dayKey ?? view?.spec?.dayKey);
      if ($('#hub').classList.contains('on')) showHub();
      showDaily(date ? `날짜가 바뀌었다. ${date} 균열을 확인하자.` : '날짜가 바뀌었다. 오늘의 균열을 확인하자.');
    } else if (['active_exists', 'already_recorded', 'official_required'].includes(result?.reason)) {
      showDaily();
    } else if (result?.reason === 'storage_failed') {
      warnSave();
    } else {
      sessionNotice('균열을 시작하지 못했다.');
    }
  }

  function resumeDaily() {
    const restored = dailyStore?.resume?.();
    if (restored?.ok && restored.run) return enterDaily(restored.run);
    sessionNotice('진행 중인 균열을 불러오지 못했다.');
    const active = dailyStore?.view?.(profile, new Date())?.active;
    if (active && !$('#meta-rift-resume')) promptDailyResume(active);
  }

  function abandonDaily(runId) {
    const result = dailyStore?.abandon?.(runId);
    if (result?.ok) {
      showHub();
      showDaily();
    } else if (result?.reason === 'storage_failed') warnSave();
    else sessionNotice('균열을 포기하지 못했다.');
  }

  function enterDaily(current) {
    dailyRun = current;
    review = null;
    sheets.closeSheet();
    audio.unlockAudio();
    if (current.phase === 'done') return finishDaily(current);
    review = enterRun(current, dailyHost) || null;
  }

  function finishDaily(current) {
    if (current !== dailyRun || current.phase !== 'done') return;
    const result = dailyStore?.finish?.(current);
    if (!result?.ok) {
      if (result?.reason === 'storage_failed') warnSave();
      const node = page('daily-result', { title: '균열 기록' });
      node.innerHTML = '<div class="rift-actions"><p>균열 기록을 저장하지 못했다.</p><button class="btn go" id="meta-rift-retry">다시 저장</button></div>';
      $('#meta-rift-retry', node).addEventListener('click', () => finishDaily(current));
      return;
    }
    const spec = current.daily?.spec;
    const score = {
      runId: current.id, dayKey: spec?.dayKey, kind: current.daily?.kind, outcome: current.result,
      floor: current.floor, turns: current.stats?.turns, livingIds: current.bench, heirloomsUsed: current.stats?.heirloomsUsed,
      ...result.score
    };
    const view = dailyStore?.view?.(profile, new Date());
    dailyRun = null;
    review = null;
    const node = page('daily-result', { title: dailyResultTitle(score), track: score.outcome === 'win' ? 'victory' : 'defeat' });
    dailyResultScreen(node, { spec, score, official: result.official }, {
      widgets, today: view?.dayKey ?? view?.spec?.dayKey, practice: dayKey => startDaily(dayKey, 'practice'),
      openToday: showDaily, hub: showHub
    });
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
    const quick = !run && (mainDestinations.find(dungeon => dungeon.id === profile.ui?.destination)
      ?? mainDestinations.find(dungeon => dungeon.id === currentGoal()?.target?.dungeonId) ?? mainDestinations[0]);
    const difficulty = quick ? departureDifficulty(profile, quick.id) : 'normal';
    const quickStart = quick ? { name: quick.name, difficulty, start: () => startExpedition(quick.id, difficulty) } : null;
    dungeonsScreen(node, {
      profile, roster, widgets, prepare: run ? null : prepare, quickStart,
      openRoster(dungeonId) {
        const dungeon = DUNGEONS[dungeonId];
        rosterTable({ dungeon, pool: listedPool(roster, dungeon), locked: true, currentProfile: () => profile, updateProfile, widgets, sheets });
      }
    });
  }

  function prepare(dungeonId, contractId) {
    if (run || !availableDungeons(profile).some(dungeon => dungeon.id === dungeonId)) return;
    const initialContract = Object.hasOwn(CONTRACTS, contractId) && profile.nightmareUnlocks.includes(dungeonId) ? contractId : null;
    if (profile.ui?.destination !== dungeonId || !profile.ui?.preparing) updateUi({ destination: dungeonId, preparing: true });
    preparationOpen = true;
    preparationSheet({ dungeonId, currentProfile: () => profile, updateProfile, roster, widgets, sheets, start: startExpedition, initialContract });
  }

  function closePreparation() {
    if (!preparationOpen || $('#sheet').classList.contains('on')) return;
    preparationOpen = false;
    updateUi({ preparing: false });
    if ($('#hub').classList.contains('on')) showHub();
    else if ($('#dungeons').classList.contains('on')) {
      const top = $('#dungeons .meta-page').scrollTop;
      openDungeons();
      $('#dungeons .meta-page').scrollTop = top;
    }
  }

  function startExpedition(destination, difficulty = 'normal', contract = null) {
    const dungeonId = destination || 'dawn_forest';
    const requestedSeed = new URLSearchParams(location.search).get('seed');
    const seed = requestedSeed !== null && /^\d+$/.test(requestedSeed)
      ? Number(requestedSeed) >>> 0 : Math.floor(Math.random() * 0x100000000);
    run = createRun({ core, roster, dungeonId, difficulty, contract, seed, profileView: startView(profile, dungeonId) });
    preparationOpen = false;
    updateUi({
      destination: destination || profile.ui?.destination, preparing: false, announcement: null,
      ...(destination && { difficulty: { ...profile.ui?.difficulty, [dungeonId]: difficulty } })
    });
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
      run, rewards, profile, widgets, sheets, choices, preview: selection => applyRunEnd(profile, run, selection).announce,
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
    const returned = new Set(announce.returned ?? run.bench.filter(id => !run.fallen.includes(id)));
    for (const id of new Set([...run.participated, ...recruits])) {
      if (next.recruits[id]) recent[id] = [{ ...entry, returned: returned.has(id) }, ...(recent[id] || [])].slice(0, 3);
    }
    const hubReturners = run.result === 'win' ? run.bench.filter(id => next.recruits[id]) : [];
    const returners = [...new Set([...recruits, ...hubReturners, ...(next.ui?.returners || [])])].slice(0, 3);
    const announcement = {
      dungeons: announce.dungeons, nightmares: announce.nightmares, chapters: announce.chapters, missionEarned: !!announce.missions?.length
    };
    const latestRun = { ...entry, difficulty: run.difficulty, floors: run.floors, stats: run.stats, fallen: run.fallen,
      lastBattleLog: run.lastBattleLog };
    run = null;
    review = null;
    updateProfile({ ...next, ui: { ...next.ui, recruitChoices: null, recent, returners, announcement, latestRun } });
    if (recruits.length) audio.sfx.crit();
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
    dailyRun = null;
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

  function currentBackup({ lastGood = false } = {}) {
    const settings = settingsSnapshot(stage, audio, music);
    if (!recovery) return store.exportBackup({ profile, run, dailyRun, settings });
    const good = lastGood ? store.loadLastGood?.() : null;
    return store.exportBackup(good?.status === 'ok' ? { profile: good.profile, settings } : { settings });
  }

  function showRecovery() {
    const good = store.loadLastGood?.();
    const hasGood = good?.status === 'ok';
    const unavailable = recovery === 'unavailable';
    const node = page('recovery');
    node.innerHTML = `<div class="meta-panel meta-sheet meta-recovery">
      <h2>${unavailable ? '저장 공간에 접근할 수 없다' : '전체 기록 복구 필요'}</h2>
      ${hasGood ? `<button class="btn go" id="meta-last-good">직전 기록으로 복구 · 동료 ${Object.keys(good.profile?.recruits ?? {}).length}명</button>` : ''}
      <button class="btn${hasGood ? '' : ' go'}" data-backup-action="import">기록 가져오기</button>
      <button class="btn" id="meta-recovery-new">${unavailable ? '기록 없이 시작' : '새 기록 시작'}</button>
      <p class="meta-feedback" role="status"></p>
    </div>`;
    $('#meta-last-good', node)?.addEventListener('click', () => {
      const result = store.restoreLastGood?.();
      if (result?.ok) location.reload();
      else $('.meta-feedback', node).textContent = '직전 기록을 복구하지 못했다.';
    });
    $('#meta-recovery-new', node).addEventListener('click', () => {
      if (unavailable) {
        recovery = null;
        return showTitle();
      }
      sheets.openSheet('새 기록을 시작할까요?', `<div class="meta-sheet">
        <p>남아 있는 동료, 수첩, 균열과 복구 사본을 지운다.</p>
        <button class="btn meta-danger" id="meta-recovery-erase">모든 기록 지우기</button>
      </div>`);
      $('#meta-recovery-erase').addEventListener('click', resetData);
    });
  }

  $('#frame').addEventListener('click', event => {
    const mode = event.target.closest('[data-backup-action]')?.dataset.backupAction;
    if (mode) openBackupSheet({ mode, sheets, store, currentBackup, recovered: () => location.reload() });
  });

  function showTitle(savedProfile, notice) {
    music.play('hub');
    titleScreen({
      profile: savedProfile, widgets, notice,
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
    if (recovery) showRecovery();
    else if (run?.phase === 'done') showRecruit();
    // The observatory opens with the first return: until then a reload goes straight back into the intro.
    else if (run && !Object.keys(profile.recruits || {}).length) enterExpedition();
    else if (run) showHub();
    else showTitle(stored?.profile, detail?.status === 'runDamaged' || stored?.runError ? '원정만 손상 · 동료와 수첩 유지' : '');
  }

  return { boot, closePreparation, resetData, inspect, get run() { return dailyRun ?? run; }, get review() { return review; } };
}
