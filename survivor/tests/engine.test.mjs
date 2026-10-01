import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SpatialHash,sweptHit} from '../src/engine.js';
import {HEROES,HERO,WEAPONS,WEAPON,LIMITS,STAGE} from '../src/content.js';
import {simulateExpedition} from '../scripts/simulate.mjs';
const advance=(g,seconds,input={x:0,y:0})=>{for(let i=0;i<seconds*60;i++){g.step(1/60,input);g.drainEvents();}};

test('fixed-step combat restores RNG, entities and pending choices exactly',()=>{
  const g=new Game({seed:179,hero:'luna'});advance(g,12,{x:.8,y:.25});g.player.charge=100;g.castSkill();advance(g,2);
  const copy=Game.restore(g.snapshot());
  for(let i=0;i<1800;i++){for(const run of [g,copy]){if(run.mode==='choice')run.choose(0);if(run.mode==='treasure')run.claimTreasure();run.step(1/60,{x:Math.sin(i/70)*.4,y:Math.cos(i/70)*.4});run.drainEvents();}}
  assert.deepEqual(copy.snapshot(),g.snapshot());
});

test('all nine starting weapons actually damage and each skill consumes charge once',()=>{
  for(const h of HEROES){const g=new Game({hero:h.id,seed:14});g.spawnTimer=1000;g.eliteTimer=1000;
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
  assert.equal(g.drops.find(d=>d.kind==='chest').value,2);g.updateDrops(1/60);assert.equal(g.mode,'treasure');assert.equal(g.gold,10);g.claimTreasure();g.updateDrops(1/60);assert.equal(g.mode,'treasure');assert.equal(g.gold,20);g.claimTreasure();assert.equal(g.weapons[0].level,3);assert.equal(g.drops.some(d=>d.kind==='chest'),false);
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
