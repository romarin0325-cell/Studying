import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SpatialHash,sweptHit,muzzlePoint,targetPoint,xpNeed,enemyHpScale,enemyDamageScale,metaGain,ENEMY_HP_SCALE_CAP} from '../src/engine.js';
import {HEROES,HERO,WEAPONS,WEAPON,HIDDEN_UNIONS,LIMITS,STAGE,STAGES,DIFFICULTIES,EVOLUTION,BONDS,META} from '../src/content.js';
import {BALANCE,fuseWeapons,updatePeriodicRelics,relicInterval} from '../src/nightfall.js';
import {bossArrival,bossMilestone} from '../src/ordeal.js';
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
    const shots=g.hazards.filter(h=>h.kind==='shot'),center=shots[Math.floor(shots.length/2)];
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
  g.hit(boss,boss.maxHp*2,'star');assert.equal(g.mode,'victory');g.step(1/60);assert.equal(g.mode,'victory');assert.equal(g.enemies.filter(e=>e.final).length,1);
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

test('all nine guardians can finish a gentle first expedition; later chapters reach their own final bosses',()=>{
  const cases=HEROES.map(h=>({hero:h.id,stage:'garden'})).concat([{hero:'luna',stage:'cathedral'},{hero:'rumi',stage:'rift'}]);
  for(const options of cases){let result;for(const seed of [2026,616,104]){result=simulateExpedition({...options,difficulty:'gentle',seed});if(result.game.mode==='victory')break;}const {game:g,peaks}=result;assert.equal(g.mode,'victory',options.hero+' / '+options.stage);assert.ok(g.time>=STAGE[options.stage].duration);assert.equal(g.bossesKilled,3);assert.ok(g.kills>100);assert.ok(g.skilled>0);for(const key of Object.keys(peaks))assert.ok(peaks[key]<=LIMITS[key]);}
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

test('fixed simulation interpolates continuous movement and gait at 60, 90, 120 and 144 Hz',async()=>{
  const {FIXED_DT,playerPose,followCamera}=await import('../src/motion.js');
  for(const hz of [60,90,120,144])for(const jitter of [false,true]){
    const g=new Game();g.introSpawned=true;g.spawnTimer=1000;g.eliteTimer=1000;let accum=0,time=0,camera=800,last=null,lastScreen=null;const speeds=[];
    for(let frame=0;frame<hz;frame++){
      const dt=(jitter?[.8,1.25,.95,1][frame%4]:1)/hz;time+=dt;accum+=dt;
      while(accum+1e-12>=FIXED_DT){g.step(FIXED_DT,{x:1,y:0});accum-=FIXED_DT;}
      const pose=playerPose(g.player,accum/FIXED_DT,{x:1,y:0});assert.equal(pose.moving,true,'held movement never becomes an idle render frame');
      camera=followCamera(camera,last??800,pose.x,dt);const screen=pose.x-camera;
      if(frame>3){assert.ok(Math.abs((pose.x-last)/dt-175)<1e-7,`${hz} Hz: no repeated position or step jump`);assert.ok(screen>lastScreen,`${hz} Hz: camera never pulls the moving player backwards`);speeds.push((screen-lastScreen)/dt);}
      last=pose.x;lastScreen=screen;
    }
    assert.ok(Math.abs(g.player.moveDistance-g.time*175)<1e-7);for(let i=1;i<speeds.length;i++)assert.ok(Math.abs(speeds[i]-speeds[i-1])/speeds[i-1]<.3,'screen velocity changes smoothly');
    const saved=g.snapshot(),restored=Game.restore(saved);assert.deepEqual(restored.snapshot(),saved,'gait phase survives reload');
  }
});

const quiet=g=>{g.introSpawned=true;g.spawnTimer=1000;g.eliteTimer=1000;for(const w of g.weapons)w.timer=1000;return g;};
test('hidden echo performs a real second cast after its delay and persists the pending attack',()=>{
  const g=quiet(new Game());g.secrets=['echo'];enemy(g);g.grid.rebuild(g.enemies);g.fire(g.weapons[0]);assert.equal(g.echoes.length,1);
  const restored=Game.restore(g.snapshot());let casts=0;for(let i=0;i<80;i++){restored.step(1/60);casts+=restored.drainEvents().filter(e=>e.type==='cast').length;}
  assert.equal(casts,1,'restored run emits only the delayed cast; original cosmetic events are not replayed');assert.equal(restored.echoes.length,0);assert.ok(restored.weapons[0].damage>0);
});
test('mirror dash converts actual enemy shots into damaging allied projectiles',()=>{
  const g=quiet(new Game());g.secrets=['mirror'];enemy(g,1000,800);g.grid.rebuild(g.enemies);g.hazardShot(850,770,Math.PI,100,12);const hostile=g.hazards[0];assert.ok(g.dash());assert.ok(hostile.hit);assert.ok(g.shots.some(s=>s.reflected));advance(g,1.5);assert.ok(g.weapons[0].damage>=60);assert.equal(g.damageTaken,0);
});
test('stationary time pocket freezes nearby enemies; moving releases them',()=>{
  const g=quiet(new Game());g.secrets=['pocket'];const e=g.spawnEnemy('beetle',{x:920,y:800,speed:70,damage:0,hp:10000,maxHp:10000});advance(g,.75);const frozen=e.x;advance(g,.5);assert.equal(e.x,frozen);advance(g,.5,{x:-1,y:0});assert.ok(e.x<frozen);assert.equal(g.stillness,0);
});
test('doorway dash returns to its actual origin without interpolating across the teleport',()=>{
  const g=quiet(new Game());g.secrets=['portal'];g.step(1/60,{x:1,y:0});const origin={x:g.player.x,y:g.player.y};assert.ok(g.dash());advance(g,.8,{x:1,y:0});assert.ok(g.player.x>origin.x+80);const restored=Game.restore(g.snapshot());assert.ok(restored.dash());assert.equal(restored.player.x,origin.x);assert.equal(restored.player.y,origin.y);assert.equal(restored.player.prevX,origin.x);assert.equal(restored.portal,null);
});
test('relic awakenings change reflection, skill-time and dash attacks rather than just stats',()=>{
  const mirror=quiet(new Game({hero:'cinderella'}));mirror.weapons[0].evolved=true;mirror.relics=[{id:'mirror',level:3}];mirror.recompute();assert.ok(mirror.stats.awakened.includes('mirror'));enemy(mirror,1200);mirror.grid.rebuild(mirror.enemies);mirror.fire(mirror.weapons[0]);const shot=mirror.shots[0];shot.x=46;shot.y=780;shot.vx=-200;shot.vy=0;mirror.updateShots(1/60);assert.equal(shot.bounces,1);assert.ok(shot.vx>0);
  const time=quiet(new Game({hero:'time_ruler'}));time.weapons[0].evolved=true;time.relics=[{id:'hourglass',level:3}];time.recompute();time.hazardShot(800,500,Math.PI/2,120,20);time.castSkill();time.hazards=[];time.hazardShot(800,500,Math.PI/2,120,20);const danger=time.hazards[0];advance(time,1);assert.equal(danger.y,500);assert.ok(time.timeStop>0);
  const wind=quiet(new Game());equip(wind,'storm',6);wind.weapons.find(w=>w.id==='storm').evolved=true;wind.relics=[{id:'feather',level:3}];wind.recompute();enemy(wind,800,900);wind.grid.rebuild(wind.enemies);wind.dash();assert.ok(wind.totalDamage>0);assert.ok(wind.player.dashCooldown<2);
});
test('endless bosses reserve capacity and keep cycling without time-triggered victory',()=>{
  const g=quiet(new Game({runMode:'endless'}));g.time=g.duration;g.bossesSpawned=2;for(let i=0;i<LIMITS.enemies;i++)g.spawnEnemy();g.director(1/60);const boss=g.enemies.find(e=>e.boss);assert.ok(boss);assert.equal(boss.final,false);g.hit(boss,1e8,'star');assert.equal(g.mode,'playing');g.time=g.duration+60;g.director(1/60);assert.equal(g.bossesSpawned,4);assert.ok(g.enemies.some(e=>e.boss));assert.ok(g.enemies.length<=LIMITS.enemies);
});
test('seeded night rules, transactional encounter choices and growth history restore exactly',()=>{
  assert.equal(new Game({seed:122}).omen,new Game({seed:122}).omen);assert.ok(new Set([1,2,3,40000,90000].map(seed=>new Game({seed}).omen)).size>1);
  const g=quiet(new Game());g.encounters.push({id:g.uid++,kind:'altar',x:800,y:800,life:40,progress:0,used:false,title:'test',secret:'echo'});assert.ok(g.useEncounter());const copy=Game.restore(g.snapshot()),hp=copy.player.maxHp;assert.equal(copy.mode,'anomaly');assert.deepEqual(copy.encounterOffers,g.encounterOffers);assert.ok(copy.chooseEncounter(0));assert.ok(copy.secrets.includes('echo'));assert.ok(copy.player.maxHp<hp);assert.equal(copy.chooseEncounter(0),false);advance(copy,11,{x:.1,y:0});assert.ok(copy.growthHistory.length>=2);assert.deepEqual(Game.restore(copy.snapshot()).snapshot(),copy.snapshot());
  const saved=copy.snapshot();for(const patch of [{secrets:['bad']},{secrets:['echo','echo']},{runMode:'bad'},{encounters:null},{echoes:[{weapon:'star',wait:10}]},{growthHistory:[{time:1,level:2,dps:'bad',kills:1,evolutions:0}]},{portal:{x:-1,y:800,life:2}},{cycle:1.2},{growthDamage:-1},{encounterOffers:[{type:'gift',id:'gift',price:20}]},{reverieVersion:undefined}])assert.throws(()=>Game.restore({...saved,...patch}));
  const legacy=new Game().snapshot();for(const key of ['reverieVersion','runMode','omen','limitBreak','secrets','encounters','encounterOffers','encounterIndex','nextEncounter','conditionFlags','stillness','echoes','portal','timeStop','lifePrice','eclipseAt','growthHistory','growthAt','growthDamage','cycle','fieldGiftAt'])delete legacy[key];legacy.totalDamage=500;const migrated=quiet(Game.restore(legacy));assert.equal(migrated.omen,'legacy');assert.equal(migrated.runMode,'expedition');assert.deepEqual(Game.restore(migrated.snapshot()).snapshot(),migrated.snapshot());advance(migrated,19);assert.ok(migrated.encounters.every(e=>['lantern','altar'].includes(e.kind)));assert.equal(migrated.growthHistory[0].dps,0,'the first new window excludes damage accumulated before migration');assert.deepEqual(Game.restore(migrated.snapshot()).snapshot(),migrated.snapshot(),'legacy play remains resumable after the first scheduled encounter');assert.throws(()=>Game.restore({...legacy,conditionFlags:'bad'}));
  const long=quiet(new Game({runMode:'endless'}));long.level=105;long.need=1200;assert.equal(Game.restore(long.snapshot()).level,105,'endless saves keep levels above the old 99 limit');
  const bloom=quiet(new Game());bloom.omen='bloom';bloom.player.hp=20;const shrine=bloom.shrines.find(s=>s.id==='dawn');bloom.player.x=shrine.x;bloom.player.y=shrine.y;assert.ok(bloom.useShrine());assert.equal(bloom.player.hp,20+bloom.player.maxHp*.15,'bloom grants the advertised extra shrine healing');
});

test('endless limit break continues actual weapon growth beyond complete equipment and level 99',()=>{
  const g=quiet(new Game({runMode:'endless'}));g.weapons=['star','blade','flower','sun','storm','light'].map(id=>({id,level:6,evolved:true,timer:1000,damage:0}));g.relics=['prism','mirror','hourglass','feather'].map(id=>({id,level:3}));g.recompute();assert.ok(g.candidates().some(o=>o.type==='limit'));
  enemy(g,900,800);g.grid.rebuild(g.enemies);g.stats.crit=0;g.fire(g.weapons[1]);g.updateShots(.4);const base=g.weapons[1].damage;assert.ok(base>0);g.shots=[];g.applyOption({type:'limit',id:'power'});g.stats.crit=0;g.fire(g.weapons[1]);g.updateShots(.4);assert.ok(g.weapons[1].damage-base>=base*1.05,'the next attack really deals more damage');
  g.level=99;g.need=100;g.mode='playing';g.gainXP(100);assert.equal(g.level,100);assert.equal(g.mode,'choice');assert.ok(g.options.some(o=>o.type==='limit'));assert.deepEqual(Game.restore(g.snapshot()).snapshot(),g.snapshot());assert.throws(()=>Game.restore({...g.snapshot(),limitBreak:{power:-1,haste:0,area:0}}));
});

test('renewal curves slow levels, diminish memories and let enemies catch up',()=>{
  assert.deepEqual([5,10,20,30,35,40,50,80,100].map(xpNeed),[50,92,216,395,491,573,753,1295,1667]);
  for(const [time,hp,damage] of [[0,1,1],[60,1.52,1.04],[120,2.49,1.18],[150,3.39,null],[180,4.77,1.40],[210,6.78,null],[240,9.59,null]]){
    assert.ok(Math.abs(enemyHpScale(time)-hp)<.015,time+' hp');
    if(damage!=null)assert.ok(Math.abs(enemyDamageScale(time)-damage)<.015,time+' damage');
  }
  const grown=new Game({hero:'luna',meta:{power:10,heart:10,haste:10,magnet:10,speed:10,growth:10}});grown.omen='hunter';grown.recompute();
  assert.ok(Math.abs(grown.stats.damage-(1+metaGain(10,.05)))<1e-9);
  assert.ok(Math.abs(grown.player.maxHp-(HERO.luna.hp+metaGain(10,10)))<1e-6);
  assert.ok(Math.abs(grown.stats.cooldown-(1-metaGain(10,.03)))<1e-9);
  assert.ok(Math.abs(grown.stats.speed-(1+metaGain(10,.03)))<1e-9);
  assert.ok(Math.abs(grown.stats.magnet-(78*(1+metaGain(10,.15))*1.4))<1e-6);
  assert.ok(Math.abs(grown.stats.xp-(1+metaGain(10,.05)))<1e-9);
  const plain=new Game({hero:'luna'});plain.omen='hunter';plain.recompute();assert.equal(plain.stats.xp,1,'global experience multiplier is gone');
  const rumi=new Game();rumi.omen='hunter';rumi.recompute();assert.equal(rumi.stats.xp,1.15);
  const comet=new Game({hero:'luna'});comet.omen='comet';comet.recompute();assert.equal(comet.stats.xp,1.25);
  plain.time=180;const foe=plain.spawnEnemy('wisp',{x:plain.player.x+220,y:plain.player.y});
  assert.ok(Math.abs(foe.maxHp-18*enemyHpScale(180)*1.35*1.3)<1e-6);
  assert.ok(Math.abs(foe.damage-7*1.3*enemyDamageScale(180))<1e-6);
  plain.level=4;plain.need=1;plain.xp=0;plain.mode='playing';plain.pending=0;plain.gainXP(1);
  assert.equal(plain.level,5);assert.equal(plain.need,xpNeed(5));
  const opener=new Game({hero:'luna'});assert.equal(opener.need,12,'opening threshold grows by fifty percent');opener.omen='hunter';opener.recompute();opener.gainXP(12);assert.equal(opener.level,2);assert.equal(opener.need,xpNeed(2));
  assert.ok(enemyHpScale(240)<ENEMY_HP_SCALE_CAP);assert.equal(enemyHpScale(1e7),ENEMY_HP_SCALE_CAP);
});

test('rank twenty memories and capped late elites restore',()=>{
  const meta=Object.fromEntries(META.map(m=>[m.id,m.max]));
  const saved=new Game({hero:'luna',meta});
  assert.equal(saved.meta.power,20);assert.deepEqual(Game.restore(saved.snapshot()).snapshot(),saved.snapshot());
  const over=saved.snapshot();over.meta.heart=21;assert.throws(()=>Game.restore(over));
  const late=new Game({hero:'luna',stage:'rift',difficulty:'eclipse',runMode:'endless'});late.time=2250;late.introSpawned=true;late.spawnTimer=1000;late.eliteTimer=1000;
  const elite=late.spawnEnemy('elite',{x:late.player.x+220,y:late.player.y});
  assert.ok(elite.hp<13000000);assert.ok(elite.maxHp<13000000);assert.equal(elite.maxHp,220*enemyHpScale(2250)*1.8*1.3*1.3);
  assert.doesNotThrow(()=>Game.restore(late.snapshot()));
  const ember=new Game({hero:'luna'});ember.time=180;ember.introSpawned=true;const dying=ember.spawnEnemy('ember',{x:ember.player.x+180,y:ember.player.y,hp:1,maxHp:1});ember.hit(dying,10,'star');
  assert.ok(Math.abs(ember.hazards.at(-1).damage-10*enemyDamageScale(180))<1e-9);
});

test('health increase covers every enemy, boss override, difficulty and run mode',()=>{
  const bases={wisp:18,beetle:60,moth:32,stalker:26,ember:36,elite:220,boss:1000};
  for(const stage of STAGES)for(const difficulty of DIFFICULTIES)for(const runMode of ['expedition','endless']){
    const g=new Game({stage:stage.id,difficulty:difficulty.id,runMode});g.time=80;
    for(const [kind,base] of Object.entries(bases)){const foe=g.spawnEnemy(kind);assert.ok(Math.abs(foe.maxHp-base*enemyHpScale(80)*stage.danger*difficulty.hp*1.3)<1e-6,kind+' '+stage.id+' '+difficulty.id+' '+runMode);}
    const boss=bossArrival(2,stage.id,difficulty.id),foe=g.spawnEnemy('boss',boss);assert.equal(foe.hp,boss.hp*1.3);assert.equal(foe.maxHp,boss.maxHp*1.3);
    const runner=g.spawnEnemy('wisp',{hp:220,maxHp:220,runner:true});assert.equal(runner.maxHp,286);
  }
});
test('an active older save receives health and XP changes once without losing earned XP',()=>{
  const g=new Game();g.spawnEnemy('beetle');const old=g.snapshot();delete old.nightfallVersion;delete old.relicTimers;delete old.fusedWeapons;delete old.spentWeapons;delete old.peakWeapons;
  old.need=8;old.xp=3.25;old.enemies[0].hp=100;old.enemies[0].maxHp=200;
  const migrated=Game.restore(old);assert.equal(migrated.need,12);assert.equal(migrated.xp,3.25);assert.equal(migrated.enemies[0].hp,130);assert.equal(migrated.enemies[0].maxHp,260);
  assert.deepEqual(Game.restore(migrated.snapshot()).snapshot(),migrated.snapshot());
});
test('each hidden union consumes both maximum evolved weapons, releases a slot and restores',()=>{
  for(const recipe of HIDDEN_UNIONS){
    const g=new Game();g.weapons=[...recipe.weapons,...['star','blade','flower','storm']].map(id=>({id,level:6,evolved:true,timer:1000,damage:125}));g.recompute();g.fields=[];
    g.spawnEnemy('beetle',{x:920,y:800,hp:100000,maxHp:100000,speed:0,damage:0});g.grid.rebuild(g.enemies);for(const w of g.weapons.slice(0,2))g.fire(w);
    const damage=g.weapons.slice(0,2).reduce((n,w)=>n+w.damage,0);g.drainEvents();g.applyOption({type:'gold'});
    assert.equal(g.weapons.length,5);assert.equal(g.weapons.filter(w=>w.id===recipe.id).length,1);assert.equal(g.weapons.find(w=>w.id===recipe.id).damage,damage);assert.equal(g.peakWeapons,6);
    for(const id of recipe.weapons){assert.ok(!g.weapons.some(w=>w.id===id));assert.ok(!g.fields.some(f=>f.weapon===id));assert.ok(!g.shots.some(s=>s.weapon===id));assert.ok(!g.candidates().some(c=>['weapon','evolution'].includes(c.type)&&c.id===id));assert.equal(g.applyOption({type:'weapon',id}),false);}
    assert.ok(g.candidates().some(c=>c.type==='weapon'&&!g.weapons.some(w=>w.id===c.id)),'the released slot accepts another weapon');assert.equal(g.drainEvents().filter(e=>e.type==='union').length,1);
    assert.deepEqual(Game.restore(g.snapshot()).snapshot(),g.snapshot());fuseWeapons(g);assert.equal(g.weapons.length,5);
    const corrupt=g.snapshot();corrupt.spentWeapons=[];assert.throws(()=>Game.restore(corrupt));
  }
  const g=new Game();g.weapons=HIDDEN_UNIONS.flatMap(r=>r.weapons).map(id=>({id,level:6,evolved:true,timer:1,damage:0}));g.recompute();g.applyOption({type:'gold'});assert.equal(g.weapons.length,3);assert.equal(g.fusedWeapons.length,3);assert.deepEqual(Game.restore(g.snapshot()).snapshot(),g.snapshot());
});
test('one incomplete ingredient cannot trigger a union and ordinary resonance remains separate',()=>{
  const g=new Game();g.weapons=['ember','frost'].map(id=>({id,level:6,evolved:true,timer:1,damage:0}));g.weapons[1].level=5;g.recompute();fuseWeapons(g);assert.equal(g.weapons.length,2);assert.equal(g.fusedWeapons.length,0);assert.ok(g.stats.bonds.includes('steam'));
  g.weapons[1].level=6;g.applyOption({type:'gold'});assert.equal(g.weapons[0].id,'polar_phoenix');assert.ok(!g.stats.bonds.includes('steam'));
});
test('hidden weapons create different moving attacks and inflict actual damage',()=>{
  for(const recipe of HIDDEN_UNIONS){
    const g=new Game();g.weapons=recipe.weapons.map(id=>({id,level:6,evolved:true,timer:1,damage:0}));g.recompute();g.applyOption({type:'gold'});g.player.dx=1;g.player.dy=0;g.stats.crit=0;
    const foe=g.spawnEnemy('beetle',{x:920,y:800,hp:100000,maxHp:100000,speed:0,damage:0});g.grid.rebuild(g.enemies);assert.ok(g.fire(g.weapons[0]));const kinds=g.fields.map(f=>f.kind);assert.ok(kinds.every(k=>k===WEAPON[recipe.id].kind));
    const before=foe.hp;for(let i=0;i<150;i++)g.updateFields(1/60);assert.ok(foe.hp<before,recipe.id+' real damage');assert.ok(g.weapons[0].damage>0);assert.deepEqual(Game.restore(g.snapshot()).snapshot(),g.snapshot());
  }
});
test('holy bell grows random delayed impact circles and aqua wave hits only the forward fan',()=>{
  const bell=new Game();bell.spawnEnemy('beetle',{x:920,y:800,hp:100000,maxHp:100000,speed:0,damage:0});bell.grid.rebuild(bell.enemies);
  const w={id:'holy_bell',level:1,evolved:false,timer:1,damage:0};bell.weapons=[w];assert.ok(bell.fire(w));assert.equal(bell.fields.length,1);const small=bell.fields[0].r,impact=bell.fields[0];
  const victim=bell.spawnEnemy('beetle',{x:impact.x,y:impact.y,hp:10000,maxHp:10000,speed:0,damage:0});bell.grid.rebuild(bell.enemies);const before=victim.hp;bell.updateFields(.2);assert.equal(victim.hp,before);bell.updateFields(.2);bell.updateFields(.01);assert.ok(victim.hp<before);
  bell.fields=[];w.level=6;w.evolved=true;assert.ok(bell.fire(w));assert.equal(bell.fields.length,5);assert.ok(bell.fields.every(f=>f.r>small));assert.ok(new Set(bell.fields.map(f=>f.x+','+f.y)).size>1);
  const wave=new Game();wave.weapons=[{id:'aqua_wave',level:3,evolved:false,timer:1,damage:0}];wave.player.dx=1;wave.player.dy=0;
  const ahead=wave.spawnEnemy('beetle',{x:930,y:800,hp:10000,maxHp:10000,speed:0,damage:0}),behind=wave.spawnEnemy('beetle',{x:670,y:800,hp:10000,maxHp:10000,speed:0,damage:0});wave.grid.rebuild(wave.enemies);const hp=behind.hp;assert.ok(wave.fire(wave.weapons[0]));for(let i=0;i<70;i++)wave.updateFields(1/60);assert.ok(ahead.hp<hp);assert.equal(behind.hp,hp);
});
test('periodic relics retain their countdown on reload, generate chests and gather all pickup kinds',()=>{
  const g=new Game();g.relics=[{id:'santa',level:1},{id:'deep_orb',level:1}];g.recompute();updatePeriodicRelics(g,10);assert.equal(g.relicTimers.santa,30);assert.equal(g.relicTimers.deep_orb,22);
  const restored=Game.restore(g.snapshot());updatePeriodicRelics(restored,22);assert.equal(restored.relicTimers.santa,8);assert.equal(restored.relicTimers.deep_orb,32);
  for(const [i,kind] of ['xp','coin','heart','magnet','chest'].entries())restored.spawnDrop(kind,70+i*100,100,1);
  updatePeriodicRelics(restored,8);assert.ok(restored.drops.filter(d=>d.kind==='chest').length>=2);updatePeriodicRelics(restored,24);assert.ok(restored.drops.every(d=>d.pull));
  for(const id of ['santa','deep_orb'])assert.ok(relicInterval(id,3)<relicInterval(id,1));assert.deepEqual(Game.restore(restored.snapshot()).snapshot(),restored.snapshot());
});
test('new stages are denser and tougher, finish at four minutes, and retain endless continuation',()=>{
  for(const id of ['abyss','observatory']){
    assert.ok(STAGE[id].danger>STAGE.rift.danger);assert.ok(STAGE[id].density>1);assert.equal(bossMilestone(2,240,id),210);const early=new Game({stage:id});early.time=215;const last=early.spawnEnemy('boss',{hp:1,maxHp:1,final:true});early.hit(last,100000,'star');assert.equal(early.mode,'playing','new survival stage does not finish early on a boss kill');
    const g=new Game({stage:id});g.time=239.99;g.introSpawned=true;g.spawnTimer=1000;g.eliteTimer=1000;g.bossesSpawned=3;g.weapons[0].timer=1000;g.step(1/30);assert.equal(g.time,240);assert.equal(g.mode,'victory');
    const dead=new Game({stage:id});dead.time=239.99;dead.player.hp=0;dead.step(1/30);assert.equal(dead.mode,'defeat');
    const endless=new Game({stage:id,runMode:'endless'});endless.time=239.99;endless.bossesSpawned=3;endless.introSpawned=true;endless.spawnTimer=1000;endless.eliteTimer=1000;endless.step(1/30);assert.ok(endless.time>240);assert.equal(endless.mode,'playing');
  }
});
