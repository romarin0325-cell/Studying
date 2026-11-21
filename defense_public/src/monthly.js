import {HERO,TIERS,TIER_IDS,CHALLENGE_WAVES} from './content.js';
import {calendar} from './economy.js';
import {TEAM_SIZE} from './team-config.js';

const tierOf=r=>r?.tier||'easy',rankOf=r=>TIER_IDS.indexOf(tierOf(r));
// Rewards: base plus a share per wave/boss and a full-clear bonus, scaled by tier.
// The meteor draft opens three times a week. Its gems follow the week's best record: a run that beats it pays the
// rise, so retries buy a better draft, not three weekly rewards. (Three separately paid runs at the same weekly total
// would pay a third each: a bad draft would cost again and the full reward would need three clears.)
export const WEEKLY_ENTRIES=3;
export const weeklyReward=(tier,round,won)=>Math.round((100+25*Math.min(round,CHALLENGE_WAVES)+(won?100:0))*(TIERS[tier]||TIERS.easy).reward);
export const MONTHLY_REWARDS=Object.freeze({base:110,perBoss:38,clear:165});
export const monthlyReward=record=>Math.round((MONTHLY_REWARDS.base+MONTHLY_REWARDS.perBoss*Math.min(record.round,CHALLENGE_WAVES)+(record.round>=CHALLENGE_WAVES?MONTHLY_REWARDS.clear:0))*(TIERS[tierOf(record)]||TIERS.easy).reward);
// Higher tier first, then more bosses, then more damage. The lifetime record keeps this order.
export const betterRecord=(a,b)=>!b||rankOf(a)>rankOf(b)||rankOf(a)===rankOf(b)&&(a.round>b.round||a.round===b.round&&a.damage>b.damage);
// This month's record is the one that pays most, so a short try at a higher tier never lowers the claim.
export const betterMonth=(a,b)=>!b||monthlyReward(a)>monthlyReward(b)||monthlyReward(a)===monthlyReward(b)&&betterRecord(a,b);
export const currentRecord=(p,now)=>p.monthlyBest?.period===calendar(now).month?p.monthlyBest:null;
// One rule for every period challenge (draft, hunt, oath, twin): the period's best record sets the reward, and a better
// record pays the rise at once. Nothing is claimed by hand and nothing is lost by playing again or by waiting.
// monthly is the month that has been paid; monthlyClaim is the record it has been paid up to. A month marked paid
// without a record comes from the oldest saves: the amount is unknown, so that month is closed.
export const monthlyPaid=(p,now)=>p.monthly!==calendar(now).month?0:p.monthlyClaim?monthlyReward(p.monthlyClaim):Infinity;
export const monthlyDue=(p,now)=>{const record=currentRecord(p,now);return record?Math.max(0,monthlyReward(record)-monthlyPaid(p,now)):0;};
export function validRecord(r){
  return r===null||!!r&&/^\d{4}-\d{2}$/.test(r.period)&&typeof r.token==='string'&&r.token.length<=100&&
    Number.isSafeInteger(r.round)&&r.round>=0&&r.round<=1000&&Number.isFinite(r.damage)&&r.damage>=0&&r.damage<1e100&&
    Number.isFinite(r.seconds)&&r.seconds>=0&&r.seconds<1e100&&Number.isSafeInteger(r.at)&&r.at>=0&&
    calendar(r.at).month===r.period&&(r.tier===undefined||!!TIERS[r.tier])&&Array.isArray(r.deck)&&r.deck.length===TEAM_SIZE&&new Set(r.deck).size===TEAM_SIZE&&r.deck.every(id=>HERO[id]);
}
export function migrateMonthly(p){
  if(Object.hasOwn(p,'monthlyBest'))return;
  // The oldest marker meant entry consumed, and finished attempts paid instantly.
  // Preserve those paid months. A still-active old attempt has not paid yet.
  const records=(p.results||[]).filter(r=>r.mode==='monthly').map(r=>({period:calendar(r.at).month,token:`legacy-${r.at}`,round:r.round,damage:0,seconds:0,at:r.at,deck:[...p.deck]}));
  p.monthlyBest=records.find(r=>r.period===p.monthly)||null;
  p.monthlyLifetime=records.reduce((best,r)=>betterRecord(r,best)?r:best,null);
  p.monthlyClaim=p.monthlyBest;
  if(p.active?.mode==='monthly'&&!p.monthlyBest)p.monthly=null;
}
