import test from 'node:test';
import assert from 'node:assert/strict';
import {HEROES,HERO,DEFAULT_DECK,ARTIFACTS,BLESSINGS,validArtifacts} from '../../merge/content.js';
import {newRun,step,summon,drawHero,move,canMerge,power,cast,upgrade,upgradeCost,summonCost,dividend,chooseReward,continueEndless,serialize,restore,attackDirection,attackGeometry,geometryContains,cellPoint,pathPoint,PATH_LENGTH,wavePlan} from '../../merge/engine.js';
import {FX_PROFILES,distinctAttackCount} from '../../merge/effects.js';

const tick=(s,seconds)=>{for(let i=0;i<Math.ceil(seconds*60);i++)step(s,1/60);};
function target(s,progress=185,kind='grunt'){s.queue=[{kind,hp:1e6}];s.spawnIn=0;step(s,1/60);s.queue=[];const e=s.enemies.at(-1);e.progress=progress;e.hp=e.maxHp=1e6;e.speed=0;return e;}
function settle(s,wave){s.wave=wave;s.phase='combat';s.queue=[];s.enemies=[];step(s,1/60);}
function solo(id,artifacts=[]){const s=newRun({deck:[id,...DEFAULT_DECK.filter(h=>h!==id)].slice(0,6),seed:23,artifacts});s.board=s.board.map((u,i)=>i===6?u:null);return s;}

