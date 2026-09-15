import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../engine.js';
import {ARTIFACTS, artifactText, createProfile, drawArtifact} from '../meta.js';
import {DUNGEONS, STAGES, LIMITS} from '../content.js';
const tick=(g,t)=>{for(let elapsed=0;elapsed<t;elapsed+=1/60)g.update(1/60);};
const offer=(g,id)=>{g.phase='quiz';g.room=2;g.pendingArtifacts=[id];assert.ok(g.chooseChallengeArtifact(id));};

test('epic draw boundaries reserve one or two percent without reducing rare odds',()=>{
  for(const boosted of [false,true]) {
    const rare=boosted?.30:.15,epic=boosted?.02:.01;
    for(const [roll,rarity] of [[0,'rare'],[rare-1e-7,'rare'],[rare,'epic'],[rare+epic-1e-7,'epic'],[rare+epic,'normal'],[.999,'normal']]) {
      const p=createProfile({tickets:[{dungeon:0,difficulty:'normal'}]});let calls=0;
      assert.equal(drawArtifact(p,()=>calls++===0?roll:0,boosted).artifact.rarity,rarity);
      assert.equal(p.tickets.length,0);
    }
  }
  for(const a of ARTIFACTS.slice(32))assert.ok(createProfile({owned:[a.id],equipped:[a.id]}).equipped.includes(a.id));
});
test('fairy cloak shrinks actual collision radius and revival artifacts respect caps',()=>{
  for(const hero of [0,4,6,7]){
    const base=new Game({hero}),g=new Game({hero,artifacts:['fairycloak','resurgence','miracle']});
    assert.equal(g.player.radius,base.player.radius-2);assert.equal(g.maxLife,base.maxLife+1);
    g.phase='defeat';g.finished=true;g.player.lives=0;g.bombs=g.maxBombs-1;
    assert.ok(g.revive(true));assert.equal(g.player.lives,g.maxLife);assert.equal(g.bombs,g.maxBombs);
    g.startStage(0,1);g.phase='defeat';assert.equal(g.revive(true),false);
  }
});
test('blessing refreshes a single barrier every stage and keeps normal hit immunity',()=>{
  const g=new Game({artifacts:['blessing','clover','cloak']});
  for(const [stage,room] of [[0,0],[0,1],[5,2],[6,0]]) {
    g.startStage(stage,room);assert.equal(g.player.barrier,true);g.phase='wave';g.player.invincible=0;
    const life=g.player.lives;g.enemyBullet(10,10,0,0);g.hitPlayer();
    assert.equal(g.player.barrier,false);assert.equal(g.player.lives,life);assert.equal(g.player.invincible,4);assert.equal(g.bullets.length,1);
  }
});
test('twenty-one challenge rooms preserve run resources and finish only after Astea',()=>{
  const g=new Game({challenge:true,stage:5,artifacts:['mask','dream','holy']});
  assert.equal(g.stageIndex,0);g.maskUses=3;g.reviveUsed=true;g.power=4;g.score=10000;
  let acquired=0;
  for(let index=0;index<21;index++) {
    assert.equal(g.stageIndex,Math.floor(index/3));assert.equal(g.room,index%3);
    g.phase='quiz';
    if(g.room===2 && g.stageIndex<6) {
      const ids=g.challengeChoices();assert.equal(ids.length,3);assert.equal(new Set(ids).size,3);
      assert.ok(ids.every(id=>!g.artifacts.has(id)));assert.deepEqual(g.challengeChoices(),ids);
      const total=g.totalTime;tick(g,5);assert.equal(g.totalTime,total);
      assert.equal(g.chooseChallengeArtifact('not-offered'),false);
      assert.ok(g.chooseChallengeArtifact(ids[0]));acquired++;
      assert.equal(g.chooseChallengeArtifact(ids[1]),false);
    } else assert.ok(g.completeQuiz(index===20?'score':null));
    assert.equal(g.maskUses,3);assert.equal(g.reviveUsed,true);
    assert.equal(g.finished,index===20);
  }
  assert.equal(acquired,6);assert.equal(g.artifacts.size,9);assert.equal(g.loadout.ids.length,9);
  assert.equal(g.score,11000);assert.equal(g.phase,'victory');assert.equal(g.completeQuiz('score'),false);
});
test('declines advance across dungeons without finalizing ordinary bonuses',()=>{
  const g=new Game({challenge:true});
  for(let i=0;i<21;i++){g.phase='quiz';assert.ok(g.completeQuiz());}
  assert.equal(g.phase,'victory');assert.equal(g.artifacts.size,0);assert.equal(g.score,0);
  assert.equal(g.rankBonus,0);assert.equal(g.timeBonus,0);
});
test('challenge instant variants activate on selection and do not retrigger on revival',()=>{
  const g=new Game({challenge:true});g.player.lives=1;g.bombs=0;
  offer(g,'resurgence');assert.equal(g.player.lives,g.maxLife);
  offer(g,'miracle');assert.equal(g.bombs,3);
  offer(g,'clover');assert.equal(g.player.barrier,true);
  g.phase='wave';g.player.invincible=0;g.hitPlayer();assert.equal(g.player.barrier,false);
  g.phase='defeat';g.finished=true;g.player.lives=0;g.bombs=0;assert.ok(g.revive(true));
  assert.equal(g.player.lives,2);assert.equal(g.bombs,0);assert.equal(g.player.barrier,false);
  for(const id of ['resurgence','miracle','clover'])assert.notEqual(artifactText(ARTIFACTS.find(a=>a.id===id),true),artifactText(ARTIFACTS.find(a=>a.id===id)));
});
test('choice pool includes unowned epic items uniformly and never changes outside the run',()=>{
  const p=createProfile(),before=JSON.stringify(p),seen=new Set();
  const g=new Game({challenge:true,artifacts:p.equipped});g.phase='quiz';g.room=2;
  const eligible=ARTIFACTS.filter(a=>!g.artifacts.has(a.id));
  for(let i=0;i<eligible.length;i++) {
    g.pendingArtifacts=null;let n=0;g.random=()=>n++===0?(i+.5)/eligible.length:0;
    const ids=g.challengeChoices();assert.equal(ids[0],eligible[i].id);ids.forEach(id=>seen.add(id));
  }
  assert.ok(seen.has('miracle')&&seen.has('blessing'));assert.equal(JSON.stringify(p),before);
});
test('challenge acquired stat artifacts refresh caps, hitbox, attack and P requirement',()=>{
  const g=new Game({challenge:true,artifacts:['crystal','hourglass','frozen']});
  const life=g.maxLife;offer(g,'fairycloak');assert.equal(g.maxLife,life+1);assert.equal(g.player.radius,3);
  offer(g,'nail');assert.equal(g.attackBonus,1.3);assert.ok(g.player.lives<=g.maxLife);
  g.powerPoints=3;offer(g,'dew');assert.equal(g.powerRequirement,3);assert.equal(g.power,2);
  offer(g,'holy');assert.equal(g.maxBombs,6);
  offer(g,'boots');assert.equal(g.loadout.speed,200);
  offer(g,'blessing');assert.equal(g.artifacts.size,9);assert.equal(g.player.barrier,true);
  assert.deepEqual(g.challengeChoices(),[]);
});
test('celestial elites combine the requested pairs and all boss phases remain bounded',()=>{
  assert.equal(DUNGEONS.filter(d=>!d.challengeOnly).length,6);assert.equal(STAGES[6].boss,'창조신 아스테아');
  for(const [room,expected] of [[0,[3,0]],[1,[1,5]]]) {
    const g=new Game({challenge:true});g.startStage(6,room);g.phase='wave';
    for(let i=0;i<5;i++)g.spawnWave();
    const specials=g.enemies.filter(e=>e.elite).map(e=>e.special);assert.ok(expected.every(id=>specials.includes(id)));
  }
  for(let phase=0;phase<3;phase++) {
    const g=new Game({challenge:true});g.startStage(6,2);g.spawnBoss();g.phase='boss';g.player.invincible=999;g.player.fire=999;g.boss.hp=g.boss.maxHp*[1,.6,.3][phase];
    tick(g,2.5);assert.equal(g.bossPattern,phase);
    if(phase===0)assert.ok(g.bullets.some(b=>b.vy<0));
    if(phase===1)assert.deepEqual(new Set(g.hazards.map(h=>h.axis)),new Set(['vertical','horizontal']));
    if(phase===2)assert.ok(g.bullets.every(b=>Math.abs(b.x-90)>62));
    tick(g,12);assert.ok(g.bullets.length<=LIMITS.bullets);assert.ok(g.hazards.length<=6);
  }
});
