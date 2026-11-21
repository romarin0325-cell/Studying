import test from 'node:test';
import assert from 'node:assert/strict';
import {HERO,HEROES,HIDDEN,ARTIFACTS,TUNING,ROSTER,LATE_COMPANIONS,LATE_UNLOCK_STAGE,PART_STAGES,levelStage} from '../src/content.js';
import {drawCharacter,heroPool,lateOpen,drawRelic,relicRates,relicThreshold,relicTier,duplicateCost,enhanceMultiplier,specialMultiplier,dispatchReward,dispatchSlots,calendar,HOUR,relicCost,relicScale,relicPhase,relicLevel,relicPoints,collectionBonus,collectionPoints,RELIC_LEVEL_STEP,stageReward,stageDust} from '../src/economy.js';
import {TEMPO,periodOf,guardianSlots} from '../src/tempo.js';
import {createProfile,random} from '../src/profile.js';

test('normal and seasonal draws enforce the hidden guardian boundary',()=>{
  const rolls=a=>()=>a.shift();
  assert.equal(HERO[drawCharacter(rolls([.999,.4]),false,HIDDEN[0])].hidden,false);
  for(const guardian of HIDDEN){
    assert.equal(drawCharacter(rolls([.999,.499]),true,guardian),guardian);
    assert.equal(HERO[drawCharacter(rolls([.999,.5,.9]),true,guardian)].hidden,false);
  }
  assert.equal(drawCharacter(rolls([0,0]),false,HIDDEN[0]),'star_boy');
});

test('seeded independent draws match published rates and never leak other hidden heroes',()=>{
  const p=createProfile(0),n=10000,counts={C:0,R:0,SR:0,UR:0},season={ordinary:0,guardian:0};
  for(let i=0;i<n;i++){
    const id=drawCharacter(()=>random(p),false,HIDDEN[0]);
    assert.equal(HERO[id].hidden,false);counts[HERO[id].rarity]++;
    const h=HERO[drawCharacter(()=>random(p),true,HIDDEN[3])];
    if(h.hidden){assert.equal(h.id,HIDDEN[3]);season.guardian++;}
    else if(h.rarity==='UR')season.ordinary++;
  }
  for(const [i,r] of ['C','R','SR','UR'].entries()){
    const expected=n*TUNING.heroRates[i],sigma=Math.sqrt(n*TUNING.heroRates[i]*(1-TUNING.heroRates[i]));
    assert.ok(Math.abs(counts[r]-expected)<6*sigma,`${r}: ${counts[r]}/${n}`);
  }
  assert.ok(Math.abs(counts.UR/n-.004)<=.0015,`${counts.UR}/${n} normal URs`);
  assert.ok(Math.abs((season.ordinary+season.guardian)/n-.004)<=.0015,`${season.ordinary+season.guardian}/${n} seasonal URs`);
  for(const key of ['ordinary','guardian'])assert.ok(Math.abs(season[key]-n*.002)<6*Math.sqrt(n*.002*.998));
});

test('relic progression is normalized, increasingly expensive and bounded at every boundary',()=>{
  let previous=[1,0,0,0],previousGap=0;
  for(let tier=0;tier<15;tier++){
    const threshold=relicThreshold(tier);
    assert.equal(relicTier(threshold),tier);
    if(tier)assert.equal(relicTier(threshold-1),tier-1);
    const rates=relicRates(threshold);
    assert.ok(Math.abs(rates.reduce((a,b)=>a+b,0)-1)<1e-12);
    assert.ok(rates.every(p=>p>0&&p<1));
    assert.ok(rates[0]<=previous[0]);for(let i=1;i<4;i++)assert.ok(rates[i]>=previous[i]);
    assert.ok(rates[3]<.02&&rates[2]<.14&&rates[0]>.55);
    const gap=relicThreshold(tier+1)-threshold;assert.ok(gap>previousGap);
    previous=rates;previousGap=gap;
  }
  assert.ok(relicRates(0)[0]>=.9599);
  const p=createProfile(0);
  for(const draws of [0,30,96,242,10000]){
    for(let i=0;i<1000;i++){const id=drawRelic(()=>random(p),draws);assert.ok(ARTIFACTS.some(a=>a.id===id));}
  }
});

