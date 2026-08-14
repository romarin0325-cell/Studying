import { firstDefined, normalizeEffects } from "./ContentAdapter.js";

function includesId(ids, id) {
  return Array.isArray(ids) && ids.includes(id);
}

function upgradeIdsFor(definition, level, branch) {
  return (definition?.upgrades ?? [])
    .filter((upgrade) => Number(upgrade.level) <= level && (!upgrade.branch || upgrade.branch === branch))
    .map((upgrade) => upgrade.id);
}

/**
 * Converts data definitions into runtime flags. Handlers live here, not in
 * character subclasses, so content can be extended by data + registry entry.
 */
export function buildRuntimeTraits(definition, level = 1, branch = null, context = {}) {
  const skills = Array.isArray(definition?.skills) ? definition.skills : [];
  const basic = skills.find((skill) => skill.id === definition.basicSkillId || skill.trigger === "basic") ?? {};
  const passive = skills.find((skill) => skill.id === definition.passiveId || skill.trigger === "passive") ?? {};
  const active = skills.find((skill) => skill.id === definition.activeSkillId || skill.trigger === "manual") ?? null;
  const upgradeIds = upgradeIdsFor(definition, level, branch);
  const traits = {
    upgradeIds,
    basicMechanics: basic.mechanics ?? {},
    passiveMechanics: passive.mechanics ?? {},
    activeMechanics: active?.mechanics ?? {},
    basicSkillId: basic.id ?? definition?.basicSkillId,
    passiveId: passive.id ?? definition?.passiveId,
    activeSkillId: active?.id ?? definition?.activeSkillId ?? null,
    basicTags: [...new Set([...(definition?.attackTags ?? []), ...(basic.tags ?? [])])],
    activeTags: [...new Set(active?.tags ?? [])],
    projectilesPerAttack: Number(firstDefined(definition?.baseStats?.projectilesPerAttack, basic.mechanics?.projectiles, 1)) || 1,
    damageMultiplier: 1,
    attackIntervalMultiplier: 1,
    rangeAdd: 0,
    rangeMultiplier: 1,
    critChanceAdd: 0,
    critMultiplierAdd: 0,
    effects: [],
  };

  // Common level growth is deliberately modest; explicit modifier arrays win.
  traits.damageMultiplier *= 1 + Math.max(0, level - 1) * 0.06;
  const dataModifiers = (definition?.upgrades ?? [])
    .filter((upgrade) => upgradeIds.includes(upgrade.id))
    .flatMap((upgrade) => normalizeEffects(firstDefined(upgrade.modifiers, upgrade.effects, upgrade.addedEffects)));
  for (const modifier of dataModifiers) {
    const type = firstDefined(modifier.type, modifier.stat, modifier.key);
    const value = Number(firstDefined(modifier.value, modifier.amount, 0)) || 0;
    if (["damage_mul", "unit_damage_mul", "damage"].includes(type)) traits.damageMultiplier *= Math.abs(value) > 2 ? 1 + value / 100 : value;
    else if (["attack_interval_mul", "attackInterval"].includes(type)) traits.attackIntervalMultiplier *= value;
    else if (["attack_speed_mul", "attackSpeed"].includes(type)) traits.attackIntervalMultiplier /= value;
    else if (["range_add", "rangeCells"].includes(type)) traits.rangeAdd += value;
    else if (["range_mul", "unit_range_mul"].includes(type)) traits.rangeMultiplier *= value;
    else if (["crit_chance_add", "critChance"].includes(type)) traits.critChanceAdd += value;
    else if (["crit_multiplier_add", "critMultiplier"].includes(type)) traits.critMultiplierAdd += value;
    else traits.effects.push(modifier);
  }

  const has = (id) => includesId(upgradeIds, id);
  const id = definition?.id;
  if (id === "rumi") {
    if (level >= 2) traits.damageMultiplier *= 1.15;
    if (has("rumi_moon_l4")) traits.moonBlessEmpower = { magicDamageMultiplier: 1.2, rangeMultiplier: 1.1 };
    if (has("rumi_moon_l5")) traits.chain = { count: 1, multiplier: 0.65 };
    if (has("rumi_moon_l6")) traits.everyNthSplash = { n: 7, radius: 0.9, damage: 45, damageType: "magic", cooldownRefund: 1.5 };
    if (has("rumi_guard_l4")) traits.rumiGuard = true;
    if (has("rumi_guard_l5")) {
      traits.coreShieldMaxAdd = 30;
      traits.starPowderCoreDamageMultiplier = 0.85;
    }
    if (has("rumi_guard_l6")) traits.dreamForm = { threshold: 0.5, slotDuration: 10 };
  } else if (id === "zeke") {
    if (level >= 2) traits.damageMultiplier *= 1.12;
    traits.burnEvery = Number(passive.mechanics?.attacksPerStack ?? 3);
    if (has("zeke_ignite_l4")) traits.burnSpreadOnDetonateKill = true;
    if (has("zeke_ignite_l5")) traits.burnDeathExplosion = 20;
    if (has("zeke_ignite_l6")) traits.firePatch = true;
    if (has("zeke_pursuit_l4")) {
      traits.execute = { threshold: 0.5, multiplier: 1.35 };
      traits.rangeAdd += 0.5;
    }
    if (has("zeke_pursuit_l5")) traits.sunBlessOnActive = true;
    if (has("zeke_pursuit_l6")) traits.lastFlame = { threshold: 0.3, duration: 8, attackSpeedMultiplier: 1.5 };
  } else if (id === "luna") {
    if (level >= 2) {
      traits.damageMultiplier *= 1.15;
      traits.critMultiplierAdd += 0.15;
    }
    if (has("luna_hunter_l4")) traits.applyDarkness = true;
    if (has("luna_hunter_l5")) traits.criticalResistanceIgnore = 0.35;
    if (has("luna_hunter_l6")) traits.sameBossHitExecute = { hits: 6, multiplier: 1.6, cooldownRefund: 2 };
    if (has("luna_meteor_l4")) traits.meteorExpanded = true;
    if (has("luna_meteor_l5")) traits.meteorRecovery = 1;
    if (has("luna_meteor_l6")) traits.blackMoon = true;
  } else if (id === "cinderella") {
    if (level >= 2) traits.attackIntervalMultiplier *= 0.92;
    traits.alternatingDamage = true;
    if (has("cinderella_breaker_l4")) {
      traits.cinderellaPhysical = true;
      traits.piercingTargets = 2;
    }
    if (has("cinderella_breaker_l5")) traits.armoredDamageMultiplier = 1.35;
    if (has("cinderella_breaker_l6")) traits.miracleKick = true;
    if (has("cinderella_hex_l4")) {
      traits.cinderellaMagicSplash = true;
      traits.hexCurseDuration = 8;
    }
    if (has("cinderella_hex_l5")) traits.markSilence = true;
    if (has("cinderella_hex_l6")) traits.midnightSeal = true;
  } else if (id === "guardian") {
    traits.barricadeEvery = Number(passive.mechanics?.attacksPerTrigger ?? 5);
    if (level >= 2) traits.damageMultiplier *= 1.1;
    if (branch === "A") traits.barricade = true;
    if (branch === "A") traits.barricadeStopLimit = 3;
    if (has("guardian_fortress_l4")) traits.barricadeSlow = 0.2;
    if (has("guardian_fortress_l5")) traits.barricadeStun = true;
    if (branch === "B") traits.pangaea = true;
    if (has("guardian_pangaea_l5")) traits.arenaAfterPangaea = true;
  } else if (id === "silver_rabbit") {
    if (level >= 2) traits.rangeAdd += 0.2;
    traits.antiAirMultiplier = level >= 2 ? 1.15 : 1;
    if (branch === "A") traits.extraAirProjectile = true;
    if (has("silver_rabbit_sky_l4")) traits.airKillChain = { damage: 35, cooldown: 1 };
    if (has("silver_rabbit_sky_l5")) traits.rushFallbackAntiAirMultiplier = 1.075;
    if (branch === "B") traits.rabbitRelay = { marks: 4, damageMultiplier: has("silver_rabbit_relay_l4") ? 1 + 0.15 * Number(context.rabbitCount ?? 0) : 1 };
    if (has("silver_rabbit_relay_l5") && Number(context.rabbitCount ?? 0) >= 3) {
      traits.critChanceAdd += 0.15;
      traits.rangeAdd += 0.2;
    }
  } else if (id === "snow_rabbit") {
    traits.frostPerHit = Number(passive.mechanics?.gaugePerHit ?? 18) + (level >= 2 ? 4 : 0);
    if (branch === "A") traits.frostThreshold = 85;
    if (has("snow_rabbit_freeze_l4")) traits.frostSplash = true;
    if (has("snow_rabbit_freeze_l5")) traits.frozenDamageMultiplier = 1.2;
    if (branch === "B") {
      traits.frostPerHit *= 0.5;
      traits.corrosionEvery = 3;
    }
    if (has("snow_rabbit_corrosion_l4")) traits.corrosionMagicDamageMultiplier = 1.2;
    if (has("snow_rabbit_corrosion_l5")) traits.corrosionSplash = { damage: 45, radius: 0.7, cooldown: 2 };
  } else if (id === "gray") {
    if (level >= 2) traits.damageMultiplier *= 1.12;
    traits.forceCritEvery = level >= 2 ? 3 : Number(passive.mechanics?.attacksPerCritical ?? 4);
    if (branch === "A") {
      traits.forceCritMultiplier = 2.2;
      traits.forceCritMoonMultiplier = 3.2;
      if (has("gray_soul_l4")) traits.forceCritResistanceIgnore = 0.3;
      if (has("gray_soul_l5")) traits.forceCritExecute = { threshold: 0.3, multiplier: 1.5 };
    }
    if (branch === "B") traits.delayedStrike = {
      interval: 5,
      delay: 3,
      damage: 95,
      radius: has("gray_delay_l4") ? 0.715 : 0.55,
      nextDelayReduction: has("gray_delay_l4") ? 1 : 0,
      timeMagicianDelay: has("gray_delay_l5") ? 0.8 : null,
      timeMagicianDamageMultiplier: has("gray_delay_l5") ? 1.25 : 1,
    };
  } else if (id === "gold_dragon") {
    if (level >= 2) traits.damageMultiplier *= 1.12;
    traits.firstAttackMultiplier = level >= 2 ? 2.4 : 2;
    if (branch === "A") traits.splash = { radius: 1.1, multiplier: 0.75, burn: 1 };
    if (has("gold_dragon_breath_l4")) traits.goldenFlame = { airMultiplier: 1.3, burningMultiplier: 1.2 };
    if (has("gold_dragon_breath_l5")) traits.everyNthSplash = { n: 6, radius: 2.2, multiplier: 1.8, damageType: "magic" };
    if (branch === "B") {
      traits.damageMultiplier *= 1.45;
      traits.attackIntervalMultiplier *= 1.15;
      traits.goldDragonPhysical = true;
    }
    if (has("gold_dragon_claw_l4")) traits.fullHealthFirstHit = true;
    if (has("gold_dragon_claw_l5")) traits.goldExecute = { threshold: 0.25, multiplier: 1.6, overflowCarry: 0.25 };
  } else if (id === "time_magician") {
    if (level >= 2) traits.applySlow = { potency: 0.15, duration: 2 };
    traits.supportRadius = Number(definition?.baseStats?.supportRadiusCells ?? 2.2) + (level >= 2 ? 0.25 : 0);
    traits.delayedReduction = branch === "A" ? 0.4 : 0.25;
    if (branch === "A") traits.cooldownReductionAura = 0.15;
    if (has("time_magician_accel_l4")) traits.synchronization = { requiredTargets: 2, attackSpeedMultiplier: 1.25 };
    if (has("time_magician_accel_l5")) traits.timeJump = true;
    if (branch === "B") traits.timeStop = { interval: 10, duration: 1.3, bossDuration: 0.35 };
    if (has("time_magician_stop_l4")) traits.deathClockDamageMultiplier = 1.25;
    if (has("time_magician_stop_l5")) traits.zeroHourCastDelay = 2;
  }
  return traits;
}

