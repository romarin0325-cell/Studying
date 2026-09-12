import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs/promises';
import {LIBRARY} from '../learning.js';
const root=new URL('../',import.meta.url),original=await fs.readFile(new URL('dist/AstralBloom.html',root),'utf8');
// Only this test copy exposes the run for deterministic combat setup. Production
// output has no bridge. Quiz UI, persistence, rewards and renderer are unchanged.
const harness=original.replace("Object.defineProperty(globalThis, 'astralDiagnostics'", "globalThis.__flow={get game(){return game},get profile(){return profile}};\nObject.defineProperty(globalThis, 'astralDiagnostics'");
assert.notEqual(harness,original);await fs.mkdir(new URL('artifacts/',root),{recursive:true});
const file=new URL('artifacts/flow-offline.html',root);await fs.writeFile(file,harness);
const browser=await chromium.launch({headless:true}),checks=[],errors=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,offline:true});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date(2026,8,14,12)});
 await page.goto(file.href);await page.waitForFunction(()=>window.astralDiagnostics?.ready);
 const click=selector=>page.locator(selector).click();
 const shot=name=>page.screenshot({path:fileURLToPath(new URL(`artifacts/${name}.png`,root))});
 const state=()=>page.evaluate(()=>astralDiagnostics);
 async function answer(correct=true){
   if(await page.locator('#quiz-accept').count())await click('#quiz-accept');
   if(await page.locator('#quiz-now').count())await click('#quiz-now');
   const prompt=await page.locator('.quiz-prompt').textContent();
   const q=[...LIBRARY.grammar.flatMap(l=>l.quizzes||[]),...LIBRARY.collocation].find(q=>q.question===prompt);
   const expected=q?.answer||LIBRARY.vocab.find(v=>v.w===prompt)?.m;assert.ok(expected);
   const options=page.locator('[data-answer]'),labels=await options.allTextContents();
   const index=labels.findIndex(s=>correct?s===expected:s!==expected);assert.ok(index>=0);await options.nth(index).click();await click('#quiz-continue');
 }
 await click('[data-hero="4"]');await click('#quiz-accept');await click('#read-first');assert.ok((await page.locator('.lecture-copy').textContent()).length>200);await click('#lecture-back');await answer();
 assert.equal((await state()).hero,4);checks.push('Off-day grammar lecture and successful daily unlock');
 await shot('snow-sortie');await click('[data-hero="1"]');await shot('luna-sortie');await click('[data-hero="4"]');
 await click('#dungeons');await shot('dungeon-select');await click('[data-difficulty="easy"]');await click('#dungeon-done');
 await click('#launch');await click('#help-done');await page.clock.runFor(4000);
 // Run the real first-room timer. Invulnerability avoids unattended random death.
 await page.evaluate(()=>{__flow.game.player.invincible=999;});await page.clock.runFor(28000);
 assert.equal((await state()).phase,'quiz');await shot('vocabulary-quiz');await answer();await click('#reward-life');await page.clock.runFor(3000);assert.equal((await state()).room,1);
 checks.push('Real room timer to vocabulary quiz to recovery to room 2');
 await page.evaluate(()=>{__flow.game.player.invincible=999;});await page.clock.runFor(17500);await shot('sentinel-battle');
 assert.ok(await page.evaluate(()=>__flow.game.enemies.some(e=>e.miniboss)));
 await page.evaluate(()=>{const g=__flow.game;for(const e of [...g.enemies])if(e.miniboss)g.damage(e,1e6,e.x,e.y);g.time=g.stage.duration;});await page.clock.runFor(4000);
 assert.equal((await state()).phase,'quiz');await shot('collocation-quiz');await answer(false);await page.clock.runFor(3000);assert.equal((await state()).room,2);
 checks.push('Sentinel gate and collocation wrong-answer continuation without blessing');
 await page.evaluate(()=>{const g=__flow.game;g.spawnBoss();g.player.invincible=999;});await page.clock.runFor(3500);
 await page.evaluate(()=>{const g=__flow.game;g.damage(g.boss,1e6,g.boss.x,g.boss.y);});await page.clock.runFor(4000);
 assert.equal((await state()).phase,'quiz');await answer();assert.equal((await state()).phase,'victory');assert.equal(await page.evaluate(()=>__flow.profile.tickets.length),1);await shot('dungeon-reward');
 await click('#sortie-return');await click('#equipment');await shot('artifact-collection');await click('#draw-ticket');await shot('artifact-draw');assert.equal(await page.evaluate(()=>__flow.profile.tickets.length),0);await click('#reveal-done');await click('#equipment-done');
 checks.push('First clear ticket and single-use artifact draw');
 await page.reload();await page.waitForFunction(()=>astralDiagnostics?.ready);assert.equal(await page.evaluate(()=>Object.keys(__flow.profile.claims).length),1);assert.equal(await page.evaluate(()=>__flow.profile.learning.mistakes.length),1);
 await click('#launch');await page.clock.runFor(4000);await page.evaluate(()=>{const g=__flow.game;g.player.lives=1;g.player.invincible=0;g.hitPlayer();});await click('#revive-quiz');await answer();await page.clock.runFor(100);assert.equal((await state()).reviveUsed,true);
 await page.evaluate(()=>{const g=__flow.game;g.player.lives=1;g.player.invincible=0;g.hitPlayer();});assert.equal(await page.locator('#revive-quiz').count(),0);assert.ok(await page.locator('#again').isVisible());
 checks.push('Reload retains claim and mistakes; exactly one grammar revival');
 await page.clock.setSystemTime(new Date(2026,8,15,12));await click('#again');assert.ok(await page.locator('#quiz-accept').isVisible());await answer(false);
 assert.ok(await page.locator('#launch').isVisible());assert.equal((await state()).phase,'sortie');checks.push('Expired daily unlock and failed retry quiz return safely to sortie');
 await click('#library');await click('[data-tab="mistakes"]');assert.ok((await page.locator('#library-list').textContent()).includes('2개'));await click('#practice');await answer();await click('#practice');await answer();assert.equal(await page.evaluate(()=>__flow.profile.learning.mistakes.length),0);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,errors},null,2));await fs.writeFile(new URL('artifacts/flow.json',root),JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
