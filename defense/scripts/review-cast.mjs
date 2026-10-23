// Focused offline acceptance of the installed cast and changed live numbers.
// PLAYWRIGHT_BROWSERS_PATH=<installed browser directory> node defense/scripts/review-cast.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {gameRoot} from './local-inputs.mjs';
import {HEROES,HERO,LATE_COMPANIONS,DEFAULT_DECK} from '../src/content.js';
import {createProfile,command,validateProfile,SAVE_KEY} from '../src/profile.js';
import {createBattle} from '../src/battle.js';
import * as E from '../src/combat/engine.js';

const output=path.join(gameRoot,'test-results/cast-v2');await fs.mkdir(output,{recursive:true});
const section=process.argv.find(a=>a.startsWith('--section='))?.split('=')[1]||'all';
assert.ok(['all','art','stats','attacks'].includes(section),'--section=all|art|stats|attacks');
const report={environment:'Windows Chromium, offline file://, 390x844 touch viewport, DPR 2',scenes:[],embedded:[],errors:[],externalRequests:[],assertions:0};
const check=(condition,label)=>{assert.ok(condition,label);report.assertions++;};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const directions=['down','up','left','right'];
const now=Date.now();
function fixture(ids,{rank=1,level=0,enhance=0,trauma=false,enemies=false,attack=null}={}){
  const deck=[...new Set([...ids,...DEFAULT_DECK])].slice(0,5),p=createProfile(now);
  p.cleared=90;p.noticeLate=[...LATE_COMPANIONS];p.dreams=9999;p.dust=9999;p.deck=deck;p.partner=deck[0];p.equipped=[];
  Object.assign(p.settings,{sound:false,auto:false,reduced:true,quality:'standard'});
  for(const h of HEROES)Object.assign(p.heroes[h.id],{owned:true,enhance});
  assert.ok(command(p,'begin',{mode:'main',stage:1},now).ok);
  const s=createBattle(p),template=s.board.find(Boolean);s.board.fill(null);s.queue=[{kind:'grunt',hp:1e9}];s.spawnIn=1e6;s.events=[];s.gold=1000;s.gauge=120;
  for(const [row,id] of deck.entries()){
    s.upgrades[id]=level;
    for(let col=0;col<4;col++)s.board[row*5+col]={...template,uid:s.nextId++,hero:id,rank,birthWave:1,born:0,cooldown:attack?0:100,windup:0,target:null,attacks:0,harvest:12,disabled:0,facing:directions[col],priority:attack==='right'?'last':'first'};
  }
  if(trauma){s.buffs.trauma=10;s.buffTotals.trauma=10;s.buffScale.trauma=1;}
  if(enemies||attack){
    const queue=s.queue;s.queue=[{kind:'grunt',hp:1e9},{kind:'grunt',hp:1e9}];
    while(s.queue.length){s.spawnIn=0;E.step(s,.001);}
    s.queue=queue;s.spawnIn=1e6;s.enemies.forEach((e,i)=>Object.assign(e,{progress:attack?(i?2105:683):(i?1900:850),speed:0,skillIn:1e6}));
    if(attack)for(const u of s.board)if(u)Object.assign(u,{cooldown:0,windup:0,target:null});
  }
  p.active.run=E.serialize(s);assert.ok(E.restore(p.active.run),'valid integration fixture');assert.ok(validateProfile(p));return p;
}

