// Offline viewer for every companion's basic attack and ultimate.
// The battle picture is the production Renderer. Painted motifs are counted
// from CombatFX atlas draws during the ultimate's own layers (skill field,
// finishers, persistent effects, zones, impacts) over the first 1.5s.
import {Art, Renderer} from '../src/combat/render.js';
import {CombatFX, FX_PROFILES} from '../src/combat/effects.js';
import {COMPANION_VISUALS} from '../src/combat/companion-vfx.js';
import {HEROES, HERO, RARITY} from '../src/content.js';
import {reviewScene} from './sol-review-scene.mjs';
import {cast, step, skillGoldCost} from '../src/combat/engine.js';

const $=id=>document.getElementById(id);
const DT=1/60;
const ULT_TIMES=[0.12,0.3,0.5,0.8,1.2,1.8];
const ATTACK_TIMES=[0.1,0.25,0.45];
const LABEL_W=248;
const GAP=4;
const SHEET={theme:'night',dense:true,reduced:false,side:'left',crowded:false};
const FILLERS=['star_boy','snow_rabbit','night_rabbit','great_detective','luna','jasmine','guardian','phantom','silver_rabbit','siren'];

const motif={enabled:false,capture:false,rows:new Map(),owner:null};
let motifPhase=0;
let motifIgnore=0;
let atlasCalls=0;

function logPaint(atlas,frame,width){
  if(!motif.enabled||!motif.capture||motifPhase<=0||motifIgnore>0)return;
  const w=Number(width);
  if(!atlas||!Number.isFinite(w)||w<=0||!Number.isFinite(frame))return;
  const key=atlas+'\0'+frame;
  let row=motif.rows.get(key);
  if(!row){row={atlas,frame,maxWidth:0,calls:0};motif.rows.set(key,row);}
  row.calls+=1;
  if(w>row.maxWidth)row.maxWidth=Math.round(w*100)/100;
}
function watch(name){
  const orig=CombatFX.prototype[name];
  CombatFX.prototype[name]=function(...args){
    motifPhase+=1;
    try{return orig.apply(this,args);}
    finally{motifPhase-=1;}
  };
}
// These layers are the ultimate. Trait seals, status icons, and basic-attack
// silhouettes stay outside the count. Skill shots are in: the fixture holds
// every placed unit's basic attack for 99s. A gift summon can still attack,
// so shots and stamps for anyone but the caster are ignored.
for(const name of ['drawSkillField','drawFinishers','drawFinisherLocks','drawPersistent','drawZones','draw'])watch(name);
const origShot=CombatFX.prototype.drawShot;
CombatFX.prototype.drawShot=function(shot){
  motifPhase+=1;
  const ignore=!!(motif.owner&&shot?.hero&&shot.hero!==motif.owner);
  if(ignore)motifIgnore+=1;
  try{return origShot.apply(this,arguments);}
  finally{if(ignore)motifIgnore-=1;motifPhase-=1;}
};
const origAtlas=CombatFX.prototype.atlasStamp;
CombatFX.prototype.atlasStamp=function(atlas,frame,columns,rows,x,y,width,height,angle,alpha){
  atlasCalls+=1;
  const a=alpha==null?1:alpha;
  const frameNo=Number(frame);
  const img=this.art?.images?.[atlas];
  if(a>0&&img&&Number.isFinite(frameNo))logPaint(String(atlas),Math.trunc(frameNo),Number(width));
  return origAtlas.apply(this,arguments);
};
// ultimate() and emblem() always paint through atlasStamp. stamp() sometimes
// copies the effects atlas with drawImage and never calls atlasStamp.
function callOwned(orig,hero,args){
  const ignore=!!(motif.owner&&hero!==motif.owner);
  if(ignore)motifIgnore+=1;
  try{return orig.apply(this,args);}
  finally{if(ignore)motifIgnore-=1;}
}
const origUltimate=CombatFX.prototype.ultimate;
CombatFX.prototype.ultimate=function(hero){return callOwned.call(this,origUltimate,hero,arguments);};
const origEmblem=CombatFX.prototype.emblem;
CombatFX.prototype.emblem=function(hero){return callOwned.call(this,origEmblem,hero,arguments);};
const origStamp=CombatFX.prototype.stamp;
CombatFX.prototype.stamp=function(hero,x,y,size,angle=0,alpha=1,form=null){
  const ignore=!!(motif.owner&&hero!==motif.owner);
  if(ignore)motifIgnore+=1;
  const before=atlasCalls;
  let result;
  try{result=origStamp.call(this,hero,x,y,size,angle,alpha,form);}
  finally{if(ignore)motifIgnore-=1;}
  if(!ignore&&atlasCalls===before&&alpha>0&&Number(size)>0){
    const own=COMPANION_VISUALS[hero];
    const fx=FX_PROFILES[hero];
    if(fx&&!(own&&this.art.images[own.atlas])&&!fx.atlas&&this.art.images.effects)logPaint('effects',fx.frame|0,Number(size));
  }
  return result;
};

