// Pass 20 blades: Zeke's Ragnarok and Luna's moon cut. These functions only draw; damage, timing and targets stay in engine.js.
// zeke-ragnarok (3x1, GPT image, docs/art/pass20-fx-20261028): 0 greatsword, tip down; 1 impact eruption; 2 fire seal ring.
// Measured on the packed cells (share of the stamp size from its centre): the sword tip sits 0.41 below the centre, the
// eruption's white-hot point 0.20 below it, and the ring's outer flame at 0.83 of the half-size.
const RAGNAROK='zeke-ragnarok',TIP=.412,ERUPT=.2,SEAL_EDGE=.83;
export const RAGNAROK_LIFE=2.2;
const clamp=t=>Math.max(0,Math.min(1,t));
const span=(t,a,b)=>clamp((t-a)/(b-a));
const ease=t=>1-(1-clamp(t))**3;
const hash=(seed,i)=>{const n=Math.sin(seed*12.9898+i*78.233)*43758.5453;return n-Math.floor(n);};
const stamp=(fx,frame,x,y,w,angle=0,alpha=1,blend='source-over')=>alpha>0&&fx.atlasStamp(RAGNAROK,frame,3,1,x,y,w,w,angle,alpha,blend);
function diamond(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x,y+r*.42);ctx.lineTo(x-r,y);ctx.lineTo(x,y-r*.42);ctx.closePath();ctx.fill();}

