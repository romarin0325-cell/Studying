// Small deterministic presentation fixture. Both comparison columns receive the
// same real engine state/events; only the renderer and unit textures differ.
import * as E from '../src/combat/engine.js';
export function reviewScene(id,{mode='attack',dense=true,crowded=false,side='left',chapter=0}={}){
  const deck=[id,'zeke','queen','siren','storm_sage'];
  const s=E.newRun({deck,chapter,seed:231023});
  const template={...s.board.find(Boolean)};s.board.fill(null);
  for(const [i,hero,rank] of [[12,id,3],[6,'siren',1],[17,'zeke',1],[19,'queen',1]])s.board[i]={...template,uid:s.nextId++,hero,rank,cooldown:99,windup:0,pose:0,disabled:0,cursed:false,aim:0,facing:'down'};
  if(crowded)for(let i=0;i<25;i++)if(i!==12)s.board[i]={...s.board[12],uid:s.nextId++,rank:1,cooldown:mode==='attack'?0:99};
  s.queue=[{kind:'boss',hp:1e7}];s.spawnIn=0;E.step(s,.001);
  const enemy={...s.enemies[0]};
  const positions=dense?[310,620,780,940,1140,1330,1740,1900]:side==='left'?[1740,1790,1840]:[700,750,800];
  s.enemies=positions.map((progress,i)=>({...structuredClone(enemy),uid:s.nextId++,kind:i?'grunt':'boss',boss:i?null:enemy.boss,progress,speed:0,skillIn:99,hp:1e7,maxHp:1e7}));
  s.queue=[{kind:'grunt',hp:1e7}];s.spawnIn=999;s.events=[];s.time=0;s.sunlight=3;s.gauge=120;s.gold=300;
  if(mode==='attack')s.board[12].cooldown=0;
  if(mode==='skill'){
    if(id==='cure_master'){s.board[6].disabled=3;s.board[19].cursed=true;}
    if(id==='antropy')for(const e of s.enemies){e.poison=3;e.poisonTime=5;e.burn=5;e.burnTime=5;}
    if(id==='toffee_apple'){
      // The real mine cannot wait when a leading enemy is already beyond the
      // placement cap. Keep the initial pack earlier on the route instead.
      s.enemies.forEach((e,i)=>e.progress=190+i*145);
    }
    const result=E.cast(s,id);if(!result.ok)throw Error(result.reason);
  }
  return {state:s,advance(dt){
    // Controlled demonstration: after showing the stored mine, approach it with
    // one enemy. Detonation still uses the real engine's distance/trigger test.
    if(mode==='skill'&&id==='toffee_apple'&&s.bombs.length&&s.time>=1.35){s.enemies[0].progress=s.bombs[0].progress-70;}
    E.step(s,dt);return s.events.splice(0);
  }};
}
