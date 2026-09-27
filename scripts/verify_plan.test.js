'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const { createPlan } = require('./verify_plan.js');
const { parseNameStatusZ, resolveChanges } = require('./verify.js');

function changes(...files) {
  return files.map(file => ({ status: 'M', paths: [file] }));
}

function ids(plan) {
  return plan.steps.map(step => step.id);
}

function games(plan) {
  return new Set(plan.steps.map(step => step.game));
}

test('Idle runtime selects its focused checks and offline artifact only', () => {
  const plan = createPlan(changes('idle/src/core/commands.js', 'idle/src/combat/engine.js', 'idle/assets/memories/bond_lumi_01.webp'));
  assert.deepEqual([...games(plan)], ['idle']);
  assert.deepEqual(plan.blocked, []);
  assert.ok(ids(plan).includes('idle:build'));
  assert.ok(ids(plan).includes('idle:offline-browser'));
  const commands = plan.steps.map(s => s.args.join(' ')).join('\n');
  assert.match(commands, /idle\/tests\/rewards.test.mjs/);
  assert.doesNotMatch(commands, /defense|shooter|card\/|simulate.mjs/);
});

test('Idle documentation and test-only changes never rebuild or run unrelated games', () => {
  assert.deepEqual(createPlan(changes('idle/docs/ART_REVIEW.md')).steps, []);
  const plan = createPlan(changes('idle/tests/rewards.test.mjs'));
  assert.deepEqual([...games(plan)], ['idle']);
  assert.equal(ids(plan).includes('idle:build'), false);
  assert.equal(plan.needsInstall, false);
});

test('Idle unknown executable and dist-only updates block; selector-only updates stay fixtures', () => {
  assert.ok(createPlan(changes('idle/unknown-runtime.js')).blocked.length);
  assert.ok(createPlan(changes('idle/dist/AstralCompanions.html')).blocked.length);
  assert.deepEqual([...games(createPlan(changes('scripts/verify_plan.js', 'package.json')))], ['verification']);
});

test('Card-only changes never select Shooter or Defense commands', () => {
  const plan = createPlan(changes('card/game/logic.js'));
  assert.ok(games(plan).has('card'));
  assert.equal(games(plan).has('shooter'), false);
  assert.equal(games(plan).has('defense'), false);
  assert.ok(ids(plan).includes('card:build'));
  assert.ok(ids(plan).includes('card:combat-regression'));
});

test('Shooter-only changes select direct build, combat, and boot checks only', () => {
  const plan = createPlan(changes('shooter/engine.js'));
  assert.deepEqual([...games(plan)], ['shooter']);
  assert.ok(ids(plan).includes('shooter:build'));
  assert.ok(ids(plan).includes('shooter:selected-unit-tests'));
  assert.ok(ids(plan).includes('shooter:bundle-smoke'));
});

test('Defense-only changes are delegated by root and isolated in the dedicated plan', () => {
  const rootPlan = createPlan(changes('defense/js/battle/DamageSystem.js'));
  assert.equal(rootPlan.steps.length, 0);
  assert.match(rootPlan.skipped.join('\n'), /dedicated Defense workflow/);

  const defensePlan = createPlan(
    changes('defense/js/battle/DamageSystem.js'),
    { onlyGame: 'defense' }
  );
  assert.deepEqual([...games(defensePlan)], ['defense']);
  assert.ok(ids(defensePlan).includes('defense:build-local'));
  assert.equal(ids(defensePlan).some(id => id.includes('simulation-balance')), false);
});

test('Defense legacy snapshot changes select no runtime and are fully mapped', () => {
  const rootPlan = createPlan(changes(
    'defense_legacy/js/main.js',
    'defense_legacy/tests/unit/core.test.mjs',
    'defense_legacy/index.html'
  ));
  assert.deepEqual(rootPlan.steps, []);
  assert.deepEqual(rootPlan.blocked, []);
  assert.deepEqual(rootPlan.detectedGames, []);

  const defensePlan = createPlan(
    changes('defense_legacy/js/main.js'),
    { onlyGame: 'defense' }
  );
  assert.deepEqual(defensePlan.steps, []);
  assert.deepEqual(defensePlan.blocked, []);
});

