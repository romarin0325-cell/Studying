// Focused offline Chromium UI reproduction; fixtures are installed before the app boots.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {createProfile,command,parseProfile,SAVE_KEY} from '../src/profile.js';
import {createBattle} from '../src/battle.js';
import {HEROES,LATE_COMPANIONS} from '../src/content.js';
import * as E from '../src/combat/engine.js';
import {gameRoot} from './local-inputs.mjs';
const out=path.join(gameRoot,'test-results/demon-miracle');
await fs.mkdir(out,{recursive:true});
const errors=[],network=[],cases=[];
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true});
function fixture({one,side='right'}={}){
  const now=Date.now(),p=createProfile(now);p.cleared=45;p.noticeLate=[...LATE_COMPANIONS];p.partner='miracle_larva';
  for(const h of HEROES){p.heroes[h.id].owned=true;p.heroes[h.id].bond=10;}
  p.settings={sound:false,auto:false,reduced:false,quality:'standard'};
  p.deck=['demon_king','miracle_larva','snow_rabbit','great_detective','rumi'];
  assert.equal(command(p,'begin',{mode:'main',stage:46},now).ok,true);
  const s=createBattle(p),template=structuredClone(s.board.find(Boolean));s.board.fill(null);s.spawnIn=0;E.step(s,.05);s.queue=[];
  const enemy=s.enemies[0];Object.assign(enemy,{hp:1e9,maxHp:1e9,progress:side==='left'?1925:863,speed:0,statusEffects:[],slowEffects:[]});
  const put=(id,at,rank=1)=>{const hero=E.MIRACLE_FORMS[id]?'miracle_larva':id;const u={...structuredClone(template),uid:s.nextId++,hero,rank,cooldown:0,windup:0,target:null,attacks:0,priority:'first',cursed:false};delete u.form;if(hero==='miracle_larva')u.form=id;s.board[at]=u;};
  if(one)put(one,one==='miracle_cocoon'?(side==='left'?11:13):12);
  else{for(const [id,at,rank] of [['demon_king',6,1],['demon_king',8,2],['miracle_larva',11,1],['miracle_cocoon',13,2],['miracle_wing',17,3],['abyss_wing',18,3],['snow_rabbit',7,1],['great_detective',12,1],['rumi',16,1]])put(id,at,rank);}
  s.gauge=120;s.gold=120;s.events=[];p.active.run=E.serialize(s);
  const restored=parseProfile(JSON.stringify(p));assert.ok(restored?.active?.run,'fixture must pass normal profile/run validation');
  return JSON.stringify(restored);
}
async function open(theme,config){
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
  await page.route('**/*',r=>/^https?:/.test(r.request().url())?r.abort():r.continue());
  await page.addInitScript(({key,value})=>localStorage.setItem(key,value),{key:SAVE_KEY,value:fixture(config)});
  await page.goto(pathToFileURL(path.join(gameRoot,'dist',theme==='bright'?'StarGardenDefenseBright.html':'StarGardenDefense.html')).href);
  await page.waitForFunction(()=>window.STAR_GARDEN?.profile);
  return page;
}
async function resume(page){await page.locator('[data-action="resume"]').click();await page.waitForSelector('#arena');}
async function geometry(page){return page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,images:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.alt),buttons:[...document.querySelectorAll('.battle-controls button,.skills button')].map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};})}));}
async function point(page,index){const b=await page.locator('#arena').boundingBox(),p=E.cellPoint(index);return {x:b.x+p.x/720*b.width,y:b.y+p.y/780*b.height};}
async function drag(page,from,to){const a=await point(page,from),b=await point(page,to);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();}
try{
  for(const theme of ['night','bright']){
    const page=await open(theme);
    await page.locator('[data-nav="collection"]').click();await page.locator('[data-hero="miracle_larva"]').click();
    await page.locator('.miracle-forms summary').click();await page.locator('.miracle-form-grid').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('.miracle-form-grid .miracle-form').count(),4);
    await page.screenshot({path:path.join(out,theme+'-forms.png')});
    assert.ok((await geometry(page)).scrollWidth<=390);
    await page.locator('#sheet [data-action="close"]').last().click();await page.locator('#navigation [data-nav="home"]').click();await resume(page);
    await page.waitForTimeout(350);
    const before=await page.evaluate(()=>({gauge:STAR_GARDEN.battle.gauge,forms:STAR_GARDEN.battle.board.filter(u=>u?.hero==='miracle_larva').map(u=>({uid:u.uid,form:u.form,rank:u.rank}))}));
    await page.locator('[data-skill="miracle_larva"]').click();
    await page.waitForFunction(()=>STAR_GARDEN.battle.board.filter(u=>u?.hero==='miracle_larva').every(u=>u.form.endsWith('_wing')));
    const after=await page.evaluate(()=>({gauge:STAR_GARDEN.battle.gauge,forms:STAR_GARDEN.battle.board.filter(u=>u?.hero==='miracle_larva').map(u=>({uid:u.uid,form:u.form,rank:u.rank}))}));
    assert.ok(Math.abs(before.gauge-after.gauge-50)<2);assert.deepEqual(after.forms.map(u=>[u.uid,u.rank]),before.forms.map(u=>[u.uid,u.rank]));
    assert.equal(after.forms.find(u=>u.uid===before.forms[2].uid).form,'miracle_wing');assert.equal(after.forms.find(u=>u.uid===before.forms[3].uid).form,'abyss_wing');
    await page.waitForFunction(()=>document.querySelector('[data-skill="miracle_larva"]').classList.contains('unavailable'));
    const blocked=await page.locator('[data-skill="miracle_larva"]').getAttribute('aria-label');assert.match(blocked,/우화할 개체 없음/);
    await page.screenshot({path:path.join(out,theme+'-eclosed.png')});
    await drag(page,17,18);await page.waitForFunction(()=>STAR_GARDEN.battle.board[18]?.form==='miracle_cocoon');
    assert.equal(await page.evaluate(()=>STAR_GARDEN.battle.board[18].rank),4);
    await page.waitForSelector('.unit-name');
    assert.match(await page.locator('.unit-name').innerText(),/미라클코쿤/);
    await page.waitForFunction(()=>!document.querySelector('[data-skill="miracle_larva"]').classList.contains('unavailable'));
    await page.waitForTimeout(1000); // let the prior skill banner and inspection cross-fade finish before the review image
    await page.screenshot({path:path.join(out,theme+'-cocoon.png')});
    const g=await geometry(page);assert.ok(g.scrollWidth<=390);assert.deepEqual(g.images,[]);assert.ok(g.buttons.every(b=>b.x>=-1&&b.right<=391&&b.bottom<=845));
    cases.push({theme,before,after,blocked,geometry:g});await page.close();
  }
  if(!process.argv.includes('--themes-only'))for(const id of ['demon_king','miracle_larva','miracle_cocoon','miracle_wing','abyss_wing'])for(const side of ['left','right']){
    const cell=id==='miracle_cocoon'?(side==='left'?11:13):12;
    const page=await open('night',{one:id,side});await resume(page);await page.waitForFunction(({side,cell})=>STAR_GARDEN.battle.board[cell].facing===side,{side,cell});
    await page.screenshot({path:path.join(out,id+'-'+side+'.png')});cases.push({id,side,cell,facing:await page.evaluate(cell=>STAR_GARDEN.battle.board[cell].facing,cell)});await page.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  const result={viewport:[390,844],cases,errors,externalRequests:network,limits:'Offline desktop Chromium at mobile viewport; no physical-device FPS or long-run win-rate claim.'};
  await fs.writeFile(path.join(out,process.argv.includes('--themes-only')?'theme-validation.json':'browser-validation.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({cases:cases.length,errors,externalRequests:network.length,output:out}));
}finally{await browser.close();}
