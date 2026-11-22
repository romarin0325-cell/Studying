import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudio } from '../src/stage/audio.js';
import { create } from '../src/engine/bridge.js';
import { warningDue } from '../src/ui/battle/effect-plan.js';
import { cleanseLabel } from '../src/ui/battle/log.js';
import { contractSettlement, resultNextLabel } from '../src/ui/battle/result.js';
import { planBattleAction } from '../src/ui/battle/view.js';
import { createSheet } from '../src/ui/sheet.js';
import { RESUME } from '../src/ui/glossary.js';
import { beetleWarningFixture, trenchCleanseFixture } from './screens/feedback.mjs';
import { createCoreRoster } from './support/core.mjs';

test('the trench cleanse reports the distinct statuses removed on floor 2, turn 2', () => {
  const { cleanse } = trenchCleanseFixture();
  assert.deepEqual(Object.keys(cleanse.before).sort(), ['corrosion', 'silence', 'weak']);
  assert.equal(cleanseLabel(cleanse), '정화 · 3종 해제');
  assert.equal(cleanseLabel({ ...cleanse, before: {} }), '');
  assert.equal(cleanseLabel({ ...cleanse, after: { corrosion: 1 } }), '정화 · 2종 해제');
  assert.equal(cleanseLabel({ ...cleanse, preventedBy: 'stun' }), '');
});

test('an ally skill uses its actual buff removals to report a cleanse on its target', () => {
  const { core, roster } = createCoreRoster();
  const base = roster.wildOf('golem');
  const enemy = { ...base, stats: { ...base.stats, hp: 10000 } };
  const battle = create(core, {
    seed: 7, party: ['ancient_soul'], enemies: [enemy],
    start: { allyStart: [{ mp: 60 }], enemyDebuffs: { corrosion: 1, weak: 1 } }
  });
  battle.start();
  const option = battle.options().find(option => option.name === '영혼수확');
  assert.ok(option?.usable);
  const events = battle.act(option.index);
  const cast = events.findIndex(e => e.t === 'act');
  const { cleanses } = planBattleAction(events, cast, { core, artifacts: [] });
  assert.equal(cleanses.length, 1);
  assert.deepEqual(cleanses[0].target, events[cast].target);
  assert.equal(cleanseLabel(cleanses[0]), '정화 · 2종 해제');
});

const strong = { salience: 'strong' };
const ordinary = { salience: 'ordinary' };
const command = { key: '0/2', playedKey: null, fast: false, soundOn: true, intent: strong };

test('Ember 7919 warns for the beetle charge and stays quiet for the weak hit before shell counter', () => {
  const { danger, weak } = beetleWarningFixture();
  assert.equal(warningDue({ ...command, ...danger }), true);
  assert.equal(warningDue({ ...command, ...weak }), false);
});

test('Trench 7919 leaves exactly one strong warning available when commands resume after fast-forward', () => {
  const { warning } = trenchCleanseFixture();
  const key = `${warning.enemyIndex}/${warning.s.turn}`;
  const forecast = { ...command, ...warning, key };
  assert.equal(warningDue({ ...forecast, fast: true }), false);
  assert.equal(warningDue(forecast), true);
  assert.equal(warningDue({ ...forecast, playedKey: key }), false);
});

test('only an intent without salience can use an unclassified countdown for its warning', () => {
  assert.equal(warningDue({ ...command, intent: {}, countdown: { inTurns: 1 } }), true);
  assert.equal(warningDue({ ...command, intent: {}, countdown: { inTurns: 2 } }), false);
  assert.equal(warningDue({ ...command, intent: ordinary, countdown: { inTurns: 1 } }), false);
});

test('audible warnings are delivered only once per enemy and turn', () => {
  assert.equal(warningDue({ ...command, playedKey: command.key, immediate: true }), false);
  assert.equal(warningDue({ ...command, playedKey: command.key }), false);
  assert.equal(warningDue({ ...command, key: '1/2', playedKey: command.key }), true);
});

test('a muted setting never leaves an old warning to play on a later command', () => {
  assert.equal(warningDue({ ...command, fast: true, soundOn: false }), false);
  assert.equal(warningDue({ ...command, soundOn: false }), false);
  assert.equal(warningDue({ ...command, key: '0/3', intent: ordinary }), false);
});

test('the result board labels the next step for retries, borrowed battles and pending rewards', () => {
  const battle = { floor: 4, roomType: 'gate', won: true, retry: false };
  assert.equal(resultNextLabel({ pending: { kind: 'gate' } }, { ...battle, retry: true }), '편성 바꿔 재도전');
  assert.equal(resultNextLabel({}, { ...battle, roomType: 'borrowed' }), '다음 동료 고르기');
  assert.equal(resultNextLabel({ pending: { kind: 'reinforcement' } }, battle), '동료 보충하기');
  assert.equal(resultNextLabel({ pending: { kind: 'gate' } }, battle), '문지기 보상 고르기');
  assert.equal(resultNextLabel({ pending: { kind: 'relic' } }, battle), '유물 보상 고르기');
  assert.equal(resultNextLabel({}, battle), '5층으로');
});

