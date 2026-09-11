import { Game } from '../engine.js';
import { HEROES } from '../content.js';
import fs from 'node:fs/promises';
// A conservative deterministic autopilot is a balance probe, not a claim about human difficulty.
export function pilot(g) {
  if (g.phase === 'quiz') { g.completeQuiz(g.player.lives < g.maxLife ? 'life' : 'bomb'); return; }
  if (!['wave', 'boss'].includes(g.phase)) return;
  const p = g.player, target = g.boss?.hp > 0 ? g.boss : g.nearest(p.x, p.y);
  let best = null, bestCost = Infinity;
  const goalY = g.weapon === 'melee' && target ? Math.min(g.height * .75, target.y + 115) : g.height * .68;
  for (let x = 35; x <= 415; x += 25) for (const y of [goalY - 35, goalY, goalY + 45]) {
    if (y < 130) continue;
    let cost = Math.hypot(x - p.x, y - p.y) * .09;
    if (target) cost += Math.abs(x - target.x) * (['laser', 'lance', 'dagger', 'melee', 'spread', 'petal','frost','glass'].includes(g.weapon) ? .16 : .025);
    for (const b of g.bullets) {
      for (const t of [0, .22, .48]) { const d = Math.hypot(x - b.x - b.vx * t, y - b.y - b.vy * t); cost += d < 70 ? (70 - d) ** 2 * .018 : 0; }
    }
    for (const e of g.enemies) { const d = Math.hypot(e.x - x, e.y - y); if (d < e.r + 40) cost += 400; }
    for (const h of g.hazards) if (Math.abs(x - h.x) < h.width / 2 + 30) cost += 700;
    for (const d of g.pickups) if (d.type !== 'score') cost -= Math.max(0, 100 - Math.hypot(d.x - x, d.y - y)) * .12;
    if (cost < bestCost) { bestCost = cost; best = { x, y }; }
  }
  if (best) g.move(best.x, best.y);
  if (g.bombs && !g.bombTime && (bestCost > 170 || p.lives <= 2 && g.phase === 'boss')) g.bomb();
}
if (process.argv[1]?.endsWith('balance.mjs')) {
  const report=[];
  for(const mode of ['easy','normal','hard']) for(let stage=0;stage<4;stage++) for (let h = 0; h < 6; h++) for (let w = 0; w < 2; w++) {
    const g = new Game({ hero: h, weapon: w, stage,mode,seed: 92,artifacts:['spellbook','frozen','crystal'] });
    for (let i = 0; i < 60 * 540 && !g.finished; i++) { if (i % 6 === 0) pilot(g); g.update(1 / 60); }
    report.push({hero:HEROES[h].name,weapon:g.weapon,mode,stage,phase:g.phase,lives:g.player.lives,time:Math.round(g.totalTime),maxBullets:g.stats.maxBullets});
  }
  await fs.mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});await fs.writeFile(new URL('../artifacts/balance.json',import.meta.url),JSON.stringify(report,null,2));
  console.log(JSON.stringify({runs:report.length,wins:report.filter(r=>r.phase==='victory').length,stalled:report.filter(r=>!['victory','defeat'].includes(r.phase)),byDifficulty:['easy','normal','hard'].map(mode=>({mode,wins:report.filter(r=>r.mode===mode&&r.phase==='victory').length,total:48})),defeats:report.filter(r=>r.phase==='defeat')},null,2));
}
