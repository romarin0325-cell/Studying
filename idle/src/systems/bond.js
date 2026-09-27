import {SCENES,SCENE} from '../data/scenes.js';
import {HEROES} from '../data/catalog.js';
import {HOME_LINES} from '../data/home-lines.js';
import {requireThat} from '../core/rng.js';
import {addMemory} from './seasons.js';
export function unlocked(s,scene){
 const r=scene.requirements;
 if(r.kind==='bond')return s.heroes[r.heroId].bond>=r.points;
 if(r.kind==='companion')return s.companions[r.companionId].owned&&s.companions[r.companionId].gates.length>=r.gates;
 if(r.kind==='special'){
  const base=r.group==='trauma'?s.companions.time_magician.owned&&[0,1,2].every(i=>s.readScenes.includes('companion:time_magician:'+i))&&Object.values(s.heroes).some(h=>h.stage>=60):s.heroes.luna.bond>=210&&s.heroes.jasmine.bond>=210&&s.heroes.luna.stage+s.heroes.jasmine.stage>=120;
  return base&&(r.index===0||s.readScenes.includes('special:'+r.group+':'+(r.index-1)));
 }
 if(r.kind==='season')return Math.max(0,...Object.values(s.calendar.seasonPoints).map(x=>x/10))>=r.days&&(r.index===0||s.readScenes.includes('season:s01:'+(r.index-1)));
 return false;
}
export function readScene(s,id,skip=false){const scene=SCENE[id];requireThat(scene&&unlocked(s,scene),'이야기 해금 조건이 아직 남아 있습니다.');if(s.readScenes.includes(id))return {alreadyRead:true};s.readScenes.push(id);if(skip)s.skippedScenes.push(id);if(scene.rewardId)addMemory(s,scene.rewardId);return {sceneId:id,rewardId:scene.rewardId};}
export const unreadScenes=s=>SCENES.filter(scene=>unlocked(s,scene)&&!s.readScenes.includes(scene.id)).sort((a,b)=>b.priority-a.priority);
export function homeLine(s,now=Date.now(),recentType=''){
 const hero=s.ui.hero,all=HOME_LINES[hero],hour=new Date(now+9*3600000).getUTCHours(),unread=unreadScenes(s).find(x=>x.actors.includes(hero));
 let group=unread?'bond':['level','gear','mastery'].includes(recentType)?'growth':recentType==='battle'?'expedition':['summon','exchange','scene'].includes(recentType)?'collection':'time';
 const candidates=all[group].map((text,index)=>({id:hero+':'+group+':'+index,text})),fresh=candidates.filter(x=>!s.ui.lastHomeLines.includes(x.id));
 return group==='time'?candidates[hour<11?0:hour<17?1:hour<22?2:3]:(fresh.length?fresh:candidates)[0];
}
