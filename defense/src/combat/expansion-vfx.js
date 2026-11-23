// Authored raster signatures with code-native motion, trails and combat receipts
// for the sixteen card-game companions. These drawings only consume production
// attack / impact / skill events; they never decide combat state.
import {HERO} from '../content.js';
import {cellPoint,VICTORIA_CHARGE} from './engine.js';
import {EXPANSION_IDS,EXPANSION_RARITIES} from '../expansion-companions.js';

export const EXPANSION_VFX=Object.freeze({
  ancient_soul:Object.freeze({motif:'soulFlame',skill:'soulOrbit',primary:'#ffb35e',accent:'#8d67d8'}),
  victoria:Object.freeze({motif:'commandCrown',skill:'victoryStandard',primary:'#ffe08a',accent:'#f27b72'}),
  deep_lord:Object.freeze({motif:'abyssEye',skill:'abyssTide',primary:'#63e0dd',accent:'#31527f'}),
  sakura:Object.freeze({motif:'ofuda',skill:'blazingSeal',primary:'#ff9ab4',accent:'#ff5a48'}),
  dainichi_nyorai:Object.freeze({motif:'vajraLotus',skill:'sunMandala',primary:'#ffe58e',accent:'#e88f52'}),
  gumiho:Object.freeze({motif:'foxFire',skill:'nineTails',primary:'#8be8ff',accent:'#ff9a72'}),
  archangel:Object.freeze({motif:'angelFeather',skill:'sanctuaryWings',primary:'#fff1a8',accent:'#88cfff'}),
  sylphid:Object.freeze({motif:'windClaw',skill:'tempestClaws',primary:'#a8f06c',accent:'#5fd7c8'}),
  succubus:Object.freeze({motif:'dreamHeart',skill:'darkDream',primary:'#ff8ecb',accent:'#8b62c5'}),
  skull_dragon:Object.freeze({motif:'skullFlame',skill:'skullBreath',primary:'#b58aff',accent:'#633d82'}),
  mad_scientist:Object.freeze({motif:'madFlask',skill:'experiment',primary:'#69e2be',accent:'#ffda63'}),
  crystal_dancer:Object.freeze({motif:'crystalBlade',skill:'heartbreaker',primary:'#8ae9ff',accent:'#668ee8'}),
  blessing_tail:Object.freeze({motif:'starTail',skill:'starFoxTail',primary:'#ffe58c',accent:'#ffb7da'}),
  marshmallow:Object.freeze({motif:'sugarCloud',skill:'meltingHug',primary:'#ffb2da',accent:'#ffd57f'}),
  mimic:Object.freeze({motif:'chestKey',skill:'surpriseChest',primary:'#d49aff',accent:'#ffd35f'}),
  silent_librarian:Object.freeze({motif:'silentBook',skill:'silenceArchive',primary:'#9dc5d3',accent:'#665b91'}),
});

export const EXPANSION_FX_PROFILES=Object.freeze(Object.fromEntries(
  EXPANSION_IDS.map(id=>[id,Object.freeze({motion:'expansion-'+EXPANSION_VFX[id].motif,frame:0,offset:0})]),
));

export const EXPANSION_RASTER_VFX=Object.freeze(Object.fromEntries(
  Object.entries(EXPANSION_RARITIES).flatMap(([rarity,ids])=>ids.map((id,frame)=>[
    id,Object.freeze({atlas:'effects-card-expansion-'+rarity.toLowerCase(),attackFrame:frame,ultimateFrame:frame+4}),
  ])),
));

const clamp=t=>Math.max(0,Math.min(1,t));
const span=(t,a,b)=>clamp((t-a)/(b-a));
const ease=t=>1-(1-clamp(t))**3;
const fade=(t,start=.45)=>1-span(t,start,1);
const hash=(seed,i)=>{const n=Math.sin(seed*12.9898+i*78.233)*43758.5453;return n-Math.floor(n);};

