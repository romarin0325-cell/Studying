// node card_pixel/game/tests/screens-map.mjs [--case <name>] [--validate-only]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { scheduleTimer } from '../src/engine/bridge.js';
import { createProfile } from '../src/engine/meta.js';
import { create as makeRoster, POSITION } from '../src/engine/roster.js';
import * as Run from '../src/engine/run.js';
import { createSaveStore } from '../src/engine/save.js';
import { getWalkLayout } from '../src/stage/walking-map.js';
import { doorDecision } from '../src/ui/screens/map.js';
import { coreBundle } from '../tools/core-bundle.mjs';

const sessionKey = 'relaymare.session';
const gameUrl = new URL('../dist/Relaymare.html', import.meta.url).href;
const shots = fileURLToPath(new URL('shots/screens-map/', import.meta.url));
const viewport = { width: 390, height: 844 };
const sandbox = { console, Math, __relayCoreTimer: scheduleTimer };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(coreBundle(fileURLToPath(new URL('../../../', import.meta.url))), sandbox);
const core = sandbox.RelayCore;
const manifest = JSON.parse(fs.readFileSync(new URL('../assets/sprites.json', import.meta.url), 'utf8'));
const sp = Object.fromEntries(Object.entries(manifest).map(([name, sprite]) => [name.replace(/\.png$/, ''), sprite]));
const roster = makeRoster(core, { sp });

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
  'one-door': { dungeon: 'ember_volcano', seed: 21, floor: 1, lines: ['물리 강공 · 결정 1'], select: 0, mode: 'speed' },
  'two-doors': { dungeon: 'dawn_forest', seed: 7, floor: 3, lines: ['물리 강공 · 결정 1', '마법 강공 · 결정 1'], select: 0 },
  'three-doors': { dungeon: 'ember_volcano', seed: 21, floor: 3, lines: ['소환의 샘', '혼돈의 제단', '사건'] },
  'mid-walk': { dungeon: 'dawn_forest', seed: 7, floor: 3, lines: ['물리 강공 · 결정 1', '마법 강공 · 결정 1'], select: 0, frame: 'walking' },
  'door-zoom': { dungeon: 'ember_volcano', seed: 21, floor: 3, lines: ['소환의 샘', '혼돈의 제단', '사건'], select: 1, frame: 'zoom' }
};

function fixture(spec) {
  const { dungeon, seed, floor, lines, select } = spec;
  const run = reachFloor(dungeon, seed, floor);
  const initial = structuredClone(run);
  const layout = getWalkLayout(run);
  const actual = run.doors.map(door => doorDecision(run, door, Run.getTempoView(run, door.index)));
  assert.deepEqual(actual, lines);
  assert.equal(layout.branches.length, lines.length);
  if (lines.length === 3) assert.deepEqual(layout.branches.map(branch => branch.center), [[278, 162], [320, 230], [274, 295]]);
  assert.deepEqual(run, initial);

  let session;
  const store = createSaveStore({ getItem: () => session, setItem: (_, value) => { session = value; } }, { core, roster });
  const profile = createProfile();
  store.save({ run, profile });
  const savedMap = session;
  assert.deepEqual(store.load()?.run, initial);
  let expected, destination;
  if (select != null) {
    command(Run.chooseDoor, run, select);
    destination = run.room.status === 'order' ? 'order' : run.room.type;
    store.save({ run, profile });
    expected = JSON.parse(session).run.run;
    assert.deepEqual(store.load()?.run, run);
    assert.equal(Run.chooseDoor(run, select).ok, false);
  }
  return { ...spec, session: savedMap, party: Run.defaultParty(run), expected, destination };
}

async function inject(page, session) {
  await page.addInitScript(({ url, key, data }) => {
    if (location.href === url) localStorage.setItem(key, data);
  }, { url: gameUrl, key: sessionKey, data: session });
  await page.goto(gameUrl, { waitUntil: 'domcontentloaded' });
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
    const portraits = document.querySelectorAll('#map.on img');
    await Promise.all(Array.from(portraits, img => img.decode().catch(() => {})));
  });
  return page.screenshot({ animations: 'disabled' });
}

async function runCase(browser, model) {
  const motion = !!model.frame || model.mode === 'speed';
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
      if (model.mode === 'speed') await page.evaluate(() => { window.__game.clock.speed = 2; });
      const input = model.frame === 'zoom' ? openFromList : openInScene;
      await input.click();
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
