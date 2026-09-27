import {snapshot,purchaseLevels,gearCost} from '../systems/growth.js';
import {clone} from '../core/rng.js';
import {COMPANIONS,ARTIFACTS} from '../data/catalog.js';
import {simulateBattle} from './engine.js';
export async function analyzeDefeat(s,heroId,encounter){
 if(!s.battleHistory.some(r=>r.encounterId===encounter.id&&r.loadout.heroId===heroId&&r.winner==='enemy'))throw Error('첫 패배 뒤에 돌파 분석을 사용할 수 있습니다.');
 const original=snapshot(s,heroId),baseline=simulateBattle(original,encounter,undefined,{trace:false}),candidates=[];
 if(original.level<400){const copy=clone(s);copy.wallets.xp=copy.wallets.gold=1e12;const receipt=purchaseLevels(copy,heroId,5);candidates.push({name:`레벨 +${receipt.levels}`,loadout:snapshot(copy,heroId),cost:{xp:receipt.xp,gold:receipt.gold},steps:receipt.levels,command:{type:'level',heroId,count:receipt.levels}});}
 for(const [slot,name]of [['weapon','무기'],['armor','방어구'],['accessory','장신구']])if(original.gear[slot]<100&&(slot!=='accessory'||Object.values(s.heroes).reduce((a,h)=>a+h.stage,0)>=20)){const l=clone(original),cost=gearCost(l.gear[slot]);l.gear[slot]++;candidates.push({name:name+' +1',loadout:l,cost,steps:1,command:{type:'gear',heroId,slot,count:1}});}
 if(original.nodes>=2){const l=clone(original);l.style=1-l.style;candidates.push({name:'다른 숙련 스타일',loadout:l,cost:{},steps:0,command:{type:'style',heroId,value:l.style}});}
 const companion=COMPANIONS.find(c=>s.companions[c.id].owned&&!original.companions.includes(c.id));if(companion){const l=clone(original);l.companions[0]=companion.id;l.companionRanks=Object.fromEntries(l.companions.filter(Boolean).map(id=>[id,s.companions[id].rank]));candidates.push({name:companion.name+' 지원',loadout:l,cost:{},steps:0,command:{type:'assign',heroId,slot:0,companionId:companion.id}});}
 const artifact=ARTIFACTS.find(a=>s.artifacts[a.id]>0&&a.id!==original.artifact);if(artifact){const l=clone(original);l.artifact=artifact.id;l.artifactRank=s.artifacts[artifact.id];candidates.push({name:artifact.name,loadout:l,cost:{},steps:0,command:{type:'equipArtifact',heroId,artifactId:artifact.id}});}
 const held=clone(original);held.tactics.hold=!held.tactics.hold;candidates.push({name:held.tactics.hold?'방어 구간 공격 보류':'즉시 공격',loadout:held,cost:{},steps:0,command:{type:'tactics',heroId,tactics:held.tactics}});
 const results=[];for(const candidate of candidates.slice(0,8)){await new Promise(resolve=>setTimeout(resolve,0));const result=simulateBattle(candidate.loadout,encounter,undefined,{trace:false});results.push({...candidate,affordable:Object.entries(candidate.cost).every(([k,v])=>s.wallets[k]>=v),result,improvement:baseline.enemyHP/baseline.enemyMaxHP-result.enemyHP/result.enemyMaxHP});}
 const rank=(a,b)=>(b.result.winner==='hero')-(a.result.winner==='hero')||b.improvement-a.improvement;
 return {baseline,results,actionable:[...results].filter(x=>x.affordable&&x.improvement>0).sort(rank)[0]||null,fewest:[...results].filter(x=>x.result.winner==='hero').sort((a,b)=>a.steps-b.steps||rank(a,b))[0]||null};
}
