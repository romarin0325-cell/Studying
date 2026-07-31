'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const {
  PATHS,
  TOKENS,
  buildOutput,
  checkOutput
} = require('./build_class_roguelike');

const EXPECTED_CLASS_IDS = [
  'berserker',
  'magic_swordsman',
  'paladin',
  'aether_saber',
  'priest',
  'archmage',
  'witch',
  'assassin',
  'phantom',
  'moon_sage',
  'star_sage',
  'sun_sage',
  'gardener',
  'breaker'
];

const EXPECTED_DUNGEON_IDS = Array.from({ length: 10 }, (_, index) => `dungeon_${index + 1}`);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function mustMatch(content, pattern, message) {
  assert(pattern.test(content), message);
}

function mustNotMatch(content, pattern, message) {
  assert(!pattern.test(content), message);
}

function extractInlineScripts(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map(match => ({
    attributes: match[1],
    source: match[2]
  }));
}

function readDataSnapshot() {
  const dataSource = fs.readFileSync(PATHS.data, 'utf8');
  const context = vm.createContext({});
  const snapshotSource = `
${dataSource}
JSON.stringify({
  saveKey: SAVE_KEY,
  maxLevel: MAX_LEVEL,
  milestones: CLASS_MILESTONES,
  xpMultiplier: TEST_XP_MULTIPLIER,
  classIds: Array.isArray(CLASS_DATA)
    ? CLASS_DATA.map(entry => entry.id)
    : Object.keys(CLASS_DATA),
  classNames: CLASS_DATA.map(entry => entry.name),
  skills: CLASS_DATA.flatMap(entry => entry.skills.map(skill => ({
    id: skill.id,
    effect: skill.effect,
    name: skill.name
  }))),
  classSkillUnlocks: CLASS_DATA.map(entry => entry.skills.map(skill => skill.unlock)),
  dungeonIds: Array.isArray(DUNGEONS)
    ? DUNGEONS.map(entry => entry.id)
    : Object.keys(DUNGEONS),
  dungeonEncounters: DUNGEONS.map(entry => entry.encounters),
  equipmentCount: EQUIPMENT_CATALOG.length,
  armorSkillIds: Object.keys(ARMOR_SKILLS)
});
`;
  const json = new vm.Script(snapshotSource, { filename: PATHS.data }).runInContext(context);
  return JSON.parse(json);
}

function assertExactIds(actual, expected, label) {
  assert(Array.isArray(actual), `${label} IDs must be an array.`);
  assert.strictEqual(new Set(actual).size, actual.length, `${label} IDs must be unique.`);
  assert.deepStrictEqual(
    [...actual].sort(),
    [...expected].sort(),
    `${label} IDs do not match the planned content.`
  );
}

