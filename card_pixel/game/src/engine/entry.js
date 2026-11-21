import { DUNGEONS } from '../content/dungeons.js';

const ADVANCED = [
  'difficultyChoice', 'regionRules', 'riskDoors', 'quirks', 'affixes', 'battleBlessing',
  'bets', 'altar', 'pricedEvents', 'springPick', 'fullReinforcement', 'prepEditing', 'missions', 'dailyRift'
];
const ALWAYS = [
  'enemyIntent', 'retreat', 'heirlooms', 'lastStand', 'gate', 'boss', 'bossLessons', 'treasure',
  'relics', 'springDraw', 'reinforcement'
];

export const hasCleared = (profile, dungeon) => {
  const clear = profile.records.clears[dungeon];
  return !!(clear?.easy || clear?.normal || clear?.nightmare);
};

export function entryState(legacy = false) {
  return { v: 1, legacy, done: [], tours: [], skipped: false };
}

export function featureFlags(profile) {
  const legacy = profile.ui?.entry?.legacy ?? true;
  const introCleared = legacy || hasCleared(profile, 'dawn_forest');
  const firstMainCleared = legacy || Object.keys(DUNGEONS).some(id => id !== 'dawn_forest' && hasCleared(profile, id));
  return {
    introCleared, firstMainCleared, introSpring: legacy,
    ...Object.fromEntries(ALWAYS.map(key => [key, true])),
    ...Object.fromEntries(ADVANCED.map(key => [key, firstMainCleared]))
  };
}

export const openFeatures = Object.freeze(featureFlags({}));

export function hasFeature(run, key) {
  return run.features?.[key] ?? true;
}

function mark(profile, key, id) {
  const entry = profile.ui?.entry ?? entryState(true);
  if (typeof id !== 'string' || !id.trim() || entry[key].includes(id)) return profile;
  return { ...profile, ui: { ...profile.ui, entry: { ...entry, [key]: [...entry[key], id] } } };
}

export const markEntryStep = (profile, stepId) => mark(profile, 'done', stepId);
export const markTour = (profile, tourId) => mark(profile, 'tours', tourId);

export function skipTutorial(profile) {
  const entry = profile.ui?.entry ?? entryState(true);
  return entry.skipped ? profile : { ...profile, ui: { ...profile.ui, entry: { ...entry, skipped: true } } };
}
