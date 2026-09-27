import {DAY,HOUR,Q,rates} from './state.js';
export function logicalNow(s,wall){s.diagnostics.clockWarning=wall+s.clockOffsetMs<s.lastTrustedLogicalMs;return Math.max(s.lastTrustedLogicalMs,wall+s.clockOffsetMs);}
export function settleAccrual(s,now){
 const a=s.accrual,start=a.cursorMs,end=Math.max(start,now),duration=Math.min(end-start,DAY-a.duration),acceptedEnd=start+duration;
 const rate=a.rateSnapshot;
 for(const [id,r] of Object.entries(rate)){
  for(const k of ['xp','gold','forgeOre'])a.pending[k]+=r[k]*duration;
  a.pending.heroes[id].training+=r.training*duration;a.pending.heroes[id].bond+=r.bond*duration;
 }
 if(duration>0){const sums={xp:0,gold:0};for(const r of Object.values(rate)){sums.xp+=r.xp;sums.gold+=r.gold;}const last=a.segments.at(-1);if(last&&last.xp===sums.xp&&last.gold===sums.gold)last.duration+=duration;else a.segments.push({...sums,duration});}
 const grace=s.gates.grace;
 if(grace){const overlap=Math.max(0,Math.min(end,grace.end)-Math.max(start,grace.start));for(const r of Object.values(rate))for(const k of ['xp','gold'])a.boostQ[k]+=r[k]*overlap;}
 const comebackDuration=Math.max(0,Math.min(acceptedEnd,s.rewards.comebackEnd)-start);
 if(comebackDuration)for(const r of Object.values(rate))for(const k of ['xp','gold'])a.comebackQ[k]+=r[k]*comebackDuration/4;
 a.duration+=duration;a.cursorMs=end;s.lastTrustedLogicalMs=Math.max(s.lastTrustedLogicalMs,end);
 return s;
}
export function refreshRates(s){s.accrual.rateSnapshot=rates(s);}
export function takeQ(holder,key){const amount=Math.floor(holder[key]/Q);holder[key]%=Q;return amount;}
export function bonusFromSegments(segments,maxMs=4*HOUR){const q={xp:0,gold:0};let left=maxMs;for(const seg of [...segments].reverse()){const d=Math.min(left,seg.duration);q.xp+=seg.xp*d;q.gold+=seg.gold*d;left-=d;if(!left)break;}return {xp:Math.floor(q.xp/Q),gold:Math.floor(q.gold/Q)};}
