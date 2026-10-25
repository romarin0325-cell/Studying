// Demon King, the four Miracle forms and Zeke's spin slash (pass 18). Painted GPT sheets in the cast's luminous crystal
// language (docs/art/pass18-fx-20261026); dark fire keeps a baked dark body so it reads as darkness on either theme.
// Every ring is drawn at the engine's real hit radius. These functions only draw: damage and timing stay in engine.js.
import {HERO} from '../content.js';
import {MIRACLE_FORMS} from '../new-companions.js';

// effects-demon-miracle (4x2): 0 black-flame lance, 1 leaf dart, 2 prism butterfly, 3 abyss butterfly,
// 4 black-flame burst, 5 silk ring, 6 prism flare, 7 miasma bloom. effects-deathhand (2x2): 0 open hand, 1 fist,
// 2 ground seal, 3 eruption. effects-eclose (2x2): 0 Miracle Wing emblem, 1 Abyss Wing emblem, 2 cracking cocoon,
// 3 scale ring. zeke-spin (3x1): 0 full ring, 1 breaking, 2 embers.
const SHEET='effects-demon-miracle',HAND='effects-deathhand',ECLOSE='effects-eclose',SPIN='zeke-spin';
const WING_GOLD='#ffe7a6',ABYSS='#d07cff',SILK='#e6dcff',LEAF='#bfe88a';
// Painted ring radii as a fraction of the drawn half-size (measured on the packed sheets).
const SPIN_EDGE=.8,SILK_RING=.66,SEAL_EDGE=.8;
const clamp=t=>Math.max(0,Math.min(1,t));
const ease=t=>1-(1-clamp(t))**3;
const easeIn=t=>clamp(t)**2;
const easeBack=t=>{t=clamp(t);const c=1.9;return 1+(c+1)*(t-1)**3+c*(t-1)**2;};
const span=(t,a,b)=>clamp((t-a)/(b-a));
const hash=(seed,i)=>{const n=Math.sin(seed*12.9898+i*78.233)*43758.5453;return n-Math.floor(n);};
const has=(fx,atlas)=>!!fx.art.images[atlas];
function diamond(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x,y+r*.45);ctx.lineTo(x-r,y);ctx.lineTo(x,y-r*.45);ctx.closePath();ctx.fill();}
function ring(ctx,x,y,r,color,width,alpha){if(alpha<=0||r<=0)return;ctx.save();ctx.globalAlpha*=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();ctx.restore();}
// Code fallback for a failed sheet: the earlier small butterfly.
function butterfly(ctx,size,color){
  ctx.fillStyle=color;ctx.strokeStyle='#372750';ctx.lineWidth=1.3;
  for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(side*size*.5,-size*.95,side*size,-size*.65,side*size*.67,-size*.12);ctx.bezierCurveTo(side*size*.95,size*.75,side*size*.22,size*.7,0,0);ctx.fill();ctx.stroke();}
}
const sheet=(fx,frame,x,y,w,h=w,angle=0,alpha=1,blend='source-over')=>fx.atlasStamp(SHEET,frame,4,2,x,y,w,h,angle,alpha,blend);
// A band of black fire from (x0,y0) to (x1,y1): a dark violet body that thickens toward the head, a magenta rim and a hot core.
function darkLine(ctx,x0,y0,x1,y1,width,alpha){
  if(alpha<=0)return;ctx.save();ctx.lineCap='round';ctx.globalAlpha*=alpha;
  const body=ctx.createLinearGradient(x0,y0,x1,y1);body.addColorStop(0,'#12051d00');body.addColorStop(.35,'#1a072ab0');body.addColorStop(1,'#26093ced');
  ctx.strokeStyle=body;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();
  ctx.globalCompositeOperation='lighter';
  const rim=ctx.createLinearGradient(x0,y0,x1,y1);rim.addColorStop(0,'#9c3cff00');rim.addColorStop(1,'#d77bffcc');
  ctx.strokeStyle=rim;ctx.lineWidth=Math.max(1.5,width*.16);
  for(const side of [-1,1]){const nx=-(y1-y0),ny=x1-x0,l=Math.hypot(nx,ny)||1,o=width*.42*side;ctx.beginPath();ctx.moveTo(x0+nx/l*o,y0+ny/l*o);ctx.lineTo(x1+nx/l*o,y1+ny/l*o);ctx.stroke();}
  ctx.strokeStyle='#f5d6ff99';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(x0+(x1-x0)*.5,y0+(y1-y0)*.5);ctx.lineTo(x1,y1);ctx.stroke();
  ctx.restore();
}

