import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {HEROES,DEFAULT_DECK,ARTIFACTS,ASSET_PATHS,CHAPTERS,TUNING,ROSTER} from '../src/content.js';
import {duplicateCost,enhanceMultiplier,specialMultiplier,bedCost,critChance,critDamage,stardustRate,BED_IDS,roseAttack,springGauge,seedGold,combatPower,dispatchReward,dispatchSlots,relicRates,relicThreshold,stageReward,relicCost,relicScale,relicPhase,RELIC_LEVEL_STEP,RELIC_COST_STEP,RELIC_COST_MULT,COLLECTION_WEIGHT,COLLECTION_OWN_BONUS,COLLECTION_POINTS_PER_PERCENT} from '../src/economy.js';
import {createProfile} from '../src/profile.js';
import {gameRoot,assetFile} from './local-inputs.mjs';
import {MEMORIAL_MEDIA_PATHS,MEMORIAL_WEBP_PATHS,MEMORIAL_MEDIA_MANIFEST} from '../src/memorial-media.js';
import {LIBRARY_ART} from '../src/library.js';
import {MIRACLE_FORMS,DEATHHAND} from '../src/combat/engine.js';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourcePath=file=>'defense/'+path.relative(gameRoot,file).replaceAll('\\','/');
const probability=(name,p)=>({name,perDraw:p,meanDraws:1/p,medianDraws:Math.ceil(Math.log(.5)/Math.log(1-p)),p90Draws:Math.ceil(Math.log(.1)/Math.log(1-p)),at20:1-(1-p)**20,at50:1-(1-p)**50,at100:1-(1-p)**100});

export function balanceSnapshot(){
  const p=createProfile(0);let total=0;
  return {
    tuning:TUNING,
    probability:[probability('any SR',TUNING.heroRates[2]),probability('specific SR',TUNING.heroRates[2]/ROSTER.SR.length),probability('any normal UR',TUNING.heroRates[3]),probability('current season guardian',TUNING.heroRates[3]/2)],
    enhancement:Array.from({length:21},(_,e)=>{const cost=duplicateCost(e);const row={current:e,nextCopies:cost,spentCopies:total,power:enhanceMultiplier(e),special:specialMultiplier(e),gainPerCopy:TUNING.enhanceStep/cost};total+=cost;return row;}),
    beds:Object.fromEntries(BED_IDS.map(id=>[id,{unlockStage:TUNING.beds[id].unlock,levels:[...new Set([0,5,10,15,20,25,30,TUNING.beds[id].knee2])].sort((a,b)=>a-b).map(level=>({level,nextDust:bedCost(id,level),value:id==='rose'?1+roseAttack(level):id==='spring'?springGauge(level):id==='seed'?seedGold(level):id==='crit'?critChance(level):id==='critDamage'?critDamage(level):stardustRate(level),cumulativeDust:Array.from({length:level},(_,i)=>bedCost(id,i)).reduce((a,b)=>a+b,0)}))}])),
    relics:Array.from({length:13},(_,tier)=>({tier,threshold:relicThreshold(tier),nextThreshold:relicThreshold(tier+1),rates:relicRates(relicThreshold(tier))})),
    relicEnhancement:{
      levelStep:RELIC_LEVEL_STEP,costStep:[...RELIC_COST_STEP],costMult:RELIC_COST_MULT,
      collection:{weight:COLLECTION_WEIGHT,ownBonus:COLLECTION_OWN_BONUS,pointsPerPercent:COLLECTION_POINTS_PER_PERCENT},
      rarities:['C','R','SR','UR'].map(rarity=>{
        let spent=0;const rows=[];
        for(let e=0;e<20;e++){const cost=relicCost(rarity,e),level=e+1;rows.push({enhance:e,level,nextCopies:cost,spentCopies:spent,scale:relicScale(level),phase:relicPhase(e)});spent+=cost;}
        return {rarity,rows};
      })
    },
    stages:[1,9,18,27,36,45].map(stage=>({stage,hp:CHAPTERS[stage-1].hp,slots:dispatchSlots(stage),dispatchMultiplier:1+TUNING.dispatchStageStep*stage,firstClear:stageReward(stage),totalFirstClear:Array.from({length:stage},(_,i)=>stageReward(i+1)).reduce((a,b)=>a+b,0)})),
    starter:DEFAULT_DECK.map(id=>({id,power:combatPower(id,p.heroes[id]),dispatchAt9:dispatchReward(combatPower(id,p.heroes[id]),9)})),
    roster:HEROES.map(h=>({id:h.id,name:h.name,rarity:h.rarity,hidden:h.hidden})),
    newCompanions:{deathhand:DEATHHAND,miracleForms:Object.fromEntries(Object.entries(MIRACLE_FORMS).map(([id,h])=>[id,{damage:h.damage,interval:h.interval,range:h.range,radius:h.radius,shape:h.shape,trait:h.trait.type}]))}
  };
}

export async function assetProvenance(){
  const assets=[];
  for(const [id,relative] of Object.entries(ASSET_PATHS)){
    const file=assetFile(relative),bytes=await fs.readFile(file),metadata=await sharp(bytes).metadata();
    if(!metadata.width||!metadata.height)throw new Error('Invalid Star Garden asset: '+id);
    assets.push({id,source:sourcePath(file),sha256:hash(bytes),width:metadata.width,height:metadata.height});
  }
  const fontFile=assetFile('./assets/Jua-Regular.woff2'),licenseFile=assetFile('./assets/Jua-OFL.txt');
  const font=await fs.readFile(fontFile),license=(await fs.readFile(licenseFile,'utf8')).replace(/\r\n/g,'\n');
  const memorial=[];
  for(const h of HEROES){
    const file=assetFile(MEMORIAL_MEDIA_PATHS[h.id]),bytes=await fs.readFile(file),m=await sharp(bytes).metadata();
    const webpFile=assetFile(MEMORIAL_WEBP_PATHS[h.id]),webp=await fs.readFile(webpFile),wm=await sharp(webp).metadata();
    memorial.push({id:h.id,source:sourcePath(file),sha256:hash(bytes),width:m.width,height:m.height,bytes:bytes.length,sourceSha256:MEMORIAL_MEDIA_MANIFEST[h.id].sourceSha256,
      webp:{source:sourcePath(webpFile),sha256:hash(webp),width:wm.width,height:wm.height,bytes:webp.length,quality:MEMORIAL_MEDIA_MANIFEST[h.id].webp.quality}});
  }
  const library=[];
  for(const [id,relative] of Object.entries(LIBRARY_ART)){
    const file=assetFile(relative),bytes=await fs.readFile(file),m=await sharp(bytes).metadata();
    library.push({id,source:sourcePath(file),sha256:hash(bytes),width:m.width,height:m.height,bytes:bytes.length});
  }
  return {
    initialArtCommit:'d4c32cf',
    policy:'independently maintained local atlases; build-time authored portrait crops; no runtime pixel processing',
    assets,font:{source:sourcePath(fontFile),sha256:hash(font),license:{source:sourcePath(licenseFile),sha256:hash(license)}},
    portraits:HEROES.length,relics:ARTIFACTS.length,memorial,library
  };
}
