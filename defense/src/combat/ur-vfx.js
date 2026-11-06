// Sequenced ultimates and the shared basic-attack contact layer. Pass 21: Cherry Prince, Luna, Frost Witch, Harmonious. Pass 22:
// Jasmine, Queen, Time Magician, Galaxy Whale, Time Ruler. Pass 3: Cinderella, Venom, Doom, Rumi and her dream form, Red Dragon, Aurora,
// Shooting Star Boy (2026-11-06; docs/plans/VFX_DIRECTION_PLAN.md, how to add one: docs/VFX_SEQUENCE_GUIDE.md, art:
// docs/art/ur-vfx-20261106, ur-vfx2-20261106 and ur-vfx3-20261106).
//
// Assets are one small library, not a sheet per hero:
//   ur-kit    12 monochrome luminance pieces (blade flash, crescent, ring, mist, shard, flare, petal, ice spikes, spike, moon,
//             rime, shatter). Each is recoloured at runtime by a gradient map (white core -> hero colour -> dark rim), so the same
//             256-px cell is a sakura cut for Cherry Prince, a moon cut for Luna and a frost spike for the Frost Witch.
//   ur-kit2   16 pieces (KIT2): ten luminance pieces (holy circle, wing, feather, clock face, clock hand, light pillar, star whale,
//             galaxy, gear, hourglass) and six gray objects with their own alpha (glass slipper, rose, rose petal, thorn vine, coin,
//             crown), recoloured by the same maps.
//   ur-kit3   14 pieces (KIT3): ten luminance pieces (butterfly, flame, fire breath, shooting star, hand mirror, glass cracks, sun,
//             crescent moon, star, bell) and four gray objects (spider lily, envelope, dagger, root). The envelope cell is unused
//             since Doom's deal became a coin toss (owner review, 2026-11-07).
//   ur-sweets Harmonious's painted desserts, cake stand and sugar dust (colour cannot come from a ramp).
// The engine still resolves damage at its own moment (instantly at the cast, or at the finisher's impact). These sequences say
// when each target is struck on screen (plan); Renderer holds the cast's numbers, deaths and HP bars until then.
import {HERO,TRANSFORM_ART} from '../content.js';
import {cellPoint,cellAt,pathPoint,PATH_LENGTH,unitForm,attackDirection} from './engine.js';

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

// Gradient maps: brightness 0..1 -> colour.
// Palette v2 (owner review of pass 1: the ultimates read as "translucent silver"). The generated pieces are mostly bright, so a
// straight brightness ramp dropped most of their pixels into its pale top. A tone curve now moves the body of each light piece into
// the hero's saturated band, the ramps are deeper, and white is kept for the hottest core. Silver stays only where it is the
// concept (Luna's full moon, the Frost Witch's rime). v1 is kept for the review page's comparison (fx.palette='v1').
const RAMPS_V1=Object.freeze({
  sakura:[[0,'#5a1036'],[.28,'#e0408a'],[.55,'#ff9cc8'],[.8,'#ffe0ee'],[1,'#ffffff']],
  gold:[[0,'#4a2a00'],[.28,'#d99a1c'],[.55,'#ffd25e'],[.8,'#fff2c4'],[1,'#ffffff']],
  moon:[[0,'#24104a'],[.28,'#7448d6'],[.55,'#b08cff'],[.8,'#e8deff'],[1,'#ffffff']],
  pale:[[0,'#262048'],[.35,'#9088d8'],[.65,'#dcd6ff'],[.85,'#f5f2ff'],[1,'#ffffff']],
  ice:[[0,'#0a2440'],[.28,'#2a86d6'],[.55,'#6fd0ff'],[.8,'#d8f4ff'],[1,'#ffffff']],
  frost:[[0,'#1a3048'],[.4,'#9fd8f4'],[.75,'#eaf8ff'],[1,'#ffffff']],
  sugar:[[0,'#4a1028'],[.28,'#ff6aa6'],[.55,'#ffb6d4'],[.8,'#fff0c8'],[1,'#ffffff']],
  holy:[[0,'#4a3008'],[.3,'#d9a83c'],[.6,'#ffe6a5'],[.85,'#fffaf0'],[1,'#ffffff']],
  midnight:[[0,'#16062c'],[.3,'#7a2ab0'],[.55,'#d86ad8'],[.8,'#ffd0f4'],[1,'#ffffff']],
  cosmos:[[0,'#0a0a30'],[.28,'#3a4ab8'],[.5,'#7a8cf0'],[.72,'#c8b8ff'],[.9,'#f4f0ff'],[1,'#ffffff']],
  chrono:[[0,'#1a1440'],[.3,'#6a5cc8'],[.55,'#c4bcf4'],[.8,'#efeaff'],[1,'#ffffff']],
});
const RAMPS=Object.freeze({
  sakura:[[0,'#3a0420'],[.3,'#c8125e'],[.55,'#ff4f9a'],[.78,'#ff9cc8'],[.93,'#ffe0ee'],[1,'#ffffff']],
  gold:[[0,'#3a1e00'],[.3,'#c07a08'],[.55,'#ffb72e'],[.78,'#ffdc7a'],[.93,'#fff4cc'],[1,'#ffffff']],
  moon:[[0,'#1a0838'],[.3,'#5a2ac0'],[.55,'#9b6bff'],[.78,'#cdb4ff'],[.93,'#efe6ff'],[1,'#ffffff']],
  pale:RAMPS_V1.pale,
  ice:[[0,'#06203a'],[.3,'#1a6cd0'],[.55,'#3fb4ff'],[.78,'#a8e4ff'],[.93,'#e6f8ff'],[1,'#ffffff']],
  frost:RAMPS_V1.frost,
  sugar:[[0,'#4a0a28'],[.3,'#ff4f96'],[.55,'#ff8fc0'],[.78,'#ffc8e0'],[.93,'#fff2c8'],[1,'#ffffff']],
  // Pass 22. Object pieces read these by their gray shading: the dark end is the shadow, the top the highlight.
  holy:[[0,'#3a2204'],[.3,'#c88a1c'],[.55,'#ffcc4a'],[.78,'#ffe9a8'],[.93,'#fffaf0'],[1,'#ffffff']],
  rose:[[0,'#2a0410'],[.25,'#8a0c26'],[.5,'#e01c44'],[.72,'#ff6a86'],[.9,'#ffd0d8'],[1,'#ffffff']],
  thorn:[[0,'#120206'],[.35,'#3e0a18'],[.6,'#8a1a32'],[.82,'#e0607a'],[1,'#ffd8e0']],
  midnight:[[0,'#16042c'],[.3,'#8a1ab0'],[.55,'#e04ad8'],[.78,'#ff9ef0'],[.93,'#ffe0f8'],[1,'#ffffff']],
  glass:[[0,'#1a1040'],[.35,'#7a5ae0'],[.65,'#d8c8ff'],[.88,'#f6f0ff'],[1,'#ffffff']],
  cosmos:[[0,'#04062a'],[.3,'#2a3ab8'],[.55,'#5a78f0'],[.78,'#a8b4ff'],[.93,'#e8ecff'],[1,'#ffffff']],
  chrono:[[0,'#140e3a'],[.3,'#5040c0'],[.55,'#9a8cf0'],[.78,'#d4ccff'],[.93,'#f2f0ff'],[1,'#ffffff']],
  // Pass 3. lily, root, shadow and blade colour objects (their gray shading): dark bodies with a coloured sheen.
  miracle:[[0,'#081040'],[.35,'#2a50d8'],[.55,'#5a8cff'],[.72,'#ff6ab8'],[.88,'#ffc4e4'],[1,'#ffffff']],
  lily:[[0,'#030105'],[.5,'#0e0616'],[.72,'#2a0e3a'],[.88,'#6a2a88'],[.96,'#c890e8'],[1,'#f0e0ff']],
  toxic:[[0,'#021a08'],[.3,'#168a30'],[.55,'#52d04a'],[.78,'#b4f088'],[.93,'#ecffd8'],[1,'#ffffff']],
  root:[[0,'#010302'],[.45,'#081008'],[.7,'#16261a'],[.88,'#2e5030'],[1,'#7ac068']],
  shadow:[[0,'#020104'],[.6,'#0c0812'],[.82,'#221a30'],[.94,'#5a4a70'],[1,'#c8b8e0']],
  blade:[[0,'#140208'],[.45,'#3a0a16'],[.7,'#8a1426'],[.88,'#e0303e'],[1,'#ffb0b4']],
  blood:[[0,'#1a0006'],[.3,'#8a0a1e'],[.55,'#e01a34'],[.78,'#ff6a72'],[.93,'#ffd0d4'],[1,'#ffffff']],
  fire:[[0,'#2a0400'],[.3,'#c02a08'],[.55,'#ff6a1a'],[.78,'#ffb84a'],[.93,'#fff0c0'],[1,'#ffffff']],
  quake:[[0,'#0e0c04'],[.3,'#3a3412'],[.5,'#5e8a18'],[.7,'#a6d84a'],[.86,'#e6f6a8'],[1,'#ffffff']],
  dust:[[0,'#140e06'],[.45,'#5a4a30'],[.75,'#a8987a'],[.92,'#e8dcc4'],[1,'#fff8ec']],
  comet:[[0,'#04203a'],[.3,'#1a86d0'],[.55,'#56ccff'],[.78,'#b8eeff'],[.93,'#fff6d8'],[1,'#ffffff']],
  prism:[[0,'#12063a'],[.3,'#6a2ad8'],[.5,'#c050f0'],[.7,'#ff8ad8'],[.85,'#90e0ff'],[.95,'#e8fbff'],[1,'#ffffff']],
  dream:[[0,'#042a3a'],[.3,'#18a0c8'],[.55,'#64dcf0'],[.78,'#c4f4ff'],[.93,'#f4feff'],[1,'#ffffff']],
  dreamMoon:[[0,'#0a1640'],[.3,'#3a62d8'],[.55,'#7ab0ff'],[.78,'#c8e2ff'],[.93,'#f0f8ff'],[1,'#ffffff']],
  dreamStar:[[0,'#3a0a30'],[.3,'#e04a9a'],[.55,'#ff9ad0'],[.78,'#ffe0a0'],[.93,'#fff8e0'],[1,'#ffffff']],
});
// v2 tone curve for light pieces (brightness -> ramp position); objects keep their own shading.
const TONE=Uint8Array.from({length:256},(_,i)=>Math.round(255*Math.pow(i/255,2)));
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
// Pass 22 kit (ur-kit2, 256-px cells 4x4). Light pieces are white with alpha = brightness like ur-kit; the six objects carry their
// shading as gray with the image tool's own alpha, and the same gradient maps colour that gray (a rose turns crimson, a coin gold).
export const KIT2=Object.freeze({circle:0,wing:1,feather:2,clock:3,hand:4,pillar:5,slipper:6,rose:7,petal:8,vine:9,coin:10,crown:11,whale:12,galaxy:13,gear:14,hourglass:15});
const KIT2_OBJECT=new Set([KIT2.slipper,KIT2.rose,KIT2.petal,KIT2.vine,KIT2.coin,KIT2.crown]);
const KIT2_SMALL=new Set([KIT2.feather,KIT2.petal,KIT2.coin,KIT2.hourglass]);
// The clock hand's hub sits this far down its cell and the hand reaches this far above the hub (measured on the packed cell).
const HAND_PIVOT=.836,HAND_REACH=.785;
// One recoloured canvas per (sheet, piece, ramp), built once.
function kitCanvas(fx,frame,ramp,sheet='ur-kit'){
  const img=fx.art?.images?.[sheet];if(!img||typeof document==='undefined')return null;
  const v1=fx.palette==='v1',cache=fx.urCache||(fx.urCache=new Map()),key=(v1?'v1|':'')+sheet+'|'+frame+'|'+ramp;let c=cache.get(key);if(c)return c;
  const stops=(v1?RAMPS_V1[ramp]:null)||RAMPS[ramp]||(ramp.startsWith('hero:')?heroStops(ramp.slice(5)):null);if(!stops)return null;
  const objects=sheet==='ur-kit2'?KIT2_OBJECT:sheet==='ur-kit3'?KIT3_OBJECT:null,object=!!objects?.has(frame),size=(sheet==='ur-kit2'?KIT2_SMALL:sheet==='ur-kit3'?KIT3_SMALL:SMALL).has(frame)?128:256,cw=img.naturalWidth/4;
  c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d',{willReadFrequently:true});
  g.drawImage(img,frame%4*cw,Math.floor(frame/4)*cw,cw,cw,0,0,size,size);
  try{const d=g.getImageData(0,0,size,size),p=d.data,l=lutOf(stops);for(let i=0;i<p.length;i+=4){const a=p[i+3];if(!a)continue;const v=object?p[i]:v1?a:TONE[a];p[i]=l[v*3];p[i+1]=l[v*3+1];p[i+2]=l[v*3+2];}g.putImageData(d,0,0);}
  catch{g.globalCompositeOperation='source-atop';g.fillStyle=stops[Math.min(2,stops.length-1)][1];g.fillRect(0,0,size,size);}
  cache.set(key,c);return c;
}
function drawPiece(fx,sheet,frame,ramp,x,y,w,h,angle,alpha,blend,flip=1){
  if(!(alpha>.004)||!(w>0)||!(h>0))return;const c=kitCanvas(fx,frame,ramp,sheet);if(!c)return;const ctx=fx.ctx;
  ctx.save();ctx.globalAlpha*=Math.min(1,alpha);ctx.globalCompositeOperation=blend;ctx.translate(x,y);if(angle)ctx.rotate(angle);if(flip!==1)ctx.scale(flip,1);ctx.drawImage(c,-w/2,-h/2,w,h);ctx.restore();
}
export function kit(fx,frame,ramp,x,y,w,h=w,angle=0,alpha=1,blend='lighter'){drawPiece(fx,'ur-kit',frame,ramp,x,y,w,h,angle,alpha,blend);}
export function kit2(fx,frame,ramp,x,y,w,h=w,angle=0,alpha=1,blend='lighter',flip=1){drawPiece(fx,'ur-kit2',frame,ramp,x,y,w,h,angle,alpha,blend,flip);}
// A piece whose base sits on the cell floor, drawn standing on (x, y) and stretched upward by `rise` (0..1).
function kitStanding(fx,frame,ramp,x,y,w,rise=1,flip=1,lean=0,alpha=1,blend='lighter',sheet='ur-kit'){
  if(!(rise>0))return;const c=kitCanvas(fx,frame,ramp,sheet);if(!c||!(alpha>.004))return;const ctx=fx.ctx;
  ctx.save();ctx.globalAlpha*=Math.min(1,alpha);ctx.globalCompositeOperation=blend;ctx.translate(x,y);if(lean)ctx.rotate(lean);ctx.scale(flip,rise);ctx.drawImage(c,-w/2,-w*KIT_FLOOR,w,w);ctx.restore();
}
// A round piece lying flat on the board (perspective squash), turning in its own plane.
function disc(fx,frame,ramp,x,y,w,squash,spin,alpha,blend='lighter'){
  if(!(alpha>.004)||!(w>0))return;const c=kitCanvas(fx,frame,ramp,'ur-kit2');if(!c)return;const ctx=fx.ctx;
  ctx.save();ctx.globalAlpha*=Math.min(1,alpha);ctx.globalCompositeOperation=blend;ctx.translate(x,y);ctx.scale(1,squash);ctx.rotate(spin);ctx.drawImage(c,-w/2,-w/2,w,w);ctx.restore();
}
// A clock hand turning on its hub at (x, y); angle 0 points to twelve.
function clockHand(fx,ramp,x,y,reach,angle,alpha=1,blend='lighter'){
  if(!(alpha>.004))return;const c=kitCanvas(fx,KIT2.hand,ramp,'ur-kit2');if(!c)return;const w=reach/HAND_REACH,ctx=fx.ctx;
  ctx.save();ctx.globalAlpha*=Math.min(1,alpha);ctx.globalCompositeOperation=blend;ctx.translate(x,y);ctx.rotate(angle);ctx.drawImage(c,-w/2,-w*HAND_PIVOT,w,w);ctx.restore();
}
function sweet(fx,frame,x,y,w,angle=0,alpha=1,sx=1,sy=1){
  const img=fx.art?.images?.['ur-sweets'];if(!img||!(alpha>.004)||!(w>0))return;const cw=img.naturalWidth/4,ch=img.naturalHeight/3,ctx=fx.ctx;
  ctx.save();ctx.globalAlpha*=Math.min(1,alpha);ctx.translate(x,y);if(angle)ctx.rotate(angle);ctx.scale(sx,sy);ctx.drawImage(img,frame%4*cw,Math.floor(frame/4)*ch,cw,ch,-w/2,-w/2,w,w);ctx.restore();
}
// The hero's own SD, tinted, for afterimages (re-drawn original pixels; nothing is painted onto the character).
function ghostSprite(fx,hero,direction,color,form=null){
  const art=form&&TRANSFORM_ART[form]||HERO[hero]?.art,img=fx.art?.images?.[art?.atlas];if(!img||typeof document==='undefined')return null;
  const cache=fx.urCache||(fx.urCache=new Map()),key=`ghost|${hero}|${form||''}|${direction}|${color}`;let c=cache.get(key);if(c)return c;
  const cols=art.columns,cell=img.naturalWidth/cols,index=art.directional?({down:0,up:1,left:2,right:3}[direction]??0):0,col=index%cols,row=art.directional?Math.floor(index/cols):art.row,size=192;
  c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');
  g.drawImage(img,col*cell,row*cell,cell,cell,0,0,size,size);g.globalCompositeOperation='source-atop';g.globalAlpha=.74;g.fillStyle=color;g.fillRect(0,0,size,size);
  c.foot=art.foot;c.scale=art.scale||1;cache.set(key,c);return c;
}
// baseY is the unit's foot line as render.js draws it (cell point + 31). A form draws that transformation's art instead.
function drawGhost(fx,hero,x,baseY,direction,color,alpha,size=126,form=null){
  const c=ghostSprite(fx,hero,direction,color,form);if(!c||!(alpha>.004))return;const sz=size*c.scale,ctx=fx.ctx;
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
      fx.glow('glow','#ffb3d6',cx,cy,170*big,.6*span(p,.55,.6)*(1-span(p,.6,.75)));}
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
      if(!R)fx.glow('glow',u.empowered?'#ffe08a':'#ff9cc8',cx,cy,260*big,.6*(1-span(a,0,.14)));
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

