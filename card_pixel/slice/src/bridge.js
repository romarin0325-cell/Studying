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
     G  quirks                one battle-wide rule twist per door (QUIRKS below)
     H  affixes               enemy modifiers that give ordinary fights a readable twist (AFFIXES)
   Works in the browser and in a Node vm (tests, balance sim). */
(function (root) {
  'use strict';

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const strip = html => String(html).replace(/<[^>]*>/g, '');

  /* G. Battle-wide twists shown on the door before the player picks it. Each one bends the
     numbers toward excess on both sides; `foe` scales the enemies so the twist is not free. */
  const QUIRKS = {
    glass: { name: '유리 대포', desc: '모두의 공격력·마법공격력 +60%, 방어력 0', foe: { atk: 1.6, def: 0 }, ally: { atk: 1.6, def: 0 } },
    overheat: { name: '과열', desc: '아군 치명타율 +20%, 치명타 피해 3배. 적 공격력 +25%', foe: { atk: 1.25 }, ally: { crit: 20 }, critMult: 3.0 },
    surge: { name: '마나 폭주', desc: '아군 MP 200으로 시작. 적 HP +35%', foe: { hp: 1.35 }, ally: { mp: 200 } },
    starfall: { name: '별의 비', desc: '매 턴 시작에 하늘에 무작위 필드 버프가 걸린다' },
    overflow: { name: '넘침', desc: '적이 한 명 더 나온다. 쓰러뜨리고 남은 피해는 다음 적에게 넘어간다' },
    martyr: { name: '순교', desc: '아군이 쓰러질 때마다 남은 아군 공격력·마법공격력 +40%' },
    echo: { name: '메아리', desc: '아군의 3티어 공격이 절반 위력으로 한 번 더 울린다. 적 HP +20%', foe: { hp: 1.2 } }
  };
  /* H. Enemy modifiers. They replace "weaker numbers" as the way ordinary fights differ. */
  const AFFIXES = {
    tough: { name: '단단함', desc: '처음 3턴 동안 받는 피해 절반' },
    frenzy: { name: '광폭', desc: 'HP가 절반 이하가 되면 다음 턴부터 공격력 1.5배' },
    leech: { name: '흡혈', desc: '준 피해의 절반만큼 HP 회복' },
    thorns: { name: '가시', desc: '물리 공격한 아군이 준 피해의 25%를 돌려받는다 (HP 1 아래로는 안 내려간다)' },
    treasure: { name: '보물', desc: '쓰러뜨리면 꿈의 결정 +2' }
  };
  const FIELD_POOL = ['sun_bless', 'moon_bless', 'sanctuary', 'goddess_descent', 'earth_bless', 'twinkle_party', 'star_powder', 'valentine', 'arena', 'reaper_realm', 'gale'];

  /** The attack a fallen fighter hands on: the strongest physical or magic skill, free of MP and at 1.5x power. */
  const HEIRLOOM_POWER = 1.5;
  function heirloomSkill(proto) {
    const attacks = (proto.skills || []).filter(s => s.type === 'phy' || s.type === 'mag');
    if (!attacks.length) return null;
    const power = s => (s.tier || 1) * 10 + (Number.isFinite(s.val) ? s.val : 1);
    const best = attacks.slice().sort((x, y) => power(y) - power(x))[0];
    const skill = Object.assign(JSON.parse(JSON.stringify(best)), { cost: 0, heirloom: true, heirFrom: proto.id, heirFromName: proto.name });
    if (Number.isFinite(skill.val)) skill.val = Math.round(skill.val * HEIRLOOM_POWER * 100) / 100;
    return skill;
  }

  let active = null;        // battle that is inside a core call right now
  let original = null;      // unpatched core functions

  root.__relayCoreTimer = function (fn) { if (active) active.timers.push(fn); return 0; };

  /* The core calls its own functions through the BattleRuntime / Logic objects, so replacing
     the properties once lets every battle observe them. Battles without a bridge are untouched. */
  function installHooks(core) {
    if (original) return;
    const { Logic, BattleRuntime } = core;
    const TM = BattleRuntime.TurnManager;
    original = { decide: Logic.decideEnemyAction, calc: Logic.calculateDamage };

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
  }

  function create(core, opts) {
    installHooks(core);
    const { BattleRuntime, Logic, GameUtils, getMaxMana, buildBattleEnemy } = core;
    const TM = BattleRuntime.TurnManager;
    const rng = mulberry32(opts.seed == null ? Math.floor(Math.random() * 4294967296) : opts.seed);
    const queue = opts.enemies.slice();
    const rules = Object.assign({ heirloom: true, lastStand: true }, opts.rules || {});
    const quirk = opts.quirk && QUIRKS[opts.quirk] ? opts.quirk : null;
    const Q = quirk ? QUIRKS[quirk] : {};
    const B = {
      timers: [], events: [], ctx: [], probing: false,
      enemyIdx: 0, awaiting: false, outcome: null, retreatUsed: false,
      pendingNext: null, intentCache: null, lastCalc: null, prev: null,
      lastHit: null, carry: 0, lastStandDone: false, gained: [], turnStartHp: 0
    };

    const host = B.host = {
      __relay: B,
      NORMAL_ATTACK: { name: '일반 공격', type: 'phy', tier: 1, cost: 0, val: 1.0, effects: [] },
      state: {
        deck: opts.party.slice(0, 3).concat([null, null, null]).slice(0, 3),
        mode: 'default', gameType: 'pixel', hardMode: false, enemyScale: 0,
        artifacts: (opts.artifacts || []).slice(), chaosBuffs: (opts.blessings || []).slice()
      },
      battle: {},
      log(msg, kind) {
        const text = strip(msg), hit = /(\d+) 피해/.exec(text);
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
        flush();
        push({ t: 'enemyDown', who: enemyRef(), treasure: hasAffix(host.battle.enemy, 'treasure') });
        if (B.enemyIdx + 1 < queue.length) {
          B.pendingNext = host.battle.phase || 'player-resolving';
          if (quirk === 'overflow') B.carry = Math.max(0, -Math.floor(host.battle.enemy.hp));
        } else { host.battle.isFinished = true; B.outcome = 'win'; push({ t: 'win' }); }
      },
      loseBattle() { flush(); host.battle.isFinished = true; B.outcome = 'lose'; push({ t: 'lose' }); }
    };

    const enemyRef = () => ({ side: 'enemy', idx: B.enemyIdx });
    const allyRef = idx => ({ side: 'ally', idx });
    const refOf = unit => (unit === host.battle.enemy ? enemyRef() : allyRef(unit.pos));
    const localTurn = enemy => host.battle.turn - (enemy.relayEnteredTurn || 1) + 1;
    const isAlly = unit => !!unit && unit !== host.battle.enemy && !!unit.proto;
    const hasAffix = (enemy, id) => !!enemy && Array.isArray(enemy.affixes) && enemy.affixes.includes(id);
    const players = () => (host.battle.players || []).filter(Boolean);

    function push(ev) { ev.s = B.prev; B.events.push(ev); return ev; }

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
      if (!b.players || !b.enemy) return;
      const now = snapshot(), was = B.prev;
      B.prev = now;
      if (!was) return;
      const cause = B.ctx.length ? B.ctx[B.ctx.length - 1] : null;
      const diffUnit = (who, unit, a, z) => {
        if (!a || !z) return;
        if (z.mp !== a.mp) push({ t: 'mp', who, delta: z.mp - a.mp });
        if (z.hp !== a.hp) {
          const ev = { t: 'hp', who, delta: z.hp - a.hp, amount: Math.abs(z.hp - a.hp), cause: describeCause(cause, who) };
          const c = B.lastCalc;
          if (c && c.target === unit && ev.delta < 0) {
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
      if (/^전투 개시/.test(text)) { push({ t: 'begin', enemy: enemyRef(), quirk }); return; }
      const target = b.players && b.players[b.currentPlayerIdx];
      if (/회피 성공/.test(text) && target) push({ t: 'miss', who: allyRef(target.pos), why: 'evasion' });
      else if (/배리어로 방어/.test(text) && target) push({ t: 'miss', who: allyRef(target.pos), why: 'barrier' });
      else if (/매직가드로 방어/.test(text) && target) push({ t: 'miss', who: allyRef(target.pos), why: 'magic_guard' });
      else if (/기절하여 행동 불가/.test(text)) push({ t: 'stunned', who: enemyRef() });
      else if (/기절로 인해 행동 불가/.test(text) && target) push({ t: 'stunned', who: allyRef(target.pos) });
    }

    /* ---------- G/H: setting units up ---------- */
    function setupAllies() {
      for (const p of players()) {
        const a = Q.ally || {};
        if (a.atk) { p.atk = Math.floor(p.atk * a.atk); p.matk = Math.floor(p.matk * a.atk); }
        if (a.def === 0) { p.def = 0; p.mdef = 0; }
        if (a.crit) p.baseCrit = (Number.isFinite(p.baseCrit) ? p.baseCrit : 10) + a.crit;
        if (a.mp) { p.maxMp = a.mp; p.mp = a.mp; }
        const held = rules.heirloom && opts.heirlooms && opts.heirlooms[p.id];
        if (held) {
          const giver = GameUtils.getCardById(held.from), skill = giver && heirloomSkill(giver);
          if (skill) p.skills.push(skill);
        }
      }
    }
    function setupEnemy(enemy) {
      const def = queue[B.enemyIdx] || {};
      enemy.affixes = (def.affixes || []).slice();
      const f = Q.foe || {};
      if (f.hp) { enemy.maxHp = Math.floor(enemy.maxHp * f.hp); enemy.hp = enemy.maxHp; }
      if (f.atk) for (const k of ['atk', 'matk', 'baseAtk', 'baseMatk']) enemy[k] = Math.floor(enemy[k] * f.atk);
      if (f.def === 0) for (const k of ['def', 'mdef', 'baseDef', 'baseMdef']) enemy[k] = 0;
      if (hasAffix(enemy, 'tough')) enemy.buffs.damage_half = 3;
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
          B.gained.push({ to: heir.id, from: victim.id, name: skill.name });
          push({ t: 'heirloom', from: allyRef(victim.pos), to: allyRef(heir.pos), skill: { name: skill.name, type: skill.type, tier: skill.tier || 1 } });
        }
      }
      if (quirk === 'martyr') {
        const alive = players().filter(p => !p.isDead);
        if (alive.length) {
          asRule('martyr', () => alive.forEach(p => { p.atk = Math.floor(p.atk * 1.4); p.matk = Math.floor(p.matk * 1.4); }));
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
      p.atk = Math.floor(p.atk * 1.5); p.matk = Math.floor(p.matk * 1.5);
      p.baseCrit = (Number.isFinite(p.baseCrit) ? p.baseCrit : 10) + 25;
      push({ t: 'laststand', who: allyRef(p.pos) });
    }

    /* ---------- hooks called from the patched core functions ---------- */
    B.onSkill = function (source, target, skill, delayed, go) {
      flush();
      const who = refOf(source);
      push({ t: 'act', who, target: refOf(target), delayed, heirloom: !!skill.heirloom, skill: { name: skill.name, type: skill.type, tier: skill.tier || 1, cost: skill.cost || 0, val: skill.val, effects: (skill.effects || []).map(e => e.type) } });
      B.ctx.push({ kind: 'act', who, skill, delayed });
      B.lastHit = null;
      try {
        const result = go();
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
      if (quirk === 'starfall' && b.isNewTurn && b.enemy && b.enemy.hp > 0) {
        const have = (b.fieldBuffs || []).map(f => f.name), pool = FIELD_POOL.filter(id => !have.includes(id));
        if (pool.length) {
          const id = pool[Math.floor(Math.random() * pool.length)];
          push({ t: 'rule', rule: 'starfall', id });
          asRule('starfall', () => BattleRuntime.applyFieldBuff(host, id));
        }
      }
      return go();
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
      const cache = B.intentCache;
      let action;
      if (cache && cache.enemy === enemy && cache.turn === host.battle.turn) action = cache.action;
      else action = original.decide.call(Logic, enemy, localTurn(enemy));
      B.intentCache = null;
      const top = B.ctx[B.ctx.length - 1];
      if (top && top.enemyTurn) top.skill = action;
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
      const stats = Logic.calculateStats(source, b.fieldBuffs, host.state.mode, host.state.artifacts, b.turn);
      B.lastHit = { source, target, dmg: result.dmg };
      B.lastCalc = {
        target,
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
    const isScripted = action => !!action && action.name !== '일반 공격' && (action.rate === 0 || !!action.isChargeStart || !!action.chargeReset);
    function previewEnemyHit(action, target) {
      const b = host.battle, enemy = b.enemy;
      const es = Logic.calculateStats(enemy, b.fieldBuffs, host.state.mode, host.state.artifacts, b.turn);
      const ts = Logic.calculateStats(target, b.fieldBuffs, host.state.mode, host.state.artifacts, b.turn);
      const val = action.type === 'phy' ? es.atk : es.matk;
      const def = action.type === 'phy' ? ts.def : ts.mdef;
      const random = (action.effects || []).find(e => e.type === 'random_mult');
      let lo = Number.isFinite(action.val) ? action.val : 1, hi = lo;
      if (random) { lo = random.min; hi = random.max; }
      const reduce = 1 - core.StatusRules.damageReduction(target).rate;
      const hit = m => Math.floor(Math.floor(val * m * (100 / (100 + def))) * reduce);
      let range = [hit(lo), hit(hi)];
      if (enemy.id === 'pharaoh' && action.name === '고대의저주') range = [hit(lo), hit(3.0)];   // x3 if it was hit this turn
      return range;
    }
    function currentIntent() {
      const b = host.battle, enemy = b.enemy, target = b.players[b.currentPlayerIdx];
      if (enemy.buffs.stun) return { kind: 'stun', name: '기절', ult: false };
      let cache = B.intentCache;
      if (!cache || cache.enemy !== enemy || cache.turn !== b.turn) {
        cache = B.intentCache = { enemy, turn: b.turn, action: original.decide.call(Logic, enemy, localTurn(enemy)) };
      }
      const a = cache.action;
      if (a.isChargeStart) return { kind: 'charge', name: a.name, ult: true };
      if (a.type !== 'phy' && a.type !== 'mag') return { kind: 'sup', name: a.name, ult: isScripted(a), effects: (a.effects || []).map(e => e.type) };
      const dmg = previewEnemyHit(a, target);
      return {
        kind: a.type, name: a.name, ult: isScripted(a), dmg, lethal: dmg[1] >= target.hp,
        extra: (a.effects || []).map(e => e.type).filter(t => t !== 'random_mult')
      };
    }
    function countdown() {
      const enemy = host.battle.enemy, local = localTurn(enemy);
      const saved = Math.random;
      B.probing = true; Math.random = () => 0.999;   // random branches fall through, scripted turns remain
      try {
        for (let k = 0; k <= 14; k++) {
          const a = original.decide.call(Logic, Object.assign({}, enemy), local + k);
          if (isScripted(a)) return { name: a.name.replace(/ 차징$/, ''), inTurns: k, charge: !!a.isChargeStart };
        }
      } finally { Math.random = saved; B.probing = false; }
      return null;
    }

    /* ---------- stepping ---------- */
    function nextEnemy() {
      B.enemyIdx++;
      host.battle.enemy = buildBattleEnemy(host);
      setupEnemy(host.battle.enemy);
      host.battle.enemy.relayEnteredTurn = host.battle.turn + 1;   // its own turn count starts with its first action
      B.prev = snapshot();
      push({ t: 'enemyEnter', who: enemyRef(), name: host.battle.enemy.name });
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
        push({ t: 'await', who: allyRef(host.battle.currentPlayerIdx), intent: currentIntent(), countdown: countdown() });
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
    function skillAt(index) { const p = currentPlayer(); return index === 0 ? host.NORMAL_ATTACK : p.skills[index - 1]; }
    function previewSkill(player, skill) {
      if (skill.type !== 'phy' && skill.type !== 'mag') return null;
      if (core.findDelayedSkillEffect && core.findDelayedSkillEffect(skill)) return { delayed: true };
      const b = host.battle, saved = Math.random, outer = active, critMult = core.GAME_CONSTANTS.BASE_CRIT_MULT;
      let first = true;
      active = B; B.probing = true;
      Math.random = () => { if (first) { first = false; return 0.9999; } return 0.5; };   // no crit, mid roll for random parts
      try {
        const r = original.calc.call(Logic, player, b.enemy, skill, b.fieldBuffs, b.activeTraits, null,
          host.state.mode, host.state.deck, b.turn, host.state.artifacts);
        return { dmg: r.dmg, kill: r.dmg >= b.enemy.hp, forcedCrit: !!r.isCrit };
      } finally { Math.random = saved; B.probing = false; active = outer; core.GAME_CONSTANTS.BASE_CRIT_MULT = critMult; }
    }
    function canRetreat() {
      if (!B.awaiting || B.retreatUsed || B.outcome) return false;
      const b = host.battle;
      return b.players.some(p => p && !p.isDead && p.pos > b.currentPlayerIdx);
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
              B.prev = snapshot();                                      // the set-up values are the starting point, not a change
              const begin = B.events.filter(e => e.t === 'begin').pop();
              if (begin) begin.s = B.prev;
            }
            return init.apply(this, arguments);
          };
          try { BattleRuntime.startBattleInit(host); } finally { host.renderBattleView = init; }
          if (host.battle.enemy) host.battle.enemy.relayEnteredTurn = 1;
        });
      },
      act(index) {
        if (!B.awaiting || B.outcome) return [];
        const player = currentPlayer(), skill = skillAt(index);
        if (!skill || player.mp < (skill.cost || 0)) return [];
        const events = run(() => { BattleRuntime.executeSkill(host, player, host.battle.enemy, skill); });
        if (skill.heirloom) player.skills = player.skills.filter(s => s !== skill);   // once per battle
        return events;
      },
      retreat() {
        if (!canRetreat()) return [];
        return run(() => {
          const b = host.battle, player = currentPlayer();
          player.isDead = true; player.retreated = true;        // the core skips it; death traits never run
          B.retreatUsed = true;
          push({ t: 'retreat', who: allyRef(player.pos) });
          while (b.currentPlayerIdx < b.players.length && (!b.players[b.currentPlayerIdx] || b.players[b.currentPlayerIdx].isDead)) b.currentPlayerIdx++;
          checkLastStand();
          b.phase = 'player-ready';
          TM.endPlayerTurn(host);                                // leaving costs the turn: the enemy acts on the newcomer
        });
      },
      options() {
        if (!B.awaiting || B.outcome) return [];
        const player = currentPlayer();
        return [host.NORMAL_ATTACK].concat(player.skills).map((skill, index) => ({
          index, name: skill.name, type: skill.type, tier: skill.tier || 1, cost: skill.cost || 0,
          usable: player.mp >= (skill.cost || 0), effects: skill.effects || [], val: skill.val,
          heirloom: !!skill.heirloom, heirFrom: skill.heirFrom || null, heirFromName: skill.heirFromName || null,
          preview: previewSkill(player, skill)
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
      survivors() { return host.battle.players.map(p => !!p && (!p.isDead || !!p.retreated)); },
      /** Heirlooms handed on in this battle: [{ to, from, name }] (card ids). */
      heirloomsGained() { return B.gained.slice(); }
    };
  }

  root.RelayBridge = { create, mulberry32, QUIRKS, AFFIXES, heirloomSkill, HEIRLOOM_POWER };
})(typeof window !== 'undefined' ? window : globalThis);
