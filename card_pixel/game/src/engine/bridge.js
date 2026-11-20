/* RelayBridge: runs the real card/game battle rules without the card game's screen.
 It gives BattleRuntime a small host object, turns every state change into an ordered event
 list for the pixel screen, and adds the roguelite rules on top of the unchanged core.

 Adopted (owner decisions of 2026-11-16):
   A  boss countdown        display only: probes the scripted turns that already exist
   B  next-action intent    the enemy action is rolled when the player turn starts, then reused
   C  enemy relay           a queue of enemies; allies keep HP, MP and field buffs; a newcomer
                            does not act on the turn it enters
   D  retreat               once per battle; the fighter leaves alive, death traits do not fire,
                            the turn is spent
 Experimental (2026-11-18, see card_pixel/plan/experimental-rules.md):
   E  heirloom              a fallen fighter's strongest attack passes to the next fighter: 1.5x power,
                            no MP, once per battle, and it stays with that fighter for the run
   F  last stand            the last fighter standing gets ATK/MATK x1.5 and crit +25
   G  quirks                one battle-wide rule twist per door (content/quirks.js)
   H  affixes               enemy modifiers that give ordinary fights a readable twist (AFFIXES)
 Regional events (each has t: 'rule' and the usual snapshot s):
   ember_carry / twilight_bell  { rule, who: enemy ref, stacks: number actually added }
   tide_cycle                  { rule, who: enemy ref, kind: 'rest', name, vulnerable }; emitted when the opening starts
   arena_charge                { rule, who: ally ref, multiplier: 2 } when spent
 The await event carries region: { bellIn } or { charge, ready }, and the next tide hit in countdown.
 Works in the browser and in Node with the same card core. */
import { mulberry32 } from './rng.js';
import { QUIRKS } from '../content/quirks.js';
import { REGIONS } from '../content/regions.js';
import { BOSS_PREVIEW_TURNS, STRONG_BEAT, THREE_BEAT, TIDE_BEATS, TIDE_STRONG_BEAT } from '../content/tempo.js';

export { QUIRKS } from '../content/quirks.js';
export { AFFIXES } from '../content/affixes.js';
export { mulberry32 } from './rng.js';

const strip = html => String(html).replace(/<[^>]*>/g, '');

const FIELD_POOL = ['sun_bless', 'moon_bless', 'sanctuary', 'goddess_descent', 'earth_bless', 'twinkle_party', 'star_powder', 'valentine', 'arena', 'reaper_realm', 'gale'];
const DEFENSE_BUFFS = ['guard', 'barrier', 'magic_guard', 'damage_half', 'evasion'];
const isAttack = skill => skill.type === 'phy' || skill.type === 'mag';
const RANDOM_DAMAGE = ['random_mult', 'random_mult_moon_boost', 'delayed_random_attack'];
const isScripted = action => !!action && action.name !== '일반 공격' && (action.rate === 0 || !!action.isChargeStart || !!action.chargeReset);

function patternActions(enemy, pattern, openingIntent) {
  if (pattern === 'tide') return TIDE_BEATS;
  if (pattern !== 'threeBeat' && pattern !== 'introFixed') return [];
  const basic = THREE_BEAT[0];
  const skill = enemy.skills.find(s => isAttack(s) && (!openingIntent || s.type === openingIntent));
  const signature = skill ? { ...skill, power: skill.val ?? 1 } : basic;
  if (pattern === 'introFixed') return openingIntent ? [signature, basic, THREE_BEAT[2]] : [signature];
  return THREE_BEAT.map(beat => !beat.signature ? beat : skill
    ? { ...signature, rate: 0, power: signature.power * beat.power } : basic);
}

export function enemyBeats(core, enemy, pattern, openingIntent) {
  if (pattern !== 'bossScript') {
    const beats = patternActions(enemy, pattern, openingIntent);
    return beats.map(({ name, type, power }, index) => ({ turn: index + 1, name, type, power }));
  }
  const decide = coreHooks.get(core)?.decide ?? core.Logic.decideEnemyAction;
  const saved = Math.random;
  const beats = [];
  // Only fixed scripted moves are known at the door. Random branches are announced in battle.
  try {
    for (let turn = 1; turn <= BOSS_PREVIEW_TURNS; turn++) {
      Math.random = () => 0;
      const low = decide.call(core.Logic, { ...enemy }, turn);
      Math.random = () => 1 - Number.EPSILON;
      const high = decide.call(core.Logic, { ...enemy }, turn);
      const fixed = low.name === high.name;
      if ((!fixed && !(isScripted(low) && isScripted(high))) || (fixed && !isScripted(high) && turn !== 1)) continue;
      for (const action of fixed ? [high] : [low, high]) {
        const type = !action.isChargeStart && isAttack(action) ? action.type : 'rest';
        beats.push({ turn, name: action.name, type, power: type === 'rest' ? 0 : action.val ?? 1 });
      }
    }
  } finally { Math.random = saved; }
  return beats;
}

export function enemyStatsWithQuirk(stats, quirk) {
  const modifiers = QUIRKS[quirk]?.foe || {};
  return {
    hp: Math.floor(Math.floor(stats.hp) * (modifiers.hp || 1)),
    atk: Math.floor(Math.floor(stats.atk) * (modifiers.atk || 1)),
    matk: Math.floor(Math.floor(stats.matk) * (modifiers.atk || 1)),
    def: modifiers.def ?? Math.floor(stats.def),
    mdef: modifiers.def ?? Math.floor(stats.mdef)
  };
}

/** The attack a fallen fighter hands on: the strongest physical or magic skill, free of MP and at 1.5x power. */
export const HEIRLOOM_POWER = 1.5;
export function heirloomSkill(proto, name) {
  const attacks = (proto.skills || []).filter(isAttack);
  if (!attacks.length) return null;
  const power = s => (s.tier || 1) * 10 + (Number.isFinite(s.val) ? s.val : 1);
  const best = attacks.find(attack => attack.name === name) || attacks.sort((x, y) => power(y) - power(x))[0];
  const skill = Object.assign(JSON.parse(JSON.stringify(best)), { cost: 0, heirloom: true, heirFrom: proto.id, heirFromName: proto.name });
  if (Number.isFinite(skill.val)) skill.val = Math.round(skill.val * HEIRLOOM_POWER * 100) / 100;
  for (const effect of skill.effects || []) {
    if (RANDOM_DAMAGE.includes(effect.type)) {
      effect.min *= HEIRLOOM_POWER;
      effect.max *= HEIRLOOM_POWER;
      if (effect.type === 'random_mult_moon_boost') effect.boostMax *= HEIRLOOM_POWER;
    }
  }
  return skill;
}

