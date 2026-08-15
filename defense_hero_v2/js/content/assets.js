import { deepFreeze } from './combat.js';

export const DIRECTIONS = deepFreeze(['front', 'back', 'left', 'right']);

export const HERO_IDS = deepFreeze([
  'rumi',
  'luna',
  'cinderella',
  'zeke',
  'snow_rabbit',
  'avalanche_maid',
  'night_rabbit',
  'guardian',
  'storm_sage',
  'lightning_sage',
]);

export const BOSS_IDS = deepFreeze(['flora', 'pharaoh', 'reaper', 'demon_god']);

const DIRECTION_COLUMN = deepFreeze({
  front: 0,
  back: 1,
  left: 2,
  right: 3,
});

export const SOURCE_ATLASES = deepFreeze({
  heroes_main: {
    id: 'heroes_main',
    path: './assets/source-atlases/heroes-main.webp',
    sourcePath: './assets/source-atlases/heroes-main-source.png',
    width: 1254,
    height: 1254,
    columns: 4,
    rows: 4,
    rowByEntityId: {
      rumi: 0,
      luna: 1,
      cinderella: 2,
      zeke: 3,
    },
    hasAlpha: false,
    transparencyRequired: true,
    transparencyStatus: 'runtime-connected-background-removal',
  },
  heroes_companions_a: {
    id: 'heroes_companions_a',
    path: './assets/source-atlases/heroes-companions-a.webp',
    sourcePath: './assets/source-atlases/heroes-companions-a-source.png',
    width: 1254,
    height: 1254,
    columns: 4,
    rows: 4,
    rowByEntityId: {
      snow_rabbit: 0,
      avalanche_maid: 1,
      night_rabbit: 2,
      guardian: 3,
    },
    hasAlpha: false,
    transparencyRequired: true,
    transparencyStatus: 'runtime-connected-background-removal',
  },
  heroes_companions_b: {
    id: 'heroes_companions_b',
    path: './assets/source-atlases/heroes-companions-b.webp',
    sourcePath: './assets/source-atlases/heroes-companions-b-source.png',
    width: 1774,
    height: 887,
    columns: 4,
    rows: 2,
    rowByEntityId: {
      storm_sage: 0,
      lightning_sage: 1,
    },
    hasAlpha: false,
    transparencyRequired: true,
    transparencyStatus: 'runtime-connected-background-removal',
  },
  bosses: {
    id: 'bosses',
    path: './assets/source-atlases/bosses.webp',
    sourcePath: './assets/source-atlases/bosses-source.png',
    width: 1254,
    height: 1254,
    columns: 4,
    rows: 4,
    rowByEntityId: {
      flora: 0,
      pharaoh: 1,
      reaper: 2,
      demon_god: 3,
    },
    hasAlpha: false,
    transparencyRequired: true,
    transparencyStatus: 'runtime-connected-background-removal',
  },
});

const HERO_ATLAS_BY_ID = Object.fromEntries(
  Object.values(SOURCE_ATLASES)
    .filter((atlas) => atlas.id !== 'bosses')
    .flatMap((atlas) => Object.keys(atlas.rowByEntityId).map((heroId) => [heroId, atlas])),
);

function normalizedFrame(atlas, row, column) {
  return {
    unit: 'normalized',
    x: column / atlas.columns,
    y: row / atlas.rows,
    width: 1 / atlas.columns,
    height: 1 / atlas.rows,
  };
}

function completeFileFrame() {
  return {
    unit: 'normalized',
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  };
}

function atlasMetadata(atlas, entityId, direction) {
  const row = atlas.rowByEntityId[entityId];
  const column = DIRECTION_COLUMN[direction];
  return {
    id: atlas.id,
    sourcePath: atlas.path,
    sourceWidth: atlas.width,
    sourceHeight: atlas.height,
    columns: atlas.columns,
    rows: atlas.rows,
    row,
    column,
    sourceFrame: normalizedFrame(atlas, row, column),
  };
}

function commonImageMetadata(atlas) {
  return {
    type: 'image',
    optional: true,
    fallbackAllowed: true,
    fallbackAllowedIn: ['development'],
    fallbackMode: 'development-only',
    releaseRequired: true,
    releaseFallbackAllowed: false,
    transparencyRequired: true,
    hasAlpha: atlas.hasAlpha,
    transparencyStatus: atlas.transparencyStatus,
    backgroundStatus: atlas.hasAlpha ? 'transparent' : 'opaque-checkerboard-from-generation',
  };
}

function portraitEntry(heroId) {
  const atlas = HERO_ATLAS_BY_ID[heroId];
  const direction = 'front';
  const row = atlas.rowByEntityId[heroId];
  return {
    id: `portrait/${heroId}`,
    path: `./assets/characters/portraits/${heroId}.webp`,
    preloadGroup: ['menu', 'formation'],
    entityKind: 'hero',
    entityId: heroId,
    direction,
    frame: completeFileFrame(),
    atlas: atlasMetadata(atlas, heroId, direction),
    pivotX: 0.5,
    pivotY: 0.5,
    ...commonImageMetadata(atlas),
  };
}

function directionalEntry(kind, entityId, direction, atlas) {
  const contractRoot = kind === 'boss'
    ? `./assets/bosses/${entityId}`
    : `./assets/characters/battle/${entityId}`;
  const logicalRoot = kind === 'boss' ? 'boss' : 'battle';
  const row = atlas.rowByEntityId[entityId];
  return {
    id: `${logicalRoot}/${entityId}/${direction}`,
    path: `${contractRoot}/${direction}.webp`,
    preloadGroup: 'battle',
    entityKind: kind,
    entityId,
    direction,
    frame: completeFileFrame(),
    atlas: atlasMetadata(atlas, entityId, direction),
    pivotX: 0.5,
    pivotY: 0.88,
    ...commonImageMetadata(atlas),
  };
}

const portraits = HERO_IDS.map(portraitEntry);
const heroBattleSprites = HERO_IDS.flatMap((heroId) => DIRECTIONS.map((direction) => (
  directionalEntry('hero', heroId, direction, HERO_ATLAS_BY_ID[heroId])
)));
const bossBattleSprites = BOSS_IDS.flatMap((bossId) => DIRECTIONS.map((direction) => (
  directionalEntry('boss', bossId, direction, SOURCE_ATLASES.bosses)
)));

export const ASSET_MANIFEST = deepFreeze([
  ...portraits,
  ...heroBattleSprites,
  ...bossBattleSprites,
]);

export const ASSET_MANIFEST_BY_ID = deepFreeze(Object.fromEntries(
  ASSET_MANIFEST.map((entry) => [entry.id, entry]),
));

export default ASSET_MANIFEST;
