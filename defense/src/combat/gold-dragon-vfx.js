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
// Reuse the EXISTING Ancient Dragon texture. Red is the original image, pixel for pixel.
// The normal variant changes only RGB, once per loaded image; its alpha/silhouette is identical.
export function ancientCrossTexture(fx,opening){
  const original=fx.art.images['ancient-cross'];if(!original||opening)return original;
  if(fx.goldCrossOriginal===original)return fx.goldCrossTint;
  const c=document.createElement('canvas');c.width=original.naturalWidth;c.height=original.naturalHeight;
  const g=c.getContext('2d');g.drawImage(original,0,0);
  const pixels=g.getImageData(0,0,c.width,c.height);
  for(let i=0;i<pixels.data.length;i+=4){
    const red=Math.max(0,pixels.data[i]-pixels.data[i+1]);
    pixels.data[i+1]+=red*.68;pixels.data[i+2]+=red*.12;
  }
  g.putImageData(pixels,0,0);fx.goldCrossOriginal=original;fx.goldCrossTint=c;return c;
}
function crossStamp(fx,opening,x,y,size,alpha){
  const img=ancientCrossTexture(fx,opening);if(!img)return;
  const ctx=fx.ctx;ctx.save();ctx.globalAlpha*=alpha;ctx.drawImage(img,x-size/2,y-size/2,size,size);ctx.restore();
}
export function drawGoldAttack(fx,e,t,clarity=1){
  if(e.hero!=='gold_dragon')return false;
  const ctx=fx.ctx,fade=Math.sin(Math.PI*t)*clarity,reach=620*Math.min(1,t*2.4),color=e.opening?'#ff8850':'#efd078';
  // Same four narrow beams and same 150px centre texture as Ancient Dragon.
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';ctx.globalAlpha=fade*.55;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const g=ctx.createLinearGradient(e.origin.x,e.origin.y,e.origin.x+dx*reach,e.origin.y+dy*reach);
    g.addColorStop(0,color+'cc');g.addColorStop(1,color+'00');ctx.strokeStyle=g;ctx.lineWidth=10*(1-t)+2;
    ctx.beginPath();ctx.moveTo(e.origin.x,e.origin.y);ctx.lineTo(e.origin.x+dx*reach,e.origin.y+dy*reach);ctx.stroke();
  }
  ctx.restore();crossStamp(fx,e.opening,e.origin.x,e.origin.y-8,150,fade*.5);
  // Two fine curling strokes and only FOUR glints; no replacement painted cross or star cloud.
  ctx.save();ctx.translate(e.origin.x,e.origin.y-8);ctx.globalCompositeOperation='lighter';
  ctx.globalAlpha=fade*.64;ctx.strokeStyle=e.opening?'#ffc18d':'#ffe9ad';ctx.lineWidth=1.2;
  for(let arm=0;arm<2;arm++){ctx.beginPath();for(let i=0;i<=16;i++){const k=i/16,a=arm*Math.PI+t*1.4+k*1.9,r=18+k*40;const x=Math.cos(a)*r,y=Math.sin(a)*r*.55;if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();}
  for(let i=0;i<4;i++){const a=i*Math.PI/2+t*.8,r=38+i%2*17;star(ctx,Math.cos(a)*r,Math.sin(a)*r*.55,2.8+i%2,'#fff1c8');}
  ctx.restore();return true;
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
    crossStamp(fx,e.opening,e.x,e.y-18,58,(1-t)*.55);return true;
  }
  if(e.type==='ward'&&e.hero==='gold_dragon'){stamp(fx,4,e.x,e.y-25,65,65,(1-t)*.6,true);return true;}
  return false;
}
