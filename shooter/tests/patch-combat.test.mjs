import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../engine.js';
import {EVENT_DUNGEONS} from '../content.js';

const tick = (g, t) => { for (let elapsed = 0; elapsed < t - 1e-9; elapsed += 1 / 60) g.update(1 / 60); };
const offer = (g, id) => { g.phase = 'quiz'; g.room = 2; g.pendingArtifacts = [id]; assert.ok(g.chooseChallengeArtifact(id)); };
function room(stage = 0, roomIndex = 0, challenge = false) {
  const g = new Game({ stage, challenge, height: 900 });
  if (!challenge) g.startStage(stage, roomIndex);
  g.phase = 'wave'; g.player.invincible = 999; g.player.fire = 999; g.time = g.stage.duration;
  return g;
}

test('first room waits for living elites and later rooms keep their gates', () => {
  const first = room();
  first.player.fire = 999;
  first.spawnEnemy(225, 200, { elite: true, hp: 1e9, speed: 80, move: 'dive', r: 20, fire: 999 });
  tick(first, 2);
  assert.equal(first.phase, 'wave');
  assert.ok(first.enemies.some(e => e.elite && e.hp > 0 && e.y <= 280));
  const waves = first.wave;
  tick(first, 8);
  assert.equal(first.wave, waves);
  first.enemies.forEach(e => { e.hp = 0; });
  tick(first, 1 / 60);
  assert.equal(first.phase, 'clear');
  assert.equal(first.roomRecovered, true);
  const ordinary = room();
  ordinary.spawnEnemy(225, 200, { hp: 40, speed: 80, move: 'dive', r: 20, fire: 999 });
  tick(ordinary, 1 / 60);
  assert.equal(ordinary.phase, 'clear');
  const mid = room(0, 1);
  mid.sentinelSpawned = true;
  mid.spawnEnemy(225, 180, { elite: true, miniboss: true, hp: 40, r: 20, speed: 0, fire: 999 });
  tick(mid, 1 / 60);
  assert.equal(mid.phase, 'wave');
  mid.enemies[0].hp = 0;
  tick(mid, 1 / 60);
  assert.equal(mid.phase, 'clear');
  const boss = room(0, 2);
  tick(boss, 1 / 60);
  assert.equal(boss.phase, 'warning');
  const challenge = room(3, 0, true);
  challenge.spawnEnemy(40, 200, { elite: true, hp: 20, r: 20, speed: 0, fire: 999 });
  tick(challenge, 1 / 60);
  assert.equal(challenge.phase, 'wave');
  assert.equal(challenge.stageIndex, 0);
});

test('revival artifacts maximize power once and challenge effects do not retrigger', () => {
  const life = new Game({ artifacts: ['resurgence'] });
  life.phase = 'defeat'; life.finished = true; life.player.lives = 0; life.power = 2; life.powerPoints = 4; life.bombs = 1;
  assert.ok(life.revive(true));
  assert.equal(life.player.lives, life.maxLife);
  assert.equal(life.power, 5);
  assert.equal(life.powerPoints, 0);
  assert.equal(life.bombs, 1);
  const bombs = new Game({ artifacts: ['miracle'] });
  bombs.phase = 'defeat'; bombs.finished = true; bombs.bombs = 0; bombs.power = 5; bombs.powerPoints = 2;
  assert.ok(bombs.revive(true));
  assert.equal(bombs.bombs, 5);
  assert.equal(bombs.power, 5);
  assert.equal(bombs.powerPoints, 0);
  assert.equal(bombs.player.lives, Math.min(2, bombs.maxLife));
  const both = new Game({ artifacts: ['resurgence', 'miracle'] });
  both.phase = 'defeat'; both.finished = true; both.bombs = both.maxBombs - 1; both.power = 1;
  assert.ok(both.revive(true));
  assert.equal(both.player.lives, both.maxLife);
  assert.equal(both.bombs, both.maxBombs);
  assert.equal(both.power, 5);
  both.phase = 'defeat';
  assert.equal(both.revive(true), false);
  const wrong = new Game({ artifacts: ['miracle', 'resurgence'] });
  wrong.phase = 'defeat'; wrong.finished = true; wrong.power = 1; wrong.bombs = 0;
  assert.equal(wrong.revive(false), false);
  assert.equal(wrong.power, 1);
  assert.equal(wrong.bombs, 0);
  const challenge = new Game({ challenge: true, artifacts: ['resurgence', 'miracle'] });
  assert.equal(challenge.power, 5);
  assert.equal(challenge.player.lives, challenge.maxLife);
  challenge.power = 1; challenge.powerPoints = 3; challenge.bombs = 0; challenge.player.lives = 1;
  challenge.phase = 'defeat'; challenge.finished = true;
  assert.ok(challenge.revive(true));
  assert.equal(challenge.power, 1);
  assert.equal(challenge.powerPoints, 3);
  assert.equal(challenge.bombs, 0);
  assert.equal(challenge.player.lives, 2);
  const picked = new Game({ challenge: true });
  picked.power = 1; picked.bombs = 0; picked.player.lives = 1;
  offer(picked, 'miracle');
  assert.equal(picked.power, 5);
  assert.equal(picked.bombs, 5);
  picked.startStage(0, 1);
  assert.equal(picked.power, 5);
  picked.power = 2;
  offer(picked, 'crystal');
  assert.equal(picked.power, 2);
});

