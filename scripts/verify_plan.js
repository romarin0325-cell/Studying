'use strict';

const path = require('path');

const ACTIVE_ROOT_GAMES = Object.freeze(['card', 'shooter', 'idle', 'survivor', 'defense_test']);
const ALL_GAMES = Object.freeze(['card', 'shooter', 'defense', 'idle', 'survivor', 'defense_test']);
const DEFENSE_TOOLS = new Set([
  'scripts/build_defense_local.mjs', 'scripts/prepare_defense_art.mjs',
  'scripts/verify_defense.js', 'scripts/verify_defense_confluence.mjs',
  'scripts/verify_defense_browser.js', 'scripts/verify_defense_experience.js',
  'scripts/verify_defense_local_bundle.js', 'scripts/verify_defense_resilience.js',
  'scripts/defense_browser_suite.cjs', 'scripts/serve_defense.js',
  'scripts/pack_defense_directions.mjs', 'scripts/validate_defense_directions.mjs',
  'scripts/export_defense_directions.mjs', 'scripts/build_defense_head_review.mjs',
  'scripts/make_defense_geometry_reference.mjs'
]);
const DEFENSE_ART_INPUTS = new Set([
  'defense/docs/art/HEAD_PROFILE.json', 'defense/docs/art/ANATOMICAL_LANDMARKS.json'
]);
const DEFENSE_TEST_REPORTS = new Set([
  'defense_test/docs/BALANCE_SNAPSHOT.json', 'defense_test/docs/ASSET_PROVENANCE.json'
]);

