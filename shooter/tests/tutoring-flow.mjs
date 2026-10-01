import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { makeQuestion } from '../learning.js';

const root=new URL('../',import.meta.url),output=new URL('artifacts/tutoring/',root),file=new URL('flow.html',output);
await fs.mkdir(output,{recursive:true});
const original=await fs.readFile(new URL('dist/AstralBloom.html',root),'utf8');
const harness=original.replace("Object.defineProperty(globalThis, 'astralDiagnostics'","globalThis.__tutorFlow={profile,save,get menus(){return menus}};\nObject.defineProperty(globalThis, 'astralDiagnostics'");
assert.notEqual(harness,original);await fs.writeFile(file,harness);
const grammar=makeQuestion('grammar',()=>0);grammar.lectureId=grammar.lecture.id;delete grammar.lecture;
const vocab=makeQuestion('vocab',()=>.5);
const mistake={...grammar,selectedAnswer:grammar.options.find(o=>o!==grammar.answer)};
const browser=await chromium.launch({headless:true}),errors=[],checks=[],viewports=[];
const success='### 핵심 단서\n형아, 문장 속 **주어와 동사**를 먼저 봐.\n### 정답과 오답의 차이\n정답의 근거를 나란히 비교하면 기억하기 쉬워.\n### 기억할 한 가지\n주어의 수와 동사의 형태를 같이 확인해.\n### 짧은 예문\nHe studies every day.\n<img src=x onerror="window.__injected=true">';
try {
  async function setup({width=390,height=844,key='',offline=false,empty=false}={}) {
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,hasTouch:true,reducedMotion:'reduce',offline,timezoneId:'Asia/Tokyo'});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.clock.install({time:new Date('2026-10-02T12:00:00+09:00')});
    await page.addInitScript(({mistakes,key})=>{
      localStorage.setItem('astral-bloom-v1',JSON.stringify({campaign:{version:8,dreamShards:7,learning:{mistakes,read:[],correct:0,total:0}}}));
      if(key)localStorage.setItem('astral-bloom-tutor-key',key);else localStorage.removeItem('astral-bloom-tutor-key');
    },{mistakes:empty?[]:[mistake,vocab],key});
    await page.goto(file.href);await page.waitForFunction(()=>astralDiagnostics?.ready);
    return {context,page};
  }
  const shards=page=>page.evaluate(()=>__tutorFlow.profile.dreamShards);
  const enter=async page=>{await page.locator('#library').click();await page.locator('#library-tutor').click();};
  const geometry=page=>page.evaluate(()=>{
    const panel=document.querySelector('.panel'),r=panel.getBoundingClientRect();
    return {scroll:document.documentElement.scrollWidth,width:innerWidth,left:r.left,right:r.right,bottom:r.bottom,height:innerHeight,
      contentOverflow:[...panel.querySelectorAll('.tutor-reading,.tutor-key-form')].some(el=>el.scrollWidth>el.clientWidth+1)};
  });
  for(const [width,height] of [[320,568],[390,844],[430,932],[844,390]]) {
    const {context,page}=await setup({width,height});const calls=[];page.on('request',r=>{if(/^https?:/.test(r.url()))calls.push(r.url());});
    await page.locator('#library').click();await page.screenshot({path:fileURLToPath(new URL(`library-${width}.png`,output))});
    assert.deepEqual(calls,[]);await page.locator('#library-tutor').click();
    assert.equal(await page.locator('#tutor-api-key').getAttribute('type'),'password');assert.equal(await shards(page),7);
    let g=await geometry(page);assert.equal(g.scroll,g.width);assert.ok(g.bottom<=g.height+1);assert.equal(g.contentOverflow,false);
    await page.screenshot({path:fileURLToPath(new URL(`connect-${width}.png`,output))});
    await page.locator('#tutor-basic').click();assert.equal(await shards(page),8);assert.match(await page.locator('#tutor-reward').innerText(),/\+1/);
    assert.equal(await page.locator('#tutor-api-key').count(),0);assert.ok((await page.locator('#tutor-lesson').innerText()).length>100);
    g=await geometry(page);assert.equal(g.scroll,g.width);assert.ok(g.left>=0&&g.right<=g.width+1&&g.bottom<=g.height+1);assert.equal(g.contentOverflow,false);
    assert.equal(await page.locator('#tutor-next').isVisible(),true);assert.equal(await page.locator('#tutor-close').isVisible(),true);
    assert.equal(await page.evaluate(()=>{const caption=document.querySelector('.tutor-mentor-caption').getBoundingClientRect(),mentor=document.querySelector('.tutor-mentor').getBoundingClientRect();return caption.bottom<=mentor.bottom+1;}),true,'Mentor caption must not be clipped');
    await page.screenshot({path:fileURLToPath(new URL(`lesson-${width}.png`,output))});viewports.push({width,height,geometry:g});
    await page.locator('#tutor-next').click();await page.locator('#tutor-basic').click();assert.equal(await shards(page),8);
    await page.locator('#tutor-close').click();await page.locator('#library-close').click();assert.match(await page.locator('#shop small').innerText(),/8/);
    assert.deepEqual(calls,[]);await context.close();
  }
  checks.push('Four mobile/landscape layouts: masked key popup only on entry, offline lessons, daily shard, and refreshed shop balance');
  {
    const {context,page}=await setup({empty:true});await page.locator('#library').click();assert.equal(await page.locator('#library-tutor').isDisabled(),true);assert.equal(await shards(page),7);assert.equal(await page.locator('#tutor-api-key').count(),0);await context.close();
  }
  checks.push('No mistakes: disabled private lesson and no reward or key popup');
  {
    const {context,page}=await setup();let calls=0;
    await page.route('https://generativelanguage.googleapis.com/**',async route=>{calls++;assert.equal(route.request().headers()['x-goog-api-key'],'test-entered-key');await route.fulfill({json:{candidates:[{content:{parts:[{text:success}]}}]}});});
    await enter(page);await page.locator('#tutor-api-key').fill('test-entered-key');await page.locator('#tutor-key-reveal').click();assert.equal(await page.locator('#tutor-api-key').getAttribute('type'),'text');await page.locator('#tutor-key-reveal').click();
    await page.locator('#tutor-key-remember').check();await page.locator('#tutor-key-form button[type="submit"]').click();await page.waitForFunction(()=>document.querySelector('#tutor-source')?.textContent.includes('AI 과외'));
    assert.equal(calls,1);assert.equal(await shards(page),8);assert.equal(await page.evaluate(()=>localStorage.getItem('astral-bloom-tutor-key')),'test-entered-key');
    assert.ok(!(await page.evaluate(()=>localStorage.getItem('astral-bloom-v1'))).includes('test-entered-key'));
    await page.locator('#tutor-connection').click();assert.equal(await page.evaluate(()=>localStorage.getItem('astral-bloom-tutor-key')),null);assert.equal(await page.locator('#tutor-api-key').count(),0);await context.close();
  }
  checks.push('Key popup submits a real mocked request, masking and opt-in memory work, key is excluded from the campaign and disconnect removes it');
  {
    const {context,page}=await setup({key:'test-key'});let calls=0;
    await page.route('https://generativelanguage.googleapis.com/**',async route=>{calls++;await route.fulfill({json:{candidates:[{content:{parts:[{thought:true,text:'PRIVATE THOUGHT'},{text:success}]}}]}});});
    await enter(page);await page.waitForFunction(()=>document.querySelector('#tutor-source')?.textContent.includes('AI 과외'));
    assert.equal(await page.locator('#tutor-api-key').count(),0);assert.equal(await shards(page),8);assert.equal(await page.locator('#tutor-lesson img').count(),0);assert.equal(await page.evaluate(()=>window.__injected),undefined);assert.ok(!(await page.locator('#tutor-lesson').innerText()).includes('PRIVATE THOUGHT'));
    await page.screenshot({path:fileURLToPath(new URL('ai-lesson-390.png',output))});
    await page.locator('#tutor-retry').click();await page.waitForFunction(()=>document.querySelector('#tutor-source')?.textContent.includes('저장된'));assert.equal(calls,1);
    await page.locator('[data-tutor-model="gemini-2.5-pro"]').click();await page.waitForFunction(()=>document.querySelector('#tutor-source')?.textContent.includes('Pro'));assert.equal(calls,2);assert.equal(await shards(page),8);
    await page.locator('#tutor-close').click();
    // Remove the init script by opening a fresh page in the same storage context.
    const next=await context.newPage();next.on('pageerror',e=>errors.push(e.message));
    await next.clock.install({time:new Date('2026-10-02T12:00:00+09:00')});await next.goto(file.href);await next.waitForFunction(()=>astralDiagnostics?.ready);
    assert.equal(await shards(next),8);
    await next.route('https://generativelanguage.googleapis.com/**',route=>route.fulfill({json:{candidates:[{content:{parts:[{text:success}]}}]}}));
    await enter(next);await next.waitForFunction(()=>document.querySelector('#tutor-source')?.textContent.includes('AI 과외'));assert.equal(await shards(next),8);await next.close();
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('astral-bloom-v1')));
    assert.equal(saved.campaign.dreamShards,8);assert.equal(saved.campaign.learning.reviewRewardDate,'2026-10-02');
    await page.clock.setSystemTime(new Date('2026-10-03T12:00:00+09:00'));await page.locator('#library-tutor').click();await page.waitForFunction(()=>document.querySelector('#tutor-source')?.textContent.includes('AI 과외'));assert.equal(await shards(page),9);
    await context.close();
  }
  checks.push('Connected key bypasses popup; AI formatting is escaped; cache, Pro switch and next-day reward work');
  {
    const {context,page}=await setup({key:'test-key'});const models=[];
    await page.route('https://generativelanguage.googleapis.com/**',async route=>{models.push(route.request().url());await route.fulfill(models.length===1?{status:429,json:{error:{code:429}}}:{json:{candidates:[{content:{parts:[{text:success}]}}]}});});
    await enter(page);await page.waitForFunction(()=>document.querySelector('#tutor-source')?.textContent.includes('AI 과외'));
    assert.equal(models.length,2);assert.match(models[1],/flash-lite/);assert.match(await page.locator('#tutor-source').innerText(),/Lite/);assert.equal(await shards(page),8);await context.close();
  }
  checks.push('Quota failure falls back from Flash to Lite with a single daily reward');
  for(const status of [429,403,200]) {
    const {context,page}=await setup({key:'test-key'});let calls=0;
    await page.route('https://generativelanguage.googleapis.com/**',async route=>{calls++;await route.fulfill({status,json:status===200?{candidates:[]}:{error:{code:status}}});});
    await enter(page);await page.waitForFunction(()=>document.querySelector('#tutor-status')?.classList.contains('fallback'));
    assert.ok((await page.locator('#tutor-lesson').innerText()).length>100);assert.equal(await shards(page),8);assert.equal(calls,status===403?1:2);
    await page.screenshot({path:fileURLToPath(new URL(`fallback-${status}.png`,output))});
    await page.locator('#tutor-retry').click();
    if(status===403){assert.equal(await page.locator('#tutor-api-key').isVisible(),true);assert.equal(await page.locator('#tutor-api-key').inputValue(),'');}
    else {await page.waitForFunction(()=>!document.querySelector('#tutor-retry').disabled);assert.equal(await page.locator('#tutor-api-key').count(),0);}
    assert.equal(await shards(page),8);await context.close();
  }
  checks.push('Exhausted quota, invalid key and empty output preserve base lessons; only invalid key requests reconnection');
  {
    const {context,page}=await setup({key:'test-key'});let pending;
    await page.route('https://generativelanguage.googleapis.com/**',route=>{pending=route;});
    await enter(page);await page.waitForFunction(()=>document.querySelector('#tutor-status')?.classList.contains('loading'));
    await page.locator('#tutor-close').click();await page.locator('#library-close').click();
    if(pending)await pending.fulfill({json:{candidates:[{content:{parts:[{text:success}]}}]}}).catch(()=>{});
    await page.waitForTimeout(100);assert.equal(await page.locator('#modal').isVisible(),false);assert.equal(await page.locator('#tutor-lesson').count(),0);assert.equal(await shards(page),8);await context.close();
  }
  checks.push('Closing a pending lesson cancels it; late responses cannot reopen or replace the game screen');
  {
    const {context,page}=await setup({key:'test-key',offline:true});await enter(page);await page.waitForFunction(()=>document.querySelector('#tutor-status')?.classList.contains('fallback'));assert.equal(await page.locator('#tutor-api-key').count(),0);assert.equal(await shards(page),8);await context.close();
  }
  checks.push('Offline with a saved key uses base explanation without another key prompt');
  {
    const {context,page}=await setup();await page.locator('#library').click();await page.locator('[data-tab="mistakes"]').click();assert.equal(await shards(page),7);
    await page.locator('#practice').click();if(await page.locator('#quiz-now').count())await page.locator('#quiz-now').click();
    await page.locator('[data-answer]').filter({hasText:mistake.answer}).click();await page.locator('#quiz-continue').click();
    assert.equal(await shards(page),8);assert.equal(await page.evaluate(id=>__tutorFlow.profile.learning.mistakes.some(q=>q.id===id),mistake.id),false);
    await page.locator('#library-tutor').click();await page.locator('#tutor-basic').click();assert.equal(await shards(page),8);await context.close();
  }
  checks.push('Library wrong-answer practice also grants the same daily reward; merely opening the tab grants nothing');
  assert.deepEqual(errors,[]);
  await fs.writeFile(new URL('report.json',output),JSON.stringify({checks,viewports,errors},null,2));console.log(JSON.stringify({checks,viewports: viewports.map(({width,height})=>({width,height})),errors},null,2));
}finally {await browser.close();}
