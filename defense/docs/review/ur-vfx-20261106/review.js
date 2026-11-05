import {Art,Renderer} from '../../../src/combat/render.js';
import {Renderer as BeforeRenderer} from './before/render.js';
import {HERO} from '../../../src/content.js';
import {ENTRIES,reviewScene,isUltimateUR} from './scene.js';
const $=id=>document.getElementById(id),DATA=window.UR_REVIEW_DATA,entries=Object.fromEntries(ENTRIES.map(e=>[e.key,e]));
const images={};
await Promise.all(Object.entries(DATA.images).map(([id,src])=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{images[id]=image;resolve();};image.onerror=()=>reject(Error('Missing review texture: '+id));image.src=src;})));
const makeArt=(theme)=>{const a=Object.create(Art.prototype);a.images={...images};if(theme==='bright')a.images.garden=images['bright-garden'];a.failed=[];a.ready=Promise.resolve();return a;};
const canvases=[$('before'),$('after')],FRAME=1/60;
let config={key:'cherry',theme:'night',reduced:false,cutin:true,speed:1,hold:true,hitstop:true,kills:true,empowered:false,spotlight:false,moving:true,freed:true,repeat:false,twin:false,marks:true,palette:'v2',phone:false},runners=[],time=0,playhead=0,playing=true,last=0;
// Renderer particles use Math.random; both columns get the same sequence per frame.
function seeded(seed,fn){const old=Math.random;let n=seed>>>0||1;Math.random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};try{return fn();}finally{Math.random=old;}}
function runnersFor(c,targets=canvases){
  const entry=entries[c.key];
  return targets.map((canvas,i)=>{
    const before=i===0,renderer=new (before?BeforeRenderer:Renderer)(canvas,makeArt(c.theme));
    const fixture=reviewScene(entry,{kills:c.kills,empowered:c.empowered,spotlight:c.spotlight,moving:c.moving,freed:c.freed,repeat:c.repeat,twin:c.twin,marks:c.marks,chapter:c.theme==='dawn'?45:0});
    renderer.reduced=c.reduced;renderer.shake=0;if(!before){renderer.hold=c.hold;renderer.fx.palette=c.palette;}
    const item={renderer,fixture,frames:0,entry,before,slowmo:0,stopped:0};
    seeded(1,()=>renderer.draw(fixture.state,0));
    const initial=fixture.cast();
    // The game starts the UR slow motion with the cut-in (app.js cutIn); the review does the same.
    if(c.cutin&&!c.reduced&&isUltimateUR(entry))item.slowmo=.5;
    seeded(1,()=>initial.forEach(e=>renderer.event(e)));
    return item;
  });
}
// One real-time frame: the simulation advances by speed x slow motion, unless the new renderer asked for a hitstop.
function advance(items,dt,c=config){
  for(const item of items){
    const r=item.renderer;let sim=dt*c.speed*(item.slowmo>0?.3:1);item.slowmo=Math.max(0,item.slowmo-dt);
    if(!item.before&&c.hitstop&&r.hitstop>0){r.hitstop=Math.max(0,r.hitstop-dt);sim=0;item.stopped+=dt;}else if(!item.before)r.hitstop=0;
    const events=sim>0?item.fixture.advance(sim):[];
    seeded(++item.frames,()=>events.forEach(e=>r.event(e)));
    r.draw(item.fixture.state,dt);
    if(c.cutin&&item.entry.mode==='skill')cutinBand(item);
  }
}
// The game's cut-in is a DOM band over the board (app.js cutIn, style.css .cutin): UR top 5% and 26% tall for 1.6 s, other
// rarities top 7% and 22% (C/R 18%) for 1.1 s, skewed -7 degrees, 88% opaque. Simulated so the review shows what it hides.
function cutinBand(item){const h=HERO[item.entry.hero],ur=h.hidden||h.rarity==='UR',dur=ur?1.6:1.1,top=ur?.05:.07,tall=ur?.26:['C','R'].includes(h.rarity)?.18:.22,age=item.frames/60;if(age>dur)return;
  const k=age<dur*.16?age/(dur*.16):age>dur*.8?1-(age-dur*.8)/(dur*.2):1,ctx=item.renderer.ctx,y0=780*top,y1=780*(top+tall),sk=Math.tan(7*Math.PI/180);
  ctx.save();ctx.setTransform(item.renderer.dpr,0,0,item.renderer.dpr,0,0);ctx.globalAlpha=.88*k;ctx.fillStyle='#080a1e';ctx.beginPath();ctx.moveTo(-90,y0+sk*450);ctx.lineTo(810,y0-sk*450);ctx.lineTo(810,y1-sk*450);ctx.lineTo(-90,y1+sk*450);ctx.closePath();ctx.fill();
  ctx.globalAlpha=k;ctx.strokeStyle=ur?'#ffe08a':h.color;ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#ffffff';ctx.font='700 26px system-ui';ctx.textAlign='center';ctx.fillText(h.skill.name,400,(y0+y1)/2+8);ctx.restore();}
function playTo(items,t,c){advance(items,0,c);let at=0;while(at+FRAME<=t+1e-8){advance(items,FRAME,c);at+=FRAME;}return at;}
function report(){
  const entry=entries[config.key],h=HERO[entry.hero],fx=runners[1];
  $('clock').textContent=time.toFixed(2)+'초';$('seek').max=String(entry.duration);$('seek').value=String(Math.min(entry.duration,time));
  $('hero-name').textContent=entry.label;
  $('role').textContent=entry.mode==='skill'?`${h.skill.name} · 별빛 ${h.skill.cost} · ${h.rarity}`:'일반 공격';
  $('reason').textContent=entry.note;
  $('stop').textContent=fx?`히트스톱 누적 ${(fx.stopped*1000).toFixed(0)}ms · 보류 중 숫자 ${fx.renderer.releases?.length||0} · 잔상 ${fx.renderer.ghosts?.length||0}`:'';
  $('play').textContent=playing?'일시정지':'재생';
  for(const o of ['kills','empowered','spotlight','moving','freed','repeat','twin','marks'])$(o).closest('label').hidden=!entry.options.includes(o);
}
function reset(){runners=runnersFor(config);time=0;playhead=0;advance(runners,0);report();}
function seek(t){if(t<time-.0001)reset();while(time+FRAME<=t+1e-8){advance(runners,FRAME);time+=FRAME;}report();}
function choose(c){config={...config,...c};$('hero').value=config.key;for(const id of ['theme','speed','palette'])$(id).value=String(config[id]);for(const id of ['reduced','cutin','hold','hitstop',...['kills','empowered','spotlight','moving','freed','repeat','twin','marks'],'phone'])$(id).checked=!!config[id];document.body.classList.toggle('phone',config.phone);reset();}
// Scenes grouped by pass (1차: Cherry Prince, Luna, Frost Witch, Harmonious and basic attacks; 2차: the five of pass 22).
const groups=new Map();for(const entry of ENTRIES){const b=entry.batch||1;if(!groups.has(b)){const g=document.createElement('optgroup');g.label=b+'차';groups.set(b,g);$('hero').append(g);}const option=document.createElement('option');option.value=entry.key;option.textContent=entry.label;groups.get(b).append(option);}
$('hero').addEventListener('change',()=>choose({key:$('hero').value}));
$('theme').addEventListener('change',()=>choose({theme:$('theme').value}));
$('speed').addEventListener('change',()=>choose({speed:Number($('speed').value)}));
$('palette').addEventListener('change',()=>choose({palette:$('palette').value}));
for(const id of ['reduced','cutin','hold','hitstop',...['kills','empowered','spotlight','moving','freed','repeat','twin','marks'],'phone'])$(id).addEventListener('change',()=>choose({[id]:$(id).checked}));
$('play').onclick=()=>{playing=!playing;playhead=time;report();};$('restart').onclick=reset;
$('seek').oninput=()=>{playing=false;seek(Number($('seek').value));playhead=time;};
const keys=ENTRIES.map(e=>e.key);
for(const [name,offset] of [['previous',-1],['next',1]])$(name).onclick=()=>choose({key:keys[(keys.indexOf(config.key)+offset+keys.length)%keys.length]});
const status=()=>({ready:true,config:{...config},time,after:{contacts:runners[1]?.renderer.fx.impacts.filter(e=>e.type==='contact').length||0,flashes:runners[1]?[...runners[1].renderer.flash.values()].filter(v=>runners[1].renderer.clock-v<.12).length:0,releases:runners[1]?.renderer.releases?.length||0,ghosts:runners[1]?.renderer.ghosts?.length||0,stopped:runners[1]?.stopped||0,enemies:runners[1]?.fixture.state.enemies.length,heldGold:runners[1]?.renderer.heldGold?.()??0,moving:runners[1]?.renderer.moves?.size??0}});
window.UR_REVIEW={entries:ENTRIES.map(e=>({key:e.key,label:e.label,moments:e.moments,mode:e.mode})),get state(){return status();},select(c={},t){playing=false;choose(c);seek(t??entries[config.key].moments[1]);return status();}};
choose({});
function animate(now){const dt=Math.min(.05,(now-(last||now))/1000)*Number($('rate').value);last=now;if(playing){playhead+=dt;const cap=entries[config.key].duration;if(playhead>cap)reset();else seek(Math.min(cap,playhead));}requestAnimationFrame(animate);}requestAnimationFrame(animate);
$('rate').addEventListener('change',()=>{last=0;});

// Gallery: the same moments for every scene, both renderers, default options (night, cut-in band, 1x, hold and hitstop on).
const labels=['기존','적용 후'];
for(const entry of ENTRIES){
  const row=document.createElement('tr'),head=document.createElement('th'),button=document.createElement('button');button.textContent=`${entry.batch||1}차 · ${entry.label}`;button.onclick=()=>{choose({key:entry.key});$('player').scrollIntoView({behavior:'smooth',block:'start'});};head.append(button);
  const note=document.createElement('p');note.textContent=entry.note;head.append(note);row.append(head);
  for(const column of [0,1]){
    const cell=document.createElement('td'),strip=document.createElement('div');strip.className='strip';
    for(const moment of entry.moments){
      const canvas=document.createElement('canvas'),made=[document.createElement('canvas'),document.createElement('canvas')];made[column]=canvas;
      const c={...config,key:entry.key,theme:'night',reduced:false,cutin:true,speed:1,hold:true,hitstop:true,kills:true,empowered:false,spotlight:false,moving:true,freed:true,repeat:false,twin:false,marks:true,palette:'v2'};
      const item=runnersFor(c,made)[column];playTo([item],moment,c);
      const fig=document.createElement('figure'),cap=document.createElement('figcaption'),img=document.createElement('img');
      cap.textContent=`${labels[column]} · ${moment.toFixed(2)}초`;img.src=canvas.toDataURL('image/webp',.8);img.alt=`${entry.label} ${labels[column]} ${moment}초`;img.loading='lazy';
      fig.append(img,cap);strip.append(fig);
    }
    cell.append(strip);row.append(cell);
  }
  $('rows').append(row);await new Promise(resolve=>setTimeout(resolve,0));
}
$('loading').textContent='비교표 준비 완료 · 같은 엔진 이벤트, main 렌더러와 이번 렌더러';window.UR_REVIEW.galleryReady=true;