test('event subpatterns are independent, stationary, cancellable and do not add radial shots', () => {
  const blast = EVENT_DUNGEONS.filter(d => ['behemoth', 'time-ruler', 'gold-dragon'].includes(d.asset));
  const laser = EVENT_DUNGEONS.filter(d => ['harmonious', 'ancient-soul'].includes(d.asset));
  for (const d of EVENT_DUNGEONS) {
    const calm = new Game({ stage: d.id, height: 900 });
    calm.startStage(d.id, 2); calm.spawnBoss(); calm.phase = 'boss'; calm.boss.y = 150; calm.boss.hp = calm.boss.maxHp; calm.player.invincible = 999;
    tick(calm, 4);
    assert.equal(calm.hazards.some(h => h.source === 'eventSubpattern'), false);
  }
  for (const d of [...blast, ...laser]) {
    const g = new Game({ stage: d.id, height: 900 });
    g.startStage(d.id, 2); g.spawnBoss(); g.phase = 'boss'; g.boss.y = 150; g.boss.hp = g.boss.maxHp * .5; g.boss.fire = 30;
    g.player.x = g.player.targetX = 80; g.player.y = g.player.targetY = 500; g.player.invincible = 999; g.player.lives = 3;
    tick(g, 3.05);
    const hazard = g.hazards.find(h => h.source === 'eventSubpattern');
    assert.ok(hazard);
    assert.equal(g.bullets.some(b => b.split), false);
    tick(g, .2);
    if (blast.some(item => item.id === d.id)) {
      assert.equal(hazard.kind, 'targetBlast');
      assert.ok(Math.hypot(hazard.x - 80, hazard.y - 500) < 50);
      g.player.x = g.player.targetX = 400; g.player.y = g.player.targetY = 700; g.boss.fire = 999; g.clearBullets(); g.effects.length = 0; g.player.invincible = 0; g.player.lives = 3;
      assert.equal(hazard.x < 200, true);
      tick(g, .9);
      assert.equal(g.player.lives, 3);
    } else {
      assert.equal(hazard.axis, 'vertical');
      assert.equal(hazard.width, 24);
      assert.equal(hazard.kind, undefined);
    }
    const cancel = new Game({ stage: d.id, height: 900 });
    cancel.startStage(d.id, 2); cancel.spawnBoss(); cancel.phase = 'boss'; cancel.boss.y = 150; cancel.boss.hp = cancel.boss.maxHp * .2; cancel.player.invincible = 999;
    tick(cancel, 3.1);
    assert.ok(cancel.hazards.some(h => h.source === 'eventSubpattern'));
    assert.equal(cancel.bomb(), true);
    assert.equal(cancel.hazards.some(h => h.source === 'eventSubpattern'), false);
    tick(cancel, .4);
    assert.equal(cancel.hazards.some(h => h.source === 'eventSubpattern'), false);
  }
  const skip = new Game({ stage: 10, height: 900 });
  skip.startStage(10, 2); skip.spawnBoss(); skip.phase = 'boss'; skip.boss.y = 150; skip.boss.hp = skip.boss.maxHp * .2; skip.player.invincible = 999;
  tick(skip, 1 / 60);
  assert.equal(skip.bossPattern, 2);
  assert.ok(skip.boss.subpatternNext > skip.bossClock + 2.5);
  const capped = new Game({ stage: 8, height: 900 });
  capped.startStage(8, 2); capped.spawnBoss(); capped.phase = 'boss'; capped.boss.y = 150; capped.boss.hp = capped.boss.maxHp * .5; capped.bossPattern = 1; capped.boss.subpatternNext = capped.bossClock; capped.player.invincible = 999;
  for (let i = 0; i < 6; i++) capped.addHazard(40 + i * 20, 20);
  tick(capped, 1 / 60);
  assert.equal(capped.hazards.some(h => h.source === 'eventSubpattern'), false);
  assert.equal(capped.hazards.length, 6);
});
