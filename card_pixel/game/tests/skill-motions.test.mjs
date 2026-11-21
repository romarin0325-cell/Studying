import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { SKILL_MOTIONS } from '../src/content/skill-motions.js';
import { create as createBattle } from '../src/engine/bridge.js';
import { createStage } from '../src/stage/stage.js';
import { contactOffset, motionPoint, rangedTiming, resolveMotion, socketPoint, spriteBox } from '../src/ui/battle/motion.js';
import { createMoves } from '../src/ui/battle/moves.js';
import { createCoreRoster } from './support/core.mjs';

const { core, roster, sp } = createCoreRoster();
const audit = JSON.parse(readFileSync(new URL('../../history/consults/2026-11-22-astra-skill-motion.json', import.meta.url), 'utf8'));

function rosterSkill(sourceKey) {
  const [role, ownerId, slot] = sourceKey.split('/');
  const owner = role === 'boss' ? roster.bossOf(ownerId) :
    role === 'wild' ? roster.wildOf(ownerId.slice('wild_'.length)) : roster.card(ownerId);
  return owner?.skills[Number(slot) - 1];
}

function resolve(sourceKey, options) {
  return resolveMotion({ sourceKey, skill: rosterSkill(sourceKey), side: 'ally', ...options });
}

test('every table key names the exact slot and covers all the native audit findings', () => {
  for (const [key, entry] of Object.entries(SKILL_MOTIONS)) {
    assert.match(key, /^(ally|boss|wild|form)\/[a-z_0-9]+\/[1-9]\d*$/);
    assert.equal(rosterSkill(key)?.name, entry.expectedName, key);
  }
  const families = new Set(audit.design.families.map(entry => entry.id));
  const required = audit.entries.filter(entry => ['ally', 'boss', 'wild', 'form'].includes(entry.context));
  assert.equal(required.length, 267);
  assert.equal(Object.keys(SKILL_MOTIONS).length, 269);
  assert.equal(audit.counts.nativeSlots.total - Object.keys(SKILL_MOTIONS).length, 167);
  assert.equal(required.filter(entry => SKILL_MOTIONS[entry.caseId]?.range === 'ranged').length, 190);
  for (const entry of required) {
    const motion = SKILL_MOTIONS[entry.caseId];
    assert.ok(families.has(motion?.family), entry.caseId);
    if (!audit.design.firstWave.families.includes(entry.family)) assert.equal(motion.family, entry.family, entry.caseId);
  }
});

test('the four Dragon Claws and Fire Breath choose the intended art by original slot', () => {
  for (const [key, frame] of [
    ['ally/ancient_dragon/2', 'idle'], ['ally/gold_dragon/3', 'idle'],
    ['ally/skull_dragon/2', 'idle'], ['ally/red_dragon/3', 'attack']
  ]) {
    const motion = resolve(key);
    assert.equal(motion.family, 'claw', key);
    assert.equal(motion.frame, frame, key);
  }
  const breath = resolve('ally/red_dragon/2');
  assert.equal(breath.frame, 'idle');
  assert.equal(breath.range, 'ranged');
});

test('magic-type melee retains its family and an inherited guillotine only changes size', () => {
  const key = 'ally/executor/3';
  assert.equal(rosterSkill(key).type, 'mag');
  const direct = resolve(key, { casterSprite: 'executor' });
  assert.deepEqual(direct, {
    family: 'blade', variant: 'guillotine', range: 'melee', frame: 'idle', socket: 'hand', tint: 'dark', size: 'quiet'
  });
  assert.deepEqual(resolve(key, { heirloom: true, casterSprite: 'executor' }), { ...direct, size: 'big' });
  assert.equal(resolve('ally/zeke/2').frame, 'attack');
  assert.equal(resolve('ally/zeke/2').family, 'blade');
  assert.equal(resolve('boss/gray/1', { side: 'enemy', salience: 'boss' }).size, 'big');
  assert.equal(resolve('ally/gray/3', { casterSprite: 'prophet' }).frame, 'idle');
});