// ---- Basic attacks: projectiles -------------------------------------------------------------------------------
export function drawNewShot(fx,shot,s,{x,y,angle,t}){
  if(!['demon_king','miracle_larva'].includes(shot.hero))return false;
  const ctx=fx.ctx,form=shot.form||'miracle_larva';
  // The cocoon strikes in a circle around itself (drawn as an attack shape below the units): no projectile.
  if(shot.hero==='miracle_larva'&&form==='miracle_cocoon')return true;
  if(!has(fx,SHEET)){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    if(shot.hero==='demon_king'){ctx.fillStyle='#40225b';ctx.strokeStyle='#d1a3fb';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(18,0);ctx.lineTo(-22,-5);ctx.lineTo(-17,0);ctx.lineTo(-22,5);ctx.closePath();ctx.fill();ctx.stroke();}
    else if(form==='miracle_wing'||form==='abyss_wing')butterfly(ctx,10,form==='abyss_wing'?'#b279e0':'#e7d690');
    else{ctx.fillStyle='#d8e897';ctx.beginPath();ctx.moveTo(12,0);ctx.quadraticCurveTo(-1,-12,-11,0);ctx.quadraticCurveTo(-1,12,12,0);ctx.fill();}
    ctx.restore();return true;
  }
  const rank=Math.min(5,shot.rank||1);
  if(shot.hero==='demon_king'){
    // Black-flame lance: the head flies to the target in the shot's 0.2 s with a dark fire trail behind it. The burnt
    // line along the whole pierce range is left by the impact (drawn there, at the beam's real width).
    const o=shot.origin,dir=Math.atan2(shot.to.y-o.y,shot.to.x-o.x),d=Math.hypot(shot.to.x-o.x,shot.to.y-o.y),len=(d+30)*ease(t);
    const hx=o.x+Math.cos(dir)*len,hy=o.y-16+Math.sin(dir)*len;
    darkLine(ctx,o.x+Math.cos(dir)*Math.min(40,len*.3),o.y-16+Math.sin(dir)*Math.min(40,len*.3),hx,hy,HERO.demon_king.radius,1);
    const w=170+rank*6;fx.glow('glow','#b45cff',hx,hy,96,.6);sheet(fx,0,hx-Math.cos(dir)*w*.34,hy-Math.sin(dir)*w*.34,w,w*.64,dir,1);
    return true;
  }
  if(form==='miracle_wing'||form==='abyss_wing'){
    // A painted butterfly that beats its wings in flight; the gold one leaves a short rainbow shimmer.
    const flap=.72+.28*Math.abs(Math.sin(t*22+shot.uid)),size=(form==='miracle_wing'?84:80)+rank*3;
    fx.glow('glow',form==='miracle_wing'?'#fff1c0':'#b45cff',x,y,size*.9,.45);
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(1,flap);sheet(fx,form==='miracle_wing'?2:3,0,0,size,size,0,.97);ctx.restore();
    return true;
  }
  // Larva: a crystal leaf dart that wobbles along its flight.
  sheet(fx,1,x,y,60+rank*2,undefined,angle+Math.sin(t*14+shot.uid)*.18,.96);
  return true;
}

