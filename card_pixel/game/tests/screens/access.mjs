import assert from 'node:assert/strict';
import { INTRO } from '../../src/content/intro.js';
import { defaultParty, settleBattle } from '../../src/engine/run.js';
import { resolveMotion } from '../../src/ui/battle/motion.js';
import { SETTINGS_KEY } from '../../src/ui/storage.js';
import { createFeedbackCases } from './feedback.mjs';

const lead = 'snow_rabbit';
const skill = '스노우샷';
const heirloom = '섀도우길로틴';
const tile = index => `#acts .act[data-i="${index}"]`;
const setting = key => `#sheet.on [data-set="${key}"]`;

async function focused(page, selector) {
  assert.equal(await page.locator(`${selector}:focus`).count(), 1, `Expected focus on ${selector}`);
}

async function tabTo(page, selector) {
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    if (await page.locator(`${selector}:focus`).count()) return;
  }
  assert.fail(`Tab never reached ${selector}`);
}

export function createAccessCases({ makeRun, startBattle, storedSession, act, openBattle, battleIdle, snowRabbitProfile, enterObservatory }) {
  function battleFixture(move) {
    const run = makeRun({ seed: 21, floor: 2, tempoVersion: 2, profileView: { lead } });
    run.lastParty = [lead, ...run.bench.filter(id => id !== lead).slice(0, 2)];
    run.nextBattle = { start: { allyStart: [{ mp: 60 }] } };
    run.heirlooms[lead] = { from: 'executor', name: heirloom };
    const session = storedSession({ run });
    const battle = startBattle(run, { party: defaultParty(run) });
    const options = battle.options();
    const initial = battle.state();
    assert.deepEqual(Array.from(options.filter(option => option.usable), option => option.index), [0, 1, 2, 3, 4]);
    assert.equal(options[2].name, skill);
    const events = act(battle, move);
    const cast = events.find(event => event.t === 'act');
    const hits = events.filter(event => event.t === 'hp' && event.who.side === 'enemy' && event.delta < 0);
    assert.equal(cast?.skill.name, move);
    assert.equal(hits.length, 1);
    assert.ok(hits[0].s.enemy.hp > 0, 'The fixture needs a non-finishing hit');
    if (move === heirloom) {
      assert.equal(cast.heirloom, true);
      const motion = resolveMotion({ sourceKey: cast.sourceKey, skill: cast.skill, side: cast.who.side, heirloom: true });
      assert.equal(motion.range, 'melee');
      assert.equal(motion.size, 'big');
    } else {
      assert.equal(battle.canRetreat(), true);
      assert.ok(battle.retreat().some(event => event.t === 'retreat'));
    }
    return { session, initial, damage: hits[0].amount };
  }

  return {
    ...createFeedbackCases({ makeRun, storedSession, openBattle, battleIdle }),
    'access-result-focus': () => {
      const run = makeRun({ dungeonId: 'dawn_forest', seed: 7, tempoVersion: 2 });
      const battle = startBattle(run, { party: INTRO.party });
      const session = storedSession({ run });
      assert.ok(battle.retreat().some(event => event.t === 'retreat'));
      const finisher = '실버스톰';
      act(battle, finisher);
      assert.equal(battle.outcome, 'win');
      assert.equal(settleBattle(run, battle.summary()).ok, true);
      return {
        session, mute: true,
        proof: 'Dawn Forest 7: retreat and Silver Storm open the live result; Tab wraps and closing the log returns to its button',
        async show(page, { text, capture }) {
          const board = page.locator('#result.on');
          const next = '#result.on #b-next';
          const log = '#result.on #b-result-log';
          await battleIdle(page);
          await page.locator('[data-opening-rescue]').click();
          await battleIdle(page);
          await page.locator('#acts .act').filter({ hasText: finisher }).click();
          await board.waitFor();
          await focused(page, next);
          const background = await page.locator('#battle > :not(#result)').evaluateAll(nodes => nodes.every(node => node.inert));
          assert.equal(background, true);
          await page.locator('#foebar').evaluate(node => node.focus());
          await focused(page, next);
          for (const key of ['Tab', 'Shift+Tab']) {
            await page.keyboard.press(key);
            await focused(page, log);
            await page.keyboard.press(key);
            await focused(page, next);
          }
          await page.keyboard.press('Tab');
          await page.keyboard.press('Enter');
          await text(page.locator('#sheet.on #sh-title'), '전투 기록', { exact: true });
          assert.equal(await board.evaluate(node => node.inert), true);
          await page.keyboard.press('Escape');
          await page.locator('#sheet').waitFor({ state: 'hidden' });
          await focused(page, log);
          await capture();
          await page.reload({ waitUntil: 'domcontentloaded' });
          await board.waitFor();
          await focused(page, next);
          await page.keyboard.press('Enter');
          await board.waitFor({ state: 'hidden' });
          assert.equal(await page.locator('#battle > [inert]').count(), 0);
        }
      };
    },
    'access-inspection': () => {
      const { session, initial } = battleFixture(skill);
      assert.ok(initial.enemy && initial.allies[1] && initial.allies[2]);
      assert.equal(initial.cur, 0);
      return {
        session, mute: true,
        proof: 'A foe and three roster rows follow the command panel, with distinct enemy and bench sheets',
        async show(page, { text, capture }) {
          const foe = '#foebar';
          const row = index => `#party .pm[data-i="${index}"]`;
          const assertLabel = async (selector, { name, hp, maxHp }) => {
            const locator = page.locator(selector);
            assert.equal(await locator.getAttribute('role'), 'button');
            assert.equal(await locator.getAttribute('tabindex'), '0');
            assert.equal(await locator.getAttribute('aria-label'),
              `${name} · HP ${hp.toLocaleString('en-US')}/${maxHp.toLocaleString('en-US')} · 정보 보기`);
          };
          async function inspect(selector, unit, key, title, closeKey) {
            await assertLabel(selector, unit);
            await page.keyboard.press(key);
            await text(page.locator('#sheet.on #sh-title'), title, { exact: true });
            await text(page.locator('#sheet.on .ih b').first(), unit.name, { exact: true });
            const clock = await page.evaluate(async () => {
              const game = window.__game;
              const before = [game.clock.paused, game.clock.t, game.B.all.length];
              await game.advance(0.2);
              return { before, after: [game.clock.paused, game.clock.t, game.B.all.length] };
            });
            assert.equal(clock.before[0], true);
            assert.deepEqual(clock.after, clock.before);
            if (closeKey === 'Escape') await page.keyboard.press(closeKey);
            else {
              await tabTo(page, '#b-sheetclose');
              await page.keyboard.press(closeKey);
            }
            await page.locator('#sheet').waitFor({ state: 'hidden' });
            await focused(page, selector);
            assert.equal(await page.evaluate(() => window.__game.clock.paused), false);
          }

          await openBattle(page);
          assert.equal(await page.locator('#battle [aria-live="polite"]').count(), 1);
          const announcement = page.locator('#battle-announcement');
          assert.equal(await announcement.textContent(), await page.locator('#intent').textContent());
          assert.equal(await announcement.evaluate(node => node.childNodes.length), 1);

          await tabTo(page, tile(1));
          for (const selector of [tile(2), tile(3), tile(0), '#b-heir', '#b-retreat', foe]) {
            await page.keyboard.press('Tab');
            await focused(page, selector);
          }
          await inspect(foe, initial.enemy, 'Enter', '적 전투 정보', 'Escape');
          await page.keyboard.press('Tab');
          await focused(page, row(0));
          await page.keyboard.press('Tab');
          await focused(page, row(1));
          await inspect(row(1), initial.allies[1], 'Space', '동료 전투 정보', 'Enter');
          await page.keyboard.press('Tab');
          await focused(page, row(2));
          await page.keyboard.press('Tab');
          await focused(page, '#b-field');
          const stageOffset = await page.locator('#sky').evaluate(node => {
            const field = node.getBoundingClientRect();
            const stage = document.querySelector('#stage').getBoundingClientRect();
            return [field.left - stage.left, field.top - stage.top];
          });
          assert.deepEqual(stageOffset, [6, 14]);
          await capture();
        }
      };
    },
    'access-battle': () => {
      const { session } = battleFixture(skill);
      return {
        session, mute: true,
        proof: 'Four usable skill tiles, one inherited skill and a viable retreat after Snow Shot',
        async show(page, { text, capture }) {
          await openBattle(page);
          await tabTo(page, tile(2));
          assert.equal(await page.locator(tile(2)).evaluate(node => getComputedStyle(node).outlineWidth), '2px');
          for (const [key, index] of [['ArrowLeft', 1], ['ArrowRight', 2], ['ArrowDown', 0], ['ArrowUp', 2]]) {
            await page.keyboard.press(key);
            await focused(page, tile(index));
          }
          const count = () => page.evaluate(() => window.__game.B.all.length);
          const before = await count();
          for (const key of ['?', 'i']) {
            await page.keyboard.press(key);
            await text(page.locator('#sheet.on #sh-title'), skill);
            await focused(page, '#sheet.on :is(#sh-title, #b-sheetclose)');
            if (key === '?') await capture('detail');
            await page.keyboard.press('Escape');
            await page.locator('#sheet').waitFor({ state: 'hidden' });
            await focused(page, tile(2));
          }
          assert.equal(await count(), before, 'Inspecting a skill spends no turn');
          await page.keyboard.press('Enter');
          await battleIdle(page);
          assert.ok(await page.evaluate(name => window.__game.B.all.some(event =>
            event.t === 'act' && event.who.side === 'ally' && event.skill.name === name), skill));
          await focused(page, tile(2));

          await tabTo(page, '#b-heir');
          await page.keyboard.press('Tab');
          await focused(page, '#b-retreat');
          await page.keyboard.press('Shift+Tab');
          await focused(page, '#b-heir');
          await page.keyboard.press('Tab');
          const beforeRetreat = await count();
          await page.keyboard.press('Enter');
          await page.locator('#b-retreat.armed').waitFor();
          assert.equal(await count(), beforeRetreat, 'The first Enter only previews the retreat');
          await page.keyboard.press('Enter');
          assert.ok(await page.evaluate(() => window.__game.B.all.some(event => event.t === 'retreat')));
          await capture();
        }
      };
    },
    'access-sheet': () => {
      const profile = snowRabbitProfile();
      assert.ok(profile.notebook.chapters.length && profile.recruits[lead]);
      return {
        session: storedSession({ profile }), motion: 'reduce', mute: true,
        proof: 'A returned expedition profile can open settings in the observatory',
        async show(page, { text, capture }) {
          await enterObservatory(page);
          const opener = '#hub.on .b-set';
          await tabTo(page, opener);
          await page.keyboard.press('Enter');
          await text(page.locator('#sheet.on #sh-title'), '설정', { exact: true });
          await focused(page, setting('sound'));
          for (const key of ['shake', 'flash']) {
            assert.equal(await page.locator(setting(key)).getAttribute('aria-pressed'), 'false');
          }
          await page.keyboard.press('Shift+Tab');
          await focused(page, '#sheet.on #b-sheetclose');
          await page.keyboard.press('Tab');
          await focused(page, setting('sound'));
          await page.keyboard.press('Tab');
          await focused(page, setting('music'));
          await capture();
          await page.keyboard.press('Escape');
          await page.locator('#sheet').waitFor({ state: 'hidden' });
          await focused(page, opener);
          await page.keyboard.press('Enter');
          await page.locator('#sheet.on').waitFor();
          await page.locator(opener).evaluate(button => button.remove());
          await page.keyboard.press('Escape');
          await focused(page, '#hub.on #meta-depart');
        }
      };
    },
    'access-comfort': () => {
      const { session, damage } = battleFixture(heirloom);
      return {
        session, motion: 'no-preference', mute: true,
        proof: 'Inherited Shadow Guillotine produces a non-finishing big melee hit that normally shakes and flashes',
        async show(page, { text, capture }) {
          async function openSettings() {
            await tabTo(page, '#battle.on .b-set');
            await page.keyboard.press('Enter');
            await page.locator('#sheet.on').waitFor();
          }
          await openBattle(page);
          await openSettings();
          for (const key of ['shake', 'flash']) {
            assert.equal(await page.locator(setting(key)).getAttribute('aria-pressed'), 'true');
            await tabTo(page, setting(key));
            await page.keyboard.press('Space');
            assert.equal(await page.locator(setting(key)).getAttribute('aria-pressed'), 'false');
            await focused(page, setting(key));
          }
          await page.keyboard.press('Escape');
          await focused(page, '#battle.on .b-set');
          await page.reload({ waitUntil: 'domcontentloaded' });
          const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), SETTINGS_KEY);
          assert.equal(saved.shake, false);
          assert.equal(saved.flash, false);
          await openBattle(page);
          await openSettings();
          for (const key of ['shake', 'flash']) {
            assert.equal(await page.locator(setting(key)).getAttribute('aria-pressed'), 'false');
          }
          await page.keyboard.press('Escape');
          await tabTo(page, '#b-heir');
          await page.evaluate(() => { window.__game.clock.paused = true; });
          await page.keyboard.press('Space');
          const hit = await page.evaluate(async name => {
            const game = window.__game;
            game.clock.paused = false;
            try {
              for (let i = 0; i < 180; i++) {
                await game.advance(0.02);
                const { shake, flash } = game.clock.screenEffects;
                if (shake !== 0 || flash !== 0) throw new Error(`Disabled effects changed to ${shake} / ${flash}`);
                const move = game.B.pending;
                if (move?.e.skill.name === name && move.hitAt != null && game.clock.t - move.hitAt >= 0.04) {
                  return { size: move.motion.size, range: move.motion.range, pose: move.target?.pose };
                }
              }
              throw new Error('The big melee hit did not land');
            } finally {
              game.clock.paused = true;
            }
          }, heirloom);
          assert.deepEqual(hit, { size: 'big', range: 'melee', pose: 'hurt' });
          await text(page.locator('#fx .num:not(.tag):not(.call)'), damage.toLocaleString('en-US'));
          await capture(undefined, page, { duringBattle: true });
        }
      };
    }
  };
}
