import { HEROES, STAGES, DUNGEONS, LIMITS, clamp } from './content.js';
import { ARTIFACTS, DIFFICULTIES, loadoutStats } from './meta.js';
const TAU = Math.PI * 2;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const BOMB_DURATIONS = [4,2,3,3,3,3,3,3,10];
const BOMB_INVULNERABILITY = [4,2,3,3,3,3,3,3,2];
const DUNGEON_ENEMY_SCALE = [1.12,1.16,1.20,1.25,1.30,1.35,1.55];
export class Game {
  constructor({ hero = 0, weapon = 0, stage = 0, height = 900, seed = 41, mode = 'normal', artifacts = [], challenge = false, onEvent = () => {} } = {}) {
    this.challenge = challenge; this.pendingArtifacts = null; this.celestialWave = 0;
    this.hero = HEROES[hero]; this.heroIndex = hero; this.weaponIndex = weapon; this.weapon = this.hero.weapons[weapon].id;
    this.width = 450; this.height = height; this.seed = seed; this.mode = mode; this.onEvent = onEvent;
    this.difficulty = DIFFICULTIES.find(d => d.id === mode) || DIFFICULTIES[1];
    this.loadout = loadoutStats(artifacts, this.difficulty.id); this.artifacts = new Set(this.loadout.ids);
    this.maxLife = this.loadout.maxLife + (this.hero.lifeBonus || 0); this.maxBombs = this.loadout.maxBombs + (this.hero.bombBonus || 0); this.room = 0; this.reviveUsed = false; this.fairyFire = 0; this.darkFairyFire = 0; this.maskUses = 0;
    this.player = { x: 225, y: height * .78, targetX: 225, targetY: height * .78, radius: Math.max(1,(this.hero.radius || 5)+this.loadout.radius), lives: this.loadout.lives + (this.hero.lifeBonus || 0), barrier: this.artifacts.has('clover'), invincible: 2.5, fire: 0, tilt: 0, recoil: 0 };
    this.score = 0; this.bestCombo = 0; this.combo = 0; this.comboTime = 0; this.graze = 0; this.kills = 0;
    this.power = this.artifacts.has('origin') ? 2 : 1; this.powerPoints = 0; this.bombs = Math.min(this.maxBombs,this.loadout.bombs + (this.hero.bombBonus || 0)); this.attackBonus = this.loadout.attack; this.bombTime = 0; this.bombPulse = 0;
    this.comboDuration = this.artifacts.has('hourglass') ? 5.6 : 3.6;
    this.powerRequirement = ([0,7].includes(this.heroIndex) ? 4 : 3) - (this.artifacts.has('dew') ? 1 : 0);
    this.time = 0; this.totalTime = 0; this.phase = 'intro'; this.phaseTime = 0; this.finished = false;
    this.zones = []; this.areaFire = 0; this.scoreBonus = 0; this.rankBonus = 0; this.timeBonus = 0; this.bonusesFinalized = false; this.shots = []; this.bullets = []; this.enemies = []; this.particles = []; this.pickups = []; this.effects = []; this.hazards = [];
    this.stats = { shots: 0, hits: 0, damage: 0, bombs: 0, maxBullets: 0, bossKills: 0, deaths: 0 };
    if(challenge) {
      if(this.artifacts.has('resurgence'))this.player.lives=this.maxLife;
      if(this.artifacts.has('miracle'))this.bombs=Math.min(this.maxBombs,this.bombs+3);
    }
    this.startStage(challenge ? 0 : stage);
  }
  random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  emit(type, data = {}) { this.onEvent({ type, ...data }); }
  startStage(index, room = 0) {
    this.stageIndex = index; this.room = room; this.dungeon = DUNGEONS[index];
    this.level = this.dungeon.event ? 5.35 : index;
    this.stage = { ...STAGES[index], name: this.dungeon.rooms[room], duration: 25 + this.level * 3 + room * 5 };
    this.time = 0; this.phase = 'intro'; this.phaseTime = 0;
    this.spawnTime = 0; this.wave = 0; this.boss = null; this.bossDefeated = false; this.bossPattern = -1; this.bossClock = 0; this.bossElapsed = 0; this.bossClearTime = Infinity;
    this.sentinelSpawned = false;
    this.enemies.length = this.bullets.length = this.shots.length = this.hazards.length = this.pickups.length = 0;
    this.player.x = this.player.targetX = 225; this.player.y = this.player.targetY = this.height * .79;
    this.zones.length = 0; this.areaFire = 0; this.effects.length = this.particles.length = 0; this.player.fire = 0; this.bombTime = 0;
    this.pendingArtifacts = null; this.celestialWave = 0;
    if(this.artifacts.has('blessing'))this.player.barrier=true;
    this.frostTime = 0; this.orbitHits = [new WeakMap(),new WeakMap()]; this.orbitPrevious = null; this.roomRecovered = false;
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
    const boost = this.heroIndex === 2 && !this.artifacts.has('sun') && this.bombTime > 0 ? 1.75 : 1;
    const damage = (10 + this.power * 2.5) * boost * (this.heroIndex === 2 ? 1.1 : 1);
    p.recoil = 1;
    if (this.heroIndex === 8 && !this.artifacts.has('sun') && this.bombTime > 0) {
      p.fire = .16;
      for (const side of [-1,1]) this.shot(side*.055, damage*3.8*this.loadout.bomb, 'darkglass', { x:p.x+side*14, r:17, pierce:true, vy:-700, damageKind:'bomb' });
      this.emit('shot', { weapon:'darkglass' }); return;
    }
    switch (this.weapon) {
      case 'homing':
        p.fire = .14; for (let i = 0; i < 2 + Math.floor(this.power / 2); i++) this.shot((i - (1 + Math.floor(this.power / 2)) / 2) * .24, damage * .698544, 'star', { homing: true, r: 7, speed: 520 }); break;
      case 'laser': {
        p.fire += .075; const width = 13 + this.power * 3;
        for (const e of this.enemies) if (e.y < p.y && Math.abs(e.x - p.x) < e.r + width / 2) {
          if (e.lastLaserHit === undefined || this.totalTime - e.lastLaserHit > .15) e.lock = 0;
          e.lastLaserHit = this.totalTime; e.lock = Math.min(3.25, (e.lock || 0) + .075);
          this.damage(e, damage * .989664 * (1 + Math.min(.65, e.lock * .2)), e.x, e.y);
        } break;
      }
      case 'dagger':
        p.fire = .095; for (const x of [-10, 10]) this.shot(0, damage * .85833, 'dagger', { x: p.x + x, pierce: true, vy: -730, r: 8 }); break;
      case 'melee': {
        p.fire = .70; const reach = 156 + this.power * 8;
        this.effect('slash', { x: p.x, y: p.y, radius: reach, life: .3, color: this.hero.color, alternate: this.stats.shots++ % 2 });
        for (const e of this.enemies) if (e.y < p.y + 20 && distance(e, p) < reach + e.r) this.damage(e, damage * (e.y > p.y - 100 ? 13.77 : 9.18), e.x, e.y);
        this.bullets = this.bullets.filter(b => { if (b.y < p.y && distance(b, p) < reach * .72) { this.particlesAt(b.x, b.y, '#cdb5ff', 2); return false; } return true; });
        // A narrow moon wave keeps distant enemies reachable; close slash remains the main damage.
        this.shot(0, damage * .57375, 'moon', { vy: -430, r: 15 }); break;
      }
      case 'spread':
        p.fire = .15; for (let i = -1; i <= 1; i++) { this.shot(i * .24, damage * (i === 0 ? 1.76868 : 1.0404), 'fire', { r: 9 }); if (this.power >= 3) this.shot(i * .24 + .065, damage * .46818, 'fire', { r: 5 }); } break;
      case 'lance':
        p.fire = .36; this.shot(0, damage * 6.067215, 'lance', { pierce: true, r: 21, vy: -500 }); break;
      case 'chain': {
        p.fire = .23; const target = this.nearest(p.x, p.y - 70, 530);
        if (target) { const hit = new Set(); let from = { x: p.x, y: p.y - 24 }, next = target;
          for (let i = 0; i < 3 + Math.floor(this.power / 2) && next; i++) {
            hit.add(next); this.effect('chain', { x: from.x, y: from.y, tx: next.x, ty: next.y, life: .19, color: '#d3faff' });
            this.damage(next, damage * (i === 0 ? 2.646 : 1.764), next.x, next.y); from = next;
            next = this.enemies.filter(e => !hit.has(e) && e.hp > 0 && distance(e, from) < 210).sort((a, b) => distance(a, from) - distance(b, from))[0];
          }
        } else { p.fire = .05; p.recoil = 0; return; } break;
      }
      case 'petal':
        p.fire = .16; for (let i = -1; i <= 1; i++) this.shot(i * .20, damage * (i === 0 ? 1.4841 : .89046), 'petal', { wave: i * 1.6, baseX: p.x, homing: this.power >= 5, r: 10 }); break;
      case 'frost':
        p.fire = .19; for (const x of [-12,12]) this.shot(0, damage * 1.36323, 'ice', { x: p.x+x, vy: -610, pierce: true, slow: this.power===5?2:1.6 }); break;
      case 'snowflake':
        p.fire = .24; this.shot(0, damage * 2.3814, 'snow', { homing: true, bounce: this.power===5?4:3, r: 13 }); break;
      case 'glass':
        p.fire = .23; for (const i of [-1,1]) this.shot(i * .07, damage * 2.84427, 'glass', { x: p.x+i*(this.power===5?16:13), pierce: true, vy: -650, r: 12*(this.power===5?1.1:1) }); break;
      case 'midnight':
        p.fire = .14; this.shot(Math.sin(this.totalTime*5)*.18, damage * 1.8326, 'clock', { homing: true, mark: true, markRadius: this.power===5?120:100, r: 10 }); break;
      case 'nightfall':
        p.fire = .48; this.shot(0,damage*7.53984,'nightmoon',{r:28.8+(this.power===5?10:0),vy:-360}); break;
      case 'dreamfield':
        p.fire = .18; this.shot(0,damage*.931,'nightstar',{r:7,vy:-620});
        if (this.totalTime >= this.areaFire) {
          this.areaFire = this.totalTime + 1.15;
          this.shot(0,damage*.882,'seed',{r:14,vy:-400,homing:true,zone:true,zoneDamage:damage*.686,zoneRadius:this.power===5?100:90,fuse:1.45});
        } break;
      case 'promise':
        p.fire = .20;
        for (const side of [-1,1]) this.shot(side*.12,damage*2.06388,'promise',{x:p.x+side*20,homing:true,r:10,echo:true,echoRadius:this.power===5?96:80});
        break;
      case 'haven':
        p.fire = .42; this.shot(0,damage*1.90512,'promise',{r:16,homing:true,zone:true,zoneDamage:damage*2.22264,zoneRadius:this.power===5?110:100,fuse:1,zoneKind:'haven'}); break;
      case 'rewind':
        p.fire = .25;
        for (const side of [-1,1]) this.shot(side*.045,damage*2.174436,'timehand',{x:p.x+side*12,pierce:true,r:11,vy:-650});
        break;
      case 'orbit': {
        p.fire = .12;
        // Persistent orbit collision is checked every simulation frame below.
        break;
      }
    }
    this.emit('shot', { weapon: this.weapon });
  }
  orbitCenters() {
    return [0,Math.PI].map(offset => {
      const a=this.totalTime*2.8+offset;
      return {x:this.player.x+Math.cos(a)*115,y:this.player.y-68+Math.sin(a)*85.1};
    });
  }
  updateOrbit(previous) {
    if(this.weapon!=='orbit' || !['wave','boss'].includes(this.phase) || (this.bombTime>0&&!this.artifacts.has('sun')))return;
    const centers=this.orbitCenters();
    centers.forEach((orb,i)=>{
      const from=previous[i],hits=this.orbitHits[i];
      for(const e of [...this.enemies]) {
        if(e.hp<=0 || (hits.get(e)||0)>this.totalTime+1e-9)continue;
        // Sweep relative motion as well as the visible endpoints: fast drags cannot tunnel.
        const ax=from.x-(e.prevX??e.x),ay=from.y-(e.prevY??e.y);
        const bx=orb.x-e.x,by=orb.y-e.y,dx=bx-ax,dy=by-ay;
        const q=clamp(-(ax*dx+ay*dy)/(dx*dx+dy*dy||1),0,1);
        if(Math.hypot(ax+dx*q,ay+dy*q)<e.r+50.4) {
          hits.set(e,this.totalTime+.12);
          this.damage(e,(10+this.power*2.5)*7.44,e.x,e.y);
        }
      }
    });
  }
  plantZone(s) {
    if (!s.zone) return;
    s.zone=false;
    // Refresh a sanctuary instead of stacking its damage indefinitely.
    const kind=s.zoneKind || 'night', existing=this.zones.find(z=>z.kind===kind && distance(z,s)<60);
    const radius=s.zoneRadius ?? (kind==='haven'?100:90);
    if (existing) { existing.life=3; existing.x=s.x; existing.y=s.y; existing.r=radius; existing.damage=s.zoneDamage; return; }
    this.add('zones',{x:s.x,y:s.y,r:radius,damage:s.zoneDamage,kind,life:3,tick:0},8);
    this.effect('burst',{x:s.x,y:s.y,radius,life:.5,color:this.hero.color});
  }
  damage(enemy, amount, x, y, kind = 'attack') {
    if (enemy.hp <= 0 || enemy.spawnInvincible > 0 || (enemy.boss && this.phase !== 'boss')) return;
    const artifactAttack = this.attackBonus - 1
      + (this.artifacts.has('pendant') && this.power === 5 ? .2 : 0)
      + (this.artifacts.has('dragon') && this.player.lives === 1 ? .5 : 0)
      + (this.artifacts.has('chocolate') && (enemy.boss || enemy.miniboss) ? .5 : 0)
      + (this.artifacts.has('witch') && !enemy.boss && !enemy.miniboss && !enemy.elite ? .2 : 0)
      + (this.artifacts.has('silver') && (enemy.elite || enemy.miniboss) ? .3 : 0)
      + (this.artifacts.has('eye') && this.bombs === 0 ? .3 : 0)
      + (this.artifacts.has('startboost') && this.power === 1 ? .5 : 0)
      + (this.artifacts.has('starpowder') && this.player.barrier ? .2 : 0)
      + (kind === 'attack' ? this.loadout.normalAttack : 0);
    amount *= 1 + artifactAttack;
    enemy.hp -= amount; enemy.flash = .07; this.stats.damage += amount; this.stats.hits++;
    if (this.random() < .2) this.particlesAt(x, y, this.hero.color, 2);
    if (enemy.hp > 0) return;
    this.kills++;
    if (!enemy.boss) { this.combo++; this.comboTime = this.comboDuration; this.bestCombo = Math.max(this.bestCombo, this.combo); }
    const points = enemy.boss ? 15000 : (enemy.elite ? 600 : 100) * this.multiplier;
    this.score += Math.round(points); this.particlesAt(x, y, enemy.boss ? '#fff3cf' : this.stage.color, enemy.boss ? 70 : 15, enemy.boss ? 2.5 : 1);
    this.effect('burst', { x, y, radius: enemy.boss ? 180 : 38, life: enemy.boss ? 1.6 : .4, color: this.stage.color });
    this.emit('kill', { boss: !!enemy.boss, x, y, points });
    if (enemy.boss) {
      this.recoverRoom(); this.stats.bossKills++; this.bossDefeated = true; this.bossClearTime = this.bossElapsed; this.phase = 'clear'; this.phaseTime = 0;
      if (this.challenge) this.awardBossTimeBonus(); this.clearBullets(); this.hazards.length = 0;
      for (const e of this.enemies) e.hp = 0;
      this.emit('bossDefeated', { stage: this.stageIndex });
    } else {
      this.specialDeath(enemy);
      if (enemy.miniboss) this.emit('sentinelDefeated');
      this.drop(x, y, 'score');
      const ordinary = !enemy.elite && !enemy.miniboss;
      if ((this.challenge && ordinary) ? this.random()<.2 : (this.kills % 4 === 0 || enemy.elite) && this.random()<.9) this.drop(x + 12, y, 'power');
      if (this.kills % 37 === 0 && !this.artifacts.has('cursedsword')) this.drop(x - 12, y, 'life');
    }
  }
  get multiplier() { return ['warning','boss'].includes(this.phase) ? 1 : 1 + Math.min(4, Math.floor(this.combo / 10)); }
  get rank() { return this.challenge ? (this.stats.deaths <= 5 ? 'S' : this.stats.deaths <= 15 ? 'A' : 'B') : (this.stats.deaths === 0 ? 'S' : this.stats.deaths < 4 ? 'A' : 'B'); }
  bossTimeScore(seconds) { return seconds <= 20 ? 15000 : seconds <= 30 ? 10000 : seconds <= 40 ? 5000 : 0; }
  awardBossTimeBonus() {
    const bonus = this.bossTimeScore(this.bossClearTime);
    this.timeBonus += bonus; this.score += bonus;
  }
  drop(x, y, type) { this.add('pickups', { x, y, type, age: 0, vx: (this.random() - .5) * 45 }, LIMITS.pickups); }
  clearBullets() {
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
    const corona=this.artifacts.has('sun');
    this.stats.bombs++; this.bombTime = corona ? 1 : BOMB_DURATIONS[this.heroIndex];
    this.bombDuration=this.bombTime;this.bombElapsed=0;this.bombTicks=0;
    this.bombInvincibility = corona ? 1 : BOMB_INVULNERABILITY[this.heroIndex];
    const pulse=this.heroIndex===1?65:this.heroIndex===3?27:this.heroIndex===5?55:42;
    // Measured against the previous release at the game's fixed 60 Hz simulation:
    // Luna applied 16 pulses; the five-second ultimates applied 19, not 20.
    this.bombDamagePool=corona||this.heroIndex===8?0:this.heroIndex===6?1640:pulse*(this.heroIndex===1?16:19);
    this.player.invincible = Math.max(this.player.invincible, this.bombInvincibility); this.clearBullets(true); this.hazards.length = 0;
    if (!corona && this.heroIndex === 3 && !paidWithLife) this.player.lives = Math.min(this.maxLife, this.player.lives + 1);
    if(!corona&&this.heroIndex===4)this.frostTime=this.bombDuration+5;
    if(!corona&&this.heroIndex===6){this.power=Math.max(1,this.power-1);this.powerPoints=0;}
    for (const e of [...this.enemies]) this.damage(e, (corona?2000:this.heroIndex === 8 ? 80 : this.heroIndex === 2 ? 450 : 260) * this.loadout.bomb, e.x, e.y, 'bomb');
    this.emit('bomb', { hero: this.heroIndex, corona }); return true;
  }
  grantBarrier() {
    if (this.player.barrier) return false;
    this.player.barrier = true; this.emit('barrier'); return true;
  }
  hitPlayer() {
    const p = this.player; if (p.invincible > 0 || this.finished || !['wave', 'boss'].includes(this.phase)) return false;
    if (p.barrier) {
      p.barrier = false; p.invincible = this.artifacts.has('cloak') ? 4 : 2.5;
      this.effect('barrierBreak', {x:p.x,y:p.y,radius:48,life:.45,color:'#8cefff'});
      this.particlesAt(p.x,p.y,'#a9f5ff',12); this.emit('barrierBreak'); return true;
    }
    if (this.artifacts.has('shield') && this.bombs > 0) this.bombs--; else p.lives--;
    this.stats.deaths++; p.invincible = this.artifacts.has('cloak') ? 4 : 2.5; this.combo = 0; this.comboTime = 0;
    if (!this.artifacts.has('steelshield')) {
      this.power = this.artifacts.has('burningcore') ? 1 : Math.max(1, this.power - 1);
      if (this.artifacts.has('burningcore')) this.powerPoints = 0;
    }
    this.clearBullets(); this.particlesAt(p.x, p.y, '#fff', 30); this.emit('hurt');
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
    const n = this.wave++, type = n % 5, stage = this.level, image = this.dungeon.specialType ?? this.stageIndex;
    if (type === 4) {
      this.spawnEnemy(225, -55, { elite: true, r: 29, hp: 220 + stage * 65, speed: 42, move: 'sentry', fire: 1.7, image });
    } else {
      const count = type === 2 ? 4 : 5;
      for (let i = 0; i < count; i++) {
        const left = n % 2 === 0;
        this.spawnEnemy(type === 0 ? 55 + i * 85 : left ? 65 + i * 20 : 385 - i * 20, -40 - i * 38,
          { hp: 38 + stage * 10, speed: 68 + stage * 8 + (type === 3 ? 25 : 0), move: type === 0 ? 'drift' : type === 1 ? 'curve' : type === 2 ? 'zigzag' : 'dive', side: left ? 1 : -1, fire: 1.8 + i * .25, image, r: 19 });
      }
    }
    if (n % 3 === 1) this.spawnEnemy(70 + this.random()*310, -65, { special: image, elite:image===4, r: 25, hp: (115 + stage*35)*(stage===3?1.65:stage===4?0.9167:1), speed: 53, move: 'sentry', fire: 2, image, countdown: 3 });
    this.emit('wave', { wave: n });
  }
  spawnEnemy(x, y, data) {
    if(this.stageIndex===6 && !data.offspring && (data.elite || data.special!==undefined)) {
      const patterns=this.room===0?[3,0]:[1,5];
      data={...data,elite:true,special:patterns[this.celestialWave++%2]};
    }
    const hp = data.hp * this.difficulty.hp * (this.dungeon.event ? 1.40 : DUNGEON_ENEMY_SCALE[this.stageIndex]) * (1 + this.room*.12) * (data.elite || data.miniboss ? 1.2 : 1);
    this.add('enemies', { x, y, ox: x, age: 0, flash: 0, ...data, hp, maxHp: hp }, LIMITS.enemies);
  }
  specialDeath(e) {
    const sealed = this.dungeon.asset === 'behemoth';
    if (e.special === 0) this.effect('detonation', { x: e.x, y: e.y, radius: sealed ? 120 : 82, wait: sealed ? 1 : .75, life: sealed ? 1.3 : 1.05, fired: false, color: this.stage.color });
    if (e.special === 1) for (const side of [-1,0,1]) this.spawnEnemy(clamp(e.x+side*22,25,425),e.y, { hp: 16, r: 12, speed: 170, move: 'curve', side, fire: .65, image: 1, offspring: true, spawnInvincible: this.dungeon.asset === 'harmonious' ? .5 : 0 });
  }
  spawnSentinel() {
    this.sentinelSpawned = true; this.clearBullets();
    this.spawnEnemy(225, -80, { miniboss: true, elite: true, hp: 1150 + this.level*340, r: 38, speed: 65, move: 'sentry', fire: 1.8, image: this.dungeon.specialType ?? this.stageIndex });
    this.emit('sentinel', { name: this.dungeon.sentinel });
  }
  sentinelAttack(e) {
    const aim = Math.atan2(this.player.y-e.y,this.player.x-e.x);
    if (this.dungeon.event) { this.fan(e.x,e.y,7,145,.23,aim,{shape:'diamond',color:this.stage.color}); return; }
    if (this.stageIndex === 0) { this.fan(e.x,e.y,7,120,.18,aim); this.addHazard(clamp(this.player.x,45,405),24); }
    if (this.stageIndex === 1) for (const side of [-1,1]) this.fan(e.x+side*40,e.y,5,112,.2,Math.PI/2+side*Math.sin(e.age)*.6,{shape:'heart'});
    if (this.stageIndex === 2) for(let i=0;i<16;i++) this.enemyBullet(e.x,e.y,i*TAU/16+e.age*.3,118,{shape:'diamond'});
    if(this.stageIndex===3)this.fan(e.x,e.y,9,130,.19,aim,{shape:'petal'});
    if(this.stageIndex===4)this.fan(e.x,e.y,5,150,.3,aim,{r:7,ricochet:5});
    if(this.stageIndex===5){this.fan(e.x,e.y,3,75,.45,aim,{r:16,split:true,shape:'diamond'});this.addHazard(clamp(this.player.x,40,410),28);}
    if(this.stageIndex===6){this.fan(e.x,e.y,5,150,.22,aim,{shape:'diamond'});if(e.special===5)this.enemyBullet(e.x,e.y,aim,65,{r:16,split:true});}
  }
  recoverRoom() {
    if(this.roomRecovered)return;
    this.roomRecovered=true;
    if(this.artifacts.has('will'))this.player.lives=Math.min(this.maxLife,this.player.lives+1);
    if(this.artifacts.has('moonlight'))this.bombs=Math.min(this.maxBombs,this.bombs+1);
  }
  clearRoom() {
    if (this.phase !== 'wave') return;
    this.recoverRoom(); this.phase = 'clear'; this.phaseTime = 0; this.clearBullets(); this.hazards.length = this.enemies.length = this.effects.length = 0;
    this.emit('roomClear', {room:this.room});
  }
  spawnBoss() {
    this.enemies.length = 0; this.clearBullets(); this.hazards.length = 0;
    this.combo = 0; this.comboTime = 0; this.bossElapsed = 0;
    const hp = this.stage.hp * this.difficulty.hp * 0.936;
    this.boss = { boss: true, x: 225, y: -100, age: 0, hp, maxHp: hp, r: 42, flash: 0, fire: 1.5, image: this.stageIndex };
    this.enemies.push(this.boss); this.phase = 'warning'; this.phaseTime = 0; this.emit('warning');
  }
  bossAttack(dt) {
    const b = this.boss; if (!b || b.hp <= 0) return;
    const phase = b.hp / b.maxHp > .67 ? 0 : b.hp / b.maxHp > .34 ? 1 : 2;
    if (phase !== this.bossPattern) {
      this.bossPattern = phase; this.clearBullets(); this.hazards.length = 0; this.effects=this.effects.filter(f=>!['celestialWarning','eventWave'].includes(f.type)); b.fire = 1.2;
      if (this.stageIndex===6) {
        b.nextLight=this.bossClock+4; b.nextBlade=this.bossClock+1.5; b.nextJudgmentCross=this.bossClock+3; b.asteaCrossCount=0;
      }
      this.emit('pattern', { phase, name: this.stage.pattern[phase] });
    }
    this.bossClock += dt; b.fire -= dt;
    const aim = Math.atan2(this.player.y - b.y, this.player.x - b.x);
    const speed = 102 + this.stageIndex * 10 + phase * 12;
    const t = this.bossClock;
    if(this.stageIndex===6 && phase===0 && t>=b.nextLight) {
      b.nextLight=t+4;
      const gap=clamp(this.player.x,85,365);
      this.effect('celestialWarning',{x:gap,y:this.height-28,life:1.5,wait:1.2,gap,bottom:true,color:'#ffe1a3'});
    }
    if(this.stageIndex===6 && phase===1 && t>=b.nextBlade) {
      b.nextBlade=t+1.5;
      const aimed=(b.asteaCrossCount++%2)===0;
      const x=aimed?clamp(this.player.x,70,380):70+this.random()*310;
      const y=aimed?clamp(this.player.y,240,this.height-120):240+this.random()*Math.max(1,this.height-360);
      this.addHazard(x,28);this.addHazard(y,28,'horizontal');
    }
    if(this.stageIndex===6 && phase===2 && t>=b.nextJudgmentCross) {
      b.nextJudgmentCross=t+3;
      this.addHazard(clamp(this.player.x,70,380),28);
      this.addHazard(clamp(this.player.y,240,this.height-120),28,'horizontal');
    }
    if (b.fire > 0) return;
    if (this.dungeon.event) { this.eventBossAttack(phase,b,aim); this.emit('enemyShot',{boss:true}); return; }
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
        b.fire=phase===0?1.05:.8;
        for(let i=0;i<12+phase*4;i++)this.enemyBullet(b.x,b.y,i*TAU/(12+phase*4)+t*.24,speed,{shape:'petal',turn:(i%2?1:-1)*.16});
        if(phase===2)this.fan(b.x,b.y,3,speed+30,.15,aim);break;
      case 4:
        b.fire=phase===0?1:.85;
        this.fan(b.x,b.y,5+phase,speed,.20,aim,{r:6,ricochet:phase===2?3:0});
        if(phase>0 && t>=(b.nextCross||0)) {
          b.nextCross=t+4.5;
          this.addHazard(clamp(this.player.x,65,385),30);
          this.addHazard(clamp(this.player.y,200,this.height-100),30,'horizontal');
        }break;
      case 5:
        b.fire = phase === 0 ? .9 : .6;
        for (const side of [-1, 1]) this.fan(b.x + side * 55, b.y + 10, 4 + phase, speed, .18, Math.PI / 2 + side * Math.sin(t) * .5, { color: side === 1 ? '#e2a3ff' : '#ffb882', shape: 'diamond' });
        if (phase > 0 && Math.floor(t * 2) % 3 === 0) this.addHazard(60 + Math.floor(this.random() * 4) * 110, phase === 2 ? 34 : 26);
        if (phase === 2) this.fan(b.x, b.y, 3, speed + 35, .16, aim); break;
      case 6:
        b.fire=phase===2?2.6:1.25;
        if(phase===0) {
          this.fan(b.x,b.y,7,150,.19,aim,{shape:'diamond'});
        } else if(phase===1) {
          this.fan(b.x,b.y,7,155,.22,Math.PI/2,{shape:'diamond'});
        } else {
          // A fixed, telegraphed corridor stays open for this entire volley.
          const gap=[90,225,360][(b.judgmentCount||0)%3];b.judgmentCount=(b.judgmentCount||0)+1;
          this.effect('celestialWarning',{x:gap,y:80,life:1.5,wait:1.2,gap,bottom:false,color:'#ffe1a3'});
          this.fan(b.x,b.y,5,175,.17,aim,{shape:'diamond'});
        }
        break;
    }
    if(this.stageIndex===5){b.fire*=.943;if(phase===2)this.fan(b.x,b.y,2,speed+45,.24,aim,{split:true,r:12});}
    this.emit('enemyShot', { boss: true });
  }
  addHazard(x, width, axis='vertical') { if (this.hazards.length < 6) this.hazards.push({ x, width, axis, age: 0, warn: 1.4, life: 2.25 }); }
  eventBossAttack(phase, b, aim) {
    const t=this.bossClock, color=this.stage.color;
    b.fire=[1.45,1.3,1.15][phase];
    // Decoration comes from paired colors and shapes, not fast or dense collision fields.
    const ring=(count,speed,rotation,shape,extra={})=>{
      for(let i=0;i<count;i++) {
        const angle=i*TAU/count+rotation;
        // Keep a generous downward corridor open in every decorative ring.
        if(Math.abs(Math.atan2(Math.sin(angle-Math.PI/2),Math.cos(angle-Math.PI/2)))<.27)continue;
        this.enemyBullet(b.x,b.y,angle,speed,{color,shape,r:5,...extra});
      }
    };
    switch(this.dungeon.asset) {
      case 'harmonious':
        for(const side of [-1,1]) this.fan(b.x+side*48,b.y+12,4+phase,108,.22,Math.PI/2+side*(.62+Math.sin(t*.45)*.2),{shape:'heart',color:side<0?'#ffacd0':'#a7edd4',r:5});
        if(phase>0)ring(16,82,t*.1,'petal');
        break;
      case 'gold-dragon':
        for(const side of [-1,1])this.fan(b.x+side*55,b.y,5+phase,112,.16,Math.PI/2+side*.72,{shape:'diamond',color:side<0?'#ffe6a1':'#8ee7df',r:5});
        if(phase===2)ring(20,86,t*.14,'diamond');
        break;
      case 'ancient-soul':
        ring(18+phase*4,95,t*.19,'petal',{turn:.07});
        if(phase>0)this.fan(b.x,b.y,3,125,.25,aim,{shape:'diamond',color:'#fff1ba',r:4});
        break;
      case 'behemoth': {
        b.fire=phase===2?1.65:1.9;
        const gap=[100,225,350][(b.earthWave||0)%3]; b.earthWave=(b.earthWave||0)+1;
        this.effect('eventWave',{x:gap,y:90,gap,wait:1,life:1.3,color,phase});
        if(phase>0)ring(14,90,0,'diamond',{r:7});
        break;
      }
      case 'time-ruler':
        b.fire=2.4;
        // An original clock volley inspired by Taisei's stop/release rhythm, not its code.
        ring(12+phase*6,108,t*.12,'diamond',{stopAt:.55,releaseAt:1.65,stopped:false});
        if(phase===2)this.fan(b.x,b.y,3,118,.3,aim,{shape:'diamond',color:'#fff1c2',r:4});
        break;
    }
  }
  completeQuiz(reward = null) {
    if (this.phase !== 'quiz' || !(this.room === 2 ? [null,'score'] : [null,'life','bomb']).includes(reward)) return false;
    if(this.challenge && this.room===2 && this.stageIndex<6) {
      if(reward!==null)return false;
      this.startStage(this.stageIndex+1);return true;
    }
    if (reward === 'score') { this.scoreBonus = Math.round(this.score * .1); this.score += this.scoreBonus; }
    if (reward === 'life') this.player.lives = Math.min(this.maxLife,this.player.lives+1);
    if (reward === 'bomb') this.bombs = Math.min(this.maxBombs,this.bombs+1);
    if(this.room===2){this.finalizeClearBonuses();this.phase='victory';this.finished=true;this.emit('victory');return true;}
    this.startStage(this.stageIndex, this.room+1); return true;
  }
  challengeChoices() {
    if(!this.challenge || this.phase!=='quiz' || this.room!==2 || this.stageIndex>=6 || this.artifacts.size>=9)return [];
    if(!this.pendingArtifacts) {
      const pool=ARTIFACTS.filter(a=>!this.artifacts.has(a.id));
      this.pendingArtifacts=[];
      while(pool.length && this.pendingArtifacts.length<3)this.pendingArtifacts.push(pool.splice(Math.floor(this.random()*pool.length),1)[0].id);
    }
    return [...this.pendingArtifacts];
  }
  chooseChallengeArtifact(id) {
    if(!this.challenge || this.phase!=='quiz' || this.room!==2 || this.stageIndex>=6 || this.artifacts.size>=9 || !this.pendingArtifacts?.includes(id) || this.artifacts.has(id))return false;
    const old=this.loadout, oldMax=this.maxLife;
    this.artifacts.add(id);this.loadout=loadoutStats([...this.artifacts],this.mode,9);
    this.maxLife=this.loadout.maxLife+(this.hero.lifeBonus||0);
    this.maxBombs=this.loadout.maxBombs+(this.hero.bombBonus||0);
    this.player.lives=clamp(this.player.lives+this.maxLife-oldMax,1,this.maxLife);
    this.player.radius=Math.max(1,(this.hero.radius||5)+this.loadout.radius);
    this.bombs=clamp(this.bombs+this.loadout.bombs-old.bombs,0,this.maxBombs);
    this.attackBonus=this.loadout.attack;
    this.comboDuration=this.artifacts.has('hourglass')?5.6:3.6;
    this.powerRequirement=([0,7].includes(this.heroIndex)?4:3)-(this.artifacts.has('dew')?1:0);
    if(id==='origin')this.power=Math.min(5,this.power+1);
    while(this.powerPoints>=this.powerRequirement && this.power<5){this.powerPoints-=this.powerRequirement;this.power++;}
    if(id==='resurgence')this.player.lives=this.maxLife;
    if(id==='miracle')this.bombs=Math.min(this.maxBombs,this.bombs+3);
    if(id==='clover')this.player.barrier=true;
    this.pendingArtifacts=null;
    return this.completeQuiz();
  }
  finalizeClearBonuses() {
    if (this.bonusesFinalized) return;
    if (!this.challenge) {
      this.timeBonus = this.bossTimeScore(this.bossClearTime);
      this.score += this.timeBonus;
    }
    this.rankBonus = this.challenge ? (this.rank === 'S' ? 10000 : this.rank === 'A' ? 5000 : 0) : (this.rank === 'S' ? 4000 : this.rank === 'A' ? 2000 : 0);
    this.score += this.rankBonus; this.bonusesFinalized = true;
  }
  revive(correct) {
    if (this.phase !== 'defeat' || this.reviveUsed) return false;
    this.reviveUsed = true;
    if (!correct) return false;
    this.finished = false; this.player.lives = !this.challenge && this.artifacts.has('resurgence') ? this.maxLife : Math.min(2,this.maxLife); this.player.invincible = 4;
    if(!this.challenge && this.artifacts.has('miracle'))this.bombs=Math.min(this.maxBombs,this.bombs+3);
    this.phase = this.boss && this.boss.hp > 0 ? 'boss' : 'wave'; this.clearBullets(); this.hazards.length = 0; this.emit('revived'); return true;
  }
  update(dt) {
    if (this.finished || this.phase === 'quiz' || dt <= 0) return;
    const previousOrbit=this.weapon==='orbit'?this.orbitCenters():null;
    dt = Math.min(dt, .05); this.frostTime=Math.max(0,this.frostTime-dt); this.totalTime += dt; this.phaseTime += dt;
    const p = this.player; p.invincible = Math.max(0, p.invincible - dt); p.recoil = Math.max(0, p.recoil - dt * 8);
    const dx = p.targetX - p.x, dy = p.targetY - p.y, len = Math.hypot(dx, dy), step = Math.min(1, Math.max(200,(this.hero.speed || 1250)+this.loadout.speed) * dt / Math.max(1, len));
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
      } else if (this.spawnTime <= 0) { this.spawnWave(); this.spawnTime = Math.max(2.5,3.8-this.level*.2) * this.difficulty.interval; }
    }
    if (this.phase === 'warning' && this.phaseTime > 3) { this.phase = 'boss'; this.phaseTime = 0; this.emit('bossStart'); }
    if (this.phase === 'boss') this.bossElapsed += dt;
    if (['wave', 'boss'].includes(this.phase)) this.fire(dt);
    for (const e of this.enemies) {
      if (e.hp <= 0) continue; e.prevX=e.x;e.prevY=e.y; e.slow = Math.max(0,(e.slow || 0)-dt);
      e.spawnInvincible=Math.max(0,(e.spawnInvincible||0)-dt);
      const chilled = e.slow > 0 || (this.frostTime > 0);
      e.age += dt * (chilled ? .6 : 1); e.flash = Math.max(0, e.flash - dt);
      if (e.boss) {
        const targetY = this.phase === 'warning' ? 150 : 155 + Math.sin(e.age * .65) * 26;
        e.y += (targetY - e.y) * Math.min(1, dt * 2);
        e.x = 225 + Math.sin(e.age * .6) * (this.stageIndex === 5 ? 95 : 105);
        if (this.phase === 'boss') this.bossAttack(dt * (chilled ? .7 : 1));
      } else {
        const slow = e.slow > 0 || (this.frostTime > 0) ? .48 : 1;
        e.y += e.speed * dt * slow;
        if (e.move === 'curve') e.x = clamp(e.ox + Math.sin(e.age * 1.4) * 95 * e.side, 25, 425);
        if (e.move === 'zigzag') e.x = clamp(e.ox + Math.sin(e.age * 2.3) * 55, 25, 425);
        if (e.move === 'drift') e.x = e.ox + Math.sin(e.age) * 18;
        if (e.move === 'sentry' && e.y > 155) e.y -= e.speed * dt * slow * (e.miniboss ? 1 : .85);
        if(e.special===3&&e.y>35&&['wave','boss'].includes(this.phase)) {
          e.teleportClock=(e.teleportClock||0)+dt;
          if(e.teleportClock>=2.3&&!e.teleportTarget){e.teleportTarget={x:55+this.random()*340,y:70+this.random()*Math.min(260,this.height*.35)};this.effect('teleport',{...e.teleportTarget,radius:32,life:.75,color:this.stage.color});}
          if(e.teleportClock>=3){e.x=e.ox=e.teleportTarget.x;e.y=e.teleportTarget.y;e.prevX=e.x;e.prevY=e.y;e.teleportClock=0;e.teleportTarget=null;this.effect('burst',{x:e.x,y:e.y,radius:40,life:.35,color:this.stage.color});}
        }
        if (e.special === 2 && e.y > 0) {
          e.countdown -= dt;
          if (e.countdown <= 0) { for(let i=0;i<20;i++) this.enemyBullet(e.x,e.y,i*TAU/20,145,{shape:'diamond'}); e.countdown = 3; this.emit('curseBurst'); }
        }
        e.fire -= dt;
        if (e.fire <= 0 && e.y > 30 && e.y < this.height * .62 && ['wave', 'boss'].includes(this.phase)) {
          const aim = Math.atan2(p.y - e.y, p.x - e.x);
          if (e.miniboss) this.sentinelAttack(e);
          else if(e.special===4)this.fan(e.x,e.y,4,130,.3,aim,{r:6,ricochet:5});
          else if (e.special === 5) this.enemyBullet(e.x,e.y,aim,58,{r:17,split:true,shape:'diamond'});
          else this.fan(e.x, e.y + 10, e.elite ? 5 : 1 + (this.level >= 2 ? 2 : 0), 105 + this.level * 14, .17, aim, { color: e.elite ? '#ffc184' : this.stage.color });
          e.fire = (e.miniboss ? 1.83 : e.elite && e.special!==4 ? 1.5 : 2.9) * this.difficulty.interval;
        }
      }
      if (distance(e, p) < e.r + p.radius) this.hitPlayer();
      if(this.finished)return;
    }
    this.updateOrbit(previousOrbit);
    this.enemies = this.enemies.filter(e => e.hp > 0 && e.y < this.height + 70);
    for (const s of this.shots) {
      s.life -= dt;
      if (s.fuse !== undefined) { s.fuse-=dt; if(s.fuse<=0) {this.plantZone(s);s.life=0;continue;} }
      if (s.homing) { const e = this.nearest(s.x, s.y, 700); if (e) { const d = Math.max(1, distance(e, s)), turn = Math.min(1, dt * 6); s.vx += ((e.x - s.x) / d * 520 - s.vx) * turn; s.vy += ((e.y - s.y) / d * 520 - s.vy) * turn; } }
      s.x += s.vx * dt; s.y += s.vy * dt; if (s.wave) s.x += Math.sin(s.life * 10) * s.wave;
      for (const e of this.enemies) {
        if (e.hp <= 0 || e.spawnInvincible > 0 || s.hit.has(e) || (e.boss && this.phase !== 'boss')) continue;
        if (distance(s, e) < e.r + s.r) {
          s.hit.add(e); this.damage(e, s.damage, s.x, s.y, s.damageKind);
          if (s.zone) this.plantZone(s);
          if (s.echo) {
            this.effect('burst',{x:e.x,y:e.y,radius:s.echoRadius,life:.3,color:'#f8dfef'});
            for (const other of [...this.enemies]) if(other!==e && distance(e,other)<s.echoRadius) this.damage(other,s.damage*.3,other.x,other.y);
          }
          if (s.slow) e.slow = s.slow;
          if (s.mark && e.hp > 0) { e.marks = (e.marks || 0)+1; if(e.marks >= 3) {e.marks=0;this.effect('burst',{x:e.x,y:e.y,radius:s.markRadius,life:.45,color:'#ffc4e3'});for(const target of [...this.enemies]) if(distance(e,target)<s.markRadius) this.damage(target,s.damage*2.5,target.x,target.y);} }
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
      b.stopped=b.stopAt!==undefined && b.age>=b.stopAt && b.age<b.releaseAt;
      const bulletSlow = b.stopped ? 0 : this.frostTime > 0 ? .35 : 1;
      b.x += b.vx * dt * bulletSlow; b.y += b.vy * dt * bulletSlow;
      const d = distance(b, p);
      if(b.ricochet && b.age<b.ricochet){
        if(b.x<b.r&&b.vx<0 || b.x>450-b.r&&b.vx>0){b.vx=-b.vx;b.x=clamp(b.x,b.r,450-b.r);}
        if(b.y<b.r&&b.vy<0 || b.y>this.height-b.r&&b.vy>0){b.vy=-b.vy;b.y=clamp(b.y,b.r,this.height-b.r);}
      }
      if (b.split && (d < 178 || b.age > 3.7)) { b.dead = true; b.split = false; this.fan(b.x,b.y,9,125,TAU/9,Math.PI/2,{r:4}); this.effect('burst',{x:b.x,y:b.y,radius:35,life:.3,color:this.stage.color}); continue; }
      if (d < b.r + p.radius && p.invincible <= 0) { b.dead = !p.barrier; this.hitPlayer(); }
      else if (d < 24 && !b.grazed && p.invincible <= 0) { b.grazed = true; this.graze++; this.score += 25 * this.multiplier; if(this.artifacts.has('slipper') && this.graze%20===0)this.grantBarrier(); this.emit('graze'); }
      if(this.finished)return;
      if (this.weapon === 'petal' && d < 28 && Math.sin(this.totalTime * 2) > .97) { b.dead = true; this.particlesAt(b.x, b.y, '#f7dfaa', 2); }
    }
    this.bullets = this.bullets.filter(b => !b.dead && b.age < 14 && b.y < this.height + 25 && b.y > -150 && b.x > -80 && b.x < 530);
    this.stats.maxBullets = Math.max(this.stats.maxBullets, this.bullets.length);
    for (const h of this.hazards) { h.age += dt; if (h.age > h.warn && Math.abs((h.axis==='horizontal'?p.y:p.x) - h.x) < h.width / 2 + p.radius) this.hitPlayer(); }
    if(this.finished)return;
    this.hazards = this.hazards.filter(h => h.age < h.life);
    for (const d of this.pickups) {
      d.age += dt; const dist = distance(d, p), magnet = dist < Math.max(0,125+this.loadout.attraction) || (!this.artifacts.has('chaoscarnival') && p.y < this.height * .32) || this.phase === 'clear';
      if (magnet) { const speed = Math.min(1, 420 * dt / Math.max(1, dist)); d.x += (p.x - d.x) * speed; d.y += (p.y - d.y) * speed; }
      else { d.y += 48 * dt; d.x += d.vx * dt * Math.exp(-d.age); }
      if (distance(d, p) < 24) { d.dead = true; this.collect(d.type); }
    }
    this.pickups = this.pickups.filter(d => !d.dead && d.y < this.height + 20);
    if (this.bombTime > 0) {
      this.bombElapsed=Math.min(this.bombDuration,this.bombElapsed+dt);
      this.bombTime=Math.max(0,this.bombDuration-this.bombElapsed);
      const ticks=Math.floor((this.bombElapsed+1e-9)/.25),count=ticks-this.bombTicks;
      if(count>0){this.bombTicks=ticks;if(this.heroIndex!==8||this.artifacts.has('sun'))this.clearBullets(true);
        const amount=this.bombDamagePool/(this.bombDuration/.25)*count*this.loadout.bomb;
        if(amount>0)for(const e of [...this.enemies]){this.damage(e,amount,e.x,e.y,'bomb');this.effect('burst',{x:e.x,y:e.y,radius:44,life:.2,color:this.hero.color});}
      }
    }
    for(const [artifact,timer,side] of [['leaf','fairyFire',1],['mirror','darkFairyFire',-1]])if(this.artifacts.has(artifact)&&['wave','boss'].includes(this.phase)) {
      this[timer]-=dt;if(this[timer]<=0){this[timer]=.3;this.shot(0,15,side===1?'star':'nightstar',{x:p.x+side*44,y:p.y-20,homing:true,r:5});}
    }
    for (const q of this.particles) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= .97; q.vy *= .97; }
    this.particles = this.particles.filter(q => q.life > 0);
    for (const f of this.effects) {
      f.age += dt;
      if(f.type==='celestialWarning' && !f.fired && f.age>=f.wait && this.phase==='boss') {
        f.fired=true;
        for(let x=25;x<450;x+=32)if(Math.abs(x-f.gap)>62) {
          this.enemyBullet(x,f.bottom?this.height+8:75,f.bottom?-Math.PI/2:Math.PI/2,f.bottom?110:165,{shape:'diamond',color:'#ffe1a3',r:6});
          if(!f.bottom)this.enemyBullet(x,28,Math.PI/2,165,{shape:'diamond',color:'#eacbff',r:6});
        }
      }
      if(f.type==='eventWave' && !f.fired && f.age>=f.wait && this.phase==='boss') {
        f.fired=true;
        for(let x=20;x<450;x+=28)if(Math.abs(x-f.gap)>62)this.enemyBullet(x,90,Math.PI/2,118,{shape:'diamond',color:f.color,r:6});
      }
      if(f.type==='detonation' && !f.fired && f.age>(f.wait??.75)) {f.fired=true;this.fan(f.x,f.y,10,115,TAU/10);if(distance(f,p)<f.radius)this.hitPlayer();}
    }
    this.effects = this.effects.filter(f => f.age < f.life);
    if (this.phase === 'clear' && this.phaseTime > 3.4) {
      this.phase = 'quiz'; this.emit('quiz', { kind: ['vocab','collocation','grammar'][this.room] });
    }
  }
  collect(type) {
    if (type === 'power') { if (this.power < 5 && ++this.powerPoints >= this.powerRequirement) { this.power++; this.powerPoints = 0; this.emit('powerup'); } else if (this.power >= 5) this.score += 250; }
    if (type === 'life') { this.player.lives = Math.min(this.maxLife, this.player.lives + 1); this.emit('heal'); }
    if (type === 'score') this.score += 50 * this.multiplier;
    this.emit('pickup', { item: type });
  }
}
