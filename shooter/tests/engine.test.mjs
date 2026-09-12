import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../engine.js';
import { HEROES, STAGES, LIMITS } from '../content.js';
function tick(g, seconds) { for (let n = 0; n < Math.ceil(seconds * 60); n++) g.update(1 / 60); }
function fixture(hero = 0, weapon = 0) {
  const g = new Game({ hero, weapon }); g.phase = 'boss'; g.player.x = g.player.targetX = 225; g.player.y = g.player.targetY = 370;
  g.spawnEnemy(225, 245, { hp: 100000, r: 30, speed: 0, fire: 999, image: 0 }); return g;
}
test('all eighteen weapons damage a target through the real update loop', () => {
  for (let h = 0; h < HEROES.length; h++) for (let w = 0; w < 2; w++) {
    const g = fixture(h, w); tick(g, 3);
    assert.ok(g.stats.damage > 120, `${HEROES[h].weapons[w].id} damage=${g.stats.damage}`);
    assert.ok(Number.isFinite(g.stats.damage));
  }
});
test('homing actually curves toward an off-axis target; spread covers distinct lanes', () => {
  const g = fixture(); g.enemies[0].x = 340; g.fire(1 / 60); const s = g.shots[0], initialVx = s.vx; tick(g, .15);
  assert.ok(s.vx > initialVx);
  const spread = fixture(2, 0); spread.fire(1 / 60); assert.equal(new Set(spread.shots.map(s => s.vx)).size, 3);
});
test('piercing blades hit a column; chain reaches a second target', () => {
  for (const [h, w] of [[1, 0], [2, 1], [3, 0]]) {
    const g = fixture(h, w); g.spawnEnemy(225, 150, { hp: 100000, r: 25, speed: 0, fire: 999, image: 0 }); tick(g, 2);
    assert.ok(g.enemies.every(e => e.hp < e.maxHp), `${h}/${w} did not reach both enemies`);
  }
});
test('melee clears nearby projectiles and has much stronger close damage', () => {
  const g = fixture(1, 1); g.enemyBullet(225, 320, Math.PI / 2, 0); g.fire(1 / 60);
  assert.equal(g.bullets.length, 0); assert.ok(g.stats.damage > 35);
});
test('player hitbox is five logical pixels, with a real invulnerability window', () => {
  const g = fixture(); g.enemies.length = 0; g.player.invincible = 0;
  g.enemyBullet(240, 370, 0, 0, { r: 5 }); tick(g, .02); assert.equal(g.player.lives, 3); assert.equal(g.graze, 1);
  g.enemyBullet(225, 370, 0, 0, { r: 5 }); tick(g, .02); assert.equal(g.player.lives, 2);
  g.enemyBullet(225, 370, 0, 0, { r: 5 }); tick(g, .2); assert.equal(g.player.lives, 2);
});
test('bombs have distinct healing/buff durations and cannot be used in menus', () => {
  for (let h = 0; h < 4; h++) {
    const g = fixture(h); g.player.lives = 2; g.enemyBullet(20, 20, 0, 100);
    assert.equal(g.bomb(), true); assert.equal(g.bombs, 2); assert.equal(g.bullets.length, 0);
    assert.equal(g.player.lives, h === 3 ? 3 : 2); assert.equal(g.bombTime, h === 1 ? 4 : 5);
    g.phase = 'quiz'; assert.equal(g.bomb(), false);
  }
});
test('power cap, score multiplier, recovery caps and quiz guard', () => {
  const g = fixture(); for (let i = 0; i < 30; i++) g.collect('power'); assert.equal(g.power, 5);
  g.combo = 120; assert.equal(g.multiplier, 5); for (let i = 0; i < 20; i++) g.collect('life'); assert.equal(g.player.lives, g.maxLife);
  assert.equal(g.completeQuiz('life'), false); g.phase = 'quiz'; assert.equal(g.completeQuiz('invalid'), false);
  assert.equal(g.completeQuiz('life'), true); assert.equal(g.room, 1); assert.equal(g.attackBonus, 1);
});
test('four bosses have three phases, telegraphed hazards and bounded projectiles', () => {
  for (let stage = 0; stage < 4; stage++) {
    const patterns = [];
    const g = new Game({ stage, onEvent: e => { if (e.type === 'pattern') patterns.push(e.phase); } });
    g.spawnBoss(); tick(g, 3.2); assert.equal(g.phase, 'boss');
    for (const ratio of [.99, .6, .25]) { g.boss.hp = g.boss.maxHp * ratio; g.player.invincible = 999; tick(g, 5); }
    assert.deepEqual(patterns, [0, 1, 2]); assert.ok(g.stats.maxBullets > 10); assert.ok(g.bullets.length <= LIMITS.bullets);
    assert.ok(g.hazards.every(h => h.warn >= 1));
  }
});
test('each dungeon ends only after three rooms and its own final boss', () => {
  for(let stage=0;stage<4;stage++){
    const g=new Game({stage});g.player.invincible=999;
    for(let room=0;room<2;room++){
      assert.equal(g.room,room);g.phase='wave';g.time=g.stage.duration+.1;
      if(room===1){g.spawnSentinel();const e=g.enemies.find(e=>e.miniboss);g.damage(e,1e6,e.x,e.y);}
      tick(g,3.6);assert.equal(g.phase,'quiz');const time=g.totalTime;tick(g,2);assert.equal(g.totalTime,time);g.completeQuiz('bomb');
    }
    g.spawnBoss();tick(g,3.2);g.damage(g.boss,1e6,225,150);tick(g,3.6);
    assert.equal(g.phase,'quiz');g.completeQuiz('score');assert.equal(g.phase,'victory');assert.equal(g.finished,true);assert.equal(g.stats.bossKills,1);assert.equal(g.stageIndex,stage);
  }
});
test('defeat stops the simulation; movement clamps to touch-safe bounds', () => {
  const g = fixture(); g.move(-500, 9999); tick(g, 1); assert.equal(g.player.x, 20); assert.equal(g.player.y, g.height - 74);
  g.player.lives = 1; g.player.invincible = 0; g.hitPlayer(); const time = g.totalTime; tick(g, 10); assert.equal(g.phase, 'defeat'); assert.equal(g.totalTime, time);
});
test('seeded identical input produces identical outcomes', () => {
  const a = new Game({ seed: 321 }), b = new Game({ seed: 321 }); tick(a, 30); tick(b, 30);
  assert.equal(a.score, b.score); assert.equal(a.player.lives, b.player.lives); assert.equal(a.bullets.length, b.bullets.length);
});
