const EFFECT_CAP = 250;
const POPUP_CAP = 40;

const COLORS = Object.freeze({
  fire: '#ff7043', water: '#55c9ff', nature: '#7ad66d', light: '#ffe27a', dark: '#c68cff',
  neutral: '#ffffff',
});

const LIFE_BY_PRESET = Object.freeze({
  basic_melee_hit: 0.3,
  basic_ranged_hit: 0.28,
  basic_shotgun_hit: 0.34,
  basic_area_hit: 0.42,
  skill_cast: 0.55,
  skill_single_hit: 0.52,
  skill_area_hit: 0.68,
  status_apply: 0.65,
  critical_hit: 0.45,
  advantage_hit: 0.48,
});

function drawRing(context, x, y, radius, color, alpha, width = 2) {
  context.save();
  context.globalAlpha = alpha;
  context.strokeStyle = color;
  context.lineWidth = width;
  context.beginPath();
  context.arc(x, y, Math.max(1, radius), 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawStar(context, x, y, outerRadius, innerRadius, points, rotation) {
  context.beginPath();
  for (let index = 0; index < points * 2; index += 1) {
    const angle = rotation + (index * Math.PI) / points;
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const vx = x + Math.cos(angle) * radius;
    const vy = y + Math.sin(angle) * radius;
    if (index === 0) context.moveTo(vx, vy); else context.lineTo(vx, vy);
  }
  context.closePath();
}

function effectSourcePoint(layout, effect, fallback) {
  if (!Number.isFinite(effect.sourceX) || !Number.isFinite(effect.sourceY)) return fallback;
  return layout.logicalToCanvas(effect.sourceX, effect.sourceY);
}

function drawAnimatedTrace(context, start, end, progress, color, alpha, width, trailLength = 0.28) {
  const headProgress = Math.min(1, Math.max(0, progress));
  const tailProgress = Math.max(0, headProgress - trailLength);
  const head = {
    x: start.x + (end.x - start.x) * headProgress,
    y: start.y + (end.y - start.y) * headProgress,
  };
  const tail = {
    x: start.x + (end.x - start.x) * tailProgress,
    y: start.y + (end.y - start.y) * tailProgress,
  };
  context.globalAlpha = alpha;
  context.strokeStyle = color;
  context.lineWidth = width;
  context.beginPath();
  context.moveTo(tail.x, tail.y);
  context.lineTo(head.x, head.y);
  context.stroke();
  return head;
}

export class EffectRenderer {
  constructor() {
    this.effects = [];
    this.popups = [];
    this.reduced = false;
    this.damageNumbers = true;
  }

  setReduced(value) {
    this.reduced = Boolean(value);
  }

  setDamageNumbers(value) {
    this.damageNumbers = Boolean(value);
  }

  push(event) {
    if (!event) return false;
    const life = LIFE_BY_PRESET[event.effectPreset];
    const drawsEffect = Boolean(life) && !event.suppressEffect;
    const drawsPopup = this.damageNumbers
      && event.effectPreset !== 'critical_hit'
      && Number.isFinite(event.amount);
    if (!drawsEffect && !drawsPopup) return false;
    const effect = { ...event, age: 0, life: life ?? 0.5 };
    if (drawsEffect) {
      this.effects.push(effect);
      if (this.effects.length > EFFECT_CAP) this.effects.splice(0, this.effects.length - EFFECT_CAP);
    }
    if (drawsPopup) {
      this.popups.push({ ...effect, critical: Boolean(event.critical) });
      if (this.popups.length > POPUP_CAP) this.popups.splice(0, this.popups.length - POPUP_CAP);
    }
    return true;
  }

  update(deltaSeconds) {
    for (const item of [...this.effects, ...this.popups]) item.age += deltaSeconds;
    this.effects = this.effects.filter(({ age, life }) => age < life);
    this.popups = this.popups.filter(({ age, life }) => age < life);
  }

  render(context, layout) {
    for (const effect of this.effects) this.#drawEffect(context, layout, effect);
    for (const popup of this.popups) this.#drawPopup(context, layout, popup);
  }

  #drawEffect(context, layout, effect) {
    const point = layout.logicalToCanvas(effect.x, effect.y);
    const progress = Math.min(1, effect.age / effect.life);
    const fade = 1 - progress;
    const color = COLORS[effect.element] ?? COLORS.neutral;
    const cell = layout.logicalRadiusToCanvas(1);
    const radius = layout.logicalRadiusToCanvas(effect.radius ?? 0.45);
    context.save();
    context.lineCap = 'round';

    switch (effect.effectPreset) {
      case 'basic_melee_hit': {
        context.globalAlpha = fade;
        context.strokeStyle = color;
        context.lineWidth = Math.max(2, cell * 0.1);
        for (const arcRotation of [-0.5, 0.15, 0.8]) {
          context.beginPath();
          context.arc(point.x, point.y, cell * (0.3 + progress * 0.22), arcRotation, arcRotation + 1.15);
          context.stroke();
        }
        context.fillStyle = '#fff';
        drawStar(context, point.x, point.y, cell * (0.14 + progress * 0.24), cell * (0.06 + progress * 0.1), 4, progress * 0.9);
        context.fill();
        drawRing(context, point.x, point.y, cell * (0.1 + progress * 0.2), color, fade * 0.8, 2);
        break;
      }
      case 'basic_ranged_hit': {
        const source = effectSourcePoint(layout, effect, point);
        const burst = effect.attackArchetype === 'burst';
        const head = drawAnimatedTrace(
          context,
          source,
          point,
          progress,
          color,
          fade,
          Math.max(2, cell * (burst ? 0.16 : 0.08)),
        );
        drawRing(context, point.x, point.y, cell * (burst ? 0.16 + progress * 0.56 : 0.08 + progress * 0.28), color, fade, burst ? 4 : 2);
        if (burst && !this.reduced) drawRing(context, point.x, point.y, cell * (0.32 + progress * 0.5), '#fff', fade * 0.6, 2);
        context.globalAlpha = fade;
        context.fillStyle = '#fff';
        context.fillRect(head.x - 1, head.y - cell * 0.08, 2, cell * 0.16);
        context.fillRect(head.x - cell * 0.08, head.y - 1, cell * 0.16, 2);
        break;
      }
      case 'basic_shotgun_hit': {
        const source = effectSourcePoint(layout, effect, point);
        drawAnimatedTrace(context, source, point, progress, color, fade, Math.max(2, cell * 0.065), 0.4);
        if (!effect.missed) drawRing(context, point.x, point.y, cell * (0.06 + progress * 0.16), color, fade, 2);
        break;
      }
      case 'basic_area_hit':
        drawRing(context, point.x, point.y, radius * (0.4 + progress * 0.6), color, fade, 3);
        break;
      case 'skill_cast': {
        context.globalAlpha = fade;
        context.strokeStyle = '#ffffff';
        context.lineWidth = 2;
        context.beginPath();
        context.arc(point.x, point.y, cell * (0.3 + progress * 0.35), 0, Math.PI * 2);
        context.stroke();
        if (!this.reduced) {
          context.fillStyle = color;
          for (let index = 0; index < 6; index += 1) {
            const angle = (index * Math.PI) / 3 + progress * 1.8;
            const distance = cell * (0.35 + ((index % 3) / 3) * 0.2 + progress * 0.15);
            drawStar(
              context,
              point.x + Math.cos(angle) * distance,
              point.y + Math.sin(angle) * distance - progress * cell * 0.2,
              cell * 0.07 * fade + cell * 0.02,
              cell * 0.03,
              4,
              angle,
            );
            context.fill();
          }
        }
        break;
      }
      case 'skill_single_hit': {
        drawRing(context, point.x, point.y, cell * (0.25 + progress * 0.45), '#fff', fade, 4);
        drawRing(context, point.x, point.y, cell * (0.12 + progress * 0.35), color, fade, 2);
        break;
      }
      case 'skill_area_hit': {
        drawRing(context, point.x, point.y, radius * (0.25 + progress * 0.75), color, fade, 4);
        if (!this.reduced) drawRing(context, point.x, point.y, radius * (0.7 - progress * 0.25), '#fff', fade * 0.7, 2);
        break;
      }
      case 'status_apply': {
        context.globalAlpha = fade;
        context.fillStyle = color;
        context.beginPath();
        context.moveTo(point.x, point.y - cell * (0.25 + progress * 0.35));
        context.lineTo(point.x + cell * 0.13, point.y - cell * (0.08 + progress * 0.35));
        context.lineTo(point.x - cell * 0.13, point.y - cell * (0.08 + progress * 0.35));
        context.closePath();
        context.fill();
        break;
      }
      case 'advantage_hit':
        drawRing(context, point.x, point.y, cell * (0.32 + progress * 0.2), '#ffd54f', fade, 4);
        break;
      case 'critical_hit':
        drawRing(context, point.x, point.y, cell * (0.18 + progress * 0.42), '#fff2a3', fade, 4);
        break;
      default:
        break;
    }
    context.restore();
  }

  #drawPopup(context, layout, popup) {
    const point = layout.logicalToCanvas(popup.x, popup.y);
    const progress = Math.min(1, popup.age / popup.life);
    context.save();
    context.globalAlpha = 1 - progress;
    context.fillStyle = popup.critical ? '#ffe57f' : '#ffffff';
    context.strokeStyle = '#3b173f';
    context.lineWidth = 3;
    context.font = `900 ${Math.max(14, layout.logicalRadiusToCanvas(0.34))}px system-ui`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const label = `${Math.round(popup.amount ?? 0)}${popup.critical ? '!' : ''}`;
    const y = point.y - layout.logicalRadiusToCanvas(0.35 + progress * 0.55);
    context.strokeText(label, point.x, y);
    context.fillText(label, point.x, y);
    context.restore();
  }

  snapshotCaps() {
    return { effects: this.effects.length, popups: this.popups.length, effectCap: EFFECT_CAP, popupCap: POPUP_CAP };
  }
}

export default EffectRenderer;
