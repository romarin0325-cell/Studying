// Review tool: the pilot only supplies movement, choices, dash and skill input.
// It never alters health, the clock, spawns, rewards or combat parameters.
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {Game} from '../src/engine.js';
import {HEROES,HERO,WEAPON,STAGE,LIMITS} from '../src/content.js';

export function simulateExpedition(options={}){
  const g=new Game(options),hero=HERO[g.hero],peaks={enemies:0,shots:0,drops:0,fields:0,hazards:0};
  const limit=(STAGE[g.stage].duration+150)*60;
  for(let frame=0;frame<limit&&!['victory','defeat'].includes(g.mode);frame++){
    if(g.mode==='choice'){
      const rank=o=>o.type==='evolution'?100:o.type==='weapon'&&o.id===hero.weapon?90:o.type==='relic'&&o.id===WEAPON[hero.weapon].relic?80:o.type==='weapon'&&g.weapons.some(w=>w.id===o.id)?70:o.type==='heal'&&g.player.hp<g.player.maxHp*.6?60:0;
      let best=0;for(let i=1;i<g.options.length;i++)if(rank(g.options[i])>rank(g.options[best]))best=i;
      g.choose(best);
    }
    if(g.mode==='treasure')g.claimTreasure();
    const p=g.player,nearest=g.nearest(p.x,p.y,130);let x=0,y=0;
    if(nearest){const dx=p.x-nearest.x,dy=p.y-nearest.y,d=Math.hypot(dx,dy)||1;x=dx/d;y=dy/d;}
    else{
      let target=null,best=Infinity;for(const d of g.drops){if(!['xp','chest','heart'].includes(d.kind))continue;const distance=(d.x-p.x)**2+(d.y-p.y)**2;if(distance<best){best=distance;target=d;}}
      if(target){const dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy)||1;if(d>20){x=dx/d;y=dy/d;}}
    }
    for(const h of g.hazards){if(h.kind==='shot'||h.wait>1.2||h.hit)continue;const dx=p.x-h.x,dy=p.y-h.y,d=Math.hypot(dx,dy)||1;if(d<h.r+45){x+=dx/d*2;y+=dy/d*2;}}
    if(p.x<160)x=Math.abs(x);if(p.x>1440)x=-Math.abs(x);if(p.y<160)y=Math.abs(y);if(p.y>1440)y=-Math.abs(y);
    if(p.charge>=100)g.castSkill();if(nearest&&Math.hypot(nearest.x-p.x,nearest.y-p.y)<75)g.dash();
    g.step(1/60,{x,y});g.drainEvents();
    for(const key of Object.keys(peaks)){peaks[key]=Math.max(peaks[key],g[key].length);if(g[key].length>LIMITS[key])throw new Error('Entity budget exceeded: '+key);}
  }
  return {game:g,peaks};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const stage=process.argv[2]||'garden',seed=Number(process.argv[3]||2026);
  if(!STAGE[stage]||!Number.isSafeInteger(seed))throw new Error('Usage: node survivor/scripts/simulate.mjs [garden|cathedral|rift] [seed]');
  for(const hero of HEROES){const {game:g,peaks}=simulateExpedition({hero:hero.id,stage,seed});console.log(JSON.stringify({hero:hero.id,stage,seed,outcome:g.mode,seconds:+g.time.toFixed(1),hp:+g.player.hp.toFixed(1),kills:g.kills,level:g.level,bosses:g.bossesKilled,evolutions:g.evolutions,peaks}));}
}
