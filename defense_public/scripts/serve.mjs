import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const game=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const server=http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const files={'/balance':'dist/StarGardenBalanceLab.html','/lab':'dist/StarGardenBalanceLab.html','/StarGardenBalanceLab.html':'dist/StarGardenBalanceLab.html','/':'dist/StarGardenPublic.html','/StarGardenPublic.html':'dist/StarGardenPublic.html','/unlocked':'test-results/unlocked/StarGardenPublicUnlocked.html','/bright':'dist/StarGardenPublicBright.html','/unlocked-bright':'test-results/unlocked/StarGardenPublicUnlockedBright.html'};if(!files[pathname]){res.writeHead(404);res.end('Not found');return;}const bytes=await fs.readFile(path.join(game,files[pathname]));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(bytes);}catch{res.writeHead(500);res.end('Build the standalone game first.');}});
server.listen(Number(process.env.GARDEN_PORT||4179),'127.0.0.1',()=>console.log('Star Garden Public: http://127.0.0.1:'+server.address().port));
