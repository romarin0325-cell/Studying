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
async function dragCell(page,from,to){const a=await cell(page,from),b=await cell(page,to);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up();}
async function geometry(page,label){
  const measured=await page.evaluate(()=>{const el=document.querySelector('#arena'),b=el.getBoundingClientRect(),summon=document.querySelector('#summon').getBoundingClientRect();return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,boardWidth:b.width,boardHeight:b.height,summonBottom:summon.bottom,summonWidth:summon.width,summonHeight:summon.height,skills:[...document.querySelectorAll('#skills button')].map(b=>b.getBoundingClientRect().width)};});
  assert.ok(measured.scrollWidth<=measured.width+1,label+' horizontal overflow');assert.ok(measured.boardWidth>200,label+' arena missing');assert.ok(Math.abs(measured.boardWidth/measured.boardHeight-720/780)<.005,label+' distorted arena');
  assert.ok(measured.summonWidth>150&&measured.summonHeight>=48,label+' summon target');assert.equal(measured.skills.length,6);assert.ok(measured.skills.every(w=>w>=40),label+' small skill target');
  assert.ok(measured.scrollHeight<=measured.height+1,label+' vertical page overflow');assert.ok(measured.summonBottom<=measured.height+1,label+' summon below viewport');
  return measured;
}
async function smoke(page,{screenshot=null}={}){
  await portraitsReady(page);await start(page);await geometry(page,'smoke');
  await tapCell(page,6);await tapCell(page,8);assert.equal(await page.locator('#arena').getAttribute('data-merges'),'0','taps must not move or merge');assert.match(await page.locator('#unit-panel').textContent(),/지크/);await dragCell(page,6,8);await page.waitForFunction(()=>document.querySelector('#arena').dataset.merges==='1');
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
  s.board.forEach((u,i)=>u.rank=1+i%3);s.gold=88;s.wave=8;s.phase='combat';s.queue=Array.from({length:18},(_,i)=>({kind:i===7?'boss':'grunt',hp:1e7}));s.waveTotal=18;
  for(let i=0;i<18;i++){s.spawnIn=0;E.step(s,1/60);}s.queue=[];
  s.enemies.forEach((e,i)=>{e.hp=e.maxHp=1e7;e.progress=i*105;});s.gauge=100;s.events=[];return E.serialize(s);
}
async function blessingChecks(browser,url,out){
  const E=await import('../defense/merge/engine.js'),s=E.newRun({seed:4});s.queue=[];s.enemies=[];E.step(s,1/60);
  const t=await pageFor(browser,url,{fixture:E.serialize(s)});try{
    await portraitsReady(t.page);await start(t.page,true);await t.page.getByRole('heading',{name:'별빛의 축복'}).waitFor();assert.equal(await t.page.locator('[data-reward]').count(),3);
    assert.equal(await t.page.locator('.blessing-card .item-art').evaluateAll(nodes=>nodes.every(i=>i.complete&&i.naturalWidth>=256)),true);
    await t.page.screenshot({path:path.join(out,'blessings.png')});await t.page.locator('[data-reward]').first().click();await t.page.waitForFunction(()=>document.querySelector('#arena').dataset.wave==='2');assert.deepEqual(t.errors,[]);
  }finally{await t.context.close();}
}
async function expeditionChecks(browser,url,out){
  const t=await pageFor(browser,url);try{
    const p=t.page;await portraitsReady(p);assert.match(await p.title(),/루미의 별빛 원정/);
    await p.locator('[data-action="loadout"]').first().click();assert.equal(await p.locator('[data-relic]').count(),20);
    for(const id of ['ember','frost','seed'])await p.locator(`[data-relic="${id}"]`).click();await p.locator('[data-relic="feather"]').click();assert.equal(await p.locator('[data-relic][aria-pressed="true"]').count(),3);
    await p.screenshot({path:path.join(out,'relics.png')});await p.locator('[data-action="save-loadout"]').click();assert.equal(await p.locator('#home-relics .equipped').count(),3);
    await p.reload();await portraitsReady(p);assert.equal(await p.locator('#home-relics .equipped').count(),3);
    await p.locator('[data-action="deck"]').click();assert.equal(await p.locator('.roster-card').count(),21);const header=await p.locator('.modal-header').boundingBox();
    await p.locator('[data-inspect="time_ruler"]').scrollIntoViewIfNeeded();const before=await p.locator('.modal-scroll').evaluate(el=>el.scrollTop);assert.ok(before>200);await p.locator('[data-inspect="time_ruler"]').click();
    assert.ok(await p.locator('.modal-scroll').evaluate(el=>el.scrollTop)>before*.85,'inspection reset roster scroll');assert.ok(Math.abs((await p.locator('.modal-header').boundingBox()).y-header.y)<1,'roster header moved');assert.match(await p.locator('.companion-preview').textContent(),/시간의지배자/);
    assert.ok(await p.locator('.companion-preview img').evaluate(i=>i.naturalWidth>=250),'portrait downsampled');await p.screenshot({path:path.join(out,'roster-scrolled.png')});await p.locator('[data-action="close-modal"]').click();
    await smoke(p,{screenshot:path.join(out,'drag-and-skill.png')});assert.deepEqual(t.errors,[]);
  }finally{await t.context.close();}
  const E=await import('../defense/merge/engine.js'),s=E.newRun({seed:4});s.gold=1000;
  const training=await pageFor(browser,url,{fixture:E.serialize(s),viewport:{width:320,height:568}});try{
    const p=training.page;await portraitsReady(p);await start(p,true);await p.locator('#training').click();await p.locator('[data-upgrade="cinderella"]').scrollIntoViewIfNeeded();const header=await p.locator('.modal-header').boundingBox(),before=await p.locator('.modal-scroll').evaluate(el=>el.scrollTop);assert.ok(before>0);
    await p.locator('[data-upgrade="cinderella"]').click();assert.ok(Math.abs(await p.locator('.modal-scroll').evaluate(el=>el.scrollTop)-before)<2,'upgrade reset scroll');assert.ok(Math.abs((await p.locator('.modal-header').boundingBox()).y-header.y)<1,'training title moved');assert.match(await p.locator('.training-list').textContent(),/환급 20G/);await p.screenshot({path:path.join(out,'training-small.png')});assert.deepEqual(training.errors,[]);
  }finally{await training.context.close();}
  await blessingChecks(browser,url,out);await effectsProof(browser,url,out);
}
async function effectsProof(browser,url,out){
  const t=await pageFor(browser,url,{viewport:{width:1170,height:1260}});try{
    await t.page.route('**/fx-proof.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#132d3b"></body></html>'}));await t.page.goto(url+'/fx-proof.html');
    await t.page.evaluate(async()=>{
      const [{Art},{CombatFX,FX_PROFILES},{HEROES}]=await Promise.all([import('/merge/render.js'),import('/merge/effects.js'),import('/merge/content.js')]);
      const art=new Art();await art.ready;document.body.innerHTML='';const canvas=document.createElement('canvas');canvas.width=1170;canvas.height=1260;canvas.id='fx-proof';document.body.append(canvas);const ctx=canvas.getContext('2d'),fx=new CombatFX(ctx,art);ctx.fillStyle='#132d3b';ctx.fillRect(0,0,1170,1260);
      HEROES.forEach((h,i)=>{const x=i%3*390,y=Math.floor(i/3)*180;ctx.save();ctx.beginPath();ctx.rect(x,y,390,180);ctx.clip();ctx.translate(x,y);ctx.fillStyle='#dae9de';ctx.font='15px system-ui';ctx.fillText(`${i+1}. ${h.name} · ${FX_PROFILES[h.id].motion}`,18,26);ctx.strokeStyle='#78969b55';ctx.strokeRect(5,5,380,170);art.hero(ctx,h.id,65,150,115,{direction:'right'});
        const shot={hero:h.id,rank:2,from:{x:115,y:96},origin:{x:70,y:100},to:{x:285,y:112},target:1,life:.15,total:.3};fx.drawShot(shot,{enemies:[]});fx.stamp(h.id,310,105,95,0,1);ctx.restore();});
    });
    await t.page.locator('#fx-proof').screenshot({path:path.join(out,'all-21-attacks.png')});assert.deepEqual(t.errors,[]);
    await t.page.evaluate(async()=>{const [{Art},{CombatFX}]=await Promise.all([import('/merge/render.js'),import('/merge/effects.js')]);const art=new Art();await art.ready;const canvas=document.querySelector('#fx-proof');canvas.width=960;canvas.height=720;const ctx=canvas.getContext('2d'),fx=new CombatFX(ctx,art);ctx.fillStyle='#18323e';ctx.fillRect(0,0,960,720);['zeke','luna','night_rabbit','phantom'].forEach((id,row)=>[-Math.PI/2,0,Math.PI/2,Math.PI].forEach((a,col)=>{const x=col*240+120,y=row*180+100;fx.stamp(id,x,y,140,a);ctx.fillStyle='#d8e7de';ctx.font='14px system-ui';ctx.fillText(`${id} / ${['up','right','down','left'][col]}`,col*240+20,row*180+24);}));});
    await t.page.locator('#fx-proof').screenshot({path:path.join(out,'directional-slashes.png')});
  }finally{await t.context.close();}
}
async function browserChecks(browser,url,out){
  const views=[box,{width:360,height:800},{width:320,height:568},{width:390,height:667}];
  for(const viewport of views){const t=await pageFor(browser,url,{viewport});try{await portraitsReady(t.page);await start(t.page);await geometry(t.page,viewport.width+'x'+viewport.height);await t.page.locator('#summon').scrollIntoViewIfNeeded();await t.page.locator('#summon').click();assert.equal(await t.page.locator('#arena').getAttribute('data-units'),'4');assert.deepEqual(t.errors,[]);}finally{await t.context.close();}}
  await expeditionChecks(browser,url,out);
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
  await blessingChecks(browser,url,out);
}
async function resilienceChecks(browser,url,out,label){
  for(const mode of ['healthy','missing','hung']){const t=await pageFor(browser,url,{mode});try{
    await portraitsReady(t.page);await start(t.page);await dragCell(t.page,6,8);await t.page.waitForFunction(()=>document.querySelector('#arena').dataset.merges==='1');await t.page.locator('#summon').click();
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
