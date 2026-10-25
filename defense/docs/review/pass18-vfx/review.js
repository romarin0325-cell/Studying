import {Art,Renderer} from '../../../src/combat/render.js';
import {Renderer as BeforeRenderer} from './before/render.js';
import {HERO} from '../../../src/content.js';
import {MIRACLE_FORMS} from '../../../src/new-companions.js';
import {reviewScene,ENTRIES} from './scene.js';
const $=id=>document.getElementById(id),DATA=window.PASS18_DATA,entries=Object.fromEntries(ENTRIES.map(e=>[e.key,e]));
const images={};
await Promise.all(Object.entries(DATA.images).map(([id,src])=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{images[id]=image;resolve();};image.onerror=()=>reject(Error('Missing review texture: '+id));image.src=src;})));
const makeArt=()=>{const a=Object.create(Art.prototype);a.images={...images};a.failed=[];a.ready=Promise.resolve();return a;};
const canvases=[$('before'),$('after')];
// Zeke's column before pass 18 runs with his old cleave (90-degree band, range 345, power 25); after, the new circle.
const OLD_ZEKE={shape:'cleave',range:345,radius:90,damage:25};
function asBefore(entry,before,fn){if(!before||entry.hero!=='zeke')return fn();const keep={};for(const k of Object.keys(OLD_ZEKE))keep[k]=HERO.zeke[k];Object.assign(HERO.zeke,OLD_ZEKE);try{return fn();}finally{Object.assign(HERO.zeke,keep);}}
let config={key:'demon_king',mode:'skill',theme:'night',reduced:false},runners=[],time=0,playhead=0,playing=true,last=0;
function seeded(seed,fn){const old=Math.random;let n=seed;Math.random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};try{return fn();}finally{Math.random=old;}}
function runnersFor(c,targets=canvases){
  const entry=entries[c.key];
  return targets.map((canvas,i)=>{
    const before=i===0,art=makeArt();
    if(c.theme==='bright')art.images.garden=images['bright-garden'];
    const r=new (before?BeforeRenderer:Renderer)(canvas,art);
    const fixture=asBefore(entry,before,()=>reviewScene(entry,{mode:c.mode,chapter:c.theme==='dawn'?45:0}));
    r.reduced=c.reduced;r.shake=0;
    const initial=fixture.state.events.splice(0);seeded(1,()=>initial.forEach(e=>r.event(e)));
    return {renderer:r,fixture,frames:0,entry,before};
  });
}
function advance(items,dt){for(const item of items)asBefore(item.entry,item.before,()=>{const events=item.fixture.advance(dt);seeded(++item.frames,()=>events.forEach(e=>item.renderer.event(e)));item.renderer.draw(item.fixture.state,dt);});}
const nameOf=entry=>entry.form?MIRACLE_FORMS[entry.form].name:HERO[entry.hero].name;
function report(){
  const entry=entries[config.key],h=HERO[entry.hero];
  $('clock').textContent=time.toFixed(2)+'초';$('seek').value=time;$('hero-name').textContent=nameOf(entry);
  $('role').textContent=config.mode==='skill'?`${h.skill.name} · 별빛 ${h.skill.cost}`:entry.form?`${MIRACLE_FORMS[entry.form].attack} · 사거리/반경 ${MIRACLE_FORMS[entry.form].range}/${MIRACLE_FORMS[entry.form].radius}`:`${h.role} · 사거리/반경 ${h.range}/${h.radius}`;
  $('reason').textContent=DATA.notes[config.key][config.mode]||'';
  $('play').textContent=playing?'일시정지':'재생';
}
function reset(){runners=runnersFor(config);time=0;playhead=0;advance(runners,0);report();}
function seek(t){if(t<time)reset();while(time+1/60<=t+1e-8){advance(runners,1/60);time+=1/60;}report();}
function syncModes(){const entry=entries[config.key];if(!entry.modes.includes(config.mode))config.mode=entry.modes[0];for(const o of $('mode').options)o.disabled=!entry.modes.includes(o.value);}
function choose(c){config={...config,...c};syncModes();$('hero').value=config.key;$('mode').value=config.mode;$('theme').value=config.theme;$('reduced').checked=config.reduced;reset();}
for(const entry of ENTRIES){const option=document.createElement('option');option.value=entry.key;option.textContent=nameOf(entry);$('hero').append(option);}
$('hero').addEventListener('change',()=>choose({key:$('hero').value}));
for(const id of ['mode','theme'])$(id).addEventListener('change',()=>choose({[id]:$(id).value}));
$('reduced').addEventListener('change',()=>choose({reduced:$('reduced').checked}));
$('play').onclick=()=>{playing=!playing;playhead=time;report();};$('restart').onclick=reset;
$('seek').oninput=()=>{playing=false;seek(Number($('seek').value));playhead=time;};
$('speed').onchange=()=>{};
const keys=ENTRIES.map(e=>e.key);
for(const [name,offset] of [['previous',-1],['next',1]])$(name).onclick=()=>choose({key:keys[(keys.indexOf(config.key)+offset+keys.length)%keys.length]});
const status=()=>({ready:true,config:{...config},time,draws:runners.map(x=>({impacts:x.renderer.fx.impacts.length,shots:x.fixture.state.shots.length,damage:x.fixture.state.stats.damage,forms:x.fixture.state.board.filter(u=>u?.hero==='miracle_larva').map(u=>u.form)}))});
window.PASS18_REVIEW={get state(){return status();},select(c={},t=.4){playing=false;choose(c);seek(t);return status();}};
choose({});
function animate(now){const dt=Math.min(.06,(now-(last||now))/1000)*Number($('speed').value);last=now;if(playing){playhead+=dt;if(playhead>2.4)reset();seek(Math.min(2.4,playhead));}requestAnimationFrame(animate);}requestAnimationFrame(animate);