test('duplicate investment adds 5% each without a cap, loses efficiency, and lifts support every five steps',()=>{
  assert.equal(duplicateCost(0),1);
  for(let e=0;e<40;e++){
    assert.ok(duplicateCost(e+1)>duplicateCost(e));
    assert.ok(Math.abs(enhanceMultiplier(e+1)-enhanceMultiplier(e)-.05)<1e-12);
    assert.ok(Math.abs(specialMultiplier(e)-(1+.1*Math.floor(e/5)))<1e-12);
    if(e)assert.ok(.05/duplicateCost(e)<.05/duplicateCost(e-1));
  }
  assert.equal(specialMultiplier(4),1);assert.ok(Math.abs(specialMultiplier(5)-1.1)<1e-12);assert.ok(Math.abs(specialMultiplier(10)-1.2)<1e-12);
});

test('relic unique effects scale by a constant per level while duplicate cost carries the phases',()=>{
  const spent=(rarity,level)=>{let n=0;for(let e=0;e<level-1;e++)n+=relicCost(rarity,e);return n;};
  assert.equal(spent('C',5),6);assert.equal(spent('C',10),31);assert.equal(spent('C',15),141);
  assert.equal(relicPhase(0),'early');assert.equal(relicPhase(3),'early');assert.equal(relicPhase(4),'mid');assert.equal(relicPhase(8),'mid');assert.equal(relicPhase(9),'late');
  assert.equal(relicCost('C',0),1);assert.equal(relicCost('C',4),3);assert.equal(relicCost('C',9),12);assert.equal(relicCost('C',19),98);
  for(let e=0;e<9;e++)assert.equal(relicCost('UR',e),1,'UR early steps stay at the 1-copy floor');
  assert.equal(relicCost('UR',10),Math.max(1,Math.round(16*.12)));
  assert.equal(relicScale(1),1);assert.ok(Math.abs(relicScale(5)-1.2)<1e-12);assert.ok(Math.abs(relicScale(3)-(1+RELIC_LEVEL_STEP*2))<1e-12);
  assert.equal(relicLevel({owned:true,enhance:4}),5);assert.equal(relicLevel({owned:false,enhance:9}),0);assert.equal(relicLevel(null),0);
});

test('collection bonus sums every owned relic and is a power fraction',()=>{
  assert.equal(relicPoints('hourglass',{owned:true,enhance:0}),3);
  assert.equal(relicPoints('hourglass',{owned:false,enhance:9}),0);
  assert.equal(collectionPoints({hourglass:{owned:true,enhance:0}}),3);
  assert.ok(Math.abs(collectionBonus({hourglass:{owned:true,enhance:0}})-.001)<1e-12);
  assert.ok(Math.abs(collectionBonus({hourglass:{owned:true,enhance:5}})-8/30/100)<1e-12);
  assert.equal(relicPoints('gift_ribbon',{owned:true,enhance:4}),3*(5+2));
  const allC=Object.fromEntries(ARTIFACTS.filter(a=>a.rarity==='C').map(a=>[a.id,{owned:true,enhance:0}]));
  assert.ok(Math.abs(collectionBonus(allC)-12*3/30/100)<1e-12);
});

test('relics keep the rarity written on them, not their place in the list',()=>{
  // Rarity sets draw odds, duplicate cost and collection weight of relics players already own.
  const approved={
    C:['hourglass','ember','frost','banner','chorus','lens','seed','feather','crown','sprout','amulet','dream_crystal'],
    R:['meteor','prism','tide','roots','guild','phoenix'],
    SR:['lantern','constellation','orbit','tempo_bell','spotlight','royal_crown'],
    UR:['twin','alchemy','chalice','royal_seal','gift_ribbon','broken_clock'],
  };
  for(const [rarity,ids] of Object.entries(approved))for(const id of ids)assert.equal(ARTIFACTS.find(a=>a.id===id)?.rarity,rarity,id);
  const order=['C','R','SR','UR'],ranks=ARTIFACTS.map(a=>order.indexOf(a.rarity));
  assert.ok(ranks.every((r,i)=>r>=0&&(!i||r>=ranks[i-1])),'the list stays grouped C → R → SR → UR');
});

