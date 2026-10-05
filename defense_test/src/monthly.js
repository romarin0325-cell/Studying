import {HERO} from './content.js';
import {calendar} from './economy.js';

export const monthlyReward=record=>150+record.round*50;
export const betterRecord=(a,b)=>!b||a.round>b.round||a.round===b.round&&a.damage>b.damage;
export const currentRecord=(p,now)=>p.monthlyBest?.period===calendar(now).month?p.monthlyBest:null;
export function validRecord(r){
  return r===null||!!r&&/^\d{4}-\d{2}$/.test(r.period)&&typeof r.token==='string'&&r.token.length<=100&&
    Number.isSafeInteger(r.round)&&r.round>=0&&r.round<=1000&&Number.isFinite(r.damage)&&r.damage>=0&&r.damage<1e100&&
    Number.isFinite(r.seconds)&&r.seconds>=0&&r.seconds<1e100&&Number.isSafeInteger(r.at)&&r.at>=0&&
    calendar(r.at).month===r.period&&Array.isArray(r.deck)&&r.deck.length===5&&new Set(r.deck).size===5&&r.deck.every(id=>HERO[id]);
}
export function migrateMonthly(p){
  if(Object.hasOwn(p,'monthlyBest'))return;
  // The old marker meant entry consumed, and finished attempts paid instantly.
  // Preserve those paid months. A still-active old attempt has not paid yet.
  const records=(p.results||[]).filter(r=>r.mode==='monthly').map(r=>({period:calendar(r.at).month,token:`legacy-${r.at}`,round:r.round,damage:0,seconds:0,at:r.at,deck:[...p.deck]}));
  p.monthlyBest=records.find(r=>r.period===p.monthly)||null;
  p.monthlyLifetime=records.reduce((best,r)=>betterRecord(r,best)?r:best,null);
  p.monthlyClaim=p.monthlyBest;
  if(p.active?.mode==='monthly'&&!p.monthlyBest)p.monthly=null;
}
