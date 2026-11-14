import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfile,command,parseProfile,ProfileStore} from '../src/profile.js';
import {calendar} from '../src/economy.js';
import {currentRecord,monthlyReward,monthlyPaid,monthlyDue} from '../src/monthly.js';
import {TIERS,TIER_IDS,CHALLENGE_WAVES} from '../src/content.js';
import {wavePlan,challengeBase} from '../src/combat/engine.js';
const NOW=Date.parse('2026-10-05T03:00:00Z'),NEXT=Date.parse('2026-11-01T00:00:00Z');
const ready=()=>{const p=createProfile(NOW);p.cleared=3;return p;};
const act=(p,id,args={},time=NOW)=>{const r=command(p,id,args,time);assert.ok(r.ok,r.message);return r;};
function attempt(p,round,damage=0,time=NOW){act(p,'begin',{mode:'monthly',stage:4},time);const token=p.active.token;return act(p,'settle',{token,round,damage,seconds:37},time);}

test('monthly health rises ten percent and rewards rise modestly without reversing progression',()=>{
  const previousHp={easy:.33,hard:.33,abyss:.385};
  assert.deepEqual(TIER_IDS.map(tier=>monthlyReward({tier,round:CHALLENGE_WAVES})),[1247,2206,3261]);
  for(const tier of TIER_IDS){
    let reward=-1,hp=0;
    for(let round=0;round<=CHALLENGE_WAVES;round++){
      const next=monthlyReward({tier,round});
      const old=Math.round((100+35*round+(round===CHALLENGE_WAVES?150:0))*TIERS[tier].reward);
      assert.ok(next>reward);assert.ok(next>old&&next<=Math.ceil(old*1.11));reward=next;
      if(!round)continue;
      const base=challengeBase(round,tier).base*30,actual=wavePlan(round,0,'monthly',tier).sequence[0].hp;
      assert.ok(Math.abs(actual-base*previousHp[tier]*1.1)<=.5);
      assert.ok(actual>hp);hp=actual;
      const index=TIER_IDS.indexOf(tier);
      if(index){const lower=TIER_IDS[index-1];assert.ok(next>monthlyReward({tier:lower,round}));assert.ok(actual>wavePlan(round,0,'monthly',lower).sequence[0].hp);}
    }
    assert.equal(monthlyReward({tier,round:CHALLENGE_WAVES+5}),reward,'completed rewards cap at eighteen bosses');
  }
});

test('monthly entries are unlimited, the best record pays at once and a better record pays the rise',()=>{
  const p=ready();const one=attempt(p,3,300);assert.equal(one.reward,monthlyReward({round:3}));assert.equal(one.paidBefore,0);
  const first=p.monthlyBest.token;attempt(p,3,500);const weak=attempt(p,2,9000);
  assert.equal(weak.reward,0);assert.equal(weak.paidBefore,monthlyReward({round:3}));assert.equal(weak.earned,monthlyReward({round:3}));
  assert.equal(p.dreams,600+monthlyReward({round:3}));assert.equal(p.monthlyBest.round,3);assert.equal(p.monthlyBest.damage,500);
  assert.equal(command(p,'claimMonthly',{token:first},NOW).ok,false,'a stale token pays nothing');
  assert.equal(command(p,'claimMonthly',{token:p.monthlyBest.token},NOW).ok,false,'nothing is owed after a settle');
  const up=attempt(p,6,1000);assert.equal(up.reward,monthlyReward({round:6})-monthlyReward({round:3}));assert.equal(up.earned,monthlyReward({round:6}));
  assert.equal(p.monthlyBest.round,6);assert.equal(p.monthlyClaim.round,6);assert.equal(p.dreams,600+monthlyReward({round:6}));
  assert.equal(monthlyDue(p,NOW),0);assert.equal(monthlyPaid(p,NOW),monthlyReward({round:6}));
  // A weaker run pays nothing and lowers nothing.
  act(p,'begin',{mode:'monthly',stage:4,tier:'easy'});act(p,'settle',{token:p.active.token,round:0});assert.equal(p.dreams,600+monthlyReward({round:6}));
  assert.ok(parseProfile(JSON.stringify(p)));
});

