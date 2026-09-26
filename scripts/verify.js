'use strict';

const fs = require('fs');
const { spawnSync } = require('child_process');
const {
  ALL_GAMES,
  createPlan,
  fullPlan,
  normalizePath
} = require('./verify_plan.js');

class ScopeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ScopeError';
    this.code = 'BLOCKED_SCOPE';
  }
}

function git(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: options.cwd || process.cwd(),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.status !== 0) {
    if (options.allowFailure) return null;
    const detail = String(result.stderr || result.stdout || '').trim();
    throw new ScopeError(
      'git ' + args.join(' ') + ' failed' + (detail ? ': ' + detail : '.')
    );
  }
  return result.stdout;
}

function commitFor(ref, cwd) {
  if (!ref || /^0+$/.test(ref)) return '';
  const output = git(
    ['rev-parse', '--verify', '--end-of-options', ref + '^{commit}'],
    { cwd, allowFailure: true }
  );
  return output ? output.trim() : '';
}

function localBase(cwd) {
  for (const candidate of ['origin/main', 'origin/master', 'main', 'master']) {
    if (commitFor(candidate, cwd)) return candidate;
  }
  throw new ScopeError('No trusted base ref exists (tried origin/main, origin/master, main, master).');
}

function parseNameStatusZ(raw) {
  const tokens = String(raw || '').split('\0');
  const changes = [];
  let index = 0;
  while (index < tokens.length) {
    const status = tokens[index++];
    if (!status) continue;
    if (/^[RC]/.test(status)) {
      const oldPath = normalizePath(tokens[index++]);
      const newPath = normalizePath(tokens[index++]);
      if (!oldPath || !newPath) {
        throw new ScopeError('Malformed rename/copy record in git diff output.');
      }
      changes.push({ status, paths: [oldPath, newPath] });
    } else {
      const file = normalizePath(tokens[index++]);
      if (!file) throw new ScopeError('Malformed path record in git diff output.');
      changes.push({ status, paths: [file] });
    }
  }
  return changes;
}

function parseUntrackedZ(raw) {
  return String(raw || '')
    .split('\0')
    .map(normalizePath)
    .filter(Boolean)
    .map(file => ({ status: '?', paths: [file] }));
}

function dedupeChanges(changes) {
  const seen = new Set();
  const result = [];
  for (const change of changes) {
    const key = change.status + '\0' + change.paths.join('\0');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(change);
  }
  return result;
}

function resolveChanges(options = {}) {
  const cwd = options.cwd || process.cwd();
  const explicitBase = options.baseRef || '';
  const explicitHead = options.headRef || '';
  const baseRef = explicitBase && !/^0+$/.test(explicitBase) ? explicitBase : localBase(cwd);
  const headRef = explicitHead && !/^0+$/.test(explicitHead) ? explicitHead : 'HEAD';
  const baseSha = commitFor(baseRef, cwd);
  const headSha = commitFor(headRef, cwd);
  if (!baseSha) throw new ScopeError('Base ref is unavailable: ' + baseRef);
  if (!headSha) throw new ScopeError('Head ref is unavailable: ' + headRef);

  const mergeBase = git(['merge-base', baseSha, headSha], { cwd }).trim();
  if (!mergeBase) {
    throw new ScopeError('No merge base exists for ' + baseSha + ' and ' + headSha + '.');
  }

  const committed = parseNameStatusZ(
    git(['diff', '--name-status', '-z', '--find-renames', mergeBase, headSha, '--'], { cwd })
  );
  const includeWorktree = options.includeWorktree !== false;
  const worktree = includeWorktree
    ? [
        ...parseNameStatusZ(git(['diff', '--name-status', '-z', '--find-renames', '--'], { cwd })),
        ...parseNameStatusZ(git(['diff', '--cached', '--name-status', '-z', '--find-renames', '--'], { cwd })),
        ...parseUntrackedZ(git(['ls-files', '--others', '--exclude-standard', '-z'], { cwd }))
      ]
    : [];

  return {
    baseRef,
    baseSha,
    headRef,
    headSha,
    mergeBase,
    checkoutSha: commitFor('HEAD', cwd),
    includeWorktree,
    changes: dedupeChanges([...committed, ...worktree])
  };
}

