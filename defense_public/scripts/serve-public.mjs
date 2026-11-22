import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkPublic} from './check-public.mjs';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.txt':'text/plain; charset=utf-8','.webp':'image/webp','.avif':'image/avif','.ogg':'audio/ogg','.woff2':'font/woff2'};
export async function servePublic(directory,{port=0}={}){
  const root=path.resolve(directory),{manifest}=await checkPublic(root);
  const server=http.createServer(async(req,res)=>{
    try{
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return;}
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const name=({'/':'index.html','/bright':'bright.html'})[pathname]||pathname.slice(1);
      const found=(Object.hasOwn(manifest.files,name)&&name!=='_headers')||name==='build-manifest.json';
      const file=found?name:'404.html',record=manifest.files[file];
      const headers={...manifest.headers,'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':file.startsWith('assets/')?'public, max-age=31536000, immutable':'no-cache'};
      if(record)headers.ETag='"'+record.sha256+'"';
      if(found&&headers.ETag&&req.headers['if-none-match']===headers.ETag){res.writeHead(304,headers);res.end();return;}
      const bytes=await fs.readFile(path.join(root,file));res.writeHead(found?200:404,{...headers,'Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);
    }catch{res.writeHead(400,{'Content-Type':'text/plain'});res.end('Invalid request');}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return {server,url:'http://127.0.0.1:'+server.address().port,close:()=>new Promise(resolve=>server.close(resolve))};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const service=await servePublic(process.argv[2]||path.join(path.dirname(fileURLToPath(import.meta.url)),'../dist-public'),{port:Number(process.env.GARDEN_PORT||4180)});
  console.log(service.url);
}
