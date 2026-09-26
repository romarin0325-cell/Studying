import test from 'node:test';
import assert from 'node:assert/strict';
import {HEROES,HERO,DEFAULT_DECK,ARTIFACTS} from '../../merge/content.js';
import {newRun,step,summon,drawHero,move,canMerge,power,cast,upgrade,summonCost,interest,dividend,nextWave,buy,rerollShop,chooseReward,serialize,restore,attackDirection,cellPoint,pathPoint,PATH_LENGTH} from '../../merge/engine.js';

const tick=(s,seconds)=>{for(let i=0;i<Math.ceil(seconds*60);i++)step(s,1/60);};
function target(s,progress=0){s.queue=['grunt'];s.spawnIn=0;step(s,1/60);s.queue=[];const e=s.enemies[0];e.progress=progress;e.hp=e.maxHp=1e6;e.speed=0;return e;}
function settle(s,wave){s.wave=wave;s.phase='combat';s.queue=[];s.enemies=[];step(s,1/60);}

test('opening is playable, deck constrained, and the six-card bag avoids missing a hero',()=>{
  const s=newRun({seed:11});assert.equal(s.board.filter(Boolean).length,3);assert.ok(canMerge(s.board[6],s.board[8]));assert.ok(s.gold>=summonCost(s)*3);
  assert.deepEqual(newRun({deck:['zeke'],seed:1}).deck,DEFAULT_DECK);
  for(let round=0;round<4;round++)assert.deepEqual(Array.from({length:6},()=>drawHero(s)).sort(),[...s.deck].sort());
  const before=s.gold,cost=summonCost(s);const result=summon(s,0);assert.equal(result.ok,true);assert.equal(s.board[0].hero,result.hero);assert.equal(s.gold,before-cost);assert.ok(s.deck.includes(result.hero));
});

test('merging gives a useful power increase; movement swaps and wildcard identity stay deterministic',()=>{
  const s=newRun({seed:1}),old=power(s,s.board[6]);assert.equal(move(s,6,8).merged,true);assert.equal(s.board[6],null);assert.equal(s.board[8].rank,2);assert.ok(power(s,s.board[8])>old*2);
  const a=s.board[8].uid,b=s.board[12].uid;move(s,8,12);assert.equal(s.board[8].uid,b);assert.equal(s.board[12].uid,a);
  const w=newRun({deck:['rumi','cinderella','zeke','snow_rabbit','siren','queen'],seed:1});move(w,6,12);assert.equal(w.board[12].hero,'cinderella');assert.equal(w.board[12].rank,2);assert.equal(w.gold,65,'wildcard consumed, Cinderella retained');
  const c=newRun({deck:['cinderella','rumi','zeke','snow_rabbit','siren','queen'],seed:1});move(c,6,8);assert.equal(c.gold,83);assert.equal(c.stats.income['합성 환급'],18);
  c.board[8].rank=6;c.board[12].rank=6;assert.equal(canMerge(c.board[8],c.board[12]),false);
});

test('interest, dividends, training and paid summons account for their exact cost',()=>{
  const s=newRun({deck:['queen','snow_rabbit','zeke','rumi','siren','cinderella'],seed:4});
  s.gold=139;assert.equal(interest(s),8);assert.equal(dividend(s),10);s.artifacts.push('treasury');assert.equal(interest(s),13);
  settle(s,1);assert.deepEqual(s.settlement,{base:14,interest:13,dividend:10});assert.equal(s.gold,176);
  assert.equal(upgrade(s,'queen').ok,true);assert.equal(s.gold,148);assert.equal(s.upgrades.queen,1);
  s.gold=0;const snapshot=serialize(s);assert.equal(summon(s).ok,false);assert.equal(serialize(s),snapshot);
});

test('skills share a gauge, require a live enemy and a deployed hero, and do not spend on failure',()=>{
  const s=newRun({seed:7});assert.equal(cast(s,'zeke').ok,false);assert.equal(s.gauge,75);
  target(s);s.gauge=100;assert.equal(cast(s,'queen').ok,false);assert.equal(s.gauge,100);
  assert.equal(cast(s,'snow_rabbit').ok,true);assert.equal(s.gauge,35);assert.equal(s.enemies[0].stun,3);
  assert.equal(cast(s,'zeke').ok,false);assert.equal(s.gauge,35);assert.equal(s.stats.skills,1);
});

test('every one of the 21 heroes has a functioning basic attack and skill',()=>{
  assert.equal(HEROES.length,21);
  for(const h of HEROES){
    const deck=[h.id,...DEFAULT_DECK.filter(id=>id!==h.id)].slice(0,6),s=newRun({deck,seed:23});
    s.board=s.board.map((u,i)=>i===6?u:null);const e=target(s,60);tick(s,4);
    assert.ok(s.stats.byHero[h.id]>0,h.id+' did not attack');s.gauge=100;assert.equal(cast(s,h.id).ok,true,h.id+' skill');assert.ok(e.hp<e.maxHp);assert.equal(s.stats.skills,1);
  }
});

