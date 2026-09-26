import test from 'node:test';
import assert from 'node:assert/strict';
import {ARTIFACTS, createProfile, drawArtifact, purchaseShopItem, useRandomResetTicket, randomRemaining, consumeRandom, claimDungeon, RANDOM_DAILY_LIMIT} from '../meta.js';

const today = new Date(2026, 8, 14, 23, 59);
const tomorrow = new Date(2026, 8, 15, 0, 1);
function ticketed(ids = []) {
  const p = createProfile({ owned: ids, equipped: ids.slice(0, 3), tickets: [{ dungeon: 0, difficulty: 'normal' }] });
  return p;
}
function force(p, rarity, correct = false, index = 0) {
  const boundary = correct ? .30 : .15;
  const roll = rarity === 'rare' ? 0 : rarity === 'epic' ? boundary : boundary + (correct ? .02 : .01);
  const pool = ARTIFACTS.filter(a => a.rarity === rarity);
  let n = 0;
  return drawArtifact(p, () => n++ === 0 ? roll : (index + .5) / pool.length, correct);
}

test('new and duplicate draws award shards without removing the relic or changing odds', () => {
  for (const rarity of ['normal', 'rare', 'epic']) {
    const fresh = ticketed();
    const index = rarity === 'normal' ? 1 : 0;
    const added = force(fresh, rarity, false, index);
    assert.equal(added.duplicate, false);
    assert.equal(added.shardsAwarded, 0);
    assert.equal(fresh.dreamShards, 0);
    assert.ok(fresh.owned.includes(added.artifact.id));
    fresh.tickets.push({ source: 'shop', kind: 'artifact' });
    const again = force(fresh, rarity, true, index);
    assert.equal(again.duplicate, true);
    assert.equal(again.shardsAwarded, { normal: 1, rare: 3, epic: 5 }[rarity]);
    assert.equal(fresh.dreamShards, again.shardsAwarded);
    assert.equal(fresh.tickets.length, 0);
    assert.equal(fresh.owned.filter(id => id === again.artifact.id).length, 1);
  }
});

test('shop tickets and weekly tickets share settlement and do not touch claims', () => {
  const p = createProfile();
  const date = new Date(2026, 8, 14);
  assert.equal(claimDungeon(p, 0, 'normal', date).count, 1);
  const claims = JSON.stringify(p.claims);
  p.dreamShards = 6;
  assert.deepEqual(purchaseShopItem(p, 'artifact'), { ok: true, item: 'artifact', dreamShards: 1, randomResetTickets: 0, tickets: 2 });
  assert.equal(JSON.stringify(p.claims), claims);
  assert.deepEqual(p.tickets.at(-1), { source: 'shop', kind: 'artifact' });
  const first = drawArtifact(p, () => .5);
  const second = drawArtifact(p, () => .5);
  assert.ok(first && second);
  assert.equal(drawArtifact(p), null);
  assert.equal(p.tickets.length, 0);
});

test('purchases and reset tickets are atomic and refuse waste', () => {
  const p = createProfile();
  p.dreamShards = 1;
  assert.equal(purchaseShopItem(p, 'artifact').ok, false);
  assert.equal(p.dreamShards, 1);
  assert.equal(p.tickets.length, 0);
  assert.equal(purchaseShopItem(p, 'reset').ok, true);
  assert.equal(p.dreamShards, 0);
  assert.equal(p.randomResetTickets, 1);
  assert.equal(randomRemaining(p, today), 3);
  assert.equal(useRandomResetTicket(p, today).ok, false);
  assert.equal(p.randomResetTickets, 1);
  for (let i = 0; i < RANDOM_DAILY_LIMIT; i++) consumeRandom(p, () => 0, today);
  assert.equal(randomRemaining(p, today), 0);
  const used = useRandomResetTicket(p, today);
  assert.equal(used.ok, true);
  assert.equal(p.randomResetTickets, 0);
  assert.equal(randomRemaining(p, today), 3);
  assert.equal(consumeRandom(p, () => 0, today), 0);
});

test('old saves migrate without granting shards or a free random reset', () => {
  const old = { version: 5, owned: ['spellbook', 'frozen', 'crystal', 'dream'], equipped: ['dream'], tickets: [{ dungeon: 1, difficulty: 'hard', week: '2026-09-14' }], claims: { '2026-09-14:1': 'hard' }, randomDraws: { date: '2026-09-14', count: 1 }, clears: { '0:0:easy:0': true } };
  const p = createProfile(old);
  assert.equal(p.version, 6);
  assert.equal(p.dreamShards, 0);
  assert.equal(p.randomResetTickets, 0);
  assert.equal(p.randomDraws.date, '2026-09-14');
  assert.equal(randomRemaining(p, today), 2);
  assert.equal(createProfile({ ...old, randomDraws: { date: '2026-09-14', count: 10 } }).randomDraws.count, 3);
  assert.equal(randomRemaining(createProfile({ randomDraws: { date: '2026-09-14', count: 2 } }), today), 1);
  assert.equal(randomRemaining(createProfile({ randomDraws: { date: '2026-09-13', count: 10 } }), today), 3);
  const mixed = createProfile({ version: 2, tickets: [{ dungeon: 3, difficulty: 'hard' }, { source: 'shop', kind: 'artifact', dungeon: 0, difficulty: 'easy' }], claims: { '2026-09-14:3': 'hard' } });
  assert.equal(mixed.tickets[0].dungeon, 5);
  assert.deepEqual(mixed.tickets[1], { source: 'shop', kind: 'artifact' });
  assert.equal(mixed.claims['2026-09-14:5'], 'hard');
  assert.equal(createProfile(JSON.parse(JSON.stringify(mixed))).tickets.length, 2);
});

test('corrupt currency normalizes and repeated reset requests do not stack', () => {
  const p = createProfile({ dreamShards: -4.8, randomResetTickets: Number.POSITIVE_INFINITY, randomDraws: { date: '2026-09-14', count: Number.NaN } });
  assert.equal(p.dreamShards, 0);
  assert.equal(p.randomResetTickets, 0);
  assert.equal(p.randomDraws.count, 0);
  p.randomResetTickets = 1;
  p.randomDraws = { date: '2026-09-14', count: 3 };
  assert.equal(useRandomResetTicket(p, today).ok, true);
  assert.equal(useRandomResetTicket(p, today).ok, false);
  assert.equal(p.randomResetTickets, 0);
  assert.equal(useRandomResetTicket(p, tomorrow).reason, 'no-ticket');
  assert.equal(createProfile({ dreamShards: Number.POSITIVE_INFINITY, randomResetTickets: Number.MAX_SAFE_INTEGER + 20 }).randomResetTickets, Number.MAX_SAFE_INTEGER);
  assert.equal(createProfile({ dreamShards: 1.9 }).dreamShards, 1);
  assert.equal(ARTIFACTS.find(a => a.id === 'dream').text, '최대 생명 2 증가');
});
