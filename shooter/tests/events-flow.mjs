import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {weeklyEvent} from '../meta.js';
const root=new URL('../',import.meta.url),original=await fs.readFile(new URL('dist/AstralBloom.html',root),'utf8');
const html=original.replace("Object.defineProperty(globalThis, 'astralDiagnostics'","globalThis.__events={get game(){return game},get art(){return art},get renderer(){return renderer},profile,saved,save,showSortie,finish,weeklyEvent,BOSS_PRESENTATION,STAGES};\nObject.defineProperty(globalThis, 'astralDiagnostics'");
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
    const before=await page.evaluate(()=>__events.profile.tickets.length);await click('#launch');
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
  // Production-scale contact sheet: scaling and offsets are exactly those used by Renderer.draw.
  const png=await page.evaluate(()=>{
    const {art,BOSS_PRESENTATION,STAGES}=__events,c=document.createElement('canvas');c.width=1800;c.height=1000;const x=c.getContext('2d');x.fillStyle='#15243c';x.fillRect(0,0,c.width,c.height);
    for(let i=0;i<12;i++){
      const col=i%6,row=Math.floor(i/6),cx=col*300+150,cy=row*500+150,p=BOSS_PRESENTATION[i],size=p.size*1.2;
      x.strokeStyle='#7ca5c333';x.beginPath();x.moveTo(col*300,row*500+100);x.lineTo(col*300+300,row*500+100);x.stroke();
      x.drawImage(art.bosses[i],cx-size/2,cy+p.offsetY*1.2-size/2,size,size);
      x.font='17px sans-serif';x.textAlign='center';x.fillStyle='#e6efff';x.fillText(STAGES[i].boss,cx,row*500+410);x.font='13px sans-serif';x.fillStyle='#acbed5';x.fillText(`${i<6?'기존 기준':'새 에셋'} · ${p.size}px`,cx,row*500+438);
      // Enlarged face/hand inspection belongs to source review, not this overview.
    }
    return c.toDataURL('image/png').split(',')[1];
  });
  await fs.writeFile(new URL('artifacts/boss-style-comparison.png',root),Buffer.from(png,'base64'));
  const relic=await page.evaluate(()=>__events.art.urls.relics[34].split(',')[1]);await fs.writeFile(new URL('artifacts/miracle-centered.png',root),Buffer.from(relic,'base64'));
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);checks.push('Weekly rollover, persisted rewards, centered random sigil, twelve-boss production-scale comparison and miracle crop captured offline');
  await fs.writeFile(new URL('artifacts/events-flow.json',root),JSON.stringify({checks,errors,network},null,2));console.log(JSON.stringify({checks,errors,network},null,2));
} finally {await browser.close();}
