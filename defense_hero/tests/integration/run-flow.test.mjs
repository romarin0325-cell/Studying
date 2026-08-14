import test from 'node:test';
import assert from 'node:assert/strict';

import { RunController } from '../../js/app/RunController.js';
import { SeededRng } from '../../js/core/SeededRng.js';
import {
  MemoryStorage,
  SAVE_KEYS,
  SaveRepository,
} from '../../js/state/SaveRepository.js';
import {
  CHARACTER_DEFINITIONS,
  DIFFICULTY_DEFINITIONS,
  DOCTRINE_DEFINITIONS,
  RELIC_DEFINITIONS,
  STARTING_BLESSING_DEFINITIONS,
} from '../../js/data/content.js';

const TEST_DECK = Object.freeze({
  leaderId: 'rumi',
  companionIds: ['guardian', 'silver_rabbit', 'snow_rabbit', 'gray'],
});

const RUN_CONTENT = Object.freeze({
  characters: CHARACTER_DEFINITIONS,
  difficulties: DIFFICULTY_DEFINITIONS,
  doctrines: DOCTRINE_DEFINITIONS,
  relics: RELIC_DEFINITIONS,
  blessings: STARTING_BLESSING_DEFINITIONS,
});

function createHarness(storage = new MemoryStorage()) {
  let timestamp = Date.UTC(2026, 7, 14, 0, 0, 0);
  const repository = new SaveRepository({ storage, logger: { warn() {} } });
  const controller = new RunController({
    repository,
    SeededRng,
    content: RUN_CONTENT,
    now: () => {
      timestamp += 1;
      return timestamp;
    },
  });
  controller.initialize();
  return { controller, repository, storage };
}

function createRun(controller, seed = 'INTEGRATION-EXPEDITION-01') {
  return controller.createRun({
    deck: TEST_DECK,
    difficultyId: 'standard',
    seed,
    blessingId: 'blessing_core_lining',
  });
}

function victorySnapshot(stageNumber, overrides = {}) {
  return {
    core: { hp: 100 - stageNumber, shield: Math.max(0, 12 - stageNumber) },
    gold: 180 + stageNumber * 11,
    stats: {
      kills: 8 + stageNumber,
      damage: 600 + stageNumber * 100,
      advantageDamage: 100 + stageNumber * 10,
      elapsedSeconds: 45,
      byCharacter: {
        rumi: {
          damage: 160 + stageNumber * 10,
          kills: 2,
          advantageDamage: 30 + stageNumber,
        },
      },
    },
    ...overrides,
  };
}

function planDigest(plan) {
  return JSON.stringify({
    stageNumber: plan.stageNumber,
    layout: {
      id: plan.layoutId,
      core: plan.core,
      paths: plan.paths,
      obstacles: plan.obstacles,
      leaderNodes: plan.leaderNodes,
      specialTiles: plan.specialTiles,
    },
    threats: plan.threats,
    elementProfile: plan.elementProfile,
    mutator: plan.mutator,
    spawns: plan.spawnSpecs.map((spawn) => ({
      enemyId: spawn.enemyId,
      bossId: spawn.bossId ?? null,
      element: spawn.element,
      pathId: spawn.pathId,
      spawnAt: spawn.spawnAt,
      elitePrefix: spawn.elitePrefix,
    })),
  });
}

test('same seed reproduces all six stage plans while node variants change the expedition', async () => {
  const { buildStagePlan } = await import('../../js/battle/StageBuilder.js');
  const buildExpedition = (nodeVariant) => Array.from({ length: 6 }, (_, index) => buildStagePlan({
    stageNumber: index + 1,
    seed: 'SIX-STAGE-DIGEST',
    difficultyId: 'standard',
    nodeVariant,
  })).map(planDigest);

  const first = buildExpedition(0);
  const replay = buildExpedition(0);
  const alternateNode = buildExpedition(1);

  assert.deepEqual(replay, first);
  assert.equal(first.length, 6);
  assert.ok(
    first.some((digest, index) => digest !== alternateNode[index]),
    '다른 nodeVariant가 지도·위협·스폰 중 어느 것도 바꾸지 않았습니다.',
  );
});

