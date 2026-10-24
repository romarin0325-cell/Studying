// Lightning Sage basic attacks. Drawing only: travel time, damage and chain targets
// stay in engine.js. The picture is a held bolt, not a bullet, and it is seeded
// from the shot id so a frame does not reshuffle the jag.
import {HERO} from '../content.js';

export const LIGHTNING_BOLT_WINDOW=.22;
export const LIGHTNING_IMPACT_LIFE=.18;
export const LIGHTNING_CHAIN_LIFE=.18;

const hash=(seed,i)=>{const n=Math.sin(seed*12.9898+i*78.233)*43758.5453;return n-Math.floor(n);};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

export function boltSpine(x0,y0,x1,y1,seed,frame,segments,amp){
  const dx=x1-x0,dy=y1-y0,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,pts=[[x0,y0]];
  let jag=0;
  for(let i=1;i<segments;i++){
    const f=i/segments,env=Math.sin(Math.PI*f),kick=(hash(seed,frame*19+i)-.5)*2;
    jag=clamp(jag*.2+kick*amp,-amp,amp);
    pts.push([x0+dx*f+nx*jag*env,y0+dy*f+ny*jag*env]);
  }
  pts.push([x1,y1]);
  return pts;
}

function boltForks(spine,seed,frame,count,scale){
  const out=[],n=spine.length;
  if(n<4||count<=0)return out;
  for(let k=0;k<count;k++){
    const i=1+Math.floor(hash(seed,frame*23+k*5)*(n-2));
    const a=spine[i-1],b=spine[i],c=spine[Math.min(n-1,i+1)];
    const dx=c[0]-a[0],dy=c[1]-a[1],len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
    const sign=hash(seed,frame*29+k)<.5?-1:1,reach=(18+hash(seed,k+11)*22)*scale;
    const j=(hash(seed,frame+k+3)-.5)*8;
    out.push([
      [b[0],b[1]],
      [b[0]+nx*sign*reach*.55+(dx/len)*reach*.25+nx*j,b[1]+ny*sign*reach*.55+(dy/len)*reach*.25+ny*j],
      [b[0]+nx*sign*reach+(dx/len)*reach*.4,b[1]+ny*sign*reach+(dy/len)*reach*.4],
    ]);
  }
  return out;
}

function paintBolt(ctx,spine,forks,scale,alpha,halo){
  const base=ctx.globalAlpha;
  ctx.save();
  ctx.globalCompositeOperation='lighter';
  ctx.lineCap='round';ctx.lineJoin='round';
  const stroke=(pts,color,w,a)=>{
    if(a<=0||w<=0||!pts?.length)return;
    ctx.globalAlpha=Math.min(1,base*alpha*a);ctx.strokeStyle=color;ctx.lineWidth=w;
    ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
  };
  // Phone battle draws the 720-wide board at about half size. The core stays
  // thin enough that the jag reads; the gold edge is the glow, not a second beam.
  const core=2.15*scale,mid=5.1*scale,glow=11*scale;
  if(halo)stroke(spine,'#f2db84',glow,.34);
  stroke(spine,'#ffe7a2',mid,.82);
  stroke(spine,'#fffef8',Math.max(1.6,core),1);
  for(const fork of forks){
    if(halo)stroke(fork,'#f2db84',mid*.7,.32);
    stroke(fork,'#fffef8',Math.max(1.15,core*.72),.9);
  }
  ctx.restore();
}

function clusterScale(chainRatio){
  if(chainRatio>=.8)return 1.16;
  if(chainRatio>=.75)return 1.1;
  if(chainRatio>=.7)return 1.05;
  return 1;
}

function heldFrame(age,span,reduced){
  const u=clamp(span>0?age/span:1,0,.999);
  if(reduced)return {frame:0,blink:1-u*.2};
  const frame=u<.34?0:u<.68?1:2;
  const blink=(u>.32&&u<.4)||(u>.66&&u<.74)?.48:u>.9?(1-u)/.1:1;
  return {frame,blink};
}

function segmentCount(len,cap){return Math.max(3,Math.min(cap,Math.round(len/44)));}

