// Offline atlas packing. The generated pose drawings are left intact.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const castPath=path.join(root,'survivor/assets/cast.json');
const cast=JSON.parse(await fs.readFile(castPath,'utf8'));
const frame=cast.frames.find(f=>f.id==='jasmine');
const bytes=await fs.readFile(path.join(root,frame.source.path));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(sha(bytes)!==frame.source.sha256)throw new Error('Generated Jasmine source changed. Review its landmarks before repacking.');
const metadata=await sharp(bytes).metadata(),half=Math.floor(metadata.width/2),scale=frame.source.scale;
const out=Buffer.alloc(1024*1024*4);
for(let view=0;view<4;view++){
  const [fx,fy]=frame.source.feet[view],column=view%2,row=Math.floor(view/2);
  const cell=await sharp(bytes).extract({left:column*half,top:row*half,width:half,height:half}).resize(Math.round(half*scale),Math.round(half*scale)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const left=Math.round(frame.anchor[0]-(fx-column*half)*scale)+column*512;
  const top=Math.round(frame.anchor[1]-(fy-row*half)*scale)+row*512;
  for(let y=0;y<cell.info.height;y++)for(let x=0;x<cell.info.width;x++){
    const tx=left+x,ty=top+y;if(tx<column*512||tx>=(column+1)*512||ty<row*512||ty>=(row+1)*512)continue;
    const source=(y*cell.info.width+x)*4,target=(ty*1024+tx)*4;
    out.set(cell.data.subarray(source,source+4),target);
  }
}
const packed=await sharp(out,{raw:{width:1024,height:1024,channels:4}}).webp({quality:94}).toBuffer();
await fs.writeFile(path.join(root,frame.sourcePath),packed);frame.sourceSha256=sha(packed);
await fs.writeFile(castPath,JSON.stringify(cast,null,2)+'\n');
console.log('Jasmine: four neutral directions, uniform scale, shared foot anchor. Run prepare-assets.mjs next.');
