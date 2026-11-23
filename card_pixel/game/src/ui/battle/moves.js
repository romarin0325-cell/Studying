import { $$ } from '../dom.js';
import { FORM_ART, FORM_MARKERS } from '../../content/skill-motions.js';
import { FIELD, GOOD } from './hud.js';
import { contactOffset, MOTION_FRAME, rangedTiming, resolveMotion, spriteBox } from './motion.js';

const CAST_SOUND = { shot: 'throw', orb: 'cast', breath: 'whoosh', ray: 'zap', fall: 'whoosh',
  blast: 'whoosh', field: 'cast', drift: 'whoosh', mark: 'cast' };

export function createMoves({ stage: St, sfx, actorOf, unitOf, colorsOf, applyHp, card, spr }) {
  const { S, clock, wait, tween, footY: FY, headY: HY, chestY: CY, reducedMotion } = St;

  const label = (text, actor, cls, dy) => St.number(text, St.X(actor), HY(actor) - 4 + (dy || 0), 'tag ' + (cls || ''));

  function beginMove(e, actor, isFoe, action) {
    const target = e.target ? actorOf(e.target) : null;
    const p = { e, actor, target, isFoe, stage: 'ready', colors: colorsOf(e.who),
      reserve: action?.effects.some(effect => effect.kind === 'delay') };
    const donor = e.heirloom && e.heirFrom ? card(e.heirFrom) : null;
    const donorForm = donor && Object.hasOwn(FORM_MARKERS, donor.id) ? donor.id : null;
    const sourceArt = donorForm ? FORM_ART : donor?.id;
    const art = sourceArt && spr(sourceArt);
    const unit = unitOf(e.who);
    p.fromEdge = e.trigger === 'reserved' && (!actor?.vis || !unit || unit.hp <= 0 || unit.dead || unit.out);
    if (donor) {
      p.donor = donor;
      p.colors = St.ELEMENT_COLORS[donor.element] || St.ELEMENT_COLORS.none;
    }
    if (p.fromEdge) {
      p.actor = { sprite: art ? sourceArt : actor?.sprite ?? target?.sprite, x: isFoe ? St.S.W - 1 : 0,
        y: target?.y ?? 0, ox: 0, oy: 0, vis: false, pose: 'idle' };
    } else if (art && !p.reserve) {
      p.caster = actor;
      p.casterVisible = actor.vis;
      actor.vis = false;
      p.actor = St.makeActor({ sprite: donor.id, form: donorForm, x: actor.x, y: actor.y, flip: (art.facing === 'left') !== isFoe });
    }
    p.basic = e.skill.name === '일반 공격';
    p.motion = resolveMotion({
      sourceKey: e.sourceKey, skill: e.skill, sourceSkill: e.sourceSkill, side: e.who.side,
      salience: e.salience ?? (e.ult ? 'boss' : undefined),
      isBasic: p.basic, casterSprite: art ? sourceArt : p.actor.sprite, casterForm: donorForm ?? p.actor.form
    });
    const owner = e.sourceKey?.split('/')[1];
    if (owner && p.motion.family === 'fall') p.effectSprite = St.variant(owner + '-fx', 'base');
    p.colors = St.ELEMENT_COLORS[p.motion.tint ?? e.sourceSkill?.element] ?? p.colors;
    if (action) {
      const hp = [...action.hp.values()];
      const hasStrike = hp.some(step => step.strike);
      p.manaOnly = !hasStrike && (action.drains?.size > 0 || e.manaDrain);
      p.support = !action.miss && !hasStrike && !p.manaOnly && !action.followUp;
      if (p.manaOnly) {
        p.motion = { ...p.motion, family: 'orb', variant: 'absorb', range: 'ranged', socket: p.motion.socket ?? 'hand' };
      } else if (p.support) {
        const selfField = p.motion.family === 'field' && p.motion.variant !== 'bind' &&
          action.effects.some(effect => effect.at === 'field');
        const recipient = hp.find(step => step.kind === 'heal') ?? (!selfField &&
          action.effects.find(effect => effect.who && effect.kind !== 'delay'));
        if (recipient) p.target = actorOf(recipient.who) ?? p.target;
        else if (selfField || e.skill.type === 'sup') p.target = p.actor;
      }
      p.labelCast = e.skill.type === 'sup' && !action.effects.some(effect => effect.at === 'caster');
      p.beneficial = hp.some(step => step.kind === 'heal' && step.at !== 'foe') ||
        action.effects.some(effect => effect.who && effect.at !== 'foe' && effect.ids?.some(id => GOOD.includes(id)));
    }
    return p;
  }

  const isMelee = p => p.motion.range === 'melee';
  const isBig = p => p.motion.size === 'big';

  function impact(e, o, stats) {
    const actor = actorOf(e.who), unit = unitOf(e.who), isAlly = e.who.side === 'ally';
    applyHp(e);
    if (!actor) return;
    const ratio = e.amount / unit.maxHp, big = ratio >= 0.3 || o.crit || o.big;
    actor.pose = 'hurt';
    if (!reducedMotion()) {
      actor.white = 0.04;
      if (!o.melee) {
        actor.ox = (isAlly ? -1 : 1) * 4;
        tween(actor, { ox: 0 }, 0.25);
        S.shake = Math.max(S.shake, Math.min(7, 1 + ratio * 12 + (o.crit ? 2 : 0)));
        if (o.crit && !o.ranged) S.flash = Math.max(S.flash, 0.5);
        if (!o.ranged) St.sparks(St.X(actor), CY(actor), big ? 22 : 8, o.colors || St.ELEMENT_COLORS.none, big ? 100 : 50);
      }
    }
    const text = (o.prefix || '') + (o.label ?? e.amount.toLocaleString('en-US')) + (o.adv ? ' ▲' : '');
    St.number(text, St.X(actor), HY(actor) - (big ? 8 : 2), (o.crit ? 'crit ' : big ? 'big ' : '') + (isAlly ? 'foe' : ''));
    if (o.melee === 'bite') sfx.bite();
    else if (o.melee === 'blade' || o.melee === 'claw' || o.melee === 'thrust') sfx.swing();
    else if (o.crit && o.ranged) sfx.crit();
    else sfx.hit(o.melee ? o.big : big);
    if (o.crit && !o.melee && !o.ranged) sfx.crit();
    if (!isAlly && e.amount > stats.best) stats.best = e.amount;
  }

  async function windUp(p) {
    const { actor, isFoe, colors, donor } = p, dir = isFoe ? -1 : 1, skill = p.e.skill;
    const caster = unitOf(p.e.who)?.name ?? skill.name;
    const who = isFoe && p.e.ult ? '필살' : p.e.heirloom ? '유품 · ' + (donor?.name || caster) : caster;
    actor.front = 1;
    $$('#fx .num').forEach(n => n.remove());
    p.plate = St.plate(who, skill.name, isFoe && p.e.ult ? '#ff6b5e' : p.e.heirloom ? '#ffc857' : colors[1], dir);
    if (p.fromEdge) {
      sfx.charge?.();
      return;
    }
    if (reducedMotion()) {
      actor.pose = p.motion.frame;
      sfx.charge?.();
      await wait(0.12);
      return;
    }
    tween(S, { dark: isFoe ? 0.45 : 0.35 }, 0.12);
    sfx.charge?.();
    actor.pose = isMelee(p) ? 'idle' : p.motion.frame; actor.white = 0.06;
    if (isMelee(p)) {
      const point = St.socket(actor, p.motion.socket);
      St.converge(point.x, point.y, 18, colors, 22, 0.3);
    }
    await St.punch(St.X(actor) + dir * 14, CY(actor) - 6, 0.18);
  }

  function finishBig(p) {
    if (!reducedMotion()) {
      if (isMelee(p)) S.flash = 0.22;
      S.shake = isMelee(p) ? 7 : 4;
      tween(S, { dark: 0 }, 0.3);
    }
    if (p.plate) wait(0.45).then(() => p.plate.remove());
  }

  function hpCostFlare(p) {
    if (p.e.sourceKey !== 'ally/ash/2' || p.e.skill.name !== '아마겟돈' || reducedMotion()) return;
    const box = spriteBox(p.actor, St.meta(p.actor), S.BASE);
    const fx = St.prop({ kind: 'costFlare', caster: p.actor, x: box.cx,
      y: Math.round(box.top + box.height * 0.58), rx: Math.round(box.width * 0.4), ry: Math.round(box.height * 0.22),
      start: clock.t, colors: St.ELEMENT_COLORS.fire });
    wait(2 * MOTION_FRAME).then(() => St.dropProp(fx));
  }

  async function rangedMove(p, landed, reserve = false) {
    const { actor, motion, colors } = p, target = reserve ? actor : p.target ?? actor;
    const still = reducedMotion(), big = !reserve && isBig(p), dir = p.isFoe ? -1 : 1;
    const family = reserve ? 'mark' : motion.family;
    const variant = reserve ? 'reserve' : motion.variant;
    actor.casting = true;
    const windup = big && p.stage === 'ready';
    if (windup) await windUp(p);
    else sfx[CAST_SOUND[family]]?.();
    actor.pose = reserve ? 'idle' : motion.frame;
    const targetMeta = St.meta(target, landed && !p.support && !p.manaOnly ? 'hurt' : target.pose);
    const box = spriteBox(target, targetMeta, S.BASE);
    const chest = { x: box.cx, y: Math.round(box.top + box.height * 0.6) };
    const from = reserve ? St.socket(target, 'top') : p.fromEdge ? { x: actor.x, y: chest.y } : St.socket(actor, motion.socket);
    const edge = dir > 0 ? box.left : box.right - 1;
    const to = family === 'breath' && dir * (edge - from.x) > 0 ? { ...chest, x: edge } : chest;
    const fromFloor = p.fromEdge ? { x: actor.x, y: FY(actor) } : St.socket(actor, 'ground');
    const fallY = box.top - 40;
    const launch = family === 'blast' && (['wave', 'ground'].includes(variant) ||
      (variant === 'eruption' && motion.socket === 'top'));
    const timing = rangedTiming({ family, variant, from, to, big, still, fallHeight: to.y - fallY, launch });
    const absorb = family === 'orb' && variant === 'absorb';
    const fx = p.fx = St.prop({ kind: 'rangedFx', caster: actor, target,
      from: absorb ? to : from, to: absorb ? from : to, fromFloor, fallY, launch, effectSprite: p.effectSprite,
      floor: Math.round(box.feet), head: box.top, dir, family, variant, colors,
      beneficial: p.beneficial, basic: p.basic, big, still, landed, start: clock.t, ...timing });
    if (timing.travel) await wait(timing.travel);
    fx.arrived = clock.t;
    p.stage = 'hit';
    p.hitAt = clock.t;
    if (windup) finishBig(p);
    p.hitHold = wait(timing.hold).then(() => St.dropProp(fx));
  }

  async function playCast(p) {
    hpCostFlare(p);
    if (p.e.heirloom && !p.reserve && !isBig(p)) {
      const donor = p.donor?.name ?? unitOf(p.e.who)?.name;
      p.heirloomPlate = St.plate('유품 · ' + donor, p.e.skill.name, '#ffc857', p.isFoe ? -1 : 1);
    }
    if (p.labelCast) label(p.e.skill.name, p.actor, 'good');
    if (!p.reserve && !p.support) return;
    p.actor.front = 1;
    if (p.reserve) await rangedMove(p, true, true);
    else await deliver(p, true);
    if (p.reserve) {
      sfx.tick?.(0);
      await p.hitHold;
    }
    else sfx.chime?.(p.motion.variant === 'heal' || p.beneficial);
  }

  async function playDrain(p, e, applyMp) {
    await rangedMove(p, true);
    applyMp(e);
    label('MP ' + e.delta.toLocaleString('en-US'), actorOf(e.who), 'bad');
    await p.hitHold;
  }

  function showHeal(e, p) {
    const target = actorOf(e.who);
    if (!target || (p?.support && p.target === target && p.motion.family === 'mark' && p.motion.variant === 'heal')) return;
    const box = spriteBox(target, St.meta(target), S.BASE);
    const to = { x: box.cx, y: Math.round(box.top + box.height * 0.6) };
    const hold = reducedMotion() ? 0.09 : 0.135;
    const fx = St.prop({ kind: 'rangedFx', family: 'mark', variant: 'heal', to, target,
      start: clock.t, arrived: clock.t, landed: true, hold, still: reducedMotion() });
    if (p) p.healAt = clock.t;
    sfx.chime?.(true);
    wait(hold).then(() => St.dropProp(fx));
  }

  async function meleeMove(p, landed) {
    const { actor, target, isFoe, colors, motion } = p;
    const dir = isFoe ? -1 : 1, big = isBig(p), still = reducedMotion();
    const windup = big && !still && p.stage === 'ready';
    actor.casting = true;
    if (windup) await windUp(p);
    else sfx.throw?.();
    // The HP event switches the target to hurt on this same frame.
    const casterMeta = St.meta(actor, motion.frame), targetMeta = St.meta(target, landed ? 'hurt' : target.pose);
    if (!still && !p.fromEdge) {
      const offset = contactOffset({ caster: actor, target, casterMeta, targetMeta, dir });
      await tween(actor, offset, big ? 0.1 : 0.12, 'in');
      actor.pose = motion.frame;
    }

    const from = p.fromEdge ? null : spriteBox(actor, still ? St.meta(actor) : casterMeta, S.BASE);
    const to = spriteBox(target, targetMeta, S.BASE);
    const near = dir > 0 ? to.left : to.right;
    const x = near + dir * 2;
    const low = motion.socket === 'foot' || motion.variant === 'scythe';
    const floor = Math.round(to.feet);
    const hand = from && Math.round(from.top + from.height * 0.63);
    const body = Math.round(to.top + to.height * 0.64);
    const y = low ? floor - (motion.variant === 'stomp' ? 5 : 14) :
      Math.min(to.bottom - 7, Math.max(body, still || p.fromEdge ? body : hand + (motion.variant === 'uppercut' ? -4 : 0)));
    const tip = motion.family === 'thrust'
      ? (p.fromEdge ? { x: actor.x, y } : St.socket(actor, motion.socket ?? 'weaponTip')) : null;
    const duration = still ? 0.09 : big ? 0.22 : 0.135;
    p.stage = 'hit';
    p.hitAt = clock.t;
    if (windup) finishBig(p);
    const fx = p.fx = St.prop({ kind: 'meleeFx', family: motion.family, variant: motion.variant, x, y, tip, floor, dir, colors,
      big, basic: p.basic, still, landed, start: clock.t, duration });
    p.hitHold = wait(duration).then(() => St.dropProp(fx));
  }

  function deliver(p, landed) {
    if (!isMelee(p)) return rangedMove(p, landed);
    if (p.target && p.target !== p.actor) return meleeMove(p, landed);
    p.actor.pose = p.motion.frame;
    p.stage = 'hit';
    p.hitAt = clock.t;
  }

  async function strikeAndHit(p, step, stats, hasEffects, finishHit) {
    const e = step.event;
    p.actor.front = 1;
    await deliver(p, true);
    if (finishHit) {
      p.finishing = true;
      await finishHit(e);
      await p.hitHold;
      return;
    }
    const calc = e.calc || {};
    impact(e, { crit: !!calc.crit, adv: !!calc.adv, colors: p.colors, big: isBig(p),
      label: step.label, melee: isMelee(p) && p.motion.family, ranged: !isMelee(p) }, stats);
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
      if (p.stage === 'ready' && p.e.salience === 'boss' && p.target && !p.manaOnly) {
        await deliver(p, false);
      }
      if (p.hitHold) await p.hitHold;
      if (p.stage === 'ready') { p.actor.pose = p.motion.frame; await wait(0.12); }
      if (p.finishing || reducedMotion()) Object.assign(p.actor, { ox: 0, oy: 0 });
      else if (p.actor.ox || p.actor.oy) await tween(p.actor, { ox: 0, oy: 0 }, 0.1);
      p.actor.pose = 'idle'; p.actor.front = 0; p.actor.casting = false;
      const t = p.target, tu = p.e.target && unitOf(p.e.target);
      if (t && tu && tu.hp > 0 && t.pose === 'hurt') t.pose = 'idle';
      if (S.dark > 0.01) tween(S, { dark: 0 }, 0.2);
    } finally {
      if (p.heirloomPlate) p.heirloomPlate.remove();
      if (p.caster) {
        St.removeActor(p.actor);
        p.caster.vis = p.casterVisible;
        p.caster.casting = false;
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

  return { beginMove, playCast, playDrain, showHeal, isBig, label, impact, strikeAndHit, strikeMiss, settleMove, showEffects };
}
