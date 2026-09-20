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
  'red_dragon', 'flame_sage', 'mushroom_king', 'great_detective', 'siren', 'phantom',
]);

export const BOSS_IDS = deepFreeze(['flora', 'pharaoh', 'reaper', 'demon_god']);

const DIRECTION_COLUMN = deepFreeze({
  front: 0,
  back: 1,
  left: 2,
  right: 3,
});

function poseAtlas(id, name, ids) {
  return { id, path: './assets/moonlit/' + name + '.webp', sourcePath: './assets/moonlit/' + name + '.webp',
    width: 1024, height: ids.length * 512, columns: 2, rows: ids.length,
    rowByEntityId: Object.fromEntries(ids.map((hero, row) => [hero, row])),
    hasAlpha: true, transparencyRequired: true, transparencyStatus: 'prepared-alpha' };
}
export const SOURCE_ATLASES = deepFreeze({
  heroes_main: poseAtlas('heroes_main','heroes',['rumi','luna','cinderella','zeke']),
  heroes_companions: poseAtlas('heroes_companions','companions',['snow_rabbit','avalanche_maid','night_rabbit','guardian','storm_sage','lightning_sage']),
  companions_ember: poseAtlas('companions_ember','companions-ember',['red_dragon','flame_sage','mushroom_king']),
  companions_tide: poseAtlas('companions_tide','companions-tide',['great_detective','siren','phantom']),
  bosses: {
    id:'bosses', path:'./assets/source-atlases/bosses.webp', sourcePath:'./assets/source-atlases/bosses-source.png',
    width:1254,height:1254,columns:4,rows:4,rowByEntityId:{flora:0,pharaoh:1,reaper:2,demon_god:3},
    hasAlpha:false,transparencyRequired:true,transparencyStatus:'opaque-generation-source',
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
  const column = atlas.id === 'bosses' ? DIRECTION_COLUMN[direction] : 0;
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
    fallbackAllowedIn: ['development', 'release'],
    fallbackMode: 'always',
    releaseRequired: true,
    releaseFallbackAllowed: true,
    transparencyRequired: true,
    hasAlpha: true,
    transparencyStatus: 'prepared-alpha',
    backgroundStatus: 'transparent',
    sourceBackgroundStatus: atlas.id === 'bosses' ? 'opaque-checkerboard-from-generation' : 'reserved-magenta',
  };
}

function portraitEntry(heroId) {
  const atlas = HERO_ATLAS_BY_ID[heroId];
  const direction = 'front';
  const row = atlas.rowByEntityId[heroId];
  return {
    id: `portrait/${heroId}`,
    path: `./assets/characters/portraits/${heroId}.webp`,
    preloadGroup: 'fallback',
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
  ...['heroes', 'companions', 'companions-ember', 'companions-tide', 'combat-fx', 'creatures', 'worlds'].map((id) => ({
    id: `illustration/${id}`, type: 'image', path: `./assets/moonlit/${id}.webp`,
    preloadGroup: id === 'worlds' ? ['menu','battle'] : ['creatures','combat-fx'].includes(id) ? 'battle' : ['formation','battle'], releaseRequired: true,
    hasAlpha: !['worlds','combat-fx'].includes(id), sourceBackgroundStatus: id === 'worlds' ? 'painted-scene' : id === 'combat-fx' ? 'screen-black' : id === 'creatures' ? 'generated-white' : 'reserved-magenta',
    pivotX: .5, pivotY: .5,
    backgroundStatus: id === 'worlds' ? 'painted-scene' : id === 'combat-fx' ? 'screen-black' : 'transparent',
  })),
  ...portraits,
  ...heroBattleSprites,
  ...bossBattleSprites,
]);

export const ASSET_MANIFEST_BY_ID = deepFreeze(Object.fromEntries(
  ASSET_MANIFEST.map((entry) => [entry.id, entry]),
));

export default ASSET_MANIFEST;
