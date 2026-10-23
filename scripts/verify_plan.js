'use strict';

const path = require('path');

const ACTIVE_ROOT_GAMES = Object.freeze(['card', 'shooter', 'survivor', 'defense']);
const ALL_GAMES = Object.freeze(['card', 'shooter', 'defense', 'survivor']);

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
  if (file === 'defense/docs/ASSET_OPTIMIZATION.json') return false;
  if (file === 'survivor/assets/Jua-OFL.txt' || file === 'defense/assets/Jua-OFL.txt') return false;
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
    file === 'package.json'
    || file === 'package-lock.json'
    || file === 'scripts/verify.js'
    || file === 'scripts/verify_plan.js'
    || file === 'scripts/verify_plan.test.js'
    || /^\.github\/workflows\/(?:verify|defense)\.yml$/.test(file)
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
  }
}

function planCardAstra(plan, files, currentFiles) {
  const product = currentFiles.filter(file => file.startsWith('card_astra/') && !isDocumentation(file));
  const inputs = product.filter(file => /^(?:card_astra\/(?:src|assets)\/|card_astra\/(?:build\.mjs|package\.json)$)/.test(file));
  for (const file of product.filter(file => /\.(?:js|mjs)$/.test(file))) addNodeCheck(plan, 'card', file);
  if (inputs.length) {
    addStep(plan, makeStep('card:astra:build', 'card', 'Build the standalone Astra presentation', 'node', ['card_astra/build.mjs']));
  }
  if (inputs.length || product.some(file => file.startsWith('card_astra/tests/'))) {
    addBrowserScript(plan, 'card', 'card:astra:smoke', 'Check Astra navigation, card paging, formation and combat', 'card_astra/tests/smoke.mjs');
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
    selectedUnitTests.add('shooter/tests/patch-economy.test.mjs');
  }
  if (sourceFiles.some(file => file === 'shooter/engine.js' || file === 'shooter/content.js')) {
    selectedUnitTests.add('shooter/tests/patch-combat.test.mjs');
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
  }
}

function planSurvivor(plan, files, currentFiles) {
  const product = files.filter(file => file.startsWith('survivor/') && !isDocumentation(file));
  if (!product.length) return;
  const inputs = product.filter(file => /^survivor\/(?:src\/|assets\/|scripts\/(?:(?:build|prepare-assets|pack-jasmine|art-normalization)\.mjs|prepare-font\.py)$|index\.html$|package\.json$)/.test(file));
  const current = new Set(currentFiles);
  const direct = product.filter(file => current.has(file) && /^survivor\/tests\/.*\.test\.mjs$/.test(file));
  const checks = new Set(direct);

  if (inputs.some(file => /survivor\/src\/(?:engine|combat|weapons)\.js/.test(file))) checks.add('survivor/tests/engine.test.mjs');
  if (inputs.some(file => /survivor\/src\/(?:profile|save|storage)\.js/.test(file))) checks.add('survivor/tests/profile.test.mjs');

  addNodeTest(plan, 'survivor', 'survivor:contracts-and-regressions', 'Check Nocturne combat and persistence contracts', [...checks]);
  if (checks.has('survivor/tests/assets.test.mjs')) {
    const step = plan.steps.find(s => s.id === 'survivor:contracts-and-regressions');
    if (step) step.needsInstall = true;
  }

  // Standalone scripts outside build
  const standaloneScripts = product.filter(file => current.has(file) && file.startsWith('survivor/scripts/') && !inputs.includes(file) && /\.(?:js|mjs|cjs)$/.test(file));
  for (const file of standaloneScripts) addNodeCheck(plan, 'survivor', file);

  if (inputs.length) {
    addStep(plan, makeStep('survivor:build', 'survivor', 'Build the changed offline Nocturne inputs once', 'node', ['survivor/scripts/build.mjs'], { needsInstall: true }));
  }
  if (product.some(file => file === 'survivor/tests/browser.mjs')) {
    addBrowserScript(plan, 'survivor', 'survivor:offline-browser', 'Play the committed standalone HTML offline at mobile and desktop sizes', 'survivor/tests/browser.mjs');
  }
  if (product.some(file => file === 'survivor/tests/browser-webkit.mjs')) {
    addBrowserScript(plan, 'survivor', 'survivor:offline-webkit', 'Check Nocturne file playback, resume and backup import in WebKit', 'survivor/tests/browser-webkit.mjs', ['webkit']);
  }
}

