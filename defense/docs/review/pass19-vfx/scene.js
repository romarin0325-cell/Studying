// Deterministic pass 19 presentation fixture. Both columns build this scene with the same seed, so they receive the
// same current-engine state and events. Only the renderer differs. Toffee Apple's before column replays this engine's
// bombBlast. The engine still damages every living enemy at factor 10 and the event has no radius; the painted ring is 200.
import * as E from '../../../src/combat/engine.js';
import {HERO} from '../../../src/content.js';

const FILL=['siren','queen','guardian','behemoth','storm_sage','great_detective'];
const BLAST=920;
const CLUSTER=[820,870,920,970,1020];
const FURY=1900;
export const ENTRIES=Object.freeze([
  {key:'zeke-calm',hero:'zeke',scene:'calm',modes:['attack'],label:'지크 · 평소',duration:1.6,peak:.24,moments:[.16,.24,.4]},
  {key:'zeke-fury',hero:'zeke',scene:'fury',modes:['attack'],label:'지크 · 광폭',duration:1.6,peak:.26,moments:[.16,.26,.42]},
  {key:'toffee_apple',hero:'toffee_apple',scene:'blast',modes:['skill'],label:'토피애플 · 애플봄',duration:1.6,peak:.4,moments:[.16,.4,.7]},
  {key:'joker-chaos',hero:'joker',scene:'chaos',modes:['skill'],label:'조커 · 카오스 룰렛',duration:2.2,peak:.55,moments:[.28,.55,.9]},
  {key:'joker-red',hero:'joker',scene:'red',modes:['skill'],label:'조커 · 일반 색',duration:2.2,peak:.36,moments:[.2,.36,.7]},
  {key:'sunflower-3',hero:'sunflower',scene:'full',modes:['skill'],label:'해바라기 · 햇빛 3',duration:2.2,peak:.65,moments:[.3,.65,1.05]},
  {key:'sunflower-1',hero:'sunflower',scene:'low',modes:['skill'],label:'해바라기 · 햇빛 1',duration:2.2,peak:.36,moments:[.2,.36,.7]},
  {key:'badges',hero:'sunflower',scene:'badges',modes:['badge'],label:'특성 배지',duration:4,peak:3.4,moments:[.4,1.4,2.4,3.4]},
  {key:'demon_king',hero:'demon_king',scene:'range',modes:['range'],label:'마왕 · 관통 사거리',duration:2.2,peak:1,moments:[.3,1,1.8]},
  {key:'doom',hero:'doom',scene:'range',modes:['range'],label:'둠 · 관통 사거리',duration:2.2,peak:1,moments:[.3,1,1.8]},
]);

const deckOf=(...ids)=>{const deck=[];for(const id of [...ids,...FILL])if(!deck.includes(id)&&deck.length<5)deck.push(id);return deck;};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

