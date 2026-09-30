/* Simulation is intentionally independent of DOM, audio, and wall-clock time. */
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const ROOMS=[
 ['분류실','접힌 세계의 첫 문',0,30],['종이 골목','돌아갈 주소가 없는 편지',0,34],['빗소리 보관함','아직 끝나지 않은 문장',0,38],
 ['미완의 온실','피지 않은 봄의 이름',1,36],['뒤집힌 정원','보이지 않는 뿌리',1,40],['달빛 수문','흘러가도 남는 것',1,42],
 ['빈 별자리','누구도 쓰지 않은 다음',2,40],['새벽의 다리','지킬 자리를 정하는 밤',2,44],['남겨진 이름','최종 정리자',2,0]
];
const UPGRADES=[{id:'edge',name:'기억의 날',text:'베기 피해 +1 · 지킬 것이 생겼다'},{id:'step',name:'달의 보폭',text:'질주 충전 25% 단축 · 뒤돌아볼 시간'},{id:'heart',name:'머물 곳',text:'최대 체력 +2, 체력 회복 · 빈자리를 방으로'},{id:'veil',name:'조용한 약속',text:'은신 충전 30% 단축 · 더 오래 살아남기'},{id:'reach',name:'맞잡은 거리',text:'베기 범위 +16 · 닿을 수 있도록'}];
function create(seed=Date.now()){return {version:2,choices:[],seed:seed>>>0,room:0,time:0,spawn:2,spawned:0,kills:0,names:0,totalNames:0,hp:8,maxHp:8,damage:2,range:68,dashMax:2.1,veilMax:8,player:{x:210,y:420,fx:0,fy:-1},enemies:[],shots:[],particles:[],memories:[],wards:[],events:[],attack:0,dash:0,dashCd:0,veil:0,veilCd:0,invuln:0,hit:0,slash:0,state:'playing',upgrades:[],bossPhase:0};}
function random(g){g.seed=(Math.imul(g.seed,1664525)+1013904223)>>>0;return g.seed/4294967296;}
function beginRoom(g){g.time=0;g.spawn=1.2;g.spawned=0;g.enemies=[];g.shots=[];g.memories=[];g.particles=[];g.wards=g.choices[Math.floor(g.room/3)]==='release'?[]:[{x:68,y:170,charge:0,saved:false},{x:350,y:265,charge:0,saved:false},{x:90,y:475,charge:0,saved:false}];g.player={x:210,y:480,fx:0,fy:-1};g.state='playing';g.invuln=1;g.dashCd=0;g.veilCd=0;g.dash=0;g.veil=0;g.attack=0;if(g.room===8){spawnEnemy(g,'boss',210,160);g.enemies[0].hp=g.enemies[0].maxHp=Math.max(90,150-g.names*2);g.wards=[];}}
function spawnEnemy(g,type,x,y){const a=random(g)*Math.PI*2;g.enemies.push({id:++g.spawned,type,x:x??clamp(210+Math.cos(a)*220,30,390),y:y??clamp(320+Math.sin(a)*290,160,485),hp:type==='boss'?150:type==='knight'?7: type==='archer'?3:4,maxHp:type==='boss'?150:type==='knight'?7:type==='archer'?3:4,mode:'seek',timer:0.6+random(g),tx:0,ty:0,hit:0,cycle:0});}
function event(g,type,data={}){g.events.push({type,...data});}
function hurt(g,n){if(g.state!=='playing'||g.invuln>0||g.dash>0)return;g.hp=Math.max(0,g.hp-n);g.invuln=1.05;g.hit=.24;g.veil=0;event(g,'hurt');if(!g.hp){g.state='dead';event(g,'dead');}}
function burst(g,x,y,color,n=10){for(let i=0;i<n;i++){let a=random(g)*6.28,s=30+random(g)*130;g.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.3+random(g)*.5,color});}}
function damageEnemy(g,e,n){e.hp-=n;e.hit=.18;burst(g,e.x,e.y,'#d7bcff',6);if(e.hp<=0){g.kills++;event(g,'kill');g.memories.push({x:e.x,y:e.y,v:1});if(e.type==='boss'){g.state='won';event(g,'won');}}}
function act(g,action){if(g.state!=='playing')return;const p=g.player;if(action==='dash'&&g.dashCd<=0){g.dash=.19;g.dashCd=g.dashMax;g.invuln=Math.max(g.invuln,.24);event(g,'dash');}if(action==='veil'&&g.veilCd<=0){g.veil=2.8;g.veilCd=g.veilMax;event(g,'veil');}if(action==='attack'&&g.attack<=0){const hidden=g.veil>0;g.attack=.38;g.slash=.19;g.veil=0;event(g,'slash');for(const e of g.enemies){if(distance(p,e)<g.range+(e.type==='boss'?24:10))damageEnemy(g,e,g.damage*(hidden?2.5:1));}}}
function update(g,dt,input={}){
 if(g.state!=='playing')return;dt=clamp(dt,0,.04);g.time+=dt;for(const k of ['attack','dash','dashCd','veil','veilCd','invuln','hit','slash'])g[k]=Math.max(0,g[k]-dt);
 let mx=input.x||0,my=input.y||0,mag=Math.hypot(mx,my);if(mag>1){mx/=mag;my/=mag;}const p=g.player;if(mag>.12){p.fx=mx/(mag>1?1:mag);p.fy=my/(mag>1?1:mag);}let speed=g.veil>0?210:178;if(g.dash>0){mx=p.fx;my=p.fy;speed=760;burst(g,p.x,p.y,'#8be5fa',1);}p.x=clamp(p.x+mx*speed*dt,23,397);p.y=clamp(p.y+my*speed*dt,160,485);if(input.attack)act(g,'attack');
 const room=ROOMS[g.room],duration=room[3]-(g.choices[Math.floor(g.room/3)]==='release'?10:0);if(g.room<8&&g.time<duration){g.spawn-=dt;if(g.spawn<=0&&g.enemies.length<8){let r=random(g);spawnEnemy(g,r<.32&&g.room>0?'archer':r>.73&&g.room>1?'knight':'shade');g.spawn=Math.max(2,4.7-g.room*.23);}}
 for(const w of g.wards){if(!w.saved&&distance(p,w)<36){w.charge+=dt;if(w.charge>=2){w.saved=true;g.names++;g.totalNames++;g.hp=Math.min(g.maxHp,g.hp+1);burst(g,w.x,w.y,'#f3d28b',24);event(g,'name');}}else if(!w.saved)w.charge=Math.max(0,w.charge-dt*.4);}
 for(const e of g.enemies){if(e.hp<=0)continue;e.hit=Math.max(0,e.hit-dt);e.timer-=dt;const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1;const boss=e.type==='boss';
 if(e.mode==='seek'){
  if(g.veil<=0&&d>(e.type==='archer'?180:boss?125:42)){const v=boss?42:e.type==='knight'?50:e.type==='archer'?48:68;e.x+=dx/d*v*dt;e.y+=dy/d*v*dt;}
  if(e.timer<=0&&g.veil<=0){e.mode='wind';e.timer=boss?1.05:e.type==='knight'?1:.85;e.tx=p.x;e.ty=p.y;e.cycle++;}
 }else if(e.mode==='wind'&&e.timer<=0){
  if(e.type==='archer'||boss&&e.cycle%3===0){let count=boss?12:1;for(let i=0;i<count;i++){let a=count===1?Math.atan2(e.ty-e.y,e.tx-e.x):i/count*Math.PI*2+g.time;g.shots.push({x:e.x,y:e.y,vx:Math.cos(a)*(boss?112:155),vy:Math.sin(a)*(boss?112:155),life:5});}}
  else if(boss&&e.cycle%3===2){if(distance(p,e)<128)hurt(g,2);burst(g,e.x,e.y,'#ec8ea8',22);}
  else{e.mode='charge';e.timer=.32;const dd=Math.hypot(e.tx-e.x,e.ty-e.y)||1;e.vx=(e.tx-e.x)/dd*(boss?630:410);e.vy=(e.ty-e.y)/dd*(boss?630:410);}
  if(e.mode==='wind'){e.mode='rest';e.timer=boss?1.45:1.25;}
 }else if(e.mode==='charge'){e.x=clamp(e.x+e.vx*dt,25,395);e.y=clamp(e.y+e.vy*dt,160,485);if(distance(p,e)<(boss?42:27))hurt(g,boss?2:1);if(e.timer<=0){e.mode='rest';e.timer=boss?1.4:1;}}
 else if(e.mode==='rest'&&e.timer<=0){e.mode='seek';e.timer=boss?.3:.65;}
 }
 g.enemies=g.enemies.filter(e=>e.hp>0);
 for(const s of g.shots){s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;if(distance(p,s)<17){hurt(g,1);s.life=0;}}g.shots=g.shots.filter(s=>s.life>0&&s.x>0&&s.x<420&&s.y>70&&s.y<550);
 for(const m of g.memories){const d=distance(p,m);if(d<80){m.x+=(p.x-m.x)*dt*7;m.y+=(p.y-m.y)*dt*7;}if(d<19){m.v=0;g.totalNames++;event(g,'memory');}}g.memories=g.memories.filter(m=>m.v);
 for(const q of g.particles){q.x+=q.vx*dt;q.y+=q.vy*dt;q.life-=dt;}g.particles=g.particles.filter(q=>q.life>0).slice(-220);
 if(g.state==='playing'&&g.room<8&&g.time>=duration&&g.enemies.length===0){g.state='cleared';event(g,'clear');}
}
function upgrade(g,id){if(!UPGRADES.some(u=>u.id===id))return false;if(id==='edge')g.damage++;if(id==='step')g.dashMax*=.75;if(id==='heart'){g.maxHp+=2;g.hp=Math.min(g.maxHp,g.hp+4);}if(id==='veil')g.veilMax*=.7;if(id==='reach')g.range+=16;g.upgrades.push(id);return true;}
function choose(g,policy){const chapter=Math.floor(g.room/3);if(g.state!=='playing'||g.room%3!==0||g.choices.length!==chapter||!['keep','release'].includes(policy)||g.choices[chapter])return false;g.choices[chapter]=policy;if(policy==='release')g.hp=Math.min(g.maxHp,g.hp+3);beginRoom(g);event(g,'choice',{policy});return true;}
function restore(raw){try{let s=JSON.parse(raw);if(s.version!==2||!Number.isInteger(s.room)||s.room<0||s.room>8||!Number.isFinite(s.hp)||s.hp<=0||s.hp>100||!Array.isArray(s.upgrades)||s.upgrades.length>8||!Array.isArray(s.choices)||s.choices.length>3||s.choices.some(x=>!['keep','release'].includes(x))||s.choices.length<Math.floor(s.room/3)+(s.room%3?1:0)||s.choices.length>Math.floor(s.room/3)+1||!Number.isInteger(s.seed)||s.seed<0||s.seed>4294967295||!Number.isInteger(s.names)||s.names<0||s.names>24||!Number.isInteger(s.totalNames)||s.totalNames<s.names||s.totalNames>9999)return null;const g=create(s.seed);for(const u of s.upgrades)if(!upgrade(g,u))return null;g.choices=[...s.choices];g.room=s.room;g.hp=Math.min(g.maxHp,s.hp);g.totalNames=clamp(Number(s.totalNames)||0,0,9999);g.names=clamp(Number(s.names)||0,0,24);beginRoom(g);return g;}catch{return null;}}
function checkpoint(g){return JSON.stringify({version:2,choices:g.choices,seed:g.seed,room:g.room,hp:g.hp,upgrades:g.upgrades,totalNames:g.totalNames,names:g.names});}
const api={ROOMS,UPGRADES,create,beginRoom,update,act,upgrade,restore,checkpoint,spawnEnemy,choose};if(typeof module!=='undefined')module.exports=api;root.LunaCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
