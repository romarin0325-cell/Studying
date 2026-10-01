import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SpatialHash,sweptHit,muzzlePoint,targetPoint} from '../src/engine.js';
import {HEROES,HERO,WEAPONS,WEAPON,LIMITS,STAGE,EVOLUTION,BONDS} from '../src/content.js';
import {simulateExpedition} from '../scripts/simulate.mjs';
const advance=(g,seconds,input={x:0,y:0})=>{for(let i=0;i<seconds*60;i++){g.step(1/60,input);g.drainEvents();}};

test('fixed-step combat restores RNG, entities and pending choices exactly',()=>{
  const g=new Game({seed:179,hero:'luna'});advance(g,12,{x:.8,y:.25});g.player.charge=100;g.castSkill();advance(g,2);
  const copy=Game.restore(g.snapshot());
  for(let i=0;i<1800;i++){for(const run of [g,copy]){if(run.mode==='choice')run.choose(0);if(run.mode==='treasure')run.claimTreasure();run.step(1/60,{x:Math.sin(i/70)*.4,y:Math.cos(i/70)*.4});run.drainEvents();}}
  assert.deepEqual(copy.snapshot(),g.snapshot());
});

test('all nine starting weapons actually damage and each skill consumes charge once',()=>{
  for(const h of HEROES){const g=new Game({hero:h.id,seed:14});g.introSpawned=true;g.spawnTimer=1000;g.eliteTimer=1000;
    g.spawnEnemy('beetle',{x:840,y:800,hp:10000,maxHp:10000,speed:0,damage:0});
    advance(g,4);assert.ok(g.totalDamage>0,h.id+' starting weapon');g.player.charge=100;g.player.hp=40;assert.equal(g.castSkill(),true,h.id);assert.equal(g.castSkill(),false);assert.equal(g.skilled,1);assert.equal(g.player.charge,0);
    if(['snow_rabbit','time_ruler'].includes(h.id))assert.equal(g.enemies[0].freeze,h.id==='snow_rabbit'?5.6:4);if(['jasmine','night_rabbit','time_ruler'].includes(h.id))assert.ok(g.player.hp>=40);
  }
});

test('all fourteen weapon behaviors deal real damage at base rank and after recipe evolution',()=>{
  for(const def of WEAPONS){for(const evolved of [false,true]){const g=new Game({seed:9});g.weapons=[];g.applyOption({type:'weapon',id:def.id});if(evolved){g.weapons[0].level=6;g.relics=[{id:def.relic,level:2}];g.applyOption({type:'evolution',id:def.id});}
    g.spawnTimer=1000;g.eliteTimer=1000;g.spawnEnemy('beetle',{x:900,y:800,hp:10000,maxHp:10000,speed:0,damage:0});advance(g,4);assert.ok(g.weapons[0].damage>0,def.id+' / '+(evolved?'evolved':'base'));}}
});

test('moving fast projectiles use their whole segment; spatial queries match brute force',()=>{
  assert.equal(sweptHit(0,0,100,0,50,0,3),true);assert.equal(sweptHit(0,0,100,0,50,6,3),false);assert.equal(sweptHit(10,10,10,10,12,10,3),true);
  const enemies=Array.from({length:180},(_,i)=>({id:i,x:i*47%1200,y:i*131%1200,radius:10,hp:1})),hash=new SpatialHash();hash.rebuild(enemies);
  for(let n=0;n<20;n++){const x=n*71,y=n*113,r=100;assert.deepEqual(hash.near(x,y,r).map(e=>e.id).sort((a,b)=>a-b),enemies.filter(e=>(e.x-x)**2+(e.y-y)**2<=(r+10)**2).map(e=>e.id).sort((a,b)=>a-b));}
  hash.rebuild([{id:1,x:100,y:100,radius:45,hp:1}]);assert.equal(hash.near(95,95,1).length,1,'an overlapping boss across a hash-cell boundary is still hittable');
});

