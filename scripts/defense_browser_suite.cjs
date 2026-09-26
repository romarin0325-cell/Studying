const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {chromium,webkit}=require('playwright');
const {createHeroDefenseV2Server}=require('./serve_defense.js');

const RUN_KEY='astra.confluence.run.v1';
const root=path.resolve(__dirname,'../defense');
const box={width:390,height:844};
async function pageFor(browser,url,{viewport=box,fixture=null,mode='healthy',offline=false}={}){
  const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:true,reducedMotion:'reduce'});
  const errors=[],requests=[];
  if(fixture)await context.addInitScript(({key,value})=>localStorage.setItem(key,value),{key:RUN_KEY,value:fixture});
  if(mode!=='healthy'){
    await context.addInitScript(()=>{
      Array.prototype.at=undefined;CanvasRenderingContext2D.prototype.roundRect=undefined;
      CanvasRenderingContext2D.prototype.getImageData=function(){throw new Error('Runtime pixel extraction forbidden');};
      Storage.prototype.setItem=function(){throw new Error('Storage unavailable');};
    });
    await context.route('**/*.css',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:(await r.text()).replace(/[\w-]+\s*:[^;{}]*svh[^;{}]*;/g,'')});});
    const imageAssets=/\/assets\/.*\.(?:webp|png|jpe?g|svg)(?:\?.*)?$/;
    if(mode==='missing')await context.route(imageAssets,route=>route.fulfill({status:404,body:''}));
    if(mode==='hung')await context.route(imageAssets,()=>new Promise(()=>{}));
  }
  if(offline)await context.route('**/*',route=>{
    const r=route.request();if(r.isNavigationRequest()&&r.url()===url)return route.continue();
    requests.push(r.url());return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator('#home').waitFor({state:'visible'});
  return {context,page,errors,requests};
}
async function portraitsReady(page){await page.waitForFunction(()=>[...document.querySelectorAll('#home-deck img')].length===6&&[...document.querySelectorAll('#home-deck img')].every(i=>i.complete&&i.naturalWidth>0),{},{timeout:15000});}
async function start(page,resume=false){await page.locator(resume?'#resume':'#play').click();await page.locator('#battle').waitFor({state:'visible'});}
async function cell(page,index){const b=await page.locator('#arena').boundingBox();return {x:b.x+b.width*(135+(index%5+.5)*90)/720,y:b.y+b.height*(212+(Math.floor(index/5)+.5)*90)/780};}
async function tapCell(page,index){const p=await cell(page,index);await page.mouse.click(p.x,p.y);}
async function geometry(page,label){
  const measured=await page.evaluate(()=>{const el=document.querySelector('#arena'),b=el.getBoundingClientRect(),summon=document.querySelector('#summon').getBoundingClientRect();return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,boardWidth:b.width,boardHeight:b.height,summonWidth:summon.width,summonHeight:summon.height,skills:[...document.querySelectorAll('#skills button')].map(b=>b.getBoundingClientRect().width)};});
  assert.ok(measured.scrollWidth<=measured.width+1,label+' horizontal overflow');assert.ok(measured.boardWidth>200,label+' arena missing');assert.ok(Math.abs(measured.boardWidth/measured.boardHeight-720/780)<.005,label+' distorted arena');
  assert.ok(measured.summonWidth>150&&measured.summonHeight>=48,label+' summon target');assert.equal(measured.skills.length,6);assert.ok(measured.skills.every(w=>w>=40),label+' small skill target');
  return measured;
}
async function smoke(page,{screenshot=null}={}){
  await portraitsReady(page);await start(page);await geometry(page,'smoke');
  await tapCell(page,6);await tapCell(page,8);await page.waitForFunction(()=>document.querySelector('#arena').dataset.merges==='1');
  assert.match(await page.locator('[data-cell="8"]').getAttribute('aria-label'),/지크 2성/);
  await page.locator('#summon').click();await page.waitForFunction(()=>document.querySelector('#arena').dataset.units==='3');
  await page.locator('[data-skill="zeke"].ready').waitFor();const before=Number(await page.locator('#gauge').textContent());await page.locator('[data-skill="zeke"]').click();
  await page.waitForFunction(n=>Number(document.querySelector('#gauge').textContent)<n,before);assert.ok(Number(await page.locator('#gauge').textContent())<before);
  if(screenshot)await page.screenshot({path:screenshot});
  await page.getByRole('button',{name:'일시 정지',exact:true}).click();await page.getByRole('dialog').waitFor();
  const units=await page.locator('#arena').getAttribute('data-units');await page.reload({waitUntil:'domcontentloaded'});await page.locator('#resume').waitFor({state:'visible'});await start(page,true);
  assert.equal(await page.locator('#arena').getAttribute('data-units'),units);assert.equal(await page.locator('#arena').getAttribute('data-merges'),'1');
}
async function denseFixture(){
  const E=await import('../defense/merge/engine.js');const s=E.newRun({seed:981});s.gold=100000;while(s.board.some(u=>!u))E.summon(s);
  s.board.forEach((u,i)=>u.rank=1+i%3);s.gold=88;s.wave=7;s.phase='intermission';E.nextWave(s);s.queue=Array(18).fill('grunt');s.queue[7]='boss';
  for(let i=0;i<18;i++){s.spawnIn=0;E.step(s,1/60);}s.queue=[];
  s.enemies.forEach((e,i)=>{e.hp=e.maxHp=1e7;e.progress=i*105;});s.gauge=100;s.events=[];return E.serialize(s);
}
async function browserChecks(browser,url,out){
  const views=[box,{width:360,height:800}];
  for(const viewport of views){const t=await pageFor(browser,url,{viewport});try{await portraitsReady(t.page);await start(t.page);await geometry(t.page,viewport.width+'x'+viewport.height);await t.page.locator('#summon').scrollIntoViewIfNeeded();await t.page.locator('#summon').click();assert.equal(await t.page.locator('#arena').getAttribute('data-units'),'4');assert.deepEqual(t.errors,[]);}finally{await t.context.close();}}
  const t=await pageFor(browser,url,{fixture:await denseFixture()});try{
    await portraitsReady(t.page);await start(t.page,true);assert.equal(await t.page.locator('#arena').getAttribute('data-units'),'25');await t.page.locator('[data-skill="zeke"].ready').waitFor();
    await t.page.screenshot({path:path.join(out,'mobile-25-units.png')});await t.page.locator('[data-skill="zeke"]').click();await t.page.screenshot({path:path.join(out,'mobile-skill.png')});
    const samples=await t.page.evaluate(()=>new Promise(resolve=>{const frames=[],start=performance.now();let last=start;function frame(now){frames.push(now-last);last=now;if(now-start<3000)requestAnimationFrame(frame);else resolve(frames.slice(2));}requestAnimationFrame(frame);}));
    const sorted=[...samples].sort((a,b)=>a-b),mean=samples.reduce((a,b)=>a+b,0)/samples.length,p95=sorted[Math.floor(sorted.length*.95)];
    console.log(JSON.stringify({denseBoardFps:Number((1000/mean).toFixed(1)),frameP95ms:Number(p95.toFixed(1)),fixture:'25 units, 18 high-health enemies; rendering stress fixture, not a balance run'}));
    assert.ok(mean<70,'dense board freezes');assert.deepEqual(t.errors,[]);
  }finally{await t.context.close();}
}
async function offlineChecks(browser,url,out){
  const html=await fs.readFile(path.join(root,'dist-local/HeroCoreDefense.html'),'utf8');
  assert.match(html,/name="astra-defense-distribution" content="single-file-offline"/);assert.doesNotMatch(html,/<script[^>]+src=/i);assert.doesNotMatch(html,/<link[^>]+rel=["']stylesheet/i);assert.doesNotMatch(html,/<script[^>]+type=["']module/i);
  const t=await pageFor(browser,url+'/dist-local/HeroCoreDefense.html',{offline:true});try{await smoke(t.page,{screenshot:path.join(out,'mobile-offline-bundle.png')});assert.deepEqual(t.errors,[]);assert.deepEqual(t.requests,[],'bundle requested a separate resource');}finally{await t.context.close();}
  console.log('Single HTML passed with every secondary network request blocked. Literal file:// launch is a separate device/browser check.');
}
async function experienceChecks(browser,url,out){
  const t=await pageFor(browser,url);try{
    await portraitsReady(t.page);await t.page.getByRole('button',{name:'편성 바꾸기 ↗'}).click();assert.equal(await t.page.locator('.roster-card').count(),21);
    await t.page.locator('[data-pick="queen"]').click();assert.equal(await t.page.getByRole('button',{name:'함께 떠나기'}).isEnabled(),false);await t.page.locator('[data-pick="silver_rabbit"]').click();await t.page.getByRole('button',{name:'함께 떠나기'}).click();
    assert.equal(await t.page.locator('#home-deck img[alt="은토끼"]').count(),1);await smoke(t.page,{screenshot:path.join(out,'mobile-play.png')});
    await t.page.getByRole('button',{name:'일시 정지',exact:true}).click();await t.page.getByRole('button',{name:'설정',exact:true}).click();await t.page.locator('[data-setting="reduced"]').check();await t.page.getByRole('button',{name:'적용',exact:true}).click();
    assert.deepEqual(t.errors,[]);
  }finally{await t.context.close();}
  const E=await import('../defense/merge/engine.js');const s=E.newRun({seed:4});s.wave=3;s.queue=[];s.enemies=[];s.gold=150;E.step(s,1/60);
  const shop=await pageFor(browser,url,{fixture:E.serialize(s)});try{
    await start(shop.page,true);await shop.page.getByRole('heading',{name:'별빛을 싣고 온 상인'}).waitFor();const first=shop.page.locator('[data-buy="0"]');await first.click();assert.equal(await first.isEnabled(),false);await shop.page.getByRole('button',{name:'다음 물결로',exact:true}).click();assert.equal(await shop.page.locator('#arena').getAttribute('data-wave'),'4');assert.deepEqual(shop.errors,[]);
  }finally{await shop.context.close();}
}
async function resilienceChecks(browser,url,out,label){
  for(const mode of ['healthy','missing','hung']){const t=await pageFor(browser,url,{mode});try{
    await portraitsReady(t.page);await start(t.page);await tapCell(t.page,6);await tapCell(t.page,8);await t.page.waitForFunction(()=>document.querySelector('#arena').dataset.merges==='1');await t.page.locator('#summon').click();
    if(mode!=='healthy')assert.equal(await t.page.locator('#save-notice').isVisible(),true);
    const layout=await geometry(t.page,label+' '+mode);
    // With deliberately never-settling image requests, WebKit's font readiness
    // promise can remain pending although the DOM/fallback controls work.
    // Do not mutate fonts or release those requests merely to obtain a picture.
    // Record the actual fallback checks; healthy/missing modes retain screenshots.
    if(mode==='hung')await fs.writeFile(path.join(out,label+'-hung.json'),JSON.stringify({mode,label,layout,units:await t.page.locator('#arena').getAttribute('data-units'),merges:await t.page.locator('#arena').getAttribute('data-merges'),portraits:'six complete fallback images',storageWarning:await t.page.locator('#save-notice').isVisible(),errors:t.errors},null,2));
    else await t.page.screenshot({path:path.join(out,label+'-'+mode+'.png')});
    assert.deepEqual(t.errors,[]);
  }finally{await t.context.close();}}
}
async function runSuite(mode){
  const prefix={browser:'hero-defense-v2-browser-',experience:'starward-experience-',resilience:'defense-resilience-',local:'astra-offline-'}[mode];
  const out=await fs.mkdtemp(path.join(os.tmpdir(),prefix));const server=createHeroDefenseV2Server();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
  let browser;
  try{
    browser=await chromium.launch({headless:true});
    if(mode==='local')await offlineChecks(browser,url,out);
    if(mode==='browser')await browserChecks(browser,url,out);
    if(mode==='experience')await experienceChecks(browser,url,out);
    if(mode==='resilience'){await resilienceChecks(browser,url,out,'chromium');await browser.close();browser=await webkit.launch({headless:true});await resilienceChecks(browser,url,out,'webkit');}
    console.log('ASTRA '+mode+' passed. Evidence: '+out);
    return out;
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
module.exports={runSuite};
