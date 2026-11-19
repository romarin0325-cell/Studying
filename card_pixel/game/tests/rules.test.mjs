// Experimental rules E-H and the run structure: node --test card_pixel/game/tests/rules.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
// Share Math so the ESM bridge can seed the card core inside the VM.
import * as Bridge from '../src/engine/bridge.js';
import * as RelayRoster from '../src/engine/roster.js';
import { coreBundle } from '../tools/core-bundle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..');
const IDS = ['ash', 'luna', 'red_dragon', 'zeke', 'flame_sage', 'cherry_prince', 'gold_dragon', 'queen', 'sunflower', 'siren', 'golem', 'magma_beetle', 'night_bat', 'treant', 'dark_knight'];
const sp = Object.fromEntries(IDS.map(id => [id + '-idle', { w: 60, h: 72, cx: 30, fy: 71 }]));
const S = { console, Math, __relayCoreTimer: Bridge.scheduleTimer, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, RELAY_ASSETS: { sp } };
S.window = S; S.globalThis = S;
vm.createContext(S);
vm.runInContext(coreBundle(repo), S);
const core = S.RelayCore;
const roster = RelayRoster.create(core, S.RELAY_ASSETS);

const dummy = over => Object.assign({ id: 'test_dummy', name: '시험용 적', element: 'nature', stats: { hp: 99999, atk: 60, matk: 60, def: 60, mdef: 60 }, skills: [{ name: '강타', type: 'phy', val: 2.0, rate: 0.3 }] }, over);
const brute = over => dummy(Object.assign({ stats: { hp: 99999, atk: 5000, matk: 5000, def: 60, mdef: 60 } }, over));
const battle = opts => Bridge.create(core, Object.assign({ party: ['red_dragon', 'ash', 'luna'], enemies: [dummy()], seed: 7 }, opts));
const last = (events, t) => events.filter(e => e.t === t).pop();
const plain = v => JSON.parse(JSON.stringify(v));   // objects from the vm realm compared as plain data

test('E heirloom: the fallen fighter\'s strongest attack goes to the next one, free and at 1.5x', () => {
  const b = battle({ enemies: [brute()] });
  b.start();
  const events = b.act(0);                       // red dragon is one-shot on the enemy turn
  const h = events.find(e => e.t === 'heirloom');
  assert.ok(h, 'heirloom event');
  assert.equal(h.from.idx, 0); assert.equal(h.to.idx, 1);
  const red = core.GameUtils.getCardById('red_dragon');
  const best = red.skills.filter(s => s.type !== 'sup').sort((x, y) => (y.tier * 10 + y.val) - (x.tier * 10 + x.val))[0];
  assert.equal(h.skill.name, best.name);
  const opt = b.options().find(o => o.heirloom);
  assert.ok(opt, 'the heir has the heirloom option');
  assert.equal(opt.cost, 0);
  assert.equal(opt.val, Math.round(best.val * 1.5 * 100) / 100);
  assert.deepEqual(JSON.parse(JSON.stringify(b.heirloomsGained())), [{ to: 'ash', from: 'red_dragon', name: best.name }]);
});

test('E heirlooms scale random attack ranges and damage without changing the original skills', () => {
  for (const id of ['santa', 'avalanche_maid']) {
    const card = roster.card(id);
    const original = card.skills.find(s => s.effects.some(e => e.type === 'random_mult'));
    const range = plain(original.effects.find(e => e.type === 'random_mult'));
    const hit = heirloom => {
      const heirlooms = heirloom ? { [id]: { from: id } } : {};
      const b = battle({ party: [id], seed: 1, heirlooms });
      b.start();
      const option = b.options().find(o => o.name === original.name && o.heirloom === heirloom);
      const effect = option.effects.find(e => e.type === 'random_mult');
      const power = heirloom ? 1.5 : 1;
      assert.deepEqual([effect.min, effect.max], [range.min * power, range.max * power], id);
      return b.act(option.index).find(e => e.t === 'hp' && e.who.side === 'enemy').amount;
    };
    const normal = hit(false), inherited = hit(true);
    assert.ok(Math.abs(inherited - normal * 1.5) <= 1, id + ': ' + normal + ' → ' + inherited);
    assert.deepEqual(plain(original.effects.find(e => e.type === 'random_mult')), range, id);
  }
  const gray = roster.card('gray');
  for (const type of ['random_mult_moon_boost', 'delayed_random_attack']) {
    const skill = gray.skills.find(s => s.effects.some(e => e.type === type));
    const original = plain(skill.effects.find(e => e.type === type));
    const inherited = Bridge.heirloomSkill({ ...gray, skills: [skill] }).effects.find(e => e.type === type);
    assert.deepEqual([inherited.min, inherited.max], [original.min * 1.5, original.max * 1.5], type);
    if (type === 'random_mult_moon_boost') assert.equal(inherited.boostMax, original.boostMax * 1.5);
    assert.deepEqual(plain(skill.effects.find(e => e.type === type)), original);
  }
});

