import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {HEROES,HERO,ARTIFACTS,BLESSINGS,CHAPTERS,BOSSES,DEFAULT_DECK,ASSET_MANIFEST} from '../defense/merge/content.js';
import {validateDirections} from './validate_defense_directions.mjs';

export async function verifyConfluence(){
  const root=new URL('../defense/',import.meta.url),runtime=new URL('merge/',root),files=(await readdir(runtime)).filter(f=>f.endsWith('.js'));
  for(const file of files){const result=spawnSync(process.execPath,['--check',fileURLToPath(new URL(file,runtime))],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);}
  assert.ok(!(await readFile(new URL('engine.js',runtime),'utf8')).includes('Math.random('),'combat randomness must be seeded');
  assert.equal(new Set(HEROES.map(h=>h.id)).size,30);assert.equal(new Set(DEFAULT_DECK).size,6);assert.ok(DEFAULT_DECK.every(id=>HERO[id]));
  assert.equal(ARTIFACTS.length,24);assert.equal(BLESSINGS.length,6);assert.equal(CHAPTERS.length,7);assert.equal(Object.keys(BOSSES).length,9);
  for(const h of HEROES){assert.ok(h.damage>0&&h.interval>0&&h.range>0);assert.ok(h.skill.cost>0&&h.skill.cost<=100);assert.ok(h.trait.text&&h.skill.text);}
  const html=await readFile(new URL('index.html',root),'utf8');assert.match(html,/\.\/merge\/main\.js/);assert.match(html,/\.\/merge\/style\.css/);assert.doesNotMatch(html,/src=["']https?:/);
  for(const a of ASSET_MANIFEST)assert.ok((await readFile(new URL(a.path,root))).length>0);
  const art=await validateDirections();console.log(`ASTRA static validation OK: ${files.length} modules, ${art.heroes} heroes, ${art.directions} authored directions, ${art.releaseAssets} embedded assets.`);
}
