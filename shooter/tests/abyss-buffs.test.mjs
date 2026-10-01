import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../engine.js';
import { HEROES } from '../content.js';

const scales = { laser: 1.04, spread: 1.02, lance: 1.04, petal: 1.01, frost: 1.03,
  rewind: 1.04, dagger: 1.04, melee: 1.02, glass: 1.03, nightfall: 1.04, dreamfield: 1.01 };
// Captured from main 82da18a before this patch at 60 Hz, seed 41, no artifacts.
// Each row is P1/P3/P5 at gaps 80/200: three-second warmup, then 15 seconds.
// Actual hits include secondary flames, melee waves, seed impacts and zone ticks.
const baseline = [
  ['homing', [116.424, 116.424, 244.4904, 244.4904, 419.1264, 419.1264], [240, 240, 360, 360, 480, 480]],
  ['laser', [272.1081168, 272.1081168, 380.95136352, 380.95136352, 489.79461024, 489.79461024], [0, 0, 0, 0, 0, 0]],
  ['dagger', [214.5825, 214.5825, 300.4155, 300.4155, 386.2485, 386.2485], [360, 360, 360, 360, 360, 360]],
  ['melee', [251.015625, 171.16875, 351.421875, 239.63625, 451.828125, 308.10375], [52, 52, 52, 52, 52, 52]],
  ['spread', [317.5821, 317.5821, 606.83931, 552.76452, 780.22197, 710.69724], [324, 324, 648, 648, 648, 648]],
  ['lance', [228.02616375, 228.02616375, 319.23662925, 319.23662925, 410.44709475, 410.44709475], [50, 50, 50, 50, 50, 50]],
  ['chain', [143.325, 143.325, 200.655, 200.655, 257.985, 257.985], [0, 0, 0, 0, 0, 0]],
  ['petal', [244.8765, 244.8765, 342.8271, 342.8271, 440.7777, 440.7777], [324, 324, 324, 324, 324, 324]],
  ['frost', [170.40375, 170.40375, 238.56525, 238.56525, 306.72675, 306.72675], [180, 180, 180, 180, 180, 180]],
  ['snowflake', [119.07, 119.07, 166.698, 166.698, 214.326, 214.326], [72, 72, 72, 72, 72, 72]],
  ['glass', [308.12925, 303.3888, 431.38095, 424.74432, 554.63265, 546.09984], [156, 156, 156, 156, 156, 156]],
  ['midnight', [282.525833333, 278.707916667, 395.536166667, 390.191083333, 508.5465, 501.67425], [120, 120, 120, 120, 120, 120]],
  ['nightfall', [194.7792, 194.7792, 272.69088, 272.69088, 350.60256, 350.60256], [38, 38, 38, 38, 38, 38]],
  ['dreamfield', [129.605, 128.87, 181.447, 180.418, 233.289, 231.966], [114, 114, 114, 114, 114, 114]],
  ['promise', [237.3462, 237.3462, 332.28468, 332.28468, 427.22316, 427.22316], [168, 168, 168, 168, 168, 168]],
  ['haven', [240.786, 240.786, 337.1004, 337.1004, 433.4148, 433.4148], [42, 42, 42, 42, 42, 42]],
  ['rewind', [202.94736, 202.94736, 284.126304, 284.126304, 365.305248, 365.305248], [136, 136, 136, 136, 136, 136]],
  ['orbit', [322.4, 322.4, 451.36, 451.36, 580.32, 580.32], [0, 0, 0, 0, 0, 0]]
];
const tick = (g, seconds) => { for (let i = 0; i < seconds * 60; i++) g.update(1 / 60); };
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: ${actual} != ${expected}`);
function fixture(hero, weapon, power, gap, mode) {
  const g = new Game({ hero, weapon, mode, height: 900, seed: 41, artifacts: [] });
  g.phase = 'boss'; g.power = power; g.player.invincible = 1e6;
  g.player.x = g.player.targetX = 225; g.player.y = g.player.targetY = 400;
  g.spawnEnemy(225, 400 - gap, { hp: 1e9, r: 38, speed: 0, fire: 1e6, image: 0 });
  return g;
}

for (const mode of ['easy', 'normal', 'hard', 'abyss']) {
  test(`requested DPS gains and unchanged firing cadence at all sampled powers/distances in ${mode}`, () => {
    assert.deepEqual(baseline.map(row => row[0]), HEROES.flatMap(hero => hero.weapons.map(w => w.id)));
    for (const [id, damage, shots] of baseline) {
      const hero = HEROES.findIndex(h => h.weapons.some(w => w.id === id));
      const weapon = HEROES[hero].weapons.findIndex(w => w.id === id);
      let sample = 0;
      for (const power of [1, 3, 5]) for (const gap of [80, 200]) {
        const g = fixture(hero, weapon, power, gap, mode), label = `${id} P${power} gap ${gap}`;
        tick(g, 3); const before = g.stats.damage; tick(g, 15);
        near((g.stats.damage - before) / 15, damage[sample] * (scales[id] || 1), label);
        assert.equal(g.stats.shots, shots[sample++], `${label}: firing cadence changed`);
      }
    }
  });
  test(`Dark Cinderella gains exactly 3% independently of both ordinary weapons in ${mode}`, () => {
    for (const power of [1, 3, 5]) for (const weapon of [0, 1]) {
      const g = fixture(8, weapon, power, 200, mode), fire = g.fire.bind(g), damage = g.damage.bind(g);
      let direct = 0, transformed = 0;
      g.fire = dt => { if (g.bombTime > 0) fire(dt); };
      g.damage = (enemy, amount, x, y, kind) => {
        const before = g.stats.damage; damage(enemy, amount, x, y, kind);
        if (kind === 'bomb') {
          if (g.bombElapsed > 0) transformed += g.stats.damage - before;
          else direct += g.stats.damage - before;
        }
      };
      assert.ok(g.bomb()); tick(g, 13);
      near(direct, 80 * 1.03, 'initial hit');
      near(transformed, ({ 1: 5700, 3: 7980, 5: 10260 })[power] * 1.03, 'transformed hits');
      assert.equal(g.stats.shots, 120); assert.equal(g.bombDuration, 10); assert.equal(g.bombInvincibility, 2);
      assert.equal(g.bombTime, 0); assert.equal(g.shots.length, 0);
    }
  });
}
