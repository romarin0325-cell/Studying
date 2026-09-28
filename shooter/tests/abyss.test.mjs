import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../engine.js';
import { DIFFICULTIES, ARTIFACTS, createProfile, normalizeDifficulty, recordDungeonClear, claimDungeon } from '../meta.js';
import { EVENT_DUNGEONS, LIMITS } from '../content.js';

const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-8, `${label}: ${actual} !== ${expected}`);
const game = (stage, mode, room = 2) => {
  const g = new Game({ stage, mode, challenge: stage === 6 });
  g.startStage(stage, room);
  g.player.fire = 999;
  g.player.invincible = 999;
  return g;
};
const volley = (stage, mode, phase) => {
  const g = game(stage, mode);
  g.spawnBoss();
  g.phase = 'boss';
  g.boss.y = 150;
  g.boss.hp = g.boss.maxHp * [1, .6, .3][phase];
  g.bossAttack(1.3);
  return g;
};

test('abyss is the fourth difficulty and version-six currency, tickets and clears survive reload', () => {
  assert.deepEqual(DIFFICULTIES.map(d => d.id), ['easy', 'normal', 'hard', 'abyss']);
  assert.deepEqual(['easy','normal','hard','abyss','relaxed','broken'].map(normalizeDifficulty), ['easy','normal','hard','abyss','easy','normal']);
  const abyss = DIFFICULTIES[3], hard = DIFFICULTIES[2];
  assert.deepEqual([abyss.hp,abyss.speed,abyss.interval,abyss.lives,abyss.maxLife,abyss.rare,abyss.tickets], [hard.hp,1.27,.74,3,3,hard.rare,2]);
  assert.equal(ARTIFACTS.find(a => a.id === 'dream').name, '꿈의조각');
  const p = createProfile({ version: 6, dreamShards: 9, tickets: [{ dungeon: 0, difficulty: 'hard' }], clears: { '0:0:hard:0': true } });
  assert.equal(p.version, 7);
  assert.equal(recordDungeonClear(p, 0, 0, 5, 'abyss'), true);
  p.tickets.push({ dungeon: 5, difficulty: 'abyss' });
  const saved = createProfile(JSON.parse(JSON.stringify(p)));
  assert.equal(saved.dreamShards, 9);
  assert.equal(saved.clears['0:0:hard:0'], true);
  assert.equal(saved.clears['0:0:abyss:5'], true);
  assert.deepEqual(saved.tickets.map(t => t.difficulty), ['hard','abyss']);
});

test('abyss shares each dungeon weekly claim with the other difficulties', () => {
  const date = new Date(2026, 8, 21);
  const hardFirst = createProfile();
  assert.equal(claimDungeon(hardFirst, 0, 'hard', date).count, 2);
  assert.equal(claimDungeon(hardFirst, 0, 'abyss', date), null);
  const abyssFirst = createProfile();
  assert.equal(claimDungeon(abyssFirst, 0, 'abyss', date).count, 2);
  assert.equal(claimDungeon(abyssFirst, 0, 'easy', date), null);
  assert.equal(createProfile(JSON.parse(JSON.stringify(abyssFirst))).tickets.length, 2);
});

test('six dungeon enemy, sentinel and boss HP curves apply once over unchanged hard values', () => {
  const enemy = [1.30,1.26,1.22,1.18,1.14,1.10];
  const sentinel = [1.40,1.36,1.32,1.28,1.24,1.20];
  const boss = [1.60,1.54,1.48,1.42,1.36,1.30];
  for (let stage = 0; stage < 6; stage++) {
    const hard = game(stage, 'hard'), abyss = game(stage, 'abyss');
    for (const data of [{ hp: 100 }, { hp: 100, elite: true }, { hp: 100, special: 3 }, { hp: 100, elite: true, special: 3 }]) {
      hard.spawnEnemy(225, 100, data); abyss.spawnEnemy(225, 100, data);
      near(abyss.enemies.at(-1).maxHp / hard.enemies.at(-1).maxHp, enemy[stage], `enemy ${stage}`);
    }
    hard.spawnSentinel(); abyss.spawnSentinel();
    near(abyss.enemies.at(-1).maxHp / hard.enemies.at(-1).maxHp, sentinel[stage], `sentinel ${stage}`);
    hard.spawnBoss(); abyss.spawnBoss();
    near(abyss.boss.maxHp / hard.boss.maxHp, boss[stage], `boss ${stage}`);
  }
});