function stroke(ctx,points,color,width=2,close=false){
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
  points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));if(close)ctx.closePath();ctx.stroke();
}
function disk(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
function ring(ctx,x,y,r,color,width=2,squash=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.ellipse(x,y,r,r*squash,0,0,Math.PI*2);ctx.stroke();}
function diamond(ctx,x,y,r,color,angle=0){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(r,0);ctx.lineTo(0,r*.52);ctx.lineTo(-r,0);ctx.lineTo(0,-r*.52);ctx.closePath();ctx.fill();ctx.restore();}
function star(ctx,x,y,r,color,points=5){ctx.save();ctx.translate(x,y);ctx.fillStyle=color;ctx.beginPath();for(let i=0;i<points*2;i++){const a=-Math.PI/2+i*Math.PI/points,n=i%2?r*.42:r;i?ctx.lineTo(Math.cos(a)*n,Math.sin(a)*n):ctx.moveTo(Math.cos(a)*n,Math.sin(a)*n);}ctx.closePath();ctx.fill();ctx.restore();}
function heart(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y+r);ctx.bezierCurveTo(x-r*1.45,y,x-r*.85,y-r*1.05,x,y-r*.38);ctx.bezierCurveTo(x+r*.85,y-r*1.05,x+r*1.45,y,x,y+r);ctx.fill();}
function petal(ctx,x,y,r,color,angle=0){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,-r);ctx.bezierCurveTo(r*.7,-r*.28,r*.55,r*.7,0,r);ctx.bezierCurveTo(-r*.55,r*.7,-r*.7,-r*.28,0,-r);ctx.fill();ctx.restore();}
function page(ctx,x,y,w,h,color,angle=0){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h,Math.max(1,w*.12));ctx.fill();ctx.restore();}

function rasterSignature(fx,id,ultimate,x,y,width,height=width,angle=0,alpha=1,blend='source-over'){
  const art=EXPANSION_RASTER_VFX[id];
  if(!art||!fx.art?.images?.[art.atlas]||alpha<=0)return false;
  fx.atlasStamp(art.atlas,ultimate?art.ultimateFrame:art.attackFrame,4,2,x,y,width,height,angle,alpha,blend);
  return true;
}

