import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {execFileSync} from 'node:child_process';
import {HEROES,WEAPONS} from '../src/content.js';

import crypto from 'node:crypto';
import {cleanFrame} from './art-normalization.mjs';

if(process.argv[2]==="--measure"){
// Authoring analysis only: follow a reviewed head patch through a whole pose.
// This is image registration, not skull/pose detection or a body-parts editor.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const file=path.join(root,'survivor/assets/body-profile.json'),profile=JSON.parse(await fs.readFile(file));
const specs=JSON.parse(await fs.readFile(path.join(root,'survivor/assets/renewal/sources.json')));
for(const spec of specs.filter(s=>s.kind==='walk')){
  const id=spec.id.slice(5),body=profile.frames[id],raw=await fs.readFile(path.join(root,spec.source)),meta=await sharp(raw).metadata(),images=[];
  if(crypto.createHash('sha256').update(raw).digest('hex')!==body.walkSourceSha256)throw new Error('Update reviewed source pin before measuring '+id);
  for(let i=0;i<16;i++){
    const index=spec.sequence?.[i]??i,col=index%4,row=Math.floor(index/4),left=Math.floor(col*meta.width/4),top=Math.floor(row*meta.height/4),right=Math.floor((col+1)*meta.width/4),bottom=Math.floor((row+1)*meta.height/4);
    const [px,py]=spec.extractionPadding||[0,0],l=Math.max(0,left-px),t=Math.max(0,top-py);
    const clean=await cleanFrame(await sharp(raw).extract({left:l,top:t,width:Math.min(meta.width,right+px)-l,height:Math.min(meta.height,bottom+py)-t}).png().toBuffer(),{minArea:140,maxGap:14,keepSecondary:!spec.isolatedFigure});
    images.push(await (spec.flipFrames?.includes(i)?sharp(clean.bytes).flop():sharp(clean.bytes)).ensureAlpha().raw().toBuffer({resolveWithObject:true}));
  }
  body.walk.frames=[];
  for(let view=0;view<4;view++){
    const s=body.walk.views[view],height=s.chin-s.skullTop,ref=images[view*4+1];
    for(let phase=0;phase<4;phase++){
      const target=images[view*4+phase];let best={score:Infinity,dx:0,dy:0};
      for(let dy=phase===1?0:-20;dy<=(phase===1?0:20);dy++)for(let dx=phase===1?0:-65;dx<=(phase===1?0:65);dx++){
        let total=0,n=0;
        for(let yy=Math.ceil(s.skullTop);yy<s.chin-4;yy+=4)for(let xx=Math.ceil(s.rootX-height*.5);xx<s.rootX+height*.5;xx+=4){
          if(xx<0||xx>=ref.info.width||yy<0||yy>=ref.info.height||xx+dx<0||xx+dx>=target.info.width||yy+dy<0||yy+dy>=target.info.height)continue;
          const a=(yy*ref.info.width+xx)*4,b=((yy+dy)*target.info.width+xx+dx)*4,aa=ref.data[a+3]/255,ab=target.data[b+3]/255;
          total+=(aa-ab)**2*65025;
          for(let c=0;c<3;c++)total+=(ref.data[a+c]*aa-target.data[b+c]*ab)**2;
          n++;
        }
        const score=total/n;if(score<best.score)best={score,dx,dy};
      }
      const rootX=s.rootX+best.dx;let foot=-1;
      // This restricted, manually reviewed sole window excludes ears, staff,
      // veils and cape tails. It controls translation, never figure proportions.
      for(let y=Math.max(0,s.foot-18);y<Math.min(target.info.height,s.foot+12);y++)for(let x=Math.max(0,Math.round(rootX-55));x<Math.min(target.info.width,Math.round(rootX+55));x++)if(target.data[(y*target.info.width+x)*4+3]>100)foot=y;
      if(foot<0)throw new Error('Review sole window: '+id+' '+view+' '+phase);
      body.walk.frames.push({skullTop:s.skullTop+best.dy,chin:s.chin+best.dy,rootX,foot,pelvis:s.pelvis+best.dy,bodyCenter:[rootX,(s.chin+s.pelvis)/2+best.dy],registration:{referenceFrame:view*4+1,dx:best.dx,dy:best.dy,meanSquaredRGBA:Math.round(best.score),atSearchBoundary:Math.abs(best.dx)===65||Math.abs(best.dy)===20}});
    }
  }
  console.log(id,body.walk.frames.map(f=>[f.registration.dx,f.registration.dy,f.foot]).flat().join(','));
}
await fs.writeFile(file,JSON.stringify(profile,null,2)+'\n');

process.exit(0);
}

