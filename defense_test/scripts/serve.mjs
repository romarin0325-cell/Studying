import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const game=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const server=http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname!=='/'&&pathname!=='/StarGardenDefense.html'){res.writeHead(404);res.end('Not found');return;}const bytes=await fs.readFile(path.join(game,'dist/StarGardenDefense.html'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(bytes);}catch{res.writeHead(500);res.end('Build the standalone game first.');}});
server.listen(Number(process.env.GARDEN_PORT||4178),'127.0.0.1',()=>console.log('Star Garden: http://127.0.0.1:'+server.address().port));
