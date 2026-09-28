import test from 'node:test';
import assert from 'node:assert/strict';
import {HERO,DEFAULT_DECK} from '../../merge/content.js';
import * as E from '../../merge/engine.js';
import {CombatFX} from '../../merge/effects.js';
import {inspection,attackDescription,skillDescription,trainingPreview} from '../../merge/unit-info.js';
import {tutorialPage} from '../../merge/tutorial.js';

const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
function arrange(id='zeke'){
  const s=E.newRun({deck:[id,...DEFAULT_DECK.filter(x=>x!==id)].slice(0,6),seed:981273});
  const template=s.board.find(Boolean);s.board.fill(null);s.board[12]={...template,hero:id,cooldown:0};s.queue=[];s.events=[];
  return s;
}
function enemy(s,progress=260){s.queue=[{kind:'grunt',hp:1e7}];s.spawnIn=0;E.step(s,1/60);s.queue=[];const e=s.enemies.at(-1);e.progress=progress;e.speed=0;return e;}

test('all three opening slots use independent draws, and old bags do not control new draws',()=>{
  for(const seed of [1,8916273,0xffffffff,671231]){
    const rng={deck:DEFAULT_DECK,rng:seed},expected=Array.from({length:3},()=>E.drawHero(rng));
    const s=E.newRun({seed});assert.deepEqual([6,8,12].map(i=>s.board[i].hero),expected);
    s.bag=[...s.deck].reverse();const saved=E.restore(E.serialize(s));assert.ok(saved);
    const draws=Array.from({length:50},()=>E.drawHero(s));
    assert.deepEqual(Array.from({length:50},()=>E.drawHero(saved)),draws);assert.deepEqual(saved.bag,[...s.deck].reverse());
  }
});
test('summon price continues beyond 40 and free summons never advance paid count',()=>{
  const s=E.newRun({seed:87,artifacts:['feather']});
  for(let i=0;i<3;i++)assert.equal(E.summon(s).ok,true);
  assert.equal(s.paidSummons,0);assert.equal(E.summonCost(s),8);
  s.freeSummons=0;
  for(const paid of [16,17,100,1000000]){s.paidSummons=paid;assert.equal(E.summonCost(s),10+2*paid-4);}
  s.paidSummons=100;s.gold=1000;assert.equal(E.summon(s).ok,true);assert.equal(s.gold,794);assert.equal(E.summonCost(s),208);
});
test('guided merge practice declares a pair independently of random gameplay openings',()=>{
  const {state}=tutorialPage(1,id=>id);
  assert.deepEqual([state.board[6].hero,state.board[8].hero],['zeke','zeke']);assert.equal(E.move(state,6,8).merged,true);
});
test('inspection uses current rank, training, relics, adjacency and buffs, matching emitted attacks',()=>{
  const s=arrange(),u=s.board[12];u.rank=3;s.upgrades.zeke=2;s.globalAttack=.2;s.surgeWave=s.wave;
  for(const [i,id] of [[11,'ancient_dragon'],[13,'siren'],[7,'night_rabbit']])s.board[i]={...u,uid:s.nextId++,hero:id,cooldown:1e6};
  s.upgrades.ancient_dragon=3;s.upgrades.siren=4;
  s.artifacts=['guild','constellation','crown'];s.buffs={awaken:100,haste:100,march:100};
  const expected=23*2.35**2*1.56*1.2*1.25*1.34*1.15*1.65*1.25*1.7;
  const stats=inspection(s,'zeke',u).stats;close(stats.damage,expected);close(stats.interval,1.2/2.39+.13);
  const preview=trainingPreview(s,'zeke');assert.equal(preview.rank,3);close(preview.damage,expected);close(preview.nextDamage,expected/1.56*1.84);
  enemy(s);s.events=[];let firstShot;
  for(let i=0;i<60&&!firstShot;i++){E.step(s,1/60);firstShot=s.shots.find(shot=>shot.hero==='zeke');}
  assert.ok(firstShot);close(firstShot.damage,expected);
  const times=[];for(let i=0;i<120;i++){E.step(s,1/60);for(const e of s.events)if(e.type==='attack'&&e.hero==='zeke')times.push(s.time);s.events=[];}
  assert.ok(times.length>=2);assert.ok(Math.abs(times.at(-1)-times.at(-2)-stats.interval)<2/60,'displayed cadence includes the real windup');
  s.board[11]=null;assert.ok(inspection(s,'zeke',u).stats.damage<stats.damage,'moving an aura changes the selected unit immediately');
});
test('rabbit synergy counts distinct other rabbit kinds; unplaced companions get no lonely-board bonus',()=>{
  const s=arrange('silver_rabbit'),u=s.board[12];s.artifacts=['chorus'];
  for(const [i,id] of [[11,'silver_rabbit'],[13,'snow_rabbit'],[7,'snow_rabbit'],[17,'night_rabbit']])s.board[i]={...u,uid:s.nextId++,hero:id};
  close(E.combatStats(s,u).interval,HERO.silver_rabbit.interval/1.55+.13);
  s.artifacts=['banner'];const unplaced={hero:'luna',rank:1};close(E.combatStats(s,unplaced).damage,HERO.luna.damage);
});
test('trait and skill descriptions include actual conditional damage and highest deployed caster rank',()=>{
  const s=arrange('luna'),u=s.board[12];u.rank=2;s.upgrades.luna=2;s.artifacts=['lens'];
  const b=E.combatStats(s,u).damage;assert.ok(attackDescription(s,u).includes(Number((b*1.35*1.3).toFixed(1)).toLocaleString('ko-KR')));
  s.board[7]={...u,uid:s.nextId++,rank:4};assert.equal(inspection(s,'luna',u).unit.rank,2);
  const skill=E.power(s,s.board[7])*21.6*1.3;assert.ok(skillDescription(s,'luna').includes(Number(skill.toFixed(1)).toLocaleString('ko-KR')));
  const mushroom=arrange('mushroom_king');mushroom.artifacts=['seed'];mushroom.board[12].rank=3;
  assert.match(attackDescription(mushroom,mushroom.board[12]),/독 \+4/);assert.match(skillDescription(mushroom,'mushroom_king'),/독 \+25/);
});
test('impact events carry the actual collision snapshot even after the target moves',()=>{
  const s=arrange();s.board[12].cooldown=0;const e=enemy(s);e.speed=49;
  let hit;for(let i=0;i<90&&!hit;i++){E.step(s,1/60);hit=s.events.find(event=>event.type==='impact');}
  assert.ok(hit?.geometry);assert.equal(hit.source,s.board[12].uid);
  assert.deepEqual(hit.geometry,E.attackGeometry(HERO.zeke,E.cellPoint(12),{...E.pathPoint(e.progress)}));
  const before=structuredClone(hit.geometry);e.progress+=500;E.move(s,12,18);assert.deepEqual(hit.geometry,before);
});
test('echo refreshes one footprint per source, and skill particles cannot evict attack boundaries',()=>{
  const fx=new CombatFX({},{}),g=E.attackGeometry(HERO.zeke,{x:360,y:350},{x:360,y:142});
  for(let i=0;i<300;i++)fx.event({type:'impact',hero:'zeke',source:i%25,geometry:g});
  assert.equal(fx.footprints.length,25);assert.equal(fx.impacts.length,96);
  for(let i=0;i<100;i++)fx.event({type:'skill',hero:'zeke',origin:{x:360,y:350},targets:[],rank:1});
  assert.equal(fx.footprints.length,25);assert.equal(fx.impacts.length,96);
});
