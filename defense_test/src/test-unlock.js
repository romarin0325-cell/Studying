// Local unlocked-build profile: every companion and every relic owned, stage 45 open.
// Most companions start at ten hearts (memorials open); three start lower so gifts can be tried.
// Deck, partner and equipped relics stay as created.
export function unlockProfile(p){
  for(const [id,entry] of Object.entries(p.heroes)){entry.owned=true;entry.bond={star_boy:6,siren:3,snow_rabbit:8}[id]??10;entry.bondXp=0;}
  for(const entry of Object.values(p.relics))entry.owned=true;
  p.cleared=45;p.dreams=99999;p.dust=99999;
  return topUpUnlocked(p);
}
// Saves from earlier test builds keep their progress but always have gifts to try.
export function topUpUnlocked(p){
  if(p.gifts)for(const id of Object.keys(p.gifts))p.gifts[id]=Math.max(p.gifts[id],30);
  return p;
}