test('physical basics are quiet and unknown or stale source keys fall back', () => {
  const basic = resolveMotion({
    skill: { name: '일반 공격', type: 'phy', tier: 3, val: 4 },
    side: 'ally', isBasic: true, salience: 'boss', casterSprite: 'ancient_dragon'
  });
  assert.deepEqual(basic, { family: 'impact', variant: 'strike', range: 'melee', frame: 'idle', size: 'quiet' });
  assert.equal(resolve('boss/iris_love/3', { side: 'enemy' }).variant, 'absorb');
  assert.deepEqual(resolve('ally/ash/2'), {
    family: 'fall', variant: 'meteor', range: 'ranged', frame: 'idle', socket: 'top', tint: 'fire', size: 'big'
  });
  assert.equal(resolve('ally/executor/3', { skill: rosterSkill('ally/zeke/2') }).family, 'orb');
  assert.equal(resolve('ally/aurora_wing/2').family, 'drift');
  const fallback = (type, effects, val = 2, salience = 'boss') =>
    resolveMotion({ skill: { name: 'new skill', type, effects, val }, side: 'enemy', salience });
  for (const [type, effects, val, family, variant] of [
    ['phy', ['multi_hit'], 2, 'blade', 'double'],
    ['mag', ['random_mult'], 4, 'fall', 'rain'],
    ['mag', ['consume_field_all'], 4, 'blast', 'burst'],
    ['phy', ['self_hp_cost_ratio'], 2, 'fall', 'meteor'],
    ['mag', [], 4, 'fall', 'meteor'],
    ['phy', [], 2, 'impact', 'body'],
    ['mag', [], 2, 'ray', 'straight']
  ]) {
    const motion = fallback(type, effects, val);
    assert.deepEqual([motion.family, motion.variant, motion.size], [family, variant, 'big']);
  }
  assert.equal(fallback('phy', [], 2, 'quiet').variant, 'strike');
  assert.equal(fallback('mag', [], 2, 'quiet').variant, 'bolt');
});

test('sockets follow crop rounding, mirror on the drawn pixel, and fall back to hand then chest', () => {
  const meta = { w: 34, h: 49, cx: 12, fy: 45 };
  const actor = { x: 68.5, y: 124, ox: 1.5, oy: -3 };
  const sockets = { hand: [24, 32], mouth: [18, 10] };
  assert.deepEqual(socketPoint(actor, meta, sockets, 'mouth'), { x: 76, y: 85 });
  assert.deepEqual(socketPoint({ ...actor, flip: true }, meta, sockets, 'mouth'), { x: 63, y: 85 });
  assert.deepEqual(socketPoint(actor, meta, sockets, 'eye'), { x: 82, y: 107 });
  assert.deepEqual(socketPoint(actor, meta, {}, 'hand'), { x: 70, y: 104 });
  assert.deepEqual(socketPoint(actor, meta, sockets, 'ground'), { x: 70, y: 121 });
  const from = { x: 0, y: 30 }, to = { x: 90, y: 40 };
  assert.deepEqual(motionPoint(from, to, 0.5, 20), { x: 45, y: 15 });
  assert.equal(rangedTiming({ family: 'shot', from, to, big: false }).travel, Math.hypot(90, 10) / 900);
  assert.equal(rangedTiming({ family: 'shot', from, to, big: true }).travel, Math.hypot(90, 10) / 700);
  assert.deepEqual(rangedTiming({ family: 'ray', still: true }), { travel: 0, hold: 0.09 });
});

for (const dir of [1, -1]) {
  test(`contact meets the opaque edge with both lanes aligned (direction ${dir})`, () => {
    const caster = { x: dir > 0 ? 46.3 : 165.7, y: -14, flip: dir < 0, ox: -3, oy: 2 };
    const target = { x: dir > 0 ? 165.7 : 46.3, y: 6, flip: dir > 0, ox: dir * 2, oy: 1 };
    const casterMeta = sp['red_dragon-attack'], targetMeta = sp['night_bat-hurt'];
    assert.notEqual(casterMeta.feetBaselineY, targetMeta.feetBaselineY);
    const offset = contactOffset({ caster, target, casterMeta, targetMeta, dir });
    const from = spriteBox({ ...caster, ...offset }, casterMeta), to = spriteBox(target, targetMeta);
    const overlap = dir > 0 ? from.right - to.left : to.right - from.left;
    assert.ok(overlap >= 4 && overlap <= 6, `Overlap was ${overlap}px`);
    assert.equal(from.feet, to.feet);
    assert.notEqual(from.top, to.top);
    assert.equal(offset.oy, 21);
  });
}

