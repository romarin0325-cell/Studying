import {HERO,HEROES,ARTIFACTS,compareRarity} from './content.js';
import {combatPower,collectionBonus,relicLevel} from './economy.js';
import {TEAM_SIZE} from './team-config.js';
import {ROLE_NEEDS,hasRole,synergy} from './roles.js';
import {oathConflict,oathDeckProblem} from './preview/oath.js';

// Auto formation builds a minimal working team, then takes combat power (src/roles.js for the roles and synergies).
// One companion is added at a time, the one that raises the team score most:
//   team score = sum of combat power x (1 + synergy), synergy +10% per status a teammate supplies (at most +20%)
//   a companion that covers a role the team still lacks (attack ultimate, support ultimate, gold, control, area
//   attack) counts ROLE_STEP more per role, and when the open slots are only enough for the missing roles, only
//   companions that cover one are taken.
// A role is filled only by a companion whose combat power is at least ROLE_FLOOR of the fifth-strongest available, so a
// weak companion is never forced in for a role. Equal scores keep a companion already in the team (auto never swaps
// equals), then prefer an attack shape the team does not have yet.
export const ROLE_STEP=.15,ROLE_FLOOR=.7;
export function autoDeck(p,{exclude=[],allow=null,size=TEAM_SIZE}={}){
  const bonus=collectionBonus(p.relics),held=new Set(p.deck),deck=[];
  const pool=HEROES.filter(h=>p.heroes[h.id]?.owned&&!p.dispatches.some(d=>d.hero===h.id)&&!exclude.includes(h.id)&&(!allow||allow(h.id))).map(h=>h.id);
  const power=Object.fromEntries(pool.map(id=>[id,combatPower(id,p.heroes[id],p.beds,bonus)]));
  pool.sort((a,b)=>power[b]-power[a]||compareRarity(HERO[b],HERO[a]));
  const floor=ROLE_FLOOR*(power[pool[Math.min(TEAM_SIZE,pool.length)-1]]??0);
  const teamScore=team=>team.reduce((sum,id)=>sum+power[id]*(1+synergy(id,team)),0);
  while(pool.length&&deck.length<size){
    const missing=ROLE_NEEDS.filter(r=>!deck.some(id=>hasRole(id,r))&&pool.some(id=>power[id]>=floor&&hasRole(id,r)));
    const covers=id=>power[id]>=floor?missing.filter(r=>hasRole(id,r)).length:0;
    const slots=Math.min(size,TEAM_SIZE)-deck.length,must=slots>0&&missing.length>=slots;
    const base=teamScore(deck),gain=id=>Math.round((teamScore([...deck,id])-base)*(1+ROLE_STEP*covers(id)));
    const cands=must&&pool.some(id=>covers(id))?pool.filter(id=>covers(id)):pool;
    const shapes=new Set(deck.map(id=>HERO[id].shape)),rank=id=>[gain(id),held.has(id)?1:0,shapes.has(HERO[id].shape)?0:1];
    let best=cands[0];for(const id of cands){const a=rank(id),b=rank(best);if(a[0]>b[0]||a[0]===b[0]&&(a[1]>b[1]||a[1]===b[1]&&a[2]>b[2]))best=id;}
    deck.push(best);pool.splice(pool.indexOf(best),1);
  }
  return deck;
}
export function autoRelics(p,{exclude=[],count=3}={}){return ARTIFACTS.filter(a=>p.relics[a.id]?.owned&&!exclude.includes(a.id)).sort((a,b)=>compareRarity(b,a)||relicLevel(p.relics[b.id])-relicLevel(p.relics[a.id])).slice(0,count).map(a=>a.id);}
export function autoTwin(p){const heroes=autoDeck(p,{size:10}),relics=autoRelics(p,{count:6}),left=[0,3,4,7,8],right=[1,2,5,6,9];return {left:{deck:left.map(i=>heroes[i]).filter(Boolean),relics:relics.filter((_,i)=>i%2===0)},right:{deck:right.map(i=>heroes[i]).filter(Boolean),relics:relics.filter((_,i)=>i%2===1)}};}
export function oathDeck(p,oaths){
  if(oathConflict(oaths))return null;const on=id=>oaths.includes(id),allow=id=>(!on('lowstar')||['C','R'].includes(HERO[id].rarity))&&(!on('crownless')||HERO[id].rarity!=='UR')&&(!on('nobeam')||HERO[id].shape!=='beam');
  const pool=autoDeck(p,{allow,size:HEROES.length}),required=on('rabbits')?['silver_rabbit','snow_rabbit','night_rabbit']:[];if(required.some(id=>!pool.includes(id)))return null;
  const deck=pool.filter(id=>required.includes(id));for(const id of pool)if(deck.length<TEAM_SIZE&&!deck.includes(id))deck.push(id);if(deck.length!==TEAM_SIZE)return null;
  if(on('shapes'))while(new Set(deck.map(id=>HERO[id].shape)).size<4){const shapes=new Set(deck.map(id=>HERO[id].shape)),add=pool.find(id=>!deck.includes(id)&&!shapes.has(HERO[id].shape)),drop=[...deck].reverse().find(id=>!required.includes(id)&&deck.filter(x=>HERO[x].shape===HERO[id].shape).length>1);if(!add||!drop)return null;deck[deck.indexOf(drop)]=add;}
  return oathDeckProblem(oaths,deck)?null:deck;
}