export class EffectRegistry {
  constructor() {
    this.handlers = new Map();
    this.registerDefaults();
  }

  register(type, handler) {
    if (typeof handler !== "function") throw new TypeError(`Effect handler for ${type} must be a function.`);
    this.handlers.set(type, handler);
    return this;
  }

  execute(effect, context) {
    if (!effect) return undefined;
    const type = firstDefined(effect.type, effect.effectType, effect.id);
    return this.handlers.get(type)?.(effect, context);
  }

  executeAll(effects, context) {
    return normalizeEffects(effects).map((effect) => this.execute(effect, context));
  }

  registerDefaults() {
    this.register("damage", (effect, context) => context.engine.dealDamage(context.source, context.target, {
      amount: firstDefined(effect.value, effect.amount, effect.damage),
      damageType: effect.damageType,
      element: firstDefined(effect.element, context.source?.element),
    }));
    this.register("apply_status", (effect, context) => context.engine.applyStatus(context.target, firstDefined(effect.statusId, effect.id), effect, context.source));
    this.register("create_field_buff", (effect, context) => context.engine.addFieldBuff(firstDefined(effect.fieldBuffId, effect.buffId, effect.id), effect, context.source));
    this.register("create_area", (effect, context) => context.engine.createAreaEffect({ ...effect, sourceId: context.source?.id }));
    this.register("delayed_attack", (effect, context) => context.engine.createAreaEffect({ ...effect, sourceId: context.source?.id, delay: firstDefined(effect.delay, effect.duration, 1), kind: "delayed_attack" }));
    this.register("modify_cooldown", (effect, context) => {
      if (!context.source) return;
      context.source.activeCooldownRemaining = Math.max(0, context.source.activeCooldownRemaining - Number(firstDefined(effect.value, effect.amount, 0)));
    });
  }
}

export default EffectRegistry;
