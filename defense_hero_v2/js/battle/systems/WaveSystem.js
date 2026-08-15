import { SeededRng } from '../../core/SeededRng.js';
import { BATTLE_PHASE, DIRECTION } from '../../core/enums.js';
import { ENEMY_BY_ID } from '../../content/enemies.js';
import { WAVE_REWARDS } from '../../content/combat.js';
import { allHeroesPlaced } from './PlacementSystem.js';

const gcd = (left, right) => (right === 0 ? left : gcd(right, left % right));

function waveEntries(wave) {
  if (Array.isArray(wave.groups)) return wave.groups.map((entry) => ({ ...entry }));
  if (Array.isArray(wave.entries)) return wave.entries.map((entry) => ({ ...entry }));
  if (wave.composition && typeof wave.composition === 'object') {
    return Object.entries(wave.composition).map(([enemyId, count]) => ({ enemyId, count }));
  }
  throw new TypeError('Wave needs entries or composition');
}

export function buildFixedSpawnSequence(entries) {
  const normalized = entries.map(({ enemyId, count }) => ({ enemyId, count: Number(count) }));
  if (normalized.some(({ enemyId, count }) => !enemyId || !Number.isInteger(count) || count <= 0)) {
    throw new TypeError('Invalid fixed wave composition');
  }
  const divisor = normalized.reduce((value, entry) => gcd(value, entry.count), normalized[0].count);
  if (divisor > 1) {
    const block = normalized.flatMap(({ enemyId, count }) => Array(count / divisor).fill(enemyId));
    return Array.from({ length: divisor }, () => block).flat();
  }

  const remaining = normalized.map((entry) => ({ ...entry }));
  const total = remaining.reduce((sum, entry) => sum + entry.count, 0);
  const output = [];
  let cursor = 0;
  while (output.length < total) {
    const entry = remaining[cursor % remaining.length];
    if (entry.count > 0) {
      output.push(entry.enemyId);
      entry.count -= 1;
    }
    cursor += 1;
  }
  return output;
}

export function startWave(state) {
  if (![BATTLE_PHASE.PREPARATION, BATTLE_PHASE.INTERMISSION].includes(state.phase)) return false;
  if (!allHeroesPlaced(state)) return false;
  const wave = state.stage.waves[state.nextWave - 1];
  if (!wave) throw new RangeError(`Stage has no wave ${state.nextWave}`);
  state.phase = BATTLE_PHASE.WAVE_RUNNING;
  state.wave.number = state.nextWave;
  state.wave.spawnQueue = Array.isArray(wave.spawnOrder)
    ? [...wave.spawnOrder]
    : buildFixedSpawnSequence(waveEntries(wave));
  state.wave.spawnIndex = 0;
  state.wave.spawnTimer = 0;
  state.wave.currentCoreDamaged = false;
  for (const hero of state.heroes) {
    hero.attackTimer = 0;
    hero.skillTimer = 0;
    hero.lastTargetId = null;
    hero.direction = DIRECTION.FRONT;
  }
  state.waveRng = new SeededRng(`${state.seed}:wave:${state.wave.number}`);
  state.events.push({ type: 'wave_started', wave: state.wave.number });
  return true;
}

function spawnEnemy(state, enemyId) {
  const definition = ENEMY_BY_ID[enemyId];
  if (!definition) throw new RangeError(`Unknown enemy: ${enemyId}`);
  const waveDefinition = state.stage.waves[state.wave.number - 1];
  const waveMultiplier = Number(waveDefinition.hpMultiplier ?? 1);
  const bossMultiplier = definition.isBoss ? Number(state.difficulty.bossHpMultiplier ?? 1) : 1;
  const maxHp = definition.baseHp * waveMultiplier * state.difficulty.hpMultiplier * bossMultiplier;
  const first = state.stage.path[0];
  state.wave.spawnSerial += 1;
  const enemy = state.registry.add('enemies', {
    id: `enemy_${String(state.wave.spawnSerial).padStart(4, '0')}`,
    definition,
    enemyId,
    name: definition.name,
    element: definition.element,
    defenseType: definition.defenseType,
    isBoss: Boolean(definition.isBoss),
    hp: maxHp,
    maxHp,
    speed: definition.speed * state.difficulty.speedMultiplier,
    progress: 0,
    spawnOrder: state.wave.spawnSerial,
    x: first.x + 0.5,
    y: first.y + 0.5,
    statuses: {},
    direction: 'front',
    dead: false,
    reachedCore: false,
  });
  state.events.push({ type: 'enemy_spawned', enemyId: enemy.id, x: enemy.x, y: enemy.y });
  return enemy;
}

export function updateWaveSpawning(state, deltaSeconds) {
  if (state.phase !== BATTLE_PHASE.WAVE_RUNNING) return;
  const waveDefinition = state.stage.waves[state.wave.number - 1];
  const interval = Number(waveDefinition.spawnIntervalSeconds ?? 0.72) * state.difficulty.spawnIntervalMultiplier;
  state.wave.spawnTimer -= deltaSeconds;
  while (
    state.wave.spawnTimer <= 0
    && state.wave.spawnIndex < state.wave.spawnQueue.length
    && state.enemies.size < 45
  ) {
    spawnEnemy(state, state.wave.spawnQueue[state.wave.spawnIndex]);
    state.wave.spawnIndex += 1;
    state.wave.spawnTimer += interval;
  }
}

export function isWaveClear(state) {
  return state.phase === BATTLE_PHASE.WAVE_RUNNING
    && state.wave.spawnIndex >= state.wave.spawnQueue.length
    && state.registry.activeEnemyCount() === 0;
}

export function completeWave(state) {
  if (!isWaveClear(state)) return false;
  const waveNumber = state.wave.number;
  state.crystals += WAVE_REWARDS[waveNumber - 1] ?? 0;
  state.wave.previousCoreDamaged = state.wave.currentCoreDamaged;
  state.nextWaveFlags.coreDamagedPreviousWave = state.wave.currentCoreDamaged;
  state.wave.completedCount += 1;
  if (waveNumber >= 10) {
    state.phase = BATTLE_PHASE.VICTORY;
    state.result = { victory: true, wave: 10, elapsedSeconds: state.elapsedSeconds };
  } else {
    state.nextWave = waveNumber + 1;
    state.phase = BATTLE_PHASE.INTERMISSION;
  }
  state.events.push({ type: 'wave_completed', wave: waveNumber, reward: WAVE_REWARDS[waveNumber - 1] ?? 0 });
  return true;
}
