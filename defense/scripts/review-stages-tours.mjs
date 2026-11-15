// Screenshots for the intro chapter / flexible stage list, the feature tours and the free relic summon.
// Builds nothing: point it at a built normal and Bright page (default: defense/dist).
//   node defense/scripts/review-stages-tours.mjs [--dir <folder with StarGardenDefense.html>] [--out defense/test-results/stages-tours]
// Every shot is 390x844 and is listed in index.html next to the pictures.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {createProfile,SAVE_KEY} from '../src/profile.js';
import {FTUE_STEPS,UNLOCKS} from '../src/beginner.js';
import {HERO,LATE_COMPANIONS,PART_STAGES} from '../src/content.js';
import {eventWindow} from '../src/preview/season.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),opt=(n,f)=>{const i=args.indexOf('--'+n);return i<0?f:args[i+1];};
const dir=path.resolve(opt('dir',path.join(root,'dist'))),out=path.resolve(opt('out',path.join(root,'test-results','stages-tours')));
await fs.mkdir(out,{recursive:true});
const NOW=Date.parse('2026-11-16T03:00:00Z');
// A player past the first session: tutorial done, first-week board closed, this week's event read.
function player(cleared,{seen=Object.keys(UNLOCKS),tours=[],relics=false}={}){
  const p=createProfile(NOW);p.cleared=cleared;p.dreams=5000;p.dust=3000;p.firstTen=true;p.beginner=null;
  p.ftue={legacy:false,done:[...FTUE_STEPS],seen:seen.filter(id=>UNLOCKS[id]<=cleared),skipped:false,tours};
  for(const id of ['great_detective','santa','guardian','storm_sage','red_dragon','aurora'])p.heroes[id].owned=true;
  if(relics)for(const id of Object.keys(p.relics).slice(0,4))p.relics[id].owned=true;
  p.noticeLate=cleared>=PART_STAGES?LATE_COMPANIONS.filter(id=>!HERO[id].hidden):[];p.eventSeen=eventWindow(NOW).id;p.clockAt=NOW;p.idleAt=NOW;p.basket.at=NOW-9*3600e3;
  return p;
}
// Playwright's Chromium when installed, otherwise the system Edge.
const browser=await chromium.launch({headless:true}).catch(()=>chromium.launch({headless:true,channel:'msedge'})),shots=[],errors=[];
async function open(file,profile){
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:1});
  const page=await context.newPage();await page.clock.setFixedTime(NOW+60000);
  page.on('pageerror',e=>errors.push(file+': '+e.message));
  const url=pathToFileURL(path.join(dir,file)).href;
  await page.route(url,r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>fixture</title>'}),{times:1});
  await page.goto(url);await page.evaluate(({key,profile})=>localStorage.setItem(key,JSON.stringify(profile)),{key:SAVE_KEY,profile});
  await page.goto(url);await page.locator('.scene-partner').waitFor();await page.evaluate(()=>document.fonts.ready);
  return {context,page};
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function shot(page,name,note){const file=name+'.png';await wait(450);await page.screenshot({path:path.join(out,file),animations:'disabled'});shots.push({file,note});}
const LABEL={adventure:'모험',garden:'정원',summon:'소환',home:'홈'};
const nav=(page,id)=>page.getByRole('button',{name:LABEL[id],exact:true}).click();
for(const [theme,file] of [['night','StarGardenDefense.html'],['bright','StarGardenDefenseBright.html']]){
  // Stage list: a new player in the intro chapter, and a player in part two.
  {const {context,page}=await open(file,player(0,{seen:[]}));await nav(page,'adventure');await shot(page,`${theme}-stages-intro`,'신규: 1장 별빛 산책, 제1부 6장, 0/54');await context.close();}
  {const {context,page}=await open(file,player(100,{tours:['garden','challenge','season','library','relic','dispatch']}));await nav(page,'adventure');
    await page.locator('[data-mode="main"]').click({timeout:3000}).catch(()=>{});await page.locator('[data-part="2"]').click();await shot(page,`${theme}-stages-part2`,'제2부 12장(첫 햇살의 언덕), 스테이지 100–108');await context.close();}
  if(theme==='bright'&&!args.includes('--all'))continue;
  // Feature tours, one per feature, on the real screens.
  {const {context,page}=await open(file,player(2));await nav(page,'garden');await shot(page,`${theme}-tour-garden-1`,'정원: 장미 화단 물 주기');
    await page.locator('[data-bed-grow="rose"]').click();await shot(page,`${theme}-tour-garden-2`,'정원: 선물 바구니 설명 + 다음 버튼');await context.close();}
  {const {context,page}=await open(file,player(3));await nav(page,'adventure');await shot(page,`${theme}-tour-challenge-1`,'모험: 드래프트 탭');
    await page.locator('[data-mode="weekly"]').click();await shot(page,`${theme}-tour-challenge-2`,'드래프트 카드 설명');
    await page.locator('.coach-next').click();await shot(page,`${theme}-tour-challenge-3`,'토벌 탭');await context.close();}
  {const {context,page}=await open(file,player(4,{tours:['season','challenge','garden']}));await page.locator('[data-action="library"]').first().click();await shot(page,`${theme}-tour-library`,'서재: 오늘의 별');await context.close();}
  {const {context,page}=await open(file,player(5,{tours:['season','challenge','garden','library']}));await nav(page,'summon');await shot(page,`${theme}-tour-relic-1`,'소환: 유물 탭');
    await page.locator('[data-banner="relic"]').click();await shot(page,`${theme}-tour-relic-2`,'유물 무료 1회');
    await page.locator('[data-draw="1"]').click();await wait(600);await page.locator('#sheet [data-action="close"]').last().click().catch(()=>{});await wait(300);
    for(let i=0;i<4&&await page.locator('#sheet').isVisible().catch(()=>false);i++){await page.locator('#sheet [data-action="close"]').last().click().catch(()=>{});await wait(300);}
    await shot(page,`${theme}-tour-relic-3`,'장착하러 가기');
    await page.locator('.coach-next').click().catch(()=>{});await shot(page,`${theme}-tour-relic-4`,'편성 창 유물 탭: 자동 장착');await context.close();}
  {const {context,page}=await open(file,player(9,{tours:['season','challenge','garden','library','relic']}));await nav(page,'garden');await shot(page,`${theme}-tour-dispatch`,'정원: 파견 슬롯');await context.close();}
}
await browser.close();
const html=`<!doctype html><meta charset="utf-8"><title>Stages and tours review</title><style>body{font-family:system-ui;background:#1b1d26;color:#eee;margin:16px}main{display:flex;flex-wrap:wrap;gap:16px}figure{margin:0;width:260px}img{width:260px;border:1px solid #444;border-radius:8px}figcaption{font-size:13px;margin-top:4px}</style><h1>스테이지·튜토리얼·유물 무료 소환 검토</h1><main>${shots.map(s=>`<figure><a href="${s.file}"><img src="${s.file}"></a><figcaption><b>${s.file}</b><br>${s.note}</figcaption></figure>`).join('')}</main>`;
await fs.writeFile(path.join(out,'index.html'),html);
console.log(shots.length+' shots in '+out);if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
