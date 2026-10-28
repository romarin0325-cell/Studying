// Pass 20 blades: Zeke's Ragnarok and Luna's moon cut. These functions only draw; damage, timing and targets stay in engine.js.
// zeke-ragnarok (3x1, GPT image, docs/art/pass20-fx-20261028): 0 greatsword, tip down; 1 impact eruption; 2 fire seal ring.
// Measured on the packed cells (share of the stamp size from its centre): the sword tip sits 0.41 below the centre, the
// eruption's white-hot point 0.20 below it, and the ring's outer flame at 0.83 of the half-size.
const RAGNAROK='zeke-ragnarok',TIP=.412,ERUPT=.2,SEAL_EDGE=.83;
export const RAGNAROK_LIFE=2;
const clamp=t=>Math.max(0,Math.min(1,t));
const span=(t,a,b)=>clamp((t-a)/(b-a));
const ease=t=>1-(1-clamp(t))**3;
const easeIn=t=>clamp(t)**2.2;
const hash=(seed,i)=>{const n=Math.sin(seed*12.9898+i*78.233)*43758.5453;return n-Math.floor(n);};
const stamp=(fx,frame,x,y,w,angle=0,alpha=1,blend='source-over')=>alpha>0&&fx.atlasStamp(RAGNAROK,frame,3,1,x,y,w,w,angle,alpha,blend);
function diamond(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x,y+r*.42);ctx.lineTo(x-r,y);ctx.lineTo(x,y-r*.42);ctx.closePath();ctx.fill();}

// Ragnarok: a fire seal opens on the board, the greatsword drops out of the sky and stabs the centre, a flame shockwave runs
// out across the field and fire erupts under each enemy as the wave reaches it (all enemies are hit, like the engine).
// The sword then stands in the ground, glowing, and burns away into embers. Same centre as the other field ultimates.
export function drawRagnarok(fx,skill,age){
  if(!fx.art.images[RAGNAROK])return false;
  const ctx=fx.ctx,X=360,TY=440,S=480,hit=.42,reduced=fx.reduced,end=1-span(age,1.45,RAGNAROK_LIFE);
  // A warm dusk over the field while the sword is out (lighter than the old wash; units stay readable).
  ctx.save();ctx.globalAlpha=Math.min(1,age*4)*end*(reduced?.25:.4);
  const wash=fx.ragnarokWash||(fx.ragnarokWash=(()=>{const g=ctx.createRadialGradient(X,TY,140,X,TY,600);g.addColorStop(0,'#ff6a2000');g.addColorStop(1,'#5a0e0699');return g;})());
  ctx.fillStyle=wash;ctx.fillRect(0,0,720,780);ctx.restore();
  // The seal marks where it will land, then flares as the blade arrives.
  const open=ease(span(age,0,.3)),seal=1-span(age,hit+.1,hit+.5);
  if(seal>0){const r=150*open;stamp(fx,2,X,TY,2*r/SEAL_EDGE,-age*.6,seal*.9);fx.glow('glow','#ff7a2a',X,TY,r*1.4,seal*.35);}
  // The sword falls, gathering speed, with a short afterimage; it lands at the hit.
  const fall=easeIn(span(age,.1,hit)),tipY=-80+(TY+80)*fall,landed=age>=hit;
  if(age>=.1){
    if(!landed&&!reduced)for(const [i,back] of [[1,70],[2,150]])stamp(fx,0,X,tipY-TIP*S-back*fall,S,0,(.35-.12*i)*fall);
    const glowPulse=landed?.15*Math.sin(age*9):0,embedded=landed?ease(span(age,hit,hit+.12)):0;
    // Once it stands in the ground it softens so the units around the centre stay visible, then burns away upward.
    const alpha=landed?(1-.3*embedded)*end:Math.min(1,fall*3),rise=(1-end)*40;
    stamp(fx,0,X,TY-TIP*S-rise+(landed?6*embedded:0),S,0,alpha);
    if(landed)fx.glow('glow','#ff9a3a',X,TY-120,260,(.3+glowPulse)*end);
    if(landed&&end<1&&!reduced){ctx.save();ctx.globalCompositeOperation='lighter';const k=1-end;
      for(let i=0;i<14;i++){const y=TY-hash(i,3)*S*.8-k*(60+hash(i,5)*90),x=X+(hash(i,7)-.5)*60+Math.sin(k*6+i)*10;ctx.globalAlpha=Math.sin(Math.PI*clamp(k*1.3-hash(i,9)*.3))*.9;diamond(ctx,x,y,2.6+hash(i,11)*2.4,i%3?'#ffb35a':'#fff0c8');}ctx.restore();}
  }
  if(!landed)return true;
  const since=age-hit;
  // Impact: white-hot flash, a short screen flash and one shake for the renderer.
  if(!skill.slammed){skill.slammed=true;if(!reduced)fx.shake=Math.max(fx.shake||0,11);}
  const flash=1-span(since,0,.28);
  if(flash>0){fx.glow('rays','#ffd08a',X,TY,620*ease(since/.22),flash*.8,since*1.5);fx.glow('glow','#fff3d6',X,TY,260,flash*.85);
    if(!reduced){ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=flash*.16;ctx.fillStyle='#ff9a50';ctx.fillRect(0,0,720,780);ctx.restore();}}
  // The eruption at the tip.
  const burst=span(since,0,.45);if(burst<1){const w=280+110*ease(burst/.5);stamp(fx,1,X,TY-ERUPT*w,w,0,(1-span(burst,.35,1))*.92);}
  // The shockwave: the seal's flame ring runs out to the board edge, a thin bright line rides its front. The painted band
  // thickens as it scales, so it fades as it grows and never floods the board.
  const wave=ease(span(since,0,.7)),R=60+520*wave,waveA=1-span(since,.25,.62);
  if(waveA>0){stamp(fx,2,X,TY,2*R/SEAL_EDGE,since*.4,waveA*.6*(1-.6*wave));ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=waveA*.6;ctx.strokeStyle='#ffd9a0';ctx.lineWidth=3*waveA+1;ctx.beginPath();ctx.arc(X,TY,R*.97,0,Math.PI*2);ctx.stroke();ctx.restore();}
  // Fire erupts under each enemy when the front reaches it.
  for(const [i,p] of (skill.targets||[]).slice(0,reduced?6:14).entries()){
    // The front's radius is 60+520*ease(since/.7), so it reaches distance d at .7*(1-cbrt(1-share)).
    const share=clamp((Math.hypot(p.x-X,p.y-TY)-60)/520),arrive=.7*(1-Math.cbrt(1-share)),k=span(since,arrive,arrive+.45);
    if(k<=0||k>=1)continue;const w=(108+i%3*10)*(.6+.4*ease(k/.3));
    stamp(fx,1,p.x,p.y+4-ERUPT*w,w,0,(1-span(k,.4,1))*.9);fx.glow('glow','#ffb24a',p.x,p.y-12,90,(1-k)*.55);
  }
  return true;
}

