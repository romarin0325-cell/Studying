import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FORM_ART, FORM_MARKERS, FORM_OUTLINE_WIDTH, SKILL_MOTIONS } from '../src/content/skill-motions.js';
import { create as createBattle } from '../src/engine/bridge.js';
import { createStage } from '../src/stage/stage.js';
import { contactOffset, motionPoint, rangedTiming, resolveMotion, socketPoint, spriteBox } from '../src/ui/battle/motion.js';
import { createMoves } from '../src/ui/battle/moves.js';
import { planBattleAction } from '../src/ui/battle/view.js';
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
    if (!audit.design.firstWave.families.includes(entry.family) && entry.variant !== '예약') {
      assert.equal(motion.family, entry.family, entry.caseId);
    }
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

test('magic-type melee retains its family', () => {
  const key = 'ally/executor/3';
  assert.equal(rosterSkill(key).type, 'mag');
  const direct = resolve(key, { casterSprite: 'executor' });
  assert.deepEqual(direct, {
    family: 'blade', variant: 'guillotine', range: 'melee', frame: 'idle', socket: 'hand', tint: 'dark', size: 'big'
  });
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
  assert.notEqual(inherited.skill.val, direct.skill.val);
  const guillotine = motionForCast(direct, 'executor');
  assert.deepEqual(motionForCast(inherited, inherited.heirFrom), guillotine);
  for (const [enemy, expected] of [[roster.shadowOf('executor'), key], [roster.wildOf('night_bat'), 'wild/wild_night_bat/1']]) {
    const b = battle('ash', { enemy, tempo: { pattern: 'introFixed' } });
    const cast = b.act(0).find(e => e.t === 'act' && e.who.side === 'enemy');
    assert.equal(cast?.sourceKey, expected);
    if (expected === key) assert.deepEqual(motionForCast(cast, 'executor'), guillotine);
  }
  const shadow = battle('ash', { enemy: roster.shadowOf('zeke'), tempo: { pattern: 'introFixed' } })
    .act(0).find(e => e.t === 'act' && e.who.side === 'enemy');
  assert.equal(motionForCast(shadow, 'zeke').size, 'big');
  assert.deepEqual(motionForCast(shadow, 'zeke'), resolve(shadow.sourceKey, { casterSprite: 'zeke' }));
});

function motionForCast(cast, casterSprite, casterForm) {
  return resolveMotion({ ...cast, side: cast.who.side, casterSprite, casterForm });
}

test('roulette keeps the original slot both immediately and after a delayed copy', () => {
  for (const [seed, name, expected, immediate] of [
    [9, '라그나로크', 'ally/zeke/3', true], [15, '차원절단', 'ally/gray/3', false]
  ]) {
    const b = battle('prophet', { seed });
    const events = act(b, '슈퍼내추럴');
    assert.equal(events.some(e => e.t === 'act' && e.skill.name === name), immediate);
    const parent = planBattleAction(events, events.findIndex(e => e.t === 'act'), { core });
    assert.equal(parent.followUp, immediate);
    assert.equal(parent.effects.some(effect => effect.kind === 'delay'), !immediate);
    const cast = [...events, ...b.act(0), ...b.act(0), ...b.act(0)].find(e => e.t === 'act' && e.skill.name === name);
    assert.equal(cast?.sourceKey, expected);
    assert.equal(cast.trigger, immediate ? 'follow-up' : 'reserved');
    assert.deepEqual(motionForCast(cast, 'prophet'), { ...resolve(expected), frame: 'idle' });
  }
});

