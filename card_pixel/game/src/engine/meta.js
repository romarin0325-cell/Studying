import { CONTRACTS } from '../content/contracts.js';
import { DUNGEONS } from '../content/dungeons.js';
import { MISSIONS, MISSION_OFFER_LIMIT, MISSION_UNLOCK_CHAPTER } from '../content/missions.js';
import { NOTEBOOK, NOTEBOOK_GOALS } from '../content/notebook.js';
import { calendarDate, localDayKey } from './dates.js';
import { expeditionPool, gradeOf } from './roster.js';
import { shuffle } from './rng.js';
import { finishRun, runRewards, runRoster } from './run.js';
import { entryState, featureFlags, hasCleared, hasFeature } from './entry.js';

export { featureFlags, hasCleared, markEntryStep, markTour, skipTutorial } from './entry.js';

export const PROFILE_VERSION = 1;
const INTRO = 'dawn_forest';
const TOWER = 'creation_tower';
const EARLY = ['ember_volcano', 'twilight_cathedral'];
const REGIONS = Object.keys(DUNGEONS).filter(id => id !== INTRO && id !== TOWER);
const completed = (profile, chapter) => profile.notebook.chapters.includes(chapter);
const union = (left, right) => [...new Set([...left, ...right])];

export function createProfile() {
  return {
    version: PROFILE_VERSION,
    recruits: {}, lead: null, companions: [], preferredCompanion: null, reserved: null, seals: {},
    notebook: { chapters: [], firstLead: null },
    unlockedDungeons: [INTRO], nightmareUnlocks: [], contractStamps: {},
    records: { runs: 0, clears: {}, bestHit: null, longestServing: null, appliedRuns: [] },
    seenCharacters: [], seenRelics: [], missions: { periods: {} }, ui: { entry: entryState(), preparation: null }
  };
}

export function availableDungeons(profile) {
  const { difficultyChoice } = featureFlags(profile);
  return Object.values(DUNGEONS).filter(dungeon => profile.unlockedDungeons.includes(dungeon.id))
    .map(({ id, name, floors, background }) => ({
      id, name, floors, background, difficulties: id === INTRO ? ['normal']
        : !difficultyChoice ? ['easy'] : profile.nightmareUnlocks.includes(id) ? ['easy', 'normal', 'nightmare'] : ['easy', 'normal']
    }));
}

export function validPreparation(profile, draft) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return false;
  const { dungeonId, difficulty, contract } = draft;
  const destination = availableDungeons(profile).find(dungeon => dungeon.id === dungeonId);
  return !!destination?.difficulties.includes(difficulty)
    && (contract === null || (difficulty === 'nightmare' && typeof contract === 'string' && Object.hasOwn(CONTRACTS, contract)));
}

export function setPreparation(profile, draft) {
  if (!validPreparation(profile, draft)) return profile;
  const { dungeonId, difficulty, contract } = draft;
  return { ...profile, ui: { ...profile.ui, preparation: { dungeonId, difficulty, contract } } };
}

export function clearPreparation(profile) {
  return { ...profile, ui: { ...profile.ui, preparation: null } };
}

export function contractsFor(profile, dungeonId) {
  const earned = profile.contractStamps?.[dungeonId];
  const stamps = Object.fromEntries(Object.keys(CONTRACTS).map(id => [id, earned?.[id] ?? null]));
  return { unlocked: profile.nightmareUnlocks.includes(dungeonId), stamps };
}

export function notebookView(profile) {
  return NOTEBOOK.map(chapter => ({ ...chapter, opens: chapter.opens.slice(), completed: completed(profile, chapter.id) }));
}

