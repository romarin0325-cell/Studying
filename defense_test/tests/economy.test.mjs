import test from 'node:test';
import assert from 'node:assert/strict';
import {HERO,HEROES,HIDDEN,ARTIFACTS,TUNING,ROSTER} from '../src/content.js';
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

test('dispatch uses four story gates and a logarithmic CP return with additive stage bonuses',()=>{
  for(const [clear,count] of [[0,0],[8,0],[9,1],[18,2],[27,3],[36,4],[45,4]])assert.equal(dispatchSlots(clear),count);
  for(const kind of ['dust','dreams']){
    const a=dispatchReward(1000,0)[kind],b=dispatchReward(1000,20)[kind];
    assert.ok(Math.abs(b-2*a)<=1);
    assert.ok(dispatchReward(1000000,9)[kind]>dispatchReward(10000,9)[kind]);
    assert.ok(dispatchReward(1000000,9)[kind]<dispatchReward(10000,9)[kind]*3);
  }
});

test('dispatch pays mostly dust with a small crystal share',()=>{
  for(const [power,clear] of [[0,0],[500,9],[1500,36],[3000,45]]){
    const {dust,dreams}=dispatchReward(power,clear);
    assert.ok(Number.isSafeInteger(dust)&&Number.isSafeInteger(dreams)&&dreams>=1);
    assert.ok(dust>=4*dreams&&dust<=6*dreams,'dust stays about five times the crystals');
  }
});

test('a normal-banner UR is the weekly pickup half the time',()=>{
  // First roll lands on UR; expected pickup share is 1/2 + 1/2 x 1/6.
  let n=0,pick=0;
  for(let i=0;i<20000;i++){const r=[.9999,Math.random(),Math.random()];let k=0;const id=drawCharacter(()=>r[k++]??Math.random(),false,'doom','luna');n++;if(id==='luna')pick++;assert.ok(ROSTER.UR.includes(id));}
  assert.ok(pick/n>.55&&pick/n<.62,'pickup share '+pick/n);
});

test('calendar uses UTC+9, Monday weeks and six guardians independently of host locale',()=>{
  const sunday=Date.parse('2026-10-04T14:59:59Z'),monday=sunday+1000;
  const {pickup,...rest}=calendar(sunday);assert.deepEqual(rest,{day:'2026-10-04',month:'2026-10',week:'2026-09-28',guardian:HIDDEN[3]});
  assert.equal(calendar(monday).week,'2026-10-05');
  // The normal-banner pickup turns over exactly at Monday 00:00 (UTC+9) and cycles all six standard URs.
  assert.ok(ROSTER.UR.includes(pickup));assert.notEqual(calendar(monday).pickup,pickup);assert.equal(calendar(monday+6*24*HOUR).pickup,calendar(monday).pickup);
  assert.equal(new Set(Array.from({length:6},(_,i)=>calendar(monday+i*7*24*HOUR).pickup)).size,6);
  assert.equal(calendar(Date.parse('2026-10-31T15:00:00Z')).guardian,HIDDEN[4]);
  assert.equal(calendar(Date.parse('2027-01-01T00:00:00Z')).guardian,HIDDEN[0]);
  assert.equal(calendar(monday-HOUR).day,'2026-10-04');
});
