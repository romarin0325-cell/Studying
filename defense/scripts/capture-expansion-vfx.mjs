// Focused 390x844 release smoke for the sixteen expansion companions.
// Captures one real basic attack and one real skill cast per hero. Run after the
// regular release build; pass --bright for StarGardenDefenseBright.html.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {gameRoot} from './local-inputs.mjs';
import {createProfile,command,SAVE_KEY} from '../src/profile.js';
import {HEROES} from '../src/content.js';
import {EXPANSION_RARITIES} from '../src/expansion-companions.js';
import {RUNTIME_ASSET_PATHS} from '../src/asset-policy.js';
import {createBattle} from '../src/battle.js';
import * as E from '../src/combat/engine.js';

const bright=process.argv.includes('--bright'),theme=bright?'bright':'night';
const filename=bright?'StarGardenDefenseBright.html':'StarGardenDefense.html';
const url=pathToFileURL(path.join(gameRoot,'dist',filename)).href,NOW=Date.now();
const out=path.join(gameRoot,'test-results/review-captures',`expansion-vfx-${theme}.png`);
const fillers={UR:'queen',SR:'storm_sage',R:'guardian',C:'star_boy'};
const DECKS=Object.entries(EXPANSION_RARITIES).map(([rarity,ids])=>[...ids,fillers[rarity]]);

function fixture(deck){
  const p=createProfile(NOW);p.settings.auto=false;p.settings.sound=false;p.settings.reduced=false;p.settings.quality='high';
  if(!command(p,'ftue',{skip:true},NOW).ok)throw Error('skip tutorial');
  for(const hero of HEROES)p.heroes[hero.id].owned=true;p.deck=[...deck];
  if(!command(p,'begin',{mode:'main',stage:1},NOW).ok)throw Error('begin');
  const s=createBattle(p),template={...s.board.find(Boolean)};s.board.fill(null);s.wave=3;s.gold=1000;
  [12,6,8,16,18].forEach((cell,i)=>{const hero=deck[i];s.board[cell]={...template,uid:s.nextId++,hero,rank:3,birthWave:3,priority:E.targetingLocked(hero)?'random':'first',cooldown:99,windup:0,disabled:0,stunWard:0,riposteAt:0};});
  s.queue=[{kind:'grunt',hp:1e9}];s.spawnIn=0;E.step(s,.05);const proto=s.enemies[0];
  s.enemies=[1340,1360,1380,1400,1420,1440,1460,1480].map(progress=>({...structuredClone(proto),uid:s.nextId++,progress,speed:0,skillIn:99,hp:1e9,maxHp:1e9}));
  s.queue=[];s.spawnIn=999;s.gauge=E.gaugeCap(s);p.active.run=E.serialize(s);
  if(!E.restore(p.active.run))throw Error('fixture is not a valid saved battle');return p;
}
async function labelRaster(text,width,height){
  const safe=text.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const letters=await sharp({text:{text:`<span foreground="#fff4d3">${safe}</span>`,font:'Consolas 11',width:width-12,height,rgba:true}}).png().toBuffer();
  return sharp({create:{width,height,channels:3,background:'#171522'}}).composite([{input:letters,left:6,top:1}]).png().toBuffer();
}