test('celestial and event fallbacks use late-game HP curves and ordinary projectiles use 1.27', () => {
  for (const stage of [6, ...EVENT_DUNGEONS.map(d => d.id)]) {
    const hard = game(stage, 'hard'), abyss = game(stage, 'abyss');
    for (const data of [{ hp: 100 }, { hp: 100, elite: true, special: 3 }]) {
      hard.spawnEnemy(225, 100, data); abyss.spawnEnemy(225, 100, data);
      near(abyss.enemies.at(-1).maxHp / hard.enemies.at(-1).maxHp, 1.10, `late enemy ${stage}`);
    }
    hard.spawnSentinel(); abyss.spawnSentinel();
    near(abyss.enemies.at(-1).maxHp / hard.enemies.at(-1).maxHp, 1.20, `late sentinel ${stage}`);
    hard.spawnBoss(); abyss.spawnBoss();
    near(abyss.boss.maxHp / hard.boss.maxHp, 1.30, `late boss ${stage}`);
  }
  const g = game(0, 'abyss'); g.phase = 'wave'; g.enemyBullet(0,0,0,100);
  near(g.bullets[0].vx, 127, 'ordinary abyss projectile');
});

test('ordinary bosses use their specified abyss volleys and fire intervals', () => {
  const counts = [[7,16,9],[8,10,18],[14,null,21],[18,24,35],[6,7,8],[10,12,17]];
  const fires = [[.95,.70,.70],[.86,.55,.55],[.95,.72,.72],[1.05,.8,.8],[1,.85,.85],[.81*.943,.54*.943,.6*.943]];
  for (let stage = 0; stage < 6; stage++) for (let phase = 0; phase < 3; phase++) {
    const g = volley(stage, 'abyss', phase);
    if (counts[stage][phase] !== null) assert.equal(g.bullets.length, counts[stage][phase], `stage ${stage} phase ${phase}`);
    near(g.boss.fire, fires[stage][phase], `fire ${stage}/${phase}`);
    if (stage === 2 && phase === 1) {
      const xs = g.bullets.map(b => b.x).sort((a,b) => a-b);
      assert.ok(xs.length >= 12);
      assert.ok(xs.slice(1).some((x,i) => x-xs[i] === 30));
    }
    if (stage === 4 && phase > 0) near(g.boss.nextCross - g.bossClock, 4, 'Poseidon cross');
  }
});

test('Genocide keeps hard volley, fire period and projectile speed before and after splitting', () => {
  const hard = volley(5, 'hard', 2), abyss = volley(5, 'abyss', 2);
  near(abyss.boss.fire, hard.boss.fire, 'Genocide interval');
  assert.equal(abyss.bullets.length, hard.bullets.length);
  for (let i = 0; i < hard.bullets.length; i++) {
    near(abyss.bullets[i].vx, hard.bullets[i].vx, `Genocide vx ${i}`);
    near(abyss.bullets[i].vy, hard.bullets[i].vy, `Genocide vy ${i}`);
  }
  for (const g of [hard, abyss]) {
    const split = g.bullets.find(b => b.split);
    g.bullets = [{ ...split, x: g.player.x, y: g.player.y - 100, age: 0 }];
    g.boss.fire = 999;
    g.update(.01);
    assert.equal(g.bullets.length, 9);
  }
  for (let i = 0; i < 9; i++) near(Math.hypot(abyss.bullets[i].vx,abyss.bullets[i].vy), Math.hypot(hard.bullets[i].vx,hard.bullets[i].vy), `split ${i}`);
});

