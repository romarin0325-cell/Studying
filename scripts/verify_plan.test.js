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

test('Star Garden is an isolated target with one build and no existing Defense commands',()=>{
  const plan=createPlan(changes('defense_test/src/content.js','defense_test/src/app.js','defense_test/src/combat/engine.js','defense_test/dist/StarGardenDefense.html','scripts/verify_plan.js'));
  assert.deepEqual(plan.blocked,[]);
  assert.deepEqual([...games(plan)],['defense_test','verification']);
  assert.equal(plan.steps.filter(s=>s.id==='defense_test:build').length,1);
  assert.ok(ids(plan).includes('defense_test:offline-browser'));
  assert.ok(ids(plan).includes('defense_test:offline-webkit'));
  assert.doesNotMatch(plan.steps.map(s=>s.args.join(' ')).join('\n'),/lint:defense|test:defense|defense\/tests|shooter\/|card\/tests|survivor\/|idle\//);
  const dedicated=createPlan(changes('defense_test/src/app.js','scripts/verify_plan.js'),{onlyGame:'defense'});
  assert.deepEqual(dedicated.steps,[]);assert.deepEqual(dedicated.blocked,[]);
});

test('Star Garden docs, test-only and unknown paths keep the smallest safe boundary',()=>{
  const docs=createPlan(changes('defense_test/README.md','defense_test/docs/UI_ASSET_RESEARCH.md'));
  assert.deepEqual(docs.steps,[]);assert.equal(docs.needsInstall,false);
  const tests=createPlan(changes('defense_test/tests/profile.test.mjs'));
  assert.ok(tests.steps.some(s=>s.args.includes('--test')));
  assert.ok(!ids(tests).some(id=>id.includes(':build')));
  assert.deepEqual(tests.browsers,[]);
  const browser=createPlan(changes('defense_test/tests/browser.mjs'));
  assert.ok(ids(browser).includes('defense_test:offline-browser'));
  assert.ok(!ids(browser).includes('defense_test:build'));
  assert.match(createPlan(changes('defense_test/dist/StarGardenDefense.html')).blocked.join('\n'),/without a mapped/);
  assert.match(createPlan(changes('defense_test/scripts/unknown.mjs')).blocked.join('\n'),/No Defense test mapping/);
  assert.match(createPlan(changes('defense_test/tests/unmapped-helper.mjs')).blocked.join('\n'),/No Defense test mapping/);
});

test('Star Garden presentation-only changes select browser checks without economy or combat tests',()=>{
  const plan=createPlan(changes('defense_test/src/style.css'));
  assert.deepEqual(plan.blocked,[]);
  assert.ok(ids(plan).includes('defense_test:build'));
  assert.ok(!plan.steps.some(s=>s.args.includes('--test')));
});

test('Star Garden monthly and render/save helpers select their own contracts without unrelated game commands',()=>{
  for(const [file,required]of [['monthly',['monthly','profile']],['runtime',['runtime']]]){
    const plan=createPlan(changes('defense_test/src/'+file+'.js'));
    assert.deepEqual(plan.blocked,[]);assert.deepEqual([...games(plan)],['defense_test']);
    const units=plan.steps.find(s=>s.id==='defense_test:contracts-and-regressions');
    for(const name of required)assert.ok(units.args.includes('defense_test/tests/'+name+'.test.mjs'));
    assert.doesNotMatch(plan.steps.map(s=>s.args.join(' ')).join('\n'),/lint:defense|test:defense|defense\/tests|shooter\/|card\/tests|survivor\/|idle\//);
  }
});

test('Star Garden local data, copied images, font and font license each validate their own consumer',()=>{
  for(const file of ['defense_test/src/data.js','defense_test/assets/merge/units/luna.webp','defense_test/assets/moonlit/realm-bosses.webp','defense_test/assets/Jua-Regular.ttf','defense_test/assets/Jua-OFL.txt','defense_test/scripts/local-inputs.mjs']){
    const plan=createPlan(changes(file));
    assert.deepEqual(plan.blocked,[],file);assert.deepEqual([...games(plan)],['defense_test'],file);
    for(const id of ['contracts-and-regressions','generated-reports','build','offline-browser','offline-webkit'])assert.ok(ids(plan).includes('defense_test:'+id),file+' '+id);
    assert.equal(plan.steps.filter(s=>s.id==='defense_test:build').length,1);
    assert.ok(plan.steps.find(s=>s.id==='defense_test:contracts-and-regressions').args.includes('defense_test/tests/independence.test.mjs'));
  }
});

test('Star Garden no longer consumes active Defense content, art or Card fonts',()=>{
  for(const file of ['defense/merge/content.js','defense/assets/merge/units/luna.webp','card/assets/Jua-Regular.ttf']){
    const plan=createPlan(changes(file));
    assert.ok(!games(plan).has('defense_test'),file);
    assert.ok(!games(plan).has('defense'),file);
  }
});

test('Star Garden generated JSON alone selects read-only regeneration without a build or browser',()=>{
  for(const file of ['defense_test/docs/BALANCE_SNAPSHOT.json','defense_test/docs/ASSET_PROVENANCE.json']){
    const plan=createPlan(changes(file));
    assert.deepEqual(plan.blocked,[]);assert.deepEqual(ids(plan),['defense_test:generated-reports']);
    assert.deepEqual(plan.steps[0].args,['defense_test/scripts/generated-reports.mjs','--check']);
    assert.deepEqual(plan.browsers,[]);
    assert.equal(plan.steps.some(s=>s.id.includes(':build')),false);
    const deleted=createPlan([{status:'D',paths:[file]}]);assert.deepEqual(ids(deleted),['defense_test:generated-reports']);
    const renamed=createPlan([{status:'R100',paths:[file,'defense_test/docs/moved.json']}]);assert.deepEqual(ids(renamed),['defense_test:generated-reports']);
  }
});

test('Star Garden report generator changes run tamper regressions and comparison only',()=>{
  for(const file of ['defense_test/scripts/generated-reports.mjs','defense_test/scripts/report-data.mjs','defense_test/scripts/analyze.mjs']){
    const plan=createPlan(changes(file));
    assert.deepEqual(plan.blocked,[]);assert.deepEqual(plan.browsers,[]);
    assert.ok(ids(plan).includes('defense_test:generated-reports'));
    assert.ok(plan.steps.some(s=>s.args.includes('defense_test/tests/generated-reports.test.mjs')));
    assert.equal(ids(plan).includes('defense_test:build'),false);
  }
});

test('Nocturne runtime builds once, boots offline and never selects existing game suites', () => {
  const plan=createPlan(changes('survivor/src/engine.js','survivor/assets/jasmine.webp','scripts/verify_plan.js'));
  assert.deepEqual(plan.blocked,[]);
  assert.deepEqual([...games(plan)],['survivor','verification']);
  assert.equal(plan.steps.filter(s=>s.id==='survivor:build').length,1);
  assert.ok(ids(plan).includes('survivor:offline-browser'));
  assert.ok(ids(plan).includes('survivor:offline-webkit'));
  assert.doesNotMatch(plan.steps.map(s=>s.args.join(' ')).join('\n'),/lint:defense|test:defense|shooter\/|card\/|idle\//);
});

test('Nocturne documentation and selector-only edits never run a game; dist-only and unknown paths block', () => {
  assert.equal(createPlan(changes('survivor/README.md')).steps.length,0);
  assert.deepEqual([...games(createPlan(changes('scripts/verify_plan.js')))],['verification']);
  assert.ok(createPlan(changes('survivor/dist/AstraNocturne.html')).blocked.length);
  assert.ok(createPlan(changes('survivor/mystery.js')).blocked.length);
  const testOnly=createPlan(changes('survivor/tests/profile.test.mjs'));
  assert.equal(ids(testOnly).includes('survivor:build'),false);
  assert.equal(testOnly.needsInstall,false);
  assert.ok(ids(createPlan(changes('survivor/scripts/simulate.mjs'))).includes('survivor:contracts-and-regressions'));
  assert.ok(ids(createPlan(changes('survivor/assets/Jua-OFL.txt'))).includes('survivor:build'));
  assert.ok(ids(createPlan(changes('survivor/scripts/prepare-font.py'))).includes('survivor:build'));
});

test('Nocturne shared-art changes validate the consumer without invoking Defense from root', () => {
  const plan=createPlan(changes('defense/assets/merge/units/rumi.webp'));
  assert.ok(ids(plan).includes('survivor:build'));
  assert.equal(games(plan).has('defense'),false);
  const dedicated=createPlan(changes('survivor/src/app.js'),{onlyGame:'defense'});
  assert.equal(dedicated.steps.length,0);
  assert.deepEqual(dedicated.blocked,[]);
});

test('Nocturne anatomical processor is a build input; review viewer checks art without releasing', () => {
  const processor=createPlan(changes('survivor/scripts/art-normalization.mjs'));
  assert.deepEqual(processor.blocked,[]);assert.deepEqual([...games(processor)],['survivor']);
  assert.equal(processor.steps.filter(s=>s.id==='survivor:build').length,1);
  assert.ok(ids(processor).includes('survivor:offline-browser'));
  const viewer=createPlan(changes('survivor/scripts/review-art.mjs'));
  assert.deepEqual(viewer.blocked,[]);assert.deepEqual([...games(viewer)],['survivor']);
  assert.ok(ids(viewer).includes('survivor:contracts-and-regressions'));
  assert.ok(ids(viewer).includes('survivor:syntax:survivor/scripts/review-art.mjs'));
  assert.equal(ids(viewer).includes('survivor:build'),false);
  assert.equal(ids(viewer).includes('survivor:offline-browser'),false);
});

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

test('moving Shooter manual sources into docs preserves deployment scope without invoking removed source paths', () => {
  const plan = createPlan([
    { status:'R100', paths:['shooter/manual.js','shooter/docs/manual-content.js'] },
    { status:'R100', paths:['shooter/manual-data.js','shooter/docs/manual-data.js'] },
    { status:'D', paths:['shooter/generate-manual.mjs'] },
    { status:'D', paths:['shooter/tests/old-flow.mjs'] },
    { status:'D', paths:['shooter/tests/old.test.mjs'] },
    { status:'M', paths:['shooter/build.mjs'] }
  ]);
  assert.ok(ids(plan).includes('shooter:build'));
  assert.ok(ids(plan).includes('shooter:bundle-smoke'));
  assert.deepEqual(plan.blocked,[]);
  const commands=plan.steps.map(step=>step.args.join(' ')).join('\n');
  assert.doesNotMatch(commands,/shooter\/(?:manual\.js|manual-data\.js|generate-manual\.mjs|tests\/old)/);
  assert.equal(games(plan).has('defense'),false);
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
