import {calendar,HOUR} from '../economy.js';

const DAY=24*HOUR;
// Two-week seasons. calendar().weekNo is the Monday week number in UTC+9; a season is a pair of those weeks.
export function season(now){
  const {weekNo}=calendar(now),index=Math.floor(weekNo/2),even=index*2;
  const start=Date.UTC(1970,0,5)+even*7*DAY-9*HOUR,end=start+14*DAY;
  return {index,id:`S${index}`,start,end,daysLeft:Math.max(1,Math.ceil((end-now)/86400000))};
}