test('StageBuilder keeps each group to two elements, declares the 65 enemy cap, and fixes boss elements', async () => {
  const { buildStagePlan } = await import('../../js/battle/StageBuilder.js');
  const mixed = buildStagePlan({
    stageNumber: 5,
    seed: 'ELEMENT-GROUP-LIMIT',
    difficultyId: 'eclipse',
    nodeVariant: 1,
    trainingOverrides: {
      wavePackageId: 'wave_mixed_trial',
      elementProfile: { water: 0.5, fire: 0.3, dark: 0.2 },
    },
  });

  assert.equal(mixed.elementProfile.maxElementsPerGroup, 2);
  assert.equal(mixed.maxActiveEnemies, 65);
  assert.ok(mixed.totalEnemies <= 65, `기본 조립 결과가 적 65 상한을 넘었습니다: ${mixed.totalEnemies}`);
  for (const wave of mixed.waves) {
    const elementsByGroup = new Map();
    for (const spawn of wave.spawns) {
      const elements = elementsByGroup.get(spawn.groupIndex) ?? new Set();
      elements.add(spawn.element);
      elementsByGroup.set(spawn.groupIndex, elements);
    }
    for (const [groupIndex, elements] of elementsByGroup) {
      assert.ok(
        elements.size <= 2,
        `${wave.id} 그룹 ${groupIndex}에 ${elements.size}개 속성이 배정되었습니다: ${[...elements].join(', ')}`,
      );
    }
  }

  const midBoss = buildStagePlan({ stageNumber: 3, seed: 'BOSS-ELEMENTS', difficultyId: 'standard' });
  const finalBoss = buildStagePlan({ stageNumber: 6, seed: 'BOSS-ELEMENTS', difficultyId: 'standard' });
  const artificialDemon = midBoss.spawnSpecs.find(({ bossId }) => bossId === 'artificial_demon');
  const iris = finalBoss.spawnSpecs.find(({ bossId }) => bossId === 'iris_curse');

  assert.ok(artificialDemon, '스테이지 3에 인조 마신이 없습니다.');
  assert.ok(iris, '스테이지 6에 아이리스가 없습니다.');
  assert.equal(artificialDemon.element, 'water');
  assert.equal(iris.element, 'fire');
});

test('RunController persists node, victory, growth, reward candidates, and next-stage transition', () => {
  const storage = new MemoryStorage();
  const first = createHarness(storage).controller;
  const run = createRun(first, 'REWARD-CHECKPOINT');

  assert.equal(run.phase, 'map');
  assert.equal(run.stageNumber, 1);
  assert.equal(run.coreShield, 15);
  assert.equal(first.chooseNode(1), 1);
  assert.equal(first.run.phase, 'preview');
  first.setPhase('battle', { checkpoint: true });

  assert.deepEqual(first.completeStage(victorySnapshot(1)), {
    complete: false,
    next: 'growth',
    rewardKind: null,
  });
  assert.equal(first.run.shards, 3);
  const levelTwo = first.getUpgradeOptions('rumi');
  assert.equal(levelTwo.length, 1);
  assert.equal(first.applyUpgrade('rumi', levelTwo[0].id).ok, true);
  assert.equal(first.run.levels.rumi, 2);
  assert.equal(first.advanceAfterGrowth(), 'map');
  assert.equal(first.run.stageNumber, 2);

  first.chooseNode(0);
  first.setPhase('battle', { checkpoint: true });
  first.completeStage(victorySnapshot(2));
  const levelThree = first.getUpgradeOptions('rumi');
  assert.equal(levelThree.length, 1);
  assert.equal(first.applyUpgrade('rumi', levelThree[0].id).ok, true);
  assert.equal(first.advanceAfterGrowth(), 'reward');

  const choices = first.getRewardChoices('doctrine');
  assert.equal(choices.length, 3);
  assert.equal(new Set(choices).size, 3);
  assert.deepEqual(first.getRewardChoices('doctrine'), choices);
  assert.deepEqual(first.repository.loadRun().rewardChoices['2:doctrine:0'], choices);

  const resumed = createHarness(storage).controller;
  assert.equal(resumed.run.phase, 'reward');
  assert.deepEqual(resumed.getRewardChoices('doctrine'), choices);
  assert.equal(resumed.chooseReward('doctrine', choices[0]), true);
  assert.equal(resumed.run.stageNumber, 3);
  assert.equal(resumed.run.phase, 'map');
  assert.deepEqual(resumed.run.doctrines, [choices[0]]);
  assert.equal(resumed.run.selectedNodeByStage[1], 1);
  assert.equal(resumed.run.selectedNodeByStage[2], 0);
});

