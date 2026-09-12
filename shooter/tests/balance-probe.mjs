import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import {Game} from '../engine.js';
import {HEROES} from '../content.js';
const dir=new URL('../artifacts/baseline/',import.meta.url);
await fs.mkdir(dir,{recursive:true});
for(const name of ['engine.js','content.js','meta.js'])await fs.writeFile(new URL(name,dir),execFileSync('git',['show',`59b6782:shooter/${name}`]));
const {Game:Before}=await import(new URL('engine.js',dir));
function probe(Class,hero,weapon){
  const g=new Class({hero,weapon,mode:'normal'});g.phase='boss';g.power=3;g.player.x=g.player.targetX=225;g.player.y=g.player.targetY=400;
  g.spawnEnemy(225,hero===1&&weapon===1?320:200,{hp:1e9,r:38,speed:0,fire:999,image:0});
  for(let n=0;n<60*15;n++)g.update(1/60);
  return g.stats.damage/15;
}
const rows=HEROES.flatMap((h,i)=>h.weapons.map((w,j)=>{const before=i<6?probe(Before,i,j):null,after=probe(Game,i,j);return {hero:h.id,weapon:w.id,before,after,ratio:before?after/before:null};}));
console.table(rows);await fs.writeFile(new URL('../artifacts/dps.json',import.meta.url),JSON.stringify(rows,null,2));
