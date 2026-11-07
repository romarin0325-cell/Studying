import {HERO,BOSS_ORDER,MAIN_STAGES} from '../content.js';
import {season} from './season.js';

export const OATH_WAVES=9;
// Scoring rules carry a version so a retune never invalidates a stored record: v1 (2026-10-29) used 0/10/20,
// v2 (2026-11-05) raises hard to 12 (the promotion from easy measured 11-13 pressure points) and sets 깨어난 군주 to 2
// (with the curse capped at two it measured below 단단한 밤). See docs/SEASON_CONTENT.md.
export const OATH_RULES=2;
const TIER_BASE_BY_RULES=Object.freeze({1:Object.freeze({easy:0,hard:10,abyss:20}),2:Object.freeze({easy:0,hard:12,abyss:20})});
export const OATH_TIER_BASE=TIER_BASE_BY_RULES[OATH_RULES];
export const OATH_GROUPS=Object.freeze({deck:'편성',tempo:'운영',board:'배치',pressure:'압박'});
export const OATH_CLOSED=Object.freeze([6,7,8,11,12,13,16,17,18]);
export const OATHS=Object.freeze([
  {id:'lowstar',group:'deck',points:5,name:'낮은 별의 맹세',text:'C·R 동료만 편성할 수 있습니다.',exclusive:'rarity'},
  {id:'nobeam',group:'deck',points:3,name:'곧은 길 봉인',text:'관통 공격 동료를 편성할 수 없습니다.'},
  {id:'rabbits',group:'deck',points:2,name:'달토끼 원정대',text:'은토끼·눈토끼·밤토끼를 모두 편성해야 합니다.'},
  {id:'shapes',group:'deck',points:2,name:'서로 다른 궤도',text:'기본 공격 방식이 서로 다른 동료가 4종 이상이어야 합니다.'},
  {id:'crownless',group:'deck',points:3,name:'왕관 없는 원정',text:'UR 동료를 편성할 수 없습니다.',exclusive:'rarity'},
  {id:'drought',group:'tempo',points:3,name:'별빛 가뭄',text:'합성해도 별빛을 얻지 못하고, 전투 중 자연 수급이 절반입니다.'},
  {id:'untrained',group:'tempo',points:3,name:'수련 금지',text:'원정 중에 훈련할 수 없습니다.'},
  {id:'afterglow',group:'tempo',points:2,name:'짧은 잔광',text:'웨이브가 끝날 때 남은 별빛이 30을 넘으면 30이 됩니다.'},
  {id:'heavy',group:'tempo',points:2,name:'무거운 별빛',text:'모든 필살기의 별빛 비용이 20 늘어납니다.'},
  {id:'purse',group:'tempo',points:3,name:'빈 주머니',text:'원정을 시작할 때 골드가 절반입니다.'},
  {id:'once',group:'tempo',points:2,name:'단 한 번의 응답',text:'동료마다 필살기를 웨이브당 한 번만 쓸 수 있습니다.'},
  {id:'ceiling',group:'tempo',points:3,name:'낮은 천장',text:'동료는 3성까지만 오릅니다.'},
  {id:'scatter',group:'board',points:2,name:'흩어진 별자리',text:'배치 오라(에인션트 드래곤·세이렌·하모니어스)의 효과가 절반입니다.'},
  {id:'hollow',group:'board',points:3,name:'닫힌 중심',text:'전장 가운데 9칸을 쓸 수 없습니다.'},
  {id:'stiff',group:'board',points:2,name:'굳은 발걸음',text:'전투 중 자리를 옮기면 8초 동안 다시 옮길 수 없습니다. 합성은 할 수 있습니다.'},
  {id:'tough1',group:'pressure',points:2,name:'단단한 밤',text:'적 체력 +25%',exclusive:'tough'},
  {id:'tough2',group:'pressure',points:4,name:'더 단단한 밤',text:'적 체력 +50%',exclusive:'tough'},
  {id:'haste',group:'pressure',points:2,name:'서두르는 발걸음',text:'적 이동 속도 +15%'},
  {id:'tyrant',group:'pressure',points:2,name:'깨어난 군주',text:'보스 체력 +50%. 보스 패턴 대기 시간이 30% 줄어듭니다.'},
  {id:'glass',group:'pressure',points:4,name:'유리 코어',text:'코어 생명력이 10입니다.'},
]);
export const OATH=Object.fromEntries(OATHS.map(o=>[o.id,o]));
export const OATH_BANDS=Object.freeze([{score:5,reward:100},{score:10,reward:120},{score:15,reward:150},{score:20,reward:180},{score:25,reward:200},{score:30,reward:230},{score:35,reward:250},{score:40,reward:270},{score:45,reward:320},{score:50,reward:380}]);
// Oath points that v2 changed; a v1 record keeps the points it was scored with.
const V1_POINTS=Object.freeze({tyrant:3});
export const validOathRules=rules=>Object.hasOwn(TIER_BASE_BY_RULES,rules);
export const oathPoints=(id,rules=OATH_RULES)=>(rules===1?V1_POINTS[id]:undefined)??OATH[id]?.points??0;
export const oathScore=(tier,ids,rules=OATH_RULES)=>TIER_BASE_BY_RULES[rules][tier]+(Array.isArray(ids)?ids.reduce((n,id)=>n+oathPoints(id,rules),0):0);
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
  if(on('crownless')&&list.some(id=>HERO[id]?.rarity==='UR'))return '왕관 없는 원정: UR 동료를 편성할 수 없습니다.';
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
  if(on('once'))m.oncePerWave=true;
  if(on('ceiling'))m.rankCap=3;
  if(on('hollow'))m.closed=OATH_CLOSED;
  if(on('stiff'))m.moveCooldown=8;
  if(on('glass'))m.core=10;
  return m;
}
export function oathBosses(seasonIndex,met){
  const m=Math.max(1,Math.min(met,BOSS_ORDER.length));
  return [0,1,2].map(k=>BOSS_ORDER[(seasonIndex*3+k)%m]);
}
export function oathChapter(seasonIndex,cleared){return seasonIndex%Math.max(1,Math.min(cleared,MAIN_STAGES));}
export const oathBandsReached=score=>OATH_BANDS.filter(b=>score>=b.score).length;
const copyRecord=r=>r?{period:r.period,token:r.token,score:r.score,tier:r.tier,oaths:[...r.oaths],deck:[...r.deck],at:r.at,...(r.rules!==undefined?{rules:r.rules}:{})}:null;
export function oathState(p,now){
  const period=season(now).id,o=p?.oath,fresh=!o||o.period!==period;
  return {period,best:fresh?null:copyRecord(o.best),paid:fresh?0:o.paid|0,lifetime:copyRecord(o?.lifetime)};
}
