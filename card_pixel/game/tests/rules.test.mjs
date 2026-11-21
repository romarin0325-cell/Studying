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
import { skillText, traitText } from '../src/ui/widgets.js';
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
  assert.deepEqual(plain(b.heirloomsGained()), [{
    to: 'ash', from: 'red_dragon', name: best.name, form: 'red_dragon', skill: Bridge.heirloomSkill(red)
  }]);
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

test('live affixes and ordinary strong attacks report their own values, without boss salience', () => {
  const target = dummy({ affixes: ['tough', 'frenzy'], stats: { hp: 3000, atk: 1, matk: 1, def: 50, mdef: 50 } });
  const b = battle({ enemies: [target], tempo: { pattern: 'threeBeat' } });
  const opening = last(b.start(), 'await');
  assert.equal(opening.intent.salience, 'ordinary');
  assert.equal(opening.affixes.find(affix => affix.id === 'tough').turns, 3);
  b.host.battle.enemy.hp = 1200;
  const strong = last(b.act(0), 'await');
  assert.equal(strong.intent.salience, 'strong');
  assert.equal(strong.affixes.find(affix => affix.id === 'tough').turns, 2);
  assert.equal(strong.affixes.find(affix => affix.id === 'frenzy').active, true);
  const blow = b.act(0).find(event => event.t === 'act' && event.who.side === 'enemy');
  assert.deepEqual([blow.salience, blow.ult], ['strong', false]);
});

test('traitText adapts every core card trait without card-game terms or spacing errors', () => {
  const formIds = ['mirror_cocoon', 'aurora_wing', 'abyss_wing'];
  const allCards = [
    ...core.GameUtils.getAllCards(),
    ...formIds.map(id => core.GameUtils.getCardById(id)).filter(Boolean)
  ];
  assert.ok(allCards.length >= 164);

  const forbidden = /(덱|카드|필드\s*버프|지연\s*스킬|드로우|\d+장|일반등급)/;
  const badSpacing = /(배치|사망|있을|사용|발생)시|일반공격시|적용중인|(부식|침묵)상태|(불|물|자연|빛|어둠)속성|\d+%(확률로|증가|상승|피해)/;
  for (const card of allCards) {
    const out = traitText(card.trait);
    assert.ok(out.length > 0, `${card.id}: empty traitText`);
    assert.ok(!forbidden.test(out), `${card.id}: leftover term in "${out}"`);
    assert.ok(!badSpacing.test(out), `${card.id}: spacing error in "${out}"`);
  }

  const byId = Object.fromEntries(allCards.map(card => [card.id, card]));
  assert.equal(traitText(byId.queen.trait), '전투 승리 후 생존 시 결정 +1');
  assert.equal(traitText(byId.mimic.trait), '전투 승리 후 생존 시 결정 +1');
  assert.equal(traitText(byId.mummy.trait), '중견 배치 시 출전 파티 전체 마법 방어력 15% 증가');
  assert.equal(traitText(byId.guardian.trait), '선봉 배치 시 물리 공격력 30% 증가 / 출전 파티 전체의 [가드] 스킬 피해 감소율을 75%로 강화');
  assert.equal(traitText(byId.prism_twin.trait), '이 동료의 일반 공격 피해 2배');
  assert.equal(traitText(byId.harmonius.trait), '출전 파티에 있는 자신을 제외한 디저트킹덤 동료 하나당 물리 공격력/마법 공격력 50% 증가');
  assert.equal(traitText(byId.jasmine_christmas.trait), '자스민이 생존해 있을 경우, 출전 파티의 빛 속성 동료 사망 시 자신의 기본 마법 공격력 기준 2배율 반격');
  assert.equal(traitText(byId.victoria.trait), '대장 배치 시 아레나를 제외한 필드 효과의 능력치 보너스를 2배로 받음');
  assert.equal(traitText(byId.trans_yeon_rabbit.trait), '출전 파티에 있는 토끼의 수만큼 물리 공격력·마법 공격력이 50% 증가');
});

test('skillText removes card-game terms from SkillDisplay across all cards and enemies', () => {
  const formIds = ['mirror_cocoon', 'aurora_wing', 'abyss_wing'];
  const allCards = [
    ...core.GameUtils.getAllCards(),
    ...formIds.map(id => core.GameUtils.getCardById(id)).filter(Boolean)
  ];
  const forbidden = /(덱|카드|지연\s*스킬|필드\s*버프)/;
  let checked = 0;

  for (const card of allCards) {
    for (const skill of card.skills || []) {
      const out = skillText(core.SkillDisplay.body(skill, { entity: card }));
      assert.ok(!forbidden.test(out), `${card.id}/${skill.name}: "${out}"`);
      checked++;
    }
  }
  for (const enemy of core.ENEMIES || []) {
    for (const skill of enemy.skills || []) {
      const out = skillText(core.SkillDisplay.body(skill, { entity: enemy, enemy: true }));
      assert.ok(!forbidden.test(out), `${enemy.id}/${skill.name}: "${out}"`);
      checked++;
    }
  }
  assert.ok(checked >= 500);
});

test('affix and quirk descriptions match their actual combat and reward rules', () => {
  assert.match(Bridge.AFFIXES.treasure.desc, /승리/);
  assert.match(Bridge.affixView('treasure').text, /승리/);
  assert.match(Bridge.QUIRKS.overheat.desc, /공격력·마법공격력/);
  assert.match(Bridge.QUIRKS.surge.desc, /최대·시작 MP 200/);
});
