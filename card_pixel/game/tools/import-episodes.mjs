import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { create as createRoster } from '../src/engine/roster.js';
import { coreBundle } from './core-bundle.mjs';

const NUMBERED = /^(\d+)\. (.+?)(?: \([^()]+\))?$/;
const BRACKETED = /^\[(.+?) \([^()]+\)\]$/;
const TITLE = /^\[(\d+)-\d+\] (.+)$/;
const DIVIDER = /^=+$/;
const NOTES = { 외모: 'appearance', 외형: 'appearance', '보이스 톤': 'voice', '말투/성격': 'voice' };
const output = new URL('../src/content/episodes.js', import.meta.url);

function rosterNames() {
  const window = {};
  vm.runInNewContext(coreBundle(), { window });
  const sprites = JSON.parse(fs.readFileSync(new URL('../assets/sprites.json', import.meta.url), 'utf8'));
  const sp = Object.fromEntries(Object.entries(sprites).map(([name, sprite]) => [name.replace(/\.png$/, ''), sprite]));
  const roster = createRoster(window.RelayCore, { sp });
  const names = new Map();
  for (const id of roster.allies) {
    const { name } = roster.card(id);
    names.set(name, [...(names.get(name) ?? []), id]);
  }
  return { names, allies: new Set(roster.allies) };
}

export function parseEpisodes(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map(line => line.trimEnd());
  const blocks = [];
  let block;
  let body = [];

  function finish() {
    if (!block) return;
    while (body.at(-1) === '') body.pop();
    const start = body.findIndex(line => line !== '');
    if (!block.title || start < 0) throw new Error(`Missing episode for ${block.name}`);
    blocks.push({ ...block, body: body.slice(start).join('\n').split('\n\n'),
      source: `${block.line}-${block.titleLine + body.length}` });
    body = [];
    block = undefined;
  }

  for (const [index, line] of lines.entries()) {
    const numbered = NUMBERED.exec(line);
    const bracketed = BRACKETED.exec(line);
    if (numbered || bracketed) {
      finish();
      block = { name: numbered?.[2] ?? bracketed[1], number: numbered?.[1], line: index + 1, appearance: '', voice: '' };
      continue;
    }
    if (DIVIDER.test(line)) {
      if (block?.title) finish();
      continue;
    }
    const title = TITLE.exec(line);
    if (title) {
      if (!block || block.title || (block.number && block.number !== title[1])) throw new Error(`Unexpected title at line ${index + 1}`);
      block.title = title[2];
      block.titleLine = index + 1;
    } else if (block?.title) {
      body.push(line);
    } else if (line) {
      const note = /^(외모|외형|보이스 톤|말투\/성격): (.+)$/.exec(line);
      if (!block || !note) throw new Error(`Unexpected content at line ${index + 1}`);
      const field = NOTES[note[1]];
      if (block[field]) throw new Error(`Duplicate ${note[1]} at line ${index + 1}`);
      block[field] = note[2];
    }
  }
  finish();
  return blocks;
}

export function importEpisodes(text) {
  const { names, allies } = rosterNames();
  const episodes = {};
  for (const { name, title, appearance, voice, body, source } of parseEpisodes(text)) {
    const matches = names.get(name) ?? [];
    const id = matches.length === 1 ? matches[0] : null;
    if (!allies.has(id)) throw new Error(`No unique companion ID for ${name} (lines ${source})`);
    if (Object.hasOwn(episodes, id)) throw new Error(`Duplicate episode for ${id} (lines ${source})`);
    episodes[id] = { title, appearance, voice, body, source };
  }
  if (!Object.keys(episodes).length) throw new Error('No episodes found');
  return episodes;
}

export function episodeModule(episodes) {
  return '// Generated from 시나리오.txt. Edit the source text, then regenerate:\n' +
    '// node card_pixel/game/tools/import-episodes.mjs "<path to 시나리오.txt>"\n' +
    `export const EPISODES = ${JSON.stringify(episodes, null, 2)};\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = process.argv[2];
  if (!input) throw new Error('Usage: node card_pixel/game/tools/import-episodes.mjs "<path to 시나리오.txt>"');
  if (path.resolve(input) === fileURLToPath(output)) throw new Error('The input must be the original scenario text');
  const episodes = importEpisodes(fs.readFileSync(input, 'utf8'));
  fs.writeFileSync(output, episodeModule(episodes));
  console.log(`Wrote ${Object.keys(episodes).length} episodes to src/content/episodes.js`);
}
