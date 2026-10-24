// Offline battle for the Lightning Sage basic-attack review. The picture is the
// production Renderer. Times are picked from the real shot clock.
import {Art, Renderer} from '../src/combat/render.js';
import * as E from '../src/combat/engine.js';
import {LIGHTNING_BOLT_WINDOW} from '../src/combat/lightning-vfx.js';

const DT=1/60;
const images={};
await Promise.all(Object.entries(window.BOLT_DATA.images).map(([id,src])=>new Promise((resolve,reject)=>{
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

function boltScene(){
  const deck=['lightning_sage','siren','zeke','queen','storm_sage'];
  const s=E.newRun({deck,chapter:0,seed:231024});
  const template={...s.board.find(Boolean)};
  s.board.fill(null);
  for(const [index,rank] of [[6,5],[7,4],[11,3],[12,2],[4,1],[9,3],[18,5],[22,1],[20,2]]){
    s.board[index]={...template,uid:s.nextId++,hero:'lightning_sage',rank,cooldown:.02,windup:0,pose:0,disabled:0,cursed:false,aim:0,facing:'down',attacks:0,birthWave:s.wave};
  }
  s.queue=[{kind:'boss',hp:1e9}];s.spawnIn=0;E.step(s,.001);
  const enemy={...s.enemies[0]};
  const positions=[826,860,910,970,300,1280,1380,1480];
  s.enemies=positions.map((progress,i)=>({...structuredClone(enemy),uid:s.nextId++,kind:i?'grunt':'boss',boss:i?null:enemy.boss,progress,speed:0,skillIn:99,hp:1e9,maxHp:1e9}));
  s.queue=[{kind:'grunt',hp:1e9}];s.spawnIn=999;s.events=[];s.time=0;
  for(const u of s.board)if(u)u.cooldown=.02;
  return s;
}

function shotCounts(state){
  let bolt=0,pending=0;
  for(const shot of state.shots){
    if(shot.hero!=='lightning_sage'||shot.life<=0)continue;
    if(shot.life<=Math.min(LIGHTNING_BOLT_WINDOW,shot.total))bolt++;
    else pending++;
  }
  return {bolt,pending};
}

function play(canvas,opts,until){
  const renderer=new Renderer(canvas,makeArt(opts.theme||'night'));
  renderer.reduced=!!opts.reduced;
  if(opts.quality)renderer.setQuality(opts.quality);
  const state=boltScene();
  state.events.splice(0).forEach(event=>renderer.event(event));
  renderer.shake=0;renderer.draw(state,0);
  const steps=Math.round(until/DT);
  const samples=[];
  for(let i=0;i<steps;i++){
    E.step(state,DT);
    state.events.splice(0).forEach(event=>renderer.event(event));
    renderer.shake=0;renderer.draw(state,DT);
    const counts=shotCounts(state);
    samples.push({
      t:Math.round(state.time*1000)/1000,
      shots:state.shots.filter(shot=>shot.hero==='lightning_sage').length,
      bolt:counts.bolt,
      pending:counts.pending,
      chains:renderer.effects.filter(effect=>effect.type==='chain'&&effect.hero==='lightning_sage'&&effect.life>0).length,
      impacts:renderer.fx.impacts.filter(effect=>effect.type==='impact'&&effect.hero==='lightning_sage'&&effect.life>0).length,
    });
  }
  return samples;
}

function pickTimes(samples){
  const fire=samples.find(sample=>sample.shots>0);
  const travel=samples.filter(sample=>sample.pending>0).sort((a,b)=>b.pending-a.pending||a.t-b.t)[0];
  const strike=samples.reduce((best,sample)=>sample.bolt>best.bolt?sample:best,samples[0]);
  const flicker=samples.find(sample=>sample.t>strike.t+.06&&sample.bolt>0)||strike;
  const impact=samples.find(sample=>sample.t>=strike.t-.02&&(sample.chains>0||sample.impacts>0));
  const fade=samples.filter(sample=>impact&&sample.t>impact.t+.1).sort((a,b)=>b.chains-a.chains||a.t-b.t)[0];
  const named=[
    ['01-fire',fire],
    ['02-travel',travel||fire],
    ['03-strike',strike],
    ['04-flicker',flicker],
    ['05-impact',impact||strike],
    ['06-fade',fade||impact||strike],
  ];
  return named.filter(([,sample])=>sample).map(([name,sample])=>({name,t:sample.t,shots:sample.shots,bolt:sample.bolt,pending:sample.pending,chains:sample.chains,impacts:sample.impacts}));
}

const scratch=document.createElement('canvas');
const samples=play(scratch,{},1.2);
const times=pickTimes(samples);
scratch.width=1;scratch.height=1;

window.BOLT={
  ready:true,
  times,
  samples,
  show(spec){
    const canvas=document.getElementById('board');
    play(canvas,spec,spec.t);
    return {t:spec.t,quality:spec.quality||'standard',reduced:!!spec.reduced,theme:spec.theme||'night'};
  },
};
