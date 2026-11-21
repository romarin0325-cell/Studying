import test from 'node:test';
import assert from 'node:assert/strict';
import { create } from '../src/engine/bridge.js';
import { actionEnd, planEffects } from '../src/ui/battle/effect-plan.js';
import { createCoreRoster } from './support/core.mjs';

const { core, roster } = createCoreRoster();
const seed = 7;
const enemy = {
  ...roster.wildOf('golem'), element: 'nature',
  stats: { hp: 5000, atk: 0, matk: 0, def: 60, mdef: 60 }, skills: []
};
const caster = { side: 'ally', idx: 0 };
const foe = { side: 'enemy', idx: 0 };

function battle(id, start, target = enemy) {
  const b = create(core, { seed, party: [id], enemies: [target], start });
  b.start();
  return b;
}

function act(b, name) {
  const option = b.options().find(o => o.name === name);
  assert.ok(option?.usable, name);
  return b.act(option.index);
}

function action(events, name, side = 'ally') {
  const index = events.findIndex(e => e.t === 'act' && e.skill.name === name && e.who.side === side);
  assert.ok(index >= 0, name);
  const end = actionEnd(events, index);
  const group = events.slice(index, end);
  const next = events[end]?.s;
  return { cast: group[0], group, next, plan: planEffects(group, { core, next }) };
}

function checkDamage({ cast, group, plan }, amounts) {
  const steps = plan.filter(p => p.kind === 'damage');
  const damage = group.filter(e => e.t === 'hp' && e.delta < 0);
  assert.deepEqual(damage.map(e => e.amount), amounts);
  assert.deepEqual(steps.map(p => p.event), damage);
  assert.deepEqual(steps.map(p => [p.at, p.who, p.turn, p.strike]), damage.map(e => ['foe', e.who, e.s.turn, true]));
  for (const e of damage) assert.deepEqual(e.who, cast.target);
}

function checkFields({ group, plan }, expected) {
  const events = group.filter(e => e.t === 'field');
  assert.deepEqual(events.flatMap(e => [...e.add]), expected);
  const entries = plan.filter(p => p.kind === 'field-add');
  assert.equal(entries.length, Number(expected.length > 0));
  assert.deepEqual(entries.flatMap(p => p.ids), expected);
  if (entries.length) assert.deepEqual([entries[0].at, entries[0].turn], ['field', events[0].s.turn]);
}

test('Pudding Paradise strikes before adding Star Powder and omits the effect on a repeat cast', () => {
  const b = battle('pudding_princess');
  const first = action(act(b, '푸딩파라다이스'), '푸딩파라다이스');
  checkDamage(first, [106]);
  checkFields(first, ['star_powder']);
  assert.deepEqual(first.plan.map(p => p.kind), ['damage', 'field-add']);
  assert.equal(first.plan[1].label, '스타파우더 · 방어·마방 상승');

  const repeat = action(act(b, '푸딩파라다이스'), '푸딩파라다이스');
  checkDamage(repeat, [106]);
  checkFields(repeat, []);
  assert.deepEqual(repeat.plan.map(p => p.kind), ['damage']);
});

test('Dancing Dagger places one evasion effect on the caster after the enemy hit', () => {
  const a = action(act(battle('crystal_dancer'), '댄싱대거'), '댄싱대거');
  checkDamage(a, [103]);
  checkFields(a, []);
  const buff = a.group.find(e => e.t === 'buff');
  assert.deepEqual(buff.who, caster);
  assert.equal(buff.to, 1);
  assert.equal(a.plan.length, 2);
  assert.deepEqual(a.plan[1], { at: 'caster', kind: 'buff', label: '회피', who: caster, ids: [buff.id], turn: buff.s.turn });
});

for (const divine of [true, false]) {
  test(`The Holy ${divine ? 'adds Sanctuary with Divine' : 'only deals damage without Divine'}`, () => {
    const b = battle('jasmine', divine ? { enemyDebuffs: { divine: 1 } } : undefined);
    const a = action(act(b, '더홀리'), '더홀리');
    checkDamage(a, [156]);
    checkFields(a, divine ? ['sanctuary'] : []);
    assert.deepEqual(a.plan.map(p => p.kind), divine ? ['damage', 'field-add'] : ['damage']);
  });
}

