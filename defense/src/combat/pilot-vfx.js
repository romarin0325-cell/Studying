import {activeSkill, attackDirection, cellPoint, combatStats, neighbors} from './engine.js';

const PILOT_HEROES = new Set(['cherry_prince', 'red_dragon', 'siren']);
const TAU = Math.PI * 2;
const clamp = n => Math.min(1, Math.max(0, n));
const ease = n => 1 - (1 - clamp(n)) ** 3;
const fade = (t, from = 0) => 1 - clamp((t - from) / (1 - from));
export const isPilotHero = hero => PILOT_HEROES.has(hero);
export const isPilotSkill = ({kind, blast}) => kind === 'royal' || kind === 'haste' || (kind === 'dragon' && !!blast);

function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
}

function petal(ctx, x, y, size, angle, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(size, size);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-.75, .18);
  ctx.bezierCurveTo(-.4, -.62, .43, -.66, .78, -.22);
  ctx.lineTo(.53, -.05);
  ctx.lineTo(.74, .12);
  ctx.bezierCurveTo(.37, .6, -.37, .49, -.75, .18);
  ctx.fill();
  ctx.restore();
}

function blade(ctx, length, width, gold = false) {
  const g = ctx.createLinearGradient(-length * .5, width, length * .5, -width);
  g.addColorStop(0, gold ? '#88471510' : '#7c214230');
  g.addColorStop(.45, gold ? '#e6a44e' : '#c95182');
  g.addColorStop(.73, gold ? '#fff7c5' : '#ffe6ef');
  g.addColorStop(1, '#fffdf5');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-length * .55, width * .58);
  ctx.quadraticCurveTo(-length * .08, -width * 1.12, length * .53, -width * .7);
  ctx.quadraticCurveTo(length * .15, width * .33, -length * .55, width * .58);
  ctx.fill();
}

function flameTexture(fx) {
  if (fx.pilotFlame) return fx.pilotFlame;
  const texture = document.createElement('canvas');
  texture.width = texture.height = 128;
  const ctx = texture.getContext('2d');
  ctx.translate(64, 118);
  ctx.scale(79, 104);
  const g = ctx.createLinearGradient(0, 0, 0, -1);
  g.addColorStop(0, '#7d211c');
  g.addColorStop(.31, '#d74e24');
  g.addColorStop(.65, '#ffa052');
  g.addColorStop(1, '#ffdd83');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-.52, 0);
  ctx.bezierCurveTo(-.9, -.33, -.16, -.55, -.31, -.79);
  ctx.quadraticCurveTo(.08, -.68, .34, -1);
  ctx.bezierCurveTo(.67, -.54, .04, -.42, .52, -.45);
  ctx.quadraticCurveTo(.8, -.16, .5, 0);
  ctx.quadraticCurveTo(0, .11, -.52, 0);
  ctx.fill();
  const core = ctx.createLinearGradient(0, .03, 0, -.75);
  core.addColorStop(0, '#ff852c22');
  core.addColorStop(.29, '#ffc669');
  core.addColorStop(.68, '#fff0b9');
  core.addColorStop(1, '#ffe5ac');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.moveTo(-.31, .02);
  ctx.bezierCurveTo(-.51, -.23, .08, -.35, .13, -.7);
  ctx.bezierCurveTo(.29, -.41, .04, -.36, .41, -.25);
  ctx.quadraticCurveTo(.53, -.05, .31, .04);
  ctx.fill();
  fx.pilotFlame = texture;
  return texture;
}

function flame(fx, x, y, height, width, tilt) {
  const ctx = fx.ctx;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.drawImage(flameTexture(fx), -width * .81, -height * 1.13, width * 1.62, height * 1.23);
  ctx.restore();
}

