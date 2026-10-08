import {HERO,HEROES} from '../content.js';
import {cellPoint,pathPoint,attackGeometry,activeSkill,ACTIVE_SKILLS,neighbors,personalTrait,PATH} from './engine.js';
export const ULTIMATE_FRAMES=Object.freeze({cinderella:0,galaxy_whale:1,time_ruler:2,doom:3,santa:4,jasmine:5,frost_witch:6,harmonious:7,zeke:8,rumi:9,luna:10,cherry_prince:11,siren:12,silver_rabbit:13,ancient_dragon:14,time_magician:15});
const dedicated=hero=>hero==='queen'||ULTIMATE_FRAMES[hero]!==undefined;
export const ultimateLayout=kind=>['royal','starfall','mirror','flurry','thunder','execute'].includes(kind)?'target':['vortex','singularity'].includes(kind)?'pull':['echo','haste','awaken','march','gift','harmony','trauma'].includes(kind)?'support':'field';
export function impactSize(hero,rank=1){const h=HERO[hero],area=['cleave','pulse','beam','cross','splash','zone'].includes(h.shape);return (area?82:62)+Math.min(5,rank)*4+(hero==='red_dragon'?22:hero==='santa'?10:0);}

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
for(const [frame,[id,motion]] of [['doom','contract'],['santa','present'],['jasmine','halo'],['star_boy','falling_star'],['time_magician','time_needle'],['cherry_prince','royal_blade']].entries())FX_PROFILES[id]={motion,frame,offset:0,atlas:'effects-expansion',columns:4,rows:3};
for(const [frame,[id,motion]] of [['frost_witch','ice_lance'],['harmonious','harmony_bell'],['aurora','mirror_shard']].entries())FX_PROFILES[id]={motion,frame,offset:0,atlas:'effects-trio',columns:3,rows:2};

function stroke(ctx,points,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
function disk(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
function diamond(ctx,x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x,y+r*.4);ctx.lineTo(x-r,y);ctx.lineTo(x,y-r*.4);ctx.closePath();ctx.fill();}
function star(ctx,r,color){ctx.fillStyle=color;ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,rad=i%2?r*.27:r;i?ctx.lineTo(Math.cos(a)*rad,Math.sin(a)*rad):ctx.moveTo(Math.cos(a)*rad,Math.sin(a)*rad);}ctx.closePath();ctx.fill();}
const directional=new Set(['crescent','daggers','leap','ribbon','dragon','claws','comets']);

