import {Art, Renderer} from '../src/combat/render.js';
import {Sound} from '../src/combat/audio.js';
import {Renderer as BeforeRenderer} from 'vfx-before:combat/render.js';
import {Sound as BeforeSound} from 'vfx-before:combat/audio.js';
import {HERO} from '../src/content.js';
import {activeSkill, cellPoint, combatStats} from '../src/combat/engine.js';
import {isPilotSkill} from '../src/combat/pilot-vfx.js';
import {REVIEW_HEROES, REVIEW_SCENES, REVIEW_STEP, recordPilotScene} from './pilot-review-scenes.mjs';

const $ = id=>document.getElementById(id);
const FRAME = 1/60;
const HISTORY_FRAMES = 120; // These three scenes' transient canvas effects live at most 1.6 s.
const PANES = [...document.querySelectorAll('.pane')].map((element,i)=>({
  name:i?'after':'before', stage:element.querySelector('.battle-stage'),
  canvas:element.querySelector('canvas'), guide:element.querySelector('.guide'),
  Renderer:i?Renderer:BeforeRenderer, Sound:i?Sound:BeforeSound,
}));
const data = window.VFX_PILOT_DATA;

let art, tape, film, index=0, playing=false, raf=0, last=0, elapsed=0, seekRaf=0;
let hero=REVIEW_HEROES[0];
const number=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:0});

function label(e, scene) {
  if (e.type==='warning' && scene.id==='breath-crowd') return ['warning','위험 예고'];
  if (e.type==='summon' && scene.hero==='siren') return ['join','동료 합류'];
  if (e.hero!==scene.hero) return null;
  if (e.type==='attack' && scene.basic) return ['attack','발사'];
  if (e.type==='targetLock') return ['lock','대상 잠금'];
  if (e.type==='skill') {
    if (e.blast) return ['cast','착탄 · '+e.targets.length+'명'];
    return ['cast',e.kind==='haste'?'지원 시작':'시전'];
  }
  if (e.type==='impact' && scene.basic) return ['impact','적중 · '+e.hitTargets.length+'명'];
  if (e.type==='finisherImpact') return ['impact',e.enhanced?'강화 적중':'적중'];
  if (e.type==='finisherFizzle') return ['fizzle','표적 소실'];
  return null;
}

function editFilm() {
  const speed=Number($('speed').value), withCutin=$('cutin').checked, reduced=$('reduced').checked;
  const frames=[{tick:0,events:[],cutin:null,guide:null}];
  const marks=new Map();
  let tick=0, accumulator=0, slow=0, cutin=null, guide=null;
  while (tick<tape.frames.length-1) {
    const frame=frames.length, events=[];
    accumulator+=FRAME*speed*(slow>0?.3:1);
    slow=Math.max(0,slow-FRAME);
    const oldTick=tick;
    while (accumulator+1e-9>=REVIEW_STEP && tick<tape.frames.length-1) {
      events.push(...tape.frames[++tick].events);
      accumulator-=REVIEW_STEP;
    }
    for (const e of events) {
      const mark=label(e,tape.scene);
      if (mark && !marks.has(mark[0])) marks.set(mark[0],{frame,label:mark[1]});
      if (e.hero===hero && (e.blast || e.hitTargets || e.type==='finisherImpact' || e.type==='finisherFizzle')) {
        guide={event:e,frame};
      }
      if (withCutin && e.type==='skill') {
        const h=HERO[e.hero], ur=h.rarity==='UR'||h.hidden;
        cutin={event:e,frame,duration:reduced?700:ur?1600:1100};
        if (ur&&!reduced) slow=.5;
      }
    }
    const previous=tape.frames[oldTick].state.buffs.haste||0, current=tape.frames[tick].state.buffs.haste||0;
    if (previous>0 && current<=0) marks.set('end',{frame,label:'지원 종료'});
    if (cutin && (frame-cutin.frame)*FRAME*1000>=cutin.duration) cutin=null;
    if (guide && frame-guide.frame>46) guide=null;
    frames.push({tick,events,cutin,guide});
  }
  return {frames,marks:[...marks.values()]};
}

