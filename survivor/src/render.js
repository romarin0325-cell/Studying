import {playerPose,visualX,visualY,followCamera} from './motion.js';
import {WORLD,HERO,WEAPONS,WEAPON,STAGE,clamp} from './content.js';
import {BOSSES,bossKind} from './ordeal.js';
export async function loadArt(){
  const images={},failed=[];
  await Promise.all(Object.entries(globalThis.NOCTURNE_ASSETS||{}).filter(([id])=>!id.startsWith('walk-')).map(([id,url])=>new Promise(resolve=>{
    const img=new Image();let done=false;const finish=ok=>{if(done)return;done=true;clearTimeout(timer);if(ok)images[id]=img;else failed.push(id);resolve();};
    const timer=setTimeout(()=>finish(false),15000);img.onload=()=>finish(img.naturalWidth>0);img.onerror=()=>finish(false);img.src=url;
  })));
  return {images,failed,frames:globalThis.NOCTURNE_FRAMES||{},walking:new Map(),pending:new Map()};
}
export function loadWalking(art,id){
  const key='walk-'+id;art.walkingWanted=key;if(art.images[key]){art.walking.delete(key);art.walking.set(key,true);return Promise.resolve();}
  if(art.pending.has(key))return art.pending.get(key);
  const url=globalThis.NOCTURNE_ASSETS?.[key];if(!url)return Promise.resolve();
  const promise=new Promise(resolve=>{const img=new Image();let done=false;const finish=ok=>{if(done)return;done=true;clearTimeout(timer);art.pending.delete(key);if(ok){art.images[key]=img;art.walking.set(key,true);while(art.walking.size>2){const oldest=art.walking.keys().next().value;if(oldest===art.walkingWanted){art.walking.delete(oldest);art.walking.set(oldest,true);continue;}delete art.images[oldest];art.walking.delete(oldest);}}else if(!art.failed.includes(key))art.failed.push(key);resolve();};const timer=setTimeout(()=>finish(false),15000);img.onload=()=>finish(img.naturalWidth>0);img.onerror=()=>finish(false);img.src=url;});art.pending.set(key,promise);return promise;
}
export function unit(ctx,art,id,x,y,size=98,direction=0,alpha=1,phase=-1){
  const walking=phase>=0&&art.images['walk-'+id],img=walking||art.images['unit-'+id];if(!img)return;
  const cell=img.width/(walking?4:2),index=walking?direction*4+phase:direction;
  if(walking)size*=art.frames[id]?.walk?.displayScale||1;
  ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(img,index%(walking?4:2)*cell,Math.floor(index/(walking?4:2))*cell,cell,cell,x-size/2,y-size*.9375,size,size);ctx.restore();
}
const weaponIndex=Object.fromEntries(WEAPONS.map((w,i)=>[w.id,i]));
const enemyIndex={wisp:0,beetle:1,moth:2,stalker:3,ember:4,elite:5};
const canvas=(w,h=w)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
// Compact bounded arrays in place. Expired cosmetic objects return to a small pool.
function expire(list,pool){let n=0;for(const v of list){if(v.life>0)list[n++]=v;else if(pool.length<160)pool.push(v);}list.length=n;}
export class Renderer{
  constructor(element,art,settings){
    this.canvas=element;this.ctx=element.getContext('2d',{alpha:false});this.art=art;this.settings=settings;
    this.width=390;this.height=620;this.camera={x:800,y:800};this.time=0;this.zoom=1;this.dpr=1;this.drawCount=0;
    this.fx=[];this.particles=[];this.floaters=[];this.pool=[];this.visibleEntities=[];this.cache=new Map();this.numbers=new Map();this.backdrops=new Map();
    this.shake=0;this.flash=0;this.walkDistance=0;this.pose=null;this.autoTier=1;this.slowFrames=0;this.fastFrames=0;this.resize();
  }
  resize(){
    const rect=this.canvas.getBoundingClientRect();this.width=Math.max(1,rect.width);this.height=Math.max(1,rect.height);
    const quality=this.settings.quality||'auto',cap=quality==='high'?1.75:quality==='economy'?1:this.autoTier?1.5:1;
    this.dpr=Math.min(globalThis.devicePixelRatio||1,cap);this.canvas.width=Math.round(this.width*this.dpr);this.canvas.height=Math.round(this.height*this.dpr);this.zoom=clamp(this.width/430,.76,1.1);
    this.vignette=canvas(Math.ceil(this.width),Math.ceil(this.height));const c=this.vignette.getContext('2d'),g=c.createRadialGradient(this.width/2,this.height*.45,Math.min(this.width,this.height)*.32,this.width/2,this.height*.45,Math.max(this.width,this.height)*.75);g.addColorStop(0,'#050b1b00');g.addColorStop(1,'#050b1b65');c.fillStyle=g;c.fillRect(0,0,this.width,this.height);
  }
  observeFrame(workMs,frameMs,playing=true){
    if(this.settings.quality!=='auto'||!playing)return;
    if(workMs>12||frameMs>29){this.slowFrames++;this.fastFrames=0;}else if(workMs<7&&frameMs<22){this.fastFrames++;this.slowFrames=Math.max(0,this.slowFrames-1);}else{this.fastFrames=0;this.slowFrames=Math.max(0,this.slowFrames-1);}
    if(this.autoTier&&this.slowFrames>90){this.autoTier=0;this.slowFrames=0;this.resize();}
    else if(!this.autoTier&&this.fastFrames>360){this.autoTier=1;this.fastFrames=0;this.resize();}
  }
  get detail(){return this.settings.effects&&this.settings.quality!=='economy'&&(this.settings.quality==='high'||this.autoTier);}
  add(list,value,limit){if(list.length>=limit)return;const item=this.pool.pop()||{};for(const key of Object.keys(item))delete item[key];Object.assign(item,value);list.push(item);}
  events(events){for(const e of events){
    if(e.type==='hit'&&this.settings.numbers&&(!e.periodic||e.damage>50&&this.drawCount%5===0))this.add(this.floaters,{x:e.x,y:e.y-18,text:e.damage,color:e.crit?'#ffe0a0':e.color,life:.58,total:.58,crit:e.crit},this.detail?32:16);
    if(e.type==='heal')this.add(this.floaters,{x:e.x,y:e.y-50,text:'+'+e.value,color:'#bcf0c3',life:.8,total:.8},32);
    const duration={cast:.14,slash:.3,chain:.24,beam:.24,blast:.4,skill:1.25,dash:.3,bossTell:.7,orbitHit:.22,tell:.9,bond:.9,overdrive:1,reflection:.5,dodge:.5,portal:.6,secretFound:.8,encounter:.8};
    if(duration[e.type])this.add(this.fx,{...e,life:duration[e.type],total:duration[e.type]},this.detail?72:36);
    if(e.type==='hurt'){if(this.detail&&this.settings.motion!==false)this.shake=5;this.flash=.14;}
    if(e.type==='skill'&&this.detail&&this.settings.motion!==false)this.shake=3;
    if(e.type==='death'&&this.detail)for(let i=0;i<(e.elite?10:3);i++){const a=Math.random()*Math.PI*2;this.add(this.particles,{x:e.x,y:e.y-18,vx:Math.cos(a)*45,vy:Math.sin(a)*45-18,life:.45+Math.random()*.2,total:.65},96);}
  }}
  sprite(id,index=0,columns=4,rows=4){
    const key=id+':'+index;if(this.cache.has(key))return this.cache.get(key);
    const source=this.art.images[id];if(!source)return null;
    const sw=source.width/columns,sh=source.height/rows,c=canvas(sw,sh);c.getContext('2d').drawImage(source,index%columns*sw,Math.floor(index/columns)*sh,sw,sh,0,0,sw,sh);this.cache.set(key,c);return c;
  }
  image(id,index,x,y,size,rotation=0,alpha=1,columns=4,rows=4){
    const image=this.sprite(id,index,columns,rows);if(!image)return;
    const c=this.ctx;c.save();c.globalAlpha=alpha;c.translate(x,y);if(rotation)c.rotate(rotation);c.drawImage(image,-size/2,-size/2,size,size);c.restore();
  }
  background(stage){
    if(this.backdrops.has(stage.id))return this.backdrops.get(stage.id);
    const c=canvas(1024),ctx=c.getContext('2d'),bg=this.art.images[stage.bg];ctx.fillStyle=stage.floor;ctx.fillRect(0,0,1024,1024);if(bg)ctx.drawImage(bg,0,0,1024,1024);
    ctx.fillStyle='#07122228';ctx.fillRect(0,0,1024,1024);this.backdrops.set(stage.id,c);return c;
  }
  glow(x,y,r,color,alpha=.2){
    const key='glow:'+color;let img=this.cache.get(key);if(!img){img=canvas(128);const c=img.getContext('2d'),g=c.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,color);g.addColorStop(.4,color+'90');g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(0,0,128,128);this.cache.set(key,img);}
    const c=this.ctx;c.globalAlpha=alpha;c.drawImage(img,x-r,y-r,r*2,r*2);c.globalAlpha=1;
  }
  render(game,dt=1/60,input={x:0,y:0},alpha=1){
    dt=Math.min(.05,Math.max(0,dt));this.time+=dt;this.drawCount++;const c=this.ctx,p=game.player,stage=STAGE[game.stage],w=this.width,h=this.height;
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle=stage.floor;c.fillRect(0,0,w,h);
    this.alpha=clamp(alpha,0,1);this.pose=playerPose(p,this.alpha,input);this.walkDistance=this.pose.distance;this.walking=this.pose.moving;
    const hx=Math.min(WORLD/2,w/this.zoom/2),hy=Math.min(WORLD/2,h/this.zoom/2),tx=clamp(this.pose.x,hx,WORLD-hx),ty=clamp(this.pose.y,hy,WORLD-hy);
    this.cameraTarget??={x:tx,y:ty};this.camera.x=followCamera(this.camera.x,this.cameraTarget.x,tx,dt);this.camera.y=followCamera(this.camera.y,this.cameraTarget.y,ty,dt);this.cameraTarget.x=tx;this.cameraTarget.y=ty;
    const shake=this.detail&&this.settings.motion!==false?this.shake:0;this.shake=Math.max(0,this.shake-dt*30);
    c.save();c.translate(w/2+(Math.random()-.5)*shake,h/2+(Math.random()-.5)*shake);c.scale(this.zoom,this.zoom);c.translate(-this.camera.x,-this.camera.y);
    c.drawImage(this.background(stage),0,0,WORLD,WORLD);
    c.strokeStyle=stage.color+'60';c.lineWidth=3;c.strokeRect(40,40,WORLD-80,WORLD-80);
    for(const shrine of game.shrines)this.drawShrine(shrine,stage);
    for(const encounter of game.encounters)this.drawEncounter(encounter);
    if(game.portal){this.glow(game.portal.x,game.portal.y-20,42,'#ecdca8',.15);this.image('secrets',3,game.portal.x,game.portal.y-30,74,0,Math.min(1,game.portal.life),4,2);}
    if(game.secrets.includes('pocket')&&game.stillness>.5){c.globalAlpha=.2;c.drawImage(this.seal('pocket','#b6cdfb'),this.pose.x-155,this.pose.y-155,310,310);c.globalAlpha=1;}
    for(const f of game.fields)this.drawField(f);
    for(const d of game.drops){if(!this.visible(d.x,d.y,35))continue;const x=visualX(d,this.alpha),y=visualY(d,this.alpha)+(this.settings.motion===false?0:Math.sin(this.time*3+d.id)*1.4);
      const chest=d.kind==='chest';if(chest)this.glow(x,y,34,'#ffdc88',.3);
      this.image(d.kind==='xp'?'weapons':'relics',d.kind==='xp'?15:({chest:10,coin:14,heart:12,magnet:13})[d.kind],x,y-(chest?10:0),chest?48:d.kind==='xp'?(d.value>=10?22:d.value>=3?15:11):d.kind==='coin'?19:32);
    }
    // Sort existing actor references only; no per-actor wrapper allocation.
    const entities=this.visibleEntities;entities.length=0;for(const e of game.enemies)if(e.hp>0&&this.visible(e.x,e.y,e.boss?160:90))entities.push(e);entities.push(p);entities.sort((a,b)=>visualY(a,this.alpha)-visualY(b,this.alpha));
    for(const e of entities){if(e===p)this.drawPlayer(game);else this.drawEnemy(e,stage,visualX(e,this.alpha),visualY(e,this.alpha));}
    for(const s of game.shots)if(this.visible(s.x,s.y,50))this.image('effects',weaponIndex[s.weapon],visualX(s,this.alpha),visualY(s,this.alpha),s.evolved?49:35,Math.atan2(s.vy,s.vx));
    this.drawOrbits(game);this.drawFX(dt);
    // Enemy telegraphs remain above friendly effects, including in economy mode.
    for(const hazard of game.hazards){if(hazard.kind==='shot')this.image('effects',15,visualX(hazard,this.alpha),visualY(hazard,this.alpha),hazard.r*4,this.time*2);else this.drawWarning(hazard);}
    for(const f of this.floaters){f.life-=dt;f.y-=dt*23;const img=this.number(f);c.globalAlpha=clamp(f.life/f.total*2,0,1);c.drawImage(img,f.x-img.width/4,f.y-img.height/4,img.width/2,img.height/2);}expire(this.floaters,this.pool);c.globalAlpha=1;
    for(const v of this.particles){v.life-=dt;v.x+=v.vx*dt;v.y+=v.vy*dt;if(this.detail)this.image('effects',14,v.x,v.y,12,0,Math.max(0,v.life/v.total));}expire(this.particles,this.pool);c.restore();
    c.drawImage(this.vignette,0,0,w,h);if(this.flash>0){this.flash-=dt;c.strokeStyle=`rgba(231,123,137,${Math.max(0,this.flash*4)})`;c.lineWidth=10;c.strokeRect(0,0,w,h);}this.drawMinimap(game,w);
  }
  number(f){const key=f.text+':'+f.color+':'+!!f.crit;let img=this.numbers.get(key);if(img)return img;
    img=canvas(110,42);const c=img.getContext('2d');c.scale(2,2);c.font=`${f.crit?'bold 16':'12'}px system-ui`;c.textAlign='center';c.lineWidth=3;c.strokeStyle='#111628';c.strokeText(f.text,27.5,16);c.fillStyle=f.color;c.fillText(f.text,27.5,16);if(this.numbers.size>=96)this.numbers.delete(this.numbers.keys().next().value);this.numbers.set(key,img);return img;
  }
  visible(x,y,margin=40){return Math.abs(x-this.camera.x)<this.width/this.zoom/2+margin&&Math.abs(y-this.camera.y)<this.height/this.zoom/2+margin;}
  drawShrine(s,stage){if(!this.visible(s.x,s.y,90))return;const c=this.ctx;if(!s.used)this.glow(s.x,s.y-20,62,stage.color,.16);this.image('relics',15,s.x,s.y-30,91,0,s.used?.4:1);c.fillStyle=s.used?'#a0a4b5':'#efdfba';c.font='11px system-ui';c.textAlign='center';c.fillText(s.used?'빛을 나눈 자리':stage.landmarks[['moon','star','dawn'].indexOf(s.id)],s.x,s.y+24);}
  drawEncounter(e){
    if(e.used||!this.visible(e.x,e.y,110))return;const c=this.ctx,lantern=e.kind==='lantern';this.glow(e.x,e.y-20,56,lantern?'#cdb9ef':'#e8ce93',.2);this.image('secrets',lantern?5:7,e.x,e.y-29,79,0,Math.min(1,e.life),4,2);
    if(lantern){c.strokeStyle='#cdd6fa75';c.lineWidth=2;c.beginPath();c.ellipse(e.x,e.y+5,88,29,0,0,Math.PI*2);c.stroke();c.strokeStyle='#f1dfb4';c.beginPath();c.arc(e.x,e.y-29,43,-Math.PI/2,-Math.PI/2+Math.min(1,e.progress/3)*Math.PI*2);c.stroke();}
    c.fillStyle='#eadcbe';c.font='10px system-ui';c.textAlign='center';c.fillText(lantern?'빛 곁에서 '+Math.max(0,Math.ceil(3-e.progress))+'초':'낯선 별의 제단',e.x,e.y+33);
  }
  seal(id,color){
    const key='seal:'+id;let img=this.cache.get(key);if(img)return img;img=canvas(256);const c=img.getContext('2d');c.translate(128,128);c.strokeStyle=color;c.lineWidth=1.5;
    for(const r of [98,113,119]){c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();}
    for(let i=0;i<12;i++){c.save();c.rotate(i*Math.PI/6);c.beginPath();c.moveTo(0,-103);c.lineTo(0,-112);c.stroke();if(i%3===0){c.strokeRect(-4,-123,8,8);}c.restore();}
    c.lineWidth=1;for(let i=0;i<6;i++){c.save();c.rotate(i*Math.PI/3);c.beginPath();c.ellipse(0,-38,29,59,0,0,Math.PI*2);c.stroke();c.restore();}this.cache.set(key,img);return img;
  }
  drawField(f){if(!this.visible(f.x,f.y,f.r))return;const c=this.ctx,a=Math.min(1,f.life);c.save();c.translate(f.x,f.y);c.rotate(this.settings.motion===false?0:this.time*(f.gravity?-.2:.08));c.globalAlpha=a*.42;const seal=this.seal(f.weapon,f.color);c.drawImage(seal,-f.r,-f.r,f.r*2,f.r*2);c.restore();this.image('effects',weaponIndex[f.weapon],f.x,f.y,f.r*.8,this.time*.1,a*.22);}
  drawWarning(h){
    const line=h.kind==='line',reach=line?Math.hypot(h.bx-h.ax,h.by-h.ay)/2+h.r:h.r;
    if(!this.visible(h.x,h.y,reach))return;
    const c=this.ctx,t=clamp(1-h.wait/(h.telegraph||1.5),0,1),active=h.wait<=0;
    c.save();c.strokeStyle=active?'#ffe4be':'#ffb09b';c.fillStyle=active?'#e6684b66':`rgba(190,55,83,${.12+t*.18})`;c.lineWidth=2;c.lineCap='round';
    if(line){
      c.beginPath();c.moveTo(h.ax,h.ay);c.lineTo(h.bx,h.by);c.strokeStyle=active?'#ed704875':'#c4446048';c.lineWidth=h.r*2;c.stroke();
      c.strokeStyle=active?'#ffe4be':'#ffb09b';c.lineWidth=2;const a=Math.atan2(h.by-h.ay,h.bx-h.ax),dx=Math.sin(a)*h.r,dy=-Math.cos(a)*h.r;
      for(const side of [-1,1]){c.beginPath();c.moveTo(h.ax+dx*side,h.ay+dy*side);c.lineTo(h.bx+dx*side,h.by+dy*side);c.stroke();}
      c.setLineDash(active?[]:[7,8]);c.beginPath();c.moveTo(h.ax,h.ay);c.lineTo(h.bx,h.by);c.stroke();
    }else{
      c.beginPath();c.arc(h.x,h.y,h.r,0,Math.PI*2);if(h.kind==='annulus')c.arc(h.x,h.y,h.inner,0,Math.PI*2,true);c.fill('evenodd');c.stroke();
      if(!active){c.setLineDash([5,7]);c.beginPath();const r=h.kind==='annulus'?h.inner+(h.r-h.inner)*t:h.r*t;c.arc(h.x,h.y,r,0,Math.PI*2);c.stroke();}
    }
    c.setLineDash([]);if(!active){c.font='bold 15px system-ui';c.fillStyle='#ffddbb';c.textAlign='center';c.fillText('!',h.x,h.y-(h.kind==='annulus'?(h.inner+h.r)/2:0)+5);}c.restore();
  }
  shadow(x,y,r){const c=this.ctx;c.fillStyle='#05091668';c.beginPath();c.ellipse(x,y,r,r*.32,0,0,Math.PI*2);c.fill();}
  drawEnemy(e,stage,x=e.x,y=e.y){
    const c=this.ctx,size=e.boss?158:e.elite?92:e.kind==='beetle'?58:55;this.shadow(x,y+2,e.radius);
    const phase=this.settings.motion===false||e.freeze>0?0:Math.floor(this.time*(e.kind==='moth'?10:7)+e.id)%4;
    if(e.runner)this.image('secrets',6,x,y-27,84,0,1,4,2);
    else if(e.boss){const boss=BOSSES[bossKind(e,stage.id)],pose=boss.columns===2?(e.charge>0||e.ai<.65?1:0):phase;this.image(boss.atlas,boss.row*boss.columns+pose,x,y-size*.39,size+(e.overrun?12:0),0,1,boss.columns,3);}
    else this.image('enemies',enemyIndex[e.kind]*4+phase,x,y-size*.39,size,0,1,4,6);
    if(e.freeze>0)this.image('effects',4,x,y-22,70,0,.5);
    else if(e.slow>0){c.strokeStyle='#abddf08a';c.beginPath();c.ellipse(x,y+1,e.radius+3,7,0,0,Math.PI*2);c.stroke();}
    if(e.burn>0)this.image('effects',2,x+8,y-size*.8,28);
    if(e.flash>0)this.image('effects',14,x,y-size*.4,34,0,.65);
    if(e.kind==='stalker'&&e.charge>.55){c.strokeStyle='#ffbc8c';c.beginPath();c.arc(x,y-15,27,0,Math.PI*2);c.stroke();}
    if(e.elite||(e.hp/e.maxHp<.85&&!e.boss)){c.fillStyle='#10172cdd';c.fillRect(x-17,y+8,34,3);c.fillStyle=e.elite?'#ecc693':'#bba8d6';c.fillRect(x-17,y+8,34*clamp(e.hp/e.maxHp,0,1),3);}
  }
  drawPlayer(game){
    const c=this.ctx,p=game.player,color=HERO[game.hero].color,{x,y}=this.pose||p;this.shadow(x,y+3,18);
    c.strokeStyle=color+'85';c.lineWidth=1.5;c.beginPath();c.ellipse(x,y+3,22,8,0,0,Math.PI*2);c.stroke();
    const phase=this.walking&&this.settings.motion!==false?Math.floor(this.walkDistance/16)%4:1;
    const alpha=p.invulnerable>0&&p.dash<=0?.78+Math.sin(this.time*32)*.18:1;
    unit(c,this.art,game.hero,x,y,100,p.facing,alpha,phase);
    if(p.charge>=100)this.image('weapons',14,x,y-88,18,this.time*.3);
    if(game.overdrive>0){this.glow(x,y-25,53,'#ffd685',.2);this.image('effects',14,x-25,y-20,22,this.time);}
  }
  drawOrbits(game){const p=this.pose||game.player;for(const w of game.weapons)if(WEAPON[w.id].kind==='orbit'){const r=(70+w.level*6)*game.stats.area,n=2+Math.floor(w.level/2)+(w.evolved?2:0);for(let i=0;i<n;i++){const a=game.time*2.4+i*Math.PI*2/n;this.image('effects',weaponIndex[w.id],p.x+Math.cos(a)*r,p.y+Math.sin(a)*r,w.evolved?50:37,a);}}}
  drawFX(dt){const c=this.ctx;for(const e of this.fx){e.life-=dt;const t=1-e.life/e.total,alpha=clamp((1-t)*1.4,0,1);c.save();c.globalAlpha=alpha;c.strokeStyle=e.color||'#e7d5b0';
    if(e.type==='reflection')this.image('secrets',1,e.x,e.y-25,92,0,alpha*.8,4,2);
    else if(e.type==='portal')this.image('secrets',3,e.x,e.y-25,92,0,alpha*.8,4,2);
    else if(e.type==='secretFound'||e.type==='encounter')this.image('secrets',e.art??7,e.x,e.y-42,65+t*25,0,alpha*.8,4,2);
    else if(e.type==='cast')this.image('effects',14,e.x,e.y,28,0,alpha);
    else if(e.type==='slash')this.image('effects',2,e.x+Math.cos(e.angle)*e.r*.4,e.y+Math.sin(e.angle)*e.r*.4,e.r*1.8,e.angle,alpha*.85);
    else if(e.type==='beam'||e.type==='chain'){
      const dx=e.tx-e.x,dy=e.ty-e.y,d=Math.hypot(dx,dy),img=this.sprite('effects',e.type==='chain'?10:7);
      c.translate(e.x,e.y);c.rotate(Math.atan2(dy,dx));if(img)c.drawImage(img,0,-(e.width||18)/2,d,e.width||18);
      c.lineWidth=e.type==='beam'?2:1.5;c.strokeStyle='#fffae0';c.beginPath();c.moveTo(0,0);if(e.type==='chain')for(let i=1;i<6;i++)c.lineTo(d*i/6,(i%2?1:-1)*7*(1-t));c.lineTo(d,0);c.stroke();
    }else if(e.type==='blast'||e.type==='orbitHit')this.image('effects',e.weapon?weaponIndex[e.weapon]:14,e.x,e.y,(e.r||40)*2*(.5+t*.5),t,alpha);
    else if(['skill','bond','overdrive'].includes(e.type)){
      const r=e.type==='skill'?125+t*90:90+t*65;c.translate(e.x,e.y);c.rotate(this.settings.motion===false?0:t*.4);c.globalAlpha=alpha*.58;c.drawImage(this.seal(e.hero||e.type,e.color||'#ffe0a6'),-r,-r,r*2,r*2);this.image('effects',weaponIndex[HERO[e.hero]?.weapon]??14,0,0,r*.9,0,alpha*.5);
    }else if(e.type==='dash')this.image('effects',9,e.x+e.dx*35*t,e.y-30+e.dy*35*t,70,Math.atan2(e.dy,e.dx),alpha*.5);
    else if(e.type==='tell'){c.strokeStyle='#ffad8c';c.setLineDash([6,8]);c.beginPath();c.moveTo(e.x,e.y-18);c.lineTo(e.x+Math.cos(e.angle)*e.length,e.y+Math.sin(e.angle)*e.length-18);c.stroke();}
    else if(e.type==='dodge'){c.fillStyle='#c3ecdf';c.font='11px system-ui';c.textAlign='center';c.fillText('빛 사이로',e.x,e.y-55-t*16);}else if(e.type==='bossTell'){c.strokeStyle='#ffbc94';c.lineWidth=2;c.beginPath();c.arc(e.x,e.y,70+t*30,0,Math.PI*2);c.stroke();}c.restore();
  }expire(this.fx,this.pool);}
  drawMinimap(game,w){const c=this.ctx,size=60,x=w-size-12,y=14;c.save();c.fillStyle='#0e162ac9';c.fillRect(x,y,size,size);c.strokeStyle='#b5c0df45';c.strokeRect(x,y,size,size);const scale=size/WORLD;for(const s of game.shrines)if(!s.used){c.fillStyle='#e7d19a';c.fillRect(x+s.x*scale-1.5,y+s.y*scale-1.5,3,3);}for(const e of game.encounters)if(!e.used){c.fillStyle='#d7b9fa';c.fillRect(x+e.x*scale-2,y+e.y*scale-2,4,4);}if(game.portal){c.fillStyle='#a8dcdf';c.fillRect(x+game.portal.x*scale-2,y+game.portal.y*scale-2,4,4);}for(const e of game.enemies)if(e.boss){c.fillStyle='#ff988a';c.fillRect(x+e.x*scale-2,y+e.y*scale-2,4,4);}c.fillStyle=HERO[game.hero].color;c.beginPath();c.arc(x+game.player.x*scale,y+game.player.y*scale,2.5,0,Math.PI*2);c.fill();c.restore();}
  screenToWorld(x,y){return {x:(x-this.width/2)/this.zoom+this.camera.x,y:(y-this.height/2)/this.zoom+this.camera.y};}
}