// Contact sheet: the same renderers at fixed moments, so the strike, the peak and the fade can be compared at once.
const MOMENTS={attack:[.08,.16,.3],skill:[.12,.32,.7]};
for(const entry of ENTRIES)for(const mode of entry.modes){
  const row=document.createElement('tr'),head=document.createElement('th');
  const button=document.createElement('button');button.textContent=`${nameOf(entry)} · ${mode==='skill'?'필살기':'평타'}`;button.onclick=()=>{choose({key:entry.key,mode});$('player').scrollIntoView({behavior:'smooth',block:'start'});};head.append(button);
  const note=document.createElement('p');note.textContent=DATA.notes[entry.key][mode];head.append(note);row.append(head);
  for(const [i,label] of [[0,'기존'],[1,'적용 후']].values()){
    const cell=document.createElement('td'),strip=document.createElement('div');strip.className='strip';
    for(const moment of MOMENTS[mode]){
      const canvas=document.createElement('canvas'),items=runnersFor({...config,key:entry.key,mode},[canvas]).map(x=>x);
      // runnersFor makes [before] for one canvas; build the after column with a second canvas.
      const item=i?runnersFor({...config,key:entry.key,mode},[document.createElement('canvas'),canvas])[1]:items[0];
      for(let t=0;t<moment;t+=1/60)advance([item],1/60);
      const fig=document.createElement('figure'),cap=document.createElement('figcaption'),img=document.createElement('img');cap.textContent=`${label} · ${moment.toFixed(2)}초`;img.src=canvas.toDataURL('image/webp',.8);img.alt=`${nameOf(entry)} ${label} ${moment}초`;img.loading='lazy';fig.append(img,cap);strip.append(fig);
    }
    cell.append(strip);row.append(cell);
  }
  $('rows').append(row);await new Promise(resolve=>setTimeout(resolve,0));
}
$('loading').textContent='비교표 준비 완료 · 같은 엔진 이벤트, 변경 전/후 실제 렌더러';window.PASS18_REVIEW.galleryReady=true;