function syncCutin(pane, cutin, i) {
  if (pane.cutinKey !== cutin?.frame) {
    pane.cutin?.remove();
    pane.cutin=null;
    pane.cutinKey=cutin?.frame;
    if (cutin) {
      const e=cutin.event, h=HERO[e.hero], ur=h.rarity==='UR'||h.hidden;
      const div=document.createElement('div');
      div.className='cutin';
      div.setAttribute('aria-hidden','true');
      div.dataset.rarity=ur?'UR':h.rarity;
      div.dataset.reduced=String($('reduced').checked);
      if (pane.name==='after' && isPilotSkill(e)) div.dataset.layout='footer';
      div.style.setProperty('--c',h.color);
      div.innerHTML='<div class="cutin-band"><span class="cutin-lines"></span><span class="cutin-art"><img alt=""></span><span class="cutin-text"><small></small><b></b></span></div>';
      div.querySelector('img').src=data.figures[e.hero];
      div.querySelector('small').textContent=(ur?'ULTIMATE':'필살기')+' · '+h.name;
      div.querySelector('b').textContent=e.name||h.skill.name;
      pane.stage.append(div);
      pane.cutin=div;
      pane.animations=div.getAnimations({subtree:true});
      for (const anim of pane.animations) anim.pause();
    }
  }
  if (pane.cutin && cutin) {
    const ms=(i-cutin.frame)*FRAME*1000;
    for (const anim of pane.animations) anim.currentTime=ms;
  }
}

function seeded(seed, run) {
  const previous=Math.random;
  Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  try { run(); } finally { Math.random=previous; }
}

function renderFrame(i, dt, audible=false) {
  const {tick,events}=film.frames[i], s=tape.frames[tick].state;
  for (const pane of PANES) {
    seeded(i*417+171,()=>{for (const event of events) pane.renderer.event(event);});
    pane.renderer.draw(s,dt);
    if (audible && $('sound').value===pane.name && pane.sound?.ctx?.state==='running') {
      for (const event of events) pane.sound.event(event);
    }
  }
}

function circle(ctx,x,y,r,stroke,fill=false) {
  ctx.beginPath();
  ctx.arc(x,y,r,0,2*Math.PI);
  ctx.strokeStyle='#142b3a';
  ctx.lineWidth=5.5;
  ctx.stroke();
  ctx.strokeStyle=stroke;
  ctx.lineWidth=2.3;
  ctx.stroke();
  if (fill) {ctx.fillStyle=stroke;ctx.fill();}
}

function supports(s) {
  if (!activeSkill(s,'siren')) return [];
  return s.board.flatMap((u,i)=>u&&combatStats(s,u,i).sirenHaste?[{...cellPoint(i),focus:u.uid===s.buffSpotlight?.haste}]:[]);
}

function drawGuide(pane, guide, support) {
  pane.guide.hidden=!$('guide').checked;
  if (pane.guide.hidden) return;
  const ctx=pane.guide.getContext('2d'), e=guide?.event;
  ctx.clearRect(0,0,720,780);
  if (e) {
    const ring=e.blast || (e.radius?e:null);
    if (ring) {
      ctx.setLineDash([8,6]);
      circle(ctx,ring.x,ring.y,ring.radius,'#b8f5ee');
      ctx.setLineDash([]);
    }
    const targets=e.blast?e.targets:e.hitTargets || (e.type==='finisherImpact'?[e]:[]);
    for (const p of targets) circle(ctx,p.x,p.y,5,p.enhanced?'#ffe88d':'#d4fff4',true);
  }
  for (const p of support) circle(ctx,p.x-31,p.y+25,17,p.focus?'#ffe08a':'#b8f5ee');
}

function syncUi() {
  const frame=film.frames[index], s=tape.frames[frame.tick].state;
  const support=hero==='siren'?supports(s):[];
  $('seek').value=String(index);
  $('time').textContent=s.time.toFixed(2)+'초';
  $('time').title='전투 시간';
  $('play').textContent=playing?'일시정지':'재생';
  $('prev').disabled=index===0;
  $('next').disabled=index===film.frames.length-1;
  const amount=number.format(s.stats.byHero[hero]||0);
  let info=HERO[hero].name+' 누적 피해 '+amount+'  ·  전장 처치 '+s.stats.kills+'  ·  별빛 '+Math.floor(s.gauge);
  if (support.length) info+='  ·  가속 '+support.length+'기 / '+(s.buffs.haste||0).toFixed(1)+'초';
  if ($('metrics').textContent!==info) $('metrics').textContent=info;
  for (const button of $('marks').children) button.dataset.current=String(Math.abs(index-Number(button.value))<=3);
  for (const pane of PANES) {
    syncCutin(pane,frame.cutin,index);
    drawGuide(pane,frame.guide,support);
  }
}

function createRenderers(from) {
  const viewArt=Object.create(Art.prototype);
  viewArt.images=$('theme').value==='bright'?{...art.images,garden:art.bright}:art.images;
  for (const pane of PANES) {
    pane.renderer=new pane.Renderer(pane.canvas,viewArt);
    pane.renderer.reduced=$('reduced').checked;
    pane.renderer.clock=Math.max(0,(from-1)*FRAME);
    pane.renderer.fx.clock=pane.renderer.clock;
  }
}

function seek(frame) {
  index=Math.min(film.frames.length-1,Math.max(0,frame));
  const from=Math.max(0,index-HISTORY_FRAMES);
  createRenderers(from);
  for (let i=from;i<=index;i++) renderFrame(i,i===0?0:FRAME);
  syncUi();
}