// One readable silhouette per companion. The same mark is used at projectile,
// hit receipt and ultimate scale, so the effect remains identifiable in motion.
function drawMotif(ctx,kind,x,y,r,angle,primary,accent,phase=0){
  if(!(r>0))return;ctx.save();ctx.translate(x,y);ctx.rotate(angle||0);
  switch(kind){
    case 'soulFlame':{
      ctx.fillStyle=primary;ctx.beginPath();ctx.moveTo(0,-r);ctx.bezierCurveTo(r*.9,-r*.2,r*.55,r*.8,0,r*.62);ctx.bezierCurveTo(-r*.75,r*.75,-r*.75,-r*.25,0,-r);ctx.fill();
      disk(ctx,0,r*.1,r*.24,accent);stroke(ctx,[[-r*.48,r*.55],[0,r*.18],[r*.48,r*.55]],'#fff3cf',Math.max(1,r*.1));break;
    }
    case 'commandCrown':{
      ctx.fillStyle=primary;ctx.beginPath();ctx.moveTo(-r,-r*.18);ctx.lineTo(-r*.66,r*.62);ctx.lineTo(r*.66,r*.62);ctx.lineTo(r,-r*.18);ctx.lineTo(r*.42,r*.12);ctx.lineTo(0,-r*.66);ctx.lineTo(-r*.42,r*.12);ctx.closePath();ctx.fill();
      stroke(ctx,[[-r*.95,r*.7],[r*.95,r*.7]],accent,Math.max(1,r*.11));diamond(ctx,0,-r*.05,r*.25,'#fff9db');break;
    }
    case 'abyssEye':{
      ctx.fillStyle=accent;ctx.beginPath();ctx.ellipse(0,0,r,r*.58,0,0,Math.PI*2);ctx.fill();ring(ctx,0,0,r*.82,primary,Math.max(1,r*.12),.48);disk(ctx,0,0,r*.25,'#d9ffff');disk(ctx,0,0,r*.11,'#13233f');
      for(const side of [-1,1])stroke(ctx,[[side*r*.75,r*.25],[side*r*1.08,r*.7],[side*r*.9,r]],primary,Math.max(1,r*.09));break;
    }
    case 'ofuda':{
      page(ctx,0,0,r*1.05,r*1.72,'#fff2dc',0);ctx.strokeStyle=accent;ctx.lineWidth=Math.max(1,r*.09);ctx.strokeRect(-r*.39,-r*.66,r*.78,r*1.32);stroke(ctx,[[0,-r*.48],[-r*.22,-r*.08],[r*.22,-r*.08],[0,r*.34]],accent,Math.max(1,r*.09));star(ctx,0,r*.25,r*.2,primary,4);break;
    }
    case 'vajraLotus':{
      for(let i=0;i<8;i++)petal(ctx,Math.cos(i*Math.PI/4)*r*.48,Math.sin(i*Math.PI/4)*r*.48,r*.52,i%2?primary:accent,i*Math.PI/4+Math.PI/2);
      ring(ctx,0,0,r*.42,'#fff9d1',Math.max(1,r*.1));diamond(ctx,0,0,r*.28,accent,phase);break;
    }
    case 'foxFire':{
      ctx.fillStyle=primary;ctx.beginPath();ctx.moveTo(0,-r);ctx.bezierCurveTo(r*.75,-r*.15,r*.5,r*.75,0,r*.72);ctx.bezierCurveTo(-r*.65,r*.65,-r*.65,-r*.15,0,-r);ctx.fill();
      ctx.fillStyle=accent;ctx.beginPath();ctx.moveTo(0,-r*.47);ctx.quadraticCurveTo(r*.3,r*.15,0,r*.43);ctx.quadraticCurveTo(-r*.3,r*.15,0,-r*.47);ctx.fill();for(const side of [-1,1])petal(ctx,side*r*.42,-r*.58,r*.28,primary,side*.4);break;
    }
    case 'angelFeather':{
      ctx.fillStyle=primary;ctx.beginPath();ctx.moveTo(-r*.12,r);ctx.bezierCurveTo(r*.9,r*.25,r*.95,-r*.7,r*.15,-r);ctx.bezierCurveTo(-r*.05,-r*.15,-r*.22,r*.55,-r*.12,r);ctx.fill();stroke(ctx,[[0,r*.78],[r*.2,-r*.72]],accent,Math.max(1,r*.09));ring(ctx,0,-r*.78,r*.46,'#fff8c7',Math.max(1,r*.11),.32);break;
    }
    case 'windClaw':{
      for(let i=-1;i<=1;i++){const y=i*r*.35;stroke(ctx,[[-r,y+r*.2],[0,y-r*.12],[r,y-r*.35]],i?primary:'#efffd9',Math.max(1,r*(.14-Math.abs(i)*.025)));}break;
    }
    case 'dreamHeart':{
      heart(ctx,0,0,r*.85,primary);heart(ctx,r*.22,-r*.08,r*.48,accent);star(ctx,-r*.42,-r*.42,r*.18,'#ffe6f6',4);ring(ctx,0,r*.26,r*.76,'#ffd4ef',Math.max(1,r*.09),.3);break;
    }
    case 'skullFlame':{
      ctx.fillStyle=accent;ctx.beginPath();ctx.arc(0,-r*.1,r*.72,Math.PI,0);ctx.lineTo(r*.5,r*.48);ctx.lineTo(r*.18,r*.78);ctx.lineTo(-r*.18,r*.78);ctx.lineTo(-r*.5,r*.48);ctx.closePath();ctx.fill();
      for(const side of [-1,1])disk(ctx,side*r*.27,-r*.08,r*.16,primary);stroke(ctx,[[-r*.28,r*.48],[0,r*.32],[r*.28,r*.48]],primary,Math.max(1,r*.1));for(const side of [-1,1])petal(ctx,side*r*.42,-r*.73,r*.35,primary,side*.45);break;
    }
    case 'madFlask':{
      ctx.fillStyle='#e9fff8';ctx.beginPath();ctx.moveTo(-r*.22,-r);ctx.lineTo(r*.22,-r);ctx.lineTo(r*.18,-r*.35);ctx.quadraticCurveTo(r*.95,r*.7,0,r*.83);ctx.quadraticCurveTo(-r*.95,r*.7,-r*.18,-r*.35);ctx.closePath();ctx.fill();
      ctx.fillStyle=primary;ctx.beginPath();ctx.moveTo(-r*.58,r*.18);ctx.quadraticCurveTo(0,r*.48,r*.58,r*.18);ctx.lineTo(r*.72,r*.58);ctx.quadraticCurveTo(0,r*.92,-r*.72,r*.58);ctx.closePath();ctx.fill();for(const q of [[-.32,.18],[.22,.42],[.05,.05]])disk(ctx,q[0]*r,q[1]*r,r*.1,accent);break;
    }
    case 'crystalBlade':{
      ctx.fillStyle=primary;ctx.beginPath();ctx.moveTo(r,0);ctx.lineTo(-r*.22,r*.28);ctx.lineTo(-r*.72,0);ctx.lineTo(-r*.22,-r*.28);ctx.closePath();ctx.fill();stroke(ctx,[[-r*.72,0],[r,0]],'#efffff',Math.max(1,r*.08));diamond(ctx,-r*.68,0,r*.25,accent,Math.PI/2);break;
    }
    case 'starTail':{
      star(ctx,-r*.3,-r*.18,r*.54,primary,5);ctx.strokeStyle=accent;ctx.lineWidth=Math.max(1,r*.25);ctx.lineCap='round';ctx.beginPath();ctx.arc(-r*.15,r*.25,r*.72,-.25,2.4);ctx.stroke();diamond(ctx,r*.64,r*.12,r*.2,'#fff8cf',phase);break;
    }
    case 'sugarCloud':{
      for(const q of [[-.45,.1],[0,-.25],[.45,.08],[-.1,.3]])disk(ctx,q[0]*r,q[1]*r,r*(q[1]<0?.53:.45),q[0]>0?accent:primary);stroke(ctx,[[-r*.7,r*.58],[r*.7,r*.58]],'#fff6ed',Math.max(1,r*.12));for(const side of [-1,1])disk(ctx,side*r*.24,r*.05,r*.07,'#713b66');break;
    }
    case 'chestKey':{
      ctx.fillStyle=accent;ctx.beginPath();ctx.roundRect(-r*.82,-r*.35,r*1.64,r*1.05,r*.16);ctx.fill();ctx.fillStyle=primary;ctx.beginPath();ctx.roundRect(-r*.84,-r*.72,r*1.68,r*.58,r*.22);ctx.fill();
      for(const side of [-1,1])ctx.fillRect(side*r*.52,-r*.15,r*.13,r*.5);disk(ctx,0,r*.05,r*.18,'#38214f');ctx.fillStyle='#fff4b4';for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(i*r*.28-r*.1,-r*.15);ctx.lineTo(i*r*.28+r*.1,-r*.15);ctx.lineTo(i*r*.28,r*.07);ctx.closePath();ctx.fill();}break;
    }
    case 'silentBook':{
      ctx.fillStyle='#edf7f4';ctx.beginPath();ctx.moveTo(0,-r*.66);ctx.quadraticCurveTo(-r*.42,-r*.82,-r*.9,-r*.52);ctx.lineTo(-r*.72,r*.65);ctx.quadraticCurveTo(-r*.35,r*.45,0,r*.7);ctx.quadraticCurveTo(r*.35,r*.45,r*.72,r*.65);ctx.lineTo(r*.9,-r*.52);ctx.quadraticCurveTo(r*.42,-r*.82,0,-r*.66);ctx.fill();stroke(ctx,[[0,-r*.62],[0,r*.66]],accent,Math.max(1,r*.08));for(const side of [-1,1])for(let i=0;i<3;i++)stroke(ctx,[[side*r*.16,-r*.34+i*r*.26],[side*r*.66,-r*.25+i*r*.24]],primary,Math.max(1,r*.055));ring(ctx,0,r*.02,r*.25,accent,Math.max(1,r*.08));break;
    }
  }
  ctx.restore();
}

