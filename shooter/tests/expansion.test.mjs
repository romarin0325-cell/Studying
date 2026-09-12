import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../engine.js';
import {ARTIFACTS,DIFFICULTIES,createProfile,dailyHeroes,heroAvailable,unlockHero,weekKey,claimDungeon,drawArtifact,loadoutStats,normalizeDifficulty,randomHero} from '../meta.js';
import {LIBRARY,makeQuestion,recordAnswer} from '../learning.js';
import {Renderer} from '../render.js';
const tick=(g,t)=>{for(let i=0;i<t*60;i++)g.update(1/60);};
function target(g,x=225,y=200){g.spawnEnemy(x,y,{hp:100000,r:30,speed:0,fire:999,image:0});return g.enemies.at(-1);}
function combat(options={}){const g=new Game(options);g.phase='boss';g.player.x=g.player.targetX=225;g.player.y=g.player.targetY=400;return g;}
test('chain stays silent without targets and reacquires without petal fallback',()=>{const g=combat({hero:3});tick(g,.5);assert.equal(g.shots.length,0);assert.equal(g.stats.shots,0);const e=target(g);tick(g,.06);assert.ok(e.hp<e.maxHp);assert.ok(g.effects.some(f=>f.type==='chain'));});
test('laser focus resets across a gap and creates no stored beam trails',()=>{const g=combat({weapon:1}),e=target(g);tick(g,2);assert.ok(e.lock>1.8);assert.ok(!g.effects.some(f=>f.type==='beam'));g.move(400,400);tick(g,.5);g.move(225,400);tick(g,.16);assert.ok(e.lock<.3);tick(g,5);assert.equal(e.lock,3.25);});
test('all sixteen artifacts have live effects and stacking respects three distinct slots',()=>{
  assert.equal(ARTIFACTS.length,16);assert.equal(ARTIFACTS.filter(a=>a.rarity==='rare').length,6);
  const base=combat(),e=target(base);base.damage(e,100,0,0);
  for(const [ids,expected] of [[['pendant'],120],[['dragon'],140],[['chocolate'],150]]){const g=combat({artifacts:ids}),t=target(g);if(ids[0]==='pendant')g.power=5;if(ids[0]==='dragon')g.player.lives=1;if(ids[0]==='chocolate')t.miniboss=true;g.damage(t,100,0,0);assert.equal(g.stats.damage,expected);}
  assert.deepEqual(loadoutStats(['frozen','dream','nail']).maxLife,5);assert.equal(loadoutStats(['nail']).maxLife,2);assert.equal(loadoutStats(['nail','crystal']).attack,1.3);
  assert.equal(loadoutStats(['spellbook','crown','core']).bomb,2);assert.equal(loadoutStats(['holy']).bombs,4);assert.equal(loadoutStats(['holy']).maxBombs,6);
  assert.equal(loadoutStats(['dream','dream']).maxLife,6);assert.equal(loadoutStats(['spellbook','crown','core','dream']).maxLife,4);
  const cloak=combat({artifacts:['cloak']});cloak.player.invincible=0;cloak.hitPlayer();assert.equal(cloak.player.invincible,4);
  const shield=combat({artifacts:['shield']});shield.player.invincible=0;shield.hitPlayer();assert.equal(shield.player.lives,3);assert.equal(shield.bombs,2);shield.bombs=0;shield.player.invincible=0;shield.hitPlayer();assert.equal(shield.player.lives,2);
  const fairy=combat({artifacts:['leaf'],hero:3});tick(fairy,.35);assert.ok(fairy.stats.shots>=2);assert.ok(fairy.shots.some(s=>s.homing));
  const b=combat({artifacts:['spellbook','crown','core']});target(b);b.bomb();assert.equal(b.stats.damage,520);
});
test('madness mask cannot refund Jasmine, overlap, or exceed three uses per stage',()=>{
  const g=combat({hero:3,artifacts:['mask','frozen','dream']});g.bombs=0;target(g);
  assert.equal(g.player.lives,6);assert.ok(g.bomb());assert.equal(g.player.lives,5);assert.equal(g.maskUses,1);
  assert.equal(g.bomb(),false);assert.equal(g.player.lives,5);assert.equal(g.maskUses,1);
  let successes=1;
  for(let i=0;i<99;i++){g.bombTime=0;if(g.bomb())successes++;}
  assert.equal(successes,3);assert.equal(g.stats.bombs,3);assert.equal(g.maskUses,3);assert.equal(g.player.lives,3);assert.equal(g.stats.damage,780);
  g.startStage(0,1);g.phase='boss';g.bombs=0;assert.equal(g.maskUses,0);assert.ok(g.bomb());assert.equal(g.player.lives,2);
});
test('permanent and conditional attack artifacts add once while bomb bonuses stay separate',()=>{
  const mixed=combat({artifacts:['nail','crystal','chocolate']}),boss=target(mixed);boss.miniboss=true;mixed.damage(boss,100,0,0);assert.equal(mixed.stats.damage,180);
  const bomb=combat({artifacts:['nail','chocolate','spellbook']}),bombBoss=target(bomb);bombBoss.miniboss=true;bomb.bomb();assert.equal(bomb.stats.damage,546);
});
test('all four special monsters produce their promised patterns',()=>{
  const empire=combat();const e=target(empire);e.special=0;empire.damage(e,1e6,e.x,e.y);assert.equal(empire.bullets.length,0);tick(empire,.8);assert.ok(empire.bullets.length>=10);
  const light=combat({stage:1}),s=target(light);s.special=1;light.damage(s,1e6,s.x,s.y);const offspring=light.enemies.filter(e=>e.offspring);assert.equal(offspring.length,3);assert.ok(offspring.every(e=>e.speed===170&&e.special===undefined));
  const dark=combat({stage:2}),d=target(dark);d.special=2;d.countdown=.1;tick(dark,.2);assert.ok(dark.bullets.length>=20);
  const chaos=combat({stage:3});chaos.enemyBullet(225,260,Math.PI/2,30,{r:17,split:true});tick(chaos,.02);assert.equal(chaos.bullets.length,9);assert.ok(chaos.bullets.every(b=>!b.split&&b.r===4));
});
test('revival is one attempt per whole dungeon and all heals respect loadout cap',()=>{const g=combat();g.player.lives=1;g.player.invincible=0;g.hitPlayer();assert.equal(g.phase,'defeat');assert.ok(g.revive(true));assert.equal(g.player.lives,2);g.player.lives=1;g.player.invincible=0;g.hitPlayer();assert.equal(g.revive(true),false);const low=combat({hero:3,artifacts:['nail']});low.bomb();low.collect('life');assert.equal(low.player.lives,2);const wrong=combat();wrong.player.lives=1;wrong.player.invincible=0;wrong.hitPlayer();assert.equal(wrong.revive(false),false);assert.equal(wrong.revive(true),false);});
test('calendar rotation and off-day unlock expire at the next local day',()=>{const p=createProfile();for(let d=14;d<21;d++){const date=new Date(2026,8,d,12);assert.deepEqual(dailyHeroes(date),d<16?[0,1]:d<18?[2,3]:d<20?[4,6]:[0,1,2,3,4,6]);}const mon=new Date(2026,8,14,23,59);assert.equal(heroAvailable(p,4,mon),false);unlockHero(p,4,mon);assert.ok(heroAvailable(p,4,mon));assert.equal(heroAvailable(p,4,new Date(2026,8,15)),false);});
test('legacy relaxed difficulty migrates to easy before invalid values fall back',()=>{assert.equal(normalizeDifficulty('relaxed'),'easy');assert.equal(normalizeDifficulty('easy'),'easy');assert.equal(normalizeDifficulty('normal'),'normal');assert.equal(normalizeDifficulty('hard'),'hard');assert.equal(normalizeDifficulty('unknown'),'normal');assert.equal(normalizeDifficulty(undefined),'normal');});
test('four weekly claims maximum across difficulties, reset Monday, tickets retain odds',()=>{const p=createProfile(),sunday=new Date(2026,8,20,23,59),monday=new Date(2026,8,21);assert.notEqual(weekKey(sunday),weekKey(monday));for(let d=0;d<4;d++){assert.ok(claimDungeon(p,d,'hard',sunday));assert.equal(claimDungeon(p,d,'easy',sunday),null);}assert.equal(p.tickets.length,4);assert.ok(claimDungeon(p,0,'easy',monday));assert.equal(p.tickets.length,5);const reload=createProfile(JSON.parse(JSON.stringify(p)));assert.equal(claimDungeon(reload,0,'normal',monday),null);for(const mode of DIFFICULTIES){const profile=createProfile();profile.tickets=[{difficulty:mode.id,dungeon:0}];let calls=0;const result=drawArtifact(profile,()=>calls++===0?mode.rare-.001:0);assert.equal(result.artifact.rarity,'rare');assert.equal(profile.tickets.length,0);assert.equal(drawArtifact(profile),null);}});
test('library uses actual Card content, grammar lecture references and persistent mistakes',()=>{assert.equal(LIBRARY.grammar.length,35);assert.ok(LIBRARY.vocab.length>300);assert.ok(LIBRARY.collocation.length>=130);for(const kind of ['vocab','collocation','grammar'])for(const n of [0,.13,.53,.999]){const q=makeQuestion(kind,()=>n);assert.ok(q.options.includes(q.answer));assert.equal(new Set(q.options).size,q.options.length);if(kind==='grammar')assert.ok(q.lecture.content.length>100);const p=createProfile();recordAnswer(p,q,'wrong');assert.equal(p.learning.mistakes.length,1);recordAnswer(p,q,q.answer);assert.equal(p.learning.mistakes.length,0);assert.equal(p.learning.total,2);assert.equal(p.learning.correct,1);}});
test('each difficulty changes actual health and projectile speed, later dungeons scale',()=>{const hp=[],speed=[];for(const mode of DIFFICULTIES){const g=combat({mode:mode.id}),e=target(g);hp.push(e.maxHp);g.enemyBullet(0,0,0,100);speed.push(g.bullets[0].vx);}assert.ok(hp[0]<hp[1]&&hp[1]<hp[2]);assert.ok(speed[0]<speed[1]&&speed[1]<speed[2]);});
test('renderer draws all laser layers at current player position on every frame',()=>{const g=combat({weapon:1}),rects=[];const renderer={c:{save(){},restore(){},fillRect(...v){rects.push(v);},drawImage(){}},glow(){return {};}};Renderer.prototype.drawLaser.call(renderer,g);assert.equal(rects[2][0],g.player.x-2.5);g.player.x=370;rects.length=0;Renderer.prototype.drawLaser.call(renderer,g);assert.equal(rects[2][0],367.5);assert.equal(rects.length,3);});
test('frost slows movement, snowflakes jump, and midnight marks explode on three hits',()=>{
 const frost=combat({hero:4});const e=target(frost,225,260);e.speed=100;tick(frost,.4);assert.ok(e.slow>0);const old=e.y;tick(frost,.3);assert.ok(e.y-old<30);
 const snow=combat({hero:4,weapon:1});const a=target(snow,225,260),b=target(snow,320,250);tick(snow,2);assert.ok(a.hp<a.maxHp&&b.hp<b.maxHp);
 const midnight=combat({hero:5,weapon:1});const t=target(midnight,225,260);tick(midnight,1.4);assert.ok(midnight.effects.some(e=>e.type==='burst'));assert.ok(t.hp<t.maxHp-150);
});
test('all imported grammar and collocation questions have valid options and lecture links',()=>{for(const q of LIBRARY.collocation){assert.ok(q.options.includes(q.answer),`collocation ${q.id}`);assert.ok(q.question&&q.expression&&q.meaning);}for(const l of LIBRARY.grammar)for(const q of l.quizzes){assert.ok(q.options.includes(q.answer));assert.ok(LIBRARY.grammar.some(t=>t.id===q.lecture_id));}});
test('final quiz adds ten percent exactly once, and declining still completes the dungeon',()=>{
  const g=combat();g.room=2;g.phase='quiz';g.score=12345;const lives=g.player.lives,bombs=g.bombs;
  assert.equal(g.completeQuiz('life'),false);assert.ok(g.completeQuiz('score'));assert.equal(g.score,13580);assert.equal(g.scoreBonus,1235);
  assert.equal(g.completeQuiz('score'),false);assert.equal(g.player.lives,lives);assert.equal(g.bombs,bombs);
  const skip=combat();skip.room=2;skip.phase='quiz';skip.score=456;assert.ok(skip.completeQuiz());assert.equal(skip.phase,'victory');assert.equal(skip.score,456);
});
test('combo countdown freezes between targets, during quizzes and between rooms',()=>{
  const g=combat();g.combo=15;g.comboTime=1;tick(g,2);assert.equal(g.combo,15);assert.equal(g.comboTime,1);
  const e=target(g);g.phase='quiz';tick(g,5);assert.equal(g.comboTime,1);
  g.phase='clear';tick(g,.5);assert.equal(g.comboTime,1);g.phase='boss';tick(g,.4);assert.ok(g.comboTime<.7);
  e.hp=0;const remaining=g.comboTime;tick(g,.5);assert.equal(g.comboTime,remaining);
  target(g);tick(g,1);assert.equal(g.combo,0);
});
test('hidden heroes never unlock into normal rotation; random can draw every hidden hero',()=>{
  const p=createProfile(),date=new Date(2026,8,13,12);
  for(const h of [5,7,8]){unlockHero(p,h,date);p.unlocks[h]='2026-09-13';assert.equal(heroAvailable(p,h,date),false);}
  for(let i=0;i<3;i++){let n=0;assert.equal(randomHero(p,()=>n++===0?.1:(i+.5)/3,date),[5,7,8][i]);}
  for(let i=0;i<6;i++){let n=0;assert.equal(randomHero(p,()=>n++===0?.3:(i+.5)/6,date),[0,1,2,3,4,6][i]);}
});
test('new hitboxes, life caps and Zeke movement speed are reflected in the simulation',()=>{
  for(const h of [4,6])assert.equal(combat({hero:h}).player.radius,4);
  for(const h of [2,7])assert.equal(combat({hero:h}).player.radius,6);
  for(const h of [5,7,8])assert.equal(combat({hero:h}).maxLife,5);
  const z=combat({hero:2});z.move(225,800);z.update(.05);assert.equal(z.player.y,455);
});
test('health tuning applies each difficulty multiplier and elite/boss surcharge exactly once',()=>{
  for(const [i,prior,multiplier] of [[0,.76,1.1],[1,1,1.15],[2,1.3,1.2]]){
    const g=combat({mode:DIFFICULTIES[i].id});g.spawnEnemy(0,0,{hp:100});g.spawnEnemy(0,0,{hp:100,elite:true});
    assert.ok(Math.abs(g.enemies[0].hp-100*prior*multiplier)<1e-9);
    assert.ok(Math.abs(g.enemies[1].hp/g.enemies[0].hp-1.2)<1e-9);
    g.spawnBoss();assert.ok(Math.abs(g.boss.maxHp-g.stage.hp*prior*multiplier*.78*1.2)<1e-9);
  }
});
test('golden magnet attracts items beyond ordinary range and respects pickup bounds',()=>{
  const plain=combat(),magnet=combat({artifacts:['magnet']});
  for(const g of [plain,magnet]){g.drop(225,80,'power');g.pickups[0].vx=0;g.update(.05);}
  assert.ok(magnet.pickups[0].y>plain.pickups[0].y+10);
  const p=magnet.powerPoints;tick(magnet,1);assert.ok(magnet.powerPoints>p);
});
test('Luna slashes less often, leaving a window for incoming bullets',()=>{
  const g=combat({hero:1,weapon:1});target(g,225,320);g.fire(.001);assert.equal(g.player.fire,.56);const first=g.stats.damage;assert.equal(first,135);
  g.enemyBullet(225,360,0,0);g.fire(.28);assert.equal(g.bullets.length,1);assert.equal(g.stats.damage,first);
  g.fire(.29);assert.equal(g.bullets.length,0);assert.equal(g.stats.damage,first*2);
});
test('laser reaches top of viewport in both damage and all rendered layers',()=>{
  const g=combat({weapon:1}),e=target(g,225,2);g.fire(.01);assert.ok(e.hp<e.maxHp);
  const rects=[],r={c:{save(){},restore(){},fillRect(...args){rects.push(args)},drawImage(){}},glow(){return {}}};
  Renderer.prototype.drawLaser.call(r,g);assert.ok(rects.every(rect=>rect[1]===0&&rect[3]===g.player.y-25));
});
test('night and sanctuary zones persist, deal damage and do not stack without limit',()=>{
  for(const h of [6,7]){const g=combat({hero:h,weapon:1}),e=target(g,225,200);tick(g,4);assert.ok(g.zones.length>0);assert.ok(g.zones.length<=8);assert.ok(g.stats.damage>200);const before=e.hp;g.player.fire=999;tick(g,.4);assert.ok(e.hp<before);g.startStage(0,1);assert.equal(g.zones.length,0);}
});
test('time orbit deals high damage at a safe offset, transformation expires and costs a bomb',()=>{
  const orbit=combat({hero:8,weapon:1});target(orbit,225,280);tick(orbit,3);assert.ok(orbit.stats.damage/3>250);
  orbit.player.invincible=0;const bombs=orbit.bombs;assert.ok(orbit.bomb());assert.equal(orbit.bombs,bombs-1);assert.equal(orbit.bombTime,10);assert.equal(orbit.player.invincible,2.5);
  tick(orbit,3);assert.ok(orbit.shots.some(s=>s.type==='darkglass'));assert.equal(orbit.player.invincible,0);assert.equal(orbit.bomb(),false);
  tick(orbit,7.1);assert.equal(orbit.bombTime,0);tick(orbit,3);assert.ok(!orbit.shots.some(s=>s.type==='darkglass'));
});