test('a save from the claim-once rule is handed what its record is still owed, once',()=>{
  // Claimed at three bosses, then improved to six without pay (the old lock).
  const locked=ready();attempt(locked,3,300);locked.monthlyBest={...locked.monthlyBest,round:6,token:'later'};assert.ok(parseProfile(JSON.stringify(locked)));
  assert.equal(monthlyDue(locked,NOW),monthlyReward({round:6})-monthlyReward({round:3}));
  act(locked,'claimMonthly',{token:'later'});assert.equal(locked.dreams,600+monthlyReward({round:6}));assert.equal(command(locked,'claimMonthly',{token:'later'},NOW).ok,false);
  // A record that was never claimed.
  const waiting=ready();attempt(waiting,4,100);waiting.monthly=null;waiting.monthlyClaim=null;waiting.dreams=600;assert.ok(parseProfile(JSON.stringify(waiting)));
  assert.equal(monthlyDue(waiting,NOW),monthlyReward({round:4}));
  // Its next run pays the whole record, improved or not.
  const next=attempt(waiting,1,10);assert.equal(next.reward,monthlyReward({round:4}));assert.equal(waiting.dreams,600+monthlyReward({round:4}));
  // The oldest saves marked a month paid without a record: the amount is unknown, so nothing more is paid that month.
  const closed=ready();closed.monthly=calendar(NOW).month;attempt(closed,5,100);assert.equal(closed.dreams,600);assert.equal(monthlyDue(closed,NOW),0);
});

test('monthly rollover starts a new maximum and reward while retaining a lifetime record outside the result ring',()=>{
  const p=ready();attempt(p,50,30000);
  for(let i=0;i<35;i++)attempt(p,1,10);assert.equal(p.results.length,30);assert.equal(p.monthlyLifetime.round,50);
  assert.equal(currentRecord(p,NEXT),null);assert.equal(command(p,'claimMonthly',{token:p.monthlyBest.token},NEXT).ok,false);
  const before=p.dreams;attempt(p,2,50,NEXT);assert.equal(p.monthlyBest.round,2);assert.equal(p.monthlyLifetime.round,50);
  assert.equal(p.dreams,before+monthlyReward({round:2}),'the new month pays its own record from zero');
  act(p,'begin',{mode:'monthly'},NEXT);const token=p.active.token;act(p,'settle',{token,round:4,damage:100},Date.parse('2026-12-01T00:00:00Z'));
  assert.equal(p.monthlyBest.period,'2026-12','a crossing attempt belongs to its completion month');
});

test('legacy paid attempts cannot be paid again, but a legacy ongoing entry is allowed to finish and is paid',()=>{
  const legacy=ready();delete legacy.monthlyBest;delete legacy.monthlyLifetime;delete legacy.monthlyClaim;delete legacy.settings.quality;
  legacy.monthly=calendar(NOW).month;legacy.results=[{at:NOW,mode:'monthly',stage:4,round:5,reward:400,won:false}];
  const paid=parseProfile(legacy);assert.ok(paid);assert.equal(paid.monthlyClaim.round,5);assert.equal(command(paid,'claimMonthly',{token:paid.monthlyBest.token},NOW).ok,false);
  act(paid,'begin',{mode:'monthly'});assert.ok(paid.active);
  const oldActive=ready();act(oldActive,'begin',{mode:'monthly'});oldActive.monthly='2026-10';delete oldActive.monthlyBest;delete oldActive.monthlyLifetime;delete oldActive.monthlyClaim;
  const ongoing=parseProfile(oldActive);assert.ok(ongoing);assert.equal(ongoing.monthly,null);
  act(ongoing,'settle',{token:ongoing.active.token,round:2});assert.equal(ongoing.dreams,600+monthlyReward({round:2}));
});

test('an owed reward is an atomic cross-window receipt and malformed records are rejected',()=>{
  const p=ready();attempt(p,3,200);p.monthly=null;p.monthlyClaim=null;p.dreams=600;let raw=JSON.stringify(p);const storage={getItem:()=>raw,setItem:(k,v)=>{raw=v;}},a=new ProfileStore(storage,NOW),b=new ProfileStore(storage,NOW);
  assert.ok(a.transact('claimMonthly',{token:p.monthlyBest.token},NOW).ok);assert.equal(b.transact('claimMonthly',{token:p.monthlyBest.token},NOW).ok,false);assert.ok(b.conflict);
  for(const mutate of [r=>r.damage=NaN,r=>r.round=1001,r=>r.deck=['missing'],r=>r.seconds=-1]){const bad=structuredClone(p);mutate(bad.monthlyBest);assert.equal(parseProfile(bad),null);}
});

test('this month keeps the record that pays most; a short try at a higher tier does not lower the claim',async()=>{
  const {betterMonth,betterRecord,monthlyReward}=await import('../src/monthly.js');
  const easy={tier:'easy',round:18,damage:1},hard={tier:'hard',round:0,damage:9};
  assert.ok(monthlyReward(easy)>monthlyReward(hard));
  assert.equal(betterMonth(hard,easy),false);assert.equal(betterMonth(easy,hard),true);
  assert.equal(betterRecord(hard,easy),true,'the lifetime order still ranks the tier first');
  const hard9={tier:'hard',round:9,damage:1};assert.equal(betterMonth(hard9,easy),monthlyReward(hard9)>monthlyReward(easy));
});
