import {WORLD,LIMITS,WEAPON,HIDDEN_UNIONS,clamp} from './content.js';

// One revision marker makes the balance migration idempotent for active v1 runs.
export const BALANCE = Object.freeze({revision:1,xp:1.5,health:1.3,hpLimit:13000000});
export const relicInterval = (id,level) => (id==='santa'?48:40)-8*level;
export function initializeNightfall(g){
  g.nightfallVersion=BALANCE.revision;g.relicTimers={};g.fusedWeapons=[];g.spentWeapons=[];g.peakWeapons=g.weapons.length;
}
export function updatePeriodicRelics(g,dt){
  for(const id of ['santa','deep_orb']){
    const relic=g.relics.find(r=>r.id===id);if(!relic)continue;
    const interval=relicInterval(id,relic.level);
    g.relicTimers[id]=Math.min(g.relicTimers[id]??interval,interval)-dt;
    if(g.relicTimers[id]>0)continue;g.relicTimers[id]+=interval;
    if(id==='santa'){
      const angle=g.roll()*Math.PI*2,x=clamp(g.player.x+Math.cos(angle)*85,60,WORLD-60),y=clamp(g.player.y+Math.sin(angle)*85,75,WORLD-60);
      // A full pickup budget never discards the promised chest.
      const chest=g.spawnDrop('chest',x,y,1);
      if(chest)g.emit('giftChest',{x:chest.x,y:chest.y,title:'산타보따리의 선물'});else g.relicTimers[id]=Math.min(1,g.relicTimers[id]);
    }else{
      for(const drop of g.drops)drop.pull=true;
      g.emit('gather',{x:g.player.x,y:g.player.y,color:'#a5eddf',title:'심해가 별을 불러요'});
    }
  }
}
export function fuseWeapons(g){
  g.peakWeapons=Math.max(g.peakWeapons,g.weapons.length);
  for(const recipe of HIDDEN_UNIONS){
    if(g.fusedWeapons.includes(recipe.id))continue;
    const ingredients=recipe.weapons.map(id=>g.weapons.find(w=>w.id===id));
    if(ingredients.some(w=>!w||!w.evolved||w.level!==6))continue;
    const slot=g.weapons.findIndex(w=>w.id===ingredients[0].id),damage=ingredients.reduce((n,w)=>n+w.damage,0);
    g.weapons=g.weapons.filter(w=>!recipe.weapons.includes(w.id));
    g.weapons.splice(Math.min(slot,g.weapons.length),0,{id:recipe.id,level:1,evolved:true,timer:.1,damage});
    g.fusedWeapons.push(recipe.id);g.spentWeapons.push(...recipe.weapons);
    g.shots=g.shots.filter(s=>!recipe.weapons.includes(s.weapon));g.fields=g.fields.filter(f=>!recipe.weapons.includes(f.weapon));g.echoes=g.echoes.filter(e=>!recipe.weapons.includes(e.weapon));
    if(recipe.weapons.includes(g.focusRecipe))g.focusRecipe=recipe.id;
    g.emit('union',{id:recipe.id,title:WEAPON[recipe.id].name,x:g.player.x,y:g.player.y,color:WEAPON[recipe.id].color});
  }
}
function field(g,values){
  if(g.fields.length>=LIMITS.fields)return false;
  g.fields.push({id:g.uid++,tick:0,wait:0,life:1,r:20,color:WEAPON[values.weapon].color,...values});return true;
}
export function sectorHit(f,e,inner,outer){
  const dx=e.x-f.x,dy=e.y-f.y,d=Math.hypot(dx,dy);
  if(d+e.radius<inner||d-e.radius>outer)return false;
  const difference=Math.atan2(Math.sin(Math.atan2(dy,dx)-f.angle),Math.cos(Math.atan2(dy,dx)-f.angle));
  return Math.abs(difference)<=f.halfAngle+Math.asin(Math.min(1,e.radius/(d||1)));
}
export function fireNightfall(g,w,damage){
  const def=WEAPON[w.id],p=g.player,level=w.level,e=w.evolved,angle=Math.atan2(p.dy,p.dx);
  if(def.kind==='pillar'){
    const count=Math.min(8,1+Math.floor((level-1)/2)+g.stats.amount+(e?2:0)),r=(37+level*5)*g.stats.area*(e?1.3:1);
    for(let i=0;i<count;i++){
      const a=g.roll()*Math.PI*2,reach=Math.sqrt(g.roll())*240;
      field(g,{weapon:w.id,kind:'pillar',x:clamp(p.x+Math.cos(a)*reach,40,WORLD-40),y:clamp(p.y+Math.sin(a)*reach,40,WORLD-40),r,wait:.36+i*.08,life:1+i*.08,damage,evolved:e,hit:false});
    }return true;
  }
  if(def.kind==='wave'){
    for(let i=0;i<(e?2:1);i++)field(g,{weapon:w.id,kind:'wave',x:p.x,y:p.y,angle,r:1,maxR:Math.min(950,(185+level*18)*g.stats.area),halfAngle:e?1.05:.75,speed:310,life:1.6,wait:i*.18,damage,hits:[],evolved:e});
    return true;
  }
  if(def.kind==='phoenix'){
    const target=g.nearest(p.x,p.y,650),a=target?Math.atan2(target.y-p.y,target.x-p.x):angle;
    for(const offset of [-.16,0,.16])field(g,{weapon:w.id,kind:'phoenix',x:p.x,y:p.y,angle:a+offset,r:32*g.stats.area,speed:330,life:2,damage:damage*.85,hits:[],evolved:true});
    return true;
  }
  if(def.kind==='chronicle'){
    field(g,{weapon:w.id,kind:'chronicle',x:p.x,y:p.y,r:225*g.stats.area,life:4.7,damage,angle,phase:0,tick:0,evolved:true});return true;
  }
  if(def.kind==='choir'){
    field(g,{weapon:w.id,kind:'choir',x:p.x,y:p.y,r:115*g.stats.area,life:4.8,damage,angle,phase:0,tick:0,evolved:true});return true;
  }
  return false;
}
// Returns true for fields owned by this module; legacy fields keep their rules.
export function updateNightfallField(g,f,dt){
  if(!f.kind)return false;
  if(f.life<=0)return true;
  if(f.wait>0){f.wait=Math.max(0,f.wait-dt);return true;}
  if(f.kind==='pillar'){
    if(!f.hit){f.hit=true;for(const e of g.grid.near(f.x,f.y,f.r))g.hit(e,f.damage,f.weapon);g.emit('pillar',{x:f.x,y:f.y,r:f.r,weapon:f.weapon,color:f.color});}
  }else if(f.kind==='wave'||f.kind==='ripple'){
    const old=f.r;f.r=Math.min(f.maxR,f.r+f.speed*dt);
    for(const e of g.grid.near(f.x,f.y,f.r+20))if(!f.hits.includes(e.id)&&(f.kind==='ripple'?Math.hypot(e.x-f.x,e.y-f.y)+e.radius>=old-16:sectorHit(f,e,Math.max(0,old-16),f.r+16))){
      f.hits.push(e.id);g.hit(e,f.damage,f.weapon);e.slow=Math.max(e.slow,.8);
    }
    if(f.r>=f.maxR)f.life=Math.min(f.life,.12);
  }else if(f.kind==='phoenix'){
    f.prevX=f.x;f.prevY=f.y;f.x+=Math.cos(f.angle)*f.speed*dt;f.y+=Math.sin(f.angle)*f.speed*dt;
    for(const e of g.grid.near(f.x,f.y,f.r))if(!f.hits.includes(e.id)){f.hits.push(e.id);g.hit(e,f.damage,f.weapon);g.freezeEnemy(e,.7);e.burn=3.5;e.burnDamage=f.damage*.14;}
  }else if(f.kind==='chronicle'){
    f.x=g.player.x;f.y=g.player.y;f.angle+=dt*.9;
    if(f.tick<=0){f.tick=.38;f.phase++;for(const e of g.grid.near(f.x,f.y,f.r)){
      let struck=false;for(let i=0;i<3;i++)if(sectorHit({...f,angle:f.angle+i*Math.PI*2/3,halfAngle:.055},e,0,f.r)){struck=true;break;}
      if(struck){g.hit(e,f.damage,f.weapon,true);if(f.phase%3===0)g.freezeEnemy(e,.65);}
    }}
  }else if(f.kind==='choir'){
    f.x=g.player.x;f.y=g.player.y;f.angle+=dt*.65;
    if(f.tick<=0){f.tick=.95;f.phase++;for(let i=0;i<3;i++){
      const a=f.angle+i*Math.PI*2/3;field(g,{weapon:f.weapon,kind:'ripple',x:f.x+Math.cos(a)*f.r,y:f.y+Math.sin(a)*f.r,r:1,maxR:145*g.stats.area,speed:230,life:1.2,damage:f.damage*.8,hits:[]});
    }}
  }
  return true;
}

