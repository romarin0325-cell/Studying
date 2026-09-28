const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {chromium,webkit}=require('playwright');
const {createHeroDefenseV2Server}=require('./serve_defense.js');

const RUN_KEY='astra.confluence.run.v1';
const root=path.resolve(__dirname,'../defense');
const box={width:390,height:844};
async function pageFor(browser,url,{viewport=box,fixture=null,mode='healthy',offline=false,reducedMotion='reduce'}={}){
  const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:true,reducedMotion});
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
async function mergePair(page){
  // No guaranteed opening pair: exercise the real independent draw until one
  // exists (at most seven units for a six-hero deck).
  for(let attempt=0;attempt<5;attempt++){
    const units=await page.locator('[data-cell]').evaluateAll(nodes=>nodes.flatMap(n=>{const m=n.getAttribute('aria-label').match(/열 (.+) (\d)성/);return m?[{index:Number(n.dataset.cell),name:m[1],rank:Number(m[2])}]:[];}));
    for(const a of units)for(const b of units)if(a.index!==b.index&&a.name===b.name&&a.rank===b.rank)return {from:a.index,to:b.index,name:b.name,units:units.length};
    await page.locator('#summon').click();await page.waitForFunction(n=>Number(document.querySelector('#arena').dataset.units)>n,units.length);
  }
  throw new Error('Seven units from six heroes should contain a pair');
}
async function smoke(page,{screenshot=null}={}){
  await portraitsReady(page);await start(page);await geometry(page,'smoke');
  const pair=await mergePair(page);
  await tapCell(page,pair.from);await tapCell(page,pair.to);assert.equal(await page.locator('#arena').getAttribute('data-merges'),'0','taps must not move or merge');assert.ok((await page.locator('#unit-panel').textContent()).includes(pair.name));await dragCell(page,pair.from,pair.to);await page.waitForFunction(()=>document.querySelector('#arena').dataset.merges==='1');
  assert.ok((await page.locator(`[data-cell="${pair.to}"]`).getAttribute('aria-label')).includes(pair.name+' 2성'));
  await page.locator('#summon').click();await page.waitForFunction(n=>Number(document.querySelector('#arena').dataset.units)===n,pair.units);
  await page.locator('.skill-button.ready').first().waitFor();const before=Number(await page.locator('#gauge').textContent());await page.locator('.skill-button.ready').first().click();
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
    await p.locator('[data-upgrade="cinderella"]').click();assert.ok(Math.abs(await p.locator('.modal-scroll').evaluate(el=>el.scrollTop)-before)<2,'upgrade reset scroll');assert.ok(Math.abs((await p.locator('.modal-header').boundingBox()).y-header.y)<1,'training title moved');assert.match(await p.locator('.training-list').textContent(),/22G/);assert.match(await p.locator('.training-list').textContent(),/15.4 → 18.7/);await p.screenshot({path:path.join(out,'training-small.png')});assert.deepEqual(training.errors,[]);
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
    const fieldCoverage=await t.page.evaluate(async()=>{
      const [{Art,Renderer},{CombatFX},{HEROES,DEFAULT_DECK},E]=await Promise.all([import('/merge/render.js'),import('/merge/effects.js'),import('/merge/content.js'),import('/merge/engine.js')]);
      const art=new Art();await art.ready;const sheet=document.querySelector('#fx-proof');sheet.width=1080;sheet.height=2940;const sheetCtx=sheet.getContext('2d'),results=[];
      for(const [i,h] of HEROES.entries()){
        const field=document.createElement('canvas');field.width=720;field.height=780;const ctx=field.getContext('2d'),fx=new CombatFX(ctx,art);
        for(const reduced of [false,true]){ctx.clearRect(0,0,720,780);fx.reduced=reduced;fx.drawSkillField({hero:h.id,life:1.28,total:1.6});const pixels=ctx.getImageData(0,0,720,780).data;let outer=0,hash=2166136261;
          for(let p=0;p<pixels.length;p+=4){const x=p/4%720,y=Math.floor(p/4/720);if((x<120||x>600||y<170||y>660)&&pixels[p+3]>4)outer++;hash=Math.imul(hash^pixels[p]^pixels[p+1]^pixels[p+2]^pixels[p+3],16777619);}
          results.push({id:h.id,reduced,outer,hash:hash>>>0});
        }
        const canvas=document.createElement('canvas'),renderer=new Renderer(canvas,art),s=E.newRun({deck:[h.id,...DEFAULT_DECK.filter(id=>id!==h.id)].slice(0,6),seed:21});
        s.board=s.board.map((u,index)=>index===6?u:null);s.wave=4;s.queue=[{kind:'boss',hp:1e7}];s.spawnIn=0;E.step(s,1/60);s.enemies[0].progress=850;s.enemies[0].speed=0;s.queue=[];s.gauge=100;s.events=[];E.cast(s,h.id);
        renderer.event(s.events.find(e=>e.type==='skill'));renderer.skill.life=1.28;renderer.shake=0;renderer.draw(s,0);
        const x=i%3*360,y=Math.floor(i/3)*420;sheetCtx.drawImage(canvas,x,y+30,360,390);sheetCtx.fillStyle='#142c3a';sheetCtx.fillRect(x,y,360,30);sheetCtx.fillStyle='#f4deb4';sheetCtx.font='14px system-ui';sheetCtx.fillText(h.name+' · '+h.skill.name,x+12,y+21);
      }
      return results;
    });
    assert.equal(fieldCoverage.length,42);assert.ok(fieldCoverage.every(r=>r.outer>10000),'skill field disappears with one target or reduced motion');
    for(const reduced of [false,true])assert.equal(new Set(fieldCoverage.filter(r=>r.reduced===reduced).map(r=>r.hash)).size,21,'skill identities collapsed');
    await t.page.locator('#fx-proof').screenshot({path:path.join(out,'all-21-single-boss-skills.png')});
    await fs.writeFile(path.join(out,'skill-field-coverage.json'),JSON.stringify(fieldCoverage,null,2));assert.deepEqual(t.errors,[]);
  }finally{await t.context.close();}
}
async function browserChecks(browser,url,out){
  const views=[box,{width:360,height:800},{width:320,height:568},{width:390,height:667}];
  for(const viewport of views){const t=await pageFor(browser,url,{viewport});try{await portraitsReady(t.page);await start(t.page);await geometry(t.page,viewport.width+'x'+viewport.height);await t.page.locator('#summon').scrollIntoViewIfNeeded();await t.page.locator('#summon').click();assert.equal(await t.page.locator('#arena').getAttribute('data-units'),'4');assert.deepEqual(t.errors,[]);}finally{await t.context.close();}}
  await expeditionChecks(browser,url,out);
  await combatClarityChecks(browser,url,out);
  await tutorialChecks(browser,url,out);
  await bossClarityChecks(browser,url,out);
  const t=await pageFor(browser,url,{fixture:await denseFixture()});try{
    await portraitsReady(t.page);await start(t.page,true);assert.equal(await t.page.locator('#arena').getAttribute('data-units'),'25');await t.page.locator('[data-skill="zeke"].ready').waitFor();
    await t.page.screenshot({path:path.join(out,'mobile-25-units.png')});await t.page.locator('[data-skill="zeke"]').click();await t.page.screenshot({path:path.join(out,'mobile-skill.png')});
    const samples=await t.page.evaluate(()=>new Promise(resolve=>{const frames=[],start=performance.now();let last=start;function frame(now){frames.push(now-last);last=now;if(now-start<3000)requestAnimationFrame(frame);else resolve(frames.slice(2));}requestAnimationFrame(frame);}));
    const sorted=[...samples].sort((a,b)=>a-b),mean=samples.reduce((a,b)=>a+b,0)/samples.length,p95=sorted[Math.floor(sorted.length*.95)];
    console.log(JSON.stringify({denseBoardFps:Number((1000/mean).toFixed(1)),frameP95ms:Number(p95.toFixed(1)),fixture:'25 units, 18 high-health enemies; rendering stress fixture, not a balance run'}));
    assert.ok(mean<70,'dense board freezes');assert.deepEqual(t.errors,[]);
  }finally{await t.context.close();}
}
async function combatClarityChecks(browser,url,out){
  const E=await import('../defense/merge/engine.js'),{number}=await import('../defense/merge/unit-info.js');
  const s=E.newRun({seed:817231,deck:['zeke','ancient_dragon','siren','queen','silver_rabbit','mushroom_king']});
  const template=s.board.find(Boolean);s.board.fill(null);
  for(const [i,id] of [[12,'zeke'],[11,'ancient_dragon'],[13,'siren']])s.board[i]={...template,uid:s.nextId++,hero:id,rank:i===12?3:1};
  s.upgrades.zeke=2;s.upgrades.ancient_dragon=2;s.upgrades.siren=3;
  const expected=E.combatStats(s,s.board[12]);
  const t=await pageFor(browser,url,{fixture:E.serialize(s),reducedMotion:'no-preference'}),p=t.page;
  try{
    await portraitsReady(p);
    await p.locator('#home [data-action="fullscreen"]').click();
    await p.waitForFunction(()=>!!document.fullscreenElement);assert.equal(await p.locator('#home [data-action="fullscreen"]').getAttribute('aria-pressed'),'true');
    await p.locator('#home [data-action="fullscreen"]').click();await p.waitForFunction(()=>!document.fullscreenElement);
    await start(p,true);await tapCell(p,12);
    assert.match(await p.locator('.unit-metrics').textContent(),new RegExp(number(expected.damage).replace('.', '\\.')));
    assert.ok((await p.locator('.unit-metrics').textContent()).includes(expected.interval.toFixed(2)+'초'));
    await p.locator('[data-unit="info"]').click();await p.getByRole('heading',{name:'지크',exact:true}).waitFor();
    assert.ok((await p.locator('.hero-metrics').textContent()).includes(number(expected.damage)));
    assert.match(await p.locator('.live-bonuses').textContent(),/고대 용의 가호/);assert.doesNotMatch(await p.locator('#modal-root').textContent(),/같은 동료.*적용|기본 위력|성급.*곱/);
    await p.screenshot({path:path.join(out,'current-unit-stats.png')});
    await p.locator('[data-action="close-modal"]').first().click();
    await dragCell(p,11,0);await tapCell(p,12);
    s.board[0]=s.board[11];s.board[11]=null;
    const moved=number(E.combatStats(s,s.board[12]).damage);
    await p.waitForFunction(n=>document.querySelector('.unit-metrics').textContent.includes(n),moved);
    await p.screenshot({path:path.join(out,'current-unit-dock.png')});
    await p.goto(url+'/tools/combat-review.html');await p.waitForFunction(()=>document.body.dataset.ready==='true');
    const geometryProof=await p.evaluate(async()=>{
      const [{attackGeometry,geometryContains},{traceAttackShape},{HERO}]=await Promise.all([import('/merge/engine.js'),import('/merge/attack-shapes.js'),import('/merge/content.js')]);
      const ctx=document.createElement('canvas').getContext('2d'),mismatches=[];let probes=0;
      for(const id of ['zeke','mushroom_king','ancient_dragon','red_dragon','silver_rabbit','guardian'])for(const angle of [-2.1,-.7,0,.6,1.9]){
        const g=attackGeometry(HERO[id],{x:360,y:390},{x:360+Math.cos(angle)*210,y:390+Math.sin(angle)*210});traceAttackShape(ctx,g);
        for(let y=10.37;y<780;y+=19.3)for(let x=10.23;x<720;x+=19.7){probes++;if(ctx.isPointInPath(x,y)!==geometryContains(g,{x,y}))mismatches.push({id,angle,x,y});}
      }
      return {probes,mismatches};
    });
    assert.deepEqual(geometryProof.mismatches,[],'rendered contour disagrees with actual hit testing');
    await fs.writeFile(path.join(out,'attack-geometry.json'),JSON.stringify(geometryProof,null,2));
    const seek=async frame=>{await p.locator('#scrub').evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));},frame);};
    for(const [id,frame] of [['zeke',43],['mushroom_king',70],['ancient_dragon',43],['red_dragon',49],['silver_rabbit',43]]){
      await p.locator('#hero').selectOption(id);await seek(frame);
      assert.ok(Number(await p.locator('#review').getAttribute('data-impacts'))>0,id+' failed to hit');
      await p.locator('#review').screenshot({path:path.join(out,`attack-${id}.png`)});
    }
    // Same real scene at several points: anticipation, contact, hold and clear.
    await p.locator('#hero').selectOption('zeke');
    for(const frame of [18,30,39,43,52,63]){await seek(frame);await p.locator('#review').screenshot({path:path.join(out,`zeke-frame-${frame}.png`)});}
    for(const viewport of [box,{width:320,height:568}]){
      await p.setViewportSize(viewport);await p.locator('#layout').selectOption('dense');
      for(const speed of ['1','2'])for(const reduced of [false,true]){
        await p.locator('#speed').selectOption(speed);await p.locator('#reduced').setChecked(reduced);await seek(120);
        assert.ok(Number(await p.locator('#review').getAttribute('data-impacts'))>20);
        assert.ok(Number(await p.locator('#review').getAttribute('data-footprints'))<=25);
        await p.locator('#review').screenshot({path:path.join(out,`area-dense-${viewport.width}-${speed}x-${reduced?'reduced':'normal'}.png`)});
      }
    }
    assert.deepEqual(t.errors,[]);
  }finally{await t.context.close();}
}
async function offlineChecks(browser,url,out){
  const html=await fs.readFile(path.join(root,'dist-local/HeroCoreDefense.html'),'utf8');
  assert.match(html,/name="astra-defense-distribution" content="single-file-offline"/);assert.doesNotMatch(html,/<script[^>]+src=/i);assert.doesNotMatch(html,/<link[^>]+rel=["']stylesheet/i);assert.doesNotMatch(html,/<script[^>]+type=["']module/i);
  const t=await pageFor(browser,url+'/dist-local/HeroCoreDefense.html',{offline:true});try{await smoke(t.page,{screenshot:path.join(out,'mobile-offline-bundle.png')});assert.deepEqual(t.errors,[]);assert.deepEqual(t.requests,[],'bundle requested a separate resource');}finally{await t.context.close();}
  await tutorialChecks(browser,url+'/dist-local/HeroCoreDefense.html',out,{offline:true});
  await bossClarityChecks(browser,url+'/dist-local/HeroCoreDefense.html',out,{offline:true});
  console.log('Single HTML passed with every secondary network request blocked. Literal file:// launch is a separate device/browser check.');
}
async function tutorialChecks(browser,url,out,options={}){
  const t=await pageFor(browser,url,{...options,viewport:{width:320,height:568}}),p=t.page;
  try{
    await portraitsReady(p);await p.locator('#home [data-action="help"]').click();
    await p.locator('[data-practice-cell="6"]').click();assert.match(await p.locator('.practice-result').textContent(),/지크 · 1성/);
    await p.locator('[data-lesson-nav="1"]').first().click();
    await p.locator('[data-practice-cell="6"]').click();await p.locator('[data-practice-cell="8"]').click();assert.match(await p.locator('[data-practice-cell="8"]').getAttribute('aria-label'),/1성/);
    const a=await p.locator('[data-practice-cell="6"]').boundingBox(),b=await p.locator('[data-practice-cell="8"]').boundingBox();
    await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8});await p.mouse.up();assert.match(await p.locator('.practice-result').textContent(),/합성 완료/);assert.match(await p.locator('[data-practice-cell="8"]').getAttribute('aria-label'),/2성/);
    await p.screenshot({path:path.join(out,'tutorial-merge-small.png')});
    await p.locator('[data-lesson-nav="2"]').first().click();await p.locator('[data-practice-cell="8"]').click();await p.locator('[data-practice-summon]').click();assert.match(await p.locator('.practice-result').textContent(),/골드 45G 그대로/);assert.doesNotMatch(await p.locator('[data-practice-cell="8"]').getAttribute('aria-label'),/빈칸/);
    await p.locator('[data-lesson-nav="3"]').first().click();await p.locator('[data-practice-skill]').click();assert.equal(await p.locator('[data-practice-gauge]').textContent(),'별빛 30 / 100');
    await p.screenshot({path:path.join(out,'tutorial-skill-small.png')});
    const bounds=await p.locator('.practice-footer').boundingBox();assert.ok(bounds.y+bounds.height<=568,'tutorial footer off screen');
    await p.locator('.practice-footer [data-action="close-modal"]').click();assert.equal(await p.evaluate(key=>localStorage.getItem(key),RUN_KEY),null,'practice created a saved run');
    await start(p);assert.equal(await p.locator('#hint').count(),0);assert.equal(await p.locator('#inspection-empty').count(),0);assert.doesNotMatch(await p.locator('#battle').innerText(),/어떤 동행|드래그|탭으로|소환.*보세요/);
    await p.locator('[data-action="pause"]').click();const saved=await p.evaluate(key=>localStorage.getItem(key),RUN_KEY);
    await p.locator('#modal-root [data-action="help"]').click();await p.locator('[data-lesson-nav="3"]').first().click();await p.locator('[data-practice-skill]').click();assert.equal(await p.evaluate(key=>localStorage.getItem(key),RUN_KEY),saved,'practice changed the live run');
    await p.locator('.practice-footer [data-action="close-modal"]').click();await geometry(p,'after tutorial');assert.deepEqual(t.errors,[]);assert.deepEqual(t.requests,[]);
  }finally{await t.context.close();}
}
async function bossClarityChecks(browser,url,out,options={}){
  const E=await import('../defense/merge/engine.js');
  for(const reducedMotion of ['no-preference','reduce']){
    const s=E.newRun({seed:21});s.wave=4;s.queue=[{kind:'boss',hp:1e7}];s.spawnIn=0;E.step(s,1/60);s.enemies[0].progress=850;s.enemies[0].speed=0;s.enemies[0].skillIn=100;s.queue=[];s.gauge=100;s.events=[];
    const t=await pageFor(browser,url,{...options,fixture:E.serialize(s),reducedMotion}),p=t.page;
    try{
      await portraitsReady(p);await start(p,true);await p.locator('#boss-health').waitFor({state:'visible'});assert.match(await p.locator('#boss-name').textContent(),/인조마신/);assert.equal(await p.locator('#remaining-enemies').textContent(),'1');
      await p.locator('[data-skill="zeke"]').click();await p.waitForFunction(()=>document.querySelector('#arena').dataset.skillField==='zeke');
      await p.waitForFunction(()=>!document.querySelector('#skill-cutin').hidden&&Number(getComputedStyle(document.querySelector('#skill-cutin')).opacity)>.85);await p.screenshot({path:path.join(out,`one-boss-skill-${reducedMotion}.png`)});assert.equal(await p.locator('#boss-health').isVisible(),true);
      await p.waitForFunction(()=>document.querySelector('#arena').dataset.skillField==='');await p.screenshot({path:path.join(out,`battle-overview-${reducedMotion}.png`)});assert.deepEqual(t.errors,[]);assert.deepEqual(t.requests,[]);
    }finally{await t.context.close();}
  }
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
    await portraitsReady(t.page);await start(t.page);const pair=await mergePair(t.page);await dragCell(t.page,pair.from,pair.to);await t.page.waitForFunction(()=>document.querySelector('#arena').dataset.merges==='1');await t.page.locator('#summon').click();
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
  const prefix={browser:'hero-defense-v2-browser-',clarity:'combat-clarity-',experience:'starward-experience-',resilience:'defense-resilience-',local:'astra-offline-'}[mode];
  const out=await fs.mkdtemp(path.join(os.tmpdir(),prefix));const server=createHeroDefenseV2Server();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
  let browser;
  try{
    browser=await chromium.launch({headless:true});
    if(mode==='local')await offlineChecks(browser,url,out);
    if(mode==='browser')await browserChecks(browser,url,out);
    if(mode==='clarity')await combatClarityChecks(browser,url,out);
    if(mode==='experience')await experienceChecks(browser,url,out);
    if(mode==='resilience'){await resilienceChecks(browser,url,out,'chromium');await browser.close();browser=await webkit.launch({headless:true});await resilienceChecks(browser,url,out,'webkit');}
    console.log('ASTRA '+mode+' passed. Evidence: '+out);
    return out;
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
module.exports={runSuite};
