import {gameDay,relativeDay,occurrence,baseHourly,HOUR} from '../core/state.js';
import {random} from '../core/rng.js';
export function addMemory(s,id){if(s.memories.includes(id)){s.wallets.memoryDust+=60;return false;}s.memories.push(id);return true;}
export function scheduleLetter(s,now){if(!s.rewards.letter&&s.rewards.letterScheduledDay!==s.calendar.day){s.rewards.letter={day:s.calendar.day,availableAt:now+4*HOUR,actor:s.ui.hero,rates:baseHourly(s)};s.rewards.letterScheduledDay=s.calendar.day;}}
export function resolveCalendar(s,now){
 const day=gameDay(now),cal=s.calendar;if(day<=cal.day)return;
 const absence=day-cal.day,previous=cal.day;cal.day=day;cal.bits=[];
 s.wallets.companionTickets+=2;s.wallets.memoryTickets++;s.wallets.researchPermits=Math.min(4,s.wallets.researchPermits+2);s.wallets.gifts=Math.min(6,s.wallets.gifts+3);cal.interactionCharges=Math.min(2,cal.interactionCharges+1);cal.bits.push('login');
 if(!cal.seasonStarted){s.wallets.memoryTickets+=3;cal.seasonStarted=true;}
 const occ=occurrence(s);
 if(absence>=3&&previous>=s.epochDay&&!s.rewards.comebacks[occ]){const r=baseHourly(s);for(const k of ['xp','gold','forgeOre'])s.wallets[k]+=Math.floor(r[k]*12);s.rewards.comebacks[occ]=true;s.rewards.comebackEnd=now+72*HOUR;}
 if(s.gates.lastEchoRefreshDay<day){s.gates.echoCharge=true;s.gates.lastEchoRefreshDay=day;}
 s.rewards.butterfly={day,appearsAt:now+(30+Math.floor(random(s,'reward')*61))*1000,golden:random(s,'reward')<.05,claimed:false};
}
export function daily(s,bit,now){const c=s.calendar;if(c.bits.includes(bit))return;
 c.bits.push(bit);if(bit==='claim'){s.wallets.companionTickets+=2;s.wallets.memoryTickets++;scheduleLetter(s,now);}if(bit==='maintain'){s.wallets.companionTickets++;s.wallets.memoryTickets++;}
 if(['login','claim','maintain'].every(x=>c.bits.includes(x))&&!c.qualified[c.day]){
  c.qualified[c.day]=true;const week=Math.floor(relativeDay(s)/7),occ=occurrence(s),w=c.weeks[week]||{days:0,awarded:[]};w.days++;for(const n of [2,4,6])if(w.days>=n&&!w.awarded.includes(n)){s.wallets.memoryTickets+=3;s.wallets.adventureBadges++;w.awarded.push(n);}c.weeks[week]=w;
  c.seasonPoints[occ]=(c.seasonPoints[occ]||0)+10;
  if(occ===0||occ>=4){const rewards=c.seasonRewards[occ]||[];for(const n of [10,40,80,120,160,200,240])if(c.seasonPoints[occ]>=n&&!rewards.includes(n)){if(n===40)s.wallets.bondTokens+=20;if(n===80)s.wallets.memoryDust+=20;if(n===160)s.wallets.bondTokens+=40;if(n===200)s.wallets.memoryDust+=40;if(n===240)addMemory(s,'s01_lumi_whale');if(n===10||n===120){const id='s01-'+n;if(!s.decor.includes(id))s.decor.push(id);}rewards.push(n);}c.seasonRewards[occ]=rewards;}
  scheduleLetter(s,now);
 }
}
export const seasonActive=s=>occurrence(s)===0||occurrence(s)>=4;
