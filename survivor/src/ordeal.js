import {STAGE,DIFFICULTY,WORLD,clamp} from './content.js';

export const BOSSES={
  rose:{name:'장미의 집행관',concept:'꽃잎 사이로 · 가시가 남는 길',atlas:'bosses',row:0,columns:4},
  judge:{name:'성당의 심판관',concept:'십자 심판 · 대각선의 틈',atlas:'bosses',row:1,columns:4},
  sovereign:{name:'밤의 군주',concept:'추적 유성 · 바깥으로 번지는 밤',atlas:'bosses',row:2,columns:4},
  thorn:{name:'백골 장미사슴',concept:'가시 울타리 · 예고된 돌진',atlas:'ordeal-bosses',row:0,columns:2},
  clock:{name:'열두 번째 종',concept:'교차하는 시침 · 고요한 원의 안쪽',atlas:'ordeal-bosses',row:1,columns:2},
  eclipse:{name:'새벽을 삼키는 고래',concept:'갈라지는 어둠 · 좁아지는 안전지대',atlas:'ordeal-bosses',row:2,columns:2}
};
const guardians={garden:'rose',cathedral:'judge',rift:'sovereign'};
const sentries={garden:['thorn','clock'],cathedral:['clock','eclipse'],rift:['eclipse','thorn']};
export const bossKind=(enemy,stage)=>enemy.bossKind||guardians[stage]||'rose';
export const bossMilestone=(spawned,duration)=>spawned<3?[duration*.25,duration*.6,duration][spawned]:duration+(spawned-2)*60;
export function bossArrival(spawned,stage,difficulty){
  const overrun=Math.max(0,spawned-2),index=spawned%3,kind=overrun?Object.keys(BOSSES)[(overrun+2)%6]:index===2?guardians[stage]:sentries[stage][index];
  const hp=Math.min(9999999,(overrun?220000*2.8**Math.min(18,overrun-1):[14000,32000,85000][index])*(difficulty==='gentle'?.55:1)*STAGE[stage].danger*DIFFICULTY[difficulty].hp);
  return {bossKind:kind,name:BOSSES[kind].name,phase:Math.min(2,index+1),overrun,patternStep:0,hp,maxHp:hp,speed:overrun?Math.min(210,55+overrun*16):35+index*8,damage:Math.min(600,(overrun?38*1.45**Math.min(12,overrun-1):[24,30,38][index])*DIFFICULTY[difficulty].damage),ai:1.7};
}
export const bossCadence=e=>Math.max(1.4,(e.overrun?2.35-Math.min(8,e.overrun)*.1:3.2)-(e.hp/e.maxHp<.5?.6:0));

// These shapes are both rendered and collided in ground space. Projectile aim
// remains in body space in engine.js. Safe holes are real collision exclusions.
export function bossPattern(e,p,stage){
  const kind=bossKind(e,stage),step=e.patternStep||0,enraged=e.hp/e.maxHp<.5,over=e.overrun||0;
  const wait=Math.max(.7,1.25-Math.min(6,over)*.07),angle=Math.atan2(p.y-e.y,p.x-e.x),out=[];
  const zone=(x,y,r,delay=wait,duration=.45)=>out.push({kind:'zone',x:clamp(x,40,WORLD-40),y:clamp(y,40,WORLD-40),r,wait:delay,life:delay+duration,damage:e.damage,tick:0,telegraph:delay});
  const annulus=(x,y,r,inner,delay=wait)=>out.push({kind:'annulus',x,y,r,inner,wait:delay,life:delay+.55,damage:e.damage*1.15,tick:0,telegraph:delay});
  const line=(x,y,a,span,width=20,delay=wait,duration=.55)=>{const dx=Math.cos(a)*span/2,dy=Math.sin(a)*span/2;out.push({kind:'line',x,y,ax:x-dx,ay:y-dy,bx:x+dx,by:y+dy,r:width,wait:delay,life:delay+duration,damage:e.damage*1.1,tick:0,telegraph:delay});};
  if(kind==='thorn'){
    if(step%2===0){line(e.x+Math.cos(angle)*200,e.y+Math.sin(angle)*200,angle,650,23,wait);zone(p.x,p.y,60,wait+.35,2.2);}
    else {for(const side of [-1,1])line(p.x,p.y+side*100,0,650,22,wait,2.2);zone(p.x+p.dx*95,p.y+p.dy*95,65,wait+.45,1.3);}
  }else if(kind==='clock'){
    const a=step*Math.PI/4;line(p.x,p.y,a,720,20,wait);line(p.x,p.y,a+Math.PI/2,720,20,wait+.28);
    if(step%2||enraged)annulus(p.x,p.y,215,145,wait+.6);
  }else if(kind==='eclipse'){
    annulus(p.x,p.y,210,138,wait+.25);
    for(const side of [-1,1])line(p.x+Math.cos(angle+Math.PI/2)*side*72,p.y+Math.sin(angle+Math.PI/2)*side*72,angle,650,23,wait,1.2);
    if(enraged||over)for(let i=0;i<3;i++)zone(p.x+p.dx*i*85,p.y+p.dy*i*85,55,wait+.45+i*.25);
  }else if(kind==='judge'){
    for(let i=0;i<4;i++){const a=i*Math.PI/2+step*Math.PI/4;zone(p.x+Math.cos(a)*108,p.y+Math.sin(a)*108,60,wait,1.1);}
    line(e.x,e.y,angle+Math.PI/2,720,24,wait+.4);if(enraged)annulus(e.x,e.y,225,145,wait+.6);
  }else if(kind==='sovereign'){
    for(let i=0;i<(enraged?5:3);i++)zone(p.x+p.dx*(i-1)*78,p.y+p.dy*(i-1)*78,60,wait+i*.22,1.1);
    annulus(e.x,e.y,230,140,wait+.7);
  }else{
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5+step*.35;zone(p.x+Math.cos(a)*118,p.y+Math.sin(a)*118,54,wait,1.7);}
    if(enraged)line(p.x,p.y,angle,650,21,wait+.45);
  }
  if(over>=3)zone(p.x,p.y,68,wait+.8,1.4);
  return out;
}

export function groundDanger(h,x,y,margin=0){
  if(h.kind==='line'){
    const dx=h.bx-h.ax,dy=h.by-h.ay,t=clamp(((x-h.ax)*dx+(y-h.ay)*dy)/(dx*dx+dy*dy||1),0,1);
    return Math.hypot(x-h.ax-t*dx,y-h.ay-t*dy)<=h.r+margin;
  }
  const d=Math.hypot(x-h.x,y-h.y);
  return d<=h.r+margin&&(h.kind!=='annulus'||d>=Math.max(0,h.inner-margin));
}
