// Only the changed voice/story/summon presentation, on the two release skins at390x844.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {createProfile,SAVE_KEY} from '../src/profile.js';
import {HEROES,LATE_COMPANIONS} from '../src/content.js';
import {MEMORIAL_STORIES} from '../src/memorial.js';
import {FAVORITE_LINES} from '../src/bond.js';
import {gameRoot} from './local-inputs.mjs';
const out=path.join(gameRoot,'test-results/balance-dialogue');await fs.mkdir(out,{recursive:true});
const request=JSON.parse(await fs.readFile(path.join(gameRoot,'docs/archive/2026-10-25-DIALOGUE_REQUEST.json')));
const stories=Object.entries(request.characters).filter(([,v])=>v.memorial).map(([id,v])=>({id,...v.memorial}));
const longestBody=stories.toSorted((a,b)=>b.body.length-a.body.length)[0].id,longestTitle=stories.toSorted((a,b)=>b.title.length-a.title.length)[0].id;
const storyIds=[...new Set([longestBody,longestTitle])],errors=[],external=[],cases=[];
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true});
const normalize=s=>s.replace(/\s+/g,' ').trim();
function fixture(gift){const p=createProfile();p.cleared=45;p.noticeLate=[...LATE_COMPANIONS];p.partner='ash';p.settings={sound:false,auto:false,reduced:true,quality:'standard'};p.gifts={candy:5,letter:5,bouquet:5};for(const h of HEROES){p.heroes[h.id].owned=true;p.heroes[h.id].bond=10;}if(gift)p.heroes.ash.bond=9;return JSON.stringify(p);}
async function open(theme,gift){const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});await page.route('**/*',r=>/^https?:/.test(r.request().url())?r.abort():r.continue());await page.addInitScript(({key,value})=>localStorage.setItem(key,value),{key:SAVE_KEY,value:fixture(gift)});await page.goto(pathToFileURL(path.join(gameRoot,'dist',theme==='bright'?'StarGardenDefenseBright.html':'StarGardenDefense.html')).href);await page.waitForFunction(()=>window.STAR_GARDEN?.profile);return page;}
async function geometry(page){const g=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,broken:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.alt)}));assert.ok(g.scrollWidth<=g.width);assert.deepEqual(g.broken,[]);return g;}
try{
 for(const theme of ['night','bright']){
  const p=await open(theme,true);await p.locator('.lb-gift').click();await p.locator('.tray-gift[data-give="bouquet"]').click();
  await p.waitForFunction(()=>getComputedStyle(document.querySelector('#subtitle')).opacity==='1');assert.equal(await p.locator('#subtitle-text').innerText(),FAVORITE_LINES.ash);
  const subtitle=await p.locator('#subtitle-text').evaluate(e=>({client:e.clientHeight,scroll:e.scrollHeight,rect:{x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right,y:e.getBoundingClientRect().y,bottom:e.getBoundingClientRect().bottom}}));
  assert.ok(subtitle.scroll<=subtitle.client);assert.ok(subtitle.rect.x>=0&&subtitle.rect.right<=390&&subtitle.rect.y>=0&&subtitle.rect.bottom<=844);
  await p.screenshot({path:path.join(out,theme+'-long-gift.png')});cases.push({theme,kind:'long favorite line',length:FAVORITE_LINES.ash.length,subtitle,geometry:await geometry(p)});
  await p.locator('#navigation [data-nav="summon"]').click();await p.locator('[data-action="rates"]').click();assert.match(await p.locator('#sheet').innerText(),/베히모스/);
  await p.screenshot({path:path.join(out,theme+'-regular-rates.png')});await p.locator('#sheet [data-action="close"]').last().click();
  await p.locator('[data-banner="season"]').click();await p.locator('[data-action="rates"]').click();assert.match(await p.locator('#sheet').innerText(),/일반 UR 8종 합계/);
  cases.push({theme,kind:'regular Behemoth and8 ordinary URs',geometry:await geometry(p)});await p.close();
  const m=await open(theme,false);await m.locator('#navigation [data-nav="collection"]').click();await m.locator('[data-collection="album"]').click();
  for(const id of storyIds){
   await m.locator(`[data-memorial="${id}"]`).click();await m.waitForSelector('#memory-art[aria-busy="false"]');assert.match(await m.locator('#sheet').innerText(),new RegExp(MEMORIAL_STORIES[id].title));
   await m.locator('[data-action="memorial-story"]').click();const body=await m.locator('#memory-text').innerText();assert.equal(normalize(body),normalize(MEMORIAL_STORIES[id].paragraphs.join(' ')));
   const storyGeometry=await m.locator('#memory-text').evaluate(e=>({client:e.clientWidth,scroll:e.scrollWidth}));assert.ok(storyGeometry.scroll<=storyGeometry.client);
   await m.screenshot({path:path.join(out,theme+'-'+id+'-story.png')});
   await m.locator('#memory-text').evaluate(e=>{e.scrollTop=e.scrollHeight;e.dispatchEvent(new Event('scroll'));});await m.waitForFunction(id=>STAR_GARDEN.profile.memories[id]?.read,id);
   cases.push({theme,kind:'story',id,title:MEMORIAL_STORIES[id].title,storyGeometry,geometry:await geometry(m)});await m.locator('.mv-controls [data-action="close"]').click();
  }
  await m.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await fs.writeFile(path.join(out,'validation.json'),JSON.stringify({viewport:[390,844],cases,errors,externalRequests:external,limits:'Desktop Chromium mobile viewport; actual paid API responses were not requested.'},null,2)+'\n');console.log(JSON.stringify({cases:cases.length,storyIds,errors,externalRequests:external.length,output:out}));
}finally{await browser.close();}
