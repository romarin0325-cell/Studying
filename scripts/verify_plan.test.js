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

test('Astra edition builds before its focused browser check and never selects unrelated games', () => {
  const plan = createPlan(changes('card_astra/src/edition.js', 'card_astra/src/edition.css', 'card_astra/tests/smoke.mjs'));
  assert.deepEqual([...games(plan)], ['card']);
  assert.ok(ids(plan).indexOf('card:astra:build') < ids(plan).indexOf('card:astra:smoke'));
  assert.deepEqual(plan.browsers, ['chromium']);
  assert.equal(plan.steps.filter(step => step.args.includes('card_astra/tests/smoke.mjs') && !step.args.includes('--check')).length, 1);
  assert.deepEqual(plan.warnings, []);
  const removed = createPlan([{status:'D', paths:['card_deepseek/build.mjs']}, {status:'D', paths:['card_deepseek/dist/DREAMWEAVER-DeepSeek.html']}]);
  assert.deepEqual(removed.steps, []);
  assert.deepEqual(removed.warnings, []);
  assert.deepEqual(createPlan(changes('card_astra/README.md')).steps, []);
});

test('Lumen edition builds before its own browser check and leaves Astra alone', () => {
  const plan = createPlan(changes('card_lumen/src/lumen.js', 'card_lumen/src/lumen.css', 'card_lumen/tests/smoke.mjs'));
  assert.deepEqual([...games(plan)], ['card']);
  assert.ok(ids(plan).indexOf('card:lumen:build') < ids(plan).indexOf('card:lumen:smoke'));
  assert.equal(ids(plan).some(id => id.startsWith('card:astra:')), false);
  assert.deepEqual(plan.warnings, []);
  assert.deepEqual(createPlan(changes('card_lumen/README.md')).steps, []);
});

