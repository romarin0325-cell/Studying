// Focused, offline visual review of the five owner-selected atlases and Phantom's laugh.
// Fixture state is isolated in new browser contexts; no player save is read or changed.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {createProfile,command,SAVE_KEY} from '../src/profile.js';
import {HEROES,LATE_COMPANIONS} from '../src/content.js';
import {createBattle} from '../src/battle.js';
import * as E from '../src/combat/engine.js';
import {eventWindow,activeEvent} from '../src/preview/season.js';
import {PARTNER_LINES,JOIN_LINES} from '../src/lines.js';
import {GIFT_LINES,FAVORITE_LINES} from '../src/bond.js';
import {MEMORIAL_STORIES} from '../src/memorial.js';
import {REQUESTS,AFTERWORDS} from '../src/preview/requests-data.js';
import {gameRoot} from './local-inputs.mjs';
const manifest=JSON.parse(await fs.readFile(path.join(gameRoot,'docs/art/selected-cast-20261108/selection.json'),'utf8')),ids=manifest.assets.map(a=>a.id),out=path.join(gameRoot,'test-results/selected-cast');await fs.mkdir(out,{recursive:true});
const optimization=JSON.parse(await fs.readFile(path.join(gameRoot,'docs/ASSET_OPTIMIZATION.json'),'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');
let NOW=Date.UTC(2026,10,8,4);if(activeEvent(NOW)==='oath')NOW+=7*86400000;
function profile(partner='luna'){
 const p=createProfile(NOW);p.cleared=90;p.noticeLate=[...LATE_COMPANIONS];p.partner=partner;p.deck=[...ids];p.settings.sound=false;p.settings.auto=false;p.settings.reduced=true;p.settings.quality='standard';p.ftue={legacy:true,done:[],seen:[],skipped:false};p.beginner=null;p.firstTen=true;p.eventSeen=eventWindow(NOW).id;
 for(const h of HEROES){p.heroes[h.id].owned=true;p.heroes[h.id].bond=10;}
 p.gifts={candy:3,letter:3,bouquet:3};p.heroes.phantom.bond=9;
 const other=HEROES.filter(h=>!ids.includes(h.id)).slice(0,5).map(h=>h.id);assert.ok(command(p,'twinParty',{left:{deck:ids,relics:[]},right:{deck:other,relics:[]}},NOW).ok);
 return p;
}
const progress={up:284,right:818,down:1394,left:1970};
function battleProfile(direction){
 const p=profile();assert.ok(command(p,'begin',{mode:'main',stage:1},NOW).ok);const s=createBattle(p),sample={...s.board.find(Boolean)};s.board.fill(null);s.wave=1;s.time=10;s.gold=100;s.gauge=120;
 for(const [j,hero]of ids.entries()){const i=[7,6,8,11,12][j];s.board[i]={...sample,uid:s.nextId++,hero,rank:1,born:0,birthWave:1,cooldown:99,priority:'first',windup:0};}
 s.queue=[{kind:'boss',hp:1e9}];s.spawnIn=0;E.step(s,.05);assert.equal(s.enemies.length,1);const enemy=s.enemies[0];enemy.progress=progress[direction];enemy.speed=0;enemy.skillIn=999;enemy.hp=enemy.maxHp=1e9;
 for(const u of s.board)if(u){u.cooldown=0;u.windup=0;}
 E.step(s,.01);assert.ok(s.board.filter(Boolean).every(u=>u.facing===direction),direction+' actual targeting directions');p.active.run=E.serialize(s);assert.ok(E.restore(p.active.run));return p;
}
const browser=await chromium.launch({headless:true}),errors=[],external=[],captures=[],embedded=[],guideCases=[];
async function boot(file,p=profile()){
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:1}),page=await context.newPage();await page.clock.setFixedTime(NOW);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});await page.route('**/*',r=>/^https?:/.test(r.request().url())?r.abort():r.continue());
 const url=pathToFileURL(file).href;await page.route(url,r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated fixture</title>'}),{times:1});await page.goto(url);await page.evaluate(({key,p})=>localStorage.setItem(key,JSON.stringify(p)),{key:SAVE_KEY,p});await page.goto(url);await context.setOffline(true);await page.waitForFunction(()=>window.STAR_GARDEN?.profile);await page.locator('.scene-partner').waitFor();await page.evaluate(()=>document.fonts.ready);return{page,context};
}
async function shot(page,label){
 await page.evaluate(async()=>{await Promise.all([...document.images].filter(i=>i.offsetParent!==null).map(i=>i.decode()));});
 const g=await page.evaluate(()=>({documentWidth:document.documentElement.scrollWidth,visibleBroken:[...document.images].filter(i=>i.offsetParent!==null&&(!i.complete||!i.naturalWidth)).map(i=>i.alt),sheet:(()=>{const e=document.getElementById('sheet');if(!e||!e.offsetParent)return null;const r=e.getBoundingClientRect();return{x:r.x,right:r.right,bottom:r.bottom};})()}));assert.ok(g.documentWidth<=390,label+' document overflow');assert.deepEqual(g.visibleBroken,[]);if(g.sheet){assert.ok(g.sheet.x>=-1&&g.sheet.right<=391&&g.sheet.bottom<=845,label+' sheet fits');}
 const file=path.join(out,label+'.png');await page.screenshot({path:file,animations:'disabled'});captures.push({label,file:path.relative(gameRoot,file).replaceAll('\\','/'),...g});
}
const close=page=>page.locator('#sheet .sheet-top [data-action="close"]').click();
try{
 for(const [theme,name]of [['night','StarGardenDefense.html'],['bright','StarGardenDefenseBright.html']]){
  const file=path.join(gameRoot,'dist',name),{page,context}=await boot(file);
  const values=await page.evaluate(ids=>Object.fromEntries(ids.flatMap(id=>[['atlas:'+id,window.__ASTRA_ASSETS__['unit-'+id]],['portrait:'+id,window.__GARDEN_MEDIA__['portrait:'+id]],['figure:'+id,window.__GARDEN_MEDIA__['figure:'+id]]])),ids);
  for(const [key,value]of Object.entries(values)){const i=key.startsWith('atlas:')?optimization.images.find(i=>i.id==='atlas:unit-'+key.slice(6)):optimization.derived.find(i=>i.id===key);assert.equal(sha(Buffer.from(value.split(',')[1],'base64')),i.output.sha256,key+' actual embedded selection');}embedded.push({theme,verifiedImages:Object.keys(values).length});
  await shot(page,theme+'-home');await page.locator('[data-action="prepare"]').click();await page.locator('#sheet[data-kind="prepare"]').waitFor();await shot(page,theme+'-prepare');await page.locator('#sheet-footer [data-action="team"]').click();await shot(page,theme+'-formation');await close(page);
  await page.locator('#navigation [data-nav="collection"]').click();for(const id of ids){await page.locator(`.cards [data-hero="${id}"]`).click();await shot(page,theme+'-detail-'+id);await close(page);}
  await page.locator('#navigation [data-nav="adventure"]').click();await page.locator('[data-mode="twin"]').click();await page.locator('[data-action="twin-party"]').click();await page.locator('.twin-panels').waitFor();for(const id of ids)assert.equal(await page.locator(`[data-twin-drop="left:deck:${id}"] img`).count(),1);await shot(page,theme+'-twin-formation');await context.close();
  const gift=await boot(file,profile('phantom'));await gift.page.locator('.lb-gift').click();await gift.page.locator('[data-give="letter"]').click();await gift.page.waitForFunction(()=>getComputedStyle(document.querySelector('#subtitle')).opacity==='1');assert.equal(await gift.page.locator('#subtitle-text').innerText(),GIFT_LINES.phantom);assert.match(GIFT_LINES.phantom,/^크큭\.\.\./);await shot(gift.page,theme+'-phantom-line');await gift.context.close();
  for(const direction of ['down','up','left','right']){const b=await boot(file,battleProfile(direction));await b.page.locator('[data-action="resume"]').click();await b.page.locator('#arena').waitFor();await b.page.waitForFunction(direction=>window.STAR_GARDEN.battle.board.filter(Boolean).every(u=>u.facing===direction),direction);await b.page.locator('[data-action="pause"]').click();await shot(b.page,theme+'-battle-'+direction);await b.context.close();}
 }
 // The committed bright test build exposes the current request/epilogue data.
 const preview=await boot(path.join(gameRoot,'dist-test/StarGardenDefenseBrightTest.html'),profile('phantom'));await shot(preview.page,'preview-home');await preview.context.close();
 for(const width of [390,1280]){
  const ctx=await browser.newContext({viewport:{width,height:1000},offline:true}),page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});await page.goto(pathToFileURL(path.join(gameRoot,'docs/art/sd-pipeline/index.html')).href);await page.waitForFunction(()=>window.guideReady);assert.equal(await page.locator('[data-check]').count(),17);assert.equal(await page.locator('#master option').count(),9);assert.equal(await page.locator('[data-stage]').count(),7);
  for(const frame of ['feminine-medium','neutral-tall','masculine-medium']){await page.selectOption('#master',frame);await page.evaluate(async()=>Promise.all([...document.images].map(i=>i.decode())));}
  await page.selectOption('#direction','all');await page.selectOption('#size','96');await page.waitForFunction(()=>window.guideReady);assert.equal(await page.locator('#cast .card').count(),20);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);await page.screenshot({path:path.join(out,'pipeline-guide-'+width+'.png')});guideCases.push({width,stages:7,checks:17,masters:9,comparisonCards:20,externalRequests:0});await ctx.close();
 }
 const phantomText=[...PARTNER_LINES.phantom.talk,...PARTNER_LINES.phantom.greet,JOIN_LINES.phantom,GIFT_LINES.phantom,...MEMORIAL_STORIES.phantom.paragraphs,...REQUESTS.filter(r=>r.hero==='phantom').flatMap(r=>[...r.arrive,...r.thanks]),...AFTERWORDS.phantom.paragraphs].join('\n');assert.doesNotMatch(phantomText,/크하하/);assert.equal((phantomText.match(/크큭\.\.\./g)||[]).length,8);assert.match(FAVORITE_LINES.behemoth,/크하하/,'another character laugh is unchanged');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);const report={viewports:[390,844],themes:['night','bright'],captures,embedded,guideCases,phantomReplacements:8,pageErrors:errors,externalRequests:external,limits:'Desktop Chromium CSS viewport and controlled combat fixtures; not physical-device FPS or a new anatomical-art pass.'};await fs.writeFile(path.join(out,'validation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({captures:captures.length,embedded,guideCases,phantomReplacements:8,pageErrors:errors.length,externalRequests:external.length}));
}finally{await browser.close();}
