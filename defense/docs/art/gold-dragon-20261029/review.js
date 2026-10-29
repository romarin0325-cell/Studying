import * as E from '../../../src/combat/engine.js';
import {Art,Renderer} from '../../../src/combat/render.js';
import {HERO} from '../../../src/content.js';
const $=id=>document.getElementById(id);
const art=Object.create(Art.prototype);art.images={};art.failed=[];
await Promise.all(Object.entries(window.__ASTRA_ASSETS__).map(async([id,url])=>{
  const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});art.images[id]=img;
}));
let panels=[],time=0,playing=true,mode='normal',dense=false,dawn=false,castAt=0,seed=11;
const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
Math.random=random;
function fixture(id,opening=false){
  const s=E.newRun({deck:[id,...['star_boy','snow_rabbit','siren','great_detective'].filter(x=>x!==id)].slice(0,5),seed:11,crit:null});
  const template=structuredClone(s.board.find(Boolean));s.board.fill(null);s.spawnIn=0;E.step(s,.01);s.queue=[];s.events=[];s.time=0;s.waveTime=opening?(mode==='ultimate'?castAt:0):11;s.gauge=120;s.chapter=dawn?45:0;
  const e=s.enemies[0];Object.assign(e,{hp:1e8,maxHp:1e8,progress:863,speed:0});
  for(const progress of [815,839,887,911])s.enemies.push({...structuredClone(e),uid:s.nextId++,progress});
  const cells=dense?[1,3,5,7,9,11,12,13,15,17,19,21,23]:[12];
  for(const cell of cells)s.board[cell]={...structuredClone(template),uid:s.nextId++,hero:id,rank:1,cooldown:.2,windup:0,attacks:0,born:-1};
  if(!dense)for(const [cell,hero] of [[0,'star_boy'],[4,'snow_rabbit'],[20,'siren'],[24,'great_detective']])s.board[cell]={...structuredClone(template),uid:s.nextId++,hero,rank:1,cooldown:1e6,windup:0,born:-1};
  if(mode==='ultimate')E.cast(s,id);
  return s;
}
function reset(){
  seed=11;time=0;
  mode=$('mode').value;dense=$('dense').checked&&mode!=='ultimate';dawn=$('dawn').checked;castAt=Math.max(0,Math.min(15,Number($('castAt').value)||0));$('dense').disabled=mode==='ultimate';$('castControl').hidden=mode!=='ultimate';
  const predicted=44*E.GOLD_DRAGON.factor*(castAt+E.GOLD_DRAGON.charge<E.GOLD_DRAGON.opening-1e-9?2:1);
  const specs=mode==='ultimate'?[['gold_dragon',false,'평시 · 968'],['gold_dragon',true,`웨이브 ${castAt}초 시전 · 발사 피해 ${predicted.toLocaleString('ko-KR')}`]]:[['ancient_dragon',false,'기존 에인션트 드래곤'],['gold_dragon',mode==='opening',mode==='opening'?'골드드래곤 · 개전 붉은색':'골드드래곤 · 평시 금색']];
  panels=specs.map(([id,opening,label],i)=>{const s=fixture(id,opening),renderer=new Renderer($('canvas'+i),art);renderer.setQuality('standard');renderer.reduced=false;$('label'+i).textContent=label;return {s,renderer,id};});
  draw(0);updateHash();
}
function draw(dt){
  if(dt>0)time+=dt;
  for(const {s,renderer,id} of panels){
    if(dt>0)E.step(s,dt);
    for(const event of s.events)renderer.event(event);s.events=[];
    renderer.draw(s,dt);
    $('state'+panels.findIndex(p=>p.s===s)).textContent=(s.goldCharge?'차지 '+Math.max(0,s.goldCharge.ends-s.time).toFixed(1)+'초':s.volleys.some(v=>v.kind==='gold_breath')?'광선 비행':E.goldOpening(s)&&id==='gold_dragon'?'강화':'')+' · 누적 피해 '+Math.round(s.stats.byHero[id]||0).toLocaleString('ko-KR');
  }
  $('seek').value=String(time);$('time').textContent=time.toFixed(2)+'초';$('play').textContent=playing?'일시정지':'재생';
}
function seek(at){reset();for(let t=0;t<at-1e-9;t+=1/60)draw(Math.min(1/60,at-t));updateHash();}
function updateHash(){history.replaceState(null,'','#'+new URLSearchParams({mode,cast:String(castAt),dense:dense?'1':'0',dawn:dawn?'1':'0',time:time.toFixed(2)}));}
$('mode').onchange=reset;$('dense').onchange=reset;$('dawn').onchange=reset;$('castAt').onchange=reset;
$('play').onclick=()=>{playing=!playing;draw(0);};$('restart').onclick=()=>{reset();playing=true;};
$('step').onclick=()=>{playing=false;draw(1/60);updateHash();};$('seek').oninput=()=>{playing=false;seek(Number($('seek').value));};
$('rate').onchange=()=>{};
const hash=new URLSearchParams(location.hash.slice(1));$('mode').value=hash.get('mode')||'normal';$('castAt').value=hash.get('cast')||'0';$('dense').checked=hash.get('dense')==='1';$('dawn').checked=hash.get('dawn')==='1';
reset();if(Number(hash.get('time'))>0){playing=false;seek(Number(hash.get('time')));}
let last=performance.now();function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(playing){const total=dt*Number($('rate').value);for(let t=0;t<total;t+=.05)draw(Math.min(.05,total-t));if(time>8)reset();}requestAnimationFrame(frame);}requestAnimationFrame(frame);
// Read-only diagnostics and deterministic visual stepping for the verification script.
window.GOLD_REVIEW={get panels(){return panels;},get time(){return time;},pause:()=>{playing=false;},seek,reset,setMode:value=>{$('mode').value=value;reset();},setCastAt:value=>{$('castAt').value=value;reset();}};