test('boss center shots hit the player body in every chapter and phase, but remain dodgeable',()=>{
  for(const stage of ['garden','cathedral','rift'])for(const lowHealth of [false,true])for(const [dx,dy] of [[200,0],[-200,0],[160,120]])for(const dodge of [false,true]){
    const g=new Game({stage});g.player.invulnerable=0;
    const boss=g.spawnEnemy('boss',{x:g.player.x-dx,y:g.player.y-dy,maxHp:1000,hp:lowHealth?400:1000,phase:2});
    g.bossAttack(boss);
    const shots=g.hazards.filter(h=>h.kind==='shot'),center=shots[stage==='cathedral'?0:Math.floor(shots.length/2)];
    assert.ok(center);assert.deepEqual({x:center.x,y:center.y},targetPoint(boss));
    // Isolate the aimed projectile so rings, blasts and neighboring fan shots cannot hide a miss.
    g.hazards=[center];const hp=g.player.hp;
    if(dodge){g.player.x-=dy/Math.hypot(dx,dy)*100;g.player.y+=dx/Math.hypot(dx,dy)*100;}
    for(let i=0;i<360;i++)g.updateHazards(1/60);
    assert.equal(g.player.hp,dodge?hp:hp-center.damage,`${stage}, lowHealth=${lowHealth}, offset=${dx},${dy}, dodge=${dodge}`);
  }
});

test('evolution requires the actual recipe, and rabbit synergy changes firing speed',()=>{
  const g=new Game({hero:'snow_rabbit'});g.weapons[0].level=6;assert.equal(g.candidates().some(o=>o.type==='evolution'),false);
  g.relics=[{id:WEAPON.frost.relic,level:2}];assert.ok(g.candidates().some(o=>o.id==='frost'&&o.type==='evolution'));g.applyOption({type:'evolution',id:'frost'});assert.equal(g.weapons[0].evolved,true);assert.equal(g.evolutions,1);
  g.applyOption({type:'weapon',id:'dream'});assert.equal(g.stats.rabbit,1.1);g.applyOption({type:'weapon',id:'sun'});assert.equal(g.stats.rabbit,1.2);
  const bad=new Game();bad.applyOption({type:'evolution',id:'star'});assert.equal(bad.weapons[0].evolved,false);
});

test('pickup saturation conserves experience, entity budgets remain bounded',()=>{
  const g=new Game();for(let i=0;i<LIMITS.drops;i++)g.spawnDrop('xp',100+i,100,3);g.spawnDrop('xp',999,999,12);assert.equal(g.drops.length,LIMITS.drops);assert.equal(g.drops.reduce((n,d)=>n+d.value,0),LIMITS.drops*3+12);
  for(let i=0;i<LIMITS.enemies+40;i++)g.spawnEnemy();assert.equal(g.enemies.length,LIMITS.enemies);
  for(let i=0;i<1000;i++)g.emit('hit');assert.equal(g.events.length,LIMITS.events);
  const fireworks=new Game();for(let i=0;i<LIMITS.enemies;i++)fireworks.spawnEnemy('ember',{hp:1});for(const e of fireworks.enemies)fireworks.hit(e,10,'star');assert.equal(fireworks.hazards.length,LIMITS.hazards);assert.doesNotThrow(()=>Game.restore(fireworks.snapshot()));
  const caster=new Game({hero:'jasmine'});for(let i=0;i<LIMITS.fields;i++)caster.fields.push({id:caster.uid++,weapon:'flower',x:800,y:800,r:50,life:2,tick:0,damage:1,color:'#f6df9d'});caster.player.charge=100;caster.castSkill();assert.equal(caster.fields.length,LIMITS.fields);assert.ok(caster.fields.at(-1).r>195);assert.doesNotThrow(()=>Game.restore(caster.snapshot()));
});

