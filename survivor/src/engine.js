import { VERSION,WORLD,LIMITS,HERO,WEAPON,WEAPONS,RELIC,RELICS,STAGE,DIFFICULTY,clamp,length } from './content.js';

export function random(state) {
  let x=state.rng|0;x^=x<<13;x^=x>>>17;x^=x<<5;state.rng=x>>>0||1;return state.rng/4294967296;
}
export function sweptHit(ax,ay,bx,by,x,y,r) {
  const dx=bx-ax,dy=by-ay,t=clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1),0,1);
  return (ax+t*dx-x)**2+(ay+t*dy-y)**2<=r*r;
}
export class SpatialHash {
  constructor(size=96){this.size=size;this.cells=new Map();this.maxRadius=0;}
  rebuild(enemies){this.cells.clear();this.maxRadius=0;for(const e of enemies){if(e.hp<=0)continue;this.maxRadius=Math.max(this.maxRadius,e.radius);const key=this.key(e.x,e.y);if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key).push(e);}}
  key(x,y){return `${Math.floor(x/this.size)},${Math.floor(y/this.size)}`;}
  near(x,y,r){const out=[],reach=r+this.maxRadius;for(let a=Math.floor((x-reach)/this.size);a<=Math.floor((x+reach)/this.size);a++)for(let b=Math.floor((y-reach)/this.size);b<=Math.floor((y+reach)/this.size);b++)for(const e of this.cells.get(`${a},${b}`)||[])if(e.hp>0&&(e.x-x)**2+(e.y-y)**2<=(r+e.radius)**2)out.push(e);return out;}
}
export class Game {
  constructor({hero='rumi',stage='garden',difficulty='normal',seed=1,meta={},runId='run-'+seed}={}) {
    if(!HERO[hero]||!STAGE[stage]||!DIFFICULTY[difficulty])throw new Error('Unknown expedition');
    this.version=VERSION;this.runId=runId;this.rng=seed>>>0||1;this.hero=hero;this.stage=stage;this.difficulty=difficulty;this.meta={...meta};
    this.mode='playing';this.time=0;this.uid=1;this.kills=0;this.gold=0;this.level=1;this.xp=0;this.need=14;this.pending=0;this.options=[];this.rerolls=3;this.banishes=2;this.banned=[];this.view={w:430,h:680};
    this.player={x:WORLD/2,y:WORLD/2,hp:1,maxHp:1,invulnerable:1.6,dash:0,dashCooldown:0,dx:0,dy:1,facing:0,charge:35,boost:0,haste:0,recentDamage:0,recentTimer:0,healTimer:10};
    this.weapons=[{id:HERO[hero].weapon,level:1,evolved:false,timer:.3,damage:0}];this.relics=[];this.enemies=[];this.shots=[];this.drops=[];this.fields=[];this.hazards=[];this.events=[];this.bossesSpawned=0;this.bossesKilled=0;this.eliteTimer=40;this.spawnTimer=.4;this.nextRush=55;this.rush=0;this.rushes=0;this.ultimate=0;this.ultimateTimer=0;this.treasure=null;this.totalDamage=0;this.damageTaken=0;this.dashes=0;this.skilled=0;this.evolutions=0;this.grid=new SpatialHash();
    this.shrines=[{id:'moon',x:500,y:480,used:false},{id:'star',x:1100,y:700,used:false},{id:'dawn',x:650,y:1160,used:false}];
    this.recompute();this.player.hp=this.player.maxHp;this.emit('start',{text:STAGE[stage].name});
  }
  emit(type,data={}) {if(this.events.length<LIMITS.events)this.events.push({type,...data});}
  drainEvents(){const out=this.events;this.events=[];return out;}
  recompute(){
    const old=this.player.maxHp,s={damage:1+(this.meta.power||0)*.05,area:1,duration:1,cooldown:1-(this.meta.haste||0)*.03,speed:1+(this.meta.speed||0)*.03,amount:0,crit:.05,magnet:78*(1+(this.meta.magnet||0)*.15),xp:1+(this.meta.growth||0)*.05,charge:1,regen:0,boss:1};
    this.player.maxHp=HERO[this.hero].hp+(this.meta.heart||0)*10;
    if(this.hero==='rumi'){s.xp+=.15;s.magnet*=1.25;}
    if(this.hero==='luna')s.crit+=.15;
    if(this.hero==='jasmine')s.area+=.15;
    if(this.hero==='night_rabbit')s.duration+=.3;
    if(this.hero==='silver_rabbit')s.charge+=.25;
    if(this.hero==='time_ruler'){s.cooldown-=.1;s.area+=.2;}
    for(const r of this.relics){const def=RELIC[r.id];if(def.stat==='health'){this.player.maxHp+=r.level*15;s.regen+=r.level*.2;}else if(def.stat==='cooldown')s.cooldown-=def.value*r.level;else s[def.stat]+=def.value*r.level;
      if(r.id==='lens')s.boss+=.12*r.level;if(r.id==='roots')s.xp+=.05*r.level;if(r.id==='feather')s.dash=1-r.level*.05;
    }
    const rabbits=this.weapons.filter(w=>['frost','dream','sun'].includes(w.id)).length;
    s.rabbit=rabbits>=2?1+(rabbits-1)*.1:1;s.cooldown=clamp(s.cooldown,.4,1);this.stats=s;
    if(old>1&&this.player.maxHp>old)this.player.hp=Math.min(this.player.maxHp,this.player.hp+this.player.maxHp-old);
  }
  nearest(x,y,r=650,priority=false,exclude=new Set()){
    let best=null,score=Infinity;for(const e of this.enemies){if(e.hp<=0||exclude.has(e.id))continue;const d=(e.x-x)**2+(e.y-y)**2;if(d>r*r)continue;const n=priority?d/(e.boss?10:e.elite?4:1):d;if(n<score){score=n;best=e;}}return best;
  }
  spawnEnemy(kind='wisp',options={}) {
    if(this.enemies.length>=LIMITS.enemies)return null;
    const p=this.player,side=Math.floor(random(this)*4),along=random(this)*2-1,scale=1+this.time/130;
    const rx=Math.min(550,this.view.w/2+38),ry=Math.min(550,this.view.h/2+38);
    const spawnX=p.x+(side<2?(side===0?-rx:rx):along*rx),spawnY=p.y+(side>=2?(side===2?-ry:ry):along*ry);
    const defaults={wisp:[20,44,12,7],beetle:[60,27,20,12],moth:[32,38,16,9],stalker:[26,62,13,10],ember:[36,40,15,10],elite:[300,34,28,18],boss:[1000,25,45,24]};const [hp,speed,radius,damage]=defaults[kind]||defaults.wisp;
    const d=DIFFICULTY[this.difficulty],st=STAGE[this.stage],e={id:this.uid++,kind,x:clamp(spawnX,55,WORLD-55),y:clamp(spawnY,55,WORLD-55),hp:hp*scale*d.hp*st.danger,maxHp:hp*scale*d.hp*st.danger,speed:speed*(1+Math.min(this.time/1200,.3)),radius,damage:damage*d.damage,elite:kind==='elite',boss:kind==='boss',phase:0,ai:1.5+random(this)*2,slow:0,freeze:0,burn:0,burnDamage:0,burnTick:.5,flash:0,knockX:0,knockY:0,charge:0,angle:0,final:false,variant:Math.floor(random(this)*3),...options};this.enemies.push(e);return e;
  }
  director(dt){
    const st=STAGE[this.stage];this.spawnTimer-=dt;this.eliteTimer-=dt;this.rush=Math.max(0,this.rush-dt);
    if(this.time>=this.nextRush){this.rush=10;this.rushes++;this.nextRush+=65;this.emit('rush',{text:['蛍','暗','星'][this.rushes%3],title:this.rushes%2?'별을 삼키는 군세':'그림자의 행진'});}
    const density=DIFFICULTY[this.difficulty].density,interval=Math.max(.16,.8-this.time*.0012)/(density*(this.rush>0?1.8:1));
    if(this.spawnTimer<=0){this.spawnTimer+=interval;const roll=random(this);let kind='wisp';if(this.time>25&&roll>.70)kind='beetle';if(this.time>50&&roll>.85)kind='moth';if(this.time>90&&roll<.15)kind='stalker';if(this.time>125&&roll>.95)kind='ember';this.spawnEnemy(kind);if(this.time>180&&random(this)<.45)this.spawnEnemy('wisp');}
    if(this.eliteTimer<=0){this.eliteTimer+=50;this.spawnEnemy('elite');this.emit('elite',{title:'빛을 삼킨 파수꾼'});}
    const milestones=[st.duration/3,st.duration*2/3,st.duration];
    if(this.bossesSpawned<3&&this.time>=milestones[this.bossesSpawned]){
      const final=this.bossesSpawned===2,index=this.bossesSpawned++;
      const hp=(final?4800:1100+index*900)*DIFFICULTY[this.difficulty].hp*st.danger;
      // Reserve capacity so a full horde cannot skip the final boss.
      if(this.enemies.length>=LIMITS.enemies){const ordinary=this.enemies.find(e=>!e.boss);if(ordinary)ordinary.hp=0;this.cleanup();}
      this.spawnEnemy('boss',{hp,maxHp:hp,final,phase:index,name:final?st.bossName:['별을 삼킨 자','달그림자 집행관'][index],x:clamp(this.player.x+180,100,WORLD-100),y:clamp(this.player.y-270,100,WORLD-100)});this.emit('boss',{title:final?st.bossName:'밤의 파수꾼',final});
    }
  }
  step(dt,input={x:0,y:0}) {
    if(this.mode!=='playing'||!Number.isFinite(dt)||dt<=0)return;
    dt=Math.min(dt,1/30);this.time+=dt;const p=this.player;
    p.invulnerable=Math.max(0,p.invulnerable-dt);p.dashCooldown=Math.max(0,p.dashCooldown-dt);p.boost=Math.max(0,p.boost-dt);p.haste=Math.max(0,p.haste-dt);p.recentTimer=Math.max(0,p.recentTimer-dt);if(!p.recentTimer)p.recentDamage=0;
    const ix=Number.isFinite(input.x)?input.x:0,iy=Number.isFinite(input.y)?input.y:0,l=length(ix,iy),mx=l>1?ix/l:ix,my=l>1?iy/l:iy;
    if(l>.08&&p.dash<=0){p.dx=mx/(length(mx,my)||1);p.dy=my/(length(mx,my)||1);p.facing=Math.abs(mx)>Math.abs(my)?(mx<0?2:3):(my<0?1:0);}
    const speed=HERO[this.hero].speed*this.stats.speed*(p.haste>0?1.35:1);
    p.x=clamp(p.x+(p.dash>0?p.dx*speed*4.2:mx*speed)*dt,45,WORLD-45);p.y=clamp(p.y+(p.dash>0?p.dy*speed*4.2:my*speed)*dt,65,WORLD-40);p.dash=Math.max(0,p.dash-dt);
    p.charge=Math.min(100,p.charge+dt*.6*this.stats.charge);p.hp=Math.min(p.maxHp,p.hp+this.stats.regen*dt);
    if(this.hero==='jasmine'){p.healTimer-=dt;if(p.healTimer<=0){p.healTimer=10;this.heal(2);}}
    this.director(dt);this.grid.rebuild(this.enemies);this.updateEnemies(dt);
    if(p.hp<=0){p.hp=0;this.finish(false);this.cleanup();return;}
    this.grid.rebuild(this.enemies);
    for(const w of this.weapons){w.timer-=dt;if(w.timer<=0){const used=this.fire(w);w.timer=used?WEAPON[w.id].cooldown*this.stats.cooldown/(p.haste>0?1.35:1)/( ['frost','dream','sun'].includes(w.id)?this.stats.rabbit:1)*(w.evolved?.72:1):.15;}}
    this.updateUltimate(dt);this.updateShots(dt);this.updateFields(dt);this.updateHazards(dt);this.cleanup();
    if(this.mode==='playing'&&p.hp<=0){p.hp=0;this.finish(false);return;}
    if(this.mode==='playing')this.updateDrops(dt);
  }
  updateEnemies(dt){
    const p=this.player;for(const e of this.enemies){if(e.hp<=0)continue;e.flash=Math.max(0,e.flash-dt);e.slow=Math.max(0,e.slow-dt);e.freeze=Math.max(0,e.freeze-dt);e.burn=Math.max(0,e.burn-dt);e.burnTick-=dt;
      if(e.burn>0&&e.burnTick<=0){e.burnTick=.5;this.hit(e,e.burnDamage,'ember',true);if(e.hp<=0)continue;}
      let dx=p.x-e.x,dy=p.y-e.y,d=length(dx,dy)||1;e.ai-=dt;
      if(e.kind==='stalker'&&!e.charge&&e.ai<=0&&d<420){e.ai=4.5;e.charge=1.1;e.angle=Math.atan2(dy,dx);this.emit('tell',{x:e.x,y:e.y,angle:e.angle,length:180});}
      if(e.boss&&e.ai<=0&&e.freeze<=0){e.ai=Math.max(2.1,4.5-e.phase*.7);this.bossAttack(e);}
      if(e.kind==='moth'&&e.ai<=0&&e.freeze<=0){e.ai=3.2;this.hazardShot(e.x,e.y,Math.atan2(dy,dx),110,e.damage*.7);}
      let speed=e.freeze>0?0:e.speed*(e.slow>0?.5:1);e.charge=Math.max(0,e.charge-dt);
      if(e.charge>0){if(e.charge<.55){speed*=3;dx=Math.cos(e.angle);dy=Math.sin(e.angle);d=1;}else speed=0;}
      if(e.kind==='moth'&&d<210)speed*=.1;
      let rx=0,ry=0;
      if(speed>0&&!e.boss)for(const other of this.grid.near(e.x,e.y,e.radius+20)){if(other.id===e.id)continue;const sx=e.x-other.x,sy=e.y-other.y,sl=length(sx,sy)||1,overlap=e.radius+other.radius-sl;if(overlap>0){rx+=sx/sl*overlap*1.8;ry+=sy/sl*overlap*1.8;}}
      e.x=clamp(e.x+(dx/d*speed+rx+e.knockX)*dt,25,WORLD-25);e.y=clamp(e.y+(dy/d*speed+ry+e.knockY)*dt,25,WORLD-25);e.knockX*=Math.max(0,1-dt*8);e.knockY*=Math.max(0,1-dt*8);
      if(length(e.x-p.x,e.y-p.y)<e.radius+11&&e.freeze<=0)this.hurt(e.damage);
    }
  }
  bossAttack(e){
    const angle=Math.atan2(this.player.y-e.y,this.player.x-e.x),phase=e.hp/e.maxHp<.5?2:1;
    this.emit('bossTell',{x:e.x,y:e.y});
    this.hazards.push({id:this.uid++,kind:'ring',x:e.x,y:e.y,r:115+e.phase*18,wait:1.35,life:1.6,damage:e.damage*1.25,hit:false});
    const p=this.player,blast=(x,y,r,wait)=>this.hazards.push({id:this.uid++,kind:'blast',x:clamp(x,45,WORLD-45),y:clamp(y,45,WORLD-45),r,wait,life:wait+.35,damage:e.damage,hit:false});
    if(this.stage==='cathedral'){
      // Four seals leave diagonal escape routes, then a rotating cross of shots.
      for(let i=0;i<4;i++){const a=i*Math.PI/2;blast(p.x+Math.cos(a)*105,p.y+Math.sin(a)*105,48,1.5);this.hazardShot(e.x,e.y,angle+i*Math.PI/2+this.time*.015,90+phase*10,e.damage*.7,1);}
    }else if(this.stage==='rift'){
      // Successive meteors follow the last movement line, with a wider fan.
      for(let i=0;i<phase+2;i++)blast(p.x+p.dx*(i-1)*75,p.y+p.dy*(i-1)*75,48,1.2+i*.25);
      for(let i=-3;i<=3;i++)this.hazardShot(e.x,e.y,angle+i*.28,90+phase*15,e.damage*.7,.9);
    }else{
      for(let i=0;i<phase+1;i++)blast(p.x+(i-1)*100,p.y+(i%2)*50,52,1.45+i*.15);
      for(let i=-2;i<=2;i++)this.hazardShot(e.x,e.y,angle+i*.25,85+phase*15,e.damage*.7,.8);
    }
    if(this.hazards.length>LIMITS.hazards)this.hazards.splice(0,this.hazards.length-LIMITS.hazards);
  }
  hazardShot(x,y,a,speed,damage,wait=0){if(this.hazards.length<LIMITS.hazards)this.hazards.push({id:this.uid++,kind:'shot',x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,wait,life:7,damage,r:7,hit:false});}
  updateHazards(dt){
    const p=this.player;for(const h of this.hazards){h.life-=dt;h.wait-=dt;if(h.wait>0||h.hit)continue;
      if(h.kind==='shot'){const ox=h.x,oy=h.y;h.x+=h.vx*dt;h.y+=h.vy*dt;if(sweptHit(ox,oy,h.x,h.y,p.x,p.y,h.r+10)){this.hurt(h.damage);h.hit=true;}}
      else {if(length(p.x-h.x,p.y-h.y)<h.r)this.hurt(h.damage);h.hit=true;this.emit('blast',{x:h.x,y:h.y,r:h.r,color:'#ff897d'});}
    }this.hazards=this.hazards.filter(h=>h.life>0&&!h.hit);
  }
  fire(w){
    const def=WEAPON[w.id],p=this.player,target=this.nearest(p.x,p.y,650,def.kind==='snipe');if(!target)return false;
    const level=w.level,e=w.evolved,damage=def.damage*(1+(level-1)*.22)*(e?1.8:1),angle=Math.atan2(target.y-p.y,target.x-p.x),amount=Math.min(9,1+Math.floor(level/2)+this.stats.amount+(e?1:0));
    this.emit('cast',{id:w.id,x:p.x,y:p.y,angle});
    if(def.kind==='slash'){
      const r=(95+level*8)*this.stats.area*(e?1.4:1);this.emit('slash',{x:p.x,y:p.y,angle,r,color:def.color});
      for(const enemy of this.grid.near(p.x,p.y,r)){const a=Math.atan2(enemy.y-p.y,enemy.x-p.x),difference=Math.atan2(Math.sin(a-angle),Math.cos(a-angle));if(Math.abs(difference)<1.35||e){this.hit(enemy,damage,w.id);enemy.burn=3.5;enemy.burnDamage=damage*.14*(this.hero==='zeke'?1.4:1);}}
    }else if(def.kind==='chain'){
      const used=new Set();let from=p,next=target;const links=2+Math.floor(level/2)+this.stats.amount+(e?3:0);
      for(let i=0;i<links&&next;i++){this.emit('chain',{x:from.x,y:from.y,tx:next.x,ty:next.y,color:def.color,flower:w.id==='flower'});used.add(next.id);this.hit(next,damage*(1-i*.04),w.id);from=next;next=this.nearest(from.x,from.y,(170+level*12)*this.stats.area,false,used);}
    }else if(['field','clock','gravity'].includes(def.kind)){
      if(this.fields.length<LIMITS.fields)this.fields.push({id:this.uid++,weapon:w.id,x:target.x,y:target.y,r:(62+level*7)*this.stats.area*(e?1.35:1),life:(3+level*.2)*this.stats.duration,tick:0,damage,gravity:def.kind==='gravity',slow:def.kind==='clock'||w.id==='dream'||w.id==='rose',color:def.color});
    }else if(def.kind==='orbit'){
      const r=(70+level*6)*this.stats.area,n=2+Math.floor(level/2)+(e?2:0);for(let i=0;i<n;i++){const a=this.time*2.4+i*Math.PI*2/n,x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r;for(const enemy of this.grid.near(x,y,26))this.hit(enemy,damage,w.id);this.emit('orbitHit',{x,y,color:def.color});}
    }else if(def.kind==='sun'||def.kind==='snipe'){
      const range=def.kind==='snipe'?680:480;const bx=p.x+Math.cos(angle)*range,by=p.y+Math.sin(angle)*range;
      this.emit('beam',{x:p.x,y:p.y,tx:bx,ty:by,width:8+level*2,color:def.color});
      for(const enemy of this.enemies)if(enemy.hp>0&&sweptHit(p.x,p.y,bx,by,enemy.x,enemy.y,enemy.radius+9+level)){this.hit(enemy,damage,w.id);if(def.kind==='snipe'&&!e)break;}
    }else {
      for(let i=0;i<amount&&this.shots.length<LIMITS.shots;i++){
        const a=angle+(i-(amount-1)/2)*.15,speed=def.kind==='homing'?290:420;
        this.shots.push({id:this.uid++,weapon:w.id,kind:def.kind,x:p.x,y:p.y,ox:p.x,oy:p.y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,speed,target:target.id,life:2.8,damage,pierce:def.kind==='homing'?0:1+Math.floor(level/2)+(w.id==='glass'&&this.hero==='cinderella'?1:0),radius:def.kind==='homing'?7:5+level*.5,evolved:e,hits:[],color:def.color});
      }
    }return true;
  }
  updateShots(dt){
    for(const s of this.shots){s.life-=dt;s.ox=s.x;s.oy=s.y;
      if(s.kind==='homing'){let target=this.enemies.find(e=>e.id===s.target&&e.hp>0);if(!target)target=this.nearest(s.x,s.y,400);if(target){s.target=target.id;const a=Math.atan2(target.y-s.y,target.x-s.x);const turn=Math.min(1,dt*7);s.vx+=(Math.cos(a)*s.speed-s.vx)*turn;s.vy+=(Math.sin(a)*s.speed-s.vy)*turn;}}
      s.x+=s.vx*dt;s.y+=s.vy*dt;
      for(const e of this.grid.near((s.x+s.ox)/2,(s.y+s.oy)/2,length(s.x-s.ox,s.y-s.oy)/2+38)){
        if(s.hits.includes(e.id)||!sweptHit(s.ox,s.oy,s.x,s.y,e.x,e.y,s.radius+e.radius))continue;
        s.hits.push(e.id);this.hit(e,s.damage,s.weapon);if(s.weapon==='frost'){const chill=(this.hero==='snow_rabbit'?1.4:1)*(1+(this.relics.find(r=>r.id==='frost')?.level||0)*.15);e.slow=2*chill;if(s.evolved)e.freeze=.7*chill;}
        if(s.weapon==='glass'&&s.evolved)for(const other of this.grid.near(e.x,e.y,48))if(other.id!==e.id)this.hit(other,s.damage*.4,s.weapon);
        if(s.pierce--<=0){s.life=0;break;}
      }
    }this.shots=this.shots.filter(s=>s.life>0&&s.x>-60&&s.y>-60&&s.x<WORLD+60&&s.y<WORLD+60);
  }
  updateFields(dt){
    for(const f of this.fields){f.life-=dt;f.tick-=dt;if(f.tick>0)continue;f.tick=.4;
      for(const e of this.grid.near(f.x,f.y,f.r)){this.hit(e,f.damage*.5,f.weapon,true);if(f.slow)e.slow=.7;if(f.gravity){const d=length(f.x-e.x,f.y-e.y)||1;e.knockX+=(f.x-e.x)/d*70;e.knockY+=(f.y-e.y)/d*70;}}
    }this.fields=this.fields.filter(f=>f.life>0);
  }
  hit(enemy,base,weapon,periodic=false){
    if(enemy.hp<=0)return 0;
    const crit=!periodic&&random(this)<this.stats.crit;let damage=base*this.stats.damage*(crit?1.8:1)*(enemy.boss?this.stats.boss:1)*(this.player.boost>0?1.4:1);
    if(this.hero==='luna'&&enemy.hp/enemy.maxHp<.35)damage*=1.35;
    const actual=Math.min(enemy.hp,damage);enemy.hp-=damage;enemy.flash=.1;this.totalDamage+=actual;
    const w=this.weapons.find(w=>w.id===weapon);if(w)w.damage+=actual;
    this.emit('hit',{x:enemy.x,y:enemy.y-15,damage:Math.round(damage),crit,color:WEAPON[weapon]?.color||HERO[this.hero].color,periodic});
    if(!periodic){const d=length(enemy.x-this.player.x,enemy.y-this.player.y)||1;enemy.knockX=(enemy.x-this.player.x)/d*(enemy.boss?5:35);enemy.knockY=(enemy.y-this.player.y)/d*(enemy.boss?5:35);}
    if(enemy.hp<=0){this.kills++;const xp=enemy.boss?50:enemy.elite?20:enemy.kind==='beetle'?5:3;
      this.spawnDrop('xp',enemy.x,enemy.y,xp);if(enemy.elite||enemy.boss)this.spawnDrop('chest',enemy.x+12,enemy.y,1);
      if(enemy.boss){this.bossesKilled++;this.heal(15);this.emit('bossDown',{final:enemy.final,title:enemy.name});if(enemy.final)this.finish(true);}
      if(!enemy.boss&&random(this)<.055)this.spawnDrop('coin',enemy.x-8,enemy.y,1);
      if(!enemy.boss&&random(this)<.015)this.spawnDrop('heart',enemy.x,enemy.y+8,18);
      if(!enemy.boss&&random(this)<.0015)this.spawnDrop('magnet',enemy.x,enemy.y,1);
      if(enemy.kind==='ember'&&this.hazards.length<LIMITS.hazards)this.hazards.push({kind:'blast',id:this.uid++,x:enemy.x,y:enemy.y,r:45,wait:.9,life:1.2,damage:10,hit:false});
      this.player.charge=Math.min(100,this.player.charge+(.65+(enemy.elite?8:0)+(enemy.boss?20:0))*this.stats.charge);this.emit('death',{x:enemy.x,y:enemy.y,color:WEAPON[weapon]?.color||'#abcad1',elite:enemy.elite});
    }return actual;
  }
  hurt(damage){const p=this.player;if(p.invulnerable>0||this.mode!=='playing')return false;p.hp-=damage;p.invulnerable=.8;p.recentDamage+=damage;p.recentTimer=8;this.damageTaken+=damage;this.emit('hurt',{damage,x:p.x,y:p.y});return true;}
  heal(value){const before=this.player.hp;this.player.hp=Math.min(this.player.maxHp,this.player.hp+value);if(this.player.hp>before)this.emit('heal',{x:this.player.x,y:this.player.y,value:Math.round(this.player.hp-before)});}
  dash(){if(this.mode!=='playing'||this.player.dashCooldown>0)return false;this.player.dash=.18;this.player.invulnerable=Math.max(this.player.invulnerable,.35);this.player.dashCooldown=4*(this.stats.dash||1);this.dashes++;this.emit('dash',{x:this.player.x,y:this.player.y,dx:this.player.dx,dy:this.player.dy});return true;}
  castSkill(){
    if(this.mode!=='playing'||this.player.charge<100)return false;const p=this.player;p.charge=0;this.skilled++;p.invulnerable=Math.max(p.invulnerable,this.hero==='luna'?2:.65);this.ultimate=4;this.ultimateTimer=0;
    this.emit('skill',{hero:this.hero,title:HERO[this.hero].skill,x:p.x,y:p.y,color:HERO[this.hero].color});
    for(const h of this.hazards)if(h.kind==='shot')h.hit=true;
    if(this.hero==='jasmine')this.heal(p.maxHp*.25);if(this.hero==='night_rabbit')this.heal(15);if(this.hero==='time_ruler')this.heal(Math.min(p.maxHp*.2,p.recentDamage*.6));
    if(this.hero==='zeke')p.boost=5;if(this.hero==='silver_rabbit')p.haste=6;
    for(const e of this.enemies){if(e.hp<=0)continue;if(this.hero==='snow_rabbit'||this.hero==='time_ruler')e.freeze=this.hero==='snow_rabbit'?5.6:4;
      const d=length(e.x-p.x,e.y-p.y);if(d<360){this.hit(e,55,HERO[this.hero].weapon);e.knockX+=(e.x-p.x)/(d||1)*130;e.knockY+=(e.y-p.y)/(d||1)*130;}}
    if(this.hero==='cinderella')for(let i=0;i<6&&this.shots.length<LIMITS.shots;i++){const a=i*Math.PI/3;this.shots.push({id:this.uid++,weapon:'glass',kind:'glass',x:p.x,y:p.y,ox:p.x,oy:p.y,vx:Math.cos(a)*420,vy:Math.sin(a)*420,speed:420,target:0,life:2.8,damage:65,pierce:4,radius:8,evolved:true,hits:[],color:HERO[this.hero].color});}
    if(['jasmine','night_rabbit'].includes(this.hero)){if(this.fields.length>=LIMITS.fields)this.fields.shift();this.fields.push({id:this.uid++,weapon:HERO[this.hero].weapon,x:p.x,y:p.y,r:195*this.stats.area,life:5*this.stats.duration,tick:0,damage:65,slow:true,color:HERO[this.hero].color});}
    return true;
  }
  updateUltimate(dt){
    this.ultimate=Math.max(0,this.ultimate-dt);this.ultimateTimer-=dt;if(this.ultimate<=0||this.ultimateTimer>0)return;this.ultimateTimer=.32;
    const p=this.player,weapon=HERO[this.hero].weapon,def=WEAPON[weapon],target=this.nearest(p.x,p.y,680);if(!target)return;
    if(['rumi','luna','cinderella'].includes(this.hero)){
      const r=this.hero==='luna'?90:58;this.emit('blast',{x:target.x,y:target.y,r,color:def.color});for(const e of this.grid.near(target.x,target.y,r))this.hit(e,55,weapon);
    }else if(this.hero==='silver_rabbit'||this.hero==='zeke'){
      const a=Math.atan2(target.y-p.y,target.x-p.x),x=p.x+Math.cos(a)*600,y=p.y+Math.sin(a)*600;this.emit('beam',{x:p.x,y:p.y,tx:x,ty:y,width:28,color:def.color});for(const e of this.enemies)if(e.hp>0&&sweptHit(p.x,p.y,x,y,e.x,e.y,35))this.hit(e,48,weapon);
    }else if(this.hero==='snow_rabbit')for(const e of this.grid.near(p.x,p.y,260))this.hit(e,22,weapon,true);
  }
  spawnDrop(kind,x,y,value){
    if(this.drops.length>=LIMITS.drops){const nearest=this.drops.filter(d=>d.kind===kind).sort((a,b)=>(a.x-x)**2+(a.y-y)**2-((b.x-x)**2+(b.y-y)**2))[0];if(nearest){nearest.value+=value;return nearest;}if(kind==='xp'){this.gainXP(value);return null;}const gem=this.drops.find(d=>d.kind==='xp');if(gem){this.gainXP(gem.value);this.drops.splice(this.drops.indexOf(gem),1);}else return null;}
    const drop={id:this.uid++,kind,x,y,value,pull:false};this.drops.push(drop);return drop;
  }
  updateDrops(dt){
    const p=this.player;for(const d of this.drops){const dx=p.x-d.x,dy=p.y-d.y,dist=length(dx,dy)||1;
      if(dist<this.stats.magnet||(d.kind==='chest'&&dist<55))d.pull=true;
      if(d.pull){d.x+=dx/dist*Math.min(dist/dt,360+dist*2)*dt;d.y+=dy/dist*Math.min(dist/dt,360+dist*2)*dt;}
      if(dist<17){d.collected=true;this.collect(d);if(this.mode!=='playing')break;}
    }this.drops=this.drops.filter(d=>!d.collected);
  }
  collect(d){
    if(d.kind==='xp')this.gainXP(d.value);if(d.kind==='coin'){this.gold+=d.value;this.emit('coin',{value:d.value});}if(d.kind==='heart')this.heal(d.value);
    if(d.kind==='magnet'){for(const gem of this.drops)if(gem.kind==='xp'||gem.kind==='coin')gem.pull=true;this.emit('magnet');}
    // A saturated pickup budget can stack chests. Consume one reward at a time.
    if(d.kind==='chest'){if(d.value>1){d.value--;d.collected=false;}this.openTreasure();}
  }
  gainXP(value){
    this.xp+=value*this.stats.xp;
    while(this.xp>=this.need&&this.level<99){this.xp-=this.need;this.level++;this.need=Math.floor(10+this.level*3+this.level**1.15);this.pending++;}
    if(this.pending&&this.mode==='playing'){this.mode='choice';this.options=this.offers();this.emit('level',{level:this.level});}
  }
  candidates(){
    const candidates=[];
    for(const def of WEAPONS){if(this.banned.includes('weapon:'+def.id))continue;const w=this.weapons.find(w=>w.id===def.id);
      if(!w&&this.weapons.length<6)candidates.push({type:'weapon',id:def.id,level:1});
      else if(w&&w.level<def.max)candidates.push({type:'weapon',id:def.id,level:w.level+1});
      else if(w&&!w.evolved&&this.relics.some(r=>r.id===def.relic&&r.level>=2))candidates.push({type:'evolution',id:def.id,level:6});
    }
    for(const def of RELICS){if(this.banned.includes('relic:'+def.id))continue;const r=this.relics.find(r=>r.id===def.id);if(!r&&this.relics.length<4)candidates.push({type:'relic',id:def.id,level:1});else if(r&&r.level<def.max)candidates.push({type:'relic',id:def.id,level:r.level+1});}
    if(candidates.length===0)candidates.push({type:'heal',id:'heal',level:1},{type:'gold',id:'gold',level:1});return candidates;
  }
  offers(){
    const candidates=this.candidates(),out=[];const evolutions=candidates.filter(c=>c.type==='evolution');
    if(evolutions.length)out.push(evolutions[Math.floor(random(this)*evolutions.length)]);
    const owned=candidates.filter(c=>c.type==='weapon'&&this.weapons.some(w=>w.id===c.id));
    if(owned.length&&!out.length&&random(this)<.75)out.push(owned[Math.floor(random(this)*owned.length)]);
    const shuffled=candidates.filter(c=>!out.some(o=>o.type===c.type&&o.id===c.id));for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(random(this)*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
    return out.concat(shuffled.slice(0,3-out.length));
  }
  applyOption(option){
    if(option.type==='weapon'){let w=this.weapons.find(w=>w.id===option.id);if(w)w.level=Math.min(6,w.level+1);else if(this.weapons.length<6)this.weapons.push({id:option.id,level:1,evolved:false,timer:.1,damage:0});}
    else if(option.type==='evolution'){const w=this.weapons.find(w=>w.id===option.id);if(w&&w.level===6&&!w.evolved&&this.relics.some(r=>r.id===WEAPON[w.id].relic&&r.level>=2)){w.evolved=true;this.evolutions++;this.emit('evolution',{id:w.id,title:WEAPON[w.id].evolution});}}
    else if(option.type==='relic'){let r=this.relics.find(r=>r.id===option.id);if(r)r.level=Math.min(3,r.level+1);else if(this.relics.length<4)this.relics.push({id:option.id,level:1});}
    else if(option.type==='heal')this.heal(this.player.maxHp*.3);else if(option.type==='gold')this.gold+=15;
    this.recompute();
  }
  choose(index){
    if(this.mode!=='choice'||!this.options[index])return false;this.applyOption(this.options[index]);this.pending=Math.max(0,this.pending-1);this.mode=this.pending?'choice':'playing';this.options=this.pending?this.offers():[];this.player.invulnerable=Math.max(this.player.invulnerable,.65);this.emit('chosen');return true;
  }
  reroll(){if(this.mode!=='choice'||this.rerolls<=0)return false;this.rerolls--;this.options=this.offers();return true;}
  banish(index){if(this.mode!=='choice'||this.banishes<=0||!this.options[index]||!['weapon','relic'].includes(this.options[index].type))return false;const o=this.options[index];this.banned.push(o.type+':'+o.id);this.banishes--;this.options=this.offers();return true;}
  openTreasure(){
    const options=this.candidates().filter(c=>c.type==='evolution'||(c.type==='weapon'&&this.weapons.some(w=>w.id===c.id))||(c.type==='relic'&&this.relics.some(r=>r.id===c.id)));
    const evolved=options.filter(c=>c.type==='evolution'),pool=evolved.length?evolved:options;this.treasure=pool.length?pool[Math.floor(random(this)*pool.length)]:{type:'gold',id:'gold',level:1};this.gold+=10;this.mode='treasure';this.emit('treasure');
  }
  claimTreasure(){if(this.mode!=='treasure'||!this.treasure)return false;this.applyOption(this.treasure);this.treasure=null;this.mode=this.pending?'choice':'playing';if(this.pending)this.options=this.offers();return true;}
  nearShrine(){return this.shrines.find(s=>!s.used&&length(s.x-this.player.x,s.y-this.player.y)<75)||null;}
  useShrine(){if(this.mode!=='playing')return false;const s=this.nearShrine();if(!s)return false;s.used=true;if(s.id==='moon'){this.heal(this.player.maxHp*.3);this.player.charge=Math.min(100,this.player.charge+30);}else if(s.id==='star')this.openTreasure();else {this.player.boost=15;this.gold+=10;}this.emit('shrine',{id:s.id});return true;}
  cleanup(){this.enemies=this.enemies.filter(e=>e.hp>0);if(this.hazards.length>LIMITS.hazards)this.hazards=this.hazards.slice(-LIMITS.hazards);}
  finish(won){if(this.mode==='victory'||this.mode==='defeat')return;this.mode=won?'victory':'defeat';this.emit('finish',{won});}
  snapshot(){const data={};for(const [key,value] of Object.entries(this))if(!['grid','events','stats'].includes(key))data[key]=value;return JSON.parse(JSON.stringify(data));}
  static restore(data){
    if(!data||data.version!==VERSION||!HERO[data.hero]||!STAGE[data.stage]||!DIFFICULTY[data.difficulty])throw new Error('Incompatible expedition');
    const walk=value=>{if(typeof value==='number'&&!Number.isFinite(value))throw new Error('Invalid number');if(value&&typeof value==='object')for(const v of Object.values(value))walk(v);};walk(data);
    if(!['playing','choice','treasure','paused'].includes(data.mode)||typeof data.runId!=='string'||data.runId.length>120||!Number.isInteger(data.rng)||data.rng<=0||!Number.isInteger(data.uid)||data.uid<1||data.time<0||data.time>86400||!Number.isInteger(data.level)||data.level<1||data.level>99||data.xp<0||data.need<=0)throw new Error('Invalid expedition');
    const numeric=(object,keys)=>{if(!object||keys.some(k=>!Number.isFinite(object[k])))throw new Error('Missing numeric state');};
    numeric(data,['time','uid','kills','gold','level','xp','need','pending','rerolls','banishes','bossesSpawned','bossesKilled','eliteTimer','spawnTimer','nextRush','rush','rushes','ultimate','ultimateTimer','totalDamage','damageTaken','dashes','skilled','evolutions']);
    if(data.pending<0||data.pending>99||data.rerolls<0||data.rerolls>3||data.banishes<0||data.banishes>2||data.kills<0||data.gold<0)throw new Error('Invalid progression');
    if(!data.meta||Object.values(data.meta).some(v=>!Number.isInteger(v)||v<0||v>5))throw new Error('Invalid memories');
    numeric(data.view,['w','h']);if(data.view.w<100||data.view.h<100||data.view.w>3000||data.view.h>3000)throw new Error('Invalid viewport');
    const p=data.player;numeric(p,['x','y','hp','maxHp','invulnerable','dash','dashCooldown','dx','dy','facing','charge','boost','haste','recentDamage','recentTimer','healTimer']);if(p.x<0||p.y<0||p.x>WORLD||p.y>WORLD||p.hp<=0||p.hp>10000||p.maxHp<=0||p.maxHp>10000||p.charge<0||p.charge>100||!Number.isInteger(p.facing)||p.facing<0||p.facing>3)throw new Error('Invalid traveler');
    for(const [key,max] of [['enemies',LIMITS.enemies],['shots',LIMITS.shots],['drops',LIMITS.drops],['fields',LIMITS.fields],['hazards',LIMITS.hazards],['weapons',6],['relics',4],['shrines',3],['options',3],['banned',24]])if(!Array.isArray(data[key])||data[key].length>max)throw new Error('Invalid '+key);
    if(!data.weapons.length||new Set(data.weapons.map(w=>w.id)).size!==data.weapons.length||data.weapons.some(w=>!WEAPON[w.id]||!Number.isInteger(w.level)||w.level<1||w.level>6)||new Set(data.relics.map(r=>r.id)).size!==data.relics.length||data.relics.some(r=>!RELIC[r.id]||!Number.isInteger(r.level)||r.level<1||r.level>3))throw new Error('Invalid constellation');
    const ids=new Set();for(const key of ['enemies','shots','drops','fields','hazards'])for(const v of data[key]){if(!Number.isInteger(v.id)||ids.has(v.id)||v.id>=data.uid||!Number.isFinite(v.x)||!Number.isFinite(v.y)||Math.abs(v.x)>WORLD+700||Math.abs(v.y)>WORLD+700)throw new Error('Invalid entities');ids.add(v.id);}
    for(const e of data.enemies){numeric(e,['hp','maxHp','speed','radius','damage','ai','slow','freeze','burn','burnDamage','burnTick','flash','knockX','knockY','charge','angle','variant']);if(!['wisp','beetle','moth','stalker','ember','elite','boss'].includes(e.kind)||e.radius<1||e.radius>120||e.hp>10000000||e.speed<0||e.speed>1000)throw new Error('Invalid enemy');}
    for(const s of data.shots){numeric(s,['vx','vy','speed','ox','oy','life','damage','pierce','radius']);if(!WEAPON[s.weapon]||!Array.isArray(s.hits)||s.hits.length>LIMITS.enemies)throw new Error('Invalid projectile');}
    for(const f of data.fields){numeric(f,['r','life','tick','damage']);if(!WEAPON[f.weapon]||f.r<1||f.r>1000)throw new Error('Invalid field');}
    for(const d of data.drops){numeric(d,['value']);if(!['xp','coin','heart','magnet','chest'].includes(d.kind)||d.value<1||d.value>10000000)throw new Error('Invalid pickup');}
    for(const h of data.hazards){numeric(h,['r','wait','life','damage']);if(!['ring','blast','shot'].includes(h.kind)||h.r<1||h.r>500)throw new Error('Invalid danger');if(h.kind==='shot')numeric(h,['vx','vy']);}
    if(data.shrines.length!==3||data.shrines.some(s=>!['moon','star','dawn'].includes(s.id)||!Number.isFinite(s.x)||!Number.isFinite(s.y)||typeof s.used!=='boolean'))throw new Error('Invalid shrines');
    for(const w of data.weapons){numeric(w,['timer','damage']);if(typeof w.evolved!=='boolean')throw new Error('Invalid weapon state');}
    for(const o of [...data.options,...(data.treasure?[data.treasure]:[])])if(!['weapon','relic','evolution','heal','gold'].includes(o.type)||(['weapon','evolution'].includes(o.type)&&!WEAPON[o.id])||(o.type==='relic'&&!RELIC[o.id]))throw new Error('Invalid reward');
    const game=new Game({hero:data.hero,stage:data.stage,difficulty:data.difficulty});for(const key of Object.keys(game))if(!['grid','events','stats'].includes(key)&&Object.hasOwn(data,key))game[key]=data[key];game.events=[];game.recompute();game.grid.rebuild(game.enemies);return game;
  }
}
