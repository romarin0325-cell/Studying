import { combatAnchor } from './CombatAnchors.js';
const EFFECT_CAP = 250;
const POPUP_CAP = 40;

const COLORS = Object.freeze({
  fire: '#ff7043', water: '#55c9ff', nature: '#7ad66d', light: '#ffe27a', dark: '#c68cff',
  neutral: '#ffffff',
});

const LIFE_BY_PRESET = Object.freeze({
  basic_melee_hit: 0.42,
  basic_ranged_hit: 0.4,
  basic_shotgun_hit: 0.48,
  basic_area_hit: 0.58,
  basic_nova_hit: 0.55,
  basic_laser_hit: 0.34,
  skill_cast: 0.75,
  skill_single_hit: 0.72,
  skill_area_hit: 0.9,
  status_apply: 0.85,
  critical_hit: 0.6,
  advantage_hit: 0.65,
});

const SKILL_TRAVEL_SECONDS = 0.26;
const SKILL_IMPACT_PRESETS = new Set(['skill_single_hit', 'skill_area_hit']);

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

function drawShard(context, x, y, length, angle, color) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  context.fillStyle = color;
  context.beginPath();
  context.moveTo(x + dx*length, y + dy*length);
  context.lineTo(x - dy*length*.27, y + dx*length*.27);
  context.lineTo(x - dx*length*.6, y - dy*length*.6);
  context.lineTo(x + dy*length*.27, y - dx*length*.27);
  context.closePath(); context.fill();
}

