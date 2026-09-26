import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const values = new Map();
const sandbox = { assert, console, setTimeout: () => 1, clearTimeout() {}, localStorage: {
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key)
} };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const file of ['data.js', 'logic.js', 'card_pool_rules.js', 'battle_runtime.js', 'rpg_features.js']) {
    vm.runInContext(await fs.readFile(new URL('../game/' + file, import.meta.url), 'utf8'), sandbox, { filename: file });
}
vm.runInContext(`
const noop = () => {};
const unit = (options = {}) => ({ id: 'fixture', name: 'fixture', hp: 10000, maxHp: 10000, mp: 100, maxMp: 100,
    atk: 200, matk: 200, def: 0, mdef: 0, baseDef: 0, baseMdef: 0, baseCrit: -100, baseEva: -100,
    buffs: {}, proto: { trait: { type: 'none' } }, ...options });
const skill = type => ({ name: 'fixture attack', type, val: 1, effects: [] });
const cases = [
    [{}, {}, 200], [{ guard: 1 }, {}, 100], [{ damage_half: 3 }, {}, 100],
    [{ damage_half: 3 }, { guardDamageReduction: .75, guardEnhancedTurns: 1 }, 100],
    [{ guard: 1 }, { guardDamageReduction: .75, guardEnhancedTurns: 1 }, 50],
    [{ guard: 1, damage_half: 3 }, {}, 100],
    [{ guard: 1, damage_half: 3 }, { guardDamageReduction: .75, guardEnhancedTurns: 1 }, 50]
];
const originalDecision = Logic.decideEnemyAction;
for (const type of ['phy', 'mag']) for (const [buffs, extras, expected] of cases) {
    const target = unit({ buffs: { ...buffs }, ...extras });
    const logs = [];
    assert.equal(Logic.calculateDamage(unit(), target, skill(type), [], [], line => logs.push(line), 'origin', [], 1, []).dmg, expected);
    if (buffs.damage_half && !buffs.guard) assert.equal(logs.some(line => line.includes('가드')), false);
    const rpg = { state: { mode: 'origin', artifacts: [], deck: [] },
        battle: { turn: 1, currentPlayerIdx: 0, players: [target], enemy: unit({ skills: [skill(type)] }),
            fieldBuffs: [], activeTraits: [], delayedEffects: [], isNewTurn: false },
        log: noop, hasArtifact: () => false, renderBattleView: noop, renderBattleControls: noop,
        winBattle: () => assert.fail('Unexpected win'), loseBattle: () => assert.fail('Unexpected defeat') };
    Logic.decideEnemyAction = () => skill(type);
    BattleRuntime.TurnManager.startEnemyTurn(rpg);
    assert.equal(10000 - target.hp, expected, 'enemy matrix ' + type);
}
for (const type of ['phy', 'mag']) for (const damage of [1, 3, 7, 201]) {
    assert.equal(Logic.calculateDamage(unit({ atk: damage, matk: damage }), unit({ buffs: { guard: 1, damage_half: 1 } }),
        skill(type), [], [], noop, 'origin', [], 1, []).dmg, Math.floor(damage * .5));
}
for (const reverse of [false, true]) {
    const target = unit({ guardDamageReduction: .75 });
    const half = { type: 'buff', id: 'damage_half', duration: 3 };
    const guard = { type: 'buff', id: 'guard', duration: 1 };
    const apply = effect => SideEffects.apply({ source: target, skill: { name: effect.id === 'guard' ? '가드' : '디바인아머' } }, effect);
    (reverse ? [guard, half] : [half, guard]).forEach(apply);
    apply(half);
    assert.equal(target.buffs.damage_half, 3);
    assert.equal(target.guardEnhancedTurns, 1);
    const rpg = { state: { mode: 'origin', artifacts: [], deck: [] }, battle: {
        turn: 1, currentPlayerIdx: 0, players: [target], enemy: unit(), fieldBuffs: [], activeTraits: [], delayedEffects: [] },
        log: noop, hasArtifact: () => false, renderBattleView: noop, renderBattleControls: noop, winBattle: noop, loseBattle: noop };
    const damages = [];
    for (let turn = 0; turn < 4; turn++) {
        const before = target.hp;
        Logic.decideEnemyAction = () => skill('phy');
        BattleRuntime.TurnManager.startEnemyTurn(rpg);
        damages.push(before - target.hp);
    }
    assert.equal(JSON.stringify(damages), JSON.stringify([50, 100, 100, 200]), 'three protected attacks and independent expiry');
    assert.equal(target.buffs.damage_half, undefined);
    assert.equal(target.buffs.guard, undefined);
    assert.equal(target.guardEnhancedTurns, undefined);
}
Logic.decideEnemyAction = originalDecision;
const producers = [...GameUtils.getAllCards(), ...ENEMIES].flatMap(card => (card.skills || []).flatMap(s =>
    (s.effects || []).filter(e => e.id === 'guard' || e.id === 'damage_half').map(e => ({ id: card.id, name: card.name, skill: s.name, effect: e.id, duration: e.duration || 1 }))));
for (const row of producers) assert.equal(row.effect, row.skill === '가드' ? 'guard' : 'damage_half', row.id + '/' + row.skill);
assert.ok(producers.some(row => row.id === 'flora' && row.effect === 'damage_half'));
for (const card of [...GameUtils.getAllCards(), ...GameUtils.getBattleOnlyForms(), ...ENEMIES]) for (const s of card.skills || []) assert.ok(SkillTypes.names[s.type], 'Unsupported: ' + card.id + '/' + s.name);
const data = { version: 1, metric: 'max_reached_stage', modes: {} };
assert.ok(ModeRecords.validate(data));
for (const modes of [{ alien: { maxStage: 2 } }, { origin: { maxStage: 1.5 } }, { origin: { maxStage: 0 } }, { origin: { maxStage: Infinity } }]) assert.equal(ModeRecords.validate({ ...data, modes }), false);
Storage.save(Storage.keys.RECORDS, ['최대 스테이지: 99']);
for (const modeId of Object.keys(ModeRecords.modeNames)) {
    assert.ok(ModeRecords.update({ modeId, gameType: 'endless', reachedStage: 7 }).ok);
    assert.ok(ModeRecords.update({ modeId, gameType: 'endless', reachedStage: 2 }).ok);
    assert.equal(ModeRecords.read().data.modes[modeId].maxStage, 7);
    assert.ok(ModeRecords.update({ modeId, gameType: 'challenge', reachedStage: 100 }).ok);
    assert.equal(ModeRecords.read().data.modes[modeId].maxStage, 7);
}
assert.equal(Storage.load(Storage.keys.RECORDS)[0], '최대 스테이지: 99');
for (const raw of ['broken JSON', JSON.stringify({ ...data, version: 2 })]) {
    localStorage.setItem(Storage.keys.MODE_RECORDS, raw);
    assert.equal(ModeRecords.update({ modeId: 'origin', gameType: 'endless', reachedStage: 80 }).ok, false);
    assert.equal(localStorage.getItem(Storage.keys.MODE_RECORDS), raw);
}
localStorage.setItem(Storage.keys.MODE_RECORDS, JSON.stringify(data));
const save = Storage.save;
Storage.save = () => false;
assert.equal(ModeRecords.update({ modeId: 'origin', gameType: 'endless', reachedStage: 3 }).ok, false);
assert.equal(Object.keys(ModeRecords.read().data.modes).length, 0);
Storage.save = save;
`, sandbox);
await fs.mkdir(new URL('../test-results/', import.meta.url), { recursive: true });
await fs.writeFile(new URL('../test-results/patch-guard-producers.json', import.meta.url), vm.runInContext('JSON.stringify(producers)', sandbox));
console.log('PASS: guard/half damage matrix, actual protected turns, producers, types and record schema/failures');
