// UR ultimate sequences (Cherry Prince, Luna, Frost Witch, Harmonious) and the shared basic-attack contact layer, pass 21
// (2026-11-06, docs/plans/VFX_DIRECTION_PLAN.md §2 and docs/art/ur-vfx-20261106).
//
// Assets are one small library, not a sheet per hero:
//   ur-kit    12 monochrome luminance pieces (blade flash, crescent, ring, mist, shard, flare, petal, ice spikes, spike, moon,
//             rime, shatter). Each is recoloured at runtime by a gradient map (white core -> hero colour -> dark rim), so the same
//             256-px cell is a sakura cut for Cherry Prince, a moon cut for Luna and a frost spike for the Frost Witch.
//   ur-sweets Harmonious's painted desserts, cake stand and sugar dust (colour cannot come from a ramp).
// The engine still resolves damage at its own moment (instantly at the cast, or at the finisher's impact). These sequences say
// when each target is struck on screen (plan); Renderer holds the cast's numbers, deaths and HP bars until then.
import {HERO} from '../content.js';
import {cellPoint,cellAt,pathPoint,PATH_LENGTH} from './engine.js';

export const KIT=Object.freeze({blade:0,crescent:1,ring:2,mist:3,shard:4,flare:5,petal:6,spikes:7,spike:8,moon:9,rime:10,shatter:11});
export const SWEET=Object.freeze({shortcake:0,macarons:1,pudding:2,parfait:3,donut:4,cupcake:5,stand:6,strawberry:7,bow:8,cotton:9,macaron:10,stardust:11});
const DESSERTS=[SWEET.shortcake,SWEET.macarons,SWEET.pudding,SWEET.parfait,SWEET.donut,SWEET.cupcake];
// Cells packed with their base on the floor (pack-pick-sheet "anchor":"bottom"): the base sits this far down the cell.
const KIT_FLOOR=.949,SWEET_FLOOR=.93;

const clamp01=t=>t<0?0:t>1?1:t;
const span=(t,a,b)=>clamp01((t-a)/(b-a));
const lerp=(a,b,t)=>a+(b-a)*t;
const easeOut=t=>1-Math.pow(1-clamp01(t),3);
const easeIn=t=>clamp01(t)*clamp01(t);
const easeBack=t=>{t=clamp01(t);const c=1.7;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2);};
const hash=(seed,i)=>{const x=Math.sin(seed*12.9898+i*78.233)*43758.5453;return x-Math.floor(x);};
const bell=t=>Math.sin(Math.PI*clamp01(t));