// Authoring inspection only. This viewer is never embedded in the game.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=path.resolve(process.argv[2]||path.join(root,'survivor/test-results/art-review'));
await fs.mkdir(output,{recursive:true});
const manifest=JSON.parse(await fs.readFile(path.join(root,'survivor/assets/prepared-manifest.json'),'utf8'));
const profile=JSON.parse(await fs.readFile(path.join(root,manifest.normalization.source),'utf8'));
const data={};
for(const hero of HEROES){const body=profile.frames[hero.id],canonical=manifest.assets.find(a=>a.id==='unit-'+hero.id),walking=manifest.assets.find(a=>a.id==='walk-'+hero.id);
  data[hero.id]={name:hero.name,body,meta:manifest.frames[hero.id],source:'data:image/webp;base64,'+(await fs.readFile(path.join(root,body.identityReference?.path||canonical.source))).toString('base64'),canonical:'data:image/webp;base64,'+(await fs.readFile(path.join(root,'survivor/assets',canonical.file))).toString('base64'),walking:'data:image/webp;base64,'+(await fs.readFile(path.join(root,'survivor/assets',walking.file))).toString('base64'),pivots:manifest.normalization.frames.filter(f=>f.id===walking.id)};
}
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nocturne anatomical review</title><style>body{margin:0;background:#111b30;color:#e6dac3;font:14px/1.7 system-ui}header{padding:20px;position:sticky;top:0;background:#111b30ee;border-bottom:1px solid #8b9dba40;z-index:2}h1{font-size:20px;margin:0}p{margin:4px 0;color:#a8b8ce}label{display:inline-block;margin:10px 15px 0 0}select,button{font:inherit;color:inherit;background:#27354e;border:1px solid #93a5c540;border-radius:5px;padding:5px}main{padding:20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(650px,1fr));gap:18px}article{border:1px solid #8b9dba40;border-radius:9px;padding:14px;overflow:auto}canvas{display:block;margin:0 auto}h2{font-size:16px;margin:0 0 10px}small{color:#a5b6ce}pre{font-size:10px;white-space:pre-wrap;color:#a5b6ce}</style><header><h1>같은 바닥 · 같은 머리 기준</h1><p>정수리·턱은 수동 추정값입니다. 귀·왕관·머리카락·무기는 머리 크기를 정하는 경계가 아닙니다. 흰색 의상과 셀 가장자리를 함께 검토하세요.</p><label>배경 <select id="matte"><option value="#17233a">남색</option><option value="#888888">회색</option><option value="#e3e6e6">밝은 바닥</option><option value="#8c2374">자홍색</option></select></label><label>방향 <select id="dir"><option value="0">정면</option><option value="1">후면</option><option value="2">왼쪽</option><option value="3">오른쪽</option></select></label><label>게임 셀 크기 <select id="size"><option>100</option><option>64</option><option>96</option><option>150</option></select></label><label><input id="onion" type="checkbox"> 이전 프레임 겹쳐 보기</label><label><input id="guides" type="checkbox" checked> 머리·턱·발 기준</label><button id="play">보행 재생</button></header><main id="cast"></main><script>const data=${JSON.stringify(data)};let phase=0,playing=false;const loaded={};async function boot(){for(const [id,h]of Object.entries(data)){loaded[id]={};for(const type of ['source','canonical','walking']){const img=new Image;img.src=h[type];await img.decode();loaded[id][type]=img;}const art=document.createElement('article');art.innerHTML='<h2>'+h.name+'</h2><canvas width="620" height="190"></canvas><small>정체성 원화 / 새 전신 / 보행 4프레임</small><pre></pre>';art.dataset.id=id;document.querySelector('main').append(art);}draw();}function draw(){const size=+document.querySelector('#size').value,dir=+document.querySelector('#dir').value,guides=document.querySelector('#guides').checked,matte=document.querySelector('#matte').value;for(const art of document.querySelectorAll('article')){const id=art.dataset.id,h=data[id],c=art.querySelector('canvas').getContext('2d'),img=loaded[id],foot=160;c.fillStyle=matte;c.fillRect(0,0,620,190);c.strokeStyle='#b8d6dc66';c.beginPath();c.moveTo(0,foot);c.lineTo(620,foot);c.stroke();const src=img.source,cell=src.width/2;c.drawImage(src,dir%2*cell,Math.floor(dir/2)*cell,cell,cell,7,foot-120*.9375,120,120);const normal=img.canonical,nc=normal.width/2;c.drawImage(normal,dir%2*nc,Math.floor(dir/2)*nc,nc,nc,190-size/2,foot-size*.9375,size,size);for(let j=0;j<4;j++){const ph=playing?(phase+j)%4:j,ws=size*h.meta.walk.displayScale,wc=img.walking.width/4,x=280+j*88;if(document.querySelector('#onion').checked){c.globalAlpha=.18;c.drawImage(img.walking,(ph+3)%4*wc,dir*wc,wc,wc,x-ws/2,foot-ws*.9375,ws,ws);c.globalAlpha=1;}c.drawImage(img.walking,ph*wc,dir*wc,wc,wc,x-ws/2,foot-ws*.9375,ws,ws);}if(guides){const b=h.body.identityReference?.landmarks||h.body.canonical;for(const [at,color]of [[b.skullTop,'#ffd480'],[b.chin,'#e695b7'],[b.foot,'#a3e6dd']]){c.strokeStyle=color;c.beginPath();c.moveTo(7,foot-120*.9375+at/512*120);c.lineTo(127,foot-120*.9375+at/512*120);c.stroke();}c.strokeStyle='#ffd480';for(const x of [190,280,368,456,544]){c.beginPath();c.moveTo(x-15,foot-(h.meta.anatomy.bodyHeight+h.body.targetHead)/512*size);c.lineTo(x+15,foot-(h.meta.anatomy.bodyHeight+h.body.targetHead)/512*size);c.stroke();}c.strokeStyle='#e695b7';c.beginPath();c.moveTo(175,foot-h.meta.anatomy.bodyHeight/512*size);c.lineTo(604,foot-h.meta.anatomy.bodyHeight/512*size);c.stroke();}art.querySelector('pre').textContent='head '+h.body.targetHead+' / body '+h.meta.anatomy.bodyHeight.toFixed(1)+' / sole 480\\nsource '+h.body.sourceSha256+'\\nwalk '+h.body.walkSourceSha256;}}for(const el of document.querySelectorAll('select,input'))el.onchange=draw;document.querySelector('#play').onclick=()=>{playing=!playing;document.querySelector('#play').textContent=playing?'보행 정지':'보행 재생';draw();};setInterval(()=>{if(playing){phase=(phase+1)%4;draw();}},160);boot();</script></html>`;
await fs.writeFile(path.join(output,'index.html'),html);
// Two real-size front contact sheets; transparent areas share a common matte.
for(const size of [64,96,100,150]){const width=HEROES.length*200,height=240,layers=[];
  const labels=`<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="#17233a"/><path d="M0 202H${width}" stroke="#a3e6dd" stroke-opacity=".5"/>${HEROES.map((h,i)=>'<text x="'+(i*200+100)+'" y="24" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#e5d7bd">'+h.en+'</text>').join('')}<text x="12" y="230" font-family="sans-serif" font-size="11" fill="#a5b7cc">${size}px game cells · canonical / walking · anatomical head 144/512</text></svg>`;
  layers.push({input:Buffer.from(labels),left:0,top:0});
  for(let i=0;i<HEROES.length;i++){const id=HEROES[i].id;
    for(const [type,x] of [['canonical',i*200+50],['walking',i*200+148]]){const bytes=Buffer.from(data[id][type].split(',')[1],'base64'),m=await sharp(bytes).metadata(),cell=m.width/(type==='walking'?4:2),drawSize=Math.round(size*(type==='walking'?data[id].meta.walk.displayScale:1));layers.push({input:await sharp(bytes).extract({left:type==='walking'?cell:0,top:0,width:cell,height:cell}).resize(drawSize,drawSize).png().toBuffer(),left:Math.round(x-drawSize/2),top:Math.round(202-drawSize*.9375)});}
  }
  // Pad before compositing so the outer transparent margins never need clipping.
  const padding=75;const shifted=layers.map(l=>({...l,left:l.left+padding,top:l.top}));
  await sharp({create:{width:width+padding*2,height,channels:4,background:'#17233aff'}}).composite(shifted).extract({left:padding,top:0,width,height}).png().toFile(path.join(output,'cast-'+size+'.png'));
}
console.log('Art review: '+output);

// Publication contact sheets: full cast and every walking cell on both mattes.
for(const [name,bg,fg] of [['dark','#1b2940','#eaddc8'],['light','#e3e6e6','#24354b']]){
  const width=1920,height=HEROES.length*130,layers=[];
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${bg}"/>`;
  for(let row=0;row<HEROES.length;row++){
    const h=HEROES[row],bytes=Buffer.from(data[h.id].walking.split(',')[1],'base64');
    svg+=`<text x="9" y="${row*130+24}" font-family="sans-serif" font-size="13" fill="${fg}">${h.en}</text><path d="M140 ${row*130+111}H1920" stroke="${fg}" stroke-opacity=".3"/>`;
    for(let i=0;i<16;i++){const size=125,center=145+i*110+55;layers.push({input:await sharp(bytes).extract({left:i%4*208,top:Math.floor(i/4)*208,width:208,height:208}).resize(size,size).png().toBuffer(),left:Math.round(center-size/2),top:Math.round(row*130+111-size*.9375)});}
  }
  layers.unshift({input:Buffer.from(svg+'</svg>'),left:0,top:0});await sharp({create:{width,height,channels:4,background:bg}}).composite(layers).png().toFile(path.join(output,'walking-'+name+'.png'));
}
const ids=[...new Set([...HEROES.map(h=>h.id),...WEAPONS.map(w=>w.owner)])];
{
  const width=1540,height=580,layers=[];let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#1b2940"/>`;
  for(let i=0;i<ids.length;i++){
    const id=ids[i],x=i%7*220,y=Math.floor(i/7)*290,h=HEROES.find(h=>h.id===id),asset=manifest.assets.find(a=>a.id===(h?'full-':'unit-')+id),bytes=await fs.readFile(path.join(root,'survivor/assets',asset.file));
    svg+=`<path d="M${x+6} ${y+250}h208" stroke="#bbe7d7" stroke-opacity=".45"/><text x="${x+110}" y="${y+22}" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#eddebd">${h?.en||id.replaceAll('_',' ')}</text><text x="${x+110}" y="${y+277}" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#96b0ce">${h?'GUARDIAN':'WEAPON COMPANION'} · same scale / sole</text>`;
    const size=210,region=h?bytes:await sharp(bytes).extract({left:0,top:0,width:384,height:384}).png().toBuffer();layers.push({input:await sharp(region).resize(size,size).png().toBuffer(),left:x+5,top:Math.round(y+250-size*.9375)});
  }
  layers.unshift({input:Buffer.from(svg+'</svg>'),left:0,top:0});await sharp({create:{width,height,channels:4,background:'#1b2940'}}).composite(layers).png().toFile(path.join(output,'cast-all.png'));
}
// The optional explicit Git baseline pins before/after comparisons to a commit,
// never to whatever a later main happens to contain.
const baseline=process.argv[3];
if(baseline){
  if(!/^[a-f0-9]{7,40}$/.test(baseline))throw new Error('Use an explicit baseline commit hash');
  const width=HEROES.length*280,height=540,layers=[],padding=80;
  let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#202c44"/><path d="M0 225H${width}M0 485H${width}" stroke="#b8ede0" stroke-opacity=".5"/>`;
  for(let i=0;i<HEROES.length;i++){
    const h=HEROES[i],current=Buffer.from(data[h.id].walking.split(',')[1],'base64'),old=execFileSync('git',['show',baseline+':survivor/assets/prepared/walk-'+h.id+'.webp'],{cwd:root,maxBuffer:20e6});
    svg+=`<text x="${i*280+140}" y="25" text-anchor="middle" fill="#efddb9" font-family="sans-serif" font-size="14">${h.en}</text><text x="${i*280+140}" y="253" text-anchor="middle" fill="#b8cbe3" font-family="sans-serif" font-size="11">${baseline} / patch · 150px cell</text>`;
    for(const [bytes,x]of[[old,i*280+70],[current,i*280+210]])for(const [direction,foot]of[[0,225],[2,485]]){const size=195;layers.push({input:await sharp(bytes).extract({left:208,top:direction*208,width:208,height:208}).resize(size,size).png().toBuffer(),left:Math.round(x-size/2+padding),top:Math.round(foot-size*.9375)});}
  }
  layers.unshift({input:Buffer.from(svg+'</svg>'),left:padding,top:0});await sharp({create:{width:width+padding*2,height,channels:4,background:'#202c44'}}).composite(layers).extract({left:padding,top:0,width,height}).png().toFile(path.join(output,'before-after.png'));
}
