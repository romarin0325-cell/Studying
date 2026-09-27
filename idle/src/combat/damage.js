import {balance} from '../data/catalog.js';
export function damagePacket({p=0,m=0,atk,matk,def=0,mdef=0,element=1,crit=1,increase=0,exposed=1,reduction=1,taken=1,physicalReduction=0,magicReduction=0,miss=false}){if(miss||p+m<=0)return 0;const P=p*atk*Math.max(.25,500/(500+Math.max(0,def)))*(1-physicalReduction),M=m*matk*Math.max(.25,500/(500+Math.max(0,mdef)))*(1-magicReduction);return Math.max(1,Math.floor((P+M)*element*crit*(1+increase)*exposed*reduction*taken));}
export const elemental=(from,to)=>balance.combat.elementMatrix[from]?.[to]??1;
