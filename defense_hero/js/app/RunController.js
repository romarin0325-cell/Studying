import { createDefaultMetaState } from "../state/MetaState.js";
import { createRunState } from "../state/RunState.js";

const STAGE_SHARDS = Object.freeze([0, 3, 3, 4, 3, 3, 0]);
const REWARD_STAGE_KIND = Object.freeze({ 2: "doctrine", 3: "relic", 5: "doctrine" });
const CHALLENGE_UNLOCKS = Object.freeze({
  sky: "challenge_sky_rift",
  iron: "challenge_iron_column",
  stopped: "challenge_stopped_clock",
});

const DEFAULT_SETTINGS = Object.freeze({
  sound: true,
  damageNumbers: true,
  particles: true,
  screenShake: true,
  vibration: true,
  flashes: true,
  debugOverlay: false,
  elementRules: true,
  elementMultiplier: 1.2,
});

const DEFAULT_UNLOCKS = Object.freeze({
  leaders: ["rumi", "zeke"],
  companions: ["guardian", "silver_rabbit", "snow_rabbit", "gray"],
  difficulties: ["scout", "standard"],
  challenges: [],
});

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function unique(items) {
  return [...new Set(items)];
}

function initialStats() {
  return {
    kills: 0,
    damage: 0,
    advantageDamage: 0,
    aerialDamage: 0,
    areaDamage: 0,
    controlSeconds: 0,
    statusesApplied: 0,
    coreDamageTaken: 0,
    relocations: 0,
    activeUses: 0,
    elapsedSeconds: 0,
    byCharacter: {},
  };
}

export class RunController {
  constructor({ repository, SeededRng, content, now = () => Date.now() }) {
    this.repository = repository;
    this.SeededRng = SeededRng;
    this.content = content;
    this.now = now;
    this.meta = null;
    this.run = null;
  }

  initialize() {
    this.meta = this.repository.loadMeta() ?? createDefaultMetaState({
      unlocks: clone(DEFAULT_UNLOCKS),
      affinity: {},
      records: {
        clears: 0,
        failures: 0,
        bestScore: 0,
        highestDifficulty: "scout",
        recentSeeds: [],
        characterClears: {},
        challengeStars: {},
      },
      settings: clone(DEFAULT_SETTINGS),
      createdAt: this.now(),
    });
    this.meta.unlocks = {
      ...clone(DEFAULT_UNLOCKS),
      ...(this.meta.unlocks ?? {}),
    };
    this.meta.settings = { ...clone(DEFAULT_SETTINGS), ...(this.meta.settings ?? {}) };
    this.meta.records = {
      clears: 0,
      failures: 0,
      bestScore: 0,
      highestDifficulty: "scout",
      recentSeeds: [],
      characterClears: {},
      challengeStars: {},
      ...(this.meta.records ?? {}),
    };
    this.meta.affinity = this.meta.affinity ?? {};
    this.meta.createdAt = this.meta.createdAt ?? this.now();
    this.repository.saveMeta(this.meta);
    this.run = this.repository.loadRun();
    if (this.run?.phase === "battle") {
      this.run.phase = "deploy";
      this.run.interruptedBattle = true;
      this.saveRun();
    }
    this.refreshChallengeUnlocks();
    return { meta: this.meta, run: this.run };
  }

  get settings() {
    return this.meta.settings;
  }

  updateSettings(patch) {
    this.meta.settings = { ...this.meta.settings, ...patch };
    this.repository.saveMeta(this.meta);
    return this.meta.settings;
  }

  createRun({ deck, difficultyId, seed, blessingId }) {
    const difficulty = this.#difficulty(difficultyId);
    const cleanSeed = String(seed || "STAR-0001").trim().toUpperCase();
    const ids = [deck.leaderId, ...deck.companionIds];
    const levels = Object.fromEntries(ids.map((id) => [id, 1]));
    const rng = new this.SeededRng(cleanSeed).fork("run-id");
    this.run = createRunState({
      runId: `${cleanSeed}-${rng.int(0, 36 ** 5).toString(36).padStart(5, "0")}`,
      seed: cleanSeed,
      difficultyId: difficulty.id,
      deck: clone(deck),
      blessingId,
      phase: "map",
      stageNumber: 1,
      selectedNode: null,
      selectedNodeByStage: {},
      completedStages: [],
      coreHp: 100,
      coreShield: 0,
      gold: difficulty.startingGold ?? difficulty.startGold ?? 180,
      shards: 0,
      levels,
      branches: {},
      upgrades: {},
      doctrines: [],
      relics: [],
      rerolls: 1,
      rewardChoices: {},
      stats: initialStats(),
      startedAt: this.now(),
      updatedAt: this.now(),
    });
    this.#applyBlessing(blessingId);
    this.saveRun({ checkpoint: true });
    return this.run;
  }

