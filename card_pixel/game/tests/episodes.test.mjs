import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { EPISODES } from '../src/content/episodes.js';
import { GREETING_LINE, episodeGreeting } from '../src/content/episode-greetings.js';
import { episodePages, episodeState } from '../src/engine/episodes.js';
import { createSaveStore, restoreProfile, serializeProfile } from '../src/engine/save.js';
import { createProfile } from '../src/engine/meta.js';
import { saveEpisodeFlags } from '../src/ui/screens/collection.js';
import { backupSlots, SESSION_KEY } from '../src/ui/storage.js';
import { episodeModule, importEpisodes, parseEpisodes } from '../tools/import-episodes.mjs';
import { createCoreRoster } from './support/core.mjs';

const pairs = [
  ['가디언', 'guardian', 10], ['눈토끼', 'snow_rabbit', 32], ['둠', 'doom_luther', 58],
  ['레드드래곤', 'red_dragon', 70], ['루나', 'luna', 85], ['루미', 'rumi', 104],
  ['머쉬룸킹', 'mushroom_king', 124], ['명탐정', 'great_detective', 141], ['밤토끼', 'night_rabbit', 157],
  ['번개의현자', 'lightning_sage', 173], ['별똥별소년', 'shooting_star_boy', 188], ['산타', 'santa', 209],
  ['세이렌', 'siren', 228], ['시간의마술사', 'time_magician', 252], ['시간의지배자', 'time_ruler', 266],
  ['신데렐라', 'cinderella', 285], ['아발란체메이드', 'avalanche_maid', 299], ['에인션트드래곤', 'ancient_dragon', 314],
  ['에인션트소울', 'ancient_soul', 329], ['여왕', 'queen', 348], ['은토끼', 'silver_rabbit', 361],
  ['은하고래', 'galaxy_whale', 370], ['자스민', 'jasmine', 381], ['지크', 'zeke', 395],
  ['체리프린스', 'cherry_prince', 410], ['팬텀', 'phantom', 427], ['폭풍의현자', 'storm_sage', 446],
  ['하모니어스', 'harmonius', 463], ['화염의현자', 'flame_sage', 478], ['혹한의마녀', 'frozen_witch', 494],
  ['퍼펙트아우로라', 'perfect_aurora', 506]
];
const source = process.env.RELAY_EPISODE_SOURCE ?? new URL('../../../../일러스트/시나리오.txt', import.meta.url);

