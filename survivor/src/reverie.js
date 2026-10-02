import {HERO,WEAPON,OMENS,SECRET,SECRETS,LIMITS,WORLD,clamp} from './content.js';

export function initializeRun(g,runMode){
  if(!['expedition','endless'].includes(runMode))throw new Error('Unknown run mode');
  g.reverieVersion=1;g.runMode=runMode;g.omen=OMENS[Math.floor(g.roll()*OMENS.length)].id;
  g.limitBreak={power:0,haste:0,area:0};
  g.secrets=[];g.encounters=[];g.encounterOffers=[];g.encounterIndex=0;g.nextEncounter=18;g.conditionFlags=[];
  g.stillness=0;g.echoes=[];g.portal=null;g.timeStop=0;g.lifePrice=0;g.eclipseAt=20;
  g.growthHistory=[{time:0,level:1,dps:0,kills:0,evolutions:0}];g.growthAt=10;g.growthDamage=0;g.cycle=0;g.fieldGiftAt=0;
}

export function beforeCombat(g,dt){
  const p=g.player;g.stillness=p.moving?0:g.stillness+dt;g.timeStop=Math.max(0,g.timeStop-dt);
  if(g.portal){g.portal.life-=dt;if(g.portal.life<=0)g.portal=null;}
  if(g.timeStop>0||g.secrets.includes('pocket')&&g.stillness>.5){
    for(const e of g.enemies)if(g.timeStop>0||Math.hypot(e.x-p.x,e.y-p.y)<155)e.freeze=Math.max(e.freeze,dt+.08);
  }
  const pending=g.echoes;g.echoes=[];
  for(const echo of pending){echo.wait-=dt;if(echo.wait>0)g.echoes.push(echo);else{const w=g.weapons.find(w=>w.id===echo.weapon);if(w)g.fire(w,true);}}
}

export function afterCombat(g,dt){
  if(g.mode!=='playing')return;const p=g.player;
  for(const e of g.encounters){e.life-=dt;if(e.kind==='lantern'&&Math.hypot(e.x-p.x,e.y-p.y)<90)e.progress+=dt;
    if(e.kind==='lantern'&&e.progress>=3){e.kind='altar';e.progress=0;e.title='기다림이 연 문';g.emit('encounter',{title:e.title,x:e.x,y:e.y});}
  }
  g.encounters=g.encounters.filter(e=>e.life>0&&!e.used);
  if(g.time>=g.nextEncounter){
    const kinds=['comet','chase','lantern','altar'],omenIndex=Math.max(0,OMENS.findIndex(o=>o.id===g.omen)),kind=kinds[(g.encounterIndex+omenIndex)%kinds.length];g.encounterIndex++;g.nextEncounter+=34;
    const x=clamp(p.x+(g.roll()>.5?95:-95),90,WORLD-90),y=clamp(p.y-65,90,WORLD-90);
    if(kind==='comet'){
      for(let i=0;i<14;i++){const a=g.roll()*Math.PI*2,r=35+g.roll()*140;g.spawnDrop('xp',clamp(p.x+Math.cos(a)*r,45,WORLD-45),clamp(p.y+Math.sin(a)*r,65,WORLD-40),5);}
      g.emit('encounter',{title:'별비를 모으세요',text:'유성의 조각 · 70 경험치',x:p.x,y:p.y,art:4});
    }else if(kind==='chase'){
      const runner=g.spawnEnemy('wisp',{x,y,hp:220,maxHp:220,speed:115,damage:0,elite:true,runner:true,name:'도망치는 별'});
      if(runner)g.emit('encounter',{title:'도망치는 보물',text:'별을 추적하면 보물상자를 얻어요',x,y,art:6});
    }else if(g.encounters.length<3){g.encounters.push({id:g.uid++,kind,x,y,life:40,progress:0,used:false,title:kind==='altar'?'밤의 낯선 거래':'빛 곁에 머무르세요',secret:null});g.emit('encounter',{title:kind==='altar'?'밤의 낯선 거래':'움직이지 않는 용기',text:kind==='altar'?'제단을 찾아 세계의 규칙을 바꿔요':'등불 곁에서 3초 · 숨겨진 문',x,y,art:kind==='altar'?7:5});}
  }
  const conditions=[['portal',g.dashes>=6],['pocket',g.stillness>=5],['mirror',g.skilled>=3],['echo',g.shrines.filter(s=>s.used).length>=2]];
  for(const [id,ready] of conditions)if(ready&&!g.conditionFlags.includes(id)&&!g.secrets.includes(id)&&g.encounters.length<3){g.conditionFlags.push(id);g.encounters.push({id:g.uid++,kind:'altar',x:clamp(p.x+65,60,WORLD-60),y:clamp(p.y-35,75,WORLD-55),life:50,progress:0,used:false,title:'숨겨진 별이 깨어났어요',secret:id});g.emit('secretFound',{id,title:SECRET[id].name,x:p.x,y:p.y});}
  if(g.difficulty==='eclipse'&&g.time>=g.eclipseAt){g.eclipseAt+=12;g.emit('curse',{title:'검은 태양의 유성우'});
    for(let i=0;i<3&&g.hazards.length<LIMITS.hazards;i++){const a=g.time*.6+i*2.1;g.hazards.push({id:g.uid++,kind:'blast',x:clamp(p.x+Math.cos(a)*95,45,WORLD-45),y:clamp(p.y+Math.sin(a)*95,65,WORLD-40),r:48,wait:1.4+i*.15,life:2+i*.15,damage:18,hit:false});}
  }
  if(g.omen==='bloom'&&p.moveDistance>=g.fieldGiftAt+350){g.fieldGiftAt=p.moveDistance;g.spawnDrop('heart',p.x,p.y,12);}
  if(g.time>=g.growthAt){g.growthHistory.push({time:+g.time.toFixed(2),level:g.level,dps:+((g.totalDamage-g.growthDamage)/10).toFixed(1),kills:g.kills,evolutions:g.evolutions});if(g.growthHistory.length>32)g.growthHistory.splice(1,1);g.growthAt=g.time+10;g.growthDamage=g.totalDamage;}
}

