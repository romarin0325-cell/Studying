import * as E from '../../../src/combat/engine.js';
import {HERO} from '../../../src/content.js';

const FILL=['siren','queen','guardian','behemoth','storm_sage','great_detective'];
const RIGHT=[820,870,920,970,1020];
export const ENTRIES=Object.freeze([
  {key:'zeke-calm',hero:'zeke',modes:['attack'],label:'지크 · 평타',duration:1.6,peak:.24,moments:[.16,.24,.4],ring:true},
  {key:'zeke-fury',hero:'zeke',modes:['attack'],label:'지크 · 광폭 평타',duration:1.6,peak:.26,moments:[.16,.26,.42],ring:true},
  {key:'guardian',hero:'guardian',modes:['attack'],label:'가디언 · 평타',duration:1.6,peak:.24,moments:[.16,.24,.4],ring:true},
  {key:'cocoon',hero:'miracle_larva',modes:['attack'],label:'미라클코쿤 · 평타',duration:1.6,peak:.24,moments:[.16,.24,.4],ring:true},
  {key:'luna',hero:'luna',modes:['attack'],label:'루나 · 평타',duration:1.2,peak:.6,moments:[.2,.6,1],ring:false},
  {key:'zeke-skill',hero:'zeke',modes:['skill'],label:'지크 · 라그나로크',duration:2.6,peak:.7,moments:[.3,.7,1.2],ring:false},
  {key:'ash-skill',hero:'ash',modes:['skill'],label:'애쉬 · 아마겟돈과 환원',duration:2.2,peak:.5,moments:[.2,.5,1],ring:false},
  {key:'joker-badge',hero:'joker',modes:['badge'],label:'조커 · 카오스 배지',duration:4,peak:2,moments:[.5,2,3.5],ring:false},
]);
const deckOf=(...ids)=>{const deck=[];for(const id of [...ids,...FILL])if(!deck.includes(id)&&deck.length<5)deck.push(id);return deck;};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

export function reviewScene(entry,{mode=entry.modes[0],chapter=0}={}){
  const ids=entry.key==='ash-skill'?['ash','siren']:[entry.hero];
  const deck=deckOf(...ids);
  if(!ids.every(id=>deck.includes(id)))throw Error('fixture deck does not include every placed hero');
  const s=E.newRun({deck,chapter,seed:261029,crit:{chance:0,damage:1.5}});
  const template={...s.board.find(Boolean)};s.board.fill(null);
  const place=(i,hero,rank=3)=>{if(!deck.includes(hero))throw Error('fixture deck missing '+hero);s.board[i]={...template,uid:s.nextId++,hero,rank,cooldown:99,windup:0,pose:0,disabled:0,cursed:false,aim:0,facing:'down',born:-1,attacks:0,idleFor:0,invincible:0,priority:'first',target:null};delete s.board[i].form;return s.board[i];};
  const cell=entry.key==='ash-skill'?24:entry.key==='joker-badge'?7:14;
  const unit=place(cell,entry.hero);
  if(entry.key==='cocoon')unit.form='miracle_cocoon';
  if(entry.key==='ash-skill')place(12,'siren',1);
  if(entry.key==='joker-badge')place(17,'joker');
  s.queue=[{kind:'grunt',hp:1e7}];s.spawnIn=0;E.step(s,.001);
  const enemy={...s.enemies[0]};
  if(!enemy.uid)throw Error('fixture could not spawn enemy template');
  const fork=progress=>({...structuredClone(enemy),uid:s.nextId++,kind:'grunt',boss:null,progress,speed:0,skillIn:99,hp:1e7,maxHp:1e7,statusEffects:[],slowEffects:[]});
  let pack=RIGHT;
  if(entry.key==='zeke-fury')pack=[...RIGHT,1900];
  if(entry.key==='zeke-skill')pack=[...RIGHT,200,1400,1600];
  s.enemies=entry.key==='joker-badge'?[]:pack.map(fork);
  if(entry.key!=='zeke-fury'&&s.enemies.some(e=>e.progress>=E.PATH_LENGTH*.75))throw Error(entry.key+': enemy reached the last quarter');
  s.queue=[{kind:'grunt',hp:1e7}];s.spawnIn=999;s.events=[];s.time=0;s.shots=[];s.finishers=[];s.volleys=[];s.zones=[];s.telegraph=null;s.gauge=200;s.gold=400;s.phase='combat';
  for(const u of s.board)if(u){u.cooldown=99;u.windup=0;u.disabled=0;u.pose=0;}
  if(entry.key==='joker-badge'){s.jokerColor='red';s.jokerSeen=1;}
  if(mode==='attack'){
    unit.cooldown=0;
    const hero=E.unitHero(s,unit),at=E.cellPoint(cell);
    if(!s.enemies.some(e=>dist(E.pathPoint(e.progress),at)<=hero.range))throw Error(entry.key+': no enemy in attack range');
    if(entry.key==='cocoon'&&(E.miracleForm(unit)!=='miracle_cocoon'||hero.shape!=='pulse'||hero.range!==230))throw Error('cocoon fixture is not a pulse attack with range 230');
    if(entry.key==='zeke-fury'&&!E.zekeFury(s))throw Error('fury fixture did not arm fury');
    if(entry.key==='zeke-calm'&&E.zekeFury(s))throw Error('calm fixture armed fury');
  }
  if(mode==='skill'){
    const result=E.cast(s,entry.hero);if(!result.ok)throw Error(entry.key+': '+(result.reason||'cast failed'));
    if(!s.events.some(e=>e.type==='skill'&&e.hero===entry.hero))throw Error(entry.key+': missing skill event');
    if(entry.key==='ash-skill'&&!s.events.some(e=>e.type==='reduce'&&e.by==='ash'&&e.hero==='siren'))throw Error('ash fixture did not reduce siren');
    if(entry.key==='ash-skill'&&!s.events.some(e=>e.type==='armageddonBlast'))throw Error('ash fixture missing armageddonBlast');
  }
  let switched=false;
  return {state:s,cell,advance(dt){
    E.step(s,dt);
    if(entry.key==='joker-badge'&&!switched&&s.time>=1.5-1e-4){switched=true;s.jokerColor='chaos';s.jokerSeen=31;E.event(s,'jokerColor',{from:'red',color:'chaos',points:s.board.flatMap((u,i)=>u?.hero==='joker'?[E.cellPoint(i)]:[])});}
    return s.events.splice(0);
  }};
}
