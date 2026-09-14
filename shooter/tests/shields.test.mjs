import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../engine.js';
import {ARTIFACTS,createProfile,drawArtifact} from '../meta.js';
const tick=(g,seconds,dt=1/60)=>{for(let t=0;t<seconds-1e-9;t+=dt)g.update(Math.min(dt,seconds-t));};
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);
function game(options={}){const g=new Game(options);g.phase='boss';g.player.x=g.player.targetX=225;g.player.y=g.player.targetY=600;g.player.invincible=0;g.player.fire=999;return g;}
function target(g,tags={},x=225,y=200){g.spawnEnemy(x,y,{hp:1e7,r:1,speed:0,fire:999,image:0,...tags});return g.enemies.at(-1);}
function graze(g,n){for(let i=0;i<n;i++){g.bullets=[];g.enemyBullet(g.player.x+18,g.player.y,0,0);g.update(.001);}}

test('ten new artifacts enter their rarity pools and survive save/load',()=>{
 const added=ARTIFACTS.slice(22);assert.equal(added.length,10);assert.equal(added.filter(a=>a.rarity==='normal').length,6);
 for(const a of added){const p=createProfile({owned:[a.id],equipped:[a.id]});assert.ok(p.owned.includes(a.id));assert.deepEqual(p.equipped,[a.id]);
  const pool=ARTIFACTS.filter(b=>b.rarity===a.rarity);p.tickets=[{difficulty:'normal',dungeon:0}];let i=0;
  assert.equal(drawArtifact(p,()=>i++===0?(a.rarity==='rare'?0:1):(pool.indexOf(a)+.5)/pool.length).artifact.id,a.id);
 }
});

test('draw uses 15 percent rare normally and 30 percent only on a correct optional quiz',()=>{
 for(const correct of [false,true])for(const difficulty of ['easy','normal','hard']){
  const boundary=correct?.30:.15;
  for(const roll of [0,boundary-.000001,boundary,.999999]){
   const p=createProfile({tickets:[{difficulty,dungeon:0},{difficulty,dungeon:1}]}),before=p.tickets.length;let n=0;
   const result=drawArtifact(p,()=>n++===0?roll:0,correct);assert.equal(result.artifact.rarity,roll<boundary?'rare':'normal');assert.equal(p.tickets.length,before-1);
   const next=drawArtifact(p,()=>.2);assert.equal(next.artifact.rarity,'normal','quiz benefit is not carried over');assert.equal(drawArtifact(p),null);
  }
 }
});

test('starting barrier absorbs a hit before shield artifact, without clearing bullets or losing resources',()=>{
 for(const cloak of [false,true]){
  const g=game({artifacts:['clover','shield',...(cloak?['cloak']:[])]});g.power=4;g.combo=20;g.comboTime=2;
  const resources=[g.player.lives,g.bombs,g.power,g.combo,g.stats.deaths];g.enemyBullet(225,600,0,0);g.enemyBullet(20,20,0,0);
  g.update(.001);assert.equal(g.player.barrier,false);assert.equal(g.bullets.length,2);near(g.player.invincible,cloak?4:2.5);
  assert.deepEqual([g.player.lives,g.bombs,g.power,g.combo,g.stats.deaths],resources);assert.ok(g.effects.some(f=>f.type==='barrierBreak'));
  assert.equal(g.hitPlayer(),false);tick(g,1);assert.equal(g.player.lives,resources[0]);
  g.player.invincible=0;g.hitPlayer();assert.equal(g.bombs,resources[1]-1);assert.equal(g.power,3);
 }
});

test('barrier protects against contact, lasers and detonation, with exactly one absorption',()=>{
 for(const kind of ['contact','laser','detonation']){
  const g=game({artifacts:['clover']});const life=g.player.lives;
  if(kind==='contact')target(g,{},225,600);
  if(kind==='laser')g.hazards.push({x:225,width:20,warn:0,age:1,life:10});
  if(kind==='detonation')g.effect('detonation',{x:225,y:600,radius:82,life:2,age:.8,fired:false});
  g.update(.001);assert.equal(g.player.barrier,false,kind);assert.equal(g.player.lives,life);assert.ok(g.player.invincible>0);
  g.player.invincible=0;g.hitPlayer();assert.equal(g.player.lives,life-1);
 }
});