function assertEmbeddedPngs(html) {
  const matches = [...html.matchAll(/data:image\/png;base64,([A-Za-z0-9+/]+={0,2})/g)];
  assert.strictEqual(matches.length, 2, 'The final HTML must contain exactly two embedded PNG data URIs.');

  for (const [, encoded] of matches) {
    const image = Buffer.from(encoded, 'base64');
    assert(
      image.length > PNG_SIGNATURE.length &&
      image.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE),
      'An embedded image is not a valid PNG.'
    );
  }

  mustMatch(
    html,
    /const\s+GAME_IMAGES\s*=\s*Object\.freeze\s*\(\s*\{[\s\S]*?\blumi\s*:\s*"data:image\/png;base64,/,
    'GAME_IMAGES.lumi must contain an embedded PNG.'
  );
  mustMatch(
    html,
    /const\s+GAME_IMAGES\s*=\s*Object\.freeze\s*\(\s*\{[\s\S]*?\bdemon\s*:\s*"data:image\/png;base64,/,
    'GAME_IMAGES.demon must contain an embedded PNG.'
  );
}

function assertOfflineShell(html) {
  mustNotMatch(html, /<script\b[^>]*\bsrc\s*=/i, 'The final HTML must not load an external script.');
  mustNotMatch(
    html,
    /<link\b[^>]*\brel\s*=\s*["']?stylesheet\b/i,
    'The final HTML must not load an external stylesheet.'
  );
  mustNotMatch(html, /<base\b/i, 'The final HTML must not change its base URL.');
  mustNotMatch(html, /<script\b[^>]*\btype\s*=\s*["']module["']/i, 'The final HTML must not use module scripts.');
  mustNotMatch(html, /https?:\/\//i, 'The final HTML must not depend on an HTTP(S) resource.');
  mustNotMatch(
    html,
    /(?:fetch\s*\(|new\s+XMLHttpRequest\b|new\s+WebSocket\b|new\s+EventSource\b|navigator\.sendBeacon\s*\()/,
    'The final HTML must not use a network API.'
  );
  mustNotMatch(
    html,
    /(?:\bsrc\s*=|\.src\s*=|url\()\s*["'`]?(?:\.\.?\/)?(?:assets\/)?[^"'`()\r\n]*\.png\b/i,
    'The final HTML must not reference path-based image files.'
  );
  mustNotMatch(
    html,
    /@import\b|url\(\s*["']?(?:https?:)?\/\//i,
    'The final CSS must not import a remote resource.'
  );

  for (const token of Object.values(TOKENS)) {
    assert(!html.includes(token), `The final HTML contains an unresolved build token: ${token}`);
  }
}

function assertMobileShell(html) {
  mustMatch(
    html,
    /<meta\s+name=["']viewport["']\s+content=["'][^"']*\bwidth=device-width\b[^"']*\binitial-scale=1\b[^"']*\bviewport-fit=cover\b[^"']*["']/i,
    'The final HTML must declare a mobile viewport with viewport-fit=cover.'
  );
  mustMatch(html, /env\(\s*safe-area-inset-top\b/i, 'The layout must account for the top safe area.');
  mustMatch(html, /env\(\s*safe-area-inset-bottom\b/i, 'The layout must account for the bottom safe area.');
  mustMatch(html, /touch-action\s*:/i, 'The layout must define touch behavior.');
  mustMatch(html, /100(?:d|s)vh\b/i, 'The layout must use a modern mobile viewport unit.');
  mustMatch(html, /@media\b/i, 'The layout must include responsive media rules.');
}

function assertStorageHooks(gameSource) {
  mustMatch(
    gameSource,
    /(?:window\.)?localStorage\s*\.\s*getItem\s*\(\s*SAVE_KEY\s*\)/,
    'src/game.js must load progress from localStorage using SAVE_KEY.'
  );
  mustMatch(
    gameSource,
    /(?:window\.)?localStorage\s*\.\s*setItem\s*\(\s*SAVE_KEY\s*,/,
    'src/game.js must save progress to localStorage using SAVE_KEY.'
  );
}

function assertImageHooks(gameSource) {
  mustMatch(gameSource, /\bGAME_IMAGES\s*\.\s*lumi\b/, 'src/game.js must render the embedded Lumi image.');
  mustMatch(gameSource, /\bGAME_IMAGES\s*\.\s*demon\b/, 'src/game.js must render the embedded demon image.');
}

function assertSkillCoverage(snapshot, gameSource) {
  assert.strictEqual(snapshot.skills.length, 64, 'The beta must include all 64 planned class skills.');
  const handledEffects = new Set(
    [...gameSource.matchAll(/case\s+"([^"]+)"\s*:/g)].map(match => match[1])
  );
  const missing = [...new Set(snapshot.skills.map(skill => skill.effect))]
    .filter(effect => !handledEffects.has(effect));
  assert.deepStrictEqual(missing, [], `Class skill effects missing runtime handlers: ${missing.join(', ')}`);
}

function run() {
  const expected = buildOutput();
  checkOutput(expected);

  const html = fs.readFileSync(PATHS.output, 'utf8').replace(/\r\n?/g, '\n');
  assert.strictEqual(html, expected, 'class_roguelike/index.html does not match its generated sources.');

  assertOfflineShell(html);
  assertMobileShell(html);
  assertEmbeddedPngs(html);

  const scripts = extractInlineScripts(html);
  assert.strictEqual(scripts.length, 1, 'The final HTML must contain exactly one inline script.');
  assert.strictEqual(scripts[0].attributes.trim(), '', 'The final inline script must be a classic script.');
  new vm.Script(scripts[0].source, { filename: PATHS.output });

  const snapshot = readDataSnapshot();
  assert.strictEqual(snapshot.saveKey, 'trinityNocturneSaveV1', 'Unexpected storage key.');
  assert.strictEqual(snapshot.maxLevel, 30, 'MAX_LEVEL must be 30.');
  assert.strictEqual(snapshot.xpMultiplier, 3, 'Every dungeon must use the 3x test XP multiplier.');
  assert.deepStrictEqual(snapshot.milestones, [11, 21], 'Class milestones must be levels 11 and 21.');
  assertExactIds(snapshot.classIds, EXPECTED_CLASS_IDS, 'Class');
  assertExactIds(snapshot.dungeonIds, EXPECTED_DUNGEON_IDS, 'Dungeon');
  assert.strictEqual(snapshot.equipmentCount, 35, 'The beta must include 35 equipment entries.');
  assert.deepStrictEqual(snapshot.armorSkillIds.sort(), ['barrier', 'dodge_stance', 'guard', 'magic_guard']);
  assert.deepStrictEqual(snapshot.dungeonEncounters, [1, 1, 1, 2, 2, 2, 2, 3, 3, 3]);
  assert(snapshot.classNames.every(name => /[가-힣]/.test(name)), 'Every class needs a readable Korean name.');
  assert(
    snapshot.classSkillUnlocks.every(unlocks => unlocks[0] === 1),
    'Each class must start with its first skill at mastery 1.'
  );

  const gameSource = fs.readFileSync(PATHS.game, 'utf8');
  assertStorageHooks(gameSource);
  assertImageHooks(gameSource);
  assertSkillCoverage(snapshot, gameSource);

  console.log('Class roguelike smoke verification passed.');
}

try {
  run();
} catch (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
