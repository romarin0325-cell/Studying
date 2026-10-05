import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {HEROES,DEFAULT_DECK,ARTIFACTS,ASSET_PATHS,CHAPTERS,TUNING,ROSTER} from '../src/content.js';
import {duplicateCost,enhanceMultiplier,specialMultiplier,levelCost,combatPower,dispatchReward,dispatchSlots,relicRates,relicThreshold,stageReward} from '../src/economy.js';
import {createProfile} from '../src/profile.js';
import {gameRoot,assetFile} from './local-inputs.mjs';
import {MEMORIAL_MEDIA_PATHS,MEMORIAL_MEDIA_MANIFEST} from '../src/memorial.js';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourcePath=file=>'defense_test/'+path.relative(gameRoot,file).replaceAll('\\','/');
const probability=(name,p)=>({name,perDraw:p,meanDraws:1/p,medianDraws:Math.ceil(Math.log(.5)/Math.log(1-p)),p90Draws:Math.ceil(Math.log(.1)/Math.log(1-p)),at20:1-(1-p)**20,at50:1-(1-p)**50,at100:1-(1-p)**100});

export function balanceSnapshot(){
  const p=createProfile(0);let total=0;
  return {
    tuning:TUNING,
    probability:[probability('any SR',TUNING.heroRates[2]),probability('specific SR',TUNING.heroRates[2]/ROSTER.SR.length),probability('any normal UR',TUNING.heroRates[3]),probability('current season guardian',TUNING.heroRates[3]/2)],
    enhancement:Array.from({length:21},(_,e)=>{const cost=duplicateCost(e);const row={current:e,nextCopies:cost,spentCopies:total,power:enhanceMultiplier(e),special:specialMultiplier(e),gainPerCopy:TUNING.enhanceStep/cost};total+=cost;return row;}),
    levels:[1,5,10,15,20,30,40].map(level=>({level,nextDust:levelCost(level),basePower:1+TUNING.levelStep*(level-1),cumulativeDust:Array.from({length:level-1},(_,i)=>levelCost(i+1)).reduce((a,b)=>a+b,0)})),
    relics:Array.from({length:9},(_,tier)=>({tier,threshold:relicThreshold(tier),nextThreshold:relicThreshold(tier+1),rates:relicRates(relicThreshold(tier))})),
    stages:[1,9,18,27,36,45].map(stage=>({stage,hp:CHAPTERS[stage-1].hp,slots:dispatchSlots(stage),dispatchMultiplier:1+TUNING.dispatchStageStep*stage,firstClear:stageReward(stage),totalFirstClear:Array.from({length:stage},(_,i)=>stageReward(i+1)).reduce((a,b)=>a+b,0)})),
    starter:DEFAULT_DECK.map(id=>({id,power:combatPower(id,p.heroes[id]),dispatchAt9:dispatchReward(combatPower(id,p.heroes[id]),9)})),
    roster:HEROES.map(h=>({id:h.id,name:h.name,rarity:h.rarity,hidden:h.hidden}))
  };
}

export async function assetProvenance(){
  const assets=[];
  for(const [id,relative] of Object.entries(ASSET_PATHS)){
    const file=assetFile(relative),bytes=await fs.readFile(file),metadata=await sharp(bytes).metadata();
    if(!metadata.width||!metadata.height)throw new Error('Invalid Star Garden asset: '+id);
    assets.push({id,source:sourcePath(file),sha256:hash(bytes),width:metadata.width,height:metadata.height});
  }
  const fontFile=assetFile('./assets/Jua-Regular.ttf'),licenseFile=assetFile('./assets/Jua-OFL.txt');
  const font=await fs.readFile(fontFile),license=(await fs.readFile(licenseFile,'utf8')).replace(/\r\n/g,'\n');
  const memorial=[];
  for(const h of HEROES){const file=assetFile(MEMORIAL_MEDIA_PATHS[h.id]),bytes=await fs.readFile(file),m=await sharp(bytes).metadata();memorial.push({id:h.id,source:sourcePath(file),sha256:hash(bytes),width:m.width,height:m.height,bytes:bytes.length,sourceSha256:MEMORIAL_MEDIA_MANIFEST[h.id].sourceSha256});}
  return {
    initialArtCommit:'d4c32cf',
    policy:'independently maintained local atlases; build-time authored portrait crops; no runtime pixel processing',
    assets,font:{source:sourcePath(fontFile),sha256:hash(font),license:{source:sourcePath(licenseFile),sha256:hash(license)}},
    portraits:HEROES.length,relics:ARTIFACTS.length,memorial
  };
}