test('glass slipper triggers every twenty distinct grazes without stacks, banked shields or immunity farming',()=>{
 const g=game({artifacts:['slipper']});graze(g,19);assert.equal(g.player.barrier,false);graze(g,1);assert.equal(g.player.barrier,true);
 const count=g.graze;g.update(.001);assert.equal(g.graze,count,'same bullet cannot count twice');
 graze(g,20);assert.equal(g.graze,40);assert.equal(g.player.barrier,true);assert.equal(g.grantBarrier(),false);
 g.hitPlayer();assert.equal(g.player.barrier,false);graze(g,30);assert.equal(g.graze,40);
 g.player.invincible=0;graze(g,19);assert.equal(g.player.barrier,false);graze(g,1);assert.equal(g.player.barrier,true);
 g.startStage(0,1);assert.equal(g.player.barrier,true);assert.equal(g.graze,60);
 const c=game({artifacts:['clover','slipper']});c.hitPlayer();c.startStage(0,1);assert.equal(c.player.barrier,false,'clover is run-start only');
 c.player.invincible=0;graze(c,20);assert.equal(c.player.barrier,true);
});

test('madness mask pays life without consuming or being blocked by a barrier',()=>{
 const g=game({hero:3,artifacts:['clover','mask']});g.bombs=0;const life=g.player.lives;
 assert.equal(g.bomb(),true);assert.equal(g.player.lives,life-1);assert.equal(g.player.barrier,true);assert.equal(g.maskUses,1);
});

test('hourglass grants two extra active combat seconds and still pauses with no enemies or during quizzes',()=>{
 const g=game({artifacts:['hourglass']});const e=target(g);e.hp=1;g.damage(e,100,0,0);near(g.comboTime,5.6);
 g.enemies=[];tick(g,2);near(g.comboTime,5.6);target(g);tick(g,4);assert.equal(g.combo,1);near(g.comboTime,1.6);
 g.phase='quiz';tick(g,10);near(g.comboTime,1.6);g.phase='boss';tick(g,1.7);assert.equal(g.combo,0);
});

test('enemy classification applies normal or elite/miniboss damage exactly once, including mixed tags',()=>{
 for(const [tags,expected] of [[{},120],[{special:3},120],[{elite:true},130],[{miniboss:true},130],[{elite:true,miniboss:true},130],[{boss:true},100]]){
  for(const kind of ['attack','bomb']){const g=game({artifacts:['witch','silver']});g.damage(target(g,tags),100,0,0,kind);near(g.stats.damage,expected);}
 }
 const g=game({artifacts:['silver','chocolate','crystal']});g.damage(target(g,{elite:true,miniboss:true}),100,0,0);near(g.stats.damage,185);
});

test('conditional attack bonuses add once and respond to bomb inventory and power changes',()=>{
 const g=game({artifacts:['eye','startboost','crystal']}),e=target(g);
 for(const [bombs,power,expected] of [[1,1,155],[0,1,185],[0,2,135],[1,2,105]]){g.bombs=bombs;g.power=power;const before=g.stats.damage;g.damage(e,100,0,0);near(g.stats.damage-before,expected);}
 const last=game({artifacts:['eye']});target(last);last.bombs=1;last.bomb();near(last.stats.damage,260*1.3);
});

test('normal-only modifiers do not leak into bomb impacts, pulses or transformed projectiles',()=>{
 for(const [ids,attack,bomb] of [[['bigbang'],.9,1.6],[['kaleidoscope'],1.3,.8],[['bigbang','kaleidoscope'],1.2,1.4],[['bigbang','kaleidoscope','crystal'],1.25,1.4*1.05]]){
  const g=game({artifacts:ids});const e=target(g);g.damage(e,100,0,0);near(g.stats.damage,100*attack);g.stats.damage=0;g.bomb();tick(g,4.1);near(g.stats.damage,1058*bomb);
  const time=game({hero:8,artifacts:ids});time.bomb();time.player.fire=0;time.fire(.001);assert.ok(time.shots.every(s=>s.damageKind==='bomb'));
  const t=target(time,{},time.shots[0].x,time.shots[0].y);time.shots=[time.shots[0]];time.shots[0].vx=time.shots[0].vy=0;time.update(.001);near(t.maxHp-t.hp,12.5*3.8*bomb);
 }
 for(const [ids,expected] of [[['sun','bigbang'],2720],[['sun','kaleidoscope'],1360]]){const g=game({artifacts:ids});target(g);g.bomb();near(g.stats.damage,expected);}
});