test('form and heirloom casts use the original larva art and the form’s slot and outline', () => {
  assert.equal(FORM_OUTLINE_WIDTH, 2);
  assert.equal(new Set(Object.values(FORM_MARKERS).map(String)).size, 3);
  for (const [form, label, name, slot] of [
    ['aurora_wing', '오로라윙', '미라클파우더', 2],
    ['abyss_wing', '어비스윙', '카오스파우더', 2]
  ]) {
    const b = battle(FORM_ART);
    const larva = act(b, '기적의우화');
    const cocoon = act(b, '기적의우화 → ' + label);
    assert.equal(larva.find(e => e.t === 'form')?.form, 'mirror_cocoon');
    assert.equal(cocoon.find(e => e.t === 'form')?.form, form);
    assert.deepEqual(motionForCast(cocoon.find(e => e.t === 'act'), FORM_ART, 'mirror_cocoon'),
      { ...motionForCast(larva.find(e => e.t === 'act'), FORM_ART), marker: 'mirror_cocoon' });
    const direct = act(b, name).find(e => e.t === 'act');
    assert.equal(direct.sourceKey, `ally/${form}/${slot}`);
    const inherited = act(battle('ash', { heirlooms: { ash: { from: FORM_ART, form, name } } }), name).find(e => e.t === 'act');
    assert.deepEqual(motionForCast(inherited, FORM_ART, form), motionForCast(direct, FORM_ART, form));
    const stage = createStage({ sp });
    const recipient = stage.makeActor({ sprite: 'ash', x: 65 });
    const { moves } = motionHarness(stage, recipient, stage.makeActor({ sprite: 'night_bat', x: 143 }));
    const move = moves.beginMove(inherited, recipient, false);
    assert.deepEqual([move.actor.form, move.motion.marker], [form, form]);
    assert.equal(stage.meta(move.actor, 'idle'), sp[FORM_ART + '-idle']);
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

function motionHarness(stage, caster, target, { casterHp = 100, still = false } = {}) {
  const hp = [], labels = [], props = [];
  const who = { side: 'ally', idx: 0 }, foe = { side: 'enemy', idx: 0 };
  const moves = createMoves({
    stage: {
      ...stage, reducedMotion: () => still, plate: () => ({ remove() {} }),
      prop(fx) { props.push(fx); return stage.prop(fx); },
      number(label, x, y, cls) { labels.push({ label, cls, at: stage.clock.t }); }
    },
    sfx: new Proxy({}, { get: () => () => {} }),
    actorOf: ref => ref.side === 'ally' ? caster : target,
    unitOf: ref => ({ name: ref.side, hp: ref.side === 'ally' ? casterHp : 100, maxHp: 100 }),
    colorsOf: () => stage.ELEMENT_COLORS.light,
    card: roster.card, spr: id => sp[id + '-idle'],
    applyHp(e) { hp.push({ event: e, at: stage.clock.t }); }
  });
  return { moves, hp, labels, props, who, foe };
}

test('Festival Night clocks the caster at cast and plays three real hits on their exact turns', async () => {
  const b = battle('fireworks_girl');
  const name = '페스티벌나이트';
  const events = [...act(b, name), ...b.act(0), ...b.act(0)];
  const casts = events.flatMap((e, index) => e.t === 'act' && e.skill.name === name
    ? [{ e, plan: planBattleAction(events, index, { core }) }] : []);
  assert.deepEqual(casts.map(({ e }) => [e.s.turn, e.trigger]), [
    [1, undefined], [2, 'reserved'], [3, 'reserved'], [4, 'reserved']
  ]);
  assert.deepEqual(casts[0].plan.effects.find(effect => effect.kind === 'delay')?.turns, [2, 3, 4]);
  assert.equal(casts[0].plan.hp.size, 0);
  const stage = createStage({ sp });
  const caster = stage.makeActor({ sprite: 'fireworks_girl', x: 65 });
  const target = stage.makeActor({ sprite: 'night_bat', x: 143 });
  const { moves, props, hp, labels } = motionHarness(stage, caster, target);
  const reserve = moves.beginMove(casts[0].e, caster, false, casts[0].plan);
  const preparation = moves.playCast(reserve);
  assert.equal(props[0].family, 'mark');
  assert.equal(props[0].variant, 'reserve');
  assert.equal(props[0].target, caster);
  assert.deepEqual(props[0].from, stage.socket(caster, 'top'));
  await stage.advance(0.24);
  await preparation;
  await moves.settleMove(reserve);
  assert.equal(hp.length, 0);
  for (const { e, plan } of casts.slice(1, 3)) {
    const move = moves.beginMove(e, caster, false, plan);
    const [step] = plan.hp.values();
    assert.equal(step.strike, true);
    const playback = moves.strikeAndHit(move, step, { best: 0 }, false);
    const fx = props.at(-1);
    assert.deepEqual([fx.family, fx.variant, fx.launch], ['blast', 'eruption', true]);
    assert.deepEqual(fx.from, stage.socket(caster, 'top'));
    await stage.advance(0.4);
    await playback;
    assert.equal(hp.at(-1).at, fx.arrived);
    await moves.settleMove(move);
  }
  const { e, plan } = casts[3];
  // The core cancels dead casters' reservations. If a recorded hit has no live sprite, playback still has an origin.
  caster.vis = false;
  const move = moves.beginMove(e, caster, false, plan);
  const playback = moves.strikeAndHit(move, [...plan.hp.values()][0], { best: 0 }, false);
  assert.equal(move.fx.from.x, 0);
  assert.equal(move.fx.family, 'blast');
  await stage.advance(0.5);
  await playback;
  assert.equal(hp.at(-1).at, move.fx.arrived);
  assert.equal(caster.vis, false);
  assert.equal(hp.length, 3);
  assert.equal(labels.length, 3);
  assert.ok(labels.every((label, i) => label.at === hp[i].at));
});

test('instant follow-ups and a same-cast repeat mark each HP event; a random multiplier marks once', async t => {
  const oldDocument = globalThis.document;
  globalThis.document = { querySelectorAll: () => [] };
  t.after(() => { globalThis.document = oldDocument; });
  for (const [lead, skill, extra, expected] of [
    ['fireworks_girl', '페스티벌나이트', { party: ['fireworks_girl', 'time_magician'] }, 3],
    ['gray', '영혼절단', {}, 1],
    ['rumi_wedding', '하트샤워', {}, 2]
  ]) {
    const b = battle(lead, extra);
    const events = act(b, skill);
    if (lead === 'rumi_wedding') {
      // The core currently aggregates its damage. Replay a second distinct HP event in this same cast.
      const i = events.findIndex(e => e.t === 'hp' && e.cause?.skill === skill);
      assert.ok(i > 0);
      events.splice(i + 1, 0, { ...events[i], amount: 7, delta: -7 });
    }
    const stage = createStage({ sp });
    const caster = stage.makeActor({ sprite: lead, x: 65 });
    const target = stage.makeActor({ sprite: 'night_bat', x: 143 });
    const { moves, props, hp, labels } = motionHarness(stage, caster, target, { still: true });
    for (const [index, cast] of events.entries()) {
      if (cast.t !== 'act' || cast.skill.name !== skill) continue;
      const plan = planBattleAction(events, index, { core });
      assert.equal(plan.effects.some(effect => effect.kind === 'delay'), false);
      const move = moves.beginMove(cast, caster, false, plan);
      await moves.playCast(move);
      for (const step of plan.hp.values()) {
        if (!step.strike) continue;
        const strike = moves.strikeAndHit(move, step, { best: 0 }, false);
        await Promise.resolve();
        await stage.advance(0.4);
        await strike;
      }
      const settle = moves.settleMove(move);
      await stage.advance(0.2);
      await settle;
    }
    assert.equal(props.length, expected, lead);
    assert.equal(hp.length, expected, lead);
    assert.equal(labels.length, expected, lead);
    assert.ok(hp.every(({ at }, i) => at === props[i].arrived && at === labels[i].at), lead);
  }
});

test('MP-only Soul Drain travels from the target to the boss and changes MP at arrival', async t => {
  const oldDocument = globalThis.document;
  globalThis.document = { querySelectorAll: () => [] };
  t.after(() => { globalThis.document = oldDocument; });
  const iris = roster.bossOf('iris_love');
  const b = battle('guardian', { enemy: iris });
  let events;
  for (let i = 0; i < 7; i++) events = b.act(0);
  const index = events.findIndex(e => e.t === 'act' && e.skill.name === '소울드레인');
  assert.ok(index > 0);
  const cast = events[index], action = planBattleAction(events, index, { core });
  assert.equal(action.hp.size, 0);
  assert.equal(action.drains.size, 1);
  const stage = createStage({ sp });
  const target = stage.makeActor({ sprite: 'guardian', x: 65 });
  const boss = stage.makeActor({ sprite: iris.sprite, x: 143, flip: true });
  const { moves, hp, labels, props } = motionHarness(stage, target, boss);
  const move = moves.beginMove(cast, boss, true, action);
  await moves.playCast(move);
  assert.equal(props.length, 0);
  const [drain] = action.drains;
  let mp = drain.s.allies[0].mp - drain.delta, applied = 0;
  const playback = moves.playDrain(move, drain, event => {
    assert.equal(move.fx.arrived, stage.clock.t);
    mp += event.delta;
    applied++;
  });
  await stage.advance(0.4);
  assert.equal(applied, 0);
  assert.equal(move.fx.family, 'orb');
  assert.equal(move.fx.variant, 'absorb');
  assert.equal(move.fx.from.x, target.x);
  assert.deepEqual(move.fx.to, stage.socket(boss, 'hand'));
  await stage.advance(0.6);
  await playback;
  assert.equal(applied, 1);
  assert.equal(mp, 0);
  assert.equal(hp.length, 0);
  assert.deepEqual(labels.map(label => label.label), ['MP ' + drain.delta]);
});

test('battle draws its first frame immediately and draws zero frames in the idle observatory', async t => {
  const names = ['document', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const original = Object.fromEntries(names.map(key => [key, globalThis[key]]));
  t.after(() => Object.assign(globalThis, original));
  const outlines = [];
  const img = { width: 1, height: 1 };
  const ctx = {
    setTransform() {}, translate() {}, scale() {}, save() {}, restore() {}, fillRect() {}, drawImage() {},
    getImageData: () => ({ data: [255, 255, 255, 255] }),
    createImageData: (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }),
    putImageData(outline) { outlines.push(outline); }
  };
  globalThis.document = { createElement: () => ({ getContext: () => ctx }) };
  const frames = new Map();
  let id = 0, on = false, observe;
  globalThis.requestAnimationFrame = callback => { frames.set(++id, callback); return id; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  globalThis.MutationObserver = class {
    constructor(callback) { observe = callback; }
    observe() {}
    disconnect() {}
  };
  const screen = { isConnected: true, classList: { contains: name => name === 'on' && on } };
  const stage = createStage({ sp: { [FORM_ART + '-idle']: { w: 1, h: 1, cx: 0, fy: 0 } } });
  stage.IMG[FORM_ART + '-idle'] = { base: img };
  const actor = stage.makeActor({ sprite: FORM_ART, form: 'mirror_cocoon', x: 70 });
  stage.init({ closest: () => screen, getContext: () => ctx }, {});
  stage.start();
  await stage.advance(0.2);
  assert.deepEqual([stage.clock.framesDrawn, stage.clock.t, frames.size], [0, 0, 0]);
  on = true;
  observe();
  assert.deepEqual([stage.clock.framesDrawn, frames.size], [1, 1]);
  const [rim] = outlines;
  assert.deepEqual([rim.width, rim.height], [5, 5]);
  assert.deepEqual([...rim.data.slice(8, 12)], [...FORM_MARKERS[actor.form], 255]);
  const [[first, tick]] = frames;
  frames.delete(first);
  tick(performance.now() + 16);
  assert.deepEqual([stage.clock.framesDrawn, frames.size], [2, 1]);
  on = false;
  observe();
  stage.draw(performance.now());
  await stage.advance(0.5);
  assert.deepEqual([stage.clock.framesDrawn, frames.size], [2, 0]);
  on = true;
  actor.form = 'abyss_wing';
  observe();
  assert.deepEqual([stage.clock.framesDrawn, frames.size], [3, 1]);
  assert.deepEqual([...outlines.at(-1).data.slice(8, 12)], [...FORM_MARKERS[actor.form], 255]);
});