// Gradient maps: brightness 0..1 -> colour. The white top keeps the hot cores of the established crystal look.
const RAMPS=Object.freeze({
  sakura:[[0,'#5a1036'],[.28,'#e0408a'],[.55,'#ff9cc8'],[.8,'#ffe0ee'],[1,'#ffffff']],
  gold:[[0,'#4a2a00'],[.28,'#d99a1c'],[.55,'#ffd25e'],[.8,'#fff2c4'],[1,'#ffffff']],
  moon:[[0,'#24104a'],[.28,'#7448d6'],[.55,'#b08cff'],[.8,'#e8deff'],[1,'#ffffff']],
  pale:[[0,'#262048'],[.35,'#9088d8'],[.65,'#dcd6ff'],[.85,'#f5f2ff'],[1,'#ffffff']],
  ice:[[0,'#0a2440'],[.28,'#2a86d6'],[.55,'#6fd0ff'],[.8,'#d8f4ff'],[1,'#ffffff']],
  frost:[[0,'#1a3048'],[.4,'#9fd8f4'],[.75,'#eaf8ff'],[1,'#ffffff']],
  sugar:[[0,'#4a1028'],[.28,'#ff6aa6'],[.55,'#ffb6d4'],[.8,'#fff0c8'],[1,'#ffffff']],
});
const hex=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const toHex=c=>'#'+c.map(v=>Math.round(Math.min(255,Math.max(0,v))).toString(16).padStart(2,'0')).join('');
const mixHex=(a,b,t)=>{const x=hex(a),y=hex(b);return toHex(x.map((v,i)=>v+(y[i]-v)*t));};
// A hero's own ramp for its contact spark: dark rim, the roster colour, a pale mid and a white core.
function heroStops(id){const c=HERO[id]?.color;if(!c)return null;return [[0,mixHex(c,'#000000',.62)],[.3,c],[.65,mixHex(c,'#ffffff',.55)],[1,'#ffffff']];}
function lutOf(stops){
  const out=new Uint8ClampedArray(768);
  for(let i=0;i<256;i++){const t=i/255;let k=0;while(k<stops.length-2&&t>stops[k+1][0])k++;
    const [t0,c0]=stops[k],[t1,c1]=stops[k+1],f=clamp01((t-t0)/((t1-t0)||1)),a=hex(c0),b=hex(c1);
    for(let c=0;c<3;c++)out[i*3+c]=Math.round(a[c]+(b[c]-a[c])*f);}
  return out;
}
const SMALL=new Set([KIT.petal,KIT.shard,KIT.flare,KIT.spikes,KIT.spike,KIT.rime]);
// One recoloured canvas per (piece, ramp), built once.
function kitCanvas(fx,frame,ramp){
  const img=fx.art?.images?.['ur-kit'];if(!img||typeof document==='undefined')return null;
  const cache=fx.urCache||(fx.urCache=new Map()),key=frame+'|'+ramp;let c=cache.get(key);if(c)return c;
  const stops=RAMPS[ramp]||(ramp.startsWith('hero:')?heroStops(ramp.slice(5)):null);if(!stops)return null;
  const size=SMALL.has(frame)?128:256,cw=img.naturalWidth/4,ch=img.naturalHeight/3;
  c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d',{willReadFrequently:true});
  g.drawImage(img,frame%4*cw,Math.floor(frame/4)*ch,cw,ch,0,0,size,size);
  try{const d=g.getImageData(0,0,size,size),p=d.data,l=lutOf(stops);for(let i=0;i<p.length;i+=4){const a=p[i+3];if(!a)continue;p[i]=l[a*3];p[i+1]=l[a*3+1];p[i+2]=l[a*3+2];}g.putImageData(d,0,0);}
  catch{g.globalCompositeOperation='source-atop';g.fillStyle=stops[Math.min(2,stops.length-1)][1];g.fillRect(0,0,size,size);}
  cache.set(key,c);return c;
}
export function kit(fx,frame,ramp,x,y,w,h=w,angle=0,alpha=1,blend='lighter'){
  if(!(alpha>.004)||!(w>0)||!(h>0))return;const c=kitCanvas(fx,frame,ramp);if(!c)return;const ctx=fx.ctx;
  ctx.save();ctx.globalAlpha*=Math.min(1,alpha);ctx.globalCompositeOperation=blend;ctx.translate(x,y);if(angle)ctx.rotate(angle);ctx.drawImage(c,-w/2,-h/2,w,h);ctx.restore();
}
// A piece whose base sits on the cell floor, drawn standing on (x, y) and stretched upward by `rise` (0..1).
function kitStanding(fx,frame,ramp,x,y,w,rise=1,flip=1,lean=0,alpha=1,blend='lighter'){
  if(!(rise>0))return;const c=kitCanvas(fx,frame,ramp);if(!c||!(alpha>.004))return;const ctx=fx.ctx;
  ctx.save();ctx.globalAlpha*=Math.min(1,alpha);ctx.globalCompositeOperation=blend;ctx.translate(x,y);if(lean)ctx.rotate(lean);ctx.scale(flip,rise);ctx.drawImage(c,-w/2,-w*KIT_FLOOR,w,w);ctx.restore();
}
function sweet(fx,frame,x,y,w,angle=0,alpha=1,sx=1,sy=1){
  const img=fx.art?.images?.['ur-sweets'];if(!img||!(alpha>.004)||!(w>0))return;const cw=img.naturalWidth/4,ch=img.naturalHeight/3,ctx=fx.ctx;
  ctx.save();ctx.globalAlpha*=Math.min(1,alpha);ctx.translate(x,y);if(angle)ctx.rotate(angle);ctx.scale(sx,sy);ctx.drawImage(img,frame%4*cw,Math.floor(frame/4)*ch,cw,ch,-w/2,-w/2,w,w);ctx.restore();
}
// The hero's own SD, tinted, for afterimages (re-drawn original pixels; nothing is painted onto the character).
function ghostSprite(fx,hero,direction,color){
  const h=HERO[hero],img=fx.art?.images?.[h?.art?.atlas];if(!img||typeof document==='undefined')return null;
  const cache=fx.urCache||(fx.urCache=new Map()),key=`ghost|${hero}|${direction}|${color}`;let c=cache.get(key);if(c)return c;
  const cols=h.art.columns,cell=img.naturalWidth/cols,index=h.art.directional?({down:0,up:1,left:2,right:3}[direction]??0):0,col=index%cols,row=h.art.directional?Math.floor(index/cols):h.art.row,size=192;
  c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');
  g.drawImage(img,col*cell,row*cell,cell,cell,0,0,size,size);g.globalCompositeOperation='source-atop';g.globalAlpha=.74;g.fillStyle=color;g.fillRect(0,0,size,size);
  c.foot=h.art.foot;c.scale=h.art.scale||1;cache.set(key,c);return c;
}
function drawGhost(fx,hero,x,baseY,direction,color,alpha,size=126){
  const c=ghostSprite(fx,hero,direction,color);if(!c||!(alpha>.004))return;const sz=size*c.scale,ctx=fx.ctx;
  ctx.save();ctx.globalAlpha*=alpha;ctx.drawImage(c,x-sz/2,baseY-sz*c.foot,sz,sz);ctx.globalCompositeOperation='lighter';ctx.globalAlpha*=.4;ctx.drawImage(c,x-sz/2,baseY-sz*c.foot,sz,sz);ctx.restore();
}
function line(ctx,a,b,color,width,alpha){if(!(alpha>.004))return;ctx.save();ctx.globalAlpha*=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();}
// The board darkens toward the edges, leaving a clear hole around the action.
function vignette(fx,x,y,inner,outer,color,alpha){
  if(!(alpha>.004))return;const ctx=fx.ctx,g=ctx.createRadialGradient(x,y,inner,x,y,outer);
  g.addColorStop(0,color+'00');g.addColorStop(.4,color+'99');g.addColorStop(1,color+'ff');ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=g;ctx.fillRect(0,0,720,780);ctx.restore();
}
const casterAt=(skill,i)=>skill.origin&&Math.abs(skill.origin.x-i.x)<1&&Math.abs(skill.origin.y-i.y)<1;
const stun=(fx,shake,stop)=>{if(fx.reduced)return;fx.shake=Math.max(fx.shake||0,shake);if(stop)fx.hitstop=Math.max(fx.hitstop||0,stop);};

