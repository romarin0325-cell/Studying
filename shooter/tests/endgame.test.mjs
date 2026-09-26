import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../engine.js';
import {STAGES,DUNGEONS} from '../content.js';
import {createProfile,consumeRandom,randomRemaining,randomHero,RANDOM_DAILY_LIMIT,claimDungeon,drawArtifact,loadoutStats,recordDungeonClear,achievementProgress} from '../meta.js';
const tick=(g,t,dt=1/60)=>{for(let elapsed=0;elapsed<t-1e-9;elapsed+=dt)g.update(Math.min(dt,t-elapsed));};
function combat(options={}){const g=new Game(options);g.phase='boss';g.player.x=g.player.targetX=225;g.player.y=g.player.targetY=500;g.player.invincible=0;return g;}
function target(g,x=225,y=150,r=25){g.spawnEnemy(x,y,{hp:1e7,r,speed:0,fire:999,image:0});return g.enemies.at(-1);}
test('random is uniform over all nine heroes and limited to three persisted reveals per local day',()=>{
 for(let i=0;i<9;i++)assert.equal(randomHero(createProfile(),()=>(i+.5)/9),i);
 let p=createProfile();const today=new Date(2026,8,14,23,59),tomorrow=new Date(2026,8,15);
 for(let i=0;i<RANDOM_DAILY_LIMIT;i++){assert.equal(consumeRandom(p,()=>(i+.5)/9,today),i);p=createProfile(JSON.parse(JSON.stringify(p)));}
 assert.equal(randomRemaining(p,today),0);
 assert.equal(consumeRandom(p,()=>{throw Error('exhausted draw must not roll')},today),null);
 assert.equal(randomRemaining(p,tomorrow),RANDOM_DAILY_LIMIT);assert.equal(consumeRandom(p,()=>.99,tomorrow),8);assert.equal(randomRemaining(p,tomorrow),RANDOM_DAILY_LIMIT-1);
});
test('old Chaos claims and tickets migrate once and all ticket rarities use the same 15 percent base boundary',()=>{
 const date=new Date(2026,8,14),old={version:2,claims:{'2026-09-14:3':'hard'},tickets:[{dungeon:3,difficulty:'hard'}]};
 const p=createProfile(old);assert.equal(p.claims['2026-09-14:5'],'hard');assert.equal(p.claims['2026-09-14:3'],undefined);assert.equal(p.tickets[0].dungeon,5);
 assert.equal(claimDungeon(p,5,'hard',date),null);assert.equal(claimDungeon(p,3,'hard',date).count,2);assert.equal(p.tickets.length,3);
 assert.deepEqual(createProfile(JSON.parse(JSON.stringify(p))),p);
 for(const difficulty of ['easy','normal','hard'])for(const [chance,rarity] of [[.1499,'rare'],[.15,'epic'],[.16,'normal']]){
   const q=createProfile();q.tickets=[{dungeon:0,difficulty}];let n=0;assert.equal(drawArtifact(q,()=>n++===0?chance:0).artifact.rarity,rarity);
 }
});
test('movement and initial power artifacts add together without changing hitbox or later-stage power',()=>{
 assert.equal(loadoutStats(['mirror','boots']).speed,-100);
 for(const [ids,speed] of [[[],1250],[['mirror'],950],[['boots'],1450],[['mirror','boots'],1150]]){
  const g=combat({artifacts:ids});g.move(225,800);g.update(.05);assert.equal(g.player.y,500+speed*.05);
 }
 const g=combat({artifacts:['origin']});assert.equal(g.power,2);g.power=4;g.startStage(0,1);assert.equal(g.power,4);
});
test('light and dark fairies each fire independently with identical damage',()=>{
 const damage=[];
 for(const artifacts of [['leaf'],['mirror'],['leaf','mirror']]){
  const g=combat({hero:3,artifacts});g.player.fire=999;const e=target(g,225,250,80);tick(g,3);damage.push(e.maxHp-e.hp);
 }
  assert.ok(damage[0]>0);assert.equal(damage[0],damage[1]);assert.ok(Math.abs(damage[2]-damage[0]*2)<1e-6);
  const shot=combat({artifacts:['leaf']});shot.player.fire=999;shot.update(.01);assert.equal(shot.shots[0].damage,15);
});
test('stage recovery triggers once before optional quiz, also on final boss and respects caps',()=>{
 const g=combat({artifacts:['will','moonlight']});g.player.lives=1;g.bombs=0;g.phase='wave';g.clearRoom();g.clearRoom();assert.equal(g.player.lives,2);assert.equal(g.bombs,1);
 g.phase='quiz';g.completeQuiz();g.phase='wave';g.clearRoom();assert.equal(g.player.lives,3);assert.equal(g.bombs,2);
 g.startStage(0,2);g.spawnBoss();g.phase='boss';g.damage(g.boss,1e8,0,0);assert.equal(g.player.lives,4);assert.equal(g.bombs,3);
 g.roomRecovered=false;g.player.lives=g.maxLife;g.bombs=g.maxBombs;g.recoverRoom();assert.equal(g.player.lives,g.maxLife);assert.equal(g.bombs,g.maxBombs);
});
test('shortened bombs retain damage budgets at different frame steps and Night pays a power level',()=>{
 // Reproduced from origin/main engine at 60 Hz; Night's requested total is the exception.
 const totals=[1058,1300,1248,773,1058,1305,1900,1058,80];
  const durations=[4,2,3,3,3,3,3,3,10],invincibility=[4,2,3,3,3,3,3,3,2];
  for(const dt of [1/60,.05])for(let hero=0;hero<9;hero++){
  const g=combat({hero});g.player.fire=999;target(g);g.power=3;g.bomb();
   assert.equal(g.bombDuration,durations[hero]);assert.equal(g.player.invincible,invincibility[hero]);
  if(hero===6)assert.equal(g.power,2);tick(g,g.bombDuration+.1,dt);
  assert.ok(Math.abs(g.stats.damage-totals[hero])<1e-5,`${hero} at ${dt}: ${g.stats.damage}`);assert.equal(g.bombTime,0);
 }
});
test('Corona replaces every hero ultimate including healing, power cost, freeze and transformation',()=>{
 for(let hero=0;hero<9;hero++){
  const g=combat({hero,artifacts:['sun']});g.player.fire=999;g.player.lives=1;g.power=3;target(g);g.bomb();
   assert.equal(g.bombTime,1);assert.equal(g.player.invincible,1);assert.equal(g.stats.damage,2000);assert.equal(g.player.lives,1);assert.equal(g.power,3);assert.equal(g.frostTime,0);
   tick(g,1.1);assert.equal(g.stats.damage,2000);assert.equal(g.bombTime,0);
  }
  const g=combat({artifacts:['sun','spellbook','core']});target(g);g.bomb();assert.equal(g.stats.damage,3400);
});
test('Snow slow remains useful for five seconds after bomb immunity ends',()=>{
  const g=combat({hero:4});g.player.fire=999;g.bomb();tick(g,3);assert.ok(g.frostTime>4.99);assert.ok(g.player.invincible<1e-8);
 g.enemyBullet(20,200,Math.PI/2,100);tick(g,1);assert.ok(Math.abs(g.bullets[0].y-235)<1e-7);tick(g,4.1);assert.equal(g.frostTime,0);
});
test('Night large shot retains its size, gains damage and does not track an off-axis enemy',()=>{
 const g=combat({hero:6});target(g,400,150);g.fire(.01);const shot=g.shots[0];assert.equal(shot.r,28.8);assert.ok(Math.abs(shot.damage-94.248)<1e-8);assert.ok(!shot.homing);tick(g,.2);assert.equal(shot.x,225);
});
test('orbit sweeps fast movement and each enemy and each orb has its own damage cooldown',()=>{
 const g=combat({hero:8,weapon:1});g.player.x=g.player.targetX=30;
 const center=g.orbitCenters()[0],a=target(g,center.x,center.y),b=target(g,center.x+3,center.y);
 g.update(.001);assert.ok(a.hp<a.maxHp&&b.hp<b.maxHp);const first=a.hp;tick(g,.10);assert.equal(a.hp,first);tick(g,.04);assert.ok(a.hp<first);
 const fast=combat({hero:8,weapon:1});fast.player.x=fast.player.targetX=30;const initial=fast.orbitCenters()[0];const crossed=target(fast,initial.x-80,initial.y,1);
 // Radius endpoints miss; relative sweep must still catch an enemy crossed in this frame.
 const before={x:initial.x-160,y:initial.y};fast.orbitHits=[new WeakMap(),new WeakMap()];
 fast.updateOrbit([before,{x:-999,y:-999}]);assert.ok(crossed.hp<crossed.maxHp);
 const size=fast.orbitCenters();assert.ok(Math.abs(size[0].x-size[1].x-230)<1e-6);
});
test('forest teleports after a visible warning and sea projectiles reflect only for their lifetime',()=>{
 const g=combat({stage:3});g.player.fire=999;const e=target(g,60,130);e.special=3;e.move='sentry';tick(g,2.4);assert.ok(e.teleportTarget);assert.ok(g.effects.some(f=>f.type==='teleport'));const old=e.x;tick(g,.7);assert.notEqual(e.x,old);
 const sea=combat({stage:4});sea.player.fire=999;sea.enemyBullet(443,200,0,200,{r:6,ricochet:5});tick(sea,.05);assert.ok(sea.bullets[0].vx<0);
 const bullet=sea.bullets[0];bullet.age=5.01;bullet.x=443;bullet.vx=200;tick(sea,.05);assert.ok(bullet.vx>0);
});
test('only Poseidon creates a telegraphed horizontal and vertical cross, both axes can hit',()=>{
 for(let stage=0;stage<6;stage++){
  const g=combat({stage});g.spawnBoss();g.phase='boss';g.boss.hp=g.boss.maxHp*.5;g.boss.y=150;g.player.fire=999;g.player.invincible=999;tick(g,1.5);
  assert.equal(g.hazards.some(h=>h.axis==='horizontal'),stage===4);
 }
 for(const axis of ['horizontal','vertical']){
  const g=combat({stage:4});g.addHazard(axis==='horizontal'?g.player.y:g.player.x,30,axis);g.hazards[0].age=1.3;g.player.fire=999;
  g.update(.05);assert.equal(g.player.lives,3);tick(g,.1);assert.equal(g.player.lives,2);
 }
});
test('lower dungeon health rises in steps while final Chaos stays at its prior health',()=>{
 assert.equal(DUNGEONS.filter(d=>!d.challengeOnly&&!d.event).length,6);assert.deepEqual(STAGES.slice(0,6).map(stage=>stage.hp),[5500,7200,9400,11900,14500,17000]);
 const g=combat({stage:2});g.player.fire=999;const e=target(g);e.special=2;e.countdown=3;tick(g,2.9);assert.equal(g.bullets.length,0);tick(g,.15);assert.equal(g.bullets.length,20);
});
test('base-six A and B weapon achievements track any and hard clears without rewards',()=>{
 const profile=createProfile();
 for(let dungeon=0;dungeon<6;dungeon++)recordDungeonClear(profile,3,0,dungeon,dungeon===5?'hard':'normal');
 let jasmine=achievementProgress(profile).filter(row=>row.hero===3&&row.weapon===0);
 assert.deepEqual(jasmine.map(row=>[row.progress,row.complete]),[[6,true],[1,false]]);
 for(let dungeon=0;dungeon<6;dungeon++)recordDungeonClear(profile,3,0,dungeon,'hard');
 jasmine=achievementProgress(createProfile(JSON.parse(JSON.stringify(profile)))).filter(row=>row.hero===3&&row.weapon===0);
 assert.ok(jasmine.every(row=>row.complete));assert.equal(achievementProgress(profile).length,24);
 assert.equal(recordDungeonClear(profile,5,0,0,'hard'),false);
});
test('power pickups keep 90 percent of the prior eligible drops',()=>{
 let eligible=0,dropped=0;const g=combat();g.drop=(_x,_y,type)=>{if(type==='power')dropped++;};
 for(let i=0;i<2000;i++){g.enemies=[];const e=target(g,100,100);e.elite=i%5===0;if((g.kills+1)%4===0||e.elite)eligible++;g.damage(e,1e9,e.x,e.y);}
 assert.ok(dropped/eligible>.86&&dropped/eligible<.94,`${dropped}/${eligible}`);
});
test('challenge ordinary enemies drop power at about twenty percent while elites keep legacy drops',()=>{
 let ordinary=0,elite=0;const g=combat({challenge:true});g.drop=(_x,_y,type)=>{if(type==='power')(g.__elite?elite++:ordinary++);};
 for(let i=0;i<4000;i++){g.enemies=[];const e=target(g,100,100);g.__elite=false;g.damage(e,1e9,e.x,e.y);}
 for(let i=0;i<1000;i++){g.enemies=[];const e=target(g,100,100);e.elite=true;g.__elite=true;g.damage(e,1e9,e.x,e.y);}
 assert.ok(ordinary/4000>.18&&ordinary/4000<.22,`${ordinary}/4000`);assert.ok(elite/1000>.86&&elite/1000<.94,`${elite}/1000`);
});
