import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {buildPublicWeb,releaseConfig} from '../scripts/public-web.mjs';
import {checkPublic} from '../scripts/check-public.mjs';
import {servePublic} from '../scripts/serve-public.mjs';
import {build} from 'esbuild';
import * as sourceProfile from '../src/profile.js';
test('public build is deterministic, isolated, hashed, checked and served with real security/cache headers',async t=>{
  const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'garden-public-'));
  t.after(()=>fs.rm(scratch,{recursive:true,force:true}));
  const output=path.join(scratch,'release');
  const first=await buildPublicWeb({outdir:output}),second=await buildPublicWeb({outdir:output});assert.deepEqual(second,first);
  const report=await checkPublic(output);assert.equal(report.analyticsEnabled,false);assert.ok(report.htmlBytes<16384);
  const server=await servePublic(output);t.after(()=>server.close());
  const index=await fetch(server.url);assert.match(index.headers.get('content-security-policy'),/script-src 'self';/);assert.equal(index.headers.get('cache-control'),'no-cache');assert.equal(index.headers.get('x-frame-options'),'DENY');
  for(const location of ['/src/app.js','/.git/config','/_headers','/missing.map'])assert.equal((await fetch(server.url+location)).status,404);
  const js=Object.keys(first.files).find(n=>n.endsWith('.js')),response=await fetch(server.url+'/'+js);assert.match(response.headers.get('cache-control'),/immutable/);assert.equal((await fetch(server.url+'/'+js,{headers:{'If-None-Match':response.headers.get('etag')}})).status,304);
  const file=path.join(output,js),original=await fs.readFile(file);await fs.appendFile(file,'\n//# sourceMappingURL=x.map');await assert.rejects(checkPublic(output),/hash mismatch/);await fs.writeFile(file,original);
  await fs.writeFile(path.join(output,'source.map'),'{}');await assert.rejects(checkPublic(output),/Unlisted/);await assert.rejects(buildPublicWeb({outdir:output}),/another build/);
  const configFile=path.join(scratch,'config.json');await fs.writeFile(configFile,JSON.stringify({channel:'public',analytics:{enabled:true,host:'https://example.com',token:'secret'}}));await assert.rejects(releaseConfig(configFile),/Invalid release config/);
  await fs.writeFile(configFile,JSON.stringify({channel:'test',analytics:{enabled:true}}));assert.deepEqual(await releaseConfig(configFile),{channel:'test',analytics:{enabled:true}});
});

test('public compilation preserves save format and game command results, with test grants unavailable',async()=>{
  assert.deepEqual(await releaseConfig(fileURLToPath(new URL('../release.example.json',import.meta.url))),{channel:'public',analytics:{enabled:true}});
  const compiled=await build({entryPoints:[fileURLToPath(new URL('../src/profile.js',import.meta.url))],bundle:true,write:false,format:'esm',define:{__GARDEN_PUBLIC_WEB__:'true',__GARDEN_UNLOCKED__:'false',__GARDEN_PREVIEW__:'false',__GARDEN_SOLO__:'false'}});
  const publicProfile=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
  const now=Date.UTC(2026,10,22),a=sourceProfile.createProfile(now),b=publicProfile.parseProfile(JSON.stringify(a));
  assert.equal(publicProfile.SAVE_KEY,'astra.star-garden.public.v1');assert.deepEqual(b,a);
  for(const [action,args] of [['setting',{id:'auto',value:false}],['begin',{mode:'main',stage:1}]]){
    assert.deepEqual(publicProfile.command(b,action,args,now),sourceProfile.command(a,action,args,now));assert.deepEqual(b,a);
  }
  assert.deepEqual(publicProfile.command(b,'settle',{token:b.active.token,won:true,round:6,seconds:60,damage:2000},now),sourceProfile.command(a,'settle',{token:a.active.token,won:true,round:6,seconds:60,damage:2000},now));
  assert.deepEqual(b,a);assert.equal(publicProfile.command(b,'testGrant',{},now).ok,false);
  assert.deepEqual(publicProfile.parseProfile(JSON.stringify(b)),sourceProfile.parseProfile(JSON.stringify(a)));
});
