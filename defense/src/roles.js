// Team roles for auto formation. Each companion has the jobs its ultimate and trait do in a run; auto formation fills a
// minimal working team (an attack ultimate, a support ultimate, a gold maker, slowing or stopping control, area basic
// attacks) before taking the rest by combat power. Read from the skill and trait text (2026-11-16).
//   strike  ultimate is mainly damage
//   support ultimate mainly strengthens the team (attack, speed, extra hits, exposure, protection, a summon)
//   economy makes gold or merges in a run
//   control slows, stops, freezes or pushes enemies with the basic attack, or with an ultimate built around it
// Area basic attacks come from the attack shape (anything but single).
import {HERO} from './content.js';

export const ROLES=Object.freeze({
  star_boy:['strike'],snow_rabbit:['strike','control'],silver_rabbit:['support'],night_rabbit:['strike'],
  siren:['support'],mushroom_king:['strike'],underdog:['strike'],joker:['strike'],sunflower:['strike'],
  great_detective:['support'],guardian:['control'],avalanche_maid:['strike'],santa:['support','economy'],
  red_dragon:['strike'],aurora:['strike'],toffee_apple:['strike'],antropy:['strike'],demon_king:['strike'],
  storm_sage:['strike','control'],flame_sage:['strike'],lightning_sage:['strike'],time_magician:['strike'],
  ancient_dragon:['support'],phantom:['strike','control'],cure_master:['support'],ash:['strike'],miracle_larva:[],
  zeke:['strike'],luna:['strike'],jasmine:['strike','support'],queen:['strike','economy'],rumi:['support','economy'],
  cherry_prince:['strike'],venom:['strike'],behemoth:['strike'],gold_dragon:['strike'],time_ruler:['strike','control'],
  galaxy_whale:['strike','control'],doom:['strike','economy'],cinderella:['strike'],harmonious:['support'],
  frost_witch:['strike','control'],
  ancient_soul:['strike'],victoria:['support'],deep_lord:['strike','control'],sakura:['strike'],
  dainichi_nyorai:['strike','support'],gumiho:['strike'],archangel:['strike','support'],sylphid:['strike','control'],
  succubus:['strike','control'],skull_dragon:['strike'],mad_scientist:['strike','support'],crystal_dancer:['strike','control'],
  blessing_tail:['support'],marshmallow:['strike','support'],mimic:['strike','economy'],silent_librarian:['strike','control'],
});
export const ROLE_NEEDS=Object.freeze(['strike','support','economy','control','area']);
export const hasRole=(id,role)=>role==='area'?HERO[id].shape!=='single':ROLES[id].includes(role);

// Small synergies: a companion whose trait or ultimate reads a status counts it when a teammate applies that status.
const GIVES=Object.freeze({
  burn:['red_dragon','flame_sage','ash','zeke','venom','ancient_soul','sakura','marshmallow'],
  radiance:['silver_rabbit','aurora','jasmine','ancient_soul','sakura','archangel','blessing_tail'],
  slow:['snow_rabbit','phantom','time_ruler','galaxy_whale','frost_witch','storm_sage','sylphid','succubus','marshmallow'],
  stop:['snow_rabbit','guardian','lightning_sage','storm_sage','time_ruler','deep_lord','crystal_dancer','silent_librarian'],
  poison:['mushroom_king','venom','phantom','mad_scientist'],
  rabbit:['snow_rabbit','silver_rabbit'],
  aura:['siren','ancient_dragon','harmonious','victoria','archangel','mad_scientist'],
});
const NEEDS=Object.freeze({
  red_dragon:['burn'],flame_sage:['burn'],cherry_prince:['burn','radiance'],galaxy_whale:['radiance'],
  avalanche_maid:['slow','stop'],venom:['poison'],night_rabbit:['rabbit'],behemoth:['aura'],
  demon_king:['slow','stop','poison','burn','radiance'],
  ancient_soul:['burn','radiance'],sakura:['burn','radiance'],deep_lord:['slow','stop','poison','burn','radiance'],
  dainichi_nyorai:['aura'],gumiho:['burn','radiance'],crystal_dancer:['stop'],mad_scientist:['slow','stop'],
});
export const SYNERGY_STEP=.1,SYNERGY_MAX=.2;
// Share added to a companion's score by the teammates already chosen.
export function synergy(id,team){
  const needs=NEEDS[id]??[];let n=0;
  for(const need of needs)if(team.some(x=>x!==id&&GIVES[need].includes(x)))n++;
  return Math.min(SYNERGY_MAX,SYNERGY_STEP*n);
}
