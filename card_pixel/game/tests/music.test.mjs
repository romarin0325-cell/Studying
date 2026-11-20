import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createMusic, TRACKS } from '../src/audio/music.js';

const REGIONS = [
  'dawn_forest', 'ember_volcano', 'twilight_cathedral', 'starlit_garden',
  'midnight_trench', 'arena', 'creation_tower'
];

class FakeParam {
  value = 0;
  events = [];

  setValueAtTime(value, at) { this.events.push(['set', value, at]); }
  linearRampToValueAtTime(value, at) { this.events.push(['ramp', value, at]); }
  exponentialRampToValueAtTime(value, at) { this.events.push(['exponential', value, at]); }
  setTargetAtTime(value, at, decay) { this.events.push(['target', value, at, decay]); }
  cancelScheduledValues(at) { this.events = this.events.filter(event => event[2] < at); }
}

class FakeNode {
  outputs = new Set();

  connect(node) { this.outputs.add(node); }
  disconnect() { this.outputs.clear(); }
}

class FakeSource extends FakeNode {
  frequency = new FakeParam();
  onended = null;

  constructor(context) {
    super();
    this.context = context;
  }

  start(at) {
    assert.ok(at >= this.context.currentTime, `scheduled ${at} in the past`);
    assert.equal(this.startAt, undefined);
    this.startAt = at;
    const [filter] = this.outputs;
    const [envelope] = filter.outputs;
    [this.bus] = envelope.outputs;
  }

  stop(at) {
    assert.ok(this.startAt !== undefined);
    this.stopAt = at;
  }
}

class FakeContext extends EventTarget {
  currentTime = 0;
  state = 'running';
  sampleRate = 8000;
  destination = new FakeNode();
  nodes = [];
  sources = [];

  createGain() {
    const node = new FakeNode();
    node.gain = new FakeParam();
    this.nodes.push(node);
    return node;
  }

  createBiquadFilter() {
    const node = new FakeNode();
    node.frequency = new FakeParam();
    this.nodes.push(node);
    return node;
  }

  createOscillator() {
    const source = new FakeSource(this);
    this.nodes.push(source);
    this.sources.push(source);
    return source;
  }

  createBufferSource() { return this.createOscillator(); }

  createBuffer(_channels, length) {
    const data = new Float32Array(length);
    return { getChannelData() { return data; } };
  }

  moveTo(time) {
    assert.ok(time >= this.currentTime);
    this.currentTime = time;
    for (const source of this.sources) {
      if (source.stopAt <= time) source.onended?.();
    }
  }

  changeState(state) {
    this.state = state;
    this.dispatchEvent(new Event('statechange'));
  }
}

function setup(t) {
  const callbacks = new Set();
  t.mock.method(globalThis, 'setInterval', function (callback) {
    callbacks.add(callback);
    return callback;
  });
  t.mock.method(globalThis, 'clearInterval', function (handle) {
    callbacks.delete(handle);
  });
  const context = new FakeContext();
  const music = createMusic({ context });

  function tick(time) {
    context.moveTo(time);
    for (const callback of callbacks) callback();
  }

  function assertReleased() {
    assert.ok(context.nodes.every(node => node.outputs.size === 0));
    assert.ok(context.sources.every(source => source.onended === null));
    assert.equal(callbacks.size, 0);
    assert.equal(getEventListeners(context, 'statechange').length, 0);
  }

  return { context, music, tick, assertReleased };
}

function closeTo(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `expected ${expected}, got ${actual}`);
}

