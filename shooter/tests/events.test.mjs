import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../engine.js';
import {EVENT_DUNGEONS,STAGES,LIMITS} from '../content.js';
import {createProfile,weeklyEvent,weekKey,claimDungeon,recordDungeonClear} from '../meta.js';
const tick=(g,seconds)=>{for(let t=0;t<seconds-1e-9;t+=.01)g.update(Math.min(.01,seconds-t));};
const combat=stage=>{const g=new Game({stage});g.phase='boss';g.player.fire=999;g.player.invincible=999;return g;};

test('weekly event is deterministic, stable Monday through Sunday, and reaches all five identities',()=>{
  const seen=new Set();
  for(let week=0;week<104;week++){
    const monday=new Date(2026,0,5+week*7),event=weeklyEvent(monday);seen.add(event.id);
    for(let day=0;day<7;day++)assert.equal(weeklyEvent(new Date(2026,0,5+week*7+day,23,59,59)).id,event.id);
    assert.equal(weeklyEvent(new Date(monday)).id,event.id);
  }
  assert.equal(seen.size,5);assert.deepEqual(EVENT_DUNGEONS.map(d=>d.specialType),[1,4,3,0,2]);
  assert.equal(weekKey(new Date(2026,8,20,23,59)), '2026-09-14');
  assert.equal(weekKey(new Date(2026,8,21)), '2026-09-21');
});
test('eight independent weekly rewards persist, exclude inactive events, and cannot be doubled by difficulty changes',()=>{
  let p=createProfile();const date=new Date(2026,8,21),event=weeklyEvent(date);
  for(let id=0;id<=6;id++)assert.equal(claimDungeon(p,id,'normal',date).count,1);
  assert.equal(claimDungeon(p,event.id,'hard',date).count,2);
  for(const id of [0,1,2,3,4,5,6,...EVENT_DUNGEONS.map(d=>d.id)])assert.equal(claimDungeon(p,id,'hard',date),null);
  assert.equal(p.tickets.length,9);p=createProfile(JSON.parse(JSON.stringify(p)));assert.equal(p.tickets.length,9);
  assert.equal(p.tickets.at(-1).eventDungeon,event.id);assert.equal(p.tickets.at(-1).dungeon,7);
  const next=new Date(2026,8,28);assert.equal(claimDungeon(p,6,'hard',next).count,2);assert.equal(claimDungeon(p,weeklyEvent(next).id,'normal',next).count,1);
  assert.equal(recordDungeonClear(p,0,0,event.id,'normal'),false);
});
test('event stages share one mildly harder tier, celestial health rises and base-six health stays fixed',()=>{
  const chaos=combat(5);chaos.spawnWave();const hp=chaos.enemies[0].hp;
  const health=[];
  for(const d of EVENT_DUNGEONS){const g=combat(d.id);g.spawnWave();health.push(g.enemies[0].hp);assert.ok(g.enemies[0].hp>hp&&g.enemies[0].hp<hp*1.12);assert.equal(g.stage.duration,41.05);assert.equal(g.stage.hp,18200);}
  assert.equal(new Set(health).size,1);assert.equal(STAGES[6].hp,23100);
  assert.deepEqual(STAGES.slice(0,6).map(s=>s.hp),[5500,7200,9400,11900,14500,17000]);
  const celestial=combat(6);celestial.spawnEnemy(0,0,{hp:100});assert.ok(Math.abs(celestial.enemies[0].hp-100*celestial.difficulty.hp*1.55)<1e-9);
});
test('dessert offspring ignore attacks and bombs for exactly half a second without slow extending immunity',()=>{
  const g=combat(7);g.specialDeath({special:1,x:200,y:200});assert.equal(g.enemies.length,3);
  const child=g.enemies[0],hp=child.hp;child.slow=10;
  for(const kind of ['attack','bomb'])g.damage(child,1e9,child.x,child.y,kind);
  assert.equal(child.hp,hp);tick(g,.49);g.damage(child,1e9,child.x,child.y);assert.equal(child.hp,hp);
  tick(g,.02);g.damage(child,1e9,child.x,child.y);assert.ok(child.hp<=0);
  const normal=combat(1);normal.specialDeath({special:1,x:200,y:200});assert.equal(normal.enemies[0].spawnInvincible,0);
});
test('sealed explosion is larger and fully warned; other events retain their source special mechanic',()=>{
  const empire=combat(0),sealed=combat(10);for(const g of [empire,sealed])g.specialDeath({special:0,x:200,y:200});
  assert.equal(empire.effects[0].radius,82);assert.equal(sealed.effects[0].radius,120);assert.equal(sealed.effects[0].wait,1);
  for(const d of EVENT_DUNGEONS){const g=combat(d.id);g.wave=1;g.spawnWave();assert.ok(g.enemies.some(e=>e.special===d.specialType));}
  const sea=combat(8);sea.spawnEnemy(200,150,{hp:100,special:4,r:20,speed:0,fire:0});tick(sea,.01);assert.equal(sea.bullets.length,4);assert.ok(sea.bullets.every(b=>b.ricochet===5));
  const soul=combat(9);soul.spawnEnemy(200,150,{hp:100,special:3,r:20,speed:0,fire:999});tick(soul,2.4);assert.ok(soul.enemies[0].teleportTarget);tick(soul,.7);assert.notEqual(soul.enemies[0].x,200);
  const forest=combat(3);forest.wave=1;forest.spawnWave();const forestTeleporter=forest.enemies.find(e=>e.special===3);
  const cavern=combat(9);cavern.wave=1;cavern.spawnWave();const cavernTeleporter=cavern.enemies.find(e=>e.special===3);
  assert.ok(cavernTeleporter.maxHp>forestTeleporter.maxHp&&cavernTeleporter.maxHp<forestTeleporter.maxHp*1.2);
  const time=combat(11);time.spawnEnemy(200,150,{hp:100,special:2,countdown:3,r:20,speed:0,fire:999});tick(time,3.01);assert.equal(time.bullets.length,20);
});
test('all fifteen event boss phases are finite, capped and leave broad ring corridors',()=>{
  for(const d of EVENT_DUNGEONS)for(let phase=0;phase<3;phase++){
    const g=combat(d.id);g.startStage(d.id,2);g.spawnBoss();g.phase='boss';g.player.fire=999;g.player.invincible=999;g.boss.y=150;g.boss.hp=g.boss.maxHp*[1,.6,.3][phase];
    tick(g,16);assert.equal(g.bossPattern,phase);assert.ok(g.bullets.length>0&&g.stats.maxBullets<=LIMITS.bullets);
    assert.ok(g.bullets.every(b=>[b.x,b.y,b.vx,b.vy].every(Number.isFinite)));
    const fastest=Math.max(...g.bullets.map(b=>Math.hypot(b.vx,b.vy)));assert.ok(fastest>=125.9&&fastest<=142.1);
    assert.ok(g.stats.maxBullets>=38);
  }
  const g=combat(11);g.spawnBoss();g.phase='boss';g.boss.y=150;tick(g,1.8);assert.ok(g.bullets.some(b=>b.stopped));tick(g,1.2);assert.ok(g.bullets.every(b=>!b.stopped));
});
test('events finish after three rooms, never enter another event or the challenge chain',()=>{
  for(const d of EVENT_DUNGEONS){const g=new Game({stage:d.id});for(let room=0;room<3;room++){assert.equal(g.room,room);assert.equal(g.stageIndex,d.id);g.phase='quiz';assert.equal(g.completeQuiz(),true);}assert.equal(g.phase,'victory');assert.equal(g.finished,true);}
});
