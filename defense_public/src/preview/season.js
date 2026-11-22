import {periodOf} from '../tempo.js';

// A season pairs two consecutive event windows so each event has one set of records.
export function season(now){
  const w=eventWindow(now),index=Math.floor(w.index/2),ms=w.end-w.start,start=w.start-(w.index-index*2)*ms,end=start+2*ms;
  return {index,id:`S${index}`,start,end,msLeft:end-now};
}
export function eventWindow(now){const {index,id,start,end}=periodOf('event',now);return {index,id,start,end,msLeft:end-now};}
export function activeEvent(now,flip=false){return (eventWindow(now).index%2===0)!==flip?'oath':'twin';}
export function nextEvent(now,flip=false){const start=eventWindow(now).end;return {kind:activeEvent(start,flip),start};}
export const eventOpen=(kind,now,flip=false)=>activeEvent(now,flip)===kind;
