import { WORLD,HERO,WEAPON,STAGE,clamp,length } from './content.js';
export async function loadArt(){
  const assets=globalThis.NOCTURNE_ASSETS||{},images={},failed=[];
  await Promise.all(Object.entries(assets).filter(([id])=>id!=='font').map(([id,url])=>new Promise(resolve=>{
    const img=new Image();let done=false;const finish=ok=>{if(done)return;done=true;clearTimeout(timer);if(ok)images[id]=img;else failed.push(id);resolve();};const timer=setTimeout(()=>finish(false),6000);img.onload=()=>finish(img.naturalWidth>0);img.onerror=()=>finish(false);img.src=url;
  })));
  return {images,failed,frames:globalThis.NOCTURNE_FRAMES||{}};
}
export function unit(ctx,art,id,x,y,size=98,direction=0,alpha=1){
  const image=art.images['unit-'+id];if(!image){ctx.fillStyle=HERO[id]?.color||'#c1d9dc';ctx.beginPath();ctx.arc(x,y-22,17,0,Math.PI*2);ctx.fill();return;}
  const cell=image.width/2;ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(image,direction%2*cell,Math.floor(direction/2)*cell,cell,cell,x-size/2,y-size*480/512,size,size);ctx.restore();
}
const star=(ctx,x,y,r,color,points=4,rotation=0)=>{ctx.fillStyle=color;ctx.beginPath();for(let i=0;i<points*2;i++){const a=rotation+i*Math.PI/points,rr=i%2?r*.33:r;ctx.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}ctx.closePath();ctx.fill();};
function sigil(c,hero,x,y,r,color,rotation=0){
  c.save();c.translate(x,y);c.rotate(rotation);c.strokeStyle=color;c.fillStyle=color;c.lineWidth=1.6;
  if(hero==='snow_rabbit'){for(let i=0;i<6;i++){c.rotate(Math.PI/3);c.beginPath();c.moveTo(0,0);c.lineTo(0,-r);c.moveTo(-r*.25,-r*.65);c.lineTo(0,-r*.42);c.lineTo(r*.25,-r*.65);c.stroke();}}
  else if(hero==='jasmine'){for(let i=0;i<5;i++){c.rotate(Math.PI*2/5);c.beginPath();c.ellipse(0,-r*.52,r*.22,r*.48,0,0,Math.PI*2);c.stroke();}star(c,0,0,r*.22,color,5);}
  else if(hero==='time_ruler'){c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();for(let i=0;i<12;i++){const a=i*Math.PI/6;c.beginPath();c.moveTo(Math.cos(a)*r*.82,Math.sin(a)*r*.82);c.lineTo(Math.cos(a)*r*.96,Math.sin(a)*r*.96);c.stroke();}c.beginPath();c.moveTo(0,-r*.62);c.lineTo(0,0);c.lineTo(r*.46,0);c.stroke();}
  else if(hero==='silver_rabbit'){c.beginPath();c.arc(0,0,r*.5,0,Math.PI*2);c.stroke();for(let i=0;i<12;i++){const a=i*Math.PI/6;c.beginPath();c.moveTo(Math.cos(a)*r*.67,Math.sin(a)*r*.67);c.lineTo(Math.cos(a)*r,Math.sin(a)*r);c.stroke();}}
  else if(hero==='cinderella'){c.beginPath();c.moveTo(0,-r);c.lineTo(r*.55,0);c.lineTo(0,r);c.lineTo(-r*.55,0);c.closePath();c.stroke();c.beginPath();c.moveTo(0,-r);c.lineTo(0,r);c.moveTo(-r*.55,0);c.lineTo(r*.55,0);c.stroke();}
  else if(hero==='luna'||hero==='night_rabbit'){c.beginPath();c.arc(0,0,r,-Math.PI*.4,Math.PI*.9);c.arc(-r*.27,-r*.12,r*.82,Math.PI*.72,-Math.PI*.3,true);c.closePath();c.fill();if(hero==='night_rabbit'){star(c,r*.7,-r*.4,r*.23,color,4);}}
  else if(hero==='zeke'){c.beginPath();c.moveTo(0,-r);c.bezierCurveTo(r*.15,-r*.2,r*.75,-r*.7,r*.85,-r*.1);c.bezierCurveTo(r,r*.7,r*.2,r,r*.05,r*.7);c.bezierCurveTo(-r*.8,r,-r*.9,0,0,-r);c.closePath();c.stroke();c.beginPath();c.moveTo(-r*1.4,-r*.6);c.quadraticCurveTo(-r*.45,-r*.45,0,0);c.quadraticCurveTo(r*.45,-r*.45,r*1.4,-r*.6);c.stroke();}
  else star(c,0,0,r,color,5,-Math.PI/2);
  c.restore();
}
export class Renderer {
  constructor(canvas,art,settings){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.art=art;this.settings=settings;this.width=390;this.height=620;this.camera={x:800,y:800};this.zoom=1;this.fx=[];this.particles=[];this.floaters=[];this.shake=0;this.flash=0;this.time=0;this.lastHeroMotion=0;this.drawCount=0;this.dpr=1;this.backdrops=new Map();this.resize();}
  resize(){const rect=this.canvas.getBoundingClientRect();this.width=Math.max(1,rect.width);this.height=Math.max(1,rect.height);this.dpr=Math.min(globalThis.devicePixelRatio||1,1.75);this.canvas.width=Math.floor(this.width*this.dpr);this.canvas.height=Math.floor(this.height*this.dpr);this.zoom=clamp(this.width/430,.76,1.1);}
  events(events){for(const e of events){
    if(e.type==='hit'&&this.settings.numbers&&this.floaters.length<42&&(!e.periodic||Math.random()<.1))this.floaters.push({x:e.x,y:e.y,text:e.damage,color:e.crit?'#ffe4a0':e.color,life:.65,total:.65,crit:e.crit});
    if(e.type==='heal')this.floaters.push({x:e.x,y:e.y-50,text:'+'+e.value,color:'#b7ebc0',life:1,total:1});
    if(['slash','chain','beam','blast','skill','dash','bossTell','orbitHit','tell'].includes(e.type)){const duration={slash:.3,chain:.28,beam:.22,blast:.42,skill:1.5,dash:.35,bossTell:.7,orbitHit:.22,tell:.9}[e.type];if(this.fx.length<90)this.fx.push({...e,life:duration,total:duration});}
    if(e.type==='hurt'){if(this.settings.effects)this.shake=6;this.flash=.13;}
    if(e.type==='skill'&&this.settings.effects)this.shake=4;
    if(e.type==='death'&&this.settings.effects&&this.particles.length<130)for(let i=0;i<(e.elite?12:4);i++){const a=Math.random()*Math.PI*2;this.particles.push({x:e.x,y:e.y-18,vx:Math.cos(a)*45,vy:Math.sin(a)*45-18,life:.5+Math.random()*.25,total:.75,color:e.color,size:2+Math.random()*2});}
  }}
  background(stage){
    if(this.backdrops.has(stage.id))return this.backdrops.get(stage.id);
    const c=document.createElement('canvas');c.width=1024;c.height=1024;const ctx=c.getContext('2d'),bg=this.art.images[stage.bg];ctx.fillStyle=stage.floor;ctx.fillRect(0,0,1024,1024);
    if(bg){ctx.globalAlpha=.9;ctx.drawImage(bg,0,0,1024,1024);ctx.globalAlpha=1;ctx.fillStyle=stage.floor+'18';ctx.fillRect(0,0,1024,1024);}
    // A quiet navigable center preserves the painted border without tiled seams.
    const grad=ctx.createRadialGradient(512,512,60,512,512,640);grad.addColorStop(0,stage.floor+'22');grad.addColorStop(1,stage.floor+'00');ctx.fillStyle=grad;ctx.fillRect(0,0,1024,1024);
    ctx.strokeStyle='#d9e1d20b';ctx.lineWidth=1;for(let i=0;i<16;i++){ctx.beginPath();ctx.moveTo(i*64,0);ctx.lineTo(i*64,1024);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*64);ctx.lineTo(1024,i*64);ctx.stroke();}
    for(let i=0;i<120;i++){const x=(i*173.7)%1024,y=(i*317.8)%1024;ctx.fillStyle=i%3?'#91b39e28':'#c4d8c621';ctx.beginPath();ctx.ellipse(x,y,1.5+i%3,1, i*.3,0,Math.PI*2);ctx.fill();if(i%9===0){ctx.strokeStyle='#8da89360';ctx.lineWidth=1;for(let j=0;j<3;j++){ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+j*2-3,y-5,x+j*3-4,y-9+j);ctx.stroke();}star(ctx,x-4,y-9,2.5,'#c5cce9');}}
    this.backdrops.set(stage.id,c);return c;
  }
  render(game,dt=1/60,input={x:0,y:0}){
    this.time+=Math.min(.05,dt);this.drawCount++;const c=this.ctx,w=this.width,h=this.height,p=game.player,stage=STAGE[game.stage],zoom=this.zoom;
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle=stage.floor;c.fillRect(0,0,w,h);
    const halfW=w/zoom/2,halfH=h/zoom/2;const cx=clamp(p.x,halfW,WORLD-halfW),cy=clamp(p.y,halfH,WORLD-halfH);
    this.camera.x+=(cx-this.camera.x)*Math.min(1,dt*9);this.camera.y+=(cy-this.camera.y)*Math.min(1,dt*9);
    const shake=this.settings.effects?this.shake:0;this.shake=Math.max(0,this.shake-dt*30);
    c.save();c.translate(w/2+(Math.random()-.5)*shake,h/2+(Math.random()-.5)*shake);c.scale(zoom,zoom);c.translate(-this.camera.x,-this.camera.y);
    c.drawImage(this.background(stage),0,0,WORLD,WORLD);
    c.strokeStyle=stage.color+'60';c.lineWidth=3;c.strokeRect(40,40,WORLD-80,WORLD-80);
    for(const shrine of game.shrines)this.drawShrine(shrine,stage);
    for(const field of game.fields)this.drawField(field);
    for(const hazard of game.hazards)if(hazard.kind!=='shot')this.drawWarning(hazard);
    for(const d of game.drops){if(!this.visible(d.x,d.y,30))continue;const y=d.y+Math.sin(this.time*3+d.id)*2;
      if(d.kind==='xp'){const r=d.value>=10?7:d.value>=3?5:3.5;star(c,d.x,y,r,d.value>=10?'#d5b8ef':'#9fe6d0',4,Math.PI/4);}
      else if(d.kind==='coin'){c.fillStyle='#f5d58f';c.beginPath();c.arc(d.x,y,4.5,0,Math.PI*2);c.fill();c.strokeStyle='#a87b42';c.stroke();}
      else if(d.kind==='chest'){this.glow(d.x,y,28,'#edcea2',.18);c.fillStyle='#ab7648';c.fillRect(d.x-12,y-8,24,18);c.fillStyle='#e9ca85';c.fillRect(d.x-13,y-8,26,5);c.fillRect(d.x-2,y-2,4,7);c.strokeStyle='#e9ca85';c.strokeRect(d.x-12,y-8,24,18);star(c,d.x,y-22,5,'#f8e3b6');}
      else {c.font='20px Georgia';c.textAlign='center';c.fillStyle=d.kind==='heart'?'#f1a6b5':'#a4e1f3';c.fillText(d.kind==='heart'?'♥':'✧',d.x,y);}
    }
    const entities=game.enemies.filter(e=>e.hp>0&&this.visible(e.x,e.y,e.radius+50)).map(e=>({y:e.y,e}));entities.push({y:p.y,player:true});entities.sort((a,b)=>a.y-b.y);
    for(const entry of entities){if(entry.player)this.drawPlayer(game,input);else this.drawEnemy(entry.e,stage);}
    for(const s of game.shots){if(!this.visible(s.x,s.y,30))continue;c.save();c.translate(s.x,s.y);c.rotate(Math.atan2(s.vy,s.vx));c.strokeStyle=s.color+'90';c.lineWidth=s.radius*.7;c.beginPath();c.moveTo(-22,0);c.lineTo(0,0);c.stroke();
      if(s.kind==='homing')star(c,0,0,s.radius+3,s.color,5,this.time*2);else {c.fillStyle=s.color;c.beginPath();c.moveTo(14,0);c.lineTo(-9,-s.radius);c.lineTo(-4,0);c.lineTo(-9,s.radius);c.closePath();c.fill();c.fillStyle='#ffffff';c.fillRect(-2,-1,12,2);}c.restore();}
    for(const hazard of game.hazards)if(hazard.kind==='shot'){c.fillStyle='#e694b2';c.beginPath();c.arc(hazard.x,hazard.y,hazard.r,0,Math.PI*2);c.fill();star(c,hazard.x,hazard.y,3,'#ffecd2');}
    this.drawOrbits(game);this.drawFX(dt);
    for(const floater of this.floaters){floater.life-=dt;floater.y-=dt*24;c.globalAlpha=clamp(floater.life/floater.total*2,0,1);c.font=`${floater.crit?'bold 17':'13'}px system-ui`;c.textAlign='center';c.fillStyle='#132224';c.fillText(floater.text,floater.x+1,floater.y+1);c.fillStyle=floater.color;c.fillText(floater.text,floater.x,floater.y);}this.floaters=this.floaters.filter(f=>f.life>0);c.globalAlpha=1;
    if(this.settings.effects)for(const particle of this.particles){particle.life-=dt;particle.x+=particle.vx*dt;particle.y+=particle.vy*dt;c.globalAlpha=Math.max(0,particle.life/particle.total);star(c,particle.x,particle.y,particle.size,particle.color);}this.particles=this.particles.filter(p=>p.life>0);c.globalAlpha=1;c.restore();
    const vignette=c.createRadialGradient(w/2,h*.45,Math.min(w,h)*.2,w/2,h*.45,Math.max(w,h)*.75);vignette.addColorStop(0,'#07161d00');vignette.addColorStop(1,'#07161d80');c.fillStyle=vignette;c.fillRect(0,0,w,h);
    if(this.flash>0){this.flash-=dt;c.strokeStyle=`rgba(231,123,137,${Math.max(0,this.flash*4)})`;c.lineWidth=12;c.strokeRect(0,0,w,h);}
    this.drawMinimap(game,w,h);
  }
  visible(x,y,margin=40){return Math.abs(x-this.camera.x)<this.width/this.zoom/2+margin&&Math.abs(y-this.camera.y)<this.height/this.zoom/2+margin;}
  glow(x,y,r,color,alpha=.15){const c=this.ctx;c.save();c.globalAlpha=alpha;const grad=c.createRadialGradient(x,y,0,x,y,r);grad.addColorStop(0,color);grad.addColorStop(1,color+'00');c.fillStyle=grad;c.fillRect(x-r,y-r,r*2,r*2);c.restore();}
  drawShrine(s,stage){const c=this.ctx;if(!this.visible(s.x,s.y,90))return;c.save();c.translate(s.x,s.y);c.globalAlpha=s.used?.4:1;const color=s.id==='moon'?'#adc5ee':s.id==='star'?'#efdab1':'#e6b3c4';this.glow(0,-10,65,color,.13);c.strokeStyle=color+'40';c.lineWidth=1;c.beginPath();c.ellipse(0,4,38,16,0,0,Math.PI*2);c.stroke();c.fillStyle='#273d43';c.beginPath();c.moveTo(-15,0);c.lineTo(-12,-35);c.lineTo(12,-35);c.lineTo(15,0);c.closePath();c.fill();c.strokeStyle=color+'70';c.stroke();star(c,0,-44+Math.sin(this.time*2)*3,13,color,4,this.time*.1);c.font='10px system-ui';c.textAlign='center';c.fillStyle=color;c.fillText(s.used?'빛을 나눈 자리':stage.landmarks[['moon','star','dawn'].indexOf(s.id)],0,24);c.restore();}
  drawField(f){const c=this.ctx;if(!this.visible(f.x,f.y,f.r))return;const a=clamp(f.life,.0,.9);c.save();c.globalAlpha=a*.18;c.fillStyle=f.color;c.beginPath();c.arc(f.x,f.y,f.r,0,Math.PI*2);c.fill();c.globalAlpha=a*.6;c.strokeStyle=f.color;c.lineWidth=1.5;c.setLineDash(f.weapon==='clock'?[4,12]:[]);c.beginPath();c.arc(f.x,f.y,f.r*(.94+.02*Math.sin(this.time*3)),0,Math.PI*2);c.stroke();c.setLineDash([]);
    if(f.weapon==='clock'){for(let i=0;i<12;i++){const a=i*Math.PI/6;c.beginPath();c.moveTo(f.x+Math.cos(a)*f.r*.85,f.y+Math.sin(a)*f.r*.85);c.lineTo(f.x+Math.cos(a)*f.r*.94,f.y+Math.sin(a)*f.r*.94);c.stroke();}c.beginPath();c.moveTo(f.x,f.y);c.lineTo(f.x+Math.sin(this.time)*f.r*.7,f.y-Math.cos(this.time)*f.r*.7);c.stroke();}
    else for(let i=0;i<6;i++){const a=i*Math.PI/3+this.time*.3;star(c,f.x+Math.cos(a)*f.r*.65,f.y+Math.sin(a)*f.r*.65,f.gravity?3:7,f.color,f.weapon==='rose'?5:4,a);}
    c.restore();}
  drawWarning(h){const c=this.ctx;if(!this.visible(h.x,h.y,h.r))return;const t=clamp(1-h.wait/1.5,0,1);c.save();c.strokeStyle='#ff9a8b';c.lineWidth=2;c.fillStyle=`rgba(213,100,104,${.07+t*.15})`;c.beginPath();c.arc(h.x,h.y,h.r,0,Math.PI*2);c.fill();c.stroke();c.setLineDash([7,7]);c.beginPath();c.arc(h.x,h.y,h.r*t,0,Math.PI*2);c.stroke();c.setLineDash([]);c.font='bold 22px system-ui';c.fillStyle='#ffd6ae';c.textAlign='center';c.fillText('!',h.x,h.y+7);c.restore();}
  drawEnemy(e,stage){
    const c=this.ctx;c.save();c.translate(e.x,e.y);c.fillStyle='#09121b60';c.beginPath();c.ellipse(0,3,e.radius*.9,e.radius*.38,0,0,Math.PI*2);c.fill();const hover=Math.sin(this.time*4+e.id)*2;
    if(e.kind==='wisp'){
      const colors=['#95d1c6','#b7a2d9','#b5cfe5'];const color=colors[e.variant];c.fillStyle=color+'a0';c.beginPath();c.moveTo(0,-27+hover);c.bezierCurveTo(20,-20+hover,14,-4,0,-1);c.bezierCurveTo(-14,-4,-20,-20+hover,0,-27+hover);c.fill();star(c,0,-14+hover,8,'#d5f0e5',4,this.time);c.fillStyle='#293340';c.fillRect(-4,-16+hover,2,3);c.fillRect(3,-16+hover,2,3);
    }else {const image=this.art.images[(e.boss?'boss':e.elite?'sentinel':'enemy')+'-'+(e.boss?stage.boss:e.elite?stage.enemy:(stage.enemy+({beetle:0,moth:1,stalker:2,ember:3}[e.kind]||0))%4)];const size=e.boss?135:e.elite?86:e.kind==='beetle'?54:45;
      if(image){c.save();const tilt=e.kind==='moth'?Math.sin(this.time*6)*.06:Math.sin(this.time*4+e.id)*.04;c.rotate(tilt);c.drawImage(image,-size/2,-size*.85+hover,size,size);c.restore();}else star(c,0,-18,e.radius,stage.color,5,this.time*.2);
      if(e.kind==='stalker'&&e.charge>.55){c.strokeStyle='#ffcaa3';c.beginPath();c.arc(0,-15,25,0,Math.PI*2);c.stroke();}
    }
    if(e.freeze>0){c.fillStyle='#a5ddf330';c.strokeStyle='#afe9ffb0';c.beginPath();for(let i=0;i<6;i++){const a=Math.PI*i/3;c.lineTo(Math.cos(a)*(e.radius+8),Math.sin(a)*(e.radius+8)-14);}c.closePath();c.fill();c.stroke();}
    else if(e.slow>0){c.strokeStyle='#a0d7ee80';c.beginPath();c.ellipse(0,2,e.radius+4,7,0,0,Math.PI*2);c.stroke();}
    if(e.burn>0)star(c,8,-e.radius*2-8,6,'#ffae77',4,this.time*3);
    if(e.flash>0){c.globalAlpha=e.flash*3;c.fillStyle='#fff1ce';c.beginPath();c.arc(0,-e.radius, e.radius*.75,0,Math.PI*2);c.fill();c.globalAlpha=1;}
    if(e.elite||(e.hp/e.maxHp<.9&&!e.boss)){c.fillStyle='#15202bbb';c.fillRect(-18,9,36,3);c.fillStyle=e.elite?'#ecc693':'#bba8d6';c.fillRect(-18,9,36*clamp(e.hp/e.maxHp,0,1),3);}
    c.restore();
  }
  drawPlayer(game,input){const c=this.ctx,p=game.player,id=game.hero,color=HERO[id].color;c.save();c.translate(p.x,p.y);c.fillStyle='#06151b88';c.beginPath();c.ellipse(0,4,18,7,0,0,Math.PI*2);c.fill();c.strokeStyle=color+'50';c.beginPath();c.ellipse(0,3,21,8,0,0,Math.PI*2);c.stroke();
    const moving=length(input.x,input.y)>.1||p.dash>0,bob=moving?Math.sin(game.time*14)*1.5:Math.sin(this.time*2)*.5;
    const alpha=p.invulnerable>0&&p.dash<=0?.75+Math.sin(this.time*32)*.2:1;unit(c,this.art,id,0,-bob,100,p.facing,alpha);if(p.charge>=100){star(c,0,-77+Math.sin(this.time*2)*2,5,'#fce1a7');}if(p.boost>0||p.haste>0){c.strokeStyle=color+'90';c.lineWidth=1.5;c.beginPath();c.ellipse(0,3,27,10,0,0,Math.PI*2);c.stroke();}c.restore();}
  drawOrbits(game){const c=this.ctx,p=game.player;for(const w of game.weapons)if(WEAPON[w.id].kind==='orbit'){const r=(70+w.level*6)*game.stats.area,n=2+Math.floor(w.level/2)+(w.evolved?2:0);c.strokeStyle=WEAPON[w.id].color+'28';c.beginPath();c.arc(p.x,p.y,r,0,Math.PI*2);c.stroke();for(let i=0;i<n;i++){const a=game.time*2.4+i*Math.PI*2/n,x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r;star(c,x,y,13,WEAPON[w.id].color,4,a);}}}
  drawFX(dt){const c=this.ctx;for(const e of this.fx){e.life-=dt;const t=1-e.life/e.total;c.save();c.globalAlpha=clamp((1-t)*1.4,0,1);c.strokeStyle=e.color||'#ead5aa';c.fillStyle=e.color||'#ead5aa';
      if(e.type==='slash'){c.translate(e.x,e.y);c.rotate(e.angle);c.lineWidth=6*(1-t)+1;c.beginPath();c.arc(0,0,e.r*(.6+t*.4),-1.25+2.5*t,-.8+2.5*t);c.stroke();c.globalAlpha*=.3;c.lineWidth=14;c.stroke();}
      else if(e.type==='beam'){c.lineCap='round';c.lineWidth=e.width*(1-t);c.beginPath();c.moveTo(e.x,e.y);c.lineTo(e.tx,e.ty);c.stroke();c.strokeStyle='#fff5dc';c.lineWidth=2;c.stroke();}
      else if(e.type==='chain'){c.lineWidth=2.5;c.beginPath();c.moveTo(e.x,e.y);for(let i=1;i<6;i++){const s=i/6;const off=(i%2?1:-1)*9*(1-t);c.lineTo(e.x+(e.tx-e.x)*s+off,e.y+(e.ty-e.y)*s-off);}c.lineTo(e.tx,e.ty);c.stroke();if(e.flower)star(c,e.tx,e.ty,9*(1-t),e.color,5);}
      else if(e.type==='blast'){c.lineWidth=3*(1-t);c.beginPath();c.arc(e.x,e.y,e.r*(.2+t*.8),0,Math.PI*2);c.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4;star(c,e.x+Math.cos(a)*e.r*t,e.y+Math.sin(a)*e.r*t,7*(1-t),e.color,4,a);}}
      else if(e.type==='skill'){c.globalAlpha=Math.max(0,(1-t)*.3);c.lineWidth=2;const motion=this.settings.effects?t:.3;for(let i=0;i<2;i++){c.beginPath();c.arc(e.x,e.y,50+motion*230+i*18,0,Math.PI*2);c.stroke();}sigil(c,e.hero,e.x,e.y,80+motion*20,e.color,e.hero==='time_ruler'?0:motion*.2);for(let i=0;i<8;i++){const a=i*Math.PI/4+motion*.2;sigil(c,e.hero,e.x+Math.cos(a)*145,e.y+Math.sin(a)*145,12,e.color,a);}}
      else if(e.type==='dash'){c.strokeStyle=HERO.rumi.color+'60';c.lineWidth=8*(1-t);c.beginPath();c.moveTo(e.x,e.y-20);c.lineTo(e.x+e.dx*50*t,e.y+e.dy*50*t-20);c.stroke();}
      else if(e.type==='tell'){c.strokeStyle='#ffb59180';c.setLineDash([6,8]);c.beginPath();c.moveTo(e.x,e.y-15);c.lineTo(e.x+Math.cos(e.angle)*e.length,e.y+Math.sin(e.angle)*e.length-15);c.stroke();}
      else if(e.type==='bossTell'){c.strokeStyle='#f3b58e80';c.lineWidth=2;c.beginPath();c.arc(e.x,e.y,70+t*30,0,Math.PI*2);c.stroke();}
      c.restore();}this.fx=this.fx.filter(e=>e.life>0);
  }
  drawMinimap(game,w,h){const c=this.ctx,size=64,x=w-size-14,y=15;c.save();c.fillStyle='#10232d9c';c.fillRect(x,y,size,size);c.strokeStyle='#a3c0bb40';c.strokeRect(x,y,size,size);const scale=size/WORLD;
    for(const s of game.shrines)if(!s.used)star(c,x+s.x*scale,y+s.y*scale,3,'#ead6a9');for(const e of game.enemies)if(e.boss){c.fillStyle='#efaca3';c.fillRect(x+e.x*scale-2,y+e.y*scale-2,4,4);}c.fillStyle=HERO[game.hero].color;c.beginPath();c.arc(x+game.player.x*scale,y+game.player.y*scale,2.5,0,Math.PI*2);c.fill();c.restore();}
  screenToWorld(x,y){return {x:(x-this.width/2)/this.zoom+this.camera.x,y:(y-this.height/2)/this.zoom+this.camera.y};}
}
