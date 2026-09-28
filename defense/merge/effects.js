import {HERO,HEROES} from './content.js';
import {cellPoint,pathPoint,attackGeometry} from './engine.js';
import {traceAttackShape,outline,drawHitShape,drawZoneShape,shapeColor} from './attack-shapes.js';

// Frame order is the authored 7 x 3 SD atlas. Every companion owns a silhouette.
export const FX_PROFILES=Object.fromEntries([
  ['zeke','crescent',0,0],['rumi','star',1,0],['luna','daggers',2,-Math.PI/4],
  ['cinderella','glass',3,0],['snow_rabbit','snow',4,0],['avalanche_maid','icicles',5,0],
  ['night_rabbit','leap',6,-Math.PI*3/4],['guardian','quake',7,0],['storm_sage','ribbon',8,0],
  ['lightning_sage','bolt',9,0],['red_dragon','dragon',10,0],['flame_sage','embers',11,0],
  ['mushroom_king','spores',12,0],['great_detective','needle',13,0],['siren','song',14,0],
  ['phantom','claws',15,Math.PI/4],['queen','petals',16,0],['galaxy_whale','planet',17,0],
  ['silver_rabbit','comets',18,.18],['ancient_dragon','cross',19,0],['time_ruler','clock',20,0],
].map(([id,motion,frame,offset])=>[id,{motion,frame,offset}]));

function stroke(ctx,points,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
function disk(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
function diamond(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x,y+r*.4);ctx.lineTo(x-r,y);ctx.lineTo(x,y-r*.4);ctx.closePath();ctx.fill();}
function star(ctx,r,color){ctx.fillStyle=color;ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,rad=i%2?r*.27:r;i?ctx.lineTo(Math.cos(a)*rad,Math.sin(a)*rad):ctx.moveTo(Math.cos(a)*rad,Math.sin(a)*rad);}ctx.closePath();ctx.fill();}
const directional=new Set(['crescent','daggers','leap','ribbon','dragon','claws','comets']);

// Same logical shape and dimensions as hit testing; no role labels on empty tiles.
export function drawAttackRange(ctx,hero,from,aim){
  const g=attackGeometry(hero,from,{x:from.x+Math.cos(aim)*hero.range,y:from.y+Math.sin(aim)*hero.range});
  ctx.save();ctx.strokeStyle='#d5f1e888';ctx.lineWidth=1.5;ctx.setLineDash([4,8]);
  if(['cross','beam','cleave','pulse'].includes(g.kind))traceAttackShape(ctx,g);
  else {ctx.beginPath();ctx.arc(from.x,from.y,g.range,0,Math.PI*2);}
  ctx.stroke();
  ctx.restore();
}

