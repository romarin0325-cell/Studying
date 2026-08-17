import test from 'node:test';
import assert from 'node:assert/strict';

import { EffectRenderer } from '../../js/render/EffectRenderer.js';

function createContextRecorder() {
  const calls = [];
  return {
    calls,
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    arc() {},
    stroke() {},
    fill() {},
    fillRect() {},
    strokeText() {},
    fillText() {},
    moveTo(x, y) { calls.push(['moveTo', x, y]); },
    lineTo(x, y) { calls.push(['lineTo', x, y]); },
  };
}

const TEST_LAYOUT = Object.freeze({
  logicalToCanvas(x, y) { return { x: x * 10, y: y * 10 }; },
  logicalRadiusToCanvas(radius) { return radius * 10; },
});

test('damage number setting controls ordinary hit popups without suppressing hit effects', () => {
  const renderer = new EffectRenderer();
  assert.equal(renderer.push({
    effectPreset: 'basic_melee_hit',
    amount: 42.4,
    critical: false,
    x: 1,
    y: 2,
  }), true);
  assert.deepEqual(renderer.snapshotCaps(), {
    effects: 1,
    popups: 1,
    effectCap: 250,
    popupCap: 40,
  });

  renderer.push({ effectPreset: 'critical_hit', amount: 42.4, x: 1, y: 2 });
  assert.equal(renderer.snapshotCaps().effects, 2);
  assert.equal(renderer.snapshotCaps().popups, 1, 'critical overlay must not duplicate the original hit number');

  renderer.setDamageNumbers(false);
  renderer.push({ effectPreset: 'skill_area_hit', amount: 99, x: 1, y: 2 });
  assert.equal(renderer.snapshotCaps().effects, 3);
  assert.equal(renderer.snapshotCaps().popups, 1);

  renderer.update(2);
  assert.equal(renderer.snapshotCaps().effects, 0);
  assert.equal(renderer.snapshotCaps().popups, 0);
});

test('effect and popup queues enforce their release caps', () => {
  const renderer = new EffectRenderer();
  for (let index = 0; index < 300; index += 1) {
    renderer.push({ effectPreset: 'basic_ranged_hit', amount: index + 1, x: 0, y: 0 });
  }
  assert.equal(renderer.snapshotCaps().effects, 250);
  assert.equal(renderer.snapshotCaps().popups, 40);
});

test('suppressed duplicate area effects keep their damage popup without drawing another wave', () => {
  const renderer = new EffectRenderer();
  assert.equal(renderer.push({
    effectPreset: 'skill_area_hit',
    suppressEffect: true,
    amount: 25,
    x: 3,
    y: 4,
  }), true);
  assert.deepEqual(renderer.snapshotCaps(), {
    effects: 0,
    popups: 1,
    effectCap: 250,
    popupCap: 40,
  });
});

test('melee hit draws three slash arcs and a four-point star flash', () => {
  const renderer = new EffectRenderer();
  const context = createContextRecorder();
  renderer.push({
    effectPreset: 'basic_melee_hit',
    element: 'fire',
    suppressEffect: false,
    x: 3,
    y: 3,
  });
  renderer.update(0.15);
  renderer.render(context, TEST_LAYOUT);
  assert.equal(context.calls.filter(([name]) => name === 'moveTo').length, 1, 'only the star flash traces a polygon');
  assert.equal(context.calls.filter(([name]) => name === 'lineTo').length, 7, 'a four-point star closes through seven edges');
});

test('skill cast sparkle renders on the caster without a damage popup', () => {
  const renderer = new EffectRenderer();
  assert.equal(renderer.push({
    type: 'skill_cast',
    effectPreset: 'skill_cast',
    element: 'light',
    sourceId: 'rumi',
    targetId: 'rumi',
    x: 2.5,
    y: 3.5,
    visualOnly: true,
  }), true);
  assert.deepEqual(renderer.snapshotCaps(), {
    effects: 1,
    popups: 0,
    effectCap: 250,
    popupCap: 40,
  }, 'cast events carry no amount, so no popup may appear');

  const context = createContextRecorder();
  renderer.update(0.2);
  renderer.render(context, TEST_LAYOUT);

  renderer.update(2);
  assert.equal(renderer.snapshotCaps().effects, 0, 'cast sparkle expires within its 0.55s life');
});

test('burst basic hits keep a single trace while drawing amplified impact rings', () => {
  const renderer = new EffectRenderer();
  const context = createContextRecorder();
  renderer.push({
    effectPreset: 'basic_ranged_hit',
    attackArchetype: 'burst',
    element: 'dark',
    sourceX: 1,
    sourceY: 1,
    x: 4,
    y: 4,
  });
  renderer.update(0.1);
  renderer.render(context, TEST_LAYOUT);
  assert.equal(context.calls.filter(([name]) => name === 'moveTo').length, 1);
  assert.equal(context.calls.filter(([name]) => name === 'lineTo').length, 1);
});

test('ranged effects draw from the source while each shotgun hit draws exactly one pellet trail', () => {
  const ranged = new EffectRenderer();
  const rangedContext = createContextRecorder();
  ranged.push({
    effectPreset: 'basic_ranged_hit',
    element: 'light',
    sourceX: 1,
    sourceY: 2,
    x: 5,
    y: 6,
  });
  ranged.update(0.14);
  ranged.render(rangedContext, TEST_LAYOUT);
  assert.equal(rangedContext.calls.filter(([name]) => name === 'moveTo').length, 1);
  assert.equal(rangedContext.calls.filter(([name]) => name === 'lineTo').length, 1);
  assert.deepEqual(
    rangedContext.calls.find(([name]) => name === 'moveTo').slice(1).map(Math.round),
    [19, 29],
  );
  assert.deepEqual(
    rangedContext.calls.find(([name]) => name === 'lineTo').slice(1).map(Math.round),
    [30, 40],
  );

  const shotgun = new EffectRenderer();
  const shotgunContext = createContextRecorder();
  shotgun.push({
    effectPreset: 'basic_shotgun_hit',
    element: 'water',
    sourceX: 2,
    sourceY: 3,
    x: 6,
    y: 7,
    pelletIndex: 1,
    vectorX: 0.7,
    vectorY: 0.7,
  });
  shotgun.update(0.17);
  shotgun.render(shotgunContext, TEST_LAYOUT);
  assert.equal(shotgunContext.calls.filter(([name]) => name === 'moveTo').length, 1);
  assert.equal(shotgunContext.calls.filter(([name]) => name === 'lineTo').length, 1);
  assert.deepEqual(
    shotgunContext.calls.find(([name]) => name === 'moveTo').slice(1).map(Math.round),
    [24, 34],
  );
  assert.deepEqual(
    shotgunContext.calls.find(([name]) => name === 'lineTo').slice(1).map(Math.round),
    [40, 50],
  );
});
