import {HIDDEN} from './content.js';

export const TEMPO=Object.freeze({pickupHours:2,guardianHours:4,draftHours:4,eventHours:4,rushHours:8});
const HOUR=3600000,KST=9*HOUR,PREFIX={pickup:'P',guardian:'G',draft:'D',event:'W',rush:'R'};
export function periodOf(kind,now){
  const ms=TEMPO[`${kind}Hours`]*HOUR,index=Math.floor((now+KST)/ms),start=index*ms-KST;
  return {kind,index,id:`${PREFIX[kind]}${index}`,start,end:start+ms};
}
export function guardianSlots(id,now=Date.now(),count=2){
  const at=HIDDEN.indexOf(id);if(at<0)return [];
  const {index,start}=periodOf('guardian',now),size=HIDDEN.length,ms=TEMPO.guardianHours*HOUR;
  const offset=((at-index)%size+size)%size;
  return Array.from({length:count},(_,i)=>{const from=start+(offset+i*size)*ms;return {start:from,end:from+ms};});
}