export class CombatFX{
  constructor(ctx,art){this.ctx=ctx;this.art=art;this.impacts=[];this.footprints=[];this.clock=0;this.reduced=false;}
  stamp(hero,x,y,size,angle=0,alpha=1){
    const ctx=this.ctx,img=this.art.images.effects,fx=FX_PROFILES[hero];if(!fx||alpha<=0)return;
    ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,y);if(directional.has(fx.motion))ctx.rotate(angle+fx.offset);
    if(img){const w=img.naturalWidth/7,h=img.naturalHeight/3,inset=.055;ctx.globalCompositeOperation='screen';ctx.drawImage(img,(fx.frame%7+inset)*w,(Math.floor(fx.frame/7)+inset)*h,w*(1-inset*2),h*(1-inset*2),-size/2,-size/2,size,size);}
    else{ctx.rotate(fx.frame*Math.PI/11);star(ctx,size*.24,HERO[hero].color);ctx.lineWidth=2;ctx.strokeStyle=HERO[hero].color;for(let i=0;i<fx.frame%4;i++){ctx.beginPath();ctx.arc(0,0,size*(.25+i*.05),0,Math.PI*1.4);ctx.stroke();}}
    ctx.restore();
  }
  add(effect){this.impacts.push(effect);if(this.impacts.length>96)this.impacts.splice(0,this.impacts.length-96);}
  event(e){
    if(e.type==='impact')this.add({...e,life:.3,total:.3});
    if(e.type==='impact'&&e.geometry&&['cleave','pulse','beam','cross','splash'].includes(e.geometry.kind)){
      // Repeated echo/twin hits refresh one truthful footprint per attacker.
      // Skill decoration cannot evict ordinary attack boundaries.
      this.footprints=this.footprints.filter(p=>p.source!==e.source);
      this.footprints.push({...e,life:.46,total:.46});
      if(this.footprints.length>50)this.footprints.shift();
    }
    if(e.type==='chain')this.add({type:'impact',hero:e.hero,x:e.to.x,y:e.to.y,angle:Math.atan2(e.to.y-e.from.y,e.to.x-e.from.x),life:.24,total:.24,rank:1});
    if(e.type==='skill'){
      const targets=e.targets||[],h=HERO[e.hero];
      for(const p of targets)this.add({type:e.support?'support':'ultimate',hero:e.hero,...p,origin:e.origin,angle:Math.atan2(p.y-e.origin.y,p.x-e.origin.x),life:.65,total:.65,rank:e.rank,skill:h.skill.type});
      if(!targets.length)this.add({type:'ultimate',hero:e.hero,...e.origin,origin:e.origin,angle:0,life:.65,total:.65,rank:e.rank});
    }
  }
  drawSkillField(skill){
    if(!skill||skill.life<=0)return;
    const ctx=this.ctx,h=HERO[skill.hero],fx=FX_PROFILES[skill.hero];
    const t=Math.max(0,Math.min(1,1-skill.life/skill.total)),fade=Math.min(1,t*12)*(1-t),motion=this.reduced?.28:t;
    // Field-scale identity is independent of target count. Everything here is
    // UNDER units, HP bars and danger cells; the centre never flashes white.
    ctx.save();ctx.globalAlpha=fade*(this.reduced?.48:1);
    const wash=ctx.createRadialGradient(360,415,155,360,415,520);
    wash.addColorStop(0,h.color+'00');wash.addColorStop(.58,h.color+'12');wash.addColorStop(1,h.color+'66');
    ctx.fillStyle=wash;ctx.fillRect(0,0,720,780);
    ctx.save();ctx.translate(360,415);ctx.globalAlpha*=.5;ctx.strokeStyle=h.color;ctx.lineWidth=3;
    const arc=(r,start,end,width=3)=>{ctx.lineWidth=width;ctx.beginPath();ctx.arc(0,0,r,start,end);ctx.stroke();};
    if(['crescent','daggers','leap','claws'].includes(fx.motion)){
      const sweeps=fx.motion==='daggers'?3:fx.motion==='claws'?3:2;
      for(let i=0;i<sweeps;i++){
        ctx.save();ctx.rotate((fx.motion==='leap'?-.75:-.4)+i*.8);
        ctx.strokeStyle=i%2?'#f8e5ff':h.color;
        ctx.lineWidth=8-i*2;ctx.beginPath();ctx.ellipse(0,0,300+motion*80,130+i*55,-motion*.25,Math.PI*.1,Math.PI*.9);ctx.stroke();ctx.restore();
      }
    }else if(['snow','icicles','glass'].includes(fx.motion)){
      const count=fx.motion==='snow'?6:fx.motion==='icicles'?8:4;
      ctx.rotate(fx.motion==='glass'?Math.PI/4:0);
      for(let i=0;i<count;i++){ctx.rotate(Math.PI*2/count);const r=240+motion*70;stroke(ctx,[[r-35,-12],[r,0],[r-35,12]],h.color,3);if(fx.motion==='snow')stroke(ctx,[[r-20,-25],[r,0],[r-20,25]],h.color,2);else diamond(ctx,r,0,18,'#d8efff');}
    }else if(['dragon','embers'].includes(fx.motion)){
      for(let i=0;i<5;i++){const x=-300+i*150,y=160-motion*200+(i%2)*40;ctx.save();ctx.translate(x,y);ctx.rotate(-.4);star(ctx,22+(i%3)*8,i%2?'#ffd8a0':h.color);ctx.restore();}
      for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*330,220);ctx.bezierCurveTo(side*250,-50,side*380,-140,side*170,-230);ctx.lineWidth=fx.motion==='dragon'?14:5;ctx.stroke();}
    }else if(fx.motion==='bolt'||fx.motion==='needle'){
      for(const side of [-1,1]){
        if(fx.motion==='bolt')stroke(ctx,[[side*300,-285],[side*260,-100],[side*320,-125],[side*265,165],[side*300,280]],h.color,5);
        else {stroke(ctx,[[side*240,-210],[side*285,-210],[side*285,-155]],h.color,4);stroke(ctx,[[side*240,210],[side*285,210],[side*285,155]],h.color,4);}
      }
      if(fx.motion==='needle'){arc(230,0,Math.PI*2,2);stroke(ctx,[[-255,0],[-205,0]],h.color,3);stroke(ctx,[[205,0],[255,0]],h.color,3);}
    }else if(['ribbon','song','planet','clock'].includes(fx.motion)){
      ctx.rotate(fx.motion==='clock'?0:motion*.55);
      for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(0,0,270+i*35,fx.motion==='song'?145+i*30:200+i*22,i*.45,0,Math.PI*1.7);ctx.lineWidth=i?2:4;ctx.stroke();}
      if(fx.motion==='clock'){for(let i=0;i<12;i++){ctx.save();ctx.rotate(i*Math.PI/6);stroke(ctx,[[0,-278],[0,-300]],h.color,i%3?2:4);ctx.restore();}stroke(ctx,[[0,-180],[0,0],[100,60]],h.color,4);}
    }else if(fx.motion==='quake'||fx.motion==='cross'){
      for(const side of [-1,1]){
        const d=180+motion*80;
        if(fx.motion==='quake')stroke(ctx,[[side*330,-240],[side*270,-110],[side*300,0],[side*260,170],[side*330,250]],h.color,5);
        else {stroke(ctx,[[side*d,-300],[side*d,300]],h.color,4);stroke(ctx,[[-320,side*d],[320,side*d]],h.color,4);}
      }
    }else{
      // Stars, rose petals, spores and silver comets keep their authored motif
      // in the corners instead of filling the board with particle noise.
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4+motion*.22,r=280+(i%2)*35,x=Math.cos(a)*r,y=Math.sin(a)*r;
        if(fx.motion==='spores')disk(ctx,x,y,7+i%3*3,h.color);
        else if(fx.motion==='petals'){ctx.save();ctx.translate(x,y);ctx.rotate(a+motion);ctx.fillStyle=h.color;ctx.beginPath();ctx.ellipse(0,0,15,6,0,0,Math.PI*2);ctx.fill();ctx.restore();}
        else {ctx.save();ctx.translate(x,y);ctx.rotate(a);star(ctx,i%2?8:14,h.color);if(fx.motion==='comets')stroke(ctx,[[-35,0],[-10,0]],h.color,3);ctx.restore();}
      }
    }
    ctx.restore();
    // One large low-opacity SD emblem plus two clear side seals: unlike a hit
    // stamp this reads even with one boss on the outer lane, or reduced motion.
    this.stamp(h.id,360,410,310+motion*30,-.3,.3);
    this.stamp(h.id,39,350,104,Math.PI/2,.8);
    this.stamp(h.id,681,485,104,-Math.PI/2,.8);
    ctx.restore();
  }
  drawGround(s){
    const ctx=this.ctx,load=Math.max(.55,1-this.footprints.length*.018);
    // Retain circles around the perimeter path. HUD is outside the canvas;
    // chapter lettering and unit/health layers are drawn above this ground pass.
    ctx.save();ctx.beginPath();ctx.rect(4,36,712,724);ctx.clip();
    this.drawZones(s);
    // Quiet preparation predicts only the forthcoming direction; the bright
    // hit uses the snapshot emitted by applyHit after its exact target lookup.
    for(const shot of s.shots){
      const h=HERO[shot.hero];if(!['cleave','cross','pulse','beam'].includes(h.shape))continue;
      const target=s.enemies.find(e=>e.uid===shot.target&&e.hp>0);if(!target)continue;
      const g=attackGeometry(h,shot.origin,pathPoint(target.progress));
      ctx.save();ctx.setLineDash([3,11]);outline(ctx,g,shapeColor(h),.22*load,1.6,0);ctx.restore();
    }
    for(const p of this.footprints)drawHitShape(ctx,p.geometry,HERO[p.hero],1-p.life/p.total,{reduced:this.reduced,load});
    ctx.restore();
  }
  drawZones(s){
    const load=Math.max(.58,1-s.zones.length*.012);
    for(const z of s.zones)drawZoneShape(this.ctx,z,HERO[z.orbit?'galaxy_whale':z.hero],this.clock,this.reduced,load);
  }
  drawStatus(e,p,size){
    const ctx=this.ctx,t=this.clock;
    if(e.burnTime>0){this.stamp('flame_sage',p.x-9,p.y-13,35+Math.sin(t*10+e.uid)*3,-Math.PI/2,.62);if(!this.reduced){disk(ctx,p.x+Math.sin(t*7+e.uid)*11,p.y-26-(t*19+e.uid*3)%17,1.7,'#ffd590');}}
    if(e.poisonTime>0){this.stamp('mushroom_king',p.x+size*.22,p.y-15,28,0,.55);}
    if(e.stun>0){this.stamp('snow_rabbit',p.x,p.y-22,size*.63,t*.3,.75);}
    else if(e.slowTime>0){ctx.save();ctx.strokeStyle='#a7e7f2aa';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y+4,size*.36,size*.12,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
    if(e.exposeTime>0){ctx.save();ctx.strokeStyle='#fff0b2';ctx.lineWidth=1.5;for(const side of [-1,1])stroke(ctx,[[p.x+side*size*.36,p.y-24],[p.x+side*size*.36,p.y-34],[p.x+side*size*.24,p.y-34]],'#fff0b2',1.5);ctx.restore();}
  }
  drawShot(shot,s){
    const ctx=this.ctx,h=HERO[shot.hero],f=FX_PROFILES[h.id],target=s.enemies.find(e=>e.uid===shot.target),p=target?pathPoint(target.progress):shot.to;
    const t=Math.max(0,Math.min(1,1-shot.life/shot.total)),to={x:p.x,y:p.y-18},angle=Math.atan2(to.y-shot.from.y,to.x-shot.from.x),size=4+Math.min(5,shot.rank)*.65;
    const arc=['icicles','dragon','planet'].includes(f.motion)?34:f.motion==='leap'?20:7;
    const x=shot.from.x+(to.x-shot.from.x)*t,y=shot.from.y+(to.y-shot.from.y)*t-Math.sin(t*Math.PI)*arc;
    if(['quake','cross','crescent'].includes(f.motion))return;
    if(['crescent','daggers','claws'].includes(f.motion)){this.stamp(h.id,shot.origin.x+(p.x-shot.origin.x)*(.45+t*.55),shot.origin.y+(p.y-shot.origin.y)*(.45+t*.55)-18,50+shot.rank*6,angle,.7);return;}
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=.96;
    // Deliberately short trails: a crowded board must retain faces and enemy tells.
    if(!['bolt','ribbon','song','clock'].includes(f.motion))stroke(ctx,[[-13-size,0],[0,0]],h.color+'70',size*.65);
    if(f.motion==='star'){ctx.rotate(t*4);star(ctx,size*1.5,h.color);star(ctx,size*.6,'#ffffff');disk(ctx,-size*2,0,1.8,'#cfffff');}
    if(f.motion==='glass'){diamond(ctx,0,0,size*1.9,'#ffdae9');stroke(ctx,[[-size,0],[0,-size],[size,0]],'#fff7ff',1);disk(ctx,-size*2,size,1.5,h.color);}
    if(f.motion==='snow'){for(let i=0;i<6;i++){ctx.rotate(Math.PI/3);stroke(ctx,[[0,0],[size*1.3,0]],'#c8f7ff',2);}disk(ctx,0,0,2,'#fff');}
    if(f.motion==='icicles'){for(let i=-1;i<=1;i++)diamond(ctx,-Math.abs(i)*7,i*size,10,'#99d6ff');}
    if(f.motion==='leap'){for(const side of [-1,1]){ctx.strokeStyle=side===1?'#edd3ff':'#b68ae6';ctx.lineWidth=3;ctx.beginPath();ctx.arc(-5,side*5,9,-1.2,1.2);ctx.stroke();}}
    if(f.motion==='ribbon'){for(const side of [-1,1])stroke(ctx,Array.from({length:7},(_,i)=>[-28+i*6,Math.sin(i*.8+t*9)*4+side*3]),side===1?'#c0ffe9':h.color,2);}
    if(f.motion==='bolt'){stroke(ctx,[[-22,0],[-14,-6],[-8,5],[0,-4],[8,0]],'#ffe682',3);stroke(ctx,[[-12,0],[7,0]],'#fff',1);}
    if(f.motion==='dragon'){ctx.scale(1.6,1);disk(ctx,0,0,size,'#ff7d42');diamond(ctx,size,0,size,'#ffe6a0');disk(ctx,-size*1.5,2,size*.5,'#ff623a');}
    if(f.motion==='embers'){for(let i=0;i<3;i++){const a=t*7+i*Math.PI*2/3;diamond(ctx,Math.cos(a)*size,Math.sin(a)*size,size*.85,i?'#ffb044':'#ffefb8');}}
    if(f.motion==='spores'){for(let i=0;i<3;i++)disk(ctx,-i*6,Math.sin(t*8+i)*5,size*(1-i*.22),i?'#93cf7b':'#daf58f');}
    if(f.motion==='needle'){stroke(ctx,[[-28,0],[10,0]],'#ffebc0',2);diamond(ctx,5,0,6,'#fff');}
    if(f.motion==='song'){for(let i=0;i<2;i++){ctx.strokeStyle=i?'#c4f3ff':h.color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(-i*10,0,6+i*2,-1.2,1.2);ctx.stroke();}disk(ctx,4,0,3,'#fff');}
    if(f.motion==='petals'){ctx.rotate(t*7);for(let i=0;i<5;i++){ctx.rotate(Math.PI*2/5);ctx.fillStyle=i%2?'#ffcfdf':'#ea9ab9';ctx.beginPath();ctx.ellipse(5,0,5,2.5,0,0,Math.PI*2);ctx.fill();}disk(ctx,0,0,2,'#fff3cb');}
    if(f.motion==='planet'){disk(ctx,0,0,size,'#b1b9ff');ctx.rotate(-.7);ctx.strokeStyle='#c8a9ff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,size*1.7,size*.6,0,0,Math.PI*2);ctx.stroke();}
    if(f.motion==='comets'){for(let i=-1;i<=1;i++)stroke(ctx,[[-14-Math.abs(i)*7,i*5],[6-Math.abs(i)*7,i*5]],i?'#a9d5de':'#f2ffff',i?1.5:3);}
    if(f.motion==='clock'){ctx.rotate(t*7);ctx.strokeStyle='#cfc5ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,size*1.25,.3,5.5);ctx.stroke();stroke(ctx,[[0,-size],[0,0],[size*.7,0]],'#ffffff',1.5);}
    ctx.restore();
  }
  draw(dt){
    this.clock+=dt;const ctx=this.ctx;
    for(const p of this.footprints)p.life-=dt;
    this.footprints=this.footprints.filter(p=>p.life>0);
    for(const e of this.impacts){e.life-=dt;const t=1-e.life/e.total;if(t>=1)continue;
      if(e.type==='support'){
        // Support magic rises beside the recipient, never as a false enemy hit.
        this.stamp(e.hero,e.x+24,e.y-22-t*28,46+10*t,0,(1-t)*.75);
        ctx.save();ctx.globalAlpha=(1-t)*.5;ctx.strokeStyle=HERO[e.hero].color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(e.x,e.y+25,23+t*10,8+t*3,0,0,Math.PI*2);ctx.stroke();ctx.restore();continue;
      }
      const large=e.type==='ultimate',size=(large?102:40)+Math.min(5,e.rank||1)*(large?8:3),alpha=Math.max(0,(1-t)*(large?.83:.65));
      this.stamp(e.hero,e.x,e.y-18,size*(.75+Math.sin(t*Math.PI/2)*.5),e.angle,alpha);
      if(large&&!this.reduced){ctx.save();ctx.globalAlpha=(1-t)*.32;ctx.strokeStyle=HERO[e.hero].color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(e.x,e.y,size*(.3+t*.25),size*(.12+t*.1),0,0,Math.PI*2);ctx.stroke();ctx.restore();}
    }
    this.impacts=this.impacts.filter(e=>e.life>0);
  }
}

// A static contract is useful to keep new companions from silently sharing VFX.
export const distinctAttackCount=()=>new Set(HEROES.map(h=>FX_PROFILES[h.id]?.motion)).size;