test('dispatch uses four story gates and a logarithmic CP return with additive stage bonuses',()=>{
  for(const [clear,count] of [[0,0],[8,0],[9,1],[18,2],[27,3],[36,4],[45,4]])assert.equal(dispatchSlots(clear),count);
  for(const kind of ['dust','dreams']){
    // The stage bonus grows with the level (the intro chapter adds none).
    const a=dispatchReward(1000,9)[kind],b=dispatchReward(1000,29)[kind];
    assert.equal(dispatchReward(1000,0)[kind],a);
    assert.ok(Math.abs(b-2*a)<=1);
    assert.ok(dispatchReward(1000000,9)[kind]>dispatchReward(10000,9)[kind]);
    assert.ok(dispatchReward(1000000,9)[kind]<dispatchReward(10000,9)[kind]*3);
  }
});

test('dispatch pays mostly dust with a small crystal share',()=>{
  assert.deepEqual(dispatchReward(0,0),{dust:96,dreams:19});
  for(const [power,clear] of [[0,0],[500,9],[1500,36],[3000,45]]){
    const {dust,dreams}=dispatchReward(power,clear);
    assert.ok(Number.isSafeInteger(dust)&&Number.isSafeInteger(dreams)&&dreams>=1);
    assert.ok(dust>=4*dreams&&dust<=6*dreams,'dust stays about five times the crystals');
  }
});

test('normal and season hero draws use the fixed rarity thresholds',()=>{
  assert.deepEqual(TUNING.heroRates,[.698,.25,.048,.004]);
  const rolls=a=>()=>a.shift();
  for(const season of [false,true])for(const [value,rarity] of [[.697999,'C'],[.698,'R'],[.947999,'R'],[.948,'SR'],[.995999,'SR'],[.996,'UR']]){
    assert.equal(HERO[drawCharacter(rolls([value,.4]),season,'doom','luna')].rarity,rarity);
  }
});

test('the guaranteed hero roll normalizes the public SR and UR rates',()=>{
  const at=12/13,rarity=value=>{const rolls=[value,0];return HERO[drawCharacter(()=>rolls.shift(),false,'doom',null,true,true)].rarity;};
  assert.equal(rarity(0),'SR');assert.equal(rarity(at-1e-9),'SR');assert.equal(rarity(at),'UR');assert.equal(rarity(.999),'UR');
});

test('a normal-banner UR targets the current pickup half the time',()=>{
  // First roll lands on UR; expected pickup share is 1/2 + 1/2 x 1/(normal UR pool). The pool grows with new URs, so derive it.
  const expected=.5+.5/heroPool('UR',true).length;let n=0,pick=0;
  for(let i=0;i<20000;i++){const r=[.9999,Math.random(),Math.random()];let k=0;const id=drawCharacter(()=>r[k++]??Math.random(),false,'doom','luna');n++;if(id==='luna')pick++;assert.ok(ROSTER.UR.includes(id));}
  assert.ok(Math.abs(pick/n-expected)<.02,'pickup share '+pick/n+' expected '+expected);
});

test('calendar periods turn at KST midnight and each aligned interval',()=>{
  const epoch=-9*HOUR,midnight=Date.parse('2026-10-04T15:00:00Z');
  assert.deepEqual(TEMPO,{pickupHours:2,guardianHours:4,draftHours:4,eventHours:4,rushHours:8});
  assert.equal(calendar(midnight-1).day,'2026-10-04');assert.equal(calendar(midnight).day,'2026-10-05');
  for(const [kind,hours,prefix] of [['pickup',2,'P'],['guardian',4,'G'],['draft',4,'D'],['event',4,'W'],['rush',8,'R']]){
    const ms=hours*HOUR,index=(midnight-epoch)/ms;
    assert.deepEqual(periodOf(kind,epoch-1),{kind,index:-1,id:`${prefix}-1`,start:epoch-ms,end:epoch});
    assert.equal(periodOf(kind,midnight-1).id,`${prefix}${index-1}`);
    for(let start=midnight,i=index;start<midnight+24*HOUR;start+=ms,i++){
      const want={kind,index:i,id:`${prefix}${i}`,start,end:start+ms};
      assert.deepEqual(calendar(start).periods[kind],want);assert.deepEqual(periodOf(kind,start+ms-1),want);
      assert.equal(periodOf(kind,start+ms).index,i+1);
    }
  }
  const c=calendar(midnight);assert.equal(c.week,c.periods.draft.id);assert.equal(c.weekNo,c.periods.draft.index);assert.equal(c.month,c.periods.rush.id);
});