function planDefense(plan, files, currentFiles) {
  const product = files.filter(file => file.startsWith('defense/') && !isDocumentation(file));
  if (!product.length) return;
  const inputs = product.filter(file => /^defense\/(?:src\/|assets\/|index\.html$|package\.json$|docs\/ASSET_OPTIMIZATION\.json$|scripts\/(?:build|local-inputs|image-pack|image-policy|theme-bright)\.mjs$)/.test(file));
  const current = new Set(currentFiles);
  const direct = product.filter(file => current.has(file) && /^defense\/tests\/.*\.test\.mjs$/.test(file));
  const reportScripts = product.some(file => /^defense\/scripts\/(?:analyze|report-data|generated-reports)\.mjs$/.test(file));

  // Standalone scripts outside build
  const standaloneScripts = product.filter(file => current.has(file) && file.startsWith('defense/scripts/') && !inputs.includes(file) && /\.(?:js|mjs|cjs)$/.test(file));
  for (const file of standaloneScripts) addNodeCheck(plan, 'defense', file);

  const checks = new Set(direct);
  const add = name => checks.add('defense/tests/' + name + '.test.mjs');

  if (inputs.some(file => /^defense\/(?:docs\/ASSET_OPTIMIZATION\.json$|scripts\/(?:build|image-pack|image-policy|local-inputs)\.mjs$|assets\/optimized\/ui\/)/.test(file))) add('build');
  if (inputs.some(file => file.endsWith('/economy.js'))) add('economy');
  if (inputs.some(file => /(?:src\/battle\.js|src\/combat\/engine\.js)$/.test(file))) add('combat');
  if (inputs.includes('defense/src/profile.js')) add('profile');
  if (inputs.includes('defense/src/monthly.js')) add('monthly');
  if (inputs.includes('defense/src/runtime.js')) add('runtime');
  if (reportScripts) add('generated-reports');
  // The packer guard test imports only output-guard.mjs (no sharp), so it needs no install.
  if (product.some(file => /^defense\/scripts\/art\/(?:output-guard|pack_defense_directions|pack-sd)\.mjs$/.test(file))) add('packer-guard');

  addNodeTest(plan, 'defense', 'defense:contracts-and-regressions', 'Check Star Garden collection, growth, tickets and actual combat regressions', [...checks]);
  if (checks.has('defense/tests/generated-reports.test.mjs') || checks.has('defense/tests/assets.test.mjs') || checks.has('defense/tests/build.test.mjs')) {
    const step = plan.steps.find(s => s.id === 'defense:contracts-and-regressions');
    if (step) step.needsInstall = true;
  }

  if (inputs.length) {
    addStep(plan, makeStep('defense:build', 'defense', 'Build Star Garden from its deployment inputs once', 'node', ['defense/scripts/build.mjs'], { needsInstall: true }));
  }
  if (product.includes('defense/tests/browser.mjs')) {
    addBrowserScript(plan, 'defense', 'defense:offline-browser', 'Exercise the standalone portrait UI, draft and resume offline', 'defense/tests/browser.mjs');
  }
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
  if (shouldPlan('card')) {
    planCard(plan, files);
    planCardAstra(plan, files, currentFiles);
  }
  if (shouldPlan('shooter')) planShooter(plan, files, currentFiles);
  if (shouldPlan('defense')) planDefense(plan, files, currentFiles);
  if (shouldPlan('survivor')) planSurvivor(plan, files, currentFiles);

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
    ...files.filter(file => file.startsWith('card_astra/')),
    ...files.filter(file => file.startsWith('card_deepseek/') && !currentFiles.includes(file)),
    ...files.filter(file => file.startsWith('scripts/verify_card_')),
    ...files.filter(file => file === 'scripts/verify_gemini_api_models.js'),
    ...ordinaryDocs,
    ...files.filter(file => file.startsWith('rpg/')),
    '.gitignore',
    '.gitattributes'
  ]);
  const unselectedExecutable = files.filter(file => (
    !mapped.has(file)
    && /\.(?:js|mjs|cjs|json|ya?ml|html|css)$/.test(file)
  ));
  if (unselectedExecutable.length > 0) {
    plan.warnings.push(
      'No automated test mapped for: ' + unselectedExecutable.join(', ')
    );
    for (const file of unselectedExecutable.filter(f => currentFiles.includes(f) && /\.(?:js|mjs|cjs)$/.test(f))) {
      addNodeCheck(plan, 'standalone', file);
    }
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
  } else if (game === 'survivor' || game === 'defense') {
    throw new Error('Use the mapped standalone-game checks; a full-suite alias is not defined.');
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
