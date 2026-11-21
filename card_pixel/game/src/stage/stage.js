/* RelayStage: the pixel stage. A low-resolution canvas (2x integer upscale), a virtual clock so
   every animation can be sped up or skipped, sprite variants (flash, waiting, shadow, boss),
   a camera that punches in at an integer zoom, cached backgrounds, props and particles. It knows nothing about rules. */
import { spriteBox } from '../ui/battle/motion.js';

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
  const S = { W: 195, H: 200, BASE: 172, bg: 'cave', actors: [], parts: [], props: [], shake: 0, flash: 0, dark: 0, danger: 0, tint: null, tintA: 0,
    cam: { k: 1, x: 0, y: 0 }, beads: { burn: 0, divine: 0, x: 0, y: 0 } };
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
  function actorBox(a, m, now) {
    const box = spriteBox(a, m, S.BASE);
    const bob = a.pose === 'idle' && !a.still ? Math.round(Math.sin(now / 420 + a.phase) * 0.6) : 0;
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
  function slash(x, y, color, dir) { S.parts.push({ sl: 1, x, y, life: 0.2, max: 0.2, c: color || '#ffffff', dir: dir || 1 }); }
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
      } else if (p.sl) {
        const n = Math.min(22, Math.round((1 - p.life / p.max) * 52));
        for (let k = 0; k < 3; k++) for (let j = 0; j < n; j++) { ctx.fillStyle = j > n - 6 ? '#fff' : p.c; ctx.fillRect((p.x + p.dir * (11 + k * 8 - j)) | 0, (p.y - 4 + k * 3 + j * 1.5) | 0, 2, 2); }
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

  /* ---------- scripted props: code-drawn shapes for the big common moves ---------- */
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
    pixels([[x - rx, y], [x, y - ry], [x + rx, y], [x, y + ry]], color);
  }

  /* ---------- melee contact marks (skill-motion phase 1) ----------
     Stock pixel-game hit marks: a white cutting edge, the element's mid colour as the body and its dark colour as the
     inner rim; thick in the middle, thin at the ends; one smear frame, a few flying chips, then the fade in drawMelee.
     Everything is drawn in whole logical pixels around the contact point (q.x, q.y); dir mirrors for the enemy side. */
  const dot = (x, y, color) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };

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
    const start = tip.x - dir * (big ? 10 : 6), end = x + dir * ((big ? 10 : 6) + (frame === 1 ? 3 : 0));
    const len = Math.max(1, Math.abs(end - start));
    for (let i = 0; i <= len; i++) {                                  // a wedge that thickens toward the point
      const px = Math.round(start + dir * i), t = Math.round((frame >= 2 ? 1 : 2) * i / len);
      ctx.fillStyle = colors[2]; ctx.fillRect(px, y - t - 1, 1, t * 2 + 3);
      ctx.fillStyle = colors[1]; ctx.fillRect(px, y - t, 1, t * 2 + 1);
      dot(px, y, '#fff');
    }
    if (frame >= 1) hitStar(end, y, big ? 8 : 6, 0, colors, 1.3, 0.8);
    if (big && frame >= 2) for (const dy of [-6, 6]) { ctx.fillStyle = colors[0]; ctx.fillRect(Math.round(Math.min(start, start - dir * 10)), y + dy, 10, 1); }
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

  function drawProp(q, now) {
    ctx.globalAlpha = q.a == null ? 1 : Math.max(0, q.a);
    if (q.kind === 'meleeFx') {
      drawMelee(q, now);
    } else if (q.kind === 'orb') {              // the gathered charge in front of the caster
      const r = q.r + Math.sin(now / 50) * 0.6;
      disc(q.x, q.y, r + 2, q.colors[2]); disc(q.x, q.y, r, q.colors[1]); disc(q.x, q.y, r * 0.55, q.colors[0]); disc(q.x, q.y, r * 0.25, '#ffffff');
    } else if (q.kind === 'meteor') {
      if (q.trail.length < 2 || q.trail[q.trail.length - 2] !== q.x || q.trail[q.trail.length - 1] !== q.y) { q.trail.push(q.x, q.y); if (q.trail.length > 24) q.trail.splice(0, 2); }
      for (let i = 0; i < q.trail.length; i += 2) { const k = (i + 2) / q.trail.length; disc(q.trail[i], q.trail[i + 1], Math.max(1, q.r * k * 0.8), q.colors[i % 4 ? 2 : 1]); }
      disc(q.x, q.y, q.r, q.colors[2]); disc(q.x - 1, q.y - 1, q.r * 0.72, q.colors[1]); disc(q.x - 2, q.y - 2, q.r * 0.42, q.colors[0]); disc(q.x - 2, q.y - 2, Math.max(1, q.r * 0.2), '#ffffff');
    } else if (q.kind === 'beam') {             // tapered beam: glow, body, white core, streaks running to the target
      const dir = q.x1 >= q.x0 ? 1 : -1, len = Math.abs(q.x1 - q.x0) | 0, h = q.h;
      for (let i = 0; i <= len; i += 1) {
        const x = Math.round(q.x0 + dir * i), taper = Math.min(1, i / 14) * 0.5 + 0.5, wave = Math.sin((i - now * 0.35) / 4) * 0.7;
        const t = Math.max(0, h * taper + wave);
        if (t < 0.5) continue;
        ctx.fillStyle = q.colors[2]; ctx.fillRect(x, Math.round(q.y - t - 2), 1, Math.round(t * 2 + 4));
        ctx.fillStyle = q.colors[1]; ctx.fillRect(x, Math.round(q.y - t * 0.7), 1, Math.max(1, Math.round(t * 1.4)));
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x, Math.round(q.y - t * 0.3), 1, Math.max(1, Math.round(t * 0.6)));
      }
      if (h > 1) for (let k = 0; k < 9; k++) {
        const along = ((now * 0.32 + k * 23) % Math.max(1, len)) | 0, off = ((k * 7) % 5 - 2) * h * 0.35;
        ctx.fillStyle = k % 2 ? q.colors[0] : '#ffffff'; ctx.fillRect(Math.round(q.x0 + dir * along) - (dir < 0 ? 6 : 0), Math.round(q.y + off), 6, 1);
      }
      disc(q.x0, q.y, h * 0.95, q.colors[1]); disc(q.x0, q.y, h * 0.5, '#ffffff');
      if (q.flare) { const f = h * 1.5 + ((now / 45 | 0) % 2); disc(q.x1, q.y, f, q.colors[2]); disc(q.x1, q.y, f * 0.7, q.colors[1]); disc(q.x1, q.y, f * 0.4, '#ffffff'); }
    } else if (q.kind === 'burst') {            // a detonation that swells and thins out
      disc(q.x, q.y, q.r, q.colors[2]); disc(q.x, q.y, q.r * 0.75, q.colors[1]); disc(q.x, q.y, q.r * 0.45, q.colors[0]); disc(q.x, q.y, q.r * 0.2, '#ffffff');
    } else if (q.kind === 'ghost') {
      const key = IMG[q.key] ? q.key : q.sprite + '-idle', img = variant(key, q.look), m = ASSETS.sp[key];
      if (img && m) {
        const top = Math.round(q.footY - (m.fy + 1)), left = q.flip ? Math.round(q.x - (m.w - m.cx)) : Math.round(q.x - m.cx);
        if (q.flip) { ctx.save(); ctx.translate(left + m.w, top); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); ctx.restore(); } else ctx.drawImage(img, left, top);
      }
    } else if (q.kind === 'cut') {              // one clean diagonal cut that opens across the target
      const n = Math.round(q.len * q.t), cos = Math.cos(q.ang), sin = Math.sin(q.ang);
      for (let j = 0; j < n; j++) {
        const x = q.x + (j - q.len / 2) * cos, y = q.y + (j - q.len / 2) * sin, edge = j > n - 4;
        ctx.fillStyle = edge ? '#ffffff' : q.color; ctx.fillRect(Math.round(x), Math.round(y), 2, edge ? 2 : 1);
        if (!edge && j % 2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x), Math.round(y) - 1, 1, 1); }
      }
    }
    ctx.globalAlpha = 1;
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
  async function advance(sec) {
    for (let n = Math.round(sec / 0.02); n > 0; n--) { sim(0.02); for (let k = 0; k < 6; k++) await null; }
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
    loadSprites, variant, IMG, makeActor, removeActor, meta, X, footY, headY, chestY, tall,
    sparks, fly, rise, converge, ring, slash, dust, gem, number, fieldNotice, banner, plate, prop, dropProp, punch, reducedMotion,
    init, resize, setRoom, bellPosition, clear, start, advance, draw, RIM,
    pause(on) { clock.paused = !!on; }
  };
}
