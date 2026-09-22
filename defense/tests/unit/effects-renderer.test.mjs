import test from 'node:test';
import assert from 'node:assert/strict';

import { EffectRenderer } from '../../js/render/EffectRenderer.js';

function createContextRecorder() {
  const calls = [];
  const strokes = [];
  let path = [];
  return {
    calls, strokes,
    save() {},
    restore() {},
    beginPath() { path = []; },
    closePath() {},
    arc() {},
    stroke() { strokes.push([...path]); },
    fill() {},
    fillRect() {},
    strokeText() {},
    fillText(text,x,y) { calls.push(['text',text,x,y]); },
    moveTo(x, y) { calls.push(['moveTo', x, y]); path.push([x,y]); },
    lineTo(x, y) { calls.push(['lineTo', x, y]); path.push([x,y]); },
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
  assert.ok(context.calls.some(([name]) => name === 'moveTo'), 'slash impact includes a polygon flash');
  assert.equal(context.strokes.filter(path => path.length === 2).length, 0, 'melee must not draw a ranged trail');
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

test('burst impacts draw shards at the target without replaying the flight', () => {
  const renderer=new EffectRenderer(), context=createContextRecorder();
  renderer.push({effectPreset:'basic_ranged_hit',attackArchetype:'burst',element:'dark',sourceX:1,sourceY:1,x:4,y:4});
  renderer.update(.1); renderer.render(context,TEST_LAYOUT);
  assert.equal(context.strokes.filter(path=>path.length===2).length,0);
  assert.ok(context.calls.some(([name])=>name==='moveTo'));
});

test('loaded combat art renders a shotgun impact with a valid colored trace', () => {
  const context=createContextRecorder();
  context.translate=()=>{}; context.rotate=()=>{}; context.drawImage=(...args)=>context.calls.push(['image',...args]);
  const renderer=new EffectRenderer({assetManager:{getImage:()=>({width:1024,height:1024})}});
  renderer.push({effectPreset:'basic_shotgun_hit',attackArchetype:'shotgun',element:'fire',sourceX:1,sourceY:1,x:4,y:2,amount:9});
  renderer.render(context,TEST_LAYOUT);
  assert.ok(context.strokes.length>0,'instant shot trace must render with the atlas loaded');
  assert.ok(context.calls.some(call=>call[0]==='image'),'impact uses the loaded art');
});

test('skill flight is drawn from simulation progress; its hit popup appears on the impact frame', () => {
  const renderer=new EffectRenderer(), flight=createContextRecorder();
  const projectile={phase:'flight',progress:.5,actionKind:'skill',attackArchetype:'area',
    element:'fire',sourceX:1,sourceY:1,targetX:5,targetY:5,x:3,y:3,radius:3};
  renderer.render(flight,TEST_LAYOUT,[projectile]);
  assert.equal(renderer.snapshotCaps().popups,0,'a flying projectile cannot report damage');
  const trace=flight.strokes.find(path=>path.length===2);
  assert.deepEqual(trace[0].map(Math.round),[16,8]);
  assert.deepEqual(trace[1].map(Math.round),[30,25]);
  renderer.push({type:'hit',actionKind:'skill',attackArchetype:'area',effectPreset:'skill_area_hit',
    element:'fire',sourceX:1,sourceY:1,x:5,y:5,radius:3,amount:120});
  const impact=createContextRecorder(); renderer.render(impact,TEST_LAYOUT,[]);
  assert.equal(impact.strokes.filter(path=>path.length===2).length,0,'no second fake projectile after HP decreases');
  assert.equal(impact.calls.filter(([name])=>name==='text').length,1,'damage is visible immediately');
  assert.equal(renderer.effects[0].travel,0);
  renderer.update(1.2);
  assert.equal(renderer.snapshotCaps().effects,0); assert.equal(renderer.snapshotCaps().popups,0);
});

test('skill status and critical overlays appear at the same impact with one damage number', () => {
  const renderer=new EffectRenderer();
  const common={type:'hit',actionKind:'skill',element:'light',sourceX:1,sourceY:1,x:5,y:5};
  renderer.push({...common,effectPreset:'skill_single_hit',amount:80});
  renderer.push({...common,effectPreset:'critical_hit',amount:80});
  renderer.push({...common,effectPreset:'status_apply',statusId:'burn'});
  const context=createContextRecorder(); renderer.render(context,TEST_LAYOUT);
  assert.equal(renderer.effects.length,3);
  assert.ok(renderer.effects.every(effect=>effect.travel===0));
  assert.equal(context.calls.filter(([name])=>name==='text').length,1);
  assert.equal(context.strokes.filter(path=>path.length===2).length,0);
});

test('shotgun hits draw one complete instantaneous pellet ray at the impact tick', () => {
  const renderer=new EffectRenderer(), context=createContextRecorder();
  renderer.push({effectPreset:'basic_shotgun_hit',element:'water',sourceX:2,sourceY:3,x:6,y:7,pelletIndex:1});
  renderer.update(.24); renderer.render(context,TEST_LAYOUT);
  const traces=context.strokes.filter(path=>path.length===2);
  assert.equal(traces.length,1);
  assert.deepEqual(traces[0][0].map(Math.round),[20,21]);
  assert.deepEqual(traces[0][1].map(Math.round),[60,61]);
});

test('nova draws six jagged lightning spokes from the caster', () => {
  const renderer = new EffectRenderer();
  const context = createContextRecorder();
  renderer.push({
    effectPreset: 'basic_nova_hit',
    element: 'nature',
    radius: 2.5,
    x: 5,
    y: 5,
  });
  renderer.update(0.2);
  renderer.render(context, TEST_LAYOUT);
  // 6 spokes × 2 strokes (glow + white core), each spoke is moveTo + 3 lineTo.
  assert.equal(context.calls.filter(([name]) => name === 'moveTo').length, 12);
  assert.equal(context.calls.filter(([name]) => name === 'lineTo').length, 36);
});

test('laser draws a beam from the caster to the beam endpoint', () => {
  const renderer = new EffectRenderer();
  const context = createContextRecorder();
  renderer.push({
    effectPreset: 'basic_laser_hit',
    element: 'light',
    sourceX: 1,
    sourceY: 2,
    x: 9,
    y: 2,
    vectorX: 1,
    vectorY: 0,
  });
  renderer.update(0.1);
  renderer.render(context, TEST_LAYOUT);
  const moves = context.calls.filter(([name]) => name === 'moveTo');
  const lines = context.calls.filter(([name]) => name === 'lineTo');
  assert.equal(moves.length, 3, 'glow + mid + core beam layers');
  assert.equal(lines.length, 3);
  assert.ok(moves.every(([, x, y]) => x === 10 && Math.abs(y - 10.8) < 1e-6), 'every layer starts at the caster chest');
  assert.ok(lines.every(([, x, y]) => x === 90 && Math.abs(y - 10.8) < 1e-6), 'the complete ray has the same elevation and length as its preview');
});
