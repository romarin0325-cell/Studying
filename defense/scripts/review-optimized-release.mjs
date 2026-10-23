// Focused manual check of the changed offline image paths; one Chromium viewport.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {gameRoot} from './local-inputs.mjs';
import {HEROES,LATE_COMPANIONS} from '../src/content.js';
import {BUILD_ONLY_ATLASES,RUNTIME_ASSET_PATHS} from '../src/asset-policy.js';
import {createProfile,command,SAVE_KEY} from '../src/profile.js';
import {createBattle} from '../src/battle.js';
import {serialize,step,restore} from '../src/combat/engine.js';

const out=path.join(gameRoot,'test-results/optimized-release');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch(),errors=[],external=[],cases=[],now=Date.now();
async function capture(page,label){
  await page.waitForFunction(()=>[...document.images].filter(i=>i.offsetParent!==null).every(i=>i.complete&&i.naturalWidth>0));
  const geometry=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
  assert.ok(geometry.scrollWidth<=390,label+' horizontal overflow');
  await page.screenshot({path:path.join(out,label+'.png'),animations:'disabled'});cases.push({label,...geometry});
}
try{
  for(const name of ['StarGardenDefense.html','StarGardenDefenseBright.html']){
    const skin=name.includes('Bright')?'bright':'night',p=createProfile(now);
    p.settings.sound=false;p.settings.auto=false;p.cleared=45;p.partner='underdog';p.noticeLate=[...LATE_COMPANIONS];
    for(const h of HEROES){p.heroes[h.id].owned=true;p.heroes[h.id].bond=10;}
    p.deck=['underdog','toffee_apple','siren','time_magician','zeke'];
    assert.ok(command(p,'begin',{mode:'main',stage:1},now).ok);
    const run=createBattle(p),unit={...run.board.find(Boolean)};run.board.fill(null);
    for(const [index,hero] of p.deck.entries())run.board[[12,7,16,18,24][index]]={...unit,uid:run.nextId++,hero,rank:2,cooldown:99,windup:0,pose:0,disabled:0,cursed:false,facing:'down'};
    run.queue=[{kind:'grunt',hp:1e7}];run.spawnIn=0;step(run,.001);
    run.queue=[{kind:'grunt',hp:1e7}];run.spawnIn=999;run.events=[];p.active.run=serialize(run);
    assert.ok(restore(p.active.run),'focused render fixture restores');
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true}),page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(/^https?:/.test(r.url())||/^file:.*\/assets\//.test(r.url()))external.push(r.url());});
    await page.route('**/*',r=>/^https?:/.test(r.request().url())?r.abort():r.continue());
    await page.addInitScript(({p,key})=>localStorage.setItem(key,JSON.stringify(p)),{p,key:SAVE_KEY});
    await page.goto(pathToFileURL(path.join(gameRoot,'dist',name)).href);await context.setOffline(true);
    await page.locator('.scene-partner').waitFor();await page.evaluate(()=>document.fonts.ready);
    const embedded=await page.evaluate(()=>Object.keys(window.__ASTRA_ASSETS__));
    assert.deepEqual(embedded.sort(),Object.keys(RUNTIME_ASSET_PATHS).sort());
    for(const id of Object.keys(BUILD_ONLY_ATLASES))assert.ok(!embedded.includes(id));
    await capture(page,skin+'-home');
    await page.locator('[data-nav="collection"]').click();await page.locator('.cc[data-hero="underdog"]').click();
    await page.locator('#sheet[data-kind="hero"]').waitFor();await capture(page,skin+'-portrait');
    await page.locator('#sheet [data-action="bond"]').click();
    await page.locator('[data-memorial="underdog"]').click();
    await page.locator('img[data-memorial="1"]').waitFor();
    assert.deepEqual(await page.locator('img[data-memorial="1"]').evaluate(i=>[i.naturalWidth,i.naturalHeight]),[720,1080]);
    await capture(page,skin+'-memorial');
    await page.locator('.mv-controls [data-action="close"]').click();
    if(await page.locator('#sheet[data-kind="hero"]').isVisible())await page.locator('.sheet-top [data-action="close"]').first().click();
    await page.locator('.nav-item[data-nav="home"]').click();
    const resume=page.locator('[data-action="resume"]');
    await resume.click();await page.locator('#arena').waitFor();
    await page.waitForFunction(()=>window.STAR_GARDEN.battle?.time>.5);
    const before=await page.evaluate(()=>{window.STAR_GARDEN.battle.gauge=120;window.STAR_GARDEN.battle.gold=200;return window.STAR_GARDEN.battle.stats.skills;});
    await page.locator('[data-skill="zeke"]').click();
    await page.waitForFunction(n=>window.STAR_GARDEN.battle.stats.skills>n,before);
    await capture(page,skin+'-battle');
    await context.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await fs.writeFile(path.join(out,'summary.json'),JSON.stringify({viewport:[390,844],browser:'Chromium',errors,external,cases},null,2)+'\n');
  console.log(JSON.stringify({cases:cases.length,errors:errors.length,external:external.length}));
}finally{await browser.close();}
