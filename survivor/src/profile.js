import { VERSION,HERO,HEROES,STAGE,STAGES,META,ACHIEVEMENTS,clamp } from './content.js';
export const PROFILE_KEY='astra.nocturne.profile.v1';
export const RUN_KEY='astra.nocturne.run.v1';
export function freshProfile(){return {version:VERSION,crystals:0,totalKills:0,runs:0,wins:0,meta:Object.fromEntries(META.map(m=>[m.id,0])),achievements:[],travelers:[],history:[],claimed:[],best:{},settings:{music:true,sound:true,volume:.4,effects:true,numbers:true,joystick:'floating'},selection:{hero:'rumi',stage:'garden',difficulty:'normal'}};}
export function normalizeProfile(value){
  if(!value||value.version!==VERSION)throw new Error('지원하지 않는 기록 버전입니다.');
  const out=freshProfile();const finite=n=>typeof n==='number'&&Number.isFinite(n);
  for(const k of ['crystals','totalKills','runs','wins'])if(finite(value[k]))out[k]=Math.floor(clamp(value[k],0,100000000));
  for(const m of META)if(finite(value.meta?.[m.id]))out.meta[m.id]=Math.floor(clamp(value.meta[m.id],0,m.max));
  out.achievements=[...new Set((Array.isArray(value.achievements)?value.achievements:[]).filter(id=>ACHIEVEMENTS.some(a=>a.id===id)))];
  out.travelers=[...new Set((Array.isArray(value.travelers)?value.travelers:[]).filter(id=>HERO[id]))];
  out.claimed=(Array.isArray(value.claimed)?value.claimed:[]).filter(id=>typeof id==='string'&&id.length<120).slice(-30);
  out.history=(Array.isArray(value.history)?value.history:[]).filter(r=>r&&HERO[r.hero]&&STAGE[r.stage]&&finite(r.time)&&finite(r.kills)&&finite(r.reward)).slice(0,20).map(r=>({hero:r.hero,stage:r.stage,difficulty:['gentle','normal','eclipse'].includes(r.difficulty)?r.difficulty:'normal',won:!!r.won,time:clamp(r.time,0,86400),kills:clamp(r.kills,0,1000000),reward:clamp(r.reward,0,100000),date:typeof r.date==='string'?r.date.slice(0,30):''}));
  for(const st of STAGES){const best=value.best?.[st.id];if(best&&finite(best.kills)&&finite(best.time))out.best[st.id]={kills:clamp(best.kills,0,10000000),time:clamp(best.time,0,86400),won:!!best.won};}
  for(const key of ['music','sound','effects','numbers'])if(typeof value.settings?.[key]==='boolean')out.settings[key]=value.settings[key];
  if(finite(value.settings?.volume))out.settings.volume=clamp(value.settings.volume,0,1);
  if(['floating','fixed'].includes(value.settings?.joystick))out.settings.joystick=value.settings.joystick;
  if(HERO[value.selection?.hero])out.selection.hero=value.selection.hero;if(STAGE[value.selection?.stage])out.selection.stage=value.selection.stage;if(['gentle','normal','eclipse'].includes(value.selection?.difficulty))out.selection.difficulty=value.selection.difficulty;
  return out;
}
export function metaCost(profile,id){const def=META.find(m=>m.id===id);return def?Math.round(def.cost*(1+(profile.meta[id]||0)*.65)):Infinity;}
export function buyMeta(profile,id){const def=META.find(m=>m.id===id),cost=metaCost(profile,id);if(!def||profile.meta[id]>=def.max||profile.crystals<cost)return false;profile.crystals-=cost;profile.meta[id]++;return true;}
export function settle(profile,game,date=new Date().toISOString()){
  if(!['victory','defeat'].includes(game.mode)||profile.claimed.includes(game.runId))return null;
  const won=game.mode==='victory',difficulty={gentle:.8,normal:1,eclipse:1.5}[game.difficulty]||1;
  const reward=Math.max(5,Math.floor((game.kills*.065+game.time*.06+game.gold*1.5+(won?70:0))*difficulty*(game.hero==='cinderella'?1.2:1)));
  profile.crystals+=reward;profile.totalKills+=game.kills;profile.runs++;if(won)profile.wins++;if(!profile.travelers.includes(game.hero))profile.travelers.push(game.hero);
  const old=profile.best[game.stage];profile.best[game.stage]={won:won||!!old?.won,kills:Math.max(game.kills,old?.kills||0),time:Math.max(game.time,old?.time||0)};
  const earned=[];const checks={first:true,hundred:game.kills>=100,evolved:game.evolutions>0,six:game.weapons.length===6,dawn:won&&game.stage==='garden',chapel:won&&game.stage==='cathedral',rift:won&&game.stage==='rift',eclipse:won&&game.difficulty==='eclipse',travelers:profile.travelers.length===HEROES.length};
  for(const a of ACHIEVEMENTS)if(checks[a.id]&&!profile.achievements.includes(a.id)){profile.achievements.push(a.id);profile.crystals+=a.reward;earned.push(a);}
  profile.claimed.push(game.runId);profile.claimed=profile.claimed.slice(-30);
  profile.history.unshift({hero:game.hero,stage:game.stage,difficulty:game.difficulty,won,time:game.time,kills:game.kills,reward,date});profile.history=profile.history.slice(0,20);
  return {reward,earned,total:reward+earned.reduce((n,a)=>n+a.reward,0)};
}
export class Storage {
  constructor(storage){this.storage=storage;this.available=true;this.memory=new Map();this.error='';}
  read(key){if(this.memory.has(key))return this.memory.get(key);try{return this.storage?.getItem(key)??null;}catch{this.available=false;this.error='이 브라우저에서는 기록을 저장할 수 없어요. 현재 원정은 계속할 수 있어요.';return null;}}
  write(key,value){this.memory.set(key,value);try{if(!this.storage)throw new Error();this.storage.setItem(key,value);return true;}catch{this.available=false;this.error='기록 저장 공간을 사용할 수 없어요. 설정에서 기록을 내보낼 수 있어요.';return false;}}
  remove(key){this.memory.set(key,null);try{this.storage?.removeItem(key);}catch{this.available=false;}}
  loadProfile(){const text=this.read(PROFILE_KEY);if(!text)return freshProfile();try{return normalizeProfile(JSON.parse(text));}catch{this.error='기록을 읽지 못했어요. 원본 기록을 덮어쓰기 전에 설정에서 내보낼 수 있어요.';this.corrupt=text;return freshProfile();}}
}