export function nextGoal(profile, run) {
  if (run) return run.phase === 'done'
    ? { text: '원정 결과 확인', reward: run.result === 'win' ? '생환 정산' : '다음 원정 준비', target: { screen: 'recruit', dungeonId: run.dungeonId } }
    : { text: `${DUNGEONS[run.dungeonId].name} ${run.floor || 1}층 이어가기`, reward: '', target: { screen: 'resume', dungeonId: run.dungeonId } };

  const chapters = notebookView(profile);
  const openRegions = REGIONS.filter(id => profile.unlockedDungeons.includes(id));
  const unreturned = openRegions.find(id => !hasCleared(profile, id));
  const preferred = profile.ui?.destination;
  const destination = unreturned || (openRegions.includes(preferred) ? preferred : openRegions[0]);
  const journey = (chapter, dungeonId) => ({ ...NOTEBOOK_GOALS[chapter], target: { screen: 'dungeons', dungeonId } });

  if (chapters[6].completed) {
    if (unreturned) return { text: `${DUNGEONS[unreturned].name}에서 생환`, reward: '새 지역 생환 기록', target: { screen: 'dungeons', dungeonId: unreturned } };
    for (const dungeonId of [...REGIONS, TOWER]) {
      const { unlocked, stamps } = contractsFor(profile, dungeonId);
      const contractId = unlocked && Object.keys(stamps).find(id => stamps[id] === null);
      if (contractId) return { text: `${DUNGEONS[dungeonId].name} · ${CONTRACTS[contractId].name}`, reward: '악몽 계약 도장', target: { screen: 'dungeons', dungeonId, contractId } };
    }
    return { text: '동료 도감 보기', reward: '동료 수집', target: { screen: 'collection' } };
  }

  const chapter = chapters.find(entry => !entry.completed).id;
  if (chapter === 1) return journey(1, INTRO);
  const recruited = Object.keys(profile.recruits);
  if (chapter === 2 && !recruited.length) {
    return { text: '생환 동료 영입', reward: '시작 동료와 출발할 수 있음', target: { screen: 'dungeons', dungeonId: destination || INTRO } };
  }
  if (chapter === 5 && !recruited.some(id => profile.notebook.firstLead && id !== profile.notebook.firstLead)) {
    if (!chapters[5].completed && unreturned) return journey(6, unreturned);
    if (profile.unlockedDungeons.includes(TOWER)) return journey(7, TOWER);
    return { text: '새 동료 영입', reward: '다른 시작 동료와 출발할 수 있음', target: { screen: 'dungeons', dungeonId: destination || INTRO } };
  }
  if (chapter === 7) return journey(7, TOWER);
  return journey(chapter, destination || INTRO);
}

export function dailyRiftUnlocked(profile) {
  return featureFlags(profile).dailyRift && completed(profile, 4);
}

function companionSlots(profile) {
  if (completed(profile, 5)) return 3;
  if (completed(profile, 4)) return 2;
  return Number(completed(profile, 2));
}

function sealSlots(profile, dungeonId) {
  const clear = profile.records.clears[dungeonId];
  return clear?.nightmare ? 3 : clear?.normal ? 1 : 0;
}

export function startView(profile, dungeonId = INTRO) {
  if (!Object.hasOwn(DUNGEONS, dungeonId)) throw new RangeError('Unknown dungeon: ' + dungeonId);
  const recruited = Object.keys(profile.recruits);
  const features = featureFlags(profile);
  const lead = completed(profile, 1) && recruited.includes(profile.lead) ? profile.lead : null;
  const slots = features.prepEditing ? companionSlots(profile) : 0;
  const seals = features.prepEditing ? (profile.seals[dungeonId] || []).slice() : [];
  const companions = profile.companions.filter(id => recruited.includes(id) && id !== lead && !seals.includes(id)).slice(0, slots);
  const actualLead = seals.includes(lead) ? null : lead;
  return {
    dungeonId, features, lead: actualLead, leadCandidates: features.prepEditing && completed(profile, 1) ? recruited.slice() : [],
    companionSlots: slots, companionCandidates: recruited.filter(id => id !== lead && !seals.includes(id)), companions,
    preferredCompanion: actualLead && profile.recruits[actualLead].bond >= 1 && companions.includes(profile.preferredCompanion)
      ? profile.preferredCompanion : null,
    seals, sealSlots: features.prepEditing ? sealSlots(profile, dungeonId) : 0, reserved: profile.reserved, introCleared: hasCleared(profile, INTRO),
    bossOrder: ![...REGIONS, TOWER].some(id => hasCleared(profile, id)),
    firstMainAssist: ![...REGIONS, TOWER].some(id => profile.records.clears[id]?.normal),
    recruited, runNumber: profile.records.runs + 1,
    unlockedDungeons: profile.unlockedDungeons.slice(), nightmareUnlocks: profile.nightmareUnlocks.slice()
  };
}