test('moving removed Defense files to legacy never syntax-checks missing paths', () => {
  const plan = createPlan([{
    status: 'R100',
    paths: ['defense/js/main.js', 'defense_legacy/js/main.js']
  }], { onlyGame: 'defense' });
  const commands = plan.steps.map(step => [step.command, ...step.args].join(' ')).join('\n');
  assert.doesNotMatch(commands, /node --check defense\/js\/main\.js/);
  assert.ok(ids(plan).includes('defense:build-local'));
  assert.match(commands, /defense\/tests\/unit\/confluence\.test\.mjs/);
  assert.deepEqual(plan.blocked, []);
});

test('non-deployment documentation installs and runs no game tooling', () => {
  const plan = createPlan(changes('shooter/README.md', 'docs/notes.md'));
  assert.equal(plan.steps.length, 0);
  assert.equal(plan.needsInstall, false);
  assert.deepEqual(plan.browsers, []);
  assert.match(plan.skipped.join('\n'), /documentation/);
});

test('Confluence source and art select focused Defense checks and the offline browser dependency', () => {
  const files=changes('defense/merge/engine.js','defense/merge/render.js','defense/docs/art/ANATOMICAL_LANDMARKS.json','scripts/pack_defense_directions.mjs');
  const rootPlan=createPlan(files);
  assert.equal(games(rootPlan).has('defense'),false);
  assert.deepEqual(rootPlan.blocked,[]);
  const plan=createPlan(files,{onlyGame:'defense'});
  assert.deepEqual(plan.blocked,[]);
  assert.ok(plan.steps.some(s=>s.args.includes('defense/tests/unit/confluence.test.mjs')));
  assert.ok(plan.steps.some(s=>s.args.includes('defense/tests/integration/confluence-art.test.mjs')));
  assert.ok(ids(plan).includes('defense:browser-screen'));
  assert.ok(plan.steps.find(s=>s.id==='defense:bundle-contract').browsers.includes('chromium'));
  assert.doesNotMatch(plan.steps.map(s=>s.args.join(' ')).join('\n'),/test:defense:experience|test:defense:resilience|simulation-balance/);
});

test('authoring research stays documentation while active profile JSON is a deployment input', () => {
  const docs=createPlan(changes('defense/docs/art/HEAD_CONSISTENCY_RESEARCH.md'),{onlyGame:'defense'});
  assert.equal(docs.steps.length,0);
  const input=createPlan(changes('defense/docs/art/HEAD_PROFILE.json'),{onlyGame:'defense'});
  assert.ok(ids(input).includes('defense:build-local'));
  const toolsOnly=createPlan(changes('scripts/pack_defense_directions.mjs'),{onlyGame:'defense'});
  assert.equal(toolsOnly.steps.length,0);
});

test('root package script changes do not select every game', () => {
  const plan = createPlan(changes('package.json'));
  assert.deepEqual(ids(plan), ['verification:selector-fixtures']);
  assert.deepEqual([...games(plan)], ['verification']);
  assert.equal(plan.needsInstall, false);
});

test('Gemini verifier changes select the verifier without a duplicated CI regex', () => {
  const plan = createPlan(changes('scripts/verify_gemini_api_models.js'));
  assert.deepEqual(ids(plan), ['card:direct:scripts/verify_gemini_api_models.js']);
  assert.deepEqual([...games(plan)], ['card']);
});

test('Card learning changes add the data contract without selecting Shooter', () => {
  const plan = createPlan(changes('card/game/vocab_data.js'));
  assert.ok(ids(plan).includes('card:learning-contract'));
  assert.ok(ids(plan).includes('card:build'));
  assert.equal(games(plan).has('shooter'), false);
});

