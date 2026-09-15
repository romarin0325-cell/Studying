import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=new URL('../',import.meta.url),original=await fs.readFile(new URL('dist/AstralBloom.html',root),'utf8');
const html=original.replace("Object.defineProperty(globalThis, 'astralDiagnostics'","globalThis.__end={get game(){return game},get profile(){return profile},get art(){return art},Game,save};\nObject.defineProperty(globalThis, 'astralDiagnostics'");
assert.notEqual(html,original);const file=new URL('artifacts/endgame-offline.html',root);await fs.writeFile(file,html);
const browser=await chromium.launch({headless:true}),errors=[],network=[],checks=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844},offline:true});const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
 await page.clock.install({time:new Date(2026,8,13,12)});await page.goto(file.href);await page.waitForFunction(()=>astralDiagnostics?.ready);
 const click=s=>page.locator(s).click(),shot=name=>page.screenshot({path:fileURLToPath(new URL(`artifacts/endgame-${name}.png`,root))});
 const scroll=()=>page.evaluate(()=>({top:document.querySelector('.sortie').scrollTop,left:document.querySelector('.roster').scrollLeft}));
 await page.setViewportSize({width:320,height:568});
 await page.locator('.roster').evaluate(el=>el.scrollLeft=el.scrollWidth);await page.locator('.sortie').evaluate(el=>el.scrollTop=el.scrollHeight);
 const before=await scroll();await click('[data-hero="6"]');const after=await scroll();assert.ok(Math.abs(before.left-after.left)<2);assert.ok(Math.abs(before.top-after.top)<2);
 const box=await page.locator('.weapons').boundingBox();await click('#random-hero');const randomBox=await page.locator('.weapons').evaluate(el=>{const b=el.getBoundingClientRect();return {width:b.width,height:b.height};});assert.equal(box.width,randomBox.width);assert.equal(box.height,randomBox.height);
 await shot('random-lobby');checks.push('Character scroll persists and random keeps the weapon slot dimensions at 320px');
 await click('#equipment');
 for(const size of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:844,height:390}]){
  await page.setViewportSize(size);const done=await page.locator('#equipment-done').boundingBox();assert.ok(done.y>=0&&done.y+done.height<=size.height);
  assert.deepEqual(await page.locator('.relic-section h3').allTextContents(),['일반 아티팩트','레어 아티팩트','에픽 아티팩트']);await page.locator('.equipment-list').evaluate(el=>el.scrollTop=el.scrollHeight);const next=await page.locator('#equipment-done').boundingBox();assert.equal(done.y,next.y);
 }
 await page.setViewportSize({width:390,height:844});await shot('relics');await click('#equipment-done');
 await click('#dungeons');await page.locator('.dungeon-list').evaluate(el=>el.scrollTop=el.scrollHeight);const dungeonScroll=await page.locator('.dungeon-list').evaluate(el=>el.scrollTop);
 await click('[data-dungeon="5"]');assert.ok(Math.abs(await page.locator('.dungeon-list').evaluate(el=>el.scrollTop)-dungeonScroll)<2);
 await click('[data-difficulty="hard"]');assert.equal(await page.locator('[data-difficulty="hard"] small').textContent(),'뽑기권 2장');await shot('dungeons');await click('#dungeon-done');
 checks.push('Equipment actions stay visible in four viewports; rarity groups and dungeon scroll work');
 // A reveal is charged even when cancelled. Reload cannot restore it.
 await click('#launch');await click('#help-done');await click('#random-cancel');assert.equal(await page.evaluate(()=>__end.profile.randomDraws.count),1);
 await page.reload();await page.waitForFunction(()=>astralDiagnostics?.ready);assert.equal(await page.evaluate(()=>__end.profile.randomDraws.count),1);
 for(let i=1;i<10;i++){await click('#launch');await click('#random-cancel');}
 await click('#launch');assert.ok(await page.locator('#random-limit-return').isVisible());await shot('random-limit');await click('#random-limit-return');
 await page.clock.setFixedTime(new Date(2026,8,14,12));await click('#launch');await click('#random-cancel');assert.equal(await page.evaluate(()=>__end.profile.randomDraws.count),1);
 checks.push('Ten reveals persist across cancellation/reload; exhaustion has a return path; next day resets');
 // Ordinary departures remain possible after exhaustion, and Corona replaces HUD/help/actual behavior.
 await page.evaluate(()=>{__end.profile.randomDraws.count=10;__end.profile.owned.push('sun');__end.profile.equipped=['sun'];__end.save();});
 await click('[data-hero="0"]');await click('#help');assert.ok((await page.locator('.help-list').innerText()).includes('코로나'));await click('#help-done');
 await click('#launch');await page.clock.runFor(2800);await click('#bomb');assert.equal(await page.locator('#bomb-label').textContent(),'코로나');await page.clock.runFor(350);await shot('corona');
 await click('#pause');await click('#return');
 // Render and fight every new boss in the actual offline canvas. Use a resilient test-only target.
 for(const stage of [3,4,5]){
  await click('#dungeons');await click(`[data-dungeon="${stage}"]`);await click('#dungeon-done');await click('#launch');await page.clock.runFor(2800);
  await page.evaluate(()=>{const g=__end.game;g.player.invincible=999;g.player.fire=999;g.spawnBoss();g.phase='boss';g.boss.y=150;g.boss.hp=g.boss.maxHp*.5;});
  await page.clock.runFor(1700);if(stage===4){assert.ok(await page.evaluate(()=>__end.game.hazards.some(h=>h.axis==='horizontal')));}
  await shot(`boss-${stage}`);await click('#pause');await click('#return');
 }
 await page.evaluate(()=>{__end.profile.equipped=[];__end.save();});
 await page.clock.setFixedTime(new Date(2026,8,13,12));await click('[data-hero="2"]');await click('#launch');await page.clock.runFor(2800);await click('#bomb');await page.clock.runFor(350);await shot('phoenix');
 checks.push('Corona overrides help/HUD and launches without random uses; all six-dungeon assets render; Poseidon cross and phoenix render offline');
 await page.evaluate(()=>{
  const art=__end.art;document.body.innerHTML='<main id="atlas" style="display:grid;grid-template-columns:repeat(3,1fr);background:#14233c"></main>';
  for(let i=0;i<6;i++){const el=document.createElement('div');el.innerHTML=`<img src="${art.urls.bosses[i]}" style="width:220px;height:220px;object-fit:contain">`;document.getElementById('atlas').append(el);}
 });await page.setViewportSize({width:720,height:500});await page.locator('#atlas img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));await shot('boss-comparison');
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);await fs.writeFile(new URL('artifacts/endgame-flow.json',root),JSON.stringify({checks,errors,network},null,2));console.log(JSON.stringify({checks,errors,network},null,2));
}finally{await browser.close();}