test('saved battle resumes at deploy with the stage-start state intact', () => {
  const storage = new MemoryStorage();
  const first = createHarness(storage).controller;
  createRun(first, 'BATTLE-ROLLBACK');
  first.chooseNode(1);
  first.run.coreHp = 83;
  first.run.gold = 147;
  first.setPhase('battle', { checkpoint: true });

  const resumed = createHarness(storage).controller;
  assert.ok(resumed.run);
  assert.equal(resumed.run.phase, 'deploy');
  assert.equal(resumed.run.interruptedBattle, true);
  assert.equal(resumed.run.stageNumber, 1);
  assert.equal(resumed.run.selectedNode, 1);
  assert.equal(resumed.run.coreHp, 83);
  assert.equal(resumed.run.gold, 147);

  const persisted = JSON.parse(storage.getItem(SAVE_KEYS.run));
  assert.equal(persisted.phase, 'deploy');
  assert.equal(persisted.interruptedBattle, true);
});

test('upgrade branches are exclusive, enforce prerequisites and persist their shard cost', () => {
  const storage = new MemoryStorage();
  const first = createHarness(storage).controller;
  createRun(first, 'UPGRADE-CONTRACT');
  first.run.shards = 8;

  assert.equal(first.applyUpgrade('rumi', 'rumi_moon_l4').ok, false);
  assert.equal(first.applyUpgrade('rumi', 'rumi_common_l2').ok, true);
  assert.equal(first.applyUpgrade('rumi', 'rumi_common_l3').ok, true);
  const beforeBranch = first.run.shards;
  assert.equal(first.applyUpgrade('rumi', 'rumi_guard_l4').ok, true);
  assert.equal(first.run.shards, beforeBranch - 2);
  assert.equal(first.run.branches.rumi, 'B');
  assert.equal(first.applyUpgrade('rumi', 'rumi_moon_l5').ok, false);

  const resumed = createHarness(storage).controller;
  assert.equal(resumed.run.branches.rumi, 'B');
  assert.equal(resumed.run.levels.rumi, 4);
  assert.deepEqual(resumed.run.upgrades.rumi, ['rumi_common_l2', 'rumi_common_l3', 'rumi_guard_l4']);
  assert.equal(resumed.run.shards, first.run.shards);
  resumed.run.shards = 0;
  assert.equal(resumed.applyUpgrade('rumi', 'rumi_guard_l5').ok, false);
});

