import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const url = new URL('../dist/DREAMWEAVER.html', import.meta.url).href;
const reviewDir = process.env.CARD_HEADER_REVIEW_DIR;
if (reviewDir) await fs.mkdir(reviewDir, {recursive: true});
const browser = await chromium.launch();
const errors = [];
const results = [];
const sizes = [
  {width:320,height:568}, {width:360,height:640}, {width:390,height:844},
  {width:412,height:915}, {width:760,height:800}, {width:844,height:390},
  {width:1280,height:800}
];
try {
  for (const size of sizes) {
    const page = await browser.newPage({viewport:size, reducedMotion:'reduce', offline:true});
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    await page.waitForFunction(() => Astra.ready && RPG._featuresInstalled);
    for (const theme of ['astra','strawberry','dreamsky']) {
      for (const mode of ['origin','artifact','artifact_chaos','artifact_reserve']) {
        await page.evaluate(({theme,mode}) => {
          Astra.setTheme(theme);
          RPG.loadGlobalData();
          Object.assign(RPG.state, {mode,gameType:'endless',tickets:20,enemyScale:0,
            artifacts:[],deck:['marshmallow','kobold','golem'],inventory:['marshmallow','kobold','golem']});
          RPG.toMenu();
          RPG.startBattleInit();
        }, {theme,mode});
        await page.locator('#screen-battle').waitFor({state:'visible'});
        for (const turn of [1,999]) {
          // Use the two longest real field labels, including the bracket separators.
          const geometry = await page.evaluate(turn => {
            const fieldIds = ['sun_bless','moon_bless','sanctuary','goddess_descent',
              'destiny_oath','earth_bless','twinkle_party','star_powder','valentine','arena','reaper_realm','gale'];
            const longest = fieldIds.sort((a,b) => BUFF_NAMES[b].length - BUFF_NAMES[a].length).slice(0,2);
            const header = document.querySelector('.battle-header');
            const field = document.getElementById('field-buff-box');
            const artifact = document.getElementById('btn-battle-artifact-check');
            const samples = [];
            RPG.battle.turn = turn;
            for (const count of [0,1,2,fieldIds.length]) {
              RPG.battle.fieldBuffs = (count <= 2 ? longest.slice(0,count) : fieldIds).map(name => ({name}));
              RPG.renderBattlefield();
              const css = getComputedStyle(field), box = field.getBoundingClientRect();
              const head = header.getBoundingClientRect(), left = header.firstElementChild.getBoundingClientRect();
              const range = document.createRange();range.selectNodeContents(field);
              const text = count ? range.getBoundingClientRect() : null;
              samples.push({count,display:css.display,overflowY:css.overflowY,overflowX:css.overflowX,
                width:field.clientWidth,scrollWidth:field.scrollWidth,height:field.clientHeight,scrollHeight:field.scrollHeight,
                headerHeight:head.height,headerWidth:header.clientWidth,headerScrollWidth:header.scrollWidth,
                fits:head.left >= 0 && head.right <= innerWidth && box.right <= head.right && box.left >= left.right,
                textFits:!count || (text.top >= box.top && text.bottom <= box.bottom
                  && (count > 2 || (text.left >= box.left && text.right <= box.right))),
                artifactFits:getComputedStyle(artifact).display === 'none' || (() => {
                  const r = artifact.getBoundingClientRect();return r.top >= head.top && r.bottom <= head.bottom;
                })()});
            }
            // All field information stays reachable when the row really overflows.
            field.scrollLeft = field.scrollWidth;
            const scrollReachedEnd = field.scrollLeft + field.clientWidth >= field.scrollWidth - 1;
            RPG.battle.fieldBuffs = longest.map(name => ({name}));RPG.renderBattlefield();field.scrollLeft = 0;
            return {samples,scrollReachedEnd,headerText:header.firstElementChild.textContent,
              turn:document.getElementById('bt-turn').textContent,labels:longest.map(id => BUFF_NAMES[id]),
              artifactVisible:getComputedStyle(artifact).display !== 'none'};
          }, turn);
          const context = `${theme} ${mode} ${size.width}x${size.height} turn ${turn}`;
          assert.equal(geometry.turn,String(turn),context);
          assert.equal(geometry.artifactVisible,mode !== 'origin',context);
          for (const sample of geometry.samples) {
            const label = `${context}: ${JSON.stringify(sample)}`;
            assert.equal(sample.headerHeight,40,label);
            assert.ok(sample.headerScrollWidth <= sample.headerWidth + 1,label);
            assert.ok(sample.artifactFits,label);
            if (!sample.count) {assert.equal(sample.display,'none',label);continue;}
            assert.ok(sample.fits,label);
            assert.ok(sample.textFits,label);
            assert.ok(sample.scrollHeight <= sample.height,label);
            assert.equal(sample.overflowY,'hidden',label);
            if (sample.count <= 2) assert.ok(sample.scrollWidth <= sample.width,label);
          }
          assert.ok(geometry.scrollReachedEnd,context);
          assert.doesNotMatch(geometry.headerText,/ENCOUNTER/,context);
          if (turn === 1 && mode === 'artifact_chaos' && reviewDir && [320,390,1280].includes(size.width)) {
            await page.screenshot({path:path.join(reviewDir,`${theme}-${mode}-${size.width}.png`)});
          }
          results.push({context,labels:geometry.labels,width:geometry.samples[2].width});
        }
        await page.locator('#field-buff-box').click();
        await page.locator('#modal-info').waitFor({state:'visible'});
        assert.match(await page.locator('#modal-info').innerText(),/필드 버프/);
        await page.keyboard.press('Escape');
      }
    }
    await page.close();
  }
  assert.deepEqual(errors,[],'No runtime errors');
  if (reviewDir) await fs.writeFile(path.join(reviewDir,'measurements.json'),JSON.stringify(results,null,2));
  console.log(`Battle header: ${results.length} offline viewport/theme/mode/turn combinations passed; 0/1/2/crowded buffs, details and horizontal overflow access.`);
} finally {
  await browser.close();
}
