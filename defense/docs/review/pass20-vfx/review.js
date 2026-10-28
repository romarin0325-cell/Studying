import {Art,Renderer} from '../../../src/combat/render.js';
import {Renderer as BeforeRenderer} from './before/render.js';
import * as E from '../../../src/combat/engine.js';
import {HERO} from '../../../src/content.js';
import {ENTRIES,reviewScene} from './scene.js';
const $=id=>document.getElementById(id),DATA=window.PASS20_DATA,entries=Object.fromEntries(ENTRIES.map(e=>[e.key,e]));
const images={};
await Promise.all(Object.entries(DATA.images).map(([id,src])=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{images[id]=image;resolve();};image.onerror=()=>reject(Error('Missing review texture: '+id));image.src=src;})));
const makeArt=()=>{const a=Object.create(Art.prototype);a.images={...images};a.failed=[];a.ready=Promise.resolve();return a;};
const canvases=[$('before'),$('after')];
let config={key:'zeke-calm',mode:'attack',theme:'night',reduced:false,ring:true},runners=[],time=0,playhead=0,playing=true,last=0;
function seeded(seed,fn){const old=Math.random;let n=seed>>>0||1;Math.random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};try{return fn();}finally{Math.random=old;}}
function runnersFor(c,targets=canvases){
  const entry=entries[c.key];
  return targets.map((canvas,i)=>{
    const before=i===0,art=makeArt();
    if(c.theme==='bright')art.images.garden=images['bright-garden'];
    const renderer=new (before?BeforeRenderer:Renderer)(canvas,art);
    const fixture=reviewScene(entry,{mode:c.mode,chapter:c.theme==='dawn'?45:0});
    renderer.reduced=c.reduced;renderer.shake=0;
    if(c.mode==='range')renderer.selected=fixture.cell;
    const initial=fixture.state.events.splice(0);seeded(1,()=>initial.forEach(e=>renderer.event(e)));
    return {renderer,fixture,frames:0,entry,before,ring:c.ring};
  });
}
function advance(items,dt){for(const item of items){const events=item.fixture.advance(dt);seeded(++item.frames,()=>events.forEach(e=>item.renderer.event(e)));item.renderer.draw(item.fixture.state,dt);if(item.ring && item.entry.ring){const ctx=item.renderer.ctx,p=E.cellPoint(item.fixture.cell),unit=item.fixture.state.board[item.fixture.cell];const radius=item.entry.key==='cocoon'?E.unitHero(item.fixture.state,unit).range:HERO[item.entry.hero].range;ctx.save();ctx.setTransform(item.renderer.dpr,0,0,item.renderer.dpr,0,0);ctx.globalAlpha=.55;ctx.strokeStyle="white";ctx.lineWidth=1.5;ctx.setLineDash([6,5]);ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.stroke();ctx.restore();}}}
function playTo(items,t){advance(items,0);let at=0;while(at+1/60<=t+1e-8){advance(items,1/60);at+=1/60;}return at;}
const skillLine=(entry,h)=>`${h.skill.name} · 별빛 ${h.skill.cost}`;
function report(){
  const entry=entries[config.key],h=HERO[entry.hero],fx=runners[0]?.fixture;
  $('clock').textContent=time.toFixed(2)+'초';$('seek').max=String(entry.duration);$('seek').value=String(Math.min(entry.duration,time));
  $('hero-name').textContent=entry.label;
  $('role').textContent=config.mode==='badge'?'조커 둘 · 1.5초에 빨강에서 카오스로 전환':config.mode==='range'?`${h.name} · ${h.role} · 사거리 ${h.range} · 판정 폭 ${h.radius}`:config.mode==='skill'?skillLine(entry,h)+(fx?.farPx?` · 원 밖 ${Math.round(fx.edgePx)}px, 먼 적 ${Math.round(fx.farPx)}px`:''):`${h.role} · 사거리/반경 ${h.range}/${h.radius}`;
  $('reason').textContent=DATA.notes[config.key]||'';
  $('play').textContent=playing?'일시정지':'재생';
}
function reset(){runners=runnersFor(config);time=0;playhead=0;advance(runners,0);report();}
function seek(t){if(t<time-.0001)reset();while(time+1/60<=t+1e-8){advance(runners,1/60);time+=1/60;}report();}
function syncModes(){const entry=entries[config.key];if(!entry.modes.includes(config.mode))config.mode=entry.modes[0];for(const o of $('mode').options)o.disabled=!entry.modes.includes(o.value);$('mode').value=config.mode;}
function choose(c){config={...config,...c};syncModes();$('hero').value=config.key;$('mode').value=config.mode;$('theme').value=config.theme;$('reduced').checked=config.reduced;$('ring').checked=config.ring;reset();}
for(const entry of ENTRIES){const option=document.createElement('option');option.value=entry.key;option.textContent=entry.label;$('hero').append(option);}
$('hero').addEventListener('change',()=>choose({key:$('hero').value}));
for(const id of ['mode','theme'])$(id).addEventListener('change',()=>choose({[id]:$(id).value}));
$('reduced').addEventListener('change',()=>choose({reduced:$('reduced').checked}));
$('ring').addEventListener('change',()=>choose({ring:$('ring').checked}));
$('play').onclick=()=>{playing=!playing;playhead=time;report();};$('restart').onclick=reset;
$('seek').oninput=()=>{playing=false;seek(Number($('seek').value));playhead=time;};
const keys=ENTRIES.map(e=>e.key);
for(const [name,offset] of [['previous',-1],['next',1]])$(name).onclick=()=>choose({key:keys[(keys.indexOf(config.key)+offset+keys.length)%keys.length]});
const snap=item=>({impacts:item.renderer.fx.impacts.length,shots:item.fixture.state.shots.length,sunlight:item.fixture.state.sunlight,joker:item.fixture.state.jokerColor,bombs:item.fixture.state.bombs.length,selected:item.renderer.selected,enemies:item.fixture.state.enemies.length,fury:item.fixture.state.events.some(e=>e.fury)||item.renderer.fx.impacts.some(e=>e.fury)});
const status=()=>({ready:true,config:{...config},time,draws:runners.map(snap)});
window.PASS20_REVIEW={entries:ENTRIES.map(e=>({key:e.key,mode:e.modes[0],peak:e.peak,label:e.label,moments:e.moments})),get state(){return status();},select(c={},t){playing=false;choose(c);seek(t??entries[config.key].peak);return status();}};
choose({});
function animate(now){const dt=Math.min(.05,(now-(last||now))/1000)*Number($('speed').value);last=now;if(playing){playhead+=dt;const cap=entries[config.key].duration;if(playhead>cap)reset();else seek(Math.min(cap,playhead));}requestAnimationFrame(animate);}requestAnimationFrame(animate);

