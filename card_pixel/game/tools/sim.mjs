// node card_pixel/game/tools/sim.mjs [runs] [--all | --dungeon=<id>] [--nightmare]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { DUNGEONS } from '../src/content/dungeons.js';
import * as Bridge from '../src/engine/bridge.js';
import * as RelayRoster from '../src/engine/roster.js';
import * as R from '../src/engine/run.js';
import { coreBundle } from './core-bundle.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..');
const args = process.argv.slice(2);
const flag = name => args.includes(name);
const runs = Number(args.find(arg => /^\d+$/.test(arg)) || (flag('--all') ? 200 : 300));
const dungeon = args.find(arg => arg.startsWith('--dungeon='))?.slice('--dungeon='.length) || 'ember_volcano';
const difficulty = flag('--nightmare') ? 'nightmare' : 'normal';
const dungeons = flag('--all') ? Object.keys(DUNGEONS).filter(id => difficulty === 'normal' || DUNGEONS[id].nightmareRule) : [dungeon];
if (!runs || dungeons.some(id => !Object.hasOwn(DUNGEONS, id))) throw new RangeError('Invalid run count or dungeon');

const manifest = JSON.parse(fs.readFileSync(path.join(here, '../assets/sprites.json'), 'utf8'));
const sp = Object.fromEntries(Object.entries(manifest).map(([name, sprite]) => [name.replace(/\.png$/, ''), sprite]));
const sandbox = { console, Math, __relayCoreTimer: Bridge.scheduleTimer, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(coreBundle(repo), sandbox);
const core = sandbox.RelayCore;
const roster = RelayRoster.create(core, { sp });
const rules = { heirloom: !flag('--no-heirloom'), lastStand: !flag('--no-laststand') };

const gradeRank = { normal: 0, rare: 1, epic: 2, legend: 3, transcendence: 3, event: 2 };
function strength(id) {
  const card = roster.card(id);
  return card.stats.hp / 4 + Math.max(card.stats.atk, card.stats.matk) + gradeRank[card.grade] * 30;
}
const strongest = ids => ids.slice().sort((a, b) => strength(b) - strength(a));
const isBuff = (option, ids) => option.effects.some(effect => effect.type === 'buff' && ids.includes(effect.id));

function chooseAction(bridge, wait, allowDefense) {
  const state = bridge.state();
  const fighter = state.allies[state.cur];
  const usable = bridge.options().filter(option => option.usable);
  const kill = usable.filter(option => option.preview?.kill).sort((a, b) => a.cost - b.cost)[0];
  if (kill) return kill.index;
  const intent = wait?.intent || {};
  const incoming = intent.dmg?.[1] || 0;
  if (incoming > 0 && allowDefense) {
    const exact = usable.find(option => (intent.kind === 'phy' && isBuff(option, ['barrier']))
      || (intent.kind === 'mag' && isBuff(option, ['magic_guard'])));
    if (exact && (intent.name !== '일반 공격' || incoming >= fighter.hp)) return exact.index;
    const half = usable.find(option => isBuff(option, ['guard', 'damage_half']));
    if (half && !fighter.buffs.damage_half && (intent.ult || incoming >= fighter.maxHp * 0.33 || incoming >= fighter.hp)) return half.index;
  }
  const best = usable.filter(option => option.preview?.dmg > 0).sort((a, b) => b.preview.dmg - a.preview.dmg)[0];
  return best?.index || 0;
}

function checked(result) {
  if (result.ok === false) throw new Error(result.reason);
  return result;
}

function fight(run) {
  const fixed = run.room.type === 'borrowed';
  const strongestThree = strongest(run.bench).slice(0, 3);
  const order = fixed ? run.bench : run.stats.retries % 2 ? strongestThree : strongestThree.reverse();
  checked(R.confirmOrder(run, order));
  const bridge = Bridge.create(core, { ...R.battleOptions(run), rules });
  let events = bridge.start();
  let defended = false;
  if (fixed && rules.heirloom && run.seed % 2 && bridge.canRetreat()) events = bridge.retreat();
  for (let actions = 0; bridge.awaiting && actions < 500; actions++) {
    const wait = events.findLast(event => event.t === 'await');
    const index = chooseAction(bridge, wait, !defended);
    const option = bridge.options().find(item => item.index === index);
    defended = option?.type === 'sup';
    events = bridge.act(index);
  }
  if (!bridge.outcome) throw new Error('Battle did not finish: ' + run.id + ' floor ' + run.floor);
  checked(R.settleBattle(run, bridge));
}

function chooseDoor(run) {
  const spring = run.doors.find(door => door.type === 'spring');
  const altar = run.doors.find(door => door.type === 'altar');
  if (spring && run.crystals >= (run.bench.length < 3 ? 1 : 3)) return spring;
  if (altar) return altar;
  if (run.floor === 2 && run.doors[1]?.risk) return run.seed % 2 ? run.doors[1] : run.doors[0];
  if (run.doors.some(door => door.type === 'treasure')) {
    return run.doors.find(door => door.type === (run.seed % 3 ? 'treasure' : 'event')) || run.doors[0];
  }
  if (run.doors[1]?.type === 'elite' && run.bench.length >= 4 && run.seed % 4 === 0) return run.doors[1];
  if (run.doors[1]?.intent && run.seed % 2) return run.doors[1];
  return run.doors[0];
}

function resolveChoices(run) {
  while (run.pending) {
    const pending = run.pending;
    if (pending.kind === 'start') checked(R.chooseStartPick(run, strongest(pending.candidates)[0] || null));
    else if (pending.kind === 'gate') {
      const id = strongest(pending.candidates)[0];
      if (id && (run.bench.length < 4 || !pending.relic || run.seed % 2)) checked(R.chooseGateReward(run, { kind: 'join', id }));
      else if (pending.relic) checked(R.chooseGateReward(run, { kind: 'relic', id: pending.relic }));
      else break;
    } else if (pending.kind === 'altar') {
      for (let i = 0; i < 3; i++) {
        const roll = checked(R.altarRoll(run));
        if (roll.jackpot || roll.multiplier >= 0.3) break;
      }
      checked(R.altarKeep(run));
    } else if (pending.kind === 'event') {
      const choice = pending.choices.find(entry => entry.enabled && !entry.ops.some(op => op.type === 'release'));
      if (!choice) break;
      checked(R.chooseEvent(run, choice.id, choice.targets ? strongest(choice.targets)[0] : undefined));
    } else if (pending.kind === 'relic') {
      checked(R.equipRelic(run, pending.id, pending.replace[0]));
    } else {
      throw new Error('Unexpected pending choice: ' + pending.kind);
    }
  }
}

function playRun(dungeonId, seed) {
  const run = R.createRun({ core, roster, dungeonId, difficulty, seed, plain: flag('--plain') });
  resolveChoices(run);
  while (run.phase !== 'done') {
    const door = chooseDoor(run);
    checked(R.chooseDoor(run, door.index));
    if (door.enemies.length) {
      const retries = run.stats.retries;
      do {
        if (run.stats.retries - retries >= 20) throw new Error('Intro retry limit: ' + run.id);
        fight(run);
      } while (run.room.status === 'order');
    } else if (door.type === 'spring') {
      if (run.bench.length < 6 && R.springPick(run).ok) {
        checked(R.springTake(run, strongest(run.pending.candidates)[0]));
      }
      while (run.bench.length < 6 && R.springDraw(run).ok) { /* Draw only while the pool and crystals allow it. */ }
    } else if (door.type === 'treasure') {
      checked(R.takeTreasure(run));
    }
    resolveChoices(run);
    if (run.phase !== 'done') {
      checked(R.leaveRoom(run));
      if (run.phase !== 'done') checked(R.nextFloor(run));
    }
  }
  const end = checked(R.finishRun(run));
  return { end, stats: run.stats, fallen: run.fallen.length };
}

console.log(difficulty + ' · ' + runs + ' seeds per dungeon');
console.log('| Dungeon | Clear | 1,000+ hit | Battles/run | Fallen/run | Recruitable/run |');
console.log('| --- | ---: | ---: | ---: | ---: | ---: |');
for (const id of dungeons) {
  const counts = { wins: 0, bigHits: 0, battles: 0, fallen: 0, recruitable: 0 };
  for (let seed = 1; seed <= runs; seed++) {
    const { end, stats, fallen } = playRun(id, seed * 7919);
    counts.wins += Number(end.result === 'win');
    counts.bigHits += Number(stats.best >= 1000);
    counts.battles += stats.battles;
    counts.fallen += fallen;
    counts.recruitable += end.recruitable.length;
  }
  const percent = n => (n / runs * 100).toFixed(1) + '%';
  const average = n => (n / runs).toFixed(2);
  console.log('| ' + [id, percent(counts.wins), percent(counts.bigHits), average(counts.battles),
    average(counts.fallen), average(counts.recruitable)].join(' | ') + ' |');
}
