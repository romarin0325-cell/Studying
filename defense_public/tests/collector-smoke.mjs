// Local workerd + D1 integration. No account, remote database or deployment.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import {spawn,execFileSync} from 'node:child_process';
import {checkPublic} from '../scripts/check-public.mjs';
const game=fileURLToPath(new URL('..',import.meta.url)),deploy=path.join(game,'deploy/cloudflare');
const assets=path.resolve(process.argv[2]||path.join(game,'dist-public'));
await checkPublic(assets);
const bin=path.join(deploy,'node_modules/wrangler/bin/wrangler.js');
const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'garden-worker-')),config=JSON.parse(await fs.readFile(path.join(deploy,'wrangler.jsonc'),'utf8'));
delete config.$schema;config.main=path.join(deploy,'worker.mjs');config.assets.directory=assets;config.vars.ANALYTICS_ENABLED='true';config.d1_databases[0].migrations_dir=path.join(deploy,'migrations');
const configFile=path.join(scratch,'wrangler.json'),state=path.join(scratch,'state');await fs.writeFile(configFile,JSON.stringify(config));
const env={...process.env,WRANGLER_SEND_METRICS:'false',CI:'true'};
const cli=args=>execFileSync(process.execPath,[bin,...args,'--config',configFile],{env,cwd:deploy,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:2*1024*1024});
let child,logs='';
try{
  cli(['d1','execute','DB','--local','--persist-to',state,'--file',path.join(deploy,'migrations/0001_counts.sql')]);
  const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
  const url='http://127.0.0.1:'+port;
  child=spawn(process.execPath,[bin,'dev','--local','--config',configFile,'--persist-to',state,'--port',String(port),'--ip','127.0.0.1','--test-scheduled'],{env,cwd:deploy,stdio:['ignore','pipe','pipe'],windowsHide:true});
  for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{logs=(logs+b.toString()).slice(-12000);});
  let ready=false;
  for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(logs);try{ready=(await fetch(url)).ok;}catch{}if(ready)break;await new Promise(r=>setTimeout(r,250));}
  assert.ok(ready,'local Worker startup: '+logs);
  const index=await fetch(url);assert.match(index.headers.get('content-security-policy'),/script-src 'self'/);assert.equal(index.headers.get('cache-control'),'no-cache');
  const manifest=JSON.parse(await fs.readFile(path.join(assets,'build-manifest.json'),'utf8'));
  const asset=Object.keys(manifest.files).find(n=>n.endsWith('.js'));
  assert.equal((await fetch(url+'/'+asset)).headers.get('cache-control'),'public, max-age=31536000, immutable');
  assert.equal((await fetch(url+'/src/app.js')).status,404);assert.equal((await fetch(url+'/api/counts')).status,404);
  const post=data=>fetch(url+'/api/event',{method:'POST',headers:{origin:url,'content-type':'application/json'},body:JSON.stringify(data)});
  assert.equal((await post({events:[{event:'game_boot',fields:{}},{event:'game_boot',fields:{}}]})).status,204);
  assert.equal((await post({events:[{event:'game_boot',fields:{session_id:'forbidden'}}]})).status,400);
  const query=sql=>JSON.parse(cli(['d1','execute','DB','--local','--persist-to',state,'--command',sql,'--json']));
  const rows=query('SELECT * FROM daily_counts')[0].results;assert.equal(rows.length,1);assert.equal(rows[0].hits,2);assert.equal(rows[0].bucket,'{}');
  query("INSERT INTO daily_counts VALUES('2000-01-01','game_boot','{}',1)");
  assert.equal((await fetch(url+'/__scheduled?cron=17+3+*+*+*')).status,200);
  assert.equal(query('SELECT COUNT(*) AS n FROM daily_counts')[0].results[0].n,1);
  console.log('PASS local Cloudflare: real headers/assets, same-origin API, D1 aggregation, rejected identity and scheduled retention');
}finally{
  if(child&&child.exitCode===null){
    const stopped=new Promise(r=>child.once('exit',r));
    if(process.platform==='win32')execFileSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});
    else child.kill('SIGTERM');
    await stopped;
  }
  await fs.rm(scratch,{recursive:true,force:true,maxRetries:20,retryDelay:200});
}