function parseArgs(argv) {
  const options = {
    planOnly: false,
    full: false,
    onlyGame: null,
    githubOutput: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--plan') {
      options.planOnly = true;
    } else if (arg === '--full') {
      options.full = true;
    } else if (arg === '--only' || arg === '--game') {
      options.onlyGame = argv[++index] || '';
    } else if (arg === '--github-output') {
      options.githubOutput = argv[++index] || '';
    } else {
      throw new Error('Unknown argument: ' + arg);
    }
  }
  if (options.onlyGame && !ALL_GAMES.includes(options.onlyGame)) {
    throw new Error('Unknown game: ' + options.onlyGame);
  }
  if (options.full && !options.onlyGame) {
    throw new Error('--full requires --game <card|shooter|defense>.');
  }
  return options;
}

function commandText(step) {
  return [step.command, ...step.args].map(value => (
    /\s/.test(value) ? JSON.stringify(value) : value
  )).join(' ');
}

function printPlan(plan, scope) {
  if (scope) {
    console.log('Basis: merge-base ' + scope.mergeBase + ' -> PR/local head ' + scope.headSha);
    console.log('Execution checkout: ' + scope.checkoutSha);
    console.log('Working tree included: ' + (scope.includeWorktree ? 'yes' : 'no'));
  }
  console.log('Changed paths: ' + (plan.files.length ? plan.files.join(', ') : '(none)'));
  for (const step of plan.steps) {
    console.log('PLAN ' + step.id + ': ' + step.description);
    console.log('  ' + commandText(step));
  }
  for (const skipped of plan.skipped) console.log('SKIP: ' + skipped);
  for (const warning of plan.warnings) console.log('UNVERIFIED: ' + warning);
  for (const blocked of plan.blocked) console.error('BLOCKED_SELECTION: ' + blocked);
  if (plan.steps.length === 0 && plan.blocked.length === 0) {
    console.log('PLAN: no runtime command is relevant to this diff.');
  }
}

function appendGitHubOutput(file, plan) {
  if (!file) return;
  const selectedGames = new Set(plan.steps.map(step => step.game));
  const lines = [
    'has_commands=' + String(plan.steps.length > 0),
    'needs_install=' + String(plan.needsInstall),
    'needs_chromium=' + String(plan.browsers.includes('chromium')),
    'needs_webkit=' + String(plan.browsers.includes('webkit')),
    'card=' + String(selectedGames.has('card')),
    'shooter=' + String(selectedGames.has('shooter')),
    'defense=' + String(selectedGames.has('defense'))
  ];
  fs.appendFileSync(file, lines.join('\n') + '\n', 'utf8');
}

function runStep(step) {
  const started = Date.now();
  console.log('RUN ' + step.id + ': ' + commandText(step));
  const result = spawnSync(step.command, step.args, {
    stdio: 'inherit',
    shell: process.platform === 'win32' && step.command === 'npm'
  });
  const seconds = ((Date.now() - started) / 1000).toFixed(2);
  if (result.error) {
    console.error('FAIL ' + step.id + ' (' + seconds + 's): ' + result.error.message);
    return 1;
  }
  if (result.status !== 0) {
    console.error('FAIL ' + step.id + ' (' + seconds + 's)');
    return result.status || 1;
  }
  console.log('PASS ' + step.id + ' (' + seconds + 's)');
  return 0;
}

function execute(plan) {
  if (plan.blocked.length > 0) return 3;
  const started = Date.now();
  for (const step of plan.steps) {
    const status = runStep(step);
    if (status !== 0) return status;
  }
  const seconds = ((Date.now() - started) / 1000).toFixed(2);
  console.log('PASS: selected minimal verification completed in ' + seconds + 's.');
  return 0;
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    let plan;
    let scope = null;
    if (options.full) {
      plan = fullPlan(options.onlyGame);
    } else {
      const ciBase = process.env.VERIFY_BASE_SHA || '';
      const ciHead = process.env.VERIFY_HEAD_SHA || '';
      scope = resolveChanges({
        baseRef: ciBase,
        headRef: ciHead,
        includeWorktree: !(ciBase && ciHead)
      });
      plan = createPlan(scope.changes, { onlyGame: options.onlyGame });
    }

    printPlan(plan, scope);
    appendGitHubOutput(options.githubOutput, plan);
    if (plan.blocked.length > 0) process.exit(3);
    if (options.planOnly) return;
    process.exit(execute(plan));
  } catch (error) {
    if (error && error.code === 'BLOCKED_SCOPE') {
      console.error('BLOCKED_SCOPE: ' + error.message);
      process.exit(2);
    }
    console.error('BLOCKED: ' + (error && error.message ? error.message : String(error)));
    process.exit(2);
  }
}

if (require.main === module) main();

module.exports = {
  ScopeError,
  commitFor,
  dedupeChanges,
  parseNameStatusZ,
  parseUntrackedZ,
  resolveChanges
};
