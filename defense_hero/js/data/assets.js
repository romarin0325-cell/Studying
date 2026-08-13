const createImageAsset = ({ id, path, pivotX, pivotY, preloadGroup }) => Object.freeze({
  id,
  type: "image",
  path,
  pivotX,
  pivotY,
  preloadGroup: Object.freeze(Array.isArray(preloadGroup) ? [...preloadGroup] : [preloadGroup]),
  optional: true,
  fallbackAllowed: true,
});

const CHARACTER_IDS = Object.freeze([
  "rumi",
  "zeke",
  "luna",
  "cinderella",
  "guardian",
  "silver_rabbit",
  "snow_rabbit",
  "gray",
  "gold_dragon",
  "time_magician",
]);

const ENEMY_IDS = Object.freeze([
  "normal",
  "rush",
  "swarm",
  "armored",
  "magic",
  "aerial",
  "split",
  "cleanse",
  "support",
]);

const CHARACTER_ASSETS = CHARACTER_IDS.flatMap((characterId) => [
  createImageAsset({
    id: `portrait/${characterId}`,
    path: `./assets/characters/portraits/${characterId}.webp`,
    pivotX: 0.5,
    pivotY: 0.5,
    preloadGroup: ["menu", "compendium"],
  }),
  createImageAsset({
    id: `battle/${characterId}`,
    path: `./assets/characters/battle/${characterId}.webp`,
    pivotX: 0.5,
    pivotY: 0.88,
    preloadGroup: "battle",
  }),
]);

const ENEMY_ASSETS = ENEMY_IDS.map((enemyId) => createImageAsset({
  id: `enemy/${enemyId}`,
  path: `./assets/enemies/${enemyId}.webp`,
  pivotX: 0.5,
  pivotY: 0.78,
  preloadGroup: "battle",
}));

const BOSS_ASSETS = [
  createImageAsset({
    id: "boss/artificial_demon",
    path: "./assets/bosses/artificial_demon.webp",
    pivotX: 0.5,
    pivotY: 0.82,
    preloadGroup: "battle",
  }),
  createImageAsset({
    id: "boss/iris_curse",
    path: "./assets/bosses/iris_curse.webp",
    pivotX: 0.5,
    pivotY: 0.82,
    preloadGroup: "battle",
  }),
];

/**
 * Logical media contract for the prototype roster. The referenced files are
 * intentionally optional until final art lands; Canvas tokens remain the
 * authoritative fallback when a URL cannot be loaded.
 */
export const ASSET_MANIFEST = Object.freeze([
  ...CHARACTER_ASSETS,
  ...ENEMY_ASSETS,
  ...BOSS_ASSETS,
]);

export const ASSET_MANIFEST_BY_ID = Object.freeze(
  Object.fromEntries(ASSET_MANIFEST.map((entry) => [entry.id, entry])),
);