test('damage follows projectile travel, and burn credit stays with the casting hero',()=>{
  const s=newRun({seed:9});s.board=s.board.map((u,i)=>i===6?u:null);const e=target(s,10);tick(s,.4);
  assert.ok(s.shots.length>0);assert.equal(e.hp,e.maxHp,'damage before impact');tick(s,1);assert.ok(e.hp<e.maxHp);assert.equal(e.burnOwner,'zeke');
  const dealt=s.stats.byHero.zeke;for(const u of s.board)if(u)u.disabled=100;s.shots=[];tick(s,.5);assert.ok(s.stats.byHero.zeke>dealt);assert.equal(s.stats.byHero.flame_sage,undefined);
});

test('combat selects each authored cardinal view and releases from the matching side',()=>{
  const origin={x:0,y:0};for(const [to,d] of [[{x:0,y:-9},'up'],[{x:0,y:9},'down'],[{x:-9,y:0},'left'],[{x:9,y:0},'right']])assert.equal(attackDirection(origin,to),d);
  for(const [progress,direction] of [[284,'up'],[850,'right'],[1400,'down'],[1900,'left']]){
    const s=newRun({seed:2}),u=s.board[6];s.board=Array(25).fill(null);s.board[12]=u;target(s,progress);tick(s,.45);
    assert.equal(u.facing,direction);const shot=s.shots[0];assert.ok(shot);const at=cellPoint(12),to=pathPoint(progress);assert.ok((shot.from.x-at.x)*(to.x-at.x)+(shot.from.y-at.y-5)*(to.y-at.y)>0);
  }
});

test('shop purchases, rerolls and free rewards have one transaction each',()=>{
  const s=newRun({seed:17});s.gold=200;settle(s,3);assert.equal(s.phase,'shop');const item=s.shop.items[0],gold=s.gold,count=s.board.filter(Boolean).length;
  assert.equal(buy(s,0).ok,true);assert.equal(s.gold,gold-item.price);assert.equal(s.board.filter(Boolean).length,count+1);assert.equal(buy(s,0).ok,false);
  const before=s.gold;assert.equal(rerollShop(s).ok,true);assert.equal(s.gold,before-8);assert.equal(s.shop.rerolls,1);
  nextWave(s);assert.equal(s.wave,4);settle(s,4);const choice=s.reward[0];assert.equal(chooseReward(s,'missing').ok,false);assert.equal(chooseReward(s,choice).ok,true);assert.ok(s.artifacts.includes(choice));assert.equal(s.wave,5);
  s.endless=true;s.artifacts=ARTIFACTS.map(a=>a.id);settle(s,16);assert.equal(s.phase,'intermission','all-owned artifacts cannot trap an endless run');
});

test('boss seal can be answered by moving out of its announced row',()=>{
  const s=newRun({seed:6});s.wave=3;s.phase='intermission';nextWave(s);s.queue=['boss'];s.spawnIn=0;step(s,1/60);s.queue=[];
  const boss=s.enemies[0];boss.speed=0;boss.hp=boss.maxHp=1e7;boss.skillIn=.01;step(s,1/60);assert.equal(s.telegraph.pattern,'seal');
  const threatened=s.telegraph.cells[0],safe=(threatened+5)%25;const unit=s.board[6];s.board=Array(25).fill(null);s.board[threatened]=unit;assert.equal(move(s,threatened,safe).ok,true);
  tick(s,2.7);assert.equal(unit.disabled,0);assert.equal(s.telegraph,null);
});

test('save/resume is deterministic during travel, and malformed states are rejected safely',()=>{
  const s=newRun({seed:99});tick(s,4);const raw=serialize(s),resumed=restore(raw);assert.ok(resumed);s.events=[];tick(s,3);tick(resumed,3);assert.equal(serialize(resumed),serialize(s));
  const mutations=[x=>x.board[6].rank=NaN,x=>x.enemies=[null],x=>x.shots=[{}],x=>x.buffs=null,x=>x.upgrades=null,x=>x.stats=null,x=>x.board[8].uid=x.board[6].uid,x=>x.gauge=1000,x=>x.queue=['alien'],x=>{x.phase='shop';x.shop=null;},x=>{x.phase='reward';x.reward=[];}];
  for(const corrupt of mutations){const x=JSON.parse(raw);corrupt(x);assert.equal(restore(x),null);}
  assert.equal(restore('{bad'),null);assert.equal(restore(null),null);assert.equal(pathPoint(PATH_LENGTH).y,142);
});
