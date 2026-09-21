import { clamp, EVENT_DUNGEONS } from './content.js';
import { createArtUrls } from './art-manifest.js';
const TAU = Math.PI * 2;
// Head landmarks exclude horns, ears, trailing hair and halos. Larger bodies stay larger.
export const BOSS_PRESENTATION = [
  {size:164,offsetY:0},{size:164,offsetY:0},{size:164,offsetY:0},
  {size:164,offsetY:0},{size:164,offsetY:0},{size:184,offsetY:0},
  {size:190,offsetY:3},{size:156,offsetY:1},{size:218,offsetY:17},
  {size:190,offsetY:13},{size:246,offsetY:44},{size:200,offsetY:11}
];
function star(c, x, y, r, points = 4, rotation = 0) {
  c.beginPath();
  for (let i = 0; i < points * 2; i++) { const a = i * Math.PI / points + rotation - Math.PI / 2, d = i % 2 ? r * .38 : r; const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d; if (!i) c.moveTo(px, py); else c.lineTo(px, py); }
  c.closePath();
}
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export async function loadArt() {
  const urls = createArtUrls(globalThis.ASTRAL_ASSET_ROOT || 'dist/assets');
  const result = { ...urls };
  for (const key of ['heroes', 'bosses', 'enemies', 'worlds', 'companions', 'secrets', 'sentinels', 'relics', 'tides', 'astea', 'bloomFx']) result[key] = Array(urls[key].length);
  result['bloom-fx'] = result.bloomFx;
  const pending = new Map();
  const imageFor = url => {
    if (!pending.has(url)) pending.set(url, new Promise((resolve, reject) => {
      const image = new Image(); image.decoding = 'async';
      image.onload = () => resolve(image); image.onerror = () => reject(new Error(`그림을 불러올 수 없어요: ${url}`));
      image.src = globalThis.ASTRAL_EMBEDDED_ASSETS?.[url] ?? url;
    }));
    return pending.get(url);
  };
  result.getDecodedCount = () => pending.size;
  const assign = (url, image) => {
    for (const key of ['heroes', 'bosses', 'enemies', 'worlds', 'companions', 'secrets', 'sentinels', 'relics', 'tides', 'astea', 'bloomFx']) urls[key].forEach((value, index) => { if (value === url) result[key][index] = image; });
    if (urls.dark === url) result.dark = image;
    if (urls.sigil === url) result.sigil = image;
    if (urls.darkFairy === url) result.darkFairy = image;
  };
  const loadQueued = async paths => {
    const queue = [...new Set(paths.filter(Boolean))]; let cursor = 0;
    const worker = async () => { while (cursor < queue.length) { const url = queue[cursor++]; assign(url, await imageFor(url)); } };
    await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker));
  };
  result.ensureStage = async stage => {
    const event = EVENT_DUNGEONS.find(dungeon => dungeon.id === stage);
    const enemyIndex = event?.specialType ?? stage;
    await loadQueued([urls.worlds[stage], urls.bosses[stage], urls.enemies[enemyIndex], urls.sentinels[enemyIndex]]);
  };
  result.ensureGameplay = async ({ stage, hero, challenge }) => {
    await loadQueued([urls.heroes[hero], urls.heroes[1], urls.dark, urls.sigil, urls.companions[3], urls.darkFairy, ...urls.bloomFx]);
    await result.ensureStage(stage);
    if (challenge) void result.ensureStage(stage + 1);
  };
  // A transparent cached effect keeps the hitbox readable without per-frame filters.
  const barrier=canvas(192,192),bc=barrier.getContext('2d');
  const glow=bc.createRadialGradient(96,96,58,96,96,88);glow.addColorStop(0,'#79eaff00');glow.addColorStop(.75,'#79eaff22');glow.addColorStop(1,'#79eaff00');bc.fillStyle=glow;bc.fillRect(0,0,192,192);
  bc.strokeStyle='#a8f5ff';bc.lineWidth=2;bc.beginPath();bc.arc(96,96,77,0,TAU);bc.stroke();
  bc.strokeStyle='#6ddcfb66';bc.lineWidth=1;bc.beginPath();bc.arc(96,96,71,0,TAU);bc.stroke();
  for(let i=0;i<6;i++){const a=i*TAU/6;bc.fillStyle='#d9ffff';star(bc,96+Math.cos(a)*77,96+Math.sin(a)*77,6,4,a);bc.fill();}
  result.barrier=barrier;
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
      const active=hazard.age>hazard.warn,horizontal=hazard.axis==='horizontal';
      c.save();c.fillStyle=active?'#b7f4ff99':'#ffb7f126';
      if(horizontal)c.fillRect(0,hazard.x-hazard.width/2,450,hazard.width);
      else c.fillRect(hazard.x-hazard.width/2,0,hazard.width,h);
      c.strokeStyle=active?'#fff':'#ffb7f1';c.lineWidth=active?3:1;c.setLineDash(active?[]:[8,12]);
      c.beginPath();c.moveTo(horizontal?0:hazard.x,horizontal?hazard.x:0);c.lineTo(horizontal?450:hazard.x,horizontal?hazard.x:h);c.stroke();c.restore();
    }
    for (const z of g.zones) {
      const color=z.kind==='haven'?'#f8d8ec':'#c496ff';
      c.save();c.globalAlpha=Math.min(.35,z.life*.35);c.drawImage(this.glow(color),z.x-z.r,z.y-z.r,z.r*2,z.r*2);
      c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.arc(z.x,z.y,z.r,0,TAU);c.stroke();
      for(let i=0;i<5;i++){const a=t*.7+i*TAU/5;c.fillStyle=color;star(c,z.x+Math.cos(a)*z.r*.7,z.y+Math.sin(a)*z.r*.7,5);c.fill();}c.restore();
    }
    if(g.weapon==='orbit' && (g.bombTime<=0||g.artifacts.has('sun'))) {
      for(const orb of g.orbitCenters()) {this.sprite(this.art.sigil,orb.x,orb.y,100.8,-t*2,1,.8);}
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
      const presentation=BOSS_PRESENTATION[e.image],size=e.boss?presentation.size:e.miniboss?125:e.elite?84:e.offspring?32:55;
      this.sprite(e.boss ? this.art.bosses[e.image] : e.miniboss?this.art.sentinels[e.image]:this.art.enemies[e.image], e.x, e.y + bob + (e.boss?presentation.offsetY:0), size, e.boss ? Math.sin(e.age) * .025 : Math.sin(e.age * 2) * .08, 1, e.flash > 0 ? .63 : 1);
      if(e.spawnInvincible>0){c.strokeStyle='#fff4d5';c.lineWidth=2;c.beginPath();c.arc(e.x,e.y,e.r+5,0,TAU);c.stroke();}
      if(e.special!==undefined){c.strokeStyle=g.stage.color;c.lineWidth=2;c.beginPath();c.arc(e.x,e.y,31,0,TAU);c.stroke();c.fillStyle='#fff';c.font='bold 12px sans-serif';c.textAlign='center';c.fillText(e.special===2?Math.ceil(e.countdown):['','Ⅲ','','✿','↔','◇'][e.special],e.x,e.y-37);}
      if(e.marks){c.fillStyle='#ffbedf';for(let i=0;i<e.marks;i++){star(c,e.x-6+i*12,e.y-30,4);c.fill();}}
      if (e.flash > 0) { c.globalCompositeOperation = 'lighter'; c.drawImage(this.glow('#ffffff'), e.x - 16, e.y - 16, 32, 32); c.globalCompositeOperation = 'source-over'; }
      if (e.elite) { c.fillStyle = '#1c102b'; c.fillRect(e.x - 26, e.y - 40, 52, 3); c.fillStyle = g.stage.color; c.fillRect(e.x - 26, e.y - 40, 52 * Math.max(0, e.hp / e.maxHp), 3); }
    }
    for (const drop of g.pickups) this.drawPickup(drop, t);
    for (const f of g.effects) if (f.type !== 'beam') this.drawEffect(f, g);
    if (g.bombTime > 0) this.drawBomb(g);
    this.drawPlayer(g);
    for (const b of g.bullets) this.drawBullet(b);
    for (let i = 0; i < g.particles.length; i += this.quality ? 1 : 2) {
      const q = g.particles[i]; c.globalAlpha = clamp(q.life / .4, 0, 1); c.fillStyle = q.color; star(c, q.x, q.y, q.r, 4, q.life * 2); c.fill();
    }
    c.globalAlpha = 1;
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
    } else if (['nightmoon','nightstar','seed','promise'].includes(s.type)) {
      const large=s.type==='nightmoon';c.drawImage(this.glow(g.hero.color),-s.r*1.8,-s.r*1.8,s.r*3.6,s.r*3.6);
      c.fillStyle=large?'#8663c5':'#fff0db';c.strokeStyle='#fff0ff';c.lineWidth=1.7;
      if(large){c.beginPath();c.arc(0,0,s.r,0,TAU);c.fill();c.stroke();c.fillStyle='#efd7ff';star(c,0,0,s.r*.7,4,g.totalTime);c.fill();}
      else {star(c,0,0,s.r,s.type==='promise'?4:5,g.totalTime*2);c.fill();c.stroke();}
    } else if (['ice','glass','snow','clock','darkglass','timehand'].includes(s.type)) {
      c.strokeStyle='#ffffff';c.fillStyle=s.type==='ice'||s.type==='snow'?'#9decff':s.type==='darkglass'?'#c56cff':'#ffbce9';c.lineWidth=1.4;
      if(s.type==='darkglass')c.scale(1.7,1.5);
      if(s.type==='glass')c.scale(s.r/12,s.r/12);
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
    if(g.artifacts.has('leaf'))this.sprite(this.art.companions[3],p.x+44,p.y-22+Math.sin(t*2)*8,40);
    if(g.artifacts.has('mirror'))this.sprite(this.art.darkFairy,p.x-44,p.y-22-Math.sin(t*2)*8,40);
    c.save(); c.translate(p.x, p.y);
    c.globalAlpha = .3; c.strokeStyle = g.hero.color; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(0, 19, 25, 8, 0, 0, TAU); c.stroke();
    for (const side of [-1, 1]) { c.beginPath(); c.moveTo(side * 14, 10); c.quadraticCurveTo(side * 23 + Math.sin(t * 4) * 7, 37, side * 9, 59); c.stroke(); }
    c.globalAlpha = 1; c.restore();
    const opacity = p.invincible > 0 && g.bombTime <= 0 ? .58 + Math.sin(t * 20) * .26 : 1;
    this.sprite(g.heroIndex===8&&!g.artifacts.has('sun')&&g.bombTime>0?this.art.dark:this.art.heroes[g.heroIndex], p.x, p.y + Math.sin(t * 4) * 3 + p.recoil * 2, g.heroIndex===7?112:82, p.tilt, 1 - p.recoil * .035, opacity);
    if(p.barrier)this.sprite(this.art.barrier,p.x,p.y,118+Math.sin(t*3)*3,t*.12,1,.9);
    if (p.invincible > 0) { c.strokeStyle = g.hero.color + '99'; c.lineWidth = 1; c.beginPath(); c.arc(p.x, p.y, 36 + Math.sin(t * 5) * 2, 0, TAU); c.stroke(); }
    // The tiny luminous core is the actual hitbox; the illustration and cape are safe.
    c.fillStyle = '#11162a'; c.beginPath(); c.arc(p.x, p.y, p.radius, 0, TAU); c.fill();
    c.strokeStyle = '#fff8dc'; c.lineWidth = 1.6; c.stroke(); c.fillStyle = '#b6f9ff'; c.beginPath(); c.arc(p.x, p.y, 2.5, 0, TAU); c.fill();
  }
  drawEffect(f, g) {
    const c = this.c, q = clamp(f.age / f.life, 0, 1); c.save();
    if(f.type==='barrierBreak'){
      c.strokeStyle='#b8f8ff';c.globalAlpha=1-q;c.lineWidth=2;
      for(let i=0;i<6;i++){const a=i*TAU/6+q*.3;c.beginPath();c.arc(f.x,f.y,f.radius*(1+q*.7),a,a+.55);c.stroke();}
    } else if(f.type==='celestialWarning'||f.type==='eventWave'){c.fillStyle='#ffe1a322';c.fillRect(f.gap-62,78,124,g.height-78);c.strokeStyle=f.color||'#ffe1a3';c.lineWidth=2;c.setLineDash([8,8]);for(const x of [f.gap-62,f.gap+62]){c.beginPath();c.moveTo(x,78);c.lineTo(x,g.height);c.stroke();}c.setLineDash([]);for(let x=25;x<450;x+=32)if(Math.abs(x-f.gap)>62){star(c,x,f.bottom?g.height-24:85,7);c.stroke();}
    } else if(f.type==='teleport'){c.strokeStyle=f.color;c.globalAlpha=.5+q*.5;c.lineWidth=2;c.beginPath();c.arc(f.x,f.y,f.radius*(1.4-q*.4),0,TAU);c.stroke();this.sprite(this.art['bloom-fx'][3],f.x,f.y,60,0,1,.5);
    } else if(f.type==='detonation') {
      c.fillStyle=f.age<(f.wait??.75)?'#ff9f492b':'#ffe6bc88';c.strokeStyle='#ffd199';c.lineWidth=2;c.beginPath();c.arc(f.x,f.y,f.radius,0,TAU);c.fill();c.stroke();
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
    const c=this.c,p=g.player,width=13+g.power*3,y=p.y-25,length=Math.max(0,y);
    c.save();c.fillStyle='#f5cf79';c.globalAlpha=.18;c.fillRect(p.x-width,0,width*2,length);
    c.fillStyle='#ffe3a2';c.globalAlpha=.6;c.fillRect(p.x-width/2,0,width,length);
    c.fillStyle='#ffffef';c.globalAlpha=.9;c.fillRect(p.x-2.5,0,5,length);
    c.drawImage(this.glow('#ffdf82'),p.x-20,y-20,40,40);c.restore();
  }
  drawBomb(g) {
    const c = this.c, t = g.totalTime, remaining = g.bombTime;
    const age=(g.bombDuration||5)-remaining;
    if(g.artifacts.has('sun')){const q=age/g.bombDuration;this.sprite(this.art['bloom-fx'][1],225,this.height*.4,220+q*400,q*.2,1,Math.sin(Math.PI*Math.min(.99,q))*.9);return;}
    const auraActive=g.heroIndex!==8||age<(g.bombInvincibility||0);
    // Reuse one cached sigil and the existing portrait: no full-screen filters or new textures per frame.
    if(auraActive)this.sprite(this.art.sigil,g.player.x,g.player.y,240+Math.min(age,1)*90,t*.35,1,Math.min(.5,remaining*.5));
    if(age<1.1){const q=age/1.1,fade=Math.sin(q*Math.PI)*.85;
      this.sprite(g.heroIndex===8?this.art.dark:this.art.heroes[g.heroIndex],350-q*80,this.height*.43,300+q*35,-.08,1,fade);
      c.save();c.strokeStyle=g.hero.color;c.globalAlpha=1-q;c.lineWidth=5*(1-q);c.beginPath();c.arc(g.player.x,g.player.y,30+q*500,0,TAU);c.stroke();c.restore();
    }
    if(!auraActive)return;
    c.save(); c.strokeStyle = g.hero.color; c.lineWidth = 2; c.globalAlpha = .25;
    const cx = g.player.x, cy = g.player.y;
    if (g.heroIndex === 0) {
      for (let i = 0; i < 10; i++) { const x = (i * 67 + t * 30) % 450, y = ((t * 530 + i * 133) % (this.height + 200)) - 100;
        c.beginPath(); c.moveTo(x - 36, y - 95); c.lineTo(x, y); c.stroke(); c.fillStyle = '#fff0b5'; star(c, x, y, 12, 5, t); c.fill(); }
    } else if (g.heroIndex === 1) {
      for (const side of [-1, 1]) this.sprite(this.art.heroes[1], cx + side * 52, cy - 20 + Math.sin(t * 8) * 14, 70, side * .22, 1, .35);
    } else if (g.heroIndex === 2) {
      this.sprite(this.art['bloom-fx'][0],cx,cy-145-Math.sin(age*2)*20,390,0,1,.9);
    } else if(g.heroIndex===4) {
      c.translate(cx,cy);c.rotate(t*.5);for(let i=0;i<6;i++){c.rotate(TAU/6);c.beginPath();c.moveTo(0,20);c.lineTo(0,180);c.moveTo(0,100);c.lineTo(-35,70);c.moveTo(0,100);c.lineTo(35,70);c.stroke();}
    } else if(g.heroIndex===5) {
      c.translate(cx,cy);c.rotate(-t*.4);c.beginPath();c.arc(0,0,140,0,TAU);c.stroke();for(let i=0;i<12;i++){c.rotate(TAU/12);c.fillStyle=g.hero.color;star(c,0,-140,9,4);c.fill();}c.beginPath();c.moveTo(0,-120);c.lineTo(0,0);c.lineTo(75,35);c.stroke();
    } else {
      c.translate(cx, cy); c.rotate(t * .5); for (let i = 0; i < 8; i++) { c.rotate(TAU / 8); c.beginPath(); c.ellipse(0, 48, 32, 75, 0, 0, TAU); c.stroke(); }
    }
    c.restore();
    const fx=g.heroIndex===0?1:g.heroIndex===4?2:g.heroIndex===3||g.heroIndex===7?3:-1;
    if(fx>=0)this.sprite(this.art['bloom-fx'][fx],cx,cy-70,270+Math.sin(age*3)*12,t*.15,1,.5*Math.min(1,remaining));
    if(g.heroIndex===1||g.heroIndex===5||g.heroIndex===6||g.heroIndex===8)this.sprite(this.art.sigil,cx,cy-90,300,-t*.25,1,.55*Math.min(1,remaining));
    c.save();c.globalAlpha = .1 * Math.min(1, remaining); c.fillStyle = g.hero.color; c.fillRect(-450, -this.height, 900, this.height * 2); c.restore();
  }
}
