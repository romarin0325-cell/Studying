import {HERO,ASSET_PATHS,BOSSES,CHAPTERS,TRANSFORM_ART} from '../content.js';
import {BOARD,cellPoint,pathPoint,PATH,canMerge,unitForm} from './engine.js';
import {CombatFX,drawAttackRange,isUR} from './effects.js';

export class Art {
  constructor(){this.images={};this.failed=[];this.ready=this.load();}
  async load(){await Promise.all(Object.entries(ASSET_PATHS).map(([id,path])=>new Promise(resolve=>{
    const image=new Image();let finished=false;
    const done=(ok)=>{if(finished)return;finished=true;clearTimeout(timer);if(ok)this.images[id]=image;else this.failed.push(id);resolve();};
    const timer=setTimeout(()=>done(false),4500);image.onload=()=>done(image.naturalWidth>0);image.onerror=()=>done(false);
    image.src=window.__ASTRA_ASSETS__?.[id]||path;
  })));}
  url(id){return window.__ASTRA_ASSETS__?.[id]||ASSET_PATHS[id];}
  hero(ctx,id,x,y,size,{pose=0,direction='down',flip=false,alpha=1,angle=0,squash=1,form=null}={}){
    const base=HERO[id],h=form&&TRANSFORM_ART[form]?{...base,art:TRANSFORM_ART[form]}:base,img=this.images[h.art.atlas];ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,y);ctx.rotate(angle);if(flip)ctx.scale(-1,1);
    ctx.scale(1/squash,squash);const k=h.art.scale||1,sz=size*k;
    if(img){const cell=img.naturalWidth/h.art.columns,index=h.art.directional?({down:0,up:1,left:2,right:3}[direction]??0):0;const column=index%h.art.columns,row=h.art.directional?Math.floor(index/h.art.columns):h.art.row;ctx.drawImage(img,column*cell,row*cell,cell,cell,-sz/2,-sz*h.art.foot,sz,sz);}
    else {ctx.fillStyle=h.color;ctx.beginPath();ctx.arc(0,-size*.52,size*.17,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(0,-size*.42);ctx.lineTo(size*.22,0);ctx.lineTo(-size*.22,0);ctx.fill();star(ctx,0,-size*.23,size*.12,'#fff0c0');}
    ctx.restore();
  }
  creature(ctx,frame,x,y,size,flip=false){const img=this.images.creatures;if(!img)return false;const c=img.naturalWidth/4;ctx.save();ctx.translate(x,y);if(flip)ctx.scale(-1,1);ctx.drawImage(img,frame%4*c,Math.floor(frame/4)*c,c,c,-size/2,-size*.87,size,size);ctx.restore();return true;}
}
function rounded(ctx,x,y,w,h,r=6){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function line(ctx,points,color,width){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();}
function star(ctx,x,y,r,color,rotation=0){ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4-Math.PI/2,rad=i%2?r*.3:r;i?ctx.lineTo(Math.cos(a)*rad,Math.sin(a)*rad):ctx.moveTo(Math.cos(a)*rad,Math.sin(a)*rad);}ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.restore();}
function shadow(ctx,x,y,r,alpha=.28){ctx.fillStyle=`rgba(9,21,24,${alpha})`;ctx.beginPath();ctx.ellipse(x,y,r,r*.28,0,0,Math.PI*2);ctx.fill();}

