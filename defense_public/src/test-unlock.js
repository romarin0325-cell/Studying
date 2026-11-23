// Local unlocked-build profile: every companion and every relic owned, every main stage cleared (both parts open).
// Most companions start at ten hearts (memorials open); three start lower so gifts can be tried.
// Deck, partner and equipped relics stay as created.
import {ARTIFACT,ARTIFACTS,HEROES,MAIN_STAGES,levelStage} from './content.js';
import {PREVIEW} from './team-config.js';
import {calendar,HOUR} from './economy.js';
export const UNLOCKED_STAGE=MAIN_STAGES;
export function unlockProfile(p){
  for(const [id,entry] of Object.entries(p.heroes)){entry.owned=true;entry.bond={star_boy:6,siren:3,snow_rabbit:8}[id]??10;entry.bondXp=0;}
  // Relics at a mid-game spread (C Lv.7, R Lv.5, SR Lv.4, UR Lv.2) with spare duplicates to try levelling.
  for(const [id,entry] of Object.entries(p.relics)){const r=ARTIFACT[id].rarity;entry.owned=true;entry.enhance={C:6,R:4,SR:3,UR:1}[r];entry.copies={C:20,R:8,SR:5,UR:3}[r];}
  p.cleared=UNLOCKED_STAGE;p.dreams=99999;p.dust=99999;
  // The new-player trial is where the unlocked build plays the tutorial and sprout board.
  p.ftue={legacy:true,done:[],seen:[],skipped:false,tours:[]};p.beginner=null;p.firstTen=true;
  // Content preview: a late-game account (greenhouse beds at their soft caps, every companion +15) so the challenge tiers
  // read as they would for a player near stage 90, and the three request companions below max hearts.
  if(PREVIEW){Object.assign(p.beds,{rose:45,spring:30,seed:20,crit:30,critDamage:25,stardust:49});for(const e of Object.values(p.heroes))e.enhance=15;Object.assign(p.heroes.night_rabbit,{bond:9,bondXp:0});Object.assign(p.heroes.underdog,{bond:9,bondXp:0});}
  return topUpUnlocked(p);
}
// Test tools of the unlocked build (settings → 테스트 도구; a wallet tap still gives 10,000 of each).
// Currencies are capped like every other currency. Returns the toast, or '' for an unknown tool.
export const TEST_GRANT=10000,TEST_CAP=9999999;
export const TEST_TOOLS=Object.freeze([
  {kind:'event-flip',label:'이벤트 바꾸기'},
  {kind:'trial-day',label:'다음 접속일로'},
  {kind:'time-hour',label:'시간 1시간 앞으로'},
  {kind:'ftue-reset',label:'튜토리얼 처음부터'},
  {kind:'wallet',label:'꿈의결정·별가루 +10,000'},
  {kind:'dreams',label:'꿈의결정 +100,000'},
  {kind:'dust',label:'별가루 +1,000,000'},
  {kind:'stage60',label:`스테이지 ${levelStage(60)}까지 클리어`},
  {kind:'stage90',label:`스테이지 ${MAIN_STAGES}까지 클리어`},
  {kind:'dawn-max',label:'제2정원 소프트캡까지'},
  {kind:'dawn-reset',label:'제2정원 처음으로'},
  {kind:'weekly-reset',label:'유성 드래프트 초기화'},
  {kind:'monthly-reset',label:'만월 토벌전 초기화'},
  {kind:'request-now',label:'부탁 바로 도착'},
  {kind:'season-reset',label:'서약·쌍성 시즌 초기화'},
]);
export function testGrant(p,kind='wallet',now=Date.now()){
  const add=(key,n)=>{p[key]=Math.min(TEST_CAP,p[key]+n);};
  switch(kind){
    case 'event-flip':p.eventFlip=!p.eventFlip;return '이벤트를 바꿨어요.';
    case 'trial-day':p.daily={day:calendar(now).day,combat:false,merges:0,idle:false,free:false,relicFree:false,bouquet:false,accel:false,claimed:[]};p.petDay='';return '다음 접속일로 이동했어요.';
    case 'time-hour':{
      const earlier=at=>Math.max(0,at-HOUR);
      p.idleAt=earlier(p.idleAt);p.basket.at=earlier(p.basket.at);
      for(const d of p.dispatches){const shift=Math.min(HOUR,d.start);d.start-=shift;d.end-=shift;}
      if(p.requests){p.requests.next=earlier(p.requests.next);for(const r of p.requests.active)r.at=earlier(r.at);}
      return '시간을 1시간 앞당겼어요.';
    }
    case 'ftue-reset':p.ftue.done=[];p.ftue.seen=[];p.ftue.tours=[];p.ftue.skipped=false;p.firstTen=false;return '튜토리얼을 초기화했어요.';
    case 'wallet':add('dreams',TEST_GRANT);add('dust',TEST_GRANT);return '테스트 지급: 꿈의결정·별가루 +10,000';
    case 'dreams':add('dreams',100000);return '테스트 지급: 꿈의결정 +100,000';
    case 'dust':add('dust',1000000);return '테스트 지급: 별가루 +1,000,000';
    case 'stage60':p.cleared=Math.max(p.cleared,levelStage(60));return `스테이지 ${levelStage(60)}까지 클리어한 상태로 바꿨어요`;
    case 'stage90':p.cleared=Math.max(p.cleared,MAIN_STAGES);return `스테이지 ${MAIN_STAGES}까지 클리어한 상태로 바꿨어요`;
    case 'dawn-max':Object.assign(p.beds,{crit:30,critDamage:25,stardust:49});p.cleared=Math.max(p.cleared,levelStage(60));return '제2정원을 소프트캡까지 키웠어요';
    case 'dawn-reset':Object.assign(p.beds,{crit:0,critDamage:0,stardust:0});return '제2정원을 처음 상태로 되돌렸어요';
    case 'weekly-reset':if(p.active?.mode==='weekly')p.active=null;p.weekly=null;p.weeklyRuns=0;p.weeklyBest=null;return '유성 드래프트를 다시 입장할 수 있게 했어요';
    case 'monthly-reset':if(p.active?.mode==='monthly')p.active=null;p.monthly=null;p.monthlyBest=null;p.monthlyClaim=null;return '만월 토벌전 기록과 보상을 초기화했어요';
    case 'request-now':
      if(!p.requests||typeof p.requests!=='object'||Array.isArray(p.requests))p.requests={next:0,active:[],claimed:[],after:[],read:[]};
      else p.requests.next=0;
      return '동료의 부탁이 바로 도착할 수 있게 했어요';
    case 'season-reset':{
      delete p.oath;
      if(p.twin&&typeof p.twin==='object'){const party=p.twin.party;if(party)p.twin={party};else delete p.twin;}
      if(p.active?.mode==='oath'||p.active?.mode==='twin')p.active=null;
      return '서약·쌍성 시즌 기록을 초기화했어요';
    }
    default:return '';
  }
}
// Saves from earlier test builds keep their progress but always have gifts to try.
export function topUpUnlocked(p){
  if(p.trial)return p;
  // The unlocked build always opens every stage; an older test save is raised, never lowered.
  if(Number.isInteger(p.cleared)&&p.cleared<UNLOCKED_STAGE)p.cleared=UNLOCKED_STAGE;
  // Companions and relics added after this save was made show up owned, like a fresh unlock.
  if(p.heroes)for(const h of HEROES){const e=p.heroes[h.id];if(e&&!e.owned){e.owned=true;e.bond=10;e.bondXp=0;}}
  if(p.relics)for(const a of ARTIFACTS){const e=p.relics[a.id];if(e&&!e.owned){e.owned=true;e.enhance={C:6,R:4,SR:3,UR:1}[a.rarity];e.copies={C:20,R:8,SR:5,UR:3}[a.rarity];}}
  if(p.gifts)for(const id of Object.keys(p.gifts))p.gifts[id]=Math.max(p.gifts[id],30);
  return p;
}