function activateSound() {
  for (const pane of PANES) {
    if (pane.name===$('sound').value) {
      if (!pane.sound) {
        pane.sound=new pane.Sound();
        pane.sound.music=false;
      }
      pane.sound.unlock();
    } else closeSound(pane);
  }
}

function closeSound(pane) {
  if (!pane.sound) return;
  clearInterval(pane.sound.timer);
  pane.sound.ctx?.close().catch(()=>{});
  pane.sound=null;
}

function pause() {
  cancelAnimationFrame(raf);
  cancelAnimationFrame(seekRaf);
  playing=false;
  last=0;
  elapsed=0;
  for (const pane of PANES) closeSound(pane);
}

function update(now) {
  if (!playing) return;
  if (last) elapsed+=Math.min(.06,(now-last)/1000);
  last=now;
  while (elapsed+1e-9>=FRAME && index<film.frames.length-1) {
    elapsed-=FRAME;
    renderFrame(++index,FRAME,true);
  }
  if (index===film.frames.length-1) pause();
  syncUi();
  if (playing) raf=requestAnimationFrame(update);
}

function play() {
  if (index===film.frames.length-1) seek(0);
  activateSound();
  playing=true;
  syncUi();
  raf=requestAnimationFrame(update);
}

function rebuildFilm(preserve=false) {
  const tick=preserve?film.frames[index].tick:0;
  pause();
  film=editFilm();
  $('seek').max=String(film.frames.length-1);
  const buttons=film.marks.map(mark=>{
    const button=document.createElement('button');
    button.type='button';
    button.textContent=mark.label;
    button.value=String(mark.frame);
    button.addEventListener('click',()=>{pause();seek(mark.frame);});
    return button;
  });
  $('marks').replaceChildren(...buttons);
  for (const pane of PANES) pane.cutinKey=null;
  const initial=film.marks.find(m=>/적중|착탄|지원 시작|표적 소실/.test(m.label))?.frame || 0;
  const frame=preserve?film.frames.findIndex(f=>f.tick>=tick):initial+3;
  seek(frame);
}

function chooseScene() {
  tape=recordPilotScene($('scene').value);
  $('scene-details').textContent=tape.scene.detail;
  rebuildFilm();
}

function chooseHero(id) {
  hero=id;
  for (const button of $('heroes').children) button.setAttribute('aria-pressed',String(button.value===hero));
  $('scene').replaceChildren(...REVIEW_SCENES.filter(s=>s.hero===id).map(s=>new Option(s.name,s.id)));
  chooseScene();
}

function bind() {
  $('scene').addEventListener('change',chooseScene);
  $('theme').addEventListener('change',()=>{pause();seek(index);});
  for (const id of ['speed','cutin','reduced']) $(id).addEventListener('change',()=>rebuildFilm(true));
  $('guide').addEventListener('change',syncUi);
  $('sound').addEventListener('change',activateSound);
  $('play').addEventListener('click',()=>{if (playing){pause();syncUi();}else play();});
  $('restart').addEventListener('click',()=>{pause();seek(0);play();});
  $('prev').addEventListener('click',()=>{pause();seek(index-1);});
  $('next').addEventListener('click',()=>{pause();seek(index+1);});
  $('seek').addEventListener('input',()=>{
    const frame=Number($('seek').value);
    pause();
    seekRaf=requestAnimationFrame(()=>seek(frame));
  });
  for (const button of document.querySelectorAll('.mobile-views button')) {
    button.addEventListener('click',()=>{
      $('arenas').dataset.view=button.dataset.view;
      for (const b of button.parentElement.children) b.setAttribute('aria-pressed',String(b===button));
    });
  }
  document.addEventListener('visibilitychange',()=>{if (document.hidden && playing){pause();syncUi();}});
}

async function decode(url) {
  const img=new Image();
  img.src=url;
  await img.decode();
  return img;
}

async function init() {
  const entries=await Promise.all(Object.entries(data.images).map(async ([id,url])=>[id,await decode(url)]));
  art={images:Object.fromEntries(entries),bright:await decode(data.bright)};
  $('revision').textContent='기준 '+data.ref;
  for (const id of REVIEW_HEROES) {
    const button=document.createElement('button'), img=document.createElement('img');
    button.type='button';
    button.value=id;
    img.src=data.portraits[id];
    img.alt='';
    button.append(img,document.createTextNode(HERO[id].name));
    button.addEventListener('click',()=>chooseHero(id));
    $('heroes').append(button);
  }
  bind();
  $('viewer').hidden=false;
  chooseHero(hero);
  $('status').hidden=true;
}
init().catch(error=>{$('status').textContent='장면을 열지 못했습니다. '+error.message;console.error(error);});
