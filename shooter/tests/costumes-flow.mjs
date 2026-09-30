import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { COSTUMES } from '../meta.js';

const root=new URL('../',import.meta.url);
const original=await fs.readFile(new URL('dist/AstralBloom.html',root),'utf8');
const html=original.replace('<head>',`<head><base href="${new URL('dist/',root).href}">`)
  .replace("Object.defineProperty(globalThis, 'astralDiagnostics'", "globalThis.__costumes={get game(){return game},get profile(){return profile},get art(){return art},get renderer(){return renderer},save,finish,costumes:COSTUMES};\nObject.defineProperty(globalThis, 'astralDiagnostics'");
const file=new URL('artifacts/costumes-flow.html',root);
await fs.mkdir(new URL('artifacts/',root),{recursive:true});await fs.writeFile(file,html);
const browser=await chromium.launch({headless:true}),checks=[];
try {
  for(const [width,height] of [[320,568],[390,844],[430,932],[844,390]]) {
    const context=await browser.newContext({viewport:{width,height},offline:true,hasTouch:true,reducedMotion:'reduce'});
    const page=await context.newPage(),errors=[],external=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>{if(!request.url().startsWith('file:')&&!request.url().startsWith('data:'))external.push(request.url());});
    await page.clock.install({time:new Date(2026,8,27,12)});
    await page.goto(file.href);await page.waitForFunction(()=>astralDiagnostics?.ready);
    const click=selector=>page.locator(selector).click();
    const shot=name=>page.screenshot({path:fileURLToPath(new URL(`artifacts/ui-${name}-${width}.png`,root)),animations:'disabled'});
    const profile=()=>page.evaluate(()=>JSON.parse(JSON.stringify(__costumes.profile)));
    const checkFrame=async()=>{
      const geometry=await page.evaluate(()=>{
        const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};};
        const p=document.querySelector('.menu-panel');
        return {panel:rect(p),close:rect(p.querySelector('[data-dismiss]')),footer:rect(p.querySelector('.menu-footer')),overflow:p.scrollWidth-p.clientWidth,doc:document.documentElement.scrollWidth-innerWidth};
      });
      assert.ok(geometry.panel.x>=0&&geometry.panel.right<=width&&geometry.panel.y>=0&&geometry.panel.bottom<=height,JSON.stringify(geometry));
      assert.ok(geometry.close.y>=geometry.panel.y&&geometry.close.bottom<=height,JSON.stringify(geometry));
      assert.ok(geometry.footer.bottom<=height&&geometry.overflow<=1&&geometry.doc<=1,JSON.stringify(geometry));
    };
    const checkReveal=async()=>{
      await checkFrame();
      const parts=await page.evaluate(()=>{
        const a=document.querySelector('.reveal-stage img').getBoundingClientRect(),b=document.querySelector('.reveal-caption').getBoundingClientRect();
        return {separated:a.bottom<=b.top+1||a.right<=b.left+1,ratio:a.width/a.height,image:a.toJSON(),caption:b.toJSON()};
      });
      if(!parts.separated)await shot('reveal-failure');
      assert.equal(parts.separated,true,`${width}: reveal image and text overlap ${JSON.stringify(parts)}`);assert.ok(Math.abs(parts.ratio-1)<.01);
    };
    await page.evaluate(()=>{__costumes.profile.dreamShards=70;});
    await click('#shop');await checkFrame();
    assert.equal(await page.locator('.costume-product:visible').count(),4);
    assert.equal(await page.locator('.shop-lineup-trigger').getAttribute('aria-label'),'코스튬 티켓 상세 라인업');
    assert.equal(await page.locator('.shop-content').evaluate(el=>el.scrollHeight<=el.clientHeight+1),true,`${width}: ticket shop requires scrolling`);
    await shot('shop');await click('#shop-lineup');await checkFrame();
    assert.equal(await page.locator('.ticket-lineup section').count(),4);
    assert.match(await page.locator('.ticket-lineup').innerText(),/파자마[\s\S]*롱패딩[\s\S]*교복[\s\S]*세일러복/);
    await click('#shop-lineup-back');await click('#buy-costume-miracle');await checkFrame();
    assert.equal(await page.locator('[data-miracle]').count(),12);assert.equal(await page.locator('#miracle-confirm').isDisabled(),true);
    await click('[data-miracle="luna-gothic"]');await shot('miracle');await click('#miracle-back');
    assert.equal((await profile()).dreamShards,70);
    // Two activations of the original control must settle only one transaction.
    await page.evaluate(()=>{const random=Math.random;Math.random=()=>0;const action=document.querySelector('#buy-costume-daily').onclick;action();action();Math.random=random;});
    assert.deepEqual([(await profile()).dreamShards,(await profile()).costumesEquipped[6]],[60,'night-pajama']);
    assert.equal((await profile()).costumeTickets.daily,0);
    await checkReveal();await shot('costume-reveal');await click('#costume-reveal-done');
    await page.evaluate(()=>{const random=Math.random;Math.random=()=>0;document.querySelector('#buy-costume-daily').click();Math.random=random;});
    assert.equal((await profile()).dreamShards,53);assert.equal((await profile()).costumesOwned.length,1);
    assert.match(await page.locator('.reward-note').innerText(),/꿈의결정\s*\+3/);await click('#costume-reveal-done');
    await click('#buy-costume-miracle');await click('[data-miracle="luna-gothic"]');await click('#miracle-confirm');
    assert.deepEqual([(await profile()).dreamShards,(await profile()).costumesEquipped[1]],[23,'luna-gothic']);
    await click('#costume-reveal-done');await click('#shop-close');
    await page.reload();await page.waitForFunction(()=>astralDiagnostics?.ready);
    assert.deepEqual([(await profile()).dreamShards,(await profile()).costumesEquipped[6],(await profile()).costumesEquipped[1]],[23,'night-pajama','luna-gothic']);
    assert.equal(await page.locator('#wardrobe-hotspot').innerText(),'');
    await click('#wardrobe-hotspot');await checkFrame();
    assert.equal(await page.locator('.wardrobe-panel img').count(),1);assert.equal(await page.locator('[data-preview]').count(),3);
    await click('[data-wardrobe-hero="6"]');assert.equal(await page.locator('[data-preview="night-pajama"]').getAttribute('aria-pressed'),'true');
    await shot('wardrobe');await click('[data-preview="night-longcoat"]');
    assert.equal(await page.locator('#wardrobe-equip').innerText(),'상점에서 만나기');
    assert.equal((await profile()).costumesEquipped[6],'night-pajama');
    await click('[data-preview=""]');await click('#wardrobe-equip');assert.equal((await profile()).costumesEquipped[6],undefined);
    await click('#wardrobe-back');

    await click('#library');await click('[data-tab="collocation"]');await checkFrame();
    assert.equal(await page.locator('#library-search').isVisible(),false);assert.equal(await page.locator('#library-all').count(),0);
    const visibleRows=await page.locator('#library-list').evaluate(list=>[...list.children].filter(el=>el.getBoundingClientRect().bottom<=list.getBoundingClientRect().bottom).length);
    assert.ok(visibleRows>=(width===320?4:width===844?2:6),`${width}: only ${visibleRows} visible phrases`);
    assert.equal(await page.locator('.library-entry').first().locator('small').count(),1);
    await shot('library');await page.locator('#library-list').evaluate(el=>{el.scrollTop=el.scrollHeight;});await checkFrame();
    await click('#library-search-toggle');await page.locator('#library-search').fill('conduct');assert.equal(await page.locator('.library-entry').count(),1);
    await click('#library-search-toggle');assert.equal(await page.locator('.library-entry').count(),30);
    await click('[data-tab="grammar"]');await page.locator('[data-lecture]').first().click();await checkFrame();
    assert.equal(await page.locator('.mentor-portrait img').getAttribute('alt'),'루미');
    assert.ok(await page.locator('.lecture-copy').evaluate(el=>el.scrollHeight>el.clientHeight));await shot('lecture');
    await click('#lecture-close');await click('#library-close');

    // A duplicate relic shows only its refund, without an appended wallet balance.
    await page.evaluate(()=>{if(!__costumes.profile.owned.includes('pendant'))__costumes.profile.owned.push('pendant');__costumes.profile.tickets=[{difficulty:'normal',dungeon:0}];});
    await click('#equipment');await checkFrame();await shot('equipment');await click('#draw-ticket');
    await page.evaluate(()=>{const random=Math.random;Math.random=()=>0;document.querySelector('#quiz-decline').click();Math.random=random;});
    await checkReveal();assert.doesNotMatch(await page.locator('.reveal-panel').innerText(),/보유 꿈의결정/);assert.match(await page.locator('.reward-note').innerText(),/꿈의결정\s*\+/);
    await shot('relic-reveal');await click('#reveal-done');await click('#equipment-close');

    if(width===390){
      // Exercise all twelve through the actual wardrobe, title, battle loader and canvas draw.
      await page.evaluate(()=>{__costumes.profile.costumesOwned=__costumes.costumes.map(c=>c.id);});
      for(const [index,costume] of COSTUMES.entries()){
        await click('#wardrobe-hotspot');await click(`[data-wardrobe-hero="${costume.hero}"]`);await click(`[data-preview="${costume.id}"]`);
        if(await page.locator('#wardrobe-equip').isEnabled())await click('#wardrobe-equip');
        await click('#wardrobe-back');await click(`[data-hero="${costume.hero}"]`);
        assert.equal(await page.locator('.hero-large').getAttribute('src'),await page.evaluate(i=>__costumes.art.urls.costumes[i],index));
        const box=await page.locator('.hero-large').boundingBox();assert.equal(box.width,box.height);
        if(index===2)await shot('title');
        await click('#launch');if(await page.locator('#help-done').count())await click('#help-done');
        await page.waitForFunction(()=>__costumes.game&&__costumes.art.costumes[__costumes.game.costumeIndex]);
        assert.equal(await page.evaluate(()=>__costumes.game.costumeIndex),index);
        const draw=await page.evaluate(()=>{
          const {game:g,renderer:r,art}=__costumes,image=art.costumes[g.costumeIndex],original=r.c.drawImage;
          let observed;g.player.recoil=.8;g.player.tilt=.1;r.shake=0;
          r.c.drawImage=function(img,x,y,w,h){if(img===image&&w===82){const m=this.getTransform();observed={width:w,height:h,center:[x+w/2,y+h/2],at:[m.e/r.scaleX,m.f/r.scaleY],hit:[g.player.x,g.player.y],canvas:[img.naturalWidth,img.naturalHeight]};}return original.apply(this,arguments);};
          r.render(g);r.c.drawImage=original;return {...observed,radius:g.player.radius};
        });
        assert.ok(draw,`${costume.id}: actual canvas draw missing`);assert.deepEqual(draw.center,[0,0]);assert.deepEqual(draw.canvas,[512,512]);assert.equal(draw.height,82);
        assert.ok(Math.abs(draw.at[0]-draw.hit[0])<.001&&Math.abs(draw.at[1]-draw.hit[1])<.001,`${costume.id}: body/hitbox drift`);
        assert.equal(draw.radius,({2:6,4:4,6:4})[costume.hero]||5,`${costume.id}: cosmetic changed the hit radius`);
        if([1,3,4].includes(costume.hero))await shot('battle-'+costume.id);
        if(index===2)await shot('battle');
        await click('#pause');await click('#return');
      }
      await click('#dungeons');await click('[data-difficulty="abyss"]');await click('#dungeon-done');await click('#launch');
      await page.waitForFunction(()=>__costumes.game);const shards=(await profile()).dreamShards;
      await page.evaluate(()=>__costumes.finish(true));assert.equal((await profile()).dreamShards,shards+3);
      assert.match(await page.locator('.panel').innerText(),/심연 업적 완료! 꿈의결정 3개/);
      await page.evaluate(()=>__costumes.finish(true));assert.equal((await profile()).dreamShards,shards+3);
      await click('#sortie-return');await click('#achievements');assert.equal(await page.locator('.achievement.complete').count(),1);await click('#achievements-close');
      // Both direct and chosen purchases must fully roll back if saving fails.
      for(const tier of ['daily','miracle']){
        await page.evaluate(()=>{__costumes.profile.dreamShards=80;__costumes.profile.costumesOwned=[];__costumes.profile.costumesEquipped={};__costumes.save();});
        const before=await profile();await click('#shop');
        if(tier==='miracle'){await click('#buy-costume-miracle');await click('[data-miracle="rumi-school"]');}
        await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new Error('Test storage full');};});
        await click(tier==='daily'?'#buy-costume-daily':'#miracle-confirm');
        assert.deepEqual(await profile(),before);assert.equal(await page.locator('.costume-reveal').count(),0);
        await page.reload();await page.waitForFunction(()=>astralDiagnostics?.ready);assert.deepEqual(await profile(),before);
      }
      await page.evaluate(()=>{__costumes.profile.dreamShards=0;__costumes.profile.costumeTickets.daily=1;});await click('#shop');
      assert.match(await page.locator('#buy-costume-daily').innerText(),/보유 티켓 사용/);await click('#buy-costume-daily');
      assert.equal((await profile()).dreamShards,0);assert.equal((await profile()).costumeTickets.daily,0);assert.equal((await profile()).costumesOwned.length,1);
      await click('#costume-reveal-done');await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
      assert.equal(await page.evaluate(()=>document.activeElement.closest('.menu-panel')!==null),true);
      await page.keyboard.press('Escape');assert.equal(await page.locator('#modal').isHidden(),true);
    }
    assert.deepEqual(errors,[],`${width}x${height} page errors`);assert.deepEqual(external,[],`${width}x${height} external requests`);
    checks.push(`${width}x${height}: offline shop, immediate equip/refund, miracle cancel/choice, save/reload, wardrobe, compact library, lecture and non-overlapping reveals`);
    await context.close();
  }
  checks.push('All 12 costumes: wardrobe/title/battle texture, undistorted square canvas, rendered center equals player hitbox during recoil/tilt; failed storage rolls back both purchase paths; legacy tickets redeemed');
  await fs.writeFile(new URL('artifacts/costumes-flow.json',root),JSON.stringify({checks},null,2));console.log(JSON.stringify({checks},null,2));
} finally {await browser.close();}
