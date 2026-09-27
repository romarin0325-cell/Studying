import {balance,COMPANIONS,INITIAL,season} from '../data/catalog.js';
import {random,weighted,requireThat} from '../core/rng.js';
import {addMemory,seasonActive} from './seasons.js';
export const poolMemories=s=>[...season.memoryPoolArchive,...(seasonActive(s)?season.memoryPoolCurrent:[])];
export const tierRank={white:0,bronze:1,silver:2,gold:3,star:4};
export function resolveSummon(s,pool,count,id,{free=false}={}){
 requireThat(['companion','memory'].includes(pool)&&Number.isInteger(count)&&count>=1&&count<=100,'소환 수량을 확인해 주세요.');
 const key=pool+'Tickets';requireThat(free||s.wallets[key]>=count,'소환권이 부족합니다.');if(!free)s.wallets[key]-=count;
 const cfg=balance.summon[pool],results=[];
 for(let i=0;i<count;i++){
  const draw=++s.gacha.counts[pool];let tier=weighted(cfg.resultTiers,random(s,pool));let item=null,duplicate=false;
  const guarantee=pool==='companion'&&draw===10&&!s.gacha.beginner;
  if(guarantee)tier=cfg.resultTiers[0];
  if(tier.id==='star'){
   let candidates;
   if(pool==='companion')candidates=COMPANIONS.filter(c=>!guarantee||(!INITIAL.includes(c.id)&&!s.companions[c.id].owned)).map(c=>c.id);
   else {const current=seasonActive(s)&&random(s,pool)<.4;candidates=current?season.memoryPoolCurrent:season.memoryPoolArchive;}
   requireThat(candidates.length,'대상 풀이 비어 있습니다.');item=candidates[Math.floor(random(s,pool)*candidates.length)];
   if(pool==='companion'){duplicate=s.companions[item].owned;if(duplicate)s.wallets.bondTokens+=20;else s.companions[item].owned=true;if(!INITIAL.includes(item))s.gacha.beginner=true;}
   else duplicate=!addMemory(s,item);
  }else{s.wallets.bondTokens+=tier.bondTokens||0;s.wallets.memoryDust+=tier.memoryDust||0;}
  const threshold=Math.floor(draw/cfg.selectorEveryDraws);if(threshold>s.gacha.issued[pool]){s.wallets[pool+'Selectors']+=threshold-s.gacha.issued[pool];s.gacha.issued[pool]=threshold;}
  results.push({index:i,tier:tier.id,item,duplicate,amount:tier.bondTokens||tier.memoryDust||(duplicate?(pool==='companion'?20:60):0),guarantee});
 }
 const batch={id,pool,count,results,revealed:false,echoed:false,day:s.calendar.day};s.gacha.batches.push(batch);s.gacha.batches=s.gacha.batches.slice(-30);return batch;
}
export function exchange(s,pool,id,method){
 const comp=pool==='companion';requireThat(comp?!!s.companions[id]:poolMemories(s).includes(id),'현재 교환 가능한 대상이 아닙니다.');requireThat(comp?!s.companions[id].owned:!s.memories.includes(id),'이미 보유한 대상입니다. 재료는 사용하지 않았습니다.');
 const key=method==='selector'?pool+'Selectors':comp?'bondTokens':'memoryDust',cost=method==='selector'?1:comp?120:200;
 requireThat(s.wallets[key]>=cost,'교환 재료가 부족합니다.');s.wallets[key]-=cost;if(comp)s.companions[id].owned=true;else addMemory(s,id);
}
