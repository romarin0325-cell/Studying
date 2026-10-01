import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { COLLECTIBLE_ARTIFACTS, COSTUMES } from '../meta.js';

const root=new URL('../',import.meta.url),review=new URL('artifacts/relics-wardrobe/',root);
await fs.mkdir(review,{recursive:true});
const original=await fs.readFile(new URL('dist/AstralBloom.html',root),'utf8');
assert.ok(!original.includes('MANUAL_BALANCE'),'manual payload must stay out of the game');
const html=original.replace("Object.defineProperty(globalThis, 'astralDiagnostics'","globalThis.__patch={get menus(){return menus},profile,get art(){return art},get renderer(){return renderer},get game(){return game},setGame(g){game=g},Game,renderHud};\nObject.defineProperty(globalThis, 'astralDiagnostics'");
const file=new URL('flow.html',review);await fs.writeFile(file,html);
const browser=await chromium.launch({headless:true}),results=[];
try {
  for(const [width,height] of [[320,568],[390,844],[430,932],[844,390]]) {
    const context=await browser.newContext({viewport:{width,height},offline:true,hasTouch:true,reducedMotion:'no-preference'});
    const page=await context.newPage(),errors=[],external=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!/^(file|data):/.test(r.url()))external.push(r.url());});
    await page.goto(file.href);await page.waitForFunction(()=>globalThis.astralDiagnostics?.ready);
    const click=selector=>page.locator(selector).click();
    const shot=name=>page.screenshot({path:fileURLToPath(new URL(`${width}-${name}.png`,review))});
    await page.evaluate(({ids,costumes})=>{__patch.profile.owned=ids;__patch.profile.costumesOwned=costumes;}, {ids:COLLECTIBLE_ARTIFACTS.map(a=>a.id),costumes:COSTUMES.map(c=>c.id)});
    assert.equal(await page.locator('#manual').count(),0);
    await click('#equipment');assert.equal(await page.locator('[data-artifact]').count(),48);
    assert.equal(await page.locator('[data-artifact="divineiris"],[data-artifact="demonicbelzebuth"]').count(),0);
    await page.locator('[data-artifact="holyflame"]').scrollIntoViewIfNeeded();await shot('relics');
    await page.evaluate(()=>{__patch.profile.equipped=['holyflame'];});await click('#equipment-close');
    await click('#help');assert.match(await page.locator('.help-list').innerText(),/홀리플레임[\s\S]*기본 피해 5800/);await click('#help-done');
    await click('#wardrobe-hotspot');
    await click('[data-wardrobe-hero="0"]');
    await page.waitForFunction(()=>!document.querySelector('.wardrobe-preview').hasAttribute('aria-busy')&&document.querySelector('.wardrobe-preview .anchored-art').alt.startsWith('루미 '));
    await page.waitForFunction(()=>document.querySelector('.menu-panel').getAnimations().length===0);
    await page.evaluate(()=>{
      __patch.profile.costumesEquipped[1]='luna-gothic';globalThis.__wardrobeAnimations=0;
      const animate=Element.prototype.animate;
      Element.prototype.animate=function(...args){if(this.matches('.wardrobe-preview img'))__wardrobeAnimations++;return animate.apply(this,args);};
    });
    const previewState=(hero,id='')=>page.evaluate(({hero,id,costumeIndex})=>{
      const portrait=document.querySelector('.wardrobe-preview'),image=portrait.querySelector('.anchored-art'),veil=portrait.querySelector('.wardrobe-veil');
      return {sourceMatches:image.src===(id?__patch.art.urls.costumes[costumeIndex]:__patch.art.urls.heroes[hero]),
        alt:image.alt,busy:portrait.getAttribute('aria-busy'),opacity:getComputedStyle(image).opacity,veil:getComputedStyle(veil).opacity,
        animations:image.getAnimations().length+veil.getAnimations().length,started:__wardrobeAnimations};
    },{hero,id,costumeIndex:COSTUMES.findIndex(c=>c.id===id)});
    const checkImmediate=async(hero,id,started)=>{
      const state=await previewState(hero,id);
      assert.equal(state.sourceMatches,true);assert.equal(state.busy,null);assert.equal(state.opacity,'1');assert.equal(state.veil,'0');
      assert.equal(state.animations,0);assert.equal(state.started,started);return state;
    };
    // Switching characters (including an equipped costume) must start no effect.
    await click('[data-wardrobe-hero="1"]');await checkImmediate(1,'luna-gothic',0);
    await click('[data-wardrobe-hero="0"]');await checkImmediate(0,'',0);
    await click('[data-preview=""]');await checkImmediate(0,'',0);
    // A character change cancels a costume swap before its 560 ms source switch.
    await click('[data-preview="rumi-school"]');await page.waitForFunction(()=>document.querySelector('.wardrobe-preview').hasAttribute('aria-busy'));
    await click('[data-wardrobe-hero="1"]');await checkImmediate(1,'luna-gothic',2);
    await page.waitForTimeout(650);await checkImmediate(1,'luna-gothic',2);
    // It must also cancel after the old source has swapped, without stale work
    // hiding a new character or clearing the next costume transition's state.
    await click('[data-wardrobe-hero="0"]');await click('[data-preview="rumi-sailor"]');
    await page.waitForFunction(()=>document.querySelector('.wardrobe-preview .anchored-art').alt==='루미 세일러복');
    await click('[data-wardrobe-hero="1"]');await checkImmediate(1,'luna-gothic',4);
    await click('[data-preview="luna-shadowcat"]');await page.waitForFunction(()=>document.querySelector('.wardrobe-preview').hasAttribute('aria-busy'));
    await click('[data-wardrobe-hero="2"]');await click('[data-wardrobe-hero="0"]');await checkImmediate(0,'',6);
    await page.waitForTimeout(650);await checkImmediate(0,'',6);
    await page.evaluate(()=>{
      globalThis.__portrait=document.querySelector('.wardrobe-preview');globalThis.__image=__portrait.querySelector('.anchored-art');
      globalThis.__panel=document.querySelector('.menu-panel');globalThis.__oldSrc=__image.src;globalThis.__swap=[];globalThis.__start=performance.now();
      globalThis.__observer=new MutationObserver(records=>{if(records.some(r=>r.attributeName==='src'))__swap.push({ms:performance.now()-__start,opacity:Number(getComputedStyle(__image).opacity),src:__image.src});});
      __observer.observe(__image,{attributes:true,attributeFilter:['src']});
    });
    await shot('before');await click('[data-preview="rumi-school"]');
    await page.waitForFunction(()=>document.querySelector('.wardrobe-preview').getAttribute('aria-busy')==='true');
    const timing=await page.evaluate(()=>{
      const animations=[...__image.getAnimations(),...__portrait.querySelector('.wardrobe-veil').getAnimations()];
      animations.forEach(a=>a.pause());globalThis.__animations=animations;
      return animations.map(a=>a.effect.getTiming().duration);
    });
    assert.deepEqual(timing,[1600,1600]);
    assert.equal(await page.evaluate(()=>__image.src===__oldSrc),true,'the source must stay stable when selection starts');
    await page.evaluate(()=>__animations.forEach(a=>a.currentTime=560));
    await page.waitForFunction(()=>__swap.length===1);
    const swap=await page.evaluate(()=>__swap[0]);
    assert.equal(swap.opacity,0,'the character must be concealed when its source changes');
    assert.ok(swap.ms>=500,`source changed too early: ${swap.ms}`);
    const cover=await page.evaluate(()=>Number(getComputedStyle(__portrait.querySelector('.wardrobe-veil')).opacity));
    assert.ok(cover>.9);await shot('covered');
    await page.evaluate(()=>__animations.forEach(a=>a.currentTime=1440));await shot('revealing');
    await page.evaluate(()=>__animations.forEach(a=>a.finish()));
    await page.waitForFunction(()=>!document.querySelector('.wardrobe-preview').hasAttribute('aria-busy'));
    assert.deepEqual(await page.evaluate(()=>({samePanel:__panel===document.querySelector('.menu-panel'),samePortrait:__portrait===document.querySelector('.wardrobe-preview'),opacity:getComputedStyle(__image).opacity,veil:getComputedStyle(__portrait.querySelector('.wardrobe-veil')).opacity})),{samePanel:true,samePortrait:true,opacity:'1',veil:'0'});
    await shot('after');
    // A selection arriving after the swap is queued; the last preview wins.
    await click('[data-preview="rumi-sailor"]');await page.waitForFunction(()=>document.querySelector('.wardrobe-preview').hasAttribute('aria-busy'));
    await click('[data-preview=""]');
    await page.waitForFunction(()=>!document.querySelector('.wardrobe-preview').hasAttribute('aria-busy')&&document.querySelector('.wardrobe-preview .anchored-art').alt.endsWith('기본 의상'),null,{timeout:8000});
    // Closing mid-effect must cancel both the timer and the animations.
    await click('[data-preview="rumi-school"]');await page.waitForFunction(()=>document.querySelector('.wardrobe-preview').hasAttribute('aria-busy'));
    await click('#wardrobe-close');await click('#wardrobe-hotspot');
    assert.equal(await page.locator('.wardrobe-preview').getAttribute('aria-busy'),null);
    assert.match(await page.locator('.wardrobe-preview .anchored-art').getAttribute('alt'),/기본 의상$/);
    await click('#wardrobe-close');
    await page.evaluate(async()=>{
      document.querySelector('#screen').hidden=true;document.querySelector('#hud').hidden=false;document.querySelector('#world').style.display='block';__patch.renderer.resize();
      const g=new __patch.Game({hero:8,artifacts:['holyflame'],height:__patch.renderer.height});g.phase='boss';g.player.invincible=0;g.power=5;g.powerPoints=2;g.bombs=5;
      g.spawnEnemy(225,160,{hp:1e6,r:40,speed:0,fire:999,image:0});
      await __patch.art.ensureGameplay({hero:8,stage:0});
      __patch.setGame(g);
    });
    assert.ok(await page.locator('#world').evaluate(canvas=>canvas.width>0&&canvas.height>0),'combat canvas must have a drawable size');
    // Cast and draw a deterministic frame without advancing the game UI loop.
    const flame=await page.evaluate(()=>{
      const g=__patch.game;g.bomb();g.bombTime=1.35;__patch.renderer.render(g);__patch.renderHud();
      return {damage:g.stats.damage,bombs:g.bombs,power:g.power,points:g.powerPoints,kind:g.bombKind,invincible:g.player.invincible,label:document.querySelector('#bomb-label').textContent};
    });
    assert.deepEqual(flame,{damage:5800,bombs:0,power:1,points:0,kind:'holyflame',invincible:2,label:'홀리플레임'});
    await shot('holyflame');
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    results.push({width,height,characterSwitchAnimations:0,cancelBeforeAndAfterSwap:true,swapMs:Math.round(swap.ms),coverOpacity:cover,flame});
    await context.close();console.log(`Relics, immediate character switch/cancellation, concealed 1.6s costume swap, rapid selection/close and 5800 holy flame: ${width}×${height} PASS`);
  }
} finally {await browser.close();}
await fs.writeFile(new URL('results.json',review),JSON.stringify(results,null,2)+'\n');