// ---- Basic attacks: circles under the units (Zeke's spin, the cocoon's silk pulse) -----------------------------
export function drawNewAttackShape(fx,e,t,clarity=1){
  const ctx=fx.ctx;
  if(e.hero==='zeke'){
    if(!has(fx,SPIN))return false;
    // One full swing of the flame sword around Zeke. The white-hot head of the painted trail (about 235 degrees on the
    // sheet) is carried round from behind the target, so it crosses the target when the hit lands (0.12 s); the swept
    // wedge reveals the trail. Then the ring breaks into flame and embers. The outer flame edge is the real radius.
    const R=HERO.zeke.range,size=2*R/SPIN_EDGE,side=e.swing?-1:1,sweep=ease(span(t,0,.42)),a0=side*e.angle-1.55*Math.PI,head=a0+sweep*Math.PI*2;
    const rot=head-235*Math.PI/180+(t>.42?(t-.42)*.5:0),peak=1-span(t,.38,.7),broke=Math.sin(Math.PI*span(t,.3,.85)),embers=Math.sin(Math.PI*span(t,.55,1));
    fx.glow('glow','#ff8a3a',e.origin.x,e.origin.y,R*.9,(1-t)*.28*clarity);
    ctx.save();ctx.translate(e.origin.x,e.origin.y);ctx.scale(1,side);
    if(peak>0){ctx.save();if(sweep<1){ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,size*.6,a0,head);ctx.closePath();ctx.clip();}
      fx.atlasStamp(SPIN,0,3,1,0,0,size,size,rot,peak*.85*clarity,'screen');ctx.restore();}
    if(broke>0)fx.atlasStamp(SPIN,1,3,1,0,0,size*1.03,size*1.03,rot+.12,broke*.85*clarity,'screen');
    if(embers>0)fx.atlasStamp(SPIN,2,3,1,0,0,size*1.06,size*1.06,rot+.2,embers*.8*clarity,'screen');
    ctx.restore();
    // The sword's head: a hot spark riding the edge while it sweeps.
    if(sweep<1&&!fx.reduced){const hx=e.origin.x+Math.cos(side*head)*R*.86,hy=e.origin.y+Math.sin(side*head)*R*.86;fx.glow('glow','#ffd27a',hx,hy,110,.85*clarity);fx.glow('rays','#ffb04a',hx,hy,120,.5*clarity,t*4);}
    return true;
  }
  if(e.hero==='miracle_larva'&&e.form==='miracle_cocoon'){
    if(!has(fx,SHEET))return false;
    // Silk shockwave: the woven ring opens from the cocoon to the real radius and fades there; pearls ride the ring.
    const R=MIRACLE_FORMS.miracle_cocoon.range,grow=ease(span(t,0,.55)),r=R*(.42+.58*grow),fade=1-span(t,.45,1),size=2*r/SILK_RING;
    fx.glow('glow','#d9ccff',e.origin.x,e.origin.y-10,140*(1-t*.4),fade*.55);
    sheet(fx,5,e.origin.x,e.origin.y,size,size,t*.6,fade*.95,'screen');
    ring(ctx,e.origin.x,e.origin.y,r,'#f3edff',2.2*fade+.6,fade*.55);
    if(!fx.reduced){ctx.save();ctx.globalCompositeOperation='lighter';for(let i=0;i<6;i++){const a=i/6*Math.PI*2+t*1.4;ctx.globalAlpha=fade;diamond(ctx,e.origin.x+Math.cos(a)*r,e.origin.y+Math.sin(a)*r,4.2*fade+1.4,i%2?'#ffffff':SILK);}ctx.restore();}
    return true;
  }
  return false;
}

// ---- Ground layer (below units): Death Hand seal and darkness, eclose glow --------------------------------------
export function drawNewGround(fx,e,t){
  const ctx=fx.ctx;
  if(e.type==='deathhandGround'){
    if(!has(fx,HAND))return true;
    const age=t*e.total,R=e.radius,open=easeBack(span(age,0,.22)),fade=1-span(age,.95,1.4),slam=age>=.28,size=2*R/SEAL_EDGE;
    // The field darkens around the pack, deepest under the hand.
    ctx.save();ctx.globalAlpha=Math.min(1,age*5)*fade*(fx.reduced?.6:1);
    const dark=ctx.createRadialGradient(e.x,e.y,R*.4,e.x,e.y,R*2.7);dark.addColorStop(0,'#0b0414b8');dark.addColorStop(.45,'#0b041466');dark.addColorStop(1,'#0b041400');
    ctx.fillStyle=dark;ctx.fillRect(0,0,720,780);ctx.restore();
    fx.atlasStamp(HAND,2,2,2,e.x,e.y,size*(.55+.45*open),size*(.55+.45*open),-age*.35,fade*.88,'source-over');
    // The hand's shadow falls before it lands.
    if(!slam){const k=easeIn(age/.28);ctx.save();ctx.globalAlpha=.25+.35*k;ctx.fillStyle='#07020c';ctx.beginPath();ctx.ellipse(e.x,e.y+6,R*(.35+.5*k),R*(.12+.18*k),0,0,Math.PI*2);ctx.fill();ctx.restore();}
    // The true radius rings out at the grip.
    if(slam){const k=ease(span(age,.28,.75));ring(ctx,e.x,e.y,R*(.9+.1*k),'#e9a6ff',6*(1-k)+1.5,(1-k)*.95);ring(ctx,e.x,e.y,R*(.9+.1*k)-7,'#7a2bb8',3*(1-k)+1,(1-k)*.8);}
    return true;
  }
  if(e.type==='ecloseGround'){
    const age=t*e.total-(e.delay||0),k=span(age,.3,1.2),c=e.form==='abyss_wing'?ABYSS:WING_GOLD;
    if(age>.28)fx.glow('glow',c,e.x,e.y+18,170*(.6+.4*ease(k)),(1-k)*.55);
    return true;
  }
  return false;
}