for (const [id, skill, offset, damage, field] of [
  ['priest_of_end', '사신강림', 4, 262, 'reaper_realm'],
  ['blue_moon_priest', '창조의기도', 3, 195, 'sanctuary'],
  ['prism_twin', '일루미네이션', 3, 159, 'star_powder']
]) {
  test(`${skill} shows the bridge's reservation and renders the hit and field on its due turn`, () => {
    const b = battle(id);
    const cast = action(act(b, skill), skill);
    checkDamage(cast, []);
    checkFields(cast, []);
    const scheduled = cast.next.delayed.find(d => d.name === skill && d.by === 0);
    assert.equal(scheduled.turn, 1 + offset);
    assert.deepEqual(cast.plan, [{
      at: 'caster', kind: 'delay', label: offset + '턴 뒤', who: caster, turns: [scheduled.turn], turn: cast.cast.s.turn
    }]);

    let events;
    // Casting spends turn 1, so the remaining commands lead to the due turn.
    for (let turn = 2; turn < scheduled.turn; turn++) {
      events = act(b, '일반 공격');
      assert.equal(events.some(e => e.t === 'act' && e.delayed && e.skill.name === skill), turn + 1 === scheduled.turn);
    }
    const trigger = action(events, skill);
    assert.equal(trigger.cast.s.turn, scheduled.turn);
    checkDamage(trigger, [damage]);
    checkFields(trigger, [field]);
    assert.equal(trigger.plan[0].kind, 'damage');
    assert.equal(trigger.plan.at(-1).kind, 'field-add');
    if (id === 'blue_moon_priest') {
      const buff = trigger.group.find(e => e.t === 'buff' && e.id === 'divine');
      assert.deepEqual(trigger.plan[1], { at: 'foe', kind: 'buff', label: '디바인 1', who: foe, ids: [buff.id], turn: buff.s.turn });
    }
  });
}

test('Miracle Powder groups two bridge field events into one slot notice after the hit', () => {
  const b = battle('miracle_larva');
  act(b, '기적의우화');
  act(b, '기적의우화 → 오로라윙');
  assert.equal(b.state().allies[0].form, 'aurora_wing');
  const a = action(act(b, '미라클파우더'), '미라클파우더');
  checkDamage(a, [125]);
  checkFields(a, ['star_powder', 'twinkle_party']);
  assert.equal(a.group.filter(e => e.t === 'field').length, 2);
  assert.deepEqual(a.plan.map(p => [p.kind, p.label, p.turn]), [
    ['damage', '125', 3], ['field-add', '스타파우더 · 트윙클파티', 3]
  ]);
});

test('Prism Shuffle on an empty field plans only damage', () => {
  const a = action(act(battle('prism_twin'), '프리즘셔플'), '프리즘셔플');
  checkDamage(a, [132]);
  checkFields(a, []);
  assert.deepEqual(a.plan.map(p => p.kind), ['damage']);
});

test('Moon Current displays the consumed field after the damage', () => {
  const a = action(act(battle('deep_lord', { field: ['moon_bless'] }), '월광해류'), '월광해류');
  checkDamage(a, [487]);
  checkFields(a, []);
  const removed = a.group.find(e => e.t === 'field');
  assert.deepEqual(a.plan[1], { at: 'field', kind: 'field-consume', label: '달 소모', ids: [...removed.remove], turn: removed.s.turn });
});

test('A field displaced by the slot limit is not announced as consumed', () => {
  const b = battle('pudding_princess', { field: ['arena', 'earth_bless', 'sun_bless'] });
  const a = action(act(b, '푸딩파라다이스'), '푸딩파라다이스');
  assert.deepEqual([...a.group.find(e => e.t === 'field' && e.remove.length).remove], ['arena']);
  checkFields(a, ['star_powder']);
  assert.deepEqual(a.plan.map(p => p.kind), ['damage', 'field-add']);
});

test('A pure support field cast has a field notice without a hit', () => {
  const a = action(act(battle('jasmine'), '여신강림'), '여신강림');
  checkDamage(a, []);
  checkFields(a, ['goddess_descent']);
  assert.deepEqual(a.plan.map(p => p.kind), ['field-add']);
});

for (const why of ['evasion', 'barrier']) {
  test(`An enemy attack prevented by ${why} plans no damage or field effect`, () => {
    const b = battle('jasmine', undefined, { ...enemy, stats: { ...enemy.stats, atk: 60 } });
    if (why === 'evasion') b.host.battle.players[0].baseEva = 100;
    const a = action(act(b, why === 'barrier' ? '배리어' : '일반 공격'), '일반 공격', 'enemy');
    assert.equal(a.group.find(e => e.t === 'miss')?.why, why);
    assert.deepEqual(a.plan, []);
  });
}
