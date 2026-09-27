import {balance,HEROES,BOSSES} from '../data/catalog.js';
import {HOUR,baseHourly} from '../core/state.js';
import {takeQ,bonusFromSegments} from '../core/clock.js';
import {weighted,random,requireThat} from '../core/rng.js';
import {daily,scheduleLetter} from './seasons.js';
export function claimAccrual(s,id,now){
 const a=s.accrual;requireThat(a.duration>0||a.boostQ.xp>=360000000,'아직 수령할 시간이 쌓이지 않았습니다.');
 const summary={id,duration:a.duration,base:{},grace:{},comeback:{},chest:null,bonus:{xp:0,gold:0,forgeOre:0}};
 const amplification=bonusFromSegments(a.segments);
 for(const k of ['xp','gold','forgeOre']){summary.base[k]=takeQ(a.pending,k);s.wallets[k]+=summary.base[k];}
 for(const k of ['xp','gold']){summary.grace[k]=takeQ(a.boostQ,k);summary.comeback[k]=takeQ(a.comebackQ,k);s.wallets[k]+=summary.grace[k]+summary.comeback[k];}
 for(const h of HEROES){s.heroes[h.id].training+=takeQ(a.pending.heroes[h.id],'training');s.heroes[h.id].bond+=takeQ(a.pending.heroes[h.id],'bond');}
 if(a.duration>=2*HOUR&&s.rewards.chestDay!==s.calendar.day){const tier=weighted(balance.rewardEvents.dailyReturnChest.tiers,random(s,'reward'));s.rewards.chestDay=s.calendar.day;summary.chest=tier.id;for(const k of Object.keys(summary.bonus)){summary.bonus[k]=Math.floor(summary.base[k]*tier.bonusMultiplier);s.wallets[k]+=summary.bonus[k];}s.wallets.companionTickets+=tier.companionTickets||0;}
 a.duration=0;a.segments=[];s.gates.claim={id,day:s.calendar.day,amounts:amplification,amplified:false};daily(s,'claim',now);s.lastClaim=summary;return summary;
}
export function collectButterfly(s,now){const b=s.rewards.butterfly;requireThat(b&&!b.claimed&&now>=b.appearsAt,'별나비가 아직 머물지 않았습니다.');const r=baseHourly(s);for(const k of ['xp','gold'])s.wallets[k]+=Math.floor(r[k]/4);if(b.golden)s.wallets.companionTickets++;b.claimed=true;return {golden:b.golden};}
export function collectLetter(s,now){const l=s.rewards.letter;requireThat(l&&now>=l.availableAt,'편지가 아직 도착하지 않았습니다.');for(const k of ['xp','gold'])s.wallets[k]+=Math.floor(l.rates[k]/3);s.rewards.letter=null;scheduleLetter(s,now);return l;}
export function research(s,id){const records=s.bossRecords[id]||{},tiers=Object.keys(records).map(Number).filter(t=>records[t].cleared),tier=Math.max(0,...tiers);requireThat(tier>0&&s.wallets.researchPermits>0,'완료한 티어와 연구권이 필요합니다.');s.wallets.researchPermits--;const spotlight=BOSSES[s.calendar.day%10].id===id;let amount=3+tier;if(spotlight&&s.rewards.spotlightDay!==s.calendar.day){amount=Math.ceil(amount*1.5);s.rewards.spotlightDay=s.calendar.day;}const roll=random(s,'reward'),spark=s.rewards.sparkMisses>=4||roll<(spotlight?.25:.15);if(spark){amount++;s.rewards.sparkMisses=0;}else s.rewards.sparkMisses++;s.bossTraces[id]=(s.bossTraces[id]||0)+amount;return {amount,spark};}
