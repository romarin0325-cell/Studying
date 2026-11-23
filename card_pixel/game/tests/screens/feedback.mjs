import assert from 'node:assert/strict';
import { chooseDoor, chooseEvent } from '../../src/engine/run.js';
import { cleanseLabel } from '../../src/ui/battle/log.js';
import { playRun } from '../../tools/sim.mjs';


// Claude cannot listen, so the gallery records what the synthesizer actually starts:
// each oscillator's waveform and starting frequency (11-23, after W3/W4B sound work).
async function recordTones(page) {
  await page.evaluate(() => {
    window.__tones = [];
    // Pitches are scheduled with setValueAtTime, so .value still reads the 440 Hz default at start().
    const set = AudioParam.prototype.setValueAtTime;
    AudioParam.prototype.setValueAtTime = function (value, time) {
      this.__scheduled ??= value;
      return set.call(this, value, time);
    };
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...args) {
      window.__tones.push({ type: this.type, hz: Math.round(this.frequency.__scheduled ?? this.frequency.value), state: this.context.state });
      return start.apply(this, args);
    };
  });
}
const tones = page => page.evaluate(() => window.__tones);
const warnTones = list => list.filter(tone => tone.type === 'sawtooth' && tone.hz === 104).length;

export function emberRewardFixture(floor, kind, storedSession) {
  let reward;
  playRun('ember_volcano', 23757, {
    onBattle(run, state, summary) {
      if (run.floor !== floor) return;
      assert.equal(summary.outcome, 'win');
      assert.equal(run.pending?.kind, kind);
      reward = {
        session: storedSession({ run }),
        candidate: run.pending.candidates[0],
        bench: [...run.bench]
      };
    }
  });
  assert.ok(reward?.candidate);
  return reward;
}

export function beetleWarningFixture(snapshot) {
  const commands = [];
  let session, party, danger, weak;
  playRun('ember_volcano', 7919, {
    trace(run, wait, option) {
      if (run.floor !== 1 || wait.s.turn > 3) return;
      assert.equal(wait.s.enemy.form, 'wild_emerald_beetle');
      if (wait.s.turn === 1) {
        session = snapshot?.(run);
        party = Array.from(run.room.party);
        danger = wait;
      }
      if (wait.s.turn < 3) commands.push(option.index);
      else weak = wait;
    }
  });
  assert.deepEqual(commands, [1, 3]);
  assert.deepEqual([danger.intent.salience, danger.countdown.name, danger.countdown.inTurns], ['ordinary', '껍질 돌진', 1]);
  assert.deepEqual([weak.intent.name, weak.intent.power, weak.intent.salience], ['약공', 0.55, 'ordinary']);
  assert.deepEqual([weak.countdown.name, weak.countdown.inTurns], ['껍질 반격', 1]);
  return { session, party, commands, danger, weak };
}

export function trenchCleanseFixture(snapshot) {
  const commands = [];
  let session, party, warning, cleanse;
  playRun('midnight_trench', 7919, {
    relicDoors: true,
    trace(run, wait, option, events) {
      if (run.floor !== 2 || wait.s.turn > 2) return;
      commands.push(option.index);
      if (wait.s.turn === 1) {
        session = snapshot?.(run);
        party = Array.from(run.room.party);
        assert.equal(wait.intent.salience, 'ordinary');
        assert.equal(wait.countdown.inTurns, 2);
        warning = events.find(event => event.t === 'await');
      } else {
        const cleanses = events.filter(event => event.t === 'rule' && event.rule === 'cleanse');
        assert.equal(cleanses.length, 1);
        [cleanse] = cleanses;
        assert.ok(events.some(event => event.t === 'await' && event.s.turn === 3));
      }
    }
  });
  assert.deepEqual(commands, [2, 2]);
  assert.equal(warning?.intent.salience, 'strong');
  assert.equal(cleanse?.turn, 2);
  assert.equal(cleanseLabel(cleanse), '정화 · 3종 해제');
  return { session, party, commands, warning, cleanse };
}

