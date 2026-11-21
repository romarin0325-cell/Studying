// node card_pixel/game/tests/screens-map.mjs [--case <name>] [--validate-only]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { createProfile } from '../src/engine/meta.js';
import { POSITION } from '../src/engine/roster.js';
import * as Run from '../src/engine/run.js';
import { createSaveStore } from '../src/engine/save.js';
import { getWalkLayout } from '../src/stage/walking-map.js';
import { doorDecision, doorLesson } from '../src/ui/screens/map.js';
import { DUNGEONS } from '../src/content/dungeons.js';
import { createCoreRoster } from './support/core.mjs';

const sessionKey = 'relaymare.session';
const gameUrl = new URL('../dist/Relaymare.html', import.meta.url).href;
const shots = fileURLToPath(new URL('shots/screens-map/', import.meta.url));
const viewport = { width: 390, height: 844 };
const { core, roster } = createCoreRoster();

function command(action, run, ...args) {
  const result = action(run, ...args);
  assert.equal(result.ok, true, `${action.name} on floor ${run.floor}: ${result.reason}`);
  return result;
}

function pickStarters(run) {
  while (run.pending?.kind === 'start') {
    command(Run.chooseStartPick, run, run.pending.candidates[0] ?? null);
  }
}

function reachFloor(dungeonId, seed, floor) {
  const run = Run.createRun({ core, roster, dungeonId, seed });
  pickStarters(run);
  while (run.floor < floor) {
    command(Run.chooseDoor, run, 0);
    if (run.room.status === 'order') {
      const party = Run.defaultParty(run);
      command(Run.confirmOrder, run, party);
      const { enemies } = Run.battleOptions(run);
      command(Run.settleBattle, run, {
        outcome: 'win', survivors: party.map(Boolean), retreated: [false, false, false],
        heirloomsGained: [], heirloomsUsed: 0, lastStands: 0,
        enemyDowns: enemies.map((_, idx) => ({ idx, treasure: false })),
        bestHit: null, turns: 3, bet: null
      });
    }
    pickStarters(run);
    if (run.pending?.kind === 'reinforcement') {
      command(Run.resolveReinforcement, run, { key: run.pending.key, id: null, replaceId: null });
    }
    command(Run.leaveRoom, run);
    command(Run.nextFloor, run);
  }
  assert.equal(run.phase, 'map');
  return run;
}

const cases = {
  'one-door': { dungeon: 'ember_volcano', seed: 21, floor: 1, lines: [/^물리 공격(?: ×[\d.]+)? · 결정 1$/], select: 0 },
  'two-doors': { dungeon: 'dawn_forest', seed: 7, floor: 3, lines: [/^물리 공격(?: ×[\d.]+)? · 결정 1$/, /^마법 공격(?: ×[\d.]+)? · 결정 1$/], select: 0 },
  'formation-preview': { dungeon: 'twilight_cathedral', seed: 21, floor: 2,
    // the pill over a lesson door is the short form: turn, kind of hit, crystals (map.js doorLessonShort)
    lines: [/^2턴 \S.* · 결정 \d+$/, /^2턴 \S.* · 결정 \d+$/], select: 1, swap: true },
  'boss-lesson': { dungeon: 'twilight_cathedral', seed: 21, floor: 8, lines: ['사랑의 여신 아이리스'] },
  'floor-strip': { dungeon: 'ember_volcano', seed: 21, floor: 4, lines: [/^전투|공격|결정/], strip: true },
  'three-doors': { dungeon: 'ember_volcano', seed: 21, floor: 3, lines: ['소환의 샘', '혼돈의 제단', '사건'] },
  'mid-walk': { dungeon: 'ember_volcano', seed: 21, floor: 3, lines: ['소환의 샘', '혼돈의 제단', '사건'], select: 0, frame: 'walking' },
  'door-zoom': { dungeon: 'ember_volcano', seed: 21, floor: 3, lines: ['소환의 샘', '혼돈의 제단', '사건'], select: 1, frame: 'zoom' }
};

