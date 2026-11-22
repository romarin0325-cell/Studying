import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudio } from '../src/stage/audio.js';
import { create } from '../src/engine/bridge.js';
import { warningDue } from '../src/ui/battle/effect-plan.js';
import { cleanseLabel } from '../src/ui/battle/log.js';
import { planBattleAction } from '../src/ui/battle/view.js';
import { trenchCleanseFixture } from './screens/feedback.mjs';
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

test('fast-forward leaves a qualifying warning available when commands resume', () => {
  assert.equal(warningDue({ ...command, fast: true }), false);
  assert.equal(warningDue(command), true);
  assert.equal(warningDue({ ...command, intent: ordinary, countdown: { inTurns: 1 } }), true);
  assert.equal(warningDue({ ...command, intent: ordinary, countdown: { inTurns: 2 } }), false);
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