export function appearanceRegions(roster, id) {
  return Object.values(DUNGEONS).filter(dungeon => expeditionPool(roster, dungeon.id).baseIds.includes(id)).map(dungeon => dungeon.id);
}

export function prepView(profile, dungeonId, roster) {
  const view = startView(profile, dungeonId);
  const intro = dungeonId === INTRO;
  const editable = view.features.prepEditing;
  const lead = intro ? null : profile.lead;
  const invited = intro ? [] : profile.companions.slice();
  const { baseIds, effectiveIds } = expeditionPool(roster, dungeonId, { ...view, lead, companions: invited, seals: [] });
  const unlocked = profile.unlockedDungeons.includes(dungeonId);
  const pool = effectiveIds.map(id => {
    const base = baseIds.includes(id);
    const start = lead === id;
    const isInvited = invited.includes(id);
    const excluded = view.seals.includes(id);
    const grade = gradeOf(roster.card(id).grade);
    const lastOfGrade = !baseIds.some(other => other !== id && !view.seals.includes(other) && gradeOf(roster.card(other).grade) === grade);
    const inviteReason = intro ? '입문 원정에는 샘 초대가 없습니다'
      : !editable ? '첫 본편을 클리어하면 샘 초대를 편집할 수 있습니다'
      : start ? '시작 동료는 샘에 초대할 수 없습니다' : excluded ? '출현 제외를 먼저 해제하세요'
        : !view.companionCandidates.includes(id) ? '영입한 동료만 샘에 초대할 수 있습니다'
          : !isInvited && invited.length >= view.companionSlots ? '샘 초대 자리가 가득 찼습니다' : null;
    const excludeReason = start ? '시작 동료는 제외할 수 없습니다'
      : !editable || !unlocked ? '지금은 이 지역의 출현 제외를 편집할 수 없습니다'
        : excluded ? null : !base ? '지역 기본 명단의 동료만 제외할 수 있습니다'
          : lastOfGrade ? '등급마다 한 명은 남겨야 합니다'
            : view.seals.length >= view.sealSlots ? '출현 제외 자리가 가득 찼습니다' : null;
    return {
      id, base, added: !base, start, invited: isInvited, excluded,
      canInvite: inviteReason === null, canExclude: excludeReason === null,
      reason: start && excluded ? excludeReason : excludeReason ?? inviteReason
    };
  });
  return {
    start: { id: lead, candidates: intro ? [] : view.leadCandidates },
    invite: { slots: intro ? 0 : view.companionSlots, ids: invited },
    exclude: { slots: view.sealSlots, ids: view.seals },
    pool,
    summary: `기본 ${baseIds.length}명 · 추가 ${pool.filter(row => row.added && !row.excluded).length}명 · 제외 ${view.seals.length}명`
  };
}

const reject = (profile, reason, extra) => ({ profile, announce: { ok: false, reason, ...extra } });

export function setExpeditionParty(profile, { lead = null, companions = [], preferredCompanion = null } = {}) {
  if (!featureFlags(profile).prepEditing) return reject(profile, 'prep_locked');
  const recruited = Object.keys(profile.recruits);
  if (lead !== null && (!completed(profile, 1) || !recruited.includes(lead))) return reject(profile, 'invalid_lead');
  if (!Array.isArray(companions) || companions.length > companionSlots(profile)
    || new Set(companions).size !== companions.length || companions.some(id => id === lead || !recruited.includes(id))) {
    return reject(profile, 'invalid_companions');
  }
  if (preferredCompanion !== null && (!lead || profile.recruits[lead].bond < 1 || !companions.includes(preferredCompanion))) {
    return reject(profile, 'invalid_preferred_companion');
  }
  return { profile: { ...profile, lead, companions: companions.slice(), preferredCompanion }, announce: { ok: true } };
}

