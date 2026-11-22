// Before/after captures of the screens the public tempo changed: the original defense/ build next to the public build,
// same clock, same account shape, 390x844, night and bright. Writes PNGs and a review page.
//   node defense_public/scripts/review-tempo.mjs            (needs both dist builds and the installed Chrome)
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import sharp from 'sharp';

const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const OUT=path.join(root,'defense_public/docs/review/public-tempo-20261121');
const TIME=Date.parse('2026-11-23T03:10:00Z');// Monday 12:10 KST
const BUILDS={
  before:{dir:'defense',files:{night:'StarGardenDefense.html',bright:'StarGardenDefenseBright.html'}},
  after:{dir:'defense_public',files:{night:'StarGardenPublic.html',bright:'StarGardenPublicBright.html'}},
};
const SHOTS=['lobby','summon-normal','summon-season','rates','draft','hunt','event','library','garden','sprout','settings','result'];
async function load(dir){
  const src=f=>pathToFileURL(path.join(root,dir,'src',f)).href;
  const [profile,content,economy,season,battle,engine,beginner]=await Promise.all(['profile.js','content.js','economy.js','preview/season.js','battle.js','combat/engine.js','beginner.js'].map(f=>import(src(f))));
  return {profile,content,economy,season,battle,engine,beginner};
}
const OWNED=['star_boy','snow_rabbit','night_rabbit','siren','great_detective','silver_rabbit','mushroom_king','guardian','santa','red_dragon','aurora','avalanche_maid','storm_sage','flame_sage','time_magician','phantom','zeke','queen'];
function veteran(m,p){p.ftue={legacy:true,done:[],seen:[],skipped:false,tours:[]};p.beginner=null;p.firstTen=true;p.eventSeen=m.season.eventWindow(TIME).id;return p;}
function account(m){
  const p=veteran(m,m.profile.createProfile(TIME));
  for(const id of OWNED){p.heroes[id].owned=true;p.heroes[id].enhance=3;}
  p.heroes.star_boy.bond=6;p.heroes.star_boy.bondXp=20;
  for(const id of Object.keys(p.relics).slice(0,8))p.relics[id].owned=true;
  p.equipped=Object.keys(p.relics).slice(0,3);
  p.deck=['zeke','queen','storm_sage','santa','siren'];p.partner='star_boy';
  p.cleared=30;p.dreams=4200;p.dust=2600;p.beds.rose=22;p.beds.spring=8;
  p.idleAt=TIME-150*60000;p.basket={at:TIME-150*60000,next:0};
  const H=m.content.TUNING.dispatchHours*3600000;
  p.dispatches=[{slot:0,hero:'mushroom_king',start:TIME-H/3,end:TIME-H/3+H,reward:30,dust:300},{slot:1,hero:'red_dragon',start:TIME-H-60000,end:TIME-60000,reward:30,dust:300}];
  p.study.library={index:2,stars:3,unlocked:['boat','hat'],day:''};
  // No request arrives during the captures (its toast would cover the summon buttons).
  p.requests={next:TIME+24*3600000,active:[],claimed:[],after:[],read:[]};
  // The public build announces the late companions at stage 27; this account has already read it.
  p.noticeLate=m.content.LATE_COMPANIONS.filter(id=>!m.content.HIDDEN.includes(id));
  return p;
}
function sprout(m){
  const p=m.profile.createProfile(TIME),b=m.beginner;
  p.ftue={legacy:false,done:[...b.FTUE_STEPS],seen:Object.keys(b.UNLOCKS),skipped:true,tours:[...b.TOUR_IDS]};
  p.firstTen=true;p.cleared=3;p.eventSeen=m.season.eventWindow(TIME).id;
  p.beginner.claimed=[1];p.beginner.tasks=[1];p.beginner.did=['greet'];
  return p;
}
function result(m){
  const p=account(m);p.dispatches=[];
  if(!m.profile.command(p,'begin',{mode:'main',stage:31},TIME).ok)throw new Error('begin');
  const s=m.battle.createBattle(p);s.phase='victory';s.wave=6;s.won=true;s.stats.damage=48210;s.stats.byHero.zeke=21000;p.active.run=m.engine.serialize(s);
  return p;
}
async function main(){
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const report=[];
  for(const [side,build] of Object.entries(BUILDS)){
    const m=await load(build.dir),key=m.profile.SAVE_KEY;
    for(const [theme,file] of Object.entries(build.files)){
      const url=pathToFileURL(path.join(root,build.dir,'dist',file)).href,dir=path.join(OUT,side,theme);await fs.mkdir(dir,{recursive:true});
      async function boot(profile){
        const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true});const page=await context.newPage();
        await page.clock.setFixedTime(TIME);
        await page.route(url,r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>fixture</title>'}),{times:1});
        await page.goto(url);await page.evaluate(({key,profile})=>localStorage.setItem(key,JSON.stringify(profile)),{key,profile});
        await page.goto(url);await page.locator('.scene-partner').waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(400);
        return {context,page};
      }
      const errors=[];
      // WebP keeps the committed review pages small; 390x844 text stays readable at quality 85.
      const shot=async(page,name)=>{await page.waitForTimeout(500);const png=await page.screenshot({animations:'disabled'});await sharp(png).webp({quality:85}).toFile(path.join(dir,name+'.webp'));};
      const nav=(page,label)=>page.getByRole('button',{name:label,exact:true}).first().click();
      const closeSheet=page=>page.locator('#sheet .sheet-top [data-action="close"]').first().click().catch(()=>{});
      {
        const {context,page}=await boot(account(m));page.on('pageerror',e=>errors.push(e.message));
        await shot(page,'lobby');
        await nav(page,'소환');await shot(page,'summon-normal');
        await page.locator('[data-action="rates"]').first().click();await shot(page,'rates');await closeSheet(page);
        await page.locator('[data-banner="season"]').first().click();await shot(page,'summon-season');
        await nav(page,'모험');await page.locator('[data-mode="weekly"]').first().click();await shot(page,'draft');
        await page.locator('[data-mode="monthly"]').first().click();await shot(page,'hunt');
        await page.locator('[data-mode="oath"],[data-mode="twin"]').first().click();await shot(page,'event');
        await nav(page,'정원');await shot(page,'garden');
        await nav(page,'홈');await page.locator('[data-action="library"]').first().click();await shot(page,'library');
        await nav(page,'홈');await page.locator('[data-action="settings"]').first().click();await shot(page,'settings');
        await context.close();
      }
      {
        const {context,page}=await boot(sprout(m));page.on('pageerror',e=>errors.push(e.message));
        await page.locator('[data-action="sprout"]').first().click();await shot(page,'sprout');await context.close();
      }
      {
        const {context,page}=await boot(result(m));page.on('pageerror',e=>errors.push(e.message));
        await page.locator('[data-action="resume"]').click();await page.locator('.battle-result').waitFor();await page.waitForTimeout(1500);await shot(page,'result');await context.close();
      }
      report.push({side,theme,errors});
      console.log(side,theme,errors.length?'errors: '+errors.join(' | '):'no page errors');
    }
  }
  await browser.close();
  await fs.writeFile(path.join(OUT,'captures.json'),JSON.stringify({time:new Date(TIME).toISOString(),shots:SHOTS,report},null,2)+'\n');
}
await main();
