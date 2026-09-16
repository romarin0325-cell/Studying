import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=new URL('../',import.meta.url),original=await fs.readFile(new URL('dist/AstralBloom.html',root),'utf8');
const html=original.replace("Object.defineProperty(globalThis, 'astralDiagnostics'","globalThis.__challenge={get game(){return game},get menus(){return menus},get art(){return art},get renderer(){return renderer},profile,saved,save,makeQuestion};\nObject.defineProperty(globalThis, 'astralDiagnostics'");
assert.notEqual(html,original);await fs.mkdir(new URL('artifacts/',root),{recursive:true});
const file=new URL('artifacts/challenge-offline.html',root);await fs.writeFile(file,html);
const browser=await chromium.launch({headless:true}),errors=[],network=[],checks=[];
try {
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,offline:true}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
  await page.clock.install({time:new Date(2026,8,13,12)});await page.goto(file.href);await page.waitForFunction(()=>astralDiagnostics?.ready);
  const click=s=>page.locator(s).click(),shot=name=>page.screenshot({path:fileURLToPath(new URL(`artifacts/challenge-${name}.png`,root))});
  await page.evaluate(()=>{
    const {menus,makeQuestion}=__challenge,quiz=menus.quiz.bind(menus);
    menus.quiz=(kind,title,done)=>{const q=makeQuestion(kind);__challenge.question=q;quiz(kind,title,done,q);};
    __challenge.profile.owned.push('mask','dream','holy');__challenge.profile.equipped=['mask','dream','holy'];__challenge.save();
  });
  const answer=async()=>{
    if(await page.locator('#quiz-now').count())await click('#quiz-now');
    const index=await page.evaluate(()=>__challenge.question.options.indexOf(__challenge.question.answer));
    await click(`[data-answer="${index}"]`);await click('#quiz-continue');
  };
  for(const viewport of [{width:320,height:568},{width:390,height:844},{width:430,height:932},{width:844,height:390}]) {
    await page.setViewportSize(viewport);await click('#fullscreen');await page.waitForFunction(()=>!!document.fullscreenElement);
    await click('#achievements');
    const rows=await page.locator('.achievement').evaluateAll(rows=>rows.map(row=>({height:row.getBoundingClientRect().height,overflow:row.scrollHeight>row.clientHeight+1})));
    assert.equal(new Set(rows.map(r=>r.height)).size,1);assert.ok(rows.every(r=>!r.overflow));await shot(`achievements-${viewport.width}`);await click('#achievements-close');
    await click('#dungeons');assert.equal(await page.locator('[data-dungeon]').count(),6);
    const offsets=await page.locator('.dungeon-card').evaluateAll(rows=>rows.map(row=>{const top=row.getBoundingClientRect().top;return [...row.children].map(el=>Math.round(el.getBoundingClientRect().top-top));}));
    assert.ok(offsets.every(row=>JSON.stringify(row)===JSON.stringify(offsets[0])));
    await click('[data-dungeon="0"]');const before=await page.locator('#dungeon-done').boundingBox();
    await click('[data-dungeon="5"]');const after=await page.locator('#dungeon-done').boundingBox();assert.equal(before.y,after.y);
    const bottom=await page.locator('#challenge-mode').boundingBox();const challengeBg=await page.locator('#challenge-mode').evaluate(el=>getComputedStyle(el).backgroundImage);assert.ok(challengeBg.includes('data:image'));await shot('geometry-'+viewport.width);assert.ok(bottom.y>=0&&bottom.y+bottom.height<=viewport.height,JSON.stringify({viewport,bottom}));
    await shot(`dungeons-${viewport.width}`);await click('#dungeon-done');await click('#fullscreen');await page.waitForFunction(()=>!document.fullscreenElement);
  }
  checks.push('Fullscreen achievements and all six dungeon cards align at four mobile/landscape sizes; Chaos text does not shift actions');
  await page.setViewportSize({width:390,height:844});await click('#dungeons');await click('#challenge-mode');await click('#challenge-done');
  assert.match(await page.locator('#dungeons').innerText(),/챌린지[\s\S]*천계의 계단/);assert.ok((await page.locator('#dungeons').evaluate(el=>getComputedStyle(el).backgroundImage)).includes('data:image'));await shot('challenge-lobby');
  await click('#launch');if(await page.locator('#help-done').count())await click('#help-done');
  await page.clock.runFor(2700);assert.equal(await page.evaluate(()=>__challenge.game.challenge),true);
  const profileBefore=await page.evaluate(()=>JSON.stringify({owned:__challenge.profile.owned,equipped:__challenge.profile.equipped,claims:__challenge.profile.claims,tickets:__challenge.profile.tickets,clears:__challenge.profile.clears,best:__challenge.saved.best}));
  await click('#run-artifacts');assert.equal(await page.locator('.run-artifact').count(),3);await click('#run-artifacts-back');
  await page.evaluate(()=>{__challenge.game.maskUses=3;__challenge.game.reviveUsed=true;});
  for(let i=0;i<21;i++) {
    const state=await page.evaluate(()=>{const g=__challenge.game;return [g.stageIndex,g.room,g.maskUses,g.reviveUsed];});
    assert.deepEqual(state,[Math.floor(i/3),i%3,3,true]);
    await page.evaluate(()=>{const g=__challenge.game;g.player.invincible=999;g.phase='wave';if(g.room===2){g.spawnBoss();g.phase='boss';g.boss.y=160;g.damage(g.boss,1e9,225,160);}else g.clearRoom();});
    await page.clock.runFor(3600);
    if(i%3!==2){await click('#quiz-decline');continue;}
    await click('#quiz-accept');await answer();
    if(i<20) {
      const ids=await page.locator('[data-challenge-artifact]').evaluateAll(rows=>rows.map(r=>r.dataset.challengeArtifact));assert.equal(ids.length,3);assert.equal(new Set(ids).size,3);
      await click('#choice-equipped');await click('#run-artifacts-back');
      assert.deepEqual(await page.locator('[data-challenge-artifact]').evaluateAll(rows=>rows.map(r=>r.dataset.challengeArtifact)),ids);
      if(i===2)await shot('relic-choice');await click(`[data-challenge-artifact="${ids[0]}"]`);
    }
  }
  assert.equal(await page.evaluate(()=>__challenge.game.artifacts.size),9);assert.equal(await page.evaluate(()=>__challenge.game.phase),'victory');
  const profileAfter=await page.evaluate(()=>JSON.stringify({owned:__challenge.profile.owned,equipped:__challenge.profile.equipped,claims:__challenge.profile.claims,tickets:__challenge.profile.tickets,clears:__challenge.profile.clears,best:__challenge.saved.best}));
  assert.equal(profileAfter,profileBefore);await shot('victory');
  await click('#result-artifacts');assert.equal(await page.locator('.run-artifact').count(),9);await click('#run-artifacts-back');await click('#again');
  assert.deepEqual(await page.evaluate(()=>{const g=__challenge.game;return [g.stageIndex,g.room,g.artifacts.size,g.maskUses,g.reviveUsed];}),[0,0,3,0,false]);
  checks.push('All 21 real clear/quiz screens progress, six optional boss quizzes award unique choices, nine run artifacts stay out of profile rewards and restart resets the run');
  await page.evaluate(()=>{const g=__challenge.game;g.startStage(6,2);g.spawnBoss();g.phase='boss';g.boss.y=150;g.player.invincible=999;g.player.fire=999;});
  for(const [phase,hp] of [[0,1],[1,.6],[2,.3]]) {
    await page.evaluate(hp=>{const g=__challenge.game;g.boss.hp=g.boss.maxHp*hp;g.bossPattern=-1;},hp);await page.clock.runFor(1700);await shot(`astea-${phase}`);
  }
  assert.equal(await page.evaluate(()=>__challenge.art.bosses.length),7);assert.equal(await page.evaluate(()=>__challenge.art.urls.relics.length),42);
  // Check decoded sprite bounds; style and head/body proportions require visual review.
  const bounds=await page.evaluate(()=>__challenge.art.bosses.map(canvas=>{const c=canvas.getContext('2d'),d=c.getImageData(0,0,canvas.width,canvas.height).data;let x0=canvas.width,y0=canvas.height,x1=0,y1=0;for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(d[(y*canvas.width+x)*4+3]>30){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}return {w:x1-x0+1,h:y1-y0+1};}));
  assert.ok(bounds.every(b=>b.w>0&&b.w<=384&&b.h>0&&b.h<=384));
  await page.evaluate(()=>{const art=__challenge.art;document.body.innerHTML='<main id="comparison" style="display:flex;background:#14233c"></main>';for(let i=0;i<art.bosses.length;i++){const img=new Image();img.src=art.urls.bosses[i];img.style='width:180px;height:180px';document.querySelector('#comparison').append(img);}});
  await page.setViewportSize({width:1260,height:180});await page.locator('#comparison img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));await shot('boss-comparison');
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);checks.push({art:'All seven boss sprites decode within the 384px cell; comparison captured at equal display size for visual review',bounds});checks.push('Astea and all three patterns render offline without network requests or page errors');
  await fs.writeFile(new URL('artifacts/challenge-flow.json',root),JSON.stringify({checks,errors,network},null,2));console.log(JSON.stringify({checks,errors,network},null,2));
} finally {await browser.close();}