const browser=await chromium.launch().catch(()=>chromium.launch({channel:'chrome'})),errors=[],tiles=[],seen={attack:[],skill:[]};
try{
  for(const deck of DECKS){
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),page=await context.newPage();
    page.on('pageerror',error=>errors.push(deck[0]+': '+error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(deck[0]+' console: '+message.text());});
    await page.addInitScript(({key,profile})=>{
      const NativeImage=window.Image,tracker=window.__CAPTURE_IMAGE_TRACKER__={created:0,pending:0,loaded:0,failed:0};
      window.Image=new Proxy(NativeImage,{construct(target,args){
        const image=Reflect.construct(target,args);tracker.created++;tracker.pending++;
        let settled=false;const done=ok=>{if(settled)return;settled=true;tracker.pending--;tracker[ok?'loaded':'failed']++;};
        image.addEventListener('load',()=>done(true),{once:true});image.addEventListener('error',()=>done(false),{once:true});return image;
      }});
      localStorage.setItem(key,JSON.stringify(profile));
    },{key:SAVE_KEY,profile:fixture(deck)});
    await page.goto(url);
    const expected=Object.keys(RUNTIME_ASSET_PATHS).length;
    try{await page.waitForFunction(count=>{const t=window.__CAPTURE_IMAGE_TRACKER__;return t&&t.created>=count&&t.pending===0;},expected,{timeout:6500});}
    catch{const tracker=await page.evaluate(()=>window.__CAPTURE_IMAGE_TRACKER__);errors.push(`${deck[0]} asset preload timeout: ${JSON.stringify(tracker)}`);}
    const failed=await page.evaluate(()=>window.__CAPTURE_IMAGE_TRACKER__?.failed||0);if(failed)errors.push(`${deck[0]} asset preload failures: ${failed}`);
    await page.locator('[data-action="resume"]').click();await page.locator('#arena').waitFor();await page.waitForTimeout(120);
    for(const hero of deck.slice(0,4)){
      await page.evaluate(id=>{const s=window.STAR_GARDEN.battle;s.shots=[];for(const unit of s.board)if(unit){unit.cooldown=unit.hero===id?0:99;unit.windup=0;unit.disabled=0;unit.target=null;}},hero);
      await page.waitForFunction(id=>window.STAR_GARDEN.battle.shots.some(shot=>shot.hero===id&&shot.life>0),hero);
      await page.evaluate(id=>{const s=window.STAR_GARDEN.battle,shot=s.shots.find(shot=>shot.hero===id&&shot.life>0);if(shot)shot.life=Math.max(.18,shot.total*.72);for(const unit of s.board)if(unit)unit.cooldown=99;},hero);
      await page.waitForTimeout(16);const attackBuffer=await page.locator('#arena').screenshot();seen.attack.push(hero);
      tiles.push({buffer:attackBuffer,label:`${hero} · BASIC`});await page.waitForTimeout(500);
      await page.evaluate(id=>{const s=window.STAR_GARDEN.battle;s.gauge=s.gaugeMax||120;s.gold=1000;const unit=s.board.find(u=>u?.hero===id);if(unit)unit.disabled=0;},hero);
      const before=await page.evaluate(()=>window.STAR_GARDEN.battle.stats.skills),button=page.locator(`[data-skill="${hero}"]`);
      if(!await button.count()){errors.push('no skill button: '+hero);continue;}await button.click();
      if(hero==='victoria')await page.waitForFunction(()=>!window.STAR_GARDEN.battle.victoriaCharge&&window.STAR_GARDEN.battle.buffs.victoriaMiracle>0,null,{timeout:9000});
      await page.waitForTimeout(320);
      if(await page.evaluate(()=>window.STAR_GARDEN.battle.stats.skills)===before){errors.push('cast refused: '+hero);continue;}
      const skillBuffer=await page.locator('#arena').screenshot();seen.skill.push(hero);tiles.push({buffer:skillBuffer,label:`${hero} · ULT`});await page.waitForTimeout(1500);
    }
    await context.close();
  }
  const tileWidth=260,tileHeight=Math.round(tileWidth*780/720),labelHeight=25,cols=8,rows=Math.ceil(tiles.length/cols),prepared=[];
  for(const tile of tiles){const image=await sharp(tile.buffer).resize(tileWidth,tileHeight).extend({bottom:labelHeight,background:'#171522'}).composite([{input:await labelRaster(tile.label,tileWidth,labelHeight),left:0,top:tileHeight}]).png().toBuffer();prepared.push(image);}
  await fs.mkdir(path.dirname(out),{recursive:true});await sharp({create:{width:cols*(tileWidth+4),height:rows*(tileHeight+labelHeight+4),channels:3,background:'#302b3d'}}).composite(prepared.map((input,i)=>({input,left:(i%cols)*(tileWidth+4),top:Math.floor(i/cols)*(tileHeight+labelHeight+4)}))).png().toFile(out);
  console.log(JSON.stringify({theme,seen,errors,out},null,2));if(errors.length||seen.attack.length!==16||seen.skill.length!==16)process.exitCode=1;
}finally{await browser.close();}
