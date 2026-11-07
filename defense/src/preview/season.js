import {calendar,HOUR} from '../economy.js';

const DAY=24*HOUR;
// Two-week seasons. calendar().weekNo is the Monday week number in UTC+9; a season is a pair of those weeks.
export function season(now){
  const {weekNo}=calendar(now),index=Math.floor(weekNo/2),even=index*2;
  const start=Date.UTC(1970,0,5)+even*7*DAY-9*HOUR,end=start+14*DAY;
  return {index,id:`S${index}`,start,end,daysLeft:Math.max(1,Math.ceil((end-now)/86400000))};
}
export const EVENT_ROTATION_START=1483;
export function activeEvent(now,flip=false){const i=season(now).index;return i<EVENT_ROTATION_START?'both':((i-EVENT_ROTATION_START)%2===0)!==flip?'oath':'twin';}
export function nextEvent(now,flip=false){const start=season(now).end;return {kind:activeEvent(start,flip),start};}
export const eventOpen=(kind,now,flip=false)=>{const a=activeEvent(now,flip);return a==='both'||a===kind;};
