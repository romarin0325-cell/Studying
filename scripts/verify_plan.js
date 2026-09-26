'use strict';

const path = require('path');

const ACTIVE_ROOT_GAMES = Object.freeze(['card', 'shooter']);
const ALL_GAMES = Object.freeze(['card', 'shooter', 'defense']);

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

function isDocumentation(file) {
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

function planShooter(plan, files) {
  const shooterFiles = files.filter(file => file.startsWith('shooter/'));
  const productFiles = shooterFiles.filter(file => !isDocumentation(file));
  const directUnitTests = productFiles.filter(file => /^shooter\/tests\/.+\.test\.mjs$/.test(file));
  const selectedUnitTests = new Set(directUnitTests);
  const directFlowTests = productFiles.filter(file => (
    /^shooter\/tests\/.+\.mjs$/.test(file) && !file.endsWith('.test.mjs')
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
  for (const file of sourceFiles.filter(file => /\.(?:js|mjs|cjs)$/.test(file))) {
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
  for (const file of sourceFiles) {
    if (file.includes('/persistence/')) tests.add('defense/tests/unit/persistence.test.mjs');
    if (file.includes('/render/')) tests.add('defense/tests/unit/effects-renderer.test.mjs');
    if (file.includes('/content/')) tests.add('defense/tests/integration/content-architecture.test.mjs');
    if (file.includes('/battle/')) tests.add('defense/tests/unit/combat-rules.test.mjs');
    if (file.includes('AttackTimeline')) tests.add('defense/tests/unit/attack-timeline.test.mjs');
    if (file.includes('AuraSystem')) tests.add('defense/tests/unit/aura-status.test.mjs');
    if (file.includes('BossAbility')) tests.add('defense/tests/unit/boss-abilities.test.mjs');
    if (file.includes('Direction')) tests.add('defense/tests/unit/direction-viewport.test.mjs');
  }
  return [...tests];
}

function planDefense(plan, files) {
  const defenseFiles = files.filter(file => file.startsWith('defense/'));
  const productFiles = defenseFiles.filter(file => !isDocumentation(file));
  const directTests = productFiles.filter(file => /^defense\/tests\/.+\.test\.mjs$/.test(file));
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
  for (const file of sourceFiles.filter(file => /\.(?:js|mjs|cjs)$/.test(file))) {
    addNodeCheck(plan, 'defense', file);
  }

  addNodeTest(
    plan,
    'defense',
    'defense:nearby-regressions',
    'Run the closest Defense regression tests',
    defenseUnitTestsFor(sourceFiles)
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
        { needsInstall: true }
      )
    );
  }

  if (sourceFiles.some(file => (
    file === 'defense/index.html'
    || file.startsWith('defense/css/')
    || file.startsWith('defense/js/app/')
    || file.startsWith('defense/js/render/')
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

function createPlan(changes, options = {}) {
  const files = changePaths(changes);
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
  if (shouldPlan('shooter')) planShooter(plan, files);
  if (shouldPlan('defense')) planDefense(plan, files);

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
    ...ordinaryDocs,
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
  createPlan,
  fullPlan,
  isDocumentation,
  isVerificationPath,
  normalizePath
};
