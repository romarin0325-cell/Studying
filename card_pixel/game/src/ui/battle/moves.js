import { $$ } from '../dom.js';
import { FIELD, GOOD } from './hud.js';
import { contactOffset, isBigMove, resolveMotion, spriteBox } from './motion.js';

export function createMoves({ stage: St, sfx, actorOf, unitOf, colorsOf, applyHp, card, spr }) {
  const { S, clock, wait, tween, footY: FY, headY: HY, chestY: CY, reducedMotion } = St;

  const label = (text, actor, cls, dy) => St.number(text, St.X(actor), HY(actor) - 4 + (dy || 0), 'tag ' + (cls || ''));

  function beginMove(e, actor, isFoe) {
    const p = { e, actor, target: e.target ? actorOf(e.target) : null, kind: e.skill.type, isFoe, stage: 'ready', colors: colorsOf(e.who) };
    const donor = e.heirloom && e.heirFrom && card(e.heirFrom);
    if (donor) {
      p.donor = donor;
      p.colors = St.ELEMENT_COLORS[donor.element] || St.ELEMENT_COLORS.none;
      const art = spr(donor.id);
      if (art) {
        p.caster = actor;
        p.casterVisible = actor.vis;
        actor.vis = false;
        p.actor = St.makeActor({ sprite: donor.id, x: actor.x, y: actor.y, flip: art.facing === 'left' });
      }
    }
    p.motionInput = {
      sourceKey: e.sourceKey, skill: e.skill, side: e.who.side, heirloom: e.heirloom,
      salience: e.salience ?? (e.ult ? 'boss' : undefined),
      isBasic: p.kind === 'phy' && e.skill.name === '일반 공격', casterSprite: p.actor.sprite
    };
    p.motion = resolveMotion(p.motionInput);
    if (donor && !isMelee(p)) p.effectSprite = St.variant(donor.id + '-fx', 'base');
    return p;
  }

  const isMelee = p => p.motion?.range === 'melee';

  function impact(e, o, stats) {
    const actor = actorOf(e.who), unit = unitOf(e.who), isAlly = e.who.side === 'ally';
    applyHp(e);
    if (!actor) return;
    const ratio = e.amount / unit.maxHp, big = ratio >= 0.3 || o.crit || o.big;
    actor.pose = 'hurt';
    if (!reducedMotion()) {
      actor.white = o.melee ? 0.04 : 0.09;
      if (!o.melee) {
        actor.ox = (isAlly ? -1 : 1) * 4;
        tween(actor, { ox: 0 }, 0.25);
        S.shake = Math.max(S.shake, Math.min(7, 1 + ratio * 12 + (o.crit ? 2 : 0)));
        if (o.crit) S.flash = Math.max(S.flash, 0.5);
        St.sparks(St.X(actor), CY(actor), big ? 22 : 8, o.colors || St.ELEMENT_COLORS.none, big ? 100 : 50);
      }
    }
    const text = (o.prefix || '') + (o.label ?? e.amount.toLocaleString('en-US')) + (o.adv ? ' ▲' : '');
    St.number(text, St.X(actor), HY(actor) - (big ? 8 : 2), (o.crit ? 'crit ' : big ? 'big ' : '') + (isAlly ? 'foe' : ''));
    if (o.melee === 'bite') sfx.bite();
    else if (o.melee === 'blade' || o.melee === 'claw' || o.melee === 'thrust') sfx.swing();
    else sfx.hit(o.melee ? o.big : big);
    if (o.crit && !o.melee) sfx.crit();
    if (!isAlly && e.amount > stats.best) stats.best = e.amount;
  }

  /* B. Big common move: name plate, wind-up with a 2x camera punch on the caster, then one
     of six shapes chosen from the skill's own data, then one impact. Quiet moves (A) skip all of it. */
  function isBig(p) {
    return p.motion ? p.motion.size === 'big' : isBigMove(p.motionInput);
  }
  function shapeOf(skill, val) {
    const fx = skill.effects || [];
    if (fx.includes('random_mult') || fx.includes('multi_hit')) return skill.type === 'phy' ? 'flurry' : 'rain';
    if (fx.includes('consume_debuff_all') || fx.includes('consume_field_all')) return 'burst';
    if (fx.includes('self_hp_cost_ratio') || (val ?? skill.val ?? 0) >= 4) return 'meteor';
    return skill.type === 'phy' ? 'dash' : 'beam';
  }
  /* What each sprite's attack frame shows. A move of the other kind lunges or casts from the idle frame. */
  const ATTACK_FRAME = { red_dragon: 'phy', ash: 'mag', flame_sage: 'mag', luna: 'phy', zeke: 'phy', cherry_prince: 'phy', golem: 'phy' };
  const poseFor = ({ actor, kind, motion }) => motion?.frame ??
    (!ATTACK_FRAME[actor.sprite] || ATTACK_FRAME[actor.sprite] === kind ? 'attack' : 'idle');

  async function windUp(p) {
    const { actor, isFoe, colors, donor } = p, dir = isFoe ? -1 : 1, skill = p.e.skill;
    const caster = unitOf(p.e.who).name;
    const who = isFoe && p.e.ult ? '필살' : p.e.heirloom ? '유품 · ' + (donor?.name || caster) : caster;
    actor.front = 1;
    $$('#fx .num').forEach(n => n.remove());
    p.plate = St.plate(who, skill.name, isFoe && p.e.ult ? '#ff6b5e' : p.e.heirloom ? '#ffc857' : colors[1], dir);
    if (reducedMotion()) {
      actor.pose = poseFor(p);
      await wait(0.12);
      return;
    }
    tween(S, { dark: isFoe ? 0.45 : 0.35 }, 0.12);
    sfx.charge();
    actor.pose = isMelee(p) ? 'idle' : poseFor(p); actor.white = 0.06;
    St.converge(St.X(actor) + dir * 10, CY(actor), 18, colors, 34, 0.3);
    await St.punch(St.X(actor) + dir * 14, CY(actor) - 6, 0.18);
  }

  function finishBig(p, x, y) {
    if (!reducedMotion()) {
      S.flash = isMelee(p) ? 0.22 : 0.6; S.shake = 7;
      if (!isMelee(p)) {
        St.ring(x, y, p.colors[0], 40);
        St.sparks(x, y, 34, p.colors, 130);
      }
      tween(S, { dark: 0 }, 0.3);
    }
    if (p.plate) {
      if (isMelee(p)) wait(0.45).then(() => p.plate.remove());
      else setTimeout(() => p.plate.remove(), 450);
    }
  }

  async function bigMove(p) {
    const { actor, target, isFoe, colors, donor } = p, dir = isFoe ? -1 : 1, skill = p.e.skill;
    await windUp(p);
    if (reducedMotion()) {
      finishBig(p);
      p.stage = 'hit';
      return;
    }
    const tx = St.X(target), ty = CY(target);
    if (p.effectSprite) St.fly(St.X(actor) + dir * 14, CY(actor), tx, ty, 0.28, colors[1], 16, 2, null, p.effectSprite);
    const original = donor?.skills.find(s => s.name === skill.name && s.type === skill.type);
    const shape = shapeOf(skill, original && (original.val ?? 0));
    if (shape === 'beam') {
      const x0 = St.X(actor) + dir * 16, y = CY(actor) - 4;
      const orb = St.prop({ kind: 'orb', x: x0, y, r: 2, colors });
      await tween(orb, { r: 6 }, 0.12); St.dropProp(orb);
      const bm = St.prop({ kind: 'beam', x0, x1: x0, y, h: 1, colors, flare: true });
      sfx.beam(); await tween(bm, { x1: tx, h: 6 }, 0.1, 'in');
      for (let i = 0; i < 26; i++) St.fly(x0, y + (Math.random() - 0.5) * 8, tx + (Math.random() - 0.5) * 10, ty + (Math.random() - 0.5) * 16, 0.12 + Math.random() * 0.12, colors[i % 3], 2, i % 4 ? 1 : 2);
      await tween(bm, { h: 8 }, 0.18);
      tween(bm, { h: 0, a: 0 }, 0.14).then(() => St.dropProp(bm));
    } else if (shape === 'meteor') {
      const m = St.prop({ kind: 'meteor', x: tx - dir * 110, y: -20, r: 11, colors, trail: [] });
      sfx.beam(); await tween(m, { x: tx, y: ty }, 0.38, 'in'); St.dropProp(m);
      const bu = St.prop({ kind: 'burst', x: tx, y: ty, r: 4, colors });
      tween(bu, { r: 22, a: 0 }, 0.32).then(() => St.dropProp(bu)); sfx.boom();
    } else if (shape === 'rain') {
      for (let i = 0; i < 5; i++) {
        const m = St.prop({ kind: 'meteor', x: tx - dir * (60 + i * 10), y: -16 - i * 6, r: 5, colors, trail: [] });
        const job = tween(m, { x: tx - 14 + i * 7, y: ty - 6 + (i % 2) * 12 }, 0.22, 'in').then(() => { St.dropProp(m); St.sparks(m.x, m.y, 6, colors, 50); sfx.hit(false); S.shake = 3; });
        if (i === 4) await job; else await wait(0.07);
      }
    } else if (shape === 'burst') {
      for (let i = 0; i < 12; i++) St.fly(tx + (Math.random() - 0.5) * 40, ty - 30 - Math.random() * 20, tx, ty, 0.2 + Math.random() * 0.1, colors[i % 3], 6, 2);
      await wait(0.24);
      const bu = St.prop({ kind: 'burst', x: tx, y: ty, r: 3, colors });
      sfx.boom(); await tween(bu, { r: 20 }, 0.16); tween(bu, { r: 24, a: 0 }, 0.2).then(() => St.dropProp(bu));
    } else {                                     // dash / flurry: afterimages, a pass through the target, clean cuts
      const x0 = St.X(actor), through = tx + dir * 26, n = shape === 'flurry' ? 4 : 2;
      for (let i = 0; i < 4; i++) {
        const g = St.prop({ kind: 'ghost', sprite: actor.sprite, key: actor.sprite + '-' + actor.pose, look: actor.look === 'base' ? 'white' : actor.look, flip: actor.flip, x: x0 + (through - x0) * (i / 4), footY: FY(actor), a: 0.15 + i * 0.1 });
        tween(g, { a: 0 }, 0.35).then(() => St.dropProp(g));
      }
      sfx.swing(); await tween(actor, { ox: through - actor.x, oy: (FY(target) - FY(actor)) }, 0.08, 'in');
      for (let i = 0; i < n; i++) {
        const c = St.prop({ kind: 'cut', x: tx, y: ty - 4 + i * 5, len: 46 - i * 4, ang: (i % 2 ? -0.55 : 0.55) * dir + (i * 0.2), t: 0, a: 1, color: colors[i % 3] });
        tween(c, { t: 1 }, 0.07).then(() => tween(c, { a: 0 }, 0.18)).then(() => St.dropProp(c));
        sfx.swing(); await wait(shape === 'flurry' ? 0.07 : 0.06);
      }
    }
    finishBig(p, tx, ty);
    p.stage = 'hit';
  }
  async function quietMove(p) {
    const { actor, target, isFoe, colors } = p, dir = isFoe ? -1 : 1;
    actor.pose = poseFor(p);
    p.stage = 'hit';
    if (reducedMotion()) return;
    if (p.kind === 'phy') {
      sfx.swing(); await tween(actor, { ox: dir * (actor.pose === 'attack' ? 14 : 22), oy: (FY(target) - FY(actor)) * 0.5 }, 0.1, 'in');
      St.slash(St.X(target) - dir * 6, CY(target) - 8, colors[0], dir);
    } else {
      sfx.cast();
      const fromX = St.X(actor) + dir * 18, fromY = CY(actor) - 6;
      for (let i = 0; i < 12; i++) St.fly(fromX, fromY, St.X(target) - 8 + Math.random() * 16, CY(target) - 10 + Math.random() * 24, 0.16 + Math.random() * 0.1, colors[i % 3], 6, i % 4 ? 1 : 2);
      await wait(0.22);
    }
  }

  async function meleeMove(p, landed) {
    const { actor, target, isFoe, colors, motion } = p;
    const dir = isFoe ? -1 : 1, big = isBig(p), still = reducedMotion();
    if (big && !still) await windUp(p);
    // The HP event switches the target to hurt on this same frame.
    const casterMeta = St.meta(actor, motion.frame), targetMeta = St.meta(target, landed ? 'hurt' : target.pose);
    if (!still) {
      const offset = contactOffset({ caster: actor, target, casterMeta, targetMeta, dir });
      await tween(actor, offset, big ? 0.1 : 0.12, 'in');
      actor.pose = motion.frame;
    }

    const from = spriteBox(actor, still ? St.meta(actor) : casterMeta, S.BASE);
    const to = spriteBox(target, targetMeta, S.BASE);
    const near = dir > 0 ? to.left : to.right;
    const x = near + dir * 2;
    const low = motion.socket === 'foot' || motion.variant === 'scythe';
    const floor = Math.round(to.feet);
    const hand = Math.round(from.top + from.height * 0.63);
    const body = Math.round(to.top + to.height * 0.64);
    const y = low ? floor - (motion.variant === 'stomp' ? 5 : 14) :
      Math.min(to.bottom - 7, Math.max(body, still ? body : hand + (motion.variant === 'uppercut' ? -4 : 0)));
    const tip = { x: still ? x : dir > 0 ? from.right : from.left };
    const duration = still ? 0.09 : big ? 0.22 : 0.135;
    p.stage = 'hit';
    if (big) finishBig(p, x, y);
    const tint = motion.tint && St.ELEMENT_COLORS[motion.tint];
    const fx = St.prop({ kind: 'meleeFx', family: motion.family, variant: motion.variant, x, y, tip, floor, dir, colors: tint || colors,
      big, basic: p.motionInput.isBasic, still, landed, start: clock.t, duration });
    p.hitHold = wait(duration).then(() => St.dropProp(fx));
  }

  function deliver(p, landed) {
    if (isMelee(p)) return meleeMove(p, landed);
    return isBig(p) ? bigMove(p) : quietMove(p);
  }

  async function strikeAndHit(p, step, stats, hasEffects, finishHit) {
    const e = step.event;
    p.actor.front = 1;
    if (p.stage === 'ready') await deliver(p, true);
    p.hitAt = clock.t;
    if (finishHit) {
      p.finishing = true;
      await finishHit(e);
      await p.hitHold;
      return;
    }
    const calc = e.calc || {};
    impact(e, { crit: !!calc.crit, adv: !!calc.adv, colors: p.colors, big: isBig(p),
      label: step.label, melee: isMelee(p) && p.motion.family }, stats);
    if (p.hitHold) await p.hitHold;
    else if (!hasEffects) await wait(0.14);
  }
  async function strikeMiss(p, why) {
    const { actor, target, isFoe } = p, dir = isFoe ? -1 : 1;
    actor.front = 1;
    await deliver(p, false);
    if (why === 'evasion') {
      if (!reducedMotion()) tween(target, { ox: dir * 10 }, 0.08).then(() => tween(target, { ox: 0 }, 0.2));
      label('회피!', target, 'good'); sfx.miss();
    } else {
      St.ring(St.X(target), CY(target), why === 'barrier' ? '#ffc857' : '#8ea2ff', 28, 0.3, reducedMotion());
      label(why === 'barrier' ? '배리어 무효!' : '매직가드 무효!', target, 'good'); sfx.guard();
    }
    await wait(0.3);
  }
  async function settleMove(p) {
    try {
      if (p.stage === 'ready' && p.e.salience === 'boss' && p.target) {
        await deliver(p, false);
        await p.hitHold;
      }
      if (p.stage === 'ready') { p.actor.pose = poseFor(p); await wait(0.12); }
      if (p.finishing || reducedMotion()) Object.assign(p.actor, { ox: 0, oy: 0 });
      else await tween(p.actor, { ox: 0, oy: 0 }, 0.1);
      p.actor.pose = 'idle'; p.actor.front = 0;
      const t = p.target, tu = p.e.target && unitOf(p.e.target);
      if (t && tu && tu.hp > 0 && t.pose === 'hurt') t.pose = 'idle';
      if (S.dark > 0.01) tween(S, { dark: 0 }, 0.2);
    } finally {
      if (p.caster) {
        St.removeActor(p.actor);
        p.caster.vis = p.casterVisible;
      }
    }
  }

  async function showEffects(plan, fieldSlot) {
    if (!plan.length) return;
    const fields = [], recipients = new Map();
    for (const effect of plan) {
      if (effect.at === 'field') {
        fields.push(effect);
        continue;
      }
      const actor = actorOf(effect.who);
      if (!actor?.vis) continue;
      if (effect.kind === 'delay') {
        label(effect.label, actor, 'good');
        continue;
      }
      const list = recipients.get(actor) ?? [];
      list.push(effect);
      recipients.set(actor, list);
    }
    if (fields.length) {
      const colors = fields.flatMap(effect => effect.kind === 'field-add' ? effect.ids.map(id => FIELD[id]?.[1] || '#ccc') : []);
      St.fieldNotice(fieldSlot, fields.map(effect => effect.label).join(' / '), colors);
      sfx.buff();
    }
    const still = reducedMotion();
    for (const [actor, buffs] of recipients) {
      const ids = buffs.flatMap(effect => effect.ids);
      const good = ids.some(id => GOOD.includes(id));
      label(buffs.map(effect => effect.label).join(' · '), actor, good ? 'good' : 'bad');
      if (good) {
        St.ring(St.X(actor), CY(actor), '#5fd4a8', 22, 0.3, still);
        sfx.guard();
      } else if (ids.some(id => !id.startsWith('defProtocol'))) {
        if (!still) St.sparks(St.X(actor), CY(actor), 7, ids.includes('burn') ? ['#ff5a3c', '#ffe07a'] : ['#b999ff', '#6b2433'], 40);
        sfx.debuff();
      }
    }
    await wait(0.24);
  }

  return { beginMove, isBig, label, impact, strikeAndHit, strikeMiss, settleMove, showEffects };
}