function battle(party, { seed = 7, enemy = roster.wildOf('golem'), ...options } = {}) {
  const stats = { hp: 18000, atk: 20, matk: 20, def: 60, mdef: 60 };
  const b = createBattle(core, { party: [party], enemies: [{ ...enemy, stats }], seed, ...options });
  b.start();
  return b;
}

function act(b, name) {
  const option = b.options().find(o => o.name === name);
  assert.ok(option?.usable, name);
  return b.act(option.index);
}

test('native, inherited, shadow and wild actions emit original slot keys', () => {
  const name = '섀도우길로틴', key = 'ally/executor/3';
  const direct = act(battle('executor'), name).find(e => e.t === 'act' && e.skill.name === name);
  const heirlooms = { ash: { from: 'executor', name } };
  const inherited = act(battle('ash', { heirlooms }), name).find(e => e.t === 'act' && e.skill.name === name);
  assert.equal(direct.sourceKey, key);
  assert.equal(inherited.sourceKey, key);
  assert.equal(inherited.heirloom, true);
  for (const [enemy, expected] of [[roster.shadowOf('executor'), key], [roster.wildOf('night_bat'), 'wild/wild_night_bat/1']]) {
    const b = battle('ash', { enemy, tempo: { pattern: 'introFixed' } });
    const cast = b.act(0).find(e => e.t === 'act' && e.who.side === 'enemy');
    assert.equal(cast?.sourceKey, expected);
  }
});

test('roulette keeps the original slot both immediately and after a delayed copy', () => {
  for (const [seed, name, expected, immediate] of [
    [9, '라그나로크', 'ally/zeke/3', true], [15, '차원절단', 'ally/gray/3', false]
  ]) {
    const b = battle('prophet', { seed });
    const events = act(b, '슈퍼내추럴');
    assert.equal(events.some(e => e.t === 'act' && e.skill.name === name), immediate);
    const cast = [...events, ...b.act(0), ...b.act(0), ...b.act(0)].find(e => e.t === 'act' && e.skill.name === name);
    assert.equal(cast?.sourceKey, expected);
    assert.equal(cast.who.side, 'ally');
    assert.equal(resolve(cast.sourceKey, { casterSprite: 'prophet' }).family, 'blade');
  }
});

test('a melee hit emits its prop and settles damage once, then resets the contact offsets', async () => {
  const stage = createStage({ sp });
  const actor = stage.makeActor({ sprite: 'ancient_dragon', x: 65 });
  const target = stage.makeActor({ sprite: 'night_bat', flip: true, x: 143, y: -4 });
  const counts = { hp: 0, number: 0, sound: 0 };
  const moves = createMoves({
    stage: { ...stage, number: () => counts.number++ },
    sfx: { swing: () => counts.sound++ },
    actorOf: () => target, unitOf: () => ({ hp: 70, maxHp: 100 }),
    colorsOf: () => ['#fff', '#f90', '#720'],
    applyHp() {
      counts.hp++;
      assert.equal(actor.pose, 'idle');
      assert.equal(stage.S.props[0]?.family, 'claw');
      const from = spriteBox(actor, sp['ancient_dragon-idle']);
      const to = spriteBox(target, sp['night_bat-hurt']);
      assert.equal(from.right - to.left, 5);
    }
  });
  const who = { side: 'ally', idx: 0 }, enemy = { side: 'enemy', idx: 0 };
  const sourceKey = 'ally/ancient_dragon/2';
  const move = moves.beginMove({ who, target: enemy, sourceKey, skill: rosterSkill(sourceKey) }, actor, false);
  const hit = moves.strikeAndHit(move, { event: { who: enemy, amount: 30 } }, { best: 0 }, false);
  await stage.advance(0.5);
  await hit;
  assert.deepEqual(counts, { hp: 1, number: 1, sound: 1 });
  assert.equal(stage.S.props.length, 0);
  const settle = moves.settleMove(move);
  await stage.advance(0.2);
  await settle;
  assert.deepEqual([actor.ox, actor.oy, actor.front, target.pose], [0, 0, 0, 'idle']);
});

