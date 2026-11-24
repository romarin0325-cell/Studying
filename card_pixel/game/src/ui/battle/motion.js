import { BASIC_MOTION, FORM_MARKERS, SKILL_MOTIONS } from '../../content/skill-motions.js';

const ATTACK_FRAME = { red_dragon: 'phy', ash: 'mag', flame_sage: 'mag', luna: 'phy', zeke: 'phy', cherry_prince: 'phy', golem: 'phy' };
export const MOTION_FRAME = 0.03;

function isBigMove({ skill, side, salience, isBasic }) {
  const { type, tier, val } = skill;
  return !isBasic && type !== 'sup' && (salience === 'boss' ||
    (side === 'ally' && tier >= 3 && (!Number.isFinite(val) || val >= 2)));
}

function defaultMotion(skill, casterSprite, big) {
  const phy = skill.type === 'phy';
  const frame = skill.type === 'sup' || (ATTACK_FRAME[casterSprite] && ATTACK_FRAME[casterSprite] !== skill.type) ? 'idle' : 'attack';
  const fx = (skill.effects ?? []).map(effect => effect.type ?? effect);
  if (skill.type === 'sup') {
    if (fx.includes('field_buff')) return { family: 'field', variant: 'circle', range: 'ranged', frame, socket: 'hand' };
    return { family: 'mark', variant: fx.includes('debuff') ? 'curse' : 'heal', range: 'ranged', frame, socket: 'hand' };
  }
  if (!big) return phy ? { ...BASIC_MOTION, frame } : { family: 'orb', variant: 'bolt', range: 'ranged', frame, socket: 'hand' };
  if (fx.some(type => ['random_mult', 'random_mult_moon_boost', 'delayed_random_attack', 'multi_hit'].includes(type))) return phy
    ? { family: 'blade', variant: 'double', range: 'melee', frame }
    : { family: 'fall', variant: 'rain', range: 'ranged', frame, socket: 'top' };
  if (fx.includes('consume_debuff_all') || fx.includes('consume_field_all')) {
    return { family: 'blast', variant: 'burst', range: 'ranged', frame, socket: 'hand' };
  }
  if (fx.includes('self_hp_cost_ratio') || skill.val >= 4) {
    return { family: 'fall', variant: 'meteor', range: 'ranged', frame, socket: 'top' };
  }
  return phy ? { family: 'impact', variant: 'body', range: 'melee', frame } :
    { family: 'ray', variant: 'straight', range: 'ranged', frame, socket: 'hand' };
}

export function resolveMotion({ sourceKey, skill, sourceSkill, side, salience, isBasic, casterSprite, casterForm }) {
  const [role, owner, slot] = sourceKey?.split('/') ?? [];
  const key = role === 'ally' && Object.hasOwn(FORM_MARKERS, owner) ? `form/${owner}/${slot}` : sourceKey;
  const entry = Object.hasOwn(SKILL_MOTIONS, key) ? SKILL_MOTIONS[key] : null;
  const exact = entry?.expectedName === skill.name ? entry : null;
  const native = role === 'ally' || role === 'form';
  const original = sourceSkill ?? skill;
  const big = (!isBasic && exact?.forceBig) || isBigMove({
    skill: original, side: native ? 'ally' : side, salience: native ? undefined : salience, isBasic
  });
  const { family, variant, range, frame, socket, tint } = isBasic && skill.type === 'phy' ? BASIC_MOTION :
    exact ?? defaultMotion(original, native ? owner : casterSprite, big);
  // Borrowed slots keep their FX, while the caster uses a pose available on their own art.
  const borrowed = native && casterSprite && owner !== (casterForm ?? casterSprite);
  return {
    family, variant, range, frame: borrowed ? 'idle' : frame,
    ...(socket && { socket }), ...(tint && { tint }),
    ...(Object.hasOwn(FORM_MARKERS, casterForm) && { marker: casterForm }),
    size: big ? 'big' : 'quiet'
  };
}

// The renderer and the contact calculation share the cropped frame's bounds and rounding.
export function spriteBox(actor, meta, baseY = 0) {
  const width = meta.w ?? meta.width, height = meta.h ?? meta.height;
  const center = meta.cx ?? meta.bodyCenterX, baseline = meta.fy ?? meta.feetBaselineY;
  const cx = Math.round(actor.x + (actor.ox ?? 0));
  const feet = baseY + (actor.y ?? 0) + (actor.oy ?? 0);
  const left = Math.round(cx - (actor.flip ? width - center : center));
  const top = Math.round(feet - baseline - 1);
  return { cx, feet, left, right: left + width, top, bottom: top + height, width, height };
}

export function socketPoint(actor, meta, sockets, name) {
  const { cx, left, top, width, height, feet } = spriteBox(actor, meta);
  if (name === 'ground') return { x: cx, y: Math.round(feet) };
  const point = sockets?.[name] ?? sockets?.hand;
  if (!point) return { x: cx, y: Math.round(top + height * 0.6) };
  const [x, y] = point;
  return { x: left + (actor.flip ? width - 1 - x : x), y: top + y };
}

export function motionPoint(from, to, progress, arc = 0) {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress - 4 * arc * progress * (1 - progress)
  };
}

export function rangedTiming({ family, variant, from, to, big, still, fallHeight, launch }) {
  if (still) return { travel: 0, hold: 0.09 };
  const speed = big ? 700 : 900;
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const flight = Math.min(big ? 0.26 : 0.145, distance / speed);
  if (family === 'fall') {
    const falling = Math.max(2, Math.min(3, Math.round(fallHeight / speed / MOTION_FRAME)));
    return { flight: falling * MOTION_FRAME, travel: (1 + falling) * MOTION_FRAME, hold: 0.12 };
  }
  if (family === 'breath') return { travel: Math.max(0.06, flight), hold: 0.12, linger: big ? 4 : 2 };
  if (family === 'ray') return { travel: Math.max(0.06, flight), hold: big ? 0.18 : 0.12 };
  if (family === 'orb') return { travel: 0.06 + flight, hold: 0.135, charge: 0.06 };
  if (family === 'mark') return { travel: 0, hold: variant === 'reserve' ? 0.12 : 0.135 };
  if (family === 'field') return { travel: 0.06, hold: 0.135 };
  if (family === 'drift') return { travel: Math.max(0.09, flight), hold: 0.12 };
  return { travel: family === 'blast' && !launch ? 0.06 : Math.max(0.03, flight), hold: 0.135 };
}

export function contactOffset({ caster, target, casterMeta, targetMeta, dir }) {
  const from = spriteBox({ ...caster, ox: 0, oy: 0 }, casterMeta);
  const to = spriteBox(target, targetMeta);
  const leading = dir > 0 ? from.right : from.left;
  const near = dir > 0 ? to.left : to.right;
  return { ox: near + dir * 5 - leading, oy: to.feet - from.feet };
}