const browser=await chromium.launch({headless:true});
async function boot(theme,profile){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true});
  await context.setOffline(true);const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('request',r=>{if(/^https?:/.test(r.url()))report.externalRequests.push(r.url());});
  await page.route('**/*',r=>/^https?:/.test(r.request().url())?r.abort():r.continue());
  await page.addInitScript(({key,profile})=>localStorage.setItem(key,JSON.stringify(profile)),{key:SAVE_KEY,profile});
  await page.goto(pathToFileURL(path.join(gameRoot,'dist',theme==='bright'?'StarGardenDefenseBright.html':'StarGardenDefense.html')).href);
  await page.locator('.scene-partner').waitFor();await page.evaluate(()=>document.fonts.ready);
  return {context,page};
}
async function capture(page,name,extra={}){
  const images=await page.evaluate(()=>({width:document.documentElement.scrollWidth,loaded:[...document.images].filter(i=>i.offsetParent!==null).every(i=>i.complete&&i.naturalWidth>0),fallback:document.querySelectorAll('[data-fallback]').length}));
  check(images.width<=390,name+' horizontal overflow');check(images.loaded,name+' visible images decoded');check(!images.fallback,name+' no fallback painting');
  await page.screenshot({path:path.join(output,name+'.png'),animations:'disabled'});
  report.scenes.push({name,...extra,...images});console.log('Reviewed '+name);
}
async function battle(page){
  await page.locator('[data-action="resume"]').click();await page.locator('#battle').waitFor();
  await page.waitForFunction(()=>window.STAR_GARDEN.battle?.time>0);
}
async function cell(page,index){
  const b=await page.locator('#arena').boundingBox(),p=E.cellPoint(index);await page.mouse.click(b.x+p.x*b.width/720,b.y+p.y*b.height/780);
  await page.locator('#unit-panel:not([hidden])').waitFor();
}
try{
  const manifest=JSON.parse(await fs.readFile(path.join(gameRoot,'docs/ASSET_OPTIMIZATION.json'),'utf8'));
  const groups=Array.from({length:Math.ceil(HEROES.length/5)},(_,i)=>HEROES.slice(i*5,i*5+5).map(h=>h.id));
  for(const theme of ['night','bright']){
    for(const [i,ids] of (section==='all'||section==='art'?groups.entries():[])){
      const {context,page}=await boot(theme,fixture(ids));
      if(i===0){
        const embedded=await page.evaluate(()=>({atlases:window.__ASTRA_ASSETS__,ui:window.__GARDEN_MEDIA__}));
        let units=0,crops=0;
        for(const item of manifest.images.filter(a=>a.id.startsWith('atlas:unit-'))){
          const bytes=Buffer.from(embedded.atlases[item.id.slice(6)].split(',')[1],'base64');
          check(hash(bytes)===item.output.sha256,theme+' embedded '+item.id);units++;
        }
        for(const item of manifest.derived.filter(a=>a.id.startsWith('portrait:')||a.id.startsWith('figure:'))){
          const bytes=Buffer.from(embedded.ui[item.id].split(',')[1],'base64');check(hash(bytes)===item.output.sha256,theme+' embedded '+item.id);crops++;
        }
        check(units===40&&crops===78,'complete unit and UI pack');report.embedded.push({theme,unitAtlases:units,uiImages:crops});
        await capture(page,theme+'-home',{partner:ids[0]});
      }
      await battle(page);await page.locator('[data-action="pause"]').click();
      check((await page.evaluate(()=>window.STAR_GARDEN.battle.board.filter(Boolean).length))===20,'20 directional figures in actual renderer');
      await capture(page,theme+'-field-'+(i+1),{characters:ids,directions});await context.close();
    }
    if(section==='all'||section==='art'){
      const special=await boot(theme,fixture(['time_magician','galaxy_whale','night_rabbit','guardian','cure_master'],{trauma:true}));
      await battle(special.page);await special.page.locator('[data-action="pause"]').click();await capture(special.page,theme+'-trauma',{transformation:'trauma',directions});await special.context.close();
    }
    if(section!=='all'&&section!=='stats')continue;
    const ids=['snow_rabbit','storm_sage','lightning_sage','frost_witch','behemoth'];
    const {context,page}=await boot(theme,fixture(ids,{rank:3,level:3,enhance:10,enemies:true}));await battle(page);
    for(const [row,id] of ids.entries()){
      await cell(page,row*5);await page.locator('[data-action="unit-info"]').click();
      const text=await page.locator('#sheet').innerText();
      const expected={snow_rabbit:['감속 66.2%','2.9초','72%'],storm_sage:['즉사 1.4%'],lightning_sage:['위력 +60%','체인 80%','추가 대상 +1'],frost_witch:['8.6초','72%','0.8초'],behemoth:['반경 129.375','0.5초 간격으로 3번']}[id];
      await capture(page,theme+'-stats-'+id,{expected});await page.locator('#sheet .sheet-top [data-action="close"]').click();
      for(const value of expected)check(text.includes(value),id+' live UI '+value+'; actual: '+text);
    }
    await page.locator('[data-action="training"]').click();const text=await page.locator('#sheet').innerText();
    check(text.includes('감속 66.2%'),'training shows +2pp per step with the actual rank and enhancement');check(text.includes('필살기 반경 129.375'),'training shows trained crush radius');
    check(text.includes('감속 57.6%')&&text.includes('빙결 1.1초'),'witch training uses the actual rank and enhancement');
    await capture(page,theme+'-training');await context.close();
    const ash=await boot(theme,fixture(['ash'],{rank:3,enemies:true}));await battle(ash.page);await cell(ash.page,0);await ash.page.locator('[data-skill-info="ash"]').click();
    check((await ash.page.locator('#sheet').innerText()).includes('위력 18배'),'Ash current ultimate 18x');await capture(ash.page,theme+'-stats-ash');await ash.context.close();
  }
  for(const direction of (section==='all'||section==='attacks'?['left','right']:[])){
    const {context,page}=await boot('night',fixture(['zeke','snow_rabbit','red_dragon','ancient_dragon','lightning_sage'],{attack:direction}));await battle(page);
    await page.waitForFunction(direction=>window.STAR_GARDEN.battle.board.filter(u=>u?.hero==='zeke').some(u=>u.facing===direction),direction,{timeout:5000});
    check((await page.evaluate(direction=>window.STAR_GARDEN.battle.board.filter(u=>u?.hero==='zeke').some(u=>u.facing===direction),direction)),'actual enemy-facing '+direction);
    await capture(page,'attack-'+direction,{direction});await context.close();
  }
  check(report.errors.length===0,'no page errors');check(report.externalRequests.length===0,'no external HTTP requests');
  console.log('PASS '+report.scenes.length+' scenes / '+report.assertions+' assertions');
}finally{
  await browser.close();await fs.writeFile(path.join(output,'verification-'+section+'.json'),JSON.stringify(report,null,2)+'\n');
}