test('Star Garden is an isolated target with one build and no commands for other games', () => {
  const plan = createPlan(changes('defense/src/content.js', 'defense/src/app.js', 'defense/src/combat/engine.js', 'defense/dist/StarGardenDefense.html', 'scripts/verify_plan.js'));
  assert.deepEqual(plan.blocked, []);
  assert.deepEqual([...games(plan)], ['defense', 'verification']);
  assert.equal(plan.steps.filter(s => s.id === 'defense:build').length, 1);
  assert.doesNotMatch(plan.steps.map(s => s.args.join(' ')).join('\n'), /lint:defense|test:defense|shooter\/|card\/tests|survivor\//);
  const dedicated = createPlan(changes('defense/src/app.js', 'scripts/verify_plan.js'), { onlyGame: 'shooter' });
  assert.deepEqual(dedicated.steps, []);
  assert.deepEqual(dedicated.blocked, []);
});

test('Star Garden compression inventory and imported build helpers are deployment inputs', () => {
  for (const file of ['defense/docs/ASSET_OPTIMIZATION.json','defense/scripts/image-policy.mjs','defense/scripts/image-pack.mjs','defense/scripts/theme-bright.mjs','defense/assets/optimized/merge/units/luna.webp']) {
    const plan = createPlan(changes(file));
    assert.deepEqual([...games(plan)], ['defense'], file);
    assert.equal(plan.steps.filter(s => s.id === 'defense:build').length, 1, file);
    assert.ok(!plan.browsers.length, file);
  }
});

test('Star Garden build contracts run for preparation inputs and install dependencies even when test-only', () => {
  for (const file of ['defense/scripts/build.mjs', 'defense/scripts/image-policy.mjs', 'defense/scripts/image-pack.mjs', 'defense/docs/ASSET_OPTIMIZATION.json', 'defense/assets/optimized/ui/portraits/zeke.webp']) {
    const plan = createPlan(changes(file));
    const step = plan.steps.find(s => s.id === 'defense:contracts-and-regressions');
    assert.ok(step.args.includes('defense/tests/build.test.mjs'), file);
    assert.equal(step.needsInstall, true, file);
    assert.equal(plan.steps.filter(s => s.id === 'defense:build').length, 1, file);
    assert.deepEqual(plan.browsers, [], file);
    assert.deepEqual([...games(plan)], ['defense'], file);
  }
  const direct = createPlan(changes('defense/tests/build.test.mjs'));
  assert.equal(direct.steps.find(s => s.args.includes('defense/tests/build.test.mjs')).needsInstall, true);
  assert.ok(!direct.steps.some(s => s.id === 'defense:build'));
});

test('Star Garden docs, test-only and unknown paths keep the smallest safe boundary', () => {
  const docs = createPlan(changes('defense/README.md', 'defense/docs/archive/UI_ASSET_RESEARCH.md'));
  assert.deepEqual(docs.steps, []);
  assert.equal(docs.needsInstall, false);
  const tests = createPlan(changes('defense/tests/profile.test.mjs'));
  assert.ok(tests.steps.some(s => s.args.includes('--test')));
  assert.ok(!ids(tests).some(id => id.includes(':build')));
  assert.deepEqual(tests.browsers, []);
  const browser = createPlan(changes('defense/tests/browser.mjs'));
  assert.ok(ids(browser).includes('defense:offline-browser'));
  assert.ok(!ids(browser).includes('defense:build'));
  assert.deepEqual(createPlan(changes('defense/dist/StarGardenDefense.html')).blocked, []);
  assert.deepEqual(createPlan(changes('defense/scripts/unknown.mjs')).blocked, []);
  assert.deepEqual(createPlan(changes('defense/tests/unmapped-helper.mjs')).blocked, []);
});

test('Star Garden presentation-only changes select build without economy or combat tests', () => {
  const plan = createPlan(changes('defense/src/style.css'));
  assert.deepEqual(plan.blocked, []);
  assert.ok(ids(plan).includes('defense:build'));
  assert.ok(!plan.steps.some(s => s.args.includes('--test')));
});

test('Star Garden monthly and render/save helpers select their own contracts without unrelated game commands', () => {
  for (const [file, required] of [['monthly', ['monthly']], ['runtime', ['runtime']]]) {
    const plan = createPlan(changes('defense/src/' + file + '.js'));
    assert.deepEqual(plan.blocked, []);
    assert.deepEqual([...games(plan)], ['defense']);
    const units = plan.steps.find(s => s.id === 'defense:contracts-and-regressions');
    for (const name of required) assert.ok(units.args.includes('defense/tests/' + name + '.test.mjs'));
    assert.doesNotMatch(plan.steps.map(s => s.args.join(' ')).join('\n'), /lint:defense|test:defense|shooter\/|card\/tests|survivor\//);
  }
});

test('Star Garden sources select the existing tests that pin their contracts', () => {
  const contracts = file => createPlan(changes(file)).steps.find(s => s.id === 'defense:contracts-and-regressions');
  const selected = file => (contracts(file)?.args || []).filter(a => a.endsWith('.test.mjs')).map(a => a.slice('defense/tests/'.length, -'.test.mjs'.length));
  const content = ['assets', 'bond', 'combat', 'economy', 'generated-reports', 'independence', 'lines', 'text'];
  for (const [file, expected] of [
    ['defense/src/data.js', content],
    ['defense/src/content.js', content],
    ['defense/src/combat/engine.js', ['combat', 'generated-reports', 'text']],
    ['defense/src/bond.js', ['bond']],
    ['defense/src/smart-auto.js', ['combat']],
    ['defense/src/combat/effects.js', ['companion-vfx', 'lightning-vfx']],
    ['defense/src/lab/model.js', ['lab']],
    ['defense/lab.html', ['lab']],
    ['defense/scripts/build-lab.mjs', ['lab']],
    ['defense/src/memorial.js', ['memorial']],
    ['defense/src/course.js', ['study']],
    ['defense/scripts/current-values.mjs', ['generated-reports']],
    ['defense/src/app.js', []]
  ]) assert.deepEqual(selected(file), expected, file);
  // The lab inputs rebuild the committed lab (CI compares it); tests that load sharp install dependencies.
  for (const file of ['defense/lab.html', 'defense/scripts/build-lab.mjs']) {
    assert.equal(createPlan(changes(file)).steps.filter(s => s.id === 'defense:build').length, 1, file);
  }
  for (const file of ['defense/src/memorial.js', 'defense/src/course.js', 'defense/src/data.js']) assert.equal(contracts(file).needsInstall, true, file);
  assert.equal(contracts('defense/src/bond.js').needsInstall, false);
});

test('Star Garden local data, copied images, font and font license each validate their own consumer', () => {
  for (const file of ['defense/src/data.js', 'defense/assets/merge/units/luna.webp', 'defense/assets/moonlit/realm-bosses.webp', 'defense/assets/Jua-Regular.ttf', 'defense/assets/Jua-OFL.txt', 'defense/scripts/local-inputs.mjs']) {
    const plan = createPlan(changes(file));
    assert.deepEqual(plan.blocked, [], file);
    assert.deepEqual([...games(plan)], ['defense'], file);
    assert.ok(ids(plan).includes('defense:build'), file + ' build');
    assert.equal(plan.steps.filter(s => s.id === 'defense:build').length, 1);
    assert.doesNotMatch(plan.steps.map(s => s.id).join(' '), /generated-reports|offline-webkit/);
  }
});

test('Star Garden generated JSON alone selects 0 checks without a build or browser', () => {
  for (const file of ['defense/docs/BALANCE_SNAPSHOT.json', 'defense/docs/ASSET_PROVENANCE.json']) {
    const plan = createPlan(changes(file));
    assert.deepEqual(plan.blocked, []);
    assert.deepEqual(plan.steps, []);
    const deleted = createPlan([{ status: 'D', paths: [file] }]);
    assert.deepEqual(deleted.steps, []);
    const renamed = createPlan([{ status: 'R100', paths: [file, 'defense/docs/moved.json'] }]);
    assert.deepEqual(renamed.steps, []);
  }
});

test('Star Garden report generator changes run unit test only', () => {
  for (const file of ['defense/scripts/generated-reports.mjs', 'defense/scripts/report-data.mjs']) {
    const plan = createPlan(changes(file));
    assert.deepEqual(plan.blocked, []);
    assert.deepEqual(plan.browsers, []);
    assert.ok(plan.steps.some(s => s.args.includes('defense/tests/generated-reports.test.mjs')));
    assert.equal(ids(plan).includes('defense:build'), false);
    assert.equal(ids(plan).includes('defense:generated-reports'), false);
  }
});

test('Star Garden packer changes run the dependency-free guard test without a build or install', () => {
  for (const file of ['defense/scripts/art/output-guard.mjs', 'defense/scripts/art/pack_defense_directions.mjs', 'defense/scripts/art/pack-sd.mjs']) {
    const plan = createPlan(changes(file));
    const units = plan.steps.find(s => s.id === 'defense:contracts-and-regressions');
    assert.ok(units && units.args.includes('defense/tests/packer-guard.test.mjs'), file);
    assert.equal(units.needsInstall, false, file);
    assert.equal(ids(plan).includes('defense:build'), false, file);
  }
});

test('Nocturne runtime builds once and never selects existing game suites', () => {
  const plan = createPlan(changes('survivor/src/engine.js', 'survivor/assets/jasmine.webp', 'scripts/verify_plan.js'));
  assert.deepEqual(plan.blocked, []);
  assert.deepEqual([...games(plan)], ['survivor', 'verification']);
  assert.equal(plan.steps.filter(s => s.id === 'survivor:build').length, 1);
  assert.ok(ids(plan).includes('survivor:contracts-and-regressions'));
  assert.doesNotMatch(plan.steps.map(s => s.args.join(' ')).join('\n'), /lint:defense|test:defense|shooter\/|card\//);
});

test('Nocturne documentation and selector-only edits never run a game; dist-only and unknown paths do not block', () => {
  assert.equal(createPlan(changes('survivor/README.md')).steps.length, 0);
  assert.deepEqual([...games(createPlan(changes('scripts/verify_plan.js')))], ['verification']);
  assert.deepEqual(createPlan(changes('survivor/dist/AstraNocturne.html')).blocked, []);
  assert.deepEqual(createPlan(changes('survivor/mystery.js')).blocked, []);
  const testOnly = createPlan(changes('survivor/tests/profile.test.mjs'));
  assert.equal(ids(testOnly).includes('survivor:build'), false);
  assert.equal(testOnly.needsInstall, false);
  assert.ok(ids(createPlan(changes('survivor/assets/Jua-OFL.txt'))).includes('survivor:build'));
  assert.ok(ids(createPlan(changes('survivor/scripts/prepare-font.py'))).includes('survivor:build'));
});

test('Nocturne does not trigger on external game art changes', () => {
  const plan = createPlan(changes('defense/assets/merge/units/rumi.webp'));
  assert.equal(games(plan).has('survivor'), false);
});

test('Nocturne anatomical processor is a build input; review viewer checks syntax', () => {
  const processor = createPlan(changes('survivor/scripts/art-normalization.mjs'));
  assert.deepEqual(processor.blocked, []);
  assert.deepEqual([...games(processor)], ['survivor']);
  assert.equal(processor.steps.filter(s => s.id === 'survivor:build').length, 1);
  const viewer = createPlan(changes('survivor/scripts/review-art.mjs'));
  assert.deepEqual(viewer.blocked, []);
  assert.deepEqual([...games(viewer)], ['survivor']);
  assert.ok(ids(viewer).includes('survivor:syntax:survivor/scripts/review-art.mjs'));
  assert.equal(ids(viewer).includes('survivor:build'), false);
  assert.equal(ids(viewer).includes('survivor:offline-browser'), false);
});

test('Card-only changes never select Shooter or Defense commands', () => {
  const plan = createPlan(changes('card/game/logic.js'));
  assert.ok(games(plan).has('card'));
  assert.equal(games(plan).has('shooter'), false);
  assert.equal(games(plan).has('defense'), false);
  assert.ok(ids(plan).includes('card:build'));
  assert.ok(ids(plan).includes('card:combat-regression'));
  assert.equal(ids(plan).includes('card:bundle-smoke'), false);
});

test('Shooter-only changes select direct build and combat checks without bundle smoke', () => {
  const plan = createPlan(changes('shooter/engine.js'));
  assert.deepEqual([...games(plan)], ['shooter']);
  assert.ok(ids(plan).includes('shooter:build'));
  assert.ok(ids(plan).includes('shooter:selected-unit-tests'));
  assert.equal(ids(plan).includes('shooter:bundle-smoke'), false);
});

test('non-deployment documentation and AGENTS instructions install and run no game tooling or tests', () => {
  const plan = createPlan(changes('shooter/README.md', 'docs/notes.md', 'AGENTS.md', 'card/AGENTS.override.md', 'docs/verification-policy.md'));
  assert.equal(plan.steps.length, 0);
  assert.equal(plan.needsInstall, false);
  assert.deepEqual(plan.browsers, []);
  assert.match(plan.skipped.join('\n'), /documentation/);
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

test('moving Shooter manual sources into docs preserves deployment scope without invoking removed source paths', () => {
  const plan = createPlan([
    { status: 'R100', paths: ['shooter/manual.js', 'shooter/docs/manual-content.js'] },
    { status: 'R100', paths: ['shooter/manual-data.js', 'shooter/docs/manual-data.js'] },
    { status: 'D', paths: ['shooter/generate-manual.mjs'] },
    { status: 'D', paths: ['shooter/tests/old-flow.mjs'] },
    { status: 'D', paths: ['shooter/tests/old.test.mjs'] },
    { status: 'M', paths: ['shooter/build.mjs'] }
  ]);
  assert.ok(ids(plan).includes('shooter:build'));
  assert.deepEqual(plan.blocked, []);
  const commands = plan.steps.map(step => step.args.join(' ')).join('\n');
  assert.doesNotMatch(commands, /shooter\/(?:manual\.js|manual-data\.js|generate-manual\.mjs|tests\/old)/);
  assert.equal(games(plan).has('defense'), false);
});

test('distribution-only edits do not block', () => {
  const plan = createPlan(changes('shooter/dist/AstralBloom.html'));
  assert.equal(plan.steps.length, 0);
  assert.deepEqual(plan.blocked, []);
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

test('the PR workflow installs only the browsers the selector requests', () => {
  const workflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/verify.yml'), 'utf8');
  assert.match(workflow, /needs_chromium == 'true'[\s\S]*npx playwright install --with-deps chromium/);
  assert.match(workflow, /needs_webkit == 'true'[\s\S]*npx playwright install --with-deps webkit/);
  assert.equal(createPlan(changes('defense/tests/browser.mjs')).browsers.includes('chromium'), true);
  assert.equal(createPlan(changes('defense/docs/archive/MEMORIAL_MEDIA.md')).browsers.includes('chromium'), false);
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
