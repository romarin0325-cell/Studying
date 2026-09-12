import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {HEROES} from '../content.js';
import {LIBRARY} from '../learning.js';
const root=new URL('../',import.meta.url),original=await fs.readFile(new URL('dist/AstralBloom.html',root),'utf8');
const html=original.replace("Object.defineProperty(globalThis, 'astralDiagnostics'", "globalThis.__patch={get game(){return game},get profile(){return profile},get art(){return art},get renderer(){return renderer}};\nObject.defineProperty(globalThis, 'astralDiagnostics'");
assert.notEqual(html,original);await fs.mkdir(new URL('artifacts/',root),{recursive:true});
const file=new URL('artifacts/patch-offline.html',root);await fs.writeFile(file,html);
const browser=await chromium.launch({headless:true}),errors=[],checks=[];
try{
 // Help must describe the unresolved random selection in both entry points.
 const helpContext=await browser.newContext({viewport:{width:390,height:844},offline:true});
 const helpPage=await helpContext.newPage();helpPage.on('pageerror',e=>errors.push(e.message));
 await helpPage.goto(file.href);await helpPage.waitForFunction(()=>astralDiagnostics?.ready);
 await helpPage.locator('#random-hero').click();await helpPage.locator('#launch').click();
 const helpText=()=>helpPage.locator('.help-list').innerText();
 assert.match(await helpText(),/랜덤으로 만나는 수호자/);
 assert.ok(!(await helpText()).includes(HEROES[0].bomb));
 assert.equal(await helpPage.locator('#help-done').textContent(),'수호자 만나기');
 await helpPage.locator('#help-done').click();
 const drawnHero=await helpPage.evaluate(()=>astralDiagnostics.hero);
 assert.ok((await helpPage.locator('.tiny-note').innerText()).includes(HEROES[drawnHero].bombInfo));
 await helpPage.locator('#random-cancel').click();await helpPage.locator('#help').click();
 assert.match(await helpText(),/랜덤으로 만나는 수호자/);
 assert.ok(!(await helpText()).includes(HEROES[drawnHero].bomb));
 await helpPage.locator('#help-done').click();
 // Fix the weekday so Rumi is available without a quiz.
 await helpPage.clock.install({time:new Date(2026,8,14,12)});
 await helpPage.locator('[data-hero="0"]').click();await helpPage.locator('#help').click();
 assert.ok((await helpText()).includes(HEROES[0].bomb));
 assert.ok((await helpText()).includes(HEROES[0].bombInfo));
 assert.doesNotMatch(await helpText(),/랜덤으로 만나는 수호자/);
 await helpContext.close();checks.push('Random first-flight and lobby help stay generic; reveal and normal help show the actual ultimate');
 const context=await browser.newContext({viewport:{width:390,height:844},offline:true});const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date(2026,8,14,12)});
 await page.goto(file.href);await page.waitForFunction(()=>astralDiagnostics?.ready);
 const click=s=>page.locator(s).click(),state=()=>page.evaluate(()=>astralDiagnostics);
 const shot=name=>page.screenshot({path:fileURLToPath(new URL(`artifacts/${name}.png`,root))});
 for(const h of [5,7,8])assert.equal(await page.locator(`[data-hero="${h}"]`).count(),0);
 await click('#fullscreen');await page.waitForFunction(()=>!!document.fullscreenElement);await click('#fullscreen');await page.waitForFunction(()=>!document.fullscreenElement);
 await click('[data-hero="6"]');assert.ok(await page.locator('#quiz-accept').isVisible());await click('#quiz-decline');assert.equal((await state()).hero,0);assert.ok(await page.locator('#launch').isVisible());
 checks.push('Fullscreen toggles and locked hero decline leaves selection unchanged');
 await click('#library');await page.locator('#library-search').fill('amenities');await click('#library-all');
 assert.equal(await page.locator('#library-search').inputValue(),'');assert.equal(await page.locator('#library-page').textContent(),`1 / ${Math.ceil(LIBRARY.vocab.length/30)}`);
 let viewed=0;
 do { viewed+=await page.locator('#library-list .library-entry').count();if(await page.locator('#library-next').isDisabled())break;await click('#library-next'); } while(true);
 assert.equal(viewed,LIBRARY.vocab.length);
 await page.evaluate(()=>{__patch.profile.learning.mistakes=[{id:'vocab:0',kind:'vocab',prompt:'first',answer:'첫째',options:['첫째','둘째']},{id:'vocab:1',kind:'vocab',prompt:'second',answer:'둘째',options:['첫째','둘째']}];});
 await click('[data-tab="mistakes"]');await page.locator('[data-delete]').first().click();assert.equal(await page.evaluate(()=>__patch.profile.learning.mistakes.length),1);
 await click('#mistakes-reset');await click('#reset-cancel');assert.equal(await page.evaluate(()=>__patch.profile.learning.mistakes.length),1);
 await click('#mistakes-reset');await click('#reset-confirm');assert.equal(await page.locator('[data-delete]').count(),0);assert.ok(await page.locator('#practice').isDisabled());await click('#library-close');
 await page.reload();await page.waitForFunction(()=>astralDiagnostics?.ready);assert.equal(await page.evaluate(()=>__patch.profile.learning.mistakes.length),0);
 checks.push(`All ${viewed} vocabulary entries reachable; delete, reset cancellation and persisted reset work`);
 await click('#launch');await click('#help-done');await page.clock.runFor(2800);
 const total=await page.evaluate(()=>__patch.profile.learning.total);
 await page.evaluate(()=>{const g=__patch.game;g.phase='quiz';g.emit('quiz',{kind:'vocab'});});await shot('quiz-consent');await click('#quiz-decline');assert.equal((await state()).room,1);assert.equal(await page.evaluate(()=>__patch.profile.learning.total),total);
 await page.evaluate(()=>{const g=__patch.game;g.room=2;g.phase='quiz';g.emit('quiz',{kind:'grammar'});});await click('#quiz-decline');assert.equal((await state()).phase,'victory');assert.ok(await page.locator('#again').isVisible());await click('#sortie-return');
 checks.push('Declining stage quizzes records no answer, advances rooms and completes final result');
 // Force only the two character draws in this test; production randomness is restored immediately.
 for(const [index,h] of [5,7,8].entries()){
   await click('#random-hero');
   await page.evaluate(index=>{const real=Math.random,values=[.1,(index+.5)/3];Math.random=()=>{const value=values.shift();if(!values.length)Math.random=real;return value;};},index);
   await click('#launch');assert.equal((await state()).hero,h);assert.equal(await page.locator('[data-random-weapon]').count(),2);await shot(`hidden-${h}-selection`);
   await click('[data-random-weapon="1"]');await click('#random-launch');assert.equal((await state()).weapon,1);await page.clock.runFor(3000);
   await page.evaluate(()=>{const g=__patch.game;g.player.invincible=999;g.player.x=g.player.targetX=225;g.player.y=g.player.targetY=430;g.spawnEnemy(225,300,{hp:100000,r:38,speed:0,fire:999,image:0});g.power=3;});
   await page.clock.runFor(1200);assert.ok((await state()).stats.damage>0);await shot(`hidden-${h}-battle`);
   await click('#bomb');await page.clock.runFor(320);await shot(`hidden-${h}-bloom`);
   if(h===8){assert.ok(await page.evaluate(()=>__patch.game.shots.some(s=>s.type==='darkglass')));await page.clock.runFor(10200);assert.equal(await page.evaluate(()=>__patch.game.bombTime),0);}
   await click('#pause');await click('#return');
 }
 checks.push('All hidden heroes depart only via random, fight, use ultimates and time transformation expires');
 // Screenshot the actual decoded game textures, not the source atlas preview.
 await page.setViewportSize({width:1200,height:860});
 await page.evaluate(names=>{
   const art=__patch.art;
   document.body.innerHTML='<main id="cast" style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;padding:16px;background:#14233c;color:#fff;font:16px sans-serif"></main>';
   document.documentElement.style.overflow='auto';document.body.style.overflow='auto';
   const entries=[...art.urls.heroes,art.dark.toDataURL('image/png')];
   entries.forEach((src,i)=>{const el=document.createElement('section');el.style='text-align:center;height:380px';el.innerHTML=`<h3>${names[i]||'다크신데렐라'}</h3><img src="${src}" style="width:${i===7?235:200}px;height:300px;object-fit:contain"><div>게임 코어 ${i===4||i===6?4:i===2||i===7?6:5}px</div>`;document.getElementById('cast').append(el);});
 },HEROES.map(h=>h.name));
 await page.locator('#cast img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));await shot('cast-comparison');
 assert.deepEqual(errors,[]);await fs.writeFile(new URL('artifacts/patch-flow.json',root),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
