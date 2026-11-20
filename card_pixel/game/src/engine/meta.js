import { CONTRACTS } from '../content/contracts.js';
import { DUNGEONS } from '../content/dungeons.js';
import { NOTEBOOK } from '../content/notebook.js';
import { gradeOf } from './roster.js';
import { runRewards } from './run.js';

export const PROFILE_VERSION = 1;
const INTRO = 'dawn_forest';
const TOWER = 'creation_tower';
const EARLY = ['ember_volcano', 'twilight_cathedral'];
const REGIONS = Object.keys(DUNGEONS).filter(id => id !== INTRO && id !== TOWER);
const completed = (profile, chapter) => profile.notebook.chapters.includes(chapter);
const cleared = (profile, dungeon) => !!(profile.records.clears[dungeon]?.normal || profile.records.clears[dungeon]?.nightmare);
const union = (left, right) => [...new Set([...left, ...right])];

export function createProfile() {
  return {
    version: PROFILE_VERSION,
    recruits: {}, lead: null, companions: [], preferredCompanion: null, reserved: null, seals: {},
    notebook: { chapters: [], firstLead: null },
    unlockedDungeons: [INTRO], nightmareUnlocks: [], contractStamps: {},
    records: { runs: 0, clears: {}, bestHit: null, longestServing: null, appliedRuns: [] },
    seenCharacters: [], seenRelics: []
  };
}

export function availableDungeons(profile) {
  return Object.values(DUNGEONS).filter(dungeon => profile.unlockedDungeons.includes(dungeon.id))
    .map(({ id, name, floors, background }) => ({
      id, name, floors, background, difficulties: profile.nightmareUnlocks.includes(id) ? ['normal', 'nightmare'] : ['normal']
    }));
}

export function contractsFor(profile, dungeonId) {
  const earned = profile.contractStamps?.[dungeonId];
  const stamps = Object.fromEntries(Object.keys(CONTRACTS).map(id => [id, earned?.[id] ?? null]));
  return { unlocked: profile.nightmareUnlocks.includes(dungeonId), stamps };
}

export function notebookView(profile) {
  return NOTEBOOK.map(chapter => ({ ...chapter, opens: chapter.opens.slice(), completed: completed(profile, chapter.id) }));
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
  const lead = completed(profile, 1) && recruited.includes(profile.lead) ? profile.lead : null;
  const slots = companionSlots(profile);
  const seals = (profile.seals[dungeonId] || []).slice();
  const companions = profile.companions.filter(id => recruited.includes(id) && id !== lead && !seals.includes(id)).slice(0, slots);
  const actualLead = seals.includes(lead) ? null : lead;
  return {
    dungeonId, lead: actualLead, leadCandidates: completed(profile, 1) ? recruited.slice() : [],
    companionSlots: slots, companionCandidates: recruited.filter(id => id !== lead && !seals.includes(id)), companions,
    preferredCompanion: actualLead && profile.recruits[actualLead].bond >= 1 && companions.includes(profile.preferredCompanion)
      ? profile.preferredCompanion : null,
    seals, sealSlots: sealSlots(profile, dungeonId), reserved: profile.reserved, introCleared: cleared(profile, INTRO),
    bossOrder: !Object.keys(DUNGEONS).some(id => id !== INTRO && cleared(profile, id)),
    recruited, runNumber: profile.records.runs + 1,
    unlockedDungeons: profile.unlockedDungeons.slice(), nightmareUnlocks: profile.nightmareUnlocks.slice()
  };
}

const reject = (profile, reason, extra) => ({ profile, announce: { ok: false, reason, ...extra } });