function fixture(spec) {
  const { dungeon, seed, floor, lines, select } = spec;
  const run = reachFloor(dungeon, seed, floor);
  const initial = structuredClone(run);
  const layout = getWalkLayout(run);
  const actual = run.doors.map(door => doorDecision(run, door, Run.getTempoView(run, door.index)));
  assert.equal(actual.length, lines.length);
  for (const [index, line] of lines.entries()) {
    if (line instanceof RegExp) assert.match(actual[index], line);
    else assert.equal(actual[index], line);
  }
  assert.equal(layout.branches.length, lines.length);
  if (lines.length === 3) assert.deepEqual(layout.branches.map(branch => branch.center), [[278, 162], [320, 230], [274, 295]]);
  assert.deepEqual(run, initial);

  let session;
  const store = createSaveStore({ getItem: () => session, setItem: (_, value) => { session = value; } }, { core, roster });
  // These runs open every feature, which only a returning (legacy) player has; a new profile would
  // pair them with first-contact coach tours that cover the doors.
  const profile = createProfile();
  profile.ui.entry.legacy = true;
  store.save({ run, profile });
  const savedMap = session;
  assert.deepEqual(store.load()?.run, initial);
  let expected, destination, entering;
  const party = Run.defaultParty(run);
  const reserve = spec.swap ? run.bench.find(id => !party.includes(id)) : null;
  const lesson = run.doors.map(door => doorLesson(Run.getTempoView(run, door.index)));
  if (select != null) {
    if (run.doors[select].enemies.length) {
      entering = party.slice();
      command(Run.enterBattleDoor, run, { floor, index: select, partyIds: entering });
      destination = 'battle';
    } else {
      command(Run.chooseDoor, run, select);
      destination = run.room.type;
    }
    store.save({ run, profile });
    expected = JSON.parse(session).run.run;
    assert.deepEqual(store.load()?.run, expected);
    assert.equal(Run.chooseDoor(run, select).ok, false);
  }
  return { ...spec, lines: actual, session: savedMap, initial, party, reserve, entering, lesson, expected, destination };
}

async function inject(page, session) {
  await page.addInitScript(({ url, key, data }) => {
    if (location.href === url) localStorage.setItem(key, data);
  }, { url: gameUrl, key: sessionKey, data: session });
  await page.goto(gameUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('.screen.on').waitFor();
  if (await page.locator('#order.on').isVisible()) {
    assert.equal(await page.locator('#b-go').textContent(), '이대로 전투 시작');
    await page.locator('#order.on #b-order-back').click();
  }
  await page.locator('#map.on').waitFor();
}

async function assertMap(page, model) {
  const map = page.locator('#map.on');
  const scene = map.locator('.walking-map');
  assert.deepEqual(await scene.locator('.map-door-line').allTextContents(), model.lines);
  for (const door of await scene.locator('[data-map-door]').all()) {
    const box = await door.boundingBox();
    assert.ok(box && box.width >= 48 && box.height >= 48);
    const visible = await door.evaluate(node => {
      const line = node.querySelector('.map-door-line').getBoundingClientRect();
      const scene = node.closest('.walking-map').getBoundingClientRect();
      return line.left >= scene.left - 1 && line.right <= scene.right + 1 && line.bottom <= scene.bottom + 1;
    });
    assert.ok(visible, 'The decision line must fit inside the scene');
  }
  const actors = await scene.locator('.map-actor').evaluateAll(nodes => nodes.map(node => ({
    id: node.dataset.sheet, position: node.querySelector('small').textContent
  })));
  assert.deepEqual(actors, model.party.flatMap((id, index) => id ? [{ id, position: POSITION[index] }] : []));
  assert.equal(await map.locator('.floor-cell.cur small').textContent(), String(model.floor));
  for (const [index, lesson] of model.lesson.entries()) {
    if (lesson) assert.equal(await map.locator(`[data-door-preview="${index}"] .door-lesson span`).textContent(), lesson);
  }
  const cells = map.locator('.floor-cell');
  const widths = await cells.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
  assert.ok(Math.max(...widths) - Math.min(...widths) < 1);
  assert.equal(await cells.locator('img').count(), 0);
  assert.equal(await map.locator('.map-formation').count(), 0);
  if (model.strip) {
    assert.equal(await cells.locator('svg').count(), 2);
    await map.locator('#b-floors').click();
    const sheet = page.locator('#sheet.on');
    assert.ok(await sheet.locator('.floor-foes img').count() >= 2);
    await sheet.locator('#b-sheetclose').click();
  }
  return scene;
}

async function startCountingSaves(page) {
  await page.evaluate(key => {
    const setItem = Storage.prototype.setItem;
    window.mapGalleryWrites = 0;
    Storage.prototype.setItem = function (item, value) {
      if (this === localStorage && item === key) window.mapGalleryWrites++;
      return setItem.call(this, item, value);
    };
  }, sessionKey);
}

async function assertSavedChoice(page, model) {
  const saved = await page.evaluate(key => ({
    writes: window.mapGalleryWrites,
    run: JSON.parse(localStorage.getItem(key)).run.run
  }), sessionKey);
  assert.equal(saved.writes, 1);
  assert.deepEqual(saved.run, model.expected);
}

async function capture(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const portraits = document.querySelectorAll('.screen.on img');
    await Promise.all(Array.from(portraits, img => img.decode().catch(() => {})));
  });
  return page.screenshot({ animations: 'disabled' });
}

