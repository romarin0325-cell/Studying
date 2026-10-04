import test from 'node:test';
import assert from 'node:assert/strict';
import {HERO,HEROES,HIDDEN,ARTIFACTS,TUNING} from '../src/content.js';
import {drawCharacter,drawRelic,relicRates,relicThreshold,relicTier,duplicateCost,enhanceMultiplier,specialMultiplier,dispatchReward,dispatchSlots,calendar,HOUR} from '../src/economy.js';
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
  const p=createProfile(0),n=300000,counts={C:0,R:0,SR:0,UR:0},season={ordinary:0,guardian:0};
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
  for(const key of ['ordinary','guardian'])assert.ok(Math.abs(season[key]-n*.001)<6*Math.sqrt(n*.001*.999));
  console.log('DRAW SAMPLE',JSON.stringify({n,counts,season}));
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

test('duplicate investment loses efficiency without a game cap or exponential stat gain',()=>{
  assert.equal(duplicateCost(0),1);
  for(let e=0;e<40;e++){
    assert.ok(duplicateCost(e+1)>duplicateCost(e));
    assert.ok(Math.abs(enhanceMultiplier(e+1)-enhanceMultiplier(e)-.1)<1e-12);
    assert.ok(specialMultiplier(e)>=1&&specialMultiplier(e)<1.15);
    if(e)assert.ok(.1/duplicateCost(e)<.1/duplicateCost(e-1));
  }
  assert.ok(specialMultiplier(100000)<1.15);
});

test('dispatch uses four story gates and a logarithmic CP return with additive stage bonuses',()=>{
  for(const [clear,count] of [[0,0],[8,0],[9,1],[18,2],[27,3],[36,4],[45,4]])assert.equal(dispatchSlots(clear),count);
  const a=dispatchReward(1000,0),b=dispatchReward(1000,20);
  assert.ok(Math.abs(b-2*a)<=1);
  assert.ok(dispatchReward(1000000,9)>dispatchReward(10000,9));
  assert.ok(dispatchReward(1000000,9)<dispatchReward(10000,9)*3);
});

test('calendar uses UTC+9, Monday weeks and six guardians independently of host locale',()=>{
  const sunday=Date.parse('2026-10-04T14:59:59Z'),monday=sunday+1000;
  assert.deepEqual(calendar(sunday),{day:'2026-10-04',month:'2026-10',week:'2026-09-28',guardian:HIDDEN[3]});
  assert.equal(calendar(monday).week,'2026-10-05');
  assert.equal(calendar(Date.parse('2026-10-31T15:00:00Z')).guardian,HIDDEN[4]);
  assert.equal(calendar(Date.parse('2027-01-01T00:00:00Z')).guardian,HIDDEN[0]);
  assert.equal(calendar(monday-HOUR).day,'2026-10-04');
});
