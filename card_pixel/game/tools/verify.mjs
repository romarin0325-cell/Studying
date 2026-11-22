// One check command with two tiers (workspace rules C1–C4 in 게임\AGENT-RULES.md).
//   node card_pixel/game/tools/verify.mjs            pick the tier from the files changed since HEAD (working tree)
//   node card_pixel/game/tools/verify.mjs --quick    build, Node tests, gallery state check, gallery cases for changed screens
//   node card_pixel/game/tools/verify.mjs --full     quick + whole gallery, map gallery, two play campaigns, tutorial both paths
//   --layout   with --full, also the whole gallery at 360×740 and at 125% text (use when layout or CSS changed)
//   --base <ref>   compare against <ref> instead of HEAD (e.g. origin/main before a push)
//   --cases a,b    add gallery cases by name or group
// A small change never needs the full tier; the full tier is for pushes, finished parallel batches and shared parts.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const game = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(game, '..', '..');
const args = process.argv.slice(2);
const option = name => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : null; };
const base = option('--base') ?? 'HEAD';

export const NODE_TESTS = ['bridge', 'rules', 'run', 'music', 'daily', 'assets', 'rulebook', 'effect-plan',
  'skill-motions', 'text', 'history', 'goals', 'episodes', 'save'];

// Parts many screens depend on: touching one of them asks for the full tier.
export const SHARED = [
  /^src\/engine\/(save|run|run-codec|rooms|bridge|meta|entry)\.js$/, /^src\/ui\/nav(\.js|\/)/, /^src\/ui\/run\//,
  /^src\/ui\/battle\/view\.js$/, /^src\/styles\/base\.css$/, /^src\/main\.js$/, /^src\/ui\/(storage|sheet|dom|widgets)\.js$/,
  /^core\//, /^build\.mjs$/, /^tests\/screens\.mjs$/
];

// Screen file → gallery cases or groups that show it (quick tier). Unlisted screens fall back to --cases.
export const SCREEN_CASES = {
  'src/ui/screens/map.js': ['fixed-map', 'map-seats', 'promise'], 'src/styles/map.css': ['fixed-map', 'map-seats'],
  'src/ui/screens/event.js': ['fixed-event', 'event-values', 'promise'], 'src/ui/screens/treasure.js': ['treasure-receipt', 'relic-compare'],
  'src/ui/screens/spring.js': ['spring-commit', 'spring-rates'], 'src/ui/screens/altar.js': ['fixed-altar'],
  'src/ui/screens/collection.js': ['fixed-collection', 'goals', 'episodes'], 'src/ui/screens/hub.js': ['next-goal', 'resume', 'stale-tab'],
  'src/ui/screens/records.js': ['fixed-records', 'puzzles'], 'src/ui/screens/daily-rift.js': ['rift-result-win', 'puzzles'],
  'src/ui/screens/order.js': ['formation-board', 'boss-formation'], 'src/ui/screens/recruit.js': ['history', 'entry-recruit-unlock'],
  'src/ui/screens/ending.js': ['ending-goal', 'history'], 'src/ui/screens/dungeons.js': ['fixed-destinations', 'difficulty-choice'],
  'src/ui/screens/notebook.js': ['missions-invitations'], 'src/ui/screens/awaken.js': ['opening-awaken', 'first-order-awakening'],
  'src/ui/screens/reinforce.js': ['reinforcement-board'], 'src/ui/screens/gate-pick.js': ['relics'],
  'src/ui/battle/tiles.js': ['tile-range', 'relay-outcomes', 'retreat-outcomes'], 'src/ui/battle/hud.js': ['truthful-hud', 'tempo-telegraph', 'patterns'],
  'src/ui/battle/moves.js': ['motion'], 'src/stage/stage.js': ['motion'], 'src/content/skill-motions.js': ['motion'],
  'src/ui/reveal.js': ['spring-commit'], 'src/ui/tutorial.js': ['entry'], 'src/ui/coach.js': ['tours'], 'src/ui/settings.js': ['access'],
  'src/styles/battle.css': ['tile-range', 'relay-outcomes', 'truthful-hud'], 'src/styles/meta.css': ['fixed-records', 'puzzles', 'next-goal'],
  'src/styles/screens.css': ['spring-commit', 'fixed-event', 'formation-board']
};

