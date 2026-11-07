import {HERO,HEROES,ARTIFACTS,compareRarity} from './content.js';
import {combatPower,collectionBonus,relicLevel} from './economy.js';
import {TEAM_SIZE} from './team-config.js';
import {oathConflict,oathDeckProblem} from './preview/oath.js';

export function autoDeck(p,{exclude=[],allow=null,size=TEAM_SIZE}={}){
  const bonus=collectionBonus(p.relics);return HEROES.filter(h=>p.heroes[h.id]?.owned&&!p.dispatches.some(d=>d.hero===h.id)&&!exclude.includes(h.id)&&(!allow||allow(h.id))).sort((a,b)=>combatPower(b.id,p.heroes[b.id],p.beds,bonus)-combatPower(a.id,p.heroes[a.id],p.beds,bonus)||compareRarity(b,a)).slice(0,size).map(h=>h.id);
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
