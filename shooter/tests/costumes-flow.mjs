import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root=new URL('../',import.meta.url);
const original=await fs.readFile(new URL('dist/AstralBloom.html',root),'utf8');
const html=original.replace('<head>',`<head><base href="${new URL('dist/',root).href}">`)
  .replace("Object.defineProperty(globalThis, 'astralDiagnostics'", "globalThis.__costumes={get game(){return game},get profile(){return profile},get art(){return art},get renderer(){return renderer},finish,costumes:COSTUMES};\nObject.defineProperty(globalThis, 'astralDiagnostics'");
const file=new URL('artifacts/costumes-flow.html',root);
await fs.mkdir(new URL('artifacts/',root),{recursive:true});
await fs.writeFile(file,html);

const browser=await chromium.launch({headless:true});
try {
  for(const [width,height] of [[320,568],[390,844],[844,390]]) {
    const context=await browser.newContext({viewport:{width,height},offline:true,hasTouch:true});
    const page=await context.newPage(),errors=[],external=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(!request.url().startsWith('file:')&&!request.url().startsWith('data:'))external.push(request.url());});
    await page.clock.install({time:new Date(2026,8,27,12)});
    await page.goto(file.href);await page.waitForFunction(()=>astralDiagnostics?.ready);
    await page.evaluate(()=>{__costumes.profile.dreamShards=70;});
    await page.locator('#shop').click();
    assert.equal(await page.locator('.shop-product').count(),6);
    assert.equal(await page.locator('.shop-lineup-trigger').getAttribute('aria-label'),'코스튬 티켓 상세 라인업');
    const shop=await page.evaluate(()=>({panel:document.querySelector('.shop-panel').clientWidth,scroll:document.querySelector('.shop-panel').scrollWidth,doc:document.documentElement.scrollWidth,width:innerWidth}));
    assert.ok(shop.scroll<=shop.panel+1&&shop.doc<=shop.width+1,`${width}x${height} shop overflow ${JSON.stringify(shop)}`);
    await page.locator('#shop-lineup').click();
    assert.equal(await page.locator('.ticket-lineup section').count(),4);
    assert.match(await page.locator('.ticket-lineup').innerText(),/파자마[\s\S]*롱패딩[\s\S]*교복[\s\S]*세일러복/);
    await page.locator('#shop-lineup-back').click();
    if(width===390){
      await page.locator('#buy-costume-daily').click();await page.locator('#shop-confirm').click();
      assert.equal(await page.locator('.shop-balance strong').innerText(),'60');
    }
    if(width!==844)await page.screenshot({path:fileURLToPath(new URL(`artifacts/costume-shop-${width}.png`,root))});
    await page.locator('#shop-back').click();
    await page.locator('#wardrobe-hotspot').click();
    assert.equal(await page.locator('.wardrobe-variants button').count(),3);
    const wardrobe=await page.evaluate(()=>({panel:document.querySelector('.wardrobe-panel').clientWidth,scroll:document.querySelector('.wardrobe-panel').scrollWidth,doc:document.documentElement.scrollWidth,width:innerWidth}));
    assert.ok(wardrobe.scroll<=wardrobe.panel+1&&wardrobe.doc<=wardrobe.width+1,`${width}x${height} wardrobe overflow ${JSON.stringify(wardrobe)}`);
    if(width!==844)await page.screenshot({path:fileURLToPath(new URL(`artifacts/costume-wardrobe-${width}.png`,root))});
    if(width===390){
      await page.locator('[data-costume-draw="daily"]').click();
      assert.equal(await page.locator('.costume-reveal img').evaluate(img=>img.complete&&img.naturalWidth),512);
      await page.locator('#costume-reveal-done').click();
      const chosen=await page.evaluate(()=>{const id=__costumes.profile.costumesOwned[0],costume=__costumes.costumes.find(c=>c.id===id);return {id,hero:costume.hero,index:__costumes.costumes.indexOf(costume)};});
      await page.locator(`[data-wardrobe-hero="${chosen.hero}"]`).click();
      await page.locator(`[data-equip="${chosen.id}"]`).click();
      assert.equal(await page.locator(`[data-equip="${chosen.id}"]`).getAttribute('class'),'active');
      await page.locator('#wardrobe-back').click();
      await page.locator(`[data-hero="${chosen.hero}"]`).click();
      assert.equal(await page.locator('.hero-large').evaluate(img=>img.complete&&img.naturalWidth),512);
      assert.equal(await page.locator('.hero-large').getAttribute('src'),await page.evaluate(index=>__costumes.art.urls.costumes[index],chosen.index));
      await page.screenshot({path:fileURLToPath(new URL('artifacts/costume-title-390.png',root))});
      await page.locator('#dungeons').click();await page.locator('[data-difficulty="abyss"]').click();await page.locator('#dungeon-done').click();
      await page.locator('#launch').click();
      if(await page.locator('#help-done').count())await page.locator('#help-done').click();
      await page.waitForFunction(()=>__costumes.game&&__costumes.art.costumes[__costumes.game.costumeIndex]);
      assert.equal(await page.evaluate(()=>__costumes.game.costumeIndex),chosen.index);
      await page.evaluate(()=>{
        const renderer=__costumes.renderer,original=renderer.sprite.bind(renderer),selected=__costumes.art.costumes[__costumes.game.costumeIndex];
        renderer.sprite=function(image,x,y,size,...rest){if(image===selected&&size===82)globalThis.__costumeDraw={size,imageWidth:image.naturalWidth,imageHeight:image.naturalHeight};return original(image,x,y,size,...rest);};
      });
      await page.waitForFunction(()=>globalThis.__costumeDraw);
      assert.deepEqual(await page.evaluate(()=>__costumeDraw),{size:82,imageWidth:512,imageHeight:512});
      await page.screenshot({path:fileURLToPath(new URL('artifacts/costume-battle-390.png',root))});
      const shards=await page.evaluate(()=>__costumes.profile.dreamShards);
      await page.evaluate(()=>__costumes.finish(true));
      assert.match(await page.locator('.panel').innerText(),/심연 업적 완료! 꿈의결정 3개/);
      assert.equal(await page.evaluate(()=>__costumes.profile.dreamShards),shards+3);
      await page.evaluate(()=>__costumes.finish(true));
      assert.equal(await page.evaluate(()=>__costumes.profile.dreamShards),shards+3);
      await page.locator('#sortie-return').click();
      await page.locator('#achievements').click();
      assert.equal(await page.locator('.achievement.complete').count(),1);
      await page.locator('#achievements-close').click();
    }
    assert.deepEqual(errors,[],`${width}x${height} page errors`);
    assert.deepEqual(external,[],`${width}x${height} external requests`);
    await context.close();
  }
  console.log('offline costume shop, lineup, wardrobe, title and battle draw passed');
} finally {await browser.close();}