  resumeRun() {
    this.run = this.repository.loadRun();
    if (!this.run) return null;
    if (this.run.phase === "battle") {
      this.run.phase = "deploy";
      this.run.interruptedBattle = true;
    }
    return this.run;
  }

  chooseNode(nodeVariant) {
    this.#requireRun();
    const variant = Math.max(0, Math.trunc(Number(nodeVariant) || 0));
    this.run.selectedNode = variant;
    this.run.selectedNodeByStage[this.run.stageNumber] = variant;
    this.run.phase = "preview";
    this.saveRun();
    return variant;
  }

  setPhase(phase, { checkpoint = false } = {}) {
    this.#requireRun();
    this.run.phase = phase;
    this.saveRun({ checkpoint });
  }

  recordBattle(snapshot) {
    this.#requireRun();
    const battleStats = snapshot?.stats ?? {};
    for (const key of Object.keys(initialStats())) {
      if (key === "byCharacter") continue;
      this.run.stats[key] = (this.run.stats[key] ?? 0) + (Number(battleStats[key]) || 0);
    }
    for (const [id, stats] of Object.entries(battleStats.byCharacter ?? {})) {
      const current = this.run.stats.byCharacter[id] ?? { damage: 0, kills: 0, advantageDamage: 0 };
      for (const [key, value] of Object.entries(stats)) current[key] = (current[key] ?? 0) + (Number(value) || 0);
      this.run.stats.byCharacter[id] = current;
    }
    this.run.coreHp = Math.max(0, Math.round(snapshot?.core?.hp ?? this.run.coreHp));
    this.run.coreShield = Math.max(0, Math.round(snapshot?.core?.shield ?? 0));
    this.run.gold = Math.max(0, Math.round(snapshot?.gold ?? this.run.gold));
  }

  completeStage(snapshot) {
    this.#requireRun();
    this.recordBattle(snapshot);
    const stage = this.run.stageNumber;
    this.run.completedStages = unique([...this.run.completedStages, stage]);
    this.run.shards += STAGE_SHARDS[stage] ?? 0;
    this.refreshChallengeUnlocks({ expeditionStageReached: stage });
    if (stage >= 6) {
      this.run.phase = "result";
      this.run.result = this.#makeResult(true);
      this.saveRun({ checkpoint: true });
      return { complete: true, next: "result" };
    }
    this.run.phase = "growth";
    this.saveRun({ checkpoint: true });
    return { complete: false, next: "growth", rewardKind: REWARD_STAGE_KIND[stage] ?? null };
  }

  failRun(snapshot) {
    this.#requireRun();
    this.recordBattle(snapshot);
    this.run.phase = "result";
    this.run.result = this.#makeResult(false);
    this.saveRun({ checkpoint: true });
    return this.run.result;
  }

  getUpgradeOptions(characterId) {
    this.#requireRun();
    const character = this.content.characters.find(({ id }) => id === characterId);
    if (!character) return [];
    const currentLevel = this.run.levels[characterId] ?? 1;
    if (currentLevel >= character.maxLevel) return [];
    const nextLevel = currentLevel + 1;
    const branch = this.run.branches[characterId] ?? null;
    return (character.upgrades ?? []).filter((upgrade) => {
      if (upgrade.level !== nextLevel) return false;
      if (!upgrade.branch) return true;
      return branch ? upgrade.branch === branch : true;
    });
  }

  applyUpgrade(characterId, upgradeId) {
    this.#requireRun();
    const options = this.getUpgradeOptions(characterId);
    const selected = options.find(({ id }) => id === upgradeId);
    if (!selected) return { ok: false, reason: "선행 레벨 또는 분기 조건이 맞지 않습니다." };
    const cost = Number(selected.cost) || 0;
    if (this.run.shards < cost) return { ok: false, reason: "성장 조각이 부족합니다." };
    this.run.shards -= cost;
    this.run.levels[characterId] = selected.level;
    this.run.upgrades[characterId] = [...(this.run.upgrades[characterId] ?? []), selected.id];
    if (selected.branch) this.run.branches[characterId] = selected.branch;
    this.saveRun();
    return { ok: true, upgrade: selected };
  }

