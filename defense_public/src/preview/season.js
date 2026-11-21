import {calendar,HOUR} from '../economy.js';

const DAY=24*HOUR;
// Each two-week season contains one oath week and one twin week, so its records cover one window per event.
export function season(now){
  const {weekNo}=calendar(now),index=Math.floor(weekNo/2),even=index*2;
  const start=Date.UTC(1970,0,5)+even*7*DAY-9*HOUR,end=start+14*DAY;
  return {index,id:`S${index}`,start,end,daysLeft:Math.max(1,Math.ceil((end-now)/86400000))};
}
export const EVENT_ROTATION_START=1483;
export function eventWindow(now){const index=calendar(now).weekNo,start=Date.UTC(1970,0,5)+index*7*DAY-9*HOUR,end=start+7*DAY;return {index,id:`W${index}`,start,end,daysLeft:Math.max(1,Math.ceil((end-now)/86400000))};}
export function activeEvent(now,flip=false){return season(now).index<EVENT_ROTATION_START?'both':(calendar(now).weekNo%2===0)!==flip?'oath':'twin';}
export function nextEvent(now,flip=false){const start=eventWindow(now).end;return {kind:activeEvent(start,flip),start};}
export const eventOpen=(kind,now,flip=false)=>{const a=activeEvent(now,flip);return a==='both'||a===kind;};