test('E heirloom: usable once per battle, and it comes back in the next battle', () => {
  const b = battle({ party: ['ash', 'luna'], heirlooms: { ash: { from: 'red_dragon', name: '파이어브레스' } } });
  b.start();
  const opt = b.options().find(o => o.heirloom);
  assert.ok(opt && opt.cost === 0);
  b.act(opt.index);
  assert.equal(b.options().filter(o => o.heirloom).length, 0, 'gone for the rest of the battle');
  const again = battle({ party: ['ash', 'luna'], heirlooms: { ash: { from: 'red_dragon', name: '파이어브레스' } }, seed: 8 });
  again.start();
  assert.ok(again.options().some(o => o.heirloom), 'back in a new battle');
});

test('E heirloom can be switched off', () => {
  const b = battle({ enemies: [brute()], rules: { heirloom: false } });
  b.start();
  assert.ok(!b.act(0).some(e => e.t === 'heirloom'));
});

test('F last stand: the last fighter gets x1.5 attack once', () => {
  const b = battle({ party: ['red_dragon', 'ash'], enemies: [brute()] });
  b.start();
  const ashAtk = b.host.battle.players[1].atk;
  const events = b.act(0);
  const ls = events.find(e => e.t === 'laststand');
  assert.ok(ls && ls.who.idx === 1);
  assert.equal(b.host.battle.players[1].atk, Math.floor(ashAtk * 1.5));
  assert.ok(b.state().allies[1].lastStand);
});

test('G glass cannon: both sides hit harder and lose defence', () => {
  const plain = battle({}); plain.start();
  const glass = battle({ quirk: 'glass' }); glass.start();
  const p0 = plain.host.battle.players[0], g0 = glass.host.battle.players[0];
  assert.equal(g0.atk, Math.floor(p0.atk * 1.6)); assert.equal(g0.def, 0);
  assert.equal(glass.host.battle.enemy.def, 0);
  assert.equal(glass.host.battle.enemy.atk, Math.floor(plain.host.battle.enemy.atk * 1.6));
  assert.equal(plain.state().enemy.hp, glass.state().enemy.hp, 'set-up is not reported as damage');
});

test('G surge: allies start with 200 MP and no MP event is reported for it', () => {
  const b = battle({ quirk: 'surge' });
  const events = b.start();
  assert.equal(b.state().allies[0].mp, 200);
  assert.ok(!events.some(e => e.t === 'mp'));
});

test('G overflow: the rest of a killing blow hits the next enemy', () => {
  const weak = dummy({ stats: { hp: 50, atk: 40, matk: 40, def: 0, mdef: 0 } });
  const b = battle({ quirk: 'overflow', enemies: [weak, dummy({ stats: { hp: 2000, atk: 40, matk: 40, def: 60, mdef: 60 } })] });
  b.start();
  const events = b.act(b.options().find(o => o.name === '드래곤크로').index);
  const of = events.find(e => e.t === 'rule' && e.rule === 'overflow');
  assert.ok(of && of.amount > 0);
  assert.equal(b.state().enemy.hp, 2000 - of.amount);
});

test('G echo: a tier-3 attack rings again at half power', () => {
  const b = battle({ quirk: 'echo', seed: 3 });
  b.start();
  const before = b.state().enemy.hp;
  const events = b.act(b.options().find(o => o.name === '파이어브레스').index);
  const echo = events.find(e => e.t === 'rule' && e.rule === 'echo');
  assert.ok(echo);
  const hits = events.filter(e => e.t === 'hp' && e.who.side === 'enemy' && e.delta < 0).map(e => -e.delta);
  assert.equal(hits.length, 2);
  assert.equal(hits[1], Math.floor(hits[0] * 0.5));
  assert.equal(b.state().enemy.hp, before - hits[0] - hits[1]);
});