  getPendingRewardKind() {
    if (!this.run) return null;
    const kind = REWARD_STAGE_KIND[this.run.stageNumber] ?? null;
    if (kind === "doctrine" && this.run.doctrines.length >= 2) return null;
    if (kind === "relic" && this.run.relics.length >= 2) return null;
    return kind;
  }

  getRewardChoices(kind = this.getPendingRewardKind(), { reroll = false } = {}) {
    this.#requireRun();
    if (!kind) return [];
    const key = `${this.run.stageNumber}:${kind}:${reroll ? 1 : 0}`;
    if (this.run.rewardChoices[key]) return this.run.rewardChoices[key];
    const pool = kind === "relic" ? this.content.relics : this.content.doctrines;
    const owned = new Set(kind === "relic" ? this.run.relics : this.run.doctrines);
    const available = pool.filter(({ id }) => !owned.has(id));
    const rng = new this.SeededRng(this.run.seed).fork(`reward:${key}`);
    const deckTags = this.#deckTags();
    const tagsFor = (item) => item.synergyTags ?? item.tags ?? [];
    const synergy = available.filter((item) => tagsFor(item).some((tag) => tag !== "generic" && deckTags.has(tag)));
    const genericTactics = available.filter((item) => tagsFor(item).some((tag) => ["generic", "offense", "control"].includes(tag)));
    const defensive = available.filter((item) => tagsFor(item).some((tag) => ["defense", "economy", "core"].includes(tag)) || (item.category ?? "").match(/defense|economy|core/));
    const picks = [];
    const take = (list) => {
      const candidates = list.filter(({ id }) => !picks.some((item) => item.id === id));
      if (candidates.length) picks.push(rng.pick(candidates));
    };
    take(synergy.length ? synergy : genericTactics);
    if (kind === "doctrine") take(genericTactics);
    take(defensive);
    while (picks.length < Math.min(3, available.length)) take(rng.shuffle(available));
    this.run.rewardChoices[key] = picks.map(({ id }) => id);
    this.saveRun();
    return this.run.rewardChoices[key];
  }

  rerollReward(kind) {
    this.#requireRun();
    if (this.run.rerolls <= 0) return [];
    this.run.rerolls -= 1;
    this.saveRun();
    return this.getRewardChoices(kind, { reroll: true });
  }

  chooseReward(kind, rewardId) {
    this.#requireRun();
    const pool = kind === "relic" ? this.content.relics : this.content.doctrines;
    if (!pool.some(({ id }) => id === rewardId)) return false;
    const target = kind === "relic" ? this.run.relics : this.run.doctrines;
    if (!target.includes(rewardId) && target.length < 2) target.push(rewardId);
    this.advanceToNextStage();
    return true;
  }

  advanceAfterGrowth() {
    this.#requireRun();
    const reward = this.getPendingRewardKind();
    if (reward) {
      this.run.phase = "reward";
      this.saveRun();
      return "reward";
    }
    this.advanceToNextStage();
    return "map";
  }

  advanceToNextStage() {
    this.#requireRun();
    this.run.stageNumber += 1;
    this.run.selectedNode = null;
    this.run.phase = "map";
    this.run.coreShield = 0;
    this.refreshChallengeUnlocks({ expeditionStageReached: this.run.stageNumber });
    this.saveRun({ checkpoint: true });
  }

  refreshChallengeUnlocks({ expeditionStageReached } = {}) {
    if (!this.meta) return [];
    const unlocked = new Set(this.meta.unlocks?.challenges ?? []);
    const completedStages = this.run?.completedStages ?? [];
    const reachedStage = Math.max(
      0,
      Number(expeditionStageReached) || 0,
      Number(this.run?.stageNumber) || 0,
      ...completedStages.map((stage) => Number(stage) || 0),
    );
    const stars = this.meta.records?.challengeStars ?? {};

    if (reachedStage >= 3) unlocked.add(CHALLENGE_UNLOCKS.sky);
    if (unlocked.has(CHALLENGE_UNLOCKS.sky) && (Number(stars[CHALLENGE_UNLOCKS.sky]) || 0) >= 1) {
      unlocked.add(CHALLENGE_UNLOCKS.iron);
    }
    if (unlocked.has(CHALLENGE_UNLOCKS.iron) && (Number(stars[CHALLENGE_UNLOCKS.iron]) || 0) >= 1) {
      unlocked.add(CHALLENGE_UNLOCKS.stopped);
    }

    this.meta.unlocks = {
      ...this.meta.unlocks,
      challenges: [...unlocked],
    };
    this.repository.saveMeta(this.meta);
    return [...unlocked];
  }

