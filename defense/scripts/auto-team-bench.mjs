// Auto formation check in real battles: synthetic accounts (real draw rates, duplicates turned into enhancement) pick a
// deck three ways and play the same main stage and weekly draft seeds with both autos:
//   old       combat power order with the 2026-11-14 power (rarity x aura x growth), copied below
//   practical that power times the fifth-member index of 2026-11-16 (PRACTICAL below, replaced the same day)
//   new       autoDeck from src (roles, synergies, combat power with the overall factor)
// Written by GPT 6.1 Terra on 2026-11-16, adapted to the stage levels and the three-way comparison.  node defense/scripts/auto-team-bench.mjs [--accounts-per-point 8] [--seeds 3] [--points 20,60,150,400] [--json out.json]
import {writeFile} from 'node:fs/promises';
import {HERO,HEROES,compareRarity,levelOf,levelStage,LATE_UNLOCK_STAGE} from '../src/content.js';
import {createProfile} from '../src/profile.js';
import {drawCharacter,calendar,duplicateCost,collectionBonus,springGauge,seedGold,heroMultiplier,specialMultiplier,POWER_BASE,POWER_RARITY,POWER_SPECIAL_SHARE} from '../src/economy.js';
import {battleMeta,autoPlay as basic,clearedRounds} from '../src/battle.js';
import {smartAutoPlay as smart} from '../src/smart-auto.js';
import {autoDeck} from '../src/auto-team.js';
import * as engine from '../src/combat/engine.js';
const args=process.argv.slice(2),opt=(name,def)=>{const i=args.indexOf('--'+name);return i<0?def:args[i+1];};
const per=Number(opt('accounts-per-point',8)),seeds=Number(opt('seeds',3)),bestAccounts=Number(opt('best-accounts',0)),out=opt('json',null);
const PRACTICAL={ancient_dragon:1.012,antropy:0.969,ash:0.937,aurora:0.895,avalanche_maid:1.101,behemoth:0.918,cherry_prince:0.896,cinderella:1.021,cure_master:0.94,demon_king:0.889,doom:1.055,flame_sage:1.085,frost_witch:1.28,galaxy_whale:1.249,gold_dragon:0.904,great_detective:0.844,guardian:0.98,harmonious:0.965,jasmine:0.972,joker:0.949,lightning_sage:0.987,luna:0.893,miracle_larva:1.114,mushroom_king:0.986,night_rabbit:0.929,phantom:1.123,queen:1.102,red_dragon:0.96,rumi:1.059,santa:1.009,silver_rabbit:0.886,siren:0.878,snow_rabbit:1.103,star_boy:0.865,storm_sage:1.183,sunflower:0.952,time_magician:1.047,time_ruler:1.301,toffee_apple:0.897,underdog:0.913,venom:0.906,zeke:1.05};
const AURA=['hasteAura','powerAura','harmonyAura'];
const oldPower=(id,e,beds,bonus)=>Math.round(POWER_BASE*POWER_RARITY[HERO[id].rarity]*(AURA.includes(HERO[id].trait.type)?1.2:1)*heroMultiplier(e,beds)*(1+bonus)*(1+POWER_SPECIAL_SHARE*(specialMultiplier(e.enhance)-1)));
function oldAutoDeck(p,{exclude=[],allow=null,size=5,index=null}={}){
 const bonus=collectionBonus(p.relics),power=h=>Math.round(oldPower(h.id,p.heroes[h.id],p.beds,bonus)*(index?.[h.id]??1)),deck=[],held=new Set(p.deck);
 const pool=HEROES.filter(h=>p.heroes[h.id]?.owned&&!p.dispatches.some(d=>d.hero===h.id)&&!exclude.includes(h.id)&&(!allow||allow(h.id))).sort((a,b)=>power(b)-power(a)||compareRarity(b,a));
 while(pool.length&&deck.length<size){const top=power(pool[0]),shapes=new Set(deck.map(h=>h.shape)),tie=test=>pool.findIndex(h=>power(h)===top&&test(h));let i=tie(h=>held.has(h.id));if(i<0)i=tie(h=>!shapes.has(h.shape));deck.push(...pool.splice(Math.max(0,i),1));}return deck.map(h=>h.id);
}
function random(seed){let x=seed>>>0||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};}
function account(draws,index,stage){
 const p=createProfile(Date.UTC(2026,10,16)),rng=random(92831+draws*100+index),c=calendar(Date.UTC(2026,10,16));
 p.cleared=stage-1;const L=levelOf(stage);p.beds.rose=Math.min(45,3+L);p.beds.spring=L>=15?Math.min(30,3*(L-14)):0;p.beds.seed=L>=30?Math.min(20,2*(L-29)):0;
 for(let i=0;i<draws;i++){const id=drawCharacter(rng,false,c.guardian,c.pickup,1,p.cleared>=LATE_UNLOCK_STAGE),e=p.heroes[id];if(!e.owned)e.owned=true;else e.copies++;while(e.copies>=duplicateCost(e.enhance)){e.copies-=duplicateCost(e.enhance);e.enhance++;}}
 return p;
}
function play(p,deck,stage,mode,auto,seed,limit=900){
 const s=engine.newRun({deck,chapter:stage-1,seed,meta:battleMeta(p,deck),mode,tier:'easy',met:Math.max(1,Math.min(9,p.cleared)),gaugeMax:springGauge(p.beds.spring),startGold:seedGold(p.beds.seed)});
 if(mode==='weekly'){s.gauge=Math.min(s.gaugeMax,s.gauge+20);}
 let autoIn=0,pick=false,ticks=0;while(s.phase!=='victory'&&s.phase!=='defeat'&&ticks<limit/.05){const before=s.phase;engine.step(s,.05);ticks++;if(pick){auto(s);autoIn=0;pick=false;}else if(before!=='reward'&&s.phase==='reward')pick=true;else if(s.phase==='combat'||s.phase==='intermission'){autoIn+=.05;if(autoIn>=.32){auto(s);autoIn=0;}}s.events.length=0;}
 return {win:Number(s.phase==='victory'),rounds:clearedRounds(s),damage:s.stats.damage,timeout:s.phase!=='victory'&&s.phase!=='defeat'};
}
function* combinations(ids,start=0,selected=[]){if(selected.length===5){yield selected;return;}for(let i=start;i<=ids.length-(5-selected.length);i++)yield* combinations(ids,i+1,[...selected,ids[i]]);}
if(args.includes('--best-only')){
 const p=account(20,5,levelStage(6)),ids=HEROES.filter(h=>p.heroes[h.id]?.owned).map(h=>h.id),old=oldAutoDeck(p),fresh=autoDeck(p),groups={};
 for(const [name,auto] of [['smart',smart],['basic',basic]])for(const mode of ['main','weekly']){
  let maximum=0,bestDeck=null,count=0;
  for(const deck of combinations(ids)){const n=play(p,deck,levelStage(6),mode,auto,1,60).damage;count++;if(n>maximum){maximum=n;bestDeck=deck;}}
  const oldDamage=play(p,old,levelStage(6),mode,auto,1,60).damage,newDamage=play(p,fresh,levelStage(6),mode,auto,1,60).damage;
  if(oldDamage>maximum){maximum=oldDamage;bestDeck=old;}if(newDamage>maximum){maximum=newDamage;bestDeck=fresh;}
  groups[name+'_'+mode]={combinations:count,bestDeck,best:maximum,old:oldDamage/maximum,new:newDamage/maximum};
 }
 const result={draws:20,account:5,stage:levelStage(6),owned:ids.length,seconds:60,groups};
 console.log(JSON.stringify(result));if(out)await writeFile(out,JSON.stringify(result,null,2)+'\n');process.exit(0);
}
const pointFilter=opt('points','20,60,150,400').split(',').map(Number);
const points=[[20,levelStage(6)],[60,levelStage(12)],[150,levelStage(12)],[400,levelStage(15)]].filter(([draws])=>pointFilter.includes(draws)),results=[];
for(const [draws,stage] of points){
 const groups=Object.fromEntries(['smart','basic'].flatMap(ai=>['main','weekly'].map(mode=>[`${ai}_${mode}`,{old:0,practical:0,new:0,worse:0,worsePractical:0,identical:0,runs:0,timeouts:0}]))),best=[];
 for(let index=0;index<per;index++){
  const p=account(draws,index,stage),old=oldAutoDeck(p),practical=oldAutoDeck(p,{index:PRACTICAL}),fresh=autoDeck(p),same=[...old].sort().join()===[...fresh].sort().join();
  for(const [name,auto] of [['smart',smart],['basic',basic]])for(const mode of ['main','weekly']){
   const g=groups[`${name}_${mode}`];let a=0,b=0,c=0;const v=r=>mode==='main'?r.win:r.rounds;
   for(let seed=1;seed<=seeds;seed++){const x=play(p,old,stage,mode,auto,seed),y=play(p,fresh,stage,mode,auto,seed),z=play(p,practical,stage,mode,auto,seed);a+=v(x);b+=v(y);c+=v(z);g.timeouts+=x.timeout+y.timeout+z.timeout;}
   g.old+=a/seeds;g.new+=b/seeds;g.practical+=c/seeds;g.worse+=Number(b<a);g.worsePractical+=Number(b<c);g.identical+=Number(same);g.runs++;
  }
  // Short battle damage is a continuous proxy, not a full-stage best; restrict to small owned pools.
  if(index<bestAccounts){const ids=HEROES.filter(h=>p.heroes[h.id]?.owned).map(h=>h.id);if(ids.length<=16){let maximum=0,bestDeck=null;for(const deck of combinations(ids)){const n=play(p,deck,stage,'main',smart,1,60).damage;if(n>maximum){maximum=n;bestDeck=deck;}}best.push({owned:ids.length,deck:bestDeck,old:play(p,old,stage,'main',smart,1,60).damage/maximum,new:play(p,fresh,stage,'main',smart,1,60).damage/maximum});}}
  console.log(JSON.stringify({draws,account:index+1,old,practical,fresh,same}));
 }
 for(const g of Object.values(groups)){g.old/=per;g.practical/=per;g.new/=per;g.worse/=per;g.worsePractical/=per;g.identical/=per;}
 results.push({draws,stage,accounts:per,seeds,groups,best});
 console.log(JSON.stringify({point:draws,groups,best}));
 if(out)await writeFile(out,JSON.stringify({parameters:{per,seeds,bestAccounts},results},null,2)+'\n');
}