export function drawLightningShot(fx,shot,s,target){
  const ctx=fx.ctx;if(!ctx||shot.hero!=='lightning_sage')return false;
  const to={x:target.x,y:target.y-20},from={x:shot.from.x,y:shot.from.y-26};
  const span=Math.min(LIGHTNING_BOLT_WINDOW,shot.total);
  const flashing=shot.life<=span;
  if(!flashing){
    // A local charge at the hand while the engine shot is still in flight.
    // Nothing travels, so the gap does not read as a bullet.
    if(!fx.reduced&&shot.total>span){
      const u=clamp((shot.total-shot.life-span)/(shot.total-span),0,1),a=Math.sin(u*Math.PI)*.45;
      fx.glow?.('glow','#fff6c2',from.x,from.y,18+u*12,a);
    }
    return true;
  }
  const age=span-shot.life,rank=clamp(shot.rank||1,1,6),low=fx.quality==='low';
  let flashingCount=0;
  for(const other of s?.shots||[])if(other.hero==='lightning_sage'&&other.life>0&&other.life<=Math.min(LIGHTNING_BOLT_WINDOW,other.total))flashingCount++;
  const crowded=flashingCount>4;
  const {frame,blink}=heldFrame(age,span,fx.reduced);
  const gain=clusterScale(shot.chainRatio),scale=(1+(rank-1)*.14)*gain;
  const len=Math.hypot(to.x-from.x,to.y-from.y)||1;
  const cap=low||fx.reduced?5:7,amp=Math.min(20+rank*2.2,len*.24)*gain;
  const seed=shot.uid*17+3;
  const spine=boltSpine(from.x,from.y,to.x,to.y,seed,frame,segmentCount(len,cap),amp);
  const forks=boltForks(spine,seed,frame,fx.reduced?0:low||crowded?1:rank>=4?2:1,1);
  const halo=!low&&!crowded;
  if(halo)fx.glow?.('glow','#fff4c4',to.x,to.y,30+rank*3,blink*.42*gain);
  if(halo&&!fx.reduced)fx.glow?.('glow','#f2db84',from.x,from.y,20,blink*.28);
  ctx.save();ctx.globalAlpha=blink;
  paintBolt(ctx,spine,forks,scale,1,halo);
  if(halo&&!fx.reduced){
    const echo=boltSpine(from.x,from.y,to.x,to.y,seed+50,frame,segmentCount(len,cap),amp*.45);
    paintBolt(ctx,echo,[],scale*.55,.42,false);
  }
  ctx.globalCompositeOperation='lighter';ctx.fillStyle='#fffef8';ctx.globalAlpha=blink;
  ctx.beginPath();ctx.arc(to.x,to.y,2.4*scale,0,Math.PI*2);ctx.fill();
  ctx.restore();
  return true;
}

export function drawLightningImpact(fx,e,t,clarity=1){
  if(e.type!=='impact'||e.hero!=='lightning_sage')return false;
  const ctx=fx.ctx;if(!ctx)return true;
  const hop=!!e.hop,rank=clamp(e.rank||1,1,6),low=fx.quality==='low';
  const fade=(1-clamp(t,0,1))**1.55,a=fade*clarity*(hop?.62:.85+(rank-1)*.04);
  if(a<=.02)return true;
  const x=e.x,y=e.y-18,seed=Math.round(x)*13+Math.round(y)*29+(e.rank||1)*17+(hop?101:0);
  const sparks=fx.reduced?3:low?4:hop?4:6;
  const ring=(hop?8:14)+(1-(1-clamp(t/.4,0,1))**3)*(hop?16:28+rank*2);
  if(!hop)fx.glow?.('glow','#fff6c8',x,y,(low?26:34)+rank*2,a*.4);
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
  ctx.globalAlpha=a*.9;ctx.strokeStyle='#fffef8';ctx.lineWidth=(hop?1.2:1.8)*(1-t*.5);
  ctx.beginPath();ctx.arc(x,y,Math.max(2,ring),0,Math.PI*2);ctx.stroke();
  ctx.globalAlpha=a*.45;ctx.strokeStyle=HERO.lightning_sage?.color||'#f2db84';ctx.lineWidth=(hop?2.2:3.2)*(1-t);
  ctx.beginPath();ctx.arc(x,y,Math.max(2,ring*.72),0,Math.PI*2);ctx.stroke();
  for(let i=0;i<sparks;i++){
    const ang=hash(seed,i)*Math.PI*2,dist=(8+hash(seed,i+9)*(hop?14:26))*(.35+.65*Math.min(1,t/.35));
    const j=hash(seed,i+4)*6-3,mx=x+Math.cos(ang)*dist*.5+Math.cos(ang+1.57)*j,my=y+Math.sin(ang)*dist*.5+Math.sin(ang+1.57)*j;
    ctx.globalAlpha=a*(.55+hash(seed,i+2)*.4);ctx.strokeStyle=i%2?'#fffef8':'#ffe7a2';ctx.lineWidth=hop?1:1.45;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(mx,my);ctx.lineTo(x+Math.cos(ang)*dist,y+Math.sin(ang)*dist);ctx.stroke();
  }
  ctx.restore();
  return true;
}

export function drawLightningChain(ctx,e,{reduced=false,low=false}={}){
  const x0=e.from.x,y0=e.from.y-20,x1=e.to.x,y1=e.to.y-20;
  const len=Math.hypot(x1-x0,y1-y0)||1;
  const seed=Math.round(x0)*13+Math.round(y0)*3+Math.round(x1)*7+Math.round(y1);
  const u=clamp(1-e.life/Math.max(1e-6,e.total),0,.999);
  const frame=reduced?0:u<.34?0:u<.68?1:2;
  const blink=reduced?1:(u>.3&&u<.4)||(u>.64&&u<.74)?.55:1;
  const cap=low||reduced?4:5,amp=Math.min(low?12:16,len*.22);
  const spine=boltSpine(x0,y0,x1,y1,seed,frame,segmentCount(len,cap),amp);
  const forks=boltForks(spine,seed,frame,reduced||low?0:1,.72);
  ctx.save();ctx.globalAlpha*=blink;
  paintBolt(ctx,spine,forks,low?.62:.78,.92,!low);
  const base=ctx.globalAlpha,n=reduced?2:3;
  ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
  for(let i=0;i<n;i++){
    const ang=hash(seed,40+i)*Math.PI*2,reach=6+hash(seed,50+i)*8;
    ctx.globalAlpha=base*.85;ctx.strokeStyle=i%2?'#fffef8':'#ffe7a2';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x1+Math.cos(ang)*reach,y1+Math.sin(ang)*reach*.65);ctx.stroke();
  }
  ctx.restore();
}
