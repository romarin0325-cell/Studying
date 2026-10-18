// Shared stage-play helper for the upcoming-hero studies: the same loop as scripts/stage-sim.mjs (smart auto, greenhouse
// by stage) plus per-step tracking. Import after `node --import ./preload.mjs`, WT overridable with UP_WT.
const WT=process.env.UP_WT||new URL('../../src/',import.meta.url).href;
export const {HERO,HEROES}=await import(WT+'content.js');
export const engine=await import(WT+'combat/engine.js');
const {heroMultiplier,specialMultiplier,springGauge,seedGold}=await import(WT+'economy.js');
const {smartAutoPlay}=await import(WT+'smart-auto.js');
const {clearedRounds}=await import(WT+'battle.js');
export const DT=.05,AUTO=.32,LIMIT=900;
export const bedsFor=stage=>({rose:Math.min(45,3+stage),spring:stage>=15?Math.min(30,3*(stage-14)):0,seed:stage>=30?Math.min(20,2*(stage-29)):0});
export const metaFor=(deck,beds)=>{const entry={enhance:0};return Object.fromEntries(deck.map(id=>[id,{power:heroMultiplier(entry,beds),special:specialMultiplier(entry.enhance)}]));};
// Plays one whole main stage. Tracking: unit-seconds spent disabled, event counts, units lost to judgement, bomb blasts
// (alive enemies when each bomb went off), ultimates cast per hero, damage by hero.
export function playStage(deck,stage,seed,{beds=bedsFor(stage),mode='main',tap}={}){
  const meta=metaFor(deck,beds);
  const s=engine.newRun({deck,chapter:stage-1,seed,meta,mode,gaugeMax:springGauge(beds.spring),startGold:seedGold(beds.seed)});
  let autoIn=0,pick=false,ticks=0;const track={disabledSeconds:0,events:{},bombBlasts:[],casts:{},judged:0,cursed:0,minBoard:99};
  const castOrig=engine.cast;
  while(s.phase!=='victory'&&s.phase!=='defeat'&&ticks<LIMIT/DT){
    const before=s.phase,bombsBefore=s.bombs?.length||0,bombList=(s.bombs||[]).map(b=>({uid:b.uid,progress:b.progress,damage:b.damage})),aliveBefore=s.enemies.filter(e=>e.hp>0).length;
    engine.step(s,DT);ticks++;
    for(const u of s.board)if(u&&u.disabled>0)track.disabledSeconds+=DT;
    for(const e of s.events){track.events[e.type]=(track.events[e.type]||0)+1;if(e.type==='skill')track.casts[e.hero]=(track.casts[e.hero]||0)+1;if(e.type==='judgement'&&e.hit)track.judged++;if(e.type==='curse')track.cursed++;}
    if((s.bombs?.length||0)<bombsBefore){const left=new Set((s.bombs||[]).map(b=>b.uid));for(const b of bombList)if(!left.has(b.uid))track.bombBlasts.push({wave:s.wave,alive:aliveBefore,time:s.time,pct:b.progress/engine.PATH_LENGTH,damage:b.damage,potential:aliveBefore*b.damage});}
    if(tap)tap(s,track);
    track.minBoard=Math.min(track.minBoard,s.board.filter(Boolean).length);
    s.events.length=0;
    if(pick){smartAutoPlay(s);autoIn=0;pick=false;}
    else if(before!=='reward'&&s.phase==='reward')pick=true;
    else if(s.phase==='combat'||s.phase==='intermission'){autoIn+=DT;if(autoIn>=AUTO){smartAutoPlay(s);autoIn=0;}}
  }
  return {won:s.phase==='victory',health:s.health,rounds:clearedRounds(s),time:ticks*DT,damage:s.stats.damage,byHero:{...s.stats.byHero},sacrificed:s.stats.sacrificed||0,skills:s.stats.skills,track};
}
export const mean=(rows,f)=>rows.reduce((n,r)=>n+f(r),0)/Math.max(1,rows.length);
