// Luminous crystal motifs in the original cast's language (glow keyed to alpha, drawn like the ultimates atlas; pass 15
// replaced the opaque Sol sprites). These functions only draw: damage, collision, costs and clocks stay in engine.js.
import {HERO} from '../../../../src/content.js';
import {pathPoint} from '../../../../src/combat/engine.js';

export const COMPANION_VISUALS=Object.freeze(Object.fromEntries([
  ['toffee_apple','effects-companion-sweet',0,'#f26040'],
  ['joker','effects-companion-sweet',1,'#f06aa8'],
  ['sunflower','effects-companion-sweet',2,'#ffd05b'],
  ['underdog','effects-companion-sweet',3,'#d8bea0'],
  ['cure_master','effects-companion-twilight',0,'#ffafd5'],
  ['venom','effects-companion-twilight',1,'#a1db6d'],
  ['ash','effects-companion-twilight',2,'#ff995b'],
  ['antropy','effects-companion-twilight',3,'#e2d8ff'],
].map(([id,atlas,frame,color])=>[id,Object.freeze({atlas,frame,color})])));
// Ultimates that hit every enemy, and the emblem scale per rarity (C smallest, UR grandest).
const FIELD_ULTIMATES=new Set(['joker','sunflower','antropy','venom']);
const RARITY_WEIGHT=Object.freeze({C:.82,R:.9,SR:1,UR:1.12});
const clamp=t=>Math.max(0,Math.min(1,t));
const ease=t=>1-(1-clamp(t))**3;
const fade=(t,start=.3)=>1-clamp((t-start)/(1-start));
const hash=(seed,i)=>{const n=Math.sin(seed*12.9898+i*78.233)*43758.5453;return n-Math.floor(n);};
const JOKER_COLORS={red:'#ff665f',blue:'#73bfff',green:'#8bdf8b',white:'#fff2df',black:'#ad8ad9',chaos:'#d9b8ff'};
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
// Pass 19 GPT sheets (docs/art/companion-fx-20261028). EMBLEMS 2x1: 0 Chaos Roulette, 1 full-bloom Solar Flare; the
// board's trait badges stay flat glyphs like every other trait badge (effects.js), the painted art is for these finales.
// PIECES 4x2: 0 sugar glitter ring, 1 sugar sparkles, 2 chaos card, 3 chaos hit burst, 4 chaos vortex ring,
// 5 sun petal (tip down), 6 sun petal ring, 7 pollen.
export const EMBLEMS='effects-joker-sun',PIECES='effects-chaos-sun';
// A hollow ring motif's outer edge sits at this share of the stamp width (228/256 inner cell, 1.08 packing margin).
export const RING_EDGE=228/256/1.08/2;
const piece=(fx,frame,x,y,w,angle=0,alpha=1)=>fx.art.images[PIECES]&&alpha>0&&fx.atlasStamp(PIECES,frame,4,2,x,y,w,w,angle,alpha,'source-over');
const emblem=(fx,frame,x,y,w,angle=0,alpha=1)=>fx.art.images[EMBLEMS]&&alpha>0&&fx.atlasStamp(EMBLEMS,frame,2,1,x,y,w,w,angle,alpha,'source-over');
// Apple bomb blast (radius 200): a thin ring of sugar glitter opens to the real radius and sparkles wink inside it.
// The centre stays open and nothing larger than a sparkle sits on an enemy, so units and HP bars stay readable.
function sugarBurst(fx,e,t){
  const ctx=fx.ctx,R=e.radius||200,open=ease(span(t,0,.42)),a=fade(t,.38);
  fx.glow('glow','#ffe0a8',e.x,e.y,70*(1-open*.5),(1-span(t,0,.25))*.55);
  piece(fx,0,e.x,e.y,R/RING_EDGE*(.35+.65*open),t*.5,a*.7);
  ctx.save();ctx.globalAlpha*=a*.35;ctx.strokeStyle='#ffd7a8';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(e.x,e.y,R*(.35+.65*open),0,Math.PI*2);ctx.stroke();ctx.restore();
  const spots=fx.reduced?3:7;
  for(let i=0;i<spots;i++){
    const at=.08+hash(e.x,i)*.4,k=span(t,at,at+.4),theta=hash(e.y,i)*Math.PI*2,r=R*(.25+hash(e.x+e.y,i)*.65);
    if(k>0&&k<1)piece(fx,1,e.x+Math.cos(theta)*r,e.y+Math.sin(theta)*r,(34+hash(i,e.x)*22)*Math.sin(Math.PI*k),k*.8,.95);
  }
  for(const [i,q] of (e.targets||[]).slice(0,fx.reduced?3:8).entries()){const k=span(t,.12+i*.03,.6+i*.03);if(k>0&&k<1)piece(fx,1,q.x,q.y-14,30*Math.sin(Math.PI*k),i,.9);}
}
const span=(t,a,b)=>clamp((t-a)/(b-a));

