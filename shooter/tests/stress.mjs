import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4188/tests/stress.html');
  await page.waitForFunction(()=>globalThis.stressResult?.frames>360,null,{timeout:30000});
  const result=await page.evaluate(()=>globalThis.stressResult);
  await page.screenshot({path:new URL('../artifacts/stress-mobile.png',import.meta.url).pathname.replace(/^\/(.:)/,'$1')});
  await fs.writeFile(new URL('../artifacts/stress.json',import.meta.url),JSON.stringify({...result,errors},null,2));
  console.log(JSON.stringify({...result,errors}));
}finally{await browser.close()}
