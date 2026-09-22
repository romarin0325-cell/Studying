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

function drawClock(context, point, radius, progress, alpha) {
  drawRing(context, point.x, point.y, radius, '#a9e5ff', alpha * .6, 1.5);
  drawRing(context, point.x, point.y, radius * .86, '#ecd08c', alpha, 2);
  context.globalAlpha = alpha;
  context.strokeStyle = '#ecd08c'; context.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6, inner = i % 3 === 0 ? .68 : .76;
    context.beginPath();
    context.moveTo(point.x + Math.cos(angle) * radius * inner, point.y + Math.sin(angle) * radius * inner);
    context.lineTo(point.x + Math.cos(angle) * radius * .86, point.y + Math.sin(angle) * radius * .86);
    context.stroke();
  }
  const angle = -Math.PI / 2 + progress * Math.PI * 2;
  context.strokeStyle = '#fff8df'; context.lineWidth = 2.5;
  context.beginPath(); context.moveTo(point.x, point.y - radius * .35);
  context.lineTo(point.x, point.y);
  context.lineTo(point.x + Math.cos(angle) * radius * .63, point.y + Math.sin(angle) * radius * .63);
  context.stroke();
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
    // A hit event now means the simulation has reached impact. Never defer its
    // numbers or flash behind a second, presentation-only projectile.
    const effect = { ...event, age: 0, life: life ?? 0.5, travel: 0, flies: false };
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

  render(context, layout, projectiles = []) {
    for (const projectile of projectiles) this.#drawProjectile(context, layout, projectile);
    for (const effect of this.effects) this.#drawEffect(context, layout, effect);
    for (const popup of this.popups) this.#drawPopup(context, layout, popup);
  }

  #drawProjectile(context, layout, projectile) {
    const target = combatAnchor(layout, projectile.targetX, projectile.targetY,
      projectile.attackArchetype === 'area' ? 'ground' : projectile.targetIsBoss ? 'boss' : 'enemy');
    const source = effectSourcePoint(layout, projectile, target);
    const progress = projectile.progress, skill = projectile.actionKind === 'skill';
    const color = COLORS[projectile.element] ?? COLORS.neutral;
    const cell = layout.logicalRadiusToCanvas(1);
    context.save();
    context.lineCap = 'round';
    if (projectile.vfx === 'clock') {
      // The face fills with the actual fixed-tick cast/flight progress. Its
      // collapse and damage share impact; this is never a second fake delay.
      drawClock(context, target, cell * projectile.radius,
        projectile.phase === 'windup' ? 0 : progress, projectile.phase === 'windup' ? .5 : .9);
      drawRing(context, source.x, source.y, cell * .3, color, .8, 2);
      context.restore(); return;
    }
    if (projectile.phase === 'windup') {
      drawRing(context, source.x, source.y, cell * (.17 + progress * .23), color, .45 + progress * .5, skill ? 3 : 1.5);
      if (skill) {
        drawRing(context, target.x, target.y, cell * (projectile.radius || .45), color, .25 + progress * .3, 1.5);
        context.fillStyle = '#fff'; drawStar(context, source.x, source.y, cell*(.10+progress*.18), cell*.08, 4, progress); context.fill();
      }
      context.restore(); return;
    }
    const head = drawAnimatedTrace(context, source, target, progress, color, .9, Math.max(2, cell * (skill ? .16 : .09)), skill ? .35 : .2);
    const row = ({fire:0,water:1,nature:2})[projectile.element];
    const index = row === undefined ? (projectile.element === 'dark' ? 14 : 12) : row * 4;
    if (!this.reduced) this.#stamp(context, index, head, cell * (skill ? 1.9 : 1.05), 1, Math.atan2(target.y-source.y,target.x-source.x));
    drawRing(context, head.x, head.y, cell * (skill ? .23 : .12), color, .9, skill ? 3 : 2);
    context.globalAlpha = 1;
    context.fillStyle = '#fff';
    drawStar(context, head.x, head.y, cell * (skill ? .2 : .1), cell * .05, 4, progress * 9);
    context.fill();
    context.restore();
  }

  #drawEffect(context, layout, effect) {
    const travel = effect.travel ?? 0;
    // A laser is one translated ground-plane segment: lift both endpoints
    // equally so its preview, collision corridor and visible direction agree.
    const kind = ['skill_cast','basic_laser_hit','basic_shotgun_hit'].includes(effect.effectPreset) ? 'hero' : ['nova','area'].includes(effect.attackArchetype) || effect.type === 'starfall' ? 'ground' : effect.targetIsBoss ? 'boss' : 'enemy';
    const point = combatAnchor(layout, effect.x, effect.y, kind);
    const progress = Math.min(1, (effect.age - travel) / effect.life);
    const fade = 1 - progress;
    const color = COLORS[effect.element] ?? COLORS.neutral;
    const cell = layout.logicalRadiusToCanvas(1);
    const radius = layout.logicalRadiusToCanvas(effect.radius ?? 0.45);
    context.save();
    context.lineCap = 'round';
    if (effect.vfx === 'clock') {
      drawClock(context, point, radius * (1 - progress * .3), 1, fade);
      if (!this.reduced) for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6;
        drawShard(context, point.x + Math.cos(angle) * radius * progress,
          point.y + Math.sin(angle) * radius * progress, cell * .25 * fade, angle, '#c5eaff');
      }
      context.restore(); return;
    }
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
        const burst = effect.attackArchetype === 'burst';
        const head = point;
        drawRing(context, point.x, point.y, cell * (.12 + progress * (burst ? .7 : .35)), color, fade, burst ? 3 : 2);
        if (burst && !this.reduced) for(let i=0;i<5;i++) { const angle=i*1.256;drawShard(context,point.x+Math.cos(angle)*cell*progress*.65,point.y+Math.sin(angle)*cell*progress*.65,cell*.17*fade,angle,'#ecfaff'); }
        context.globalAlpha = fade;
        context.fillStyle = '#fff';
        context.fillRect(head.x - 1, head.y - cell * 0.08, 2, cell * 0.16);
        context.fillRect(head.x - cell * 0.08, head.y - 1, cell * 0.16, 2);
        break;
      }
      case 'basic_shotgun_hit': {
        const source = effectSourcePoint(layout, effect, point);
        const head = drawAnimatedTrace(context, source, point, 1, color, fade, Math.max(2, cell * 0.065), 1);
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
    const color = COLORS[effect.element] ?? COLORS.light;
    const cell = layout.logicalRadiusToCanvas(1), row = ({fire:0,water:1,nature:2})[effect.element];
    const impact = row === undefined ? (effect.element === 'dark' ? 15 : 12) : row * 4 + 2;
    const source = effectSourcePoint(layout, effect, point), angle = Math.atan2(point.y-source.y, point.x-source.x);
    const scale = 1 - Math.pow(1 - progress, 3);
    switch (effect.effectPreset) {
      case 'basic_ranged_hit':
      case 'basic_shotgun_hit': {
        if (effect.effectPreset === 'basic_shotgun_hit') {
          drawAnimatedTrace(context, source, point, 1, color, fade*.65, Math.max(2,cell*.07), 1);
          if (progress < .3) this.#stamp(context, impact, source, cell*.75, 1-progress/.3);
        }
        if (!effect.missed) this.#stamp(context, impact, point, cell*(effect.attackArchetype==='burst'?2.3:1.3)*(0.65+scale*.5), fade);
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
