import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfile,command,parseProfile,ProfileStore} from '../src/profile.js';
import {calendar} from '../src/economy.js';
import {currentRecord} from '../src/monthly.js';
const NOW=Date.parse('2026-10-05T03:00:00Z'),NEXT=Date.parse('2026-11-01T00:00:00Z');
const ready=()=>{const p=createProfile(NOW);p.cleared=3;return p;};
const act=(p,id,args={},time=NOW)=>{const r=command(p,id,args,time);assert.ok(r.ok,r.message);return r;};
function attempt(p,round,damage=0,time=NOW){act(p,'begin',{mode:'monthly',stage:4},time);const token=p.active.token;return act(p,'settle',{token,round,damage,seconds:37},time);}

test('monthly entries are unlimited, only confirmed rewards pay, and the best result survives weaker attempts',()=>{
  const p=ready();attempt(p,3,300);const first=p.monthlyBest.token;attempt(p,3,500);attempt(p,2,9000);
  assert.equal(p.dreams,600);assert.equal(p.monthlyBest.round,3);assert.equal(p.monthlyBest.damage,500);
  assert.equal(command(p,'claimMonthly',{token:first},NOW).ok,false,'stale confirmation cannot pay a different record');
  act(p,'claimMonthly',{token:p.monthlyBest.token});assert.equal(p.dreams,900);
  const confirmed=structuredClone(p.monthlyClaim);attempt(p,6,1000);assert.equal(p.monthlyBest.round,6);assert.deepEqual(p.monthlyClaim,confirmed);
  assert.equal(command(p,'claimMonthly',{token:p.monthlyBest.token},NOW).ok,false);assert.equal(p.dreams,900);
  assert.ok(parseProfile(JSON.stringify(p)));
});

test('monthly rollover starts a new maximum and reward while retaining a lifetime record outside the result ring',()=>{
  const p=ready();attempt(p,50,30000);act(p,'claimMonthly',{token:p.monthlyBest.token});
  for(let i=0;i<35;i++)attempt(p,1,10);assert.equal(p.results.length,30);assert.equal(p.monthlyLifetime.round,50);
  assert.equal(currentRecord(p,NEXT),null);assert.equal(command(p,'claimMonthly',{token:p.monthlyBest.token},NEXT).ok,false);
  attempt(p,2,50,NEXT);assert.equal(p.monthlyBest.round,2);assert.equal(p.monthlyLifetime.round,50);
  const before=p.dreams;act(p,'claimMonthly',{token:p.monthlyBest.token},NEXT);assert.equal(p.dreams,before+250);
  act(p,'begin',{mode:'monthly'},NEXT);const token=p.active.token;act(p,'settle',{token,round:4,damage:100},Date.parse('2026-12-01T00:00:00Z'));
  assert.equal(p.monthlyBest.period,'2026-12','a crossing attempt belongs to its completion month');
});

test('legacy paid attempts cannot be paid again, but a legacy ongoing entry is allowed to finish and confirm',()=>{
  const legacy=ready();delete legacy.monthlyBest;delete legacy.monthlyLifetime;delete legacy.monthlyClaim;delete legacy.settings.quality;
  legacy.monthly=calendar(NOW).month;legacy.results=[{at:NOW,mode:'monthly',stage:4,round:5,reward:400,won:false}];
  const paid=parseProfile(legacy);assert.ok(paid);assert.equal(paid.monthlyClaim.round,5);assert.equal(command(paid,'claimMonthly',{token:paid.monthlyBest.token},NOW).ok,false);
  act(paid,'begin',{mode:'monthly'});assert.ok(paid.active);
  const oldActive=ready();act(oldActive,'begin',{mode:'monthly'});oldActive.monthly='2026-10';delete oldActive.monthlyBest;delete oldActive.monthlyLifetime;delete oldActive.monthlyClaim;
  const ongoing=parseProfile(oldActive);assert.ok(ongoing);assert.equal(ongoing.monthly,null);
  act(ongoing,'settle',{token:ongoing.active.token,round:2});act(ongoing,'claimMonthly',{token:ongoing.monthlyBest.token});assert.equal(ongoing.dreams,850);
});

test('reward confirmation is an atomic cross-window receipt and malformed records are rejected',()=>{
  const p=ready();attempt(p,3,200);let raw=JSON.stringify(p);const storage={getItem:()=>raw,setItem:(k,v)=>{raw=v;}},a=new ProfileStore(storage,NOW),b=new ProfileStore(storage,NOW);
  assert.ok(a.transact('claimMonthly',{token:p.monthlyBest.token},NOW).ok);assert.equal(b.transact('claimMonthly',{token:p.monthlyBest.token},NOW).ok,false);assert.ok(b.conflict);
  for(const mutate of [r=>r.damage=NaN,r=>r.round=1001,r=>r.deck=['missing'],r=>r.seconds=-1]){const bad=structuredClone(p);mutate(bad.monthlyBest);assert.equal(parseProfile(bad),null);}
});
