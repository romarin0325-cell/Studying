// Local unlocked-build profile: every companion and every relic owned, stage 45 open.
// Most companions start at ten hearts (memorials open); three start lower so gifts can be tried.
// Deck, partner and equipped relics stay as created.
import {ARTIFACT} from './content.js';
export function unlockProfile(p){
  for(const [id,entry] of Object.entries(p.heroes)){entry.owned=true;entry.bond={star_boy:6,siren:3,snow_rabbit:8}[id]??10;entry.bondXp=0;}
  // Relics at a mid-game spread (C Lv.7, R Lv.5, SR Lv.4, UR Lv.2) with spare duplicates to try levelling.
  for(const [id,entry] of Object.entries(p.relics)){const r=ARTIFACT[id].rarity;entry.owned=true;entry.enhance={C:6,R:4,SR:3,UR:1}[r];entry.copies={C:20,R:8,SR:5,UR:3}[r];}
  p.cleared=45;p.dreams=99999;p.dust=99999;
  return topUpUnlocked(p);
}
// Saves from earlier test builds keep their progress but always have gifts to try.
export function topUpUnlocked(p){
  if(p.gifts)for(const id of Object.keys(p.gifts))p.gifts[id]=Math.max(p.gifts[id],30);
  return p;
}
