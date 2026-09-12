import { HEROES, STAGES, DUNGEONS, LIMITS, clamp } from './content.js';
import { DIFFICULTIES, loadoutStats } from './meta.js';
const TAU = Math.PI * 2;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export class Game {
  constructor({ hero = 0, weapon = 0, stage = 0, height = 900, seed = 41, mode = 'normal', artifacts = [], onEvent = () => {} } = {}) {
    this.hero = HEROES[hero]; this.heroIndex = hero; this.weaponIndex = weapon; this.weapon = this.hero.weapons[weapon].id;
    this.width = 450; this.height = height; this.seed = seed; this.mode = mode; this.onEvent = onEvent;
    this.difficulty = DIFFICULTIES.find(d => d.id === mode) || DIFFICULTIES[1];
    this.loadout = loadoutStats(artifacts, this.difficulty.id); this.artifacts = new Set(this.loadout.ids);
    this.maxLife = this.loadout.maxLife + (this.hero.lifeBonus || 0); this.maxBombs = this.loadout.maxBombs; this.room = 0; this.reviveUsed = false; this.fairyFire = 0; this.maskUses = 0;
    this.player = { x: 225, y: height * .78, targetX: 225, targetY: height * .78, radius: this.hero.radius || 5, lives: this.loadout.lives, invincible: 2.5, fire: 0, tilt: 0, recoil: 0 };
    this.score = 0; this.bestCombo = 0; this.combo = 0; this.comboTime = 0; this.graze = 0; this.kills = 0;
    this.power = 1; this.powerPoints = 0; this.bombs = this.loadout.bombs; this.attackBonus = this.loadout.attack; this.bombTime = 0; this.bombPulse = 0;
    this.time = 0; this.totalTime = 0; this.phase = 'intro'; this.phaseTime = 0; this.finished = false;
    this.zones = []; this.areaFire = 0; this.scoreBonus = 0; this.shots = []; this.bullets = []; this.enemies = []; this.particles = []; this.pickups = []; this.effects = []; this.hazards = [];
    this.stats = { shots: 0, hits: 0, damage: 0, bombs: 0, maxBullets: 0, bossKills: 0, deaths: 0 };
    this.startStage(stage);
  }
  random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  emit(type, data = {}) { this.onEvent({ type, ...data }); }
  startStage(index, room = 0) {
    this.stageIndex = index; this.room = room; this.dungeon = DUNGEONS[index];
    this.stage = { ...STAGES[index], name: this.dungeon.rooms[room], duration: 25 + index * 3 + room * 5 };
    this.time = 0; this.phase = 'intro'; this.phaseTime = 0;
    this.spawnTime = 0; this.wave = 0; this.boss = null; this.bossDefeated = false; this.bossPattern = -1; this.bossClock = 0;
    this.sentinelSpawned = false;
    this.enemies.length = this.bullets.length = this.shots.length = this.hazards.length = this.pickups.length = 0;
    this.player.x = this.player.targetX = 225; this.player.y = this.player.targetY = this.height * .79;
    this.zones.length = 0; this.areaFire = 0; this.effects.length = this.particles.length = 0; this.player.fire = 0; this.bombTime = 0; this.maskUses = 0;
    this.player.invincible = 3; this.emit('stage', { stage: index, room });
  }
  nearest(x, y, range = 1000, exclude = null) {
    let best = null, bestD = range;
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0 || enemy === exclude || enemy.y < 15 || enemy.y > this.height - 75) continue;
      const d = Math.hypot(enemy.x - x, enemy.y - y);
      if (d < bestD) { bestD = d; best = enemy; }
    }
    return best;
  }
  move(x, y) { this.player.targetX = clamp(x, 20, 430); this.player.targetY = clamp(y, 95, this.height - 74); }
  add(list, object, cap) { if (this[list].length < cap) this[list].push(object); }
  particlesAt(x, y, color, count = 10, force = 1) {
    for (let i = 0; i < count; i++) { const a = this.random() * TAU, s = (30 + this.random() * 100) * force;
      this.add('particles', { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, life: .25 + this.random() * .45, max: .7, r: 1 + this.random() * 3 }, LIMITS.particles); }
  }
  effect(type, data) { this.add('effects', { type, age: 0, life: .35, ...data }, LIMITS.effects); }
  shot(angle, damage, type, extra = {}) {
    const p = this.player;
    this.add('shots', { x: p.x, y: p.y - 26, vx: Math.sin(angle) * 540, vy: -Math.cos(angle) * 540, damage, type, r: 8, life: 2.5, hit: new Set(), ...extra }, LIMITS.shots);
    this.stats.shots++;
  }
  fire(dt) {
    const p = this.player; p.fire -= dt; if (p.fire > 0) return;
    const boost = this.heroIndex === 2 && this.bombTime > 0 ? 1.6 : 1;
    const damage = (10 + this.power * 2.5) * boost * (this.heroIndex === 2 ? 1.1 : 1);
    p.recoil = 1;
    if (this.heroIndex === 8 && this.bombTime > 0) {
      p.fire = .16;
      for (const side of [-1,1]) this.shot(side*.055, damage*3.8*this.loadout.bomb, 'darkglass', { x:p.x+side*14, r:17, pierce:true, vy:-700 });
      this.emit('shot', { weapon:'darkglass' }); return;
    }
    switch (this.weapon) {
      case 'homing':
        p.fire = .14; for (let i = 0; i < 2 + Math.floor(this.power / 2); i++) this.shot((i - (1 + Math.floor(this.power / 2)) / 2) * .24, damage * .648, 'star', { homing: true, r: 7, speed: 520 }); break;
      case 'laser': {
        p.fire += .075; const width = 13 + this.power * 3;
        for (const e of this.enemies) if (e.y < p.y && Math.abs(e.x - p.x) < e.r + width / 2) {
          if (e.lastLaserHit === undefined || this.totalTime - e.lastLaserHit > .15) e.lock = 0;
          e.lastLaserHit = this.totalTime; e.lock = Math.min(3.25, (e.lock || 0) + .075);
          this.damage(e, damage * .732 * (1 + Math.min(.65, e.lock * .2)), e.x, e.y);
        } break;
      }
      case 'dagger':
        p.fire = .095; for (const x of [-10, 10]) this.shot(0, damage * .75, 'dagger', { x: p.x + x, pierce: true, vy: -730, r: 8 }); break;
      case 'melee': {
        p.fire = .56; const reach = 156 + this.power * 8;
        this.effect('slash', { x: p.x, y: p.y, radius: reach, life: .3, color: this.hero.color, alternate: this.stats.shots++ % 2 });
        for (const e of this.enemies) if (e.y < p.y + 20 && distance(e, p) < reach + e.r) this.damage(e, damage * (e.y > p.y - 100 ? 10.8 : 7.2), e.x, e.y);
        this.bullets = this.bullets.filter(b => { if (b.y < p.y && distance(b, p) < reach * .8) { this.particlesAt(b.x, b.y, '#cdb5ff', 2); return false; } return true; });
        // A narrow moon wave keeps distant enemies reachable; close slash remains the main damage.
        this.shot(0, damage * .45, 'moon', { vy: -430, r: 15 }); break;
      }
      case 'spread':
        p.fire = .15; for (let i = -1; i <= 1; i++) { this.shot(i * .24, damage * (i === 0 ? 1.7 : 1), 'fire', { r: 9 }); if (this.power >= 3) this.shot(i * .24 + .065, damage * .45, 'fire', { r: 5 }); } break;
      case 'lance':
        p.fire = .36; this.shot(0, damage * 5.5, 'lance', { pierce: true, r: 21, vy: -500 }); break;
      case 'chain': {
        p.fire = .23; const target = this.nearest(p.x, p.y - 70, 530);
        if (target) { const hit = new Set(); let from = { x: p.x, y: p.y - 24 }, next = target;
          for (let i = 0; i < 3 + Math.floor(this.power / 2) && next; i++) {
            hit.add(next); this.effect('chain', { x: from.x, y: from.y, tx: next.x, ty: next.y, life: .19, color: '#d3faff' });
            this.damage(next, damage * (i === 0 ? 2.7 : 1.8), next.x, next.y); from = next;
            next = this.enemies.filter(e => !hit.has(e) && e.hp > 0 && distance(e, from) < 210).sort((a, b) => distance(a, from) - distance(b, from))[0];
          }
        } else { p.fire = .05; p.recoil = 0; return; } break;
      }
      case 'petal':
        p.fire = .16; for (let i = -1; i <= 1; i++) this.shot(i * .20, damage * (i === 0 ? 1.53 : .918), 'petal', { wave: i * 1.6, baseX: p.x, homing: this.power >= 3, r: 10 }); break;
      case 'frost':
        p.fire = .19; for (const x of [-12,12]) this.shot(0, damage * 1.215, 'ice', { x: p.x+x, vy: -610, pierce: true, slow: 1.6 }); break;
      case 'snowflake':
        p.fire = .24; this.shot(0, damage * 2.43, 'snow', { homing: true, bounce: 3, r: 13 }); break;
      case 'glass':
        p.fire = .23; for (const i of [-1,1]) this.shot(i * .07, damage * 2.535, 'glass', { x: p.x+i*13, pierce: true, vy: -650, r: 12 }); break;
      case 'midnight':
        p.fire = .14; this.shot(Math.sin(this.totalTime*5)*.18, damage * 1.87, 'clock', { homing: true, mark: true, r: 10 }); break;
      case 'nightfall':
        p.fire = .48; this.shot(0,damage*5.6,'nightmoon',{r:24,homing:true,vy:-360}); break;
      case 'dreamfield':
        p.fire = .18; this.shot(0,damage*.95,'nightstar',{r:7,vy:-620});
        if (this.totalTime >= this.areaFire) {
          this.areaFire = this.totalTime + 1.15;
          this.shot(0,damage*.9,'seed',{r:14,vy:-400,homing:true,zone:true,zoneDamage:damage*.70,fuse:1.45});
        } break;
      case 'promise':
        p.fire = .20;
        for (const side of [-1,1]) this.shot(side*.12,damage*1.95,'promise',{x:p.x+side*20,homing:true,r:10,echo:true});
        break;
      case 'haven':
        p.fire = .42; this.shot(0,damage*1.8,'promise',{r:16,homing:true,zone:true,zoneDamage:damage*2.1,fuse:1,zoneKind:'haven'}); break;
      case 'rewind':
        p.fire = .25;
        for (const side of [-1,1]) this.shot(side*.045,damage*1.9,'timehand',{x:p.x+side*12,pierce:true,r:11,vy:-650});
        break;
      case 'orbit': {
        p.fire = .12;
        for (const orb of this.orbitCenters()) for (const e of [...this.enemies]) {
          if (distance(orb,e) < e.r+42) this.damage(e,damage*6.2,e.x,e.y);
        }
        break;
      }
    }
    this.emit('shot', { weapon: this.weapon });
  }
  orbitCenters() {
    return [0,Math.PI].map(offset => {
      const a=this.totalTime*2.8+offset;
      return {x:this.player.x+Math.cos(a)*100,y:this.player.y-68+Math.sin(a)*74};
    });
  }
  plantZone(s) {
    if (!s.zone) return;
    s.zone=false;
    // Refresh a sanctuary instead of stacking its damage indefinitely.
    const kind=s.zoneKind || 'night', existing=this.zones.find(z=>z.kind===kind && distance(z,s)<60);
    if (existing) { existing.life=3; existing.x=s.x; existing.y=s.y; return; }
    this.add('zones',{x:s.x,y:s.y,r:kind==='haven'?100:90,damage:s.zoneDamage,kind,life:3,tick:0},8);
    this.effect('burst',{x:s.x,y:s.y,radius:90,life:.5,color:this.hero.color});
  }
  damage(enemy, amount, x, y) {
    if (enemy.hp <= 0 || (enemy.boss && this.phase !== 'boss')) return;
    const artifactAttack = this.attackBonus - 1
      + (this.artifacts.has('pendant') && this.power === 5 ? .2 : 0)
      + (this.artifacts.has('dragon') && this.player.lives === 1 ? .4 : 0)
      + (this.artifacts.has('chocolate') && (enemy.boss || enemy.miniboss) ? .5 : 0);
    amount *= 1 + artifactAttack;
    enemy.hp -= amount; enemy.flash = .07; this.stats.damage += amount; this.stats.hits++;
    if (this.random() < .2) this.particlesAt(x, y, this.hero.color, 2);
    if (enemy.hp > 0) return;
    this.kills++; this.combo++; this.comboTime = 3.6; this.bestCombo = Math.max(this.bestCombo, this.combo);
    const points = (enemy.boss ? 15000 : enemy.elite ? 600 : 100) * this.multiplier;
    this.score += Math.round(points); this.particlesAt(x, y, enemy.boss ? '#fff3cf' : this.stage.color, enemy.boss ? 70 : 15, enemy.boss ? 2.5 : 1);
    this.effect('burst', { x, y, radius: enemy.boss ? 180 : 38, life: enemy.boss ? 1.6 : .4, color: this.stage.color });
    this.emit('kill', { boss: !!enemy.boss, x, y, points });
    if (enemy.boss) {
      this.stats.bossKills++; this.bossDefeated = true; this.phase = 'clear'; this.phaseTime = 0;
      this.score += this.player.lives * 1000; this.clearBullets(true); this.hazards.length = 0;
      for (const e of this.enemies) e.hp = 0;
      this.emit('bossDefeated', { stage: this.stageIndex });
    } else {
      this.specialDeath(enemy);
      if (enemy.miniboss) this.emit('sentinelDefeated');
      this.drop(x, y, 'score');
      if (this.kills % 4 === 0 || enemy.elite) this.drop(x + 12, y, 'power');
      if (this.kills % 37 === 0) this.drop(x - 12, y, 'life');
    }
  }
  get multiplier() { return 1 + Math.min(4, Math.floor(this.combo / 10)); }
  drop(x, y, type) { this.add('pickups', { x, y, type, age: 0, vx: (this.random() - .5) * 45 }, LIMITS.pickups); }
  clearBullets(reward = false) {
    if (reward) this.score += this.bullets.length * 8;
    for (let i = 0; i < this.bullets.length; i += 5) this.particlesAt(this.bullets[i].x, this.bullets[i].y, this.hero.color, 2);
    this.bullets.length = 0;
  }
  bomb() {
    if (!['wave', 'boss', 'warning'].includes(this.phase) || this.bombTime > 0) return false;
    let paidWithLife = false;
    if (this.bombs > 0) this.bombs--;
    else if (this.artifacts.has('mask') && this.player.lives > 1 && this.maskUses < 3) {
      this.player.lives--; this.maskUses++; paidWithLife = true;
    }
    else return false;
    this.stats.bombs++; this.bombTime = this.heroIndex === 8 ? 10 : this.heroIndex === 1 ? 4 : 5; this.bombDuration = this.bombTime; this.bombPulse = 0;
    this.player.invincible = Math.max(this.player.invincible, this.heroIndex === 8 ? 2.5 : this.bombTime); this.clearBullets(true); this.hazards.length = 0;
    if (this.heroIndex === 3 && !paidWithLife) this.player.lives = Math.min(this.maxLife, this.player.lives + 1);
    for (const e of [...this.enemies]) this.damage(e, (this.heroIndex === 8 ? 80 : this.heroIndex === 2 ? 450 : 260) * this.loadout.bomb, e.x, e.y);
    this.emit('bomb', { hero: this.heroIndex }); return true;
  }
  hitPlayer() {
    const p = this.player; if (p.invincible > 0 || this.finished || !['wave', 'boss'].includes(this.phase)) return false;
    if (this.artifacts.has('shield') && this.bombs > 0) this.bombs--; else p.lives--;
    this.stats.deaths++; p.invincible = this.artifacts.has('cloak') ? 4 : 2.5; this.combo = 0; this.comboTime = 0;
    this.power = Math.max(1, this.power - 1); this.clearBullets(); this.particlesAt(p.x, p.y, '#fff', 30); this.emit('hurt');
    if (p.lives <= 0) { this.phase = 'defeat'; this.finished = true; this.emit('defeat'); } return true;
  }
  enemyBullet(x, y, angle, speed, options = {}) {
    const relaxed = this.difficulty.speed;
    this.add('bullets', { x, y, vx: Math.cos(angle) * speed * relaxed, vy: Math.sin(angle) * speed * relaxed, r: 5, age: 0, color: this.stage.color, shape: 'orb', ...options }, LIMITS.bullets);
  }
  fan(x, y, count, speed, spread, aim = Math.PI / 2, opts = {}) {
    for (let i = 0; i < count; i++) this.enemyBullet(x, y, aim + (i - (count - 1) / 2) * spread, speed, opts);
  }
  spawnWave() {
    const n = this.wave++, type = n % 5, stage = this.stageIndex;
    if (type === 4) {
      this.spawnEnemy(225, -55, { elite: true, r: 29, hp: 220 + stage * 65, speed: 42, move: 'sentry', fire: 1.7, image: (stage + 1) % 4 });
    } else {
      const count = type === 2 ? 4 : 5;
      for (let i = 0; i < count; i++) {
        const left = n % 2 === 0;
        this.spawnEnemy(type === 0 ? 55 + i * 85 : left ? 65 + i * 20 : 385 - i * 20, -40 - i * 38,
          { hp: 38 + stage * 10, speed: 68 + stage * 8 + (type === 3 ? 25 : 0), move: type === 0 ? 'drift' : type === 1 ? 'curve' : type === 2 ? 'zigzag' : 'dive', side: left ? 1 : -1, fire: 1.8 + i * .25, image: stage, r: 19 });
      }
    }
    if (n % 3 === 1) this.spawnEnemy(70 + this.random()*310, -65, { special: stage, r: 25, hp: 115 + stage*35, speed: 53, move: 'sentry', fire: 2, image: stage, countdown: 4.5 });
    this.emit('wave', { wave: n });
  }
  spawnEnemy(x, y, data) {
    const hp = data.hp * this.difficulty.hp * (1 + this.room*.12) * (data.elite || data.miniboss ? 1.2 : 1);
    this.add('enemies', { x, y, ox: x, age: 0, flash: 0, ...data, hp, maxHp: hp }, LIMITS.enemies);
  }
  specialDeath(e) {
    if (e.special === 0) this.effect('detonation', { x: e.x, y: e.y, radius: 82, life: 1.05, fired: false, color: '#ffb574' });
    if (e.special === 1) for (const side of [-1,0,1]) this.spawnEnemy(clamp(e.x+side*22,25,425),e.y, { hp: 16, r: 12, speed: 170, move: 'curve', side, fire: .65, image: 1, offspring: true });
  }
  spawnSentinel() {
    this.sentinelSpawned = true; this.clearBullets();
    this.spawnEnemy(225, -80, { miniboss: true, elite: true, hp: 1150 + this.stageIndex*340, r: 38, speed: 65, move: 'sentry', fire: 1.8, image: this.stageIndex });
    this.emit('sentinel', { name: this.dungeon.sentinel });
  }
  sentinelAttack(e) {
    const aim = Math.atan2(this.player.y-e.y,this.player.x-e.x);
    if (this.stageIndex === 0) { this.fan(e.x,e.y,7,120,.18,aim); this.addHazard(clamp(this.player.x,45,405),24); }
    if (this.stageIndex === 1) for (const side of [-1,1]) this.fan(e.x+side*40,e.y,5,112,.2,Math.PI/2+side*Math.sin(e.age)*.6,{shape:'heart'});
    if (this.stageIndex === 2) for(let i=0;i<16;i++) this.enemyBullet(e.x,e.y,i*TAU/16+e.age*.3,118,{shape:'diamond'});
    if (this.stageIndex === 3) this.fan(e.x,e.y,3,62,.45,aim,{r:16,split:true,shape:'diamond'});
  }
  clearRoom() {
    if (this.phase !== 'wave') return;
    this.phase = 'clear'; this.phaseTime = 0; this.clearBullets(true); this.hazards.length = this.enemies.length = this.effects.length = 0;
    this.score += this.player.lives * 700; this.emit('roomClear', {room:this.room});
  }
  spawnBoss() {
    this.enemies.length = 0; this.clearBullets(); this.hazards.length = 0;
    const hp = this.stage.hp * this.difficulty.hp * .78 * 1.2;
    this.boss = { boss: true, x: 225, y: -100, age: 0, hp, maxHp: hp, r: 42, flash: 0, fire: 1.5, image: this.stageIndex };
    this.enemies.push(this.boss); this.phase = 'warning'; this.phaseTime = 0; this.emit('warning');
  }
  bossAttack(dt) {
    const b = this.boss; if (!b || b.hp <= 0) return;
    const phase = b.hp / b.maxHp > .67 ? 0 : b.hp / b.maxHp > .34 ? 1 : 2;
    if (phase !== this.bossPattern) { this.bossPattern = phase; this.clearBullets(); this.hazards.length = 0; b.fire = 1.2; this.emit('pattern', { phase, name: this.stage.pattern[phase] }); }
    this.bossClock += dt; b.fire -= dt; if (b.fire > 0) return;
    const aim = Math.atan2(this.player.y - b.y, this.player.x - b.x);
    const speed = 102 + this.stageIndex * 10 + phase * 12;
    const t = this.bossClock;
    switch (this.stageIndex) {
      case 0:
        b.fire = phase === 0 ? 1.05 : .8;
        if (phase === 0) this.fan(b.x, b.y + 25, 5, speed + 12, .18, aim);
        else if (phase === 1) { for (let i = 0; i < 14; i++) this.enemyBullet(b.x, b.y, i * TAU / 14 + t * .28, speed, { shape: 'diamond' }); }
        else { this.fan(b.x, b.y, 7, speed, .16, aim); this.addHazard(65 + (Math.floor(t) % 4) * 105, 28); } break;
      case 1:
        b.fire = phase === 0 ? .95 : .62;
        for (const side of [-1, 1]) this.fan(b.x + side * 43, b.y + 15, 3 + phase, speed, .19, Math.PI / 2 + Math.sin(t * .8) * side * .55, { shape: 'heart', color: '#ffa7cf', turn: side * .12 });
        if (phase === 2) this.fan(b.x, b.y, 3, speed + 35, .13, aim, { color: '#ffe9b4' }); break;
      case 2:
        b.fire = phase === 0 ? .95 : .72;
        if (phase === 1) { const gap = 50 + (Math.floor(t * .65) % 4) * 105; for (let x = 25; x < 450; x += 32) if (Math.abs(x - gap) > 43) this.enemyBullet(x, 76, Math.PI / 2, speed, { shape: 'diamond', color: '#d6adff' }); }
        else { for (let i = 0; i < 12 + phase * 3; i++) this.enemyBullet(b.x, b.y, i * TAU / (12 + phase * 3) - t * .27, speed, { turn: phase === 2 ? .24 : 0, shape: 'diamond', color: ['#e8a9ff', '#93d9ff', '#ffbfcf'][i % 3] }); }
        if (phase === 2 && Math.floor(t) % 3 === 0) this.addHazard(clamp(this.player.x, 40, 410), 30); break;
      case 3:
        b.fire = phase === 0 ? .9 : .6;
        for (const side of [-1, 1]) this.fan(b.x + side * 55, b.y + 10, 4 + phase, speed, .18, Math.PI / 2 + side * Math.sin(t) * .5, { color: side === 1 ? '#e2a3ff' : '#ffb882', shape: 'diamond' });
        if (phase > 0 && Math.floor(t * 2) % 3 === 0) this.addHazard(60 + Math.floor(this.random() * 4) * 110, phase === 2 ? 34 : 26);
        if (phase === 2) this.fan(b.x, b.y, 3, speed + 35, .16, aim); break;
    }
    this.emit('enemyShot', { boss: true });
  }
  addHazard(x, width) { if (this.hazards.length < 5) this.hazards.push({ x, width, age: 0, warn: 1.4, life: 2.25 }); }
  completeQuiz(reward = null) {
    if (this.phase !== 'quiz' || !(this.room === 2 ? [null,'score'] : [null,'life','bomb']).includes(reward)) return false;
    if (reward === 'score') { this.scoreBonus = Math.round(this.score * .1); this.score += this.scoreBonus; }
    if (reward === 'life') this.player.lives = Math.min(this.maxLife,this.player.lives+1);
    if (reward === 'bomb') this.bombs = Math.min(this.maxBombs,this.bombs+1);
    if(this.room===2){this.phase='victory';this.finished=true;this.emit('victory');return true;}
    this.startStage(this.stageIndex, this.room+1); return true;
  }
  revive(correct) {
    if (this.phase !== 'defeat' || this.reviveUsed) return false;
    this.reviveUsed = true;
    if (!correct) return false;
    this.finished = false; this.player.lives = Math.min(2,this.maxLife); this.player.invincible = 4;
    this.phase = this.boss && this.boss.hp > 0 ? 'boss' : 'wave'; this.clearBullets(); this.hazards.length = 0; this.emit('revived'); return true;
  }
  update(dt) {
    if (this.finished || this.phase === 'quiz' || dt <= 0) return;
    dt = Math.min(dt, .05); this.totalTime += dt; this.phaseTime += dt;
    const p = this.player; p.invincible = Math.max(0, p.invincible - dt); p.recoil = Math.max(0, p.recoil - dt * 8);
    const dx = p.targetX - p.x, dy = p.targetY - p.y, len = Math.hypot(dx, dy), step = Math.min(1, (this.hero.speed || 1250) * dt / Math.max(1, len));
    p.x += dx * step; p.y += dy * step; p.tilt += (clamp(dx * .008, -.25, .25) - p.tilt) * Math.min(1, dt * 14);
    if (['wave','boss'].includes(this.phase) && this.enemies.some(e => e.hp > 0 && e.y >= 0 && e.y <= this.height)) {
      this.comboTime = Math.max(0, this.comboTime - dt); if (!this.comboTime) this.combo = 0;
    }
    if (this.phase === 'intro' && this.phaseTime > 2.4) { this.phase = 'wave'; this.phaseTime = 0; }
    if (this.phase === 'wave') {
      this.time += dt; this.spawnTime -= dt;
      if (this.room === 1 && this.time > this.stage.duration*.55 && !this.sentinelSpawned) this.spawnSentinel();
      if (this.time >= this.stage.duration) {
        if (this.room === 2) this.spawnBoss();
        else if (!this.enemies.some(e=>e.miniboss && e.hp>0)) this.clearRoom();
      } else if (this.spawnTime <= 0) { this.spawnWave(); this.spawnTime = Math.max(2.5,3.8-this.stageIndex*.2) * this.difficulty.interval; }
    }
    if (this.phase === 'warning' && this.phaseTime > 3) { this.phase = 'boss'; this.phaseTime = 0; this.emit('bossStart'); }
    if (['wave', 'boss'].includes(this.phase)) this.fire(dt);
    for (const e of this.enemies) {
      if (e.hp <= 0) continue; e.slow = Math.max(0,(e.slow || 0)-dt);
      const chilled = e.slow > 0 || (this.heroIndex === 4 && this.bombTime > 0);
      e.age += dt * (chilled ? .6 : 1); e.flash = Math.max(0, e.flash - dt);
      if (e.boss) {
        const targetY = this.phase === 'warning' ? 150 : 155 + Math.sin(e.age * .65) * 26;
        e.y += (targetY - e.y) * Math.min(1, dt * 2);
        e.x = 225 + Math.sin(e.age * .6) * (this.stageIndex === 3 ? 95 : 105);
        if (this.phase === 'boss') this.bossAttack(dt * (chilled ? .7 : 1));
      } else {
        const slow = e.slow > 0 || (this.heroIndex === 4 && this.bombTime > 0) ? .48 : 1;
        e.y += e.speed * dt * slow;
        if (e.move === 'curve') e.x = clamp(e.ox + Math.sin(e.age * 1.4) * 95 * e.side, 25, 425);
        if (e.move === 'zigzag') e.x = clamp(e.ox + Math.sin(e.age * 2.3) * 55, 25, 425);
        if (e.move === 'drift') e.x = e.ox + Math.sin(e.age) * 18;
        if (e.move === 'sentry' && e.y > 155) e.y -= e.speed * dt * slow * (e.miniboss ? 1 : .85);
        if (e.special === 2 && e.y > 0) {
          e.countdown -= dt;
          if (e.countdown <= 0) { for(let i=0;i<20;i++) this.enemyBullet(e.x,e.y,i*TAU/20,145,{shape:'diamond'}); e.countdown = 4.5; this.emit('curseBurst'); }
        }
        e.fire -= dt;
        if (e.fire <= 0 && e.y > 30 && e.y < this.height * .62 && ['wave', 'boss'].includes(this.phase)) {
          const aim = Math.atan2(p.y - e.y, p.x - e.x);
          if (e.miniboss) this.sentinelAttack(e);
          else if (e.special === 3) this.enemyBullet(e.x,e.y,aim,58,{r:17,split:true,shape:'diamond'});
          else this.fan(e.x, e.y + 10, e.elite ? 5 : 1 + (this.stageIndex >= 2 ? 2 : 0), 105 + this.stageIndex * 14, .17, aim, { color: e.elite ? '#ffc184' : this.stage.color });
          e.fire = (e.elite ? 1.5 : 2.9) * this.difficulty.interval;
        }
      }
      if (distance(e, p) < e.r + p.radius) this.hitPlayer();
      if(this.finished)return;
    }
    this.enemies = this.enemies.filter(e => e.hp > 0 && e.y < this.height + 70);
    for (const s of this.shots) {
      s.life -= dt;
      if (s.fuse !== undefined) { s.fuse-=dt; if(s.fuse<=0) {this.plantZone(s);s.life=0;continue;} }
      if (s.homing) { const e = this.nearest(s.x, s.y, 700); if (e) { const d = Math.max(1, distance(e, s)), turn = Math.min(1, dt * 6); s.vx += ((e.x - s.x) / d * 520 - s.vx) * turn; s.vy += ((e.y - s.y) / d * 520 - s.vy) * turn; } }
      s.x += s.vx * dt; s.y += s.vy * dt; if (s.wave) s.x += Math.sin(s.life * 10) * s.wave;
      for (const e of this.enemies) {
        if (e.hp <= 0 || s.hit.has(e) || (e.boss && this.phase !== 'boss')) continue;
        if (distance(s, e) < e.r + s.r) {
          s.hit.add(e); this.damage(e, s.damage, s.x, s.y);
          if (s.zone) this.plantZone(s);
          if (s.echo) {
            this.effect('burst',{x:e.x,y:e.y,radius:66,life:.3,color:'#f8dfef'});
            for (const other of [...this.enemies]) if(other!==e && distance(e,other)<80) this.damage(other,s.damage*.3,other.x,other.y);
          }
          if (s.slow) e.slow = s.slow;
          if (s.mark && e.hp > 0) { e.marks = (e.marks || 0)+1; if(e.marks >= 3) {e.marks=0;this.effect('burst',{x:e.x,y:e.y,radius:90,life:.45,color:'#ffc4e3'});for(const target of [...this.enemies]) if(distance(e,target)<100) this.damage(target,s.damage*2.5,target.x,target.y);} }
          if (s.bounce > 0) { const next=this.enemies.find(t=>t.hp>0&&!s.hit.has(t)&&distance(e,t)<300); if(next) {s.bounce--; const d=Math.max(1,distance(s,next));s.vx=(next.x-s.x)/d*560;s.vy=(next.y-s.y)/d*560;s.homing=false;break;} }
          if (!s.pierce) { s.life = 0; break; } if (s.type === 'lance') this.effect('burst', { x: e.x, y: e.y, radius: 40, life: .3, color: '#ffb66a' });
        }
      }
    }
    this.shots = this.shots.filter(s => s.life > 0 && s.y > -70 && s.y < this.height + 30 && s.x > -80 && s.x < 530);
    for (const z of this.zones) {
      z.life-=dt; z.tick-=dt;
      if (z.tick<=0 && ['wave','boss'].includes(this.phase)) {
        z.tick+=.15;
        for(const e of [...this.enemies]) if(distance(z,e)<z.r+e.r) this.damage(e,z.damage,e.x,e.y);
      }
    }
    this.zones=this.zones.filter(z=>z.life>0);
    for (const b of this.bullets) {
      b.age += dt; if (b.turn) { const a = b.turn * dt, c = Math.cos(a), s = Math.sin(a), vx = b.vx; b.vx = vx * c - b.vy * s; b.vy = vx * s + b.vy * c; }
      const bulletSlow = this.heroIndex === 4 && this.bombTime > 0 ? .35 : 1;
      b.x += b.vx * dt * bulletSlow; b.y += b.vy * dt * bulletSlow;
      const d = distance(b, p);
      if (b.split && (d < 155 || b.age > 3.7)) { b.dead = true; b.split = false; this.fan(b.x,b.y,9,125,TAU/9,Math.PI/2,{r:4}); this.effect('burst',{x:b.x,y:b.y,radius:35,life:.3,color:this.stage.color}); continue; }
      if (d < b.r + p.radius && p.invincible <= 0) { b.dead = true; this.hitPlayer(); }
      else if (d < 24 && !b.grazed && p.invincible <= 0) { b.grazed = true; this.graze++; this.score += 25 * this.multiplier; this.emit('graze'); }
      if(this.finished)return;
      if (this.weapon === 'petal' && d < 28 && Math.sin(this.totalTime * 2) > .97) { b.dead = true; this.particlesAt(b.x, b.y, '#f7dfaa', 2); }
    }
    this.bullets = this.bullets.filter(b => !b.dead && b.age < 14 && b.y < this.height + 25 && b.y > -150 && b.x > -80 && b.x < 530);
    this.stats.maxBullets = Math.max(this.stats.maxBullets, this.bullets.length);
    for (const h of this.hazards) { h.age += dt; if (h.age > h.warn && Math.abs(p.x - h.x) < h.width / 2 + p.radius) this.hitPlayer(); }
    if(this.finished)return;
    this.hazards = this.hazards.filter(h => h.age < h.life);
    for (const d of this.pickups) {
      d.age += dt; const dist = distance(d, p), magnet = dist < 125 + (this.artifacts.has('magnet') ? 300 : 0) || p.y < this.height * .32 || this.phase === 'clear';
      if (magnet) { const speed = Math.min(1, 420 * dt / Math.max(1, dist)); d.x += (p.x - d.x) * speed; d.y += (p.y - d.y) * speed; }
      else { d.y += 48 * dt; d.x += d.vx * dt * Math.exp(-d.age); }
      if (distance(d, p) < 24) { d.dead = true; this.collect(d.type); }
    }
    this.pickups = this.pickups.filter(d => !d.dead && d.y < this.height + 20);
    if (this.bombTime > 0) {
      this.bombTime = Math.max(0, this.bombTime - dt); this.bombPulse -= dt;
      if (this.bombPulse <= 0 && this.heroIndex !== 8) {
        this.bombPulse = .25; this.clearBullets(true);
        for (const e of [...this.enemies]) { this.damage(e, (this.heroIndex === 1 ? 65 : this.heroIndex === 3 ? 27 : this.heroIndex === 5 ? 55 : 42) * this.loadout.bomb, e.x, e.y); this.effect(this.heroIndex === 1 ? 'slash' : 'burst', { x: e.x, y: e.y + 30, radius: 64, life: .3, color: this.hero.color }); }
      }
    }
    if (this.artifacts.has('leaf') && ['wave','boss'].includes(this.phase)) {
      this.fairyFire -= dt; if(this.fairyFire<=0) {this.fairyFire=.3;this.shot(0,12,'star',{x:p.x+Math.cos(this.totalTime*2)*44,y:p.y-20,homing:true,r:5});}
    }
    for (const q of this.particles) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= .97; q.vy *= .97; }
    this.particles = this.particles.filter(q => q.life > 0);
    for (const f of this.effects) {
      f.age += dt;
      if(f.type==='detonation' && !f.fired && f.age>.75) {f.fired=true;this.fan(f.x,f.y,10,115,TAU/10);if(distance(f,p)<f.radius)this.hitPlayer();}
    }
    this.effects = this.effects.filter(f => f.age < f.life);
    if (this.phase === 'clear' && this.phaseTime > 3.4) {
      this.phase = 'quiz'; this.emit('quiz', { kind: ['vocab','collocation','grammar'][this.room] });
    }
  }
  collect(type) {
    if (type === 'power') { if (this.power < 5 && ++this.powerPoints >= 3) { this.power++; this.powerPoints = 0; this.emit('powerup'); } else if (this.power >= 5) this.score += 250; }
    if (type === 'life') { this.player.lives = Math.min(this.maxLife, this.player.lives + 1); this.emit('heal'); }
    if (type === 'score') this.score += 50 * this.multiplier;
    this.emit('pickup', { item: type });
  }
}