// Ragnarok. The UR cut-in band covers the top of the board (5-31% of its height) for 1.6 s, so a sword dropping from the
// top edge was hidden and seemed to appear in the centre. Now a gate of fire opens in the air just below the band and a
// target seal on the ground; the greatsword slides down out of the gate (drawn only below it, so it visibly emerges and
// travels), stabs the centre at 0.62 s, the gate bursts and the whole blade stands in the ground. A flame shockwave runs out
// and fire erupts under each enemy as the wave reaches it (the engine hits all enemies at the cast, as before). The sword
// glows, then burns away into embers.
export function drawRagnarok(fx,skill,age){
  if(!fx.art.images[RAGNAROK])return false;
  const ctx=fx.ctx,X=360,TY=440,GATE=262,S=500,hit=.62,reduced=fx.reduced,end=1-span(age,1.6,RAGNAROK_LIFE);
  // A warm dusk over the field while the sword is out (units stay readable).
  ctx.save();ctx.globalAlpha=Math.min(1,age*4)*end*(reduced?.25:.4);
  const wash=fx.ragnarokWash||(fx.ragnarokWash=(()=>{const g=ctx.createRadialGradient(X,TY,140,X,TY,600);g.addColorStop(0,'#ff6a2000');g.addColorStop(1,'#5a0e0699');return g;})());
  ctx.fillStyle=wash;ctx.fillRect(0,0,720,780);ctx.restore();
  const flat=(y,w,ratio,spin,alpha)=>alpha>0&&fx.atlasStamp(RAGNAROK,2,3,1,X,y,w,w*ratio,spin,alpha,'source-over');
  // The target seal lies on the ground; the gate hangs in the air above it. Both open first, then the gate bursts on impact.
  const open=ease(span(age,0,.28)),seal=1-span(age,hit+.1,hit+.5),gate=1-span(age,hit,hit+.12);
  if(seal>0){flat(TY,330*open,.42,-age*.4,seal*.85);fx.glow('glow','#ff7a2a',X,TY,200*open,seal*.3);}
  if(gate>0){flat(GATE,300*open,.3,age*.6,gate*.95);fx.glow('glow','#ffb060',X,GATE,240*open,gate*.45);}
  // The sword: its tip leaves the gate at 0.22 s and reaches the ground at the hit, gathering speed; until then only the part
  // below the gate is drawn, with a hot seam where the blade passes through and a short streak under the tip.
  const fall=clamp((age-.22)/(hit-.22))**1.6,tipY=GATE+(TY-GATE)*fall,landed=age>=hit;
  if(age>=.22){
    const sink=landed?7*ease(span(age,hit,hit+.1)):0,cy=tipY+sink-TIP*S-(1-end)*40;
    if(!landed){
      ctx.save();ctx.beginPath();ctx.rect(0,GATE,720,780-GATE);ctx.clip();
      if(!reduced)for(const [i,back] of [[1,26],[2,58]])stamp(fx,0,X,cy-back,S,0,.3/i);
      stamp(fx,0,X,cy,S,0,1);
      // The near half of the gate passes in front of the blade, so the sword reads as coming through it.
      flat(GATE,300*open,.3,age*.6,gate*.95);ctx.restore();
      fx.glow('glow','#fff0c8',X,GATE,120,.7);
      if(!reduced){ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle='#ffd7a0';ctx.lineCap='round';
        for(const [i,dx] of [-34,34,-14,14].entries()){const len=40+i*12;ctx.globalAlpha=.5;ctx.lineWidth=i<2?2:1.4;ctx.beginPath();ctx.moveTo(X+dx,tipY-len-10);ctx.lineTo(X+dx,tipY-10);ctx.stroke();}ctx.restore();}
    }else{
      // Standing in the ground it softens so the units around the centre stay visible, then burns away upward.
      stamp(fx,0,X,cy,S,0,(1-.28*ease(span(age,hit,hit+.3)))*end);
      fx.glow('glow','#ff9a3a',X,TY-120,260,(.3+.15*Math.sin(age*9))*end);
      if(end<1&&!reduced){ctx.save();ctx.globalCompositeOperation='lighter';const k=1-end;
        for(let i=0;i<14;i++){const y=TY-hash(i,3)*S*.8-k*(60+hash(i,5)*90),x=X+(hash(i,7)-.5)*60+Math.sin(k*6+i)*10;ctx.globalAlpha=Math.sin(Math.PI*clamp(k*1.3-hash(i,9)*.3))*.9;diamond(ctx,x,y,2.6+hash(i,11)*2.4,i%3?'#ffb35a':'#fff0c8');}ctx.restore();}
    }
  }
  if(!landed)return true;
  const since=age-hit;
  // Impact: white-hot flash, a short screen flash and one shake for the renderer; the gate bursts into sparks.
  if(!skill.slammed){skill.slammed=true;if(!reduced)fx.shake=Math.max(fx.shake||0,11);}
  const flash=1-span(since,0,.28);
  if(flash>0){fx.glow('rays','#ffd08a',X,TY,620*ease(since/.22),flash*.8,since*1.5);fx.glow('glow','#fff3d6',X,TY,260,flash*.85);fx.glow('glow','#ffcf8a',X,GATE,200*(1+since*2),flash*.5);
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

// Luna's basic attack, at the same finish as the other companions' painted shots. luna-blade (3x1, GPT image,
// docs/art/pass20-fx-20261028): 0 moon dagger pointing right (its ribbon trails left), 1 crossed crescent cuts, 2 one crescent
// cut. The dagger flies straight to the target (the old curved three-claw frame slid along a straight line); where it lands
// one of the two cuts flashes across the enemy, alternating, and fades in a third of a second.
const LUNA='luna-blade';
export const MOON_CUT_LIFE=.34;
export function drawMoonShot(fx,shot,{from,to,t}){
  if(!fx.art.images[LUNA])return false;
  const a=Math.atan2(to.y-from.y,to.x-from.x),x=from.x+(to.x-from.x)*t,y=from.y+(to.y-from.y)*t,w=64+Math.min(5,shot.rank||1)*1.5;
  fx.glow('glow','#b48cff',x,y,30,.32);fx.atlasStamp(LUNA,0,3,1,x,y,w,w,a,.96,'source-over');
  return true;
}
export function drawMoonCut(fx,e,t,clarity=1){
  if(!fx.art.images[LUNA])return false;
  const age=t*MOON_CUT_LIFE,cross=Math.round(e.x*7+e.y*13)%2===0,a=(e.angle||0)+(cross?0:-.35),pop=ease(span(age,0,.07)),fade=(1-span(age,.12,MOON_CUT_LIFE))*clarity;
  const w=(64+Math.min(5,e.rank||1)*4)*(.72+.28*pop);
  fx.atlasStamp(LUNA,cross?1:2,3,1,e.x,e.y-18,w,w,a,fade*.92,'source-over');
  const glint=Math.sin(Math.PI*span(age,0,.16));if(glint>0)fx.glow('glow','#d8c4ff',e.x,e.y-18,44,glint*.4*clarity);
  return true;
}