export function heldHeirloomSkill(core, held) {
  if (!held) return null;
  if (held.skill) {
    const skill = structuredClone(held.skill);
    skill.heirFrom ??= held.form || held.from;
    return skill;
  }
  const giver = core.GameUtils.getCardById(held.form || held.from);
  return giver ? heirloomSkill(giver, held.name) : null;
}

function instantDamageSkill(skill, delay) {
  // Match the core's resolved damage effects. Other delayed effects only change what happens after the hit.
  let effect;
  if (delay.type === 'delayed_turn_scale_attack') {
    effect = { type: 'dmg_boost_turn_scale', scale: delay.scale };
  } else if (delay.type === 'delayed_attack_debuff_scale') {
    effect = { type: 'dmg_boost', condition: 'target_debuff_count_scale', multPerDebuff: delay.multPerDebuff };
  } else if (delay.type === 'phantom_nightmare') {
    effect = { type: 'dmg_boost', condition: 'target_debuff', debuff: 'darkness', mult: delay.darknessMult || 2 };
  }
  if (!effect) return skill;
  return { ...skill, effects: [...skill.effects.filter(entry => entry !== delay), effect] };
}

export function heirloomPreview(core, party) {
  const seats = [party[0] || null, party[1] || null, party[2] || null];
  return seats.map((from, idx) => {
    const to = from ? seats.slice(idx + 1).find(Boolean) || null : null;
    const giver = to && core.GameUtils.getCardById(from);
    const skill = giver && heirloomSkill(giver);
    return { from, to, skill: skill ? { name: skill.name, type: skill.type, tier: skill.tier || 1, val: skill.val ?? 1 } : null };
  });
}

let active = null;        // battle that is inside a core call right now
const coreHooks = new WeakMap();

export function scheduleTimer(fn) {
  if (active) active.timers.push(fn);
  return 0;
}

/* The core calls its own functions through the BattleRuntime / Logic objects, so replacing
   the properties once lets every battle observe them. Battles without a bridge are untouched. */
function installHooks(core) {
  if (coreHooks.has(core)) return coreHooks.get(core);
  const { Logic, BattleRuntime } = core;
  const TM = BattleRuntime.TurnManager;
  const original = { decide: Logic.decideEnemyAction, calc: Logic.calculateDamage };
  coreHooks.set(core, original);

  Logic.decideEnemyAction = function (enemy, turn) {
    const b = active;
    if (!b || b.probing) return original.decide.call(Logic, enemy, turn);
    return b.onDecide(enemy);
  };
  Logic.calculateDamage = function (source, target, skill, fieldBuffs, activeTraits, logFn, mode, deck, turn, artifacts) {
    const b = active;
    if (!b || b.probing) return original.calc.apply(Logic, arguments);
    const lines = [];
    const result = original.calc.call(Logic, source, target, skill, fieldBuffs, activeTraits,
      msg => { lines.push(strip(msg)); if (logFn) logFn(msg); }, mode, deck, turn, artifacts);
    b.onCalc(source, target, skill, lines, result);
    return result;
  };
  const wrap = (obj, name, handler) => {
    const orig = obj[name];
    obj[name] = function (rpg) {
      const b = rpg && rpg.__relay;
      if (!b) return orig.apply(this, arguments);
      const args = arguments, self = this;
      return handler(b, () => orig.apply(self, args), args);
    };
  };
  wrap(BattleRuntime, 'executeSkill', (b, go, a) => b.onSkill(a[1], a[2], a[3], !!a[4], go));
  wrap(BattleRuntime, 'handleDeathTraits', (b, go, a) => b.onRelay('own', a[1], go));
  wrap(BattleRuntime, 'handleLinkedDeathTraits', (b, go, a) => b.onRelay('linked', a[1], go));
  wrap(TM, 'startPlayerTurn', (b, go) => b.onStartPlayerTurn(go));
  wrap(TM, 'startEnemyTurn', (b, go) => b.onEnemyTurn(go));
  wrap(TM, 'endEnemyTurn', (b, go) => b.onEndEnemyTurn(go));
  return original;
}

