import { clamp } from './content.js';
const TAU = Math.PI * 2;
function star(c, x, y, r, points = 4, rotation = 0) {
  c.beginPath();
  for (let i = 0; i < points * 2; i++) { const a = i * Math.PI / points + rotation - Math.PI / 2, d = i % 2 ? r * .38 : r; const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d; if (!i) c.moveTo(px, py); else c.lineTo(px, py); }
  c.closePath();
}
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export async function loadArt() {
  const sources = globalThis.ASTRAL_ASSETS || { heroes: 'assets/heroes.png', bosses: 'assets/bosses.png', enemies: 'assets/enemies.png', worlds: 'assets/worlds.jpg', companions:'assets/companions.png',sentinels:'assets/sentinels.png',relics:'assets/relics.png' };
  const images = {};
  await Promise.all(Object.entries(sources).map(([id, src]) => new Promise((resolve, reject) => {
    const im = new Image(); im.onload = () => { images[id] = im; resolve(); }; im.onerror = () => reject(new Error(`그림을 불러올 수 없어요: ${id}`)); im.src = src;
  })));
  const result = { heroes: [], bosses: [], enemies: [], worlds: [], companions:[],sentinels:[],relics:[], urls: { heroes: [], bosses: [], worlds: [],relics:[] } };
  for (const kind of ['heroes', 'bosses', 'enemies','companions','sentinels','relics']) {
    const columns=kind==='relics'?4:2;
    for (let i = 0; i < columns*columns; i++) {
      const sheet = images[kind], w = sheet.width / columns, h = sheet.height / columns;
      const sw = Math.floor(w), sh = Math.floor(h), raw = canvas(sw, sh), rc = raw.getContext('2d', { willReadFrequently: true });
      rc.drawImage(sheet, (i % columns) * w, Math.floor(i / columns) * h, w, h, 0, 0, sw, sh);
      // Decode the chroma export once. Gameplay uses cached, genuinely transparent textures.
      const pixels = rc.getImageData(0, 0, sw, sh), d = pixels.data;
      const keyed = new Uint8Array(sw * sh);
      for (let j = 0; j < d.length; j += 4) {
        const r = d[j], g = d[j + 1], b = d[j + 2];
        if (g > 150 && g > r * 1.7 && g > b * 1.65) {
          keyed[j / 4] = 1;
          const a = clamp((Math.max(r, b) - 45) / 80, 0, 1);
          d[j + 3] = Math.round(a * 255); d[j + 1] = Math.min(g, Math.max(r, b) * 1.12);
        }
      }
      // Despill the adjacent antialiased edge before resizing, so green never bleeds
      // into a white cloak when the texture is filtered at mobile sprite sizes.
      for (let y = 1; y < sh - 1; y++) for (let x = 1; x < sw - 1; x++) {
        const p = y * sw + x, j = p * 4;
        if (!keyed[p] && (keyed[p - 1] || keyed[p + 1] || keyed[p - sw] || keyed[p + sw])) {
          const strongest = Math.max(d[j], d[j + 2]), spill = d[j + 1] - strongest;
          if (spill > 12) { d[j + 1] = strongest + 5; d[j + 3] = Math.round(d[j + 3] * (1 - clamp((spill - 12) / 230, 0, .8))); }
        }
      }
      rc.putImageData(pixels, 0, 0);
      const cut = canvas(384, 384), c = cut.getContext('2d');
      if(kind==='companions') {
        let x0=sw,y0=sh,x1=0,y1=0;
        for(let y=0;y<sh;y++)for(let x=0;x<sw;x++)if(d[(y*sw+x)*4+3]>30){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
        const w=x1-x0+1,h=y1-y0+1,scale=352/Math.max(w,h);c.drawImage(raw,x0,y0,w,h,(384-w*scale)/2,(384-h*scale)/2,w*scale,h*scale);
      }else c.drawImage(raw, 0, 0, 384, 384);
      result[kind].push(cut);
      if (result.urls[kind]) result.urls[kind].push(cut.toDataURL('image/png'));
    }
  }
  result.heroes[1]=result.companions[0];result.heroes.push(result.companions[1],result.companions[2]);
  result.urls.heroes=result.heroes.map(c=>c.toDataURL('image/png'));
  for (let i = 0; i < 4; i++) {
    const im = images.worlds, cut = canvas(450, 1200), c = cut.getContext('2d');
    c.drawImage(im, i * im.width / 4, 0, im.width / 4, im.height, 0, 0, 450, 1200);
    result.worlds.push(cut); result.urls.worlds.push(cut.toDataURL('image/jpeg', .87));
  }
  return result;
}

export class Renderer {
  constructor(element, art) {
    this.canvas = element; this.c = element.getContext('2d', { alpha: false }); this.art = art;
    this.width = 450; this.height = 900; this.shake = 0; this.flash = 0; this.bombFlash = 0; this.quality = 1;
    this.motes = Array.from({ length: 35 }, (_, i) => ({ x: (i * 173.3) % 450, y: (i * 139.8) % 1100, r: .7 + (i % 4) * .5, speed: 10 + i % 12 }));
    this.glows = new Map(); this.bulletSprites = new Map(); this.slowFrames = 0; this.resize();
  }
  resize() {
    const box = this.canvas.getBoundingClientRect();
    this.height = clamp(450 * box.height / Math.max(1, box.width), 650, 1100);
    const ratio = Math.min(globalThis.devicePixelRatio || 1, this.quality ? 1.75 : 1);
    this.canvas.width = Math.round(box.width * ratio); this.canvas.height = Math.round(box.height * ratio);
    this.scaleX = this.canvas.width / 450; this.scaleY = this.canvas.height / this.height;
  }
  glow(color) {
    if (this.glows.has(color)) return this.glows.get(color);
    const im = canvas(48, 48), c = im.getContext('2d'), g = c.createRadialGradient(24, 24, 1, 24, 24, 24);
    g.addColorStop(0, '#ffffff'); g.addColorStop(.15, color); g.addColorStop(.35, color + '99'); g.addColorStop(1, color + '00');
    c.fillStyle = g; c.fillRect(0, 0, 48, 48); this.glows.set(color, im); return im;
  }
  feedback(type) {
    if (type === 'hurt') { this.shake = 10; this.flash = .55; }
    if (type === 'bomb') { this.shake = 7; this.bombFlash = .9; }
    if (type === 'bossDefeated') { this.shake = 12; this.bombFlash = .8; }
    if (type === 'powerup') this.bombFlash = .25;
  }
  observeFrame(dt) {
    this.slowFrames = dt > .026 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - .3);
    if (this.slowFrames > 75 && this.quality) { this.quality = 0; this.resize(); }
  }
  sprite(image, x, y, size, angle = 0, squash = 1, opacity = 1) {
    const c = this.c; c.save(); c.translate(x, y); c.rotate(angle); c.globalAlpha = opacity;
    c.drawImage(image, -size / 2, -size / 2, size, size * squash); c.restore();
  }
  render(g, dt = 1 / 60) {
    const c = this.c, h = this.height, t = g.totalTime;
    c.setTransform(this.scaleX, 0, 0, this.scaleY, 0, 0);
    c.fillStyle = '#070d1b'; c.fillRect(0, 0, 450, h);
    c.save();
    this.shake = Math.max(0, this.shake - dt * 36); this.flash = Math.max(0, this.flash - dt * 2); this.bombFlash = Math.max(0, this.bombFlash - dt * 1.4);
    if (this.shake > 0) c.translate(Math.sin(t * 103) * this.shake, Math.cos(t * 137) * this.shake * .4);
    const background = this.art.worlds[g.stageIndex];
    // Each chapter is a single painted journey. Travel through the painting toward
    // its skyline, then hold at the boss arena; architecture never flips or repeats.
    const worldHeight = Math.max(h + 360, 1320);
    const journey = clamp(g.time / g.stage.duration, 0, 1);
    c.drawImage(background, 0, -(worldHeight - h) * (1 - journey), 450, worldHeight);
    c.fillStyle = '#050a193e'; c.fillRect(0, 0, 450, h);
    const vignette = c.createLinearGradient(0, 0, 0, h);
    vignette.addColorStop(0, '#06102199'); vignette.addColorStop(.2, '#06102110'); vignette.addColorStop(.8, '#080c2010'); vignette.addColorStop(1, '#080c2099');
    c.fillStyle = vignette; c.fillRect(0, 0, 450, h);
    c.fillStyle = g.stage.color;
    for (let i = 0; i < (this.quality ? 35 : 16); i++) { const m = this.motes[i]; c.globalAlpha = .15 + Math.sin(t + i) * .1; c.beginPath(); c.arc(m.x + Math.sin(t * .3 + i) * 12, (m.y + t * m.speed) % h, m.r, 0, TAU); c.fill(); }
    c.globalAlpha = 1;
    for (const hazard of g.hazards) {
      const active = hazard.age > hazard.warn;
      c.fillStyle = active ? '#edd5ffbb' : '#f8a2ec18'; c.fillRect(hazard.x - hazard.width / 2, 70, hazard.width, h);
      c.strokeStyle = active ? '#fff' : '#ffb7f1'; c.lineWidth = active ? 3 : 1; c.setLineDash(active ? [] : [8, 12]);
      c.beginPath(); c.moveTo(hazard.x, 76); c.lineTo(hazard.x, h); c.stroke(); c.setLineDash([]);
      if (!active) { c.fillStyle = '#ffe0f4'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.fillText('주의', hazard.x, h - 160); }
    }
    if(g.weapon==='laser' && ['wave','boss'].includes(g.phase)) this.drawLaser(g);
    for (const shot of g.shots) this.drawShot(shot, g);
    for (const e of g.enemies) {
      const bob = Math.sin(e.age * (e.boss ? 2 : 5)) * (e.boss ? 6 : 3);
      if (e.boss) {
        c.save(); c.translate(e.x, e.y); c.rotate(t * .15); c.strokeStyle = g.stage.color + '70'; c.lineWidth = 1;
        for (let i = 0; i < 2; i++) { c.beginPath(); c.arc(0, 0, 73 + i * 10, 0, TAU); c.stroke(); }
        for (let i = 0; i < 8; i++) { star(c, Math.cos(i * TAU / 8) * 82, Math.sin(i * TAU / 8) * 82, 5); c.stroke(); } c.restore();
      }
      const size = e.boss ? (g.stageIndex === 3 ? 184 : 164) : e.miniboss?125:e.elite ? 84 : e.offspring?32:55;
      this.sprite(e.boss ? this.art.bosses[e.image] : e.miniboss?this.art.sentinels[e.image]:this.art.enemies[e.image], e.x, e.y + bob, size, e.boss ? Math.sin(e.age) * .025 : Math.sin(e.age * 2) * .08, 1, e.flash > 0 ? .63 : 1);
      if(e.special!==undefined){c.strokeStyle=['#ffbc74','#ffb4db','#dfaaff','#ddadff'][e.special];c.lineWidth=2;c.beginPath();c.arc(e.x,e.y,31,0,TAU);c.stroke();c.fillStyle='#fff';c.font='bold 12px sans-serif';c.textAlign='center';c.fillText(e.special===2?Math.ceil(e.countdown):['!','Ⅲ','','◇'][e.special],e.x,e.y-37);}
      if(e.marks){c.fillStyle='#ffbedf';for(let i=0;i<e.marks;i++){star(c,e.x-6+i*12,e.y-30,4);c.fill();}}
      if (e.flash > 0) { c.globalCompositeOperation = 'lighter'; c.drawImage(this.glow('#ffffff'), e.x - 16, e.y - 16, 32, 32); c.globalCompositeOperation = 'source-over'; }
      if (e.elite) { c.fillStyle = '#1c102b'; c.fillRect(e.x - 26, e.y - 40, 52, 3); c.fillStyle = g.stage.color; c.fillRect(e.x - 26, e.y - 40, 52 * Math.max(0, e.hp / e.maxHp), 3); }
    }
    for (const drop of g.pickups) this.drawPickup(drop, t);
    for (const f of g.effects) if (f.type !== 'beam') this.drawEffect(f, g);
    this.drawPlayer(g);
    for (const b of g.bullets) this.drawBullet(b);
    for (let i = 0; i < g.particles.length; i += this.quality ? 1 : 2) {
      const q = g.particles[i]; c.globalAlpha = clamp(q.life / .4, 0, 1); c.fillStyle = q.color; star(c, q.x, q.y, q.r, 4, q.life * 2); c.fill();
    }
    c.globalAlpha = 1;
    if (g.bombTime > 0) this.drawBomb(g);
    if (this.bombFlash > 0) { c.fillStyle = g.hero.color; c.globalAlpha = this.bombFlash * .38; c.fillRect(0, 0, 450, h); c.globalAlpha = 1; }
    if (this.flash > 0) { c.strokeStyle = `rgba(255,110,140,${this.flash})`; c.lineWidth = 22; c.strokeRect(0, 0, 450, h); }
    c.restore();
  }
  drawShot(s, g) {
    const c = this.c, angle = Math.atan2(s.vy, s.vx) + Math.PI / 2;
    c.save(); c.translate(s.x, s.y); c.rotate(angle);
    if (s.type === 'star') {
      c.globalAlpha = .38; c.fillStyle = g.hero.color; c.beginPath(); c.moveTo(-4, 0); c.lineTo(0, 32); c.lineTo(4, 0); c.fill(); c.globalAlpha = 1;
      c.strokeStyle = '#5086b4'; c.lineWidth = 2; c.fillStyle = '#fff5b5'; star(c, 0, 0, 9, 5, g.totalTime * 4); c.fill(); c.stroke();
    } else if (['ice','glass','snow','clock'].includes(s.type)) {
      c.strokeStyle='#ffffff';c.fillStyle=s.type==='ice'||s.type==='snow'?'#9decff':'#ffbce9';c.lineWidth=1.4;
      if(s.type==='snow'){star(c,0,0,13,6,g.totalTime*4);c.fill();c.stroke();}
      else if(s.type==='clock'){c.beginPath();c.arc(0,0,8,0,TAU);c.stroke();c.beginPath();c.moveTo(0,-5);c.lineTo(0,0);c.lineTo(5,2);c.stroke();}
      else{c.beginPath();c.moveTo(0,-23);c.lineTo(7,0);c.lineTo(0,15);c.lineTo(-7,0);c.closePath();c.fill();c.stroke();}
    } else if (s.type === 'dagger' || s.type === 'lance') {
      const long = s.type === 'lance'; c.fillStyle = long ? '#ff9e63' : '#b397ff'; c.globalAlpha = .23; c.fillRect(-s.r, -20, s.r * 2, 60); c.globalAlpha = 1;
      c.beginPath(); c.moveTo(0, long ? -40 : -19); c.lineTo(long ? 10 : 4, 6); c.lineTo(0, long ? 26 : 14); c.lineTo(long ? -10 : -4, 6); c.closePath(); c.fill();
      c.strokeStyle = '#fff4df'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, long ? -32 : -14); c.lineTo(0, 10); c.stroke();
    } else if (s.type === 'fire') {
      c.drawImage(this.glow('#ff994d'), -17, -17, 34, 48); c.fillStyle = '#fff0ae'; c.beginPath(); c.ellipse(0, 0, 4.5, 10, 0, 0, TAU); c.fill();
    } else if (s.type === 'moon') {
      c.strokeStyle = '#e8d5ff'; c.lineWidth = 4; c.beginPath(); c.arc(0, 4, 17, Math.PI * 1.14, Math.PI * 1.86); c.stroke();
    } else {
      c.fillStyle = '#fff1c8'; c.strokeStyle = '#d8aaf6'; c.lineWidth = 1.3; c.beginPath(); c.ellipse(0, 0, 5.5, 12, .4, 0, TAU); c.fill(); c.stroke();
    }
    c.restore();
  }
  drawBullet(b) {
    const key = `${b.color}/${b.shape}/${b.r}`;
    let sprite = this.bulletSprites.get(key);
    if (!sprite) {
    sprite = canvas(28, 28); const c = sprite.getContext('2d'); c.translate(14, 14);
    c.strokeStyle = '#15122d'; c.lineWidth = 2.5; c.fillStyle = b.color;
    if (b.shape === 'heart') {
      c.beginPath(); c.moveTo(0, 7); c.bezierCurveTo(-13, -1, -4, -10, 0, -4); c.bezierCurveTo(5, -10, 12, -1, 0, 7);
    } else if (b.shape === 'diamond') { c.beginPath(); c.moveTo(0, 9); c.lineTo(5, 0); c.lineTo(0, -9); c.lineTo(-5, 0); c.closePath(); }
    else { c.beginPath(); c.arc(0, 0, b.r + 1.5, 0, TAU); }
    c.stroke(); c.fill(); c.fillStyle = '#fff9f1'; c.beginPath(); c.arc(-.5, -1, 2.5, 0, TAU); c.fill();
    this.bulletSprites.set(key, sprite);
    }
    const size=b.split?44:28;
    this.c.drawImage(sprite, b.x-size/2,b.y-size/2,size,size);
    if(b.split){const c=this.c;c.strokeStyle='#ffe6ff';c.lineWidth=1;c.beginPath();c.arc(b.x,b.y,19+Math.sin(b.age*7)*2,0,TAU);c.stroke();}
  }
  drawPickup(d, t) {
    const c = this.c; c.save(); c.translate(d.x, d.y + Math.sin(t * 5 + d.x) * 3);
    if (d.type === 'score') { c.rotate(t * 1.5); c.fillStyle = '#fff0b3'; c.strokeStyle = '#906539'; c.lineWidth = 1.5; star(c, 0, 0, 7, 4); c.fill(); c.stroke(); }
    else { c.fillStyle = d.type === 'power' ? '#53d6e6' : '#ff9cb8'; c.strokeStyle = '#fff7db'; c.lineWidth = 2; c.beginPath(); c.roundRect(-12, -12, 24, 24, 6); c.fill(); c.stroke(); c.fillStyle = '#142533'; c.font = 'bold 15px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(d.type === 'power' ? 'P' : '♥', 0, 1); }
    c.restore();
  }
  drawPlayer(g) {
    const c = this.c, p = g.player, t = g.totalTime;
    if(g.artifacts.has('leaf'))this.sprite(this.art.companions[3],p.x+Math.cos(t*2)*44,p.y-22+Math.sin(t*2)*12,40);
    c.save(); c.translate(p.x, p.y);
    c.globalAlpha = .3; c.strokeStyle = g.hero.color; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(0, 19, 25, 8, 0, 0, TAU); c.stroke();
    for (const side of [-1, 1]) { c.beginPath(); c.moveTo(side * 14, 10); c.quadraticCurveTo(side * 23 + Math.sin(t * 4) * 7, 37, side * 9, 59); c.stroke(); }
    c.globalAlpha = 1; c.restore();
    const opacity = p.invincible > 0 && g.bombTime <= 0 ? .58 + Math.sin(t * 20) * .26 : 1;
    this.sprite(this.art.heroes[g.heroIndex], p.x, p.y + Math.sin(t * 4) * 3 + p.recoil * 2, 82, p.tilt, 1 - p.recoil * .035, opacity);
    if (p.invincible > 0) { c.strokeStyle = g.hero.color + '99'; c.lineWidth = 1; c.beginPath(); c.arc(p.x, p.y, 36 + Math.sin(t * 5) * 2, 0, TAU); c.stroke(); }
    // The tiny luminous core is the actual hitbox; the illustration and cape are safe.
    c.fillStyle = '#11162a'; c.beginPath(); c.arc(p.x, p.y, 6.5, 0, TAU); c.fill();
    c.strokeStyle = '#fff8dc'; c.lineWidth = 1.6; c.stroke(); c.fillStyle = '#b6f9ff'; c.beginPath(); c.arc(p.x, p.y, 2.5, 0, TAU); c.fill();
  }
  drawEffect(f, g) {
    const c = this.c, q = clamp(f.age / f.life, 0, 1); c.save();
    if(f.type==='detonation') {
      c.fillStyle=f.age<.75?'#ff9f492b':'#ffe6bc88';c.strokeStyle='#ffd199';c.lineWidth=2;c.beginPath();c.arc(f.x,f.y,f.radius,0,TAU);c.fill();c.stroke();
      c.fillStyle='#fff';c.font='bold 13px sans-serif';c.textAlign='center';c.fillText(f.age<.75?'자폭 주의':'',f.x,f.y);
    } else if (f.type === 'beam') {
      c.globalAlpha = .2; c.fillStyle = '#f5cf79'; c.fillRect(f.x - f.width, 50, f.width * 2, Math.max(0, f.y - 50));
      c.globalAlpha = .65; c.fillStyle = '#ffe3a2'; c.fillRect(f.x - f.width / 2, 50, f.width, Math.max(0, f.y - 50));
      c.globalAlpha = .92; c.fillStyle = '#ffffef'; c.fillRect(f.x - 2.5, 50, 5, Math.max(0, f.y - 50));
      c.drawImage(this.glow('#ffdf82'), f.x - 24, f.y - 24, 48, 48);
    } else if (f.type === 'chain') {
      c.globalAlpha = 1 - q; c.strokeStyle = '#88bbff'; c.lineWidth = 7; c.beginPath(); c.moveTo(f.x, f.y);
      for (let i = 1; i <= 7; i++) c.lineTo(f.x + (f.tx - f.x) * i / 7 + (i === 7 ? 0 : Math.sin(i * 12 + g.totalTime * 40) * 12), f.y + (f.ty - f.y) * i / 7);
      c.stroke(); c.strokeStyle = '#fffbdc'; c.lineWidth = 2; c.stroke();
    } else if (f.type === 'slash') {
      c.translate(f.x, f.y); c.scale(f.alternate ? -1 : 1, 1); c.globalAlpha = (1 - q) * .85;
      c.strokeStyle = f.color; c.lineWidth = (1 - q) * 17 + 2; c.beginPath(); c.ellipse(0, -f.radius * .36, f.radius * (.45 + q * .45), f.radius * (.30 + q * .3), -.3, Math.PI * .95, Math.PI * 1.95); c.stroke();
      c.strokeStyle = '#fff8ff'; c.lineWidth = 2; c.stroke();
    } else {
      c.translate(f.x, f.y); c.globalAlpha = 1 - q; c.strokeStyle = f.color; c.lineWidth = Math.max(1, (1 - q) * 5); c.beginPath(); c.arc(0, 0, f.radius * (.2 + q), 0, TAU); c.stroke();
      c.fillStyle = '#fff1c9'; star(c, 0, 0, f.radius * (1 - q) * .5, 6, q); c.fill();
    } c.restore();
  }
  drawLaser(g) {
    const c=this.c,p=g.player,width=13+g.power*3,y=p.y-25,length=Math.max(0,y-50);
    c.save();c.fillStyle='#f5cf79';c.globalAlpha=.18;c.fillRect(p.x-width,50,width*2,length);
    c.fillStyle='#ffe3a2';c.globalAlpha=.6;c.fillRect(p.x-width/2,50,width,length);
    c.fillStyle='#ffffef';c.globalAlpha=.9;c.fillRect(p.x-2.5,50,5,length);
    c.drawImage(this.glow('#ffdf82'),p.x-20,y-20,40,40);c.restore();
  }
  drawBomb(g) {
    const c = this.c, t = g.totalTime, remaining = g.bombTime;
    c.save(); c.strokeStyle = g.hero.color; c.lineWidth = 2; c.globalAlpha = .25;
    const cx = g.player.x, cy = g.player.y;
    if (g.heroIndex === 0) {
      for (let i = 0; i < 10; i++) { const x = (i * 67 + t * 30) % 450, y = ((t * 530 + i * 133) % (this.height + 200)) - 100;
        c.beginPath(); c.moveTo(x - 36, y - 95); c.lineTo(x, y); c.stroke(); c.fillStyle = '#fff0b5'; star(c, x, y, 12, 5, t); c.fill(); }
    } else if (g.heroIndex === 1) {
      for (const side of [-1, 1]) this.sprite(this.art.heroes[1], cx + side * 52, cy - 20 + Math.sin(t * 8) * 14, 70, side * .22, 1, .35);
    } else if (g.heroIndex === 2) {
      c.translate(cx, cy); c.fillStyle = '#ffb76c'; c.beginPath(); c.moveTo(0, -120);
      c.bezierCurveTo(-35, -230, -200, -260, -215, -170); c.quadraticCurveTo(-110, -180, 0, 20);
      c.quadraticCurveTo(110, -180, 215, -170); c.bezierCurveTo(200, -260, 35, -230, 0, -120); c.fill();
    } else if(g.heroIndex===4) {
      c.translate(cx,cy);c.rotate(t*.5);for(let i=0;i<6;i++){c.rotate(TAU/6);c.beginPath();c.moveTo(0,20);c.lineTo(0,180);c.moveTo(0,100);c.lineTo(-35,70);c.moveTo(0,100);c.lineTo(35,70);c.stroke();}
    } else if(g.heroIndex===5) {
      c.translate(cx,cy);c.rotate(-t*.4);c.beginPath();c.arc(0,0,140,0,TAU);c.stroke();for(let i=0;i<12;i++){c.rotate(TAU/12);c.fillStyle=g.hero.color;star(c,0,-140,9,4);c.fill();}c.beginPath();c.moveTo(0,-120);c.lineTo(0,0);c.lineTo(75,35);c.stroke();
    } else {
      c.translate(cx, cy); c.rotate(t * .5); for (let i = 0; i < 8; i++) { c.rotate(TAU / 8); c.beginPath(); c.ellipse(0, 48, 32, 75, 0, 0, TAU); c.stroke(); }
    }
    c.globalAlpha = .1 * Math.min(1, remaining); c.fillStyle = g.hero.color; c.fillRect(-450, -this.height, 900, this.height * 2); c.restore();
  }
}
