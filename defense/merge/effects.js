import {HERO,HEROES} from './content.js';
import {cellPoint,pathPoint,attackGeometry} from './engine.js';

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
  ctx.save();ctx.translate(from.x,from.y);ctx.strokeStyle='#d5f1e8aa';ctx.fillStyle='#a5ddeb12';ctx.lineWidth=2;ctx.setLineDash([5,7]);ctx.beginPath();
  if(g.kind==='cross'){
    ctx.rect(-g.range,-g.radius/2,g.range*2,g.radius);ctx.rect(-g.radius/2,-g.range,g.radius,g.range*2);
    ctx.save();ctx.beginPath();ctx.arc(0,0,g.range,0,Math.PI*2);ctx.clip();ctx.beginPath();ctx.rect(-g.range,-g.radius/2,g.range*2,g.radius);ctx.rect(-g.radius/2,-g.range,g.radius,g.range*2);ctx.fill();ctx.stroke();ctx.restore();
  }else if(g.kind==='beam'){ctx.rotate(g.angle);ctx.rect(0,-g.radius/2,g.range,g.radius);ctx.fill();ctx.stroke();}
  else if(g.kind==='cleave'){ctx.moveTo(0,0);ctx.arc(0,0,g.range,g.angle-Math.PI/4,g.angle+Math.PI/4);ctx.closePath();ctx.fill();ctx.stroke();}
  else{ctx.arc(0,0,g.range,0,Math.PI*2);ctx.fill();ctx.stroke();}
  ctx.restore();
}

export class CombatFX{
  constructor(ctx,art){this.ctx=ctx;this.art=art;this.impacts=[];this.clock=0;this.reduced=false;}
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
    if(e.type==='chain')this.add({type:'impact',hero:e.hero,x:e.to.x,y:e.to.y,angle:Math.atan2(e.to.y-e.from.y,e.to.x-e.from.x),life:.24,total:.24,rank:1});
    if(e.type==='skill'){
      const targets=e.targets||[],h=HERO[e.hero];
      for(const p of targets)this.add({type:e.support?'support':'ultimate',hero:e.hero,...p,origin:e.origin,angle:Math.atan2(p.y-e.origin.y,p.x-e.origin.x),life:.65,total:.65,rank:e.rank,skill:h.skill.type});
      if(!targets.length)this.add({type:'ultimate',hero:e.hero,...e.origin,origin:e.origin,angle:0,life:.65,total:.65,rank:e.rank});
    }
  }
  drawZones(s){
    const ctx=this.ctx;for(const z of s.zones){ctx.save();const fade=Math.min(1,z.life*2),pulse=.65+Math.sin(this.clock*4+z.uid)*.1;ctx.globalAlpha=fade;
      // Edge is the real collision radius. The painted centre is deliberately quieter.
      ctx.fillStyle=HERO[z.hero].color+'12';ctx.strokeStyle=HERO[z.hero].color+'77';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(z.x,z.y,z.radius,0,Math.PI*2);ctx.fill();ctx.stroke();
      this.stamp(z.orbit?'galaxy_whale':z.hero,z.x,z.y,z.radius*1.45,0,pulse*.35);
      if(!this.reduced){ctx.translate(z.x,z.y);ctx.rotate(this.clock*.7);for(let i=0;i<3;i++){const a=i*Math.PI*2/3;diamond(ctx,Math.cos(a)*z.radius*.8,Math.sin(a)*z.radius*.8,3,HERO[z.hero].color);}}
      ctx.restore();
    }
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
    if(f.motion==='quake'){ctx.save();ctx.strokeStyle=h.color+'b0';ctx.lineWidth=4*(1-t);ctx.beginPath();ctx.arc(shot.origin.x,shot.origin.y,h.range*t,0,Math.PI*2);ctx.stroke();ctx.restore();return;}
    if(f.motion==='cross'){ctx.save();ctx.globalAlpha=(1-t)*.55;stroke(ctx,[[shot.origin.x-h.range,shot.origin.y],[shot.origin.x+h.range,shot.origin.y]],h.color,7);stroke(ctx,[[shot.origin.x,shot.origin.y-h.range],[shot.origin.x,shot.origin.y+h.range]],h.color,7);ctx.restore();return;}
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
    for(const e of this.impacts){e.life-=dt;const t=1-e.life/e.total;if(t>=1)continue;
      if(e.type==='support'){
        // Support magic rises beside the recipient, never as a false enemy hit.
        this.stamp(e.hero,e.x+24,e.y-22-t*28,46+10*t,0,(1-t)*.75);
        ctx.save();ctx.globalAlpha=(1-t)*.5;ctx.strokeStyle=HERO[e.hero].color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(e.x,e.y+25,23+t*10,8+t*3,0,0,Math.PI*2);ctx.stroke();ctx.restore();continue;
      }
      const large=e.type==='ultimate',size=(large?102:48)+Math.min(5,e.rank||1)*(large?8:5),alpha=Math.max(0,(1-t)*(large?.83:.9));
      this.stamp(e.hero,e.x,e.y-18,size*(.75+Math.sin(t*Math.PI/2)*.5),e.angle,alpha);
      if(e.origin&&['beam','cleave'].includes(e.shape)){ctx.save();const h=HERO[e.hero],end=e.shape==='beam'?{x:e.origin.x+Math.cos(e.angle)*h.range,y:e.origin.y+Math.sin(e.angle)*h.range}:e;ctx.globalAlpha=(1-t)*.15;stroke(ctx,[[e.origin.x,e.origin.y],[end.x,end.y]],h.color,e.shape==='beam'?h.radius:3);ctx.globalAlpha=(1-t)*.7;stroke(ctx,[[e.origin.x,e.origin.y],[end.x,end.y]],h.color,2);ctx.restore();}
      if(large&&!this.reduced){ctx.save();ctx.globalAlpha=(1-t)*.32;ctx.strokeStyle=HERO[e.hero].color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(e.x,e.y,size*(.3+t*.25),size*(.12+t*.1),0,0,Math.PI*2);ctx.stroke();ctx.restore();}
    }
    this.impacts=this.impacts.filter(e=>e.life>0);
  }
}

// A static contract is useful to keep new companions from silently sharing VFX.
export const distinctAttackCount=()=>new Set(HEROES.map(h=>FX_PROFILES[h.id]?.motion)).size;