test('the final battle label uses saved reward choices and the daily result label', () => {
  const boss = { floor: 8, roomType: 'boss', won: true, retry: false };
  const win = { result: 'win', resultRewards: { recruitable: ['ash'], recruitTags: { ash: 'boss' } } };
  const loss = { result: 'lose', resultRewards: { shardCandidates: ['ash'] } };
  assert.equal(resultNextLabel(win, boss), '영입할 동료 고르기');
  assert.equal(resultNextLabel(loss, { ...boss, won: false }), '다음 원정 후보 고르기');
  assert.equal(resultNextLabel({ ...win, resultRewards: { recruitable: [] } }, boss), '관측소로');
  assert.equal(resultNextLabel({ ...win, daily: true }, boss), RESUME.dailyResult);
  assert.equal(resultNextLabel({ ...win, pending: { kind: 'relic' } }, boss), '유물 보상 고르기');
});

test('the result board reports contract completion and shows payment or forfeiture on floor six', () => {
  assert.deepEqual(contractSettlement(6, null), []);
  assert.deepEqual(contractSettlement(5, { metNow: true, paid: 3 }), ['<p class="contract-met">계약 달성</p>']);
  assert.deepEqual(contractSettlement(6, { metNow: true, paid: 3 }), [
    '<p class="contract-met">계약 달성</p>', '<p class="gain">7층 앞에서 ◆3</p>'
  ]);
  assert.deepEqual(contractSettlement(6, { failed: true, escrowed: 2 }), [
    '<p class="contract-failed">계약 실패 · 맡긴 ◆2 사라짐</p>'
  ]);
});

test('the open result board wraps Tab and receives focus back from its detail sheet', async () => {
  const bindings = new Map();
  const doc = {
    body: {},
    querySelector: selector => bindings.get(selector) ?? null,
    addEventListener(type, listener) { bindings.set(type, listener); }
  };
  const button = (primary = false) => ({
    tabIndex: 0, isConnected: true, matches: selector => primary && selector.includes('#b-next'),
    closest: () => null, getClientRects: () => [{}], focus() { doc.activeElement = this; },
    addEventListener() {}
  });
  const log = button(), next = button(true), foe = button();
  const result = { querySelectorAll: () => [log, next], contains: node => node === log || node === next };
  bindings.set('#battle.on #result.on', result);
  bindings.set('#sheet', { classList: { toggle() {}, add() {}, remove() {} }, addEventListener() {} });
  bindings.set('#sh-title', button());
  bindings.set('#sh-body', { querySelectorAll: () => [] });
  bindings.set('#b-sheetclose', button());

  const previousDocument = globalThis.document, previousStyle = globalThis.getComputedStyle;
  globalThis.document = doc;
  globalThis.getComputedStyle = () => ({ visibility: 'visible' });
  try {
    const sheet = createSheet({ pause() {} });
    next.focus();
    let trapped = false;
    bindings.get('keydown')({ key: 'Tab', preventDefault() { trapped = true; }, stopPropagation() {} });
    assert.equal(trapped, true);
    assert.equal(doc.activeElement, log);
    bindings.get('keydown')({ key: 'Tab', shiftKey: true, preventDefault() {}, stopPropagation() {} });
    assert.equal(doc.activeElement, next);

    sheet.openSheet('전투 기록', '', { opener: log });
    assert.equal(result.inert, true);
    sheet.closeSheet();
    assert.equal(result.inert, false);
    assert.equal(doc.activeElement, log);
    sheet.openSheet('적 전투 정보', '', { opener: foe });
    sheet.closeSheet();
    assert.equal(doc.activeElement, next);
  } finally {
    await Promise.resolve(); // Let the sheet's focus restoration finish before removing the DOM stub.
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousStyle === undefined) delete globalThis.getComputedStyle;
    else globalThis.getComputedStyle = previousStyle;
  }
});

test('the warning reports when audio can play and the seal schedules a short click and two rising notes', t => {
  const voices = [], clicks = [];
  const context = {
    state: 'suspended', sampleRate: 1000, currentTime: 1,
    createOscillator() {
      const voice = {
        frequency: { setValueAtTime(value) { voice.note = value; }, linearRampToValueAtTime() {} },
        start(time) { voice.from = time; }, stop(time) { voice.to = time; }, connect() {}
      };
      voices.push(voice);
      return voice;
    },
    createGain: () => ({ gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} }),
    createBuffer: (_, length) => ({ length, getChannelData: () => new Float32Array(length) }),
    createBufferSource() { return { connect() {}, start(time) { clicks.push([time, this.buffer.length]); } }; }
  };
  const previousWindow = globalThis.window;
  globalThis.window = { AudioContext: class { constructor() { return context; } } };
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });
  const clock = { fast: false };
  const audio = createAudio(clock);
  assert.equal(audio.sfx.warn(), false);
  audio.unlockAudio();
  assert.equal(audio.sfx.warn(), false);
  context.state = 'running';
  clock.fast = true;
  assert.equal(audio.sfx.warn(), false);
  clock.fast = false;
  audio.soundOn = false;
  assert.equal(audio.sfx.warn(), false);
  assert.equal(voices.length, 0);
  audio.soundOn = true;
  assert.equal(audio.sfx.warn(), true);
  assert.deepEqual(voices.map(({ type, note }) => [type, note]), [['sawtooth', 104], ['sawtooth', 104]]);

  audio.sfx.seal();
  assert.deepEqual(clicks, [[1, 25]]);
  const seal = voices.slice(2);
  assert.deepEqual(seal.map(({ type, note }) => [type, note]), [['sine', 784], ['sine', 1175]]);
  assert.ok(seal[0].from < seal[1].from && seal[1].to < context.currentTime + 0.25);
});