export function create(core, opts) {
  const original = installHooks(core);
  const { BattleRuntime, Logic, GameUtils, StatusRules, SideEffects, getMaxMana, buildBattleEnemy } = core;
  const TM = BattleRuntime.TurnManager;
  const rng = mulberry32(opts.seed == null ? Math.floor(Math.random() * 4294967296) : opts.seed);
  const queue = opts.enemies.slice();
  const rules = Object.assign({ heirloom: true, lastStand: true }, opts.rules || {});
  const quirk = opts.quirk && QUIRKS[opts.quirk] ? opts.quirk : null;
  const Q = quirk ? QUIRKS[quirk] : {};
  const region = opts.region?.id;
  const pattern = opts.tempo?.pattern;
  const bellTurns = opts.region?.turns ?? REGIONS.twilight_bell.turns;
  const bellStacks = opts.region?.stacks ?? REGIONS.twilight_bell.stacks;
  const bet = opts.bet;
  const B = {
    timers: [], events: [], ctx: [], probing: false,
    enemyIdx: 0, awaiting: false, outcome: null, retreatUsed: false,
    pendingNext: null, lastDownIdx: -1, intentCache: null, lastCalc: null, prev: null,
    lastHit: null, carry: 0, lastStandDone: false, turnStartHp: 0,
    gained: [], heirloomsUsed: 0, heirloomKills: 0, rescues: [], enemyDowns: [], bestHit: null,
    charge: 0, chargeSpent: false, dueEffects: [], betMet: false, fieldSeen: false
  };

  const host = B.host = {
    __relay: B,
    NORMAL_ATTACK: { name: '일반 공격', type: 'phy', tier: 1, cost: 0, val: 1.0, effects: [] },
    state: {
      deck: opts.party.slice(0, 3).concat([null, null, null]).slice(0, 3),
      mode: 'default', gameType: 'pixel', hardMode: false, enemyScale: 0,
      artifacts: (opts.artifacts || []).slice(0, 4), chaosBuffs: (opts.blessings || []).slice()
    },
    battle: {},
    log(msg, kind) {
      const text = strip(msg), hit = /(\d+) 피해/.exec(text);
      if (/^전투 개시/.test(text)) B.events.unshift({ t: 'begin', enemy: enemyRef(), quirk, s: null });
      const calc = B.lastCalc;
      if (calc && calc.by && /class="log-dmg"/.test(msg) && hit && Number(hit[1]) === calc.result.dmg) {
        const amount = calc.result.dmg;
        if (amount > (B.bestHit?.amount || 0)) B.bestHit = { amount, by: calc.by, skill: calc.info.skill };
        if (calc.heirloom && amount > 0 && calc.hpBefore > 0 && calc.target.hp <= 0) B.heirloomKills++;
      }
      flush(hit ? Number(hit[1]) : 0);
      push({ t: 'log', text, kind: kind || '' });
      noteLog(text);
    },
    hasArtifact(id) { return this.state.artifacts.includes(id); },
    getCardData(id) { return GameUtils.getCardById(id); },
    getCurrentStageEnemyData() { return queue[B.enemyIdx]; },
    showAlert(msg) { push({ t: 'alert', text: strip(msg) }); },
    showBattleScreen() {}, clearBattleLog() {}, renderBattleView() {},
    renderBattleControls() { B.awaiting = true; },
    winBattle() {
      if (!recordEnemyDown()) return;
      if (B.enemyIdx + 1 < queue.length) {
        B.pendingNext = host.battle.phase || 'player-resolving';
        if (quirk === 'overflow') B.carry = Math.max(0, -Math.floor(host.battle.enemy.hp));
      } else { host.battle.isFinished = true; B.outcome = 'win'; push({ t: 'win' }); }
    },
    loseBattle() {
      if (host.battle.enemy.hp <= 0) {
        if (B.enemyIdx === queue.length - 1) return host.winBattle();
        recordEnemyDown();
      }
      flush(); host.battle.isFinished = true; B.outcome = 'lose'; push({ t: 'lose' });
    }
  };

  const enemyRef = () => ({ side: 'enemy', idx: B.enemyIdx });
  const allyRef = idx => ({ side: 'ally', idx });
  const refOf = unit => (unit === host.battle.enemy ? enemyRef() : allyRef(unit.pos));
  const localTurn = enemy => host.battle.turn - (enemy.relayEnteredTurn || 1) + 1;
  const isAlly = unit => !!unit && unit !== host.battle.enemy && !!unit.proto;
  const hasAffix = (enemy, id) => !!enemy && Array.isArray(enemy.affixes) && enemy.affixes.includes(id);
  const players = () => (host.battle.players || []).filter(Boolean);

  function push(ev) { ev.s = B.prev; B.events.push(ev); return ev; }

  function recordEnemyDown() {
    if (B.lastDownIdx === B.enemyIdx) return false;
    B.lastDownIdx = B.enemyIdx;
    flush();
    const treasure = hasAffix(host.battle.enemy, 'treasure');
    B.enemyDowns.push({ idx: B.enemyIdx, treasure });
    if (bet?.kind === 'kill_on_turn' && bet.turn === host.battle.turn) B.betMet = true;
    push({ t: 'enemyDown', who: enemyRef(), treasure });
    return true;
  }

  /* ---------- snapshots and deltas ---------- */
  function unitSnap(u) {
    return {
      name: u.name, hp: Math.max(0, Math.round(u.hp)), maxHp: u.maxHp, mp: u.mp, maxMp: getMaxMana(u),
      buffs: Object.assign({}, u.buffs), dead: !!u.isDead && !u.retreated, out: !!u.retreated,
      form: u.formId || u.id
    };
  }
  function snapshot() {
    const b = host.battle;
    const enemy = b.enemy ? unitSnap(b.enemy) : null;
    if (enemy) {
      enemy.idx = B.enemyIdx; enemy.charging = !!b.enemy.isCharging; enemy.def = b.enemy.def; enemy.mdef = b.enemy.mdef;
      enemy.affixes = (b.enemy.affixes || []).slice(); enemy.frenzied = !!b.enemy.frenzied;
    }
    return {
      turn: b.turn, cur: b.currentPlayerIdx,
      allies: b.players.map(p => (p ? Object.assign(unitSnap(p), { lastStand: !!p.lastStand }) : null)),
      enemy,
      field: (b.fieldBuffs || []).map(f => f.name),
      delayed: (b.delayedEffects || []).map(d => ({ turn: d.turn, name: d.skill.name, by: d.source.pos }))
    };
  }
  /* `hint` is the damage number of the log line being written: the full hit, even past 0 HP. */
  function flush(hint) {
    const b = host.battle;
    const was = B.prev;
    if (!was) return;
    if (bet?.kind === 'empty_sky' && !B.fieldSeen && (b.phase === 'player-resolving' || b.phase === 'player-ready') &&
        b.fieldBuffs.some(f => !f.expiresAtTurn || f.expiresAtTurn > b.turn)) B.fieldSeen = true;
    const now = snapshot();
    B.prev = now;
    const cause = B.ctx.length ? B.ctx[B.ctx.length - 1] : null;
    const diffUnit = (who, unit, a, z) => {
      if (!a || !z) return;
      if (z.mp !== a.mp) push({ t: 'mp', who, delta: z.mp - a.mp });
      if (z.hp !== a.hp) {
        const ev = { t: 'hp', who, delta: z.hp - a.hp, amount: Math.abs(z.hp - a.hp), cause: describeCause(cause, who) };
        const c = B.lastCalc;
        if (c && c.target === unit && ev.delta < 0) {
          c.info.dmg = c.result.dmg;  // Companion can modify a death hit after the calculation returns.
          ev.calc = c.info;
          if (z.hp === 0) ev.amount = Math.max(ev.amount, c.info.dmg);   // show the full hit on a kill
          B.lastCalc = null;
        } else if (ev.delta < 0 && z.hp === 0 && hint > ev.amount) ev.amount = hint;
        push(ev);
      }
      const ids = new Set(Object.keys(a.buffs).concat(Object.keys(z.buffs)));
      ids.forEach(id => {
        const from = a.buffs[id] || 0, to = z.buffs[id] || 0;
        if (from !== to) push({ t: 'buff', who, id, from, to });
      });
      if (z.form !== a.form) push({ t: 'form', who, name: z.name });
      if (z.dead && !a.dead) push({ t: 'down', who });
    };
    now.allies.forEach((z, i) => diffUnit(allyRef(i), b.players[i], was.allies[i], z));
    if (was.enemy && now.enemy && was.enemy.idx === now.enemy.idx) diffUnit(enemyRef(), b.enemy, was.enemy, now.enemy);
    const add = now.field.filter(id => !was.field.includes(id)), remove = was.field.filter(id => !now.field.includes(id));
    if (add.length || remove.length) push({ t: 'field', add, remove, list: now.field.slice() });
    if (now.turn !== was.turn) push({ t: 'turn', n: now.turn });
    const entering = now.allies[now.cur];
    if (now.cur !== was.cur && entering && !entering.dead && !entering.out) push({ t: 'enter', who: allyRef(now.cur) });
  }
  function describeCause(cause, who) {
    if (!cause) return { kind: 'other' };
    if (cause.kind === 'relay') return { kind: 'relay', victim: cause.victim, linked: cause.linked };
    if (cause.kind === 'rule') return { kind: 'rule', rule: cause.rule };
    const self = cause.who && cause.who.side === who.side && cause.who.idx === who.idx;
    return { kind: self ? 'self' : 'act', by: cause.who, skill: cause.skill ? cause.skill.name : null, delayed: !!cause.delayed };
  }
  /** Run a rule's state change under its own cause so the screen can tell it apart. */
  function asRule(rule, fn) { flush(); B.ctx.push({ kind: 'rule', rule }); try { fn(); } finally { flush(); B.ctx.pop(); } }

  /* Some outcomes only exist as log lines in the core; give the screen a typed event for them. */
  function noteLog(text) {
    const b = host.battle;
    const target = b.players && b.players[b.currentPlayerIdx];
    if (/회피 성공/.test(text) && target) push({ t: 'miss', who: allyRef(target.pos), why: 'evasion' });
    else if (/배리어로 방어/.test(text) && target) push({ t: 'miss', who: allyRef(target.pos), why: 'barrier' });
    else if (/매직가드로 방어/.test(text) && target) push({ t: 'miss', who: allyRef(target.pos), why: 'magic_guard' });
    else if (/기절하여 행동 불가/.test(text)) push({ t: 'stunned', who: enemyRef() });
    else if (/기절로 인해 행동 불가/.test(text) && target) push({ t: 'stunned', who: allyRef(target.pos) });
  }

  /* ---------- G/H: setting units up ---------- */
  function applyAllyModifier(p, modifier) {
    if (modifier.atk) {
      p.atk = Math.floor(p.atk * modifier.atk);
      p.matk = Math.floor(p.matk * modifier.atk);
    }
    if (modifier.def === 0) { p.def = 0; p.mdef = 0; }
    if (modifier.crit) p.baseCrit = (Number.isFinite(p.baseCrit) ? p.baseCrit : 10) + modifier.crit;
  }
  function addAllyModifier(p, modifier) {
    p.relayModifiers.push(modifier);
    applyAllyModifier(p, modifier);
  }
  function setupAllies() {
    for (const p of players()) {
      p.relayModifiers = [];
      if (pattern !== 'introFixed' && Number.isFinite(opts.tempo?.startMp)) p.mp = Math.min(getMaxMana(p), opts.tempo.startMp);
      if (Q.ally) {
        addAllyModifier(p, Q.ally);
        if (Q.ally.mp) { p.maxMp = Q.ally.mp; p.mp = Q.ally.mp; }
      }
      const skill = rules.heirloom && heldHeirloomSkill(core, opts.heirlooms?.[p.id]);
      if (skill) p.skills.push(skill);
    }
  }
  function setupEnemy(enemy) {
    const def = queue[B.enemyIdx] || {};
    enemy.affixes = (def.affixes || []).slice();
    enemy.relayBeats = patternActions(enemy, pattern, opts.openingIntent);
    const { hp, atk, matk, def: defense, mdef } = enemyStatsWithQuirk(def.stats, quirk);
    Object.assign(enemy, { hp, maxHp: hp, atk, matk, def: defense, mdef, baseAtk: atk, baseMatk: matk, baseDef: defense, baseMdef: mdef });
    if (hasAffix(enemy, 'tough')) enemy.buffs.damage_half = 3;
  }
  function applyStart() {
    const start = opts.start;
    if (!start) return;
    const b = host.battle;
    for (const id of (start.field || []).slice(0, 3)) BattleRuntime.applyFieldBuff(host, id);
    for (const [id, stacks] of Object.entries(start.enemyDebuffs || {})) {
      StatusRules.add(b.enemy, id, stacks, host.state.artifacts);
    }
    for (const p of players()) {
      const values = start.allyStart?.[p.pos];
      if (Number.isFinite(values?.hp)) p.hp = Math.max(1, Math.min(p.maxHp, values.hp));
      if (Number.isFinite(values?.mp)) p.mp = Math.max(0, Math.min(getMaxMana(p), values.mp));
    }
  }

  /* ---------- E/F: what happens when an ally falls ---------- */
  function afterAllyDown(victim) {
    if (!isAlly(victim) || victim.retreated) return;
    if (rules.heirloom) {
      const skill = heirloomSkill(victim.proto);
      const heir = players().find(p => !p.isDead && p.pos > victim.pos);
      if (skill && heir) {
        heir.skills = heir.skills.filter(s => !s.heirloom);
        heir.skills.push(skill);
        B.gained.push({ to: heir.id, from: victim.id, name: skill.name, form: victim.formId, skill });
        push({ t: 'heirloom', from: allyRef(victim.pos), to: allyRef(heir.pos), skill: { name: skill.name, type: skill.type, tier: skill.tier || 1 } });
      }
    }
    if (quirk === 'martyr') {
      const alive = players().filter(p => !p.isDead);
      if (alive.length) {
        asRule('martyr', () => alive.forEach(p => addAllyModifier(p, { atk: 1.4 })));
        push({ t: 'rule', rule: 'martyr', who: alive.map(p => allyRef(p.pos)) });
      }
    }
    checkLastStand();
  }
  function checkLastStand() {
    if (!rules.lastStand || B.lastStandDone || B.outcome) return;
    const all = players(), alive = all.filter(p => !p.isDead);
    if (all.length < 2 || alive.length !== 1) return;
    const p = alive[0];
    B.lastStandDone = true;
    p.lastStand = true;
    addAllyModifier(p, { atk: 1.5, crit: 25 });
    push({ t: 'laststand', who: allyRef(p.pos) });
  }

  /* ---------- hooks called from the patched core functions ---------- */
  B.onSkill = function (source, target, skill, delayed, go) {
    flush();
    const who = refOf(source);
    if (skill.heirloom && !delayed && isAlly(source)) B.heirloomsUsed++;
    push({ t: 'act', who, target: refOf(target), delayed, heirloom: !!skill.heirloom, heirFrom: skill.heirFrom, skill: { name: skill.name, type: skill.type, tier: skill.tier || 1, cost: skill.cost || 0, val: skill.val, effects: (skill.effects || []).map(e => e.type) } });
    B.ctx.push({ kind: 'act', who, skill, delayed, source });
    B.lastHit = null;
    const formId = source.formId;
    const heirlooms = (source.skills || []).filter(s => s.heirloom);
    try {
      const result = go();
      if (source.formId !== formId && source.relayModifiers) {
        // the core rebuilds stats and skills from the new form's card: put back what the relay rules gave
        for (const modifier of source.relayModifiers) applyAllyModifier(source, modifier);
        for (const held of heirlooms) if (!source.skills.includes(held)) source.skills.push(held);
      }
      const hit = B.lastHit && B.lastHit.source === source && B.lastHit.target === target ? B.lastHit.dmg : 0;
      const enemy = host.battle.enemy;
      if (isAlly(source) && target === enemy && hit > 0 && !B.outcome) {
        // G echo: a big attack rings once more at half power
        if (quirk === 'echo' && !delayed && (skill.tier || 1) >= 3 && target.hp > 0) {
          flush();
          const extra = Math.floor(hit * 0.5);
          push({ t: 'rule', rule: 'echo', who: enemyRef(), amount: extra });
          target.hp -= extra; target.tookDamageThisTurn = true;
          flush();
          if (target.hp <= 0) host.winBattle();
        }
        // H thorns: physical attackers take a quarter back, never below 1 HP
        if (hasAffix(enemy, 'thorns') && skill.type === 'phy' && !source.isDead && source.hp > 1) {
          flush();
          const back = Math.min(source.hp - 1, Math.floor(hit * 0.25));
          if (back > 0) {
            push({ t: 'rule', rule: 'thorns', who: refOf(source), amount: back });
            asRule('thorns', () => { source.hp -= back; });
          }
        }
      }
      return result;
    } finally { flush(); B.ctx.pop(); }
  };
  B.onRelay = function (kind, victim, go) {
    flush();
    const at = B.events.length;
    const trait = victim && victim.proto && victim.proto.trait;
    const ev = push({ t: 'relay', phase: 'begin', linked: kind === 'linked', victim: refOf(victim), trait: trait ? trait.desc : '' });
    B.ctx.push({ kind: 'relay', victim: ev.victim, linked: ev.linked });
    try { return go(); } finally {
      flush(); B.ctx.pop();
      if (B.events.length === at + 1) B.events.pop();          // nothing happened: drop the marker
      else push({ t: 'relay', phase: 'end', linked: ev.linked, victim: ev.victim });
      if (kind === 'own') afterAllyDown(victim);
    }
  };
  B.onStartPlayerTurn = function (go) {
    const b = host.battle;
    // Mark the opening before scheduled hits or the player's command can land.
    if (b.isNewTurn && b.enemy?.hp > 0) {
      const vulnerable = tideVulnerability(b.enemy);
      if (vulnerable) {
        flush();
        push({ t: 'rule', rule: region, who: enemyRef(), kind: 'rest', name: REGIONS.tide_cycle.opening, vulnerable });
      }
    }
    if (region === 'twilight_bell' && b.isNewTurn && b.enemy?.hp > 0 && bellTurns.includes(b.turn)) {
      const before = b.enemy.buffs.divine || 0;
      asRule(region, () => {
        const after = StatusRules.add(b.enemy, 'divine', bellStacks, host.state.artifacts);
        push({ t: 'rule', rule: region, who: enemyRef(), stacks: bellStacks > 0 ? after - before : 0 });
      });
    }
    if (quirk === 'starfall' && b.isNewTurn && b.enemy && b.enemy.hp > 0) {
      const have = (b.fieldBuffs || []).map(f => f.name), pool = FIELD_POOL.filter(id => !have.includes(id));
      if (pool.length) {
        const id = pool[Math.floor(Math.random() * pool.length)];
        push({ t: 'rule', rule: 'starfall', id });
        asRule('starfall', () => BattleRuntime.applyFieldBuff(host, id));
      }
    }
    const previousDue = B.dueEffects;
    B.dueEffects = b.delayedEffects.filter(effect => effect.turn === b.turn);
    try { return go(); } finally { B.dueEffects = previousDue; }
  };
  B.onEnemyTurn = function (go) {
    flush();
    B.turnStartHp = players().reduce((n, p) => n + Math.max(0, p.hp), 0);
    B.ctx.push({ kind: 'act', who: enemyRef(), skill: null, enemyTurn: true });
    push({ t: 'enemyTurn', who: enemyRef() });
    try { return go(); } finally { B.closeEnemyTurn(); }
  };
  B.closeEnemyTurn = function () {
    const top = B.ctx[B.ctx.length - 1];
    if (top && top.enemyTurn) { flush(); B.ctx.pop(); }
  };
  B.onEndEnemyTurn = function (go) {
    const enemy = host.battle.enemy;
    if (hasAffix(enemy, 'leech') && enemy.hp > 0) {           // H leech: heal half of what it dealt this turn
      const dealt = B.turnStartHp - players().reduce((n, p) => n + Math.max(0, p.hp), 0);
      const heal = Math.min(enemy.maxHp - enemy.hp, Math.floor(Math.max(0, dealt) * 0.5));
      if (heal > 0) { push({ t: 'rule', rule: 'leech', who: enemyRef(), amount: heal }); asRule('leech', () => { enemy.hp += heal; }); }
    }
    B.closeEnemyTurn();
    return go();
  };
  B.onDecide = function (enemy) {
    flush();
    const cache = B.intentCache;
    let action;
    if (cache && cache.enemy === enemy && cache.turn === host.battle.turn) action = cache.action;
    else action = decide(enemy);
    B.intentCache = null;
    const top = B.ctx[B.ctx.length - 1];
    if (top && top.enemyTurn) top.skill = action;
    if (action.type === 'rest') return action;
    const target = host.battle.players[host.battle.currentPlayerIdx];
    push({
      t: 'act', who: enemyRef(), target: target ? allyRef(target.pos) : null, delayed: false,
      charge: !!action.isChargeStart, ult: isScripted(action),
      skill: { name: action.name, type: action.isChargeStart ? 'sup' : action.type, tier: isScripted(action) ? 3 : 1, cost: 0, val: action.val, effects: (action.effects || []).map(e => e.type) }
    });
    return action;
  };
  B.onCalc = function (source, target, skill, lines, result) {
    const b = host.battle;
    const cause = B.ctx.at(-1);
    const vulnerable = target === b.enemy && tideVulnerability(target);
    if (vulnerable && result.dmg > 0) {
      result.dmg = tideDamage(result.dmg, vulnerable);
      lines.push(`${REGIONS.tide_cycle.opening}: 받는 피해 ${vulnerable}배`);
    }
    if (target === b.enemy && cause?.source === source && isAlly(source)) {
      const scheduled = cause.delayed && B.dueEffects.some(effect => effect.source === source && effect.skill === cause.skill);
      if (!scheduled && chargedSkill(cause.skill)) {
        B.chargeSpent = true;
        B.charge = 0;
        result.dmg *= 2;
        push({ t: 'rule', rule: 'arena_charge', who: cause.who, multiplier: 2 });
      } else if (region === 'arena_charge' && !B.chargeSpent && cause.skill === host.NORMAL_ATTACK && result.dmg > 0) {
        B.charge = Math.min(2, B.charge + 1);
      }
      if (bet?.kind === 'delayed_on_time' && scheduled && result.dmg > 0) B.betMet = true;
    }
    const stats = Logic.calculateStats(source, b.fieldBuffs, host.state.mode, host.state.artifacts, b.turn);
    B.lastHit = { source, target, dmg: result.dmg };
    B.lastCalc = {
      target,
      hpBefore: target.hp,
      heirloom: !!skill.heirloom && cause?.kind === 'act' && cause.source === source && target === b.enemy,
      by: target === b.enemy ? source.baseCardId || source.proto?.baseCardId || source.proto?.id : null,
      result,
      info: {
        stat: skill.type === 'phy' ? 'atk' : 'matk',
        base: skill.type === 'phy' ? stats.atk : stats.matk,
        val: Number.isFinite(skill.val) ? skill.val : 1,
        skill: skill.name, lines, crit: !!result.isCrit, dmg: result.dmg,
        adv: lines.some(line => /상성 우위/.test(line))
      }
    };
  };

  /* ---------- rule B: intent, rule A: countdown ---------- */
  const inTide = () => region === 'tide_cycle' && !queue[B.enemyIdx].boss;
  function tideVulnerability(enemy) {
    if (!inTide()) return 0;
    const turn = localTurn(enemy);
    if (pattern === 'tide') return enemy.relayBeats[(turn - 1) % TIDE_BEATS.length]?.vulnerable ?? 0;
    return turn > 0 && turn % 4 === 0 ? 1.5 : 0;
  }
  const tideDamage = (damage, vulnerable) => vulnerable ? Math.floor(damage * vulnerable) : damage;
  function decide(enemy) {
    const turn = localTurn(enemy);
    if (enemy.relayBeats.length && (pattern !== 'introFixed' || opts.openingIntent)) {
      const beat = enemy.relayBeats[(turn - 1) % enemy.relayBeats.length];
      return { ...beat, val: beat.power };
    }
    const vulnerable = tideVulnerability(enemy);
    if (vulnerable) return { type: 'rest', name: REGIONS.tide_cycle.rest, vulnerable };
    if (!inTide() || turn % 4 !== 3) return original.decide.call(Logic, enemy, turn);

    const power = skill => skill.effects?.find(e => e.type === 'random_mult')?.max ?? skill.val ?? 1;
    const strongest = enemy.skills.filter(skill => skill.type === 'mag').sort((a, b) => power(b) - power(a))[0];
    const powerRoll = strongest ? Logic.resolveSkillMultiplier(strongest, enemy) : 1;
    const effects = (strongest?.effects || []).filter(effect => effect.type !== 'random_mult');
    return { type: 'mag', name: REGIONS.tide_cycle.hit, val: powerRoll * 2.5, effects };
  }
  function previewEnemyHit(action, target, mayHitEnemy) {
    const b = host.battle, enemy = b.enemy;
    const es = Logic.calculateStats(enemy, b.fieldBuffs, host.state.mode, host.state.artifacts, b.turn);
    const ts = Logic.calculateStats(target, b.fieldBuffs, host.state.mode, host.state.artifacts, b.turn);
    const physical = action.type === 'phy';
    if ((physical ? target.buffs.barrier : target.buffs.magic_guard) || ts.evasion >= 100) return [0, 0];
    const val = physical ? es.atk : es.matk;
    const def = physical ? ts.def : ts.mdef;
    const random = (action.effects || []).find(e => e.type === 'random_mult');
    let lo = Number.isFinite(action.val) ? action.val : 1, hi = lo;
    if (random) { lo = random.min; hi = lo + Math.ceil(random.max - lo); }
    if (enemy.id === 'pharaoh' && action.name === '고대의저주') {
      if (enemy.tookDamageThisTurn) lo = hi = 3;
      else if (mayHitEnemy) hi = 3;
    }
    const reduce = 1 - StatusRules.damageReduction(target).rate;
    const hit = m => Math.floor(val * m * (100 / (100 + def)) * reduce);
    return [hit(lo), hit(hi)];
  }
  function currentIntent(target = currentPlayer(), mayHitEnemy = true) {
    const b = host.battle, enemy = b.enemy;
    if (enemy.buffs.stun && !tideVulnerability(enemy)) return { kind: 'stun', name: '기절', ult: false };
    let cache = B.intentCache;
    if (!cache || cache.enemy !== enemy || cache.turn !== b.turn) {
      cache = B.intentCache = { enemy, turn: b.turn, action: decide(enemy) };
    }
    const a = cache.action;
    if (a.type === 'rest') return { kind: 'rest', name: a.name, vulnerable: a.vulnerable };
    if (a.isChargeStart) return { kind: 'charge', name: a.name, ult: true };
    if (!isAttack(a)) return { kind: 'sup', name: a.name, ult: isScripted(a), effects: (a.effects || []).map(e => e.type) };
    const dmg = previewEnemyHit(a, target, mayHitEnemy);
    return {
      kind: a.type, name: a.name, ult: isScripted(a), dmg, lethal: dmg[1] >= target.hp,
      extra: (a.effects || []).map(e => e.type).filter(t => t !== 'random_mult')
    };
  }
  function countdown() {
    const b = host.battle, enemy = b.enemy, local = localTurn(enemy);
    if (pattern === 'threeBeat' || pattern === 'tide') {
      const strong = pattern === 'tide' ? TIDE_STRONG_BEAT : STRONG_BEAT;
      const period = enemy.relayBeats.length;
      let inTurns = (strong - local % period + period) % period;
      if (inTurns === 0 && enemy.buffs.stun) inTurns = period;
      return { name: enemy.relayBeats[strong - 1].name, inTurns, charge: false };
    }
    if (inTide()) {
      let inTurns = (3 - local % 4 + 4) % 4;
      if (inTurns === 0 && enemy.buffs.stun) inTurns = 4;
      return { name: REGIONS.tide_cycle.hit, inTurns, charge: false };
    }
    const skillName = action => action.isChargeStart && action.name === '차지'
      ? '디바인블레이드' : action.name.replace(/ 차징$/, '');
    const cache = B.intentCache;
    const current = cache && cache.enemy === enemy && cache.turn === b.turn && !enemy.buffs.stun && cache.action;
    if (isScripted(current)) return { name: skillName(current), inTurns: 0, charge: !!current.isChargeStart };

    const saved = Math.random;
    B.probing = true;
    try {
      for (let k = 1; k <= 14; k++) {
        Math.random = () => 0.999;
        const a = original.decide.call(Logic, Object.assign({}, enemy), local + k);
        if (!isScripted(a)) continue;
        Math.random = () => 0;
        const other = original.decide.call(Logic, Object.assign({}, enemy), local + k);
        const next = { name: skillName(a), inTurns: k, charge: !!a.isChargeStart };
        if (isScripted(other) && skillName(other) !== next.name) next.alt = skillName(other);
        return next;
      }
    } finally { Math.random = saved; B.probing = false; }
    return null;
  }

  /* ---------- stepping ---------- */
  function nextEnemy() {
    const burn = region === 'ember_carry' ? Math.min(2, host.battle.enemy.buffs.burn || 0) : 0;
    B.enemyIdx++;
    host.battle.enemy = buildBattleEnemy(host);
    setupEnemy(host.battle.enemy);
    host.battle.enemy.relayEnteredTurn = host.battle.turn + 1;   // its own turn count starts with its first action
    B.prev = snapshot();
    push({ t: 'enemyEnter', who: enemyRef(), name: host.battle.enemy.name });
    if (burn > 0) {
      push({ t: 'rule', rule: 'ember_carry', who: enemyRef(), stacks: burn });
      asRule('ember_carry', () => { host.battle.enemy.buffs.burn = burn; });
    }
  }
  /* H frenzy is checked when the player's turn starts, so the announced damage already includes it. */
  function checkFrenzy() {
    const enemy = host.battle.enemy;
    if (!hasAffix(enemy, 'frenzy') || enemy.frenzied || enemy.hp <= 0 || enemy.hp > enemy.maxHp / 2) return;
    enemy.frenzied = true;
    for (const k of ['atk', 'matk', 'baseAtk', 'baseMatk']) enemy[k] = Math.floor(enemy[k] * 1.5);
    push({ t: 'rule', rule: 'frenzy', who: enemyRef() });
  }
  function settle() {
    for (let guard = 0; guard < 200; guard++) {
      flush();
      if (B.outcome) return;
      if (B.pendingNext) {
        B.pendingNext = null; B.timers.length = 0;
        nextEnemy();
        if (B.carry > 0) {                    // G overflow: what was left of the last hit goes on
          const carry = B.carry; B.carry = 0;
          push({ t: 'rule', rule: 'overflow', who: enemyRef(), amount: carry });
          asRule('overflow', () => { host.battle.enemy.hp -= carry; });
          if (host.battle.enemy.hp <= 0) { host.battle.phase = 'enemy-pending'; host.winBattle(); continue; }
        }
        TM.endEnemyTurn(host);      // the newcomer spends this turn entering, so its first action is always announced
        continue;
      }
      if (B.timers.length) { B.timers.shift()(); continue; }
      break;
    }
    if (B.awaiting) {
      checkFrenzy();
      flush();
      const intent = currentIntent();
      if (pattern) Object.assign(intent, { type: intent.kind, damageRange: intent.dmg ?? [0, 0] });
      const wait = { t: 'await', who: allyRef(host.battle.currentPlayerIdx), intent, countdown: countdown() };
      if (region === 'twilight_bell') {
        const turn = host.battle.turn;
        const next = Math.min(...bellTurns.filter(n => n > turn));
        wait.region = { bellIn: Number.isFinite(next) ? next - turn : null };
      } else if (region === 'arena_charge') {
        wait.region = { charge: B.charge, ready: B.charge === 2 };
      }
      push(wait);
    }
  }
  function run(fn) {
    const saved = Math.random, outer = active, critMult = core.GAME_CONSTANTS.BASE_CRIT_MULT;
    Math.random = rng; active = B; B.events = []; B.awaiting = false;
    if (Q.critMult) core.GAME_CONSTANTS.BASE_CRIT_MULT = Q.critMult;
    try { fn(); settle(); } finally { Math.random = saved; active = outer; core.GAME_CONSTANTS.BASE_CRIT_MULT = critMult; }
    return B.events;
  }

  /* ---------- player options ---------- */
  function currentPlayer() { return host.battle.players[host.battle.currentPlayerIdx]; }
  function actionSkills(player) {
    return [host.NORMAL_ATTACK].concat(player.skills).flatMap(skill => {
      const choice = (skill.effects || []).find(effect => effect.type === 'transform_choice');
      if (!choice) return [skill];
      return choice.forms.map(formId => Object.assign({}, skill, { chosenFormId: formId }));
    });
  }
  function chargedSkill(skill) {
    return region === 'arena_charge' && B.charge === 2 && skill !== host.NORMAL_ATTACK && isAttack(skill);
  }
  function previewSkill(player, skill) {
    const delay = core.findDelayedSkillEffect?.(skill);
    const instant = !!delay && BattleRuntime.hasActiveTrait(host, 'instant_delayed_skills');
    if (!isAttack(skill)) return instant ? { instant, dmg: 0 } : null;
    if (delay && !instant) return { delayed: true };
    const b = host.battle, saved = Math.random, outer = active, critMult = core.GAME_CONSTANTS.BASE_CRIT_MULT;
    let enemy = b.enemy, attack = skill;
    if (instant) attack = instantDamageSkill(skill, delay);
    if (skill === host.NORMAL_ATTACK) {
      if (host.hasArtifact('divine_ares')) attack = { ...skill, val: 2.5 };
      else if (host.hasArtifact('double_attack')) attack = { ...skill, val: 2 };
      const trait = player.proto.trait.type;
      if (trait === 'normal_attack_burn_divine' || trait === 'syn_fire_3_crit_burn') {
        enemy = { ...enemy, buffs: { ...enemy.buffs } };
        StatusRules.add(enemy, 'burn', 1, host.state.artifacts);
        if (trait === 'normal_attack_burn_divine') StatusRules.add(enemy, 'divine', 1, host.state.artifacts);
      }
    }
    const random = attack.effects?.some(effect => RANDOM_DAMAGE.includes(effect.type));
    const hits = instant && Array.isArray(delay.turns) ? delay.turns.length : 1;
    const damage = roll => {
      let first = true;
      Math.random = () => {
        if (!first) return roll;
        first = false;
        return 1 - Number.EPSILON; // No chance crit. Guaranteed crits still apply.
      };
      const result = original.calc.call(Logic, player, enemy, attack, b.fieldBuffs, b.activeTraits, null,
        host.state.mode, host.state.deck, b.turn, host.state.artifacts);
      const hit = tideDamage(result.dmg, tideVulnerability(enemy));
      return { hit, total: hit * (hits + Number(chargedSkill(skill))), forcedCrit: !!result.isCrit };
    };
    active = B; B.probing = true;
    if (Q.critMult) core.GAME_CONSTANTS.BASE_CRIT_MULT = Q.critMult;
    try {
      const middle = damage(0.5);
      const preview = { dmg: middle.total, kill: middle.total >= enemy.hp, forcedCrit: middle.forcedCrit };
      if (instant) preview.instant = true;
      if (random) {
        preview.min = damage(0).total;
        preview.max = damage(1 - Number.EPSILON).total;
        preview.kill = preview.min >= enemy.hp;
      } else if (hits > 1) {
        // Later hits can change with the effects of earlier hits.
        preview.kill = middle.hit * (1 + Number(chargedSkill(skill))) >= enemy.hp;
      }
      return preview;
    } finally { Math.random = saved; B.probing = false; active = outer; core.GAME_CONSTANTS.BASE_CRIT_MULT = critMult; }
  }
  function previewDefense(player, skill) {
    const effect = (skill.effects || []).find(e => e.type === 'buff' && DEFENSE_BUFFS.includes(e.id));
    if (!effect) return null;
    const kind = effect.id;
    const source = { ...player, buffs: { ...player.buffs } };
    SideEffects.apply({ source, skill }, effect);
    let reduction = 1;
    if (kind === 'guard') reduction = StatusRules.guardReduction(source);
    else if (kind === 'damage_half') reduction = StatusRules.damageReduction({ buffs: { damage_half: source.buffs.damage_half } }).rate;
    else if (kind === 'evasion') {
      const b = host.battle;
      const stats = Logic.calculateStats(source, b.fieldBuffs, host.state.mode, host.state.artifacts, b.turn);
      reduction = Math.max(0, Math.min(1, stats.evasion / 100));
    }
    return { kind, reduction };
  }
  function nextAlly() {
    return players().find(p => !p.isDead && p.pos > host.battle.currentPlayerIdx);
  }
  function canRetreat() {
    return B.awaiting && !B.retreatUsed && !B.outcome && !!nextAlly();
  }
  function survivors() { return host.battle.players.map(p => !!p && (!p.isDead || !!p.retreated)); }
  function heirloomsGained() { return structuredClone(B.gained); }
  function betWon() {
    if (B.outcome !== 'win') return false;
    if (bet.kind === 'empty_sky') return !B.fieldSeen;
    if (bet.kind === 'same_grade_full') {
      const grades = host.state.deck.map(id => id && GameUtils.getCardById(id).grade);
      return !!grades[0] && grades.every(grade => grade === grades[0]);
    }
    return B.betMet;
  }

  return {
    host,
    quirk,
    start() {
      return run(() => {
        host.battle = {}; B.prev = null;
        const init = host.renderBattleView;
        let ready = false;
        // set units up after they are built and before the first turn is decided
        host.renderBattleView = function () {
          if (!ready && host.battle.players && host.battle.enemy) {
            ready = true; setupAllies(); setupEnemy(host.battle.enemy);
            applyStart();
            B.prev = snapshot();                                      // the set-up values are the starting point, not a change
            B.events[0].s = B.prev;
          }
          return init.apply(this, arguments);
        };
        try { BattleRuntime.startBattleInit(host); } finally { host.renderBattleView = init; }
        if (host.battle.enemy) host.battle.enemy.relayEnteredTurn = 1;
      });
    },
    act(index) {
      if (!B.awaiting || B.outcome) return [];
      const player = currentPlayer(), skill = actionSkills(player)[index];
      if (!skill || player.mp < (skill.cost || 0)) return [];
      const events = run(() => { BattleRuntime.executeSkill(host, player, host.battle.enemy, skill); });
      if (skill.heirloom) player.skills = player.skills.filter(s => s !== skill);  // once per battle
      return events;
    },
    retreat() {
      if (!canRetreat()) return [];
      return run(() => {
        const b = host.battle, player = currentPlayer(), next = nextAlly();
        const [minimum] = currentIntent().dmg || [0];
        B.rescues.push({ retreated: host.state.deck[player.pos], incoming: host.state.deck[next.pos], lethal: player.hp <= minimum });
        player.isDead = true; player.retreated = true;        // the core skips it; death traits never run
        B.retreatUsed = true;
        push({ t: 'retreat', who: allyRef(player.pos) });
        b.currentPlayerIdx = next.pos;
        checkLastStand();
        b.phase = 'player-ready';
        TM.endPlayerTurn(host);                                // leaving costs the turn: the enemy acts on the newcomer
      });
    },
    previewRetreat() {
      if (!canRetreat()) return null;
      const player = nextAlly();
      const intent = currentIntent(player, false);
      return { next: allyRef(player.pos), intent, dmg: intent.dmg || [0, 0], lethal: !!intent.lethal };
    },
    options() {
      if (!B.awaiting || B.outcome) return [];
      const player = currentPlayer();
      return actionSkills(player).map((skill, index) => ({
        index, name: skill.chosenFormId ? skill.name + ' → ' + GameUtils.getCardById(skill.chosenFormId).name : skill.name,
        type: skill.type, tier: skill.tier || 1, cost: skill.cost || 0,
        usable: player.mp >= (skill.cost || 0), effects: skill.effects || [], val: skill.val,
        heirloom: !!skill.heirloom, heirFrom: skill.heirFrom || null, heirFromName: skill.heirFromName || null,
        preview: previewSkill(player, skill), defense: previewDefense(player, skill)
      }));
    },
    canRetreat,
    get retreatUsed() { return B.retreatUsed; },
    get outcome() { return B.outcome; },
    get awaiting() { return B.awaiting && !B.outcome; },
    get enemyIndex() { return B.enemyIdx; },
    enemyCount: queue.length,
    state() { return snapshot(); },
    /** Units that are still alive when the battle ends (retreated fighters count as alive). */
    survivors,
    /** Heirlooms handed on in this battle, including the donor's form and the inherited skill. */
    heirloomsGained,
    summary() {
      return {
        outcome: B.outcome,
        survivors: survivors(),
        retreated: host.battle.players.map(p => !!p?.retreated),
        rescues: B.rescues.map(rescue => ({ ...rescue })),
        heirloomsGained: heirloomsGained(),
        heirloomsUsed: B.heirloomsUsed,
        heirloomKills: B.heirloomKills,
        lastStands: Number(B.lastStandDone),
        enemyDowns: B.enemyDowns.map(down => ({ ...down })),
        bestHit: B.bestHit && { ...B.bestHit },
        turns: host.battle.turn,
        bet: bet ? { kind: bet.kind, won: betWon() } : null
      };
    }
  };
}
