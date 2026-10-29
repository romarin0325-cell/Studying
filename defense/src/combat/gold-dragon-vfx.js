import {GOLD_DRAGON,cellPoint,charging,goldOpening} from './engine.js';
const ATLAS='gold-breath';
const clamp=t=>Math.max(0,Math.min(1,t));
const span=(t,a,b)=>clamp((t-a)/(b-a));
const ease=t=>1-(1-clamp(t))**3;
function stamp(fx,frame,x,y,w,h=w,a=1,opening=false){
  if(a<=0)return;
  if(!opening){fx.atlasStamp(ATLAS,frame,3,2,x,y,w,h,0,a,'source-over');return;}
  const original=fx.art.images[ATLAS];if(!original)return;
  if(fx.goldBreathOriginal!==original){
    const c=document.createElement('canvas');c.width=original.naturalWidth;c.height=original.naturalHeight;
    const g=c.getContext('2d');g.drawImage(original,0,0);const pixels=g.getImageData(0,0,c.width,c.height);
    for(let i=0;i<pixels.data.length;i+=4){const heat=Math.max(0,pixels.data[i]-pixels.data[i+2]);pixels.data[i+1]-=heat*.68;pixels.data[i+2]-=heat*.15;}
    g.putImageData(pixels,0,0);fx.goldBreathOriginal=original;fx.goldBreathTint=c;
  }
  const img=fx.goldBreathTint,cw=img.width/3,ch=img.height/2,ctx=fx.ctx;
  ctx.save();ctx.globalAlpha*=a;ctx.drawImage(img,frame%3*cw,Math.floor(frame/3)*ch,cw,ch,x-w/2,y-h/2,w,h);ctx.restore();
}
function star(ctx,x,y,r,color,alpha=1){
  ctx.save();ctx.globalAlpha*=alpha;ctx.fillStyle=color;ctx.beginPath();
  ctx.moveTo(x,y-r);ctx.lineTo(x+r*.25,y-r*.23);ctx.lineTo(x+r,y);ctx.lineTo(x+r*.25,y+r*.23);
  ctx.lineTo(x,y+r);ctx.lineTo(x-r*.25,y+r*.23);ctx.lineTo(x-r,y);ctx.lineTo(x-r*.25,y-r*.23);ctx.closePath();ctx.fill();ctx.restore();
}
// Basic attack: four beams and a stream of star dust shed by each beam head. No centre texture: a cross
// stamped behind the unit only showed its tips around the body. Opening (first 10 s) is the warm red palette.
const ARMS=[[1,0],[-1,0],[0,1],[0,-1]],REACH=620,HEAD=.125,BEAM=.3,END=.45,TAU=.12;
const palette=opening=>opening?{hot:'#ff7a3c',light:'#ffd9bf',core:'#ffe2c8',halo:'#ff9a5c'}:{hot:'#f0b040',light:'#fff3cf',core:'#fff4d2',halo:'#ffd77a'};
function sparks(e,clarity){
  if(e.sparks)return e.sparks;
  let seed=(Math.round(e.origin.x*7+e.origin.y*13+(e.count||0)*101)>>>0)||1;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  // Most grains leave the head while it travels and keep flying outward, slowing; a few leave the finished
  // beam. All drift sideways and twinkle out. Fewer grains when many dragons fire at once.
  const per=Math.max(10,Math.round(30*clarity));
  e.sparks=ARMS.flatMap(([dx,dy])=>Array.from({length:per},()=>{
    const head=rnd()<.8,ts=head?rnd()*HEAD:HEAD+rnd()*.08,big=rnd()<.3;
    return {dx,dy,ts,d0:head?REACH*ts/HEAD-rnd()*25:60+rnd()*540,v:head?260+rnd()*560:30+rnd()*110,
      side:rnd()<.5?-1:1,off0:rnd()*5,drift:18+rnd()*60,life:Math.min(.2+rnd()*.14,END-ts),r:big?3+rnd()*1.6:1.5+rnd(),big,ph:rnd()*6.3,spin:rnd()*.8};
  }));
  return e.sparks;
}
function glint(fx,x,y,r,core,halo,alpha,angle=0){
  if(alpha<=0)return;const ctx=fx.ctx;
  fx.glow('glow',halo,x,y,r*7,alpha*.55);
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalCompositeOperation='lighter';star(ctx,0,0,r*2.1,core,alpha);star(ctx,0,0,r*1.1,'#ffffff',alpha*.9);ctx.restore();
}
export function drawGoldAttack(fx,e,t,clarity=1){
  if(e.hero!=='gold_dragon')return false;
  const ctx=fx.ctx,age=t*e.total,tb=Math.min(1,age/BEAM),fade=Math.sin(Math.PI*tb)*clarity,reach=REACH*Math.min(1,tb*2.4),c=palette(e.opening);
  if(tb<1){
    ctx.save();ctx.lineCap='round';
    for(const [dx,dy] of ARMS){
      const x2=e.origin.x+dx*reach,y2=e.origin.y+dy*reach;
      // Warm body painted normally (additive gold over the teal floor reads olive), thin light core added on top.
      const g=ctx.createLinearGradient(e.origin.x,e.origin.y,x2,y2);g.addColorStop(0,c.hot+'aa');g.addColorStop(1,c.hot+'00');
      ctx.globalCompositeOperation='source-over';ctx.globalAlpha=fade*.5;ctx.strokeStyle=g;ctx.lineWidth=8*(1-tb)+2.5;
      ctx.beginPath();ctx.moveTo(e.origin.x,e.origin.y);ctx.lineTo(x2,y2);ctx.stroke();
      const k=ctx.createLinearGradient(e.origin.x,e.origin.y,x2,y2);k.addColorStop(0,c.light+'ee');k.addColorStop(1,c.light+'00');
      ctx.globalCompositeOperation='lighter';ctx.globalAlpha=fade*.55;ctx.strokeStyle=k;ctx.lineWidth=1.8;
      ctx.beginPath();ctx.moveTo(e.origin.x,e.origin.y);ctx.lineTo(x2,y2);ctx.stroke();
    }
    ctx.restore();
  }
  // A bright tip rides each beam head out to the end of its reach, shedding the dust behind it.
  if(age<HEAD+.04){const k=Math.min(1,age/HEAD),tip=1-Math.max(0,(age-HEAD)/.04);for(const [dx,dy] of ARMS)glint(fx,e.origin.x+dx*REACH*k,e.origin.y+dy*REACH*k,4.2,c.core,c.halo,tip*clarity*.9,age*6);}
  for(const p of sparks(e,clarity)){
    const a=age-p.ts,u=a/p.life;if(u<=0||u>=1)continue;
    const slow=TAU*(1-Math.exp(-a/TAU)),d=p.d0+p.v*slow,off=p.side*(p.off0+p.drift*slow);
    const x=e.origin.x+p.dx*d+p.dy*off,y=e.origin.y+p.dy*d+p.dx*off;
    const env=Math.min(1,u/.15)*(1-u)**.8,flick=.55+.45*Math.sin(p.ph+a*38),alpha=env*flick*clarity;
    if(p.big)glint(fx,x,y,p.r*(.7+.3*flick),c.core,c.halo,alpha,p.spin+a*3);
    else{fx.glow('glow',c.halo,x,y,p.r*8,alpha*.6);ctx.save();ctx.globalCompositeOperation='lighter';star(ctx,x,y,p.r*1.7,c.core,alpha);ctx.restore();}
  }
  return true;
}
export function drawGoldPersistent(fx,s,foreground){
  const ctx=fx.ctx;
  // Read the flight from saved combat state, so pause, resume and wave cancellation stay in sync.
  for(const v of s.volleys||[])if(v.kind==='gold_breath'){
    if(foreground)drawGoldImpact(fx,{...v,type:'goldBreathFlight'},1-v.life/v.total);
    else drawGoldGround(fx,{...v,type:'goldBreathGround',flight:v.total,total:v.total+.9},(v.total-v.life)/(v.total+.9));
  }
  for(let i=0;i<s.board.length;i++){
    const u=s.board[i];if(u?.hero!=='gold_dragon')continue;const p=cellPoint(i),on=charging(s,u),opening=goldOpening(s)&&(!u.cursed||on);
    if(!foreground){
      if(!opening&&!on)continue;
      ctx.save();ctx.globalAlpha=on?.6:.36;ctx.strokeStyle=opening?'#ff9363':'#eed18c';ctx.lineWidth=on?2:1.5;
      ctx.beginPath();ctx.ellipse(p.x,p.y+30,31,10,0,-Math.PI/2,-Math.PI/2+Math.PI*2*(on?clamp((s.time-s.goldCharge.started)/GOLD_DRAGON.charge):1));ctx.stroke();ctx.restore();continue;
    }
    if(!on){
      if(opening){ctx.save();ctx.fillStyle='#231e22e6';ctx.beginPath();ctx.arc(p.x+29,p.y+20,12,0,Math.PI*2);ctx.fill();star(ctx,p.x+29,p.y+20,7,'#ffb182');ctx.restore();}
      continue;
    }
    const elapsed=clamp((s.time-s.goldCharge.started)/GOLD_DRAGON.charge),pulse=fx.reduced?1:1+Math.sin(fx.clock*6)*.035,oy=p.y-96,size=(30+elapsed*34)*pulse;
    fx.glow('glow',opening?'#ff8a4e':'#ffe0a0',p.x,oy,size*1.35,.12+elapsed*.14);
    stamp(fx,opening?5:0,p.x,oy,size,size,.9);
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(let j=0;j<5;j++){
      const travel=((s.time-s.goldCharge.started)*(.45+j*.035)+j/5)%1,a=j*2.4+travel*1.7,r=(1-travel)*(30+elapsed*15);
      star(ctx,p.x+Math.cos(a)*r,oy+Math.sin(a)*r*.65,1.3+travel*1.5,opening?'#ffd7b0':'#fff1c2',Math.sin(Math.PI*travel)*.8);
    }
    ctx.restore();
    const remain=Math.max(0,s.goldCharge.ends-s.time);
    ctx.save();ctx.font='700 15px system-ui';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#172632';
    const label=remain.toFixed(1);ctx.strokeText(label,p.x+32,p.y+19);ctx.fillStyle='#fff0c7';ctx.fillText(label,p.x+32,p.y+19);ctx.restore();
  }
}
export function goldEvent(fx,e){
  if(e.type==='goldBreathImpact'){
    fx.add({...e,life:1.05,total:1.05});
    fx.add({...e,type:'goldBreathGround',to:{x:e.x,y:e.y},flight:0,after:true,life:.9,total:.9});
  }
}
export function drawGoldGround(fx,e,t){
  if(e.type!=='goldBreathGround')return false;
  const age=t*e.total,open=e.after?1:ease(span(age,0,e.flight*.65)),out=1-span(age,e.flight+.2,e.total),R=e.radius;
  stamp(fx,4,e.to.x,e.to.y,R*2.2*open,R*2.2*open,out*.42,e.opening);
  return true;
}
export function drawGoldImpact(fx,e,t){
  const ctx=fx.ctx;
  if(e.type==='goldBreathFlight'){
    const age=t*e.total,o=e.origin,p=e.to;
    // Condensed light leaves the caster first; a separate sky gate opens over the release-time target.
    const rise=ease(span(age,0,.3));
    if(age<.34){
      const y=o.y-96-rise*(o.y+20),out=1-span(age,.23,.34);
      stamp(fx,1,o.x,y,42+rise*18,80+rise*100,out,e.opening);
    }
    const sky=Math.max(120,p.y-330),gate=span(age,.18,.31),fall=span(age,.29,e.total)**1.65;
    if(age>=.18){
      const ringOut=1-span(age,e.total-.06,e.total+.1);
      stamp(fx,4,p.x,sky,95*ease(gate),25*ease(gate),ringOut*.8,e.opening);
      const height=(p.y-sky)/.83,cy=sky+height*.45;
      ctx.save();ctx.beginPath();ctx.rect(p.x-120,sky-4,240,Math.max(0,(p.y-sky+16)*fall));ctx.clip();
      stamp(fx,2,p.x,cy,175,height,span(age,.28,.36),e.opening);ctx.restore();
      if(fall>0){const tip=sky+(p.y-sky)*fall;fx.glow('glow',e.opening?'#ffba83':'#ffe6a3',p.x,tip,30,.55);star(ctx,p.x,tip,5,'#fff4d8',.85);}
    }
    return true;
  }
  if(e.type==='goldBreathImpact'){
    const age=t*e.total,out=1-span(age,.22,1.05),growth=ease(span(age,0,.16)),size=e.radius*2.3*(.82+.18*growth);
    // A bounded hit flash; the field outside radius180 stays readable. No field-wide wash.
    fx.glow('glow',e.opening?'#ffd3ae':'#fff0bf',e.x,e.y,size*.55,(1-span(age,0,.22))*.78);
    stamp(fx,3,e.x,e.y-size*.19,size,size,out*.94,e.opening);
    if(!e.shook){e.shook=true;if(!fx.reduced)fx.shake=Math.max(fx.shake||0,5);}
    return true;
  }
  if(e.type==='impact'&&e.hero==='gold_dragon'){
    const c=palette(e.opening);glint(fx,e.x,e.y-18,4.2*(1-t*.35),c.core,c.halo,(1-t)*.85,t*.6);return true;
  }
  if(e.type==='ward'&&e.hero==='gold_dragon'){stamp(fx,4,e.x,e.y-25,65,65,(1-t)*.6,true);return true;}
  return false;
}