test('pickup and guardian rotate through their ordered pools and guardian slots include the active window',()=>{
  const start=-9*HOUR,pool=heroPool('UR',false),rotation=(hours,ids,key)=>[...ids,ids[0]].forEach((id,i)=>assert.equal(calendar(start+(i*hours)*HOUR)[key],id));
  rotation(2,pool,'pickup');rotation(4,HIDDEN,'guardian');
  assert.equal(calendar(start-1).pickup,pool.at(-1));assert.equal(calendar(start-1).guardian,HIDDEN.at(-1));
  const [active,next]=guardianSlots(HIDDEN[0],start+HOUR);assert.deepEqual(active,{start,end:start+4*HOUR});assert.deepEqual(next,{start:start+24*HOUR,end:start+28*HOUR});
  assert.deepEqual(guardianSlots(HIDDEN[0],active.end,1),[next]);assert.deepEqual(guardianSlots(HIDDEN[2],start,1),[{start:start+8*HOUR,end:start+12*HOUR}]);
  assert.deepEqual(guardianSlots('behemoth',start),[]);
});

test('first clears scale dreams and triple win dust, and losses pay for up to five waves',()=>{
  for(const [stage,L] of [[1,0],[levelStage(1),1],[levelStage(15),15],[levelStage(30),30],[levelStage(50),50]]){
    assert.equal(stageReward(stage),Math.round((160+10*L)*Math.min(3,1+L/15)));
    assert.equal(stageDust(stage,true,false),60+16*L);assert.equal(stageDust(stage,true,true),3*(60+16*L));
    for(const [round,credited] of [[0,0],[1,1],[3,3],[5,5],[6,5]]){
      const dust=Math.round((60+16*L)*credited/12);
      assert.equal(stageDust(stage,false,false,round),dust);assert.equal(stageDust(stage,false,true,round),dust);
    }
  }
});

test('companions added after the first part join the summon pool only once its last stage is cleared',()=>{
  assert.equal(LATE_UNLOCK_STAGE,PART_STAGES);assert.equal(lateOpen(PART_STAGES-1),false);assert.equal(lateOpen(PART_STAGES),true);
  assert.equal(HERO.behemoth.hidden,false);assert.equal(HERO.behemoth.rarity,'UR');assert.ok(!HIDDEN.includes('behemoth'));
  assert.ok(!heroPool('UR',false).includes('behemoth'));assert.ok(heroPool('UR',true).includes('behemoth'));
  for(const id of LATE_COMPANIONS)assert.ok(HEROES.some(h=>h.id===id),id);
  for(const rarity of Object.keys(ROSTER)){
    const closed=heroPool(rarity,false),open=heroPool(rarity,true);
    assert.ok(closed.length>0,rarity);
    assert.ok(closed.every(id=>!LATE_COMPANIONS.includes(id)),rarity);
    assert.deepEqual(open,ROSTER[rarity]);
  }
  const seen=new Set();let n=1;const rng=()=>{n=(n*16807)%2147483647;return n/2147483647;};
  for(let i=0;i<4000;i++)seen.add(drawCharacter(rng,false,null,null,false));
  for(const id of LATE_COMPANIONS)assert.ok(!seen.has(id),'closed summon never draws '+id);
  const seenOpen=new Set();n=1;
  for(let i=0;i<20000;i++)seenOpen.add(drawCharacter(rng,false,null,null,true));
  for(const id of ['underdog','toffee_apple'])assert.ok(seenOpen.has(id),'open summon can draw '+id);
  for(const id of LATE_COMPANIONS)assert.ok(HIDDEN.includes(id)||Object.values(ROSTER).some(p=>p.includes(id)),id+' is a roster or hidden companion');
});
