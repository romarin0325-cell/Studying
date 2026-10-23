// Painted motifs use the same short trails / crisp focal points as the original
// cast. These functions only draw: damage, collision, costs and clocks stay in engine.js.
import {HERO} from '../content.js';
import {pathPoint} from './engine.js';

export const COMPANION_VISUALS=Object.freeze(Object.fromEntries([
  ['toffee_apple','effects-sol-sweet',0,'#f26040'],
  ['joker','effects-sol-sweet',1,'#f06aa8'],
  ['sunflower','effects-sol-sweet',2,'#ffd05b'],
  ['underdog','effects-sol-sweet',3,'#d8bea0'],
  ['cure_master','effects-sol-twilight',0,'#ffafd5'],
  ['venom','effects-sol-twilight',1,'#a1db6d'],
  ['ash','effects-sol-twilight',2,'#ff995b'],
  ['antropy','effects-sol-twilight',3,'#e2d8ff'],
].map(([id,atlas,frame,color])=>[id,Object.freeze({atlas,frame,color})])));
const clamp=t=>Math.max(0,Math.min(1,t));
const ease=t=>1-(1-clamp(t))**3;
const fade=(t,start=.3)=>1-clamp((t-start)/(1-start));
const hash=(seed,i)=>{const n=Math.sin(seed*12.9898+i*78.233)*43758.5453;return n-Math.floor(n);};
const JOKER_COLORS={red:'#ff665f',blue:'#73bfff',green:'#8bdf8b',white:'#fff2df',black:'#ad8ad9'};
function line(ctx,points,color,width){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
function point(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
function shard(ctx,x,y,r,color,a=0){ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(r,0);ctx.lineTo(0,r*.34);ctx.lineTo(-r,0);ctx.lineTo(0,-r*.34);ctx.closePath();ctx.fill();ctx.restore();}
function painted(fx,id,ultimate,x,y,w,h=w,angle=0,alpha=1){
  const p=COMPANION_VISUALS[id];if(!p||!fx.art.images[p.atlas])return false;
  fx.atlasStamp(p.atlas,p.frame+(ultimate?4:0),4,2,x,y,w,h,angle,alpha,'source-over');return true;
}
function chips(fx,id,x,y,t,radius=28,count=4,alpha=1){
  const ctx=fx.ctx,p=COMPANION_VISUALS[id],k=ease(t),a=fade(t,.15)*alpha;
  ctx.save();ctx.globalAlpha*=a;
  for(let i=0;i<(fx.reduced?2:count);i++){
    const theta=hash(x+y,i)*Math.PI*2,r=radius*(.4+hash(y,i+9)*.6)*k;
    shard(ctx,x+Math.cos(theta)*r,y+Math.sin(theta)*r*.6+k*k*9,2.5+hash(x,i+7)*2,i%2?p.color:id==='underdog'?'#746975':'#fff3da',theta+k);
  }ctx.restore();
}
function floorArc(fx,x,y,r,t,color,alpha=.6){
  const ctx=fx.ctx;ctx.save();ctx.globalAlpha*=fade(t,.2)*alpha;
  ctx.strokeStyle=color;ctx.lineWidth=2.8*(1-t)+.7;ctx.beginPath();
  ctx.ellipse(x,y,Math.max(1,r*ease(t)),Math.max(.5,r*.32*ease(t)),0,.15,Math.PI*1.85);ctx.stroke();ctx.restore();
}
function dustHit(fx,x,y,t,scale=1,alpha=1){
  const ctx=fx.ctx,k=ease(t),a=fade(t,.12)*alpha;ctx.save();ctx.globalAlpha*=a;
  for(let i=0;i<(fx.reduced?2:4);i++){
    const sign=i%2?-1:1,px=x+sign*(8+k*(10+i*4))*scale,py=y+8-(i%2)*5-k*5;
    ctx.fillStyle=i%2?'#b9a38a55':'#dbc7a966';ctx.beginPath();ctx.ellipse(px,py,(7+i*2)*scale,(3+i)*scale,sign*.3,0,Math.PI*2);ctx.fill();
    line(ctx,[[x+sign*4,y+4],[x+sign*(15+k*19)*scale,y-(3+i*3)*scale]],i%2?'#e7cfab':'#9c8270',1.8*(1-t)+.5);
  }ctx.restore();chips(fx,'underdog',x,y,t,24*scale,4,alpha);
}
function shatteredApple(fx,x,y,t){
  const p=COMPANION_VISUALS.toffee_apple;if(!fx.art.images[p.atlas])return;
  const ctx=fx.ctx,k=ease(t/.4),size=145+ease(t/.18)*28,a=fade(t,.14);
  // Six angular painted shell pieces separate immediately. No intact giant apple
  // hangs over the target after the bomb has already detonated.
  for(let i=0;i<6;i++){
    const angle=i*Math.PI/3,lo=angle-Math.PI/6,hi=angle+Math.PI/6;
    ctx.save();ctx.globalAlpha*=a*.9;ctx.translate(x+Math.cos(angle)*k*62,y+Math.sin(angle)*k*48+t*t*55);ctx.rotate((i%2?1:-1)*t*.4);
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(lo)*size,Math.sin(lo)*size);ctx.lineTo(Math.cos(hi)*size,Math.sin(hi)*size);ctx.closePath();ctx.clip();
    painted(fx,'toffee_apple',true,0,0,size,undefined,0,1);ctx.restore();
  }
  fx.glow('glow','#ffd69d',x,y,74*(1-k*.3),a*.4*(1-k));
}

export function drawCompanionShot(fx,shot,s,{x,y,angle,t,target=shot.to}){
  const id=shot.hero,p=COMPANION_VISUALS[id];if(!p||!fx.art.images[p.atlas])return false;
  if(id==='toffee_apple'){
    // A piercing glaze ribbon, not a homing candy. Its narrow painted stroke
    // extends along the actual beam axis/range; it never fills the attack area.
    const o=shot.origin,h=HERO[id],a=Math.atan2(target.y-o.y,target.x-o.x),length=h.range*ease(t/.3);
    painted(fx,id,false,o.x+Math.cos(a)*length*.5,o.y-18+Math.sin(a)*length*.5,length,38+shot.rank,a,.86*fade(t,.7));
    return true;
  }
  const widths={joker:53,sunflower:48,underdog:47,cure_master:57,venom:46,ash:53,antropy:48};
  const spin=id==='underdog'?Math.sin(t*14)*.08:id==='joker'?Math.sin(t*12)*.35:id==='antropy'?Math.sin(t*6)*.12:0;
  painted(fx,id,false,x,y,widths[id]+Math.min(5,shot.rank)*1.5,undefined,angle+spin,.96);
  if(id==='joker'){
    // Card art stays ivory/gold. A stable, high-contrast jewel carries all five
    // gameplay colours, including black and white on either battlefield theme.
    fx.companionJoker=s.jokerColor||'red';const tint=JOKER_COLORS[fx.companionJoker];
    fx.glow('glow',tint,x,y,23,.5);const ctx=fx.ctx;ctx.save();ctx.globalAlpha=.95;shard(ctx,x,y,4.8,tint,angle+spin);ctx.restore();
  }
  return true;
}

// Called below units, HP bars and boss danger cells. One signature at the caster
// is enough: field damage is confirmed by small receipts at the affected enemies.
export function drawCompanionSkill(fx,skill){
  const id=skill.hero,p=COMPANION_VISUALS[id];if(!p||!fx.art.images[p.atlas])return false;
  const ctx=fx.ctx,age=skill.total-skill.life,o=skill.origin;
  if(!o||age<0||skill.life<=0)return true;
  const t=clamp(age/1.1),out=fade(t,.42),pop=ease(age/.17),physical=id==='underdog';
  // A restrained, local ready beat. No screen wash, gold rain, generic flame or
  // star emblem borrowed from another hero. The heavy slam is the attack below.
  if(!physical){fx.glow('glow',p.color,o.x,o.y-12,95*pop,out*.35);floorArc(fx,o.x,o.y+22,63,t,p.color,.45);}
  if(id==='toffee_apple'){
    // Casting installs a mine; it does not detonate it or hit every enemy yet.
    painted(fx,id,true,o.x+24,o.y-30,95*(.75+.25*pop),undefined,-.15*(1-pop),out*.62);
    return true;
  }
  if(id==='underdog'){
    // No conjured sky fist: a short physical strike at the brawler, then grit
    // racing into the lanes. The actual stun remains visible on allied units.
    dustHit(fx,o.x,o.y+18,t,2.2,.95);
    floorArc(fx,o.x,o.y+24,440,t,'#ddc5a5',.7);
    ctx.save();ctx.globalAlpha=out*.58;
    for(let i=0;i<4;i++){
      const a=i/4*Math.PI*2+.4,len=(110+hash(o.x,i)*150)*ease(age/.36),pts=[[o.x,o.y+23]];
      for(let j=1;j<=3;j++)pts.push([o.x+Math.cos(a+(j%2?.12:-.1))*len*j/3,o.y+23+Math.sin(a)*len*j/3*.52]);
      line(ctx,pts,'#584b49',3.2);line(ctx,pts,'#d8bea0',1.1);
    }ctx.restore();chips(fx,id,o.x,o.y+12,t,100,fx.reduced?3:9,.85);
    if(age<.6)for(const [i,q] of (skill.targets||[]).slice(0,fx.reduced?3:8).entries()){
      const travel=ease(age/.6),px=o.x+(q.x-o.x)*travel,py=o.y+18+(q.y-o.y)*travel-Math.sin(travel*Math.PI)*(16+i%3*8);
      painted(fx,id,false,px,py,32+i%3*5,undefined,Math.atan2(q.y-o.y,q.x-o.x)+age*3,(1-travel)*.8);
    }return true;
  }
  let size={joker:204,sunflower:232,cure_master:176,venom:166,ash:132,antropy:180}[id];
  let x=o.x,y=o.y-40;
  // Solarflare has a single sun above the formation, not repeated flowers on
  // every tile. It is a field hit even with no stored sunlight.
  if(id==='sunflower'){x=360;y=205;size=230;}
  if(id==='ash'){size=112;y=o.y-24;} // the real blast is at the densest enemy pack
  painted(fx,id,true,x,y,size*(.55+.45*pop),undefined,id==='antropy'?-.12+age*.15:0,out*(id==='venom'?.76:.86));
  if(id==='joker'){
    const color=JOKER_COLORS[fx.companionJoker||'red'];
    fx.glow('glow',color,x,y+12,92,out*.38);chips(fx,id,x,y,t,80,5,.7);
    if(!fx.reduced&&age<.36)for(const [i,q] of (skill.targets||[]).slice(0,5).entries()){
      const travel=ease(age/.36),px=x+(q.x-x)*travel,py=y+(q.y-y)*travel-Math.sin(travel*Math.PI)*24;
      painted(fx,id,false,px,py,45,undefined,Math.atan2(q.y-y,q.x-x)+i*.1,(1-travel)*.75);
    }
  }
  if(id==='antropy'){
    // The halo from the sprite opens once, very thinly; the empty centre keeps
    // units readable. This is a cleansing wave, not a persistent damage zone.
    ctx.save();ctx.strokeStyle='#e9e1ff';ctx.globalAlpha=out*.4;ctx.lineWidth=2;
    ctx.beginPath();ctx.ellipse(x,y+20,30+ease(t)*390,12+ease(t)*170,-.16,.15,2.85);ctx.stroke();
    ctx.beginPath();ctx.ellipse(x,y+20,24+ease(t)*340,10+ease(t)*140,.22,3.3,5.9);ctx.stroke();ctx.restore();
  }
  return true;
}

export function companionSkillEvents(fx,e){
  if(e.type!=='skill'||!COMPANION_VISUALS[e.hero])return false;
  // Dedicated events already confirm these casts (bombSet, requiem,
  // armageddonBlast, lemonPop, plagueBloom). Never also draw generic impacts.
  if(!['applebomb','requiem','armageddon','lemonade','venomplague'].includes(e.kind))
    for(const p of e.targets||[])fx.add({...p,type:'companionReceipt',hero:e.hero,life:.52,total:.52});
  return true;
}

export function drawCompanionImpact(fx,e,t,clarity=1){
  const id=e.hero,p=COMPANION_VISUALS[id],ctx=fx.ctx;
  if(e.type==='reduce'&&e.by==='ash'){
    // A sacrificed ally burns away here. No gold stream toward the gauge:
    // Armageddon pays a unit and does not award starlight or gold for it.
    const a=fade(t,.05);fx.art.hero(ctx,e.hero,e.x,e.y+28,126,{alpha:a*a*.65});
    ctx.save();ctx.globalAlpha=a;
    for(let i=0;i<(fx.reduced?3:9);i++){
      const x=e.x+(hash(e.x,i)-.5)*42,y=e.y+8-t*(30+hash(e.y,i)*55);
      shard(ctx,x,y,2+hash(i,9)*3,i%3?'#f3a264':'#39222f',t*3+i);
    }ctx.restore();return true;
  }
  if(e.type==='companionReceipt'&&p){
    const physical=id==='underdog',a=fade(t,.12)*clarity;
    if(physical){dustHit(fx,e.x,e.y,t,1.25,clarity);return true;}
    painted(fx,id,false,e.x,e.y-5,48*(.75+.25*ease(t/.3)),undefined,id==='joker'?t*1.3:0,a*.8);
    floorArc(fx,e.x,e.y+6,physical?38:28,t,p.color,.6);chips(fx,id,e.x,e.y-10,t,physical?32:24,4,.65);return true;
  }
  if(e.type==='impact'&&p){
    const a=fade(t,.08)*clarity,axis=e.angle||0;
    const size=id==='toffee_apple'?90:id==='underdog'?58:57;
    painted(fx,id,false,e.x,e.y-18,size*(.8+.2*ease(t/.18)),id==='toffee_apple'?28:undefined,axis,a*.83);
    if(id!=='toffee_apple')chips(fx,id,e.x,e.y-18,t,24,3,clarity*.75);
    if(id==='sunflower'&&e.sunR){
      // Actual circular splash, 30/60/90 logical px. A fine petal arc is enough;
      // the entire disc never fills white or masks the enemies under it.
      ctx.save();ctx.globalAlpha=a*.65;ctx.strokeStyle='#f9d36d';ctx.lineWidth=2.3*(1-t)+.6;ctx.beginPath();ctx.arc(e.x,e.y,e.sunR,0,Math.PI*2);ctx.stroke();ctx.restore();
    }return true;
  }
  if(e.type==='armageddon'){
    const k=ease(t/.23),a=fade(t,.3),r=e.radius;
    painted(fx,'ash',true,e.x,e.y-12,r*1.72*(.55+.45*k),undefined,0,a*.86);
    // Only Armageddon really selects a disc here. Its thin, unflooded boundary
    // uses the real engine radius, and the painted black core stays bounded.
    ctx.save();ctx.globalAlpha=a*.6;ctx.strokeStyle='#ffac68';ctx.lineWidth=3*(1-t)+.7;ctx.beginPath();ctx.arc(e.x,e.y,r,0,Math.PI*2);ctx.stroke();ctx.restore();
    chips(fx,'ash',e.x,e.y,t,r*.8,fx.reduced?3:8,.9);return true;
  }
  if(e.type==='plagueBloom'){
    const a=fade(t,.25);painted(fx,'venom',true,e.x,e.y+5,68*(.7+.3*ease(t/.25)),undefined,0,a*.75);
    chips(fx,'venom',e.x,e.y-5,t,22,3,.6);return true;
  }
  if(e.type==='lemonPop'){
    const a=fade(t,.3);painted(fx,'cure_master',true,e.x+27,e.y-7-t*16,65,undefined,0,a*.85);
    floorArc(fx,e.x,e.y+23,36,t,'#ffe2a3',.65);return true;
  }
  if(e.type==='wipe'){
    painted(fx,'antropy',false,e.x,e.y-14,63,undefined,t*.35,fade(t,.2)*.75);
    chips(fx,'antropy',e.x,e.y-14,t,25,3+Math.min(3,e.cleared||0),.7);return true;
  }
  if(e.type==='novaRing'||e.type==='sunSpend')return true; // one field sequence, no second oversized wave
  if(e.type==='bombBlast'){
    // A stored, expensive candy mine ruptures into glossy sugar, not a fire
    // spell. The local shatter is decorative: every actual global hit gets its
    // own small receipt, including enemies outside this drawing.
    shatteredApple(fx,e.x,e.y-14,t);
    chips(fx,'toffee_apple',e.x,e.y-10,t,135,fx.reduced?4:12,.95);
    const targets=e.targets||[];
    for(const q of targets){const b=fade(t,.16);painted(fx,'toffee_apple',false,q.x,q.y-16,62,24,0,b*.7);}
    return true;
  }
  return false;
}

export function drawCompanionBomb(fx,b){
  if(!fx.art.images['effects-applebomb'])return false;
  const p=pathPoint(b.progress),ctx=fx.ctx,pulse=.5+Math.sin(fx.clock*4+b.uid)*.5;
  // Reuse the good, readable mine silhouette. Its fuse and small shadow signal
  // "waiting"; no fake 170px damage radius (this bomb strikes the whole field).
  ctx.save();ctx.fillStyle='#24152655';ctx.beginPath();ctx.ellipse(p.x,p.y+5,19,6,0,0,Math.PI*2);ctx.fill();ctx.restore();
  fx.atlasStamp('effects-applebomb',0,2,1,p.x,p.y-29,70+pulse*3,70+pulse*3,0,.94,'source-over');
  if(!fx.reduced){fx.glow('glow','#ffcb79',p.x,p.y-61,19+pulse*9,.7);}
  return true;
}
