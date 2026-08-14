import { CONTENT_MAPS, firstDefined, numberFrom } from "./ContentAdapter.js";

const FALLBACK_ADVANTAGE = Object.freeze({
  water: "fire",
  fire: "nature",
  nature: "water",
  light: "dark",
  dark: "light",
});

const STATUS_DEFAULTS = Object.freeze({
  burn: { maxStacks: 5, duration: 6, debuff: true },
  corrosion: { maxStacks: 3, duration: 8, debuff: true },
  curse: { maxStacks: 1, duration: 8, debuff: true },
  darkness: { maxStacks: 1, duration: 6, debuff: true },
  slow: { maxStacks: 1, duration: 2, debuff: true },
  frost: { maxStacks: 100, duration: Infinity, debuff: true },
  frozen: { maxStacks: 1, duration: 1.5, debuff: true },
  frost_resist: { maxStacks: 1, duration: 3, debuff: false },
  stun: { maxStacks: 1, duration: 1, debuff: true },
  silence: { maxStacks: 1, duration: 3, debuff: true },
  divine: { maxStacks: 5, duration: 8, debuff: false },
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizedFraction(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.abs(number) > 1 ? number / 100 : number;
}

function statusDefinition(id) {
  const data = CONTENT_MAPS.statuses.get(id) ?? {};
  const fallback = STATUS_DEFAULTS[id] ?? { maxStacks: 1, duration: 5, debuff: true };
  return {
    id,
    maxStacks: Math.max(1, numberFrom(data, ["maxStacks", "stackMax", "max"], fallback.maxStacks)),
    duration: numberFrom(data, ["duration", "baseDuration"], fallback.duration),
    debuff: firstDefined(data.debuff, data.isDebuff, fallback.debuff) !== false,
  };
}

export function getElementMultiplier(attackerElement, defenderElement, enabled = true, advantageMultiplier = 1.2) {
  if (!enabled) return 1;
  const definition = CONTENT_MAPS.elements.get(attackerElement);
  const advantage = firstDefined(definition?.advantageAgainst, definition?.strongAgainst, FALLBACK_ADVANTAGE[attackerElement]);
  return advantage === defenderElement ? Math.max(1, Number(advantageMultiplier) || 1.2) : 1;
}

export function effectiveResistance(target, damageType) {
  if (damageType !== "physical" && damageType !== "magic") return 0;
  const base = damageType === "physical"
    ? numberFrom(target, ["physicalResist", "resistances.physical", "stats.physicalResist"], 0)
    : numberFrom(target, ["magicResist", "resistances.magic", "stats.magicResist"], 0);
  const statuses = target?.statuses;
  const stacks = (id) => {
    if (statuses instanceof StatusCollection) return statuses.stacks(id);
    const value = statuses?.[id];
    return Number(value?.stacks ?? value ?? 0) || 0;
  };
  let result = normalizedFraction(base);
  if (damageType === "physical") result -= stacks("corrosion") * (target?.corrosionReduction ?? 0.12);
  if (damageType === "magic") result -= stacks("curse") * 0.2;
  result -= stacks("darkness") * 0.08;
  return clamp(result, -0.25, 0.75);
}

export function resolveDamage({
  amount,
  damageType = "physical",
  attackerElement,
  target,
  critChance = 0,
  critMultiplier = 1.5,
  rng,
  forceCritical = false,
  elementRulesEnabled = true,
  advantageMultiplier = 1.2,
  resistanceIgnore = 0,
  criticalResistanceIgnore = 0,
} = {}) {
  const rawAmount = Math.max(0, Number(amount) || 0);
  const chance = clamp(normalizedFraction(critChance), 0, 0.8);
  const critical = forceCritical || (rng ? rng.next() < chance : false);
  const ignoredResistance = normalizedFraction(resistanceIgnore)
    + (critical ? normalizedFraction(criticalResistanceIgnore) : 0);
  const resistance = clamp(effectiveResistance(target, damageType) - ignoredResistance, -0.25, 0.75);
  const resisted = damageType === "true" ? rawAmount : rawAmount * (1 - resistance);
  const criticalMultiplier = critical ? Math.max(1, Number(critMultiplier) || 1.5) : 1;
  const elementMultiplier = getElementMultiplier(attackerElement, target?.element, elementRulesEnabled, advantageMultiplier);
  const finalAmount = rawAmount <= 0 ? 0 : Math.max(1, Math.round(resisted * criticalMultiplier * elementMultiplier));
  return {
    amount: finalAmount,
    rawAmount,
    damageType,
    critical,
    criticalMultiplier,
    resistance,
    elementMultiplier,
    advantageous: elementMultiplier > 1,
  };
}

export class StatusCollection {
  constructor(serialized) {
    this.entries = new Map();
    if (serialized && typeof serialized === "object") {
      Object.entries(serialized).forEach(([id, value]) => {
        if (value && typeof value === "object") this.entries.set(id, { id, ...value });
      });
    }
  }

  get(id) {
    return this.entries.get(id);
  }

  has(id) {
    return this.entries.has(id);
  }

  stacks(id) {
    return Number(this.entries.get(id)?.stacks) || 0;
  }

  apply(id, options = {}, target = {}) {
    const definition = statusDefinition(id);
    const previous = this.entries.get(id);
    const requested = Math.max(0, Number(firstDefined(options.stacks, options.value, 1)) || 0);
    const maxStacks = Math.max(1, Number(firstDefined(options.maxStacks, definition.maxStacks)) || definition.maxStacks);
    const duration = Math.max(0, Number(firstDefined(options.duration, definition.duration)) || 0);

    if (id === "frost") {
      if (this.has("frost_resist")) return { applied: false, reason: "frost_resist", id };
      const gauge = clamp((previous?.stacks ?? 0) + requested, 0, maxStacks);
      this.entries.set(id, {
        id,
        stacks: gauge,
        duration: Infinity,
        maxDuration: Infinity,
        decayDelay: 2,
        sourceId: options.sourceId ?? previous?.sourceId ?? null,
        debuff: true,
      });
      if (gauge >= maxStacks) {
        this.entries.delete(id);
        const frozenDuration = Number(firstDefined(options.freezeDuration, target.isBoss ? 0.4 : 1.5));
        this.apply("frozen", { duration: frozenDuration, sourceId: options.sourceId }, target);
        return { applied: true, triggered: "frozen", id, stacks: maxStacks };
      }
      return { applied: true, id, stacks: gauge };
    }

    let adjustedDuration = duration;
    if (id === "stun" && target.isBoss) adjustedDuration *= 0.3;
    if (id === "slow") {
      const cap = target.isBoss ? 0.25 : 0.5;
      const potency = clamp(Math.max(Number(previous?.potency) || 0, normalizedFraction(firstDefined(options.potency, options.value, 0.2))), 0, cap);
      this.entries.set(id, {
        id,
        stacks: 1,
        potency,
        duration: Math.max(previous?.duration ?? 0, adjustedDuration),
        maxDuration: Math.max(previous?.maxDuration ?? 0, adjustedDuration),
        sourceId: options.sourceId ?? previous?.sourceId ?? null,
        debuff: true,
      });
      return { applied: true, id, stacks: 1, potency };
    }

    const nextStacks = clamp((previous?.stacks ?? 0) + requested, 0, maxStacks);
    const next = {
      id,
      stacks: nextStacks,
      duration: Math.max(previous?.duration ?? 0, adjustedDuration),
      maxDuration: Math.max(previous?.maxDuration ?? 0, adjustedDuration),
      sourceId: options.sourceId ?? previous?.sourceId ?? null,
      debuff: definition.debuff,
      tickClock: previous?.tickClock ?? 1,
    };
    this.entries.set(id, next);
    return { applied: true, id, stacks: nextStacks };
  }

  consume(id, count = Infinity) {
    const entry = this.entries.get(id);
    if (!entry) return 0;
    const consumed = Math.min(entry.stacks, Math.max(0, Number(count) || 0));
    entry.stacks -= consumed;
    if (entry.stacks <= 0) this.entries.delete(id);
    return consumed;
  }

  remove(id) {
    return this.entries.delete(id);
  }

  removeOneDebuff() {
    const candidate = [...this.entries.values()]
      .filter((entry) => entry.debuff)
      .sort((left, right) => (left.duration ?? 0) - (right.duration ?? 0))[0];
    if (!candidate) return null;
    this.entries.delete(candidate.id);
    return candidate.id;
  }

  clearDebuffs() {
    const removed = [];
    for (const [id, entry] of this.entries) {
      if (entry.debuff) {
        removed.push(id);
        this.entries.delete(id);
      }
    }
    return removed;
  }

  update(dt, hooks = {}, target = {}) {
    const delta = Math.max(0, Number(dt) || 0);
    for (const [id, entry] of [...this.entries]) {
      if (id === "frost") {
        entry.decayDelay = Math.max(0, (entry.decayDelay ?? 0) - delta);
        if (entry.decayDelay <= 0) entry.stacks = Math.max(0, entry.stacks - 12 * delta);
        if (entry.stacks <= 0) this.entries.delete(id);
        continue;
      }
      if (id === "burn") {
        entry.tickClock = (entry.tickClock ?? 1) - delta;
        while (entry.tickClock <= 0 && this.entries.has(id)) {
          entry.tickClock += 1;
          hooks.onBurnTick?.(entry.stacks, entry, target);
        }
      }
      if (Number.isFinite(entry.duration)) {
        entry.duration -= delta;
        if (entry.duration <= 0) {
          this.entries.delete(id);
          if (id === "frozen") this.apply("frost_resist", { duration: 3 }, target);
          hooks.onExpire?.(id, entry, target);
        }
      }
    }
  }

  movementMultiplier() {
    if (this.has("frozen") || this.has("stun")) return 0;
    return 1 - (this.get("slow")?.potency ?? 0);
  }

  canAct() {
    return !this.has("frozen") && !this.has("stun");
  }

  toJSON() {
    return Object.fromEntries([...this.entries].map(([id, entry]) => [id, { ...entry }]));
  }
}

function normalizedBuffDefinition(id, options = {}) {
  const definition = CONTENT_MAPS.fieldBuffs.get(id) ?? {};
  return {
    id,
    duration: Math.max(0.01, Number(firstDefined(options.duration, definition.duration, 8)) || 8),
    effects: firstDefined(options.effects, definition.effects, definition.modifiers, []),
    sourceId: options.sourceId ?? null,
  };
}

export class FieldBuffSlots {
  constructor(maxSlots = 3, serialized) {
    this.maxSlots = Math.max(1, Math.floor(Number(maxSlots) || 3));
    this.slots = Array.isArray(serialized) ? serialized.map((entry) => ({ ...entry })) : [];
    this.clock = this.slots.reduce((max, entry) => Math.max(max, entry.createdAt ?? 0), 0);
  }

  add(id, options = {}) {
    const definition = normalizedBuffDefinition(id, options);
    this.clock += 1;
    const existing = this.slots.find((entry) => entry.id === id);
    if (existing) {
      existing.duration = definition.duration;
      existing.maxDuration = definition.duration;
      existing.effects = definition.effects;
      existing.sourceId = definition.sourceId ?? existing.sourceId;
      existing.suppressedFor = 0;
      return { added: false, refreshed: true, evicted: null, buff: existing };
    }
    let evicted = null;
    if (this.slots.length >= this.maxSlots) {
      this.slots.sort((left, right) => left.createdAt - right.createdAt);
      evicted = this.slots.shift();
    }
    const buff = {
      ...definition,
      maxDuration: definition.duration,
      createdAt: this.clock,
      suppressedFor: Math.max(0, Number(options.suppressedFor) || 0),
    };
    this.slots.push(buff);
    return { added: true, refreshed: false, evicted: evicted?.id ?? null, buff };
  }

  suppressOldest(duration = 4) {
    const oldest = [...this.slots].sort((left, right) => left.createdAt - right.createdAt)[0];
    if (!oldest) return null;
    oldest.suppressedFor = Math.max(oldest.suppressedFor ?? 0, Number(duration) || 0);
    return oldest.id;
  }

  remove(id) {
    const index = this.slots.findIndex((entry) => entry.id === id);
    if (index < 0) return false;
    this.slots.splice(index, 1);
    return true;
  }

  update(dt) {
    const delta = Math.max(0, Number(dt) || 0);
    for (const entry of this.slots) {
      entry.duration -= delta;
      entry.suppressedFor = Math.max(0, (entry.suppressedFor ?? 0) - delta);
    }
    this.slots = this.slots.filter((entry) => entry.duration > 0);
  }

  active() {
    return this.slots.filter((entry) => (entry.suppressedFor ?? 0) <= 0);
  }

  has(id, activeOnly = true) {
    return (activeOnly ? this.active() : this.slots).some((entry) => entry.id === id);
  }

  toJSON() {
    return this.slots.map((entry) => ({ ...entry }));
  }
}

export function distanceBetween(left, right) {
  return Math.hypot((left?.x ?? left?.col ?? 0) - (right?.x ?? right?.col ?? 0), (left?.y ?? left?.row ?? 0) - (right?.y ?? right?.row ?? 0));
}

export function applyNumericModifiers(stats, modifiers = []) {
  const result = { ...stats };
  for (const modifier of Array.isArray(modifiers) ? modifiers : []) {
    if (!modifier || typeof modifier !== "object") continue;
    const stat = firstDefined(modifier.stat, modifier.key, modifier.target);
    if (!stat || !Number.isFinite(Number(result[stat]))) continue;
    const value = Number(firstDefined(modifier.value, modifier.amount, 0)) || 0;
    const operation = firstDefined(modifier.operation, modifier.op, modifier.mode, "add");
    if (["multiply", "mul", "percent"].includes(operation)) result[stat] *= Math.abs(value) > 2 ? 1 + value / 100 : value;
    else if (["add_percent", "percent_add"].includes(operation)) result[stat] *= 1 + normalizedFraction(value);
    else if (["set", "override"].includes(operation)) result[stat] = value;
    else result[stat] += value;
  }
  return result;
}