// Same logical shape and dimensions as hit testing; no role labels on empty tiles.
export function drawAttackRange(ctx,hero,from,aim){
  if(hero.id==='flame_sage'){
    ctx.save();ctx.globalAlpha=.7;ctx.strokeStyle=hero.color;ctx.lineWidth=3;ctx.setLineDash([6,8]);ctx.beginPath();
    PATH.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();ctx.restore();return;
  }
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
  constructor(ctx,art){this.ctx=ctx;this.art=art;this.impacts=[];this.clock=0;this.reduced=false;this.budget=64;this.enemies=new Map();}
  point(uid,fallback){return this.enemies.get(uid)?.point||fallback;}
  ultimate(hero,x,y,width,height=width,angle=0,alpha=1){const frame=ULTIMATE_FRAMES[hero];if(hero==='queen')this.atlasStamp('finishers',0,4,3,x,y,width,height,angle,alpha);else if(frame!==undefined)this.atlasStamp('ultimates',frame,4,4,x,y,width,height,angle,alpha,'source-over');else this.stamp(hero,x,y,width,angle,alpha);}
  atlasStamp(atlas,frame,columns,rows,x,y,width,height=width,angle=0,alpha=1,blend='screen'){
    const ctx=this.ctx,img=this.art.images[atlas];if(!img||alpha<=0)return;
    const w=img.naturalWidth/columns,h=img.naturalHeight/rows;
    ctx.save();ctx.globalAlpha*=alpha;ctx.globalCompositeOperation=blend;ctx.translate(x,y);ctx.rotate(angle);ctx.drawImage(img,frame%columns*w,Math.floor(frame/columns)*h,w,h,-width/2,-height/2,width,height);ctx.restore();
  }
  stamp(hero,x,y,size,angle=0,alpha=1,form=null){
    const ctx=this.ctx,fx=FX_PROFILES[hero];if(!fx||alpha<=0)return;
    if(fx.atlas&&this.art.images[fx.atlas]){this.atlasStamp(fx.atlas,form==='trauma'?6:fx.frame,fx.columns,fx.rows,x,y,size,size,fx.motion==='halo'?0:angle,alpha);return;}
    const img=this.art.images.effects;
    ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,y);if(directional.has(fx.motion))ctx.rotate(angle+fx.offset);
    if(img&&!fx.atlas){const w=img.naturalWidth/7,h=img.naturalHeight/3,inset=.055;ctx.globalCompositeOperation='screen';ctx.drawImage(img,(fx.frame%7+inset)*w,(Math.floor(fx.frame/7)+inset)*h,w*(1-inset*2),h*(1-inset*2),-size/2,-size/2,size,size);}
    else{ctx.rotate(fx.frame*Math.PI/11);star(ctx,size*.24,HERO[hero].color);ctx.lineWidth=2;ctx.strokeStyle=HERO[hero].color;for(let i=0;i<fx.frame%4;i++){ctx.beginPath();ctx.arc(0,0,size*(.25+i*.05),0,Math.PI*1.4);ctx.stroke();}}
    ctx.restore();
  }
  add(effect){
    // Spend the decoration budget on ordinary hit stamps first. Boss magic and
    // finisher receipts keep their target marks even during a dense burst.
    if(this.impacts.length>=this.budget){const index=this.impacts.findIndex(e=>e.type==='impact');if(index>=0)this.impacts.splice(index,1);else if(effect.type==='impact')return;}
    this.impacts.push(effect);if(this.impacts.length>128)this.impacts.shift();
  }
  event(e){
    if(e.type==='attack'&&['zeke','guardian','ancient_dragon'].includes(e.hero))this.add({...e,...e.origin,type:'attackShape',angle:Math.atan2(e.to.y-e.origin.y,e.to.x-e.origin.x),life:e.hero==='guardian'?.44:.36,total:e.hero==='guardian'?.44:.36});
    if(e.type==='frostBreak')this.add({...e,life:.42,total:.42});
    if(e.type==='instantKill')this.add({...e,life:.48,total:.48});
    if(e.type==='finisherImpact'||e.type==='finisherFizzle')this.add({...e,life:e.type==='finisherImpact'?.55:.25,total:e.type==='finisherImpact'?.55:.25});
    if(e.type==='bossCast')for(const p of e.cells?.map(cellPoint)||[e])this.add({...e,...p,type:'bossMagic',life:.65,total:.65});
    if(e.type==='supportPulse')for(const p of e.targets||[])this.add({...p,hero:e.hero,type:'support',life:.45,total:.45});
    if(e.type==='impact')this.add({...e,life:['red_dragon','santa','snow_rabbit'].includes(e.hero)?.38:.3,total:['red_dragon','santa','snow_rabbit'].includes(e.hero)?.38:.3});
    if(e.type==='chain')this.add({type:'impact',hero:e.hero,x:e.to.x,y:e.to.y,angle:Math.atan2(e.to.y-e.from.y,e.to.x-e.from.x),life:.24,total:.24,rank:1});
    if(e.type==='skill'){
      if(e.locked)return;
      const targets=e.targets||[],h=HERO[e.hero];
      if(e.kind==='trauma'){for(const p of targets)this.add({...p,type:'transform',hero:e.hero,life:.8,total:.8});return;}
      for(const p of targets)this.add({type:e.support?'support':ultimateLayout(e.kind)==='pull'?'pullImpact':'ultimate',hero:e.hero,...p,origin:e.origin,angle:Math.atan2(p.y-e.origin.y,p.x-e.origin.x),life:.65,total:.65,rank:e.rank,skill:h.skill.type});
      if(!targets.length)this.add({type:'ultimate',hero:e.hero,...e.origin,origin:e.origin,angle:0,life:.65,total:.65,rank:e.rank});
    }
  }
  drawSkillField(skill){
    if(!skill||skill.life<=0||skill.locked||skill.kind==='trauma')return;
    const ctx=this.ctx,h=HERO[skill.hero],fx=FX_PROFILES[skill.hero];
    const t=Math.max(0,Math.min(1,1-skill.life/skill.total)),fade=Math.min(1,t*12)*(1-t),motion=this.reduced?.28:t;
    const layout=ultimateLayout(skill.kind);
    if(layout==='target'||layout==='pull'){this.drawDirectedSkill(skill,t,fade,layout);return;}
    if(dedicated(skill.hero)){
      if(layout==='support'){
        const burst=skill.hero==='santa'?460:420;
        this.ultimate(skill.hero,skill.origin.x,skill.origin.y-18,burst,burst,0,fade*.9);
        for(const p of (skill.targets||[]).slice(0,8))this.ultimate(skill.hero,p.x,p.y+18,62,30,0,fade*.35);
      }else if(skill.hero==='zeke'){
        for(let i=0;i<4;i++){const local=(t*3.5-i*.24)%1;if(local<0)continue;this.ultimate('zeke',210+i*100,245+i*113,370,220,i%2?.12:-.4,Math.sin(local*Math.PI)*.52);}
      }else{
        const center=skill.hero==='cinderella'?640:skill.hero==='frost_witch'?480:460;
        this.ultimate(skill.hero,360,405,center,center,skill.hero==='time_ruler'?motion*.15:0,fade*.55);
        for(const [x,y] of [[42,345],[678,485]])this.ultimate(skill.hero,x,y,112,112,0,fade*.72);
      }
      return;
    }
    if(fx.atlas==='effects-trio'){
      // Authored seals sit outside the board; never cover faces or enemy HP.
      for(const [x,y] of [[38,345],[682,485]])this.atlasStamp('effects-trio',fx.frame+3,3,2,x,y,80,80,0,fade*(this.reduced?.45:.75));
      return;
    }
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
  drawDirectedSkill(skill,t,fade,layout){
    const ctx=this.ctx,points=skill.targets||[],h=HERO[skill.hero];
    if(layout==='pull'){
      if(!points.length)return;const centre=points.reduce((a,p)=>({x:a.x+p.x/points.length,y:a.y+p.y/points.length}),{x:0,y:0});
      this.ultimate(skill.hero,centre.x,centre.y-18,230,210,t*.45,fade*.8);
      for(const p of points){const from=p.from||p,to=this.point(p.uid,p),travel=Math.min(1,t*3),x=from.x+(to.x-from.x)*travel,y=from.y+(to.y-from.y)*travel;
        ctx.save();ctx.globalAlpha=fade*.6;ctx.strokeStyle=h.color;ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(from.x,from.y-20);ctx.quadraticCurveTo((from.x+to.x)/2+25,(from.y+to.y)/2-45,to.x,to.y-20);ctx.stroke();ctx.restore();
        this.stamp(skill.hero,x,y-20,42,Math.atan2(to.y-from.y,to.x-from.x),fade*.8);
      }return;
    }
    let from=skill.origin;
    for(let i=0;i<points.length;i++){
      const p=this.point(points[i].uid,points[i]),angle=Math.atan2(p.y-from.y,p.x-from.x);
      if(skill.kind==='thunder'){
        ctx.save();ctx.globalAlpha=fade*.9;const mid={x:(from.x+p.x)/2+12,y:(from.y+p.y)/2-24};stroke(ctx,[[from.x,from.y-20],[mid.x,mid.y],[p.x,p.y-20]],h.color,5);stroke(ctx,[[from.x,from.y-20],[mid.x,mid.y],[p.x,p.y-20]],'#fff8cf',1.6);ctx.restore();
        this.stamp(skill.hero,p.x,p.y-20,96,Math.PI/2,fade);from=p;
      }else if(skill.kind==='flurry'){
        const phase=Math.min(1,Math.max(0,t*2.4-i*.055)),x=from.x+(p.x-from.x)*phase,y=from.y+(p.y-from.y)*phase-Math.sin(phase*Math.PI)*50;
        ctx.save();ctx.globalAlpha=fade*.48;ctx.strokeStyle=h.color;ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(from.x,from.y-18);ctx.quadraticCurveTo((from.x+p.x)/2,(from.y+p.y)/2-70,p.x,p.y-18);ctx.stroke();ctx.restore();
        this.stamp('night_rabbit',x,y-18,100,angle,fade);from=p;
      }else this.ultimate(skill.hero,p.x,p.y-28,skill.hero==='aurora'?420:165,skill.hero==='aurora'?420:165,angle,fade*.8);
      ctx.save();ctx.globalAlpha=fade*.65;ctx.strokeStyle=h.color;ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(p.x,p.y+8,27,10,0,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
  }
  drawPersistent(s){
    for(let i=0;i<s.board.length;i++){
      const u=s.board[i];if(!u)continue;const own=activeSkill(s,u.hero),p=cellPoint(i);
      let active=own,owner=u.hero;
      if(!active){owner=Object.keys(ACTIVE_SKILLS).find(id=>id!=='time_magician'&&s.buffs[ACTIVE_SKILLS[id]]>0&&(id!=='harmonious'||neighbors(i).some(n=>s.board[n]?.hero==='harmonious')));active=owner?activeSkill(s,owner):null;}
      if(!active)continue;
      const pulse=.27+Math.sin(this.clock*4+u.uid)*.06,ctx=this.ctx;
      this.ultimate(owner,p.x,p.y+20,76,30,0,pulse);
      if(own){ctx.save();ctx.strokeStyle=HERO[owner].color;ctx.lineWidth=2.5;ctx.globalAlpha=.7;ctx.beginPath();ctx.ellipse(p.x,p.y+21,32,11,0,-Math.PI/2,-Math.PI/2+Math.PI*2*active.remaining/active.total);ctx.stroke();ctx.restore();this.ultimate(owner,p.x+29,p.y-36,31,31,0,.58);}
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
  drawPersonalTraits(s,foreground=false){
    // Reuse each companion's painted combat emblem. The foot seal conveys a
    // live condition without painting over faces, ranks, enemies or HP bars.
    const ctx=this.ctx;
    for(let i=0;i<s.board.length;i++){
      const u=s.board[i];if(!u)continue;
      if(!['lightning_sage','star_boy','galaxy_whale','aurora','zeke','time_ruler'].includes(u.hero))continue;
      const state=personalTrait(s,u,i),aged=['star_boy','galaxy_whale'].includes(u.hero);
      if(!state.active&&!aged)continue;
      const strong=state.active&&state.damageMultiplier>=1,p=cellPoint(i),alpha=strong?.48:.17,pulse=this.reduced?1:1+Math.sin(this.clock*2+u.uid)*.06;
      if(foreground){
        // A small, dark status backing separates the painted emblem from
        // tile trim and rank stars. It sits beside the feet, above shadows.
        ctx.save();ctx.globalAlpha=strong?.8:.5;disk(ctx,p.x+28,p.y+21,16,'#0b1e2b');
        ctx.strokeStyle=HERO[u.hero].color;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p.x+28,p.y+21,16,0,Math.PI*2);ctx.stroke();ctx.restore();
        if(u.hero==='aurora')this.atlasStamp('effects-trio',5,3,2,p.x+28,p.y+21,30,38,0,.85);
        else this.stamp(u.hero,p.x+28,p.y+21,strong?30:24,0,strong?.85:.4);
        continue;
      }
      ctx.save();ctx.globalAlpha=alpha*pulse;ctx.strokeStyle=HERO[u.hero].color;ctx.lineWidth=2.5;
      ctx.beginPath();ctx.ellipse(p.x,p.y+31,28,9,0,Math.PI*.13,Math.PI*1.87);ctx.stroke();ctx.restore();
      this.stamp(u.hero,p.x,p.y+31,56,0,alpha);
      if(aged){
        const phase=Math.min(2,state.age||0);ctx.save();
        for(let j=0;j<3;j++)disk(ctx,p.x-7+j*7,p.y+39,3,j===phase?HERO[u.hero].color:'#d4dfdf44');
        ctx.restore();
      }
    }
  }
  drawStatus(e,p,size){
    const ctx=this.ctx,t=this.clock;
    if(e.frostTime>0)for(let i=0;i<e.frostStacks;i++)diamond(ctx,p.x-size*.3+i*7,p.y+10,3,'#b0f1ff');
    if(e.divine>0)for(let i=0;i<e.divine;i++)diamond(ctx,p.x+(i-1)*7,p.y-size*.78-17,3,'#ffeac0');
    if(e.rage>0)this.atlasStamp('effects-expansion',8,4,3,p.x,p.y-20,size*.85,size*.85,0,.38);
    if(e.shield>0)this.atlasStamp('effects-expansion',11,4,3,p.x,p.y-25,size,size,0,.4);
    if(e.burnTime>0){this.stamp('flame_sage',p.x-9,p.y-13,35+Math.sin(t*10+e.uid)*3,-Math.PI/2,.62);if(!this.reduced){disk(ctx,p.x+Math.sin(t*7+e.uid)*11,p.y-26-(t*19+e.uid*3)%17,1.7,'#ffd590');}}
    if(e.poisonTime>0){this.stamp('mushroom_king',p.x+size*.22,p.y-15,28,0,.55);}
    if(e.freeze>0){this.stamp('snow_rabbit',p.x,p.y-22,size*.63,t*.3,.75);}
    if(e.stun>0){ctx.save();ctx.globalAlpha=.85;for(let i=0;i<3;i++){const a=t*2+i*Math.PI*2/3;ctx.save();ctx.translate(p.x+Math.cos(a)*size*.28,p.y-size*.7+Math.sin(a)*3);star(ctx,3.5,'#ffe09a');ctx.restore();}ctx.restore();}
    if(e.stun<=0&&!(e.freeze>0)&&e.slowTime>0){ctx.save();ctx.strokeStyle='#a7e7f2aa';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y+4,size*.36,size*.12,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
    if(e.exposeTime>0){ctx.save();ctx.strokeStyle='#fff0b2';ctx.lineWidth=1.5;for(const side of [-1,1])stroke(ctx,[[p.x+side*size*.36,p.y-24],[p.x+side*size*.36,p.y-34],[p.x+side*size*.24,p.y-34]],'#fff0b2',1.5);ctx.restore();}
  }
  drawShot(shot,s){
    const ctx=this.ctx,h=HERO[shot.hero],f=FX_PROFILES[h.id],target=this.enemies.get(shot.target)?.enemy,p=this.point(shot.target,shot.to);
    if(shot.reflected&&shot.delay>0){if(target)this.atlasStamp('effects-trio',5,3,2,shot.from.x,shot.from.y-18,36,44,0,.35+.35*(1-shot.delay/.42));return;}
    const t=Math.max(0,Math.min(1,1-shot.life/shot.total)),to={x:p.x,y:p.y-18},angle=Math.atan2(to.y-shot.from.y,to.x-shot.from.x),size=4+Math.min(5,shot.rank)*.65;
    const arc=['icicles','dragon','planet'].includes(f.motion)?34:f.motion==='leap'?20:7;
    const x=shot.from.x+(to.x-shot.from.x)*t,y=shot.from.y+(to.y-shot.from.y)*t-Math.sin(t*Math.PI)*arc;
    if(['zeke','guardian','ancient_dragon'].includes(h.id))return;
    if(h.shape==='beam'){
      const atlas=f.atlas||'effects',frame=shot.form==='trauma'?15:f.frame;
      if(shot.form==='trauma')this.ultimate('time_magician',x,y,122,48,angle+.65,.9);
      else this.atlasStamp(atlas,frame,f.columns||7,f.rows||3,x,y,116+shot.rank*3,48,angle+(f.offset||0),.86);
      return;
    }
    if(f.atlas){this.stamp(h.id,x,y,48+Math.min(5,shot.rank)*3,angle,.95,shot.form);return;}
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
  drawFinisherLocks(s){
    for(const f of s.finishers){const target=s.enemies.find(e=>e.uid===f.target&&e.hp>0);if(!target)continue;const p=pathPoint(target.progress),row=f.kind==='royal'?0:4;
      if(f.kind==='mirror'){this.atlasStamp('effects-trio',5,3,2,p.x-(target.boss?38:15),p.y-(target.boss?27:18),target.boss?88:56,target.boss?104:68,0,.78);continue;}
      this.atlasStamp('finishers',row,4,3,p.x,p.y-(target.boss?35:16),target.boss?148:84,undefined,0,.88);
    }
  }
  drawFinishers(s){
    for(const f of s.finishers){const target=s.enemies.find(e=>e.uid===f.target&&e.hp>0);if(!target)continue;
      const to=pathPoint(target.progress),p=1-f.life/f.total,row=f.kind==='royal'?0:4;
      if(f.kind==='mirror'){
        // The lock follows its original enemy. Small shards fill from damage,
        // while the timer line conveys a fixed three-second detonation.
        const y=to.y+14,ctx=this.ctx,fill=f.cap?Math.min(1,f.stored*.45/f.cap):0;
        stroke(ctx,[[to.x-18,y],[to.x+18,y]],'#b4a0ce66',2);
        stroke(ctx,[[to.x-18,y],[to.x-18+36*p,y]],'#e5d6ff',2);
        for(let i=0;i<Math.ceil(fill*3);i++)diamond(ctx,to.x-8+i*8,y+7,2.5,'#ceb2ff');
        continue;
      }
      const from=f.kind==='royal'?{x:f.origin.x,y:f.origin.y-18}:{x:Math.max(30,to.x-100),y:Math.max(30,to.y-190)},end={x:to.x,y:to.y-(target.boss?35:18)},angle=Math.atan2(end.y-from.y,end.x-from.x);
      if(p<.58){this.atlasStamp('finishers',row+1,4,3,from.x,from.y,38+p*28,undefined,angle,.35+p*.65);continue;}
      const t=Math.pow(Math.min(1,(p-.58)/.42),.8),x=from.x+(end.x-from.x)*t,y=from.y+(end.y-from.y)*t;
      if(f.kind==='royal')this.ultimate('cherry_prince',x,y,170,142,angle,.95);
      else this.atlasStamp('finishers',row+1,4,3,x,y,175,undefined,angle,.95);
    }
  }
  // Large attack silhouettes belong below units and HP, with hit stamps above.
  // Age them once in draw(), regardless of how many layers use the same event.
  drawAttackShapes(){
    const ctx=this.ctx;
    // Twenty simultaneous basic attacks must not paint the entire grid red.
    // Keep a two-attack brightness budget; every real strike still has a shape.
    const flames=this.impacts.filter(e=>e.type==='attackShape'&&e.life>0&&['zeke','ancient_dragon'].includes(e.hero)).length;
    const fireClarity=Math.min(1,2/Math.max(1,flames));
    for(const e of this.impacts){
      if(e.type!=='attackShape'||e.life<=0)continue;
      const t=Math.max(0,1-e.life/e.total);
        const h=HERO[e.hero],fade=Math.sin(Math.PI*t);
        if(e.hero==='zeke'){
          ctx.save();ctx.translate(e.origin.x,e.origin.y);ctx.rotate(e.angle);
          ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,h.range,-Math.PI/4,Math.PI/4);ctx.closePath();ctx.clip();
          // Authored cone vertex is at (12%,50%), radius 64% of its square.
          // Clip every flame to the engine's exact 90-degree collision sector.
          const size=h.range/.64;
          this.atlasStamp('zeke-cone',0,1,1,size*.38,0,size,size,0,fade*.42*fireClarity,'source-over');
          ctx.globalAlpha=fade*.28*fireClarity;ctx.strokeStyle='#ffbc6a';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,h.range,-Math.PI/4,Math.PI/4);ctx.stroke();ctx.restore();
        }else if(e.hero==='guardian'){
          ctx.save();ctx.globalAlpha=fade*.62;ctx.strokeStyle=h.color;ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(e.origin.x,e.origin.y,h.range*(.32+t*.68),h.range*(.32+t*.68),0,0,Math.PI*2);ctx.stroke();ctx.restore();this.stamp('guardian',e.origin.x,e.origin.y,90+t*30,0,fade*.46);
        }else{
          ctx.save();ctx.translate(e.origin.x,e.origin.y);ctx.beginPath();ctx.arc(0,0,h.range,0,Math.PI*2);ctx.clip();
          this.atlasStamp('ancient-cross',0,1,1,0,0,h.range*1.6,h.range*1.6,0,fade*.26*fireClarity,'source-over');ctx.restore();
        }
    }
  }
  draw(dt){
    this.clock+=dt;const ctx=this.ctx;
    // Several ordinary strikes on one enemy share a local glow budget. Skills,
    // boss tells and execution receipts keep their own independent emphasis.
    const hitKey=e=>`${Math.round(e.x/24)}:${Math.round(e.y/24)}`,hitCounts=new Map();
    for(const e of this.impacts)if(e.type==='impact'&&e.life>dt){const key=hitKey(e);hitCounts.set(key,(hitCounts.get(key)||0)+1);}
    for(const e of this.impacts){e.life-=dt;const t=1-e.life/e.total;if(t>=1||e.type==='attackShape')continue;
      if(e.type==='pullImpact'){this.stamp(e.hero,e.x,e.y-18,72+t*22,0,(1-t)*.58);continue;}
      if(e.type==='instantKill'){
        // A brief, inward wind seal on the actual executed enemy. No screen
        // wash or additional burst competes with the boss danger indicators.
        this.stamp('storm_sage',e.x,e.y-18,84-t*48,-t*1.2,(1-t)*.88);
        ctx.save();ctx.globalAlpha=(1-t)*.6;ctx.strokeStyle='#c0ffe9';ctx.lineWidth=2;
        ctx.beginPath();ctx.ellipse(e.x,e.y+5,23*(1-t),8*(1-t),0,0,Math.PI*2);ctx.stroke();ctx.restore();continue;
      }
      if(e.type==='finisherImpact'||e.type==='finisherFizzle'){
        if(e.kind==='mirror'){this.atlasStamp('effects-trio',5,3,2,e.x,e.y-(e.targetBoss?29:18),280+t*70,320+t*50,0,(1-t)*(e.type==='finisherImpact'?.95:.3));if(e.type==='finisherImpact')for(const side of [-1,1])this.stamp('aurora',e.x+side*t*90,e.y-18,88,side<0?Math.PI:0,(1-t)*.85);continue;}
        const row=e.kind==='royal'?0:4,hit=e.type==='finisherImpact',angle=Math.atan2(e.y-(e.origin?.y||e.y),e.x-(e.origin?.x||e.x));
        if(hit&&e.kind==='royal')this.ultimate('cherry_prince',e.x,e.y-(e.targetBoss?35:18),210+t*44,180+t*35,angle,(1-t)*.94);
        else if(hit&&t<.75)this.atlasStamp('finishers',row+2,4,3,e.x,e.y-(e.targetBoss?35:18),220+t*35,undefined,angle,(1-t)*(this.reduced?.65:.95));
        this.atlasStamp('finishers',row+3,4,3,e.x,e.y-(e.targetBoss?35:18),190+t*65,undefined,0,(1-t)*.55);continue;
      }
      if(e.type==='transform'){this.atlasStamp('finishers',8+Math.min(3,Math.floor(t*4)),4,3,e.x,e.y-8,100,undefined,0,(1-t)*.85);continue;}
      if(e.type==='bossMagic'){this.atlasStamp('effects-expansion',{storm:7,duel:8,creation:9}[e.pattern],4,3,e.x,e.y-20,112+t*18,undefined,0,(1-t)*.85);continue;}
      if(e.type==='support'){
        // Support magic rises beside the recipient, never as a false enemy hit.
        const burst=e.hero==='santa'?168:150;
        this.ultimate(e.hero,e.x+24,e.y-22-t*28,burst+24*t,burst+24*t,0,(1-t)*.9);
        ctx.save();ctx.globalAlpha=(1-t)*.5;ctx.strokeStyle=HERO[e.hero].color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(e.x,e.y+25,23+t*10,8+t*3,0,0,Math.PI*2);ctx.stroke();ctx.restore();continue;
      }
      const large=e.type==='ultimate',size=large?118+Math.min(5,e.rank||1)*8:impactSize(e.hero,e.rank||1),hitClarity=e.type==='impact'?1/(hitCounts.get(hitKey(e))||1):1,alpha=Math.max(0,(1-t)*(large?.83:.9)*hitClarity);
      if(e.type==='impact'&&e.hero==='ancient_dragon'){this.atlasStamp('ancient-cross',0,1,1,e.x,e.y-18,size*.58,size*.58,0,alpha*.7,'source-over');continue;}
      if(large&&dedicated(e.hero)){this.ultimate(e.hero,e.x,e.y-22,size*(1+t*.35),size*(1+t*.35),0,alpha);continue;}
      if(FX_PROFILES[e.hero]?.atlas==='effects-trio'){
        const frame=FX_PROFILES[e.hero].frame+3,burst=e.type==='frostBreak';
        this.atlasStamp('effects-trio',frame,3,2,e.x,e.y-18,(large?118:burst?88:size)*(1+t*.35),undefined,0,alpha*(this.reduced?.7:1));
        continue;
      }
      this.stamp(e.hero,e.x,e.y-18,size*(.75+Math.sin(t*Math.PI/2)*.5),e.angle,alpha,e.form);
      if(large&&!this.reduced){ctx.save();ctx.globalAlpha=(1-t)*.32;ctx.strokeStyle=HERO[e.hero].color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(e.x,e.y,size*(.3+t*.25),size*(.12+t*.1),0,0,Math.PI*2);ctx.stroke();ctx.restore();}
    }
    this.impacts=this.impacts.filter(e=>e.life>0);
  }
}

// A static contract is useful to keep new companions from silently sharing VFX.
export const distinctAttackCount=()=>new Set(HEROES.map(h=>FX_PROFILES[h.id]?.motion)).size;