// Luna's basic attack. A thrown moon-silver blade flies straight (it is straight, so it no longer looks like a curved slash
// sliding across the board); where it lands a thin crescent cut is drawn across the target, then a second, finer cut
// crosses it. Small, short and low alpha like the cast's basic attacks; no painted frame is needed.
export function drawMoonShot(fx,shot,{from,to,t}){
  const ctx=fx.ctx,a=Math.atan2(to.y-from.y,to.x-from.x),x=from.x+(to.x-from.x)*t,y=from.y+(to.y-from.y)*t,len=20+Math.min(5,shot.rank||1)*1.2;
  ctx.save();ctx.translate(x,y);ctx.rotate(a);
  if(!fx.reduced)for(const [i,back] of [[1,12],[2,24]]){ctx.globalAlpha=.32/i;blade(ctx,-back,len,'#b48cff');}
  ctx.globalAlpha=.95;blade(ctx,0,len,'#e9ddff');ctx.restore();
  fx.glow('glow','#c5a0ff',x,y,26,.35);
  return true;
}
function blade(ctx,x,len,color){
  ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x+len*.55,0);ctx.lineTo(x-len*.15,-2.6);ctx.lineTo(x-len*.45,-1.2);ctx.lineTo(x-len*.45,1.2);ctx.lineTo(x-len*.15,2.6);ctx.closePath();ctx.fill();
  ctx.fillStyle='#ffffff';ctx.beginPath();ctx.moveTo(x+len*.55,0);ctx.lineTo(x-len*.1,-.8);ctx.lineTo(x-len*.1,.8);ctx.closePath();ctx.fill();
}
// A tapered crescent along an arc of radius r from angle a0, revealed up to `head` and trailing from `tail` (0..1 of the sweep).
function crescent(ctx,cx,cy,r,a0,sweep,tail,head,width,fill,core){
  if(head<=tail)return;const n=18,pts=[],inner=[];
  for(let i=0;i<=n;i++){const u=tail+(head-tail)*i/n,ang=a0+sweep*u,w=width*Math.sin(Math.PI*(i/n))**.8;pts.push([cx+Math.cos(ang)*r,cy+Math.sin(ang)*r]);inner.push([cx+Math.cos(ang)*(r-w),cy+Math.sin(ang)*(r-w)]);}
  ctx.fillStyle=fill;ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));for(const [x,y] of inner.reverse())ctx.lineTo(x,y);ctx.closePath();ctx.fill();
  ctx.strokeStyle=core;ctx.lineWidth=1.2;ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
}
export const MOON_CUT_LIFE=.34;
export function drawMoonCut(fx,e,t,clarity=1){
  const ctx=fx.ctx,age=t*MOON_CUT_LIFE,x=e.x,y=e.y-18,n=(e.angle||0)+Math.PI/2,fade=(1-span(age,.14,MOON_CUT_LIFE))*clarity;
  if(fade<=0)return true;
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=fade*.9;
  // Each cut is an arc whose centre sits off to one side, so the middle of the arc crosses the target diagonally (a slash
  // through it, not a ring around it). First cut, then a finer one from the other side, crossing it.
  const cut=(r,side,width,fill,core,t0)=>{const c=n+side,cx=x+Math.cos(c)*r,cy=y+Math.sin(c)*r,mid=c+Math.PI;
    crescent(ctx,cx,cy,r,mid-.62,1.24,ease(span(age,t0+.04,t0+.18)),ease(span(age,t0,t0+.09)),width,fill,core);};
  cut(44,.55,6.5,'#a77cf0cc','#f6f0ff',0);
  if(!fx.reduced){ctx.globalAlpha=fade*.65;cut(36,Math.PI-.55,4,'#c9a8ffbb','#ffffff',.06);}
  ctx.restore();
  const glint=Math.sin(Math.PI*span(age,.05,.22));if(glint>0)fx.glow('glow','#d8c4ff',x,y,40,glint*.35*clarity);
  return true;
}