export function createFeedbackCases({ makeRun, storedSession, openBattle, battleIdle }) {
  return {
    'access-danger-warning': () => {
      const { session, party, commands, weak } = beetleWarningFixture(run => storedSession({ run }));
      return {
        session, settings: { sound: true, music: false },
        proof: 'Ember 7919 floor 1: commands 1,3 leave a weak hit before shell counter without a strong warning',
        async show(page, { text, capture }) {
          await openBattle(page);
          assert.deepEqual(await page.evaluate(() => window.__game.B.party), party);
          for (const [offset, index] of commands.entries()) {
            if (offset === commands.length - 1) await recordTones(page);
            await page.locator(`#acts .act[data-i="${index}"]`).click();
            await battleIdle(page);
            if (offset === 0) {
              assert.equal(await page.evaluate(() => window.__game.B.lastWarning), `${weak.enemyIndex}/${weak.s.turn - 1}`);
            }
          }
          await text(page.locator('#intent'), weak.intent.name);
          assert.notEqual(await page.evaluate(() => window.__game.B.lastWarning), `${weak.enemyIndex}/${weak.s.turn}`);
          const heard = await tones(page);
          // Other battle sounds played in the same span, so silence here means no warning, not no audio.
          assert.ok(heard.length > 0, 'The synthesizer ran during the turn');
          assert.equal(warnTones(heard), 0, 'No warning tone before a weak hit');
          await capture();
        }
      };
    },
    'access-cleanse-feedback': () => {
      const { session, party, commands: [first, second], warning, cleanse } = trenchCleanseFixture(run => storedSession({ run }));
      const cleanseLine = cleanseLabel(cleanse);
      const warningKey = `${warning.enemyIndex}/${warning.s.turn}`;
      return {
        session, settings: { sound: true, music: false },
        proof: 'Trench 7919 floor 2: fast-forward to a strong intent, then replay the three-status cleanse once',
        async show(page, { text, capture }) {
          await openBattle(page);
          assert.deepEqual(await page.evaluate(() => window.__game.B.party), party);
          await page.evaluate(() => {
            const skip = document.querySelector('#skip');
            window.__feedback = { fast: false, labels: [], announcements: [] };
            new MutationObserver(records => {
              window.__feedback.fast ||= skip.classList.contains('on') || records.some(record => record.oldValue === 'on');
            }).observe(skip, { attributeFilter: ['class'], attributeOldValue: true });
            new MutationObserver(records => {
              for (const record of records) {
                for (const node of record.addedNodes) {
                  if (node.matches?.('.tag')) window.__feedback.labels.push(node.textContent);
                }
              }
            }).observe(document.querySelector('#fx'), { childList: true });
            new MutationObserver(records => {
              for (const record of records) {
                for (const node of record.addedNodes) window.__feedback.announcements.push(node.textContent);
              }
            }).observe(document.querySelector('#battle-announcement'), { childList: true });
          });
          const command = index => page.locator(`#acts .act[data-i="${index}"]`).click();
          const intent = page.locator('#intent');
          await recordTones(page);
          await command(first);
          await page.locator('#cv').click();
          await battleIdle(page);
          await text(intent, warning.intent.name);
          const warningState = await page.evaluate(() => ({
            fast: window.__feedback.fast, readyFast: window.__game.clock.fast, key: window.__game.B.lastWarning
          }));
          assert.deepEqual(warningState, { fast: true, readyFast: false, key: warningKey });
          // The warning muted by fast-forward is heard once when the command returns: two 104 Hz sawtooth pulses.
          assert.equal(warnTones(await tones(page)), 2, 'One audible warning after fast-forward');
          const turn2 = await intent.textContent();
          await command(second);
          await battleIdle(page);
          await text(page.locator('#ticker'), cleanseLine, { exact: true });
          const turn3 = await intent.textContent();
          const expected = turn3 + ' · ' + cleanseLine;
          assert.equal(await page.locator('#battle-announcement').textContent(), expected);
          const { labels, announcements } = await page.evaluate(() => window.__feedback);
          assert.equal(labels.filter(label => label === cleanseLine).length, 1);
          assert.deepEqual(announcements, [turn2, expected]);
          await capture();
        }
      };
    },
    'access-promise-seal': () => {
      const run = makeRun({ dungeonId: 'ember_volcano', seed: 7, floor: 3, tempoVersion: 2 });
      const door = run.doors.find(entry => entry.event?.id === 'kept_chest');
      assert.ok(door);
      assert.equal(chooseDoor(run, door.index).ok, true);
      const session = storedSession({ run });
      const chosen = chooseEvent(run, 'deposit');
      assert.equal(chosen.ok, true);
      assert.equal(chosen.effects.some(effect => effect.type === 'promise'), true);
      return {
        session, settings: { sound: true, music: false },
        proof: 'Ember 7 floor 3: the kept chest accepts the deposit and plays the promise seal',
        async show(page, { text, capture }) {
          const event = page.locator('#event.on');
          await text(event.locator('h2'), '맡겨 둔 상자', { exact: true });
          await recordTones(page);
          await event.locator('[data-choice="deposit"]').click();
          await text(event.locator('.event-dialog'), `${run.promise.floor}층 약속`);
          // The seal: 784 Hz then 1175 Hz sine, distinct from the 660 Hz square tap.
          const seal = (await tones(page)).filter(tone => tone.type === 'sine').map(tone => tone.hz);
          assert.deepEqual(seal, [784, 1175]);
          await capture();
        }
      };
    }
  };
}
