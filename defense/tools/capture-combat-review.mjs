// Reproducible evidence from the real review renderer, never generated artwork.
// Usage: node defense/tools/capture-combat-review.mjs OUTPUT_DIRECTORY
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createHeroDefenseV2Server}=require('../../scripts/serve_defense.js');
const out=path.resolve(process.argv[2]||'defense/artifacts/combat-review');await mkdir(out,{recursive:true});
const server=createHeroDefenseV2Server();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,recordVideo:{dir:out,size:{width:390,height:844}}});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/tools/combat-review.html`);
  await page.waitForFunction(()=>document.body.dataset.ready==='true');
  for(const hero of ['zeke','mushroom_king','ancient_dragon','red_dragon']){
    await page.locator('#hero').selectOption(hero);await page.locator('#play').click();
    await page.waitForFunction(()=>Number(document.querySelector('#review').dataset.frame)>=240);
    await page.locator('#play').click();
  }
  await page.locator('#layout').selectOption('dense');await page.locator('#speed').selectOption('2');
  await page.locator('#play').click();await page.waitForFunction(()=>Number(document.querySelector('#review').dataset.frame)>=360);await page.locator('#play').click();
  const video=page.video();await context.close();await video.saveAs(path.join(out,'attack-shapes-motion.webm'));
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Recorded actual 1x attacks and 2x dense scene: '+path.join(out,'attack-shapes-motion.webm'));
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