async function runCase(browser, model) {
  const motion = !!model.frame;
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: motion ? 'no-preference' : 'reduce' });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    const errors = [];
    page.on('pageerror', error => errors.push(error));
    const clockStart = Date.UTC(2026, 10, 21);
    if (model.frame) await page.clock.install({ time: clockStart });
    await inject(page, model.session);
    if (model.frame) await page.clock.pauseAt(clockStart + 30000);
    const scene = await assertMap(page, model);
    let image;
    if (!model.frame) {
      if (motion) await page.waitForFunction(() => document.querySelector('.walking-map')?.dataset.walkPhase === 'ready');
      image = await capture(page);
    }
    if (model.select != null) {
      await startCountingSaves(page);
      const openFromList = page.locator('#map.on [data-door="' + model.select + '"]');
      const openInScene = scene.locator('[data-map-door="' + model.select + '"]');
      const before = await scene.locator('.map-walker-anchor').first().evaluate(node => node.style.transform);

      const input = model.frame === 'zoom' ? openFromList : openInScene;
      if (model.reserve) {
        await scene.locator('[data-map-door="0"]').click();
        const order = page.locator('#order.on');
        await order.locator(`[data-bench="${model.reserve}"]`).click();
        await order.locator('[data-slot="0"]').click();
        await order.locator('#b-order-back').click();
        assert.equal(await page.evaluate(() => window.mapGalleryWrites), 0);
        assert.deepEqual(await page.evaluate(() => structuredClone(window.__game.run)), model.initial);
      }
      await input.click();
      if (model.entering) {
        assert.equal(await page.evaluate(() => window.mapGalleryWrites), 0);
        assert.equal(await page.evaluate(() => window.__game.run.phase), 'map');
        const order = page.locator('#order.on');
        assert.equal(await order.locator('#b-go').textContent(), '이대로 전투 시작');
        if (model.reserve) {
          assert.deepEqual(await order.locator('.relay-seat b').allTextContents(), model.entering.map(id => roster.card(id).name));
          image = await capture(page);
        }
        await order.locator('#b-go').click();
      }
      const destination = page.locator('#' + model.destination + '.on');
      if (model.frame) {
        assert.equal(await scene.getAttribute('data-walk-phase'), 'chosen');
        await assertSavedChoice(page, model);
        await scene.locator('[data-map-door]').evaluateAll(doors => doors.forEach(door => door.click()));
        await page.clock.runFor(model.frame === 'walking' ? 160 : 310);
        assert.equal(await scene.getAttribute('data-walk-phase'), model.frame);
        assert.equal(await scene.locator('.map-door.chosen').getAttribute('data-map-door'), String(model.select));
        assert.notEqual(await scene.locator('.map-walker-anchor').first().evaluate(node => node.style.transform), before);
        if (model.frame === 'zoom') {
          const scale = await scene.locator('.map-door.chosen .map-door-frame').evaluate(node => new DOMMatrix(getComputedStyle(node).transform).a);
          assert.ok(scale > 1);
          const faded = await scene.locator('.map-trail:not(:first-child):not(.chosen)').evaluateAll(
            paths => paths.every(path => Number(getComputedStyle(path).opacity) < 1)
          );
          assert.ok(faded);
        }
        image = await capture(page);
        if (model.frame === 'zoom') {
          await scene.locator('.map-skip').click({ position: { x: 28, y: 20 } });
        } else {
          await page.clock.runFor(260);
        }
      }
      assert.equal(await destination.count(), 1, 'The chosen room should already be open');
      await assertSavedChoice(page, model);
      if (model.entering) assert.deepEqual(await page.evaluate(() => window.__game.B.party), model.entering);
    }
    assert.deepEqual(errors, []);
    return image;
  } finally {
    await context.close();
  }
}