export function reviewScene(entry,{mode=entry.modes[0],chapter=0}={}){
  const ids=entry.scene==='badges'?['sunflower','joker']:[entry.hero];
  const s=E.newRun({deck:deckOf(...ids),chapter,seed:261028,crit:{chance:0,damage:1.5}});
  const template={...s.board.find(Boolean)};s.board.fill(null);
  const place=(i,hero,rank=3)=>{s.board[i]={...template,uid:s.nextId++,hero,rank,cooldown:99,windup:0,pose:0,disabled:0,cursed:false,aim:0,facing:'down',born:-1,attacks:0,idleFor:0,invincible:0,priority:'first',target:null};delete s.board[i].form;return s.board[i];};
  let cell=14;
  if(entry.scene==='badges'){for(const i of [0,4,20,24])place(i,'sunflower',3);for(const i of [7,17])place(i,'joker',3);cell=0;}
  else if(entry.scene==='blast')cell=6;
  else if(entry.scene==='chaos'||entry.scene==='red'||entry.scene==='full'||entry.scene==='low')cell=24;
  if(entry.scene!=='badges')place(cell,entry.hero,3);
  s.queue=[{kind:'grunt',hp:1e7}];s.spawnIn=0;E.step(s,.001);
  const enemy={...s.enemies[0]};
  const fork=(progress)=>({...structuredClone(enemy),uid:s.nextId++,kind:'grunt',boss:null,progress,speed:0,skillIn:99,hp:1e7,maxHp:1e7,statusEffects:[],slowEffects:[]});
  const right=[820,870,920,970,1020];
  let farPx=0,edgePx=0,edgeAt=0;
  if(entry.scene==='badges')s.enemies=[];
  else if(entry.scene==='blast'){
    const at=E.pathPoint(BLAST);let edge=0,far=0;
    for(let p=BLAST+40;p<E.PATH_LENGTH;p+=5){const d=dist(E.pathPoint(p),at);if(!edge&&d>200)edge=p;if(d>480){far=p;break;}}
    s.enemies=[...CLUSTER,edge,far].map(fork);
    edgePx=dist(E.pathPoint(edge),at);farPx=dist(E.pathPoint(far),at);edgeAt=edge;
    if(!(edgePx>200)||!(farPx>480))throw Error('toffee enemies are not outside the painted radius');
    if(!CLUSTER.every(p=>dist(E.pathPoint(p),at)<=200))throw Error('toffee pack is outside the painted radius');
    if(!CLUSTER.some(p=>Math.abs(p-BLAST)<=E.APPLEBOMB.trigger))throw Error('toffee pack would not detonate the bomb');
  }else{
    const pack=entry.scene==='fury'?[...right,FURY]:right;
    s.enemies=pack.map(fork);
    const line=E.PATH_LENGTH*.75;
    if(entry.scene==='fury'&&!s.enemies.some(e=>e.progress>=line))throw Error('fury enemy is not in the last quarter');
    if(entry.scene==='calm'&&s.enemies.some(e=>e.progress>=line))throw Error('calm pack reached the last quarter');
  }
  s.queue=[{kind:'grunt',hp:1e7}];s.spawnIn=999;s.events=[];s.time=0;s.shots=[];s.finishers=[];s.volleys=[];s.zones=[];s.telegraph=null;s.gauge=200;s.gold=400;s.phase='combat';
  for(const u of s.board)if(u){u.cooldown=99;u.windup=0;u.disabled=0;u.pose=0;}
  if(entry.scene==='chaos'){s.jokerColor='chaos';s.jokerSeen=31;}
  if(entry.scene==='red'){s.jokerColor='red';s.jokerSeen=1;}
  if(entry.scene==='full')s.sunlight=3;
  if(entry.scene==='low')s.sunlight=1;
  if(entry.scene==='badges'){s.sunlight=0;s.jokerColor='red';s.jokerSeen=1;}
  if(mode==='attack'){
    const u=s.board[cell],at=E.cellPoint(cell);
    u.cooldown=0;
    if(!s.enemies.some(e=>dist(E.pathPoint(e.progress),at)<=HERO.zeke.range))throw Error('zeke has nobody in range');
    if(entry.scene==='fury'&&!E.zekeFury(s))throw Error('engine did not arm fury');
    if(entry.scene==='calm'&&E.zekeFury(s))throw Error('engine armed fury on the calm pack');
  }
  if(mode==='range'){
    const u=s.board[cell],at=E.cellPoint(cell),to=E.pathPoint(BLAST);
    u.aim=Math.atan2(to.y-at.y,to.x-at.x);u.facing='right';u.cooldown=99;
  }
  if(mode==='skill'){
    const result=E.cast(s,entry.hero);if(!result.ok)throw Error(result.reason||'cast failed');
    const skill=s.events.find(e=>e.type==='skill'&&e.hero===entry.hero);if(!skill)throw Error('missing skill event');
    if(entry.scene==='chaos'&&skill.chaos!==true)throw Error('chaos finale was not marked');
    if(entry.scene==='red'&&skill.chaos)throw Error('plain roulette was marked chaos');
    if(entry.scene==='full'&&skill.sunlight!==3)throw Error('full bloom was not marked');
    if(entry.scene==='low'&&skill.sunlight!==1)throw Error('low sunlight was not marked');
    if(entry.scene==='blast'){
      const bomb=s.bombs[0];if(!bomb)throw Error('apple bomb was not placed');
      bomb.progress=BLAST;const at=E.pathPoint(BLAST);
      for(const e of s.events)if(e.type==='bombSet'&&e.uid===bomb.uid)Object.assign(e,at,{progress:BLAST});
    }
  }
  let mark=0;
  return {state:s,cell,farPx,edgePx,edgeAt,advance(dt){
    E.step(s,dt);
    if(entry.scene==='badges'){
      const step=Math.min(3,Math.floor(s.time+1e-4));
      while(mark<step){
        mark++;s.sunlight=mark;
        E.event(s,'sunCharge',{sunlight:mark,points:s.board.flatMap((u,i)=>u?.hero==='sunflower'?[E.cellPoint(i)]:[])});
        if(mark===2){s.jokerColor='chaos';s.jokerSeen=31;E.event(s,'jokerColor',{from:'red',color:'chaos',points:s.board.flatMap((u,i)=>u?.hero==='joker'?[E.cellPoint(i)]:[])});}
      }
    }
    return s.events.splice(0);
  }};
}