test('opening gives three free experiments, then exact paid costs; bags cover all six',()=>{
  const s=newRun({seed:11});assert.equal(s.board.filter(Boolean).length,3);assert.ok(canMerge(s.board[6],s.board[8]));assert.deepEqual(newRun({deck:['zeke'],seed:1}).deck,DEFAULT_DECK);
  for(let round=0;round<4;round++)assert.deepEqual(Array.from({length:6},()=>drawHero(s)).sort(),[...s.deck].sort());
  const gold=s.gold;for(let i=0;i<3;i++){assert.equal(summonCost(s),0);assert.equal(summon(s,i).ok,true);}assert.equal(s.gold,gold);assert.equal(s.freeSummons,0);assert.equal(summonCost(s),10);
  summon(s);assert.equal(s.gold,gold-10);assert.equal(summonCost(s),12);s.gold=0;const before=serialize(s);assert.equal(summon(s).ok,false);assert.equal(serialize(s),before);
});
test('merging, swaps, wildcard identity and Cinderella refund remain deterministic',()=>{
  const s=newRun({seed:1}),old=power(s,s.board[6]);assert.equal(move(s,6,8).merged,true);assert.equal(s.board[6],null);assert.equal(s.board[8].rank,2);assert.ok(power(s,s.board[8])>old*2);
  const a=s.board[8].uid,b=s.board[12].uid;move(s,8,12);assert.equal(s.board[8].uid,b);assert.equal(s.board[12].uid,a);
  const w=newRun({deck:['rumi','cinderella','zeke','snow_rabbit','siren','queen'],seed:1});move(w,6,12);assert.equal(w.board[12].hero,'cinderella');assert.equal(w.gold,45);
  const c=newRun({deck:['cinderella','rumi','zeke','snow_rabbit','siren','queen'],seed:1});c.upgrades.cinderella=2;move(c,6,8);assert.equal(c.stats.income['합성 환급'],22);
  c.board[8].rank=6;c.board[12].rank=6;assert.equal(canMerge(c.board[8],c.board[12]),false);
});
test('gold hoarding has no payout; Queen grows and Mushroom spends a slot to harvest',()=>{
  const a=solo('queen'),b=solo('queen');a.gold=0;b.gold=999;settle(a,7);settle(b,7);assert.deepEqual(a.settlement,b.settlement);assert.deepEqual(a.settlement,{base:23,dividend:7});assert.equal('interest' in a.settlement,false);
  a.upgrades.queen=2;assert.equal(dividend(a),9);const m=solo('mushroom_king');target(m);m.upgrades.mushroom_king=2;tick(m,12.1);assert.equal(m.stats.income['포자 수확'],5);
});
test('every wave offers exactly three of six blessings and grants once, including last boss',()=>{
  assert.equal(BLESSINGS.length,6);
  for(let wave=1;wave<=12;wave++){const s=newRun({seed:wave});settle(s,wave);assert.equal(s.phase,'reward');assert.equal(s.reward.length,3);assert.equal(new Set(s.reward).size,3);
    const id=s.reward[0];assert.equal(chooseReward(s,'missing').ok,false);assert.equal(chooseReward(s,id).ok,true);assert.equal(chooseReward(s,id).ok,false);assert.deepEqual(s.blessings,[id]);assert.equal(s.artifacts.length,0);
    if(wave===12){assert.equal(s.phase,'victory');continueEndless(s);assert.equal(s.wave,13);}else{tick(s,2.6);assert.equal(s.wave,wave+1);}
  }
});
test('blessings apply immediate, future, permanent and capped effects',()=>{
  for(const id of BLESSINGS.map(b=>b.id)){const s=solo('zeke');settle(s,1);s.reward=[id,...BLESSINGS.filter(b=>b.id!==id).slice(0,2).map(b=>b.id)];s.health=10;s.gauge=0;const gold=s.gold,base=power(s,s.board[6]);chooseReward(s,id);
    if(id==='arrival')assert.equal(s.board.filter(u=>u?.rank===2).length,1);
    if(id==='purse')assert.equal(s.gold,gold+35);
    if(id==='mend'){assert.equal(s.health,13);assert.equal(s.gauge,20);}
    if(id==='training'){assert.equal(s.trainingDiscount,.1);assert.equal(upgradeCost(s,'zeke'),26);}
    if(id==='oath')assert.equal(power(s,s.board[6]),base*1.06);
    if(id==='surge'){assert.equal(power(s,s.board[6]),base);tick(s,2.6);assert.equal(power(s,s.board[6]),base*1.25);s.wave=3;assert.equal(power(s,s.board[6]),base);}
  }
  const s=newRun();for(let i=0;i<8;i++){settle(s,i+1);s.reward=['training','mend','purse'];chooseReward(s,'training');}assert.equal(s.trainingDiscount,.5);
});
test('full-board arrival waits safely and resumes from storage',()=>{
  const s=newRun({seed:12});s.gold=10000;while(s.board.some(u=>!u))summon(s);settle(s,1);s.reward=['arrival','mend','purse'];chooseReward(s,'arrival');assert.equal(s.reserves.length,1);
  const restored=restore(serialize(s));assert.ok(restored);const hero=restored.reserves[0];restored.board[0]=null;step(restored,1/60);assert.equal(restored.board[0].hero,hero);assert.equal(restored.board[0].rank,2);assert.equal(restored.reserves.length,0);
});
test('twenty pre-run relics have 10/6/4 rarities and a hard three-slot limit',()=>{
  assert.equal(ARTIFACTS.length,20);assert.deepEqual(['common','rare','epic'].map(r=>ARTIFACTS.filter(a=>a.rarity===r).length),[10,6,4]);assert.equal(validArtifacts(['seed','seed']),false);assert.equal(validArtifacts(['none']),false);
  const ids=['seed','frost','roots'],s=newRun({artifacts:ids});ids.push('crown');assert.deepEqual(s.artifacts,['seed','frost','roots']);assert.equal(newRun({artifacts:ids}).artifacts.length,0);assert.ok(restore(serialize(s)));
});
test('wave health budget is conserved while opening density and count are lower',()=>{
  const weight={grunt:1,armor:2.5,runner:.65,wisp:.9},kind=(i,w)=>i%7===6&&w>=3?'armor':i%5===4&&w>=2?'runner':i%9===8&&w>=5?'wisp':'grunt';
  for(let w=1;w<=12;w++){const plan=wavePlan(w),base=88*1.34**(w-1),old=Array.from({length:12+w*2},(_,i)=>Math.round(base*weight[kind(i,w)])).reduce((a,b)=>a+b,0)+(w%4===0?Math.round(base*32):0);assert.equal(plan.healthBudget,old);assert.equal(plan.sequence.reduce((a,e)=>a+e.hp,0),old);assert.ok(plan.sequence.length<12+w*2+(w%4===0?1:0));}
  assert.equal(wavePlan(1).sequence.length,9);assert.ok(wavePlan(1).interval>1.3);assert.ok(wavePlan(12).interval<wavePlan(1).interval);
});
test('skills share gauge, require live enemies and deployed heroes, never spend on failure',()=>{
  const s=newRun({seed:7});assert.equal(cast(s,'zeke').ok,false);assert.equal(s.gauge,75);target(s);s.gauge=100;assert.equal(cast(s,'queen').ok,false);assert.equal(s.gauge,100);
  assert.equal(cast(s,'snow_rabbit').ok,true);assert.equal(s.gauge,35);assert.equal(s.enemies[0].stun,3);assert.equal(cast(s,'zeke').ok,false);assert.equal(s.gauge,35);
});
test('all 21 heroes have attacks, skills and a unique projectile and impact profile',()=>{
  assert.equal(HEROES.length,21);assert.equal(distinctAttackCount(),21);assert.equal(new Set(Object.values(FX_PROFILES).map(p=>p.frame)).size,21);
  for(const h of HEROES){const s=solo(h.id),e=target(s);tick(s,4);assert.ok(s.stats.byHero[h.id]>0,h.id+' attack');s.gauge=100;assert.equal(cast(s,h.id).ok,true,h.id+' skill');assert.ok(e.hp<e.maxHp);assert.equal(s.stats.skills,1);assert.ok(s.events.some(e=>e.type==='impact'&&e.hero===h.id));}
});
test('damage waits for release and impact; burn credit stays with its owner',()=>{
  const s=solo('zeke'),e=target(s);tick(s,.4);assert.ok(s.shots.length>0);assert.equal(e.hp,e.maxHp);tick(s,1);assert.ok(e.hp<e.maxHp);assert.equal(e.burnOwner,'zeke');
  const dealt=s.stats.byHero.zeke;s.board[6].disabled=100;s.shots=[];tick(s,.5);assert.ok(s.stats.byHero.zeke>dealt);assert.equal(s.stats.byHero.flame_sage,undefined);
});
test('four cardinal attacks use matching authored view, origin and effect angle',()=>{
  const origin={x:0,y:0};for(const [to,d] of [[{x:0,y:-9},'up'],[{x:0,y:9},'down'],[{x:-9,y:0},'left'],[{x:9,y:0},'right']])assert.equal(attackDirection(origin,to),d);
  for(const [progress,direction] of [[284,'up'],[850,'right'],[1400,'down'],[1900,'left']]){const s=solo('zeke'),u=s.board[6];s.board=Array(25).fill(null);s.board[12]=u;target(s,progress);tick(s,.41);assert.equal(u.facing,direction);const shot=s.shots[0];assert.ok(shot);const at=cellPoint(12),to=pathPoint(progress);assert.deepEqual(shot.origin,at);assert.ok((shot.from.x-at.x)*(to.x-at.x)+(shot.from.y-at.y-5)*(to.y-at.y)>0);tick(s,.2);const fx=s.events.find(e=>e.type==='impact');assert.equal(fx.angle,Math.atan2(to.y-at.y,to.x-at.x));}
});
test('beam, cone, cross, pulse and splash share exact preview geometry',()=>{
  const from={x:0,y:0},to={x:100,y:0},g=id=>attackGeometry(HERO[id],from,to);
  assert.ok(geometryContains(g('rumi'),{x:300,y:10}));assert.equal(geometryContains(g('rumi'),{x:100,y:30}),false);
  assert.ok(geometryContains(g('zeke'),{x:100,y:90}));assert.equal(geometryContains(g('zeke'),{x:-1,y:0}),false);
  assert.ok(geometryContains(g('guardian'),{x:0,y:220}));assert.equal(geometryContains(g('guardian'),{x:231,y:0}),false);
  assert.ok(geometryContains(g('ancient_dragon'),{x:0,y:-500}));assert.equal(geometryContains(g('ancient_dragon'),{x:100,y:100}),false);
  assert.ok(geometryContains(g('red_dragon'),{x:180,y:0}));assert.equal(geometryContains(g('red_dragon'),{x:189,y:0}),false);
});
test('ground fields persist independently, are bounded and train control',()=>{
  for(const id of ['flame_sage','mushroom_king','phantom','galaxy_whale','time_ruler']){const s=solo(id,['roots']),e=target(s);tick(s,1.2);assert.ok(s.zones.length,id);assert.equal(s.zones[0].total,4.5);const before=e.hp;s.board[6].disabled=100;s.shots=[];tick(s,1);assert.ok(e.hp<before,id+' field damage');assert.ok(restore(serialize(s)),id+' field save');}
  const s=solo('time_ruler');s.upgrades.time_ruler=3;const e=target(s);tick(s,1.2);assert.ok(Math.abs(e.slow-.34)<1e-10);
});
test('seed adds one to direct, field, merge and plague poison with direct and field caps',()=>{
  for(const bonus of [0,1]){const s=solo('mushroom_king',bonus?['seed']:[]),e=target(s);for(let i=0;i<120&&!e.poison;i++)step(s,1/60);assert.equal(e.poison,1+bonus);step(s,1/60);assert.equal(e.poison,2+bonus*2);e.poison=40;tick(s,1.3);assert.equal(e.poison,40);
    const m=newRun({deck:['mushroom_king',...DEFAULT_DECK].slice(0,6),artifacts:bonus?['seed']:[]}),a=target(m);a.poison=3;move(m,6,8);assert.equal(a.poison,7+bonus);assert.equal(a.poisonTime,8);
    e.poison=3;s.gauge=100;cast(s,'mushroom_king');assert.equal(e.poison,11+bonus);assert.equal(e.poisonTime,12);
  }
});
test('new relics change combat, rather than only descriptions',()=>{
  const plain=solo('night_rabbit'),prism=solo('night_rabbit',['prism']);for(const s of [plain,prism]){for(let i=0;i<3;i++)target(s,185+i*15);s.events=[];tick(s,1);}assert.ok(prism.stats.damage>plain.stats.damage);
  const orbit=solo('zeke',['orbit']);orbit.board[6].rank=3;target(orbit);tick(orbit,1);assert.ok(orbit.zones.some(z=>z.orbit));
  const twin=solo('zeke',['twin']);target(twin);twin.board[6].attacks=3;tick(twin,.42);assert.equal(twin.shots.length,2);
  const alchemy=newRun({artifacts:['alchemy']}),enemy=target(alchemy),hp=enemy.hp;move(alchemy,6,8);assert.ok(enemy.hp<hp);
  const phoenix=solo('zeke',['phoenix']),e=target(phoenix,PATH_LENGTH-1);phoenix.health=10;e.speed=100;step(phoenix,.05);assert.equal(phoenix.health,13);assert.equal(phoenix.phoenixUsed,true);
});
test('support training improves support roles as well as damage',()=>{
  const s=solo('siren');s.gold=100;assert.equal(upgrade(s,'siren').ok,true);assert.equal(s.gold,72);assert.equal(s.upgrades.siren,1);
  const d=solo('great_detective');d.upgrades.great_detective=2;const e=target(d);tick(d,1);assert.equal(e.exposed,.22);
  const rabbit=solo('silver_rabbit');rabbit.upgrades.silver_rabbit=2;target(rabbit);rabbit.gauge=0;tick(rabbit,1);assert.ok(rabbit.gauge>=1.9);
});
test('placement relics use real adjacency, rank and distinct neighbor identities',()=>{
  const shotPower=(artifacts,configure=()=>{})=>{const s=solo('zeke',artifacts);configure(s);target(s);for(let i=0;i<60&&!s.shots.length;i++)step(s,1/60);assert.ok(s.shots.length);return s.shots[0].damage;};
  const neighbor=(s,index,hero)=>s.board[index]={...s.board[6],uid:s.nextId++,hero,cooldown:100};
  assert.equal(shotPower(['banner']),23*1.4);
  assert.equal(shotPower(['banner'],s=>neighbor(s,7,'queen')),23);
  assert.equal(shotPower(['crown'],s=>s.board[6].rank=3),23*2.35**2*1.25);
  assert.equal(shotPower(['guild'],s=>neighbor(s,7,'siren')),23*1.15);
  assert.equal(shotPower(['guild']),23);
  assert.equal(shotPower(['constellation'],s=>{neighbor(s,5,'rumi');neighbor(s,7,'siren');neighbor(s,11,'queen');}),23*1.65);
  assert.equal(shotPower(['constellation'],s=>{neighbor(s,5,'queen');neighbor(s,7,'queen');neighbor(s,11,'queen');}),23);
});
test('economy and gauge relics retain free opening and explicit limits',()=>{
  const s=newRun({artifacts:['hourglass','feather','lantern']});assert.equal(summonCost(s),0);s.freeSummons=0;assert.equal(summonCost(s),8);s.paidSummons=20;assert.equal(summonCost(s),36);
  move(s,6,8);assert.equal(s.gauge,95);target(s);s.gauge=100;cast(s,'zeke');assert.equal(s.gauge,45);
});
test('relic hit modifiers, timed meteor and duplicate cadence affect actual attacks',()=>{
  const firstHit=(id,artifacts=[],configure=()=>{})=>{const s=solo(id,artifacts),e=target(s);configure(s,e);for(let i=0;i<180&&e.hp===e.maxHp;i++)step(s,1/60);return e.maxHp-e.hp;};
  const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
  near(firstHit('cinderella',['lens'],(_,e)=>e.boss='artificial_demon'),12*1.3);
  near(firstHit('cinderella',['frost'],(_,e)=>{e.slow=.4;e.slowTime=5;}),12*1.25);
  near(firstHit('cinderella',['meteor'],s=>s.board[6].attacks=11),12*2.8);
  near(firstHit('snow_rabbit',['tide']),10*1.25);
  const burn=artifacts=>{const s=solo('zeke',artifacts),e=target(s);s.board[6].disabled=100;e.burn=10;e.burnTime=2;e.burnOwner='zeke';tick(s,.5);return e.maxHp-e.hp;};
  near(burn(['ember']),burn([])*1.6);
  const cadence=artifacts=>{const s=newRun({artifacts});target(s);tick(s,.3);return s.board[6].cooldown;};
  assert.ok(cadence(['chorus'])<cadence([]));
});
test('support skill visuals identify recipients; targeted skills do not hit the whole screen',()=>{
  for(const id of ['rumi','siren','ancient_dragon','silver_rabbit']){const s=solo(id);target(s);s.gauge=100;cast(s,id);const v=s.events.find(e=>e.type==='skill');assert.equal(v.support,true);assert.deepEqual(v.targets,[{...cellPoint(6),uid:s.board[6].uid}]);}
  for(const [id,count] of [['luna',5],['night_rabbit',9]]){const s=solo(id);for(let i=0;i<12;i++)target(s,120+i*10);s.gauge=100;cast(s,id);const v=s.events.find(e=>e.type==='skill');assert.equal(v.support,false);assert.equal(v.targets.length,count);}
});
test('invalid summon coordinates cannot extend the board and expired zones cannot tick',()=>{
  for(const index of [25,99,1.5]){const s=newRun();summon(s,index);assert.equal(s.board.length,25);assert.ok(restore(serialize(s)));}
  const s=solo('flame_sage'),e=target(s);tick(s,1.2);s.board[6].disabled=100;s.shots=[];e.burnTime=0;s.zones.forEach(z=>{z.life=.001;z.tick=0;});const before=e.hp;step(s,1/60);assert.equal(s.zones.length,0);assert.equal(e.hp,before);
});
test('boss seal is answered by moving out of the announced row',()=>{
  const s=newRun({seed:6});s.wave=4;const boss=target(s,185,'boss');boss.skillIn=.01;step(s,1/60);assert.equal(s.telegraph.pattern,'seal');const threatened=s.telegraph.cells[0],safe=(threatened+5)%25,u=s.board[6];s.board=Array(25).fill(null);s.board[threatened]=u;assert.equal(move(s,threatened,safe).ok,true);tick(s,2.7);assert.equal(u.disabled,0);assert.equal(s.telegraph,null);
});
test('a boss defeated by burn cannot finish its heal or act after death',()=>{
  const s=solo('zeke');s.wave=8;const e=target(s,185,'boss');s.board[6].disabled=100;
  assert.equal(e.boss,'love_iris');e.hp=.1;e.burn=100;e.burnTime=1;e.burnOwner='zeke';e.channel=.001;e.channelHp=e.hp;
  step(s,1/60);assert.equal(s.enemies.length,0);assert.equal(s.phase,'reward');assert.equal(s.stats.kills,1);assert.equal(s.events.some(e=>e.type==='bossHeal'),false);
});
test('save/resume is deterministic; legacy or malformed saves fail closed',()=>{
  const s=newRun({seed:99,artifacts:['orbit','seed']});tick(s,4);const raw=serialize(s),resumed=restore(raw);assert.ok(resumed);s.events=[];tick(s,3);tick(resumed,3);assert.equal(serialize(resumed),serialize(s));
  const mutations=[x=>x.version=1,x=>x.board[6].rank=NaN,x=>x.enemies=[null],x=>x.shots=[{}],x=>x.zones=[{}],x=>x.buffs=null,x=>x.upgrades=null,x=>x.stats=null,x=>x.board[8].uid=x.board[6].uid,x=>x.gauge=1000,x=>x.queue=['alien'],x=>x.trainingDiscount=1,x=>x.reserves=['none'],x=>x.artifacts=['seed','seed'],x=>{x.phase='reward';x.reward=[];}];for(const corrupt of mutations){const x=JSON.parse(raw);corrupt(x);assert.equal(restore(x),null);}assert.equal(restore('{bad'),null);assert.equal(restore(null),null);assert.equal(pathPoint(PATH_LENGTH).y,142);
});
