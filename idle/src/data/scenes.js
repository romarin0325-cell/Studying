import {HEROES,COMPANIONS} from './catalog.js';
import {HERO_SCENES} from './hero-scenes.js';
import {COMPANION_SCENES} from './companion-scenes.js';
import {SPECIAL_SCENES,SEASON_SCENES} from './extra-scenes.js';
export const BOND_THRESHOLDS=[0,20,50,90,140,210,300,420,570,750,960,1200];
const lines=(data,actor)=>data.map((line,i)=>({speaker:typeof line==='string'?actor:line[0],expression:i%3===0?'warm':'neutral',text:typeof line==='string'?line:line[1]}));
const scene=(id,entry,actor,requirements,extra={})=>({id,title:entry[0],actors:[...new Set(lines(entry.slice(1),actor).map(x=>x.speaker))],requirements,priority:1,lines:lines(entry.slice(1),actor),choices:[{text:'조금 더 듣는다',reply:'곁에 머물며 이야기를 들었다.'},{text:'오늘을 기록한다',reply:'함께한 시간을 앨범에 남겼다.'}],readFlag:id,rewardId:null,artId:actor,...extra});
export const SCENES=[
...HEROES.flatMap(h=>HERO_SCENES[h.id].map((entry,i)=>scene('hero:'+h.id+':'+i,entry,h.id,{kind:'bond',heroId:h.id,points:BOND_THRESHOLDS[i]},{category:'hero',priority:i===5?5:2,rewardId:i===5?'bond_'+h.id+'_01':null,artId:i>=5?'bond_'+h.id+'_01':h.id}))),
...COMPANIONS.flatMap(c=>COMPANION_SCENES[c.id].map((entry,i)=>scene('companion:'+c.id+':'+i,entry,c.id,{kind:'companion',companionId:c.id,gates:i*5},{category:'companion'}))),
...Object.entries(SPECIAL_SCENES).flatMap(([id,entries])=>entries.map((entry,i)=>scene('special:'+id+':'+i,entry,null,{kind:'special',group:id,index:i},{category:'special',priority:6,artId:id,rewardId:i===2?id:null}))),
...SEASON_SCENES.map((entry,i)=>scene('season:s01:'+i,entry,null,{kind:'season',days:[1,7,14,21][Math.floor(i/2)],index:i},{category:'season',priority:3,artId:i<2?'s01_snow_rabbit':i<6?'s01_lumi':'s01_lumi_whale'}))
];
export const SCENE=Object.fromEntries(SCENES.map(s=>[s.id,s]));