export function setSeals(profile, dungeonId, ids, roster) {
  if (!featureFlags(profile).prepEditing) return reject(profile, 'prep_locked');
  if (!profile.unlockedDungeons.includes(dungeonId) || !Array.isArray(ids)
    || ids.length > sealSlots(profile, dungeonId) || new Set(ids).size !== ids.length) return reject(profile, 'invalid_seals');
  const pool = roster.pool(DUNGEONS[dungeonId].pool);
  if (ids.some(id => !pool.includes(id))) return reject(profile, 'invalid_seals');
  if (ids.includes(profile.lead) && !profile.seals[dungeonId]?.includes(profile.lead)) return reject(profile, 'lead_excluded');
  const remaining = pool.filter(id => !ids.includes(id)).map(id => gradeOf(roster.card(id).grade));
  if (pool.some(id => !remaining.includes(gradeOf(roster.card(id).grade)))) return reject(profile, 'empty_grade');
  return { profile: { ...profile, seals: { ...profile.seals, [dungeonId]: ids.slice() } }, announce: { ok: true } };
}

function addChapter(profile, chapter) {
  profile.notebook.chapters = union(profile.notebook.chapters, [chapter]).sort((a, b) => a - b);
}

export function recordRunProgress(profile, run) {
  if (run.daily) return { profile, announce: { ok: true, chapters: [] } };
  const next = structuredClone(profile.ui?.preparation ? clearPreparation(profile) : profile);
  if (run.dungeonId !== INTRO) {
    if (run.lead && Object.hasOwn(next.recruits, run.lead) && !completed(next, 2)) {
      next.notebook.firstLead = run.lead;
      addChapter(next, 2);
    }
    if (run.stats.gateWins > 0) addChapter(next, 3);
  }
  next.seenRelics = union(next.seenRelics, run.seenRelics);
  const chapters = next.notebook.chapters.filter(id => !completed(profile, id));
  return { profile: next, announce: { ok: true, chapters } };
}

function unlockDungeons(profile) {
  const regionalClears = REGIONS.filter(id => hasCleared(profile, id)).length;
  const unlocked = {
    initial: true, intro_clear: hasCleared(profile, INTRO),
    early_region_clear: EARLY.some(id => hasCleared(profile, id)),
    region_clear_count: regionalClears
  };
  for (const { id, unlock } of Object.values(DUNGEONS)) {
    if (unlock.count ? unlocked[unlock.kind] >= unlock.count : unlocked[unlock.kind]) {
      profile.unlockedDungeons = union(profile.unlockedDungeons, [id]);
    }
  }
  if (regionalClears >= DUNGEONS[TOWER].unlock.count) addChapter(profile, 6);
}

export function missionPeriodKeys(key = localDayKey(new Date())) {
  const monday = calendarDate(key);
  if (!monday) return null;
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  return { weekly: `week:${monday.toISOString().slice(0, 10)}`, monthly: `month:${key.slice(0, 7)}` };
}

const periodKind = key => key.startsWith('week:') ? 'weekly' : key.startsWith('month:') ? 'monthly' : null;
const emptyPeriod = () => ({ gates: 0, regionIds: [], state: 'tracking', offerOrder: [], claimedId: null });
const unownedOffers = (profile, period) => period.offerOrder.filter(id => !Object.hasOwn(profile.recruits, id));

function completeOwnedOffers(profile) {
  for (const period of Object.values(profile.missions.periods)) {
    if (period.state === 'earned' && !unownedOffers(profile, period).length) period.state = 'claimed';
  }
}

function missionCandidates(profile, period, mission, roster) {
  const available = unownedOffers(profile, period);
  const preferred = available.filter(id => mission.grades.includes(roster.card(id)?.grade));
  return (preferred.length ? preferred : available).slice(0, MISSION_OFFER_LIMIT);
}