export function drawExpansionEmblem(fx,id,x,y,size,angle=0,alpha=1){
  const spec=EXPANSION_VFX[id];if(!spec||alpha<=0)return false;
  if(rasterSignature(fx,id,true,x,y,size,size,angle,alpha))return true;
  const ctx=fx.ctx;
  ctx.save();ctx.globalAlpha*=alpha;drawMotif(ctx,spec.motif,x,y,size*.36,angle,spec.primary,spec.accent,fx.clock||0);ctx.restore();return true;
}

// Read directly from the saved charge, as the gold dragon does, so pause and
// resume keep the visual countdown aligned with the actual buff release.
export function drawVictoriaCharge(fx,s,foreground,hiddenUid=null){
  const charge=s.victoriaCharge;if(!charge||s.phase!=='combat'||charge.wave!==s.wave||charge.source===hiddenUid)return;
  const index=s.board.findIndex(u=>u?.uid===charge.source&&u.hero==='victoria');if(index<0)return;
  const ctx=fx.ctx,p=cellPoint(index),progress=clamp((s.time-charge.started)/VICTORIA_CHARGE),remaining=Math.max(0,charge.ends-s.time);
  if(!foreground){ctx.save();ctx.strokeStyle='#ffe29a';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(p.x,p.y+30,31,10,0,-Math.PI/2,-Math.PI/2+Math.PI*2*progress);ctx.stroke();ctx.restore();return;}
  fx.glow('glow','#ffde93',p.x,p.y-88,95,.2+progress*.25);
  drawExpansionEmblem(fx,'victoria',p.x,p.y-88,42+progress*28,0,.85);
  ctx.save();ctx.font='700 15px system-ui';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#172632';ctx.fillStyle='#fff0c7';const label=remaining.toFixed(1);ctx.strokeText(label,p.x+32,p.y+19);ctx.fillText(label,p.x+32,p.y+19);ctx.restore();
}