export function validateNightfall(data,numeric){
  if(data.nightfallVersion===undefined)return;
  if(data.nightfallVersion!==BALANCE.revision)throw new Error('Unknown balance revision');
  if(!Number.isInteger(data.peakWeapons)||data.peakWeapons<data.weapons.length||data.peakWeapons>6)throw new Error('Invalid weapon history');
  if(!Array.isArray(data.fusedWeapons)||data.fusedWeapons.length>3||new Set(data.fusedWeapons).size!==data.fusedWeapons.length||data.fusedWeapons.some(id=>!HIDDEN_UNIONS.some(r=>r.id===id)))throw new Error('Invalid unions');
  const consumed=HIDDEN_UNIONS.filter(r=>data.fusedWeapons.includes(r.id)).flatMap(r=>r.weapons);
  if(!Array.isArray(data.spentWeapons)||data.spentWeapons.length!==consumed.length||new Set(data.spentWeapons).size!==consumed.length||data.spentWeapons.some(id=>!consumed.includes(id))||data.weapons.some(w=>data.spentWeapons.includes(w.id))||data.fusedWeapons.some(id=>!data.weapons.some(w=>w.id===id&&w.level===1&&w.evolved)))throw new Error('Invalid consumed weapons');
  if(!data.relicTimers||typeof data.relicTimers!=='object'||Array.isArray(data.relicTimers)||Object.entries(data.relicTimers).some(([id,n])=>!['santa','deep_orb'].includes(id)||!Number.isFinite(n)||n<0||n>40))throw new Error('Invalid relic timers');
  for(const f of data.fields)if(f.kind){
    if(!['pillar','wave','ripple','phoenix','chronicle','choir'].includes(f.kind))throw new Error('Invalid new field');
    numeric(f,['wait']);if(f.wait<0||f.wait>2)throw new Error('Invalid field delay');
    if(['wave','ripple','phoenix'].includes(f.kind)){numeric(f,['speed']);if(f.speed<=0||f.speed>500||!Array.isArray(f.hits)||f.hits.length>LIMITS.enemies||f.hits.some(id=>!Number.isInteger(id)||id<1))throw new Error('Invalid field hits');}
    if(['wave','ripple'].includes(f.kind)){numeric(f,['maxR']);if(f.maxR<1||f.maxR>1000)throw new Error('Invalid wave range');}
    if(['wave','phoenix','chronicle','choir'].includes(f.kind))numeric(f,['angle']);
    if(f.kind==='wave'){numeric(f,['halfAngle']);if(f.halfAngle<.1||f.halfAngle>Math.PI)throw new Error('Invalid wave angle');}
    if(['chronicle','choir'].includes(f.kind)){numeric(f,['phase']);if(!Number.isInteger(f.phase)||f.phase<0||f.phase>40)throw new Error('Invalid field phase');}
    if(f.kind==='pillar'&&typeof f.hit!=='boolean')throw new Error('Invalid pillar impact');
  }
}
export function migrateBalance(g,data){
  if(data.nightfallVersion===undefined){
    g.need=Math.ceil(data.need*BALANCE.xp);
    for(const e of g.enemies){e.hp=Math.min(BALANCE.hpLimit-1,e.hp*BALANCE.health);e.maxHp=Math.min(BALANCE.hpLimit-1,e.maxHp*BALANCE.health);}
    g.peakWeapons=g.weapons.length;g.fusedWeapons=[];g.spentWeapons=[];g.relicTimers={};
  }
  g.nightfallVersion=BALANCE.revision;
}
