import {HERO,BOSS_ORDER,MAIN_STAGES} from '../content.js';
import {season} from './season.js';

export const OATH_WAVES=9;
export const OATH_TIER_BASE=Object.freeze({easy:0,hard:10,abyss:20});
export const OATH_GROUPS=Object.freeze({deck:'편성',tempo:'운영',board:'배치',pressure:'압박'});
export const OATHS=Object.freeze([
  {id:'lowstar',group:'deck',points:5,name:'낮은 별의 맹세',text:'C·R 동료만 편성할 수 있습니다.'},
  {id:'nobeam',group:'deck',points:3,name:'곧은 길 봉인',text:'관통 공격 동료를 편성할 수 없습니다.'},
  {id:'rabbits',group:'deck',points:2,name:'달토끼 원정대',text:'은토끼·눈토끼·밤토끼를 모두 편성해야 합니다.'},
  {id:'shapes',group:'deck',points:2,name:'서로 다른 궤도',text:'기본 공격 방식이 서로 다른 동료가 4종 이상이어야 합니다.'},
  {id:'drought',group:'tempo',points:3,name:'별빛 가뭄',text:'합성해도 별빛을 얻지 못하고, 전투 중 자연 수급이 절반입니다.'},
  {id:'untrained',group:'tempo',points:3,name:'수련 금지',text:'원정 중에 훈련할 수 없습니다.'},
  {id:'afterglow',group:'tempo',points:2,name:'짧은 잔광',text:'웨이브가 끝날 때 남은 별빛이 30을 넘으면 30이 됩니다.'},
  {id:'heavy',group:'tempo',points:2,name:'무거운 별빛',text:'모든 필살기의 별빛 비용이 20 늘어납니다.'},
  {id:'purse',group:'tempo',points:3,name:'빈 주머니',text:'원정을 시작할 때 골드가 절반입니다.'},
  {id:'scatter',group:'board',points:2,name:'흩어진 별자리',text:'배치 오라(에인션트 드래곤·세이렌·하모니어스)의 효과가 절반입니다.'},
  {id:'tough1',group:'pressure',points:2,name:'단단한 밤',text:'적 체력 +25%',exclusive:'tough'},
  {id:'tough2',group:'pressure',points:4,name:'더 단단한 밤',text:'적 체력 +50%',exclusive:'tough'},
  {id:'haste',group:'pressure',points:2,name:'서두르는 발걸음',text:'적 이동 속도 +15%'},
  {id:'tyrant',group:'pressure',points:3,name:'깨어난 군주',text:'보스 체력 +50%, 보스 패턴이 30% 더 자주 옵니다.'},
  {id:'glass',group:'pressure',points:4,name:'유리 코어',text:'코어 생명력이 10입니다.'},
]);
export const OATH=Object.fromEntries(OATHS.map(o=>[o.id,o]));
export const OATH_BANDS=Object.freeze([{score:5,reward:50},{score:10,reward:50},{score:15,reward:60},{score:20,reward:60},{score:25,reward:80},{score:30,reward:80},{score:35,reward:100},{score:40,reward:120}]);
export const oathScore=(tier,ids)=>OATH_TIER_BASE[tier]+(Array.isArray(ids)?ids.reduce((n,id)=>n+(OATH[id]?.points||0),0):0);
export function oathConflict(ids){
  if(!Array.isArray(ids))return '서약을 확인하세요.';
  const seen=new Set(),excl=new Map();
  for(const id of ids){
    const o=OATH[id];if(!o)return '알 수 없는 서약입니다.';
    if(seen.has(id))return '같은 서약을 두 번 걸 수 없습니다.';
    seen.add(id);
    if(o.exclusive){const prev=excl.get(o.exclusive);if(prev)return `${prev}과 ${o.name}은 함께 걸 수 없습니다.`;excl.set(o.exclusive,o.name);}
  }
  return '';
}
export function oathDeckProblem(ids,deck){
  const on=id=>(ids||[]).includes(id),list=Array.isArray(deck)?deck:[];
  if(on('lowstar')&&list.some(id=>!['C','R'].includes(HERO[id]?.rarity)))return '낮은 별의 맹세: C·R 동료만 편성할 수 있습니다.';
  if(on('nobeam')&&list.some(id=>HERO[id]?.shape==='beam'))return '곧은 길 봉인: 관통 공격 동료를 편성할 수 없습니다.';
  if(on('shapes')&&new Set(list.map(id=>HERO[id]?.shape)).size<4)return '서로 다른 궤도: 기본 공격 방식이 4종 이상이어야 합니다.';
  if(on('rabbits')&&['silver_rabbit','snow_rabbit','night_rabbit'].some(id=>!list.includes(id)))return '달토끼 원정대: 은토끼·눈토끼·밤토끼를 모두 편성해야 합니다.';
  return '';
}
export function oathMods(ids){
  const on=id=>(ids||[]).includes(id),m={};
  if(on('tough2'))m.hp=1.5;else if(on('tough1'))m.hp=1.25;
  if(on('haste'))m.speed=1.15;
  if(on('tyrant')){m.bossHp=1.5;m.bossHaste=1/.7;}
  if(on('drought')){m.noMergeStar=true;m.regen=.5;}
  if(on('heavy'))m.skillCost=20;
  if(on('purse'))m.gold=.5;
  if(on('untrained'))m.trainCap=0;
  if(on('afterglow'))m.carry=30;
  if(on('scatter'))m.aura=.5;
  if(on('glass'))m.core=10;
  return m;
}
export function oathBosses(seasonIndex,met){
  const m=Math.max(1,Math.min(met,BOSS_ORDER.length));
  return [0,1,2].map(k=>BOSS_ORDER[(seasonIndex*3+k)%m]);
}
export function oathChapter(seasonIndex,cleared){return seasonIndex%Math.max(1,Math.min(cleared,MAIN_STAGES));}
export const oathBandsReached=score=>OATH_BANDS.filter(b=>score>=b.score).length;
const copyRecord=r=>r?{period:r.period,token:r.token,score:r.score,tier:r.tier,oaths:[...r.oaths],deck:[...r.deck],at:r.at}:null;
export function oathState(p,now){
  const period=season(now).id,o=p?.oath,fresh=!o||o.period!==period;
  return {period,best:fresh?null:copyRecord(o.best),paid:fresh?0:o.paid|0,lifetime:copyRecord(o?.lifetime)};
}
