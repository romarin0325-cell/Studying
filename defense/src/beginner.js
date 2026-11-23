import {heroPool,lateOpen} from './economy.js';

export const UNLOCKS=Object.freeze({garden:2,library:4,relic:6,draft:8,dispatch:9,season:11,monthly:13,request:15,event:17});
export const featureOpen=(p,id)=>p.ftue?.legacy===true||!Object.hasOwn(UNLOCKS,id)||p.cleared>=UNLOCKS[id]||p.ftue?.seen?.includes(id)===true;
export const newlyOpened=p=>p.ftue?.legacy?[]:Object.keys(UNLOCKS).filter(id=>featureOpen(p,id)&&!p.ftue?.seen.includes(id));
export const FTUE_STEPS=Object.freeze(['lobby','prepare','summon','merge','cast','auto','firstTen','formation']);
// Feature tours: when a feature has opened, Rumi walks through its main control once, the first time its screen is
// open (app.js TOURS). A finished or skipped tour is remembered; saves that never had the tutorial get none.
export const TOUR_IDS=Object.freeze(['garden','library','relic','draft','dispatch','season','monthly','event']);
export function migrateChallengeFtue(ftue){
  for(const key of ['seen','tours']){
    const ids=ftue?.[key];
    if(Array.isArray(ids)&&ids.includes('challenge'))ftue[key]=[...new Set([...ids.filter(id=>id!=='challenge'),'draft','monthly','event'])];
  }
}
export const tourOpen=(p,id)=>!!p.ftue&&!p.ftue.legacy&&TOUR_IDS.includes(id)&&featureOpen(p,id)&&!(p.ftue.tours||[]).includes(id);
export const ftueNext=p=>!p.ftue||p.ftue.legacy||p.ftue.skipped?null:FTUE_STEPS.find(id=>!p.ftue.done.includes(id))??null;
export const BEGINNER_DAYS=Object.freeze([
  {day:1,login:{dreams:500},task:{id:'clear1',text:'스테이지 1 클리어',reward:{dreams:100}}},
  {day:2,login:{dreams:2000},big:true,task:{id:'greet',text:'파트너에게 인사',reward:{dreams:100}}},
  {day:3,login:{dust:1000},task:{id:'water',text:'온실에 물 주기',reward:{dreams:100}}},
  {day:4,login:{dreams:300,bouquet:2},task:{id:'gift',text:'동료에게 선물 주기',reward:{dreams:100}}},
  {day:5,login:{dreams:800},task:{id:'relic',text:'유물 소환 1회',reward:{dreams:100}}},
  {day:6,login:{dust:1500},task:{id:'clear18',text:'스테이지 18 클리어',reward:{dreams:200}}},
  {day:7,login:{choice:'UR'},big:true,task:{id:'clear21',text:'스테이지 21 클리어',reward:{dreams:200}}},
]);
export const urChoices=p=>heroPool('UR',lateOpen(p.cleared)).map(id=>({id,owned:!!p.heroes[id]?.owned}));
export function beginnerState(p){
  const b=p.beginner,active=!!b&&!b.closed,count=b?.count||0;
  const days=BEGINNER_DAYS.map(d=>{const unlocked=count>=d.day,done=d.task.id.startsWith('clear')?p.cleared>=Number(d.task.id.slice(5)):!!b?.did.includes(d.task.id),loginClaimed=!!b?.claimed.includes(d.day),taskClaimed=!!b?.tasks.includes(d.day);return {day:d.day,big:!!d.big,unlocked,login:{reward:d.login,claimed:loginClaimed,claimable:active&&unlocked&&!loginClaimed},task:{...d.task,done,claimed:taskClaimed,claimable:active&&unlocked&&done&&!taskClaimed}};});
  const next=days.find(d=>!d.login.claimed);return {active,count,days,next:next?{day:next.day,reward:next.login.reward}:null,choice:b?.choice??null};
}