function git(...rest) {
  const result = spawnSync('git', rest, { cwd: repo, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.split(/\r?\n/).filter(Boolean) : [];
}

export function changedFiles() {
  const prefix = 'card_pixel/game/';
  const files = [...git('diff', '--name-only', base), ...git('ls-files', '--others', '--exclude-standard')];
  return [...new Set(files.filter(file => file.startsWith(prefix)).map(file => file.slice(prefix.length)))]
    .filter(file => !file.startsWith('dist/'));
}

export function chooseTier(files) {
  const shared = files.filter(file => SHARED.some(rule => rule.test(file)));
  return { tier: shared.length ? 'full' : 'quick', shared };
}

export function casesFor(files) {
  return [...new Set(files.flatMap(file => SCREEN_CASES[file] ?? []))];
}

function run(label, command, commandArgs, env = {}) {
  const started = Date.now();
  const result = spawnSync(command, commandArgs, { cwd: repo, env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 1 << 28 });
  const seconds = Math.round((Date.now() - started) / 1000);
  const ok = result.status === 0;
  const tail = (result.stdout + result.stderr).split(/\r?\n/).filter(line => /FAIL|✖|Error|not ok|ℹ (pass|fail)/.test(line)).slice(0, 12);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  (${seconds}s)`);
  if (!ok) for (const line of tail) console.log('      ' + line.slice(0, 220));
  return ok;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = changedFiles();
  const picked = chooseTier(files);
  const tier = args.includes('--full') ? 'full' : args.includes('--quick') ? 'quick' : picked.tier;
  const extra = (option('--cases') ?? '').split(',').filter(Boolean);
  const cases = [...new Set([...casesFor(files), ...extra])];
  console.log(`Changed since ${base}: ${files.length} file(s). Tier: ${tier}` +
    (picked.shared.length ? ` (shared: ${picked.shared.join(', ')})` : ''));
  const node = process.execPath;
  const results = [
    run('build', node, ['card_pixel/game/build.mjs']),
    run('node tests', node, ['--test', '--test-isolation=none', ...NODE_TESTS.map(name => `card_pixel/game/tests/${name}.test.mjs`)]),
    run('gallery state check', node, ['card_pixel/game/tests/screens.mjs', '--validate-only'])
  ];
  if (tier === 'quick') {
    if (!cases.length) console.log('      no gallery case is mapped to the changed files; add --cases <name> if a screen changed');
    for (const name of cases) results.push(run(`gallery ${name}`, node, ['card_pixel/game/tests/screens.mjs', '--case', name]));
  } else {
    results.push(run('gallery (390×844)', node, ['card_pixel/game/tests/screens.mjs']));
    if (args.includes('--layout')) {
      results.push(run('gallery (360×740)', node, ['card_pixel/game/tests/screens.mjs'], { RELAY_VIEWPORT: '360x740' }));
      results.push(run('gallery (125% text)', node, ['card_pixel/game/tests/screens.mjs'], { RELAY_TEXT_SCALE: '1.25' }));
    }
    results.push(run('map gallery', node, ['card_pixel/game/tests/screens-map.mjs']));
    results.push(run('play (seeds 7, 21)', node, ['card_pixel/game/tests/play.mjs', '--no-build']));
    results.push(run('tutorial (follow, skip)', node, ['card_pixel/game/tests/play.mjs', '--no-build', '--intro-only', '--tutorial=both']));
  }
  const failed = results.filter(ok => !ok).length;
  console.log(failed ? `${failed} step(s) failed.` : 'All steps passed.');
  process.exitCode = failed ? 1 : 0;
}
