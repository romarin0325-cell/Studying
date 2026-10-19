import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const game=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Coral Bricks (DeepSeek) accepts browser calls only from its own site, so the tutor posts here and this relays it.
// The player's key comes with each request and is never stored. Only these two endpoints pass.
const RELAY='/coralbricks/v1/',UPSTREAM='https://inference.coralbricks.ai/v1/',RELAYED=['chat/completions','models'];
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'authorization, content-type','Access-Control-Max-Age':'600'};
async function relay(req,res,pathname){
  const rest=pathname.slice(RELAY.length);
  if(req.method==='OPTIONS'){res.writeHead(204,CORS);res.end();return;}
  if(!RELAYED.includes(rest)){res.writeHead(404,CORS);res.end('Not relayed');return;}
  const chunks=[];for await(const c of req)chunks.push(c);
  try{
    const upstream=await fetch(UPSTREAM+rest,{method:req.method,headers:{'Content-Type':'application/json',...(req.headers.authorization?{Authorization:req.headers.authorization}:{})},body:req.method==='POST'?Buffer.concat(chunks):undefined});
    res.writeHead(upstream.status,{...CORS,'Content-Type':upstream.headers.get('content-type')||'application/json'});res.end(Buffer.from(await upstream.arrayBuffer()));
  }catch{res.writeHead(502,{...CORS,'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:'중계 서버가 Coral Bricks에 연결하지 못했어요.'}}));}
}
const server=http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname.startsWith(RELAY)){await relay(req,res,pathname);return;}const files={'/':'dist/StarGardenDefense.html','/StarGardenDefense.html':'dist/StarGardenDefense.html','/unlocked':'test-results/unlocked/StarGardenDefenseUnlocked.html','/bright':'dist/StarGardenDefenseBright.html','/unlocked-bright':'test-results/unlocked/StarGardenDefenseUnlockedBright.html'};if(!files[pathname]){res.writeHead(404);res.end('Not found');return;}const bytes=await fs.readFile(path.join(game,files[pathname]));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(bytes);}catch{res.writeHead(500);res.end('Build the standalone game first.');}});
server.listen(Number(process.env.GARDEN_PORT||4178),'127.0.0.1',()=>console.log('Star Garden: http://127.0.0.1:'+server.address().port+' (DeepSeek relay: '+RELAY+')'));