test('renames and deletes preserve every path needed for scope selection', () => {
  const parsed = parseNameStatusZ(
    'R100\0shooter/engine.js\0card/game/logic.js\0D\0shooter/meta.js\0'
  );
  assert.deepEqual(parsed, [
    { status: 'R100', paths: ['shooter/engine.js', 'card/game/logic.js'] },
    { status: 'D', paths: ['shooter/meta.js'] }
  ]);
  const plan = createPlan(parsed);
  assert.equal(games(plan).has('card'), true);
  assert.equal(games(plan).has('shooter'), true);
});

test('distribution-only edits are blocked instead of reported as verified', () => {
  const plan = createPlan(changes('shooter/dist/AstralBloom.html'));
  assert.equal(plan.steps.length, 0);
  assert.match(plan.blocked.join('\n'), /without a mapped deployment input/);
});

test('minimal plans never contain full, balance-matrix, or unrelated game commands', () => {
  const plan = createPlan(changes(
    'scripts/verify.js',
    'shooter/meta.js',
    'shooter/tests/patch-economy.test.mjs'
  ));
  const commands = plan.steps.map(step => [step.command, ...step.args].join(' ')).join('\n');
  assert.doesNotMatch(commands, /verify:full|simulation-balance|test:defense/);
});

test('changed Shooter tests and their source mappings execute each command once', () => {
  const plan = createPlan(changes(
    'shooter/app.js',
    'shooter/engine.js',
    'shooter/tests/patch-input-flow.mjs',
    'shooter/tests/patch-combat.test.mjs'
  ));
  const inputRuns = plan.steps.filter(step => (
    step.command === 'node'
    && step.args.join(' ') === 'shooter/tests/patch-input-flow.mjs'
  ));
  assert.equal(inputRuns.length, 1);
  const unitSteps = plan.steps.filter(step => step.args[0] === '--test');
  assert.equal(unitSteps.length, 1);
  assert.equal(
    unitSteps[0].args.filter(arg => arg === 'shooter/tests/patch-combat.test.mjs').length,
    1
  );
});

function runGit(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, String(result.stderr || result.stdout));
  return result.stdout.trim();
}

test('merge-base scope excludes changes added only to main after the feature fork', t => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-plan-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  runGit(cwd, ['init', '-b', 'main']);
  runGit(cwd, ['config', 'user.email', 'verify@example.invalid']);
  runGit(cwd, ['config', 'user.name', 'Verify Fixture']);
  fs.writeFileSync(path.join(cwd, 'README.md'), 'base\n');
  runGit(cwd, ['add', 'README.md']);
  runGit(cwd, ['commit', '-m', 'base']);

  runGit(cwd, ['switch', '-c', 'feature']);
  fs.mkdirSync(path.join(cwd, 'shooter'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'shooter', 'app.js'), 'export const feature = true;\n');
  runGit(cwd, ['add', 'shooter/app.js']);
  runGit(cwd, ['commit', '-m', 'feature']);
  const featureHead = runGit(cwd, ['rev-parse', 'HEAD']);

  runGit(cwd, ['switch', 'main']);
  fs.mkdirSync(path.join(cwd, 'card', 'game'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'card', 'game', 'logic.js'), 'export const mainOnly = true;\n');
  runGit(cwd, ['add', 'card/game/logic.js']);
  runGit(cwd, ['commit', '-m', 'main only']);
  const currentMain = runGit(cwd, ['rev-parse', 'HEAD']);

  const scope = resolveChanges({
    cwd,
    baseRef: currentMain,
    headRef: featureHead,
    includeWorktree: false
  });
  const files = scope.changes.flatMap(change => change.paths);
  assert.deepEqual(files, ['shooter/app.js']);
});

test('missing refs fail as BLOCKED_SCOPE rather than selecting zero tests', () => {
  assert.throws(
    () => resolveChanges({
      baseRef: 'refs/heads/definitely-missing',
      headRef: 'HEAD',
      includeWorktree: false
    }),
    error => error && error.code === 'BLOCKED_SCOPE'
  );
});
