import * as E from '../merge/engine.js';
import {HEROES,DEFAULT_DECK,HERO} from '../merge/content.js';
import {Art,Renderer} from '../merge/render.js';

const $=id=>document.getElementById(id),art=new Art();await art.ready;
const preferred=['zeke','mushroom_king','ancient_dragon','red_dragon','silver_rabbit','guardian'];
const order=[...preferred,...HEROES.map(h=>h.id).filter(id=>!preferred.includes(id))];
$('hero').innerHTML=order.map(id=>`<option value="${id}">${HERO[id].name}</option>`).join('');
let s,renderer,frame=0,playing=false,attacker=7,impactCount=0,last=0,carry=0;
function reset(){
  const id=$('hero').value,layout=$('layout').value;
  s=E.newRun({seed:473951,deck:layout==='dense'?preferred:[id,...DEFAULT_DECK.filter(x=>x!==id)].slice(0,6)});
  const template=s.board.find(Boolean);s.board.fill(null);
  attacker=layout==='left'?11:layout==='right'?13:layout==='bottom'?17:7;
  const unit=(hero,index)=>({...template,uid:s.nextId++,hero,rank:1,cooldown:.2+(layout==='dense'?index*.013:0),attacks:0,priority:'first'});
  if(layout==='dense')s.board=s.board.map((_,i)=>unit(preferred[i%6],i));
  else s.board[attacker]=unit(id,attacker);
  s.phase='combat';s.wave=8;s.queue=Array.from({length:layout==='dense'?18:5},()=>({kind:'grunt',hp:1e7}));s.waveTotal=s.queue.length;
  while(s.queue.length){s.spawnIn=0;E.step(s,1/60);}
  const progress={solo:180,right:720,left:1840,bottom:1260};
  s.enemies.forEach((e,i)=>{e.progress=layout==='dense'?i*115:progress[layout]+i*42;e.speed=0;e.skillIn=1e6;});
  s.board.forEach(u=>{if(u){u.cooldown=.2;u.windup=0;u.target=null;u.attacks=0;}});
  s.shots=[];s.zones=[];s.events=[];s.time=s.waveTime=0;s.gauge=100;
  renderer=new Renderer($('review'),art);renderer.reduced=$('reduced').checked;renderer.selected=$('selected').checked?attacker:-1;
  frame=0;impactCount=0;carry=0;renderer.draw(s,0);readout();
}
function readout(){
  $('readout').textContent=`${(frame/60).toFixed(2)}초 · 명중 ${impactCount}회 · 범위 ${renderer.fx.footprints.length} · 장판 ${s.zones.length}`;
  $('scrub').value=String(Math.min(360,frame));$('review').dataset.frame=String(frame);$('review').dataset.impacts=String(impactCount);
  $('review').dataset.footprints=String(renderer.fx.footprints.length);$('review').dataset.zones=String(s.zones.length);
}
function advance(){
  // Match the game's fixed 60Hz simulation even when presentation runs at 2x.
  for(let tick=0;tick<Number($('speed').value);tick++)E.step(s,1/60);
  for(const e of s.events){renderer.event(e);if(e.type==='impact')impactCount++;}
  s.events=[];renderer.draw(s,1/60);frame++;readout();
}
function pause(){playing=false;$('play').textContent='재생';}
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'정지':'재생';};
$('restart').onclick=()=>{pause();reset();};
$('skill').onclick=()=>{const id=$('layout').value==='dense'?'zeke':$('hero').value;s.gauge=100;E.cast(s,id);for(const e of s.events)renderer.event(e);s.events=[];renderer.draw(s,0);readout();};
for(const id of ['hero','layout','speed','reduced','selected'])$(id).onchange=()=>{pause();reset();};
$('scrub').oninput=()=>{const target=Number($('scrub').value);pause();reset();for(let i=0;i<target;i++)advance();};
function tick(now){
  if(playing){carry+=Math.min(.05,(now-last)/1000);while(carry>=1/60){advance();carry-=1/60;}}
  last=now;requestAnimationFrame(tick);
}
reset();document.body.dataset.ready='true';requestAnimationFrame(tick);
