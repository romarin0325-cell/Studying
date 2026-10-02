import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/engine.js';
import {BOSSES,bossArrival,bossMilestone,bossPattern,groundDanger} from '../src/ordeal.js';
import {STAGE,LIMITS} from '../src/content.js';
import {beforeCombat} from '../src/reverie.js';

test('initial chapter milestones stay intact; post-clear bosses arrive every sixty seconds',()=>{
  for(const stage of Object.keys(STAGE)){
    const duration=STAGE[stage].duration,g=new Game({stage,runMode:'endless'});g.introSpawned=true;g.spawnTimer=1000;g.eliteTimer=1000;g.nextRush=10000;
    assert.deepEqual([0,1,2,3,4,5].map(i=>bossMilestone(i,duration)),[duration*.25,duration*.6,duration,duration+60,duration+120,duration+180]);
    g.bossesSpawned=3;g.time=duration+59.99;g.director(.01);assert.equal(g.bossesSpawned,3);
    for(let i=1;i<=6;i++){g.time=duration+i*60;g.director(.01);const boss=g.enemies.at(-1);assert.equal(boss.overrun,i);assert.equal(boss.final,false);assert.equal(g.bossesSpawned,3+i);}
    assert.equal(g.mode,'playing');assert.equal(new Set(g.enemies.map(e=>e.bossKind)).size,6);
  }
  // Landscape/world-edge clamping must not create a boss on the player. The
  // arrival grace period also protects contact while its silhouette appears.
  for(const view of [{w:390,h:650},{w:900,h:300}])for(const x of [80,800,1520])for(const y of [80,800,1520]){
    const g=new Game({runMode:'endless'});g.view=view;g.player.x=x;g.player.y=y;g.player.invulnerable=0;g.introSpawned=true;g.spawnTimer=g.eliteTimer=1000;g.nextRush=10000;g.bossesSpawned=5;g.time=bossMilestone(5,g.duration);g.director(.01);
    const e=g.enemies.find(e=>e.boss);assert.ok(Math.hypot(e.x-x,e.y-y)>e.radius+11,'arrival stays clear of the player');
    g.player.x=e.x;g.player.y=e.y;const hp=g.player.hp;g.updateEnemies(.01);assert.equal(g.player.hp,hp,'arrival does not deal instant contact damage');
    e.spawnGuard=0;g.updateEnemies(.01);assert.ok(g.player.hp<hp,'contact damage resumes after arrival');
  }
});
test('boss pressure increases without exceeding persisted finite HP and movement bounds',()=>{
  let previous=0;
  for(let i=0;i<1440;i++){const boss=bossArrival(i,'rift','eclipse');assert.ok(boss.hp>=previous||i===3);assert.ok(boss.hp<=9999999);assert.ok(boss.speed<=210);assert.ok(boss.damage<=600);previous=boss.hp;}
  const g=new Game({runMode:'endless'});g.time=3600;g.bossesSpawned=60;g.director(.01);assert.doesNotThrow(()=>Game.restore(g.snapshot()));
  assert.ok(bossArrival(0,'garden','normal').hp>1300*3);assert.ok(bossArrival(2,'garden','normal').hp>7800*3);
});
test('line lanes and annulus holes agree with their visible geometry; dash awards once per danger',()=>{
  const g=new Game(),p=g.player;p.invulnerable=0;
  const line={id:g.uid++,kind:'line',x:p.x,y:p.y,ax:p.x-150,ay:p.y,bx:p.x+150,by:p.y,r:20,wait:.3,telegraph:.3,life:1.5,damage:30,tick:0,hit:false,grazed:false};
  assert.equal(groundDanger(line,p.x,p.y+29,8),false);assert.equal(groundDanger(line,p.x,p.y+27,8),true);
  g.hazards=[line];const hp=p.hp;g.updateHazards(.1);assert.equal(p.hp,hp,'telegraph does no damage');g.updateHazards(.21);assert.equal(p.hp,hp-30,'active lane deals damage');
  p.invulnerable=0;p.charge=20;line.tick=0;g.dash();g.updateHazards(.02);assert.equal(p.hp,hp-30);assert.equal(p.charge,26);g.updateHazards(.02);assert.equal(p.charge,26,'persistent zone cannot farm a graze');
  const ring={...line,kind:'annulus',r:180,inner:115};assert.equal(groundDanger(ring,p.x,p.y,8),false);assert.equal(groundDanger(ring,p.x+150,p.y,8),true);assert.equal(groundDanger(ring,p.x+200,p.y,8),false);
  assert.deepEqual(Game.restore(g.snapshot()).hazards,g.hazards);
});
test('all six concepts produce bounded, restorable dangers; malformed shapes fail closed',()=>{
  for(const bossKind of Object.keys(BOSSES))for(const hp of [1000,350]){
    const g=new Game(),e=g.spawnEnemy('boss',{bossKind,hp,maxHp:1000,patternStep:0,overrun:4});g.bossAttack(e);g.bossAttack(e);
    assert.ok(g.hazards.length<=LIMITS.hazards);assert.ok(bossPattern(e,g.player,g.stage).length>0);assert.doesNotThrow(()=>Game.restore(g.snapshot()));
    const data=g.snapshot(),bad=data.hazards.find(h=>h.kind!=='shot');bad.kind='line';bad.ax=Infinity;assert.throws(()=>Game.restore(data));
  }
  for(const mutate of [h=>h.inner=h.r,h=>h.inner=-1,h=>h.inner=NaN,h=>h.grazed='yes']){const g=new Game();g.hazards.push({id:g.uid++,kind:'annulus',x:800,y:800,r:180,inner:110,wait:1,life:2,damage:30,tick:0,telegraph:1,hit:false});const data=g.snapshot();mutate(data.hazards[0]);assert.throws(()=>Game.restore(data));}
});
test('overtime guardians resist permanent stillness but active time skills remain useful',()=>{
  const g=new Game({hero:'time_ruler',runMode:'endless'});g.secrets=['pocket'];g.stillness=1;
  const regular=g.spawnEnemy('boss',{x:850,y:800,overrun:0}),overtime=g.spawnEnemy('boss',{x:900,y:800,overrun:1});beforeCombat(g,.02);assert.ok(regular.freeze>0);assert.equal(overtime.freeze,0);
  g.castSkill();assert.ok(overtime.freeze>0);const danger={id:g.uid++,kind:'zone',x:800,y:800,r:60,wait:1,life:3,damage:20,tick:0,telegraph:1,hit:false};g.hazards=[danger];g.updateHazards(0);assert.equal(danger.wait,1);
});