test('stacked chests at the pickup cap retain every upgrade and coin reward',()=>{
  const g=new Game();for(let i=0;i<LIMITS.drops;i++)g.spawnDrop('xp',100+i%50,100,3);g.spawnDrop('chest',800,800,1);g.spawnDrop('chest',800,800,1);
  assert.equal(g.drops.find(d=>d.kind==='chest').value,2);g.updateDrops(1/60);assert.equal(g.mode,'treasure');assert.equal(g.gold,10);g.claimTreasure();g.updateDrops(1/60);assert.equal(g.mode,'treasure');assert.equal(g.gold,20);g.claimTreasure();assert.equal(g.weapons[0].level,4);assert.equal(g.drops.some(d=>d.kind==='chest'),false);
});

test('final boss is reserved even in a full horde; time alone is never victory',()=>{
  const g=new Game();g.time=STAGE.garden.duration;g.bossesSpawned=2;for(let i=0;i<LIMITS.enemies;i++)g.spawnEnemy();g.director(1/60);const boss=g.enemies.find(e=>e.final);assert.ok(boss);assert.equal(g.mode,'playing');
  g.hit(boss,100000,'star');assert.equal(g.mode,'victory');g.step(1/60);assert.equal(g.mode,'victory');assert.equal(g.enemies.filter(e=>e.final).length,1);
});

test('level, treasure and pause freeze the clock; choices cannot overfill slots',()=>{
  const g=new Game();g.gainXP(80);const t=g.time;assert.equal(g.mode,'choice');g.step(1/60);assert.equal(g.time,t);assert.equal(g.choose(99),false);g.rerolls=0;assert.equal(g.reroll(),false);
  while(g.mode==='choice')g.choose(0);g.openTreasure();g.step(1/60);assert.equal(g.time,t);assert.equal(g.claimTreasure(),true);assert.equal(g.claimTreasure(),false);
  for(const id of ['blade','ember','frost','dream','glass','flower'])g.applyOption({type:'weapon',id});assert.equal(g.weapons.length,6);assert.equal(g.candidates().some(o=>o.type==='weapon'&&!g.weapons.some(w=>w.id===o.id)),false);
  g.mode='paused';advance(g,10);assert.equal(g.time,t);
});

test('dash invulnerability and cancellation of skill when paused are real combat rules',()=>{
  const g=new Game();g.player.invulnerable=0;assert.equal(g.dash(),true);assert.equal(g.dash(),false);const hp=g.player.hp;assert.equal(g.hurt(50),false);assert.equal(g.player.hp,hp);g.player.invulnerable=0;g.hurt(20);assert.equal(g.player.hp,hp-20);g.mode='paused';g.player.charge=100;assert.equal(g.castSkill(),false);assert.equal(g.player.charge,100);
});

test('lethal contact cannot be hidden by a same-frame level-up or treasure pickup',()=>{
  const g=new Game();g.player.hp=1;g.player.invulnerable=0;g.spawnDrop('xp',800,800,40);g.spawnDrop('chest',800,800,1);g.spawnEnemy('beetle',{x:800,y:800,hp:10000,maxHp:10000,speed:0,damage:200});
  g.step(1/60);assert.equal(g.mode,'defeat');assert.equal(g.player.hp,0);assert.equal(g.pending,0);assert.equal(g.xp,0);assert.equal(g.treasure,null);
});

test('lethal danger resolves before a same-frame level-up pickup',()=>{
  const g=new Game();g.player.hp=5;g.player.invulnerable=0;g.spawnDrop('xp',800,800,40);g.hazards.push({id:g.uid++,kind:'blast',x:800,y:800,r:50,wait:0,life:1,damage:10,hit:false});
  g.step(1/60);assert.equal(g.mode,'defeat');assert.equal(g.player.hp,0);assert.equal(g.pending,0);assert.equal(g.xp,0);assert.equal(g.drops.length,1);
});

test('shrines are single-use and save across restoration',()=>{
  const g=new Game();g.player.x=500;g.player.y=480;g.player.hp=50;assert.equal(g.useShrine(),true);assert.equal(g.useShrine(),false);assert.ok(g.player.hp>50);const copy=Game.restore(g.snapshot());assert.equal(copy.shrines[0].used,true);assert.equal(copy.useShrine(),false);
});