export function setExpeditionParty(profile, { lead = null, companions = [], preferredCompanion = null } = {}) {
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
  if (!profile.unlockedDungeons.includes(dungeonId) || !Array.isArray(ids)
    || ids.length > sealSlots(profile, dungeonId) || new Set(ids).size !== ids.length) return reject(profile, 'invalid_seals');
  const pool = roster.pool(DUNGEONS[dungeonId].pool);
  if (ids.some(id => !pool.includes(id))) return reject(profile, 'invalid_seals');
  const remaining = pool.filter(id => !ids.includes(id)).map(id => gradeOf(roster.card(id).grade));
  if (pool.some(id => !remaining.includes(gradeOf(roster.card(id).grade)))) return reject(profile, 'empty_grade');
  return { profile: { ...profile, seals: { ...profile.seals, [dungeonId]: ids.slice() } }, announce: { ok: true } };
}

function addChapter(profile, chapter) {
  profile.notebook.chapters = union(profile.notebook.chapters, [chapter]).sort((a, b) => a - b);
}

export function recordRunProgress(profile, run) {
  const next = structuredClone(profile);
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
  const regionalClears = REGIONS.filter(id => cleared(profile, id)).length;
  const unlocked = {
    initial: true, intro_clear: cleared(profile, INTRO),
    early_region_clear: EARLY.some(id => cleared(profile, id)),
    region_clear_count: regionalClears
  };
  for (const { id, unlock } of Object.values(DUNGEONS)) {
    if (unlock.count ? unlocked[unlock.kind] >= unlock.count : unlocked[unlock.kind]) {
      profile.unlockedDungeons = union(profile.unlockedDungeons, [id]);
    }
  }
  if (regionalClears >= DUNGEONS[TOWER].unlock.count) addChapter(profile, 6);
}

export function applyRunEnd(profile, run, { recruits = [], shard = null } = {}) {
  const noStamp = { stamp: null };
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
  const { profile: next } = recordRunProgress(profile, run);
  const { dungeonId, difficulty } = run;
  const records = next.records;
  records.runs++;
  records.appliedRuns.push(run.id);
  if (run.stats.bestHit?.amount > (records.bestHit?.amount || 0)) records.bestHit = { ...run.stats.bestHit, dungeonId, difficulty };
  next.seenCharacters = union(next.seenCharacters, run.seenCharacters);
  if (run.profileShard && run.profileShard === next.reserved) next.reserved = null;
  if (shard) next.reserved = shard;
  const bonds = [];
  let stamp = null;
  if (run.result === 'win') {
    const clears = (records.clears[dungeonId] ||= { normal: 0, nightmare: 0 });
    clears[difficulty]++;
    for (const id of run.eligible) {
      if (run.bench.includes(id) && !run.fallen.includes(id) && Object.hasOwn(next.recruits, id)) {
        next.recruits[id].bond++;
        bonds.push({ id, bond: next.recruits[id].bond });
      }
    }
    for (const id of recruits) next.recruits[id] = { bond: 0, since: records.runs };
    if (!next.lead && recruits.length) next.lead = recruits[0];
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
      next.nightmareUnlocks = union(next.nightmareUnlocks, [dungeonId]);
      if (next.notebook.firstLead && run.lead && run.lead !== next.notebook.firstLead && run.gateSurvivors.includes(run.lead)
        && run.bench.includes(run.lead) && Object.hasOwn(profile.recruits, run.lead)) addChapter(next, 5);
      if (dungeonId === TOWER) addChapter(next, 7);
    }
    unlockDungeons(next);
  }
  const longest = Object.entries(next.recruits).sort(([, a], [, b]) => b.bond - a.bond || a.since - b.since)[0];
  records.longestServing = longest ? { id: longest[0], ...longest[1] } : null;
  const returned = run.participated.filter(id => run.bench.includes(id) && !run.fallen.includes(id));
  return {
    profile: next,
    announce: {
      ok: true, recruits: recruits.slice(), bonds, shard, returned, stamp,
      chapters: next.notebook.chapters.filter(id => !completed(profile, id)),
      dungeons: next.unlockedDungeons.filter(id => !profile.unlockedDungeons.includes(id)),
      nightmares: next.nightmareUnlocks.filter(id => !profile.nightmareUnlocks.includes(id))
    }
  };
}