test('verdant dew removes one required P and adds five percent attack for standard and four-P heroes',()=>{
 for(const [hero,ids,req] of [[1,[],3],[1,['dew'],2],[0,[],4],[0,['dew'],3],[7,[],4],[7,['dew','origin'],3]]){const g=game({hero,artifacts:ids});let p=g.power;
  while(p<5){for(let i=1;i<req;i++){g.collect('power');assert.equal(g.power,p);}g.collect('power');assert.equal(g.power,++p);assert.equal(g.powerPoints,0);}
  const before=g.score;g.collect('power');assert.equal(g.power,5);assert.equal(g.score,before+250);g.hitPlayer();assert.equal(g.power,4);for(let i=0;i<req;i++)g.collect('power');assert.equal(g.power,5);
 }
 const plain=game({hero:1}),dew=game({hero:1,artifacts:['dew']}),a=target(plain),b=target(dew);plain.damage(a,100,0,0);dew.damage(b,100,0,0);near(a.maxHp-a.hp,100);near(b.maxHp-b.hp,105);
});

test('six requested weapons gain damage at every power without altering their firing intervals',()=>{
 for(const [hero,weapon,coefficient,bonus,period] of [[1,0,.75,1.1,.095],[2,1,5.5,1.05,.36],[4,0,1.215,1.1,.19],[5,0,2.535,1.1,.23],[6,0,6.72,1.1,.48],[8,0,1.9,1.1,.25]])
  for(const power of [1,2,3,4,5]){const g=game({hero,weapon});g.power=power;g.player.fire=0;g.fire(.001);near(g.shots[0].damage,(10+power*2.5)*(hero===2?1.1:1)*coefficient*bonus);near(g.player.fire,period);}
});

test('P5 shot geometry and control effects are captured when firing, including visible glass size',()=>{
 for(const p of [4,5]){
  const fire=(hero,weapon)=>{const g=game({hero,weapon});g.power=p;g.player.fire=0;g.fire(.001);return g;};
  assert.equal(fire(4,0).shots[0].slow,p===5?2:1.6);assert.equal(fire(4,1).shots[0].bounce,p===5?4:3);
  const glass=fire(5,0).shots;near(glass[0].r,p===5?13.2:12);assert.equal(glass[1].x-glass[0].x,p===5?32:26);
  near(fire(6,0).shots[0].r,p===5?38.8:28.8);
  for(const [hero,weapon,radius] of [[6,1,p===5?100:90],[7,1,p===5?110:100]]){
   const g=fire(hero,weapon),s=g.shots.find(s=>s.zone);g.power=1;g.plantZone(s);assert.equal(g.zones[0].r,radius);
   g.plantZone({...s,zone:true,zoneRadius:radius+1});assert.equal(g.zones.length,1);assert.equal(g.zones[0].r,radius+1);
  }
 }
});

test('P5 echo and mark explosions actually reach farther enemies, with matching visual radii',()=>{
 for(const [hero,weapon,distance,normal,powered] of [[7,0,88,80,96],[5,1,110,100,120]])for(const power of [4,5]){
  const g=game({hero,weapon});g.power=power;g.player.fire=0;g.fire(.001);const s=g.shots[0];g.shots=[s];s.vx=s.vy=0;s.homing=false;
  const e=target(g,{},s.x,s.y),other=target(g,{},s.x+distance,s.y);if(hero===5)e.marks=2;
  g.player.fire=999;g.update(.001);assert.equal(other.hp<other.maxHp,power===5);assert.ok(g.effects.some(f=>f.radius===(power===5?powered:normal)));
 }
});

test('hidden life and Night/Sisters bomb bonuses apply to initial resources and caps in all difficulties',()=>{
 for(const mode of ['easy','normal','hard'])for(let hero=0;hero<9;hero++){
  const base=game({mode,artifacts:['frozen','holy']}),g=game({hero,mode,artifacts:['frozen','holy']});const hidden=[5,7,8].includes(hero)?1:0,bombs=[6,7].includes(hero)?1:0;
  assert.equal(g.player.lives,base.player.lives+hidden);assert.equal(g.maxLife,base.maxLife+hidden);assert.equal(g.bombs,base.bombs+bombs);assert.equal(g.maxBombs,base.maxBombs+bombs);
  g.player.lives=1;g.bombs=0;g.startStage(0,1);assert.equal(g.player.lives,1);assert.equal(g.bombs,0);
 }
});

test('sea ricochet specialist gains ten percent health and one projectile while preserving cadence',()=>{
 const g=game({stage:4});g.wave=1;g.spawnWave();const e=g.enemies.find(e=>e.special===4);near(e.maxHp,255*1.15*1.1*1.14);assert.equal(e.elite,true);
 g.enemies=[e];e.x=e.ox=100;e.y=100;e.fire=0;g.update(.001);assert.equal(g.bullets.length,4);assert.ok(g.bullets.every(b=>b.ricochet===5));near(e.fire,2.9);
});
