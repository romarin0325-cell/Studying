import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true}).catch(()=>chromium.launch({headless:true,channel:'chrome'}));
const errors=[];
try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(pathToFileURL(path.resolve('defense/dist/StarGardenCompanionGuide.html')).href);
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('일반 공격 재생'));
  assert.equal(await page.locator('[data-hero]').count(),61);
  assert.match(await page.locator('#count').innerText(),/동료 58명 · 변신 3형태/);
  await page.locator('#search').fill('사쿠라');
  assert.equal(await page.locator('[data-hero]').count(),1);
  await page.locator('[data-hero="sakura"]').click();
  assert.match(await page.locator('#detail').innerText(),/폭염부/);
  await page.locator('#skill').click();
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='필살기 시전 중');
  await page.screenshot({path:'defense/test-results/companion-guide.png',fullPage:true});
  await page.locator('#search').fill('');
  for(const [id,expected] of [['succubus','받는 피해 +15%'],['mad_scientist','받는 피해 +15%'],['silent_librarian','받는 피해 +10%']]){
    await page.locator(`[data-hero="${id}"]`).click();
    assert.match(await page.locator('#detail').innerText(),new RegExp(expected.replace('+','\\+')));
  }
  await page.locator('[data-hero="miracle_wing"]').click();
  await page.locator('#skill').click();
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('시전할 수 없습니다'));
  assert.deepEqual(errors,[]);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile page overflows horizontally');
  console.log('PASS: 58 companions, 3 forms, search, real attack and skill, form condition, mobile layout; no page errors');
}finally{await browser.close();}