// Board-wide mood: a colour pulse over the whole field (screen brightens, source-over darkens).
function wash(fx,color,alpha,blend='screen'){if(!(alpha>.004)||fx.reduced)return;const ctx=fx.ctx;ctx.save();ctx.globalAlpha=Math.min(1,alpha);ctx.globalCompositeOperation=blend;ctx.fillStyle=color;ctx.fillRect(0,0,720,780);ctx.restore();}
// Petals carried across the board by a wind from one side.
function petalWind(fx,seed,dir,t,alpha,n,ramp='sakura'){
  if(!(alpha>.01)||fx.reduced)return;
  for(let i=0;i<n;i++){const speed=110+hash(seed,i)*120,x0=hash(seed,i+11)*900-90,x=((x0+dir*t*speed)%900+900)%900-90,y=(hash(seed,i+23)*800+t*(26+hash(seed,i+37)*30)+Math.sin(t*2+i)*14)%800-10;
    kit(fx,KIT.petal,ramp,x,y,12+hash(seed,i+5)*8,undefined,t*(1.5+hash(seed,i+7)*2)+i,alpha*(.55+.45*hash(seed,i+3)),'source-over');}
}
// Small twinkling stars over the upper board (Luna's night).
function stars(fx,seed,alpha,n){
  if(!(alpha>.01)||fx.reduced)return;const t=fx.clock||0;
  for(let i=0;i<n;i++){const tw=.5+.5*Math.sin(t*(2+hash(seed,i)*3)+i*1.7);kit(fx,KIT.flare,'pale',40+hash(seed,i+3)*640,250+hash(seed,i+9)*420,8+hash(seed,i+5)*10,undefined,0,alpha*tw,'lighter');}
}

