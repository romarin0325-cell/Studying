import {HERO} from '../content.js';
import {cellPoint,pathPoint} from './engine.js';
import {CombatFX} from './effects.js';
import {UR_SPECS,urReady,DREAM,dreamReady} from './ur-vfx.js';

// Recolour offscreen in small, cancellable idle jobs; only the finished cache is shared with the renderer.
function* warmFrames(renderer,id,deck){
  const spec=UR_SPECS[id];if(!spec||!urReady(renderer.fx,id)||typeof document==='undefined')return;
  const canvas=document.createElement('canvas');canvas.width=720;canvas.height=780;const ctx=canvas.getContext('2d');if(!ctx)return;
  const fx=new CombatFX(ctx,renderer.art);fx.urCache=renderer.fx.urCache||(renderer.fx.urCache=new Map());fx.palette=renderer.fx.palette;
  const cells=[12,6,8,16,18],board=Array(25).fill(null),roster=id==='time_magician'?cells.map(()=>id):[id,...deck.filter(h=>h!==id&&HERO[h])],allies=cells.map((i,n)=>{const hero=roster[n%roster.length],u={uid:-101-n,hero,rank:3,facing:'down'};board[i]=u;return {...cellPoint(i),uid:u.uid,hero,index:i};});
  const targets=[180,640,1160,1700,2050].map((p,i)=>({...pathPoint(p),uid:-1-i,p0:p,execute:i%2===0,hit:true,harvest:3}));
  fx.s={board,buffs:{winter:5,trauma:5},buffTotals:{winter:10,trauma:10},finishers:[],buffSpotlight:{}};
  for(const q of targets)fx.enemies.set(q.uid,{point:q,enemy:{uid:q.uid,boss:null,hp:1000,maxHp:1000},hp:1000});
  const kind=HERO[id].skill.type,locked=['royal','starfall','mirror'].includes(kind);
  for(const variant of id==='cherry_prince'?[0,1]:[0]){
    const ordered=variant?[targets[1],targets[0],...targets.slice(2)]:targets,skill={type:'skill',uid:-1,hero:id,kind:HERO[id].skill.type,rank:3,origin:cellPoint(12),targets:id==='harmonious'||id==='time_magician'?allies:ordered,support:[],allies,freed:allies.slice(0,1),struck:targets,well:1160,tax:20,edict:1};
    try{spec.plan(fx,skill);}catch{continue;}
    // One finisher object for the whole run, as the engine keeps it (the mirror tracks its own fill on it).
    const finisher=locked?{uid:-50,hero:id,kind,origin:skill.origin,target:ordered[0].uid,to:ordered[0],life:1,total:1,stored:0,ratio:.5,damage:100}:null;
    let life;try{life=spec.life(skill);}catch{continue;}if(!Number.isFinite(life)||life<0)continue;skill.total=life;const blessings=id==='jasmine'?skill.ur?.allies:null;
    for(let frame=0;frame<=Math.ceil(life*10);frame++){
      const age=Math.min(life,frame/10);skill.life=life-age;fx.clock=age;
      // Stagger ally ghosts so one idle slice does not create the whole deck at once.
      if(blessings?.length)skill.ur.allies=[blessings[frame%blessings.length]];
      // Delayed strikes (royal cut, falling star, mirror) read the engine's finisher; the mirror also fills as damage comes in.
      if(finisher){finisher.life=Math.max(.01,1-age);finisher.stored=40*frame;fx.s.finishers=age<.7?[finisher]:[];}
      if(frame===7&&spec.finisher)try{spec.finisher(fx,skill,{type:'finisherImpact',kind:'royal',x:ordered[0].x,y:ordered[0].y,targetBoss:false,empowered:!!variant});}catch{}
      if(frame>=7&&spec.impact)try{spec.impact(fx,{type:'urFx',hit:frame<14,x:ordered[0].x,y:ordered[0].y,targetBoss:false,total:spec.impactLife||.6},Math.min(1,(frame-7)/7));}catch{}
      for(const name of ['field','over','body'])if(spec[name])try{spec[name](fx,skill,age);}catch{}
      if(spec.unitBody)for(const u of board)if(u)try{spec.unitBody(fx,skill,age,u);}catch{}
      for(const name of ['persistent','persistentOver'])if(spec[name])try{spec[name](fx,fx.s,[]);}catch{}
      yield;
    }
  }
  // Behemoth's three blows land on the engine's crushPhase events: draw each blow, the finale too, across its life.
  if(id==='behemoth'&&UR_SPECS.behemoth.strike){const from=cellPoint(12);
    for(let phase=0;phase<3;phase++)for(let frame=0;frame<=10;frame++){fx.clock=frame/10;try{UR_SPECS.behemoth.strike(fx,{type:'urFx',phase,x:targets[phase].x,y:targets[phase].y,radius:126,seed:phase+1,from,prev:targets.slice(0,phase).map(q=>({x:q.x,y:q.y,radius:126})),total:phase===2?1.6:1},frame/10);}catch{}yield;}
    fx.crushHits=[null,null,{at:0}];for(let frame=0;frame<=8;frame++){fx.clock=frame/5;try{UR_SPECS.behemoth.field(fx,{origin:from,ur:{seed:1}},1);}catch{}yield;}}
  // Rumi's dream form (5 stars) runs from effects.js on the engine's four volleys: rise every symbol and land every strike once.
  if(id==='rumi'&&dreamReady(renderer.fx)){
    const at=[.45,1,1.55,2.3],dream={type:'skill',uid:-2,hero:id,kind:'dream',origin:cellPoint(12),targets:[],total:2.9,life:2.9};DREAM.start(fx);
    for(let frame=0;frame<=29;frame++){const age=frame/10;dream.life=2.9-age;fx.clock=age;fx.s.volleys=at.map((t,phase)=>({kind:'dream',hero:id,phase,life:t-age})).filter(v=>v.life>0);
      for(const [phase,t] of at.entries())if(age>=t&&age-t<.1)try{DREAM.strike(fx,{type:'dreamPhase',phase,targets})}catch{}
      try{DREAM.field(fx,dream,age);DREAM.over(fx,dream,age);fx.draw(.1);}catch{}
      yield;}
  }
}
// Each slice gets its own temporary RNG, so yielding never changes the game's random stream.
function warmStep(job){const random=Math.random;Math.random=()=>.5;try{return job.next();}finally{Math.random=random;}}
export function warmHero(renderer,id,deck=[id]){
  const job=warmFrames(renderer,id,deck);while(!warmStep(job).done){}
}

export function warmUltimates(renderer,deck,isCurrent=()=>true){
  const ids=[...new Set(deck)].filter(id=>urReady(renderer.fx,id));if(!ids.length)return;let job=null;
  const idle=cb=>typeof requestIdleCallback==='function'?requestIdleCallback(cb,{timeout:1200}):setTimeout(cb,16);
  const next=deadline=>{if(!isCurrent())return;if(!job){if(!ids.length)return;job=warmFrames(renderer,ids.shift(),deck);}const start=performance.now();let done=false;
    do{try{done=warmStep(job).done;}catch{done=true;}}while(!done&&performance.now()-start<8&&(!deadline?.timeRemaining||deadline.timeRemaining()>1));
    if(done)job=null;if(job||ids.length)idle(next);};idle(next);
}
