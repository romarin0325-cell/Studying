// Local unlocked-build profile: every companion (bond 10) and every relic owned, stage 45 open.
// Deck, partner and equipped relics stay as created.
export function unlockProfile(p){
  for(const entry of Object.values(p.heroes)){entry.owned=true;entry.bond=10;}
  for(const entry of Object.values(p.relics))entry.owned=true;
  p.cleared=45;p.dreams=99999;p.dust=99999;
  return p;
}
