import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {gameRoot,assetFile} from '../scripts/local-inputs.mjs';
import {ASSET_PATHS} from '../src/content.js';

async function filesIn(directory){
  const files=[];
  for(const entry of await fs.readdir(directory,{withFileTypes:true})){
    const file=path.join(directory,entry.name);
    if(entry.isDirectory())files.push(...await filesIn(file));
    else if(/\.(?:js|mjs)$/.test(file))files.push(file);
  }
  return files;
}

test('runtime, build, report and test modules only import this game or locked packages',async()=>{
  for(const directory of ['src','scripts','tests'])for(const file of await filesIn(path.join(gameRoot,directory))){
    const code=await fs.readFile(file,'utf8');
    const imports=[...code.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(['"])([^'"]+)\1/g)];
    for(const [, ,specifier] of imports){
      if(!specifier.startsWith('.'))continue;
      const relative=path.relative(gameRoot,path.resolve(path.dirname(file),specifier));
      assert.ok(relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative),file+' -> '+specifier);
    }
  }
});

test('every texture, font and font license resolves inside the independently owned assets folder',async()=>{
  const assetRoot=path.join(gameRoot,'assets');
  for(const relative of [...Object.values(ASSET_PATHS),'./assets/Jua-Regular.ttf','./assets/Jua-OFL.txt']){
    const real=await fs.realpath(assetFile(relative)),inside=path.relative(assetRoot,real);
    assert.ok(inside&&!inside.startsWith('..')&&!path.isAbsolute(inside),relative);
  }
  assert.throws(()=>assetFile('../outside.webp'),/inside defense_test\/assets/);
});

test('copied combat, collection and growth sources load with every other game absent',async t=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'star-garden-independent-'));
  t.after(async()=>{
    assert.equal(path.dirname(directory),path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('star-garden-independent-'));
    await fs.rm(directory,{recursive:true,force:true});
  });
  const local=path.join(directory,'defense_test');await fs.mkdir(local);
  await fs.cp(path.join(gameRoot,'src'),path.join(local,'src'),{recursive:true});
  await fs.copyFile(path.join(gameRoot,'package.json'),path.join(local,'package.json'));
  const load=relative=>import(pathToFileURL(path.join(local,relative)).href);
  const [content,profile,battle,engine]=await Promise.all([load('src/content.js'),load('src/profile.js'),load('src/battle.js'),load('src/combat/engine.js')]);
  assert.equal(content.HEROES.length,30);assert.equal(content.CHAPTERS.length,45);
  const player=profile.createProfile(1791082800000);
  assert.ok(profile.command(player,'begin',{mode:'main',stage:1},1791082800000).ok);
  const run=battle.createBattle(player);
  for(let i=0;i<200;i++){engine.step(run,.05);if(i%6===0)battle.autoPlay(run);}
  assert.equal(run.deck.length,5);assert.ok(run.stats.damage>0);
  for(const other of ['defense','card','shooter','idle','survivor'])await assert.rejects(fs.access(path.join(directory,other)),{code:'ENOENT'});
});
