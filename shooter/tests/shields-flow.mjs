import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {LIBRARY} from '../learning.js';
const root=new URL('../',import.meta.url),original=await fs.readFile(new URL('dist/AstralBloom.html',root),'utf8');
const html=original.replace("Object.defineProperty(globalThis, 'astralDiagnostics'","globalThis.__shields={get game(){return game},get profile(){return profile},get art(){return art},renderer,ARTIFACTS,save};\nObject.defineProperty(globalThis, 'astralDiagnostics'");
assert.notEqual(html,original);await fs.mkdir(new URL('artifacts/',root),{recursive:true});
const file=new URL('artifacts/shields-offline.html',root);await fs.writeFile(file,html);
const browser=await chromium.launch({headless:true}),errors=[],network=[],checks=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,offline:true}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
 await page.clock.install({time:new Date(2026,8,13,12)});await page.goto(file.href);await page.waitForFunction(()=>astralDiagnostics?.ready);
 const click=s=>page.locator(s).click(),shot=name=>page.screenshot({path:fileURLToPath(new URL(`artifacts/shields-${name}.png`,root))});
 await page.evaluate(()=>{__shields.profile.owned=__shields.ARTIFACTS.map(a=>a.id);__shields.profile.equipped=[];__shields.save();});
 await click('#equipment');
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:844,height:390}]){
  await page.setViewportSize(viewport);
  const geometry=await page.evaluate(()=>{
   const list=document.querySelector('.equipment-list'),b=list.getBoundingClientRect(),cards=[...document.querySelectorAll('[data-artifact]')];
   return {width:innerWidth,scroll:document.documentElement.scrollWidth,visible:cards.filter(c=>{const r=c.getBoundingClientRect();return r.top>=b.top&&r.bottom<=b.bottom}).length,
    clipped:cards.filter(c=>c.scrollWidth>c.clientWidth+1).map(c=>c.dataset.artifact),done:(()=>{const r=document.querySelector('#equipment-done').getBoundingClientRect();return {top:r.top,bottom:r.bottom};})()};
  });
  assert.equal(geometry.scroll,viewport.width);assert.deepEqual(geometry.clipped,[]);assert.ok(geometry.done.top>=0&&geometry.done.bottom<=viewport.height);
  if(viewport.width===390)assert.ok(geometry.visible>=6,JSON.stringify(geometry));
  await shot(`inventory-${viewport.width}`);checks.push({viewport,...geometry});
 }
 await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('.artifact.normal').count(),20);assert.equal(await page.locator('.artifact.rare').count(),12);
 assert.equal(await page.evaluate(()=>__shields.art.urls.relics.length),32);
 for(const id of ['clover','slipper','dew'])await click(`[data-artifact="${id}"]`);
 assert.equal(await page.locator('[data-artifact].selected').count(),3);await shot('selected-relics');await click('#equipment-done');
 await click('#help');assert.ok((await page.locator('.help-list').innerText()).includes('P 두 개'));await click('#help-done');
 await click('[data-hero="0"]');await click('#launch');await page.clock.runFor(2600);
 await page.evaluate(()=>{const g=__shields.game;g.phase='boss';g.enemies=[];g.bullets=[];g.player.fire=999;g.player.invincible=0;});
 await page.clock.runFor(100);assert.ok(await page.locator('#barrier-status').isVisible());await shot('barrier-active');
 const before=await page.evaluate(()=>{const g=__shields.game;return [g.player.lives,g.bombs,g.power];});
 await page.evaluate(()=>{const g=__shields.game;g.enemyBullet(g.player.x,g.player.y,0,0);g.enemyBullet(100,300,0,0);});
 await page.clock.runFor(100);assert.ok(!(await page.locator('#barrier-status').isVisible()));
 const after=await page.evaluate(()=>{const g=__shields.game;return {resources:[g.player.lives,g.bombs,g.power],bullets:g.bullets.length,immune:g.player.invincible};});
 assert.deepEqual(after.resources,before);assert.equal(after.bullets,2);assert.ok(after.immune>2.3);await shot('barrier-break');
 await page.evaluate(()=>{const g=__shields.game;g.bullets=[];g.player.invincible=0;g.graze=19;g.enemyBullet(g.player.x+18,g.player.y,0,0);});
 await page.clock.runFor(100);assert.equal(await page.evaluate(()=>__shields.game.graze),20);assert.ok(await page.locator('#barrier-status').isVisible());
 await page.evaluate(()=>{const g=__shields.game;g.collect('power');g.collect('power');});assert.equal(await page.evaluate(()=>__shields.game.power),2);
 checks.push('Offline gameplay: clover barrier, break immunity without bullet clear, slipper recharge and two-P powerup');
 await click('#pause');await click('#return');await page.reload();await page.waitForFunction(()=>astralDiagnostics?.ready);
 assert.deepEqual(await page.evaluate(()=>__shields.profile.equipped),['clover','slipper','dew']);
 // Exercise skipped, correct vocabulary, and incorrect collocation draws at the same roll.
 await page.evaluate(()=>{__shields.profile.tickets=Array.from({length:3},()=>({difficulty:'normal',dungeon:0}));__shields.save();globalThis.__originalRandom=Math.random;});
 await click('#equipment');assert.ok(!(await page.locator('.equipment-footer').innerText()).includes('%'));
 for(const [mode,expectedTickets,rare] of [['skip',2,false],['vocab',1,true],['collocation',0,false]]){
  await click('#draw-ticket');assert.equal(await page.evaluate(()=>__shields.profile.tickets.length),expectedTickets+1);
  const copy=await page.locator('.intro-copy').innerText();assert.ok(!/\d+\s*%|2배/.test(copy));await shot(`quiz-offer-${mode}`);
  if(mode==='skip'){
   await page.evaluate(()=>Math.random=()=>.2);await click('#quiz-decline');
  }else{
   await page.evaluate(kind=>Math.random=()=>kind==='vocab'?.2:.8,mode);await click('#quiz-accept');await page.evaluate(()=>Math.random=__originalRandom);
   const prompt=await page.locator('.quiz-prompt').textContent();
   const answer=mode==='vocab'?LIBRARY.vocab.find(v=>v.w===prompt)?.m:LIBRARY.collocation.find(q=>q.question===prompt)?.answer;assert.ok(answer);
   const choices=page.locator('[data-answer]'),labels=await choices.allTextContents();const index=labels.findIndex(s=>mode==='vocab'?s===answer:s!==answer);assert.ok(index>=0);
   await choices.nth(index).click();assert.equal(await page.evaluate(()=>__shields.profile.tickets.length),expectedTickets+1);
   await page.evaluate(()=>Math.random=()=>.2);await click('#quiz-continue');
  }
  await page.evaluate(()=>Math.random=__originalRandom);assert.equal(await page.evaluate(()=>__shields.profile.tickets.length),expectedTickets);
  assert.equal(await page.locator('.relic-reveal.rare').count(),rare?1:0);await shot(`draw-${mode}`);await click('#reveal-done');
 }
 assert.equal(await page.locator('#draw-ticket').isDisabled(),true);await click('#equipment-done');
 await click('#dungeons');assert.ok(!/15%|30%|70%|85%|80%|20%/.test(await page.locator('.tiny-note').innerText()));await click('#dungeon-done');
 assert.ok(await page.evaluate(()=>__shields.profile.learning.mistakes.some(q=>q.kind==='collocation')));
 checks.push('Draw confirmation, vocabulary success bonus, collocation failure, skip, single ticket debit and hidden numerical odds');
 // Native inventory assets next to the old ones, including the replacement magnet.
 await page.evaluate(()=>{const art=__shields.art;document.body.innerHTML='<main id="atlas" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;background:#142036;color:#fff;padding:16px"></main>';
  for(const id of ['spellbook','frozen','magnet','sun','hourglass','clover','witch','silver','eye','startboost','slipper','dew','bigbang','kaleidoscope']){const i=__shields.ARTIFACTS.findIndex(a=>a.id===id),el=document.createElement('div');el.style.textAlign='center';el.innerHTML=`<img src="${art.urls.relics[i]}" style="width:104px;height:104px;object-fit:contain"><p style="margin:2px;font-size:13px">${__shields.ARTIFACTS[i].name}</p>`;document.querySelector('#atlas').append(el);}});
 await page.setViewportSize({width:560,height:620});await page.locator('#atlas img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));await shot('atlas');
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);const report={checks,errors,network};await fs.writeFile(new URL('artifacts/shields-flow.json',root),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
