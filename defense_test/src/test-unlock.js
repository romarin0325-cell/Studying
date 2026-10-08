// Local unlocked-build profile. Other hero fields, relics, deck and partner stay as created.
export function unlockProfile(p){
  for(const entry of Object.values(p.heroes)){entry.owned=true;entry.bond=10;}
  p.cleared=45;p.dreams=99999;p.dust=99999;
  return p;
}