test('a warded heirloom in reduced motion marks contact without moving and restores the recipient', async () => {
  const stage = createStage({ sp });
  const actor = stage.makeActor({ sprite: 'ash', x: 65 });
  const target = stage.makeActor({ sprite: 'night_bat', flip: true, x: 143, y: -4 });
  let guards = 0;
  const moves = createMoves({
    stage: { ...stage, reducedMotion: () => true, number: () => {} },
    sfx: { guard: () => guards++ },
    actorOf: () => target, unitOf: () => ({ hp: 70, maxHp: 100 }),
    card: roster.card, spr: id => sp[id + '-idle'],
    colorsOf: () => stage.ELEMENT_COLORS.fire,
    applyHp: () => assert.fail('A warded action must not apply HP')
  });
  const who = { side: 'ally', idx: 0 }, enemy = { side: 'enemy', idx: 0 };
  const sourceKey = 'ally/executor/3';
  const move = moves.beginMove({ who, target: enemy, sourceKey, skill: rosterSkill(sourceKey),
    heirloom: true, heirFrom: 'executor' }, actor, false);
  assert.equal(actor.vis, false);
  const miss = moves.strikeMiss(move, 'magic_guard');
  await stage.advance(0.04);
  assert.equal(stage.S.props[0]?.still, true);
  assert.equal(stage.S.props[0]?.landed, false);
  assert.deepEqual([move.actor.ox, move.actor.oy, stage.clock.tweens.length], [0, 0, 0]);
  await stage.advance(0.3);
  await miss;
  await moves.settleMove(move);
  assert.equal(guards, 1);
  assert.equal(actor.vis, true);
  assert.deepEqual(stage.S.actors, [actor, target]);
  assert.equal(stage.S.props.length, 0);
});

for (const still of [false, true]) {
  test(`an orb applies the HP event at arrival once (reduced motion ${still})`, async () => {
    const stage = createStage({ sp, sockets: { 'fairy-attack': { hand: [0, 0] } } });
    const source = stage.makeActor({ sprite: 'fairy', x: 51 });
    const target = stage.makeActor({ sprite: 'night_bat', x: 149, flip: true });
    const counts = { hp: 0, number: 0, cast: 0, hit: 0 };
    const moves = createMoves({
      stage: { ...stage, reducedMotion: () => still, number: () => counts.number++ },
      sfx: { cast: () => counts.cast++, hit: () => counts.hit++ },
      actorOf: () => target, unitOf: () => ({ hp: 70, maxHp: 100 }),
      colorsOf: () => stage.ELEMENT_COLORS.light,
      applyHp() {
        counts.hp++;
        const [fx] = stage.S.props;
        assert.equal(move.stage, 'hit');
        assert.equal(fx.arrived, stage.clock.t);
        assert.equal(fx.family, 'orb');
        assert.equal(fx.travel === 0, still);
        assert.deepEqual(fx.from, stage.socket(source, 'hand'));
      }
    });
    const sourceKey = 'ally/fairy/2', enemy = { side: 'enemy', idx: 0 };
    const move = moves.beginMove({ who: { side: 'ally', idx: 0 }, target: enemy,
      sourceKey, skill: rosterSkill(sourceKey) }, source, false);
    const hit = moves.strikeAndHit(move, { event: { who: enemy, amount: 30 } }, { best: 0 }, false);
    if (still) {
      await Promise.resolve();
      assert.equal(counts.hp, 1);
    } else {
      await stage.advance(0.035);
      assert.equal(counts.hp, 0);
      assert.equal(move.stage, 'ready');
    }
    await stage.advance(0.36);
    await hit;
    assert.deepEqual(counts, { hp: 1, number: 1, cast: 1, hit: 1 });
    assert.equal(stage.S.props.length, 0);
  });
}
