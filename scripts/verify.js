'use strict';

const { execFileSync, execSync, spawnSync } = require('child_process');

const TARGET_STEPS = {
  card: ['lint:card', 'test:card:smoke', 'test:card:browser'],
  idle: ['test:idle:smoke'],
  'defense-v2': [
    'lint:defense-hero-v2',
    'test:defense-hero-v2',
    'test:defense-hero-v2:local',
    'test:defense-hero-v2:browser'
  ]
};

function gitLines(args) {
  try {
    return execSync(`git ${args}`, { encoding: 'utf8' })
      .split(/\r?\n/)
      .map(line => line.trim().replace(/\\/g, '/'))
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

function refExists(ref) {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`], {
      stdio: ['ignore', 'pipe', 'ignore']
    });
    return true;
  } catch (error) {
    return false;
  }
}

function upstreamBase() {
  for (const candidate of ['origin/main', 'origin/master', 'main', 'master']) {
    if (refExists(candidate)) return candidate;
  }
  return '';
}

function changedFiles() {
  const base = upstreamBase();
  return new Set([
    ...gitLines('diff --name-only'),
    ...gitLines('diff --name-only --cached'),
    ...gitLines('ls-files --others --exclude-standard'),
    ...(base ? gitLines(`diff --name-only ${base}...HEAD`) : [])
  ]);
}

function selectTargets(files) {
  const targets = new Set();
  for (const file of files) {
    if (
      file.startsWith('card/')
      || file.startsWith('card_remaster/')
      || file.startsWith('card_manual/')
      || file.startsWith('scripts/verify_card_')
      || file === 'scripts/verify_gemini_api_models.js'
    ) {
      targets.add('card');
      continue;
    }
    if (file.startsWith('idle_hero/') || file === 'scripts/verify_idle_hero_smoke.js') {
      targets.add('idle');
      continue;
    }
    if (
      file.startsWith('defense_hero_v2/')
      || file.includes('hero_defense_v2')
    ) {
      targets.add('defense-v2');
    }
  }
  return ['card', 'idle', 'defense-v2'].filter(target => targets.has(target));
}

function runNpm(script) {
  const result = spawnSync('npm', ['run', script], {
    stdio: 'inherit',
    shell: true
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function run() {
  const files = changedFiles();
  const targets = selectTargets(files);
  if (targets.length === 0) {
    console.log('No active game changes detected. Defense Hero V1 is unused and skipped.');
    return;
  }

  console.log(`Verifying changed games: ${targets.join(', ')}`);
  for (const target of targets) {
    for (const script of TARGET_STEPS[target]) {
      runNpm(script);
    }
  }
  console.log(`Verify passed for: ${targets.join(', ')}`);
}

run();
