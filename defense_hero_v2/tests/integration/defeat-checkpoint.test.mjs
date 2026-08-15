import assert from 'node:assert/strict';
import test from 'node:test';

import { BattleSession } from '../../js/battle/BattleSession.js';
import { BATTLE_PHASE, FIXED_TICK_SECONDS } from '../../js/core/enums.js';
import { DEFAULT_FORMATION } from '../../js/content/heroes.js';

test('a fatal core reach clears the checkpoint in the same simulation tick', () => {
  let clearCount = 0;
  const repository = {
    clearCheckpoint() { clearCount += 1; },
    saveCheckpoint(checkpoint) { return checkpoint; },
  };
  const session = new BattleSession({
    stageId: 'ancient_ruins',
    formation: DEFAULT_FORMATION,
    seed: 'defeat-checkpoint',
    repository,
  });
  const { state } = session;
  const end = state.stage.path.at(-1);
  state.phase = BATTLE_PHASE.WAVE_RUNNING;
  state.wave.number = 1;
  state.wave.spawnQueue = [];
  state.wave.spawnIndex = 0;
  state.core.durability = 1;
  state.registry.add('enemies', {
    id: 'fatal_enemy',
    enemyId: 'ruin_scarab',
    name: 'fatal',
    x: end.x + 0.5,
    y: end.y + 0.5,
    progress: state.stage.path.length - 1 - 0.001,
    speed: 1,
    statuses: {},
    dead: false,
    reachedCore: false,
    isBoss: false,
    defenseType: 'normal',
    direction: 'front',
  });

  session.step(FIXED_TICK_SECONDS);

  assert.equal(state.phase, BATTLE_PHASE.DEFEAT);
  assert.equal(state.core.durability, 0);
  assert.equal(clearCount, 1, 'checkpoint must be gone before the delayed result-screen callback');
  session.destroy();
});
