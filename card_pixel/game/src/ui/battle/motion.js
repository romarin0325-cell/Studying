import { BASIC_MOTION, SKILL_MOTIONS } from '../../content/skill-motions.js';

export function isBigMove({ skill, side, heirloom, salience, isBasic }) {
  const { tier, val } = skill;
  return !isBasic && (salience === 'boss' || !!heirloom ||
    (side === 'ally' && tier >= 3 && (!Number.isFinite(val) || val >= 2)));
}

export function resolveMotion({ sourceKey, skill, side, heirloom, salience, isBasic, casterSprite }) {
  const entry = isBasic && skill.type === 'phy' ? BASIC_MOTION :
    Object.hasOwn(SKILL_MOTIONS, sourceKey) ? SKILL_MOTIONS[sourceKey] : null;
  if (!entry || (entry.expectedName && entry.expectedName !== skill.name)) return null;

  const { family, variant, range, frame, socket, tint } = entry;
  // A roulette caster has their own art, so use a neutral pose for the borrowed strike.
  const borrowed = sourceKey?.startsWith('ally/') && casterSprite && sourceKey.split('/')[1] !== casterSprite;
  return {
    family, variant, range, frame: borrowed && !heirloom ? 'idle' : frame,
    ...(socket && { socket }), ...(tint && { tint }),
    size: isBigMove({ skill, side, heirloom, salience, isBasic }) ? 'big' : 'quiet'
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

export function contactOffset({ caster, target, casterMeta, targetMeta, dir }) {
  const from = spriteBox({ ...caster, ox: 0, oy: 0 }, casterMeta);
  const to = spriteBox(target, targetMeta);
  const leading = dir > 0 ? from.right : from.left;
  const near = dir > 0 ? to.left : to.right;
  return { ox: near + dir * 5 - leading, oy: to.feet - from.feet };
}
