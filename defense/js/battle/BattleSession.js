import { EventBus } from '../core/EventBus.js';
import { CommandQueue } from '../core/CommandQueue.js';
import { BATTLE_PHASE, FIXED_TICK_SECONDS } from '../core/enums.js';
import { createBattleState, createCheckpointFromState } from './BattleState.js';
import { executeCommand } from './systems/CommandSystem.js';
import { recomputeAuras } from './systems/AuraSystem.js';
import { updateStatuses } from './systems/StatusSystem.js';
import { updateWaveSpawning, completeWave } from './systems/WaveSystem.js';
import { updateMovement } from './systems/MovementSystem.js';
import { createBattleActions, resolveBattleActions } from './systems/ActionSystem.js';
import { applyPoisonDamage } from './systems/DamageSystem.js';
import { cleanupEntities } from './systems/CleanupSystem.js';
import { allHeroesPlaced } from './systems/PlacementSystem.js';

const now = () => globalThis.performance?.now?.() ?? Date.now();

function percentile95(samples) {
  if (!samples.length) return 0;
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
}

function plainStatusMap(statuses) {
  return Object.fromEntries(Object.entries(statuses ?? {}).map(([id, status]) => [id, { ...status }]));
}

export class BattleSession {
  constructor({
    stageId,
    difficultyId = 'easy',
    formation,
    seed,
    checkpoint = null,
    repository = null,
  } = {}) {
    this.repository = repository;
    this.events = new EventBus();
    this.commands = new CommandQueue();
    this.state = createBattleState({
      stageId: checkpoint?.stageId ?? stageId,
      difficultyId: checkpoint?.difficultyId ?? difficultyId,
      formation: checkpoint?.formation ?? formation,
      seed: checkpoint?.rngSnapshot?.seed ?? seed,
      checkpoint,
    });
    this.visualEvents = [];
    recomputeAuras(this.state);
  }

  enqueue(type, payload = {}) {
    return this.commands.enqueue(type, payload, this.state.tick);
  }

  applyNow(type, payload = {}) {
    const changed = executeCommand(this.state, { type, payload });
    if (changed && type === 'level_up') this.saveCheckpoint(type);
    if (changed && ['place_hero', 'auto_place'].includes(type) && allHeroesPlaced(this.state)) this.saveCheckpoint(type);
    if (changed && type === 'start_wave') this.saveCheckpoint('wave_start_state');
    recomputeAuras(this.state);
    return changed;
  }

  step(deltaSeconds = FIXED_TICK_SECONDS, { landscape = false } = {}) {
    if (this.state.paused || this.state.phase !== BATTLE_PHASE.WAVE_RUNNING) return this.snapshot();
    const started = now();
    for (const command of this.commands.drainThrough(this.state.tick)) executeCommand(this.state, command);
    updateWaveSpawning(this.state, deltaSeconds);
    updateStatuses(this.state, deltaSeconds, (target, amount) => applyPoisonDamage(this.state, target, amount));
    updateMovement(this.state, deltaSeconds, landscape);
    if (this.state.phase === BATTLE_PHASE.DEFEAT) this.repository?.clearCheckpoint?.();
    recomputeAuras(this.state);

    if (this.state.phase === BATTLE_PHASE.WAVE_RUNNING) {
      const actions = createBattleActions(this.state, deltaSeconds, { landscape });
      resolveBattleActions(this.state, actions);
    }
    cleanupEntities(this.state);
    const completed = completeWave(this.state);
    if (completed) {
      if (this.state.phase === BATTLE_PHASE.VICTORY) this.repository?.clearCheckpoint?.();
      else this.saveCheckpoint('wave_complete');
    }
    this.state.tick += 1;
    this.state.elapsedSeconds += deltaSeconds;
    this.#flushEvents();
    const elapsedMs = now() - started;
    this.state.metrics.updateSamples.push(elapsedMs);
    if (this.state.metrics.updateSamples.length > 600) this.state.metrics.updateSamples.shift();
    return this.snapshot();
  }

  consumeVisualEvents() {
    const events = this.visualEvents;
    this.visualEvents = [];
    return events;
  }

  recordRenderDuration(durationMs) {
    const value = Number(durationMs);
    if (!Number.isFinite(value) || value < 0) return false;
    this.state.metrics.renderSamples.push(value);
    if (this.state.metrics.renderSamples.length > 600) this.state.metrics.renderSamples.shift();
    return true;
  }

  saveCheckpoint(reason = 'manual') {
    if (!this.repository || [BATTLE_PHASE.VICTORY, BATTLE_PHASE.DEFEAT].includes(this.state.phase)) return null;
    const checkpoint = createCheckpointFromState(this.state);
    const saved = this.repository.saveCheckpoint(checkpoint);
    this.events.emit('checkpoint', { reason, checkpoint: saved });
    return saved;
  }

  snapshot() {
    return {
      sessionId: this.state.sessionId,
      stageId: this.state.stageId,
      difficultyId: this.state.difficultyId,
      phase: this.state.phase,
      speed: this.state.speed,
      paused: this.state.paused,
      core: { ...this.state.core },
      crystals: this.state.crystals,
      nextWave: this.state.nextWave,
      wave: {
        number: this.state.wave.number,
        spawned: this.state.wave.spawnIndex,
        total: this.state.wave.spawnQueue.length,
        alive: this.state.registry.activeEnemyCount(),
        completedCount: this.state.wave.completedCount,
      },
      stage: {
        id: this.state.stage.id,
        name: this.state.stage.name,
        theme: this.state.stage.theme,
        path: this.state.stage.path.map((cell) => ({ ...cell })),
        obstacles: this.state.stage.obstacles.map((cell) => ({ ...cell })),
        placementCells: (this.state.stage.placementCells ?? []).map((cell) => ({ ...cell })),
      },
      heroes: this.state.heroes.map((hero) => ({
        id: hero.id,
        slot: hero.slot,
        name: hero.definition.name,
        element: hero.definition.element,
        level: hero.level,
        selectedTraits: { ...hero.selectedTraits },
        x: hero.x,
        y: hero.y,
        placed: hero.placed,
        direction: hero.direction,
        attackTimer: hero.attackTimer,
        skillTimer: hero.skillTimer,
        buffs: [...hero.buffs.keys()],
        stats: { ...hero.stats },
      })),
      enemies: [...this.state.enemies.values()].map((enemy) => ({
        id: enemy.id,
        enemyId: enemy.enemyId,
        name: enemy.name,
        element: enemy.element,
        defenseType: enemy.defenseType,
        isBoss: enemy.isBoss,
        hp: enemy.hp,
        maxHp: enemy.maxHp,
        x: enemy.x,
        y: enemy.y,
        progress: enemy.progress,
        direction: enemy.direction,
        statuses: plainStatusMap(enemy.statuses),
      })),
      result: this.state.result ? { ...this.state.result } : null,
      metrics: {
        updateP95: percentile95(this.state.metrics.updateSamples),
        updateSamples: this.state.metrics.updateSamples.length,
        renderP95: percentile95(this.state.metrics.renderSamples),
        renderSamples: this.state.metrics.renderSamples.length,
      },
    };
  }

  #flushEvents() {
    for (const event of this.state.events.splice(0)) {
      this.visualEvents.push(event);
      this.events.emit(event.type, event);
    }
    if (this.visualEvents.length > 300) this.visualEvents.splice(0, this.visualEvents.length - 300);
  }

  destroy() {
    this.commands.clear();
    this.events.clear();
    this.visualEvents.length = 0;
  }
}

export default BattleSession;