test('31 episode IDs are the roster IDs and all greetings are full source quotations', () => {
  const { roster } = createCoreRoster();
  assert.deepEqual(Object.keys(EPISODES), pairs.map(([, id]) => id));
  for (const [name, id] of pairs) {
    assert.ok(roster.allies.includes(id), id);
    assert.equal(roster.card(id).name, name);
    const quotes = [...EPISODES[id].body.join('\n\n').matchAll(/"[^"]+"/g)].map(match => match[0]);
    // Every greeting is one of the episode's own quotations, verbatim; without an override it is the first one.
    assert.ok(quotes.includes(episodeGreeting(id)), id);
    if (!GREETING_LINE[id]) assert.equal(episodeGreeting(id), quotes[0], id);
  }
  assert.equal(episodeGreeting('ash'), '');
  assert.equal(Object.keys(GREETING_LINE).length, 12);
});

test('the generated module matches the owner file and preserves every source body and note', {
  skip: !process.env.RELAY_EPISODE_SOURCE && !fs.existsSync(source) && 'owner file unavailable (set RELAY_EPISODE_SOURCE)'
}, () => {
  const input = fs.readFileSync(source, 'utf8');
  const lines = input.replace(/^\uFEFF/, '').split(/\r?\n/).map(line => line.trimEnd());
  const imported = importEpisodes(input);
  assert.deepEqual(imported, EPISODES);
  const generated = fs.readFileSync(new URL('../src/content/episodes.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(episodeModule(imported), generated);
  for (const [name, id, quoteLine] of pairs) {
    const { title, appearance, voice, body, source: range } = EPISODES[id];
    const [first, last] = range.split('-').map(Number);
    const sourceLines = lines.slice(first - 1, last);
    assert.ok(sourceLines[0].includes(name), name);
    const titleAt = sourceLines.findIndex(line => /^\[\d+-\d+\] /.test(line));
    assert.equal(sourceLines[titleAt].replace(/^\[\d+-\d+\] /, ''), title);
    const firstBody = sourceLines.findIndex((line, index) => index > titleAt && line !== '');
    assert.equal(body.join('\n\n'), sourceLines.slice(firstBody).join('\n'), id);
    assert.equal(appearance, sourceLines.find(line => /^외[모형]: /.test(line))?.replace(/^외[모형]: /, '') ?? '');
    assert.equal(voice, sourceLines.find(line => /^(보이스 톤|말투\/성격): /.test(line))?.replace(/^[^:]+: /, '') ?? '');
    assert.ok(lines[quoteLine - 1].includes(episodeGreeting(id)), `${id} quote must match line ${quoteLine}`);
  }
});

test('the importer retains internal newlines, indentation, and blank paragraphs', () => {
  const [episode] = parseEpisodes([
    '[가디언 (Guardian)]', '', '외형: 원문 ', '말투/성격: 원문', '[01-1] 제목', '',
    '첫 줄  ', '  둘째 줄', '', '', '마지막 줄', ''
  ].join('\r\n'));
  assert.equal(episode.body.join('\n\n'), '첫 줄\n  둘째 줄\n\n\n마지막 줄');
  assert.equal(episode.source, '1-11');
});

const id = 'guardian';
const historyEntry = (runId, participation, fielded = true) => ({
  runId, dungeonId: 'dawn_forest', difficulty: 'normal', floor: 2, result: 'lose',
  fielded, participation, given: [], inherited: [], used: [], victories: []
});

test('an episode requires actual fielding in a settled run after recruitment', () => {
  const profile = createProfile();
  profile.records.appliedRuns = ['before', 'recruitment', 'standby', 'after'];
  profile.records.runs = profile.records.appliedRuns.length;
  profile.history[id] = [historyEntry('before', 'battle'), historyEntry('recruitment', 'gate')];
  assert.equal(episodeState(profile, 'ash'), 'none');
  assert.equal(episodeState(profile, id), 'locked');
  profile.recruits[id] = { since: 2, bond: 0 };
  assert.equal(episodeState(profile, id), 'locked');
  profile.history[id].push(historyEntry('standby', 'gate-standby', false), historyEntry('after', 'unrecorded'),
    historyEntry('after'), historyEntry('unsettled', 'battle'));
  assert.equal(episodeState(profile, id), 'locked');
  profile.history[id].push(historyEntry('after', 'battle'));
  assert.equal(episodeState(profile, id), 'new');
  profile.history[id].splice(3, 3); // Drop the intentionally unsupported records before saving.
  profile.ui.episodesRead = { [id]: true };
  assert.equal(episodeState(restoreProfile(serializeProfile(profile)), id), 'read');
  profile.history = {};
  assert.equal(episodeState(profile, id), 'read');
  delete profile.ui.episodesRead;
  profile.ui.episodesUnlocked = { [id]: true };
  assert.equal(episodeState(restoreProfile(serializeProfile(profile)), id), 'new');
});

test('older profiles can show locked and new states without episode fields', () => {
  assert.equal(episodeState({}, id), 'locked');
  const old = { recruits: { [id]: { since: 0, bond: 0 } } };
  assert.equal(episodeState(old, id), 'locked');
  old.records = { appliedRuns: ['after'] };
  old.history = { [id]: [historyEntry('after', 'boss')] };
  assert.equal(episodeState(old, id), 'new');
});

test('episode flags save in the active slot without replacing the expedition checkpoint', () => {
  const previousWindow = globalThis.window;
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
  try {
    globalThis.window = { localStorage: storage };
    const profile = createProfile();
    profile.recruits[id] = { since: 0, bond: 0 };
    const slots = backupSlots(storage);
    const store = createSaveStore(storage);
    store.save({ profile });
    const inactive = slots.read('a', SESSION_KEY);
    slots.activate('b');
    const session = JSON.parse(inactive);
    session.run = { version: 1, run: { phase: 'room', room: { status: 'order' } } };
    slots.write('b', SESSION_KEY, JSON.stringify(session));
    // The tab's own store, loaded after the slot switch above, writes the flags.
    const tab = createSaveStore(storage);
    tab.loadDetailed();
    assert.ok(saveEpisodeFlags(profile, 'episodesUnlocked', [id], tab.saveEpisodeFlags));
    assert.ok(saveEpisodeFlags(profile, 'episodesRead', [id], tab.saveEpisodeFlags));
    assert.equal(slots.read('a', SESSION_KEY), inactive);
    const updated = JSON.parse(slots.read('b', SESSION_KEY));
    assert.deepEqual(updated.run, session.run);
    assert.deepEqual(updated.profile.ui, { ...session.profile.ui, episodesUnlocked: { [id]: true }, episodesRead: { [id]: true } });
    assert.equal(episodeState(restoreProfile(updated.profile), id), 'read');
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('pages keep short paragraphs whole and split only an overlong paragraph', () => {
  const short = ['하나', '둘', '셋', '넷', '다섯'];
  assert.deepEqual(episodePages(short), [short.slice(0, 4), short.slice(4)]);
  const long = '길게 이어지는 원문입니다. '.repeat(29);
  assert.deepEqual(episodePages(['가'.repeat(200), '나'.repeat(120)]).map(page => page.length), [1, 1]);
  assert.equal(episodePages([long]).flat().join(''), long);
  for (const { body } of Object.values(EPISODES)) {
    for (const page of episodePages(body)) assert.ok(page.length <= 4 && page.join('\n\n').length <= 300);
  }
});
