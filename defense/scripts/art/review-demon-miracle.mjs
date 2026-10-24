// Small preparation review: approved cast beside the five new visual identities at identical scale.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {HEROES,TRANSFORM_ART,ASSET_PATHS} from '../../src/content.js';
import {gameRoot,assetFile} from '../local-inputs.mjs';
import {facingScore} from './check-facing.mjs';
const out=path.join(gameRoot,'test-results/demon-miracle');
await fs.mkdir(out,{recursive:true});
const art=new Map([...HEROES.map(h=>[h.id,h.art]),...Object.entries(TRANSFORM_ART)]);
const fresh=['demon_king','miracle_larva','miracle_cocoon','miracle_wing','abyss_wing'];
const all=['siren','aurora','snow_rabbit','rumi',...fresh];
const label=(s,w=160)=>Buffer.from(`<svg width="${w}" height="24"><text x="8" y="17" font-size="13" fill="#735e62" font-family="Arial">${s}</text></svg>`);
const layers=[];
for(const [i,id] of all.entries()){
  const file=assetFile(ASSET_PATHS[art.get(id).atlas]);
  for(const y of [24,280])layers.push({input:await sharp(file).extract({left:0,top:0,width:512,height:512}).resize(160,160).png().toBuffer(),left:i*160,top:y+70});
  const p=art.get(id).portrait;
  layers.push({input:await sharp(file).extract({left:Math.round(p.x-100),top:Math.round(p.y-95),width:200,height:190}).resize(160,152).png().toBuffer(),left:i*160,top:555});
  layers.push({input:label(id),left:i*160,top:0});
}
const light=await sharp({create:{width:1440,height:740,channels:4,background:'#f6f2e9'}}).png().toBuffer();
const dark=await sharp({create:{width:1440,height:256,channels:4,background:'#15212f'}}).png().toBuffer();
await sharp(light).composite([{input:dark,left:0,top:280},...layers]).webp({quality:95}).toFile(path.join(out,'cast-lineup.webp'));
const views=[];
for(const [row,id] of fresh.entries()){
  const file=assetFile(ASSET_PATHS[art.get(id).atlas]);
  views.push({input:label(id,1024),left:0,top:row*154});
  for(let n=0;n<8;n++)views.push({input:await sharp(file).extract({left:n%4%2*512,top:Math.floor(n%4/2)*512,width:512,height:512}).resize(128,128).png().toBuffer(),left:n*128,top:row*154+24});
}
const darkSide=await sharp({create:{width:512,height:770,channels:4,background:'#15212f'}}).png().toBuffer();
await sharp({create:{width:1024,height:770,channels:4,background:'#f6f2e9'}}).composite([{input:darkSide,left:512,top:0},...views]).webp({quality:95}).toFile(path.join(out,'four-views.webp'));
const facing=[];
for(const id of fresh)facing.push({id,left:await facingScore(id,2),right:await facingScore(id,3)});
await fs.writeFile(path.join(out,'facing.json'),JSON.stringify(facing,null,2)+'\n');
console.log(JSON.stringify({review:out,facing}));
