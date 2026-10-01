import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const file=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist/AstraNocturne.html');
const port=Number(process.env.NOCTURNE_PORT)||4190;
http.createServer(async(req,res)=>{if(!['/','/AstraNocturne.html'].includes(req.url.split('?')[0])){res.writeHead(404);res.end('Not found');return;}try{const html=await fs.readFile(file);res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(html);}catch{res.writeHead(503);res.end('Build AstraNocturne.html first.');}}).listen(port,'0.0.0.0',()=>console.log(`NOCTURNE preview: http://127.0.0.1:${port}`));
