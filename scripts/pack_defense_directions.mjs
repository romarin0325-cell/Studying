import sharp from 'sharp';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {keySpritePixels} from './import_defense_sprite.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const DIRECTIONS=['down','up','left','right'];

export function anatomicalScale(skull,profile,id){
  if(!Array.isArray(skull)||skull.length!==4||skull.some(n=>!Number.isFinite(n)))throw new Error('Four anatomical skull coordinates are required');
  const [left,top,right,chin]=skull,w=right-left,h=chin-top;
  if(w<=0||h<=0)throw new Error('Invalid anatomical skull bounds');
  // Equal projected cranial area. One UNIFORM scale preserves the original
  // face aspect ratio; width/height are also reported separately for review.
  const adjustment=profile.headOverrides?.[id]?.scale??1;
  if(!Number.isFinite(adjustment)||adjustment<=0||adjustment>1.1)throw new Error('Invalid documented head override');
  return Math.sqrt(profile.head.frontWidth*profile.head.height/(w*h))*adjustment;
}

// Skull estimates are recorded explicitly, excluding hair volume/headgear.
// They are not an automatic anatomy detector or a claim of author approval.
// Silhouette bounds are used only to detect clipping, never to derive scale.
export async function packDirections({sourceDir,entries,outputDir,proofDir}){
  await mkdir(outputDir,{recursive:true});
  if(proofDir)await mkdir(proofDir,{recursive:true});
  const manifest=[];
  const profile=JSON.parse(await readFile(path.join(ROOT,'defense/docs/art/HEAD_PROFILE.json'),'utf8'));
  for(const entry of entries){
    if(!entry.anatomy||!/^[0-9a-f]{64}$/.test(entry.sourceSha256||''))throw new Error(`${entry.id}: anatomical skull landmarks and source SHA-256 are required; arbitrary scale is not accepted`);
    const e={...entry,scale:anatomicalScale(entry.anatomy.skull,profile,entry.id)};
    if(!/^[a-z_]+$/.test(e.id)||!Number.isFinite(e.scale)||e.scale<=0||!Array.isArray(e.feet)||e.feet.length!==4)throw new Error(`Invalid landmarks: ${e.id}`);
    const source=await readFile(path.join(sourceDir,e.file));
    if(e.sourceSha256&&sha(source)!==e.sourceSha256)throw new Error(`${e.id}: source changed; anatomical landmarks must be reviewed again`);
    const meta=await sharp(source).metadata();
    const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    if(e.alphaOpaqueThreshold!==undefined){
      // Explicit per-source import correction for an exporter whose painted
      // interiors top out at alpha 253. Preserve all RGB and soft edge alpha;
      // never derive transparency from white hair/clothes or image brightness.
      if(!Number.isInteger(e.alphaOpaqueThreshold)||e.alphaOpaqueThreshold<250||e.alphaOpaqueThreshold>255)throw new Error(`${e.id}: invalid near-opaque alpha threshold`);
      for(let i=3;i<data.length;i+=4)if(data[i]>=e.alphaOpaqueThreshold)data[i]=255;
    }
    if(!meta.hasAlpha){
      const samples=[[0,0],[info.width-1,0],[0,info.height-1],[info.width-1,info.height-1]];
      if(samples.some(([x,y])=>{const i=(y*info.width+x)*4;return data[i]<200||data[i+1]>65||data[i+2]<200;}))throw new Error(`${e.id}: expected native alpha or flat magenta, not a painted checkerboard`);
    }
    // Native-alpha artwork can contain saturated magenta gems and cloth.
    // A chroma-key pass would destroy those painted materials.
    if(e.alphaMode==='native'){
      if(!meta.hasAlpha)throw new Error(`${e.id}: native alpha source required`);
    }else if(e.alphaMode===undefined||e.alphaMode==='magenta')keySpritePixels(data,info.width,info.height);
    else throw new Error(`${e.id}: unknown alpha mode`);
    const png=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
    const w=Math.floor(info.width/2),split=e.splitY||Math.floor(info.height/2),layers=[];
    for(let i=0;i<4;i++){
      const [fx,fy]=e.feet[i],h=i<2?split:info.height-split;
      if(fx<0||fx>=w||fy<0||fy>=h)throw new Error(`${e.id}/${DIRECTIONS[i]}: foot outside source view`);
      let crop=await sharp(png).extract({left:i%2*w,top:i<2?0:split,width:w,height:h}).resize(Math.round(w*e.scale),Math.round(h*e.scale)).png().toBuffer();
      const left=Math.round(256-fx*e.scale),top=Math.round(480-fy*e.scale);
      const rw=Math.round(w*e.scale),rh=Math.round(h*e.scale),bx=Math.max(0,-left),by=Math.max(0,-top),ex=Math.min(rw,512-left),ey=Math.min(rh,512-top);
      if(bx||by||ex<rw||ey<rh){
        const pixels=await sharp(crop).ensureAlpha().raw().toBuffer();
        for(let y=0;y<rh;y++)for(let x=0;x<rw;x++)if((x<bx||x>=ex||y<by||y>=ey)&&pixels[(y*rw+x)*4+3]>8)throw new Error(`${e.id}/${DIRECTIONS[i]}: painted pixels exceed frame; enlarge padding, never auto-fit`);
        // Only empty padding may be clipped. No silhouette/body fitting.
        crop=await sharp(crop).extract({left:bx,top:by,width:ex-bx,height:ey-by}).png().toBuffer();
      }
      layers.push({input:crop,left:i%2*512+left+bx,top:Math.floor(i/2)*512+top+by});
    }
    const atlas=await sharp({create:{width:1024,height:1024,channels:4,background:'#00000000'}}).composite(layers).webp({quality:95,alphaQuality:100,effort:6}).toBuffer();
    await writeFile(path.join(outputDir,`${e.id}.webp`),atlas);
    const [cx,cy]=e.face||[e.feet[0][0],e.feet[0][1]-370];
    const portrait={x:Math.round(256+(cx-e.feet[0][0])*e.scale),y:Math.round(480+(cy-e.feet[0][1])*e.scale),size:250};
    const anatomy=e.anatomy?{...e.anatomy,profileVersion:profile.version,
      packedSkull:e.anatomy.skull.map((n,i)=>Math.round((i%2?480:256)+(n-e.feet[0][i%2])*e.scale)),
      headWidth:Math.round((e.anatomy.skull[2]-e.anatomy.skull[0])*e.scale*10)/10,
      headHeight:Math.round((e.anatomy.skull[3]-e.anatomy.skull[1])*e.scale*10)/10,
      bodyBelowChin:Math.round((e.feet[0][1]-e.anatomy.skull[3])*e.scale*10)/10,
      heightClass:profile.heightClasses[e.id],heightClassApplied:false,
      scaleMethod:'uniform scale from estimated front skull area; no height multiplier'}:null;
    manifest.push({id:e.id,file:`${e.id}.webp`,width:1024,height:1024,cell:512,anchor:[256,480],directions:DIRECTIONS,portrait,sha256:sha(atlas),anatomy,source:{file:e.file,sha256:sha(source),scale:e.scale,feet:e.feet,face:e.face,splitY:split,anatomy:e.anatomy,...(e.alphaMode?{alphaMode:e.alphaMode}:{}),...(e.alphaOpaqueThreshold!==undefined?{alphaOpaqueThreshold:e.alphaOpaqueThreshold}:{})}});
    if(proofDir){
      const proof=[];
      for(let i=0;i<4;i++)for(let row=0;row<2;row++)proof.push({input:await sharp(atlas).extract({left:i%2*512,top:Math.floor(i/2)*512,width:512,height:512}).resize(128,128).png().toBuffer(),left:i*160+16,top:row*160+16});
      await sharp({create:{width:640,height:320,channels:4,background:'#213d49'}}).composite([{input:Buffer.from('<svg width="640" height="160"><rect width="640" height="160" fill="#eee8d5"/></svg>'),left:0,top:160},...proof]).png().toFile(path.join(proofDir,`${e.id}-directions.png`));
    }
    console.log(`Packed ${e.id}: four views, ${(atlas.length/1024).toFixed(0)} KiB`);
  }
  await writeFile(path.join(outputDir,'manifest.json'),JSON.stringify({version:2,generator:'Built-in image generation; offline anatomical landmark packing',anatomyPolicy:'Manual estimates of the skull and face, excluding hair volume, animal ears, horns, headgear and trailing hair. Approximate evidence; visual review remains necessary.',frames:manifest},null,2)+'\n');
  return manifest;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1];
  if(!args.includes('--source-dir')||!args.includes('--landmarks'))throw new Error('Usage: node scripts/pack_defense_directions.mjs --source-dir DIR --landmarks FILE [--proof-dir DIR]');
  const entries=JSON.parse(await readFile(option('--landmarks'),'utf8'));
  const manifest=await packDirections({sourceDir:option('--source-dir'),entries,outputDir:path.join(ROOT,'defense/assets/merge/units'),proofDir:args.includes('--proof-dir')?option('--proof-dir'):undefined});
  const portraits=Object.fromEntries(manifest.map(e=>[e.id,e.portrait]));
  await writeFile(path.join(ROOT,'defense/merge/art-frames.js'),`// Generated by scripts/pack_defense_directions.mjs from recorded anatomical estimates and foot landmarks.\nexport const PORTRAIT_FRAMES = ${JSON.stringify(portraits,null,2)};\n`);
}