export function drawExpansionShot(fx,shot,s,{x,y,angle,t,target=shot.to}){
  const spec=EXPANSION_VFX[shot.hero];if(!spec)return false;const ctx=fx.ctx,rank=Math.min(5,shot.rank||1),r=7.5+rank*.8;
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.45*(1-t*.35);ctx.strokeStyle=spec.primary;ctx.lineWidth=2.2+rank*.18;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(shot.from.x+(x-shot.from.x)*.55,shot.from.y+(y-shot.from.y)*.55);ctx.lineTo(x,y);ctx.stroke();ctx.restore();
  if(['victoria','archangel','blessing_tail'].includes(shot.hero)){ctx.save();ctx.globalAlpha=.42;stroke(ctx,[[shot.origin.x,shot.origin.y-8],[target.x,target.y-18]],spec.primary,1.5+rank*.15);ctx.restore();}
  if(shot.hero==='sylphid')for(const d of [-1,1]){ctx.save();ctx.globalAlpha=.35*(1-t);stroke(ctx,[[x-Math.cos(angle)*18,y-Math.sin(angle)*18+d*4],[x+Math.cos(angle)*5,y+Math.sin(angle)*5+d*2]],spec.accent,1.4);ctx.restore();}
  // Match the production attack-sheet footprint (roughly 116x48 at rank 3)
  // so authored signatures remain readable at the same scale as the old cast.
  const wobble=shot.hero==='mimic'?Math.sin(t*12)*.16:0,artWidth=104+rank*4,artHeight=46+rank;
  if(!rasterSignature(fx,shot.hero,false,x,y,artWidth,artHeight,angle+wobble,.96,'source-over')){
    ctx.save();ctx.globalCompositeOperation='source-over';drawMotif(ctx,spec.motif,x,y,r,angle+wobble,spec.primary,spec.accent,t*Math.PI);ctx.restore();
  }
  return true;
}

const visibleSkillCentre=point=>({x:Math.max(150,Math.min(570,point.x)),y:Math.max(180,Math.min(620,point.y))});
function skillCentre(skill){
  if(['victoria','archangel'].includes(skill.hero))return {x:360,y:405};
  const targets=skill.targets||[];if(!targets.length)return {x:360,y:405};
  if(['gumiho','crystal_dancer'].includes(skill.hero))return visibleSkillCentre(targets[0]);
  return visibleSkillCentre({x:targets.reduce((n,p)=>n+p.x,0)/targets.length,y:targets.reduce((n,p)=>n+p.y,0)/targets.length});
}
function targetReceipts(fx,skill,age,spec){
  const ctx=fx.ctx;if(fx.reduced)return;for(const [i,p] of (skill.targets||[]).slice(0,12).entries()){
    const k=span(age,.18+i*.018,.72+i*.018);if(k<=0||k>=1)continue;ctx.save();ctx.globalAlpha*=Math.sin(Math.PI*k)*.42;ring(ctx,p.x,p.y+7,9+k*23,spec.primary,1.4+k, .36);ctx.restore();
  }
}

export function expansionAllyPoints(skill){
  if(!skill)return [];
  if(skill.hero==='victoria')return skill.allies||skill.targets||[];
  if(skill.hero==='archangel')return skill.allies||[];
  return [];
}