export function drawPilotShot(fx, shot, {x, y, angle, t}) {
  if (!isPilotHero(shot.hero)) return false;
  const ctx = fx.ctx;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (shot.hero === 'cherry_prince') {
    if (!fx.reduced) {
      ctx.globalAlpha = .46;
      ctx.translate(-15, 3);
      blade(ctx, 43, 6);
      ctx.translate(15, -3);
    }
    ctx.globalAlpha = 1;
    blade(ctx, 40, 11);
    petal(ctx, -9, 3, 8, t * 5, '#fbb4cd');
  } else if (shot.hero === 'red_dragon') {
    if (!fx.reduced) {
      ctx.globalAlpha = .54;
      flame(fx, -5, 0, 39, 12, -Math.PI / 2);
    }
    ctx.globalAlpha = 1;
    flame(fx, 8, 0, 24, 17, -Math.PI / 2);
    ctx.fillStyle = '#fff0b7';
    ellipse(ctx, 4, 0, 7, 4);
    ctx.fill();
  } else {
    // Two folded wave fronts. The darker edge holds on the bright garden.
    for (const [offset, height] of [[-9, 7], [2, 10]]) {
      ctx.beginPath();
      ctx.moveTo(offset - 5, -height);
      ctx.quadraticCurveTo(offset + height * 2, 0, offset - 5, height);
      ctx.strokeStyle = '#28618d';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = '#c8f7ff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }
  ctx.restore();
  return true;
}

// The arcs mark the logical circular hit boundary. Opacity is shared by simultaneous basics.
export function drawPilotAttackFloor(fx, e, t, clarity) {
  if (!e.hitTargets?.length || !e.radius) return;
  const ctx = fx.ctx, water = e.hero === 'siren';
  ctx.save();
  ctx.globalAlpha = fade(t, .12) * clarity;
  ctx.strokeStyle = water ? '#245b84' : '#742822';
  ctx.lineWidth = 6;
  ellipse(ctx, e.x, e.y, e.radius, e.radius);
  ctx.stroke();
  ctx.strokeStyle = water ? '#a7e8fa' : '#ffc179';
  ctx.lineWidth = 2.7;
  ctx.stroke();
  if (!fx.reduced) {
    ctx.globalAlpha *= .48;
    const r = e.radius * (.28 + .72 * ease(t * 1.35));
    ellipse(ctx, e.x, e.y, r, r);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPilotImpact(fx, e, t, clarity) {
  const royal = e.kind === 'royal';
  const royalResult = royal && (e.type === 'finisherImpact' || e.type === 'finisherFizzle');
  const basic = e.type === 'impact' && isPilotHero(e.hero) && e.hitTargets;
  if (!royalResult && !basic) return false;
  const ctx = fx.ctx;
  ctx.save();
  if (e.type === 'finisherFizzle') {
    for (let i = 0; i < 4; i++) {
      const a = i * TAU / 4, r = 21 * (1 - t);
      ctx.globalAlpha = fade(t);
      petal(ctx, e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, 8, a, '#e6a1bc');
    }
  } else if (royal || e.hero === 'cherry_prince') {
    const hit = royal ? e : e.hitTargets[0];
    if (hit) {
      const y = hit.y - ((royal ? e.targetBoss : hit.boss) ? 35 : 18);
      const angle = -.65, length = royal ? (e.targetBoss ? 156 : 123) : 50;
      ctx.save();
      ctx.translate(hit.x, y);
      ctx.rotate(angle);
      ctx.globalAlpha = fade(t, .07) * clarity;
      const visible = length * (fx.reduced ? 1 : .82 + .18 * ease(t * 4));
      blade(ctx, visible, (royal ? 26 : 13) * (1 - t * .7), false);
      if (hit.enhanced) {
        ctx.translate(4, royal ? 14 : 6);
        blade(ctx, visible * .73, royal ? 13 : 7, true);
      }
      ctx.restore();
      const count = fx.reduced ? 2 : royal ? 7 : 2;
      for (let i = 0; i < count; i++) {
        const a = i * 2.4, r = (royal ? 18 + i * 7 : 14) * ease(t * 1.3);
        ctx.globalAlpha = fade(t, .34) * clarity;
        petal(ctx, hit.x + Math.cos(a) * r, y + Math.sin(a) * r * .75, royal ? 9 : 5,
          a + (fx.reduced ? 0 : t * 2), i % 2 ? '#fca8c5' : '#ffe7e9');
      }
    }
  } else {
    for (const p of e.hitTargets) {
      ctx.globalAlpha = fade(t, .16) * clarity;
      if (e.hero === 'red_dragon') {
        flame(fx, p.x, p.y + 2, p.enhanced ? 32 : 23, 15, -.16);
        if (p.enhanced) flame(fx, p.x + 11, p.y + 3, 22, 11, .38);
      } else {
        ctx.strokeStyle = '#94d8ef';
        ctx.lineWidth = 3;
        ellipse(ctx, p.x, p.y - 3, 9 + t * 8, 4 + t * 4);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
  return true;
}

export function drawRoyalLock(fx, p) {
  const ctx = fx.ctx;
  ctx.save();
  ctx.strokeStyle = '#622341';
  ctx.lineWidth = 6;
  ellipse(ctx, p.x, p.y + 8, 24, 12);
  ctx.stroke();
  ctx.strokeStyle = '#ffc2d4';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  for (const side of [-1, 1]) petal(ctx, p.x + side * 25, p.y + 7, 11, side * .4, '#ffd9e6');
  ctx.restore();
}

export function drawRoyalReady(fx, f, to, progress) {
  const ctx = fx.ctx, facing = attackDirection(f.origin, to);
  const x = f.origin.x + (facing === 'left' || facing === 'up' ? -12 : 10);
  const y = f.origin.y + 13;
  const angle = Math.atan2(to.y - f.origin.y, to.x - f.origin.x);
  const gleam = .27 + .72 * progress;
  fx.atlasStamp('finishers', 1, 4, 3, x + Math.cos(angle) * 14, y + Math.sin(angle) * 14,
    54, 33, angle, gleam * .67);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = gleam;
  blade(ctx, 17 + progress * 21, 7, true);
  ctx.restore();
}

// Approximate mouth anchors measured in the approved four-direction SD at the in-game size.
const MOUTH = {down:[3,-22], up:[0,-18], left:[-13,-19], right:[15,-19]};
function dragonRibbon(ctx, from, to, strength, phase) {
  const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy);
  if (length < 16 || strength <= 0) return;
  ctx.save();
  ctx.translate(from.x, from.y);
  ctx.rotate(Math.atan2(dy, dx));
  ctx.globalAlpha *= strength;
  const bend = Math.min(51, length * .20);
  const spine = f => -bend * Math.sin(Math.PI * f) + Math.sin(f * 13 - phase * 24) * 20 * f * (1 - f);
  const spread = f => (3 + 30 * f ** 1.4) * (.87 + .13 * Math.sin(f * 23 - phase * 28));
  const g = ctx.createLinearGradient(0, 0, length, 0);
  g.addColorStop(0, '#fff8c7');
  g.addColorStop(.27, '#ff9e4d');
  g.addColorStop(.74, '#dd5930e5');
  g.addColorStop(1, '#9c321e2c');
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    const f = i / 20;
    ctx.lineTo(length * f, spine(f) - spread(f));
  }
  for (let i = 20; i >= 0; i--) {
    const f = i / 20;
    ctx.lineTo(length * f, spine(f) + spread(f));
  }
  ctx.closePath();
  ctx.fill();
  const heat = ctx.createLinearGradient(0, 0, length, 0);
  heat.addColorStop(0,'#fff9d8');
  heat.addColorStop(.52,'#ffce77');
  heat.addColorStop(1,'#ff8e4100');
  ctx.strokeStyle = heat;
  for (const [offset, width] of [[-.58,2.8],[0,5.5],[.49,3.2]]) {
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const f = i / 20;
      const ripple = Math.sin(f * 24 - phase * 31 + offset * 6) * f * 5;
      ctx.lineTo(length * f, spine(f) + spread(f) * offset + ripple);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPilotCast(fx, skill, age) {
  if (!isPilotSkill(skill)) return false;
  if (skill.kind === 'royal') return true; // The live finisher owns the windup and impact.
  const ctx = fx.ctx, o = skill.origin;
  if (skill.kind === 'haste') {
    const t = clamp(age / .52);
    if (t === 1 || fx.reduced) return true;
    ctx.save();
    ctx.globalAlpha = fade(t, .06) * .68;
    const radius = 28 + 460 * ease(t);
    for (const [gap, width, color] of [[0,5,'#17476d'],[0,2,'#9be3ff'],[12,1.8,'#67aacb']]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ellipse(ctx, o.x, o.y + 22, radius - gap, (radius - gap) * .76);
      ctx.stroke();
    }
    ctx.restore();
    return true;
  }

  const t = clamp(age / .76), {x, y, radius} = skill.blast;
  if (t === 1) return true;
  ctx.save();
  ctx.globalAlpha = fade(t, .08) * (fx.reduced ? .7 : .92);
  const floor = ctx.createRadialGradient(x, y, 0, x, y, radius);
  floor.addColorStop(0, '#ffdc913d');
  floor.addColorStop(.69, '#ff6b2c12');
  floor.addColorStop(.94, '#e25c2554');
  floor.addColorStop(1, '#8f272280');
  ctx.fillStyle = floor;
  ctx.strokeStyle = '#572a27';
  ctx.lineWidth = 8;
  ellipse(ctx, x, y, radius, radius);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#ffc272';
  ctx.lineWidth = 3.5;
  ctx.stroke();
  // Start on the actual boundary; split into tongues as the wall cools.
  const count = fx.reduced ? 7 : 15;
  const height = (1 - ease(t * .96)) * 36 + 8;
  for (let i = 0; i < count; i++) {
    const a = (i + .34 * Math.sin(i * 2.7)) * TAU / count, variation = .54 + (i * 7 % 11) / 17;
    flame(fx, x + Math.cos(a) * (radius - 5), y + Math.sin(a) * (radius - 5),
      height * variation, (fx.reduced ? 20 : 26) * variation, Math.cos(a) * .31);
  }
  if (!fx.reduced) {
    const [dx, dy] = MOUTH[attackDirection(o, skill.blast)];
    dragonRibbon(ctx, {x:o.x + dx, y:o.y + dy}, {x,y:y - 9}, ease(age / .07) * fade(clamp(age / .44), .27), t);
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4, r = radius * (.24 + (i * 7 % 13) / 19);
      const rise = t * (28 + i % 5 * 14), px = x + Math.cos(a) * r, py = y + Math.sin(a) * r - rise;
      ctx.fillStyle = i % 3 ? '#6f3732' : '#ffad68';
      ctx.fillRect(px, py, 2.6 + i % 3, 2.6 + i % 3);
    }
  }
  for (const p of skill.targets) flame(fx, p.x, p.y, height * 1.1, 23, -.24);
  ctx.restore();
  return true;
}

function note(ctx, x, y, focus, progress) {
  ctx.fillStyle = '#103044';
  ctx.strokeStyle = focus ? '#ffd87d' : '#85d6f4';
  ctx.lineWidth = focus ? 2.8 : 1.8;
  ellipse(ctx, x, y, 12, 12);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#e1faff';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(x + 1.5, y + 4);
  ctx.lineTo(x + 1.5, y - 5.5);
  ctx.quadraticCurveTo(x + 5, y - 5, x + 6, y - 2);
  ctx.stroke();
  ctx.fillStyle = '#e1faff';
  ellipse(ctx, x - 1, y + 4.4, 3.1, 2.35);
  ctx.fill();
  if (focus) {
    ctx.beginPath();
    ctx.moveTo(x - 3.5, y - .7);
    ctx.lineTo(x - 3.5, y - 6.5);
    ctx.lineTo(x + 1.5, y - 5.5);
    ctx.stroke();
    ellipse(ctx, x - 5, y - .8, 2.5, 1.9);
    ctx.fill();
  }
  ctx.strokeStyle = focus ? '#ffe5a4' : '#e1faff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 14.7, -Math.PI / 2, -Math.PI / 2 + TAU * progress);
  ctx.stroke();
}

export function drawSirenSupport(fx, s) {
  const active = activeSkill(s, 'siren');
  const auraCells = active ? null : new Set(s.board.flatMap((u,i)=>u?.hero==='siren'&&!u.cursed?neighbors(i):[]));
  if (auraCells && !auraCells.size) return;
  const ctx = fx.ctx;
  ctx.save();
  for (const [i, u] of s.board.entries()) {
    if (!u || (auraCells && !auraCells.has(i))) continue;
    const {sirenAura, sirenHaste} = combatStats(s, u, i);
    if (!sirenAura && !sirenHaste) continue;
    const p = cellPoint(i);
    if (sirenAura) {
      ctx.strokeStyle = '#94c9dfbb';
      ctx.lineWidth = 1.9;
      for (const dy of [0, 4]) {
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + 25 + dy, 28, 8, 0, Math.PI * .12, Math.PI * .88);
        ctx.stroke();
      }
    }
    if (sirenHaste && active) {
      const focus = s.artifacts.includes('spotlight') && s.buffSpotlight?.haste === u.uid;
      note(ctx, p.x - 31, p.y + 25, focus, active.remaining / active.total);
    }
  }
  ctx.restore();
}
