// Review tool: the pilot only supplies movement, choices, dash and skill input.
// It never alters health, the clock, spawns, rewards or combat parameters.
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {Game} from '../src/engine.js';
import {HEROES,HERO,WEAPON,STAGE,LIMITS} from '../src/content.js';
import {groundDanger} from '../src/ordeal.js';

export function simulateExpedition(options={}){
  const g=new Game(options),hero=HERO[g.hero],peaks={enemies:0,shots:0,drops:0,fields:0,hazards:0};
  const limit=(options.maxSeconds??(STAGE[g.stage].duration+150))*60;if(!Number.isFinite(limit)||limit<60||limit>3600*60)throw new Error('Invalid review duration');
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
    // Read the same visible shapes a player reads: stepping into a donut's safe
    // center is useful, while treating it as a filled circle is not. The pilot
    // still supplies only input and never changes the game or its clock.
    let bestMove={x,y},bestCost=Infinity,danger=false;
    for(let i=0;i<16;i++){
      const a=i*Math.PI/8,cx=Math.cos(a),cy=Math.sin(a),px=p.x+cx*75,py=p.y+cy*75;
      let cost=-(cx*x+cy*y)*2;
      if(px<65||px>1535||py<65||py>1535)cost+=30;
      for(const h of g.hazards){
        if(h.hit||h.wait>1||h.life<.1)continue;
        if(h.kind==='shot'){const t=Math.max(0,.4-h.wait),sx=h.x+h.vx*t,sy=h.y+h.vy*t;if(Math.hypot(px-sx,py-30-sy)<30)cost+=20;continue;}
        if(groundDanger(h,p.x,p.y,12)&&h.wait<.25)danger=true;
        if(groundDanger(h,px,py,15))cost+=h.wait>.4?8:25;
      }
      for(const e of g.enemies)if(e.hp>0&&Math.hypot(px-e.x,py-e.y)<e.radius+22)cost+=e.boss?12:4;
      if(cost<bestCost){bestCost=cost;bestMove={x:cx,y:cy};}
    }
    if(g.hazards.some(h=>!h.hit&&h.wait<1))({x,y}=bestMove);
    if(p.x<160)x=Math.abs(x);if(p.x>1440)x=-Math.abs(x);if(p.y<160)y=Math.abs(y);if(p.y>1440)y=-Math.abs(y);
    if(p.charge>=100)g.castSkill();const shouldDash=danger||nearest&&Math.hypot(nearest.x-p.x,nearest.y-p.y)<75;
    g.step(1/60,{x,y});if(shouldDash)g.dash();g.drainEvents();
    for(const key of Object.keys(peaks)){peaks[key]=Math.max(peaks[key],g[key].length);if(g[key].length>LIMITS[key])throw new Error('Entity budget exceeded: '+key);}
  }
  return {game:g,peaks};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const stage=process.argv[2]||'garden',seed=Number(process.argv[3]||2026);
  if(!STAGE[stage]||!Number.isSafeInteger(seed))throw new Error('Usage: node survivor/scripts/simulate.mjs [garden|cathedral|rift] [seed]');
  for(const hero of HEROES){const {game:g,peaks}=simulateExpedition({hero:hero.id,stage,seed});console.log(JSON.stringify({hero:hero.id,stage,seed,outcome:g.mode,seconds:+g.time.toFixed(1),hp:+g.player.hp.toFixed(1),kills:g.kills,level:g.level,bosses:g.bossesKilled,evolutions:g.evolutions,peaks}));}
}
