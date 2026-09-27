import {BOSS,VERSION} from '../data/catalog.js';
import {baseHourly,totalStage} from '../core/state.js';
import {hash,requireThat} from '../core/rng.js';
import {snapshot} from './growth.js';
import {daily} from './seasons.js';
export function applyBattleResult(s,result,now){
 const {heroId}=result.loadout,h=s.heroes[heroId],e=result.encounter;
 requireThat(h&&result.contentVersion===VERSION&&result.loadoutHash===hash(snapshot(s,heroId)),'편성이 바뀌었습니다. 현재 편성으로 다시 도전해 주세요.');
 if(e.kind==='expedition'){
  requireThat(e.heroId===heroId&&e.stage===h.stage+1,'이미 처리했거나 다른 단계의 전투입니다.');
  if(result.winner==='hero'){h.stage=e.stage;if(e.stage%10===0){const r=baseHourly(s);s.wallets.xp+=Math.floor(r.xp*.1);s.wallets.gold+=Math.floor(r.gold*.1);h.training+=4;for(const id of h.companions.filter(Boolean)){const record=`${heroId}:${e.stage}`;if(!s.companions[id].gates.includes(record))s.companions[id].gates.push(record);}if(e.stage%20===0)s.wallets.companionTickets++;if(result.heroHP/result.heroMaxHP<=.1||result.elapsedTicks>=e.maxTicks-60)h.bond+=2;}}
 }else if(e.kind==='boss'){
  requireThat(BOSS[e.bossId]&&totalStage(s)>=BOSS[e.bossId].unlockTotalMedals,'아직 열리지 않은 보스입니다.');
  const boss=s.bossRecords[e.bossId]||{},highest=Math.max(0,...Object.keys(boss).filter(t=>boss[t].cleared).map(Number));
  requireThat(Number.isInteger(e.tier)&&e.tier>=1&&e.tier<=Math.min(50,highest+1),'이전 티어를 먼저 완료해 주세요.');
  const row=boss[e.tier]||{cleared:false,heroes:{},version:VERSION};
  if(row.version!==VERSION){row.heroes={};row.version=VERSION;}
  const old=row.heroes[heroId];if(!old||result.score>old.score)row.heroes[heroId]={score:result.score,digest:result.replayDigest};
  const victory=e.bossId==='astea'?Object.values(row.heroes).reduce((n,v)=>n+v.score,0)>=3.5:result.winner==='hero';
  if(victory&&!row.cleared){row.cleared=true;s.bossTraces[e.bossId]=(s.bossTraces[e.bossId]||0)+6+2*e.tier;if(result.heroHP/result.heroMaxHP<=.1||result.elapsedTicks>=e.maxTicks-60)h.bond+=2;}
  if(e.bossId==='astea'&&Object.values(row.heroes).reduce((n,v)=>n+v.score,0)>=5&&!s.decor.includes('astea-'+e.tier))s.decor.push('astea-'+e.tier);
  boss[e.tier]=row;s.bossRecords[e.bossId]=boss;
 }else throw Error('Unsupported permanent encounter');
 const chapter=Math.floor(Math.min(...Object.values(s.heroes).map(v=>v.stage))/20);for(let c=1;c<=chapter;c++)if(!s.decor.includes('chapter-'+c))s.decor.push('chapter-'+c);
 const {frames,events,...summary}=result;s.battleHistory.push(summary);s.battleHistory=s.battleHistory.slice(-200);s.lastResult=summary;daily(s,'maintain',now);return summary;
}
