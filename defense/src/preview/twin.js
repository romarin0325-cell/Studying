import {BOSS_ORDER,TIERS} from '../content.js';
import {TEAM_SIZE} from '../team-config.js';
import {season} from './season.js';

export const TWIN_WAVES=6;
// Each road is a main-stage wave plan (6 waves, bosses on 3 and 6) at the upper section of the tier's stage range
// (TIERS from→to: easy 12→42, hard 40→70, abyss 68→88; 80% of the way).
export const TWIN_STAGE=Object.freeze({easy:36,hard:64,abyss:84});
export const TWIN_SIDES=Object.freeze(['left','right']);
export const TWIN_SIDE=Object.freeze({left:{name:'은빛 별길',short:'은빛'},right:{name:'금빛 별길',short:'금빛'}});
export const TWIN_BANDS=Object.freeze([{total:4,base:60},{total:8,base:80},{total:12,base:120}]);
export const twinBandReward=(tier,i)=>Math.round(TWIN_BANDS[i].base*TIERS[tier].reward);
export function twinBosses(seasonIndex,side,met){
  const m=Math.max(1,Math.min(met,BOSS_ORDER.length)),off=side==='right'?2:0;
  return [0,1].map(k=>BOSS_ORDER[(seasonIndex*4+off+k)%m]);
}
const copySide=s=>({deck:Array.isArray(s?.deck)?[...s.deck]:[],relics:Array.isArray(s?.relics)?[...s.relics]:[]});
export function twinParty(p){
  const raw=p?.twin?.party;
  return {left:copySide(raw?.left),right:copySide(raw?.right)};
}
export function twinPartyProblem(p,party){
  const away=id=>!!p?.dispatches?.some(d=>d.hero===id);
  for(const side of TWIN_SIDES){
    const deck=party?.[side]?.deck,relics=party?.[side]?.relics;
    if(!Array.isArray(deck)||deck.length!==TEAM_SIZE||new Set(deck).size!==deck.length||deck.some(id=>!p?.heroes?.[id]?.owned||away(id)))return `은빛·금빛에 파견 중이 아닌 서로 다른 동료 ${TEAM_SIZE}명씩 필요합니다.`;
    if(!Array.isArray(relics)||relics.length>3||new Set(relics).size!==relics.length||relics.some(id=>!p?.relics?.[id]?.owned))return '보유한 서로 다른 유물을 별길마다 3개까지 장착할 수 있습니다.';
  }
  const heroes=[...party.left.deck,...party.right.deck],relics=[...party.left.relics,...party.right.relics];
  if(new Set(heroes).size!==heroes.length)return '같은 동료를 두 별길에 편성할 수 없습니다.';
  if(new Set(relics).size!==relics.length)return '같은 유물을 두 별길에 장착할 수 없습니다.';
  return '';
}
export const twinSetKey=(party,tier)=>JSON.stringify([tier,party.left.deck,party.left.relics,party.right.deck,party.right.relics]);
const copyResult=s=>s?{round:s.round,damage:s.damage}:null;
const copyEntry=e=>e?{total:e.total,left:{round:e.left.round,damage:e.left.damage},right:{round:e.right.round,damage:e.right.damage},key:e.key,at:e.at}:null;
export function twinState(p,now){
  const period=season(now).id,t=p?.twin,fresh=!t||t.period!==period,party=twinParty(p);
  const blank={easy:null,hard:null,abyss:null};
  return {
    period,party,
    set:fresh||!t.set?null:{key:t.set.key,tier:t.set.tier,left:copyResult(t.set.left),right:copyResult(t.set.right)},
    best:fresh?{...blank}:{easy:copyEntry(t.best?.easy),hard:copyEntry(t.best?.hard),abyss:copyEntry(t.best?.abyss)},
    paid:fresh?{easy:0,hard:0,abyss:0}:{easy:t.paid?.easy|0,hard:t.paid?.hard|0,abyss:t.paid?.abyss|0},
    lifetime:t?.lifetime?{tier:t.lifetime.tier,total:t.lifetime.total,at:t.lifetime.at}:null,
  };
}