export function missionsView(profile, roster, now = new Date()) {
  if (!featureFlags(profile).missions || !completed(profile, MISSION_UNLOCK_CHAPTER)) return { unlocked: false, current: [], claimable: [] };
  const keys = missionPeriodKeys(localDayKey(now));
  const periods = profile.missions?.periods ?? {};
  function view(key, period) {
    const mission = MISSIONS[periodKind(key)];
    return {
      key, kind: mission.kind, target: mission.target, ...structuredClone(period),
      candidates: period.state === 'earned' ? missionCandidates(profile, period, mission, roster) : []
    };
  }
  const current = Object.values(keys).map(key => view(key, periods[key] ?? emptyPeriod()));
  const claimable = Object.entries(periods).filter(([, period]) => period.state === 'earned').map(([key, period]) => view(key, period));
  return { unlocked: true, current, claimable };
}

export function creditMissions(profile, finishedRun) {
  if (finishedRun.daily || finishedRun.dungeonId === INTRO || finishedRun.phase !== 'done' || !finishedRun.result
    || !finishedRun.endDayKey || profile.records.appliedRuns.includes(finishedRun.id)
    || !hasFeature(finishedRun, 'missions') || !completed(profile, MISSION_UNLOCK_CHAPTER)) return profile;
  const keys = missionPeriodKeys(finishedRun.endDayKey);
  const roster = runRoster(finishedRun);
  if (!keys || !roster) return profile;
  const next = { ...profile, missions: structuredClone(profile.missions ?? { periods: {} }) };
  const { periods } = next.missions;
  const contributions = {
    weekly: finishedRun.stats.gateWins > 0,
    monthly: finishedRun.result === 'win' && REGIONS.includes(finishedRun.dungeonId)
  };
  for (const [kind, key] of Object.entries(keys)) {
    if (!contributions[kind]) continue;
    const period = (periods[key] ||= emptyPeriod());
    if (period.state !== 'tracking') continue;
    if (kind === 'weekly') period.gates++;
    else period.regionIds = union(period.regionIds, [finishedRun.dungeonId]);
    const mission = MISSIONS[kind];
    const progress = kind === 'weekly' ? period.gates : period.regionIds.length;
    if (progress < mission.target) continue;
    const pool = union([], next.unlockedDungeons.flatMap(id => expeditionPool(roster, id).baseIds));
    const seed = (finishedRun.seed ^ Number(finishedRun.endDayKey.replaceAll('-', '')) ^ mission.salt) >>> 0;
    period.offerOrder = shuffle({ state: seed }, pool.filter(id => !Object.hasOwn(next.recruits, id)));
    period.state = period.offerOrder.length ? 'earned' : 'claimed';
  }
  return next;
}

function addRecruit(profile, id) {
  profile.recruits[id] = { bond: 0, since: profile.records.runs };
  profile.lead ||= id;
  if (profile.reserved === id) profile.reserved = null;
}

function updateLongestServing(profile) {
  const longest = Object.entries(profile.recruits).sort(([, a], [, b]) => b.bond - a.bond || a.since - b.since)[0];
  profile.records.longestServing = longest ? { id: longest[0], ...longest[1] } : null;
}

export function claimMission(profile, periodKey, companionId, roster) {
  if (!featureFlags(profile).missions) return reject(profile, 'mission_not_claimable');
  const period = Object.hasOwn(profile.missions?.periods ?? {}, periodKey) && profile.missions.periods[periodKey];
  const kind = typeof periodKey === 'string' && periodKind(periodKey);
  if (period?.state !== 'earned' || !kind) return reject(profile, 'mission_not_claimable');
  const candidates = missionCandidates(profile, period, MISSIONS[kind], roster);
  if (candidates.length ? !candidates.includes(companionId) : companionId !== null) {
    return reject(profile, 'invalid_mission_companion');
  }
  const next = structuredClone(profile);
  const claimed = next.missions.periods[periodKey];
  claimed.state = 'claimed';
  claimed.claimedId = companionId;
  if (companionId !== null) {
    addRecruit(next, companionId);
    next.seenCharacters = union(next.seenCharacters, [companionId]);
    updateLongestServing(next);
  }
  completeOwnedOffers(next);
  return { profile: next, announce: { ok: true, periodKey, recruits: companionId === null ? [] : [companionId] } };
}