test('corrupt saves reject incompatible versions, nonfinite data, unknown equipment and duplicate entities',()=>{
  const base=new Game().snapshot();for(const mutate of [d=>d.version=99,d=>d.player.x=Infinity,d=>d.weapons[0].id='missing',d=>d.weapons.push({...d.weapons[0]}),d=>d.rng=0,d=>d.player.hp=-1,d=>d.player.dx='bad',d=>d.meta.power='bad',d=>d.view.w=Infinity]){const data=structuredClone(base);mutate(data);assert.throws(()=>Game.restore(data));}
  const g=new Game();g.spawnEnemy();const data=g.snapshot();data.enemies.push({...data.enemies[0]});assert.throws(()=>Game.restore(data));
});

test('all nine guardians finish a real first expedition; later chapters reach their own final bosses',()=>{
  const cases=HEROES.map(h=>({hero:h.id,stage:'garden'})).concat([{hero:'luna',stage:'cathedral'},{hero:'rumi',stage:'rift'}]);
  for(const options of cases){const {game:g,peaks}=simulateExpedition({...options,seed:2026});assert.equal(g.mode,'victory',options.hero+' / '+options.stage);assert.ok(g.time>=STAGE[options.stage].duration);assert.equal(g.bossesKilled,3);assert.ok(g.kills>100);assert.ok(g.skilled>0);for(const key of Object.keys(peaks))assert.ok(peaks[key]<=LIMITS[key]);}
});

