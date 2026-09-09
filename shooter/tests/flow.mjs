import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {fileURLToPath,pathToFileURL} from 'node:url';
import fs from 'node:fs/promises';
const file=fileURLToPath(new URL('../dist/AstralBloom.html',import.meta.url));
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},offline:true});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(file).href);await page.waitForFunction(()=>window.astralDiagnostics?.ready);
  await page.clock.install();
  await page.locator('#mode').click();await page.locator('#launch').click();await page.locator('#help-done').click();
  const phases=[];
  for(let i=0;i<9;i++){
    await page.clock.runFor(10000); const state=await page.evaluate(()=>window.astralDiagnostics);phases.push(state.phase);
    if(state.phase==='upgrade')break;
    if(state.bombs>0 && await page.locator('#bomb').isEnabled())await page.locator('#bomb').click();
  }
  assert.equal((await page.evaluate(()=>window.astralDiagnostics)).phase,'upgrade','Actual offline UI must reach the first blessing screen');
  await page.screenshot({path:fileURLToPath(new URL('../artifacts/upgrade-mobile.png',import.meta.url))});
  await page.locator('[data-upgrade="power"]').click();await page.clock.runFor(4000);
  const state=await page.evaluate(()=>window.astralDiagnostics);
  assert.equal(state.stage,1);assert.equal(state.phase,'wave');assert.ok(state.stats.shots>100);
  await page.screenshot({path:fileURLToPath(new URL('../artifacts/garden-mobile.png',import.meta.url))});
  assert.deepEqual(errors,[]);
  const report={phases,result:state,errors};await fs.writeFile(new URL('../artifacts/flow.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({phases,stage:state.stage,phase:state.phase,errors}));
}finally{await browser.close()}
