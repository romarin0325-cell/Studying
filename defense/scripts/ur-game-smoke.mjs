// Real-game smoke for the sequenced ultimates (pass 3, 2026-11-07): the release build at 390x844, a saved battle per deck, every
// ultimate cast from its own skill button with the real cut-in. Reports casts, page/console errors and the HUD gold around the
// Queen's coins, and writes one mid-cast screenshot per ultimate to test-results/review-captures/ur-game-smoke.png.
//   node defense/scripts/ur-game-smoke.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import sharp from 'sharp';
import {gameRoot} from './local-inputs.mjs';
import {createProfile,command,SAVE_KEY} from '../src/profile.js';
import {HEROES} from '../src/content.js';
import {createBattle} from '../src/battle.js';
import * as E from '../src/combat/engine.js';
const url=pathToFileURL(path.join(gameRoot,'dist/StarGardenDefense.html')).href,NOW=Date.now(),out=path.join(gameRoot,'test-results/review-captures/ur-game-smoke.png');
// Five decks cover every sequenced ultimate; Rumi at five stars casts the dream form.
const DECKS=[[['queen','cinderella','venom','doom','rumi']],[['red_dragon','aurora','star_boy','jasmine','time_magician']],[['galaxy_whale','time_ruler','cherry_prince','luna','frost_witch']],[['rumi','harmonious','siren','zeke','queen'],{rumi:5},2]];
function fixture(deck,ranks={}){
  const p=createProfile(NOW);p.settings.auto=false;for(const h of HEROES)p.heroes[h.id].owned=true;
  p.deck=[...deck];if(!command(p,'begin',{mode:'main',stage:1},NOW).ok)throw Error('begin');
  const s=createBattle(p),template={...s.board.find(Boolean)};s.board.fill(null);s.wave=3;s.gold=300;
  [12,6,8,16,18].forEach((cell,i)=>{const hero=deck[i];s.board[cell]={...template,uid:s.nextId++,hero,rank:ranks[hero]||3,birthWave:3,priority:E.targetingLocked(hero)?'random':'first',cooldown:i?.4:99};});
  s.queue=[{kind:'grunt',hp:1e7}];s.spawnIn=0;E.step(s,.05);const proto=s.enemies[0];
  // Eight sturdy enemies spread over the road, with a pack in the bottom right corner for the area strikes.
  s.enemies=[300,700,960,1010,1060,1110,1500,1900].map(p=>({...structuredClone(proto),uid:s.nextId++,progress:p,speed:0,skillIn:99,hp:1e7,maxHp:1e7}));
  s.queue=[{kind:'grunt',hp:1e7}];s.spawnIn=999;s.gauge=E.gaugeCap(s);
  p.active.run=E.serialize(s);if(!E.restore(p.active.run))throw Error('fixture is not a valid saved battle');return p;
}
const browser=await chromium.launch(),errors=[],tiles=[],gold=[];
try{
  for(const [deck,ranks,count=5] of DECKS){
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),page=await context.newPage();
    page.on('pageerror',e=>errors.push(deck[0]+': '+e.message));page.on('console',m=>{if(m.type()==='error')errors.push(deck[0]+' console: '+m.text());});
    await page.addInitScript(({key,profile})=>{localStorage.setItem(key,JSON.stringify(profile));},{key:SAVE_KEY,profile:fixture(deck,ranks)});
    await page.goto(url);await page.locator('[data-action="resume"]').click();await page.locator('#arena').waitFor();await page.waitForTimeout(1500);
    for(const hero of deck.slice(0,count)){
      const button=page.locator(`[data-skill="${hero}"]`);if(!await button.count()){errors.push('no skill button: '+hero);continue;}
      await page.evaluate(()=>{const s=window.STAR_GARDEN.battle;s.gauge=s.gaugeMax||120;});
      const before=await page.evaluate(()=>window.STAR_GARDEN.battle.stats.skills);await button.click();await page.waitForTimeout(80);
      if(await page.evaluate(()=>window.STAR_GARDEN.battle.stats.skills)===before){errors.push('cast refused: '+hero);continue;}
      if(hero==='queen'&&!gold.length){let last=0;for(const t of [250,700,1300,2000]){await page.waitForTimeout(t-last);last=t;gold.push({t,hud:await page.locator('#gold').textContent(),real:await page.evaluate(()=>window.STAR_GARDEN.battle.gold)});}}
      else await page.waitForTimeout(hero==='aurora'?2500:900);
      tiles.push({input:await sharp(await page.locator('#arena').screenshot()).resize(260).png().toBuffer(),label:hero+(ranks?.[hero]?' '+ranks[hero]+'★':'')});
      await page.waitForTimeout(hero==='aurora'?3200:2000);
    }
    await context.close();
  }
  const H=Math.round(260*780/720),cols=6,rows=Math.ceil(tiles.length/cols);await fs.mkdir(path.dirname(out),{recursive:true});
  await sharp({create:{width:cols*264,height:rows*(H+4),channels:3,background:'#333'}}).composite(tiles.map((t,i)=>({input:t.input,left:(i%cols)*264,top:Math.floor(i/cols)*(H+4)}))).png().toFile(out);
  console.log(JSON.stringify({casts:tiles.map(t=>t.label),errors,queenGold:gold,out},null,1));
  if(errors.length)process.exitCode=1;
}finally{await browser.close();}