const enemy=(g,x=900,y=800)=>g.spawnEnemy('beetle',{x,y,hp:100000,maxHp:100000,speed:0,damage:0});
const equip=(g,id,level=2)=>{if(!g.weapons.some(w=>w.id===id))g.weapons.push({id,level,timer:0,damage:0,evolved:false});else g.weapons.find(w=>w.id===id).level=level;g.recompute();};
test('every guardian casts from upper-body height; fast shots sweep the target body',()=>{
  for(const h of HEROES)for(let facing=0;facing<4;facing++){
    const g=new Game({hero:h.id});g.player.facing=facing;enemy(g,980,810);g.grid.rebuild(g.enemies);g.fire(g.weapons[0]);const origin=muzzlePoint(g.player,h.id),event=g.drainEvents().find(e=>e.type==='cast');assert.deepEqual({x:event.x,y:event.y},origin);assert.ok(origin.y<=g.player.y-30&&origin.y>=g.player.y-44);for(const shot of g.shots){assert.equal(shot.x,origin.x);assert.equal(shot.y,origin.y);}
  }
  const g=new Game();enemy(g,900,800);g.grid.rebuild(g.enemies);const e=g.enemies[0],body=targetPoint(e);g.shots.push({id:g.uid++,weapon:'blade',kind:'blade',x:750,y:body.y,ox:750,oy:body.y,vx:10000,vy:0,speed:10000,life:1,damage:10,pierce:0,radius:2,hits:[]});g.updateShots(.03);assert.ok(e.hp<e.maxHp);
});
test('rank five + one relic evolves; discovery guarantees progress without erasing other choices',()=>{
  const g=new Game();equip(g,'star',EVOLUTION.weapon);g.relics=[{id:'prism',level:1}];g.recompute();assert.ok(g.offers().some(o=>o.type==='evolution'&&o.id==='star'));g.applyOption({type:'evolution',id:'star'});assert.equal(g.weapons[0].evolved,true);assert.equal(g.weapons[0].level,6);assert.equal(g.metrics.firstEvolution,0);
  const fresh=new Game();for(let i=0;i<20;i++){const offers=fresh.offers();assert.equal(offers.length,3);assert.ok(offers.some(o=>o.type==='weapon'&&o.id===HERO[fresh.hero].weapon));assert.ok(offers.some(o=>o.type==='relic'&&o.id===WEAPON[HERO[fresh.hero].weapon].relic));}
});
test('all four resonances activate at two ranks and produce their advertised combat effects',()=>{
  for(const b of BONDS){const g=new Game();for(const id of b.weapons)equip(g,id);assert.ok(g.stats.bonds.includes(b.id));}
  const g=new Game();equip(g,'thunder');enemy(g,850,800);enemy(g,900,800);g.grid.rebuild(g.enemies);g.hit(g.enemies[0],10,'star');assert.ok(g.enemies[1].hp<g.enemies[1].maxHp);const total=g.totalDamage;g.triggerBond('aurora',g.enemies[0],10);assert.equal(g.totalDamage,total,'bond cooldown prevents recursive storms');
  const steam=new Game({hero:'zeke'});equip(steam,'frost');enemy(steam,830,800);steam.enemies[0].slow=2;steam.grid.rebuild(steam.enemies);steam.fire(steam.weapons[0]);assert.ok(steam.events.some(e=>e.type==='blast'&&e.bond==='steam'));
  const bloom=new Game({hero:'jasmine'});equip(bloom,'rose');bloom.player.hp=50;for(let i=0;i<20;i++){enemy(bloom);bloom.hit(bloom.enemies.at(-1),200000,'flower');}assert.equal(bloom.player.hp,55);
  const night=new Game({hero:'night_rabbit'});equip(night,'cosmos');enemy(night);night.grid.rebuild(night.enemies);night.fire(night.weapons[0]);assert.ok(night.fields[0].r>(62+2*7)*night.stats.area);night.updateFields(.02);assert.ok(night.enemies[0].freeze>0);
});
test('thirty chained kills trigger a bounded overdrive; inactivity breaks a chain',()=>{
  const g=new Game();for(let i=0;i<30;i++){enemy(g);g.hit(g.enemies.at(-1),200000,'star');}assert.equal(g.overdrive,8);assert.equal(g.overdrives,1);assert.equal(g.combo,0);assert.ok(g.drops.some(d=>d.pull));assert.equal(g.overdriveCooldown,18);
  for(let i=0;i<30;i++){enemy(g);g.hit(g.enemies.at(-1),200000,'star');}assert.equal(g.overdrives,1);g.spawnTimer=1000;g.eliteTimer=1000;g.introSpawned=true;g.drops=[];g.comboTimer=.001;g.step(.02);assert.equal(g.combo,0);
});
test('renewal state survives reload; old saves keep original expedition length; malformed new state fails closed',()=>{
  const g=new Game();g.focusRecipe='sun';g.combo=17;g.overdrive=4;g.bondTimers.aurora=.5;g.metrics.firstHit=2;const copy=Game.restore(g.snapshot());assert.deepEqual(copy.snapshot(),g.snapshot());
  const legacy=g.snapshot();for(const key of ['duration','introSpawned','focusRecipe','combo','comboTimer','comboBest','overdrive','overdriveCooldown','overdrives','bondTimers','metrics'])delete legacy[key];const migrated=Game.restore(legacy);assert.equal(migrated.duration,360);assert.equal(migrated.combo,0);assert.equal(migrated.bondTimers.aurora,0);
  for(const patch of [{bondTimers:null},{bondTimers:[]},{metrics:null},{metrics:{}},{focusRecipe:'unknown'},{duration:0},{overdrive:Infinity}])assert.throws(()=>Game.restore({...g.snapshot(),...patch}));
});
test('evolved sun adds two rays and evolved clock holds enemies between ticks',()=>{
  const g=new Game({hero:'silver_rabbit'});enemy(g);g.grid.rebuild(g.enemies);g.fire(g.weapons[0]);assert.equal(g.drainEvents().filter(e=>e.type==='beam').length,1);g.weapons[0].evolved=true;g.fire(g.weapons[0]);assert.equal(g.drainEvents().filter(e=>e.type==='beam').length,3);
  const clock=new Game({hero:'time_ruler'});enemy(clock);clock.grid.rebuild(clock.enemies);clock.weapons[0].evolved=true;clock.fire(clock.weapons[0]);clock.updateFields(.02);assert.equal(clock.enemies[0].freeze,.3);
});