export function drawExpansionSkill(fx,skill){
  const spec=EXPANSION_VFX[skill?.hero];if(!spec)return false;const age=skill.total-skill.life;if(age<0||skill.life<=0)return true;
  fx.drawCast(skill);const ctx=fx.ctx,o=skill.origin||{x:360,y:405},c=skillCentre(skill),t=clamp(age/1.6),out=fade(t,.58),pop=ease(span(age,.06,.42)),size=(HERO[skill.hero]?.rarity==='UR'?390:HERO[skill.hero]?.rarity==='SR'?340:HERO[skill.hero]?.rarity==='R'?300:270);
  fx.glow('rays',spec.primary,c.x,c.y-18,size*1.2*pop,out*.4,age*.36);fx.glow('glow',spec.accent,c.x,c.y-10,size*.56,out*.26);
  const emblemSize=size*.82*pop,emblemAngle=(1-pop)*-.35+age*.12;
  if(!rasterSignature(fx,skill.hero,true,c.x,c.y-24,emblemSize,emblemSize,emblemAngle,out*.96,'source-over')){
    ctx.save();ctx.globalAlpha*=out;drawMotif(ctx,spec.motif,c.x,c.y-24,size*.34*pop,emblemAngle,spec.primary,spec.accent,age);ctx.restore();
  }
  switch(skill.hero){
    case 'ancient_soul':for(let i=0;i<(fx.reduced?3:7);i++){const a=age*1.7+i*Math.PI*2/7,r=size*(.22+.1*Math.sin(i));drawMotif(ctx,'soulFlame',c.x+Math.cos(a)*r,c.y-18+Math.sin(a)*r*.45,14+4*Math.sin(age*3+i),-a,spec.primary,i%2?spec.accent:'#fff0b0',age);}break;
    case 'victoria':{
      ctx.save();ctx.globalAlpha*=out*.7;for(const p of expansionAllyPoints(skill).slice(0,16)){stroke(ctx,[[o.x,o.y-22],[p.x,p.y-20]],spec.primary,1.4);drawMotif(ctx,'commandCrown',p.x,p.y-34,10,0,spec.primary,spec.accent,age);}ctx.restore();break;
    }
    case 'deep_lord':{
      ctx.save();ctx.globalAlpha*=out*.62;for(let i=0;i<4;i++)ring(ctx,c.x,c.y+18,size*(.18+i*.09)*pop,spec.primary,3-i*.5,.3);for(let i=0;i<(fx.reduced?3:6);i++){const a=i*Math.PI/3+age*.2,rr=size*.34*pop;stroke(ctx,[[c.x+Math.cos(a)*rr*.2,c.y+18],[c.x+Math.cos(a+.25)*rr*.7,c.y+Math.sin(a)*rr*.25],[c.x+Math.cos(a-.18)*rr,c.y+Math.sin(a)*rr*.42]],spec.accent,5-i*.35);}ctx.restore();break;
    }
    case 'sakura':{
      ctx.save();ctx.globalAlpha*=out*.75;for(let i=0;i<(fx.reduced?3:7);i++){const k=span(age,.05+i*.05,.65+i*.05);if(k>0&&k<1)drawMotif(ctx,'ofuda',c.x+(hash(c.x,i)-.5)*size*.6,c.y-size*.42+k*size*.65,17,hash(c.y,i)-.5,spec.primary,spec.accent,k);}ring(ctx,c.x,c.y+8,size*.36*pop,spec.accent,3,.32);ctx.restore();break;
    }
    case 'dainichi_nyorai':{
      ctx.save();ctx.globalAlpha*=out*.65;for(let i=0;i<12;i++)petal(ctx,c.x+Math.cos(i*Math.PI/6+age*.1)*size*.3,c.y-15+Math.sin(i*Math.PI/6+age*.1)*size*.13,28*pop,i%2?spec.primary:spec.accent,i*Math.PI/6+Math.PI/2);for(let i=0;i<3;i++)ring(ctx,c.x,c.y-15,size*(.13+i*.1)*pop,'#fff2b6',2.4-i*.4,.42);ctx.restore();break;
    }
    case 'gumiho':for(let i=0;i<9;i++){const a=-Math.PI*.8+i*Math.PI*1.6/8,r=size*.34;drawMotif(ctx,'foxFire',c.x+Math.cos(a)*r,c.y+Math.sin(a)*r*.55-18,14+5*Math.sin(age*4+i),a+Math.PI/2,spec.primary,i%2?spec.accent:'#dffcff',age);}break;
    case 'archangel':{
      ctx.save();ctx.globalAlpha*=out*.7;for(const side of [-1,1])for(let i=0;i<5;i++){const a=side*(.22+i*.13);stroke(ctx,[[c.x+side*16,c.y-10],[c.x+side*size*(.17+i*.045),c.y-size*(.12+i*.035)]],i%2?spec.primary:spec.accent,7-i*.8);}
      for(const p of expansionAllyPoints(skill).slice(0,16)){ring(ctx,p.x,p.y-23,14+pop*12,'#fff4b6',1.6,.3);for(const side of [-1,1])drawMotif(ctx,'angelFeather',p.x+side*12,p.y-34,8,side*.5,spec.primary,spec.accent,age);}ctx.restore();break;
    }
    case 'sylphid':{
      ctx.save();ctx.globalAlpha*=out*.78;for(let i=-2;i<=2;i++){const a=-.45+i*.22+age*.22,rr=size*(.16+Math.abs(i)*.045);ctx.save();ctx.translate(c.x,c.y);ctx.rotate(a);stroke(ctx,[[-rr,-i*5],[rr*.1,-10],[rr,0]],i%2?spec.primary:'#efffdb',7-Math.abs(i));ctx.restore();}ctx.restore();break;
    }
    case 'succubus':{
      ctx.save();ctx.globalAlpha*=out*.62;ring(ctx,c.x,c.y+10,size*.34*pop,spec.accent,5,.36);for(let i=0;i<(fx.reduced?4:9);i++){const a=i*Math.PI*2/9-age*.5,r=size*.28;heart(ctx,c.x+Math.cos(a)*r,c.y-10+Math.sin(a)*r*.48,8+4*Math.sin(age*3+i),i%2?spec.primary:'#f7c1f0');}ctx.restore();break;
    }
    case 'skull_dragon':{
      ctx.save();ctx.globalAlpha*=out*.72;const a=Math.atan2(c.y-o.y,c.x-o.x),len=Math.min(430,Math.hypot(c.x-o.x,c.y-o.y));ctx.translate(o.x,o.y-18);ctx.rotate(a);for(let i=0;i<5;i++){ctx.fillStyle=i%2?spec.primary:spec.accent;ctx.beginPath();ctx.moveTo(18+i*len*.13,-18-i*4);ctx.lineTo(len*(.45+i*.1),-34+i*7);ctx.lineTo(len*(.4+i*.1),20+i*3);ctx.closePath();ctx.fill();}ctx.restore();break;
    }
    case 'mad_scientist':{
      ctx.save();ctx.globalAlpha*=out*.7;for(let i=0;i<3;i++){const a=age*(i%2?-.9:.9)+i*Math.PI*2/3,r=size*.25;drawMotif(ctx,'madFlask',c.x+Math.cos(a)*r,c.y-18+Math.sin(a)*r*.42,18+i*2,a*.2,spec.primary,spec.accent,age);}for(let i=0;i<6;i++){const a=i*Math.PI/3+age;disk(ctx,c.x+Math.cos(a)*size*.22,c.y-18+Math.sin(a)*size*.1,4,i%2?spec.primary:spec.accent);}ctx.restore();break;
    }
    case 'crystal_dancer':{
      ctx.save();ctx.globalAlpha*=out*.76;for(let i=0;i<5;i++){const a=-.8+i*.4+Math.sin(age*3)*.12,r=size*.24;drawMotif(ctx,'crystalBlade',c.x+Math.cos(a)*r,c.y-18+Math.sin(a)*r*.7,20,a,spec.primary,spec.accent,age);}ctx.restore();break;
    }
    case 'blessing_tail':{
      ctx.save();ctx.globalAlpha*=out*.7;for(let i=0;i<4;i++){const r=size*(.12+i*.07),a=age*(.7+i*.12);ctx.strokeStyle=i%2?spec.primary:spec.accent;ctx.lineWidth=5-i*.7;ctx.beginPath();ctx.arc(c.x,c.y,r,a,a+Math.PI*1.35);ctx.stroke();}for(const p of (skill.targets||[]).slice(0,12))star(ctx,p.x,p.y-27,7,spec.primary,5);ctx.restore();break;
    }
    case 'marshmallow':{
      ctx.save();ctx.globalAlpha*=out*.68;for(let i=0;i<(fx.reduced?5:11);i++){const a=i*Math.PI*2/11+age*.28,r=size*(.08+hash(c.x,i)*.28);disk(ctx,c.x+Math.cos(a)*r,c.y-18+Math.sin(a)*r*.45,10+hash(c.y,i)*16,i%3?spec.primary:spec.accent);}ring(ctx,c.x,c.y+18,size*.34*pop,'#fff4e8',3,.32);ctx.restore();break;
    }
    case 'mimic':{
      ctx.save();ctx.globalAlpha*=out*.78;for(let i=0;i<(fx.reduced?5:12);i++){const a=i*Math.PI*2/12+age*1.2,r=size*(.15+.12*(i%2));disk(ctx,c.x+Math.cos(a)*r,c.y-25+Math.sin(a)*r*.5,6,i%2?spec.accent:'#fff0a4');stroke(ctx,[[c.x+Math.cos(a)*r-4,c.y-25+Math.sin(a)*r*.5],[c.x+Math.cos(a)*r+4,c.y-25+Math.sin(a)*r*.5]],'#6d4720',1);}ctx.restore();break;
    }
    case 'silent_librarian':{
      ctx.save();ctx.globalAlpha*=out*.62;ring(ctx,c.x,c.y+8,size*.34*pop,spec.accent,4,.34);ctx.setLineDash([4,8]);ring(ctx,c.x,c.y+8,size*.27*pop,spec.primary,2,.34);ctx.setLineDash([]);for(let i=0;i<(fx.reduced?3:7);i++){const a=-1.2+i*.4;page(ctx,c.x+Math.cos(a)*size*.28,c.y-30+Math.sin(a)*size*.16,20,28,'#eaf4ef',a*.35);}ctx.restore();break;
    }
  }
  targetReceipts(fx,skill,age,spec);return true;
}

