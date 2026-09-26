import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const folder=path.join(root,'defense/docs/art/calibration');
const p=JSON.parse(await readFile(path.join(root,'defense/docs/art/HEAD_PROFILE.json'),'utf8'));
await mkdir(folder,{recursive:true});
// This is a construction diagram, not generated or replacement character art.
function figure(kind,dir){
  const body=p.bodyBelowChin[kind],chin=480-body,top=chin-p.head.height;
  const side=dir==='left'||dir==='right',sgn=dir==='left'?-1:1;
  const hw=side?p.head.sideWidth:p.head.frontWidth,hip=chin+body*.55,knee=hip+(480-hip)*.54;
  let shape=`<g fill="#b5c3ce" stroke="#52697a" stroke-width="3" stroke-linejoin="round">`;
  shape+=`<path d="M${side?232:222} ${chin+8} Q256 ${chin-2} ${side?280:290} ${chin+8} L${side?288:298} ${hip} Q256 ${hip+16} ${side?224:214} ${hip} Z"/>`;
  if(side){
    shape+=sgn>0?`<path d="M233 ${hip} H277 L276 462 L299 470 Q306 480 294 480 H231 Z"/>`:`<path d="M233 ${hip} H277 L276 480 H220 Q209 480 216 470 L234 462 Z"/>`;
    shape+=`<path d="M244 ${chin+21} Q229 ${chin+35} 237 ${hip-8} Q252 ${hip+11} 270 ${hip-4} L268 ${chin+31} Z"/>`;
  }else{
    for(const x of [228,278])shape+=`<path d="M${x-18} ${hip-2}H${x+18}L${x+13} 462Q${x+27} 470 ${x+21} 480H${x-25}Q${x-29} 470 ${x-13} 462Z"/>`;
    shape+=`<path d="M224 ${chin+15} Q210 ${chin+11} 202 ${chin+36} L192 ${hip-9} Q199 ${hip+11} 216 ${hip-2} L236 ${chin+40} Z"/>`;
    shape+=`<path d="M288 ${chin+15} Q302 ${chin+11} 310 ${chin+36} L320 ${hip-9} Q313 ${hip+11} 296 ${hip-2} L276 ${chin+40} Z"/>`;
  }
  shape+=`<rect x="242" y="${chin-8}" width="28" height="28" rx="8"/>`;
  shape+=`<path d="M${256-hw/2} ${top+78} C${256-hw/2} ${top+24} ${256-hw/3} ${top} 256 ${top} C${256+hw/3} ${top} ${256+hw/2} ${top+24} ${256+hw/2} ${top+78} C${256+hw/2} ${chin-25} 290 ${chin} 256 ${chin} C222 ${chin} ${256-hw/2} ${chin-25} ${256-hw/2} ${top+78}Z" fill="#e3eaf0"/>`;
  shape+='</g>';
  if(dir!=='up'){
    const ey=top+113;
    if(side)shape+=`<ellipse cx="${256+sgn*45}" cy="${ey}" rx="8" ry="14" fill="#6d8293"/>`;
    else shape+=`<ellipse cx="224" cy="${ey}" rx="9" ry="14" fill="#6d8293"/><ellipse cx="288" cy="${ey}" rx="9" ry="14" fill="#6d8293"/>`;
  }
  return shape;
}
for(const kind of ['short','medium','tall']){
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#f3f0e7"/>${p.directions.map((d,i)=>`<g transform="translate(${i%2*512} ${Math.floor(i/2)*512})">${figure(kind,d)}</g>`).join('')}</svg>`;
  await writeFile(path.join(folder,`geometry-${kind}.svg`),svg);
  await sharp(Buffer.from(svg)).png().toFile(path.join(folder,`geometry-${kind}.png`));
}
const lineup=`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="580"><rect width="1536" height="580" fill="#f3f0e7"/>${['short','medium','tall'].map((kind,i)=>`<g transform="translate(${i*512} 0)">${figure(kind,'down')}<text x="256" y="530" text-anchor="middle" font-family="Arial" font-size="24" fill="#2c4353">${kind}: head ${p.head.height} / body ${p.bodyBelowChin[kind]}</text></g>`).join('')}<path d="M0 480H1536" stroke="#dd7959" stroke-width="2"/></svg>`;
await sharp(Buffer.from(lineup)).png().toFile(path.join(folder,'geometry-lineup.png'));
console.log('Geometry construction references written. These do not certify generated art.');
