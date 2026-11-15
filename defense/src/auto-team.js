import {HERO,HEROES,ARTIFACTS,compareRarity} from './content.js';
import {combatPower,collectionBonus,relicLevel} from './economy.js';
import {PRACTICAL} from './practical.js';
import {TEAM_SIZE} from './team-config.js';
import {oathConflict,oathDeckProblem} from './preview/oath.js';

// Auto formation reads combat power corrected by each companion's measured value in real main stages (PRACTICAL:
// real in-run gold, control and boss waves included), so inside a rarity the companion that wins more stages comes first
// and a strong lower-rarity companion can pass a weak higher one at the same growth. Combat power itself (the shown
// number, dispatch rewards) is unchanged. Equal scores keep a companion already in the team (auto never swaps equals),
// then prefer an attack shape the pick does not have yet.
export const autoScore=(p,id,bonus=collectionBonus(p.relics))=>Math.round(combatPower(id,p.heroes[id],p.beds,bonus)*(PRACTICAL[id]??1));
export function autoDeck(p,{exclude=[],allow=null,size=TEAM_SIZE}={}){
  const bonus=collectionBonus(p.relics),power=h=>autoScore(p,h.id,bonus),deck=[],held=new Set(p.deck);
  const pool=HEROES.filter(h=>p.heroes[h.id]?.owned&&!p.dispatches.some(d=>d.hero===h.id)&&!exclude.includes(h.id)&&(!allow||allow(h.id))).sort((a,b)=>power(b)-power(a)||compareRarity(b,a));
  while(pool.length&&deck.length<size){
    const top=power(pool[0]),shapes=new Set(deck.map(h=>h.shape)),tie=test=>pool.findIndex(h=>power(h)===top&&test(h));
    let i=tie(h=>held.has(h.id));if(i<0)i=tie(h=>!shapes.has(h.shape));deck.push(...pool.splice(Math.max(0,i),1));
  }
  return deck.map(h=>h.id);
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