function effectSourcePoint(layout, effect, fallback) {
  if (!Number.isFinite(effect.sourceX) || !Number.isFinite(effect.sourceY)) return fallback;
  return combatAnchor(layout, effect.sourceX, effect.sourceY, 'hero');
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
  constructor({ assetManager = null } = {}) {
    this.assetManager = assetManager;
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
    const skillHit = event.type === 'hit' && event.actionKind === 'skill';
    const travel = skillHit ? SKILL_TRAVEL_SECONDS : 0;
    // Only the primary impact flies as a projectile; crit/advantage/status overlays
    // stay hidden during the same travel window so they detonate in sync.
    const flies = travel > 0 && SKILL_IMPACT_PRESETS.has(event.effectPreset) && !event.suppressEffect;
    const effect = { ...event, age: 0, life: life ?? 0.5, travel, flies };
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
    this.effects = this.effects.filter(({ age, life, travel }) => age < travel + life);
    this.popups = this.popups.filter(({ age, life, travel }) => age < travel + life);
  }

  render(context, layout) {
    for (const effect of this.effects) this.#drawEffect(context, layout, effect);
    for (const popup of this.popups) this.#drawPopup(context, layout, popup);
  }

  #drawSkillProjectile(context, layout, effect, travel) {
    const target = combatAnchor(layout, effect.x, effect.y, effect.targetIsBoss ? 'boss' : 'enemy');
    const source = effectSourcePoint(layout, effect, target);
    const progress = Math.min(1, effect.age / travel);
    const color = COLORS[effect.element] ?? COLORS.neutral;
    const cell = layout.logicalRadiusToCanvas(1);
    context.save();
    context.lineCap = 'round';
    const head = drawAnimatedTrace(context, source, target, progress, color, 0.85, Math.max(3, cell * 0.12), 0.35);
    drawRing(context, head.x, head.y, cell * 0.18, color, 0.9, 3);
    context.globalAlpha = 1;
    context.fillStyle = '#fff';
    drawStar(context, head.x, head.y, cell * 0.16, cell * 0.06, 4, effect.age * 9);
    context.fill();
    context.restore();
  }

  #drawEffect(context, layout, effect) {
    const travel = effect.travel ?? 0;
    if (travel > 0 && effect.age < travel) {
      if (effect.flies) this.#drawSkillProjectile(context, layout, effect, travel);
      return;
    }
    // A laser is one translated ground-plane segment: lift both endpoints
    // equally so its preview, collision corridor and visible direction agree.
    const kind = ['skill_cast','basic_laser_hit','basic_shotgun_hit'].includes(effect.effectPreset) ? 'hero' : effect.attackArchetype === 'nova' || effect.type === 'starfall' ? 'ground' : effect.targetIsBoss ? 'boss' : 'enemy';
    const point = combatAnchor(layout, effect.x, effect.y, kind);
    const progress = Math.min(1, (effect.age - travel) / effect.life);
    const fade = 1 - progress;
    const color = COLORS[effect.element] ?? COLORS.neutral;
    const cell = layout.logicalRadiusToCanvas(1);
    const radius = layout.logicalRadiusToCanvas(effect.radius ?? 0.45);
    context.save();
    context.lineCap = 'round';
    if (!this.reduced && this.#drawArt(context, layout, effect, point, progress, fade)) { context.restore(); return; }

    switch (effect.effectPreset) {
      case 'basic_melee_hit': {
        context.globalAlpha = fade;
        context.strokeStyle = color;
        context.lineWidth = Math.max(2.5, cell * 0.12);
        for (const arcRotation of [-0.5, 0.15, 0.8]) {
          context.beginPath();
          context.arc(point.x, point.y, cell * (0.32 + progress * 0.26), arcRotation, arcRotation + 1.15);
          context.stroke();
        }
        context.fillStyle = '#fff';
        drawStar(context, point.x, point.y, cell * (0.16 + progress * 0.26), cell * (0.07 + progress * 0.11), 4, progress * 0.9);
        context.fill();
        if (!this.reduced) for(let i=0;i<4;i++) { const angle=i*1.7; drawShard(context,point.x+Math.cos(angle)*cell*progress,point.y+Math.sin(angle)*cell*progress,cell*.14*fade,angle,color); }
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
        drawShard(context,head.x,head.y,cell*(burst?.42:.25),Math.atan2(point.y-source.y,point.x-source.x),color);
        if (burst && !this.reduced) for(let i=0;i<5;i++) { const angle=i*1.256;drawShard(context,point.x+Math.cos(angle)*cell*progress*.65,point.y+Math.sin(angle)*cell*progress*.65,cell*.17*fade,angle,'#ecfaff'); }
        context.globalAlpha = fade;
        context.fillStyle = '#fff';
        context.fillRect(head.x - 1, head.y - cell * 0.08, 2, cell * 0.16);
        context.fillRect(head.x - cell * 0.08, head.y - 1, cell * 0.16, 2);
        break;
      }
      case 'basic_shotgun_hit': {
        const source = effectSourcePoint(layout, effect, point);
        const head = drawAnimatedTrace(context, source, point, progress, color, fade, Math.max(2, cell * 0.065), 0.4);
        context.fillStyle = color;
        drawStar(context,head.x,head.y,cell*.15,cell*.05,4,progress*3); context.fill();
        break;
      }
      case 'basic_area_hit':
        context.globalAlpha = fade;
        for(let i=0;i<(this.reduced?3:7);i++) { const angle=i*.898+progress*.4;const reach=radius*(.12+progress*.7);drawShard(context,point.x+Math.cos(angle)*reach,point.y+Math.sin(angle)*reach,cell*.24*fade,angle,'#f3c8df'); }
        context.fillStyle='#fff9e7';drawStar(context,point.x,point.y,cell*.4*fade,cell*.1,6,progress);context.fill();
        break;
      case 'basic_nova_hit': {
        // Jagged lightning spokes radiate from the caster; jitter stays
        // index-seeded so the bolts are stable frame to frame.
        const reach = radius * (0.35 + progress * 0.65);
        const spokeCount = 6;
        context.lineJoin = 'miter';
        for (let index = 0; index < spokeCount; index += 1) {
          const baseAngle = (index * Math.PI * 2) / spokeCount + 0.42;
          const cos = Math.cos(baseAngle);
          const sin = Math.sin(baseAngle);
          const drawSpoke = (width, style, alpha) => {
            context.globalAlpha = alpha;
            context.strokeStyle = style;
            context.lineWidth = width;
            context.beginPath();
            for (let segment = 0; segment <= 3; segment += 1) {
              const fraction = segment / 3;
              const distance = reach * (0.18 + fraction * 0.82);
              const side = (segment + index) % 2 === 0 ? 1 : -1;
              const jitter = segment === 0 || segment === 3 ? 0 : cell * 0.16 * side;
              const vx = point.x + cos * distance - sin * jitter;
              const vy = point.y + sin * distance + cos * jitter;
              if (segment === 0) context.moveTo(vx, vy); else context.lineTo(vx, vy);
            }
            context.stroke();
          };
          drawSpoke(Math.max(3, cell * 0.11), color, fade * 0.55);
          drawSpoke(Math.max(1.5, cell * 0.05), '#ffffff', fade);
        }
        drawRing(context, point.x, point.y, reach, color, fade * 0.45, 2);
        if (!this.reduced) drawRing(context, point.x, point.y, reach * 0.55, '#fff', fade * 0.35, 1.5);
        break;
      }
      case 'basic_laser_hit': {
        const source = effectSourcePoint(layout, effect, point);
        const drawBeam = (width, style, alpha) => {
          context.globalAlpha = alpha;
          context.strokeStyle = style;
          context.lineWidth = width;
          context.beginPath();
          context.moveTo(source.x, source.y);
          context.lineTo(point.x, point.y);
          context.stroke();
        };
        if (!this.reduced) drawBeam(cell * 0.5, color, fade * 0.30);
        drawBeam(cell * 0.24, color, fade * 0.65);
        drawBeam(Math.max(2, cell * 0.09), '#ffffff', fade * 0.9);
        drawRing(context, point.x, point.y, cell * (0.1 + progress * 0.22), color, fade, 2.5);
        break;
      }
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
        context.globalAlpha=fade;
        for(let i=0;i<(this.reduced?3:7);i++) { const angle=i*.898;drawShard(context,point.x+Math.cos(angle)*cell*progress*.9,point.y+Math.sin(angle)*cell*progress*.9,cell*.4*fade,angle,color); }
        context.globalAlpha = fade;
        context.fillStyle = '#fff';
        drawStar(context, point.x, point.y, cell * (0.14 + progress * 0.22), cell * 0.05, 4, progress * 1.2);
        context.fill();
        break;
      }
      case 'skill_area_hit': {
        drawRing(context, point.x, point.y, radius * (0.25 + progress * 0.75), color, fade*.4, 1.5);
        context.globalAlpha=fade;
        for(let i=0;i<(this.reduced?4:9);i++) {
          const angle=i*2.4,d=radius*Math.sqrt((i+1)/9)*(.4+progress*.55);
          const x=point.x+Math.cos(angle)*d,y=point.y+Math.sin(angle)*d-cell*(1-progress)*.5;
          drawShard(context,x,y,cell*.3*fade,Math.PI/2,color);
          context.fillStyle='#fffbe5';drawStar(context,x,y,cell*.16*fade,cell*.04,4,angle);context.fill();
          if(effect.type==='starfall'){context.strokeStyle='#fff7d5';context.lineWidth=1;context.beginPath();context.moveTo(x,y-cell*2*fade);context.lineTo(x,y);context.stroke();}
        }
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
        drawRing(context, point.x, point.y, cell * (0.34 + progress * 0.24), '#ffd54f', fade, 5);
        break;
      case 'critical_hit':
        drawRing(context, point.x, point.y, cell * (0.2 + progress * 0.46), '#fff2a3', fade, 5);
        break;
      default:
        break;
    }
    context.restore();
  }

  #drawPopup(context, layout, popup) {
    const travel = popup.travel ?? 0;
    if (popup.age < travel) return;
    const point = combatAnchor(layout, popup.x, popup.y, popup.targetIsBoss ? 'boss' : 'enemy');
    const progress = Math.min(1, (popup.age - travel) / popup.life);
    context.save();
    context.globalAlpha = 1 - progress;
    context.fillStyle = popup.critical ? '#ffe57f' : '#ffffff';
    context.strokeStyle = '#536b69';
    context.lineWidth = 2.5;
    context.font = `800 ${Math.max(11, layout.logicalRadiusToCanvas(0.35))}px system-ui`;
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

  #stamp(context, index, point, size, alpha, angle = 0) {
    const art = this.assetManager?.getImage('illustration/combat-fx');
    if (!art) return false;
    const w = (art.naturalWidth || art.width) / 4, h = (art.naturalHeight || art.height) / 4;
    context.save(); context.globalCompositeOperation = 'screen'; context.globalAlpha = Math.min(1, Math.max(0, alpha));
    context.translate(point.x, point.y); context.rotate(angle);
    context.drawImage(art, index % 4 * w, Math.floor(index / 4) * h, w, h, -size / 2, -size / 2, size, size);
    context.restore(); return true;
  }
  #drawArt(context, layout, effect, point, progress, fade) {
    if (!this.assetManager?.getImage('illustration/combat-fx')) return false;
    const cell = layout.logicalRadiusToCanvas(1), row = ({fire:0,water:1,nature:2})[effect.element];
    const impact = row === undefined ? (effect.element === 'dark' ? 15 : 12) : row * 4 + 2;
    const source = effectSourcePoint(layout, effect, point), angle = Math.atan2(point.y-source.y, point.x-source.x);
    const scale = 1 - Math.pow(1 - progress, 3);
    switch (effect.effectPreset) {
      case 'basic_ranged_hit':
      case 'basic_shotgun_hit': {
        const flight = Math.min(1, effect.age / .14);
        if (flight < 1) {
          const head = {x:source.x+(point.x-source.x)*flight, y:source.y+(point.y-source.y)*flight};
          this.#stamp(context, row === undefined ? (effect.element === 'dark' ? 14 : 12) : row*4, head, cell*(effect.attackArchetype==='burst'?1.8:1.25), 1, angle);
        } else if (!effect.missed) this.#stamp(context, impact, point, cell*(effect.attackArchetype==='burst'?2.3:1.3)*(0.65+scale*.5), fade);
        if (progress < .3) this.#stamp(context, impact, source, cell*.75, 1-progress/.3);
        return true;
      }
      case 'basic_melee_hit':
        this.#stamp(context, row === undefined ? 14 : row*4+1, point, cell*(1.4+scale*.9), fade, angle-.5+progress*.6);
        this.#stamp(context, impact, point, cell, fade); return true;
      case 'basic_nova_hit':
      case 'basic_area_hit':
        this.#stamp(context, row === undefined ? impact : row*4+3, point, cell*Math.min(4.5,(effect.radius??2)*1.8)*(.4+scale*.6), fade);
        return true;
      case 'skill_single_hit':
      case 'skill_area_hit': {
        const index = effect.sourceId === 'lightning_sage' ? 13 : row === undefined ? impact : row*4+3;
        this.#stamp(context, index, point, cell*(effect.effectPreset==='skill_area_hit'?4.2:2.8)*(.5+scale*.6), fade);
        drawRing(context,point.x,point.y,cell*(effect.radius??.8)*scale,COLORS[effect.element],fade*.7,2); return true;
      }
      case 'critical_hit':
        this.#stamp(context,12,point,cell*(.8+scale),fade*.85);return true;
      default: return false;
    }
  }
}

export default EffectRenderer;
