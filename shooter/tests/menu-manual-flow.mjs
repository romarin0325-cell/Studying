import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { COLLECTIBLE_ARTIFACTS as ARTIFACTS, COSTUMES } from '../meta.js';
const root=new URL('../',import.meta.url),file=new URL('artifacts/menu-manual-flow.html',root);
const original=await fs.readFile(new URL('dist/AstralBloom.html',root),'utf8');
const html=original.replace("Object.defineProperty(globalThis, 'astralDiagnostics'","globalThis.__menuReview={get menus(){return menus},profile,save};\nObject.defineProperty(globalThis, 'astralDiagnostics'");
await fs.mkdir(new URL('artifacts/menu-review/',root),{recursive:true});await fs.writeFile(file,html);
const browser=await chromium.launch({headless:true});
try {
  for(const [width,height] of [[320,568],[390,844],[430,932],[844,390]]) {
    const context=await browser.newContext({viewport:{width,height},offline:true,hasTouch:true,reducedMotion:'no-preference'});
    const page=await context.newPage(),errors=[],external=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!/^(file|data):/.test(r.url()))external.push(r.url());});
    await page.addInitScript(()=>{globalThis.__entries=0;document.addEventListener('animationstart',e=>{if(e.animationName==='menu-enter')__entries++;},true);});
    await page.goto(file.href);await page.waitForFunction(()=>globalThis.astralDiagnostics?.ready);
    await page.evaluate(ids=>{__menuReview.profile.owned=ids;__menuReview.profile.equipped=[];},ARTIFACTS.map(a=>a.id));
    const click=selector=>page.locator(selector).click();
    const remember=()=>page.evaluate(()=>{
      globalThis.__panel=document.querySelector('.menu-panel');globalThis.__picture=__panel.querySelector('.wardrobe-preview img');
      globalThis.__beforeEntries=__entries;globalThis.__backgrounds=[];
      globalThis.__watch=new MutationObserver(()=>__backgrounds.push(document.querySelector('#modal').classList.contains('menu-modal')));
      __watch.observe(document.querySelector('#modal'),{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
    });
    const stable=async()=>assert.deepEqual(await page.evaluate(()=>({panel:__panel===document.querySelector('.menu-panel'),picture:!__picture||__picture===document.querySelector('.wardrobe-preview img'),entries:__entries-__beforeEntries,background:__backgrounds.every(Boolean),opacity:getComputedStyle(__panel).opacity})),{panel:true,picture:true,entries:0,background:true,opacity:'1'});
    await click('#equipment');await page.waitForFunction(()=>document.querySelector('.menu-panel').getAnimations().length===0);
    assert.ok(await page.evaluate(()=>__entries>0),'opening animation must remain available');await remember();
    for(const id of ['spellbook','frozen','crystal'])await click(`[data-artifact="${id}"]`);
    assert.match(await page.locator('.menu-heading p').innerText(),/장착 3\/3/);
    await click('[data-artifact="nail"]');assert.match(await page.locator('#toast').innerText(),/세 개/);
    await click('[data-artifact="spellbook"]');assert.equal(await page.locator('[data-artifact="spellbook"]').getAttribute('aria-pressed'),'false');
    assert.equal(await page.locator('[data-artifact="spellbook"] em').innerText(),'보유');
    const scroll=await page.evaluate(()=>{const list=document.querySelector('.equipment-list');list.scrollTop=100;const before=list.scrollTop;document.querySelector('[data-artifact="nail"]').click();return [before,list.scrollTop];});
    assert.equal(scroll[0],scroll[1]);await stable();await page.evaluate(()=>__watch.disconnect());
    await click('#equipment-done');assert.equal(await page.locator('#modal').getAttribute('class'),'');
    await page.evaluate(ids=>{__menuReview.profile.costumesOwned=ids;},COSTUMES.map(c=>c.id));
    await click('#wardrobe-hotspot');await page.waitForFunction(()=>document.querySelector('.menu-panel').getAnimations().length===0);await remember();
    for(const hero of [0,1,2,3,4,6]) {
      await click(`[data-wardrobe-hero="${hero}"]`);
      for(const costume of [null,...COSTUMES.filter(c=>c.hero===hero)]) {
        await click(`[data-preview="${costume?.id||''}"]`);
        await page.waitForFunction(()=>!document.querySelector('.wardrobe-preview').hasAttribute('aria-busy') && document.querySelector('.wardrobe-preview .anchored-art').alt.endsWith(document.querySelector('.wardrobe-caption h3').textContent));
        assert.equal(await page.locator(`[data-preview="${costume?.id||''}"]`).getAttribute('aria-pressed'),'true');
        await page.waitForFunction(()=>{const img=document.querySelector('.wardrobe-preview img');return img.complete&&img.naturalWidth===512;});
        if(width===390)await page.locator('.wardrobe-panel').screenshot({path:fileURLToPath(new URL(`artifacts/menu-review/wardrobe-${hero}-${costume?.id||'base'}.png`,root))});
        await stable();
      }
      await click('#wardrobe-equip');await stable();
    }
    await page.evaluate(()=>__watch.disconnect());await click('#wardrobe-back');
    assert.equal(await page.locator('#manual').count(),0);
    assert.equal(await page.locator('#modal').isVisible(),false);
    await page.evaluate(()=>__menuReview.menus.offerQuiz('전환 검사','문제 화면',()=>{},()=>{}));
    assert.equal(await page.locator('#modal').evaluate(m=>m.classList.contains('menu-modal')),false);
    await click('#quiz-decline');assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    await context.close();console.log(`Persistent menus, original animation, 18 wardrobe previews and documentation-only manual: ${width}×${height} PASS`);
  }
} finally {await browser.close();}