function pitchNumber(note) {
  const match = /^([A-G])([b#]?)([2-6])$/.exec(note);
  assert.ok(match, `invalid note ${note}`);
  const [, pitch, accidental, octave] = match;
  const chromatic = ['C', '', 'D', '', 'E', 'F', '', 'G', '', 'A', '', 'B'];
  return 12 * (Number(octave) + 1) + chromatic.indexOf(pitch) +
    Number(accidental === '#') - Number(accidental === 'b');
}

function paddedBars(context, start, count, secondsPerBar) {
  for (let bar = 0; bar < count; bar++) {
    const at = start + bar * secondsPerBar;
    const attacks = context.sources.filter(source => Math.abs(source.startAt - at) < 1e-8);
    assert.ok(attacks.length >= 3, `missing chord at bar ${bar + 1}`);
    assert.ok(attacks.some(source => Math.abs(source.stopAt - at - secondsPerBar) < 1e-8),
      `chord duration did not match bar ${bar + 1}`);
  }
}

test('every score has valid notes, complete measures and a varied loop or short ending', () => {
  assert.deepEqual(Object.keys(TRACKS), ['hub', ...REGIONS, 'battle', 'boss', 'victory', 'defeat']);
  for (const [id, track] of Object.entries(TRACKS)) {
    assert.match(track.name, /[가-힣]/);
    assert.match(track.description, /[가-힣]/);
    if (track.bars) {
      assert.equal(track.bars.length, 8);
      assert.ok(track.bpmScale > 1);
      for (const region of REGIONS) {
        const theme = TRACKS[region];
        assert.ok(track.bars.every(bar => theme.progression.at(bar)), `${id}/${region}`);
        checkBass(track.bass[theme.beats], theme.beats);
      }
      continue;
    }

    const { beats, bpm, chords, progression, melody, once, bass } = track;
    assert.ok(bpm >= 60 && bpm <= 160);
    assert.ok(beats === 3 || beats === 4);
    assert.match(track.key, /^[A-G][#b]? (major|minor)$/);
    assert.equal(track.instruments.length, 4);
    assert.equal(melody.length, progression.length);
    if (once) {
      assert.ok(beats * melody.length * 60 / bpm <= 6);
    } else {
      assert.ok(melody.length >= 8 && melody.length <= 16);
      const half = melody.length / 2;
      assert.notDeepEqual(melody.slice(0, half), melody.slice(half));
      assert.notDeepEqual(progression.slice(0, half), progression.slice(half));
    }

    for (const chord of progression) {
      const [root, ...pad] = chords[chord].map(pitchNumber);
      assert.ok(root >= 36 && root <= 47);
      assert.ok(pad.length >= 3 && pad.every(pitch => pitch >= 48 && pitch <= 72));
    }

    for (const bar of melody) {
      assert.ok(bar.some(([note]) => note));
      for (const [note, length] of bar) {
        assert.ok(Number.isFinite(length) && length > 0);
        if (note !== null) {
          const pitch = pitchNumber(note);
          assert.ok(pitch >= 59 && pitch <= 91);
        }
      }
      closeTo(bar.reduce((total, pair) => total + pair[1], 0), beats);
    }
    checkBass(bass, beats);
  }

  function checkBass(pattern, beats) {
    for (const [start, interval, length] of pattern) {
      assert.ok(start >= 0 && length > 0 && start + length <= beats);
      assert.ok(Number.isInteger(interval) && interval >= 0 && interval <= 12);
    }
  }
});

test('all scores schedule on their tempo and repeat or release at the end', t => {
  const { context, music, tick, assertReleased } = setup(t);
  for (const id of Object.keys(TRACKS)) {
    const track = TRACKS[id];
    for (const region of track.bars ? REGIONS : [undefined]) {
      const theme = region ? TRACKS[region] : track;
      const bars = track.bars?.length ?? track.progression.length;
      const barDuration = theme.beats * 60 / (theme.bpm * (track.bpmScale ?? 1));
      const firstSource = context.sources.length;
      music.play(id, region);
      const start = context.sources[firstSource].startAt;
      const end = start + bars * barDuration;
      for (let time = context.currentTime + 0.25; time < end + 0.25; time += 0.25) tick(time);
      paddedBars({ sources: context.sources.slice(firstSource) }, start, bars + Number(!track.once), barDuration);
      if (track.once) {
        tick(end + 0.3);
        assert.ok(context.sources.slice(firstSource).every(source => source.startAt < end));
        assertReleased();
      } else {
        music.stop();
        tick(context.currentTime + 0.2);
        assertReleased();
      }
    }
  }
});

test('play is idempotent and crossfades on the next bar with independent gains', t => {
  const { context, music, tick, assertReleased } = setup(t);
  music.play('hub');
  const outgoing = context.sources[0].bus;
  const [master] = outgoing.outputs;
  closeTo(master.gain.value, 10 ** (-10 / 20));
  const start = context.sources[0].startAt;
  const bar = start + 4 * 60 / TRACKS.hub.bpm;
  tick(0.4);
  const count = context.nodes.length;
  music.play('hub');
  assert.equal(context.nodes.length, count);
  music.play('dawn_forest');
  const queuedCount = context.nodes.length;
  music.play('dawn_forest');
  music.play('hub');
  assert.equal(context.nodes.length, queuedCount);
  assert.deepEqual(outgoing.gain.events.slice(-2), [['set', 1, bar], ['ramp', 0, bar + 0.8]]);

  tick(bar - 0.3);
  const firstIncoming = context.sources.find(source => source.bus !== outgoing);
  const incoming = firstIncoming.bus;
  closeTo(firstIncoming.startAt, bar);
  assert.deepEqual(incoming.gain.events, [['set', 0, bar], ['ramp', 1, bar + 0.8]]);
  tick(bar + 0.4);
  assert.ok(outgoing.outputs.has(master) && incoming.outputs.has(master));
  tick(bar + 0.85);
  assert.equal(outgoing.outputs.size, 0);
  assert.ok(incoming.outputs.has(master));
  music.stop();
  assert.equal(incoming.gain.events.at(-1)[1], 0);
  tick(bar + 1.1);
  assertReleased();
});

test('replacing and stopping queued tracks disconnects notes scheduled in advance', t => {
  const { context, music, tick, assertReleased } = setup(t);
  music.play('arena');
  const outgoing = context.sources[0].bus;
  const bar = context.sources[0].startAt + 4 * 60 / TRACKS.arena.bpm;
  music.play('boss');
  tick(bar - 0.1);
  const discarded = context.sources.filter(source => source.bus !== outgoing);
  assert.ok(discarded.length > 0);
  music.play('victory');
  assert.ok(discarded.every(source => source.stopAt < source.startAt && !source.outputs.size));
  music.stop();
  tick(bar + 0.15);
  assertReleased();
});

test('combat keeps the selected dungeon key, sound and meter', t => {
  const { context, music, tick, assertReleased } = setup(t);
  const bar = 4 * 60 / TRACKS.ember_volcano.bpm;
  music.play('ember_volcano');
  const start = context.sources[0].startAt;
  const firstChord = context.sources.slice(0, 3).map(source => source.frequency.events[0][1]);
  music.play('battle');
  tick(start + bar - 0.1);
  const battleChord = context.sources.filter(source => source.bus !== context.sources[0].bus).slice(0, 3);
  assert.deepEqual(battleChord.map(source => source.frequency.events[0][1]), firstChord);
  assert.ok(battleChord.every(source => source.type === 'sawtooth'));
  tick(start + bar + 0.1);
  music.play('battle', 'starlit_garden');
  const change = start + bar + bar / TRACKS.battle.bpmScale;
  tick(change - 0.1);
  const gardenChord = context.sources.find(source => source.startAt === change &&
    source.bus !== battleChord[0].bus && source.bus !== context.sources[0].bus && source.type === 'triangle');
  assert.ok(gardenChord);
  closeTo(gardenChord.stopAt - change, 3 * 60 / (TRACKS.starlit_garden.bpm * TRACKS.battle.bpmScale));
  music.stop();
  tick(change + 0.2);
  assertReleased();
});

test('hidden scheduling looks further ahead and a stalled or suspended clock recovers', t => {
  const { context, music, tick, assertReleased } = setup(t);
  const document = new EventTarget();
  document.hidden = false;
  const savedDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  t.after(() => {
    if (savedDocument) Object.defineProperty(globalThis, 'document', savedDocument);
    else delete globalThis.document;
  });

  context.changeState('suspended');
  music.play('creation_tower');
  assert.equal(context.sources.length, 0);
  context.changeState('running');
  assert.ok(context.sources.length > 0);
  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  assert.ok(context.sources.some(source => source.startAt > 2));
  const count = context.sources.length;
  context.moveTo(63.3);
  document.hidden = false;
  document.dispatchEvent(new Event('visibilitychange'));
  const resumed = context.sources.slice(count);
  assert.ok(resumed.length > 0 && resumed.length < 20);
  assert.ok(resumed.every(source => source.startAt >= 63.3 && source.startAt < 63.65));
  music.stop();
  context.changeState('suspended');
  tick(63.3);
  assertReleased();
  assert.equal(getEventListeners(document, 'visibilitychange').length, 0);
});

test('volume clamps and disabling releases nodes while retaining the selected track', t => {
  const { context, music, tick, assertReleased } = setup(t);
  music.setVolume(2);
  music.play('arena');
  const [master] = context.sources[0].bus.outputs;
  closeTo(master.gain.value, 10 ** (-10 / 20));
  tick(0.4);
  music.setVolume(-1);
  assert.deepEqual(master.gain.events.at(-1), ['target', 0, 0.4, 0.025]);
  music.setEnabled(false);
  tick(0.6);
  assertReleased();
  music.play('boss');
  const count = context.sources.length;
  tick(0.8);
  assert.equal(context.sources.length, count);
  music.setEnabled(true);
  assert.ok(context.sources.length > count);
  assert.equal(context.sources[count].type, 'sawtooth');
  music.stop();
  tick(1);
  assertReleased();
});

test('standalone preview embeds the same music module', () => {
  const module = readFileSync(new URL('../src/audio/music.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../tools/music-preview.html', import.meta.url), 'utf8');
  const embedded = html.match(/\/\* BEGIN EMBEDDED MUSIC MODULE \*\/\r?\n([\s\S]+?)\/\* END EMBEDDED MUSIC MODULE \*\//);
  assert.ok(embedded);
  assert.equal(embedded[1].replaceAll('\r\n', '\n').trimEnd(), module.replaceAll('\r\n', '\n').trimEnd(),
    'Refresh the embedded module in music-preview.html after editing music.js');
});
