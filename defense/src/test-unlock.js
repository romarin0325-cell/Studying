// Local unlocked-build profile: every companion and every relic owned, all 90 stages cleared (both parts open).
// Most companions start at ten hearts (memorials open); three start lower so gifts can be tried.
// Deck, partner and equipped relics stay as created.
import {ARTIFACT,ARTIFACTS,HEROES} from './content.js';
import {COURSE} from './course.js';
import {questionOf} from './quiz.js';
export const UNLOCKED_STAGE=90;
export function unlockProfile(p){
  for(const [id,entry] of Object.entries(p.heroes)){entry.owned=true;entry.bond={star_boy:6,siren:3,snow_rabbit:8}[id]??10;entry.bondXp=0;}
  // Relics at a mid-game spread (C Lv.7, R Lv.5, SR Lv.4, UR Lv.2) with spare duplicates to try levelling.
  for(const [id,entry] of Object.entries(p.relics)){const r=ARTIFACT[id].rarity;entry.owned=true;entry.enhance={C:6,R:4,SR:3,UR:1}[r];entry.copies={C:20,R:8,SR:5,UR:3}[r];}
  p.cleared=UNLOCKED_STAGE;p.dreams=99999;p.dust=99999;
  return topUpUnlocked(p);
}
// Test tools of the unlocked build (settings → 테스트 도구; a wallet tap still gives 10,000 of each).
// Currencies are capped like every other currency. Returns the toast, or '' for an unknown tool.
export const TEST_GRANT=10000,TEST_CAP=9999999;
export const TEST_TOOLS=Object.freeze([
  {kind:'wallet',label:'꿈의결정·별가루 +10,000'},
  {kind:'dreams',label:'꿈의결정 +100,000'},
  {kind:'dust',label:'별가루 +1,000,000'},
  {kind:'stage60',label:'스테이지 60까지 클리어'},
  {kind:'stage90',label:'스테이지 90까지 클리어'},
  {kind:'dawn-max',label:'제2정원 소프트캡까지'},
  {kind:'dawn-reset',label:'제2정원 처음으로'},
]);
export function testGrant(p,kind='wallet'){
  const add=(key,n)=>{p[key]=Math.min(TEST_CAP,p[key]+n);};
  switch(kind){
    case 'wallet':add('dreams',TEST_GRANT);add('dust',TEST_GRANT);return '테스트 지급: 꿈의결정·별가루 +10,000';
    case 'dreams':add('dreams',100000);return '테스트 지급: 꿈의결정 +100,000';
    case 'dust':add('dust',1000000);return '테스트 지급: 별가루 +1,000,000';
    case 'stage60':p.cleared=Math.max(p.cleared,60);return '스테이지 60까지 클리어한 상태로 바꿨어요';
    case 'stage90':p.cleared=Math.max(p.cleared,90);return '스테이지 90까지 클리어한 상태로 바꿨어요';
    case 'dawn-max':Object.assign(p.beds,{crit:38,critDamage:25,stardust:49});p.cleared=Math.max(p.cleared,60);return '제2정원을 소프트캡까지 키웠어요';
    case 'dawn-reset':Object.assign(p.beds,{crit:0,critDamage:0,stardust:0});return '제2정원을 처음 상태로 되돌렸어요';
    default:return '';
  }
}
// Saves from earlier test builds keep their progress but always have gifts to try.
export function topUpUnlocked(p){
  // The unlocked build always opens every stage; an older test save is raised, never lowered.
  if(Number.isInteger(p.cleared)&&p.cleared<UNLOCKED_STAGE)p.cleared=UNLOCKED_STAGE;
  // Companions and relics added after this save was made show up owned, like a fresh unlock.
  if(p.heroes)for(const h of HEROES){const e=p.heroes[h.id];if(e&&!e.owned){e.owned=true;e.bond=10;e.bondXp=0;}}
  if(p.relics)for(const a of ARTIFACTS){const e=p.relics[a.id];if(e&&!e.owned){e.owned=true;e.enhance={C:6,R:4,SR:3,UR:1}[a.rarity];e.copies={C:20,R:8,SR:5,UR:3}[a.rarity];}}
  if(p.gifts)for(const id of Object.keys(p.gifts))p.gifts[id]=Math.max(p.gifts[id],30);
  // Study: a few wrong answers to try the star library; today's star and acceleration reopen on every load.
  const s=p.study;
  if(s&&!s.wrong.length&&!s.library.index&&!s.library.stars)s.wrong=[...COURSE.lectures.slice(0,3).map(l=>['concept',l.quizzes[0].id]),...COURSE.terms.slice(0,3).map(t=>['term',t.quizzes[0].id])].map(([kind,id])=>{const q=questionOf(kind,id);return {kind,id,choice:(q.answer+1)%q.choices.length,at:0};});
  if(s)s.library.day='';if(p.daily&&typeof p.daily.accel==='boolean')p.daily.accel=false;
  return p;
}