// Chaos Roulette (Joker after five colours): the jester's wheel spins in over the field inside a five-colour vortex,
// cards fly from it to the struck enemies and burst there in five colours. Same centre and weight as the field ultimates.
function chaosRoulette(fx,skill,age){
  const t=clamp(age/1.5),out=fade(t,.5),pop=easeBack(span(age,0,.32)),x=360,y=405,size=340;
  fx.glow('rays','#d9b8ff',x,y,size*1.3*Math.min(1,age*4),out*.5,age*.5);
  piece(fx,4,x,y,size*1.6*(.7+.3*ease(age/.4)),-age*2.4,out*.6);
  emblem(fx,0,x,y,size*(.5+.5*pop),(1-ease(age/.45))*-1.2,out*.92);
  if(!fx.reduced)for(const [i,[sx,sy]] of [[42,345],[678,485]].entries())emblem(fx,0,sx,sy,104,(i?1:-1)*age*.8,out*.6);
  if(age>.22&&age<.85)for(const [i,q] of (skill.targets||[]).slice(0,fx.reduced?3:8).entries()){
    const k=ease(span(age,.22+i*.03,.6+i*.03));if(k<=0||k>=1)continue;
    piece(fx,2,x+(q.x-x)*k,y+(q.y-y)*k-Math.sin(k*Math.PI)*40,46,age*7+i,(1-k*.6)*.9);
  }
}
// Solar Flare at three sunlight: a sunflower in full bloom rises over the field, a crown of petals opens outward and a few
// sun petals drift down. The plain flare (zero to two sunlight) keeps the smaller common emblem.
function fullBloom(fx,skill,age){
  const ctx=fx.ctx,t=clamp(age/1.5),out=fade(t,.5),pop=easeBack(span(age,0,.36)),x=360,y=405-20*ease(age/.5),size=360;
  fx.glow('rays','#ffe9a0',x,y,size*1.4*Math.min(1,age*3.5),out*.62,age*.35);
  fx.glow('glow','#fff3c8',x,y,size*.7,out*.35);
  const ring=ease(span(age,.08,.7));piece(fx,6,x,y,size*(.8+1.05*ring),age*.25,(1-span(age,.3,.85))*.5);
  emblem(fx,1,x,y,size*(.45+.55*pop),age*.12,out*.95);
  if(!fx.reduced){
    for(let i=0;i<12;i++){
      const at=.15+hash(i,7)*.5,k=span(age,at,at+1.1);if(k<=0||k>=1)continue;
      const px=60+hash(i,3)*600+Math.sin(k*5+i)*26,py=40+k*560,spin=Math.sin(k*4+i)*.8;
      ctx.save();ctx.globalAlpha*=Math.sin(Math.PI*k)*.85;piece(fx,5,px,py,22+hash(i,5)*14,Math.PI+spin,1);ctx.restore();
    }
    for(const [i,q] of (skill.targets||[]).slice(0,8).entries()){const k=span(age,.3+i*.04,.9+i*.04);if(k>0&&k<1)piece(fx,7,q.x,q.y-16,44*Math.sin(Math.PI*k),0,.85);}
  }
}
const easeBack=t=>{const c=1.70158,u=clamp(t)-1;return 1+(c+1)*u*u*u+c*u*u;};

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
  if(id==='joker'&&skill.chaos&&fx.art.images[EMBLEMS]&&fx.art.images[PIECES]){chaosRoulette(fx,skill,age);return true;}
  if(id==='sunflower'&&skill.sunlight>=3&&fx.art.images[EMBLEMS]&&fx.art.images[PIECES]){fullBloom(fx,skill,age);return true;}
  if(id==='toffee_apple'){
    // Casting installs a mine; it does not detonate it or hit every enemy yet.
    painted(fx,id,true,o.x+24,o.y-30,95*(.75+.25*pop),undefined,-.15*(1-pop),out*.62);
    return true;
  }
  if(id==='underdog'){
    // A short physical strike at the brawler, then grit racing into the lanes. The whole-field hit raises the
    // stone-burst emblem over the board like every field ultimate. The actual stun remains visible on allied units.
    const k=RARITY_WEIGHT[HERO[id].rarity]||1,size=400*k;
    fx.glow('rays','#e0c9a6',360,405,size*1.2*pop,out*.45,age*.4);
    painted(fx,id,true,360,405,size*(.55+.45*pop),undefined,0,out*.85);
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
  // Same weight scale as the original cast's ultimates: a field-wide hit raises its emblem over the middle of the board
  // with a ray burst and two edge seals, a support burst stays at the caster; the emblem grows with rarity.
  // Ash only readies here: the real blast is drawn at the densest enemy pack (armageddon event).
  const field=FIELD_ULTIMATES.has(id),k=RARITY_WEIGHT[HERO[id].hidden?'UR':HERO[id].rarity]||1;
  const size=(field?400:id==='cure_master'?300:112)*k,x=field?360:o.x,y=field?405:o.y-(id==='ash'?24:40);
  if(field)fx.glow('rays',p.color,x,y,size*1.25*pop,out*.5,age*.4);
  painted(fx,id,true,x,y,size*(.55+.45*pop),undefined,id==='antropy'?-.12+age*.15:0,out*(field?.8:.86));
  if(field&&!fx.reduced)for(const [sx,sy] of [[42,345],[678,485]])painted(fx,id,true,sx,sy,104*k,undefined,0,out*.6);
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
    // The full-bloom flare drops pollen on its targets itself (fullBloom); Chaos Roulette receipts burst in five colours.
    if(!(e.hero==='sunflower'&&e.sunlight>=3&&fx.art.images[PIECES]))for(const p of e.targets||[])fx.add({...p,type:'companionReceipt',hero:e.hero,...(e.chaos?{chaos:true,life:.7,total:.7}:{life:.52,total:.52})});
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
    if(e.chaos&&fx.art.images[PIECES]){const k=span(t,.35,1);if(k>0)piece(fx,3,e.x,e.y-10,64*(.6+.4*ease(k/.4)),k,fade(k,.3)*clarity*.9);return true;}
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
    if(fx.art.images[PIECES])sugarBurst(fx,e,t);
    else{chips(fx,'toffee_apple',e.x,e.y-10,t,(e.radius||200)*.7,fx.reduced?4:12,.95);floorArc(fx,e.x,e.y,e.radius||200,t,'#ffd7a8',.6);}
    return true;
  }
  return false;
}

export function drawCompanionBomb(fx,b){
  if(!fx.art.images[COMPANION_VISUALS.toffee_apple.atlas])return false;
  const p=pathPoint(b.progress),ctx=fx.ctx,pulse=.5+Math.sin(fx.clock*4+b.uid)*.5;
  // The waiting mine is Toffee Apple's own crystal apple-bomb emblem: its lit fuse and small shadow signal
  // "waiting". Five waiting 200px blast rings would cover the road, so the radius shows only when it goes off.
  ctx.save();ctx.fillStyle='#24152655';ctx.beginPath();ctx.ellipse(p.x,p.y+5,19,6,0,0,Math.PI*2);ctx.fill();ctx.restore();
  painted(fx,'toffee_apple',true,p.x,p.y-30,76+pulse*3,undefined,0,.95);
  if(!fx.reduced){fx.glow('glow','#ffcb79',p.x+16,p.y-58,16+pulse*8,.6);}
  return true;
}
