import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/combat/engine.js';
import {HERO,ROSTER,LATE_COMPANIONS,DEFAULT_DECK} from '../src/content.js';
import {heroPool,lateOpen} from '../src/economy.js';
import {createProfile,parseProfile,validateProfile} from '../src/profile.js';
import {skillType,measure,roster} from '../src/lab/model.js';
const deck=['gold_dragon','rumi','ash','time_magician','ancient_dragon'];
const near=(a,b,n='value')=>assert.ok(Math.abs(a-b)<1e-6,n+': '+a+' ≠ '+b);
function setup(waveTime=0){
  const s=E.newRun({deck,seed:11,crit:null}),template=structuredClone(s.board.find(Boolean));
  s.board.fill(null);s.spawnIn=0;E.step(s,.01);s.queue=[];s.time=waveTime;s.waveTime=waveTime;s.gauge=90;s.events=[];s.shots=[];
  const enemy=s.enemies[0];Object.assign(enemy,{hp:1e8,maxHp:1e8,progress:863,speed:0,skillIn:1e8,statusEffects:[],slowEffects:[]});
  const unit=(hero,index,rank=1)=>s.board[index]={...structuredClone(template),uid:s.nextId++,hero,rank,cooldown:1e6,windup:0,attacks:0,cursed:false,disabled:0};
  return {s,enemy,unit};
}
function advance(s,seconds){for(let t=0;t<seconds-1e-9;t+=.05)E.step(s,Math.min(.05,seconds-t));}
function enemyAt(s,template,progress){const e={...structuredClone(template),uid:s.nextId++,hp:1e8,progress};s.enemies.push(e);return e;}
function bossPattern(s,e,pattern,cells=[12]){
  e.boss='ares';e.channel=.001;e.channelHp=e.hp;
  s.telegraph={uid:e.uid,pattern,cells,ends:s.time+.001,total:.001};E.step(s,.01);
}
test('Gold joins the regular late UR pool at clear45; old profiles gain one unowned identity',()=>{
  const h=HERO.gold_dragon;assert.equal(h.rarity,'UR');assert.equal(h.hidden,false);
  assert.ok(ROSTER.UR.includes(h.id)&&LATE_COMPANIONS.includes(h.id));
  assert.ok(!heroPool('UR',false).includes(h.id)&&heroPool('UR',true).includes(h.id));
  assert.equal(lateOpen(44),false);assert.equal(lateOpen(45),true);assert.equal(skillType(h),'범위');
  const p=createProfile(0);delete p.heroes.gold_dragon;const back=parseProfile(JSON.stringify(p));
  assert.ok(back&&validateProfile(back));assert.equal(back.heroes.gold_dragon.owned,false);assert.deepEqual(back.deck,DEFAULT_DECK);
});
test('requested base stats, fixed Ancient cross geometry, cost and text exclusions',()=>{
  const h=HERO.gold_dragon;assert.equal(h.damage,44);assert.equal(h.interval,1.7);assert.equal(h.skill.cost,80);
  for(const key of ['shape','range','radius'])assert.equal(h[key],HERO.ancient_dragon[key]);
  assert.doesNotMatch(h.skill.text,/최고|이동|합성|판매|면역|파괴|웨이브 종료/);
  const at=E.cellPoint(0),g=E.attackGeometry(h,at,{x:644,y:at.y});
  for(const p of [{x:76,y:at.y},{x:644,y:at.y},{x:at.x,y:142},{x:at.x,y:684}])assert.equal(E.geometryContains(g,p),true);
  assert.equal(E.geometryContains(g,{x:644,y:684}),false);
});
test('opening doubles live attack on every body for exactly ten wave seconds',()=>{
  const {s,unit}=setup(),a=unit('gold_dragon',0),b=unit('gold_dragon',24,3);
  assert.equal(E.power(s,a),88);near(E.power(s,b),88*2.35**2);
  s.waveTime=9.999;assert.equal(E.power(s,a),88);s.waveTime=10;assert.equal(E.power(s,a),44);
  s.waveTime=0;s.meta.gold_dragon={power:1.5,special:2};s.upgrades.gold_dragon=2;
  near(E.power(s,a),44*1.5*1.5*2,'no invented extra scaling on the opening bonus');
  s.phase='intermission';near(E.power(s,a),44*1.5*1.5);
});
test('highest eligible rank charges and pays80 once, without locking other Gold copies',()=>{
  const {s,unit}=setup();unit('gold_dragon',7,2);const top=unit('gold_dragon',12,4);unit('gold_dragon',18,3);
  assert.equal(E.cast(s,'gold_dragon').ok,true);assert.equal(s.goldCharge.source,top.uid);assert.equal(s.gauge,10);
  assert.equal(E.charging(s,s.board[7]),false);assert.equal(E.charging(s,top),true);
  assert.equal(E.castLock(s,'gold_dragon').kind,'charge');s.gauge=120;
  assert.equal(E.cast(s,'gold_dragon').ok,false);assert.equal(s.gauge,120);assert.equal(s.stats.skills,1);
});
test('charge cancels a pending basic swing and Time Magician cannot trigger another one',()=>{
  const {s,enemy,unit}=setup();const u=unit('gold_dragon',12);u.windup=.1;u.target=enemy.uid;u.cooldown=0;
  const mage=unit('time_magician',11);mage.cooldown=0;mage.attacks=2;
  E.cast(s,'gold_dragon');assert.equal(u.windup,0);advance(s,4.95);
  assert.ok(mage.attacks>2,'the adjacent extra-attack trigger actually fired');assert.equal(u.attacks,0);
  assert.ok(!s.shots.some(x=>x.hero==='gold_dragon'));
  advance(s,.1);assert.equal(s.goldCharge,null);advance(s,.2);assert.ok(u.attacks>0,'basics resume after release');
});
test('even a previously cursed highest rank is the caster; its curse is suppressed only during charge',()=>{
  const {s,unit}=setup();unit('gold_dragon',7,1);const top=unit('gold_dragon',12,3);top.cursed=true;
  assert.equal(E.cast(s,'gold_dragon').ok,true);assert.equal(s.goldCharge.source,top.uid);
  near(E.power(s,top),88*2.35**2);advance(s,5);
  near(s.volleys[0].damage,1936*2.35**2);assert.equal(top.cursed,true);
  near(E.power(s,top),44*2.35**2,'unchanged curse resumes outside charge');
});
test('an ongoing charge keeps its body and live UI caster when another higher rank is formed',()=>{
  const {s,unit}=setup();const caster=unit('gold_dragon',12,2);E.cast(s,'gold_dragon');
  const newer=unit('gold_dragon',7,3);assert.equal(E.bestUnit(s,'gold_dragon').uid,caster.uid);
  assert.equal(E.castPreview(s,'gold_dragon').rank,2);advance(s,5);
  assert.equal(s.volleys[0].source,caster.uid);assert.equal(E.bestUnit(s,'gold_dragon').uid,newer.uid);
});
test('move, swap, either merge direction including Rumi, and sell are refused while charging',()=>{
  const {s,unit}=setup();const u=unit('gold_dragon',12,2);unit('gold_dragon',13,2);unit('rumi',11,2);unit('ash',0);
  E.cast(s,'gold_dragon');const before=E.serialize(s);
  for(const [from,to] of [[12,14],[14,12],[12,13],[13,12],[11,12],[12,11],[0,12],[12,0]])assert.equal(E.move(s,from,to).ok,false);
  assert.equal(E.canMerge(u,s.board[13],s),false);assert.equal(E.sell(s,12).ok,false);assert.equal(E.serialize(s),before);
});
test('charging withstands stuns, seals, storm, thunder, judgement and forced shuffle',()=>{
  for(const pattern of ['seal','storm','stun1','thunder','judgement','shuffle']){
    const {s,enemy,unit}=setup();const u=unit('gold_dragon',12);unit('rumi',7);unit('ash',20);
    E.cast(s,'gold_dragon');E.stunUnit(s,12,3);assert.equal(u.disabled,0);assert.equal(E.invincible(s,12),true);
    bossPattern(s,enemy,pattern);assert.equal(s.board[12]?.uid,u.uid,pattern);assert.equal(u.disabled,0,pattern);assert.equal(u.cursed,false,pattern);
  }
  const {s,enemy,unit}=setup();const u=unit('gold_dragon',12);
  E.cast(s,'gold_dragon');Object.assign(enemy,{boss:'curse_iris',skillIn:0,casts:0});E.step(s,.01);assert.equal(u.cursed,false);
});
test('charging survives Ash sacrifice, and its own immunity ends at release',()=>{
  const {s,unit}=setup();const u=unit('gold_dragon',12);unit('ash',0,3);unit('rumi',7,2);
  E.cast(s,'gold_dragon');s.gauge=120;assert.equal(E.cast(s,'ash').ok,true);assert.equal(s.board[12].uid,u.uid);
  advance(s,5);assert.equal(E.invincible(s,12),false);E.stunUnit(s,12,2);assert.equal(u.disabled,2);
});
test('no hit before5s; release reads the then-alive leader, with true radius180 rather than a global hit',()=>{
  const {s,enemy,unit}=setup();unit('gold_dragon',12);E.cast(s,'gold_dragon');
  assert.equal(s.goldCharge.to,undefined);advance(s,2);enemy.hp=0;
  const centre=enemyAt(s,enemy,1600),edge=enemyAt(s,enemy,1420),outside=enemyAt(s,enemy,1419);
  advance(s,2.95);assert.equal(s.stats.damage,0);assert.equal(s.volleys.length,0);
  advance(s,.05);assert.equal(s.goldCharge,null);assert.equal(s.volleys.length,1);
  near(s.volleys[0].to.x,E.pathPoint(1600).x);assert.equal(s.volleys[0].damage,1936);
  advance(s,E.GOLD_DRAGON.flight+.05);
  near(1e8-centre.hp,1936);near(1e8-edge.hp,1936);assert.equal(outside.hp,1e8);
  const release=s.events.find(e=>e.type==='goldBreathRelease'),impact=s.events.find(e=>e.type==='goldBreathImpact');
  assert.ok(release&&impact);assert.equal(impact.targets.length,2);
});
test('the opening buff is read at release, including the exact10s boundary, never banked on cast',()=>{
  for(const [start,expected] of [[0,1936],[4.99,1936],[5,968],[6,968],[11,968]]){
    const {s,unit}=setup(start);unit('gold_dragon',12);
    assert.ok(E.castPreview(s,'gold_dragon').lines.join(' ').includes(expected.toLocaleString('ko-KR')));
    E.cast(s,'gold_dragon');advance(s,5);
    assert.equal(s.volleys[0].damage,expected,'cast at '+start);
  }
});
test('rank, training and auras changed during charge are read live at release',()=>{
  const {s,unit}=setup(11),u=unit('gold_dragon',12,2);E.cast(s,'gold_dragon');
  s.upgrades.gold_dragon=2;unit('ancient_dragon',11);
  advance(s,5);near(s.volleys[0].damage,44*2.35*1.5*1.2*22);assert.equal(s.volleys[0].rank,u.rank);
});
test('wave end cancels charge, next wave opens fresh, and defeat also clears it',()=>{
  const {s,enemy,unit}=setup();const u=unit('gold_dragon',12);E.cast(s,'gold_dragon');enemy.hp=0;E.step(s,.05);
  assert.equal(s.goldCharge,null);assert.equal(s.phase,'reward');assert.equal(s.volleys.length,0);
  E.chooseReward(s,s.reward[0]);advance(s,6);assert.equal(s.wave,2);assert.ok(E.goldOpening(s));assert.ok(!E.charging(s,u));
  const loss=setup();loss.unit('gold_dragon',12);E.cast(loss.s,'gold_dragon');loss.s.health=0;E.step(loss.s,.05);assert.equal(loss.s.goldCharge,null);assert.equal(loss.s.phase,'defeat');
});
test('charge and launched beam checkpoints resume; old runs migrate without a charge; corrupt locks are rejected',()=>{
  const {s,unit}=setup();unit('gold_dragon',12);E.cast(s,'gold_dragon');advance(s,2.3);
  const back=E.restore(E.serialize(s));assert.ok(back);near(back.goldCharge.ends-back.time,2.7);
  advance(back,2.7);assert.ok(back.volleys[0]);const flight=E.restore(E.serialize(back));assert.ok(flight);advance(flight,.7);near(flight.stats.byHero.gold_dragon,1936);
  for(const change of [x=>x.goldCharge.source=999999,x=>x.goldCharge.wave++,x=>x.goldCharge.ends++,x=>x.phase='reward']){
    const bad=JSON.parse(E.serialize(s));change(bad);assert.equal(E.restore(bad),null);
  }
  const legacy=E.newRun({seed:11});delete legacy.goldCharge;assert.equal(E.restore(E.serialize(legacy)).goldCharge,null);
});
test('starlight grants4 per merge,2 per combat second, none while intermission, with the existing cap',()=>{
  assert.equal(E.MERGE_STARLIGHT,4);assert.equal(E.STARLIGHT_PER_SECOND,2);
  const {s,unit}=setup();unit('rumi',12);unit('rumi',13);s.gauge=0;E.move(s,12,13);assert.equal(s.gauge,4);
  advance(s,1);near(s.gauge,6);s.phase='intermission';s.breakTime=4;advance(s,1);near(s.gauge,6);
  s.phase='combat';s.gauge=119;advance(s,1);assert.equal(s.gauge,120);
});
test('lab separates normal and opening damage and aligns fixed-cross targets, including one boss',()=>{
  const h=roster.find(h=>h.id==='gold_dragon');
  const normal=measure(h,{targets:1,boss:true}),opening=measure(h,{targets:1,boss:true,goldOpening:true});
  assert.ok(normal.dps>20&&normal.dps<27);assert.equal(normal.skillDamage,968);
  assert.ok(opening.dps>normal.dps);assert.equal(opening.skillDamage,1936);
  const nearCore=measure(h,{targets:1,coreNear:true});assert.ok(nearCore.dps>0);
  assert.ok(measure(roster.find(h=>h.id==='ancient_dragon'),{targets:1}).dps>0,'same fixed-cross fixture');
});