// ---------------------------------------------------------------------------------------------------------------------
// Cherry Prince · royal finisher. The engine locks the highest-HP enemy and strikes 0.3 s (game time) later, x2 if it burns or
// holds three divine marks. The SD wears his sword sheathed at the hip, so the cut is an iaido: the board holds its breath and
// petals ride a wind; he crouches and vanishes; one dash of light runs from his cell through the target to his afterimage past
// it; on the engine's impact the cut opens in a storm of petals; he is back in his cell with a glint at the sheath.
const cherry={
  life:()=>2.4,
  plan(fx,skill){const t=skill.targets?.[0]||skill.origin;skill.ur={uid:t.uid,lock:{x:t.x,y:t.y},p:0,seed:(skill.uid||1)*7.31,dir:t.x>=skill.origin.x?1:-1};return null;},
  progress(fx,skill){
    const u=skill.ur;if(u.impact!==undefined)return 1;
    const f=fx.s?.finishers?.find(f=>f.hero==='cherry_prince'&&f.kind==='royal'&&f.origin&&casterAt(skill,f.origin));
    if(f){u.p=clamp01(1-f.life/f.total);u.to=f.to;}
    else if((skill.total-skill.life)>1.4)u.p=1;
    return u.p;
  },
  target(fx,skill){const u=skill.ur;return u.impact!==undefined?u.at:fx.point(u.uid,u.to||u.lock);},
  finisher(fx,skill,e){
    const u=skill.ur,age=skill.total-skill.life;if(!u||u.impact!==undefined)return;
    u.impact=age;u.hit=e.type==='finisherImpact';u.at={x:e.x,y:e.y};u.boss=!!e.targetBoss;u.empowered=!!e.empowered;
    if(u.hit)stun(fx,7,.08);skill.life=Math.max(skill.life,1.2);
  },
  field(fx,skill,age){
    const u=skill.ur,p=this.progress(fx,skill),a=u.impact===undefined?-1:age-u.impact,T=this.target(fx,skill),big=u.boss?1.35:1;
    // The board holds its breath: it darkens toward the edges, clear around the target.
    vignette(fx,T.x,T.y-24,80,520,'#0b0612',fx.reduced?0:.44*easeOut(span(p,0,.35))*(a<0?1:1-span(a,.2,.6)));
    // The lock: a sakura ring closes on the target over a soft pink glow, five petals circling it.
    const lock=a<0?Math.min(1,p*5):1-span(a,0,.25);
    if(lock>0){const r=lerp(78,44,easeOut(p))*big;fx.glow('glow','#ff7eb6',T.x,T.y+2,r*2.6,.38*lock);kit(fx,KIT.ring,u.empowered&&a>=0?'gold':'sakura',T.x,T.y+6,r*2,r*.84,0,lock);
      for(let i=0;i<5;i++){const ang=(fx.clock||0)*2.4+i*Math.PI*2/5;kit(fx,KIT.petal,'sakura',T.x+Math.cos(ang)*r,T.y+6+Math.sin(ang)*r*.42,19,19,ang+1.2,lock,'source-over');}}
  },
  over(fx,skill,age){
    const u=skill.ur,p=this.progress(fx,skill),a=u.impact===undefined?-1:age-u.impact,T=this.target(fx,skill),o={x:skill.origin.x,y:skill.origin.y-34},big=u.boss?1.3:1,R=fx.reduced;
    const ramp=u.empowered?'gold':'sakura',theta=u.dir>0?-.6:Math.PI+.6,cx=T.x,cy=T.y-(u.boss?34:22),A={x:T.x+u.dir*62,y:T.y-30};
    petalWind(fx,u.seed,u.dir,age,a<0?span(p,.05,.3):1-span(a,.5,1.1),24);
    // Petals spiral into the crouching prince.
    if(a<0&&p<.5){const k=span(p,0,.45);for(let i=0;i<(R?3:9);i++){const ang=hash(u.seed,i)*6.283+k*2.6,r=lerp(96,8,easeIn(k));kit(fx,KIT.petal,'sakura',o.x+Math.cos(ang)*r,o.y+Math.sin(ang)*r*.7,15,15,ang*1.7,bell(k*1.05),'source-over');}}
    // He vanishes in a puff of petals (p 0.42-0.62).
    const puff=span(p,.42,.62);if(!R&&puff>0&&puff<1&&a<0){kit(fx,KIT.mist,'sakura',o.x,o.y+4,lerp(70,150,easeOut(puff)),undefined,puff*1.4,.6*(1-puff));for(let i=0;i<12;i++){const ang=hash(u.seed,i+20)*6.283,r=lerp(6,80,easeOut(puff));kit(fx,KIT.petal,'sakura',o.x+Math.cos(ang)*r,o.y+Math.sin(ang)*r*.7,14,14,ang*2+puff*3,(1-puff),'source-over');}}
    // The dash: one stroke of light from his cell through the target to where his afterimage stands, with fading copies of him.
    const dash=a<0?(p>=.55?1-span(p,.55,.85):0):0;
    if(dash>0){const ctx=fx.ctx;ctx.save();ctx.globalCompositeOperation='lighter';line(ctx,o,A,'#ff5fa0',24,.38*dash);line(ctx,o,A,'#ffc8e0',8,.85*dash);line(ctx,o,A,'#ffffff',3.2,dash);ctx.restore();
      if(!R)for(const k of [.3,.55,.8])drawGhost(fx,'cherry_prince',lerp(o.x,A.x,k),lerp(o.y+40,A.y+36,k),u.dir>0?'right':'left','#ff9cc8',.3*dash*k);
      fx.glow('glow','#ffffff',cx,cy,170*big,.6*span(p,.55,.6)*(1-span(p,.6,.75)));}
    // The cut mark on the target: a hairline that waits for the engine's impact.
    const L=320*big,w=L/1.27;
    const drawLine=(alpha,stretch=1,spread=0,width=1)=>{const ctx=fx.ctx,c=kitCanvas(fx,KIT.blade,ramp);if(!c||!(alpha>.004))return;for(const side of spread?[-1,1]:[0]){ctx.save();ctx.translate(cx-Math.sin(theta)*spread*side,cy+Math.cos(theta)*spread*side);ctx.rotate(theta);ctx.scale(stretch,width);ctx.rotate(Math.PI/4);
      ctx.globalAlpha*=Math.min(1,alpha);ctx.globalCompositeOperation='lighter';ctx.drawImage(c,-w/2,-w/2,w,w);ctx.restore();}};
    if(a<0&&p>=.55)drawLine(lerp(1,.35,span(p,.58,.7)),lerp(.4,1,easeOut(span(p,.55,.6))));
    // His afterimage stands just past the target.
    const ghostA=a<0?(p>=.55?.78*span(p,.55,.6):0):.78*(1-span(a,.1,.45));
    if(ghostA>0)drawGhost(fx,'cherry_prince',A.x,T.y+6,u.dir>0?'right':'left','#ff9cc8',ghostA);
    if(a<0)return;
    if(u.hit){
      // The cut opens: the line flares and splits, a bloom of light, a petal storm, and a pink pulse over the board.
      wash(fx,u.empowered?'#ffd77a':'#ff9cc8',.2*(1-span(a,0,.35)));
      drawLine(1.2*(1-span(a,0,.34)),1.12,2+14*easeOut(span(a,0,.3)),1.3);
      if(u.empowered)drawLine(.95*(1-span(a,0,.3)),1.04,9+16*easeOut(span(a,0,.3)),.8);
      kit(fx,KIT.flare,ramp,cx,cy,300*big*easeOut(span(a,0,.06)),undefined,theta,1-span(a,.05,.32));
      if(!R)fx.glow('glow','#ffffff',cx,cy,260*big,.6*(1-span(a,0,.14)));
      const ring=easeOut(span(a,0,.4));kit(fx,KIT.ring,ramp,cx,T.y+6,(90+290*ring)*big,(90+290*ring)*.42*big,0,.85*(1-ring));
      const n=R?10:32;for(let i=0;i<n;i++){const ang=hash(u.seed,i+40)*6.283,v=(170+hash(u.seed,i+80)*260)*big,k=span(a,0,1.1),d=v*(1-Math.exp(-k*3))/3;
        kit(fx,KIT.petal,u.empowered&&i%2?'gold':'sakura',cx+Math.cos(ang)*d,cy+Math.sin(ang)*d*.8+110*k*k,16+hash(u.seed,i)*9,undefined,ang*2+k*7,(1-k),'source-over');}
    }else{
      // The target fell to someone else first: the line only glints where it stood.
      drawLine(.6*(1-span(a,0,.3)));for(let i=0;i<8;i++){const ang=hash(u.seed,i+60)*6.283,k=span(a,0,.6);kit(fx,KIT.petal,'sakura',cx+Math.cos(ang)*60*k,cy+Math.sin(ang)*40*k,14,14,ang+k*4,(1-k)*.8,'source-over');}
    }
    // Back in his cell: petals gather, then a glint where the sheath hangs.
    const back=span(a,.12,.42);if(back>0&&back<1)for(let i=0;i<(R?3:9);i++){const ang=hash(u.seed,i+100)*6.283,r=lerp(76,6,easeOut(back));kit(fx,KIT.petal,'sakura',o.x+Math.cos(ang)*r,o.y+Math.sin(ang)*r*.7,13,13,ang,bell(back),'source-over');}
    const click=span(a,.32,.54);if(click>0&&click<1)kit(fx,KIT.flare,'sakura',skill.origin.x+u.dir*10,skill.origin.y+6,52*bell(click),undefined,.4,bell(click));
  },
  body(fx,skill,age){
    const u=skill.ur,p=this.progress(fx,skill),a=u.impact===undefined?-1:age-u.impact;
    const crouch=a<0?easeOut(span(p,0,.3)):1-span(a,.15,.35),hide=fx.reduced?0:a<0?span(p,.45,.55):1-span(a,.15,.35);
    return {dy:4*crouch,angle:u.dir*.08*crouch,squash:1-.06*crouch,alpha:1-hide};
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// Luna · execution steps. The engine strikes up to five enemies (boss first, then the toughest), each execution kill adding
// one more (at most ten). Night falls over the board; she vanishes into the veil; a violet afterimage steps to each target in the
// engine's order, a moon cut lands on each, executions under a pale full moon, then she is back.
const luna={
  life:skill=>skill.ur.end+.8,
  plan(fx,skill){
    const t=skill.targets||[],n=t.length,step=n>1?Math.min(.15,.95/(n-1)):0,first=.24;
    skill.ur={n,step,first,end:first+Math.max(0,n-1)*step+.2,seed:(skill.uid||1)*3.17};
    const m=new Map();t.forEach((q,i)=>m.set(q.uid,first+i*step+.03));return m;
  },
  stepAt:(u,i)=>u.first+i*u.step,
  point(fx,q){const p=fx.point(q.uid,q);return {x:p.x,y:p.y};},
  field(fx,skill,age){
    const u=skill.ur,night=span(age,.02,.22)*(1-span(age,u.end,u.end+.45));
    vignette(fx,360,430,140,560,'#07041a',fx.reduced?0:.52*night);wash(fx,'#2a1650',.22*night,'source-over');
    if(!fx.reduced)fx.glow('glow','#b9a8ff',360,300,820,.2*night);
  },
  over(fx,skill,age){
    const u=skill.ur,t=skill.targets||[],o={x:skill.origin.x,y:skill.origin.y-36},R=fx.reduced,ctx=fx.ctx;
    stars(fx,u.seed,span(age,.05,.3)*(1-span(age,u.end,u.end+.45))*.9,16);
    const veil=span(age,.03,.45);if(!R&&veil>0&&veil<1)kit(fx,KIT.mist,'moon',o.x,o.y,lerp(80,180,easeOut(veil)),undefined,age*1.2,.9*(1-veil));
    let prev=o;
    for(let i=0;i<t.length;i++){
      const at=this.stepAt(u,i),q=t[i],P=this.point(fx,q),head={x:P.x,y:P.y-22},boss=fx.enemies?.get(q.uid)?.enemy?.boss;
      // The step: a moonlit thread from her last position, drawn in as she moves and fading behind her.
      const k=span(age,at-.07,at),fade=1-span(age,at+.05,at+.42);if(k>0&&fade>0){const end={x:lerp(prev.x,head.x,k),y:lerp(prev.y,head.y,k)};ctx.save();ctx.globalCompositeOperation='lighter';line(ctx,prev,end,'#8a5cff',7,.36*fade);line(ctx,prev,end,'#f1e8ff',1.8,.9*fade);ctx.restore();}
      // Her afterimage arrives beside the target, facing it.
      const dx=head.x-prev.x,dy=head.y-prev.y,len=Math.hypot(dx,dy)||1,ga=.72*span(age,at-.05,at-.01)*(1-span(age,at+.06,at+.42));
      if(ga>0)drawGhost(fx,'luna',P.x-dx/len*34,P.y+4-dy/len*10,dx>=0?'right':'left','#9b6bff',ga);
      if(age>=at){
        const c=age-at,big=boss?1.3:1,exec=!!q.execute;
        if(exec){fx.glow('glow','#d9ccff',head.x,head.y,210*big,.5*(1-span(c,.1,.5)));kit(fx,KIT.moon,'pale',head.x,head.y,lerp(80,112,easeOut(span(c,0,.16)))*big,undefined,0,.95*(1-span(c,.2,.6)),'screen');}
        const s=lerp(.8,1.06,easeOut(span(c,0,.08)))*(exec?1.2:1)*big,ca=1-span(c,.08,.34);
        kit(fx,KIT.crescent,'moon',head.x,head.y,132*s,undefined,.75,ca);kit(fx,KIT.crescent,'moon',head.x,head.y,132*s,undefined,.75+Math.PI*1.5,ca);
        kit(fx,KIT.flare,exec?'pale':'moon',head.x,head.y,(exec?110:74)*big*easeOut(span(c,0,.05)),undefined,.3,1-span(c,.03,.22));
        if(c<.02&&!q.shook){q.shook=true;stun(fx,i===t.length-1?6:exec?3:1.5,i===t.length-1?.07:0);}
      }
      prev=head;
    }
    // The last cut: a violet breath over the board. Then she is back in her cell.
    const last=age-this.stepAt(u,Math.max(0,t.length-1));if(t.length&&last>=0)wash(fx,'#9b7bff',.12*(1-span(last,0,.3)));
    const back=span(age,u.end,u.end+.32);if(!R&&back>0&&back<1)kit(fx,KIT.mist,'moon',o.x,o.y,lerp(160,70,easeOut(back)),undefined,-age,.75*(1-back));
  },
  body(fx,skill,age){const u=skill.ur;if(fx.reduced)return null;const hide=span(age,.06,.18)*(1-span(age,u.end,u.end+.15));return {alpha:1-hide,dy:-2*hide};},
};

// ---------------------------------------------------------------------------------------------------------------------
// Frost Witch · Edict of the Ice Palace. The engine strikes everyone at the cast and starts the winter. The palace seal stamps
// onto the centre of the board with a cold flash over the whole field, a frost ring runs outward, ice erupts along the road as
// it passes and each enemy is struck when the ring reaches it. For the winter the road keeps its rime, frost creeps in from the
// corners of the board and snow falls (the duration itself stays on the HUD timer).
const FROST_CENTRE=cellPoint(12),FROST_SPEED=1100,FROST_START=.32;
const ROAD=Array.from({length:30},(_,j)=>{const q=pathPoint((j+.5)*PATH_LENGTH/30);return {x:q.x,y:q.y,at:FROST_START+Math.hypot(q.x-FROST_CENTRE.x,q.y-FROST_CENTRE.y)/FROST_SPEED};});
const frostAt=q=>FROST_START+Math.hypot(q.x-FROST_CENTRE.x,q.y-FROST_CENTRE.y)/FROST_SPEED;
const frost={
  life:()=>1.8,
  plan(fx,skill){skill.ur={seed:(skill.uid||1)*5.13};const m=new Map();for(const q of skill.targets||[])m.set(q.uid,frostAt(q));return m;},
  field(fx,skill,age){
    const u=skill.ur,C=FROST_CENTRE,ctx=fx.ctx,R=fx.reduced;
    // The palace seal stamps down (0.05-0.32 s), pulses once on landing and fades.
    const stamp=span(age,.05,FROST_START),land=age-FROST_START,pulse=land>=0?1+.06*bell(span(land,0,.18)):1,seal=(age<FROST_START?stamp:1-span(age,FROST_START+.08,1))*.95;
    if(seal>0){const s=380*lerp(1.35,1,easeIn(stamp))*pulse;fx.glow('rays','#bfe9ff',C.x,C.y,s*1.2,.35*seal,age*.3);fx.ultimate('frost_witch',C.x,C.y,s,s,0,seal);}
    // The frost ring runs to the road.
    const r=FROST_SPEED*(age-FROST_START);
    if(r>0&&r<540){const k=r/540;ctx.save();const g=ctx.createRadialGradient(C.x,C.y,Math.max(0,r-110),C.x,C.y,r);g.addColorStop(0,'#bfe9ff00');g.addColorStop(1,'#bfe9ff44');ctx.fillStyle=g;ctx.globalAlpha=1-k;ctx.beginPath();ctx.arc(C.x,C.y,r,0,Math.PI*2);ctx.fill();
      ctx.globalCompositeOperation='lighter';ctx.strokeStyle='#e2f7ff';ctx.lineWidth=12*(1-k)+2;ctx.globalAlpha=.9*(1-k);ctx.stroke();ctx.restore();}
    // Ice erupts along the road as the ring passes, then leaves rime.
    for(const [j,q] of ROAD.entries()){
      if(R&&j%2)continue;const c=age-q.at;if(c<0)continue;
      kit(fx,KIT.rime,'frost',q.x,q.y,74,34,hash(u.seed,j)*6.28,.36*span(c,0,.3),'lighter');
      if(!R&&c<.4)kit(fx,KIT.mist,'frost',q.x,q.y-10,lerp(30,90,easeOut(c/.4)),undefined,j,.45*(1-c/.4));
      const grow=easeBack(span(c,0,.12)),out=1-span(c,.45,.85);
      if(out>0)kitStanding(fx,KIT.spikes,'ice',q.x+(hash(u.seed,j+30)-.5)*16,q.y+4,(66+hash(u.seed,j+60)*30),grow,hash(u.seed,j+90)>.5?1:-1,(hash(u.seed,j+120)-.5)*.3,out);
    }
    // A tall spike rises behind every struck enemy.
    for(const q of skill.targets||[]){const c=age-frostAt(q);if(c<0||c>.75)continue;const P=fx.point(q.uid,q),boss=fx.enemies?.get(q.uid)?.enemy?.boss;
      kitStanding(fx,KIT.spike,'ice',P.x,P.y+6,(boss?160:126),easeBack(span(c,0,.1)),1,0,1-span(c,.4,.75));}
  },
  over(fx,skill,age){
    const u=skill.ur,C=FROST_CENTRE,R=fx.reduced,o={x:skill.origin.x,y:skill.origin.y-40};
    // The witch raises the cold: a glint at her hand.
    if(age<.5)kit(fx,KIT.flare,'ice',o.x+12,o.y-6,84*bell(span(age,.04,.5)),undefined,age*2,bell(span(age,.04,.5)));
    // The seal lands: a cold flash over the whole field.
    const land=age-FROST_START;if(land>=0&&land<.5){wash(fx,'#bfe9ff',.3*(1-span(land,0,.45)));if(!R)fx.glow('glow','#e6f8ff',C.x,C.y,460,.55*(1-land/.3));kit(fx,KIT.flare,'ice',C.x,C.y,300*easeOut(land/.06),undefined,0,1-span(land,.05,.3));if(land<.02&&!u.landed){u.landed=true;stun(fx,5,.06);}}
    // Each enemy shatters frost as it is struck.
    for(const q of skill.targets||[]){const c=age-frostAt(q);if(c<0||c>.45)continue;const P=fx.point(q.uid,q);kit(fx,KIT.shatter,'ice',P.x,P.y-28,lerp(60,140,easeOut(span(c,0,.3))),undefined,hash(u.seed,q.uid||1)*6.28,1-span(c,.12,.45));}
    if(!R)snow(fx,u.seed,Math.min(1,span(age,.4,.8))*(1-span(age,1.4,1.8)),16);
  },
  body(fx,skill,age){const k=bell(span(age,0,.6));return {dy:-6*k,squash:1+.04*k};},
  persistent(fx,s){
    const left=s.buffs?.winter||0;if(!(left>0))return;const total=s.buffTotals?.winter||left,k=Math.min(1,(total-left)/.9)*Math.min(1,left/.8);
    for(const [j,q] of ROAD.entries())kit(fx,KIT.rime,'frost',q.x,q.y,74,34,hash(7,j)*6.28,.3*k,'lighter');
  },
  persistentOver(fx,s,skills=[]){
    const left=s.buffs?.winter||0;if(!(left>0)||fx.reduced)return;const total=s.buffTotals?.winter||left,k=Math.min(1,(total-left)/.9)*Math.min(1,left/.8);
    // Frost creeping in from the corners of the board, like a window in winter.
    for(const [x,y,a] of [[0,0,.6],[720,0,2.2],[0,780,-.6],[720,780,3.8]])kit(fx,KIT.rime,'frost',x,y,300,300,a,.32*k,'lighter');
    // The cast draws its own snow; the winter's snowfall takes over when it has faded.
    if(!skills.some(k=>k.hero==='frost_witch'&&k.life>0))snow(fx,11,.75*k,12);
  },
};
function snow(fx,seed,alpha,n){
  if(!(alpha>.01))return;const t=fx.clock||0;
  for(let i=0;i<n;i++){const x=(hash(seed,i)*720+Math.sin(t*.7+i)*24+720)%720,y=(hash(seed,i+50)*780+t*(26+hash(seed,i+90)*22))%780;kit(fx,KIT.shard,'frost',x,y,10+hash(seed,i+7)*8,undefined,t*.8+i,alpha*(.5+hash(seed,i+3)*.5),'lighter');}
}

// ---------------------------------------------------------------------------------------------------------------------
// Harmonious · Dessert Ensemble (+22% power and speed to every ally for 10 s; the duration is on the HUD timer, so nothing
// lingers on the units). A cake stand of six different desserts rises in the middle of the board; it pops in a pastel wave with
// sugar stars raining over the whole field, and every ally catches a dessert. Neighbours always get different ones (cell
// colouring (row*2+col) mod 6), so a full board reads as a table of different sweets without 25 separate paintings.
const STAND={x:360,y:476,size:214};
// Six places on the three plates, measured on the packed stand (top, middle pair, bottom three), relative to its base.
const PLATES=[[0,-150,34],[-28,-104,38],[28,-104,38],[-50,-50,42],[0,-46,44],[50,-50,42]];
const dessertOf=index=>DESSERTS[((Math.floor(index/5)*2)+index%5)%6];
const harmony={
  life:()=>2.2,
  plan(fx,skill){
    // The cast lists every ally by its cell point; the cell decides the dessert (nothing is read from a previous frame).
    const allies=(skill.targets||[]).map(q=>({...q,index:cellAt(q.x,q.y)})).filter(q=>q.index>=0);
    allies.sort((a,b)=>Math.hypot(a.x-STAND.x,a.y-STAND.y)-Math.hypot(b.x-STAND.x,b.y-STAND.y));
    skill.ur={seed:(skill.uid||1)*9.71,allies:allies.map((q,i)=>({...q,dessert:dessertOf(q.index),launch:.44+.18*(allies.length>1?i/(allies.length-1):0)}))};
    return null;
  },
  field(fx,skill,age){const k=bell(span(age,.12,.85));if(k>0)fx.glow('glow','#ffb6d4',STAND.x,STAND.y-95,340,.45*k);},
  over(fx,skill,age){
    const u=skill.ur,R=fx.reduced,o={x:skill.origin.x,y:skill.origin.y-40},spot=fx.s?.buffSpotlight?.harmony;
    // Her cast: a puff of her own cotton candy and gold dust.
    const puff=span(age,0,.5);if(puff<1){sweet(fx,SWEET.cotton,o.x-6,o.y-8,lerp(44,78,easeOut(puff)),-.2,.95*(1-span(puff,.4,1)));sweet(fx,SWEET.stardust,o.x,o.y,lerp(70,140,easeOut(puff)),age,(1-puff));}
    // The cake stand rises, holds its six desserts, and pops at 0.42 s.
    const rise=easeBack(span(age,.12,.34)),gone=span(age,.44,.72);
    if(rise>0&&gone<1){const s=STAND.size*lerp(.6,1,rise),by=STAND.y+(1-rise)*30,a=(1-gone)*Math.min(1,rise*1.5),k=s/STAND.size;
      sweet(fx,SWEET.stand,STAND.x,by-s*(SWEET_FLOOR-.5),s,0,a);
      const launched=new Set(u.allies.filter(q=>age>=q.launch).map(q=>q.dessert));
      PLATES.forEach(([dx,dy,w],i)=>{if(!launched.has(DESSERTS[i]))sweet(fx,DESSERTS[i],STAND.x+dx*k,by+dy*k,w*k,0,a);});}
    // The pop: a pastel wave over the whole field, sugar stars raining down, confetti.
    const pop=age-.42;
    if(pop>=0){
      wash(fx,'#ffd1e6',.28*(1-span(pop,0,.7)));
      if(pop<.5){if(!R)fx.glow('glow','#fff3c8',STAND.x,STAND.y-95,300,.65*(1-pop/.3));kit(fx,KIT.ring,'sugar',STAND.x,STAND.y-85,lerp(90,640,easeOut(pop/.45)),undefined,0,.85*(1-span(pop,.08,.45)));sweet(fx,SWEET.stardust,STAND.x,STAND.y-95,lerp(140,300,easeOut(pop/.35)),pop,1-span(pop,.1,.45));}
      if(!R){for(let i=0;i<26;i++){const t0=hash(u.seed,i+200)*.4,k=span(pop,t0,t0+1.2);if(k<=0||k>=1)continue;const x=20+hash(u.seed,i+230)*680,y=-20+k*(820+hash(u.seed,i+260)*120);
          kit(fx,KIT.flare,i%3?'sugar':'gold',x,y,14+hash(u.seed,i+290)*12,undefined,k*4,bell(k)*.95,'lighter');}
        const ctx=fx.ctx;ctx.save();for(let i=0;i<30;i++){const t0=hash(u.seed,i+320)*.3,k=span(pop,t0,t0+1.1);if(k<=0||k>=1)continue;const x=hash(u.seed,i+350)*720+Math.sin(k*6+i)*20,y=-20+k*800;
          ctx.globalAlpha=bell(k)*.9;ctx.fillStyle=['#ff9ec8','#9ce3c5','#ffe27a','#ffffff','#c9b4ff'][i%5];ctx.save();ctx.translate(x,y);ctx.rotate(k*9+i);ctx.fillRect(-4,-1.6,8,3.2);ctx.restore();}ctx.restore();
        for(let i=0;i<10;i++){const ang=-Math.PI/2+(hash(u.seed,i)-.5)*2.8,v=160+hash(u.seed,i+9)*170,k=span(pop,0,.55);if(k<=0||k>=1)continue;sweet(fx,i%2?SWEET.strawberry:SWEET.macaron,STAND.x+Math.cos(ang)*v*k,STAND.y-95+Math.sin(ang)*v*k+280*k*k,26,ang+k*6,1-span(k,.65,1));}}
    }
    // Every ally catches a dessert: an arc from its plate, a squash on landing, sparkles, then sugar dust.
    for(const q of u.allies){
      const fly=span(age,q.launch,q.launch+.3);if(fly<=0)continue;
      const lead=spot!==undefined&&q.uid===spot,plate=PLATES[DESSERTS.indexOf(q.dessert)],from={x:STAND.x+plate[0],y:STAND.y+plate[1]},to={x:q.x,y:q.y-80},w=(lead?70:spot!==undefined?50:58),landed=age-(q.launch+.3);
      if(fly<1){const h=80+Math.hypot(to.x-from.x,to.y-from.y)*.2,x=lerp(from.x,to.x,fly),y=lerp(from.y,to.y,fly)-Math.sin(Math.PI*fly)*h;sweet(fx,q.dessert,x,y,w*lerp(.8,1,fly),(R?0:Math.sin(fly*6)*.35),1);continue;}
      if(landed<.6){const sq=landed<.12?lerp(1.32,1,easeOut(landed/.12)):1,bob=R?0:Math.sin(landed*10)*1.5,out=1-span(landed,.4,.6);
        kit(fx,KIT.flare,lead?'gold':'sugar',to.x,to.y,(lead?96:70)*bell(span(landed,0,.25)),undefined,.4,1);
        sweet(fx,q.dessert,to.x,to.y+bob,w,0,out,1/sq,sq);
        if(landed>.4){const k=span(landed,.4,.6);sweet(fx,SWEET.stardust,to.x,to.y+8,lerp(36,84,k),k,(1-k));}}
    }
  },
  body(fx,skill,age){if(fx.reduced)return null;const a=bell(span(age,0,.13)),b=bell(span(age,.14,.27));return {dy:-(a*7+b*5),squash:1+.05*(a+b)};},
};

export const UR_SPECS=Object.freeze({cherry_prince:cherry,luna,frost_witch:frost,harmonious:harmony});
const NEEDS=Object.freeze({harmonious:['ur-kit','ur-sweets']});
// A sequence runs only with its art loaded; otherwise the previous visuals stay (same fallback rule as Ragnarok).
export function urReady(fx,hero){const spec=UR_SPECS[hero];return !!spec&&(NEEDS[hero]||['ur-kit']).every(id=>fx.art?.images?.[id]);}
export function urSpec(fx,skill){return skill&&skill.kind!=='dream'&&urReady(fx,skill.hero)?UR_SPECS[skill.hero]:null;}

// ---------------------------------------------------------------------------------------------------------------------
// Basic-attack contact layer, shared by every companion. One small flash where the hit lands, in the hero's own ramp; rarity
// adds a little on top (R two shards, SR a thin ring, UR a rising glint), never more than a hand's width at game size.
export const CONTACT_LIFE=.16;
export function contactEffect(e){
  const h=HERO[e.hero];if(!h||e.ground)return null;const rarity=h.hidden?'UR':h.rarity;
  return {type:'contact',hero:e.hero,x:e.x,y:e.y-18,angle:e.angle||0,rank:{C:0,R:1,SR:2,UR:3}[rarity]??0,life:CONTACT_LIFE,total:CONTACT_LIFE};
}
export function drawContact(fx,e,t,clarity=1){
  if(!fx.art?.images?.['ur-kit'])return true;const ramp='hero:'+e.hero,a=clarity*(1-t)*(1-t),r=e.rank;
  kit(fx,KIT.flare,ramp,e.x,e.y,(30+r*4)*lerp(.7,1.1,easeOut(span(t,0,.35))),undefined,e.angle,.9*a);
  if(r>=1&&!fx.reduced)for(const side of r>=3?[-1,0,1]:[-1,1]){const ang=e.angle+side*.55,d=6+20*easeOut(t);kit(fx,KIT.shard,ramp,e.x+Math.cos(ang)*d,e.y+Math.sin(ang)*d,10,undefined,ang+Math.PI/4,a);}
  if(r>=2){const k=easeOut(t);kit(fx,KIT.ring,ramp,e.x,e.y,14+26*k,(14+26*k)*.6,0,.55*clarity*(1-t));}
  if(r>=3&&!fx.reduced){const k=span(t,.15,1);kit(fx,KIT.flare,'gold',e.x+8,e.y-10-14*k,12*bell(k),undefined,0,bell(k)*clarity);}
  return true;
}
