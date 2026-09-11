function clonePublic(value) {
  if (!value || typeof value !== "object") return value;
  if (typeof value.toJSON === "function") return value.toJSON();
  if (Array.isArray(value)) return value.map(clonePublic);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !key.startsWith("_"))
      .map(([key, entry]) => [key, clonePublic(entry)]),
  );
}

export const ENTITY_POOL_CAPS = Object.freeze({
  projectiles: 160,
  areaEffects: 64,
  particles: 250,
  damagePopups: 40,
});

export const ENTITY_ACTIVE_CAPS = Object.freeze({
  enemies: 45,
  projectiles: 160,
  areaEffects: 64,
  particles: 250,
  damagePopups: 40,
});

const ENTITY_PREFIXES = Object.freeze({
  allies: 'ally',
  enemies: 'enemy',
  projectiles: 'projectile',
  areaEffects: 'area',
  particles: 'particle',
  damagePopups: 'popup',
});

export class EntityRegistry {
  constructor() {
    this.sequences = new Map();
    this.allies = new Map();
    this.enemies = new Map();
    this.projectiles = new Map();
    this.areaEffects = new Map();
    this.particles = new Map();
    this.damagePopups = new Map();
    this.pools = {
      projectiles: [],
      areaEffects: [],
      particles: [],
      damagePopups: [],
    };
  }

  nextId(type) {
    const sequence = (this.sequences.get(type) ?? 0) + 1;
    this.sequences.set(type, sequence);
    return `${type}_${String(sequence).padStart(4, "0")}`;
  }

  add(type, entity) {
    const collection = this[type];
    if (!(collection instanceof Map)) throw new Error(`Unknown entity collection: ${type}`);
    if (collection.size >= (ENTITY_ACTIVE_CAPS[type] ?? Number.POSITIVE_INFINITY)) {
      throw new RangeError(`${type} active entity cap reached`);
    }
    const id = entity?.id ?? this.nextId(ENTITY_PREFIXES[type] ?? type);
    if (collection.has(id)) throw new Error(`Duplicate ${type} entity id: ${id}`);
    const pool = this.pools[type];
    const value = pool?.pop() ?? {};
    for (const key of Object.keys(value)) delete value[key];
    Object.assign(value, entity, { id });
    collection.set(id, value);
    return value;
  }

  remove(type, id) {
    const collection = this[type];
    if (!(collection instanceof Map)) return undefined;
    const entity = collection.get(id);
    collection.delete(id);
    const pool = this.pools[type];
    if (entity && pool && pool.length < (ENTITY_POOL_CAPS[type] ?? 0)) pool.push(entity);
    return entity;
  }

  get(id) {
    for (const collection of [this.allies, this.enemies, this.projectiles, this.areaEffects, this.particles, this.damagePopups]) {
      if (collection.has(id)) return collection.get(id);
    }
    return undefined;
  }

  activeEnemyCount() {
    let count = 0;
    for (const enemy of this.enemies.values()) if (!enemy.dead && !enemy.reachedCore) count += 1;
    return count;
  }

  clear() {
    this.allies.clear();
    this.enemies.clear();
    this.projectiles.clear();
    this.areaEffects.clear();
    this.particles.clear();
    this.damagePopups.clear();
    this.sequences.clear();
    this.pools.projectiles.length = 0;
    this.pools.areaEffects.length = 0;
    this.pools.particles.length = 0;
    this.pools.damagePopups.length = 0;
  }

  poolStats() {
    const projectiles = this.pools.projectiles.length;
    const areaEffects = this.pools.areaEffects.length;
    const particles = this.pools.particles.length;
    const damagePopups = this.pools.damagePopups.length;
    return {
      projectiles,
      areaEffects,
      particles,
      damagePopups,
      active: {
        projectiles: this.projectiles.size,
        areaEffects: this.areaEffects.size,
        particles: this.particles.size,
        damagePopups: this.damagePopups.size,
      },
      capacities: { ...ENTITY_POOL_CAPS },
      available: projectiles + areaEffects + particles + damagePopups,
    };
  }

  snapshot() {
    const convert = (collection) => [...collection.values()].map(clonePublic);
    return {
      allies: convert(this.allies),
      enemies: convert(this.enemies),
      projectiles: convert(this.projectiles),
      areaEffects: convert(this.areaEffects),
      particles: convert(this.particles),
      damagePopups: convert(this.damagePopups),
    };
  }
}

export default EntityRegistry;
