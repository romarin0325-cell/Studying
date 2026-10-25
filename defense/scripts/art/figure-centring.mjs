// Horizontal centring of each companion's UI figure (the 512 frame the summon spotlight and detail screens show):
// silhouette box centre, alpha mass centre, feet centre and face centre, in frame pixels (256 = centre).
// Usage: node defense/scripts/art/figure-centring.mjs [--json out.json]
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {HEROES} from '../../src/content.js';
import {portraitFrame} from '../../src/portrait-layout.js';
import {gameRoot} from '../local-inputs.mjs';
const rows=[];
for(const h of HEROES){
  const {data,info}=await sharp(path.join(gameRoot,'assets/optimized/ui/figures',h.id+'.webp')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const W=info.width,H=info.height,A=(x,y)=>data[(y*W+x)*4+3];
  let minX=W,maxX=-1,minY=H,maxY=-1,mass=0,mx=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const a=A(x,y);if(a>40){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;mass+=a;mx+=a*x;}}
  let fMin=W,fMax=-1;for(let y=Math.round(maxY-(maxY-minY)*.1);y<=maxY;y++)for(let x=0;x<W;x++)if(A(x,y)>40){if(x<fMin)fMin=x;if(x>fMax)fMax=x;}
  const scale=512/W,p=portraitFrame(h);
  rows.push({id:h.id,name:h.name,box:Math.round((minX+maxX)/2*scale),mass:Math.round(mx/mass*scale),feet:Math.round((fMin+fMax)/2*scale),face:p?Math.round(p.x):null,width:Math.round((maxX-minX)*scale)});
}
rows.sort((a,b)=>Math.abs(b.face-256)-Math.abs(a.face-256));
const i=process.argv.indexOf('--json');if(i>0)await fs.writeFile(process.argv[i+1],JSON.stringify(rows,null,2)+'\n');
for(const r of rows)console.log(r.id.padEnd(16),'face',String(r.face).padStart(3),'feet',String(r.feet).padStart(3),'mass',String(r.mass).padStart(3),'box',String(r.box).padStart(3),'w',r.width);