export function nearestEncounter(g){return g.encounters.find(e=>e.kind==='altar'&&!e.used&&Math.hypot(e.x-g.player.x,e.y-g.player.y)<90)||null;}
export function openEncounter(g){
  if(g.mode!=='playing')return false;const e=nearestEncounter(g);if(!e)return false;
  const pool=SECRETS.filter(s=>!g.secrets.includes(s.id));for(let i=pool.length-1;i>0;i--){const j=Math.floor(g.roll()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  if(e.secret){const at=pool.findIndex(s=>s.id===e.secret);if(at>=0)[pool[0],pool[at]]=[pool[at],pool[0]];}
  g.encounterOffers=pool.slice(0,2).map(s=>({type:'secret',id:s.id,price:Math.max(6,Math.round(g.player.maxHp*.1))}));g.encounterOffers.push({type:'gift',id:'gift',price:0});
  e.used=true;g.mode='anomaly';g.emit('anomaly');return true;
}
export function chooseEncounter(g,index){
  if(g.mode!=='anomaly'||!g.encounterOffers[index])return false;const choice=g.encounterOffers[index];
  if(choice.type==='secret'&&!g.secrets.includes(choice.id)){g.secrets.push(choice.id);g.lifePrice+=choice.price;g.recompute();g.player.hp=Math.min(g.player.hp,g.player.maxHp);g.emit('secret',{id:choice.id,title:SECRET[choice.id].name,x:g.player.x,y:g.player.y});}
  else{g.heal(g.player.maxHp*.35);g.gold+=12;}
  g.encounterOffers=[];g.mode=g.pending?'choice':'playing';if(g.pending)g.options=g.offers();g.player.invulnerable=Math.max(g.player.invulnerable,1);return true;
}

export function afterDash(g,origin){
  const p=g.player;
  if(g.omen==='silver')g.spawnDrop('xp',origin.x,origin.y,4);
  if(g.secrets.includes('mirror')){
    let count=0;for(const h of g.hazards)if(h.kind==='shot'&&!h.hit&&Math.hypot(h.x-p.x,h.y-(p.y-30))<200&&g.shots.length<LIMITS.shots&&count<12){
      h.hit=true;count++;const target=g.nearest(h.x,h.y,650),angle=target?Math.atan2(target.y-18-h.y,target.x-h.x):Math.atan2(-h.vy,-h.vx),speed=330;
      g.shots.push({id:g.uid++,weapon:HERO[g.hero].weapon,kind:'homing',x:h.x,y:h.y,ox:h.x,oy:h.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,speed,target:target?.id||0,life:3,damage:h.damage*5,pierce:2,radius:8,evolved:true,hits:[],color:SECRET.mirror.color,reflected:true});
    }if(count)g.emit('reflection',{x:p.x,y:p.y,title:'달의 반대편',count});
  }
  if(g.stats.awakened.includes('feather')){p.dashCooldown*=.55;for(const e of g.grid.near(p.x+p.dx*90,p.y+p.dy*90,115))g.hit(e,95,'storm');g.emit('slash',{weapon:'storm',x:p.x,y:p.y-30,angle:Math.atan2(p.dy,p.dx),r:180,color:'#a9e7dc'});}
  if(g.secrets.includes('portal')){
    if(g.portal){p.x=g.portal.x;p.y=g.portal.y;p.prevX=p.x;p.prevY=p.y;g.portal=null;p.dash=0;g.emit('portal',{x:p.x,y:p.y});}
    else{g.portal={x:origin.x,y:origin.y,life:6};p.dashCooldown=Math.min(p.dashCooldown,.7);}
  }
}

export function validateRunState(data,numeric){
  if(data.reverieVersion===undefined){if(['runMode','omen','limitBreak','secrets','encounters','encounterOffers','encounterIndex','nextEncounter','conditionFlags','stillness','echoes','portal','timeStop','lifePrice','eclipseAt','growthHistory','growthAt','growthDamage','cycle','fieldGiftAt'].some(key=>Object.hasOwn(data,key))||data.mode==='anomaly')throw new Error('Missing night version');return;}
  if(![0,1].includes(data.reverieVersion)||!['expedition','endless'].includes(data.runMode)||!['legacy',...OMENS.map(o=>o.id)].includes(data.omen))throw new Error('Invalid night rules');
  for(const key of ['secrets','conditionFlags'])if(!Array.isArray(data[key])||data[key].length>4||new Set(data[key]).size!==data[key].length||data[key].some(id=>!SECRET[id]))throw new Error('Invalid hidden relics');
  numeric(data,['encounterIndex','nextEncounter','stillness','timeStop','lifePrice','eclipseAt','growthAt','growthDamage','cycle','fieldGiftAt']);
  if(Object.hasOwn(data,'limitBreak')&&(!data.limitBreak||Array.isArray(data.limitBreak)||Object.keys(data.limitBreak).length!==3||['power','haste','area'].some(key=>!Number.isInteger(data.limitBreak[key])||data.limitBreak[key]<0||data.limitBreak[key]>9999)))throw new Error('Invalid limit break');
  if(data.lifePrice<0||data.lifePrice>500||data.stillness<0||data.timeStop<0||data.timeStop>10||data.nextEncounter<0||data.eclipseAt<0||data.growthAt<0||data.growthDamage<0||data.fieldGiftAt<0||!Number.isInteger(data.cycle)||data.cycle<0||!Number.isInteger(data.encounterIndex)||data.encounterIndex<0)throw new Error('Invalid night progression');
  if(!Array.isArray(data.echoes)||data.echoes.length>12||data.echoes.some(e=>!WEAPON[e.weapon]||!Number.isFinite(e.wait)||e.wait<0||e.wait>1))throw new Error('Invalid echoes');
  if(data.portal!==null&&(!data.portal||!Number.isFinite(data.portal.x)||!Number.isFinite(data.portal.y)||data.portal.x<0||data.portal.x>WORLD||data.portal.y<0||data.portal.y>WORLD||!Number.isFinite(data.portal.life)||data.portal.life<0||data.portal.life>6))throw new Error('Invalid doorway');
  if(!Array.isArray(data.encounters)||data.encounters.length>3||data.encounters.some(e=>!['altar','lantern'].includes(e.kind)||!Number.isFinite(e.x)||!Number.isFinite(e.y)||e.x<0||e.x>WORLD||e.y<0||e.y>WORLD||!Number.isFinite(e.life)||e.life<0||e.life>50||!Number.isFinite(e.progress)||e.progress<0||e.progress>3.1||typeof e.used!=='boolean'||typeof e.title!=='string'||e.title.length>80||e.secret!==null&&!SECRET[e.secret]))throw new Error('Invalid encounter');
  if(!Array.isArray(data.encounterOffers)||data.encounterOffers.length>3||new Set(data.encounterOffers.map(o=>o.id)).size!==data.encounterOffers.length||data.encounterOffers.some(o=>!['secret','gift'].includes(o.type)||o.type==='secret'&&(!SECRET[o.id]||data.secrets.includes(o.id))||o.type==='gift'&&(o.id!=='gift'||o.price!==0)||!Number.isFinite(o.price)||o.price<0||o.price>500))throw new Error('Invalid encounter reward');
  if(data.mode==='anomaly'&&!data.encounterOffers.length)throw new Error('Missing encounter reward');
  if(data.mode!=='anomaly'&&data.encounterOffers.length)throw new Error('Inactive encounter reward');
  if(!Array.isArray(data.growthHistory)||data.growthHistory.length>32||data.growthHistory.some(point=>['time','level','dps','kills','evolutions'].some(key=>!Number.isFinite(point[key])||point[key]<0)))throw new Error('Invalid growth history');
}