test('fixed challenges unlock sequentially from expedition progress and challenge stars', () => {
  const storage = new MemoryStorage();
  const first = createHarness(storage).controller;
  createRun(first, 'CHALLENGE-UNLOCK-FLOW');

  assert.deepEqual(first.meta.unlocks.challenges, []);

  first.chooseNode(0);
  first.completeStage(victorySnapshot(1));
  assert.equal(first.advanceAfterGrowth(), 'map');
  assert.equal(first.run.stageNumber, 2);
  assert.deepEqual(first.meta.unlocks.challenges, []);

  first.chooseNode(0);
  first.completeStage(victorySnapshot(2));
  assert.equal(first.advanceAfterGrowth(), 'reward');
  const doctrineChoices = first.getRewardChoices('doctrine');
  assert.equal(first.chooseReward('doctrine', doctrineChoices[0]), true);
  assert.equal(first.run.stageNumber, 3);
  assert.deepEqual(first.meta.unlocks.challenges, ['challenge_sky_rift']);

  const resumed = createHarness(storage).controller;
  assert.deepEqual(resumed.meta.unlocks.challenges, ['challenge_sky_rift']);

  resumed.meta.records.challengeStars.challenge_sky_rift = 1;
  assert.deepEqual(resumed.refreshChallengeUnlocks(), [
    'challenge_sky_rift',
    'challenge_iron_column',
  ]);
  assert.deepEqual(createHarness(storage).controller.meta.unlocks.challenges, [
    'challenge_sky_rift',
    'challenge_iron_column',
  ]);

  resumed.meta.records.challengeStars.challenge_iron_column = 1;
  assert.deepEqual(resumed.refreshChallengeUnlocks(), [
    'challenge_sky_rift',
    'challenge_iron_column',
    'challenge_stopped_clock',
  ]);
  assert.deepEqual(createHarness(storage).controller.meta.unlocks.challenges, [
    'challenge_sky_rift',
    'challenge_iron_column',
    'challenge_stopped_clock',
  ]);
});

test('six victories reach result, then finalize clears the run and updates meta progress', () => {
  const { controller, repository, storage } = createHarness();
  createRun(controller, 'FULL-CLEAR-FLOW');
  assert.ok(controller.meta.affinity && typeof controller.meta.affinity === 'object');

  for (let stageNumber = 1; stageNumber <= 6; stageNumber += 1) {
    assert.equal(controller.run.stageNumber, stageNumber);
    controller.chooseNode(stageNumber % 2);
    controller.setPhase('battle', { checkpoint: true });
    const transition = controller.completeStage(victorySnapshot(stageNumber));

    if (stageNumber === 6) {
      assert.deepEqual(transition, { complete: true, next: 'result' });
      break;
    }

    const next = controller.advanceAfterGrowth();
    if (next === 'reward') {
      const kind = controller.getPendingRewardKind();
      const choices = controller.getRewardChoices(kind);
      assert.equal(choices.length, 3);
      assert.equal(controller.chooseReward(kind, choices[0]), true);
    } else {
      assert.equal(next, 'map');
    }
  }

  assert.equal(controller.run.phase, 'result');
  assert.equal(controller.run.result.success, true);
  assert.equal(controller.run.result.stages, 6);
  assert.ok(repository.loadRun(), 'finalize 전에는 결과 런이 저장되어야 합니다.');

  const result = controller.finalizeResult();
  assert.equal(result.success, true);
  assert.equal(controller.run, null);
  assert.equal(repository.loadRun(), null);
  assert.equal(storage.getItem(SAVE_KEYS.run), null);
  assert.equal(storage.getItem(SAVE_KEYS.runBackup), null);

  const meta = repository.loadMeta();
  assert.equal(meta.records.clears, 1);
  assert.equal(meta.records.failures, 0);
  assert.equal(meta.records.recentSeeds[0], 'FULL-CLEAR-FLOW');
  assert.equal(meta.affinity.rumi, 2);
  assert.equal(meta.records.characterClears.rumi, 1);
  assert.ok(meta.unlocks.leaders.includes('luna'));
  assert.ok(meta.unlocks.companions.includes('gold_dragon'));
  assert.ok(meta.unlocks.difficulties.includes('eclipse'));
  assert.deepEqual(meta.unlocks.challenges, ['challenge_sky_rift']);
});
