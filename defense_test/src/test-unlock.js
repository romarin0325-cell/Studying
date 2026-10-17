// Local unlocked-build profile: every companion and every relic owned, stage 45 open.
// Most companions start at ten hearts (memorials open); three start lower so gifts can be tried.
// Deck, partner and equipped relics stay as created.
import {ARTIFACT,ARTIFACTS,HEROES} from './content.js';
import {COURSE} from './course.js';
import {questionOf} from './quiz.js';
export function unlockProfile(p){
  for(const [id,entry] of Object.entries(p.heroes)){entry.owned=true;entry.bond={star_boy:6,siren:3,snow_rabbit:8}[id]??10;entry.bondXp=0;}
  // Relics at a mid-game spread (C Lv.7, R Lv.5, SR Lv.4, UR Lv.2) with spare duplicates to try levelling.
  for(const [id,entry] of Object.entries(p.relics)){const r=ARTIFACT[id].rarity;entry.owned=true;entry.enhance={C:6,R:4,SR:3,UR:1}[r];entry.copies={C:20,R:8,SR:5,UR:3}[r];}
  p.cleared=45;p.dreams=99999;p.dust=99999;
  return topUpUnlocked(p);
}
// Wallet tap in the unlocked build: 10,000 dreams and dust, capped like every other currency.
export const TEST_GRANT=10000;
export function testGrant(p){const cap=9999999;p.dreams=Math.min(cap,p.dreams+TEST_GRANT);p.dust=Math.min(cap,p.dust+TEST_GRANT);return p;}
// Saves from earlier test builds keep their progress but always have gifts to try.
export function topUpUnlocked(p){
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