test('H tough, thorns, leech and frenzy do what the door says', () => {
  const t = battle({ enemies: [dummy({ affixes: ['tough'] })] }); t.start();
  assert.equal(t.state().enemy.buffs.damage_half, 3);

  const th = battle({ enemies: [dummy({ affixes: ['thorns'] })], seed: 5 }); th.start();
  const hpBefore = th.state().allies[0].hp;
  const ev = th.act(th.options().find(o => o.name === '드래곤크로').index);
  const thorns = ev.find(e => e.t === 'rule' && e.rule === 'thorns');
  assert.ok(thorns && thorns.amount > 0);
  assert.ok(th.state().allies[0].hp >= 1 && th.state().allies[0].hp <= hpBefore - thorns.amount);

  const le = battle({ enemies: [dummy({ affixes: ['leech'], stats: { hp: 3000, atk: 120, matk: 120, def: 60, mdef: 60 } })], seed: 2 }); le.start();
  le.act(le.options().find(o => o.name === '드래곤크로').index);
  const ev2 = le.act(0);
  const leech = ev2.find(e => e.t === 'rule' && e.rule === 'leech');
  assert.ok(leech && leech.amount > 0);

  const fr = battle({ enemies: [dummy({ affixes: ['frenzy'], stats: { hp: 1200, atk: 60, matk: 60, def: 0, mdef: 0 } })], seed: 4 }); fr.start();
  const atk0 = fr.host.battle.enemy.atk;
  const ev3 = fr.act(fr.options().find(o => o.name === '드래곤크로').index);
  assert.ok(ev3.some(e => e.t === 'rule' && e.rule === 'frenzy'));
  assert.equal(fr.host.battle.enemy.atk, Math.floor(atk0 * 1.5));
});

test('rule B still holds with every quirk and affix: the announced action is the one taken, the damage is in range', () => {
  let compared = 0;
  for (const quirk of [null, ...Object.keys(Bridge.QUIRKS)]) {
    for (let seed = 1; seed <= 6; seed++) {
      const foe = dummy({ affixes: ['frenzy', 'leech'], stats: { hp: 99999, atk: 45, matk: 45, def: 60, mdef: 60 } });
      const b = battle({ quirk, seed, enemies: [foe, dummy()] });
      let events = b.start();
      for (let turn = 0; turn < 10 && b.awaiting; turn++) {
        const wait = last(events, 'await');
        const target = wait.who.idx;
        events = b.act(0);
        const act = events.find(e => e.t === 'act' && e.who.side === 'enemy');
        if (!act) continue;
        assert.equal(act.skill.name, wait.intent.name, `${quirk} seed ${seed}`);
        const hurt = events.find(e => e.t === 'hp' && e.who.side === 'ally' && e.who.idx === target && e.cause.kind === 'act');
        if (hurt && wait.intent.dmg) assert.ok(hurt.amount >= wait.intent.dmg[0] && hurt.amount <= wait.intent.dmg[1], `${quirk} seed ${seed}: ${hurt.amount} vs ${wait.intent.dmg}`);
        compared++;
      }
    }
  }
  assert.ok(compared > 300);
});

test('roster: boss-only sprites stay out of the ally pool, and kind is optional', () => {
  const meta = JSON.parse(fs.readFileSync(path.join(here, '../assets/sprites.json'), 'utf8'));
  const entries = Object.entries(meta).map(([filename, sprite]) => [filename.replace(/\.png$/, ''), sprite]);
  const real = RelayRoster.create(core, { sp: Object.fromEntries(entries) });
  assert.ok(real.allies.length >= 42);
  assert.ok(real.bosses.includes('gray'));
  assert.equal(real.allies.includes('gray'), meta['gray-idle.png']?.kind === 'ally');
  const bossOnly = RelayRoster.create(core, { sp: { 'gray-idle': { kind: 'boss' } } });
  assert.deepEqual(plain(bossOnly.allies), []);
  const fake = RelayRoster.create(core, { sp: { 'gray-idle': {} } });
  assert.deepEqual(plain(fake.allies), ['gray']);
});
