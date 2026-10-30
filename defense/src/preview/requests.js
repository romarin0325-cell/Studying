import {HOUR} from '../economy.js';
import {REQUESTS} from './requests-data.js';

export const REQUEST_MAX=3,REQUEST_GAP_MIN=48*HOUR,REQUEST_GAP_SPAN=24*HOUR,REQUEST_FLAGS=Object.freeze(['moonlit','spared']);
export const REQUEST=Object.fromEntries(REQUESTS.map(r=>[r.id,r]));
export function requestState(p,now){
  const r=p?.requests;
  if(!r||typeof r!=='object'||Array.isArray(r))return {next:now,active:[],claimed:[],after:[],read:[]};
  return {
    next:r.next,active:(Array.isArray(r.active)?r.active:[]).map(e=>({id:e.id,at:e.at,seen:e.seen,count:e.count,done:e.done})),
    claimed:Array.isArray(r.claimed)?[...r.claimed]:[],after:Array.isArray(r.after)?[...r.after]:[],read:Array.isArray(r.read)?[...r.read]:[],
  };
}
// Rank goals are done once (the star count lives on the goal). Every other goal counts to goal.n.
export function requestGoal(id){const goal=REQUEST[id]?.goal;if(!goal)return undefined;return goal.type==='rank'?1:goal.n;}
export function requestTracker(){
  const casts={},ranks={},flags=new Set();let bosses=0;
  return {
    observe(run,events){
      if(Array.isArray(run?.board))for(const u of run.board)if(u?.hero&&Number.isInteger(u.rank)&&u.rank>0)ranks[u.hero]=Math.max(ranks[u.hero]||0,u.rank);
      const batch=Array.isArray(events)?events:[];
      for(const e of batch){
        if(!e||typeof e!=='object')continue;
        if(e.type==='skill'){
          casts[e.hero]=(casts[e.hero]||0)+1;
          if(e.hero==='night_rabbit'&&run?.board?.some(u=>u?.hero==='silver_rabbit')&&run.board.some(u=>u?.hero==='snow_rabbit'))flags.add('moonlit');
        }else if(e.type==='kill'&&e.boss)bosses++;
      }
      if(batch.some(e=>e?.type==='skill'&&e.hero==='ash')&&!batch.some(e=>e?.type==='reduce'&&e.by==='ash'))flags.add('spared');
    },
    feats(won){return {won:!!won,casts:{...casts},bosses,flags:[...flags],ranks:{...ranks}};},
  };
}
