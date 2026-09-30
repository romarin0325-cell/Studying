import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { Game } from '../engine.js';
import { ARTIFACTS, COLLECTIBLE_ARTIFACTS, createProfile, drawArtifact, loadoutStats } from '../meta.js';

const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-6,`${actual} != ${expected}`);
const tick=(g,seconds)=>{for(let t=0;t<seconds-1e-9;t+=1/60)g.update(Math.min(1/60,seconds-t));};
function combat(options={}) {
  const g=new Game({artifacts:[],...options});g.phase='boss';g.player.invincible=0;g.player.fire=999;
  g.spawnEnemy(225,200,{hp:1e8,r:20,speed:0,fire:999,image:0});return g;
}

test('six collectible relics and two reserved legendary records stay distinct across saves and reward pools',()=>{
  assert.equal(ARTIFACTS.length,50);assert.equal(COLLECTIBLE_ARTIFACTS.length,48);
  const added=COLLECTIBLE_ARTIFACTS.slice(-6);
  assert.deepEqual(added.map(a=>a.rarity),['normal','normal','rare','rare','epic','epic']);
  for(const a of added) {
    const p=createProfile({version:8,owned:[a.id],equipped:[a.id],tickets:[{source:'shop',kind:'artifact'}]});
    assert.deepEqual(p.equipped,[a.id]);
    const pool=COLLECTIBLE_ARTIFACTS.filter(r=>r.rarity===a.rarity);let call=0;
    const roll={rare:0,epic:.15,normal:.99}[a.rarity];
    assert.equal(drawArtifact(p,()=>call++===0?roll:(pool.indexOf(a)+.5)/pool.length).artifact.id,a.id);
  }
  const reserved=ARTIFACTS.filter(a=>a.rarity==='legendary');
  assert.equal(reserved.length,2);assert.equal(reserved[0].bombs,3);
  assert.equal(reserved[1].attack,.5);assert.equal(reserved[1].life,-2);
  const p=createProfile({owned:reserved.map(a=>a.id),equipped:reserved.map(a=>a.id)});
  assert.ok(p.owned.every(id=>!reserved.some(a=>a.id===id)));assert.deepEqual(p.equipped,[]);
  assert.deepEqual(loadoutStats(reserved.map(a=>a.id)).ids,[]);
  for(let seed=1;seed<=80;seed++) {
    const g=new Game({challenge:true,seed});g.phase='quiz';g.room=2;
    assert.ok(g.challengeChoices().every(id=>COLLECTIBLE_ARTIFACTS.some(a=>a.id===id)));
  }
});

test('gold coin doubles only score pickups including their combo multiplier',()=>{
  for(const combo of [0,20,50]) {
    const base=combat(),coin=combat({artifacts:['goldcoin']});
    for(const g of [base,coin]){g.phase='wave';g.combo=combo;g.collect('score');}
    assert.equal(coin.score,base.score*2);
    for(const g of [base,coin]){g.score=0;g.power=5;g.collect('power');}
    assert.equal(coin.score,base.score);
  }
});

test('forget-me-not doubles each companion projectile and does not manufacture a companion',()=>{
  for(const boosted of [false,true]) {
    const g=combat({artifacts:['leaf','mirror',...(boosted?['forgetmenot']:[])]});g.update(.001);
    assert.deepEqual(g.shots.map(s=>s.damage),[boosted?30:15,boosted?30:15]);
    assert.deepEqual(g.shots.map(s=>s.type),['star','nightstar']);
  }
  const g=combat({artifacts:['forgetmenot']});g.update(.001);assert.equal(g.shots.length,0);
});

test('phoenix feather adds one run-wide revival attempt, including failure and mid-challenge acquisition',()=>{
  const g=combat({artifacts:['phoenixfeather']});near(g.attackBonus,.8);
  for(let attempt=0;attempt<2;attempt++) {
    g.phase='defeat';g.finished=true;assert.equal(g.reviveRemaining,2-attempt);assert.ok(g.revive(true));
    g.startStage(0,attempt+1);
  }
  g.phase='defeat';assert.equal(g.revive(true),false);
  const wrong=combat({artifacts:['phoenixfeather']});wrong.phase='defeat';assert.equal(wrong.revive(false),false);
  assert.equal(wrong.reviveRemaining,1);assert.ok(wrong.revive(true));assert.equal(wrong.reviveRemaining,0);
  const challenge=combat({challenge:true});challenge.phase='defeat';assert.ok(challenge.revive(true));
  challenge.phase='quiz';challenge.room=2;challenge.pendingArtifacts=['phoenixfeather'];
  assert.ok(challenge.chooseChallengeArtifact('phoenixfeather'));assert.equal(challenge.reviveRemaining,1);
});

test('supernova pays an extra bomb on a damaging hit, after shield payment, and respects barrier and zero floors',()=>{
  near(loadoutStats(['supernova']).bomb,1.6);
  for(const shield of [false,true]) {
    const g=combat({artifacts:['supernova',...(shield?['shield']:[])]});g.bombs=3;
    const life=g.player.lives;g.hitPlayer();assert.equal(g.bombs,shield?1:2);assert.equal(g.player.lives,shield?life:life-1);
  }
  const protectedGame=combat({artifacts:['supernova','clover']});const resources=[protectedGame.bombs,protectedGame.player.lives];
  protectedGame.hitPlayer();assert.deepEqual([protectedGame.bombs,protectedGame.player.lives],resources);
  const empty=combat({artifacts:['supernova']});empty.bombs=0;empty.hitPlayer();assert.equal(empty.bombs,0);
});

