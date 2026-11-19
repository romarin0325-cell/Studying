// Checks the bridge against the real card/game rules: node --test card_pixel/game/tests/bridge.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
// Share Math so the ESM bridge can seed the card core inside the VM.
import * as Bridge from '../src/engine/bridge.js';
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
  const diff = new Set(['turn', 'enter', 'hp', 'mp', 'buff', 'field']);
  for (const card of S.RelayCore.GameUtils.getAllCards().filter(c => !c.battleOnly)) {
    for (let pos = 0; pos < 3; pos++) {
      const party = ['zeke', 'cherry_prince', 'ash'].filter(id => id !== card.id).slice(0, 2);
      party.splice(pos, 0, card.id);
      const events = battle({ party }).start();
      const begin = events.findIndex(e => e.t === 'begin');
      const lineup = card.id + ' in slot ' + pos;
      assert.ok(begin >= 0 && events[begin].s, lineup);
      assert.ok(!events.slice(0, begin).some(e => diff.has(e.t)), lineup);
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
