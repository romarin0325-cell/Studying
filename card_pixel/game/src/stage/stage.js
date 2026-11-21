/* RelayStage: the pixel stage. A low-resolution canvas (2x integer upscale), a virtual clock so
   every animation can be sped up or skipped, sprite variants (flash, waiting, shadow, boss),
   a camera that punches in at an integer zoom, cached backgrounds, props and particles. It knows nothing about rules. */
import { SPRITE_SOCKET_OVERRIDES } from '../content/sprite-sockets.js';
import { MOTION_FRAME, motionPoint, socketPoint, spriteBox } from '../ui/battle/motion.js';

export function createStage(ASSETS) {
  const SCALE = 2;
  const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  /* ---------- virtual clock ---------- */
  const clock = { t: 0, speed: 1, fast: false, slow: 1, paused: false, waiters: [], tweens: [] };
  function wait(sec) { return new Promise(res => clock.waiters.push({ at: clock.t + sec, res })); }
  const EASE = { lin: k => k, out: k => 1 - (1 - k) * (1 - k), in: k => k * k, back: k => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2) };
  function tween(obj, to, dur, ease) {
    const from = {}; for (const k in to) from[k] = obj[k];
    return new Promise(res => clock.tweens.push({ obj, from, to, dur, t: 0, ease: EASE[ease || 'out'], res }));
  }
  function stepClock(real) {
    if (clock.paused) return 0;                 // an info sheet is open: the battle waits
    const dt = real * (clock.fast ? 6 : clock.speed) * clock.slow;
    clock.t += dt;
    for (let i = clock.tweens.length - 1; i >= 0; i--) {
      const w = clock.tweens[i]; w.t += dt;
      const k = Math.min(1, w.t / w.dur), e = w.ease(k);
      for (const p in w.to) w.obj[p] = w.from[p] + (w.to[p] - w.from[p]) * e;
      if (k >= 1) { clock.tweens.splice(i, 1); w.res(); }
    }
    for (let i = clock.waiters.length - 1; i >= 0; i--) {
      const w = clock.waiters[i];
      if (w.at <= clock.t) { clock.waiters.splice(i, 1); w.res(); }
    }
    return dt;
  }


  /* ---------- sprites and their variants ---------- */
  const IMG = {};   // IMG[key] = { base: Image, <variant>: canvas }
  const backgrounds = new Map();
  const RECOLOR = {
    shadow(r, g, b) {
      const l = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
      const ramp = l < 0.5 ? [22 + l * 150, 12 + l * 100, 44 + l * 220] : [97 + (l - 0.5) * 200, 62 + (l - 0.5) * 210, 154 + (l - 0.5) * 200];
      return [ramp[0] * 0.78 + r * 0.14, ramp[1] * 0.78 + g * 0.1, ramp[2] * 0.78 + b * 0.16];
    },
    boss(r, g, b) {
      const l = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
      const ramp = l < 0.5 ? [8 + l * 90, 22 + l * 190, 46 + l * 240] : [53 + (l - 0.5) * 300, 117 + (l - 0.5) * 270, 166 + (l - 0.5) * 178];
      return [ramp[0] * 0.72 + r * 0.2, ramp[1] * 0.72 + g * 0.16, ramp[2] * 0.72 + b * 0.3];
    },
    wait(r, g, b) { return [r * 0.46 + 12, g * 0.42 + 8, b * 0.52 + 20]; },
    white() { return [255, 255, 255]; },
    violet() { return [150, 96, 255]; },
    cyan() { return [96, 224, 255]; },
    gold() { return [255, 200, 87]; },
    red() { return [255, 80, 70]; }
  };
  function variant(key, name) {
    const entry = IMG[key];
    if (!entry) return null;
    if (name === 'base') return entry.base;
    if (entry[name]) return entry[name];
    const im = entry.base, c = document.createElement('canvas');
    c.width = im.width; c.height = im.height;
    const x = c.getContext('2d');
    x.drawImage(im, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height), fn = RECOLOR[name];
    for (let i = 0; i < d.data.length; i += 4) {
      if (!d.data[i + 3]) continue;
      const rgb = fn(d.data[i], d.data[i + 1], d.data[i + 2]);
      d.data[i] = rgb[0]; d.data[i + 1] = rgb[1]; d.data[i + 2] = rgb[2];
    }
    x.putImageData(d, 0, 0);
    entry[name] = c;
    return c;
  }
  /** A 1 px outline around the silhouette, one pixel outside the sprite (canvas is 2 px larger). */
  function rimOf(key) {
    const entry = IMG[key];
    if (!entry) return null;
    if (entry.rim) return entry.rim;
    const im = entry.base, w = im.width, h = im.height;
    const src = document.createElement('canvas'); src.width = w; src.height = h;
    const sx = src.getContext('2d'); sx.drawImage(im, 0, 0);
    const a = sx.getImageData(0, 0, w, h).data;
    const c = document.createElement('canvas'); c.width = w + 2; c.height = h + 2;
    const x = c.getContext('2d'), out = x.createImageData(w + 2, h + 2), d = out.data;
    const solid = (px, py) => px >= 0 && py >= 0 && px < w && py < h && a[(py * w + px) * 4 + 3] > 0;
    for (let y = -1; y <= h; y++) for (let X0 = -1; X0 <= w; X0++) {
      if (solid(X0, y)) continue;
      if (solid(X0 - 1, y) || solid(X0 + 1, y) || solid(X0, y - 1) || solid(X0, y + 1)) {
        const i = ((y + 1) * (w + 2) + (X0 + 1)) * 4;
        d[i] = RIM.color[0]; d[i + 1] = RIM.color[1]; d[i + 2] = RIM.color[2]; d[i + 3] = 255;
      }
    }
    x.putImageData(out, 0, 0);
    entry.rim = c;
    return c;
  }
  function loadSprites() {
    return Promise.all(Object.keys(ASSETS.sp).map(key => new Promise(res => {
      const im = new Image();
      im.onload = () => { IMG[key] = { base: im }; res(); };
      im.onerror = res;
      im.src = ASSETS.sp[key].src;
    })));
  }

  function loadBackground(id) {
    const src = ASSETS.bg?.[id];
    if (!src || backgrounds.has(id)) return;
    const image = new Image();
    backgrounds.set(id, null);
    image.onload = () => {
      backgrounds.set(id, image);
      if (S.bg === id) bgCache = null;
    };
    image.src = src;
  }

  /* ---------- stage state ---------- */
  const RIM = { on: true, color: [226, 216, 255], alpha: 0.6 };
  const effectsOn = !reducedMotion();
  let shake = 0, flash = 0;
  const S = { W: 195, H: 200, BASE: 172, bg: 'cave', actors: [], parts: [], props: [], dark: 0, danger: 0, tint: null, tintA: 0,
    shakeOn: effectsOn, flashOn: effectsOn,
    get shake() { return this.shakeOn ? shake : 0; },
    set shake(value) { shake = this.shakeOn ? value : 0; },
    get flash() { return this.flashOn ? flash : 0; },
    set flash(value) { flash = this.flashOn ? value : 0; },
    cam: { k: 1, x: 0, y: 0 }, beads: { burn: 0, divine: 0, x: 0, y: 0 } };
  // The gallery reads the effective amplitudes through the existing window.__game.clock hook.
  Object.defineProperty(clock, 'screenEffects', { get: () => ({ shake: S.shake, flash: S.flash }) });
  let cv, ctx, fxLayer, bgCache = null;

  const ELEMENT_COLORS = {
    fire: ['#ffe07a', '#ff8a3a', '#ff5a3c'], water: ['#d6fbff', '#5fd4ff', '#3b82f6'], nature: ['#e2ffb0', '#7fdc6a', '#3fa35c'],
    light: ['#ffffff', '#fff1a8', '#ffc857'], dark: ['#e6d4ff', '#a678ff', '#5b3fd0'], none: ['#ffffff', '#ffc857', '#ff6b5e']
  };

  function makeActor(o) {
    const a = Object.assign({ sprite: 'ash', look: 'base', flip: false, x: 0, y: 0, ox: 0, oy: 0, alpha: 1, pose: 'idle', white: 0, wait: 0, vis: true, aura: null, front: 0, phase: Math.random() * 6 }, o);
    S.actors.push(a);
    return a;
  }
  function removeActor(a) { const i = S.actors.indexOf(a); if (i >= 0) S.actors.splice(i, 1); }
  function meta(a, pose) { return ASSETS.sp[a.sprite + '-' + (pose || a.pose)] || ASSETS.sp[a.sprite + '-idle']; }
  const X = a => a.x + a.ox;
  const footY = a => S.BASE + (a ? a.y || 0 : 0);           // every actor stands on its own lane of the floor
  const tall = a => (meta(a, 'idle') ? meta(a, 'idle').fy + 1 : 72);
  const headY = a => footY(a) - tall(a);
  const chestY = a => footY(a) - Math.round(tall(a) * 0.5);
  function socket(a, name) {
    const pose = ASSETS.sp[a.sprite + '-' + a.pose] ? a.pose : 'idle';
    const key = a.sprite + '-' + pose;
    return socketPoint({ ...a, y: S.BASE + a.y }, meta(a, pose),
      { ...ASSETS.sockets?.[key], ...SPRITE_SOCKET_OVERRIDES[key] }, name);
  }
  function actorBox(a, m, now) {
    const box = spriteBox(a, m, S.BASE);
    const bob = a.pose === 'idle' && !a.still && !a.casting ? Math.round(Math.sin(now / 420 + a.phase) * 0.6) : 0;
    return { ...box, top: box.top + bob };
  }

  /* ---------- particles ---------- */
  function sparks(x, y, n, colors, pow, grav) {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * 6.283, v = (pow || 60) * (0.3 + Math.random() * 0.7);
      S.parts.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - 20, g: grav == null ? 170 : grav, life: 0.22 + Math.random() * 0.35, c: colors[i % colors.length], s: Math.random() < 0.3 ? 2 : 1 });
    }
  }
  function fly(x0, y0, x1, y1, dur, c, arc, s, done, img) {
    S.parts.push({ bz: 1, t: 0, dur, x0, y0, x1, y1, cx: (x0 + x1) / 2 + (Math.random() - 0.5) * 16, cy: Math.min(y0, y1) - (arc == null ? 30 : arc), c, s: s || 1, done, img, x: x0, y: y0, trail: [] });
  }
  function rise(x, y, n, colors, spread) {
    for (let i = 0; i < n; i++) S.parts.push({ x: x + (Math.random() - 0.5) * (spread || 30), y: y - Math.random() * 30, vx: 0, vy: -26 - Math.random() * 26, g: 0, life: 0.5 + Math.random() * 0.4, c: colors[i % colors.length], s: i % 4 ? 1 : 2 });
  }
  /** Particles drawn inward to a point: the wind-up before a big move. */
  function converge(x, y, n, colors, radius, dur) {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * 6.283, r = (radius || 30) * (0.6 + Math.random() * 0.4);
      S.parts.push({ bz: 1, t: 0, dur: (dur || 0.3) * (0.7 + Math.random() * 0.3), x0: x + Math.cos(ang) * r, y0: y + Math.sin(ang) * r * 0.7, x1: x, y1: y, cx: x + Math.cos(ang + 0.9) * r * 0.6, cy: y + Math.sin(ang + 0.9) * r * 0.4, c: colors[i % colors.length], s: i % 3 ? 1 : 2, x, y, trail: [] });
    }
  }
  function ring(x, y, color, radius = 26, life = 0.3, still = false) {
    S.parts.push({ ring: 1, x, y, r: still ? radius : 2, to: radius, life, max: life, c: color });
  }
  function dust(x, y) { for (let i = 0; i < 8; i++) S.parts.push({ x: x + (Math.random() - 0.5) * 18, y: (y == null ? S.BASE : y) - 1, vx: (Math.random() - 0.5) * 40, vy: -10 - Math.random() * 22, g: 60, life: 0.3 + Math.random() * 0.25, c: i % 2 ? '#8c7486' : '#6b5566', s: i % 3 ? 1 : 2 }); }
  function gem(x0, y0, x1, y1, dur, done) { S.parts.push({ bz: 1, gem: 1, t: 0, dur, x0, y0, x1, y1, cx: x0 + (Math.random() - 0.5) * 40, cy: Math.min(y0, y1) - 34, x: x0, y: y0, done, trail: [] }); }
  function updateParts(dt) {
    for (let i = S.parts.length - 1; i >= 0; i--) {
      const p = S.parts[i];
      if (p.bz) {
        p.t += dt / p.dur; const t = Math.min(1, p.t), u = 1 - t;
        if (p.trail) { p.trail.push(p.x, p.y); if (p.trail.length > 8) p.trail.splice(0, 2); }
        p.x = u * u * p.x0 + 2 * u * t * p.cx + t * t * p.x1; p.y = u * u * p.y0 + 2 * u * t * p.cy + t * t * p.y1;
        if (p.t >= 1) { S.parts.splice(i, 1); if (p.done) p.done(); }
      } else if (p.ring || p.sl) { p.life -= dt; if (p.life <= 0) S.parts.splice(i, 1); }
      else { p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.life <= 0) S.parts.splice(i, 1); }
    }
  }

  /* ---------- backgrounds (drawn once into a cache, torches animate on top) ---------- */
  const BG = {
    cave: { sky: '#140d1f', wall: '#24152b', brick: '#1b1022', pillar: ['#170d1d', '#2e1a33'], trim: ['#5a2230', '#8a3a2e'], floor: ['#3a2434', '#4d3044', '#251526'], flame: ['#ff8a3a', '#ffe07a'], glow: 'rgba(255,150,60,.10)' },
    gate: { sky: '#0f1024', wall: '#1d1b3a', brick: '#15142c', pillar: ['#11102a', '#2c2a55'], trim: ['#3b2f6b', '#6a55b8'], floor: ['#272446', '#34305c', '#17152e'], flame: ['#a678ff', '#e6d4ff'], glow: 'rgba(166,120,255,.12)' },
    throne: { sky: '#081420', wall: '#10283a', brick: '#0b1d2c', pillar: ['#091a28', '#1c4660'], trim: ['#1d5a78', '#3fb2d6'], floor: ['#16303f', '#1f4458', '#0c1e29'], flame: ['#5fd4ff', '#e2fbff'], glow: 'rgba(95,212,255,.12)' }
  };
  function paintLandscape(image) {
    const c = document.createElement('canvas');
    c.width = S.W + 16;
    c.height = S.H + 16;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.translate(8, 8);
    const x = Math.floor((S.W - image.width) / 2);
    const y = S.H - image.height;
    const cap = S.bg === 'twilight_cathedral' && y < -10 ? 86 : 0;
    const artworkTop = cap ? 0 : y;
    g.drawImage(image, Math.floor(image.width / 2), 0, 1, 1, -8, -8, c.width, c.height);
    g.drawImage(image, x, y);
    if (cap) {
      // Keep the bell and the floor at native scale by cropping the middle of the wall.
      g.drawImage(image, 0, 0, image.width, cap, x, 0, image.width, cap);
    }
    if (S.bossRoom) {
      g.fillStyle = 'rgba(12,7,27,.32)';
      g.fillRect(-8, -8, c.width, c.height);
    }
    const bell = S.bg === 'twilight_cathedral' ? { x: x + 143, y: artworkTop + 62 } : null;
    bgCache = { canvas: c, bell };
  }

  function paintBg() {
    const landscape = backgrounds.get(S.bg);
    if (landscape) {
      paintLandscape(landscape);
      return;
    }
    const p = BG[S.bg] || BG.cave, W = S.W, H = S.H, wallTop = 14, wallBottom = S.BASE - 70;
    const c = document.createElement('canvas'); c.width = W + 16; c.height = H + 16;
    const g = c.getContext('2d'); g.translate(8, 8);
    g.fillStyle = p.sky; g.fillRect(-8, -8, W + 16, H + 16);
    g.fillStyle = p.wall; g.fillRect(-8, wallTop, W + 16, wallBottom - wallTop);
    g.fillStyle = p.brick;
    for (let y = wallTop, row = 0; y < wallBottom; y += 12, row++) { g.fillRect(-8, y, W + 16, 1); for (let x = row % 2 ? -8 : 3; x < W + 8; x += 22) g.fillRect(x, y, 1, 12); }
    const cols = [Math.round(W * 0.2), Math.round(W * 0.56), Math.round(W * 0.92)];
    for (const px of cols) { g.fillStyle = p.pillar[0]; g.fillRect(px - 6, wallTop, 12, wallBottom - wallTop); g.fillStyle = p.pillar[1]; g.fillRect(px - 4, wallTop, 2, wallBottom - wallTop); }
    if (S.bg === 'gate') {       // a tall arch between the pillars
      const ax = Math.round(W * 0.38), aw = Math.round(W * 0.36) - 12;
      g.fillStyle = '#090818'; g.fillRect(ax - aw / 2, wallTop + 18, aw, wallBottom - wallTop - 18);
      g.fillRect(ax - aw / 2 + 4, wallTop + 11, aw - 8, 7); g.fillRect(ax - aw / 2 + 9, wallTop + 6, aw - 18, 5);
      g.fillStyle = p.trim[0]; g.fillRect(ax - aw / 2 - 2, wallTop + 18, 2, wallBottom - wallTop - 18); g.fillRect(ax + aw / 2, wallTop + 18, 2, wallBottom - wallTop - 18);
    }
    if (S.bg === 'throne') {     // banners and a cold window
      for (const px of [Math.round(W * 0.38), Math.round(W * 0.74)]) {
        g.fillStyle = '#0c3348'; g.fillRect(px - 8, wallTop + 5, 16, 46); g.fillStyle = '#1a6c8f'; g.fillRect(px - 6, wallTop + 5, 12, 42);
        g.fillStyle = '#9defff'; g.fillRect(px - 2, wallTop + 18, 4, 4); g.fillRect(px - 4, wallTop + 22, 8, 2); g.fillStyle = '#0c3348'; g.fillRect(px - 3, wallTop + 47, 6, 4);
      }
    }
    g.fillStyle = p.trim[0]; g.fillRect(-8, wallBottom - 4, W + 16, 4); g.fillStyle = p.trim[1]; g.fillRect(-8, wallBottom - 1, W + 16, 1);
    g.fillStyle = p.floor[0]; g.fillRect(-8, wallBottom, W + 16, H - wallBottom + 8); g.fillStyle = p.floor[1]; g.fillRect(-8, wallBottom, W + 16, 2);
    // flagstones that grow toward the viewer: rows get taller, seams get wider
    for (let y = wallBottom + 5, row = 0, step = 6; y < H + 8; y += step, step += 3, row++) {
      g.fillStyle = p.floor[2]; g.fillRect(-8, y, W + 16, 1);
      g.globalAlpha = 0.3; g.fillStyle = p.floor[1]; g.fillRect(-8, y + 1, W + 16, 1); g.globalAlpha = 1; g.fillStyle = p.floor[2];
      const span = 20 + row * 7;
      for (let x = (row % 2 ? span / 2 : 0) - 8; x < W + 8; x += span) g.fillRect(Math.round(x), y, 1, step);
    }
    bgCache = { canvas: c, cols, torchY: wallTop + Math.round((wallBottom - wallTop) * 0.4), p };
  }
  function drawBg(now) {
    if (!bgCache) paintBg();
    ctx.drawImage(bgCache.canvas, -8, -8);
    if (!bgCache.p) return;
    const f = (now / 170 | 0) % 2, p = bgCache.p;
    for (const px of bgCache.cols.slice(0, 2)) {
      const y = bgCache.torchY;
      ctx.fillStyle = p.glow; ctx.fillRect(px - 12, y - 10, 25, 26);
      ctx.fillStyle = '#6b4a2a'; ctx.fillRect(px - 1, y + 6, 3, 8);
      ctx.fillStyle = p.flame[0]; ctx.fillRect(px - 2, y + f, 5, 6 - f);
      ctx.fillStyle = p.flame[1]; ctx.fillRect(px - 1, y + 2 + f, 3, 3);
    }
  }

  /* ---------- drawing ---------- */
  function drawActor(a, now) {
    if (!a.vis || a.alpha <= 0.01) return;
    const key = a.sprite + '-' + a.pose, m = meta(a);
    if (!m) return;
    const look = a.white > 0 ? 'white' : (a.wait > 0.5 ? (a.look === 'base' ? 'wait' : a.look) : a.look);
    const img = variant(IMG[key] ? key : a.sprite + '-idle', look);
    if (!img) return;
    const base = footY(a), { cx, left, top } = actorBox(a, m, now);
    const sw = Math.round(m.w * 0.6);
    ctx.globalAlpha = 0.36 * a.alpha; ctx.fillStyle = '#000';
    ctx.fillRect(cx - (sw >> 1), base - 1, sw, 2); ctx.fillRect(cx - (sw >> 1) + 2, base + 1, sw - 4, 1);
    const blit = (image, dx, dy) => {
      if (a.flip) { ctx.save(); ctx.translate(left + m.w + dx, top + dy); ctx.scale(-1, 1); ctx.drawImage(image, 0, 0); ctx.restore(); }
      else ctx.drawImage(image, left + dx, top + dy);
    };
    if (RIM.on && a.white <= 0 && a.rim !== false) {     // light rim behind the sprite, under any aura
      const rim = rimOf(IMG[key] ? key : a.sprite + '-idle');
      if (rim) {
        ctx.globalAlpha = a.alpha * RIM.alpha * (a.wait > 0.5 ? 0.55 : 1);
        if (a.flip) { ctx.save(); ctx.translate(left + m.w + 1, top - 1); ctx.scale(-1, 1); ctx.drawImage(rim, 0, 0); ctx.restore(); }
        else ctx.drawImage(rim, left - 1, top - 1);
      }
    }
    if (a.aura && a.white <= 0) {
      const glow = variant(IMG[key] ? key : a.sprite + '-idle', a.aura);
      ctx.globalAlpha = a.alpha * (0.42 + 0.22 * Math.sin(now / 260 + a.phase));
      blit(glow, -1, 0); blit(glow, 1, 0); blit(glow, 0, -1); blit(glow, 0, 1);
    }
    ctx.globalAlpha = a.alpha * (a.wait > 0.5 && a.look !== 'base' ? 0.6 : 1);
    blit(img, 0, 0);
    ctx.globalAlpha = 1;
  }
  function drawBeads() {
    const b = S.beads; let x = Math.round(b.x - ((b.burn + b.divine) * 6 - 2) / 2);
    const y = b.y || S.BASE;
    for (let i = 0; i < b.burn; i++, x += 6) { ctx.fillStyle = '#ff5a3c'; ctx.fillRect(x, y + 5, 4, 4); ctx.fillStyle = '#ffe07a'; ctx.fillRect(x + 1, y + 5, 2, 2); }
    for (let i = 0; i < b.divine; i++, x += 6) { ctx.fillStyle = '#ffc857'; ctx.fillRect(x + 1, y + 4, 2, 6); ctx.fillRect(x - 1, y + 6, 6, 2); ctx.fillStyle = '#fff'; ctx.fillRect(x + 1, y + 6, 2, 2); }
  }
  function drawParts() {
    for (const p of S.parts) {
      if (p.gem) {
        ctx.fillStyle = '#4fd8c8'; ctx.fillRect(p.x - 1 | 0, p.y - 3 | 0, 3, 7); ctx.fillRect(p.x - 3 | 0, p.y - 1 | 0, 7, 3);
        ctx.fillStyle = '#d6fff7'; ctx.fillRect(p.x - 1 | 0, p.y - 2 | 0, 1, 2);
      } else if (p.img) ctx.drawImage(p.img, Math.round(p.x - p.img.width / 2), Math.round(p.y - p.img.height / 2));
      else if (p.ring) {
        const k = 1 - p.life / p.max, r = p.r + (p.to - p.r) * k; ctx.fillStyle = p.c; ctx.globalAlpha = 1 - k;
        for (let i = 0; i < 24; i++) { const ang = i / 24 * 6.283; ctx.fillRect(Math.round(p.x + Math.cos(ang) * r), Math.round(p.y + Math.sin(ang) * r * 0.55), 2, 2); }
        ctx.globalAlpha = 1;
      } else {
        if (p.trail) { ctx.fillStyle = p.c; ctx.globalAlpha = 0.45; for (let i = 0; i < p.trail.length; i += 2) ctx.fillRect(p.trail[i] | 0, p.trail[i + 1] | 0, 1, 1); ctx.globalAlpha = 1; }
        ctx.fillStyle = p.c; ctx.fillRect(p.x | 0, p.y | 0, p.s, p.s);
      }
    }
  }
  function draw(now) {
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (S.shake > 0.3) ctx.translate(Math.round((Math.random() * 2 - 1) * S.shake), Math.round((Math.random() * 2 - 1) * S.shake * 0.6));
    const cam = S.cam;
    if (cam.k > 1.001) {                        // the camera punch: integer 2x at rest keeps every pixel square
      const k = cam.k >= 1.995 ? 2 : cam.k;
      ctx.translate(Math.round(S.W / 2), Math.round(S.H / 2)); ctx.scale(k, k); ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
    }
    drawBg(now);
    if (S.tintA > 0.01 && S.tint) {             // field buffs colour the upper air in bands
      ctx.fillStyle = S.tint;
      for (let i = 0; i < 4; i++) { ctx.globalAlpha = S.tintA * (0.26 - i * 0.055); ctx.fillRect(-8, -8, S.W + 16, 26 + i * 18); }
      ctx.globalAlpha = 1;
    }
    drawBeads();
    const order = S.actors.slice().sort((p, q) => (p.front - q.front) || ((p.y || 0) - (q.y || 0)) || (p.z || 0) - (q.z || 0));
    if (S.dark > 0.01) {                        // a dimmed room: only the movers stay lit
      for (const a of order) if (!a.front) drawActor(a, now);
      ctx.fillStyle = 'rgba(8,2,16,' + S.dark + ')'; ctx.fillRect(-8, -8, S.W + 16, S.H + 16);
      for (const a of order) if (a.front) drawActor(a, now);
    } else for (const a of order) drawActor(a, now);
    for (const q of S.props) drawProp(q, now);
    drawParts();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (S.danger > 0.01) {                      // red edge when a scripted ultimate is close
      const a = S.danger * (0.55 + 0.45 * Math.sin(now / 180));
      ctx.fillStyle = 'rgba(255,60,70,' + (a * 0.5) + ')';
      ctx.fillRect(0, 0, S.W, 4); ctx.fillRect(0, S.H - 4, S.W, 4); ctx.fillRect(0, 0, 4, S.H); ctx.fillRect(S.W - 4, 0, 4, S.H);
    }
    if (S.flash > 0.01) { ctx.fillStyle = 'rgba(255,255,255,' + S.flash + ')'; ctx.fillRect(0, 0, S.W, S.H); }
  }

  /* ---------- scripted props: shared skill motions ---------- */
  function prop(o) { S.props.push(o); return o; }
  function dropProp(o) { const i = S.props.indexOf(o); if (i >= 0) S.props.splice(i, 1); }
  function disc(x, y, r, color) {              // a pixel circle from horizontal runs
    if (r < 0.5) return;
    ctx.fillStyle = color;
    const R = Math.round(r);
    for (let dy = -R; dy <= R; dy++) { const half = Math.round(Math.sqrt(R * R - dy * dy)); ctx.fillRect(Math.round(x - half), Math.round(y + dy), half * 2 + 1, 1); }
  }

  function pixels(points, color) {
    const ys = points.map(([, y]) => y);
    ctx.fillStyle = color;
    for (let y = Math.min(...ys); y < Math.max(...ys); y++) {
      const intersections = [];
      for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i], [x1, y1] = points[(i + 1) % points.length];
        if ((y0 > y + 0.5) !== (y1 > y + 0.5)) intersections.push(x0 + (x1 - x0) * (y + 0.5 - y0) / (y1 - y0));
      }
      intersections.sort((a, b) => a - b);
      for (let i = 0; i < intersections.length; i += 2) {
        const left = Math.round(intersections[i]), right = Math.round(intersections[i + 1]);
        ctx.fillRect(left, y, right - left, 1);
      }
    }
  }

  function diamond(x, y, rx, ry, color) {
    x = Math.round(x); y = Math.round(y);
    pixels([[x - rx, y], [x, y - ry], [x + rx, y], [x, y + ry]], color);
  }

  /* ---------- melee contact marks (skill-motion phase 1) ----------
     Stock pixel-game hit marks: a white cutting edge, the element's mid colour as the body and its dark colour as the
     inner rim; thick in the middle, thin at the ends; one smear frame, a few flying chips, then the fade in drawMelee.
     Everything is drawn in whole logical pixels around the contact point (q.x, q.y); dir mirrors for the enemy side. */
  const dot = (x, y, color) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const OUTLINE = 'rgba(27, 24, 80, .7)';   // navy edge so a mark reads on any target colour

  // A crescent around contact point (px, py). Canonical shape: ")" bulging toward the target, radius r, sweeping
  // plus/minus `half` radians, `thick` px at its middle. rot turns it about the contact point (-PI/4 slants it top-back
  // to bottom-front for a right-facing swing).
  function crescent(px, py, { r, half, thick, rot = 0, dir, colors, reveal = 1, shift = 0 }) {
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const steps = Math.ceil(2 * half * r * 1.6);
    for (let i = 0; i <= Math.round(steps * reveal); i++) {
      const u = i / steps, a = -half + 2 * half * u;
      const t = Math.max(1, Math.round(thick * Math.pow(Math.sin(Math.PI * u), 0.65)));
      for (let k = 0; k < t; k++) {
        const radius = r - k + shift, lx = radius * Math.cos(a) - r, ly = radius * Math.sin(a);
        const color = k === 0 ? '#fff' : k === t - 1 && t > 2 ? colors[2] : colors[1];
        dot(px + dir * (lx * cos - ly * sin), py + lx * sin + ly * cos, color);
      }
    }
  }

  // Chips that fly out from the contact point as the mark fades.
  function chips(x, y, dir, frame, colors, count = 3, spread = 1) {
    for (let i = 0; i < count; i++) {
      const a = -1.1 + i * (2.2 / Math.max(1, count - 1)), d = (5 + frame * 4) * spread;
      ctx.fillStyle = i % 2 ? colors[0] : '#fff';
      ctx.fillRect(Math.round(x + dir * Math.cos(a) * d), Math.round(y + Math.sin(a) * d), 2, 2);
    }
  }

  // A filled star polygon: n points, alternating outer and inner radius, optionally stretched.
  function star(x, y, outer, inner, n, rot, color, sx = 1, sy = 1) {
    const points = Array.from({ length: n * 2 }, (_, i) => {
      const a = rot + Math.PI * i / n, r = i % 2 ? inner : outer;
      return [Math.round(x + r * Math.cos(a) * sx), Math.round(y + r * Math.sin(a) * sy)];
    });
    pixels(points, color);
  }
  // The classic hit star: dark rim, body colour, a second star turned 45 degrees, white heart.
  function hitStar(x, y, size, rot, colors, sx = 1, sy = 1) {
    star(x, y, size + 3, (size + 3) * 0.42, 4, rot, OUTLINE, sx, sy);
    star(x, y, size + 2, (size + 2) * 0.42, 4, rot, colors[2], sx, sy);
    star(x, y, size, size * 0.4, 4, rot, colors[1], sx, sy);
    star(x, y, size * 0.62, size * 0.24, 4, rot + Math.PI / 4, colors[1], sx, sy);
    star(x, y, size * 0.5, size * 0.2, 4, rot, '#fff', sx, sy);
  }
  const tri = (points, color) => pixels(points.map(([px, py]) => [Math.round(px), Math.round(py)]), color);

  const BLADE = { diagonal: -Math.PI / 4, guillotine: 0, horizontal: -Math.PI / 2, scythe: Math.PI / 2 };
  function bladeFx(q, frame) {
    const { x, y, variant, big, dir, colors } = q;
    const rot = BLADE[variant] ?? BLADE.diagonal, scythe = variant === 'scythe';
    const r = scythe ? 30 : big ? 24 : q.basic ? 16 : 20, half = scythe ? 1.15 : 0.95, thick = big ? 7 : q.basic ? 4 : 6;
    const last = big ? 4 : 2, cx = x + dir * Math.round(r * 0.45);
    if (frame === 0) crescent(cx, y, { r, half, thick: thick - 2, rot, dir, colors, reveal: 0.55 });
    else if (frame < last) {
      if (big && frame >= 2) crescent(cx, y, { r: r - 5, half: half * 0.9, thick: thick - 3, rot, dir, colors: [colors[0], colors[2], colors[2]], shift: -3 });
      crescent(cx, y, { r, half, thick, rot, dir, colors });
      chips(x, y, dir, frame, colors, big ? 4 : 3);
    } else {
      crescent(cx, y, { r, half, thick: 2, rot, dir, colors, shift: 2 });
      chips(x, y, dir, frame, colors, big ? 4 : 3);
    }
    if (variant === 'guillotine' && q.landed && frame >= 1) {   // the shadow left on the target after the chop
      star(x + dir * 3, y + 6, 5, 2, 4, Math.PI / 4, '#281838');
      star(x + dir * 3, y + 6, 3, 1, 4, Math.PI / 4, colors[1]);
    }
    if (variant === 'double' && frame >= 1 && frame < last) {
      crescent(cx, y + 7, { r: r - 5, half, thick: thick - 2, rot: -rot, dir, colors });
    }
  }

  function clawFx(q, frame) {
    const { x, y, variant, big, dir, colors } = q;
    const r = big ? 14 : 12, done = frame >= (big ? 4 : 2), cx = x + dir * 6;
    const rake = (rot, offsetX, thick, reveal) => {
      for (let i = 0; i < 3; i++) {
        const off = (i - 1) * 6;                                   // spaced across the stroke, not along it
        crescent(cx + dir * (offsetX + off * Math.cos(rot)), y + off * Math.sin(rot), { r, half: 0.8, thick, rot, dir, colors, reveal });
      }
    };
    if (frame === 0) crescent(cx, y, { r, half: 0.8, thick: 3, rot: -Math.PI / 5, dir, colors, reveal: 0.6 });
    else rake(-Math.PI / 5, 0, done ? 1 : 4, 1);
    if ((variant === 'cross' && frame >= 1) || (big && frame >= 2)) rake(Math.PI / 5, 2, done ? 1 : 2, 1);   // the return rake
    if (frame >= 1) chips(x + dir * 4, y, dir, frame, colors, 3, 0.8);
  }

  function thrustFx(q, frame) {
    const { x, y, dir, colors, big, tip } = q;
    const end = { x: x + dir * ((big ? 10 : 6) + (frame === 1 ? 3 : 0)), y };
    const len = Math.max(1, Math.abs(end.x - tip.x));
    for (let i = 0; i <= len; i++) {                                  // a wedge that thickens toward the point
      const t = Math.round((frame >= 2 ? 1 : 2) * i / len);
      const p = motionPoint(tip, end, i / len);
      rect(p.x, p.y - t - 1, 1, t * 2 + 3, colors[2]);
      rect(p.x, p.y - t, 1, t * 2 + 1, colors[1]);
      dot(p.x, p.y, '#fff');
    }
    if (frame >= 1) hitStar(end.x, y, big ? 8 : 6, 0, colors, 1.3, 0.8);
    if (big && frame >= 2) for (const dy of [-6, 6]) rect(Math.min(tip.x, tip.x - dir * 10), y + dy, 10, 1, colors[0]);
  }

  const IMPACT = { kick: [-0.75, 1, 1], uppercut: [-1.25, 0.9, 1.3], body: [0.1, 1.25, 1], downward: [1, 1, 1.1], stomp: [0, 1.2, 0.8], strike: [0.3, 1, 1] };
  function impactFx(q, frame) {
    const { x, y, dir, colors, variant, big } = q;
    if (variant === 'bat') {                                          // the bat's curved swing, then a fang-shaped flash
      crescent(x + dir * 7, y, { r: big ? 20 : 16, half: 0.9, thick: frame === 0 ? 3 : 5, rot: -Math.PI / 3, dir, colors, reveal: frame === 0 ? 0.6 : 1 });
      if (frame >= 1) for (const s of [-1, 1]) tri([[x + dir * 2, y - 2 + s * 4], [x + dir * 9, y + s * 4], [x + dir * 2, y + 2 + s * 4]], '#fff');
      if (frame >= 2) chips(x, y, dir, frame, colors);
      return;
    }
    const [rot, sx, sy] = IMPACT[variant] ?? IMPACT.strike;
    const size = (big ? 12 : q.basic ? 7 : 9) + (frame === 1 ? 2 : 0) - (frame >= 2 ? 2 : 0);
    const cy = variant === 'uppercut' ? y - 3 : y;
    if (frame === 0) star(x, cy, size * 0.6, size * 0.25, 4, rot, '#fff', sx, sy);
    else hitStar(x, cy, size, rot, colors, sx, sy);
    if (variant === 'stomp' || variant === 'downward') {              // the ground answers
      const d = 6 + frame * 3;
      for (const s of [-1, 1]) { ctx.fillStyle = colors[2]; ctx.fillRect(Math.round(x + s * d), q.floor - 3 - frame, 3, 2); }
    }
    if (frame >= 1) chips(x, cy, dir, frame, colors, big ? 4 : 3);
  }

  function biteFx(q, frame) {
    const { x, y, dir, colors, big } = q;
    const gap = [9, 4, 0, 0, 0][frame], w = big ? 5 : 4, h = big ? 7 : 6;
    for (const s of [-1, 1]) {                                         // upper jaw points down (s = -1), lower jaw up
      const jaw = y + s * (gap + h);
      ctx.fillStyle = colors[2]; ctx.fillRect(Math.round(Math.min(x - dir * (w * 1.5 + 2), x + dir * (w * 1.5 + 2))), Math.round(jaw), w * 3 + 5, 1);
      for (let i = -1; i <= 1; i++) {
        const tx = x + dir * i * (w + 1);
        tri([[tx - w / 2, jaw], [tx + w / 2, jaw], [tx, jaw - s * h]], colors[2]);
        tri([[tx - w / 2 + 1, jaw], [tx + w / 2 - 1, jaw], [tx, jaw - s * (h - 2)]], '#fff');
      }
    }
    if (frame >= 2) hitStar(x, y, big ? 6 : 4, 0.3, colors);
  }

  const MELEE_FX = { blade: bladeFx, claw: clawFx, thrust: thrustFx, impact: impactFx, bite: biteFx };

  function drawMelee(q, now) {
    const age = clock.t - q.start;
    const frame = Math.floor(age / (q.duration / (q.big ? 5 : 3)));
    if (age >= q.duration) return;
    ctx.save();
    if (q.still) {
      diamond(q.x, q.y, 5, 4, q.colors[1]);
      diamond(q.x, q.y, 2, 2, '#fff');
    } else {
      ctx.globalAlpha = [1, 1, 0.8, 0.55, 0.35][frame];
      if (q.big) {
        ctx.save();
        ctx.globalAlpha *= 0.55;
        contactRing(q, 9 + frame * 3);
        ctx.restore();
      }
      MELEE_FX[q.family](q, frame);
    }
    ctx.restore();
  }

  function contactRing(q, radius) {
    const height = Math.round(radius * 0.7);
    ctx.fillStyle = q.colors[0];
    for (let dy = -height; dy <= height; dy++) {
      const outer = Math.round(radius * Math.sqrt(1 - (dy / height) ** 2));
      const inner = Math.abs(dy) >= height - 1 ? 0 :
        Math.round((radius - 1) * Math.sqrt(1 - (dy / (height - 1)) ** 2));
      ctx.fillRect(q.x - outer, q.y + dy, outer - inner + 1, 1);
      ctx.fillRect(q.x + inner, q.y + dy, outer - inner + 1, 1);
    }
  }

  const rect = (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };
  // Strength: basic attacks smallest, other quiet skills a clear step up, big moves largest (Claude's review).
  const scaled = (q, size) => Math.max(1, Math.round(size * (q.big ? 1.5 : q.basic ? 0.8 : 1.25)));
  const unit = value => Math.min(1, Math.max(0, value));

  function pixelLine(from, to, width, color) {
    const steps = Math.ceil(Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)));
    const offset = Math.floor(width / 2);
    for (let i = 0; i <= steps; i++) {
      const point = motionPoint(from, to, i / (steps || 1));
      rect(point.x - offset, point.y - offset, width, width, color);
    }
  }

  function outlinedOrb(x, y, r, colors) {
    disc(x, y, r, colors[2]);
    disc(x, y, Math.max(1, r - 1), colors[1]);
    rect(x - (r > 3 ? 1 : 0), y - 1, r > 3 ? 2 : 1, 2, '#fff');
  }

  function hollowRing(x, y, radius, width, colors, octagon = false, open = false) {
    for (let dy = -radius - 1; dy <= radius + 1; dy++) for (let dx = -radius - 1; dx <= radius + 1; dx++) {
      if (open && dy < 0 && Math.abs(dx) < radius * 0.55) continue;
      const d = octagon ? Math.max(Math.abs(dx), Math.abs(dy), (Math.abs(dx) + Math.abs(dy)) * 0.7) : Math.hypot(dx, dy);
      if (d > radius && d <= radius + 1) { dot(x + dx, y + dy, OUTLINE); continue; }
      if (d <= radius && d > radius - width) {
        const edge = d > radius - Math.min(0.8, width * 0.45);
        dot(x + dx, y + dy, edge ? colors[2] : d <= radius - width + 0.8 ? '#fff' : colors[1]);
      }
    }
  }

  function shotFx(q, f) {
    const { from, to, variant, colors, dir } = q;
    if (f.hit) {
      hitStar(to.x, to.y, scaled(q, 7 - Math.min(f.frame, 2)), 0, colors);
      return;
    }
    const arc = ['throw', 'snowball', 'talisman'].includes(variant) ? Math.max(14, Math.hypot(to.x - from.x, to.y - from.y) * 0.25) : 0;
    const head = motionPoint(from, to, f.progress, arc);
    if (variant === 'chain') {
      const count = Math.ceil(Math.hypot(head.x - from.x, head.y - from.y) / 4);
      for (let i = 0; i < count; i++) {
        const { x, y } = motionPoint(from, head, i / count);
        rect(x, y, 2, 2, i % 2 ? colors[1] : colors[0]);
      }
    } else {
      const alpha = ctx.globalAlpha;
      for (let i = 3; i >= 1; i--) {
        const t = f.progress - i * 0.055;
        if (t < 0) continue;
        const { x, y } = motionPoint(from, to, t, arc);
        ctx.globalAlpha = alpha * (1 - i * 0.22);
        rect(x, y, 2, 2, colors[i - 1]);
      }
      ctx.globalAlpha = alpha;
    }
    const { x, y } = head;
    if (variant === 'talisman') {
      const w = scaled(q, 4), h = scaled(q, 6);
      rect(x - w / 2, y - h / 2, w, h, colors[2]);
      rect(x - w / 2 + 1, y - h / 2, w - 2, h - 1, '#fff');
      rect(x - 1, y - 1, 2, 2, '#e0514c');
    } else if (variant === 'bullet') {
      rect(x - dir * 2 - 1, y - 1, scaled(q, 5), 2, colors[2]);
      rect(x - dir - 1, y - 1, scaled(q, 3), 2, colors[1]);
      rect(x - dir - 1, y, scaled(q, 3), 1, '#fff');
      if (f.frame === 0) hitStar(from.x, from.y, scaled(q, 4), 0, colors);
    } else {
      const d = scaled(q, 5);
      for (let row = 0; row < d; row++) {
        const inset = Math.max(0, Math.floor(Math.abs(row - (d - 1) / 2)) - 1);
        const left = x - Math.floor(d / 2) + inset, width = d - 2 * inset;
        const yy = y + row - Math.floor(d / 2);
        rect(left, yy, width, 1, colors[2]);
        if (row > 0 && row < d - 1) rect(left + 1, yy, width - 2, 1, colors[1]);
      }
      rect(x - (d >= 7 ? 1 : 0), y - 1, d >= 7 ? 2 : 1, 1, '#fff');
    }
  }

  function orbFx(q, f) {
    const absorb = q.variant === 'absorb';
    const from = absorb ? q.to : q.from, to = absorb ? q.from : q.to;
    const { colors } = q;
    const radius = q.big ? 6 : scaled(q, 4);
    if (f.hit) {
      const step = Math.min(1, f.frame / 3);
      const r = absorb ? scaled(q, 4) + f.frame : Math.round(radius + ((q.big ? 16 : scaled(q, 10)) - radius) * step);
      hollowRing(to.x, to.y, r, 3, colors);
      if (absorb) for (const [dx, dy] of [[-7, -2], [4, -6], [7, 2], [-3, 4]]) {
        rect(to.x + dx, to.y + dy - f.frame * 2, 2, 2, colors[1]);
        dot(to.x + dx, to.y + dy - f.frame * 2, '#fff');
      }
      return;
    }
    if (f.age < q.charge) {
      const growth = f.age / q.charge;
      const d = Math.round(8 - growth * 5);
      for (const [dx, dy] of [[-d, 0], [0, -d], [d, 0], [0, d]]) rect(from.x + dx, from.y + dy, 2, 2, colors[0]);
      outlinedOrb(from.x, from.y, Math.round(2 + (radius - 2) * growth), colors);
      return;
    }
    const t = unit((f.age - q.charge) / Math.max(0.001, q.travel - q.charge));
    const head = motionPoint(from, to, t);
    const alpha = ctx.globalAlpha;
    for (let i = 2; i >= 1; i--) {
      const a = motionPoint(from, to, Math.max(0, t - i * 0.13));
      const b = motionPoint(from, to, Math.max(0, t - (i - 1) * 0.13));
      ctx.globalAlpha = alpha * (i === 2 ? 0.35 : 0.65);
      pixelLine(a, b, 2, colors[1]);
    }
    ctx.globalAlpha = alpha;
    outlinedOrb(head.x, head.y, radius, colors);
  }

  function breathFx(q, f) {
    const { from, to, colors, dir } = q;
    const reach = f.hit ? 1 : f.progress;
    const steps = Math.max(1, Math.round(Math.abs(from.x - to.x) * reach));
    const half = q.big ? 16 : scaled(q, 10);
    const fade = f.hit ? 1 - f.frame / (q.linger + 1) : 1;
    const frame = f.hit ? f.frame + 2 : Math.min(1, f.frame);
    for (let i = 0; i <= steps && (!f.hit || f.frame < q.linger); i++) {
      const t = (i / steps) * reach;
      const point = motionPoint(from, to, t);
      const flicker = ((Math.imul(i + 7, 37) ^ Math.imul(frame + 3, 71)) >>> 0) % 3 - 1;
      const h = Math.max(2, Math.round((2 + (half - 2) * t) * fade + (i > 1 ? flicker : 0)));
      rect(point.x, point.y - h, 1, h * 2 + 1, colors[2]);
      rect(point.x, point.y - h + 1, 1, h * 2 - 1, colors[1]);
      const core = Math.floor(h / 3);
      rect(point.x, point.y - core, 1, core * 2 + 1, '#fff');
    }
    if (f.hit) for (let i = 0; i < (q.big ? 4 : 2); i++) {
      rect(to.x + dir * (3 + i * 3 + f.frame * 3), to.y + (i % 2 ? 1 : -1) * (i * 3 + f.frame), 2, 2, colors[i % 3]);
    }
  }

  function rayFx(q, f) {
    const { from, to, colors } = q;
    const head = motionPoint(from, to, f.progress);
    const pilot = !f.hit && f.frame === 0;
    if (pilot) pixelLine(from, head, 1, colors[0]);
    else {
      const core = q.big ? 3 : 2;
      const pulse = q.big && f.hit && f.frame > 0 && f.frame % 2 ? 2 : 0;
      if (q.big) pixelLine(from, head, core + 4 + pulse, colors[2]);
      pixelLine(from, head, core + 2 + pulse, colors[1]);
      pixelLine(from, head, core, '#fff');
    }
    hitStar(from.x, from.y, q.big ? 5 : scaled(q, 3), 0, colors);
    if (f.hit) hitStar(to.x, to.y, scaled(q, Math.max(4, 8 - f.frame)), 0, colors);
  }

  function ellipseSegments(x, y, rx, ry, count, reveal, colors) {
    for (let i = 0; i < count * reveal; i++) {
      const angle = i * 2 * Math.PI / count;
      rect(x + rx * Math.cos(angle) - 1, y + ry * Math.sin(angle), 2, 2, colors[i % colors.length]);
    }
  }

  function fallFx(q, f) {
    const { to, floor, colors, variant } = q;
    const rain = variant === 'rain';
    if (!f.hit && f.frame === 0) ellipseSegments(to.x, floor - 1, 6, 1, 12, 1, [colors[2], colors[1]]);
    for (let i = 0; i < (rain ? 3 : 1); i++) {
      const x = to.x + (rain ? (i - 1) * 8 : 0);
      const begin = (1 + i) * MOTION_FRAME;
      const age = (f.hit ? q.travel + f.hitAge : f.age) - begin;
      if (age < 0) continue;
      if (age >= q.flight) {
        const landing = Math.floor((age - q.flight) / MOTION_FRAME);
        if (landing > 3) continue;
        hitStar(x, to.y, scaled(q, Math.max(3, 6 - landing)), -Math.PI / 4, colors);
        chips(x, floor - 3, q.dir, landing, colors, 2, 0.7);
        continue;
      }
      const t = unit(age / q.flight);
      const from = { x: x - q.dir * (rain || variant !== 'meteor' ? 0 : 16), y: q.fallY };
      const end = { x, y: to.y };
      const head = motionPoint(from, end, t);
      if (variant === 'meteor') {
        if (q.effectSprite) {
          ctx.save();
          ctx.globalAlpha *= 0.45;
          const { width, height } = q.effectSprite;
          ctx.translate(Math.round(head.x), Math.round(head.y - 4));
          ctx.scale(q.dir, 1);
          ctx.drawImage(q.effectSprite, -Math.floor(width / 2), -Math.floor(height / 2));
          ctx.restore();
        }
        for (let j = 6; j >= 1; j--) {
          const tail = motionPoint(from, end, Math.max(0, t - j * 0.065));
          const r = Math.max(1, scaled(q, 4) - j);
          disc(tail.x, tail.y, r, j % 2 ? colors[2] : colors[1]);
        }
        outlinedOrb(head.x, head.y, q.big ? 6 : scaled(q, 4), colors);
      } else if (variant === 'candy') {
        disc(head.x, head.y, scaled(q, 2), colors[2]);
        for (let j = 0; j < 2; j++) rect(head.x - 1, head.y + j - 1, 3, 1, colors[j]);
        dot(head.x - 1, head.y - 1, '#fff');
      } else {
        diamond(head.x, head.y, scaled(q, 2), scaled(q, 3), colors[2]);
        pixelLine({ x: head.x, y: head.y - 2 }, { x: head.x, y: head.y + 2 }, 2, colors[1]);
        dot(head.x, head.y - 1, '#fff');
      }
    }
  }

  function castSpark(point, color, r) {
    diamond(point.x, point.y, r, r, color);
    dot(point.x, point.y, '#fff');
  }

  function blastFx(q, f) {
    const { from, fromFloor, to, floor, dir, colors, variant } = q;
    if (f.hit) {
      const i = Math.min(f.frame, 2);
      const r = scaled(q, [4, 8, q.big ? 14 : 12][i]);
      hollowRing(to.x, to.y, r, 4 - i, colors, true);
      if (i === 1) for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
        const edge = { x: to.x + dx * r * 0.6, y: to.y + dy * r * 0.6 };
        pixelLine(edge, { x: edge.x + dx * 4, y: edge.y + dy * 4 }, 2, colors[0]);
      }
      if (variant === 'eruption') for (let j = -1; j <= 1; j++) {
        const spark = { x: to.x + j * scaled(q, 7), y: floor - 5 - i * 5 - (j === 0 ? 4 : 0) };
        pixelLine({ x: spark.x, y: spark.y + 5 }, spark, 2, colors[1]);
        castSpark(spark, colors[2], 2);
      }
    } else if (variant === 'ground') {
      for (let i = 0; i < 2; i++) {
        const a = { x: fromFloor.x, y: fromFloor.y + i * 3 - 2 };
        const b = motionPoint(a, { x: to.x, y: floor + i * 3 - 2 }, f.progress);
        pixelLine(a, b, 2, colors[i > 0 ? 2 : 1]);
        chips(b.x, b.y - 3, dir, f.frame % 2, colors, 2, 0.5);
      }
    } else if (variant === 'wave') {
      for (let i = 0; i < 3; i++) {
        const r = scaled(q, 6 + 3 * i);
        const point = motionPoint(from, to, Math.max(0, f.progress - i * 0.12));
        for (let j = -r; j <= r; j++) {
          const x = point.x + dir * Math.round(Math.sqrt(r * r - j * j) * 0.65);
          rect(x, point.y + j, 2, 1, j % 4 === 0 ? '#fff' : colors[1 + (i % 2)]);
        }
      }
    } else if (q.launch) {
      for (const side of [-1, 1]) {
        const head = motionPoint(from, { x: to.x + side * 5, y: to.y }, f.progress, 13);
        const tail = motionPoint(from, to, Math.max(0, f.progress - 0.15), 13);
        pixelLine(tail, head, 2, colors[2]);
        castSpark(head, colors[1], 2);
      }
    } else {
      castSpark(from, colors[1], 2);
    }
  }

  function fieldFx(q, f) {
    const { from, to, floor, colors, variant } = q;
    const progress = f.hit ? 1 : f.progress;
    const rx = q.big ? 22 : scaled(q, 15), ry = q.big ? 6 : scaled(q, 4);
    ellipseSegments(to.x, floor - 2, rx, ry, q.big ? 26 : 18, Math.max(0.12, progress), [colors[1], '#fff']);
    if (!f.hit) castSpark(from, colors[2], 2);
    if (f.hit) for (let i = 0; i < 4; i++) {
      const x = to.x + (i % 2 ? 1 : -1) * Math.round(rx * (i < 2 ? 0.72 : 0.33));
      const y = floor - (i < 2 ? 5 : 1) - Math.min(6, f.frame * 2);
      castSpark({ x, y }, colors[1], 1);
    }
    if (variant === 'summon') {
      const y = floor - 4 - Math.round(progress * scaled(q, 10)), w = scaled(q, 10);
      rect(to.x - w / 2, y + 2, w, floor - y - 2, colors[2]);
      rect(to.x - w / 2 + 1, y, w - 2, floor - y - 2, colors[1]);
      rect(to.x - 1, y + 1, 2, 2, '#fff');
    } else if (variant === 'bind') for (const side of [-1, 1]) {
      let previous = { x: to.x + side * scaled(q, 7), y: floor - 2 };
      const links = Math.ceil(Math.max(0, floor - to.y - 2) / 4 * progress);
      for (let i = 1; i <= links; i++) {
        const next = { x: to.x + side * (scaled(q, 7) + (i % 2 ? 3 : 0)), y: floor - 2 - i * 4 };
        pixelLine(previous, next, 2, colors[1]);
        dot(next.x, next.y, '#fff');
        previous = next;
      }
    }
  }

  const DRIFT_PALETTES = {
    petal: ['#ffd6f2', '#f99dc9', '#a45289'], snow: ['#fff', '#d6fbff', '#759bc0'],
    water: ELEMENT_COLORS.water, wind: ['#fff', '#bbebdd', '#5c9c9e'], sand: ['#fff1a8', '#eabc64', '#a06c3e'],
    cream: ['#fff', '#fff0d0', '#ca9d88']
  };

  function driftFx(q, f) {
    const { from, to, fromFloor, floor, variant } = q;
    const colors = DRIFT_PALETTES[variant] ?? q.colors;
    if (f.hit) {
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [-1.4, 0], [1.4, 0]]) {
        const d = scaled(q, 3 + f.frame * 2);
        castSpark({ x: to.x + dx * d, y: to.y + dy * d }, colors[1], 2);
      }
      return;
    }
    const dist = Math.max(1, Math.hypot(to.x - from.x, to.y - from.y));
    for (let i = 0; i < (q.big ? 5 : 3); i++) {
      for (let j = 15; j >= 0; j--) {
        const t = f.progress - (j + i * 3) / dist;
        if (t < 0) continue;
        const { x, y } = motionPoint(from, to, t);
        const phase = (t * dist / 16 + i / 3 - f.frame / 5) * Math.PI * 2;
        const wave = Math.sin(phase) * 3;
        const low = motionPoint(fromFloor, { x: to.x, y: floor }, t).y - 5;
        const height = variant === 'water' ? y + (low - y) * Math.sin(Math.PI * t) : y;
        const spread = (i - (q.big ? 2 : 1)) * 4 * Math.sin(Math.PI * t);
        const dy = height + wave + spread;
        const dx = variant === 'cream' ? Math.cos(phase) * 3 : 0;
        rect(x + dx, dy, variant === 'wind' && j % 4 === 0 ? 4 : 2, 2, j > 10 ? colors[2] : colors[1]);
        if (j === 0 || j === 6) dot(x + dx, dy, '#fff');
        if (variant === 'storm' && j === 5 && i < 2) {
          const bend = { x: x + 2, y: dy - 3 };
          pixelLine({ x: x - 2, y: dy - 5 }, bend, 2, colors[2]);
          pixelLine(bend, { x: x, y: dy + 1 }, 2, colors[0]);
        }
      }
    }
  }

  function markFx(q, f) {
    const { to, from, colors, variant, beneficial, head } = q;
    if (variant === 'reserve') {
      const center = { x: from.x, y: Math.max(7, from.y - 7) };
      hollowRing(center.x, center.y, 5, 2, colors);
      const angle = f.frame * Math.PI / 2;
      pixelLine(center, { x: center.x, y: center.y - 3 }, 1, colors[1]);
      pixelLine(center, { x: center.x + Math.cos(angle) * 3, y: center.y + Math.sin(angle) * 3 }, 1, '#fff');
    } else if (variant === 'heal' || (beneficial && ['question', 'whisper', 'mark'].includes(variant))) {
      const mint = ['#e8fff5', '#76dcb0', '#328f78'];
      hollowRing(to.x, to.y, scaled(q, 8), 2, mint, false, true);
      for (const [dx, dy] of [[-8, 0], [0, -5], [8, 2]]) {
        const x = to.x + dx, y = to.y + dy - Math.min(10, f.frame * 4);
        const r = scaled(q, 2);
        rect(x - r, y, r * 2 + 1, 2, mint[1]);
        rect(x, y - r, 2, r * 2 + 1, mint[1]);
        dot(x, y, '#fff');
      }
    } else {
      const y = Math.max(6, head + Math.min(8, f.frame * 4));
      const r = scaled(q, 4), h = scaled(q, 8);
      const a = { x: to.x - r, y }, b = { x: to.x + r, y }, c = { x: to.x, y: y + h };
      tri([[a.x, a.y], [b.x, b.y], [c.x, c.y]], colors[2]);
      pixelLine(a, b, 2, colors[1]); pixelLine(a, c, 2, colors[1]); pixelLine(b, c, 2, colors[1]);
      dot(to.x, y + 2, colors[0]);
      if (f.frame > 0) for (let i = -1; i <= 1; i++) rect(to.x + i * 4, y + h + f.frame * 3 + Math.abs(i), 2, 2, colors[2]);
    }
  }

  const RANGED_FX = { shot: shotFx, orb: orbFx, breath: breathFx, ray: rayFx, fall: fallFx, blast: blastFx,
    field: fieldFx, drift: driftFx, mark: markFx };

  function clipBenchFaces(q, now) {
    for (const actor of S.actors) {
      if (actor === q.caster || actor === q.target || !actor.vis || actor.wait <= 0.5) continue;
      const idle = meta(actor, 'idle'), current = meta(actor);
      if (!idle?.face || !current) continue;
      const { x, y, size } = idle.face;
      const box = actorBox(actor, current, now);
      const origin = x + current.cx - idle.cx;
      const center = box.left + (actor.flip ? box.width - 1 - origin : origin);
      ctx.beginPath();
      ctx.rect(-S.W, -S.H, 3 * S.W, 3 * S.H);
      ctx.rect(Math.round(center - size / 2), box.top + y + current.fy - idle.fy, size, size);
      ctx.clip('evenodd');
    }
  }

  function drawRanged(q, now) {
    const hit = q.arrived !== undefined;
    const age = Math.max(0, clock.t - q.start);
    const hitAge = hit ? clock.t - q.arrived : 0;
    const frame = q.still ? 0 : Math.floor((hit ? hitAge : age) / MOTION_FRAME);
    if ((hit && hitAge >= q.hold) || (q.still && !hit)) return;
    ctx.save();
    clipBenchFaces(q, now);
    ctx.globalAlpha = (q.landed ? 1 : 0.65) * (hit ? Math.max(0.25, 1 - hitAge / q.hold) : 1);
    if (q.still && q.family !== 'mark') hitStar(q.to.x, q.to.y, scaled(q, 5), 0, q.colors);
    else RANGED_FX[q.family](q, { hit, age, hitAge, frame, progress: hit ? 1 : unit(age / q.travel) });
    ctx.restore();
  }

  function drawCostFlare(q, now) {
    const frame = Math.floor((clock.t - q.start) / MOTION_FRAME);
    if (frame >= 2) return;
    ctx.save();
    clipBenchFaces(q, now);
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3 + frame * Math.PI / 6;
      const x = q.x + Math.cos(angle) * q.rx, y = q.y + Math.sin(angle) * q.ry;
      rect(x, y - 1, 2, 3, q.colors[2]);
      dot(x, y - 2, q.colors[0]);
      dot(x + 1, y, q.colors[1]);
    }
    ctx.restore();
  }

  function drawProp(q, now) {
    if (q.kind === 'meleeFx') drawMelee(q, now);
    else if (q.kind === 'rangedFx') drawRanged(q, now);
    else if (q.kind === 'costFlare') drawCostFlare(q, now);
  }

  /** Camera punch-in on a point, then back. Holds at exactly 2x so pixels stay square. */
  async function punch(x, y, hold) {
    const cam = S.cam;
    cam.x = S.W / 2; cam.y = S.H / 2;
    const tx = Math.max(S.W / 4, Math.min(S.W * 3 / 4, x)), ty = Math.max(S.H / 4, Math.min(S.H * 3 / 4, y));
    await tween(cam, { k: 2, x: tx, y: ty }, 0.12, 'out');
    await wait(hold || 0.3);
    await tween(cam, { k: 1, x: S.W / 2, y: S.H / 2 }, 0.1, 'in');
    cam.k = 1;
  }

  /* ---------- DOM overlays that follow stage coordinates ---------- */
  function number(text, x, y, cls) {
    const d = document.createElement('div');
    d.className = 'num ' + (cls || ''); d.textContent = text;
    d.style.left = Math.round(x * SCALE) + 'px'; d.style.top = Math.round(Math.max(16, y) * SCALE) + 'px';
    fxLayer.appendChild(d); setTimeout(() => d.remove(), 1300);
    return d;
  }
  function fieldNotice(anchor, text, colors) {
    if (!anchor) return;
    const stage = fxLayer.getBoundingClientRect(), slot = anchor.getBoundingClientRect();
    const x = Math.max(4, Math.round(slot.left - stage.left));
    fxLayer.querySelector('[data-field-effect]')?.remove();
    const note = document.createElement('div');
    note.dataset.fieldEffect = '';
    Object.assign(note.style, {
      position: 'absolute', left: x + 'px', top: Math.round(slot.bottom - stage.top + 2) + 'px',
      maxWidth: 'calc(100% - ' + (x + 4) + 'px)', boxSizing: 'border-box', padding: '2px 6px',
      color: 'var(--ink)', background: 'var(--paper2)', border: '1px solid var(--line2)',
      font: 'normal 0.75rem/1rem var(--f-label)'
    });
    for (const color of colors) {
      const mark = document.createElement('span');
      Object.assign(mark.style, {
        display: 'inline-block', width: '7px', height: '7px', marginRight: '3px',
        background: color, boxShadow: 'inset 0 0 0 1px var(--line2)'
      });
      note.append(mark);
    }
    note.append(text);
    fxLayer.append(note);
    wait(0.9).then(() => note.remove());
  }
  function banner(tag, text, cls) {
    const b = document.createElement('div');
    b.className = 'banner ' + (cls || '');
    b.innerHTML = '<b></b><span></span>'; b.firstChild.textContent = tag; b.lastChild.textContent = text;
    fxLayer.appendChild(b);
    return b;
  }
  /** The skill name plate for big moves: a pixel window that slides in from the caster's side. */
  function plate(who, name, color, side) {
    const p = document.createElement('div');
    p.className = 'skillplate ' + (side < 0 ? 'right' : 'left');
    p.style.setProperty('--c', color);
    p.innerHTML = '<small></small><b></b>'; p.firstChild.textContent = who; p.lastChild.textContent = name;
    fxLayer.appendChild(p);
    return p;
  }

  /* ---------- frame loop ---------- */
  let last = 0, running = false;
  function sim(real) {
    const dt = stepClock(real);
    updateParts(dt);
    S.shake = Math.max(0, S.shake - dt * 22); S.flash = Math.max(0, S.flash - dt * 4.5);
    for (const a of S.actors) if (a.white > 0) a.white -= dt;
  }
  function frame(now) {
    const real = Math.min(0.05, (now - last) / 1000); last = now;
    sim(real); draw(now);
    requestAnimationFrame(frame);
  }
  function start() { if (running) return; running = true; last = performance.now(); requestAnimationFrame(frame); }
  /** Review hook: advance stage time by hand when the page is not animating (hidden preview pane). */
  async function advance(sec, step = 0.02) {
    for (let n = Math.round(sec / step); n > 0; n--) { sim(step); for (let k = 0; k < 6; k++) await null; }
    draw(performance.now());
    return Math.round(clock.t * 100) / 100;
  }

  function init(canvas, fx) { cv = canvas; ctx = cv.getContext('2d'); fxLayer = fx; }
  function resize(W, H) {
    S.W = W; S.H = H; S.BASE = H - 22; bgCache = null;
    cv.width = W; cv.height = H; cv.style.width = W * SCALE + 'px'; cv.style.height = H * SCALE + 'px';
    ctx.imageSmoothingEnabled = false;
  }
  function setRoom(bg, bossRoom = false) {
    S.bg = bg;
    S.bossRoom = bossRoom;
    bgCache = null;
    loadBackground(bg);
  }
  function bellPosition() {
    if (!bgCache) paintBg();
    return bgCache.bell;
  }
  function clear() {
    S.actors.length = 0; S.parts.length = 0; S.props.length = 0; S.cam.k = 1;
    S.shake = S.flash = S.dark = S.danger = S.tintA = 0; S.tint = null; S.beads.burn = S.beads.divine = 0;
    if (fxLayer) fxLayer.innerHTML = '';
  }

  return {
    SCALE, S, clock, wait, tween, ELEMENT_COLORS,
    loadSprites, variant, IMG, makeActor, removeActor, meta, socket, X, footY, headY, chestY, tall,
    sparks, fly, rise, converge, ring, dust, gem, number, fieldNotice, banner, plate, prop, dropProp, punch, reducedMotion,
    init, resize, setRoom, bellPosition, clear, start, advance, draw, RIM,
    pause(on) { clock.paused = !!on; }
  };
}
