import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,readdir,realpath} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {prepareBrief} from './init-brief.mjs';
import {createRun} from './artifacts.mjs';
import {inspect,requirePrevious} from './core.mjs';
import {policy} from './policy.mjs';
import {root,gameRoot,here,sharp,segment} from './runtime.mjs';
import {auditPaths,requireAuditPaths} from './audit-environment.mjs';
async function workspace(t){const dir=await mkdtemp(path.join(os.tmpdir(),'sg-sd-portable-'));t.after(async()=>{assert.equal(path.dirname(await realpath(dir)),await realpath(os.tmpdir()));assert.match(path.basename(dir),/^sg-sd-portable-/);await rm(dir,{recursive:true,force:true});});return dir;}
test('runtime resolves this checkout and its own segmenter without a previous session',async()=>{
 assert.equal(root,path.resolve(gameRoot,'..'));assert.ok(JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).scripts['sd:defense']);
 const frame=await sharp({create:{width:150,height:150,channels:4,background:'#927ab8'}}).png().toBuffer();const atlas=await sharp({create:{width:1024,height:1024,channels:4,background:'#00000000'}}).composite([0,1,2,3].map(i=>({input:frame,left:i%2*512+180,top:Math.floor(i/2)*512+220}))).png().toBuffer();
 const dir=await mkdtemp(path.join(os.tmpdir(),'sg-sd-portable-'));try{const f=path.join(dir,'atlas.png');await writeFile(f,atlas);const s=await segment(f);assert.equal(s.pixels.length,4);assert.ok(s.metadata.majorComponents.every(c=>c.pixels===22500));}finally{await rm(dir,{recursive:true,force:true});}
});
test('new brief uses frozen front style and actual compact structure, then leaves A unapproved',async t=>{
 const dir=await workspace(t),design=path.join(dir,'design.txt'),equipment=path.join(dir,'equipment.txt');await writeFile(design,'Synthetic control fixture: pale-blue hair, rounded face and white/cyan clothing; no art approval.');await writeFile(equipment,'Synthetic fixture equipment notes: left star and pouch; no generation or visual judgment.');
 const out=path.join(dir,'brief.json'),brief=await prepareBrief({id:'siren',original:path.join(gameRoot,'assets/cast-selected-20261108/siren.png'),design,equipment,frame:'feminine-medium',peers:['jasmine','queen','cinderella'],out});
 const state=await createRun(path.join(dir,'run'),brief),status=await inspect(state),job=JSON.parse(await readFile(state.artifacts.job.file,'utf8'));
 assert.equal(status.next,'inputs');assert.equal(state.mode,'production');assert.ok(!state.artifacts.raw);await assert.rejects(requirePrevious(state,'generation'),/requires inputs to pass/);
 assert.equal(job.inputs.length,4);assert.match(job.inputs[0].role,/FRONT/);assert.match(job.inputs[1].role,/compact/);assert.match(job.inputs[2].role,/ORIGINAL/);assert.match(job.inputs[3].role,/identity/);
 assert.deepEqual(job.referencePaths,brief.generationReferences.map(r=>r.file));for(const c of policy.checks)assert.ok(job.prompt.includes(c.id));
 assert.equal((await sharp(job.referencePaths[0]).metadata()).width,512);assert.equal((await sharp(job.referencePaths[1]).metadata()).width,1024);
 await writeFile(job.referencePaths[0],'changed reference');assert.ok((await inspect(state)).badFiles.includes('ref:generation:0'),'generation derivatives remain in A bindings');
});
test('an invalid body class cannot silently pick a template',async()=>{
 await assert.rejects(prepareBrief({id:'siren',frame:'any-giant',peers:[],out:'unused.json'}),/Choose the body frame/);
});
test('audit paths are repository-local defaults and explicit overrides are honored',()=>{
 for(const platform of ['win32','linux']){const p=auditPaths({env:{},platform});assert.ok(p.python.startsWith(path.join(gameRoot,'test-results')));assert.equal(p.checker,path.join(here,'checker.py'));assert.equal(p.reference,path.join(gameRoot,'docs/art/sd-pipeline/reference-cast.json'));}
 assert.equal(auditPaths({env:{DEFENSE_ART_PYTHON:'owner-python'}}).python,'owner-python');
});
test('missing optional audit runtime fails with setup guidance, never a fake pass',async t=>{
 const dir=await workspace(t);await assert.rejects(requireAuditPaths({env:{},runtime:path.join(dir,'missing')}),/setup:defense:sd-pipeline.*No audit pass/);
});
test('executable workflow has no previous private workspace dependency',async()=>{
 for(const f of (await readdir(here)).filter(f=>/\.(mjs|py)$/.test(f)&&!f.endsWith('.test.mjs'))){const s=await readFile(path.join(here,f),'utf8');assert.doesNotMatch(s,/C:[/\\]+Users[/\\]+romar|defense-portrait-fit-20261107|defense-expressive-sd-pilot-20261108|AppData[/\\]+Local[/\\]+ms-playwright/,f);}
});