export function applyRunEnd(profile, run, { recruits = [], shard = null } = {}) {
  const noStamp = { stamp: null };
  if (run.daily) return reject(profile, 'daily_run', noStamp);
  if (run.phase !== 'done' || !run.result) return reject(profile, 'run_not_done', noStamp);
  if (profile.records.appliedRuns.includes(run.id)) return reject(profile, 'already_applied', noStamp);
  const rewards = runRewards(run);
  if (!Array.isArray(recruits) || recruits.length > rewards.recruitLimit || new Set(recruits).size !== recruits.length
    || recruits.some(id => !rewards.recruitable.includes(id) || Object.hasOwn(profile.recruits, id))) {
    return reject(profile, 'invalid_recruits', noStamp);
  }
  if (shard !== null && (!rewards.shardCandidates.includes(shard) || Object.hasOwn(profile.recruits, shard))) {
    return reject(profile, 'invalid_shard', noStamp);
  }
  finishRun(run);
  let { profile: next } = recordRunProgress(profile, run);
  next.missions ??= { periods: {} };
  const { dungeonId, difficulty } = run;
  const records = next.records;
  records.runs++;
  if (run.stats.bestHit?.amount > (records.bestHit?.amount || 0)) records.bestHit = { ...run.stats.bestHit, dungeonId, difficulty };
  next.seenCharacters = union(next.seenCharacters, run.seenCharacters);
  if (run.profileShard && run.profileShard === next.reserved) next.reserved = null;
  if (shard) next.reserved = shard;
  const bonds = [];
  let stamp = null;
  if (run.result === 'win') {
    const clears = (records.clears[dungeonId] ||= { easy: 0, normal: 0, nightmare: 0 });
    clears.easy ??= 0;
    clears[difficulty] = (clears[difficulty] ?? 0) + 1;
    for (const id of run.eligible) {
      if (run.bench.includes(id) && !run.fallen.includes(id) && Object.hasOwn(next.recruits, id)) {
        next.recruits[id].bond++;
        bonds.push({ id, bond: next.recruits[id].bond });
      }
    }
    for (const id of recruits) addRecruit(next, id);
    if (dungeonId === INTRO) addChapter(next, 1);
    else {
      const contractId = run.contract?.id;
      if (difficulty === 'nightmare' && run.contract?.met && Object.hasOwn(CONTRACTS, contractId)) {
        const stamps = ((next.contractStamps ||= {})[dungeonId] ||= {});
        if (!Object.hasOwn(stamps, contractId)) {
          stamps[contractId] = run.id;
          stamp = { dungeonId, contractId };
        }
      }
      addChapter(next, 4);
      if (difficulty === 'normal') next.nightmareUnlocks = union(next.nightmareUnlocks, [dungeonId]);
      if (next.notebook.firstLead && run.lead && run.lead !== next.notebook.firstLead && run.gateSurvivors.includes(run.lead)
        && run.bench.includes(run.lead) && Object.hasOwn(profile.recruits, run.lead)) addChapter(next, 5);
      if (dungeonId === TOWER) addChapter(next, 7);
    }
    unlockDungeons(next);
  }
  next = creditMissions(next, run);
  records.appliedRuns.push(run.id);
  completeOwnedOffers(next);
  updateLongestServing(next);
  const missions = Object.keys(next.missions.periods).filter(key => next.missions.periods[key].state === 'earned'
    && profile.missions?.periods[key]?.state !== 'earned');
  const returned = run.participated.filter(id => run.bench.includes(id) && !run.fallen.includes(id));
  return {
    profile: next,
    announce: {
      ok: true, recruits: recruits.slice(), bonds, shard, returned, stamp, missions,
      chapters: next.notebook.chapters.filter(id => !completed(profile, id)),
      dungeons: next.unlockedDungeons.filter(id => !profile.unlockedDungeons.includes(id)),
      nightmares: next.nightmareUnlocks.filter(id => !profile.nightmareUnlocks.includes(id))
    }
  };
}
