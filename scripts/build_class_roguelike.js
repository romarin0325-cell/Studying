'use strict';

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const GAME_DIR = path.join(ROOT_DIR, 'class_roguelike');
const PATHS = Object.freeze({
  template: path.join(GAME_DIR, 'src', 'template.html'),
  styles: path.join(GAME_DIR, 'src', 'styles.css'),
  data: path.join(GAME_DIR, 'src', 'data.js'),
  game: path.join(GAME_DIR, 'src', 'game.js'),
  lumiImage: path.join(GAME_DIR, 'assets', '루미.png'),
  demonImage: path.join(GAME_DIR, 'assets', '마왕.png'),
  output: path.join(GAME_DIR, 'index.html')
});

const TOKENS = Object.freeze({
  styles: '/*__STYLES__*/',
  data: '/*__DATA__*/',
  game: '/*__GAME__*/',
  lumiImage: '__LUMI_DATA_URI__',
  demonImage: '__DEMON_DATA_URI__'
});

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function normalizeNewlines(text) {
  return text.replace(/\r\n?/g, '\n');
}

function readText(filePath) {
  try {
    return normalizeNewlines(fs.readFileSync(filePath, 'utf8')).trimEnd();
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new Error(`Missing class roguelike build input: ${path.relative(ROOT_DIR, filePath)}`);
    }
    throw error;
  }
}

function readPngDataUri(filePath) {
  let image;
  try {
    image = fs.readFileSync(filePath);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new Error(`Missing class roguelike image: ${path.relative(ROOT_DIR, filePath)}`);
    }
    throw error;
  }

  if (image.length <= PNG_SIGNATURE.length || !image.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error(`Expected a valid PNG image: ${path.relative(ROOT_DIR, filePath)}`);
  }

  return `data:image/png;base64,${image.toString('base64')}`;
}

function replaceExactlyOnce(source, token, replacement, label) {
  const first = source.indexOf(token);
  const last = source.lastIndexOf(token);

  if (first === -1) {
    throw new Error(`Build template is missing the ${label} placeholder (${token}).`);
  }
  if (first !== last) {
    throw new Error(`Build template contains the ${label} placeholder more than once (${token}).`);
  }

  return `${source.slice(0, first)}${replacement}${source.slice(first + token.length)}`;
}

function escapeInlineScript(source) {
  return source.replace(/<\/script/gi, '<\\/script');
}

function buildOutput() {
  let output = readText(PATHS.template);
  const styles = readText(PATHS.styles);
  const data = escapeInlineScript(readText(PATHS.data));
  const game = escapeInlineScript(readText(PATHS.game));

  if (/<\/style/i.test(styles)) {
    throw new Error('class_roguelike/src/styles.css must not contain a closing </style tag.');
  }

  output = replaceExactlyOnce(output, TOKENS.styles, styles, 'styles');
  output = replaceExactlyOnce(output, TOKENS.data, data, 'data');
  output = replaceExactlyOnce(output, TOKENS.game, game, 'game');
  output = replaceExactlyOnce(
    output,
    TOKENS.lumiImage,
    readPngDataUri(PATHS.lumiImage),
    'Lumi image'
  );
  output = replaceExactlyOnce(
    output,
    TOKENS.demonImage,
    readPngDataUri(PATHS.demonImage),
    'demon image'
  );

  for (const token of Object.values(TOKENS)) {
    if (output.includes(token)) {
      throw new Error(`Generated HTML still contains an unresolved placeholder: ${token}`);
    }
  }

  return `${normalizeNewlines(output).trimEnd()}\n`;
}

function describeFirstDifference(actual, expected) {
  const length = Math.min(actual.length, expected.length);
  let offset = 0;
  while (offset < length && actual[offset] === expected[offset]) {
    offset += 1;
  }

  const prefix = expected.slice(0, offset);
  const line = prefix.split('\n').length;
  const lastNewline = prefix.lastIndexOf('\n');
  const column = offset - lastNewline;

  if (offset === length && actual.length !== expected.length) {
    return `first differs at end of shared content (line ${line}, column ${column})`;
  }
  return `first differs at line ${line}, column ${column}`;
}

function checkOutput(expected) {
  if (!fs.existsSync(PATHS.output)) {
    throw new Error(
      `Generated game is missing: ${path.relative(ROOT_DIR, PATHS.output)}. ` +
      'Run node scripts/build_class_roguelike.js.'
    );
  }

  const actual = normalizeNewlines(fs.readFileSync(PATHS.output, 'utf8'));
  if (actual !== expected) {
    throw new Error(
      `Generated game is stale (${describeFirstDifference(actual, expected)}). ` +
      'Run node scripts/build_class_roguelike.js.'
    );
  }
}

function writeOutput(expected) {
  fs.mkdirSync(path.dirname(PATHS.output), { recursive: true });

  if (fs.existsSync(PATHS.output)) {
    const actual = normalizeNewlines(fs.readFileSync(PATHS.output, 'utf8'));
    if (actual === expected) {
      return false;
    }
  }

  fs.writeFileSync(PATHS.output, expected, 'utf8');
  return true;
}

function runCli(args) {
  const unknownArgs = args.filter(arg => arg !== '--check');
  const checkCount = args.filter(arg => arg === '--check').length;
  if (unknownArgs.length || checkCount > 1) {
    throw new Error('Usage: node scripts/build_class_roguelike.js [--check]');
  }

  const expected = buildOutput();
  if (checkCount === 1) {
    checkOutput(expected);
    console.log('Class roguelike build is up to date.');
    return;
  }

  const changed = writeOutput(expected);
  console.log(changed ? 'Built class_roguelike/index.html.' : 'Class roguelike build is already up to date.');
}

if (require.main === module) {
  try {
    runCli(process.argv.slice(2));
  } catch (error) {
    console.error(error && error.message ? error.message : error);
    process.exit(1);
  }
}

module.exports = {
  ROOT_DIR,
  PATHS,
  TOKENS,
  buildOutput,
  checkOutput,
  runCli
};
