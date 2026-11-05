// Deterministic fixtures for the pass 21 before/after viewer. Both columns run their own copy of the same engine state and
// receive the same engine events; only the renderer differs (main's render.js/effects.js on the left, this branch on the right).
import * as E from '../../../src/combat/engine.js';
import {HERO} from '../../../src/content.js';

export const ENTRIES=Object.freeze([
  {key:'cherry',hero:'cherry_prince',mode:'skill',label:'체리프린스 · 왕자의 일격',duration:2.4,moments:[.12,.3,.45,.62,1.1],options:['kills','empowered','moving'],
    note:'발도: 웅크림 → 꽃잎 속으로 사라짐 → 대상을 지나는 한 줄의 빛 → 대상 너머의 잔상 → 엔진 판정(0.3초 지연)에 맞춰 베인 자리가 갈라지고 꽃잎이 터짐 → 칸으로 돌아와 칼집 반짝임. 강화(48배)는 금빛 두 줄.'},
  {key:'luna',hero:'luna',mode:'skill',label:'루나 · 제노사이드 스텝',duration:2.6,moments:[.15,.35,.6,.9,1.4],options:['kills','moving'],
    note:'엔진이 정한 순서(보스 → 체력 높은 순)대로 보랏빛 잔상이 한 명씩 다가가 초승달 교차 베기. 처형은 보름달. 처형으로 쓰러뜨려 늘어난 대상까지 같은 리듬으로 이어지고, 숫자·사망은 각자 베이는 순간에 보인다.'},
  {key:'frost',hero:'frost_witch',mode:'skill',label:'혹한의마녀 · 빙궁의 칙령',duration:2.8,moments:[.2,.33,.5,.7,1.8],options:['kills','moving'],
    note:'빙궁 인장이 전장 가운데에 찍히고(0.32초) 서리 고리가 길까지 퍼진다. 고리가 지나는 길마다 얼음 가시, 닿는 적마다 큰 가시와 파편, 숫자. 겨울 6초 동안 길에 서리와 눈이 남는다.'},
  {key:'harmony',hero:'harmonious',mode:'skill',label:'하모니어스 · 디저트 앙상블',duration:2.6,moments:[.2,.4,.62,.9,1.6],options:['spotlight'],
    note:'전장 가운데에 디저트 스탠드가 솟고(여섯 가지 디저트), 0.42초에 터지며 아군마다 디저트가 날아가 앉는다. 이웃한 칸은 항상 다른 디저트(행·열 색칠). 10초 동안 아군 발밑에 설탕 반짝임.'},
  {key:'basic-ur',hero:'cherry_prince',mode:'attack',label:'일반 공격 · UR 4명',duration:2.4,moments:[.25,.5,.8,1.2,1.8],options:['moving'],
    note:'체리프린스·루나·혹한의마녀·하모니어스의 평타. 그림은 그대로이고, 모든 평타에 공통으로 적의 흰 섬광(0.12초)·뒤로 2.5px 밀림·접촉 불꽃(UR은 고리와 금빛 반짝임)·숫자 팝이 더해진다.'},
  {key:'basic-rarity',hero:'snow_rabbit',mode:'attack',label:'일반 공격 · 등급별 차이',duration:2.4,moments:[.25,.5,.8,1.2,1.8],options:['moving'],
    note:'C 눈토끼 · R 명탐정 · SR 화염의현자 · UR 지크·루나. 접촉 불꽃은 영웅 색, C는 섬광만, R는 파편 둘, SR는 얇은 고리, UR는 고리와 금빛 반짝임이 더해진다.'},
  {key:'dense',hero:'siren',mode:'attack',label:'일반 공격 · 25기 동시',duration:2.4,moments:[.3,.6,1,1.5,2],options:['moving'],
    note:'25칸을 모두 채우고 동시에 쏜다. 접촉 불꽃·섬광이 얼굴·체력바·위험 칸을 가리지 않는지 본다(같은 적에 겹치는 접촉 불꽃은 밝기를 나눠 쓴다).'},
]);