export class Renderer {
  constructor(canvas,art){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.art=art;this.fx=new CombatFX(this.ctx,art);this.effects=[];this.particles=[];this.floats=[];this.skills=[];this.entities=[];this.mergeable=[];this.boardSignature='';this.clock=0;this.shake=0;this.skill=null;this.skillSeq=0;this.selected=-1;this.hover=-1;this.drag=null;this.reduced=false;this.background=null;this.bgReady=false;this.setQuality('standard');}
  setQuality(quality){if(this.quality===quality)return;this.quality=quality;const q={high:{dpr:1.75,particles:240,impacts:80,effects:76},standard:{dpr:1.5,particles:180,impacts:64,effects:64},low:{dpr:1.25,particles:100,impacts:40,effects:44}}[quality];this.budget=q;this.fx.budget=q.impacts;this.resize();}
  resize(){const dpr=Math.min(window.devicePixelRatio||1,this.budget.dpr);this.canvas.width=Math.round(720*dpr);this.canvas.height=Math.round(780*dpr);this.dpr=dpr;}
  bursts(x,y,color,n=12,power=1){if(this.reduced)n=Math.min(5,n);n=Math.min(n,this.budget.particles-this.particles.length);for(let i=0;i<n;i++){const angle=Math.random()*Math.PI*2,speed=(35+Math.random()*130)*power;this.particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-40,life:.25+Math.random()*.45,total:.7,r:1.5+Math.random()*3,color,star:i%4===0});}}
  float(text,x,y,color='#fff2cb',size=24){this.floats.push({text,x,y,color,size,life:1.1,total:1.1});if(this.floats.length>20)this.floats.shift();}
  event(e){
    this.fx.event(e);
    if(e.type==='hit'){this.bursts(e.x,e.y-20,HERO[e.hero]?.color||'#fff1c9',e.big?9:4,.6);if(e.big&&this.floats.length<10)this.float(String(e.damage),e.x,e.y-30,'#fff3d1',e.damage>300?24:18);}
    if(e.type==='kill'){this.bursts(e.x,e.y-15,e.color||'#ebd8a5',e.boss?32:8,e.boss?1.5:.6);if(e.boss)this.shake=9;}
    if(e.type==='summon'){const p=cellPoint(e.index);this.effects.push({type:'summon',...p,color:HERO[e.hero].color,life:.65,total:.65});this.bursts(p.x,p.y,HERO[e.hero].color,12);}
    if(e.type==='merge'){const p=cellPoint(e.to);this.effects.push({type:'merge',...p,color:HERO[e.hero].color,life:1,total:1});this.bursts(p.x,p.y-25,'#ffe4a0',28,1.1);this.float(`${e.rank}성`,p.x,p.y-72,'#ffe5aa',31);if(e.refund)this.float(`+${e.refund} G`,p.x,p.y-35,'#ffe5aa');this.shake=3;}
    if(e.type==='skill'){this.skill={...e,uid:++this.skillSeq,life:1.6,total:1.6};this.skills.push(this.skill);if(this.skills.length>4)this.skills.shift();if(!e.locked)this.shake=isUR(e.hero)?7:4;}
    if(e.type==='finisherImpact'){this.shake=3;if(e.kind==='mirror')this.float(`천만경 ${Math.round(e.damage)}`,e.x,e.y-85,'#f0c9ff',22);}
    if(e.type==='income')this.float(`+${e.gold} G`,e.x,e.y-40,'#f2d596',17);
    if(e.type==='chain')this.effects.push({...e,life:.24,total:.24});
    if(e.type==='meteor'){this.effects.push({...e,life:.55,total:.55});this.bursts(e.x,e.y,e.color,18);}
    if(e.type==='leak'){this.shake=6;this.effects.push({type:'leak',x:76,y:142,color:'#ef8c80',life:.8,total:.8});}
    if(e.type==='seal')for(const i of e.cells){const p=cellPoint(i);this.effects.push({type:'seal',...p,color:'#d09bfd',life:.8,total:.8});}
    if(e.type==='interrupt')this.float('시전 저지',360,175,'#c8f4ee',30);
    if(e.type==='upgrade')this.float('훈련 완료',360,390,'#f6dc9c',28);
    if(this.effects.length>this.budget.effects)this.effects.splice(0,this.effects.length-this.budget.effects);
  }
  makeBackground(chapter=0){
    const cv=document.createElement('canvas');cv.width=720;cv.height=780;const ctx=cv.getContext('2d');
    ctx.fillStyle='#253b47';ctx.fillRect(0,0,720,780);
    const realm=CHAPTERS[chapter]?.background,img=realm!==undefined?this.art.images['realms-expansion']:this.art.images.garden;
    if(img){if(realm!==undefined){const cell=img.naturalWidth/3;ctx.drawImage(img,realm*cell,0,cell,img.naturalHeight,0,0,720,780);}else ctx.drawImage(img,0,0,720,780);}
    const dim=ctx.createLinearGradient(0,0,0,780);dim.addColorStop(0,'#101c2e55');dim.addColorStop(.5,'#0d24321a');dim.addColorStop(1,'#0a202f66');ctx.fillStyle=dim;ctx.fillRect(0,0,720,780);
    line(ctx,PATH,'#192d37a6',57);line(ctx,PATH,'#afa89570',48);line(ctx,PATH,'#cfc6a728',36);
    ctx.setLineDash([1,20]);line(ctx,PATH,'#f9df962e',2);ctx.setLineDash([]);
    // Neutral, identical inlaid tiles. No authored role or optimal-place markers.
    for(let i=0;i<25;i++){
      const p=cellPoint(i),x=p.x-42,y=p.y-42;
      rounded(ctx,x,y+3,84,84,6);ctx.fillStyle='#10273185';ctx.fill();
      rounded(ctx,x,y,84,82,6);ctx.fillStyle=(Math.floor(i/5)+i%5)%2?'#48616a90':'#5d72768a';ctx.fill();
      ctx.strokeStyle='#c7d6d029';ctx.lineWidth=1.5;ctx.stroke();
      line(ctx,[[x+9,y+2],[x+75,y+2]],'#e5e3c235',1);
      for(const [dx,dy] of [[-28,-28],[28,-28],[-28,28],[28,28]]){ctx.fillStyle='#d8dbca70';ctx.fillRect(p.x+dx-1,p.y+dy-1,2,2);}
      star(ctx,p.x,p.y,4,'#d0d9d24a');
    }
    this.background=cv;this.bgReady=!!img;this.bgChapter=chapter;
  }
  draw(s,dt){
    const ctx=this.ctx;this.clock+=dt;if(!this.background||this.bgChapter!==s.chapter||!this.bgReady&&this.art.images[CHAPTERS[s.chapter]?.background!==undefined?'realms-expansion':'garden'])this.makeBackground(s.chapter);
    ctx.setTransform(this.dpr,0,0,this.dpr,0,0);ctx.clearRect(0,0,720,780);ctx.save();
    if(this.shake>0&&!this.reduced){ctx.translate(Math.sin(this.clock*97)*this.shake,Math.cos(this.clock*83)*this.shake*.65);this.shake=Math.max(0,this.shake-dt*40);}else this.shake=0;
    ctx.drawImage(this.background,0,0);
    this.drawDecor(s);
    this.fx.enemies.clear();for(const e of s.enemies)this.fx.enemies.set(e.uid,{enemy:e,point:pathPoint(e.progress)});
    this.fx.reduced=this.reduced;this.fx.drawZones(s);for(const skill of this.skills)this.fx.drawSkillField(skill);this.fx.drawPersistent(s);this.fx.drawPersonalTraits(s);this.fx.drawAttackShapes();
    const field=this.skill?.life>0?this.skill.hero:'';if(this.canvas.dataset.skillField!==field)this.canvas.dataset.skillField=field;
    const signature=s.board.map(u=>u?`${u.uid}:${u.hero}:${u.rank}`:'').join('|');if(signature!==this.boardSignature){this.boardSignature=signature;this.mergeable=s.board.flatMap((u,i)=>u&&s.board.some(b=>canMerge(u,b))?[i]:[]);}
    for(const i of this.mergeable){const p=cellPoint(i);ctx.fillStyle='#e2eac912';rounded(ctx,p.x-40,p.y-40,80,80,7);ctx.fill();for(const [dx,dy] of [[-1,-1],[1,1]])line(ctx,[[p.x+dx*27,p.y+dy*40],[p.x+dx*40,p.y+dy*40],[p.x+dx*40,p.y+dy*27]],'#ede4adbb',2.5);star(ctx,p.x+32,p.y-31,5,'#fff1b9',Math.PI/4);}
    if(this.selected>=0&&s.board[this.selected]){
      const a=s.board[this.selected];
      const at=cellPoint(this.selected);drawAttackRange(ctx,HERO[a.hero],at,a.aim);
      for(let i=0;i<25;i++)if(i===this.selected||canMerge(a,s.board[i])){const p=cellPoint(i);rounded(ctx,p.x-42,p.y-42,84,82,8);ctx.strokeStyle=i===this.selected?'#fff1b9':'#baf6df';ctx.lineWidth=i===this.selected?3:4;ctx.stroke();if(i!==this.selected){ctx.fillStyle=`rgba(164,246,208,${.1+Math.sin(this.clock*5)*.035})`;ctx.fill();star(ctx,p.x,p.y-30,9,'#daffe4',Math.PI/4);}}
      if(['hasteAura','powerAura','harmonyAura'].includes(HERO[a.hero].trait.type)){
        const i=this.selected,p=cellPoint(i);for(const j of [i%5>0?i-1:-1,i%5<4?i+1:-1,i>=5?i-5:-1,i<20?i+5:-1])if(j>=0&&s.board[j]){const b=cellPoint(j);line(ctx,[[p.x,p.y],[b.x,b.y]],HERO[a.hero].color+'aa',3);}
      }
    }
    if(this.hover>=0&&this.drag){const p=cellPoint(this.hover);rounded(ctx,p.x-42,p.y-42,84,82,6);ctx.fillStyle='#ffe9a433';ctx.fill();}
    if(['seal','storm'].includes(s.telegraph?.pattern)){const storm=s.telegraph.pattern==='storm';ctx.fillStyle=storm?'#8dccfa20':`rgba(194,99,224,${.14+Math.sin(this.clock*12)*.1})`;ctx.strokeStyle=storm?'#ffe8aa':'#e3a2fb';ctx.lineWidth=2;for(const i of s.telegraph.cells){const p=cellPoint(i);rounded(ctx,p.x-43,p.y-43,86,86,5);ctx.fill();ctx.stroke();}}
    const entities=this.entities;entities.length=0;for(let i=0;i<25;i++)if(s.board[i])entities.push({kind:'hero',i,y:cellPoint(i).y+20});for(const e of s.enemies)entities.push({kind:'enemy',e,y:this.fx.point(e.uid).y});entities.sort((a,b)=>a.y-b.y);
    for(const ent of entities)ent.kind==='hero'?this.drawHero(s,ent.i):this.drawEnemy(ent.e,s.chapter);
    this.fx.drawPersonalTraits(s,true);
    this.fx.drawFinisherLocks(s);
    for(const shot of s.shots)this.drawShot(shot,s);
    this.fx.drawFinishers(s);
    for(const e of this.effects){e.life-=dt;this.drawEffect(e);}
    this.effects=this.effects.filter(e=>e.life>0);
    for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=110*dt;ctx.globalAlpha=Math.max(0,p.life/p.total);if(p.star)star(ctx,p.x,p.y,p.r*1.7,p.color,this.clock*2);else{ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}}ctx.globalAlpha=1;this.particles=this.particles.filter(p=>p.life>0);
    this.fx.draw(dt);
    for(const skill of this.skills)skill.life-=dt;this.skills=this.skills.filter(skill=>skill.life>0);this.skill=this.skills.at(-1)||null;
    if(this.drag){this.art.hero(ctx,this.drag.hero,this.drag.x,this.drag.y+35,145,{alpha:.9,form:this.drag.form});}
    this.fx.drawAuraFrame(s);
    for(const f of this.floats){f.life-=dt;f.y-=dt*31;ctx.globalAlpha=Math.min(1,f.life*3);ctx.font=`700 ${f.size}px Georgia,serif`;ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#172632';ctx.strokeText(f.text,f.x,f.y);ctx.fillStyle=f.color;ctx.fillText(f.text,f.x,f.y);}ctx.globalAlpha=1;this.floats=this.floats.filter(f=>f.life>0);
    if(s.phase==='intermission'){ctx.textAlign='center';ctx.font='600 21px system-ui';ctx.fillStyle='#f4e5c0';ctx.fillText(`다음 웨이브까지 ${Math.max(1,Math.ceil(s.breakTime))}초`,360,737);}
    ctx.restore();
  }
  drawDecor(s){const ctx=this.ctx,t=this.clock;
    shadow(ctx,76,144,42,.35);if(!this.art.creature(ctx,15,76,156,112)){star(ctx,76,126,32,'#b597e5',t*.1);}
    if(!this.decorGlow){this.decorGlow=ctx.createRadialGradient(76,136,4,76,136,55);this.decorGlow.addColorStop(0,'#bcd0ff44');this.decorGlow.addColorStop(1,'#bcd0ff00');}ctx.fillStyle=this.decorGlow;ctx.fillRect(21,81,110,110);
    ctx.textAlign='center';ctx.fillStyle='#f0e3c5';ctx.font='600 18px system-ui';ctx.fillText(CHAPTERS[s.chapter].name,360,85);ctx.fillStyle='#b8d0d5';ctx.font='13px Georgia,serif';ctx.fillText('✦  D R E A M W E A V E R  ✦',360,59);
    for(let i=0;i<9;i++){const x=(i*103+Math.sin(t*.2+i)*20)%720,y=(i*83-t*7+7800)%780;star(ctx,x,y,1.8+Math.sin(t+i),i%2?'#c7dfc580':'#e5d7a380',t*.2);}
  }
  drawHero(s,index){const ctx=this.ctx,u=s.board[index],p=cellPoint(index);if(this.drag?.uid===u.uid){shadow(ctx,p.x,p.y+24,20,.2);return;}
    shadow(ctx,p.x,p.y+29,26);
    const born=Math.min(1,(s.time-u.born)/.32),ease=1-Math.pow(1-born,3),idle=Math.sin(this.clock*2.5+u.uid)*1.6;
    const aim=u.aim??-Math.PI/2;
    let dx=0,dy=idle,angle=0,squash=1;
    if(u.windup>0){dx=-Math.cos(aim)*2.5;dy-=Math.sin(aim)*2.5;squash=.96;}
    if(u.pose>0){const t=1-u.pose/.3,pulse=Math.sin(t*Math.PI);dx=Math.cos(aim)*pulse*4;dy+=Math.sin(aim)*pulse*4;angle=Math.cos(aim)*pulse*.025;squash=1+pulse*.035;}
    this.art.hero(ctx,u.hero,p.x+dx,p.y+31+dy+(1-ease)*15,126*(.8+.2*ease),{direction:u.facing||'down',alpha:u.disabled>0?.52:1,angle,squash,form:unitForm(s,u)});
    if(u.windup>0){star(ctx,p.x+Math.cos(aim)*14,p.y+5+Math.sin(aim)*10,4,HERO[u.hero].color,this.clock*3);}
    const start=p.x-(u.rank-1)*6;
    for(let i=0;i<u.rank;i++)star(ctx,start+i*12,p.y+36,4.8,u.rank>=4?'#fff3c7':'#efd295');
    if(u.disabled>0){ctx.strokeStyle='#c9a5ef';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y-16,20,-Math.PI/2,-Math.PI/2+Math.PI*2*u.disabled/3.2);ctx.stroke();star(ctx,p.x,p.y-16,9,'#e2cbff');}
  }
  drawEnemy(e,chapter){const ctx=this.ctx,p=this.fx.point(e.uid),boss=e.boss?BOSSES[e.boss]:null,bob=Math.sin(this.clock*(e.kind==='runner'?15:8)+e.uid)*2;
    const size=boss?116:e.kind==='armor'?66:e.kind==='runner'?52:58;shadow(ctx,p.x,p.y+7,size*.31,.32);
    ctx.save();if(e.hit>0&&!this.reduced)ctx.globalAlpha=.8;
    if(boss&&this.art.images[boss.atlas||'bosses']){const img=this.art.images[boss.atlas||'bosses'],c=img.naturalWidth/3;ctx.drawImage(img,boss.frame%3*c,Math.floor(boss.frame/3)*c,c,c,p.x-size/2,p.y-size*(boss.atlas?480/512:.88)+bob,size,size);}
    else {const frames=chapter===0?{grunt:0,armor:3,runner:2,wisp:5}:chapter===1?{grunt:4,armor:3,runner:0,wisp:10}:chapter===2?{grunt:5,armor:7,runner:6,wisp:8}:{grunt:6,armor:7,runner:1,wisp:12};if(!this.art.creature(ctx,frames[e.kind]||0,p.x,p.y+bob,size,p.angle>2||p.angle< -2)){ctx.fillStyle='#d194ac';ctx.beginPath();ctx.arc(p.x,p.y-15,19,0,Math.PI*2);ctx.fill();}}
    ctx.restore();
    this.fx.drawStatus(e,p,size);
    if(e.hp<e.maxHp||boss){const w=boss?83:34;rounded(ctx,p.x-w/2,p.y-size*.82-8,w,5,2);ctx.fillStyle='#15242ddd';ctx.fill();rounded(ctx,p.x-w/2,p.y-size*.82-8,Math.max(1,w*e.hp/e.maxHp),5,2);ctx.fillStyle=boss?'#f2bc83':'#b6d6aa';ctx.fill();}
    if(e.shield>0){ctx.fillStyle='#d5e5ff';ctx.fillRect(p.x-41,p.y-size*.82-12,82*Math.min(1,e.shield/e.maxHp),2);}
  }
  drawShot(shot,s){this.fx.drawShot(shot,s);}
  drawEffect(e){const ctx=this.ctx,t=1-e.life/e.total;ctx.save();ctx.globalAlpha=Math.max(0,1-t);
    if(e.type==='chain'){
      if(e.hero==='night_rabbit'){ctx.strokeStyle=e.color;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(e.from.x,e.from.y-20);ctx.quadraticCurveTo((e.from.x+e.to.x)/2,(e.from.y+e.to.y)/2-52,e.to.x,e.to.y-20);ctx.stroke();}
      else if(e.hero==='storm_sage'){const dx=e.to.x-e.from.x,dy=e.to.y-e.from.y,len=Math.max(1,Math.hypot(dx,dy));line(ctx,Array.from({length:9},(_,i)=>{const f=i/8,w=Math.sin(f*Math.PI*3)*7;return [e.from.x+dx*f-dy/len*w,e.from.y-20+dy*f+dx/len*w];}),e.color,2.5);}
      else{line(ctx,[[e.from.x,e.from.y-20],[(e.from.x+e.to.x)/2+12,(e.from.y+e.to.y)/2-29],[e.to.x,e.to.y-20]],e.color,5);line(ctx,[[e.from.x,e.from.y-20],[e.to.x,e.to.y-20]],'#fff5d6',1);}
    }
    else if(e.type==='meteor'){line(ctx,[[e.x-60*(1-t),e.y-170*(1-t)],[e.x,e.y]],'#ffd596',6);star(ctx,e.x,e.y,18+t*40,'#ffe9b0',t);}
    else{const r=(e.type==='merge'?20+t*90:e.type==='nova'?20+t*140:10+t*60);ctx.strokeStyle=e.color;ctx.lineWidth=(1-t)*(e.type==='nova'?10:4);ctx.beginPath();ctx.ellipse(e.x,e.y,r,r*(e.type==='summon'?.38:1),0,0,Math.PI*2);ctx.stroke();
      if(e.type==='merge'||e.type==='summon'){line(ctx,[[e.x,e.y-80*(1-t)],[e.x,e.y]],e.color+'88',10*(1-t));star(ctx,e.x,e.y-20,25*(1-t),e.color,t*Math.PI);}
    }ctx.restore();
  }
}
