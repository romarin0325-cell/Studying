import * as Data from "../data/content.js";

const ELEMENTS = Data.ELEMENTS ?? Data.ELEMENT_DEFINITIONS ?? Data.HERO_DEFENSE_CONTENT?.elements ?? [];
const CHARACTERS = Data.CHARACTERS ?? Data.CHARACTER_DEFINITIONS ?? Data.HERO_DEFENSE_CONTENT?.characters ?? [];
const ENEMIES = Data.ENEMIES ?? Data.ENEMY_TYPE_DEFINITIONS ?? Data.HERO_DEFENSE_CONTENT?.enemies ?? [];
const BOSSES = Data.BOSSES ?? Data.BOSS_DEFINITIONS ?? Data.HERO_DEFENSE_CONTENT?.bosses ?? [];
const WAVE_PACKAGES = Data.WAVE_PACKAGES ?? Data.WAVE_PACKAGE_DEFINITIONS ?? Data.HERO_DEFENSE_CONTENT?.wavePackages ?? [];
const MAP_LAYOUTS = Data.MAP_LAYOUTS ?? Data.MAP_LAYOUT_DEFINITIONS ?? Data.HERO_DEFENSE_CONTENT?.maps ?? [];
const STATUSES = Data.STATUSES ?? Data.STATUS_DEFINITIONS ?? Data.HERO_DEFENSE_CONTENT?.statuses ?? [];
const FIELD_BUFFS = Data.FIELD_BUFFS ?? Data.FIELD_BUFF_DEFINITIONS ?? Data.HERO_DEFENSE_CONTENT?.fieldBuffs ?? [];
const STAGES = Data.STAGES ?? Data.STAGE_DEFINITIONS ?? Data.HERO_DEFENSE_CONTENT?.stages ?? [];

export function asArray(collection) {
  if (Array.isArray(collection)) return collection.filter(Boolean);
  if (!collection || typeof collection !== "object") return [];
  return Object.entries(collection).map(([id, value]) =>
    value && typeof value === "object" ? { id, ...value } : { id, value },
  );
}

export function asMap(collection) {
  return new Map(asArray(collection).map((entry) => [entry.id, entry]));
}

export const CONTENT = Object.freeze({
  elements: asArray(ELEMENTS),
  characters: asArray(CHARACTERS),
  enemies: asArray(ENEMIES),
  bosses: asArray(BOSSES),
  wavePackages: asArray(WAVE_PACKAGES),
  mapLayouts: asArray(MAP_LAYOUTS),
  statuses: asArray(STATUSES),
  fieldBuffs: asArray(FIELD_BUFFS),
  stages: asArray(STAGES),
});

export const CONTENT_MAPS = Object.freeze({
  elements: asMap(ELEMENTS),
  characters: asMap(CHARACTERS),
  enemies: asMap(ENEMIES),
  bosses: asMap(BOSSES),
  wavePackages: asMap(WAVE_PACKAGES),
  mapLayouts: asMap(MAP_LAYOUTS),
  statuses: asMap(STATUSES),
  fieldBuffs: asMap(FIELD_BUFFS),
  stages: asMap(STAGES),
});

export function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

export function numberFrom(source, keys, fallback = 0) {
  for (const key of keys) {
    const value = key.split(".").reduce((cursor, part) => cursor?.[part], source);
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return fallback;
}

export function tagsFrom(source) {
  const tags = firstDefined(source?.tags, source?.attackTags, source?.roleTags, []);
  return Array.isArray(tags) ? [...tags] : typeof tags === "string" ? tags.split(/[ ,|/]+/).filter(Boolean) : [];
}

export function normalizeCell(cell) {
  if (Array.isArray(cell)) return { col: Number(cell[0]) || 0, row: Number(cell[1]) || 0 };
  return {
    col: Number(firstDefined(cell?.col, cell?.x, 0)) || 0,
    row: Number(firstDefined(cell?.row, cell?.y, 0)) || 0,
  };
}

export function normalizeEffects(effects) {
  if (!effects) return [];
  if (!Array.isArray(effects)) return typeof effects === "object" ? [effects] : [];
  return effects.flatMap((effect) => (Array.isArray(effect) ? normalizeEffects(effect) : effect ? [effect] : []));
}