test('holy sword uses live centers and viewport diagonal, with a useful ordinary-distance bonus and additive attack rules',()=>{
  for(const height of [600,900,1100]) {
    const g=combat({height,artifacts:['holysword']}),enemy=g.enemies[0];
    for(const [ratio,expected] of [[0,150],[.5,137.5],[1,100]]) {
      g.player.x=0;g.player.y=0;enemy.x=g.width*ratio;enemy.y=g.height*ratio;
      const before=g.stats.damage;g.damage(enemy,100,enemy.x,enemy.y);near(g.stats.damage-before,expected);
    }
    g.player.x=enemy.x=225;g.player.y=height*.78;enemy.y=150;
    assert.ok(g.holySwordBonus(enemy)>.25,'normal forward firing distance should earn more than 25%');
  }
  const g=combat({artifacts:['holysword','phoenixfeather']}),enemy=g.enemies[0];
  g.player.x=enemy.x;g.player.y=enemy.y;g.damage(enemy,100,enemy.x,enemy.y);near(g.stats.damage,130);
});

test('holy flame replaces every hero ultimate, spends all bombs and power, deals one 5500 hit and grants two seconds',()=>{
  for(let hero=0;hero<9;hero++) {
    const events=[],g=combat({hero,artifacts:['holyflame'],onEvent:event=>events.push(event)});
    g.bombs=5;g.power=5;g.powerPoints=2;g.player.lives=1;
    g.enemyBullet(100,100,0,0);g.addHazard(225,28);
    assert.ok(g.bomb());assert.equal(g.bombKind,'holyflame');
    assert.deepEqual([g.bombs,g.power,g.powerPoints,g.bullets.length,g.hazards.length],[0,1,0,0,0]);
    near(g.stats.damage,5500);near(g.player.invincible,2);assert.equal(g.player.lives,1);
    assert.equal(g.frostTime,0);assert.equal(g.usesHeroBomb,false);assert.equal(g.bomb(),false);
    tick(g,1.98);assert.ok(g.player.invincible>0);tick(g,.04);near(g.player.invincible,0);near(g.stats.damage,5500);
    assert.ok(events.some(event=>event.type==='bomb'&&event.holyflame));
  }
  const combined=combat({artifacts:['holyflame','sun','core']});combined.bomb();near(combined.stats.damage,8250);
  const paid=combat({hero:3,artifacts:['holyflame','mask']});paid.bombs=0;paid.player.lives=2;
  assert.ok(paid.bomb());assert.equal(paid.player.lives,1);assert.equal(paid.maskUses,1);
  const noResource=combat({artifacts:['holyflame']});noResource.bombs=0;assert.equal(noResource.bomb(),false);
});

test('recovery item drop acceptance is 70% in every difficulty and never bypasses cursed sword',()=>{
  for(const mode of ['easy','normal','hard','abyss']) {
    const g=new Game({mode});let accepted=0;
    for(let i=0;i<1000;i++){g.random=()=>i/1000;g.pickups=[];g.drop(100,100,'life');accepted+=g.pickups.length;}
    assert.equal(accepted,700);g.random=()=>.99;g.pickups=[];g.drop(100,100,'power');g.drop(100,100,'score');assert.equal(g.pickups.length,2);
    const cursed=new Game({mode,artifacts:['cursedsword']});cursed.random=()=>0;cursed.drop(100,100,'life');assert.equal(cursed.pickups.length,0);
  }
});

test('all 108 legacy boss volleys match the fetched main before this patch, including warnings and stop/release timings',()=>{
  // Captured from origin/main 1c5e3c8 before editing. All bullets, hazards,
  // warnings and Astea schedules are included, not just the bullet count.
  // Round only floating-point noise so Windows and Linux compare the same geometry.
  const baseline={easy:'bdaee423ecba056eac6b7cb5c5c0a04dc1111ea88790c037c5b1399fd037912e',normal:'b7b30afd7e5444aa06cc5a2cea605106af59647e48ea50edf5842b333586850f',hard:'4db74f790e8563a8aa94edf68797b14f75e668be91b671c2cb8402d9ec8783ae'};
  for(const [mode,hash] of Object.entries(baseline)) {
    const samples=[];
    for(let stage=0;stage<12;stage++)for(let phase=0;phase<3;phase++) {
      const g=new Game({stage,mode,challenge:stage===6,seed:41,artifacts:[]});if(stage===6)g.startStage(6,2);
      g.spawnBoss();g.phase='boss';g.boss.y=150;g.boss.hp=g.boss.maxHp*[.9,.5,.3][phase];
      g.bossAttack(.01);g.boss.fire=0;g.bossAttack(.01);
      samples.push({stage,phase,fire:g.boss.fire,bullets:g.bullets,hazards:g.hazards,effects:g.effects,nextLight:g.boss.nextLight,nextBlade:g.boss.nextBlade,nextJudgmentCross:g.boss.nextJudgmentCross});
    }
    const stable=JSON.stringify(samples,(_key,value)=>typeof value==='number'?Math.round(value*1e6)/1e6:value);
    assert.equal(createHash('sha256').update(stable).digest('hex'),hash,mode);
  }
});

test('manual and its balance payload are documentation files excluded from the game bundle',async()=>{
  const build=await fs.readFile(new URL('../build.mjs',import.meta.url),'utf8');
  const app=await fs.readFile(new URL('../app.js',import.meta.url),'utf8');
  assert.ok(!build.includes('MANUAL_BALANCE'));assert.ok(!app.includes('id="manual"'));
  const manual=await fs.readFile(new URL('../docs/MANUAL.md',import.meta.url),'utf8');
  for(const name of ['황금동전','물망초','불사조의깃털','초신성','성검','홀리플레임'])assert.ok(manual.includes(name));
  assert.ok(!manual.includes('신기 아이리스'));assert.ok(!manual.includes('마신기 벨제뷔트'));
});