function normalizePath(file) {
  return String(file || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function changePaths(changes) {
  const files = new Set();
  for (const change of changes || []) {
    for (const file of change.paths || []) {
      const normalized = normalizePath(file);
      if (normalized) files.add(normalized);
    }
  }
  return [...files].sort();
}

function currentChangePaths(changes) {
  const files = new Set();
  for (const change of changes || []) {
    const status = String(change.status || '').charAt(0);
    if (status === 'D') continue;
    const paths = change.paths || [];
    const currentPaths = status === 'R' || status === 'C'
      ? paths.slice(-1)
      : paths;
    for (const file of currentPaths) {
      const normalized = normalizePath(file);
      if (normalized) files.add(normalized);
    }
  }
  return [...files].sort();
}

function isDocumentation(file) {
  if (DEFENSE_ART_INPUTS.has(file) || DEFENSE_TEST_REPORTS.has(file)
    || file === 'survivor/assets/Jua-OFL.txt' || file === 'defense_test/assets/Jua-OFL.txt') return false;
  const lower = file.toLowerCase();
  return (
    lower.endsWith('.md')
    || lower.endsWith('.txt')
    || lower.endsWith('.adoc')
    || lower.startsWith('docs/')
    || /\/docs\//.test(lower)
  );
}

function isVerificationPath(file) {
  return (
    file === 'AGENTS.md'
    || file === 'package.json'
    || file === 'package-lock.json'
    || file === 'card/AGENTS.override.md'
    || file === 'defense/AGENTS.md'
    || file === 'docs/verification-policy.md'
    || file === 'scripts/verify.js'
    || file === 'scripts/verify_plan.js'
    || file === 'scripts/verify_plan.test.js'
    || /^\.github\/workflows\/(?:verify|card|defense)\.yml$/.test(file)
  );
}

function makeStep(id, game, description, command, args, options = {}) {
  return {
    id,
    game,
    description,
    command,
    args,
    needsInstall: Boolean(options.needsInstall),
    browsers: [...new Set(options.browsers || [])]
  };
}

function addStep(plan, step) {
  const signature = candidate => (
    candidate.command + '\0' + candidate.args.join('\0')
  );
  if (!plan.steps.some(existing => (
    existing.id === step.id || signature(existing) === signature(step)
  ))) {
    plan.steps.push(step);
  }
}

function addNodeCheck(plan, game, file) {
  addStep(
    plan,
    makeStep(
      game + ':syntax:' + file,
      game,
      'Parse changed JavaScript: ' + file,
      'node',
      ['--check', file]
    )
  );
}

function addNodeTest(plan, game, id, description, files) {
  const unique = [...new Set(files)].sort();
  if (unique.length === 0) return;
  addStep(plan, makeStep(id, game, description, 'node', ['--test', ...unique]));
}

function addBrowserScript(plan, game, id, description, file, browsers = ['chromium']) {
  addStep(
    plan,
    makeStep(id, game, description, 'node', [file], {
      needsInstall: true,
      browsers
    })
  );
}

function planCard(plan, files) {
  const cardFiles = files.filter(file => file.startsWith('card/'));
  const productFiles = cardFiles.filter(file => !isDocumentation(file));
  const directScripts = files.filter(file => (
    file.startsWith('scripts/verify_card_')
    || file === 'scripts/verify_gemini_api_models.js'
  ));

  for (const script of directScripts) {
    addStep(
      plan,
      makeStep(
        'card:direct:' + script,
        'card',
        'Run the changed Card contract check: ' + script,
        'node',
        [script]
      )
    );
  }

  const directTests = productFiles.filter(file => /^card\/tests\/.+\.mjs$/.test(file));
  for (const testFile of directTests) {
    addBrowserScript(
      plan,
      'card',
      'card:test:' + testFile,
      'Run the changed Card browser scenario: ' + testFile,
      testFile
    );
  }

  const sourceFiles = productFiles.filter(file => (
    !file.startsWith('card/tests/')
    && !file.startsWith('card/dist/')
    && file !== 'card/AGENTS.override.md'
  ));
  for (const file of sourceFiles.filter(file => /\.(?:js|mjs|cjs)$/.test(file))) {
    addNodeCheck(plan, 'card', file);
  }

  if (sourceFiles.some(file => (
    /^card\/game\/(?:vocab_data|collocation_data|toeic|toeic_explanations|data)\.js$/.test(file)
  ))) {
    addStep(
      plan,
      makeStep(
        'card:learning-contract',
        'card',
        'Check the changed Card learning data contract',
        'node',
        ['scripts/verify_card_learning_data.js']
      )
    );
  }
  if (sourceFiles.some(file => /(?:music_data|music_player)\.js$/.test(file))) {
    addStep(
      plan,
      makeStep(
        'card:music-contract',
        'card',
        'Check the changed Card music behavior',
        'node',
        ['scripts/verify_card_music_player.js']
      )
    );
  }
  if (sourceFiles.some(file => /(?:battle_runtime|rpg_features|logic)\.js$/.test(file))) {
    addStep(
      plan,
      makeStep(
        'card:combat-regression',
        'card',
        'Check the closest Card combat regressions',
        'node',
        ['scripts/verify_card_combat_regressions.js']
      )
    );
  }
  if (sourceFiles.some(file => /(?:data|card_pool_rules|card_pool_view)\.js$/.test(file))) {
    addStep(
      plan,
      makeStep(
        'card:basic-sets',
        'card',
        'Check Card data and basic-set boundaries',
        'node',
        ['scripts/verify_card_basic_sets.js']
      )
    );
  }

  if (sourceFiles.length > 0) {
    addStep(
      plan,
      makeStep(
        'card:build',
        'card',
        'Build the changed DREAMWEAVER deployment input once',
        'npm',
        ['run', 'build:card'],
        { needsInstall: true }
      )
    );
    addBrowserScript(
      plan,
      'card',
      'card:bundle-smoke',
      'Boot the built DREAMWEAVER artifact and check the closest release contract',
      'card/tests/verify.mjs'
    );
  }

  const outputOnly = productFiles.some(file => file.startsWith('card/dist/')) && sourceFiles.length === 0;
  if (outputOnly) {
    plan.blocked.push('Card distribution changed without a mapped deployment input.');
  }
}

function planShooter(plan, files, currentFiles) {
  const current = new Set(currentFiles);
  const shooterFiles = files.filter(file => file.startsWith('shooter/'));
  const productFiles = shooterFiles.filter(file => !isDocumentation(file));
  const directUnitTests = productFiles.filter(file => current.has(file) && /^shooter\/tests\/.+\.test\.mjs$/.test(file));
  const selectedUnitTests = new Set(directUnitTests);
  const directFlowTests = productFiles.filter(file => (
    current.has(file) && /^shooter\/tests\/.+\.mjs$/.test(file) && !file.endsWith('.test.mjs')
  ));

  for (const testFile of directFlowTests) {
    addBrowserScript(
      plan,
      'shooter',
      'shooter:test:' + testFile,
      'Run the changed Shooter browser scenario: ' + testFile,
      testFile
    );
  }

  const sourceFiles = productFiles.filter(file => (
    !file.startsWith('shooter/tests/')
    && !file.startsWith('shooter/dist/')
    && !file.startsWith('shooter/artifacts/')
  ));
  for (const file of sourceFiles.filter(file => current.has(file) && /\.(?:js|mjs|cjs)$/.test(file))) {
    addNodeCheck(plan, 'shooter', file);
  }

  if (sourceFiles.includes('shooter/meta.js')) {
    selectedUnitTests.add('shooter/tests/endgame.test.mjs');
    selectedUnitTests.add('shooter/tests/patch-economy.test.mjs');
  }
  if (sourceFiles.some(file => file === 'shooter/engine.js' || file === 'shooter/content.js')) {
    selectedUnitTests.add('shooter/tests/engine.test.mjs');
    selectedUnitTests.add('shooter/tests/expansion.test.mjs');
    selectedUnitTests.add('shooter/tests/patch-combat.test.mjs');
  }
  if (sourceFiles.some(file => (
    file === 'shooter/app.js'
    || file === 'shooter/menus.js'
    || file === 'shooter/style.css'
    || file === 'shooter/index.html'
  ))) {
    addBrowserScript(
      plan,
      'shooter',
      'shooter:input-ui-flow',
      'Exercise the changed Shooter input and sortie UI path',
      'shooter/tests/patch-input-flow.mjs'
    );
  }
  if (sourceFiles.some(file => (
    file === 'shooter/sync-learning.mjs'
    || file.startsWith('shooter/learning/')
  ))) {
    addStep(
      plan,
      makeStep(
        'shooter:learning-contract',
        'shooter',
        'Check the Card-to-Shooter learning snapshot contract',
        'node',
        ['shooter/sync-learning.mjs', '--check']
      )
    );
  }
  addNodeTest(
    plan,
    'shooter',
    'shooter:selected-unit-tests',
    'Run changed and closest Shooter unit regressions once',
    [...selectedUnitTests]
  );

  if (sourceFiles.length > 0) {
    addStep(
      plan,
      makeStep(
        'shooter:build',
        'shooter',
        'Build the changed AstralBloom deployment input once',
        'npm',
        ['run', 'build', '--prefix', 'shooter'],
        { needsInstall: true }
      )
    );
    addBrowserScript(
      plan,
      'shooter',
      'shooter:bundle-smoke',
      'Boot the built AstralBloom artifact offline',
      'shooter/verify.mjs'
    );
  }

  const outputOnly = productFiles.some(file => file.startsWith('shooter/dist/')) && sourceFiles.length === 0;
  if (outputOnly) {
    plan.blocked.push('Shooter distribution changed without a mapped deployment input.');
  }
}

function defenseUnitTestsFor(sourceFiles) {
  const tests = new Set();
  if (sourceFiles.length > 0) tests.add('defense/tests/unit/confluence.test.mjs');
  for (const file of sourceFiles) {
    if (/^defense\/merge\/(?:engine|content|main)\.js$/.test(file)) tests.add('defense/tests/unit/confluence.test.mjs');
    if (file.startsWith('defense/assets/') || DEFENSE_ART_INPUTS.has(file)) tests.add('defense/tests/integration/confluence-art.test.mjs');
  }
  return [...tests];
}

function planDefense(plan, files, currentFiles) {
  const defenseFiles = files.filter(file => file.startsWith('defense/'));
  if (defenseFiles.length === 0) {
    if (files.some(file => DEFENSE_TOOLS.has(file))) plan.skipped.push('Defense tooling has no changed Defense product file; no game runtime is selected.');
    return;
  }
  const currentSet = new Set(currentFiles);
  for (const file of files.filter(file => DEFENSE_TOOLS.has(file) && currentSet.has(file))) addNodeCheck(plan, 'defense', file);
  const productFiles = defenseFiles.filter(file => !isDocumentation(file));
  const directTests = productFiles.filter(file => (
    currentSet.has(file) && /^defense\/tests\/.+\.test\.mjs$/.test(file)
  ));
  addNodeTest(
    plan,
    'defense',
    'defense:changed-tests',
    'Run changed Defense tests directly',
    directTests
  );

  const sourceFiles = productFiles.filter(file => (
    !file.startsWith('defense/tests/')
    && !file.startsWith('defense/dist-local/')
    && file !== 'defense/AGENTS.md'
  ));
  for (const file of sourceFiles.filter(file => (
    currentSet.has(file) && /\.(?:js|mjs|cjs)$/.test(file)
  ))) {
    addNodeCheck(plan, 'defense', file);
  }

  addNodeTest(
    plan,
    'defense',
    'defense:nearby-regressions',
    'Run the closest Defense regression tests',
    defenseUnitTestsFor(sourceFiles).filter(file => !directTests.includes(file))
  );

  if (sourceFiles.length > 0) {
    addStep(
      plan,
      makeStep(
        'defense:lint',
        'defense',
        'Check Defense source and content contracts',
        'npm',
        ['run', 'lint:defense']
      )
    );
    if (sourceFiles.some(file => file.startsWith('defense/assets/'))) {
      addStep(
        plan,
        makeStep(
          'defense:asset-cache',
          'defense',
          'Check changed Defense asset preprocessing without forcing regeneration',
          'npm',
          ['run', 'prepare:defense-art', '--', '--check'],
          { needsInstall: true }
        )
      );
    }
    addStep(
      plan,
      makeStep(
        'defense:build-local',
        'defense',
        'Build the changed HeroCoreDefense deployment input once',
        'npm',
        ['run', 'build:defense-local'],
        { needsInstall: true }
      )
    );
    addStep(
      plan,
      makeStep(
        'defense:bundle-contract',
        'defense',
        'Check the built HeroCoreDefense single-file contract',
        'node',
        ['scripts/verify_defense_local_bundle.js'],
        { needsInstall: true, browsers: ['chromium'] }
      )
    );
  }

  if (sourceFiles.some(file => (
    file === 'defense/index.html'
    || file.startsWith('defense/css/')
    || file.startsWith('defense/js/app/')
    || file.startsWith('defense/js/render/')
    || /^defense\/merge\/(?:main\.js|render\.js|style\.css)$/.test(file)
  ))) {
    addStep(
      plan,
      makeStep(
        'defense:browser-screen',
        'defense',
        'Check the changed Defense screen in Chromium',
        'npm',
        ['run', 'test:defense:browser'],
        { needsInstall: true, browsers: ['chromium'] }
      )
    );
  }

  const outputOnly = productFiles.some(file => file.startsWith('defense/dist-local/')) && sourceFiles.length === 0;
  if (outputOnly) {
    plan.blocked.push('Defense distribution changed without a mapped deployment input.');
  }
}

function planIdle(plan, files, currentFiles) {
  const current = new Set(currentFiles);
  const product = files.filter(file => file.startsWith('idle/') && !isDocumentation(file));
  const direct = product.filter(file => current.has(file) && /^idle\/tests\/.+\.test\.mjs$/.test(file));
  const inputs = product.filter(file => /^(?:idle\/src\/|idle\/styles\/|idle\/assets\/|idle\/index\.html$|idle\/package\.json$|idle\/scripts\/(?:build|prepare-thumbnails)\.mjs$)/.test(file));
  const knownScripts = new Set(['build.mjs', 'import-assets.mjs', 'prepare-memories.mjs', 'prepare-thumbnails.mjs', 'resolve-canon.mjs', 'sync-learning.mjs', 'simulate.mjs', 'review-art.mjs']);
  const unknown = product.filter(file => !inputs.includes(file)
    && !file.startsWith('idle/dist/') && !file.startsWith('idle/tests/')
    && !(file.startsWith('idle/scripts/') && knownScripts.has(path.posix.basename(file)))
    && /\.(?:js|mjs|cjs|json|ya?ml|html|css)$/.test(file));
  if (unknown.length) plan.blocked.push('No Idle mapping exists for: ' + unknown.join(', '));
  for (const file of product.filter(file => current.has(file) && /\.(?:js|mjs|cjs)$/.test(file))) addNodeCheck(plan, 'idle', file);
  const tests = new Set(direct);
  const add = name => tests.add('idle/tests/' + name + '.test.mjs');
  if (inputs.some(file => file.startsWith('idle/assets/') || file.startsWith('idle/src/data/'))) add('contracts');
  if (inputs.some(file => /idle\/src\/(?:core|systems)\//.test(file))) { add('core'); add('rewards'); }
  if (inputs.some(file => /idle\/src\/(?:combat|data\/roster|data\/balance|systems\/(?:growth|adventure|expeditions))/.test(file))) { add('combat'); add('analysis'); }
  if (product.includes('idle/tests/helpers.mjs')) for (const name of ['core','rewards','combat','analysis']) add(name);
  addNodeTest(plan, 'idle', 'idle:contracts-and-regressions', 'Check only mapped Idle contracts and regressions', [...tests]);
  if (tests.has('idle/tests/contracts.test.mjs')) plan.steps.find(step => step.id === 'idle:contracts-and-regressions').needsInstall = true;
  if (inputs.length) {
    addStep(plan, makeStep('idle:build', 'idle', 'Build the changed AstralCompanions deployment inputs once', 'node', ['idle/scripts/build.mjs'], { needsInstall: true }));
  }
  if (inputs.length || product.some(file => file === 'idle/tests/browser.mjs' || file.startsWith('idle/tests/fixtures/'))) {
    addBrowserScript(plan, 'idle', 'idle:offline-browser', 'Boot the committed single-file game and exercise changed UI/storage', 'idle/tests/browser.mjs');
  }
  if (product.some(file => file.startsWith('idle/dist/')) && !inputs.length) plan.blocked.push('Idle distribution changed without a mapped deployment input.');
}

function planSurvivor(plan, files, currentFiles) {
  const product=files.filter(file=>file.startsWith('survivor/')&&!isDocumentation(file));
  // Reading/repacking canonical art does not run a Defense or Shooter suite.
  const shared=files.filter(file=>/^defense\/assets\/merge\/(?:garden\.webp|units\/(?:rumi|luna|zeke|cinderella|snow_rabbit|night_rabbit|silver_rabbit|time_ruler|storm_sage|lightning_sage|queen|galaxy_whale|great_detective)\.webp)$/.test(file)
    || /^shooter\/generated-assets\/(?:enemies|bosses|sentinels)\/[0-3]\.webp$/.test(file)
    || /^shooter\/generated-assets\/worlds\/[23]\.webp$/.test(file)
    || file === 'card/assets/Jua-Regular.ttf');
  if(!product.length&&!shared.length)return;
  const inputs=product.filter(file=>/^survivor\/(?:src\/|assets\/|scripts\/(?:(?:build|prepare-assets|pack-jasmine|art-normalization)\.mjs|prepare-font\.py)$|index\.html$|package\.json$)/.test(file)).concat(shared);
  const tests=currentFiles.filter(file=>/^survivor\/tests\/.*\.test\.mjs$/.test(file));
  const unknown=product.filter(file=>!inputs.includes(file)&&!/^survivor\/(?:tests\/|dist\/|scripts\/(?:serve|simulate|review-art)\.mjs$)/.test(file));
  if(unknown.length)plan.blocked.push('No Survivor mapping exists for: '+unknown.join(', '));
  const checks=new Set(tests);
  if(product.includes('survivor/scripts/simulate.mjs'))checks.add('survivor/tests/engine.test.mjs');
  if(product.includes('survivor/scripts/review-art.mjs'))checks.add('survivor/tests/assets.test.mjs');
  if(inputs.length)for(const file of ['engine','profile','assets'])checks.add('survivor/tests/'+file+'.test.mjs');
  addNodeTest(plan,'survivor','survivor:contracts-and-regressions','Check Nocturne combat, persistence and canonical art contracts',[...checks]);
  if(checks.has('survivor/tests/assets.test.mjs'))plan.steps.find(s=>s.id==='survivor:contracts-and-regressions').needsInstall=true;
  for(const file of currentFiles.filter(file=>/^survivor\/(?:src\/.*\.js|scripts\/.*\.mjs)$/.test(file)))addNodeCheck(plan,'survivor',file);
  if(inputs.length)addStep(plan,makeStep('survivor:build','survivor','Build the changed offline Nocturne inputs once','node',['survivor/scripts/build.mjs'],{needsInstall:true}));
  if(inputs.length||product.some(file=>file==='survivor/tests/browser.mjs'))addBrowserScript(plan,'survivor','survivor:offline-browser','Play the committed standalone HTML offline at mobile and desktop sizes','survivor/tests/browser.mjs');
  if(inputs.length||product.includes('survivor/tests/browser-webkit.mjs'))addBrowserScript(plan,'survivor','survivor:offline-webkit','Check Nocturne file playback, resume and backup import in WebKit','survivor/tests/browser-webkit.mjs',['webkit']);
  if(product.some(file=>file.startsWith('survivor/dist/'))&&!inputs.length)plan.blocked.push('Survivor distribution changed without a mapped deployment input.');
}

function planDefenseTest(plan, files, currentFiles) {
  const product=files.filter(file=>file.startsWith('defense_test/')&&!isDocumentation(file));
  if(!product.length)return;
  const inputs=product.filter(file=>/^defense_test\/(?:src\/|assets\/|index\.html$|package\.json$|scripts\/(?:build|local-inputs)\.mjs$)/.test(file));
  const current=new Set(currentFiles),checks=new Set(product.filter(file=>current.has(file)&&/^defense_test\/tests\/.*\.test\.mjs$/.test(file)));
  const reportScripts=product.some(file=>/^defense_test\/scripts\/(?:analyze|report-data|generated-reports)\.mjs$/.test(file));
  const unknown=product.filter(file=>!inputs.includes(file)&&!DEFENSE_TEST_REPORTS.has(file)&&!/^defense_test\/(?:tests\/(?:[a-z-]+\.test\.mjs|browser\.mjs)$|dist\/|scripts\/(?:serve|analyze|report-data|generated-reports|prepare-memorial-media)\.mjs$)/.test(file));
  if(unknown.length)plan.blocked.push('No Defense test mapping exists for: '+unknown.join(', '));
  for(const file of product.filter(file=>current.has(file)&&/\.(?:js|mjs|cjs)$/.test(file)))addNodeCheck(plan,'defense_test',file);
  const add=name=>checks.add('defense_test/tests/'+name+'.test.mjs');
  if(inputs.some(file=>/(?:src\/(?:content|data)\.js|scripts\/(?:build|local-inputs)\.mjs|assets\/)/.test(file))){add('assets');add('combat');add('economy');add('profile');add('independence');}
  if(inputs.some(file=>file.endsWith('/economy.js'))){add('economy');add('profile');add('combat');}
  if(inputs.some(file=>/(?:src\/battle\.js|src\/combat\/engine\.js)$/.test(file))){add('combat');add('profile');}
  if(inputs.includes('defense_test/src/profile.js'))add('profile');
  if(inputs.includes('defense_test/src/monthly.js')){add('monthly');add('profile');}
  if(inputs.includes('defense_test/src/runtime.js'))add('runtime');
  if(reportScripts)add('generated-reports');
  addNodeTest(plan,'defense_test','defense_test:contracts-and-regressions','Check Star Garden collection, growth, tickets and actual combat regressions',[...checks]);
  if(['assets','generated-reports'].some(name=>checks.has('defense_test/tests/'+name+'.test.mjs')))plan.steps.find(s=>s.id==='defense_test:contracts-and-regressions').needsInstall=true;
  if(inputs.length||reportScripts||product.some(file=>DEFENSE_TEST_REPORTS.has(file)))addStep(plan,makeStep('defense_test:generated-reports','defense_test','Regenerate and compare both JSON reports without overwriting the committed evidence','node',['defense_test/scripts/generated-reports.mjs','--check'],{needsInstall:true}));
  if(inputs.length)addStep(plan,makeStep('defense_test:build','defense_test','Build Star Garden from its deployment inputs once','node',['defense_test/scripts/build.mjs'],{needsInstall:true}));
  if(inputs.length||product.includes('defense_test/tests/browser.mjs')){
    addBrowserScript(plan,'defense_test','defense_test:offline-browser','Exercise the standalone portrait UI, draft and resume offline','defense_test/tests/browser.mjs');
    // file:// storage, File.text() backup import, WebP and viewport sizing have
    // a concrete WebKit boundary in this standalone deployment.
    addStep(plan,makeStep('defense_test:offline-webkit','defense_test','Check file playback, storage and backup restore in WebKit','node',['defense_test/tests/browser.mjs','--webkit'],{needsInstall:true,browsers:['webkit']}));
  }
  if(product.some(file=>file.startsWith('defense_test/dist/'))&&!inputs.length)plan.blocked.push('Defense test distribution changed without a mapped deployment input.');
}

function createPlan(changes, options = {}) {
  const files = changePaths(changes);
  const currentFiles = currentChangePaths(changes);
  const onlyGame = options.onlyGame || null;
  if (onlyGame && !ALL_GAMES.includes(onlyGame)) {
    throw new Error('Unknown game: ' + onlyGame);
  }

  const plan = {
    files,
    detectedGames: ALL_GAMES.filter(game => files.some(file => file.startsWith(game + '/'))),
    steps: [],
    skipped: [],
    warnings: [],
    blocked: []
  };

  const verificationFiles = files.filter(isVerificationPath);
  if (!onlyGame && verificationFiles.length > 0) {
    addStep(
      plan,
      makeStep(
        'verification:selector-fixtures',
        'verification',
        'Run range-selection and command-isolation fixtures',
        'node',
        ['--test', 'scripts/verify_plan.test.js']
      )
    );
  }

  if (files.includes('package-lock.json')) {
    plan.warnings.push(
      'Shared dependency compatibility is not automatically claimed for games without changed product files.'
    );
  }

  const shouldPlan = game => !onlyGame ? ACTIVE_ROOT_GAMES.includes(game) : onlyGame === game;
  if (shouldPlan('card')) planCard(plan, files);
  if (shouldPlan('shooter')) planShooter(plan, files, currentFiles);
  if (shouldPlan('defense')) planDefense(plan, files, currentFiles);
  if (shouldPlan('idle')) planIdle(plan, files, currentFiles);
  if (shouldPlan('survivor')) planSurvivor(plan, files, currentFiles);
  if (shouldPlan('defense_test')) planDefenseTest(plan, files, currentFiles);

  if (!onlyGame && plan.detectedGames.includes('defense')) {
    plan.skipped.push('Defense commands are delegated to the dedicated Defense workflow.');
  }
  for (const game of plan.detectedGames) {
    if (onlyGame && game !== onlyGame) {
      plan.skipped.push(game + ' is outside the requested dedicated game scope.');
    }
  }

  const ordinaryDocs = files.filter(file => isDocumentation(file) && !isVerificationPath(file));
  if (ordinaryDocs.length > 0) {
    plan.skipped.push('Runtime checks are not selected for non-deployment documentation.');
  }

  const mapped = new Set([
    ...files.filter(isVerificationPath),
    ...files.filter(file => ALL_GAMES.some(game => file.startsWith(game + '/'))),
    ...files.filter(file => file.startsWith('scripts/verify_card_')),
    ...files.filter(file => file === 'scripts/verify_gemini_api_models.js'),
    ...files.filter(file => DEFENSE_TOOLS.has(file)),
    ...ordinaryDocs,
    ...files.filter(file => file.startsWith('defense_legacy/')),
    '.gitignore',
    '.gitattributes'
  ]);
  const unselectedExecutable = files.filter(file => (
    !mapped.has(file)
    && /\.(?:js|mjs|cjs|json|ya?ml|html|css)$/.test(file)
  ));
  if (unselectedExecutable.length > 0) {
    plan.blocked.push(
      'No minimal verification mapping exists for: ' + unselectedExecutable.join(', ')
    );
  }

  plan.steps.sort((a, b) => a.id.localeCompare(b.id));
  plan.needsInstall = plan.steps.some(step => step.needsInstall);
  plan.browsers = [...new Set(plan.steps.flatMap(step => step.browsers))].sort();
  return plan;
}

function fullPlan(game) {
  if (!ALL_GAMES.includes(game)) throw new Error('Unknown game: ' + game);
  const plan = {
    files: [],
    detectedGames: [game],
    steps: [],
    skipped: [],
    warnings: ['Full verification was explicitly requested for ' + game + '.'],
    blocked: []
  };
  if (game === 'card') {
    for (const script of ['lint:card', 'test:card:smoke', 'test:card:browser', 'verify:card']) {
      addStep(
        plan,
        makeStep('full:card:' + script, 'card', 'Run full Card check: ' + script, 'npm', ['run', script], {
          needsInstall: true,
          browsers: script.includes('browser') || script === 'verify:card' ? ['chromium'] : []
        })
      );
    }
  } else if (game === 'shooter') {
    addStep(
      plan,
      makeStep(
        'full:shooter',
        'shooter',
        'Run the explicit full Shooter suite',
        'npm',
        ['run', 'verify:shooter'],
        { needsInstall: true, browsers: ['chromium'] }
      )
    );
  } else if (game === 'survivor' || game === 'defense_test') {
    throw new Error('Use the mapped standalone-game checks; a full-suite alias is not defined.');
  } else if (game === 'idle') {
    addStep(plan, makeStep('full:idle', 'idle', 'Explicit full Idle validation', 'npm', ['run', 'verify', '--prefix', 'idle'], { needsInstall: true, browsers: ['chromium'] }));
  } else {
    const scripts = [
      'lint:defense',
      'test:defense',
      'test:defense:local',
      'test:defense:browser',
      'test:defense:experience',
      'test:defense:resilience'
    ];
    for (const script of scripts) {
      addStep(
        plan,
        makeStep('full:defense:' + script, 'defense', 'Run full Defense check: ' + script, 'npm', ['run', script], {
          needsInstall: true,
          browsers: script.includes('browser') || script.includes('experience') || script.includes('resilience')
            ? ['chromium', 'webkit']
            : []
        })
      );
    }
  }
  plan.needsInstall = true;
  plan.browsers = [...new Set(plan.steps.flatMap(step => step.browsers))].sort();
  return plan;
}

module.exports = {
  ACTIVE_ROOT_GAMES,
  ALL_GAMES,
  changePaths,
  currentChangePaths,
  createPlan,
  fullPlan,
  isDocumentation,
  isVerificationPath,
  normalizePath
};