  finalizeResult() {
    this.#requireRun();
    const result = this.run.result ?? this.#makeResult(false);
    const records = this.meta.records;
    if (result.success) records.clears += 1;
    else records.failures += 1;
    records.bestScore = Math.max(records.bestScore ?? 0, result.score);
    records.recentSeeds = unique([this.run.seed, ...(records.recentSeeds ?? [])]).slice(0, 10);
    for (const id of [this.run.deck.leaderId, ...this.run.deck.companionIds]) {
      this.meta.affinity[id] = (this.meta.affinity[id] ?? 0) + (result.success ? 2 : 1);
      if (result.success) records.characterClears[id] = (records.characterClears[id] ?? 0) + 1;
    }
    if (result.success) {
      const difficultyOrder = this.content.difficulties.map(({ id }) => id);
      if (difficultyOrder.indexOf(this.run.difficultyId) > difficultyOrder.indexOf(records.highestDifficulty)) {
        records.highestDifficulty = this.run.difficultyId;
      }
      this.meta.unlocks.leaders = unique([...this.meta.unlocks.leaders, "luna", "cinderella"]);
      this.meta.unlocks.companions = unique([...this.meta.unlocks.companions, "gold_dragon", "time_magician"]);
      if (this.run.difficultyId === "standard" || this.run.difficultyId === "eclipse") {
        this.meta.unlocks.difficulties = unique([...this.meta.unlocks.difficulties, "eclipse"]);
      }
    }
    this.repository.saveMeta(this.meta);
    this.repository.clearRun();
    this.run = null;
    return result;
  }

  abandonRun() {
    this.repository.clearRun();
    this.run = null;
  }

  saveRun({ checkpoint = false } = {}) {
    if (!this.run) return null;
    this.run.updatedAt = this.now();
    return checkpoint
      ? this.repository.saveRunCheckpoint(this.run)
      : this.repository.saveRun(this.run, { backup: false });
  }

  #difficulty(id) {
    return this.content.difficulties.find((item) => item.id === id) ?? this.content.difficulties[0];
  }

  #deckTags() {
    const tags = new Set(["generic"]);
    for (const id of [this.run.deck.leaderId, ...this.run.deck.companionIds]) {
      const character = this.content.characters.find((item) => item.id === id);
      if (!character) continue;
      tags.add(character.rolePrimary);
      tags.add(character.element);
      for (const tag of character.roleTags ?? []) tags.add(tag);
      for (const tag of character.attackTags ?? []) tags.add(tag);
      for (const tag of character.tags ?? []) tags.add(tag);
    }
    return tags;
  }

  #applyBlessing(blessingId) {
    const blessing = this.content.blessings.find(({ id }) => id === blessingId);
    if (!blessing) return;
    for (const effect of blessing.effects ?? (blessing.effect ? [blessing.effect] : [])) {
      if (effect.startGold) this.run.gold += effect.startGold;
      if (effect.coreShield || effect.type === "expedition_start_core_shield") this.run.coreShield += effect.coreShield ?? effect.value ?? 0;
      if (effect.costMultiplier || effect.type === "companion_cost_mul") this.run.costMultiplier = effect.costMultiplier ?? effect.value;
      if (effect.shards) this.run.shards += effect.shards;
      if (effect.type === "leader_active_cooldown_mul") this.run.leaderActiveCooldownMultiplier = effect.value;
    }
  }

  #makeResult(success) {
    const stages = this.run.completedStages.length;
    const elapsed = Math.round(this.run.stats.elapsedSeconds ?? 0);
    const baseScore = stages * 1000 + this.run.coreHp * 18 + (this.run.stats.kills ?? 0) * 8 - elapsed;
    const score = Math.max(0, Math.round(baseScore * (this.#difficulty(this.run.difficultyId)?.scoreMul ?? 1)));
    return {
      success,
      score,
      stages,
      seed: this.run.seed,
      difficultyId: this.run.difficultyId,
      elapsedSeconds: elapsed,
      completedAt: this.now(),
    };
  }

  #requireRun() {
    if (!this.run) throw new Error("진행 중인 원정이 없습니다.");
  }
}

export { DEFAULT_SETTINGS, DEFAULT_UNLOCKS, STAGE_SHARDS };