// ---- Impact layer (above units) ---------------------------------------------------------------------------------
export function drawNewImpact(fx,e,t){
  const ctx=fx.ctx;
  if(e.type==='deathhandBlast'){
    const age=t*e.total,R=e.radius||180,hit=.28;
    if(!has(fx,HAND)){ctx.save();ctx.globalAlpha=Math.sin(Math.PI*t)*.9;fx.glow('glow','#9a4dff',e.x,e.y-20,R*1.6,.8);ring(ctx,e.x,e.y,R*ease(t*2),'#d7a6ff',4,1);ctx.restore();return true;}
    const targets=(e.points||[]).slice(0,fx.reduced?5:10);
    // Debuff marks gather over each target before the grip: one violet rune per kind the hand will count.
    if(age<hit+.12)for(const p of targets){const n=Math.min(7,p.count||0),k=span(age,.04,.24),a=1-span(age,hit,hit+.12);if(!n||a<=0)continue;
      ctx.save();ctx.globalCompositeOperation='lighter';for(let i=0;i<n;i++){const ang=-Math.PI/2+(i-(n-1)/2)*.42;ctx.globalAlpha=a*k;diamond(ctx,p.x+Math.cos(ang)*26,p.y-44+Math.sin(ang)*12,5.5,i%2?'#f4c4ff':'#c77dff');}ctx.restore();}
    // The open hand drops from the sky, gathering speed, and closes on the pack.
    // The hand stays whole on screen: near an edge it leans in from the board side while its grip still lands on the pack.
    const size=Math.max(360,R*2.35),hx=Math.min(720-size*.4,Math.max(size*.4,e.x));
    if(age<hit+.08){const k=easeIn(span(age,0,hit)),y=e.y-330+(250+20)*k,a=Math.min(1,age*7)*(1-span(age,hit,hit+.08));
      fx.glow('glow','#8f3dff',hx,y,size*.9,a*.35);fx.atlasStamp(HAND,0,2,2,hx,y,size*(.85+.15*k),size*(.85+.15*k),0,a,'source-over');}
    if(age>=hit){
      const since=age-hit,grip=span(since,0,.08),lift=span(age,.68,1.15),squash=1-.08*Math.sin(Math.PI*span(since,0,.16));
      const y=e.y-60-lift*140,a=grip*(1-lift);
      if(a>0){ctx.save();ctx.translate(hx,y);ctx.scale(1+(1-squash)*.6,squash);fx.atlasStamp(HAND,1,2,2,0,0,size*.95,size*.95,0,a,'source-over');ctx.restore();}
      // Impact: violet flash at the grip, a short screen flash and a shake request for the renderer.
      const flash=1-span(since,0,.25);
      if(flash>0){fx.glow('rays','#e7a6ff',e.x,e.y-30,R*2.6*ease(since/.2),flash*.75,since*2);fx.glow('glow','#b45cff',e.x,e.y-30,R*2,flash*.7);
        if(!fx.reduced){ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=flash*.18;ctx.fillStyle='#c98bff';ctx.fillRect(0,0,720,780);ctx.restore();}}
      if(!e.shook){e.shook=true;fx.shake=Math.max(fx.shake||0,9);}
      // Black fire erupts under every target; more debuff kinds, bigger eruption.
      for(const [i,p] of targets.entries()){const k=span(since,i*.02,.2+i*.02),out=1-span(since,.35+i*.02,.95);if(k<=0||out<=0)continue;
        const s=(105+15*Math.min(7,p.count||0))*(p.boss?1.35:1),h=s*(.35+.65*easeBack(k));
        fx.atlasStamp(HAND,3,2,2,p.x,p.y+8-h/2,s,h,0,out*.95,'source-over');fx.glow('glow','#a04dff',p.x,p.y-20,s*.9,out*.45);}
      // Embers and amethyst shards thrown out of the grip.
      if(!fx.reduced){ctx.save();ctx.globalCompositeOperation='lighter';const k=ease(span(since,0,.7)),out=1-span(since,.3,.85);
        for(let i=0;i<16;i++){const ang=hash(e.x,i)*Math.PI*2,v=R*(.5+hash(e.y,i)*.9);ctx.globalAlpha=out;diamond(ctx,e.x+Math.cos(ang)*v*k,e.y-30+Math.sin(ang)*v*k*.6-Math.sin(k*Math.PI)*30,4+hash(i,e.x)*4,i%3?'#d79bff':'#fff0ff');}ctx.restore();}
    }
    return true;
  }
  if(e.type==='miracleEclose'){
    // Every cocoon closes at once; they crack one after another (delay by board order) so each hatch reads on its own.
    const age=t*e.total,abyss=e.form==='abyss_wing',c=abyss?ABYSS:WING_GOLD,crack=.32+(e.delay||0);
    if(!has(fx,ECLOSE)){const open=Math.min(1,t*3);ctx.save();ctx.translate(e.x,e.y-38);ctx.globalAlpha=Math.sin(Math.PI*t)*.85;ctx.scale(open,1);butterfly(ctx,38,abyss?'#ce9aeb':'#fae3a1');ctx.restore();return true;}
    // The cocoon wraps the unit and shakes harder until it cracks, light leaking through the seams.
    if(age<crack+.06){const k=span(age,0,crack),jitter=fx.reduced?0:Math.sin(age*90+e.uid)*k*3,a=Math.min(1,age*8)*(1-span(age,crack,crack+.06));
      fx.glow('glow','#efe6ff',e.x,e.y-30,92*(.7+.4*k),a*.45);fx.atlasStamp(ECLOSE,2,2,2,e.x+jitter,e.y-34,112+12*k,112+12*k,0,a*.9,'source-over');}
    if(age>=crack){
      const since=age-crack,pop=easeBack(span(since,0,.24)),out=1-span(since,.36,.66),burst=1-span(since,0,.26);
      // Burst: a flash in the new form's colour, then the scale ring spins out and the emblem rises with the form's name.
      if(burst>0){fx.glow('rays',c,e.x,e.y-36,230*ease(since/.22),burst*.85,since*2);fx.glow('glow','#ffffff',e.x,e.y-36,120,burst*.6);}
      const ringK=ease(span(since,0,.5));fx.atlasStamp(ECLOSE,3,2,2,e.x,e.y-30,100+120*ringK,100+120*ringK,since*1.6,(1-span(since,.25,.55))*.85,'source-over');
      if(out>0)fx.atlasStamp(ECLOSE,abyss?1:0,2,2,e.x,e.y-60-since*44,150*pop,150*pop,0,out,'source-over');
      const label=1-span(since,.55,.95);
      if(label>0){ctx.save();ctx.globalAlpha=Math.min(1,since*6)*label;ctx.font='700 22px Georgia,serif';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#172632';const ly=e.y-98-since*26;ctx.strokeText(abyss?'어비스윙':'미라클윙',e.x,ly);ctx.fillStyle=abyss?'#e7b6ff':'#ffe7a6';ctx.fillText(abyss?'어비스윙':'미라클윙',e.x,ly);ctx.restore();}
      if(!fx.reduced){ctx.save();ctx.globalCompositeOperation='lighter';const k=ease(span(since,0,.7)),a=1-span(since,.25,.7);
        for(let i=0;i<10;i++){const ang=hash(e.uid||1,i)*Math.PI*2,v=40+hash(e.x,i)*56;ctx.globalAlpha=a;diamond(ctx,e.x+Math.cos(ang)*v*k,e.y-36+Math.sin(ang)*v*k*.7-k*18,3.2+hash(i,e.y)*2.6,i%2?'#ffffff':c);}ctx.restore();}
    }
    return true;
  }
  if(e.type==='impact'&&['demon_king','miracle_larva'].includes(e.hero)){
    const form=e.form||'miracle_larva';
    if(!has(fx,SHEET)){ctx.save();ctx.translate(e.x,e.y-18);ctx.globalAlpha=1-t;ctx.strokeStyle=e.hero==='demon_king'?'#c3a0e5':'#e4edc7';ctx.lineWidth=2;for(let i=0;i<4;i++){const a=i*Math.PI/2+.4;ctx.beginPath();ctx.moveTo(Math.cos(a)*5,Math.sin(a)*5);ctx.lineTo(Math.cos(a)*(12+t*10),Math.sin(a)*(12+t*10));ctx.stroke();}ctx.restore();return true;}
    const rank=Math.min(5,e.rank||1),fade=1-span(t,.35,1);
    if(e.hero==='demon_king'){
      // The lance burns its whole pierce line (real range and width) and black fire bursts up from the struck enemy.
      if(e.origin){const a=e.angle,o=e.origin,R=HERO.demon_king.range,burn=1-span(t,.3,1),k=ease(span(t,0,.25));
        darkLine(ctx,o.x+Math.cos(a)*36,o.y-16+Math.sin(a)*36,o.x+Math.cos(a)*R*(.55+.45*k),o.y-16+Math.sin(a)*R*(.55+.45*k),HERO.demon_king.radius*(.6+.4*burn),burn*.9);
        if(!fx.reduced){ctx.save();ctx.globalCompositeOperation='lighter';for(let i=0;i<7;i++){const f=.15+i*.12,px=o.x+Math.cos(a)*R*f,py=o.y-16+Math.sin(a)*R*f-ease(t)*(10+hash(i,e.x)*18);ctx.globalAlpha=burn;diamond(ctx,px,py,3.2,i%2?'#e7a6ff':'#9c4dff');}ctx.restore();}}
      const s=(96+rank*5),h=s*(.45+.55*easeBack(span(t,0,.35)));
      sheet(fx,4,e.x,e.y+4-h/2,s,h,0,fade);fx.glow('glow','#a04dff',e.x,e.y-22,s*.8,fade*.4);return true;
    }
    if(form==='miracle_cocoon'){fx.glow('glow',SILK,e.x,e.y-18,70,fade*.6);return true;}
    // Splash forms: the painted burst plus a ring at the real splash radius.
    const R=e.form==='miracle_wing'||e.form==='abyss_wing'?72:64;
    if(form==='miracle_wing'){const pop=easeBack(span(t,0,.3)),s=R*2.6*pop;sheet(fx,6,e.x,e.y-14,s,s,t*.5,fade);
      for(const [i,col] of ['#ffd6f0','#cfe8ff','#d9ffe6'].entries())ring(ctx,e.x,e.y,R*ease(span(t,i*.05,.5+i*.05)),col,2.2*fade+.5,fade*.75);return true;}
    if(form==='abyss_wing'){const pop=ease(span(t,0,.3)),s=R*2.5*(.55+.45*pop);sheet(fx,7,e.x,e.y-12,s,s,-t*.4,fade);ring(ctx,e.x,e.y,R*pop,'#c873ff',2.4*fade+.6,fade*.8);return true;}
    // Larva: a green ring at the splash radius and four small leaves thrown outward.
    fx.glow('glow',LEAF,e.x,e.y-12,R*1.6,fade*.55);ring(ctx,e.x,e.y,R*ease(span(t,0,.45)),'#d6f5a0',2.2*fade+.5,fade*.8);
    if(!fx.reduced)for(let i=0;i<4;i++){const ang=i*Math.PI/2+.5+e.x%1,k=ease(t);sheet(fx,1,e.x+Math.cos(ang)*R*.8*k,e.y-12+Math.sin(ang)*R*.5*k,30,30,ang,fade*.9);}
    return true;
  }
  return false;
}