const labels=['기존','적용 후'];
for(const entry of ENTRIES){
  const row=document.createElement('tr'),head=document.createElement('th');
  const button=document.createElement('button');button.textContent=entry.label;button.onclick=()=>{choose({key:entry.key});$('player').scrollIntoView({behavior:'smooth',block:'start'});};head.append(button);
  const note=document.createElement('p');note.textContent=DATA.notes[entry.key];head.append(note);row.append(head);
  for(const column of [0,1]){
    const cell=document.createElement('td'),strip=document.createElement('div');strip.className='strip';
    for(const moment of entry.moments){
      const canvas=document.createElement('canvas'),made=[document.createElement('canvas'),document.createElement('canvas')];made[column]=canvas;
      const item=runnersFor({key:entry.key,mode:entry.modes[0],theme:'night',reduced:false,ring:true},made)[column];
      playTo([item],moment);
      const fig=document.createElement('figure'),cap=document.createElement('figcaption'),img=document.createElement('img');
      cap.textContent=`${labels[column]} · ${moment.toFixed(2)}초`;img.src=canvas.toDataURL('image/webp',.8);img.alt=`${entry.label} ${labels[column]} ${moment}초`;img.loading='lazy';
      fig.append(img,cap);strip.append(fig);
    }
    cell.append(strip);row.append(cell);
  }
  $('rows').append(row);await new Promise(resolve=>setTimeout(resolve,0));
}
$('loading').textContent='비교표 준비 완료 · 같은 엔진 이벤트, 변경 전/후 실제 렌더러';window.PASS20_REVIEW.galleryReady=true;