const ROSTERS={
  cherry:{deck:['cherry_prince','jasmine','siren','queen','zeke'],units:[[22,'cherry_prince',3],[6,'jasmine',1],[8,'siren',1],[16,'queen',1],[18,'zeke',1]]},
  luna:{deck:['luna','jasmine','siren','queen','zeke'],units:[[12,'luna',3],[6,'jasmine',1],[8,'siren',1],[16,'queen',1],[18,'zeke',1]]},
  frost:{deck:['frost_witch','jasmine','siren','queen','zeke'],units:[[12,'frost_witch',3],[6,'jasmine',1],[8,'siren',1],[16,'queen',1],[18,'zeke',1]]},
  harmony:{deck:['harmonious','siren','queen','jasmine','zeke'],units:[[12,'harmonious',3],...[0,1,2,3,4,5,7,9,10,11,13,14,15,17,19,20,21,22,23,24].map((c,i)=>[c,['siren','queen','jasmine','zeke'][i%4],1])]},
  'basic-ur':{deck:['cherry_prince','luna','frost_witch','harmonious','siren'],units:[[11,'cherry_prince',3],[10,'luna',3],[13,'frost_witch',3],[14,'harmonious',3]],road:[1745,1865,1925,1985,803,863,923,1394]},
  'basic-rarity':{deck:['snow_rabbit','great_detective','flame_sage','zeke','luna'],units:[[10,'snow_rabbit',3],[11,'great_detective',3],[13,'flame_sage',3],[20,'zeke',3],[14,'luna',3]],road:[1745,1805,1865,1925,1985,803,863,923]},
  dense:{deck:['siren','guardian','storm_sage','zeke','luna'],units:Array.from({length:25},(_,i)=>[i,['siren','guardian','storm_sage','zeke','luna'][i%5],1+(i%3)])},
};
// Enemy places along the road (distance from the start). Skill scenes spread them around the whole loop.
const SPREAD=[180,420,640,800,980,1160,1330,1520,1700,1880,2050];
const ATTACK=[300,520,760,1000,1240,1480,1720,1960];

export function reviewScene(entry,{kills=true,empowered=false,spotlight=false,moving=true,chapter=0}={}){
  const roster=ROSTERS[entry.key],deck=roster.deck;
  const s=E.newRun({deck,chapter,seed:261106,crit:{chance:0,damage:1.5},artifacts:spotlight?['spotlight']:[]});
  const template={...s.board.find(Boolean)};s.board.fill(null);
  for(const [cell,hero,rank] of roster.units){
    if(!deck.includes(hero))throw Error('fixture deck missing '+hero);
    s.board[cell]={...template,uid:s.nextId++,hero,rank,cooldown:entry.mode==='attack'?(cell%5)*.11:99,windup:0,pose:0,disabled:0,cursed:false,aim:0,facing:'down',born:-1,attacks:0,idleFor:0,invincible:0,priority:'first',target:null};
    delete s.board[cell].form;
  }
  s.queue=[{kind:'grunt',hp:1e7}];s.spawnIn=0;E.step(s,.001);
  const proto={...s.enemies[0]};if(!proto.uid)throw Error('fixture could not spawn an enemy');
  const fork=(progress,{hp=1e7,boss=null,kind='grunt'}={})=>({...structuredClone(proto),uid:s.nextId++,kind,boss,progress,speed:moving?(kind==='runner'?82:49):0,skillIn:99,hp,maxHp:Math.max(hp,1000),statusEffects:[],slowEffects:[]});
  const skill=entry.mode==='skill';
  let enemies=(skill?SPREAD:roster.road||ATTACK).map((p,i)=>fork(p,{hp:skill&&kills?(i%3===2?1e7:60):1e7,kind:i%4===3?'runner':'grunt'}));
  if(entry.key==='luna'){
    // A sturdy lead target first, then wounded enemies under the execution line so kills carry the step onward.
    enemies=SPREAD.map((p,i)=>fork(p,i===4?{hp:9e6}:kills?{hp:250}:{hp:9e6}));
    for(const e of enemies)if(kills&&e.hp===250){e.maxHp=1000;}
  }
  if(entry.key==='cherry'){
    // The highest-HP enemy is the prince's target; with "kills" it is low enough to fall to the cut.
    enemies=SPREAD.slice(0,8).map((p,i)=>fork(p,{hp:i===5?(kills?400:9e6):kills?60:1e6}));
    if(empowered){const t=enemies[5];t.statusEffects.push({type:'divine',source:'fixture',owner:'jasmine',amount:3,until:30});}
  }
  if(entry.key==='dense')enemies=[...ATTACK,...ATTACK.map(p=>p+110)].map(p=>fork(p));
  s.enemies=enemies;
  s.queue=[{kind:'grunt',hp:1e7}];s.spawnIn=999;s.events=[];s.time=0;s.shots=[];s.finishers=[];s.volleys=[];s.zones=[];s.telegraph=null;s.gauge=200;s.gold=400;s.phase='combat';s.health=99;
  // The viewer draws one frame before the cast, as the game always has a previous frame when an ultimate fires.
  const cast=()=>{
    if(!skill)return [];
    const result=E.cast(s,entry.hero);if(!result.ok)throw Error(entry.key+': '+(result.reason||'cast failed'));
    if(!s.events.some(e=>e.type==='skill'&&e.hero===entry.hero))throw Error(entry.key+': missing skill event');
    return s.events.splice(0);
  };
  return {state:s,cast,advance(dt){E.step(s,dt);return s.events.splice(0);}};
}
export const isUltimateUR=entry=>entry.mode==='skill'&&(HERO[entry.hero].hidden||HERO[entry.hero].rarity==='UR');