// =====================================================================================================================
// Pass 22 (2026-11-06): Jasmine, Queen, Time Magician, Galaxy Whale and Time Ruler, with ur-kit2 (docs/art/ur-vfx2-20261106).
// Each one's main identity leads (the instant strike rides along): Jasmine's blessing of the whole team, the Queen's tax, the
// Time Magician's transformation, the Galaxy Whale's pull and harvest, the Time Ruler's rewind and stop.
const easeInOut=t=>{t=clamp01(t);return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const BOARD_CENTRE=cellPoint(12);
// Light pouring from the top of the board (screen blend).
function skyLight(fx,color,alpha,reach=700){
  if(!(alpha>.004)||fx.reduced)return;const ctx=fx.ctx,g=ctx.createLinearGradient(0,0,0,reach);g.addColorStop(0,color);g.addColorStop(1,color+'00');
  ctx.save();ctx.globalAlpha=Math.min(1,alpha);ctx.globalCompositeOperation='screen';ctx.fillStyle=g;ctx.fillRect(0,0,720,reach);ctx.restore();
}
// The light pillar spans [top, bottom] at a visible width (the painted column fills .27 of its cell's width and .9 of its height).
function pillar(fx,ramp,x,top,bottom,width,alpha){if(bottom>top)kit2(fx,KIT2.pillar,ramp,x,(top+bottom)/2,width/.27,(bottom-top)/.9,0,alpha);}
// The unit standing on a cell point (read at draw time, when render.js has set fx.s).
const unitAt=(fx,q)=>{const i=cellAt(q.x,q.y);return i>=0?fx.s?.board?.[i]||null:null;};
// A short label in the style of render.js floats, for gold the player receives.
function label(fx,text,x,y,alpha,size=24,color='#ffe08a'){
  if(!(alpha>.004))return;const ctx=fx.ctx;ctx.save();ctx.globalAlpha=Math.min(1,alpha);ctx.font=`800 ${size}px system-ui`;ctx.textAlign='center';ctx.lineJoin='round';
  ctx.lineWidth=5;ctx.strokeStyle='rgba(40,16,8,.75)';ctx.strokeText(text,x,y);ctx.fillStyle=color;ctx.fillText(text,x,y);ctx.restore();
}
const bossOf=(fx,q)=>!!fx.enemies?.get(q.uid)?.enemy?.boss;

// ---------------------------------------------------------------------------------------------------------------------
// Jasmine · Goddess Descent. The engine strikes every enemy x5 at the cast, frees stunned and cursed allies and gives every ally
// +50% power for 8 s (the HUD timer shows the duration; nothing lingers on the units). The cut-in band covers the top of the board
// for 1.6 s, so heaven sits behind it: the board holds its breath while she gathers light, her prayer rises into the band, light
// pours down from under it (a pillar of judgement on every enemy, nearest the middle first, and a wave of blessing over the
// formation: a gold column on each ally, a burst of dark shards off an ally that was stunned or cursed), and as the band lifts the
// goddess's two wings of light open over the board around a halo, then fold away.
const HALO={x:360,y:300};
const jasmine={
  life:()=>2.9,
  plan(fx,skill){
    const t=skill.targets||[],seed=(skill.uid||1)*4.21,far=Math.max(1,...t.map(q=>dist(q,BOARD_CENTRE)));
    const at=new Map(t.map((q,i)=>[q.uid,.78+.3*dist(q,BOARD_CENTRE)/far+.05*hash(seed,i)]));
    const freed=new Set((skill.freed||[]).map(q=>q.uid));
    const allies=(skill.allies||[]).map(q=>({...q,at:.9+dist(q,BOARD_CENTRE)/700,freed:freed.has(q.uid)}));
    skill.ur={seed,at,allies,last:Math.max(0,...at.values())};return at;
  },
  field(fx,skill,age){
    const u=skill.ur,o=skill.origin,R=fx.reduced;
    vignette(fx,o.x,o.y-40,90,580,'#120a22',R?0:.36*span(age,0,.25)*(1-span(age,.55,.95)));
    skyLight(fx,'#ffd36a',.45*bell(span(age,.5,2.4)));
    // The blessing circle opens under the formation as the blessing passes.
    const ring=span(age,.85,1.4);if(ring>0)disc(fx,KIT2.circle,'holy',BOARD_CENTRE.x,BOARD_CENTRE.y+10,lerp(220,620,easeOut(ring)),.36,age*.25,.55*(1-span(age,1.9,2.6)));
    for(const q of skill.targets||[]){const c=age-u.at.get(q.uid);if(c<0||c>.5)continue;const P=fx.point(q.uid,q),big=bossOf(fx,q)?1.4:1,k=easeOut(span(c,0,.4));kit(fx,KIT.ring,'holy',P.x,P.y+6,(44+120*k)*big,(44+120*k)*.42*big,0,.9*(1-k));}
  },
  over(fx,skill,age){
    const u=skill.ur,o=skill.origin,R=fx.reduced,staff={x:o.x+12,y:o.y-58},spot=fx.s?.buffSpotlight?.radiance;
    // She gathers light: motes stream into her staff.
    if(age<.5)for(let i=0;i<(R?4:14);i++){const t0=hash(u.seed,i)*.15,k=span(age,t0,t0+.32);if(k<=0||k>=1)continue;const ang=hash(u.seed,i+20)*6.283,r=lerp(170,6,easeIn(k));kit(fx,KIT.flare,'holy',staff.x+Math.cos(ang)*r,staff.y+Math.sin(ang)*r*.8,16,undefined,ang,bell(k));}
    // Her prayer rises into the sky.
    const rise=span(age,.3,.55),beam=rise*(1-span(age,.6,.95));if(beam>0)pillar(fx,'holy',staff.x,lerp(staff.y,-40,easeOut(rise)),staff.y+10,28,beam);
    // Light pours down from above: god rays fan over the board.
    const pour=span(age,.5,.8)*(1-span(age,1.6,2.3));if(pour>0&&!R)fx.glow('rays','#ffd36a',360,190,920,.35*pour,age*.12);
    // Judgement: a pillar of light falls on every enemy, nearest the middle first.
    for(const q of skill.targets||[]){
      const at=u.at.get(q.uid),c=age-at;if(c<-.1||c>.5)continue;const P=fx.point(q.uid,q),big=bossOf(fx,q)?1.4:1,head=P.y-34*big;
      if(c<0){pillar(fx,'holy',P.x,-40,lerp(-20,head,easeIn(span(c,-.1,0))),22*big,.9);continue;}
      pillar(fx,'holy',P.x,-40,P.y+8,lerp(42,12,easeOut(span(c,0,.4)))*big,1-span(c,.12,.5));
      kit(fx,KIT.flare,'holy',P.x,head+8,170*big*(1-span(c,0,.2)),undefined,0,1-span(c,.04,.25));
      if(!q.hit){q.hit=true;const last=at>=u.last-.001;stun(fx,last?5:1.2,last?.06:0);}
    }
    // Blessing: the wave crosses the formation; each ally gets a gold column and a faint rim; freed allies shed dark shards.
    for(const q of u.allies){
      const c=age-q.at;if(c<0||c>.6)continue;const lead=spot!==undefined&&q.uid===spot,k=bell(span(c,0,.5)),unit=unitAt(fx,q);
      pillar(fx,lead?'gold':'holy',q.x,q.y-(lead?160:118),q.y+22,lead?24:15,.75*k);
      if(unit&&!R)drawGhost(fx,unit.hero,q.x,q.y+31,unit.facing||'down','#ffcf66',.16*k,126,unitForm(fx.s,unit));
      if(q.freed){kit(fx,KIT.shatter,'moon',q.x,q.y-30,lerp(50,150,easeOut(span(c,0,.35))),undefined,hash(u.seed,q.uid||1)*6,1-span(c,.1,.45));kit(fx,KIT.flare,'pale',q.x,q.y-34,130*(1-span(c,0,.25)),undefined,0,1-span(c,.05,.3));}
      if(lead)kit(fx,KIT.flare,'gold',q.x,q.y-56,110*k,undefined,.3,k);
    }
    // As the band lifts, the goddess's wings open over the board around her halo, then fold away.
    const open=easeBack(span(age,1.3,1.7)),wings=span(age,1.3,1.5)*(1-span(age,2.15,2.8));
    if(wings>0){
      const w=380*open,flap=R?0:Math.sin(age*4)*.06;
      for(const side of [-1,1])kit2(fx,KIT2.wing,'holy',HALO.x+side*(46+w*.36),HALO.y+10-w*.3,w,w,side*flap,.42*wings,'lighter',side<0?1:-1);
      disc(fx,KIT2.circle,'holy',HALO.x,HALO.y-60,250*open,.36,age*.5,.9*wings);
      if(!R)fx.glow('glow','#ffe6a5',HALO.x,HALO.y-40,340*open,.32*wings);
    }
    // Pass 3: no falling feathers (owner review: a straight vertical drop read as unnatural, not as drifting).
    wash(fx,'#ffd36a',.2*bell(span(age,.75,1.35))+.1*bell(span(age,1.35,2)));
  },
  body(fx,skill,age){if(fx.reduced)return null;const k=bell(span(age,0,1.1));return {dy:-8*k,squash:1+.03*k};},
};

// ---------------------------------------------------------------------------------------------------------------------
// Queen · Rose Tax. The engine strikes every enemy x4, pays 20G at once and, the first time in a wave, raises this wave's income by
// 50% (the edict). The tax is one payment from the crown, not a coin per enemy: a crown shines over her, her rose bursts into a
// storm of petals spiralling over the board, thorns snap up around every enemy (nearest first) and a rose blooms on each as it is
// struck; then the treasury answers with one fountain of coins that flies into the gold counter, which counts up as they land
// (render.js holds the HUD total until then). A fresh edict also stamps the royal seal on the middle of the board.
const QUEEN_GOLD_AT=1.75,HUD_GOLD={x:150,y:-30};
const queen={
  life:()=>2.4,
  plan(fx,skill){
    const t=skill.targets||[],o=skill.origin,seed=(skill.uid||1)*6.07,far=Math.max(1,...t.map(q=>dist(q,o)));
    const at=new Map(t.map(q=>[q.uid,.52+.42*dist(q,o)/far]));
    skill.ur={seed,at,last:Math.max(0,...at.values()),edict:skill.edict||0,...(skill.tax>0?{gold:{amount:skill.tax,at:QUEEN_GOLD_AT}}:{})};return at;
  },
  field(fx,skill,age){
    const u=skill.ur,o=skill.origin,R=fx.reduced,mood=span(age,.12,.4)*(1-span(age,1.3,2.1));
    vignette(fx,o.x,o.y-30,110,620,'#2a0410',R?0:.5*mood);wash(fx,'#3a0614',.2*mood,'source-over');
    // Her crest under her feet; a fresh edict stamps the royal seal on the middle of the board.
    disc(fx,KIT2.circle,'rose',o.x,o.y+24,lerp(90,170,easeOut(span(age,0,.3))),.38,age*.8,.75*(1-span(age,1.2,1.8)));
    if(u.edict){const land=age-.34;if(land>=-.2){const s=land<0?lerp(1.5,1,easeIn(span(land,-.2,0))):1+.05*bell(span(land,0,.15));
      disc(fx,KIT2.circle,'gold',BOARD_CENTRE.x,BOARD_CENTRE.y,480*s,.4,0,(land<0?span(land,-.2,0):1-span(land,.6,1.4))*.7);
      if(land>=0)kit(fx,KIT.ring,'gold',BOARD_CENTRE.x,BOARD_CENTRE.y,lerp(200,660,easeOut(span(land,0,.5))),lerp(80,264,easeOut(span(land,0,.5))),0,.8*(1-span(land,0,.5)));}}
    // Thorns snap up around every enemy just before its rose blooms, then sink back.
    for(const q of skill.targets||[]){const c=age-u.at.get(q.uid);if(c<-.14||c>.75)continue;const P=fx.point(q.uid,q),boss=bossOf(fx,q),grow=easeBack(span(c,-.14,0))*(1-span(c,.45,.75));
      for(const side of [-1,1])kitStanding(fx,KIT2.vine,'thorn',P.x+side*(boss?26:16),P.y+8,boss?124:86,grow,side,side*.22,1,'source-over','ur-kit2');}
  },
  over(fx,skill,age){
    const u=skill.ur,o=skill.origin,R=fx.reduced,rose={x:o.x+14,y:o.y-44};
    if(!u.sealed&&u.edict&&age>=.34){u.sealed=true;stun(fx,3,0);}
    // The crown shines over her head; her rose flares.
    const crown=easeBack(span(age,.02,.25))*(1-span(age,1.5,2));if(crown>0){if(!R)fx.glow('rays','#ffd36a',o.x,o.y-100,240*crown,.5*bell(span(age,.05,.7)),age);kit2(fx,KIT2.crown,'gold',o.x,o.y-100,84*crown,undefined,0,1,'source-over');kit(fx,KIT.flare,'gold',o.x+20,o.y-122,80*bell(span(age,.12,.4)),undefined,.4,bell(span(age,.12,.4)));}
    if(age<.4)kit(fx,KIT.flare,'rose',rose.x,rose.y,90*bell(span(age,.05,.35)),undefined,age*3,bell(span(age,.05,.35)));
    // The rose storm spirals out over the board.
    for(let i=0;i<(R?14:56);i++){const t0=.22+hash(u.seed,i)*.14,k=span(age,t0,t0+1);if(k<=0||k>=1)continue;const a0=hash(u.seed,i+40)*6.283,r=lerp(20,580,easeOut(k)),a=a0+2.4*easeOut(k);
      kit2(fx,KIT2.petal,'rose',rose.x+Math.cos(a)*r,rose.y+Math.sin(a)*r*.78+60*k*k,22+hash(u.seed,i+70)*14,undefined,a*2+k*5,bell(k)*.95,'source-over');}
    // A rose blooms on every enemy as it is struck, then falls apart.
    for(const q of skill.targets||[]){
      const at=u.at.get(q.uid),c=age-at;if(c<0||c>.8)continue;const P=fx.point(q.uid,q),boss=bossOf(fx,q),big=boss?1.5:1,cy=P.y-(boss?46:26),gone=span(c,.36,.6);
      const bloom=easeBack(span(c,0,.16));if(gone<1){if(!R)fx.glow('glow','#ff4f6a',P.x,cy,120*big,.55*(1-gone)*Math.min(1,bloom));kit2(fx,KIT2.rose,'rose',P.x,cy,66*big*lerp(.35,1,bloom),undefined,hash(u.seed,q.uid||1)*6.28,1-gone,'source-over');}
      kit(fx,KIT.flare,'rose',P.x,cy,120*big*(1-span(c,0,.18)),undefined,.5,1-span(c,.03,.25));
      if(c>.36)for(let j=0;j<(R?2:6);j++){const k=span(c,.36,.8),ang=hash(q.uid||1,j)*6.283;kit2(fx,KIT2.petal,'rose',P.x+Math.cos(ang)*40*k,cy+Math.sin(ang)*26*k+50*k*k,14,undefined,ang+k*6,1-k,'source-over');}
      if(!q.hit){q.hit=true;const last=at>=u.last-.001;stun(fx,last?5:1,last?.05:0);}
    }
    // The treasury answers: one fountain of coins from her, into the gold counter above the board.
    if(u.gold){
      for(let i=0;i<18;i++){const s0=1.02+i*.016,arrive=QUEEN_GOLD_AT-(17-i)*.022,k=span(age,s0,arrive);if(k<=0||k>=1)continue;
        const start={x:o.x,y:o.y-56},peak={x:o.x+(hash(u.seed,i+120)-.5)*150,y:o.y-90-hash(u.seed,i+140)*70},fly=easeIn(span(k,.32,1)),burst=easeOut(span(k,0,.32));
        const x=k<.32?lerp(start.x,peak.x,burst):lerp(peak.x,HUD_GOLD.x,fly),y=k<.32?lerp(start.y,peak.y,burst):lerp(peak.y,HUD_GOLD.y,fly),size=lerp(28,18,span(k,.5,1)),spin=Math.abs(Math.cos(age*11+i));
        kit2(fx,KIT2.coin,'gold',x,y,size*lerp(.25,1,spin),size,0,1,'source-over');if(!R)kit(fx,KIT.flare,'gold',x,y,16,undefined,age*4+i,.7);}
      label(fx,`+${u.gold.amount} G`,o.x,o.y-96-30*easeOut(span(age,1.05,1.6)),1.4*bell(span(age,1.02,1.9)),28);
      wash(fx,'#ffd36a',.14*span(age,1,1.04)*(1-span(age,1.04,1.5)));
    }
    if(!R)for(let i=0;i<18;i++){const t0=.95+hash(u.seed,i+200)*.5,k=span(age,t0,t0+.9);if(k<=0||k>=1)continue;kit(fx,KIT.flare,'gold',20+hash(u.seed,i+230)*680,-20+k*700,10+hash(u.seed,i+260)*10,undefined,k*4,bell(k)*.9);}
  },
  body(fx,skill,age){if(fx.reduced)return null;const k=bell(span(age,0,.7));return {dy:-5*k,squash:1+.03*k};},
};

// ---------------------------------------------------------------------------------------------------------------------
// Time Magician · Trauma, the dark Cinderella (SR). The engine strikes every enemy x4 and turns every Time Magician on the board into
// Trauma for 10 s (the HUD timer shows the duration; the form itself shows who). The transformation is the point: midnight falls;
// a clock rises over each magician, its hands race backwards and strike twelve; the glass cracks while star dust spirals up around the
// boy's lit silhouette; the clock shatters and Trauma steps out (render.js keeps the old form on screen until then), a glass slipper
// glinting at her feet. The midnight toll then rings out from the caster and strikes each enemy as it passes.
const TRAUMA_REVEAL=.8,TRAUMA_TOLL=.86,TOLL_SPEED=1100;
// A four-point sparkle with a halo, the Gold Dragon's star-dust grain (gold-dragon-vfx.js glint).
function glint(fx,x,y,r,core,halo,alpha,angle=0){
  if(!(alpha>.01))return;const ctx=fx.ctx;fx.glow('glow',halo,x,y,r*7,Math.min(1,alpha)*.55);
  ctx.save();ctx.translate(x,y);if(angle)ctx.rotate(angle);ctx.globalCompositeOperation='lighter';
  for(const [s,c,a] of [[r*2.1,core,alpha],[r*1.1,'#ffffff',alpha*.9]]){ctx.globalAlpha=Math.min(1,a);ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(0,-s);ctx.lineTo(s*.25,-s*.23);ctx.lineTo(s,0);ctx.lineTo(s*.25,s*.23);ctx.lineTo(0,s);ctx.lineTo(-s*.25,s*.23);ctx.lineTo(-s,0);ctx.lineTo(-s*.25,-s*.23);ctx.closePath();ctx.fill();}
  ctx.restore();
}
// Magic gathering on a unit: twinkling star dust spirals up around it. `grow` (0..1) is how high the spiral reaches, `burst` throws
// the dust outward (the reveal). Pass 3 replaced pass 2's stroked ribbons, which the owner found plain next to the painted pieces.
function stardust(fx,M,seed,grow,age,alpha,burst=0,core='#ffe2f6',halo='#ff6ad0'){
  if(!(alpha>.01))return;
  for(let i=0;i<(fx.reduced?7:22);i++){
    const f=(hash(seed,i)+age*.7)%1;if(f>grow)continue;
    const a=f*9+hash(seed,i+30)*6.283+age*5,r=(30-f*12)*(1+burst*2.6),x=M.x+Math.cos(a)*r,y=M.y+24-f*120-burst*34*hash(seed,i+60)+Math.sin(a)*r*.25;
    const flick=.55+.45*Math.sin(age*34+i*2.3),edge=Math.min(1,f*6)*(1-span(f,.8,1));
    glint(fx,x,y,hash(seed,i+90)<.3?3.6:2.2,core,halo,alpha*flick*edge*(1-burst*.6),age*2+i);
  }
}
// The spell runs out (render.js sees the form change): the glass breaks outward, Trauma's afterimage fades and the boy stands in a flash.
function traumaEnd(fx,e,t){
  const C={x:e.x,y:e.y-40};
  if(t<.45)drawGhost(fx,e.hero,e.x,e.y+31,e.facing,'#ff9ad8',.7*(1-t/.45),126,'trauma');
  kit(fx,KIT.flare,'midnight',C.x,C.y,170*(1-span(t,0,.3)),undefined,0,1-span(t,0,.35));
  kit(fx,KIT.shatter,'glass',C.x,C.y,lerp(70,190,easeOut(span(t,0,.4))),undefined,e.seed,1-span(t,.1,.55));
  if(!fx.reduced)for(let j=0;j<12;j++){const k=span(t,0,.8);if(k>=1)break;const ang=hash(e.seed,j)*6.283,v=60+hash(e.seed,j+20)*90;kit(fx,KIT.shard,'glass',C.x+Math.cos(ang)*v*easeOut(k),C.y+Math.sin(ang)*v*easeOut(k)*.8+70*k*k,12,undefined,ang+k*6,1-k);}
  kit(fx,KIT.mist,'midnight',C.x,C.y+10,lerp(70,170,easeOut(span(t,0,.6))),undefined,t*2,.55*(1-span(t,.1,.8)));
  drawGhost(fx,e.hero,e.x,e.y+31,e.facing,'#ffffff',.6*(1-span(t,.05,.6)));
}
const trauma={
  life:()=>2,
  plan(fx,skill){
    const o=skill.origin,seed=(skill.uid||1)*8.11,mags=(skill.targets||[]).map(q=>({...q}));
    const at=new Map((skill.struck||[]).map(q=>[q.uid,TRAUMA_TOLL+dist(q,o)/TOLL_SPEED]));
    skill.ur={seed,at,mags,uids:new Set(mags.map(q=>q.uid)),last:Math.max(0,...at.values())};return at;
  },
  field(fx,skill,age){
    const o=skill.origin,R=fx.reduced,night=span(age,.04,.3)*(1-span(age,1.05,1.7));
    vignette(fx,o.x,o.y-40,80,600,'#0c0418',R?0:.5*night);wash(fx,'#1a0630',.2*night,'source-over');
    // The toll: a clock-face ring sweeps the board from the caster.
    const r=TOLL_SPEED*(age-TRAUMA_TOLL);if(r>0&&r<900){const k=r/900;kit(fx,KIT.ring,'midnight',o.x,o.y,2*r,1.24*r,0,.9*(1-k));kit2(fx,KIT2.clock,'midnight',o.x,o.y,2.2*r,1.36*r,0,.3*(1-k));}
  },
  over(fx,skill,age){
    const u=skill.ur,R=fx.reduced,ctx=fx.ctx;
    for(const [n,M] of u.mags.entries()){
      const unit=unitAt(fx,M),dir=unit?.facing||'down',C={x:M.x,y:M.y-62},c=age-TRAUMA_REVEAL;
      if(c<0){
        // The clock rises; its hands race backwards and strike twelve at 0.44 s.
        const pop=easeBack(span(age,0,.22)),spin=1-easeOut(span(age,0,.44));kit2(fx,KIT2.clock,'midnight',C.x,C.y,176*pop,undefined,0,1);
        clockHand(fx,'midnight',C.x,C.y,60*pop,-spin*Math.PI*6,1);clockHand(fx,'midnight',C.x,C.y,42*pop,-spin*Math.PI*2,1);
        const dong=span(age,.44,.74);if(dong>0&&dong<1){kit(fx,KIT.flare,'midnight',C.x,C.y-52,150*bell(dong),undefined,0,bell(dong));kit(fx,KIT.ring,'midnight',C.x,C.y,lerp(90,240,easeOut(dong)),undefined,0,.8*(1-dong));if(!M.dong&&n===0){M.dong=true;stun(fx,2,0);}}
        // The glass cracks.
        const crack=span(age,.5,.78);if(crack>0){ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle='#ffe2f6';ctx.lineWidth=2;ctx.lineCap='round';
          for(let j=0;j<7;j++){const a0=hash(u.seed+n,j)*6.283;let x=C.x,y=C.y;ctx.beginPath();ctx.moveTo(x,y);for(let s=1;s<=4;s++){const a=a0+(hash(u.seed+n,j*9+s)-.5)*.8,len=72*crack/4;x+=Math.cos(a)*len;y+=Math.sin(a)*len;ctx.lineTo(x,y);}ctx.stroke();}ctx.restore();}
        // Magic gathers on the boy: a brief aura swells behind his lit silhouette while star dust spirals up around him.
        const glow=span(age,.45,.78);if(glow>0&&!R)fx.glow('glow','#c84ad8',M.x,M.y-30,lerp(80,150,glow),.5*glow);if(unit&&glow>0&&!R)drawGhost(fx,'time_magician',M.x,M.y+31,dir,'#ffd6f6',.7*glow);
        const wind=span(age,.45,.8);if(wind>0)stardust(fx,M,u.seed+n,wind,age,1);
        continue;
      }
      // The clock shatters and Trauma steps out.
      if(!M.revealed){M.revealed=true;if(n===0)stun(fx,4,.05);}
      if(c<.5){kit(fx,KIT.shatter,'glass',C.x,C.y,lerp(120,280,easeOut(span(c,0,.3))),undefined,hash(u.seed,n)*6,1-span(c,.06,.42));kit(fx,KIT.flare,'midnight',C.x,C.y+20,240*(1-span(c,0,.25)),undefined,.3,1-span(c,0,.3));}
      if(!R)for(let j=0;j<14;j++){const k=span(c,0,.7);if(k>=1)break;const ang=hash(u.seed+n,j+30)*6.283,v=90+hash(u.seed+n,j+50)*140;kit(fx,KIT.shard,'glass',C.x+Math.cos(ang)*v*k,C.y+Math.sin(ang)*v*k+120*k*k,12,undefined,ang+k*8,1-k);}
      if(unit&&c<.4)drawGhost(fx,'time_magician',M.x,M.y+31,dir,'#ffc2e6',.9*(1-span(c,0,.4)),126,'trauma');
      if(c<.55)stardust(fx,M,u.seed+n,1,age,1-span(c,0,.55),easeOut(span(c,0,.55)));
      const shoe=easeBack(span(c,.05,.25));if(shoe>0&&c<.9){kit2(fx,KIT2.slipper,'glass',M.x+22,M.y+22,36*shoe,undefined,-.15,1-span(c,.6,.9),'source-over');kit(fx,KIT.flare,'pale',M.x+12,M.y+18,44*bell(span(c,.15,.45)),undefined,.4,bell(span(c,.15,.45)));}
    }
    wash(fx,'#ff9ad8',.12*span(age,TRAUMA_REVEAL,TRAUMA_REVEAL+.02)*(1-span(age,TRAUMA_REVEAL+.02,TRAUMA_REVEAL+.3)));
    // The toll strikes each enemy: two clock hands cross on it and its glass breaks.
    for(const q of skill.struck||[]){const at=u.at.get(q.uid),c=age-at;if(c<0||c>.42)continue;const P=fx.point(q.uid,q),y=P.y-26,k=1-span(c,.15,.42);
      clockHand(fx,'midnight',P.x,y+16,40,-.6+c*2,k);clockHand(fx,'midnight',P.x,y+16,30,.7-c*3,k);
      kit(fx,KIT.shatter,'glass',P.x,y,lerp(40,110,easeOut(span(c,0,.3))),undefined,hash(q.uid||1,3)*6,k);kit(fx,KIT.flare,'midnight',P.x,y,90*(1-span(c,0,.2)),undefined,.3,1-span(c,0,.25));
      if(!q.hit){q.hit=true;if(at>=u.last-.001)stun(fx,3,0);}}
  },
  // Every transforming magician: a small lift, the old form until the reveal, then a pop.
  unitBody(fx,skill,age,unit){
    if(!skill.ur?.uids?.has(unit.uid))return null;
    if(age<TRAUMA_REVEAL)return {dy:fx.reduced?0:-5*bell(span(age,.3,1.1)),form:null};
    const c=age-TRAUMA_REVEAL;return fx.reduced?null:{dy:-5*(1-span(c,0,.3)),squash:1+.07*(1-span(c,0,.22))};
  },
  // For the 10 s, a soft glow under Trauma and two glass shards circling her (no timer ring: the HUD has it).
  persistent(fx,s){if(!(s.buffs?.trauma>0))return;for(const [i,unit] of (s.board||[]).entries()){if(unit?.hero!=='time_magician'||unitForm(s,unit)!=='trauma')continue;const p=cellPoint(i);fx.glow('glow','#ff5c9a',p.x,p.y+22,110*(.8+Math.sin((fx.clock||0)*4+unit.uid)*.2),.3);}},
  persistentOver(fx,s){if(!(s.buffs?.trauma>0)||fx.reduced)return;const t=fx.clock||0;for(const [i,unit] of (s.board||[]).entries()){if(unit?.hero!=='time_magician'||unitForm(s,unit)!=='trauma')continue;const p=cellPoint(i);for(let j=0;j<2;j++){const a=t*1.8+j*Math.PI+unit.uid;kit(fx,KIT.shard,'glass',p.x+Math.cos(a)*30,p.y-26+Math.sin(a)*10,12,undefined,a,.75);}}},
  formChange(fx,unit,p,from,to){if(from==='trauma'&&to!=='trauma')fx.add?.({type:'urFx',x:p.x,y:p.y,hero:unit.hero,facing:unit.facing||'down',seed:unit.uid,life:.7,total:.7,draw:traumaEnd});},
};

// ---------------------------------------------------------------------------------------------------------------------
// Galaxy Whale · Heart of the Star Sea. The engine pulls every enemy along the road toward one point near the front (80 behind the
// leader), slows them and strikes each x8, plus 100% per divine mark it harvests. The board turns to deep space; the star whale swims
// in over the board and dives into a galaxy opening at the gathering point; the enemies slide along the road into it (render.js
// draws the slide); each enemy's divine marks are torn off as gold stars and spiral into the core; the galaxy collapses and bursts
// like a supernova, striking everyone at once (a harvested enemy burns gold).
const WHALE_PULL=.45,WHALE_BLAST=1.2;
const bez=(a,b,c,t)=>(1-t)*(1-t)*a+2*(1-t)*t*b+t*t*c;
const whale={
  life:()=>2.6,
  plan(fx,skill){
    const t=skill.targets||[],seed=(skill.uid||1)*2.71,W=pathPoint(skill.well??0);
    const at=new Map(t.map(q=>[q.uid,WHALE_BLAST+.03+dist(q,W)/2000]));
    const moves=t.filter(q=>q.p0!==undefined).map(q=>({uid:q.uid,from:q.p0,delay:WHALE_PULL,dur:.6,ease:easeInOut}));
    skill.ur={seed,W:{x:W.x,y:W.y},at,moves,dir:W.x<360?-1:1};return at;
  },
  field(fx,skill,age){
    const u=skill.ur,W=u.W,R=fx.reduced,space=span(age,0,.3)*(1-span(age,1.7,2.5));
    vignette(fx,W.x,W.y,60,640,'#03051a',R?0:.55*space);wash(fx,'#0a0c34',.24*space,'source-over');
    // The galaxy opens at the gathering point, turning fast, and falls into its core just before the blast.
    const open=easeOut(span(age,.38,.75)),fall=span(age,WHALE_BLAST-.12,WHALE_BLAST);
    if(age<WHALE_BLAST)disc(fx,KIT2.galaxy,'cosmos',W.x,W.y,340*open*lerp(1,.18,easeIn(fall)),.56,-age*4.2,.95);
    // Gravity: short streaks from every enemy toward the core while they slide.
    if(age>WHALE_PULL&&age<WHALE_BLAST){const ctx=fx.ctx;ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle='#b8c4ff';ctx.lineWidth=2;ctx.lineCap='round';ctx.globalAlpha=.6*bell(span(age,WHALE_PULL,WHALE_BLAST));
      for(const q of skill.targets||[]){const P=fx.point(q.uid,q),dx=W.x-P.x,dy=W.y-P.y,len=Math.hypot(dx,dy)||1;ctx.beginPath();ctx.moveTo(P.x,P.y-16);ctx.lineTo(P.x+dx/len*46,P.y-16+dy/len*46);ctx.stroke();}ctx.restore();}
  },
  over(fx,skill,age){
    const u=skill.ur,W=u.W,R=fx.reduced,o=skill.origin;
    stars(fx,u.seed,span(age,.05,.3)*(1-span(age,1.7,2.5))*.9,18);
    if(age<.45)kit(fx,KIT.flare,'gold',o.x+14,o.y-60,80*bell(span(age,.02,.4)),undefined,age*3,bell(span(age,.02,.4)));
    // The star whale swims in over the board and dives into the galaxy.
    const swim=span(age,.05,.9);
    if(swim>0&&swim<1){
      const S={x:u.dir<0?880:-160,y:330},C={x:(S.x+W.x)/2,y:Math.min(S.y,W.y)-200},q=easeInOut(swim),q2=Math.min(1,q+.02);
      const x=bez(S.x,C.x,W.x,q),y=bez(S.y,C.y,W.y,q),heading=Math.atan2(bez(S.y,C.y,W.y,q2)-y,bez(S.x,C.x,W.x,q2)-x),dive=span(swim,.72,1);
      for(let j=1;j<=(R?3:10);j++){const qq=Math.max(0,q-j*.025);kit(fx,KIT.flare,'cosmos',bez(S.x,C.x,W.x,qq),bez(S.y,C.y,W.y,qq),16-j,undefined,j,(1-j/11)*.8);}
      const w=420*lerp(1,.25,easeIn(dive));kit2(fx,KIT2.whale,'cosmos',x,y,w,w,u.dir<0?heading+Math.PI:heading,(1-span(dive,.6,1))*.95,'lighter',u.dir<0?1:-1);
    }
    // Harvest: each enemy's divine marks are torn off as gold stars and spiral into the core.
    for(const q of skill.targets||[]){if(!(q.harvest>0))continue;const P=fx.point(q.uid,q);for(let m=0;m<Math.min(3,q.harvest);m++){const k=span(age,.55+m*.07,1.05+m*.04);if(k<=0||k>=1)continue;
      const sp=k*5+m*2.1,r=(1-k)*26;kit(fx,KIT.flare,'gold',lerp(P.x,W.x,easeIn(k))+Math.cos(sp)*r,lerp(P.y-40,W.y,easeIn(k))+Math.sin(sp)*r*.7,26,undefined,sp,bell(k*.9+.1));}}
    // The core blazes, then the supernova: a flash over the board, rings and star shards.
    const pre=span(age,WHALE_BLAST-.12,WHALE_BLAST);if(pre>0&&age<WHALE_BLAST)kit(fx,KIT.flare,'pale',W.x,W.y,lerp(60,220,easeIn(pre)),undefined,age*3,pre);
    const c=age-WHALE_BLAST;
    if(c>=0){
      if(!u.blasted){u.blasted=true;stun(fx,9,.09);}
      // Pass 3: the flash stays in the cosmos colours (a pale wash had bleached the whole board white for a moment).
      wash(fx,'#3a2a9a',.32*(1-span(c,0,.45)));
      if(!R){fx.glow('glow','#7a6cff',W.x,W.y,600,.7*(1-span(c,0,.3)));fx.glow('rays','#8ab0ff',W.x,W.y,760*easeOut(span(c,0,.3)),.5*(1-span(c,0,.55)),c);}
      kit(fx,KIT.flare,'cosmos',W.x,W.y,380*(1-span(c,0,.25)),undefined,0,1-span(c,0,.3));
      kit2(fx,KIT2.galaxy,'cosmos',W.x,W.y,lerp(300,980,easeOut(span(c,0,.6))),lerp(170,560,easeOut(span(c,0,.6))),c*2,.85*(1-span(c,0,.6)));
      for(const [d,max] of [[0,800],[.08,560]]){const k=easeOut(span(c-d,0,.55));if(c>=d&&k<1)kit(fx,KIT.ring,'cosmos',W.x,W.y,lerp(80,max,k),lerp(44,max*.56,k),0,.9*(1-k));}
      if(!R)for(let i=0;i<30;i++){const k=span(c,0,.9);if(k>=1)break;const ang=hash(u.seed,i+300)*6.283,v=220+hash(u.seed,i+330)*360;kit(fx,KIT.flare,i%4?'cosmos':'gold',W.x+Math.cos(ang)*v*easeOut(k),W.y+Math.sin(ang)*v*easeOut(k)*.62,14+hash(u.seed,i)*12,undefined,ang,1-k);}
      if(!R)for(let i=0;i<20;i++){const t0=hash(u.seed,i+400)*.4,k=span(c,t0+.1,t0+1.3);if(k<=0||k>=1)continue;kit(fx,KIT.flare,'cosmos',W.x+(hash(u.seed,i+430)-.5)*600,W.y-200+k*320,8+hash(u.seed,i+460)*8,undefined,k*3,bell(k)*.8);}
    }
    for(const q of skill.targets||[]){const cc=age-u.at.get(q.uid);if(cc<0||cc>.35)continue;const P=fx.point(q.uid,q);kit(fx,KIT.flare,q.harvest>0?'gold':'cosmos',P.x,P.y-24,(q.harvest>0?150:100)*(1-span(cc,0,.25)),undefined,.4,1-span(cc,.03,.3));}
  },
  body(fx,skill,age){if(fx.reduced)return null;const k=bell(span(age,0,.9));return {dy:-6*k,squash:1+.03*k};},
};

// ---------------------------------------------------------------------------------------------------------------------
// Time Ruler · The Moment Not Yet Come. The engine sends every enemy back to where it stood 6 s ago (the faster, the farther), stops
// it for 2 s and strikes it x3. Time stops: the board loses its colour except for her; her great clock fills the board behind the
// units with its gears; the hands race backwards and every enemy slides back along the road the same way (render.js draws the
// slide), the road it gave back glowing behind it. At twelve the clock strikes: every enemy is hit and stopped, and an hourglass
// turns over its head for as long as it stays stopped (drawTimeStop, instead of the generic stun stars).
const REWIND_AT=.35,REWIND_STOP=.95;
const chrono={
  life:()=>2.1,
  plan(fx,skill){
    const t=skill.targets||[],seed=(skill.uid||1)*3.33,at=new Map(t.map((q,i)=>[q.uid,REWIND_STOP+.01*Math.min(i,12)]));
    const moves=t.filter(q=>q.p0!==undefined).map(q=>({uid:q.uid,from:q.p0,delay:REWIND_AT,dur:REWIND_STOP-REWIND_AT,ease:easeInOut}));
    skill.ur={seed,at,moves,t0:hash(seed,1)*Math.PI*2};return at;
  },
  // The hands tick slowly, race backwards with the rewind, then stand at twelve.
  hands(skill,age){const u=skill.ur,back=easeInOut(span(age,REWIND_AT,REWIND_STOP));return age<REWIND_STOP?[u.t0+age*.6-back*Math.PI*4,u.t0*.3+age*.05-back*Math.PI*.6]:[0,0];},
  field(fx,skill,age){
    const C=BOARD_CENTRE,k=span(age,.04,.3)*(1-span(age,1.15,1.7));if(!(k>0))return;const [m,h]=this.hands(skill,age);
    fx.glow('rays','#c4bcf4',C.x,C.y,700,.25*k,age*.1);
    kit2(fx,KIT2.clock,'chrono',C.x,C.y,640,undefined,0,.55*k);
    for(const [x,y,s,turn] of [[C.x-250,C.y-190,150,1],[C.x+255,C.y-175,120,-1.25],[C.x+235,C.y+215,170,.9]])kit2(fx,KIT2.gear,'gold',x,y,s,undefined,m*turn*.5,.5*k);
    clockHand(fx,'chrono',C.x,C.y,250,m,.85*k);clockHand(fx,'chrono',C.x,C.y,170,h,.85*k);
  },
  over(fx,skill,age){
    const u=skill.ur,ctx=fx.ctx,o=skill.origin,C=BOARD_CENTRE,stop=span(age,.04,.24)*(1-span(age,1.15,1.7));
    // Time stops: everything loses its colour; she alone keeps hers (drawn again on top).
    if(stop>0){
      ctx.save();ctx.globalCompositeOperation='saturation';ctx.globalAlpha=.85*stop;ctx.fillStyle='#808080';ctx.fillRect(0,0,720,780);ctx.globalCompositeOperation='color';ctx.globalAlpha=.3*stop;ctx.fillStyle='#8f84e8';ctx.fillRect(0,0,720,780);ctx.restore();
      const me=unitAt(fx,o);if(me&&fx.art?.hero){const dy=Math.sin((fx.clock||0)*2.5+me.uid)*1.6+(this.body(fx,skill,age)?.dy||0);fx.art.hero(ctx,me.hero,o.x,o.y+31+dy,126,{direction:me.facing||'down',form:unitForm(fx.s,me)});}
    }
    // Every enemy slides back; the stretch of road it gave back glows behind it.
    const back=span(age,REWIND_AT,REWIND_STOP),trail=back>0?(age<REWIND_STOP?1:1-span(age,REWIND_STOP,REWIND_STOP+.35)):0;
    if(trail>0){ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';ctx.lineJoin='round';
      for(const q of skill.targets||[]){const live=fx.enemies?.get(q.uid)?.enemy;if(q.p0===undefined||!live)continue;const p1=lerp(q.p0,live.progress,easeInOut(back));if(Math.abs(q.p0-p1)<4)continue;
        ctx.beginPath();for(let s=0;s<=10;s++){const P=pathPoint(lerp(p1,q.p0,s/10));s?ctx.lineTo(P.x,P.y-14):ctx.moveTo(P.x,P.y-14);}
        ctx.globalAlpha=.45*trail;ctx.strokeStyle='#8f84e8';ctx.lineWidth=10;ctx.stroke();ctx.globalAlpha=.9*trail;ctx.strokeStyle='#efeaff';ctx.lineWidth=2.5;ctx.stroke();}
      ctx.restore();}
    // Twelve: the clock strikes; every enemy is hit and stopped.
    const c=age-REWIND_STOP;
    if(c>=0&&c<.6){if(!u.struck){u.struck=true;stun(fx,6,.07);}kit(fx,KIT.flare,'chrono',C.x,C.y,420*(1-span(c,0,.3)),undefined,0,1-span(c,0,.35));kit(fx,KIT.ring,'chrono',C.x,C.y,lerp(160,900,easeOut(span(c,0,.5))),lerp(70,400,easeOut(span(c,0,.5))),0,.85*(1-span(c,0,.5)));wash(fx,'#efeaff',.2*(1-span(c,0,.3)));}
    for(const q of skill.targets||[]){const cc=age-u.at.get(q.uid);if(cc<0||cc>.5)continue;const P=fx.point(q.uid,q),y=P.y-30,a=1-span(cc,.25,.5);
      kit2(fx,KIT2.clock,'chrono',P.x,y,lerp(30,64,easeBack(span(cc,0,.2))),undefined,0,a);clockHand(fx,'chrono',P.x,y,22,0,a);kit(fx,KIT.flare,'chrono',P.x,y,90*(1-span(cc,0,.2)),undefined,0,1-span(cc,0,.25));}
  },
  body(fx,skill,age){if(fx.reduced)return null;return {dy:-4*bell(span(age,0,1))};},
};
// While the Time Ruler's stop holds an enemy, an hourglass turns over its head instead of the generic stun stars (effects.js).
export function drawTimeStop(fx,e,p,size){
  if(!(e.stun>0)||!e.statusEffects?.some(x=>x.type==='stun'&&x.owner==='time_ruler')||!urReady(fx,'time_ruler'))return false;
  const a=Math.min(1,e.stun/.25);
  const tilt=fx.reduced?0:Math.sin((fx.clock||0)*3+e.uid)*.14,hs=e.boss?40:30;kit2(fx,KIT2.hourglass,'chrono',p.x,p.y-size*.7-10,hs,undefined,tilt,a,'source-over');kit2(fx,KIT2.hourglass,'chrono',p.x,p.y-size*.7-10,hs,undefined,tilt,.5*a);
  kit(fx,KIT.ring,'chrono',p.x,p.y+6,size*.9,size*.38,0,.45*a);
  return true;
}

// =====================================================================================================================
// Pass 3 (2026-11-06): Cinderella, Venom, Doom, Rumi and her dream form, Red Dragon, Aurora and Shooting Star Boy, with ur-kit3
// (docs/art/ur-vfx3-20261106): ten luminance pieces (butterfly, flame, fire breath, shooting star, hand mirror, glass cracks, sun,
// crescent moon, star, bell) and four gray objects (spider lily, envelope, dagger, root).
export const KIT3=Object.freeze({butterfly:0,flame:1,breath:2,meteor:3,mirror:4,cracks:5,sun:6,crescent:7,star:8,bell:9,lily:10,envelope:11,dagger:12,root:13});
const KIT3_OBJECT=new Set([KIT3.lily,KIT3.envelope,KIT3.dagger,KIT3.root]),KIT3_SMALL=new Set([KIT3.butterfly]);
export function kit3(fx,frame,ramp,x,y,w,h=w,angle=0,alpha=1,blend='lighter',flip=1){drawPiece(fx,'ur-kit3',frame,ramp,x,y,w,h,angle,alpha,blend,flip);}

// ---------------------------------------------------------------------------------------------------------------------
// Cinderella · Miracle of Midnight. The engine strikes every enemy x3 and starts her midnight (10 s: the top Cinderella attacks 50%
// faster and every fourth attack rings the bell; her floor clock keeps the hour). She is the Time Magician's bright mirror image:
// Trauma's clock races backwards, cracks and shatters into the dark; hers is made whole. Night falls in midnight blue; star dust
// spirals up around her while glass shards fly in from the whole board and gather into a clock of glass above her, its hands
// sweeping forward to twelve; the bell inside it rings, each toll a ring of glass light crossing the floor and a glass star falling
// on every enemy it reaches; then the clock blooms into light and the glass slipper, the miracle itself, shines over her and settles
// at her feet.
const MIRACLE_TWELVE=.95,MIRACLE_TOLL=1250,MIRACLE_BLOOM=1.12;
const cinderella={
  life:()=>2.7,
  plan(fx,skill){
    const o=skill.origin,seed=(skill.uid||1)*5.53,P={x:o.x,y:Math.max(290,o.y-100)};
    const at=new Map((skill.targets||[]).map(q=>[q.uid,MIRACLE_TWELVE+dist(q,o)/MIRACLE_TOLL+.12]));
    skill.ur={seed,P,at,last:Math.max(0,...at.values())};return at;
  },
  field(fx,skill,age){
    const u=skill.ur,o=skill.origin,R=fx.reduced,night=span(age,.02,.3)*(1-span(age,1.6,2.4));
    vignette(fx,u.P.x,u.P.y,120,640,'#040a24',R?0:.5*night);wash(fx,'#0a1a4a',.22*night,'source-over');
    // Each toll of the bell: a ring of glass light rolls across the floor from her.
    for(const [j,k] of [0,.17,.34].entries()){const r=MIRACLE_TOLL*(age-MIRACLE_TWELVE-k);if(r<=0||r>1000)continue;kit(fx,KIT.ring,'miracle',o.x,o.y+20,2*r,.84*r,0,(j?.45:.9)*(1-r/1000));}
  },
  over(fx,skill,age){
    const u=skill.ur,o=skill.origin,P=u.P,R=fx.reduced,whole=1-span(age,MIRACLE_BLOOM,MIRACLE_BLOOM+.18);
    stars(fx,u.seed,span(age,.05,.4)*(1-span(age,1.6,2.4)),16);
    // The godmother's magic: star dust spirals up around her while glass shards fly in from the whole board to the clock.
    if(age<1)stardust(fx,{x:o.x,y:o.y-4},u.seed,span(age,.04,.5),age,1-span(age,.75,1),0,'#eef4ff','#6a9cff');
    for(let i=0;i<(R?8:26);i++){const t0=.06+hash(u.seed,i)*.32,k=span(age,t0,t0+.48);if(k<=0||k>=1)continue;const ang=hash(u.seed,i+40)*6.283,d=lerp(320+hash(u.seed,i+70)*220,0,easeIn(k));
      kit(fx,KIT.shard,'miracle',P.x+Math.cos(ang)*d,P.y+Math.sin(ang)*d*.8,lerp(20,9,k),undefined,ang+k*6,bell(k*.85+.15));}
    // The clock of glass forms, its hands sweeping forward to twelve, the bell hanging inside it.
    const form=easeBack(span(age,.28,.6));
    if(form>0&&whole>0){const size=200*form,sweep=easeInOut(span(age,.3,MIRACLE_TWELVE)),c=age-MIRACLE_TWELVE,swing=c>0?Math.sin(c*17)*.3*Math.exp(-c*2.5):0,hands=whole*(1-span(age,MIRACLE_TWELVE+.05,MIRACLE_TWELVE+.25));
      if(!R)fx.glow('glow','#4a6cff',P.x,P.y,size*1.6,.4*whole);fx.glow('glow','#ff6ab8',P.x,P.y+size*.2,size,.25*whole);
      kit2(fx,KIT2.clock,'miracle',P.x,P.y,size,undefined,0,whole);
      kit3(fx,KIT3.bell,'miracle',P.x,P.y+4,size*.5,undefined,swing,whole*span(age,.35,.6));
      clockHand(fx,'miracle',P.x,P.y,size*.37,lerp(Math.PI*.5,Math.PI*2,sweep),hands);clockHand(fx,'miracle',P.x,P.y,size*.26,lerp(Math.PI*1.5,Math.PI*2,sweep),hands);}
    // Twelve: the bell tolls three times.
    const c=age-MIRACLE_TWELVE;
    if(c>=0&&c<.6){if(!u.tolled){u.tolled=true;stun(fx,4,.05);}kit(fx,KIT.flare,'miracle',P.x,P.y,330*(1-span(c,0,.25)),undefined,0,1-span(c,0,.3));if(!R)fx.glow('rays','#8ab4ff',P.x,P.y,540*easeOut(span(c,0,.3)),.5*(1-span(c,.1,.6)),age*.3);
      for(const k of [.17,.34])if(c>=k&&c<k+.25)kit(fx,KIT.flare,'miracle',P.x,P.y+30,180*(1-span(c,k,k+.2)),undefined,0,.8*(1-span(c,k,k+.25)));}
    // The miracle: the clock blooms into light and the glass slipper shines over her, then settles at her feet.
    const b=age-MIRACLE_BLOOM;
    if(b>=0){
      if(b<.45){kit(fx,KIT.shatter,'miracle',P.x,P.y,lerp(220,460,easeOut(span(b,0,.4))),undefined,u.seed,1-span(b,.05,.45));wash(fx,'#ffd6ee',.2*(1-span(b,0,.4)));}
      if(!R)for(let i=0;i<22;i++){const k=span(b,0,1.1);if(k>=1)break;const ang=hash(u.seed,i+100)*6.283,v=120+hash(u.seed,i+130)*240;glint(fx,P.x+Math.cos(ang)*v*easeOut(k),P.y+Math.sin(ang)*v*easeOut(k)*.7+70*k*k,hash(u.seed,i+160)<.3?3.6:2.3,'#fff0fa','#ff8ad0',1-k,age*2+i);}
      if(fx.cinderellaEmblem==='miracle')miracleStar(fx,skill,age,b);
      const show=easeBack(span(b,.04,.32)),settle=easeInOut(span(b,.95,1.4)),alpha=fx.cinderellaEmblem==='miracle'?0:1-span(b,1.3,1.55);
      if(alpha>0&&show>0){const x=lerp(P.x,o.x+22,settle),y=lerp(P.y,o.y+22,settle),w=lerp(160,40,settle)*show,g=bell(span(b,.2,.6));
        if(!R)fx.glow('rays','#ffb0dc',x,y,w*2.7,.55*alpha*(1-settle),age*.6);fx.glow('glow','#ffc8ea',x,y,w*1.8,.45*alpha);
        kit2(fx,KIT2.slipper,'miracle',x,y,w,undefined,-.12,alpha,'source-over');kit(fx,KIT.flare,'miracle',x-w*.3,y-w*.1,w*.7*g,undefined,.4,g);}
    }
    // A glass star drops on every enemy as the toll reaches it and bursts into glitter.
    for(const q of skill.targets||[]){const at=u.at.get(q.uid),cc=age-at;if(cc<-.14||cc>.6)continue;const T=fx.point(q.uid,q),big=bossOf(fx,q)?1.4:1,y=T.y-(big>1?34:20);
      if(cc<0){const k=easeIn(span(cc,-.14,0)),fy=lerp(y-150,y,k);kit3(fx,KIT3.star,'miracle',T.x,fy,28*big,undefined,k*3,1);if(!R)glint(fx,T.x,fy-24,2.4,'#fff0fa','#ff6ab8',1,age*4);continue;}
      kit3(fx,KIT3.star,'miracle',T.x,y,lerp(36,96,easeOut(span(cc,0,.2)))*big,undefined,cc*2.5,1-span(cc,.1,.42));
      kit(fx,KIT.ring,'miracle',T.x,T.y+6,lerp(30,110,easeOut(span(cc,0,.35)))*big,lerp(12,44,easeOut(span(cc,0,.35)))*big,0,.8*(1-span(cc,.05,.4)));
      if(!R)for(let j=0;j<6;j++){const k=span(cc,0,.5),ang=hash(q.uid||1,j)*6.283;glint(fx,T.x+Math.cos(ang)*46*easeOut(k)*big,y+Math.sin(ang)*30*easeOut(k)+20*k*k,2.4,'#fff0fa','#ff8ad0',1-k,j);}
      if(!q.hit){q.hit=true;if(at>=u.last-.001)stun(fx,3,0);}}
  },
  body(fx,skill,age){if(fx.reduced)return null;const lift=bell(span(age,.04,MIRACLE_TWELVE+.3));return {dy:-7*lift,squash:1+.03*lift};},
};
// Proposal for the owner (2026-11-07, review page "기적 문양" switch; the game keeps the slipper until decided): the miracle itself
// as the emblem. In the bloom a wishing star is born over her: a holy circle turns behind it, twelve small stars (the twelve
// strokes) light around it one by one, it rises, and its light drifts down over her as glitter.
function miracleStar(fx,skill,age,b){
  const u=skill.ur,o=skill.origin,P=u.P,R=fx.reduced,show=easeBack(span(b,.04,.34)),fade=1-span(b,1.1,1.5),rise=easeInOut(span(b,.7,1.3));
  if(!(show>0&&fade>0))return;const x=P.x,y=P.y-46*rise,s=show*(1-.25*rise);
  if(!R)fx.glow('rays','#ff8ad0',x,y,400*s,.28*fade,age*.4);fx.glow('glow','#3a5cff',x,y,320*s,.4*fade);
  kit2(fx,KIT2.circle,'miracle',x,y,270*s,undefined,R?0:age*.5,fade);kit2(fx,KIT2.circle,'miracle',x,y,190*s,undefined,R?0:-age*.8,.6*fade);
  for(let i=0;i<12;i++){const on=span(b,.08+i*.035,.16+i*.035);if(on<=0)continue;const a=-Math.PI/2+i*Math.PI/6,r=126*s;
    glint(fx,x+Math.cos(a)*r,y+Math.sin(a)*r*.9,(i%3?3.4:5.6)*on,i%2?'#ffc4e4':'#a8c4ff',i%2?'#ff6ab8':'#4a6cff',fade,age*2+i);}
  kit(fx,KIT.flare,'miracle',x,y,100*s*(R?1:.85+.15*Math.sin(age*7)),undefined,age,.45*fade);
  kit3(fx,KIT3.star,'miracle',x,y,124*s,undefined,R?0:Math.sin(age*1.5)*.08,fade,'source-over');kit3(fx,KIT3.star,'miracle',x,y,124*s,undefined,R?0:Math.sin(age*1.5)*.08,.35*fade);
  // Its light drifts down over her, swaying as it falls.
  if(!R&&b>.85)for(let i=0;i<14;i++){const k=((b-.85)*1.4+hash(u.seed,i+200))%1,px=o.x+(hash(u.seed,i+220)-.5)*100+Math.sin(k*6+i)*10;
    glint(fx,px,lerp(y+30,o.y-6,k),2.3,'#fff0fa',i%2?'#ff8ad0':'#8ab4ff',bell(k)*fade,i+age*3);}
}
// Her midnight bell (every fourth attack during midnight, a splash on the boss or the target): the bell rings over it and a ring of
// glass light runs out to the real splash radius. effects.js keeps its older drawing when the kit is missing.
export function drawMidnightBell(fx,e,t){
  if(!urReady(fx,'cinderella'))return false;const age=t*e.total,r=e.radius||150,big=e.boss?1.35:1,y=e.y-(e.boss?40:26),R=fx.reduced;
  const drop=span(age,0,.14),swing=Math.sin(age*16)*.35*Math.exp(-age*3);
  kit3(fx,KIT3.bell,'miracle',e.x,lerp(y-110,y-46,easeOut(drop)),58*big,undefined,swing,1-span(age,.55,.85));
  if(age>.12){const k=easeOut(span(age,.12,.6));kit(fx,KIT.ring,'miracle',e.x,e.y+6,2*r*k/.9,2*r*k/.9*.42,0,.9*(1-span(age,.3,.7)));kit(fx,KIT.flare,'miracle',e.x,y,150*big*(1-span(age,.12,.35)),undefined,0,1-span(age,.12,.4));
    if(!R)for(let j=0;j<8;j++){const kk=span(age,.12,.7),ang=hash(e.x+e.y,j)*6.283;glint(fx,e.x+Math.cos(ang)*r*.6*easeOut(kk),y+Math.sin(ang)*r*.3*easeOut(kk)+30*kk*kk,2.4,'#fff0fa','#ff8ad0',1-kk,j);}}
  return true;
}

// ---------------------------------------------------------------------------------------------------------------------
// Venom · Plague. The engine strikes every enemy x3, adds three poison stacks and for 10 s doubles the burn and poison damage enemies
// take (the green ring under each enemy shows that). Her calm stays: no flash, no blast. The board dims; a black spider lily opens
// at her feet and poison butterflies leave it; black roots creep along the floor to every enemy, and where a root arrives a spider
// lily blooms under that enemy (the strike), poison breathes out of it and a butterfly lifts away; then the lilies wilt.
const ROOT_SPEED=760;
// A poison butterfly that left (x, y) `k` seconds ago: it flutters up and away, wings beating, then fades.
function butterfly(fx,x,y,seed,k,life,i,size=34){
  if(k<=0||k>=life)return;const f=k/life,dir=hash(seed,1)<.5?-1:1,flap=Math.abs(Math.cos(k*15+i*1.3));
  kit3(fx,KIT3.butterfly,'toxic',x+dir*(30+hash(seed,2)*60)*easeOut(f)+Math.sin(k*5+i)*12,y-(60+hash(seed,3)*90)*easeOut(f),size*lerp(.25,1,flap),size,Math.sin(k*4+i)*.3,bell(f)*.95);
}
const venom={
  life:()=>2.6,
  plan(fx,skill){
    const o=skill.origin,seed=(skill.uid||1)*3.91,t=[...(skill.targets||[])].sort((a,b)=>dist(a,o)-dist(b,o));
    const at=new Map(t.map(q=>[q.uid,.3+dist(q,o)/ROOT_SPEED]));
    skill.ur={seed,at,roots:new Set(t.slice(0,14).map(q=>q.uid)),last:Math.max(0,...at.values())};return at;
  },
  field(fx,skill,age){
    const u=skill.ur,o=skill.origin,R=fx.reduced,mood=span(age,.05,.35)*(1-span(age,1.8,2.6));
    vignette(fx,o.x,o.y,110,640,'#05020a',R?0:.5*mood);wash(fx,'#120818',.22*mood,'source-over');
    // Roots creep along the floor from her feet to the nearest fourteen enemies (the rest still bloom on time).
    for(const q of skill.targets||[]){if(!u.roots.has(q.uid))continue;const at=u.at.get(q.uid),grow=span(age,.3,at),fade=1-span(age,at+.5,at+1.1);if(grow<=0||fade<=0)continue;
      const T=fx.point(q.uid,q),A={x:o.x,y:o.y+20},B={x:T.x,y:T.y+6},L=Math.max(1,dist(A,B)),n=Math.max(1,Math.ceil(L/80)),bend=Math.min(60,L*.18)*(hash(u.seed,q.uid||1)<.5?-1:1);
      const C={x:(A.x+B.x)/2-(B.y-A.y)/L*bend,y:(A.y+B.y)/2+(B.x-A.x)/L*bend},seg=L/n*1.3;
      for(let s=0;s<n;s++){const f0=s/n;if(f0>=grow)break;const k=clamp01((grow-f0)*n),fm=Math.min(grow,(s+.5)/n),x=bez(A.x,C.x,B.x,fm),y=bez(A.y,C.y,B.y,fm),f2=Math.min(1,fm+.03);
        kit3(fx,KIT3.root,'root',x,y,seg/.9*lerp(.5,1,k),seg/.9*.8,Math.atan2(bez(A.y,C.y,B.y,f2)-y,bez(A.x,C.x,B.x,f2)-x),fade,'source-over',s%2?-1:1);}
      if(!R&&grow<1)fx.glow('glow','#5ad04a',bez(A.x,C.x,B.x,grow),bez(A.y,C.y,B.y,grow),50,.55*fade);
    }
  },
  over(fx,skill,age){
    const u=skill.ur,o=skill.origin,R=fx.reduced;
    // A black spider lily opens at her feet; butterflies leave it.
    const own=easeBack(span(age,.05,.3))*(1-span(age,1.7,2.3));
    if(own>0){if(!R)fx.glow('glow','#7a2ab0',o.x+22,o.y+6,140*own,.45*own);kitStanding(fx,KIT3.lily,'lily',o.x+24,o.y+34,70,own,1,.08,1,'source-over','ur-kit3');}
    if(!R)for(let i=0;i<4;i++)butterfly(fx,o.x+24,o.y-6,u.seed+i,age-.16-i*.08,1.7,i);
    // Where a root arrives a lily blooms under the enemy, poison breathes out and a butterfly lifts away; then the lily wilts.
    for(const q of skill.targets||[]){const at=u.at.get(q.uid),c=age-at;if(c<0||c>1.4)continue;const T=fx.point(q.uid,q),big=bossOf(fx,q)?1.45:1,grow=easeBack(span(c,0,.18)),wilt=span(c,.75,1.3);
      if(!R)fx.glow('glow','#6a1a9a',T.x,T.y-4,110*big,.5*(1-wilt)*Math.min(1,grow));
      kitStanding(fx,KIT3.lily,'lily',T.x,T.y+12,60*big,grow*(1-.4*wilt),hash(u.seed,q.uid||1)<.5?1:-1,0,1-wilt,'source-over','ur-kit3');
      kit(fx,KIT.mist,'toxic',T.x,T.y-22,lerp(50,130,easeOut(span(c,0,.6)))*big,undefined,c*1.5,.4*(1-span(c,.1,.7)));
      if(!R)butterfly(fx,T.x,T.y-26,u.seed+(q.uid||1)*3,c-.06,1.1,q.uid||0,30*big);
      if(!q.hit){q.hit=true;if(at>=u.last-.001)stun(fx,2,0);}}
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// Doom · Black Market of the Palace. The engine takes 40 gold and strikes every enemy x7, +1 per training and +1 for every 40 gold
// kept after paying (up to +5). The deal is the point, told the way a rapier spy would seal it: he flicks up a crown coin (the
// game's own coin, as in the Queen's fountain), it spins to a stop over his head and one thrust cuts it in two; from the cut a fan
// of shadow daggers opens, one for the deal and one more for every 40 gold he kept (the bonus); a dagger stands over every enemy
// at once, and one crimson X cuts them all together. Owner review, 2026-11-07: the black envelope read as a leather wallet, out
// of place for a rapier spy, so the envelope and the coins from the gold counter are gone.
const DOOM_SPLIT=.56,DOOM_CUT=1.02;
// The crown coin cut in two along `cut`: each half slides `apart` px off the cut line and turns by `turn`, opposite ways.
function halves(fx,x,y,size,cut,apart,turn,alpha){
  if(!(alpha>.004))return;const ctx=fx.ctx,nx=-Math.sin(cut),ny=Math.cos(cut);
  for(const s of [-1,1]){ctx.save();ctx.translate(x+nx*apart*s,y+ny*apart*s);ctx.rotate(turn*s+cut);ctx.beginPath();ctx.rect(-size,s<0?-size:0,size*2,size);ctx.clip();ctx.rotate(-cut);kit2(fx,KIT2.coin,'gold',0,0,size,size,0,alpha,'source-over');ctx.restore();}
}
// One cut along `angle` (the kit blade line stretched and thickened), centred on (x, y).
function slash(fx,ramp,x,y,len,angle,thick,alpha){const c=kitCanvas(fx,KIT.blade,ramp);if(!c||!(alpha>.004))return;const w=len/1.27,ctx=fx.ctx;ctx.save();ctx.globalAlpha*=Math.min(1,alpha);ctx.globalCompositeOperation='lighter';ctx.translate(x,y);ctx.rotate(angle);ctx.scale(1,thick);ctx.rotate(Math.PI/4);ctx.drawImage(c,-w/2,-w/2,w,w);ctx.restore();}
const doom={
  life:()=>2.3,
  plan(fx,skill){
    const o=skill.origin,at=new Map((skill.targets||[]).map(q=>[q.uid,DOOM_CUT+.02]));
    // The coin stops over his head, or beside it on the top two rows, where over his head would be under the cut-in band.
    const P=o.y-112>=262?{x:o.x,y:o.y-112}:{x:o.x+(o.x<360?84:-84),y:Math.max(262,o.y-40)};
    skill.ur={seed:(skill.uid||1)*9.17,at,P,blades:1+Math.max(0,Math.min(5,skill.bonus|0))};return at;
  },
  field(fx,skill,age){
    const o=skill.origin,R=fx.reduced,mood=span(age,.1,.4)*(1-span(age,1.5,2.2));
    vignette(fx,o.x,o.y-30,90,600,'#0a0206',R?0:.55*mood);wash(fx,'#1a0208',.25*mood,'source-over');
    // A pool of shadow opens under every enemy just before its dagger falls.
    const c=age-(DOOM_CUT-.4);if(c>0&&c<1.2)for(const q of skill.targets||[]){const T=fx.point(q.uid,q),k=easeOut(span(c,0,.3)),big=bossOf(fx,q)?1.4:1;kit(fx,KIT.mist,'shadow',T.x,T.y+8,lerp(30,96,k)*big,lerp(12,36,k)*big,0,.85*(1-span(c,.7,1.2)),'source-over');}
  },
  over(fx,skill,age){
    const u=skill.ur,o=skill.origin,R=fx.reduced,P=u.P;
    // He flicks up a crown coin: it spins to a stop at P, glinting each time it turns face-on, and hangs there for a beat.
    const up=span(age,.04,.44);
    if(up>0&&age<DOOM_SPLIT){const k=easeOut(up),x=lerp(o.x+8,P.x,k),y=lerp(o.y-16,P.y,k),turn=R?0:age*lerp(30,4,k),face=Math.abs(Math.cos(turn)),s=lerp(20,40,k);
      if(!R)fx.glow('glow','#ffb030',x,y,s*3,.4*k);kit2(fx,KIT2.coin,'gold',x,y,s*lerp(.16,1,face),s,0,1,'source-over');
      if(face>.96)glint(fx,x-s*.24,y-s*.24,s*.13,'#fff3c4','#ffb020',.9);}
    // One rapier thrust cuts it in two: the halves tumble apart, gold scatters and the seal of the deal flares crimson.
    const cut=age-DOOM_SPLIT;
    if(cut>=0&&cut<.5){if(!u.sealed){u.sealed=true;stun(fx,2,0);}
      slash(fx,'blood',P.x,P.y,lerp(50,170,easeOut(span(cut,0,.06))),-.5,lerp(2.2,1.2,span(cut,0,.2)),1-span(cut,.12,.3));
      halves(fx,P.x,P.y+90*cut*cut,40,-.5,lerp(2,30,easeOut(span(cut,0,.35))),cut*3,1-span(cut,.1,.3));
      kit(fx,KIT.flare,'gold',P.x,P.y,lerp(56,110,easeOut(span(cut,0,.12))),undefined,.2,1-span(cut,0,.25));
      kit(fx,KIT.flare,'blood',P.x,P.y,90*bell(span(cut,0,.32)),undefined,.6,.9);
      if(!R)for(let i=0;i<10;i++){const k=span(cut,0,.45),ang=hash(u.seed,i+20)*6.283,v=30+hash(u.seed,i+40)*50;kit(fx,KIT.shard,'gold',P.x+Math.cos(ang)*v*easeOut(k),P.y+Math.sin(ang)*v*.7*easeOut(k)+30*k*k,9,undefined,ang+k*6,1-k);}}
    // From the cut a fan of shadow daggers opens: one for the deal and one more for every 40 gold he kept. Six stay inside about
    // his own column, clear of the faces beside him.
    const fan=easeBack(span(age,DOOM_SPLIT+.04,DOOM_SPLIT+.22))*(1-span(age,.86,.98)),step=Math.min(.32,1/Math.max(1,u.blades-1));
    if(fan>0){if(!R)fx.glow('glow','#c01a30',P.x,P.y,240*fan,.4*fan);for(let i=0;i<u.blades;i++){const a=(i-(u.blades-1)/2)*step;kit3(fx,KIT3.dagger,'blade',P.x+Math.sin(a)*96*fan,P.y+66-Math.cos(a)*84*fan,72*fan,undefined,a,1,'source-over');}}
    // A dagger stands over every enemy at once, falls, and one crimson X cuts them all.
    const c=age-DOOM_CUT;
    for(const q of skill.targets||[]){const T=fx.point(q.uid,q),big=bossOf(fx,q)?1.4:1,y=T.y-(big>1?34:20),side=T.x<360?-1:1;
      const rise=span(age,DOOM_CUT-.3,DOOM_CUT-.06);if(rise>0&&c<.2){const fall=easeIn(span(c,-.06,.04)),dx=T.x+side*lerp(32,8,fall)*big,dy=y-lerp(50,10,fall)*big+(1-easeOut(rise))*20,a=rise*(1-span(c,0,.2));if(!R)fx.glow('glow','#c01a30',dx,dy,90*big,.5*a);kit3(fx,KIT3.dagger,'blade',dx,dy,62*big,undefined,Math.PI-side*.5,a,'source-over');}
      if(c<0||c>.6)continue;
      for(const a of [Math.PI/4,-Math.PI/4])slash(fx,'blood',T.x,y,lerp(70,150,easeOut(span(c,0,.08)))*big,a,lerp(2.6,1.6,span(c,0,.3)),1-span(c,.18,.55));
      kit(fx,KIT.flare,'blood',T.x,y,80*big*(1-span(c,0,.15)),undefined,0,.7*(1-span(c,0,.2)));
      if(!R)for(let j=0;j<5;j++){const k=span(c,0,.6),ang=hash(q.uid||1,j+9)*6.283;kit(fx,KIT.shard,'blood',T.x+Math.cos(ang)*50*easeOut(k)*big,y+Math.sin(ang)*30*easeOut(k)+40*k*k,12,undefined,ang+k*6,1-k);}
    }
    if(c>=0&&c<.4){if(!u.cut){u.cut=true;stun(fx,6,.06);}wash(fx,'#ff2040',.14*(1-span(c,0,.3)));}
  },
  body(fx,skill,age){if(fx.reduced)return null;const k=bell(span(age,.5,1.15));return {dy:-3*k,angle:-.04*k};},
};

// ---------------------------------------------------------------------------------------------------------------------
// Rumi · Echo of Dreams (below 5 stars). For 8 s every ally attack fires one more attack at 65% (the HUD timer and the board-edge glow
// show it; nothing stays on the units). A quiet beat, as the owner asked: she lifts her quill and draws a constellation through the
// formation, a star lighting on each ally as the line reaches it; the figure twinkles once and fades.
const rumi={
  life:()=>1.7,
  plan(fx,skill){
    const o=skill.origin,left=(skill.targets||[]).filter(q=>!casterAt(skill,q)),path=[{x:o.x,y:o.y}];
    while(left.length&&path.length<13){const last=path.at(-1);let best=0;for(let i=1;i<left.length;i++)if(dist(left[i],last)<dist(left[best],last))best=i;path.push(left.splice(best,1)[0]);}
    skill.ur={seed:(skill.uid||1)*2.29,path,step:.07};return null;
  },
  over(fx,skill,age){
    const u=skill.ur,o=skill.origin,R=fx.reduced,ctx=fx.ctx,quill={x:o.x+18,y:o.y-74},out=1-span(age,1.2,1.7),nodes=u.path,draw=(age-.18)/u.step;
    // The quill rises over her and writes.
    const lift=easeBack(span(age,0,.22))*out;if(lift>0){kit2(fx,KIT2.feather,'dream',quill.x,quill.y-10*lift,46*lift,undefined,-.6+Math.sin(age*9)*.12,1);glint(fx,quill.x-14,quill.y+12,3.2,'#ffffff','#7dddf1',lift,age*3);}
    // The constellation: a line from star to star.
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
    for(let i=1;i<nodes.length;i++){const k=clamp01(draw-(i-1));if(k<=0)break;const a=nodes[i-1],b=nodes[i],ay=a.y-38,by=b.y-38;
      for(const [w,c,al] of [[7,'#7dddf1',.22],[2.2,'#e8fbff',.9]]){ctx.globalAlpha=al*out;ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(a.x,ay);ctx.lineTo(lerp(a.x,b.x,k),lerp(ay,by,k));ctx.stroke();}}
    ctx.restore();
    // A star lights on each ally as the line reaches it; the finished figure twinkles once.
    const tw=bell(span(age,.95,1.35));
    for(let i=0;i<nodes.length;i++){const lit=i===0?span(age,.1,.25):span(draw-(i-1),1,1.4);if(lit<=0)continue;const n=nodes[i];
      glint(fx,n.x,n.y-38,(i===0?4.2:3.2)*lerp(1.6,1,lit)*(1+.3*tw),'#ffffff','#7dddf1',out*Math.min(1,lit*2),age+i);if(tw>0&&!R)fx.glow('glow','#9ae6ff',n.x,n.y-38,60,.35*tw*out);}
  },
  body(fx,skill,age){if(fx.reduced)return null;return {dy:-4*bell(span(age,0,.6))};},
};

// ---------------------------------------------------------------------------------------------------------------------
// Rumi's dream form (5 stars). The engine strikes in four volleys (kind 'dream' in s.volleys: the sun at 0.45 s, the moon at 1.0 s, the
// star at 1.55 s and the dream itself at 2.3 s of game time, each arriving as a dreamPhase event). Each symbol rises into the sky while
// its volley counts down (read from the engine, so it keeps time through the slow motion and at any speed) and strikes when its event
// comes: the sun sends a beam down on every enemy, the moon a crescent cut, the star a burst of starlight. Then sun, moon and star
// circle in and fold into one, and the imagined becomes real: a pastel bloom over the whole board and a star on every enemy. Drawn
// from effects.js (the dream is not a sequenced cast); each strike is its own effect so it outlives the cast.
// The sun and moon rise over the left and right roads while the cut-in band covers the top of the board, clear of the formation; the
// star comes after the band lifts, over the top road. They fold into one over the middle of the board.
const DREAM_SKY=[{x:100,y:430},{x:620,y:430},{x:360,y:185}],DREAM_LEAD=[.45,.55,.55,.75],DREAM_FOLD={x:360,y:380};
const DREAM_SYMBOL=[[KIT3.sun,'gold','#ffc84a',200],[KIT3.crescent,'dreamMoon','#7aa8ff',190],[KIT3.star,'dreamStar','#ff8ac8',190]];
const DREAM_RAMPS=['dreamStar','dream','dreamMoon','gold'];
export const dreamReady=fx=>['ur-kit','ur-kit2','ur-kit3'].every(id=>fx.art?.images?.[id]);
function dreamPhase(fx,p){const v=fx.s?.volleys?.find(v=>v.kind==='dream'&&v.hero==='rumi'&&v.phase===p),hit=fx.dreamStrikes?.get(p);return {left:v?v.life:null,since:hit?(fx.clock||0)-hit.at:null};}
function dreamStrike(fx,e,t){
  const c=t*e.total,R=fx.reduced;
  if(e.phase===3){
    // The dream: a pastel bloom over the whole board and a star on every enemy.
    const C=DREAM_FOLD;wash(fx,'#ffd6f0',.28*(1-span(c,0,.35)));kit(fx,KIT.flare,'dream',C.x,C.y,lerp(260,700,easeOut(span(c,0,.3))),undefined,0,1-span(c,0,.35));
    if(!R)fx.glow('rays','#ffc4ec',C.x,C.y,900*easeOut(span(c,0,.4)),.55*(1-span(c,.2,1)),c*.4);
    DREAM_RAMPS.forEach((ramp,i)=>{const k=easeOut(span(c,i*.07,i*.07+.7));if(k>0&&k<1)kit(fx,KIT.ring,ramp,C.x,C.y+40,lerp(120,1100,k),lerp(50,470,k),0,.9*(1-k));});
    if(!R)for(let i=0;i<34;i++){const t0=hash(e.seed,i)*.2,k=span(c,t0,t0+.9);if(k<=0||k>=1)continue;const ang=hash(e.seed,i+40)*6.283,v=150+hash(e.seed,i+80)*380;glint(fx,C.x+Math.cos(ang)*v*easeOut(k),C.y+Math.sin(ang)*v*.7*easeOut(k)+80*k*k,hash(e.seed,i+120)<.3?4:2.6,'#ffffff',['#ff9ad0','#7adcf0','#8ab0ff','#ffd06a'][i%4],1-k,c*2+i);}
    for(const [i,q] of e.targets.entries()){const T=fx.point(q.uid,q),k=span(c,.04,.55);if(k>=1)continue;kit3(fx,KIT3.star,DREAM_RAMPS[i%4],T.x,T.y-22,lerp(40,110,easeOut(k)),undefined,k*3,1-k);}
    return;
  }
  for(const q of e.targets){const T=fx.point(q.uid,q),y=T.y-22;
    if(e.phase===0){pillar(fx,'gold',T.x,y-260,y+12,lerp(30,10,easeOut(span(c,0,.4))),1-span(c,.1,.5));kit(fx,KIT.flare,'gold',T.x,y,lerp(130,60,span(c,0,.3)),undefined,0,1-span(c,0,.35));}
    else if(e.phase===1){const k=easeOut(span(c,0,.25));kit(fx,KIT.crescent,'dreamMoon',T.x,y,lerp(60,130,k),undefined,-.6+k*1.2,1-span(c,.15,.5));kit(fx,KIT.flare,'dreamMoon',T.x,y,100*(1-span(c,0,.25)),undefined,0,1-span(c,0,.3));}
    else{kit3(fx,KIT3.star,'dreamStar',T.x,y,lerp(40,100,easeOut(span(c,0,.2))),undefined,c*3,1-span(c,.1,.45));if(!R)for(let j=0;j<4;j++){const k=span(c,0,.45),ang=hash(q.uid||1,j)*6.283;glint(fx,T.x+Math.cos(ang)*40*easeOut(k),y+Math.sin(ang)*26*easeOut(k),2.4,'#fff8e0','#ff8ac8',1-k,j);}}
  }
}
export const DREAM={
  start(fx){fx.dreamStrikes=new Map();},
  // One volley landed (effects.js event): remember when, and draw its strike on the enemies it hit.
  strike(fx,e){
    (fx.dreamStrikes||(fx.dreamStrikes=new Map())).set(e.phase,{at:fx.clock||0});const life=e.phase===3?1.3:.75;
    fx.add?.({type:'urFx',phase:e.phase,targets:(e.targets||[]).slice(0,24),seed:((fx.clock||1)*7.7)%97+1,life,total:life,draw:dreamStrike});
    if(e.phase===3)stun(fx,0,.08);
  },
  field(fx,skill,age){const R=fx.reduced,night=span(age,.02,.3)*(1-span(age,skill.total-.3,skill.total));vignette(fx,360,380,140,640,'#0a0626',R?0:.45*night);wash(fx,'#140a36',.2*night,'source-over');},
  over(fx,skill,age){
    const R=fx.reduced,end=1-span(age,skill.total-.25,skill.total),fin=dreamPhase(fx,3),fold=fin.since!==null?1:fin.left!==null?clamp01(1-fin.left/DREAM_LEAD[3]):0;
    if(fin.since!==null)return;
    for(let p=0;p<3;p++){const ph=dreamPhase(fx,p),[piece,ramp,glow,size]=DREAM_SYMBOL[p],rise=ph.since!==null?1:ph.left!==null?clamp01(1-ph.left/DREAM_LEAD[p]):0;if(rise<=0)continue;
      // It rises, flashes at its strike, then hangs dimmer in the sky until the three fold into one.
      const strike=ph.since===null?0:1-span(ph.since,0,.35),dim=ph.since===null?1:lerp(.6,1,strike),pop=easeBack(rise);let {x,y}=DREAM_SKY[p];
      if(fold>0){const a=Math.atan2(y-DREAM_FOLD.y,x-DREAM_FOLD.x)+fold*4,r=Math.hypot(x-DREAM_FOLD.x,y-DREAM_FOLD.y)*(1-easeIn(fold));x=DREAM_FOLD.x+Math.cos(a)*r;y=DREAM_FOLD.y+Math.sin(a)*r*.8;}
      const s=size*pop*lerp(1,.45,easeIn(fold))*(1+.12*strike),alpha=.9*end*dim;
      if(!R)fx.glow('rays',glow,x,y,s*2.2,.45*alpha,age*(p===0?.5:p===1?-.3:.8));fx.glow('glow',glow,x,y,s*1.5,.4*alpha);
      kit3(fx,piece,ramp,x,y,s,undefined,p===2?age*.8:p===0?age*.25:0,alpha);
      if(strike>0)kit(fx,KIT.flare,ramp,x,y,s*1.4*strike,undefined,0,strike);
    }
    // As the three meet, a heart of light swells where the dream will open.
    if(fold>0)kit(fx,KIT.flare,'dream',DREAM_FOLD.x,DREAM_FOLD.y,lerp(20,220,easeIn(fold)),undefined,age*2,fold*end);
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// Red Dragon · Dragon Breath (R). The engine burns the densest pack: every enemy within 180 of the most crowded enemy takes x14 and a
// strong burn. The area is the point, at an R's weight (about Ash's Armageddon or less): a ring of heat marks the real radius on the
// floor while she breathes in; one jet of fire crosses to the pack; the pack goes up in one burst, the ring flaring at its true
// edge, a column of flame at the centre and a tongue of fire under each enemy, the centre first.
// Her art is four fixed views (front, back, two profiles) whose mouth never opens, and the first jet left the top of her head
// (owner review, 2026-11-07). Now she turns to the pack for the cast (body.direction, as the Gold Dragon turns for her breath),
// the ember and the jet start just past the lips of that view, and a flash at the lips hides that they do not open. Facing away,
// the breath is drawn under her, so it comes out in front of her and rises past her head, which lights from behind.
const BREATH_AT=.3,BREATH_HIT=.46;
// The mouth in each view, from the unit art (512 cell, foot .9375, drawn 126 px with the foot at cellPoint + 31): the front grin,
// each profile's lips, and the hidden mouth behind her head when she faces away.
const RED_MOUTH={down:{x:0,y:-21},left:{x:-13,y:-18},right:{x:11,y:-19},up:{x:0,y:-21}};
// She breathes in (sparks drawn into an ember just past her lips), the lips flash, and one jet of fire runs to the pack. The jet
// piece is narrow at its left end, so that end is pinned to the lips while the jet grows.
function redBreath(fx,skill,age){
  const u=skill.ur,M=u.mouth,C=u.C,ang=u.ang,red=fx.reduced;
  if(age<BREATH_AT+.1){const k=span(age,.04,BREATH_AT),out=1-span(age,BREATH_AT,BREATH_AT+.1);
    if(u.under)fx.glow('glow','#ff6a20',M.x,M.y-24,lerp(40,110,k),.5*k*out);
    if(!u.under)fx.glow('glow','#ff5a18',M.x,M.y,lerp(24,64,k),.35*k*out);
    kit(fx,KIT.flare,'fire',M.x,M.y,lerp(10,30,easeIn(k)),undefined,age*4,Math.min(1,k*3)*out);
    if(!red)for(let i=0;i<8;i++){const f=(hash(u.seed,i)+age*2.4)%1,a=hash(u.seed,i+9)*6.283,r=lerp(60,4,f);kit(fx,KIT.shard,'fire',M.x+Math.cos(a)*r,M.y+Math.sin(a)*r*.8,9,undefined,a,bell(f)*k*out);}}
  if(age>BREATH_AT&&age<BREATH_HIT+.08){const L=dist(M,C)*easeOut(span(age,BREATH_AT,BREATH_HIT)),a=1-span(age,BREATH_HIT,BREATH_HIT+.08),w=Math.max(40,L/.83),mid=w*.43;
    kit3(fx,KIT3.breath,'fire',M.x+Math.cos(ang)*mid,M.y+Math.sin(ang)*mid,w,Math.min(w,150)*.9,ang,a);
    kit(fx,KIT.flare,'fire',M.x,M.y,lerp(44,26,span(age,BREATH_AT,BREATH_HIT)),undefined,age*3,a);
    kit(fx,KIT.flare,'fire',M.x+Math.cos(ang)*L,M.y+Math.sin(ang)*L,100,undefined,0,a);}
}
const redDragon={
  life:()=>1.5,
  plan(fx,skill){
    const o=skill.origin,C=skill.blast||skill.targets?.[0]||o,R=skill.radius||180,face=attackDirection(o,C),m=RED_MOUTH[face];
    const ang=Math.atan2(C.y-o.y-m.y,C.x-o.x-m.x),mouth={x:o.x+m.x+Math.cos(ang)*7,y:o.y+m.y+Math.sin(ang)*7};
    const at=new Map((skill.targets||[]).map(q=>[q.uid,BREATH_HIT+.08*dist(q,C)/R]));
    skill.ur={seed:(skill.uid||1)*4.47,C,R,at,face,dir:C.x>=o.x?1:-1,ang,mouth,under:face==='up'};return at;
  },
  field(fx,skill,age){
    const u=skill.ur,{C,R}=u,ring=2*R/.9,mark=span(age,0,.12)*(1-span(age,1,1.5));
    if(mark>0){fx.glow('glow','#ff4a10',C.x,C.y+6,R*2.2,.2*mark);kit(fx,KIT.ring,'fire',C.x,C.y+6,ring,ring*.42,0,.7*mark);
      if(age<BREATH_HIT)for(let i=0;i<2;i++){const k=(age*2.4+i/2)%1;kit(fx,KIT.ring,'fire',C.x,C.y+6,ring*lerp(1,.3,k),ring*.42*lerp(1,.3,k),0,.5*bell(k));}}
    const c=age-BREATH_HIT;if(c>0){const ctx=fx.ctx;ctx.save();ctx.globalAlpha=.28*(1-span(c,.3,1));ctx.fillStyle='#1a0602';ctx.beginPath();ctx.ellipse(C.x,C.y+8,R*.72,R*.3,0,0,Math.PI*2);ctx.fill();ctx.restore();}
    if(u.under)redBreath(fx,skill,age);
  },
  over(fx,skill,age){
    const u=skill.ur,{C,R}=u,red=fx.reduced;
    if(!u.under)redBreath(fx,skill,age);
    // The burst: the ring flares at its true edge, a column of flame at the centre and a tongue of fire under each enemy.
    const c=age-BREATH_HIT;if(c<0)return;
    if(!u.burst){u.burst=true;stun(fx,4,.03);}
    if(c<.45){const g=lerp(.9,1.08,easeOut(span(c,0,.3)));kit(fx,KIT.shatter,'fire',C.x,C.y-10,lerp(R*.8,R*1.6,easeOut(span(c,0,.35))),undefined,u.seed,1-span(c,.05,.45));kit(fx,KIT.ring,'fire',C.x,C.y+6,2*R/.9*g,2*R/.9*.42*g,0,1-span(c,.1,.45));wash(fx,'#ff7a2a',.1*(1-span(c,0,.25)));}
    kitStanding(fx,KIT3.flame,'fire',C.x,C.y+12,160,easeOut(span(c,0,.12))*(1-span(c,.35,.8)),1,0,1-span(c,.45,.8),'lighter','ur-kit3');
    for(const q of skill.targets||[]){const cc=age-u.at.get(q.uid);if(cc<0||cc>.6)continue;const T=fx.point(q.uid,q),big=bossOf(fx,q)?1.4:1;
      kitStanding(fx,KIT3.flame,'fire',T.x,T.y+10,76*big,easeOut(span(cc,0,.1))*(1-span(cc,.3,.6)),hash(u.seed,q.uid||1)<.5?1:-1,0,1-span(cc,.35,.6),'lighter','ur-kit3');}
    if(!red)for(let i=0;i<14;i++){const k=span(c,0,.9);if(k>=1)break;const ang=hash(u.seed,i+30)*6.283,v=R*(.4+hash(u.seed,i+50)*.7);kit(fx,KIT.shard,'fire',C.x+Math.cos(ang)*v*easeOut(k),C.y-10+Math.sin(ang)*v*.45*easeOut(k)-60*k,11,undefined,ang+k*5,1-k);}
  },
  // She faces the pack for the whole cast, also with reduced motion (a turn is not motion); the rear-back and lunge are motion.
  body(fx,skill,age){const face=skill.ur.face;if(fx.reduced)return {direction:face};const a=bell(span(age,0,BREATH_AT)),b=bell(span(age,BREATH_AT,BREATH_HIT+.1));return {direction:face,dy:2*a,squash:1-.05*a+.05*b,angle:skill.ur.dir*.06*b};},
};

// ---------------------------------------------------------------------------------------------------------------------
// Aurora · Thousand-Faced Mirror (R). The engine hangs a mirror on the toughest enemy for 5 s; it stores the damage that enemy takes
// (x its ratio) and bursts with it plus x12. A hand mirror rises over the target; every hit it catches flies into it as a shard of
// light; its glass fills (the stored echo against the x12 strike) and cracks as the seconds run; at five it shatters and its light
// falls on the target. This replaces the old fill, which read a cap the engine no longer sets and so always showed empty.
const mirrorState=new WeakMap();
// The cast itself (owner review, 2026-11-07: the old emblem at the caster said "an ultimate fired", the first pass lost that): a prism
// ring opens at her feet, her own hand mirror rises over her and flashes, and its reflection crosses the board to the target, where
// the hanging mirror takes the light. At an R's weight: about half a second, one prop.
const AURORA_BEAM=[.14,.3];
const aurora={
  life:()=>.95,
  plan(fx,skill){skill.ur={seed:(skill.uid||1)*6.61};return null;},
  field(fx,skill,age){const o=skill.origin,k=span(age,0,.55);if(k>=1)return;
    fx.glow('glow','#b48cff',o.x,o.y+20,lerp(80,200,easeOut(k)),.45*(1-k));kit(fx,KIT.ring,'prism',o.x,o.y+24,lerp(60,230,easeOut(k)),lerp(24,92,easeOut(k)),0,1-k);},
  over(fx,skill,age){
    const o=skill.origin,q=skill.targets?.[0],R=fx.reduced,M={x:o.x,y:o.y-80},up=easeBack(span(age,0,.16)),gone=1-span(age,.4,.58);
    if(up>0&&gone>0){fx.glow('glow','#b48cff',M.x,M.y,220*up,.7*gone);kit3(fx,KIT3.mirror,'prism',M.x,M.y,104*up,undefined,R?0:Math.sin(age*9)*.12,gone);
      const flash=bell(span(age,.08,.26));if(flash>0){kit(fx,KIT.flare,'prism',M.x,M.y-12,170*flash,undefined,age,flash);glint(fx,M.x-14,M.y-20,8*flash,'#ffffff','#c070f0',flash,age*3);}}
    if(!q)return;const T=fx.point(q.uid,q),big=bossOf(fx,q)?1.35:1,Tm={x:T.x,y:T.y-(big>1?140:100)};
    // The reflection: a prism streak runs from her mirror to the target's.
    const r=span(age,AURORA_BEAM[0],AURORA_BEAM[1]);
    if(r>0&&age<AURORA_BEAM[1]+.12){const h=easeOut(r),H={x:lerp(M.x,Tm.x,h),y:lerp(M.y,Tm.y,h)},L=dist(M,H),a=1-span(age,AURORA_BEAM[1],AURORA_BEAM[1]+.12);
      if(L>4)slash(fx,'prism',(M.x+H.x)/2,(M.y+H.y)/2,L,Math.atan2(H.y-M.y,H.x-M.x),1.1,a);kit(fx,KIT.flare,'prism',H.x,H.y,70,undefined,age*4,a);glint(fx,H.x,H.y,6,'#ffffff','#c070f0',a,age*5);}
    const k=span(age,AURORA_BEAM[1]-.02,AURORA_BEAM[1]+.3);if(k<=0)return;
    kit(fx,KIT.flare,'prism',Tm.x,Tm.y,lerp(60,230,easeOut(k))*big,undefined,0,1-span(k,.4,1));
    kit(fx,KIT.ring,'prism',T.x,T.y+6,lerp(40,160,easeOut(k))*big,lerp(16,64,easeOut(k))*big,0,1-span(k,.5,1));},
  body(fx,skill,age){if(fx.reduced)return null;const k=bell(span(age,0,.5));return {dy:-5*k,squash:1+.03*k};},
  // For the 5 s: the mirror over its target, from the engine's finisher state.
  persistentOver(fx,s){
    const now=fx.clock||0;
    for(const f of s.finishers||[]){if(f.kind!=='mirror'||f.hero!=='aurora')continue;const e=fx.enemies?.get(f.target);if(!e||!((e.enemy?.hp??e.hp)>0))continue;
      let st=mirrorState.get(f);if(!st){st={seen:f.stored||0,shards:[],born:now,n:0};mirrorState.set(f,st);}
      if((f.stored||0)>st.seen+.5){st.seen=f.stored;if(st.shards.length<12)st.shards.push({t:now,a:hash(f.uid,++st.n)*6.283});}
      st.shards=st.shards.filter(sh=>now-sh.t<.32);
      const P=e.point,boss=!!e.enemy.boss,big=boss?1.35:1,p=clamp01(1-f.life/f.total),fill=clamp01((f.stored||0)*(f.ratio??.5)/Math.max(1,f.damage)),bob=fx.reduced?0:Math.sin(now*2.4+f.uid)*3;
      const M={x:P.x,y:P.y-(boss?150:96)+bob},w=124*big*easeBack(span(now-st.born,0,.3)),ctx=fx.ctx;
      fx.glow('glow','#b48cff',M.x,M.y,w*1.5,.35+.5*fill);
      // A thread of light ties the mirror to the enemy it watches.
      const g=ctx.createLinearGradient(0,M.y+w*.4,0,P.y-34);g.addColorStop(0,'#c070f0cc');g.addColorStop(1,'#80d8ff00');ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.7;ctx.strokeStyle=g;ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(M.x,M.y+w*.4);ctx.lineTo(P.x,P.y-34);ctx.stroke();ctx.restore();
      kit3(fx,KIT3.mirror,'prism',M.x,M.y,w,undefined,Math.sin(now*1.3+f.uid)*.05,.95);
      kit(fx,KIT.flare,'prism',M.x,M.y-w*.12,w*lerp(.25,.75,fill),undefined,now*.6,.35+.6*fill);
      if(p>.2)kit3(fx,KIT3.cracks,'prism',M.x,M.y-w*.12,w*lerp(.3,.62,span(p,.2,1)),undefined,f.uid,.2+.65*span(p,.2,1));
      for(const sh of st.shards){const k=(now-sh.t)/.32;kit(fx,KIT.shard,'prism',lerp(P.x+Math.cos(sh.a)*26,M.x,easeIn(k)),lerp(P.y-18+Math.sin(sh.a)*16,M.y,easeIn(k)),13,undefined,sh.a+k*6,1-.4*k);}
    }
  },
  // At five seconds the mirror shatters and its light falls on the target (effects.js adds this effect at the finisher event).
  impactLife:.8,
  impact(fx,e,t){
    const c=t*e.total,R=fx.reduced,big=e.targetBoss?1.35:1,M={x:e.x,y:e.y-(e.targetBoss?150:96)},T={x:e.x,y:e.y-(e.targetBoss?34:20)},hit=!!e.hit;
    kit3(fx,KIT3.cracks,'prism',M.x,M.y-10,lerp(80,190,easeOut(span(c,0,.25)))*big,undefined,0,1-span(c,.1,.4));
    kit(fx,KIT.shatter,'prism',M.x,M.y,lerp(90,240,easeOut(span(c,0,.35)))*big,undefined,1.3,(hit?1:.5)*(1-span(c,.05,.45)));
    if(!R)for(let j=0;j<12;j++){const k=span(c,0,.6),ang=hash(e.x+e.y,j)*6.283,v=50+hash(e.y,j+5)*90;kit(fx,KIT.shard,'prism',M.x+Math.cos(ang)*v*easeOut(k),M.y+Math.sin(ang)*v*.7*easeOut(k)+80*k*k,14,undefined,ang+k*8,1-k);}
    if(!hit)return;if(!e.struck){e.struck=true;stun(fx,4,.04);}
    pillar(fx,'prism',T.x,M.y,T.y+10,lerp(40,12,easeOut(span(c,0,.3)))*big,1-span(c,.1,.45));
    kit(fx,KIT.flare,'prism',T.x,T.y,lerp(220,90,span(c,0,.3))*big,undefined,0,1-span(c,0,.4));
    kit(fx,KIT.ring,'prism',T.x,e.y+6,lerp(40,180,easeOut(span(c,0,.45)))*big,lerp(16,74,easeOut(span(c,0,.45)))*big,0,1-span(c,.05,.5));
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// Shooting Star Boy · Wish upon a Star (C). The engine spends the whole starlight gauge and drops a meteor on the toughest enemy 0.3 s
// later (x0.5 per starlight spent). At a C's weight: an aiming ring on the target with the starlight poured in, one shooting star
// falling across the sky onto it (bigger the more he spent: 1x at 60, 1.35x at 120) and a star-shaped burst where it lands.
const starBoy={
  life:()=>1,
  plan(fx,skill){const t=skill.targets?.[0]||skill.origin,spent=Math.round(skill.spent||60),scale=lerp(1,1.35,clamp01((spent-60)/60));skill.ur={uid:t.uid,lock:{x:t.x,y:t.y},spent,scale,p:0};fx.starScale=scale;return null;},
  progress(fx,skill){const u=skill.ur,f=fx.s?.finishers?.find(f=>f.hero==='star_boy'&&f.kind==='starfall'&&f.origin&&casterAt(skill,f.origin));if(f){u.p=clamp01(1-f.life/f.total);u.to=f.to;}else if(u.p>0||skill.total-skill.life>.6)u.p=1;return u.p;},
  field(fx,skill,age){const u=skill.ur,o=skill.origin,w=span(age,0,.5);if(w<1){fx.glow('glow','#56ccff',o.x,o.y+20,lerp(70,180,easeOut(w)),.4*(1-w));kit(fx,KIT.ring,'comet',o.x,o.y+24,lerp(50,200,easeOut(w)),lerp(20,80,easeOut(w)),0,1-w);}
    const p=this.progress(fx,skill);if(p>=1)return;const T=fx.point(u.uid,u.to||u.lock),big=bossOf(fx,{uid:u.uid})?1.3:1,a=Math.min(1,age*6);
    fx.glow('glow','#56ccff',T.x,T.y+4,120*big,.3*a);kit(fx,KIT.ring,'comet',T.x,T.y+6,lerp(120,72,p)*big,lerp(50,30,p)*big,0,.9*a);},
  over(fx,skill,age){
    // The cast itself (owner review, 2026-11-07): he makes his wish. The starlight he spent swirls up around him into a star in his
    // hands, and the star shoots up into the sky; the meteor that falls on the target is its answer. A C's weight: half a second.
    const o=skill.origin,u=skill.ur,R=fx.reduced,wish=span(age,0,.5);
    if(wish<1){fx.glow('glow','#56ccff',o.x,o.y-30,lerp(60,130,span(age,0,.2)),.45*(1-wish));
      if(!R)stardust(fx,{x:o.x,y:o.y-4},u.lock.x+u.lock.y,span(age,0,.3),age,1-span(age,.3,.5),0,'#e8fbff','#56ccff');
      const rise=easeIn(span(age,.12,.42)),S={x:o.x,y:lerp(o.y-44,o.y-300,rise)},sa=1-span(age,.38,.46);
      if(rise>0)slash(fx,'comet',S.x,(S.y+o.y-44)/2,o.y-44-S.y,-Math.PI/2,1,sa);
      const launch=bell(span(age,.08,.24));if(launch>0)kit(fx,KIT.flare,'comet',o.x,o.y-44,180*launch,undefined,age*2,launch);
      kit(fx,KIT.flare,'comet',S.x,S.y,lerp(50,110,easeOut(span(age,0,.14)))*(1-.4*rise),undefined,age*3,.8*sa);
      kit3(fx,KIT3.star,'comet',S.x,S.y,lerp(30,58,easeOut(span(age,0,.14)))*(1-.35*rise),undefined,age*4,sa);glint(fx,S.x,S.y,6*sa,'#ffffff','#56ccff',sa,age*6);}
    const p=this.progress(fx,skill);if(p>=1)return;const T=fx.point(u.uid,u.to||u.lock),big=bossOf(fx,{uid:u.uid})?1.3:1,head={x:T.x,y:T.y-(big>1?34:20)},S={x:head.x-230,y:head.y-290};
    label(fx,'★'+u.spent,T.x,T.y+42,Math.min(1,age*6),18,'#bdf0ff');
    // The shooting star: its painted head sits at (+.40, +.36) of the cell from the centre, its streak tilted 43 degrees.
    const k=easeIn(p),H={x:lerp(S.x,head.x,k),y:lerp(S.y,head.y,k)},w=130*u.scale,rot=Math.atan2(head.y-S.y,head.x-S.x)-Math.atan2(.76,.82),ox=.4*w,oy=.36*w;
    kit3(fx,KIT3.meteor,'comet',H.x-(ox*Math.cos(rot)-oy*Math.sin(rot)),H.y-(ox*Math.sin(rot)+oy*Math.cos(rot)),w,undefined,rot,Math.min(1,p*4+.3));
    glint(fx,H.x,H.y,4*u.scale,'#ffffff','#56ccff',1,age*6);
  },
  body(fx,skill,age){if(fx.reduced)return null;const k=bell(span(age,0,.45));return {dy:-5*k,squash:1+.03*k};},
  impactLife:.6,
  impact(fx,e,t){
    const c=t*e.total,R=fx.reduced,big=e.targetBoss?1.3:1,T={x:e.x,y:e.y-(e.targetBoss?34:20)},s=(fx.starScale||1)*big;
    if(!e.hit){kit(fx,KIT.flare,'comet',T.x,T.y,80*(1-t),undefined,0,1-t);return;}
    if(!e.struck){e.struck=true;stun(fx,3,0);}
    kit3(fx,KIT3.star,'comet',T.x,T.y,lerp(50,110,easeOut(span(c,0,.18)))*s,undefined,c*2,1-span(c,.15,.5));
    kit(fx,KIT.flare,'comet',T.x,T.y,150*s*(1-span(c,0,.2)),undefined,0,1-span(c,0,.25));
    kit(fx,KIT.ring,'comet',T.x,e.y+6,lerp(40,160,easeOut(span(c,0,.4)))*s,lerp(16,66,easeOut(span(c,0,.4)))*s,0,.9*(1-span(c,.05,.45)));
    if(!R)for(let j=0;j<8;j++){const k=span(c,0,.5),ang=hash(e.x+e.y,j)*6.283;glint(fx,T.x+Math.cos(ang)*60*easeOut(k)*s,T.y+Math.sin(ang)*40*easeOut(k)+20*k*k,2.6,'#fff6d8','#56ccff',1-k,j);}
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// Behemoth · Earth Crusher (UR). The engine strikes three times, 0.5 s apart (0.25, 0.75 and 1.25 s of game time), each centred on a
// random enemy and hitting every enemy within the crush radius (112.5, +5% per training; a circle on screen). Not a fist: the ground
// itself breaks to exactly that radius. Owner review, 2026-11-07: the old stamp read as the weakest UR, so the three blows now build
// to a UR finale.
//   Cast: the board darkens to moss green, the ground under him cracks open and stones lift around him.
//   Each blow (the engine's crushPhase, so on time even in the UR slow motion): a ring tightens at his feet and he stomps; at the
//   centre the ground caves in to the true radius, green crystal spikes burst up along its true edge, the painted rock-and-crystal
//   pillar erupts from the middle and rubble flies and tumbles back. Each blow is heavier than the last.
//   The third: fault lines race from him to all three craters, every crater erupts at once and the earth heaves.
const CRUSH_LEAD=.24,CRUSH_LIFE=[1,1,2];
function crushPhase(fx,p){const v=fx.s?.volleys?.find(v=>v.kind==='crush'&&v.hero==='behemoth'&&v.phase===p),hit=fx.crushHits?.[p];return {left:v?v.life:null,since:hit?(fx.clock||0)-hit.at:null};}
// One blow at (x, y) with the engine's radius. e.prev holds the earlier craters and e.from Behemoth, for the finale.
function quakeStrike(fx,e,t){
  const c=t*e.total,R=fx.reduced,r=e.radius||126,ph=e.phase|0,big=[1,1.12,1.3][ph]||1,X=e.x,Y=e.y,seed=e.seed||1,final=ph===2;
  if(!e.struck){e.struck=true;stun(fx,[5,7,12][ph]||5,[.03,.04,.1][ph]||.03);}
  const end=1-span(c,e.total-.45,e.total);
  // The ground caves in to the true radius.
  const cave=easeOut(span(c,0,.08)),ring=2*r*lerp(.5,1.08,easeOut(span(c,0,.2)))/.9;
  fx.atlasStamp('effects-behemoth',2,3,1,X,Y+6,2*r*lerp(.85,1.05,cave),2*r*lerp(.85,1.05,cave),0,end,'source-over');
  kit(fx,KIT.ring,'quake',X,Y+6,ring,ring,0,1-span(c,.12,.5));
  if(!R)kit(fx,KIT.mist,'dust',X,Y+10,2*r*lerp(.8,1.4,easeOut(span(c,0,.6))),r*lerp(.5,.9,easeOut(span(c,0,.6))),0,.7*(1-span(c,.15,.8)),'source-over');
  // Crystal spikes burst up along the true edge.
  const n=8+ph*2;for(let i=0;i<n;i++){const a=i/n*6.283+hash(seed,i)*.3,k=easeOut(span(c,.02+hash(seed,i+9)*.06,.14))*(1-span(c,.5,.85));if(k<=0)continue;
    kitStanding(fx,KIT.spikes,'quake',X+Math.cos(a)*r*.9,Y+Math.sin(a)*r*.9+8,(38+hash(seed,i+30)*22)*big,k,hash(seed,i+50)<.5?1:-1,Math.cos(a)*.25,1-span(c,.55,.85),'lighter');}
  // The rock-and-crystal pillar erupts from the middle.
  const up=easeBack(span(c,0,.16)),w=r*1.25*big,burst=r*1.7*big*lerp(.6,1.1,easeOut(span(c,0,.2)));
  fx.atlasStamp('effects-behemoth',1,3,1,X,Y+12-w*up*.5,w,w*up,0,1-span(c,.4,.75),'source-over');
  fx.atlasStamp('effects-behemoth',0,3,1,X,Y-10,burst,burst,0,1-span(c,.06,.35),'source-over');
  kit(fx,KIT.flare,'quake',X,Y-14,190*big*(1-span(c,0,.18)),undefined,0,1-span(c,0,.22));
  if(!R)for(let i=0;i<(final?18:12);i++){const k=span(c,0,.75);if(k>=1)break;const a=hash(seed,i+70)*6.283,v=r*(.4+hash(seed,i+90)*.8)*big;
    kit(fx,KIT.shard,i%3?'dust':'quake',X+Math.cos(a)*v*easeOut(k),Y-8+Math.sin(a)*v*.45*easeOut(k)-(120+hash(seed,i+110)*90)*k+260*k*k,12+hash(seed,i+130)*10,undefined,a+k*7,1-span(k,.6,1));}
  if(!final)return;
  // The finale (owner review: not beams from him, the earth giving way before his majesty): the ground of every crater lifts in
  // chunks and hangs trembling, then all of it breaks apart at once into rubble and dust, and the earth heaves across the board.
  // His giant shadow rises behind the board meanwhile (behemoth.field).
  const boom=c-.18;if(boom<0)return;const points=[...(e.prev||[]),{x:X,y:Y,radius:r}],lift=easeOut(span(boom,0,.42)),shatter=boom-.42;
  if(!e.lifted){e.lifted=true;stun(fx,4,0);}
  for(const [j,q] of points.entries()){const rr=q.radius||r;
    if(!R)kit(fx,KIT.mist,'dust',q.x,q.y+8,2*rr*lerp(.9,1.5,easeOut(span(boom,0,1))),rr*lerp(.5,.9,easeOut(span(boom,0,1))),0,.75*(1-span(boom,.6,1.4)),'source-over');
    for(let i=0;i<(R?5:11);i++){const a=hash(seed+j,i)*6.283,d=rr*Math.sqrt(hash(seed+j,i+20))*.85,x=q.x+Math.cos(a)*d,y=q.y+Math.sin(a)*d*.5,size=28+hash(seed+j,i+40)*22,
      up=(40+hash(seed+j,i+60)*70)*lift,shake=R||shatter>0?0:Math.sin(boom*60+i)*2*lift;
      if(shatter<0){fx.atlasStamp('effects-behemoth',1,3,1,x+shake,y-up,size*1.5,size*1.5,(hash(seed+j,i+80)-.5)*.8+boom*.6,1,'source-over');continue;}
      // Each chunk breaks into a few pieces that fall away and turn to dust.
      const k=span(shatter,0,.7);if(k>=1)continue;
      for(let m=0;m<3;m++){const b=hash(i+j*31,m)*6.283,v=30+hash(i,m+9)*40;kit(fx,KIT.shard,'dust',x+Math.cos(b)*v*easeOut(k),y-up+Math.sin(b)*v*.6*easeOut(k)+140*k*k,size*.5*(1-.5*k),undefined,b+k*8,1-k,'source-over');}}
    if(shatter>=0){const k=easeOut(span(shatter,0,.25)),w=rr*1.9*lerp(.6,1.15,k);fx.atlasStamp('effects-behemoth',0,3,1,q.x,q.y-10,w,w,0,1-span(shatter,.08,.5),'source-over');}}
  if(shatter<0)return;if(!e.boomed){e.boomed=true;stun(fx,14,.1);}
  const heave=easeOut(span(shatter,0,.55));kit(fx,KIT.ring,'quake',X,Y+6,lerp(2*r,1500,heave),lerp(2*r,1500,heave)*.5,0,.8*(1-heave));
  const again=easeBack(span(shatter,0,.18)),W=r*1.7;fx.atlasStamp('effects-behemoth',1,3,1,X,Y+12-W*again*.5,W,W*again,0,1-span(shatter,.5,.9),'source-over');
  wash(fx,'#c8f070',.22*(1-span(shatter,0,.45)));
  if(!R)for(let i=0;i<24;i++){const k=span(shatter,0,1.1);if(k>=1)break;const x=40+hash(seed,i+150)*640,y=740-hash(seed,i+170)*120;
    kit(fx,KIT.shard,'dust',x+Math.sin(k*5+i)*10,y-k*(220+hash(seed,i+190)*200),9+hash(seed,i+210)*8,undefined,k*6+i,bell(k));}
}
// His majesty: a giant shadow of Behemoth rises behind the board while the last craters break, under the units.
function behemothShadow(fx,o,since){if(since===null||since>1.6)return;const k=easeOut(span(since,0,.45)),a=(fx.reduced?.3:.5)*k*(1-span(since,.9,1.6));
  drawGhost(fx,'behemoth',360,770+40*(1-k),'down','#1a2a0c',a,600);}
const behemoth={
  life:()=>3,
  plan(fx,skill){fx.crushHits=[];fx.crushFrom=skill.origin;skill.ur={seed:(skill.uid||1)*3.71};return null;},
  // effects.js calls this at the engine's crushPhase: remember the crater and add the blow as its own effect.
  land(fx,e){const hits=fx.crushHits||(fx.crushHits=[]),prev=hits.filter(Boolean).map(h=>({x:h.x,y:h.y,radius:h.radius}));hits[e.phase]={at:fx.clock||0,x:e.x,y:e.y,radius:e.radius};
    const life=CRUSH_LIFE[e.phase]||1;fx.add?.({...e,type:'urFx',seed:((fx.clock||1)*5.3)%89+1+e.phase,prev,from:fx.crushFrom,life,total:life,draw:quakeStrike});},
  strike:quakeStrike,
  field(fx,skill,age){
    const o=skill.origin,R=fx.reduced,mood=span(age,.02,.3)*(1-span(age,2.4,3));
    behemothShadow(fx,o,crushPhase(fx,2).since);
    vignette(fx,o.x,o.y,120,640,'#060a02',R?0:.5*mood);wash(fx,'#0e1404',.22*mood,'source-over');
    const g=easeOut(span(age,0,.35));fx.atlasStamp('effects-behemoth',2,3,1,o.x,o.y+26,lerp(70,200,g),lerp(28,84,g),0,.8*mood,'source-over');
    // Before each blow a ring of green light tightens at his feet.
    for(let p=0;p<3;p++){const ph=crushPhase(fx,p);if(ph.left===null||ph.left>CRUSH_LEAD)continue;const k=1-ph.left/CRUSH_LEAD;kit(fx,KIT.ring,'quake',o.x,o.y+26,lerp(220,70,k),lerp(88,28,k),0,.9*k);}
  },
  over(fx,skill,age){
    const o=skill.origin,R=fx.reduced,u=skill.ur,rise=span(age,.04,.5)*(1-span(age,1.6,2.2));if(rise<=0)return;
    fx.glow('glow','#9ccc40',o.x,o.y-10,180*rise,.35*rise);
    const wake=span(age,0,.5);if(wake<1){if(!R)fx.glow('rays','#b8e060',o.x,o.y+10,420*easeOut(wake),.55*(1-wake),age*.5);kit(fx,KIT.flare,'quake',o.x,o.y+14,lerp(120,260,easeOut(wake)),undefined,0,1-wake);
      kit(fx,KIT.ring,'quake',o.x,o.y+26,lerp(90,420,easeOut(wake)),lerp(36,170,easeOut(wake)),0,1-wake);}
    // Stones lift around him and hang, bobbing, until the last blow.
    if(!R)for(let i=0;i<10;i++){const a=hash(u.seed,i)*6.283,r=58+hash(u.seed,i+20)*52,h=lerp(0,40+hash(u.seed,i+40)*50,easeOut(span(age,.04+i*.02,.5)))+Math.sin(age*3+i)*4;
      kit(fx,KIT.shard,'quake',o.x+Math.cos(a)*r,o.y+20+Math.sin(a)*r*.4-h,12+hash(u.seed,i+60)*8,undefined,a+age*2,rise);}
  },
  body(fx,skill,age){if(fx.reduced)return null;let crouch=0,slam=0;for(let p=0;p<3;p++){const ph=crushPhase(fx,p);if(ph.left!==null&&ph.left<=CRUSH_LEAD)crouch=Math.max(crouch,1-ph.left/CRUSH_LEAD);if(ph.since!==null&&ph.since<.18)slam=Math.max(slam,1-ph.since/.18);}
    const lift=bell(span(age,0,.4));return {dy:-6*lift-7*crouch+5*slam,squash:1+.04*lift+.05*crouch-.08*slam};},
};

export const UR_SPECS=Object.freeze({cherry_prince:cherry,luna,frost_witch:frost,harmonious:harmony,jasmine,queen,time_magician:trauma,galaxy_whale:whale,time_ruler:chrono,
  cinderella,venom,doom,rumi,red_dragon:redDragon,aurora,star_boy:starBoy,behemoth});
const KIT_BOTH=['ur-kit','ur-kit2'],KIT_ALL=['ur-kit','ur-kit2','ur-kit3'],KIT_ONE_THREE=['ur-kit','ur-kit3'];
const NEEDS=Object.freeze({harmonious:['ur-kit','ur-sweets'],jasmine:KIT_BOTH,queen:KIT_BOTH,time_magician:KIT_BOTH,galaxy_whale:KIT_BOTH,time_ruler:KIT_BOTH,
  cinderella:KIT_ALL,venom:KIT_ONE_THREE,doom:KIT_ALL,rumi:KIT_ALL,red_dragon:KIT_ONE_THREE,aurora:KIT_ALL,star_boy:KIT_ONE_THREE,behemoth:['ur-kit','ur-kit2','effects-behemoth']});
// A sequence runs only with its art loaded; otherwise the previous visuals stay (same fallback rule as Ragnarok).
export function urReady(fx,hero){const spec=UR_SPECS[hero];return !!spec&&(NEEDS[hero]||['ur-kit']).every(id=>fx.art?.images?.[id]);}
export function urSpec(fx,skill){return skill&&skill.kind!=='dream'&&urReady(fx,skill.hero)?UR_SPECS[skill.hero]:null;}
// A unit's form changed between two frames (render.js): its hero's sequence may mark the moment (a transformation ending).
export function formChange(fx,u,p,from,to){const spec=UR_SPECS[u.hero];if(spec?.formChange&&urReady(fx,u.hero))spec.formChange(fx,u,p,from,to);}

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
