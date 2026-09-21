import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {weeklyEvent} from '../meta.js';
const root=new URL('../',import.meta.url),original=await fs.readFile(new URL('dist/AstralBloom.html',root),'utf8');
const html=original.replace('<head>',`<head><base href="${new URL('dist/',root).href}">`).replace("Object.defineProperty(globalThis, 'astralDiagnostics'","globalThis.__events={get game(){return game},get art(){return art},get renderer(){return renderer},profile,saved,save,showSortie,finish,weeklyEvent,BOSS_PRESENTATION,STAGES};\nObject.defineProperty(globalThis, 'astralDiagnostics'");
assert.notEqual(html,original);await fs.mkdir(new URL('artifacts/',root),{recursive:true});
const file=new URL('artifacts/events-offline.html',root);await fs.writeFile(file,html);
const browser=await chromium.launch({headless:true}),errors=[],network=[],checks=[];
try {
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,offline:true});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
  await page.clock.install({time:new Date(2026,8,21,12)});await page.goto(file.href);await page.waitForFunction(()=>astralDiagnostics?.ready);
  const click=s=>page.locator(s).click(),shot=name=>page.screenshot({path:fileURLToPath(new URL(`artifacts/events-${name}.png`,root))});
  await page.evaluate(()=>{__events.saved.tutorial=true;__events.save();});
  // Reveal all five weekly cards using separate actual calendar weeks, not a test-only selector.
  const dates=new Map();for(let w=0;dates.size<5&&w<104;w++){const date=new Date(2026,8,21+w*7,12);dates.set(weeklyEvent(date).id,date.getTime());}
  assert.equal(dates.size,5);
  for(const [id,time] of dates){
    await page.clock.setSystemTime(new Date(time));
    await page.evaluate(()=>{const d=new Date(),key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;for(const h of [0,1,2,3,4,6])__events.profile.unlocks[h]=key;__events.showSortie();});
    await click('#dungeons');assert.equal(await page.locator('.dungeon-card').count(),8);assert.equal(await page.locator('.event-card').count(),1);
    const card=page.locator('.event-card');assert.equal(await card.getAttribute('data-dungeon'),String(id));assert.match(await card.innerText(),new RegExp(weeklyEvent(new Date(time)).name));
    await click(`[data-dungeon="${id}"]`);await click('[data-difficulty="hard"]');await shot(`menu-${id}`);await click('#dungeon-done');
    assert.match(await page.locator('#dungeons').innerText(),new RegExp(weeklyEvent(new Date(time)).name));
    const before=await page.evaluate(()=>__events.profile.tickets.length);await click('#launch');await page.waitForFunction(()=>__events.game?.phase==='wave');
    for(let room=0;room<3;room++){
      assert.deepEqual(await page.evaluate(()=>[__events.game.stageIndex,__events.game.room]),[id,room]);
      await page.evaluate(()=>{const g=__events.game;g.player.fire=999;g.player.invincible=999;g.phase='wave';if(g.room===2){g.spawnBoss();g.phase='boss';g.boss.y=155;}else g.clearRoom();});
      if(room===2){
        for(let phase=0;phase<3;phase++){
          await page.evaluate(phase=>{const g=__events.game;g.boss.hp=g.boss.maxHp*[1,.6,.3][phase];g.bossPattern=-1;},phase);
          await page.clock.runFor(2100);await shot(`boss-${id}-${phase}`);
        }
        await page.evaluate(()=>{const g=__events.game;g.damage(g.boss,1e9,g.boss.x,g.boss.y);});
      }
      await page.clock.runFor(3600);await click('#quiz-decline');
    }
    assert.equal(await page.evaluate(()=>__events.game.phase),'victory');assert.equal(await page.evaluate(()=>__events.profile.tickets.length),before+2);
    assert.match(await page.locator('.panel').innerText(),/이번 주 첫 클리어/);
    await page.evaluate(()=>__events.finish(true));assert.equal(await page.evaluate(()=>__events.profile.tickets.length),before+2);
    await click('#again');assert.deepEqual(await page.evaluate(()=>[__events.game.stageIndex,__events.game.room]),[id,0]);
    await page.evaluate(()=>{const g=__events.game;g.startStage(g.stageIndex,2);g.phase='quiz';g.completeQuiz();});
    assert.equal(await page.evaluate(()=>__events.profile.tickets.length),before+2);assert.match(await page.locator('.panel').innerText(),/이미 받았어요/);
    await click('#sortie-return');checks.push(`${weeklyEvent(new Date(time)).name}: three rooms, three boss phases, hard weekly reward and no duplicate on replay`);
  }
  // Selection follows a weekly rollover even when the lobby was left open overnight.
  await click('#dungeons');await click('.event-card');await click('#dungeon-done');
  const current=await page.evaluate(()=>__events.weeklyEvent().id);
  let nextDate=new Date(await page.evaluate(()=>Date.now()));do{nextDate.setDate(nextDate.getDate()+7);}while(weeklyEvent(nextDate).id===current);
  await page.clock.setSystemTime(nextDate);await click('#dungeons');assert.equal(await page.locator('.event-card').getAttribute('data-dungeon'),String(weeklyEvent(nextDate).id));await click('#dungeon-done');
  // Verify persisted category rewards survive a reload of the release file.
  const tickets=await page.evaluate(()=>__events.profile.tickets.length);await page.reload();await page.waitForFunction(()=>astralDiagnostics?.ready);assert.equal(await page.evaluate(()=>__events.profile.tickets.length),tickets);
  await page.locator('#random-hero').scrollIntoViewIfNeeded();
  const sigil=await page.locator('.random-sigil').evaluate(el=>{const a=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();return {center:a.top+a.height/2,expected:p.top+(p.height-20)/2};});assert.ok(Math.abs(sigil.center-sigil.expected)<4);await shot('random-sigil');
  // Production-scale contact sheet: native images avoid a file:// canvas export while preserving Renderer.draw scales and offsets.
  await page.evaluate(()=>{const {art,BOSS_PRESENTATION,STAGES}=__events;document.body.innerHTML='<main id="boss-style-comparison" style="display:grid;grid-template-columns:repeat(6,300px);grid-template-rows:repeat(2,500px);width:1800px;background:#15243c;color:#e6efff;font:17px sans-serif"></main>';for(let i=0;i<12;i++){const p=BOSS_PRESENTATION[i],cell=document.createElement('section');cell.style='position:relative;border-top:1px solid #7ca5c333;text-align:center';cell.innerHTML=`<img src="${art.urls.bosses[i]}" style="position:absolute;top:${100+p.offsetY*1.2}px;left:${150-p.size*.6}px;width:${p.size*1.2}px;height:${p.size*1.2}px;object-fit:contain"><b style="position:absolute;top:410px;left:0;width:100%">${STAGES[i].boss}</b><small style="position:absolute;top:438px;left:0;width:100%;color:#acbed5">${i<6?'기존 기준':'새 에셋'} · ${p.size}px</small>`;document.querySelector('#boss-style-comparison').append(cell);}});
  await page.setViewportSize({width:1800,height:1000});await page.locator('#boss-style-comparison img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));await page.screenshot({path:fileURLToPath(new URL('artifacts/boss-style-comparison.png',root))});
  const relic=await page.evaluate(()=>__events.art.urls.relics[34]);await fs.copyFile(new URL(relic,new URL('dist/',root)),new URL('artifacts/miracle-centered.webp',root));
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);checks.push('Weekly rollover, persisted rewards, centered random sigil, twelve-boss production-scale comparison and miracle crop captured offline');
  await fs.writeFile(new URL('artifacts/events-flow.json',root),JSON.stringify({checks,errors,network},null,2));console.log(JSON.stringify({checks,errors,network},null,2));
} finally {await browser.close();}
