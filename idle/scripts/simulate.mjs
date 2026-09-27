import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {newState,DAY,HOUR,totalStage} from '../src/core/state.js';
import {hash} from '../src/core/rng.js';
import {reduce} from '../src/core/commands.js';
import {exportSave,validateState} from '../src/core/migrations.js';
import {HEROES,COMPANIONS,BOSSES,ARTIFACTS} from '../src/data/catalog.js';
import {snapshot,levelCost,gearCost} from '../src/systems/growth.js';
import {simulateBattle} from '../src/combat/engine.js';
import {analyzeDefeat} from '../src/combat/analysis.js';
import {expeditionEncounter,bossEncounter} from '../src/combat/encounter.js';
import {SCENES} from '../src/data/scenes.js';
import {unlocked} from '../src/systems/bond.js';
import {resolveSummon,poolMemories} from '../src/systems/gacha.js';
import {adventureEncounter,adventureLoadout,eventFor} from '../src/systems/adventure.js';
const root=path.resolve(import.meta.dirname,'..'),epoch=Date.UTC(2026,0,1,0),quick=process.argv.includes('--quick'),days=quick?7:Number(process.argv.find(x=>x.startsWith('--days='))?.split('=')[1]||180);
const selectedProfile=process.argv.find(x=>x.startsWith('--profile='))?.split('=')[1];
const profiles=selectedProfile?[selectedProfile]:quick?['A']:days===28?['A','B','C']:['A','B','C','focus','focus-switch','unlucky','starter','missed','comeback','gates'];
let battleCount=0;
function unluckySeed(){let best=1,least=Infinity;for(let seed=1;seed<=128;seed++){const s=newState(epoch,seed);const b=resolveSummon(s,'companion',100,'sample',{free:true}),count=b.results.filter(r=>r.item).length;if(count<least){least=count;best=seed;}}return best;}
const worst=unluckySeed(),report={method:'Actual reducer, 20Hz combat; up to four 30-stage batches per hero per session; new support/artifact loadouts get one retry in every profile; A seeks first missing artifact without spotlight optimization, B uses spotlight, C adds same-engine analysis and adventure; no level-to-stage assumption',epoch,days,unluckySeed:worst,profiles:{},snapshots:{},guards:{},battles:0};
async function run(profile){
 let s=newState(epoch,profile==='unlucky'?worst:417),cmd=0,now=epoch,total={xp:0,gold:0,forgeOre:0,companionTickets:0,memoryTickets:0},saved={},stalls=0,longestStall=0,lastGrowth='',nearLosses=0,bronze=0,tens=0,nonFull={companion:0,memory:0},poolTens={companion:0,memory:0},bonusDrought=0,longestBonusDrought=0,bonusSeen=false;
 const act=(type,data={})=>{const before=s.wallets,result=reduce(s,{id:'sim-'+profile+'-'+cmd++,expectedRevision:s.revision,type,...data},{now});s=result.state;const reward=result.result;if(reward&&(reward.chest&&reward.chest!=='wood'||reward.great>0||reward.spark||reward.golden||reward.results?.some(r=>r.tier==='star')))bonusSeen=true;for(const k of Object.keys(total))total[k]+=Math.max(0,s.wallets[k]-before[k]);return result.result;};
 const fight=(l,e)=>{battleCount++;const r=simulateBattle(l,e,undefined,{trace:false});if(r.winner==='hero'&&(r.heroHP/r.heroMaxHP<=.1||r.elapsedTicks>=e.maxTicks-60))nearLosses++;return r;};
 act('tutorial');
 if(profile==='A')await fs.writeFile(path.join(root,'tests/fixtures/new.json'),exportSave(s));
 function grow(){
  for(let i=0;i<2000;i++){const candidates=HEROES.filter(h=>s.heroes[h.id].level<400).sort((a,b)=>(profile==='focus'||profile==='focus-switch'&&now<epoch+28*DAY)?(a.id==='lumi'?-1:b.id==='lumi'?1:s.heroes[a.id].level-s.heroes[b.id].level):s.heroes[a.id].level-s.heroes[b.id].level),target=candidates.find(h=>{const c=levelCost(s,h.id);return s.wallets.xp>=c.xp&&s.wallets.gold>=c.gold;});if(!target)break;act('level',{heroId:target.id,count:1});}
  for(const h of HEROES)while(s.heroes[h.id].nodes<60&&s.heroes[h.id].training>=36+12*s.heroes[h.id].nodes)act('mastery',{heroId:h.id});
  for(let i=0;i<500;i++){const candidates=HEROES.flatMap(h=>['weapon','armor','accessory'].filter(slot=>slot!=='accessory'||totalStage(s)>=20).map(slot=>({hero:h.id,slot,g:s.heroes[h.id].gear[slot]}))).filter(x=>x.g<100).sort((a,b)=>(a.g+(a.slot==='weapon'?-2:a.slot==='armor'?0:3))-(b.g+(b.slot==='weapon'?-2:b.slot==='armor'?0:3)));const target=candidates.find(x=>{const c=gearCost(x.g);return s.wallets.forgeOre>=c.forgeOre&&s.wallets.gold>=c.gold;});if(!target)break;act('gear',{heroId:target.hero,slot:target.slot,count:1});}
 }
 function progressWorld(){
  for(const h of HEROES)for(let i=0;i<120&&s.heroes[h.id].stage<1200;i++){const r=fight(snapshot(s,h.id),expeditionEncounter(h.id,s.heroes[h.id].stage+1));act('battle',{result:r});if(r.winner!=='hero')break;}
 }
 function summons(){
  if(profile==='starter')return;
  for(const pool of ['companion','memory'])while(s.wallets[pool+'Tickets']>=10){const b=act('summon',{pool,count:10});act('reveal',{batchId:b.id});tens++;bronze+=b.results.filter(r=>r.tier!=='white').length;poolTens[pool]++;nonFull[pool]+=b.results.filter(r=>r.tier!=='white'&&r.tier!=='star').length;if(profile==='gates'&&s.gates.used.echo!==s.calendar.day){solve('echo',b.id);}}
  const unowned=()=>COMPANIONS.find(c=>!s.companions[c.id].owned);
  while(s.wallets.companionSelectors&&unowned())act('exchange',{pool:'companion',itemId:unowned().id,method:'selector'});
  while(s.wallets.bondTokens>=120&&unowned())act('exchange',{pool:'companion',itemId:unowned().id,method:'token'});
  while(s.wallets.memorySelectors){const id=poolMemories(s).find(x=>!s.memories.includes(x));if(!id)break;act('exchange',{pool:'memory',itemId:id,method:'selector'});}
  while(s.wallets.memoryDust>=200){const id=poolMemories(s).find(x=>!s.memories.includes(x));if(!id)break;act('exchange',{pool:'memory',itemId:id,method:'dust'});}
  if(totalStage(s)>=15){for(const h of HEROES)if(!s.heroes[h.id].companions[1]){const id=COMPANIONS.find(c=>s.companions[c.id].owned&&!HEROES.some(hero=>s.heroes[hero.id].companions.includes(c.id)))?.id;if(id)act('assign',{heroId:h.id,slot:1,companionId:id});}}
 }
 function solve(gate,batchId){act('gate',{gate,batchId});const c=s.gates.challenge;if(c.question.kind==='grammar')act('lecture',{challengeId:c.id});act('answer',{challengeId:c.id,answer:c.question.answer});}
 function bossResearch(){
  // One next-tier attempt per session; all five only for the independent Astéa score trial.
  const accessible=BOSSES.filter(b=>totalStage(s)>=b.unlockTotalMedals),preferred=accessible.find(b=>b.id===BOSSES[s.calendar.day%10].id);
  const boss=['A','focus','focus-switch','unlucky','starter'].includes(profile)?accessible.find(b=>!s.artifacts[b.artifact.id])||accessible[s.calendar.day%accessible.length]:preferred||accessible[0];if(!boss)return;
  const records=s.bossRecords[boss.id]||{},highest=Math.max(0,...Object.keys(records).filter(t=>records[t].cleared).map(Number)),tier=Math.min(50,highest+1),strongest=HEROES.reduce((a,b)=>s.heroes[a.id].level>=s.heroes[b.id].level?a:b);
  const heroes=boss.id==='astea'?HEROES:[strongest];for(const h of heroes)act('battle',{result:fight(snapshot(s,h.id),bossEncounter(boss.id,tier))});
  const cleared=Object.values(s.bossRecords[boss.id]||{}).some(r=>r.cleared);if(cleared)while(s.wallets.researchPermits>0)act('research',{bossId:boss.id});
  for(const a of ARTIFACTS){let rank=s.artifacts[a.id];while(rank<5){const cost=rank===0?12:[20,35,55,80][rank-1];if(totalStage(s)<30||(s.bossTraces[a.bossId]||0)<cost)break;act('artifact',{artifactId:a.id});rank++;}if(rank&&!HEROES.some(h=>s.heroes[h.id].artifact===a.id)){const target=HEROES.find(h=>!s.heroes[h.id].artifact);if(target)act('equipArtifact',{heroId:target.id,artifactId:a.id});}}
 }
 function adventure(){
  if(profile!=='C'||totalStage(s)<60)return;const week=Math.floor((s.calendar.day-s.epochDay)/7),cleared=(s.adventureSlots[week]||[]).filter(x=>x.cleared).length;if(cleared>=3)return;
  act('adventureStart',{heroId:'lumi'});while(!s.adventure.finished&&!s.adventure.failed){const r=s.adventure;if(r.offer.length){const pref=['patient_guard','warm_return','overflowing_mana','glass_star','little_companion'];act('adventureRelic',{itemId:pref.find(x=>r.offer.includes(x))||r.offer[0]});}else if([1,3,5,8].includes(r.node))act('adventureBattle',{result:fight(adventureLoadout(s),adventureEncounter(s))});else act('adventureEvent',{choice:0});}
 }
 for(let day=0;day<days;day++){
  bonusSeen=false;if(profile==='missed'&&day===3)continue;if(profile==='comeback'&&[5,6,7].includes(day))continue;
  const sessions=['B','C'].includes(profile)?2:1;
  for(let session=0;session<sessions;session++){now=epoch+day*DAY+session*12*HOUR+5*60000;act('tick');act('claim');if(profile==='gates'&&s.gates.claim.amounts.xp>0&&s.gates.used.return!==s.calendar.day)solve('return');grow();progressWorld();if(profile==='C'&&s.lastResult?.winner==='enemy'){const failure=s.lastResult,analysis=await analyzeDefeat(s,failure.loadout.heroId,failure.encounter);if(analysis.actionable){act(analysis.actionable.command.type,analysis.actionable.command);progressWorld();}}act('maintain');const priorLoadouts=hash(HEROES.map(h=>snapshot(s,h.id)));summons();bossResearch();if(priorLoadouts!==hash(HEROES.map(h=>snapshot(s,h.id))))progressWorld();if(session===0){if(s.calendar.interactionCharges)act('interact',{heroId:'lumi'});while(s.wallets.gifts)act('gift',{heroId:'lumi'});for(const scene of SCENES)if(!s.readScenes.includes(scene.id)&&unlocked(s,scene))act('scene',{sceneId:scene.id,skip:true});adventure();}
   if(s.rewards.letter&&now>=s.rewards.letter.availableAt)act('letter');
   now+=90000;act('tick');if(s.rewards.butterfly&&!s.rewards.butterfly.claimed&&now>=s.rewards.butterfly.appearsAt)act('butterfly');
   if(profile==='gates'&&s.gates.used.grace!==s.calendar.day)solve('grace');
  }
  validateState(s);if((profile==='comeback'&&day===8)||(profile==='missed'&&day===27))await fs.writeFile(path.join(root,'tests/fixtures/'+profile+'.json'),exportSave(s));bonusDrought=bonusSeen?0:bonusDrought+1;longestBonusDrought=Math.max(longestBonusDrought,bonusDrought);
  const growth=JSON.stringify(HEROES.map(h=>[s.heroes[h.id].level,s.heroes[h.id].nodes,s.heroes[h.id].gear,s.heroes[h.id].stage]));stalls=growth===lastGrowth?stalls+1:0;longestStall=Math.max(stalls,longestStall);lastGrowth=growth;
  if([7,28,30,90,180].includes(day+1)){saved[day+1]={levels:HEROES.map(h=>s.heroes[h.id].level),stages:HEROES.map(h=>s.heroes[h.id].stage),totalStage:totalStage(s),gross:{...total},draws:{...s.gacha.counts},ownedCompanions:COMPANIONS.filter(c=>s.companions[c.id].owned).length,memories:s.memories.length,bondLumi:s.heroes.lumi.bond,mastery:HEROES.map(h=>s.heroes[h.id].nodes),longestAllGrowthStall:longestStall,nearLosses,longestBonusDrought,bronzeOrBetterPerTen:tens?bronze/tens:0,nonFullBronzeOrBetterPerTen:Object.fromEntries(Object.keys(nonFull).map(pool=>[pool,poolTens[pool]?nonFull[pool]/poolTens[pool]:0]))};if(profile==='A'&&[7,30].includes(day+1))await fs.writeFile(path.join(root,'tests/fixtures/day'+(day+1)+'.json'),exportSave(s));}
 }
 return saved;
}
for(const p of profiles){const started=performance.now();report.profiles[p]=await run(p);await fs.writeFile(path.join(root,'docs/economy-progress.json'),JSON.stringify(report,null,2)+'\n');console.log(p+' · '+Math.round(performance.now()-started)+' ms · '+JSON.stringify(report.profiles[p][days]||report.profiles[p][28]));}
if(!quick&&!selectedProfile){for(const day of [28,90,180].filter(day=>day<=days)){const a=report.profiles.A[day],b=report.profiles.B[day],c=report.profiles.C[day],ratio=(x,y)=>+(x/Math.max(1,y)).toFixed(4);const g={resourcesB:{},resourcesC:{},summonsB:{},summonsC:{},stageC:ratio(c.totalStage,a.totalStage)};for(const key of ['xp','gold','forgeOre']){g.resourcesB[key]=ratio(b.gross[key],a.gross[key]);g.resourcesC[key]=ratio(c.gross[key],a.gross[key]);}for(const key of ['companion','memory']){g.summonsB[key]=ratio(b.draws[key],a.draws[key]);g.summonsC[key]=ratio(c.draws[key],a.draws[key]);}g.pass=Object.values(g.resourcesB).every(n=>n<=1.10)&&Object.values(g.resourcesC).every(n=>n<=1.25)&&Object.values(g.summonsB).every(n=>n<=1.10)&&Object.values(g.summonsC).every(n=>n<=1.20)&&g.stageC<=1.15;report.guards[day]=g;}if(report.profiles.comeback){const comeback=report.profiles.comeback[28],a=report.profiles.A[28];report.comebackPass=['xp','gold','forgeOre'].every(k=>comeback.gross[k]<=a.gross[k]);}else report.comebackPass=true;}
report.battles=battleCount;await fs.writeFile(path.join(root,'docs/economy-'+(selectedProfile?selectedProfile:quick?'quick':days===180?'long':'tuning')+'.json'),JSON.stringify(report,null,2)+'\n');console.log('actual battles:',battleCount,'guards:',JSON.stringify(report.guards),'comeback:',report.comebackPass);
if(!quick&&!selectedProfile&&(!Object.values(report.guards).every(g=>g.pass)||!report.comebackPass))process.exitCode=1;