const images={};
await Promise.all(Object.entries(window.ULT_DATA.images).map(([id,src])=>new Promise((resolve,reject)=>{
  const image=new Image();
  image.onload=()=>{if(image.naturalWidth>0){images[id]=image;resolve();}else reject(new Error('Empty texture '+id));};
  image.onerror=()=>reject(new Error('Missing texture '+id));
  image.src=src;
})));

function makeArt(theme){
  const art=Object.create(Art.prototype);
  art.images={...images};
  art.failed=[];
  if(theme==='bright')art.images.garden=images['bright-garden'];
  art.ready=Promise.resolve();
  return art;
}
function seeded(seed,fn){
  const old=Math.random;let n=seed>>>0;
  Math.random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
  try{return fn();}finally{Math.random=old;}
}
function frameIndex(t){
  let n=0,time=0;
  while(time+DT<=t+1e-8){n+=1;time+=DT;}
  return n;
}
function sceneAdvance(s,id){
  return dt=>{
    if(id==='toffee_apple'&&s.bombs.length&&s.time>=1.35&&s.enemies[0])s.enemies[0].progress=s.bombs[0].progress-70;
    step(s,dt);
    return s.events.splice(0);
  };
}
// The shared review fixture drops a hero whose id collides with its filler deck.
// Repair that here. sol-review-scene.mjs stays unchanged.
function openScene(id,opts){
  const theme=opts.theme||'night';
  const sceneOpts={mode:opts.mode||'attack',dense:opts.dense!==false,crowded:!!opts.crowded,side:opts.side||'left',chapter:theme==='dawn'?45:0};
  try{return {ok:true,scene:reviewScene(id,sceneOpts),tweaked:null};}
  catch(error){
    const reason=error?.message||String(error);
    if(sceneOpts.mode!=='skill')return {ok:false,reason,tweaked:null};
    let scene;
    try{scene=reviewScene(id,{...sceneOpts,mode:'attack'});}
    catch(again){return {ok:false,reason:again?.message||reason,tweaked:null};}
    const s=scene.state;
    const tweaks=[];
    if(!s.deck.includes(id)||new Set(s.deck).size!==s.deck.length){
      const deck=[id];
      for(const filler of FILLERS)if(!deck.includes(filler)&&deck.length<5)deck.push(filler);
      s.deck=deck;
      for(const hero of deck)if(s.upgrades[hero]==null)s.upgrades[hero]=0;
      tweaks.push('deck');
    }
    const gold=skillGoldCost(id);
    if(s.gold<gold){s.gold=gold+400;tweaks.push('gold');}
    if(s.gauge<HERO[id].skill.cost){s.gauge=HERO[id].skill.cost;tweaks.push('gauge');}
    if(s.board.filter(Boolean).length<2){
      const template=s.board.find(Boolean);
      const cell=s.board.findIndex(unit=>!unit);
      const ally=s.deck.find(hero=>hero!==id);
      if(template&&cell>=0&&ally){
        s.board[cell]={...template,uid:s.nextId++,hero:ally,rank:1,cooldown:99,windup:0,pose:0,disabled:0,cursed:false,aim:0,facing:'down',attacks:0};
        tweaks.push('ally');
      }
    }
    for(const unit of s.board)if(unit){unit.cooldown=99;unit.windup=0;}
    const result=cast(s,id);
    if(!result.ok)return {ok:false,reason:result.reason,tweaked:tweaks.join('+')||null};
    return {ok:true,tweaked:tweaks.join('+')||'recast',scene:{state:s,advance:sceneAdvance(s,id)}};
  }
}
function paintFailure(canvas,reason){
  canvas.width=720;canvas.height=780;
  const ctx=canvas.getContext('2d');
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle='#1c2430';ctx.fillRect(0,0,720,780);
  ctx.strokeStyle='#e0b15a';ctx.lineWidth=6;ctx.strokeRect(12,12,696,756);
  ctx.fillStyle='#f3e6c8';ctx.font='600 28px "Malgun Gothic",sans-serif';ctx.textAlign='center';
  ctx.fillText('시전 실패',360,360);
  ctx.font='18px "Malgun Gothic",sans-serif';
  const lines=wrap(ctx,reason||'알 수 없는 이유',560);
  lines.forEach((line,i)=>ctx.fillText(line,360,408+i*28));
}
function makeRunner(canvas,opts,id){
  const opened=openScene(id,opts);
  if(!opened.ok){paintFailure(canvas,opened.reason);return {error:opened.reason,tweaked:opened.tweaked,renderer:null,fixture:null,frames:0,time:0};}
  const renderer=new Renderer(canvas,makeArt(opts.theme||'night'));
  renderer.reduced=!!opts.reduced;
  renderer.shake=0;
  const initial=opened.scene.state.events.splice(0);
  seeded(1,()=>initial.forEach(event=>renderer.event(event)));
  return {error:null,tweaked:opened.tweaked,renderer,fixture:opened.scene,frames:0,time:0};
}
function drawFrame(runner,dt){
  if(!runner.renderer)return;
  motif.capture=motif.enabled&&runner.fixture.state.time<=1.5+1e-4;
  try{runner.renderer.draw(runner.fixture.state,dt);}
  finally{motif.capture=false;}
}
function stepRunner(runner){
  if(runner.error)return;
  const events=runner.fixture.advance(DT);
  seeded(++runner.frames,()=>events.forEach(event=>runner.renderer.event(event)));
  runner.time+=DT;
  drawFrame(runner,DT);
}
function snapshot(source){
  const copy=document.createElement('canvas');
  copy.width=source.width;copy.height=source.height;
  copy.getContext('2d').drawImage(source,0,0);
  return copy;
}
function boardVariance(canvas){
  if(!canvas||canvas.width<2)return 0;
  const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  let n=0,sum=0,sum2=0;
  const stride=Math.max(4,Math.floor(canvas.width*canvas.height/5000)*4);
  for(let i=0;i<data.length;i+=stride){
    const y=data[i]*0.2126+data[i+1]*0.7152+data[i+2]*0.0722;
    sum+=y;sum2+=y*y;n+=1;
  }
  if(!n)return 0;
  const mean=sum/n;
  return Math.sqrt(Math.max(0,sum2/n-mean*mean));
}
function simulate(id,opts,times,record){
  const canvas=document.createElement('canvas');
  try{
    const runner=makeRunner(canvas,opts,id);
    if(runner.error)return {error:runner.error,tweaked:runner.tweaked,shots:times.map(t=>({t,snap:null})),variance:0,motifs:[]};
    if(record){motif.enabled=true;motif.owner=id;motif.rows=new Map();}
    drawFrame(runner,0);
    const need=times.map(t=>({t,at:frameIndex(t),snap:null}));
    for(const item of need)if(item.at===0)item.snap=snapshot(canvas);
    const last=need.reduce((max,item)=>Math.max(max,item.at),0);
    for(let i=0;i<last;i++){
      stepRunner(runner);
      for(const item of need)if(item.at===i+1)item.snap=snapshot(canvas);
    }
    let variance=0;
    for(const item of need)variance=Math.max(variance,boardVariance(item.snap));
    motif.enabled=false;motif.owner=null;
    const motifs=record?[...motif.rows.values()].sort((a,b)=>b.maxWidth-a.maxWidth||b.calls-a.calls||a.atlas.localeCompare(b.atlas)||a.frame-b.frame):null;
    return {error:null,tweaked:runner.tweaked,shots:need,variance,motifs};
  }catch(error){
    motif.enabled=false;motif.capture=false;motif.owner=null;motifIgnore=0;
    return {error:error?.message||String(error),tweaked:null,shots:times.map(t=>({t,snap:null})),variance:0,motifs:[]};
  }finally{
    canvas.width=1;canvas.height=1;
  }
}
function wrap(ctx,text,max){
  const lines=[];let line='';
  for(const ch of String(text)){
    const next=line+ch;
    if(line&&ctx.measureText(next).width>max){lines.push(line);line=ch;}
    else line=next;
  }
  if(line)lines.push(line);
  return lines.slice(0,4);
}
function sheetWidth(count,cellW){return LABEL_W+count*(cellW+GAP)+GAP;}
function cellH(cellW){return Math.round(780*cellW/720);}
function paintLabel(ctx,id,top,height){
  const hero=HERO[id];
  ctx.fillStyle='#1a1a24';ctx.fillRect(0,top,LABEL_W,height);
  ctx.textAlign='left';ctx.textBaseline='top';
  ctx.fillStyle='#f4efe6';ctx.font='700 18px "Malgun Gothic",sans-serif';
  ctx.fillText(hero.name,12,top+12);
  ctx.fillStyle=RARITY[hero.rarity]?.color||'#e6be6c';ctx.font='700 14px "Malgun Gothic",sans-serif';
  ctx.fillText(hero.rarity,12,top+38);
  ctx.fillStyle='#f3e6c8';ctx.font='14px "Malgun Gothic",sans-serif';
  ctx.fillText(hero.skill.name,12,top+60);
  ctx.fillStyle='#b7ad9a';ctx.font='13px ui-monospace,monospace';
  ctx.fillText(hero.skill.type,12,top+82);
  ctx.fillStyle='#8d8476';ctx.font='12px ui-monospace,monospace';
  ctx.fillText(id,12,top+104);
}
function paintCells(ctx,shots,cellW,top,reason){
  const height=cellH(cellW);
  shots.forEach((shot,index)=>{
    const x=LABEL_W+GAP+index*(cellW+GAP);
    if(reason||!shot.snap){
      ctx.fillStyle='#1c2430';ctx.fillRect(x,top,cellW,height);
      ctx.strokeStyle='#e0b15a';ctx.lineWidth=3;ctx.strokeRect(x+2,top+2,cellW-4,height-4);
      ctx.fillStyle='#f3e6c8';ctx.textAlign='center';ctx.textBaseline='top';
      ctx.font='600 16px "Malgun Gothic",sans-serif';
      ctx.fillText('시전 실패',x+cellW/2,top+18);
      ctx.font='13px "Malgun Gothic",sans-serif';
      wrap(ctx,reason||'프레임 없음',cellW-24).forEach((line,i)=>ctx.fillText(line,x+cellW/2,top+46+i*18));
    }else{
      ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
      ctx.drawImage(shot.snap,x,top,cellW,height);
    }
    ctx.strokeStyle='#00000088';ctx.lineWidth=1;ctx.strokeRect(x+0.5,top+0.5,cellW-1,height-1);
  });
}
function paintHeader(ctx,width,times,cellW,title){
  ctx.fillStyle='#2a241c';ctx.fillRect(0,0,width,32);
  ctx.fillStyle='#f3e6c8';ctx.textAlign='left';ctx.textBaseline='middle';
  ctx.font='600 14px "Malgun Gothic",sans-serif';
  ctx.fillText(title,12,16);
  ctx.textAlign='center';ctx.font='13px "Malgun Gothic",sans-serif';
  times.forEach((t,index)=>{
    const x=LABEL_W+GAP+index*(cellW+GAP)+cellW/2;
    ctx.fillText(String(t)+'초',x,16);
  });
}
function rowImage(id,shots,cellW,reason){
  const height=cellH(cellW);
  const canvas=document.createElement('canvas');
  canvas.width=sheetWidth(shots.length,cellW);
  canvas.height=height+GAP;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#0c0c12';ctx.fillRect(0,0,canvas.width,canvas.height);
  paintLabel(ctx,id,0,height);
  paintCells(ctx,shots,cellW,0,reason);
  return canvas;
}
function closeImage(id,shots,reason){
  const cellW=360;
  const height=cellH(cellW);
  const width=sheetWidth(shots.length,cellW);
  const canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=32+height;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#14141c';ctx.fillRect(0,0,width,canvas.height);
  paintHeader(ctx,width,shots.map(shot=>shot.t),cellW,'필살기 · 밤 · '+HERO[id].name);
  paintLabel(ctx,id,32,height);
  paintCells(ctx,shots,cellW,32,reason);
  return canvas;
}
function png(canvas){
  const url=canvas.toDataURL('image/png');
  canvas.width=1;canvas.height=1;
  return url.slice(url.indexOf(',')+1);
}
function freeShots(shots){for(const shot of shots)if(shot.snap){shot.snap.width=1;shot.snap.height=1;}}
function headerImage(title,times,cellW){
  const canvas=document.createElement('canvas');
  canvas.width=sheetWidth(times.length,cellW);canvas.height=32;
  paintHeader(canvas.getContext('2d'),canvas.width,times,cellW,title);
  return png(canvas);
}