async function writeSheet(captures) {
  const columns = Math.min(3, captures.length);
  const gutter = 12, labelHeight = 28;
  const { width, height } = viewport;
  const layers = captures.flatMap(({ name, image }, index) => {
    const left = gutter + (index % columns) * (width + gutter);
    const top = gutter + Math.floor(index / columns) * (height + labelHeight + gutter);
    const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${labelHeight}">
      <text x="2" y="19" fill="#f3e9d2" font-family="sans-serif" font-size="15">${name}</text>
    </svg>`);
    return [{ input: label, left, top }, { input: image, left, top: top + labelHeight }];
  });
  const rows = Math.ceil(captures.length / columns);
  await sharp({ create: {
    width: columns * (width + gutter) + gutter,
    height: rows * (height + labelHeight + gutter) + gutter,
    channels: 3, background: '#15112a'
  } }).composite(layers).png().toFile(path.join(shots, 'sheet.png'));
}

const { values: args } = parseArgs({ options: { case: { type: 'string' }, 'validate-only': { type: 'boolean' } } });
assert.ok(args.case === undefined || Object.hasOwn(cases, args.case), 'Unknown case. Use ' + Object.keys(cases).join(', '));
const fixtures = (args.case ? [args.case] : Object.keys(cases)).map(name => ({ name, model: fixture(cases[name]) }));
if (args['validate-only']) {
  for (const { name, model } of fixtures) console.log(name + ': ' + model.lines.join(' | '));
  for (const dungeon of Object.values(DUNGEONS).filter(dungeon => dungeon.layout !== 'intro')) {
    for (const floor of [2, 6]) {
      const run = reachFloor(dungeon.id, 21, floor);
      for (const door of run.doors) {
        const view = Run.getTempoView(run, door.index);
        assert.equal(view.lesson.bossId, run.boss);
        assert.match(doorLesson(view), /^2턴 · /);
      }
    }
  }
} else {
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    fs.mkdirSync(shots, { recursive: true });
    const captures = [];
    for (const { name, model } of fixtures) {
      const image = await runCase(browser, model);
      fs.writeFileSync(path.join(shots, name + '.png'), image);
      captures.push({ name, image });
      console.log(name + ': ' + model.lines.join(' | '));
    }
    await writeSheet(captures);
    console.log('Contact sheet: ' + path.join(shots, 'sheet.png'));
  } finally {
    await browser.close();
  }
}