export function expansionSkillEvents(fx,e){
  if(e.type!=='skill'||!EXPANSION_VFX[e.hero])return false;
  const type=e.support?'expansionSupport':'expansionReceipt',life=e.support?.72:.58;
  for(const p of e.targets||[])fx.add({...p,type,hero:e.hero,life,total:life});
  return true;
}

export function expansionEvent(fx,e){
  if(e.type==='archiveBurst')fx.add({...e,hero:'silent_librarian',type:'expansionArea',life:.72,total:.72});
  else if(e.type==='sunBless')fx.add({type:'expansionField',hero:'marshmallow',x:360,y:405,radius:300,life:.8,total:.8});
  else if(e.type==='crystalRiposte'){
    const target=fx.enemies.get(e.target)?.point||{x:e.x,y:e.y-90};fx.add({type:'expansionRiposte',hero:'crystal_dancer',from:{x:e.x,y:e.y},x:target.x,y:target.y,life:.62,total:.62});
  }else if(e.type==='merge'&&EXPANSION_VFX[e.hero])fx.add({type:'expansionMerge',hero:e.hero,...cellPoint(e.to),life:.55,total:.55});
}

export function drawExpansionImpact(fx,e,t,clarity=1){
  const spec=EXPANSION_VFX[e.hero];if(!spec)return false;const ctx=fx.ctx,k=ease(t),a=fade(t,.2)*clarity;
  if(e.type==='impact'||e.type==='expansionReceipt'){
    ctx.save();ctx.globalAlpha*=a;ring(ctx,e.x,e.y+5,8+k*(e.type==='impact'?24:32),spec.primary,1.8*(1-t)+.6,.34);ctx.restore();
    const artSize=(e.type==='impact'?46:58)*(1+k*.28);
    if(!rasterSignature(fx,e.hero,false,e.x,e.y-18,artSize,artSize,e.angle||0,a*.9,'source-over')){
      ctx.save();ctx.globalAlpha*=a;drawMotif(ctx,spec.motif,e.x,e.y-18,(e.type==='impact'?18:22)*(1+k*.28),e.angle||0,spec.primary,spec.accent,t*Math.PI);ctx.restore();
    }
    return true;
  }
  if(e.type==='expansionSupport'){
    ctx.save();ctx.globalAlpha*=a*.75;drawMotif(ctx,spec.motif,e.x+22,e.y-27-t*18,16,e.angle||0,spec.primary,spec.accent,t);ring(ctx,e.x,e.y+22,16+k*18,spec.primary,1.4,.32);ctx.restore();return true;
  }
  if(e.type==='expansionArea'||e.type==='expansionField'){
    const radius=e.radius||180;ctx.save();ctx.globalAlpha*=a*.72;ring(ctx,e.x,e.y,radius*(.35+.65*k),spec.primary,4*(1-t)+1,.34);drawMotif(ctx,spec.motif,e.x,e.y-18,30+k*14,t*.4,spec.primary,spec.accent,t);ctx.restore();return true;
  }
  if(e.type==='expansionRiposte'){
    const from=e.from||e;ctx.save();ctx.globalAlpha*=a;for(const side of [-1,1])stroke(ctx,[[from.x,from.y-18],[e.x+side*10,e.y-18]],side<0?spec.primary:spec.accent,4*(1-t)+1);drawMotif(ctx,'crystalBlade',e.x,e.y-18,26,t*.5,spec.primary,spec.accent,t);ctx.restore();return true;
  }
  if(e.type==='expansionMerge'){
    ctx.save();ctx.globalAlpha*=a*.85;for(let i=0;i<6;i++){const q=i*Math.PI/3+t;diamond(ctx,e.x+Math.cos(q)*(16+k*35),e.y-18+Math.sin(q)*(8+k*18),5,i%2?spec.primary:spec.accent,q);}drawMotif(ctx,spec.motif,e.x,e.y-18,24+k*8,0,spec.primary,spec.accent,t);ctx.restore();return true;
  }
  if(e.type==='ward'&&['archangel','victoria'].includes(e.hero)){
    ctx.save();ctx.globalAlpha*=a;ring(ctx,e.x,e.y-6,18+k*30,spec.primary,3*(1-t)+1);
    if(e.hero==='archangel')for(const side of [-1,1])drawMotif(ctx,'angelFeather',e.x+side*(16+k*17),e.y-12,13,side*.55,spec.primary,spec.accent,t);
    else drawMotif(ctx,'commandCrown',e.x,e.y-20-k*8,18,0,spec.primary,spec.accent,t);
    ctx.restore();return true;
  }
  return false;
}
