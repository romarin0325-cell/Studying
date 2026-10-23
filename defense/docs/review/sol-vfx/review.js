import {Art,Renderer} from '../../../src/combat/render.js';
import {Renderer as BeforeRenderer} from './before/render.js';
import {HERO} from '../../../src/content.js';
import {reviewScene} from '../../../scripts/sol-review-scene.mjs';
const $=id=>document.getElementById(id),ids=Object.keys(window.SOL_DATA.heroes);
const images={};
await Promise.all(Object.entries(window.SOL_DATA.images).map(([id,src])=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{images[id]=image;resolve();};image.onerror=()=>reject(Error('Missing review texture: '+id));image.src=src;})));
const makeArt=before=>{const a=Object.create(Art.prototype);a.images={...images};a.failed=[];for(const id of ids)if(before)a.images['unit-'+id]=images['before-'+id];a.ready=Promise.resolve();return a;};
const arts=[makeArt(true),makeArt(false)],canvases=[$('before'),$('after')];
let config={hero:'toffee_apple',mode:'attack',dense:true,crowded:false,side:'left',theme:'night',reduced:false},runners=[],time=0,playhead=0,playing=true,last=0;
function seeded(seed,fn){const old=Math.random;let n=seed;Math.random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};try{return fn();}finally{Math.random=old;}}
function runnersFor(c,targets=canvases){
  return targets.map((canvas,i)=>{
    const art=Object.create(arts[i]);art.images={...arts[i].images};
    if(c.theme==='bright')art.images.garden=images['bright-garden'];
    const r=new (i?Renderer:BeforeRenderer)(canvas,art),fixture=reviewScene(c.hero,{...c,chapter:c.theme==='dawn'?45:0});
    r.reduced=c.reduced;r.shake=0;
    const initial=fixture.state.events.splice(0);seeded(1,()=>initial.forEach(e=>r.event(e)));
    return {renderer:r,fixture,frames:0};
  });
}
function advance(items,dt){for(const item of items){const events=item.fixture.advance(dt);seeded(++item.frames,()=>events.forEach(e=>item.renderer.event(e)));item.renderer.draw(item.fixture.state,dt);}}
function report(){
  $('clock').textContent=time.toFixed(2)+'초';$('seek').value=time;
  $('hero-name').textContent=HERO[config.hero].name;
  const h=HERO[config.hero];$('role').textContent=config.mode==='skill'?`${h.skill.name} · 별빛 ${h.skill.cost}`:`${h.role} · ${h.attack}`;
  $('reason').textContent=window.SOL_DATA.heroes[config.hero][config.mode];
  $('mine-note').hidden=!(config.hero==='toffee_apple'&&config.mode==='skill');
  $('play').textContent=playing?'일시정지':'재생';
}
function reset(){runners=runnersFor(config);time=0;playhead=0;advance(runners,0);report();}
function seek(t){if(t<time)reset();while(time+1/60<=t+1e-8){advance(runners,1/60);time+=1/60;}report();}
function choose(c){config={...config,...c};$('hero').value=config.hero;$('mode').value=config.mode;$('theme').value=config.theme;$('side').value=config.side;for(const id of ['dense','crowded','reduced'])$(id).checked=config[id];reset();}
for(const id of ids){const option=document.createElement('option');option.value=id;option.textContent=HERO[id].name;$('hero').append(option);}
for(const id of ['hero','mode','theme','side'])$(id).addEventListener('change',()=>choose({[id]:$(id).value}));
for(const id of ['dense','crowded','reduced'])$(id).addEventListener('change',()=>choose({[id]:$(id).checked}));
$('play').onclick=()=>{playing=!playing;playhead=time;report();};$('restart').onclick=reset;
$('seek').oninput=()=>{playing=false;seek(Number($('seek').value));playhead=time;};
for(const [name,offset] of [['previous',-1],['next',1]])$(name).onclick=()=>choose({hero:ids[(ids.indexOf(config.hero)+offset+ids.length)%ids.length]});
const status=()=>({ready:true,config:{...config},time,draws:runners.map(x=>({facing:x.fixture.state.board[12]?.facing,impacts:x.renderer.fx.impacts.length,shots:x.fixture.state.shots.length,bombs:x.fixture.state.bombs.length,damage:x.fixture.state.stats.damage,gauge:x.fixture.state.gauge,sacrificed:x.fixture.state.stats.sacrificed||0}))});
window.SOL_REVIEW={get state(){return status();},select(c={},t=.4){playing=false;choose(c);seek(t);return status();}};
reset();
function animate(now){const dt=Math.min(.06,(now-(last||now))/1000);last=now;if(playing){playhead+=dt;if(playhead>4.2)reset();seek(Math.min(4.2,playhead));}requestAnimationFrame(animate);}requestAnimationFrame(animate);

// The comparison table also uses these exact renderers / engine events. Its
// thumbnails are scaled evidence; the top canvases are the 390px game-size view.
for(const id of ids){
  const row=document.createElement('tr'),head=document.createElement('th');
  const button=document.createElement('button');button.textContent=HERO[id].name;button.onclick=()=>{choose({hero:id});$('player').scrollIntoView({behavior:'smooth',block:'start'});};head.append(button);row.append(head);
  for(const mode of ['attack','skill']){
    const cell=document.createElement('td'),text=document.createElement('p');text.textContent=window.SOL_DATA.heroes[id][mode];cell.append(text);
    const pair=document.createElement('div');pair.className='mini-pair';
    const targets=[0,1].map(()=>document.createElement('canvas')),items=runnersFor({...config,hero:id,mode},targets);
    const peak=mode==='skill'&&id==='toffee_apple'?1.48:mode==='skill'?.24:.3;
    for(let t=0;t<peak;t+=1/60)advance(items,1/60);
    for(const [i,canvas] of targets.entries()){
      const fig=document.createElement('figure'),caption=document.createElement('figcaption'),img=document.createElement('img');caption.textContent=i?'적용 후':'기존';img.src=canvas.toDataURL('image/webp',.79);img.alt=`${HERO[id].name} ${mode} ${caption.textContent}`;img.loading='lazy';fig.append(caption,img);pair.append(fig);
    }cell.append(pair);row.append(cell);
  }$('rows').append(row);await new Promise(resolve=>setTimeout(resolve,0));
}
$('loading').textContent='8명 비교표 준비 완료 · 같은 엔진 이벤트, 변경 전/후 실제 렌더러';window.SOL_REVIEW.galleryReady=true;