let config={heroA:'toffee_apple',heroB:'ash',mode:'skill',theme:'night',dense:true,reduced:false,speed:1};
let runners=[];
let time=0;
let playhead=0;
let playing=true;
let held=false;
let last=0;
let gridToken=0;

function current(){return {mode:config.mode,theme:config.theme,dense:config.dense,reduced:config.reduced,side:'left',crowded:false};}
function reset(){
  runners=[
    makeRunner($('board-a'),current(),config.heroA),
    makeRunner($('board-b'),current(),config.heroB),
  ];
  time=0;playhead=0;
  for(const runner of runners)drawFrame(runner,0);
  report();
}
function seek(target){
  if(target+1e-8<time)reset();
  while(time+DT<=target+1e-8){
    for(const runner of runners)stepRunner(runner);
    time+=DT;
  }
  report();
}
function report(){
  $('clock').textContent=time.toFixed(2)+'초';
  $('seek').value=String(time);
  $('play').textContent=playing?'일시정지':'재생';
  for(const [key,runner] of [['a',runners[0]],['b',runners[1]]]){
    const id=key==='a'?config.heroA:config.heroB;
    const hero=HERO[id];
    const what=config.mode==='skill'?`${hero.skill.name} · ${hero.skill.type}`:`기본 공격 · ${hero.attack}`;
    const note=runner?.error?` · ${runner.error}`:runner?.tweaked?` · 픽스처 ${runner.tweaked}`:'';
    $('cap-'+key).textContent=`${hero.name} · ${hero.rarity} · ${what}${note}`;
  }
}
function apply(patch,keepTime){
  const resume=keepTime?time:0;
  Object.assign(config,patch);
  $('hero-a').value=config.heroA;
  $('hero-b').value=config.heroB;
  $('mode').value=config.mode;
  $('theme').value=config.theme;
  $('speed').value=String(config.speed);
  $('dense').checked=config.dense;
  $('reduced').checked=config.reduced;
  reset();
  if(resume>0)seek(resume);
}
function raster(canvas){
  const webp=canvas.toDataURL('image/webp',0.8);
  return webp.startsWith('data:image/webp')?webp:canvas.toDataURL('image/jpeg',0.82);
}
function renderGrid(){
  motif.enabled=false;motif.capture=false;motif.owner=null;motifIgnore=0;
  const token=++gridToken;
  const host=$('grid-board');
  host.replaceChildren();
  const target=Number($('seek').value)||0;
  const status=$('grid-status');
  status.textContent='그리는 중 0/'+HEROES.length;
  return (async()=>{
    let n=0;
    for(const hero of HEROES){
      if(token!==gridToken)return {cancelled:true,n};
      const fig=document.createElement('figure');
      const img=document.createElement('img');
      const cap=document.createElement('figcaption');
      cap.textContent=`${hero.name} · ${hero.skill.name}`;
      fig.append(img,cap);host.append(fig);
      const canvas=document.createElement('canvas');
      const runner=makeRunner(canvas,current(),hero.id);
      if(runner.error)paintFailure(canvas,runner.error);
      else{
        drawFrame(runner,0);
        const steps=frameIndex(target);
        for(let i=0;i<steps;i++)stepRunner(runner);
      }
      img.src=raster(canvas);
      img.alt=`${hero.name} ${config.mode} ${target.toFixed(2)}초`;
      canvas.width=1;canvas.height=1;
      n+=1;
      status.textContent=`그리는 중 ${n}/${HEROES.length} · ${target.toFixed(2)}초`;
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    if(token===gridToken)status.textContent=`39명 · ${target.toFixed(2)}초 · ${config.mode==='skill'?'필살기':'일반 공격'} · ${config.theme}`;
    return {cancelled:false,n};
  })();
}

if(HEROES.length!==39)throw new Error('Expected 39 companions, found '+HEROES.length);
for(const hero of HEROES){
  for(const select of ['hero-a','hero-b']){
    const option=document.createElement('option');
    option.value=hero.id;
    option.textContent=`${hero.name} · ${hero.rarity}`;
    $(select).append(option);
  }
}
for(const id of ['hero-a','hero-b','mode','theme'])$(id).addEventListener('change',()=>apply({
  heroA:$('hero-a').value,heroB:$('hero-b').value,mode:$('mode').value,theme:$('theme').value,
}));
$('speed').addEventListener('change',()=>{config.speed=Number($('speed').value);report();});
$('dense').addEventListener('change',()=>apply({dense:$('dense').checked}));
$('reduced').addEventListener('change',()=>apply({reduced:$('reduced').checked}));
$('play').onclick=()=>{playing=!playing;playhead=time;report();};
$('restart').onclick=()=>{playing=true;reset();};
$('seek').oninput=()=>{playing=false;seek(Number($('seek').value));playhead=time;};
$('grid-go').onclick=()=>{renderGrid();};
apply(config);

function animate(now){
  const dt=Math.min(0.05,(now-(last||now))/1000);
  last=now;
  if(!held&&playing){
    playhead+=dt*config.speed;
    if(playhead>3){playhead=0;reset();}
    else seek(Math.min(3,playhead));
  }
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

window.ULT_SHEET={
  ready:true,
  images:Object.keys(images).length,
  heroes:HEROES.map(hero=>({id:hero.id,name:hero.name,rarity:hero.rarity,skill:hero.skill.name,type:hero.skill.type})),
  hold(on){held=!!on;if(on)playing=false;report();},
  select(patch){apply({...patch,speed:patch.speed??config.speed},false);},
  seek(t){playing=false;seek(t);playhead=time;},
  sample(){return {time,config:{...config},boards:runners.map(runner=>({error:runner.error,tweaked:runner.tweaked,variance:runner.renderer?boardVariance(runner.renderer.canvas):0,sim:runner.time}))};},
  renderGrid,
  headers(){return {ult:headerImage('필살기 · 밤 · 분산',ULT_TIMES,240),attack:headerImage('일반 공격 · 밤 · 분산',ATTACK_TIMES,240)};},
  capture(id){
    const skill=simulate(id,{...SHEET,mode:'skill'},ULT_TIMES,true);
    const attack=simulate(id,{...SHEET,mode:'attack'},ATTACK_TIMES,false);
    const ult=png(rowImage(id,skill.shots,240,skill.error));
    const close=png(closeImage(id,skill.shots,skill.error));
    const attackRow=png(rowImage(id,attack.shots,240,attack.error));
    freeShots(skill.shots);freeShots(attack.shots);
    return {id,error:skill.error,attackError:attack.error,tweaked:skill.tweaked,variance:skill.variance,attackVariance:attack.variance,motifs:skill.motifs||[],ult,attack:attackRow,close};
  },
};
