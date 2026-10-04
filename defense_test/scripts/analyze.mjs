import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {HEROES,DEFAULT_DECK,CHAPTERS,TUNING} from '../src/content.js';
import {duplicateCost,enhanceMultiplier,specialMultiplier,levelCost,combatPower,dispatchReward,dispatchSlots,relicRates,relicThreshold,stageReward} from '../src/economy.js';
import {createProfile} from '../src/profile.js';
const game=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),p=createProfile(0);
const probability=(name,p)=>({name,perDraw:p,meanDraws:1/p,medianDraws:Math.ceil(Math.log(.5)/Math.log(1-p)),p90Draws:Math.ceil(Math.log(.1)/Math.log(1-p)),at20:1-(1-p)**20,at50:1-(1-p)**50,at100:1-(1-p)**100});
let total=0;
const snapshot={
  tuning:TUNING,
  probability:[probability('any SR',.048),probability('specific SR',.048/6),probability('any normal UR',.002),probability('current season guardian',.001)],
  enhancement:Array.from({length:21},(_,e)=>{const cost=duplicateCost(e);const row={current:e,nextCopies:cost,spentCopies:total,power:enhanceMultiplier(e),special:specialMultiplier(e),gainPerCopy:.1/cost};total+=cost;return row;}),
  levels:[1,5,10,15,20,30,40].map(level=>({level,nextDust:levelCost(level),basePower:1+.04*(level-1),cumulativeDust:Array.from({length:level-1},(_,i)=>levelCost(i+1)).reduce((a,b)=>a+b,0)})),
  relics:Array.from({length:9},(_,tier)=>({tier,threshold:relicThreshold(tier),nextThreshold:relicThreshold(tier+1),rates:relicRates(relicThreshold(tier))})),
  stages:[1,9,18,27,36,45].map(stage=>({stage,hp:CHAPTERS[stage-1].hp,slots:dispatchSlots(stage),dispatchMultiplier:1+.05*stage,firstClear:stageReward(stage),totalFirstClear:Array.from({length:stage},(_,i)=>stageReward(i+1)).reduce((a,b)=>a+b,0)})),
  starter:DEFAULT_DECK.map(id=>({id,power:combatPower(id,p.heroes[id]),dispatchAt9:dispatchReward(combatPower(id,p.heroes[id]),9)})),
  roster:HEROES.map(h=>({id:h.id,name:h.name,rarity:h.rarity,hidden:h.hidden}))
};
await fs.mkdir(path.join(game,'docs'),{recursive:true});
await fs.writeFile(path.join(game,'docs/BALANCE_SNAPSHOT.json'),JSON.stringify(snapshot,null,2)+'\n');
console.log(JSON.stringify({probability:snapshot.probability,enhancement:snapshot.enhancement.filter(r=>[0,1,2,5,10,15,20].includes(r.current)),levels:snapshot.levels,relics:snapshot.relics,stages:snapshot.stages,starter:snapshot.starter},null,2));