test('all five event bosses and all phases use their individual abyss timings, volleys and subpattern schedule', () => {
  for (const d of EVENT_DUNGEONS) for (let phase = 0; phase < 3; phase++) {
    const g = volley(d.id, 'abyss', phase);
    const asset = d.asset;
    const fire = asset === 'behemoth' ? [1.47,1.45,1.12][phase] : asset === 'time-ruler' ? 1.90 : ['harmonious','gold-dragon'].includes(asset) ? [1.15,1,.85][phase] : [1.25,1.08,.92][phase];
    near(g.boss.fire, fire, `${asset} fire ${phase}`);
    if (asset === 'harmonious') assert.equal(g.bullets.filter(b => b.shape === 'heart').length, 2 * [6,7,8][phase]);
    if (asset === 'gold-dragon') assert.ok(g.bullets.length >= 2 * [7,8,9][phase]);
    if (asset === 'ancient-soul') assert.ok(g.bullets.length >= [24,30,35][phase] - 3 + (phase === 2 ? 5 : phase === 1 ? 4 : 0));
    if (asset === 'behemoth') {
      const wave = g.effects.find(e => e.type === 'eventWave');
      assert.equal(wave.spacing, phase === 0 ? 25 : 26);
      assert.equal(wave.corridor, phase === 2 ? 68 : 72);
    }
    if (asset === 'time-ruler') {
      assert.ok(g.bullets.length >= [18,24,30][phase] - 3 + (phase === 2 ? 6 : 0));
      assert.ok(g.bullets.every(b => b.stopAt === undefined || (b.stopAt === .55 && b.releaseAt === 1.65)));
    }
    if (phase > 0) {
      near(g.boss.subpatternNext - g.bossClock, 3, 'initial event subpattern');
      g.bossClock = g.boss.subpatternNext;
      g.tickEventSubpattern(phase);
      near(g.boss.subpatternNext - g.bossClock, phase === 1 ? 5.5 : 4.5, 'normal subpattern');
      g.dropEventSubpatterns(true);
      near(g.boss.subpatternNext - g.bossClock, phase === 1 ? 5.5 : 4.5, 'resumed subpattern');
    }
  }
});

test('Astea abyss challenge keeps warnings and corridors while changing its three volleys', () => {
  for (let phase = 0; phase < 3; phase++) {
    const g = volley(6, 'abyss', phase);
    assert.equal(g.challenge, true);
    assert.equal(g.bullets.length, [8,10,7][phase]);
    near(g.boss.fire, [1.12,1.12,2.4][phase], `Astea fire ${phase}`);
    if (phase === 0) near(g.boss.nextLight, 3.6, 'light interval');
    if (phase === 1) near(g.boss.nextBlade, 1.5, 'blade interval');
    if (phase === 2) {
      near(g.boss.nextJudgmentCross, 2.5, 'judgment cross');
      assert.equal(g.effects.find(e => e.type === 'celestialWarning').gap, 90);
    }
  }
});

test('dense abyss volleys stay below the 360 bullet cap in representative long phases', () => {
  let highest = 0;
  for (const stage of [3,5,6,...EVENT_DUNGEONS.map(d => d.id)]) {
    const g = game(stage, 'abyss');
    g.spawnBoss(); g.phase = 'boss'; g.boss.y = 150; g.boss.hp = g.boss.maxHp * .3;
    for (let i = 0; i < 20 * 60; i++) g.update(1/60);
    highest = Math.max(highest, g.stats.maxBullets);
    assert.ok(g.stats.maxBullets <= 340, `stage ${stage} reached ${g.stats.maxBullets}/${LIMITS.bullets}`);
  }
  console.log(`Abyss representative maxBullets=${highest}/${LIMITS.bullets}`);
});
