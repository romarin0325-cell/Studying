// Checks the bridge against the real card/game rules: node --test card_pixel/game/tests/bridge.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
// Share Math so the ESM bridge can seed the card core inside the VM.
import * as Bridge from '../src/engine/bridge.js';
import { makeBossLesson } from '../src/content/boss-lessons.js';
import { create as makeRoster } from '../src/engine/roster.js';
import * as Run from '../src/engine/run.js';
import { createStage } from '../src/stage/stage.js';
import { createMoves } from '../src/ui/battle/moves.js';
import { createCoreRoster } from './support/core.mjs';
import { coreBundle } from '../tools/core-bundle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..');

function load() {
  const sandbox = { console, Math, __relayCoreTimer: Bridge.scheduleTimer, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(coreBundle(repo), sandbox, { filename: 'core-bundle.js' });
  return sandbox;
}
const S = load();
const dummy = over => Object.assign({
  id: 'test_dummy', name: '시험용 적', element: 'nature',
  stats: { hp: 5000, atk: 60, matk: 60, def: 60, mdef: 60 },
  skills: [{ name: '강타', type: 'phy', val: 2.0, rate: 0.3 }]
}, over);
const battle = opts => Bridge.create(S.RelayCore, Object.assign({ party: ['red_dragon', 'ash', 'luna'], enemies: [dummy()], seed: 7 }, opts));
const last = (events, t) => events.filter(e => e.t === t).pop();
const plain = value => JSON.parse(JSON.stringify(value));
const option = (b, name) => b.options().find(o => o.name === name);
const quietEnemy = (hp = 99999, overrides = {}) => dummy({
  stats: { hp, atk: 0, matk: 0, def: 60, mdef: 60, ...overrides }, skills: []
});

function bossFixture(id, stats) {
  const data = S.RelayCore.ENEMIES.find(enemy => enemy.id === id);
  return { ...plain(data), boss: true, stats: { hp: 99999, atk: 0, matk: 0, def: 60, mdef: 60, ...stats } };
}

test('Soul Drain previews zero HP damage, the incoming MP, and the actual response to a ward or evasion', () => {
  function prepare(kind, preventedBy) {
    const lesson = kind === 'flat' ? makeBossLesson('iris_love', 6, 0) : null;
    const b = battle({
      party: ['snow_rabbit', null, 'guardian'],
      enemies: [lesson ? quietEnemy() : bossFixture('iris_love')],
      ...(lesson && { tempo: { pattern: 'threeBeat', lesson } })
    });
    let events = b.start();
    const turn = lesson ? 2 : 7;
    const player = b.host.battle.players[0];
    const incoming = b.host.battle.players[2];
    player.mp = 34;
    incoming.mp = 18;
    if (preventedBy === 'magic_guard') player.buffs.magic_guard = 15;
    if (preventedBy === 'evasion') player.baseEva = 100;
    for (let i = 1; i < turn; i++) events = b.act(0);
    return { b, intent: last(events, 'await').intent };
  }
  for (const type of ['flat', 'all']) {
    for (const blocked of ['magic_guard', 'evasion', null]) {
      const { b, intent } = prepare(type, blocked);
      assert.deepEqual(intent.damageRange, [0, 0]);
      assert.deepEqual([intent.resourceEffect.mode, intent.resourceEffect.before, intent.resourceEffect.after, intent.resourceEffect.preventedBy],
        [type, 34, blocked ? 34 : type === 'flat' ? 10 : 0, blocked]);
      const rule = b.act(0).find(event => event.actionId === intent.actionId && event.t === 'rule');
      assert.deepEqual([rule.target, rule.before, rule.after, rule.preventedBy],
        [{ side: 'ally', idx: 0 }, 34, intent.resourceEffect.after, blocked]);
    }
    const { b } = prepare(type, null);
    const preview = b.previewRetreat();
    for (let i = 0; i < 5; i++) assert.deepEqual(b.previewRetreat(), preview);
    assert.deepEqual([preview.intent.target, preview.intent.resourceEffect.before, preview.intent.resourceEffect.after],
      [{ side: 'ally', idx: 2 }, 18, 0]);
    assert.equal(b.previewRelay().retreat.next.mpAfter, 0);
    const response = b.retreat().find(event => event.t === 'rule' && event.actionId === preview.intent.actionId);
    assert.deepEqual([response.target, response.before, response.after], [preview.intent.target, 18, 0]);
  }
});

test('Retaliation resolves the conditional power from actual damage, including scheduled hits', () => {
  function prepare(delayed) {
    const b = battle({ party: ['snow_rabbit', 'guardian'], enemies: [bossFixture('pharaoh')], seed: 8207928 });
    let wait = last(b.start(), 'await');
    const player = b.host.battle.players[0];
    player.baseEva = -100;
    player.mdef = 60;
    player.maxHp = player.hp = 250;
    player.skills.push({ name: '검증용 대기', type: 'sup', cost: 0, effects: [] });
    if (delayed) b.host.battle.delayedEffects.push({
      turn: 5, source: player, skill: { name: '예약 검증', type: 'phy', tier: 1, val: 1, effects: [] }
    });
    for (let i = 1; i <= 4; i++) {
      if (i === 4) b.host.battle.enemy.matk = b.host.battle.enemy.baseMatk = 200;
      wait = last(b.act(0), 'await');
    }
    return { b, wait };
  }
  for (const branch of ['hit', 'pass', 'scheduled']) {
    const { b, wait } = prepare(branch === 'scheduled');
    assert.equal(wait.intent.conditions[0].met, branch === 'scheduled' ? true : null);
    assert.deepEqual(wait.intent.damageRange, branch === 'scheduled' ? [375, 375] : [125, 375]);
    assert.equal(wait.intent.lethalText, branch === 'scheduled' ? '명중 시 쓰러짐' : '쓰러질 수 있음');
    const move = branch === 'hit' ? 0 : option(b, '검증용 대기').index;
    const events = b.act(move);
    const hp = events.find(event => event.t === 'hp' && event.cause?.by?.side === 'enemy');
    assert.equal(hp.amount, branch === 'pass' ? 125 : 375);
    const rule = events.find(event => event.t === 'rule' && event.actionId === wait.intent.actionId);
    assert.equal(rule.before.enemyHitThisTurn, branch !== 'pass');
  }
});

test('the lesson cleanse, temporary defense and first-cycle tower tide use the stated values', () => {
  function lessonBattle(id, floor, region, enemy = quietEnemy()) {
    const lesson = makeBossLesson(id, floor, 0);
    const tempo = { pattern: region ? 'tide' : 'threeBeat', lesson };
    return battle({ enemies: [enemy], region, tempo });
  }
  const trench = lessonBattle('poseidon', 6, { id: 'tide_cycle' });
  trench.start();
  const cleanse = last(trench.act(0), 'await').intent;
  assert.deepEqual(cleanse.debuffs, { corrosion: 1, curse: 1 });
  const rule = trench.act(0).find(event => event.t === 'rule' && event.actionId === cleanse.actionId);
  assert.deepEqual(rule.before, cleanse.debuffs);
  assert.deepEqual(rule.after, {});

  const flora = lessonBattle('flora', 6);
  flora.start();
  flora.act(0);
  const normal = flora.options()[0].preview.dmg;
  flora.act(0);
  assert.equal(flora.options()[0].preview.dmg, Math.floor(normal * 0.5));
  flora.act(0);
  assert.equal(flora.options()[0].preview.dmg, normal);

  const protocol = lessonBattle('artificial_demon_god', 6);
  protocol.start();
  const change = protocol.act(0);
  const defense = change.find(event => event.t === 'rule' && event.rule === 'defense_protocol');
  assert.deepEqual(defense.after, { type: 'phy', def: 81 });
  assert.equal(last(change, 'await').intent.defenseProtocol.bonus, 0.35);

  const tower = lessonBattle('creator_god', 6, { id: 'tide_cycle' });
  assert.equal(last(tower.start(), 'await').intent.kind, 'phy');
  assert.equal(last(tower.act(0), 'await').intent.kind, 'mag');
  assert.equal(last(tower.act(0), 'await').intent.name, '잔물결');
  assert.equal(last(tower.act(0), 'await').intent.kind, 'rest');
  for (let i = 0; i < 2; i++) tower.act(0);
  assert.equal(last(tower.act(0), 'await').intent.name, '조류의 일격');
});

test('tempo three-beat countdown and resolved hits restart on the second shadow', () => {
  const first = dummy();
  const second = dummy({ name: '둘째', skills: [{ name: '서리 파동', type: 'mag', val: 2, rate: 0.3 }] });
  const b = battle({ enemies: [first, second], tempo: { pattern: 'threeBeat', startMp: 65 }, quirk: 'surge' });
  const start = last(b.start(), 'await');
  assert.equal(start.s.allies[0].mp, 200);
  assert.deepEqual(start.countdown, { name: '강타', inTurns: 1, charge: false });
  const checkBeat = (wait, name, type, power) => {
    assert.equal(wait.intent.name, name);
    assert.equal(wait.intent.type, type);
    const events = b.act(0);
    const action = events.find(event => event.t === 'act' && event.who.side === 'enemy');
    assert.deepEqual([action.skill.name, action.skill.type, action.skill.val], [name, type, power]);
    const hit = events.find(event => event.t === 'hp' && event.who.side === 'ally');
    assert.ok(hit);
    assert.deepEqual(wait.intent.damageRange, [hit.amount, hit.amount]);
    return last(events, 'await');
  };
  const strong = checkBeat(start, '일반 공격', 'phy', 1);
  assert.deepEqual(strong.countdown, { name: '강타', inTurns: 0, charge: false });
  const weak = checkBeat(strong, '강타', 'phy', 2.3);
  checkBeat(weak, '약공', 'phy', 0.55);
  b.host.battle.enemy.hp = 1;
  const entry = last(b.act(0), 'await');
  assert.equal(entry.s.enemy.idx, 1);
  assert.deepEqual(entry.countdown, { name: '서리 파동', inTurns: 1, charge: false });
  const nextStrong = checkBeat(entry, '일반 공격', 'phy', 1);
  assert.deepEqual(nextStrong.countdown, { name: '서리 파동', inTurns: 0, charge: false });
  checkBeat(nextStrong, '서리 파동', 'mag', 2.3);
});

test('tempo tide has a fixed x2.5 spell and a fourth-beat opening even on a strong magic shadow', () => {
  const enemy = dummy({ skills: [{ name: '마법', type: 'mag', val: 3, rate: 0.3 }] });
  const b = battle({ enemies: [enemy], tempo: { pattern: 'tide', startMp: 65 }, region: { id: 'tide_cycle' } });
  const start = last(b.start(), 'await');
  assert.equal(start.intent.kind, 'phy');
  assert.equal(start.countdown.inTurns, 2);
  const ripple = b.act(0);
  assert.equal(last(ripple, 'await').intent.name, '잔물결');
  const incoming = last(b.act(0), 'await');
  assert.equal(incoming.intent.type, 'mag');
  assert.deepEqual(incoming.countdown, { name: incoming.intent.name, inTurns: 0, charge: false });
  const events = b.act(0);
  const action = events.find(event => event.t === 'act' && event.who.side === 'enemy');
  assert.deepEqual([action.skill.name, action.skill.type, action.skill.val], [incoming.intent.name, 'mag', 2.5]);
  const rest = last(events, 'await');
  assert.equal(rest.intent.type, 'rest');
  assert.equal(rest.intent.vulnerable, 1.5);
  assert.equal(last(b.act(0), 'await').intent.kind, 'phy');
});

test('review 1: Red Moon wins when the death counter defeats the last enemy', () => {
  const b = battle({ party: ['red_moon'], seed: 0, enemies: [quietEnemy(500, { atk: 5000 })] });
  b.start();
  const events = b.act(0);
  assert.deepEqual(events.filter(e => ['enemyDown', 'win', 'lose'].includes(e.t)).map(e => e.t), ['enemyDown', 'win']);
  assert.deepEqual(b.summary().survivors.slice(), [false, false, false]);

  const relay = battle({ party: ['red_moon'], seed: 0, enemies: [quietEnemy(500, { atk: 5000 }), quietEnemy()] });
  relay.start();
  relay.act(0);
  assert.equal(relay.outcome, 'lose');
});

test('review 8: Illumination landing after two normals leaves arena charge for a direct skill', () => {
  const b = battle({ party: ['prism_twin'], seed: 1, enemies: [quietEnemy()], region: { id: 'arena_charge' } });
  b.start();
  b.act(option(b, '일루미네이션').index);
  b.act(0);
  const events = b.act(0);
  assert.ok(events.some(e => e.t === 'act' && e.delayed && e.skill.name === '일루미네이션'));
  assert.deepEqual(last(events, 'await').region, { charge: 2, ready: true });
  const direct = b.options().find(o => o.index > 0 && o.usable && o.preview?.dmg > 0);
  assert.ok(b.act(direct.index).some(e => e.rule === 'arena_charge'));
});

test('review 13: the Ice Age heirloom previews its full damage range and minimum kill', () => {
  const b = battle({
    party: ['mummy'], seed: 3, enemies: [quietEnemy(112, { mdef: 70 })],
    heirlooms: { mummy: { from: 'avalanche_maid', name: '아이스에이지' } }
  });
  b.start();
  const preview = option(b, '아이스에이지').preview;
  assert.ok(preview.min < 112 && preview.max >= 112);
  assert.ok(preview.min <= preview.dmg && preview.dmg <= preview.max);
  assert.equal(preview.kill, false);
  b.host.battle.enemy.hp = preview.min;
  assert.equal(option(b, '아이스에이지').preview.kill, true);
});

test('review 16: Guardian previews Pangaea Rebirth damage with Time Magician in reserve', () => {
  const config = { seed: 1, enemies: [quietEnemy()] };
  const instant = battle({ ...config, party: ['guardian', null, 'time_magician'] });
  instant.start();
  const move = option(instant, '판게아리버스');
  assert.equal(move.preview.instant, true);
  const hit = instant.act(move.index).find(e => e.t === 'hp' && e.who.side === 'enemy');
  assert.equal(move.preview.dmg, hit.amount);
  const scheduled = battle({ ...config, party: ['guardian'] });
  scheduled.start();
  assert.deepEqual(option(scheduled, '판게아리버스').preview, { delayed: true });
});

test('Double Attack changes only the normal attack forecast and hit, including when Pangaea resolves later', () => {
  const config = { seed: 1, enemies: [quietEnemy(99999, { def: 0, mdef: 0 })] };
  const measure = (party, name, artifacts, extraTurns = 0) => {
    const b = battle({ ...config, party, artifacts });
    b.start();
    const move = option(b, name);
    const events = b.act(move.index);
    for (let i = 0; i < extraTurns; i++) events.push(...b.act(0));
    const damage = events.filter(e => e.t === 'hp' && e.who.side === 'enemy' && e.calc?.skill === move.name)
      .map(e => e.amount);
    return [move.preview, damage];
  };
  const compare = (party, name, turns) => [[], ['double_attack']].map(artifacts => measure(party, name, artifacts, turns));
  const guardian = ['guardian', null, 'time_magician'];
  const preview = dmg => ({ dmg, kill: false, forcedCrit: false });
  assert.deepEqual(compare(guardian, '일반 공격'), [[preview(143), [143]], [preview(286), [286]]]);
  for (const support of ['가드', '배틀필드']) assert.deepEqual(compare(guardian, support), [[null, []], [null, []]]);
  const instant = [{ ...preview(455), instant: true }, [455]];
  assert.deepEqual(compare(guardian, '판게아리버스'), [instant, instant]);
  const delayed = [{ delayed: true }, [455]];
  assert.deepEqual(compare(['guardian'], '판게아리버스', 4), [delayed, delayed]);
  const [base, doubled] = compare(['red_dragon'], '드래곤크로');
  assert.ok(base[0].dmg > 0 && base[0].dmg === base[1][0]);
  assert.deepEqual(doubled, base);
});

test('Arena from Battlefield or Colosseum doubles only allied normal hits', () => {
  for (const [id, support, attack] of [
    ['guardian', '배틀필드', '판게아리버스'],
    ['golem', '콜로세움', '차지어택']
  ]) {
    const b = battle({ party: [id, null, 'time_magician'], enemies: [quietEnemy(99999, { def: 0, mdef: 0 })], seed: 1 });
    b.start();
    const normal = option(b, '일반 공격').preview.dmg, special = option(b, attack).preview.dmg;
    b.act(option(b, support).index);
    assert.deepEqual(plain(b.state().field), ['arena']);
    assert.equal(option(b, '일반 공격').preview.dmg, 2 * normal);
    assert.equal(option(b, attack).preview.dmg, special);
    if (id === 'golem') assert.equal(b.state().enemy.buffs.weak, 1);
    const hit = b.act(0).find(e => e.t === 'hp' && e.who.side === 'enemy');
    assert.equal(hit.amount, 2 * normal);
  }
});

test('shadows keep enemy stats without inheriting seat or deck traits, including after a relay', () => {
  const core = S.RelayCore;
  const roster = makeRoster(core, { sp: {} });
  const ids = ['red_dragon', 'phoenix'];
  const enemies = ids.map(id => roster.shadowOf(id));
  assert.equal(roster.card(ids[0]).trait.type, 'pos_stat_boost');
  assert.equal(roster.card(ids[1]).trait.type, 'syn_fire_3_crit_burn');
  const b = battle({ party: ['red_dragon', 'phoenix', 'ash'], enemies });
  b.start();
  function check(i) {
    const enemy = b.host.battle.enemy;
    assert.equal(b.enemyIndex, i);
    assert.equal(enemy.atk, enemies[i].stats.atk);
    assert.equal(enemy.pos, undefined);
    assert.equal(enemy.proto, undefined);
    assert.equal(enemy.activeTrait, undefined);
  }
  check(0);
  b.host.battle.enemy.hp = 1;
  b.act(option(b, '드래곤크로').index);
  check(1);
});

test('heirloom act metadata drives the donor form, palette and cleanup on stage', async () => {
  const b = battle({
    party: ['ash'], enemies: [quietEnemy()],
    heirlooms: { ash: { from: 'miracle_larva', form: 'aurora_wing', name: '뷰티토네이도',
      skill: { name: '뷰티토네이도', type: 'mag', val: 3, heirloom: true } } }
  });
  b.start();
  const e = b.act(option(b, '뷰티토네이도').index).find(e => e.t === 'act' && e.heirloom);
  assert.equal(e.heirFrom, 'aurora_wing');
  assert.deepEqual(e.who, { side: 'ally', idx: 0 });
  const stage = createStage({ sp: {} });
  const actor = stage.makeActor({ sprite: 'ash', x: 20, y: -14 });
  const target = stage.makeActor({ sprite: 'golem' });
  const { beginMove, settleMove } = createMoves({
    stage: { ...stage, wait: async () => {}, tween: async (a, to) => Object.assign(a, to) },
    actorOf: () => target, unitOf: () => ({ hp: 1 }), colorsOf: () => stage.ELEMENT_COLORS.fire,
    card: id => S.RelayCore.GameUtils.getCardById(id), spr: () => ({ facing: 'left' })
  });
  const move = beginMove(e, actor, false);
  assert.equal(move.actor.sprite, 'aurora_wing');
  assert.equal(move.actor.flip, true);
  assert.equal(move.actor.x, actor.x);
  assert.equal(move.actor.y, actor.y);
  assert.equal(move.colors, stage.ELEMENT_COLORS[move.donor.element]);
  assert.notEqual(move.colors, stage.ELEMENT_COLORS.fire);
  assert.equal(actor.vis, false);
  await settleMove(move);
  assert.equal(actor.vis, true);
  assert.deepEqual(stage.S.actors, [actor, target]);

  const fromAsh = battle({ party: ['guardian'], enemies: [quietEnemy()], heirlooms: { guardian: { from: 'ash' } } });
  fromAsh.start();
  const ashAct = fromAsh.act(option(fromAsh, '아마겟돈').index).find(e => e.t === 'act' && e.heirloom);
  const effect = {};
  stage.IMG['ash-fx'] = { base: effect };
  const ashMove = beginMove(ashAct, actor, false);
  assert.equal(ashMove.effectSprite, effect);
  assert.equal(ashMove.colors, stage.ELEMENT_COLORS.fire);
  await settleMove(ashMove);
});

test('review 19: Creator charges Divine Blade on turn three and uses it next turn', () => {
  const base = S.RelayCore.ENEMIES.find(e => e.id === 'creator_god');
  const b = battle({ seed: 2, enemies: [quietEnemy(99999, { atk: 10, matk: 10 })] });
  const enemy = b.host.getCurrentStageEnemyData();
  Object.assign(enemy, { id: base.id, name: base.name, skills: base.skills });
  b.start();
  b.act(0);
  const wait = last(b.act(0), 'await');
  assert.equal(wait.intent.kind, 'charge');
  assert.deepEqual(wait.countdown, { name: '디바인블레이드', inTurns: 0, charge: true });
  b.act(0);
  const attack = b.act(0).find(e => e.t === 'act' && e.who.side === 'enemy');
  assert.equal(attack.skill.name, '디바인블레이드');
});

test('the unchanged rule files load and the first turn waits for the player', () => {
  assert.ok(S.RelayCore.GameUtils.getCardById('red_dragon'));
  const b = battle();
  const events = b.start();
  assert.ok(events.some(e => e.t === 'begin'));
  const wait = last(events, 'await');
  assert.deepEqual(plain(wait.who), { side: 'ally', idx: 0 });
  assert.equal(b.state().allies[0].hp, 420);
});

test('every playable card starts the battle before emitting any state differences', () => {
  for (const card of S.RelayCore.GameUtils.getAllCards().filter(c => !c.battleOnly)) {
    for (let pos = 0; pos < 3; pos++) {
      const party = ['zeke', 'cherry_prince', 'ash'].filter(id => id !== card.id).slice(0, 2);
      party.splice(pos, 0, card.id);
      const events = battle({ party }).start();
      const begin = events.findIndex(e => e.t === 'begin');
      const lineup = card.id + ' in slot ' + pos;
      assert.equal(begin, 0, lineup);
      assert.ok(events[begin].s, lineup);
      assert.equal(events.at(-1).t, 'await', lineup);
    }
  }
});

test('preview equals the formula and does not change the battle', () => {
  const b = battle();
  b.start();
  const before = JSON.stringify(b.state());
  const claw = b.options().find(o => o.name === '드래곤크로');
  // atk 105 x1.5 (vanguard) = 157, x1.2 element, x2.0 skill, x2.0 at full HP, def 60 -> 471
  assert.equal(claw.preview.dmg, Math.floor(157 * 1.2 * 4 * (100 / 160)));
  assert.equal(claw.preview.dmg, 471);
  assert.equal(JSON.stringify(b.state()), before);
  const guard = b.options().find(o => o.name === '가드');
  assert.equal(guard.preview, null);
});

test('a hit carries the damage breakdown and the enemy HP follows the events', () => {
  const b = battle({ seed: 3 });
  b.start();
  const index = b.options().find(o => o.name === '드래곤크로').index;
  const events = b.act(index);
  const hit = events.find(e => e.t === 'hp' && e.who.side === 'enemy');
  assert.ok(hit.calc && hit.calc.base === 157 && hit.calc.val === 2);
  assert.ok(hit.calc.lines.some(line => /위력 2배/.test(line)));
  assert.ok(hit.calc.adv);
  assert.equal(-hit.delta, hit.calc.dmg);
  assert.equal(b.state().enemy.hp, 5000 + hit.delta);
  assert.equal(b.state().allies[0].mp, 80);
});

test('rule B: the shown intent is the action the enemy then takes', () => {
  let compared = 0;
  for (let seed = 1; seed <= 25; seed++) {
    const b = battle({ seed, enemies: [dummy({ stats: { hp: 99999, atk: 40, matk: 40, def: 60, mdef: 60 } })] });
    let events = b.start();
    for (let turn = 0; turn < 12 && b.awaiting; turn++) {
      const wait = last(events, 'await');
      const targetIdx = wait.who.idx, hpBefore = b.state().allies[targetIdx].hp;
      events = b.act(0);
      const act = events.find(e => e.t === 'act' && e.who.side === 'enemy');
      if (!act) continue;
      assert.equal(act.skill.name, wait.intent.name, `seed ${seed} turn ${turn}`);
      const hurt = events.find(e => e.t === 'hp' && e.who.side === 'ally' && e.who.idx === targetIdx && e.cause.kind === 'act');
      if (hurt) {
        assert.ok(hurt.amount >= wait.intent.dmg[0] && hurt.amount <= wait.intent.dmg[1], `seed ${seed}: ${hurt.amount} not in ${wait.intent.dmg}`);
        assert.equal(b.state().allies[targetIdx].hp, Math.max(0, hpBefore + hurt.delta));
      }
      compared++;
    }
  }
  assert.ok(compared > 150);
});

test('rule A: the countdown names the scripted turn and it arrives on that turn', () => {
  const boss = { id: 'artificial_demon_god', name: '인조 마신', element: 'water', stats: { hp: 99999, atk: 10, matk: 10, def: 60, mdef: 60 },
    skills: plain(S.RelayCore.ENEMIES.find(e => e.id === 'artificial_demon_god').skills) };
  const b = battle({ enemies: [boss], seed: 11 });
  let events = b.start();
  for (let turn = 1; turn <= 10; turn++) {
    const wait = last(events, 'await');
    assert.equal(wait.countdown.name, '파괴의형태');
    assert.equal(wait.countdown.inTurns, 10 - turn);
    if (turn === 10) { assert.equal(wait.intent.name, '파괴의형태'); assert.ok(wait.intent.ult); }
    events = b.act(0);
    if (turn === 10) assert.equal(events.find(e => e.t === 'act' && e.who.side === 'enemy').skill.name, '파괴의형태');
  }
});

test('a fallen fighter triggers the relay and the next one steps in', () => {
  const brute = dummy({ stats: { hp: 99999, atk: 5000, matk: 5000, def: 60, mdef: 60 } });
  const b = battle({ enemies: [brute], seed: 5 });
  b.start();
  const events = b.act(0);
  assert.ok(events.some(e => e.t === 'down' && e.who.idx === 0));
  const relay = events.find(e => e.t === 'relay' && e.phase === 'begin' && e.linked);
  assert.ok(relay, 'ash answers an ally death');
  const counter = events.find(e => e.t === 'hp' && e.who.side === 'enemy' && e.cause.kind === 'relay');
  assert.ok(counter && counter.delta < 0);
  assert.ok(events.some(e => e.t === 'enter' && e.who.idx === 1));
  assert.deepEqual(plain(last(events, 'await').who), { side: 'ally', idx: 1 });
});

test('rule D: retreat keeps the fighter alive, costs the turn and works once', () => {
  const b = battle({ enemies: [dummy({ stats: { hp: 99999, atk: 80, matk: 80, def: 60, mdef: 60 } })], seed: 9 });
  b.start();
  assert.ok(b.canRetreat());
  const events = b.retreat();
  assert.ok(events.some(e => e.t === 'retreat' && e.who.idx === 0));
  assert.ok(!events.some(e => e.t === 'relay'), 'no death trait on retreat');
  assert.ok(!events.some(e => e.t === 'down'));
  const act = events.find(e => e.t === 'act' && e.who.side === 'enemy');
  assert.equal(act.target.idx, 1, 'the enemy acts on the newcomer');
  const state = b.state();
  assert.equal(state.allies[0].out, true);
  assert.equal(state.allies[0].hp, 420);
  assert.equal(state.cur, 1);
  assert.equal(b.canRetreat(), false);
  assert.equal(b.retreat().length, 0);
  assert.equal(b.survivors()[0], true);
});

test('rule D: the last fighter cannot retreat', () => {
  const b = battle({ party: ['luna'], seed: 2 });
  b.start();
  assert.equal(b.canRetreat(), false);
});

test('the seeded floor 2 relay forecast agrees with both actual outcomes against the second enemy', () => {
  const { core, roster } = createCoreRoster();
  const run = Run.createRun({ core, roster, dungeonId: 'ember_volcano', seed: 26019140, tempoVersion: 2 });
  for (const id of ['dragon_miko', 'zeke']) assert.equal(Run.chooseStartPick(run, id).ok, true);
  assert.equal(Run.enterBattleDoor(run, { floor: 1, index: 0, partyIds: ['werebear', 'lightning_sage', 'zeke'] }).ok, true);
  const first = Bridge.create(core, Run.battleOptions(run));
  first.start();
  for (const name of ['강타', '강타', '강타', '일반 공격', '일반 공격']) first.act(option(first, name).index);
  assert.equal(first.outcome, 'win');
  assert.equal(Run.settleBattle(run, first.summary()).ok, true);
  assert.equal(Run.resolveReinforcement(run, { key: run.pending.key, id: 'hellhound', replaceId: null }).ok, true);
  assert.equal(Run.leaveRoom(run).ok, true);
  assert.equal(Run.nextFloor(run).ok, true);
  assert.equal(Run.enterBattleDoor(run, { floor: 2, index: 0, partyIds: ['dragon_miko', 'siren', 'zeke'] }).ok, true);
  function reachDecision() {
    const b = Bridge.create(core, Run.battleOptions(run));
    let events = b.start();
    for (const name of ['드래곤스파클', '드래곤스파클', '일반 공격', '일반 공격']) events = b.act(option(b, name).index);
    assert.deepEqual([b.state().turn, b.enemyIndex, b.state().allies[0].hp], [5, 1, 62]);
    assert.deepEqual(last(events, 'await').intent.damageRange, [212, 212]);
    return b;
  }
  const retreating = reachDecision(), standing = reachDecision();
  const before = retreating.state();
  const expected = {
    danger: 'certain',
    retreat: { available: true, next: { id: 'siren', name: '세이렌', hp: 500, hpAfter: [313, 313] } },
    stand: { falls: 'certain', inheritor: { id: 'siren', name: '세이렌' }, heirloom: { skill: '드래곤스파클', from: 'dragon_miko' }, replaces: null }
  };
  const random = Math.random;
  Math.random = () => { throw new Error('previewRelay must not roll'); };
  try {
    for (let i = 0; i < 3; i++) assert.deepEqual(retreating.previewRelay(), expected);
  } finally {
    Math.random = random;
  }
  assert.deepEqual(retreating.state(), before);
  assert.deepEqual(retreating.heirloomsGained(), []);
  assert.ok(last(retreating.retreat(), 'retreat'));
  assert.deepEqual([retreating.state().cur, retreating.state().allies[1].hp], [1, 313]);
  assert.deepEqual(retreating.previewRelay().retreat, { available: false, next: null });
  const handoff = last(standing.act(0), 'heirloom');
  assert.deepEqual([handoff.to.idx, handoff.skill.name], [1, expected.stand.heirloom.skill]);
  assert.equal(standing.heirloomsGained()[0].from, expected.stand.heirloom.from);
});

test('relay forecast distinguishes possible death and reports ascending HP after a variable hit', () => {
  const enemy = quietEnemy(99999, { atk: 100 });
  enemy.skills = [{ name: '시험용 예고', type: 'phy', rate: 1, effects: [{ type: 'random_mult', min: 1, max: 3 }] }];
  const b = battle({ party: ['fairy', null, 'red_dragon'], enemies: [enemy] });
  const [low, high] = last(b.start(), 'await').intent.damageRange;
  assert.ok(low < high);
  b.host.battle.players[0].hp = high;
  const preview = b.previewRelay();
  assert.equal(preview.danger, 'possible');
  assert.equal(preview.stand.falls, 'possible');
  assert.equal(preview.stand.inheritor.id, 'red_dragon');
  const [nextLow, nextHigh] = b.previewRetreat().dmg;
  assert.deepEqual(preview.retreat.next.hpAfter, [420 - nextHigh, 420 - nextLow]);
  b.host.battle.players[0].hp = low;
  assert.equal(b.previewRelay().danger, 'certain');
});

test('relay forecast accounts for guard, barrier and active evasion', () => {
  const b = battle({ enemies: [quietEnemy(99999, { atk: 100 })] });
  const [damage] = last(b.start(), 'await').intent.damageRange;
  const player = b.host.battle.players[0];
  player.hp = damage - 1;
  assert.equal(b.previewRelay().danger, 'certain');
  for (const defense of ['guard', 'barrier', 'evasion']) {
    player.buffs = { [defense]: 1 };
    assert.equal(b.previewRelay().danger, defense === 'evasion' ? 'possible' : 'none', defense);
  }
  player.baseEva = 100;
  assert.equal(b.previewRelay().danger, 'none', 'guaranteed evasion');
});

test('relay forecast can show a lethal hit with no inheritor or retreat for the last companion', () => {
  const b = battle({ party: ['luna'], enemies: [quietEnemy(99999, { atk: 100 })] });
  b.start();
  const player = b.host.battle.players[0];
  player.hp = 1;
  player.baseEva = -100;
  assert.deepEqual(b.previewRelay(), {
    danger: 'certain', retreat: { available: false, next: null },
    stand: { falls: 'certain', inheritor: null, heirloom: null, replaces: null }
  });
  assert.ok(last(b.act(0), 'lose'));
  assert.deepEqual(b.heirloomsGained(), []);
});

test('relay forecast hands off the transformed form attack and identifies the heirloom it replaces', () => {
  const b = battle({
    party: ['miracle_larva', 'ash'], enemies: [quietEnemy(99999, { atk: 40 })],
    heirlooms: { ash: { from: 'red_dragon' } }
  });
  b.start();
  for (const name of ['기적의우화', '기적의우화 → 오로라윙']) b.act(option(b, name).index);
  assert.equal(b.state().allies[0].form, 'aurora_wing');
  const player = b.host.battle.players[0];
  player.hp = 1;
  player.baseEva = -100;
  const { stand } = b.previewRelay();
  assert.deepEqual(stand, {
    falls: 'certain', inheritor: { id: 'ash', name: '애쉬' },
    heirloom: { skill: '뷰티토네이도', from: 'miracle_larva' }, replaces: { skill: '파이어브레스' }
  });
  const inherited = last(b.act(0), 'heirloom');
  assert.equal(inherited.skill.name, stand.heirloom.skill);
  assert.equal(b.heirloomsGained()[0].form, 'aurora_wing');
  assert.deepEqual(b.summary().forms, { mirror_cocoon: 'miracle_larva', aurora_wing: 'miracle_larva' });
  assert.deepEqual(b.summary().heirloomTransfers, [{ to: 'ash', from: 'miracle_larva', skill: '뷰티토네이도' }]);
  assert.deepEqual(b.options().filter(skill => skill.heirloom).map(skill => skill.name), [stand.heirloom.skill]);
});

test('relay forecast lists the outgoing fighter’s pending reserves only once', () => {
  const b = battle({ party: ['prism_twin', 'ash'], enemies: [quietEnemy()] });
  b.start();
  b.act(option(b, '일루미네이션').index);
  assert.deepEqual(b.previewRelay().retreat.cancelsReserve, ['일루미네이션']);
});

test('rule C: enemies arrive one after another and allies keep their state', () => {
  const weak = name => dummy({ name, stats: { hp: 300, atk: 40, matk: 40, def: 60, mdef: 60 } });
  const b = battle({ enemies: [weak('첫째'), weak('둘째')], seed: 4 });
  let events = b.start();
  events = b.act(b.options().find(o => o.name === '드래곤크로').index);
  assert.ok(events.some(e => e.t === 'enemyDown'));
  const enter = events.find(e => e.t === 'enemyEnter');
  assert.equal(enter.name, '둘째');
  assert.equal(b.outcome, null);
  assert.equal(b.state().allies[0].mp, 80, 'MP is not refilled between enemies');
  assert.ok(!events.some(e => e.t === 'act' && e.who.side === 'enemy'), 'nobody attacks unannounced on the entry turn');
  assert.equal(b.state().enemy.hp, 300);
  assert.equal(b.state().allies[0].hp, 420);
  const next = last(events, 'await');
  assert.ok(next.intent && next.intent.name, 'the newcomer announces its first action');
  events = b.act(0);
  assert.equal(events.find(e => e.t === 'act' && e.who.side === 'enemy').skill.name, next.intent.name);
  for (let i = 0; i < 20 && !b.outcome; i++) events = b.act(0);
  assert.equal(b.outcome, 'win');
  assert.ok(events.some(e => e.t === 'win'));
});

test('the same seed replays the same battle', () => {
  const play = () => {
    const b = battle({ seed: 42 });
    const log = [b.start()];
    for (let i = 0; i < 8 && b.awaiting; i++) log.push(b.act(i % 3 === 2 ? 2 : 0));
    return JSON.stringify(log.map(events => events.map(e => [e.t, e.delta || 0, e.text || ''])));
  };
  assert.equal(play(), play());
});

test('instant Nightmare records only one treasure defeat per enemy', () => {
  const treasure = dummy({ affixes: ['treasure'], stats: { hp: 20, atk: 60, matk: 60, def: 60, mdef: 60 } });
  const b = battle({ party: ['phantom', 'time_magician'], enemies: [treasure, treasure] });
  b.start();
  for (let idx = 0; idx < 2; idx++) {
    const nightmare = b.options().find(o => o.name === '나이트메어');
    const events = b.act(nightmare.index);
    assert.deepEqual(plain(events.filter(e => e.t === 'enemyDown').map(e => [e.who.idx, e.treasure])), [[idx, true]]);
  }
  assert.equal(b.outcome, 'win');
  assert.deepEqual(plain(b.summary().enemyDowns), [{ idx: 0, treasure: true }, { idx: 1, treasure: true }]);
});

test('the replacement fighter enters before the enemy acts after a self-destruct', () => {
  const b = battle({ party: ['chaos_mage', 'zeke', 'ash'], enemies: [dummy({ skills: [] })] });
  b.start();
  const carnival = b.options().find(o => o.name === '카오스카니발');
  const events = b.act(carnival.index);
  const enter = events.findIndex(e => e.t === 'enter' && e.who.idx === 1);
  const act = events.findIndex(e => e.t === 'act' && e.who.side === 'enemy');
  const hit = events.findIndex(e => e.t === 'hp' && e.who.side === 'ally' && e.who.idx === 1 && e.delta < 0);
  assert.ok(enter >= 0 && enter < act && act < hit);
  assert.equal(events[act].target.idx, 1);
});

test('Miracle Larva keeps its quirk modifiers and last stand after transformation', () => {
  const form = S.RelayCore.GameUtils.getCardById('mirror_cocoon');
  for (const [quirk, atkMult, crit, defense] of [['glass', 1.6, 35, 0], ['overheat', 1, 55, 90], ['martyr', 1.4, 35, 90]]) {
    const b = battle({ party: ['chaos_mage', 'miracle_larva'], enemies: [dummy({ skills: [] })], quirk });
    b.start();
    b.act(b.options().find(o => o.name === '카오스카니발').index);
    const events = b.act(b.options().find(o => o.name === '기적의우화').index);
    assert.equal(events.find(e => e.t === 'form').s.allies[1].form, form.id);
    const cocoon = b.host.battle.players[1];
    assert.ok(cocoon.lastStand, quirk);
    assert.equal(cocoon.atk, Math.floor(Math.floor(form.stats.atk * atkMult) * 1.5), quirk);
    assert.equal(cocoon.matk, Math.floor(Math.floor(form.stats.matk * atkMult) * 1.5), quirk);
    assert.equal(cocoon.def, defense, quirk);
    assert.equal(cocoon.mdef, defense, quirk);
    assert.equal(cocoon.baseCrit, crit, quirk);
  }
});

test('an heirloom held by Miracle Larva survives its transformation', () => {
  const b = battle({ party: ['miracle_larva'], enemies: [dummy({ skills: [] })], heirlooms: { miracle_larva: { from: 'red_dragon' } } });
  b.start();
  const heir = b.options().find(o => o.heirloom);
  assert.ok(heir);
  b.act(b.options().find(o => o.name === '기적의우화').index);
  assert.equal(b.state().allies[0].form, 'mirror_cocoon');
  assert.equal(b.options().filter(o => o.heirloom).map(o => o.name).join(), heir.name);
});

test('Mirror Cocoon offers both 20 MP transformations and applies the selected form', () => {
  for (const formId of ['aurora_wing', 'abyss_wing']) {
    const b = battle({ party: ['miracle_larva'], enemies: [dummy({ skills: [] })] });
    b.start();
    b.act(b.options().find(o => o.name === '기적의우화').index);
    assert.equal(b.state().allies[0].form, 'mirror_cocoon');
    const choices = b.options().filter(o => o.effects.some(e => e.type === 'transform_choice'));
    assert.deepEqual(plain(choices.map(o => [o.name, o.cost, o.usable])), [
      ['기적의우화 → 오로라윙', 20, true], ['기적의우화 → 어비스윙', 20, true]
    ]);
    const name = S.RelayCore.GameUtils.getCardById(formId).name;
    const mp = b.state().allies[0].mp;
    const events = b.act(choices.find(o => o.name === '기적의우화 → ' + name).index);
    assert.equal(events.find(e => e.t === 'form').name, name);
    assert.equal(b.state().allies[0].form, formId);
    assert.equal(b.state().allies[0].mp, mp - 20);
  }
});

test('boss countdown lists both future branches and matches the rolled intent on the turn', () => {
  for (const [id, turn, charge, names] of [
    ['ares', 3, true, ['마그마이럽션', '테라소드']],
    ['gray', 4, false, ['차원절단', '영혼절단']]
  ]) {
    const base = S.RelayCore.ENEMIES.find(e => e.id === id);
    const boss = { id, name: base.name, element: base.element, skills: plain(base.skills),
      stats: { hp: 99999, atk: 10, matk: 10, def: 60, mdef: 60 } };
    const rolled = new Set();
    for (const seed of [1, 2]) {
      const b = battle({ seed, enemies: [boss] });
      let events = b.start();
      const upcoming = last(events, 'await').countdown;
      assert.deepEqual([upcoming.name, upcoming.alt], names, id);
      assert.equal(upcoming.inTurns, turn - 1, id);
      assert.equal(upcoming.charge, charge, id);
      for (let t = 1; t < turn; t++) events = b.act(0);
      const wait = last(events, 'await');
      const name = wait.intent.name.replace(/ 차징$/, '');
      rolled.add(name);
      assert.deepEqual(plain(wait.countdown), { name, inTurns: 0, charge }, id);
      const action = b.act(0).find(e => e.t === 'act' && e.who.side === 'enemy');
      assert.equal(action.skill.name, wait.intent.name, id);
    }
    assert.deepEqual(rolled, new Set(names), id);
  }
});

test('ally HP always equals the start value plus the reported changes', () => {
  for (let seed = 30; seed < 45; seed++) {
    const b = battle({ seed, enemies: [dummy({ stats: { hp: 6000, atk: 150, matk: 150, def: 60, mdef: 60 } })] });
    let events = b.start();
    const hp = b.state().allies.map(a => a.hp);
    for (let i = 0; i < 40 && b.awaiting; i++) {
      const options = b.options().filter(o => o.usable);
      events = b.act(options[(seed + i) % options.length].index);
      for (const e of events) if (e.t === 'hp' && e.who.side === 'ally') hp[e.who.idx] = Math.max(0, hp[e.who.idx] + e.delta);
      assert.deepEqual(b.state().allies.map(a => a.hp), hp, `seed ${seed} step ${i}`);
    }
  }
});

test('Ember carries at most two burn stacks, after the new enemy enters', () => {
  const b = battle({ region: { id: 'ember_carry' }, artifacts: ['over_flame'],
    start: { enemyDebuffs: { burn: 3, divine: 2 } }, enemies: [quietEnemy(1), quietEnemy()] });
  assert.equal(b.start()[0].s.enemy.buffs.burn, 5);
  const events = b.act(0);
  const enter = events.findIndex(e => e.t === 'enemyEnter');
  const rule = events.findIndex(e => e.t === 'rule' && e.rule === 'ember_carry');
  const buff = events.findIndex(e => e.t === 'buff' && e.id === 'burn');
  assert.ok(enter >= 0 && enter < rule && rule < buff);
  assert.deepEqual(plain(events[rule].who), { side: 'enemy', idx: 1 });
  assert.equal(events[rule].stacks, 2);
  assert.deepEqual(plain(b.state().enemy.buffs), { burn: 2 });
});

test('Twilight forecasts each bell and applies divine through artifact caps', () => {
  const b = battle({ region: { id: 'twilight_bell' }, artifacts: ['over_divine'], enemies: [quietEnemy()] });
  let events = b.start();
  for (let turn = 1; turn <= 9; turn++) {
    const next = [3, 6, 9].find(n => n > turn);
    assert.deepEqual(last(events, 'await').region, { bellIn: next ? next - turn : null });
    const rule = events.find(e => e.t === 'rule' && e.rule === 'twilight_bell');
    assert.equal(rule?.stacks, { 3: 4, 6: 1, 9: 0 }[turn]);
    if (rule) assert.ok(events.indexOf(rule) < events.findIndex(e => e.t === 'await'));
    if (turn < 9) events = b.act(0);
  }
  assert.equal(b.state().enemy.buffs.divine, 5);

  const custom = battle({ region: { id: 'twilight_bell', turns: [4, 2], stacks: 1 }, enemies: [quietEnemy()] });
  assert.equal(last(custom.start(), 'await').region.bellIn, 1);
  events = custom.act(0);
  assert.equal(last(events, 'rule').stacks, 1);
  assert.equal(last(events, 'await').region.bellIn, 2);
});

test('Starlit sky uses the announced starting field and adds no effects of its own', () => {
  const config = { start: { field: ['sun_bless', 'star_powder'] }, enemies: [quietEnemy()] };
  const starlit = battle({ ...config, region: { id: 'starlit_sky' } });
  const plainSky = battle(config);
  assert.deepEqual(starlit.start(), plainSky.start());
  assert.deepEqual(starlit.act(0), plainSky.act(0));
  assert.deepEqual(plain(starlit.state().field), config.start.field);
  const empty = battle({ region: { id: 'starlit_sky' } });
  assert.deepEqual(plain(empty.start()[0].s.field), []);
});

test('Tide forecasts and resolves the strongest magic hit, then announces rest', () => {
  const enemy = quietEnemy(99999, { atk: 1, matk: 40 });
  enemy.skills = [
    { name: '약한 마법', type: 'mag', val: 1, rate: 0.3 },
    { name: '강한 마법', type: 'mag', val: 2, rate: 0.3, effects: [{ type: 'debuff', id: 'curse', stack: 1 }] },
    { name: '물리 기술', type: 'phy', val: 6, rate: 0.3 }
  ];
  const b = battle({ region: { id: 'tide_cycle' }, enemies: [enemy] });
  const hit = '조류의 일격';
  let events = b.start();
  for (let i = 2; i >= 0; i--) {
    assert.deepEqual(last(events, 'await').countdown, { name: hit, inTurns: i, charge: false });
    if (i > 0) events = b.act(0);
  }
  const { kind, name, salience, damageRange, lethal, extra } = last(events, 'await').intent;
  assert.deepEqual(plain({ kind, name, salience, damageRange, lethal, extra }),
    { kind: 'mag', name: hit, salience: 'strong', damageRange: [133, 133], lethal: false, extra: ['debuff'] });
  events = b.act(0);
  const strike = events.find(e => e.t === 'act' && e.who.side === 'enemy');
  assert.equal(strike.skill.name, hit);
  assert.equal(events.find(e => e.t === 'hp' && e.who.side === 'ally').amount, 133);
  assert.equal(events.find(e => e.t === 'buff' && e.id === 'curse').to, 1);
  const rest = last(events, 'await').intent;
  assert.deepEqual([rest.kind, rest.name, rest.vulnerable, rest.damageRange], ['rest', '물러간 조류', 1.5, [0, 0]]);
  assert.equal(last(events, 'await').countdown.inTurns, 3);
  assert.deepEqual(plain(last(events, 'rule').who), { side: 'enemy', idx: 0 });
  assert.equal(last(events, 'rule').name, '조류가 빠진 틈');
  events = b.act(0);
  assert.equal(events.some(e => e.t === 'act' && e.who.side === 'enemy'), false);
  assert.equal(events.some(e => e.t === 'hp' && e.who.side === 'ally'), false);
});

test('Tide opening scales previews and dealt damage only on each non-boss enemy’s fourth cycle turn', () => {
  const enemies = [quietEnemy(1), quietEnemy()];
  const config = { party: ['red_dragon'], enemies };
  const plainBattle = battle(config);
  const tide = battle({ ...config, region: { id: 'tide_cycle' } });
  const boss = battle({ ...config, enemies: [enemies[0], { ...enemies[1], boss: true }], region: { id: 'tide_cycle' } });
  for (const b of [plainBattle, tide, boss]) {
    b.start();
    b.host.battle.players[0].baseCrit = 0;
    b.act(0);
  }

  for (let turn = 1; turn <= 9; turn++) {
    const opening = turn % 4 === 0;
    const baseline = option(plainBattle, '일반 공격').preview.dmg;
    for (const b of [plainBattle, tide, boss]) {
      const vulnerable = b === tide && opening;
      const expected = vulnerable ? Math.floor(baseline * 1.5) : baseline;
      const attack = option(b, '일반 공격');
      assert.equal(b.state().turn, turn + 1);
      assert.equal(attack.preview.dmg, expected);
      const events = b.act(attack.index);
      const hit = events.find(e => e.t === 'hp' && e.who.side === 'enemy');
      assert.equal(hit.amount, attack.preview.dmg);
      const nextOpening = b === tide && (turn + 1) % 4 === 0;
      assert.equal(last(events, 'await').intent.vulnerable, nextOpening ? 1.5 : undefined);
      const marker = events.find(e => e.t === 'rule' && e.rule === 'tide_cycle');
      assert.equal(marker?.vulnerable, nextOpening ? 1.5 : undefined);
    }
  }
});

test('Tide counts from each enemy entry, falls back to MATK, and skips bosses', () => {
  const enemy = quietEnemy(99999, { matk: 60 });
  const config = { region: { id: 'tide_cycle' }, enemies: [quietEnemy(1), enemy] };
  const b = battle(config);
  b.start();
  assert.equal(last(b.act(0), 'await').countdown.inTurns, 2);
  assert.equal(last(b.act(0), 'await').countdown.inTurns, 1);
  const tide = last(b.act(0), 'await');
  assert.equal(tide.s.turn, 4);
  assert.deepEqual(tide.intent.dmg, [100, 100]);
  assert.equal(b.act(0).find(e => e.t === 'hp' && e.who.side === 'ally').amount, 100);

  const boss = battle({ ...config, enemies: [{ ...enemy, boss: true }] });
  assert.equal(last(boss.start(), 'await').countdown, null);
  boss.act(0);
  assert.equal(last(boss.act(0), 'await').intent.name, '일반 공격');
});

test('Tide scales the core magic roll and announces that exact roll before the attack', () => {
  const enemy = quietEnemy(99999, { matk: 60 });
  enemy.skills = [{ name: '파도', type: 'mag', rate: 0, effects: [{ type: 'random_mult', min: 1, max: 3 }] }];
  const b = battle({ region: { id: 'tide_cycle' }, enemies: [enemy] });
  b.start();
  b.act(0);
  const wait = last(b.act(0), 'await');
  assert.ok([100, 200, 300].includes(wait.intent.dmg[0]));
  assert.equal(wait.intent.dmg[1], wait.intent.dmg[0]);
  const events = b.act(0);
  assert.equal(events.find(e => e.t === 'hp' && e.who.side === 'ally').amount, wait.intent.dmg[0]);
});

test('Arena charge survives both relays, doubles the preview and damage, and is spent once', () => {
  const config = { party: ['red_dragon', 'snow_rabbit'], enemies: [quietEnemy(1), quietEnemy()] };
  const charged = battle({ ...config, region: { id: 'arena_charge' } });
  const ordinary = battle(config);
  for (const b of [charged, ordinary]) {
    const opening = last(b.start(), 'await');
    const down = last(b.act(0), 'await');
    const next = last(b.retreat(), 'await');
    if (b === charged) {
      assert.deepEqual(opening.region, { charge: 0, ready: false });
      assert.deepEqual(down.region, { charge: 1, ready: false });
      assert.deepEqual(next.region, { charge: 1, ready: false });
    }
    b.act(0);
    b.act(0);
    const wait = last(b.act(option(b, '배리어').index), 'await');
    if (b === charged) assert.deepEqual(wait.region, { charge: 2, ready: true });
  }
  const skill = '스노우샷';
  const powered = option(charged, skill), base = option(ordinary, skill);
  assert.equal(powered.preview.dmg, base.preview.dmg * 2);
  assert.equal(option(charged, '일반 공격').preview.dmg, option(ordinary, '일반 공격').preview.dmg);
  const boosted = charged.act(powered.index), unboosted = ordinary.act(base.index);
  const hit = events => events.find(e => e.t === 'hp' && e.who.side === 'enemy').amount;
  assert.equal(hit(boosted), hit(unboosted) * 2);
  const spent = boosted.find(e => e.t === 'rule' && e.rule === 'arena_charge');
  assert.deepEqual(spent.who, { side: 'ally', idx: 1 });
  assert.equal(spent.multiplier, 2);
  assert.deepEqual(last(boosted, 'await').region, { charge: 0, ready: false });
  for (let i = 0; i < 2; i++) charged.act(0);
  assert.equal(option(charged, skill).preview.dmg, base.preview.dmg);
  assert.ok(charged.act(powered.index).every(e => e.rule !== 'arena_charge'));
});

test('Starting field buffs use the core function and are part of begin', () => {
  const b = battle({ start: { field: ['sun_bless', 'star_powder', 'gale', 'arena'] } });
  const events = b.start();
  assert.equal(events[0].t, 'begin');
  assert.deepEqual(plain(events[0].s.field), ['sun_bless', 'star_powder', 'gale']);
  assert.equal(events.filter(e => e.t === 'field').length, 0);
  assert.equal(events.filter(e => e.t === 'log' && /필드버프.*발동/.test(e.text)).length, 3);
});

test('Starting enemy debuffs obey the core stack rules and emit no starting delta', () => {
  const b = battle({ start: { enemyDebuffs: { burn: 8, divine: 2, curse: 1 } }, artifacts: ['over_divine'] });
  const events = b.start();
  assert.equal(events[0].t, 'begin');
  assert.deepEqual(plain(events[0].s.enemy.buffs), { burn: 3, divine: 4, curse: 1 });
  assert.equal(events.some(e => e.t === 'buff'), false);
});

test('Starting ally HP and MP override set-up by seat without HP or MP deltas', () => {
  const b = battle({ party: ['ash', null, 'snow_rabbit'], quirk: 'surge',
    start: { allyStart: { 0: { hp: 40, mp: 0 }, 1: { hp: 90 }, 2: { mp: 150 } } } });
  const events = b.start();
  assert.equal(events[0].t, 'begin');
  assert.deepEqual(plain(events[0].s.allies.map(a => a && [a.hp, a.mp, a.maxMp])), [[40, 0, 200], null, [290, 150, 200]]);
  assert.equal(events.some(e => e.t === 'hp' || e.t === 'mp'), false);
  assert.equal(option(b, '아마겟돈').usable, false);
});

test('Equipped relics reach core behavior and only the first four are equipped', () => {
  const b = battle({ artifacts: ['double_attack', 'reverse', 'companion', 'over_divine', 'gale_storm'], enemies: [quietEnemy()] });
  assert.deepEqual(plain(b.start()[0].s.field), []);
  const preview = option(b, '일반 공격').preview.dmg;
  const hit = b.act(0).find(e => e.t === 'hp' && e.who.side === 'enemy');
  assert.equal(hit.calc.val, 2);
  assert.equal(hit.amount, preview);
});

test('Kill-on-turn checks every enemy defeat and requires winning the battle', () => {
  for (const turn of [1, 2, 3]) {
    const b = battle({ enemies: [quietEnemy(1), quietEnemy(1)], bet: { kind: 'kill_on_turn', turn } });
    b.start();
    b.act(0);
    assert.deepEqual(b.summary().bet, { kind: 'kill_on_turn', won: false });
    b.act(0);
    assert.deepEqual(b.summary().bet, { kind: 'kill_on_turn', won: turn < 3 });
  }
  const lose = battle({ party: ['red_dragon'], enemies: [quietEnemy(1), quietEnemy(99999, { atk: 5000 })],
    bet: { kind: 'kill_on_turn', turn: 1 } });
  lose.start();
  lose.act(0);
  lose.act(0);
  assert.equal(lose.summary().outcome, 'lose');
  assert.equal(lose.summary().bet.won, false);
});

test('Delayed-on-time requires damage from a scheduled landing, including a winning landing', () => {
  const config = { enemies: [quietEnemy(1)], bet: { kind: 'delayed_on_time' } };
  const scheduled = battle({ ...config, party: ['phantom'] });
  scheduled.start();
  const events = scheduled.act(option(scheduled, '나이트메어').index);
  const landing = events.find(e => e.t === 'act' && e.delayed);
  assert.equal(landing.s.turn, 2);
  assert.ok(events.some(e => e.t === 'hp' && e.who.side === 'enemy' && e.cause.delayed));
  assert.equal(scheduled.outcome, 'win');
  assert.deepEqual(scheduled.summary().bet, { kind: 'delayed_on_time', won: true });

  const instant = battle({ ...config, party: ['phantom', 'time_magician'] });
  instant.start();
  assert.ok(instant.act(option(instant, '나이트메어').index).some(e => e.t === 'act' && e.delayed));
  assert.equal(instant.outcome, 'win');
  assert.deepEqual(instant.summary().bet, { kind: 'delayed_on_time', won: false });
});

test('Empty-sky checks both starting fields and fields added by player actions', () => {
  const config = { party: ['fairy'], enemies: [quietEnemy(1)], bet: { kind: 'empty_sky' } };
  for (const source of ['empty', 'starting', 'skill', 'artifact']) {
    const b = battle({ ...config, start: source === 'starting' ? { field: ['sun_bless'] } : null,
      artifacts: source === 'artifact' ? ['gale_storm'] : [] });
    b.start();
    if (source === 'skill') b.act(option(b, '스타파우더').index);
    b.act(0);
    assert.equal(b.outcome, 'win');
    assert.deepEqual(b.summary().bet, { kind: 'empty_sky', won: source === 'empty' });
  }
});

test('Same-grade-full checks the three starting seats even after a retreat', () => {
  for (const third of ['slime', 'ash', null]) {
    const b = battle({ party: ['snow_rabbit', 'silver_rabbit', third], enemies: [quietEnemy(1)], bet: { kind: 'same_grade_full' } });
    b.start();
    b.retreat();
    b.act(0);
    assert.equal(b.outcome, 'win');
    assert.deepEqual(b.summary().bet, { kind: 'same_grade_full', won: third === 'slime' });
  }
});

test('Summary accounts for a retreat, death, heirloom, last stand, treasure, and the full best hit', () => {
  const treasure = { ...quietEnemy(1, { atk: 5000 }), affixes: ['treasure'] };
  const b = battle({ party: ['fairy', 'red_dragon', 'snow_rabbit'], enemies: [treasure, quietEnemy(1)], seed: 9 });
  b.start();
  const retreat = b.retreat();
  assert.ok(retreat.some(e => e.t === 'laststand' && e.who.idx === 2));
  assert.ok(retreat.some(e => e.t === 'heirloom' && e.to.idx === 2));
  const first = b.act(option(b, '파이어브레스').index);
  assert.equal(first.filter(e => e.t === 'enemyDown').length, 1);
  const hit = first.find(e => e.t === 'hp' && e.who.side === 'enemy');
  assert.equal(hit.delta, -1);
  assert.ok(hit.amount > 1);
  b.act(0);
  const summary = b.summary();
  assert.deepEqual(plain(summary), {
    outcome: 'win', survivors: [true, false, true], retreated: [true, false, false],
    rescues: [{ retreated: 'fairy', incoming: 'red_dragon', lethal: true }], heirloomKills: 1,
    heirloomsGained: [{
      to: 'snow_rabbit', from: 'red_dragon', name: '파이어브레스', form: 'red_dragon',
      skill: Bridge.heirloomSkill(S.RelayCore.GameUtils.getCardById('red_dragon'))
    }],
    heirloomTransfers: [{ to: 'snow_rabbit', from: 'red_dragon', skill: '파이어브레스' }],
    heirloomUses: [{ by: 'snow_rabbit', from: 'red_dragon', skill: '파이어브레스' }],
    forms: {}, fought: ['fairy', 'red_dragon', 'snow_rabbit'], lastEnemyKiller: 'snow_rabbit',
    heirloomsUsed: 1, lastStands: 1, enemyDowns: [{ idx: 0, treasure: true }, { idx: 1, treasure: false }],
    bestHit: { amount: hit.amount, by: 'snow_rabbit', skill: '파이어브레스' }, turns: 3, bet: null
  });
  summary.bestHit.amount = 0;
  summary.enemyDowns[0].treasure = false;
  summary.rescues[0].lethal = false;
  summary.heirloomTransfers[0].from = 'fairy';
  summary.heirloomUses[0].by = 'fairy';
  summary.fought.pop();
  assert.equal(b.summary().bestHit.amount, hit.amount);
  assert.equal(b.summary().enemyDowns[0].treasure, true);
  assert.equal(b.summary().rescues[0].lethal, true);
  assert.equal(b.summary().heirloomTransfers[0].from, 'red_dragon');
  assert.equal(b.summary().heirloomUses[0].by, 'snow_rabbit');
  assert.ok(b.summary().fought.includes('snow_rabbit'));
});

test('a rescue uses the minimum forecast on the outgoing fighter, including equality', () => {
  const enemy = quietEnemy(1000, { atk: 100 });
  enemy.skills = [{ name: '시험용 예고', type: 'phy', rate: 1, effects: [{ type: 'random_mult', min: 1, max: 3 }] }];
  for (const offset of [0, 1]) {
    const b = battle({ party: ['fairy', null, 'red_dragon'], enemies: [enemy], seed: 7 });
    const [min, max] = last(b.start(), 'await').intent.dmg;
    assert.ok(max > min);
    b.host.battle.players[0].hp = min + offset;
    b.retreat();
    assert.deepEqual(b.summary().rescues, [{ retreated: 'fairy', incoming: 'red_dragon', lethal: offset === 0 }]);
  }
});

test('an inherited delayed skill counts actual landings once per enemy', () => {
  const b = battle({ party: ['fairy'], enemies: [quietEnemy(1), quietEnemy(1)],
    heirlooms: { fairy: { from: 'phantom', name: '나이트메어' } } });
  b.start();
  assert.equal(b.summary().heirloomKills, 0);
  const events = b.act(option(b, '나이트메어').index);
  assert.deepEqual(events.filter(e => e.t === 'act' && e.delayed && e.heirloom).map(e => e.target.idx), [0, 1]);
  assert.ok(events.filter(e => e.t === 'act' && e.delayed && e.heirloom).every(e => e.heirFrom === 'phantom'));
  assert.equal(b.outcome, 'win');
  assert.equal(b.summary().heirloomKills, 2);
  assert.equal(b.summary().heirloomsUsed, 1);
  assert.deepEqual(b.summary().heirloomUses, [{ by: 'fairy', from: 'phantom', skill: '나이트메어' }]);
  assert.equal(b.summary().lastEnemyKiller, 'fairy');
});

test('using an heirloom before a lethal counter or status does not credit the kill', () => {
  const counter = battle({ party: ['red_moon'], seed: 0, enemies: [quietEnemy(500, { atk: 5000 })],
    heirlooms: { red_moon: { from: 'red_dragon', skill: { name: '희미한 불꽃', type: 'mag', cost: 0, val: 0.01, heirloom: true } } } });
  counter.start();
  counter.act(option(counter, '희미한 불꽃').index);
  assert.equal(counter.outcome, 'win');
  assert.equal(counter.summary().heirloomsUsed, 1);
  assert.equal(counter.summary().heirloomKills, 0);
  assert.equal(counter.summary().lastEnemyKiller, 'red_moon');

  const status = battle({ party: ['fairy'], enemies: [quietEnemy(500)],
    heirlooms: { fairy: { from: 'red_dragon', name: '파이어브레스' } } });
  const runtime = S.RelayCore.BattleRuntime;
  const apply = runtime.applySkillEffects;
  let statusKilled = false;
  runtime.applySkillEffects = function (host, source, target, skill) {
    apply.call(this, host, source, target, skill);
    if (host === status.host && skill.heirloom && target.buffs.burn && target.hp > 0) {
      // The core's burn stacks do not tick HP. Inject a status damage event after the real hit.
      target.hp = 0;
      statusKilled = true;
      host.log('작열 피해.');
    }
  };
  try {
    status.start();
    status.act(option(status, '파이어브레스').index);
    assert.equal(statusKilled, true);
    assert.equal(status.outcome, 'win');
    assert.equal(status.summary().heirloomKills, 0);
    assert.equal(status.summary().lastEnemyKiller, null);
  } finally {
    runtime.applySkillEffects = apply;
  }
});

test('Guard preview applies 75% with Guardian and 50% without', () => {
  const enemy = quietEnemy(99999, { atk: 226 });
  for (const guardian of [false, true]) {
    const b = battle({ party: ['red_dragon', guardian ? 'guardian' : null], enemies: [enemy] });
    assert.deepEqual(last(b.start(), 'await').intent.dmg, [141, 141]);
    const guard = option(b, '가드');
    assert.deepEqual(guard.defense, { kind: 'guard', reduction: guardian ? 0.75 : 0.5 });
    const hit = b.act(guard.index).find(e => e.t === 'hp' && e.who.side === 'ally');
    assert.equal(hit.amount, guardian ? 35 : 70);
  }
});

test('Other defensive tiles show block, half damage, and actual evasion with the current field', () => {
  for (const [id, kind, reduction] of [['snow_rabbit', 'barrier', 1], ['guardian', 'guard', 0.75],
    ['cherry_prince', 'damage_half', 0.5], ['ash', 'evasion', 0.7]]) {
    const b = battle({ party: [id], start: { field: ['moon_bless'] } });
    b.start();
    assert.deepEqual(b.options().find(o => o.defense?.kind === kind)?.defense, { kind, reduction });
  }
  const b = battle({ party: ['mirror_cocoon'] });
  b.start();
  assert.deepEqual(option(b, '리버설').defense, { kind: 'magic_guard', reduction: 1 });
});

test('Retreat preview skips empty seats, preserves the roll, and matches damage on the incoming ally', () => {
  const config = { party: ['red_dragon', null, 'snow_rabbit'], enemies: [quietEnemy(99999, { atk: 198 })] };
  const b = battle(config);
  const wait = last(b.start(), 'await');
  const before = plain(b.state());
  const preview = b.previewRetreat();
  assert.deepEqual(b.previewRetreat(), preview);
  assert.deepEqual(plain(b.state()), before);
  assert.deepEqual(preview.next, { side: 'ally', idx: 2 });
  assert.equal(preview.intent.name, wait.intent.name);
  assert.notDeepEqual(preview.dmg, wait.intent.dmg);
  assert.deepEqual(preview.dmg, [141, 141]);
  assert.equal(preview.lethal, false);
  const events = b.retreat();
  const attack = events.find(e => e.t === 'act' && e.who.side === 'enemy');
  assert.deepEqual(attack.target, preview.next);
  assert.equal(attack.skill.name, preview.intent.name);
  assert.equal(events.find(e => e.t === 'hp' && e.who.side === 'ally').amount, preview.dmg[0]);
  assert.equal(b.previewRetreat(), null);
});

test('Heirloom preview shows the next occupied seat and handles support-only and empty seats', () => {
  const preview = party => Bridge.heirloomPreview(S.RelayCore, Object.freeze(party));
  assert.deepEqual(preview(['ash', 'joker', 'snow_rabbit']), [
    { from: 'ash', to: 'joker', skill: { name: '아마겟돈', type: 'phy', tier: 3, val: 10.5 } },
    { from: 'joker', to: 'snow_rabbit', skill: null },
    { from: 'snow_rabbit', to: null, skill: null }
  ]);
  assert.deepEqual(preview(['ash', null, 'snow_rabbit']).map(p => [p.from, p.to]), [
    ['ash', 'snow_rabbit'], [null, null], ['snow_rabbit', null]
  ]);
  assert.equal(S.RelayCore.GameUtils.getCardById('ash').skills.find(s => s.name === '아마겟돈').val, 7);
});
