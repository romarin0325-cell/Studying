import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {policy} from './policy.mjs';
import {sha,json,ref,setArtifact,receipt,requirePrevious,event,policyHash,STAGES} from './core.mjs';
import {sharp,segment} from './runtime.mjs';

const dirs=['down','up','left','right'];
const imageRoles=['original','style','structure','baseline'];
export function placeFrameRGBA(source,pixels,shift,alphaThreshold=policy.clippingAlpha){
 const dest=Buffer.alloc(512*512*4);let clipped=0;
 for(let y=0;y<pixels;y++)for(let x=0;x<pixels;x++){
  const k=(y*pixels+x)*4,dx=x+shift[0],dy=y+shift[1];
  if(dx<0||dx>=512||dy<0||dy>=512){if(source[k+3]>=alphaThreshold)clipped++;continue;}
  source.copy(dest,(dy*512+dx)*4,k,k+4);
 }
 return{dest,clipped};
}
export async function createRun(run,brief,{mode='production'}={}){
 assert.ok(['production','audit'].includes(mode));
 assert.ok(brief.id&&brief.name&&brief.identityNotes&&brief.equipmentNotes,'Explicit character/design/equipment brief required');
 assert.ok(['short','medium','tall'].includes(brief.heightClass));
 assert.ok(Array.isArray(brief.peers)&&brief.peers.length>=3,'At least three fixed peers required');
 await mkdir(run,{recursive:true});
 const state={version:1,id:brief.id,name:brief.name,mode,revision:0,referenceKeys:[],artifacts:{},stages:{},events:[]};
 // Never overwrite another run's execution history.
 await writeFile(path.join(run,'run.json'),json(state),{flag:'wx'});
 await writeFile(path.join(run,'brief.json'),json(brief),{flag:'wx'});await setArtifact(state,'brief',path.join(run,'brief.json'));
 for(const role of imageRoles){assert.ok(brief[role],'Missing '+role);const key='ref:'+role;await setArtifact(state,key,brief[role]);state.referenceKeys.push(key);}
 for(const [i,p]of brief.peers.entries()){assert.ok(p.id&&p.file);const key='ref:peer:'+p.id;assert.ok(!state.referenceKeys.includes(key),'Duplicate peer');await setArtifact(state,key,p.file);state.referenceKeys.push(key);}
 if(brief.edit){
  assert.ok(brief.edit.reason?.length>=20&&brief.edit.baseFile&&brief.edit.maskFile,'A regional edit needs an explicit reason, base and allowed mask');
  assert.ok(Array.isArray(brief.edit.protectedRects)&&brief.edit.protectedRects.length,'State protected regions explicitly');
  for(const [role,file]of [['edit-base',brief.edit.baseFile],['edit-mask',brief.edit.maskFile]]){const key='ref:'+role;await setArtifact(state,key,file);state.referenceKeys.push(key);}
 }
 const customInputs=[];
 for(const [index,r]of (brief.generationReferences||[]).entries()){
  assert.ok(r.role&&r.file,'Explicit generation reference role/file required');
  const key='ref:generation:'+index;await setArtifact(state,key,r.file);state.referenceKeys.push(key);customInputs.push({role:r.role,...state.artifacts[key]});
 }
 const inputs={scope:mode,character:brief.id,policySha256:policyHash(policy),references:state.referenceKeys.map(key=>({role:key,...state.artifacts[key]})),observations:mode==='audit'?{historical:'Read-only import of existing production records. This is not retroactive pre-generation approval.'}:null};
 await writeFile(path.join(run,'inputs.json'),json(inputs));await setArtifact(state,'inputs',path.join(run,'inputs.json'));
 const body=policy.frame.bodyBelowChin[brief.heightClass];
 const prompt=`Use case: finished stylized SD game sprite atlas. Create a NEW character painting from the ORIGINAL DESIGN, never a pixel deformation of the old sprite.
Input roles in the exact recorded order: ${customInputs.length?customInputs.map((r,i)=>'Image'+(i+1)+' '+r.role).join('; '):'original design; frozen SD style; shared body/head structure; old SD identity reference'}.${brief.edit?' Additional inputs are the NEW candidate edit-base and allowed edit-mask.':''} Fixed peers are used in QA, not silently mixed into the generation inputs.
Character: ${brief.name}. Original identity and costume: ${brief.identityNotes}
Anatomical equipment ownership and occlusion: ${brief.equipmentNotes}
Natural quiet standing / slight readiness. Tiny individual expression and slight head angle, not a dramatic attack pose. Gently rounded SD cheeks and selective cel highlights like the frozen style.
TWO-HEAD-TALL compact SD body: skull about160x150px in each512px cell, profile depth about144px. Below-chin body about${body}px (${(body/150).toFixed(2)} skull heights), short torso and short thighs/shins. Keep the same actual skull across body classes. Do not copy adult body proportions from the full illustration.
The head is the ANATOMICAL SKULL AND FACE. Exclude hair volume, ears, hats, horns, ornaments, weapons and background motifs. No accessory-bound auto fitting. All four views use one scale and sole(256,480), matching eyes/chin/shoulders/hips. Do not squash/stretch a face, body or limb to meet the numbers. Tiny head tilt uses a rotated head volume, not a larger bounding-box head.
Exact four-view2x2 atlas: down/front top-left, up/back top-right, actual left profile bottom-left, actual right profile bottom-right. Quiet orthographic game camera. One character rotated; preserve equipment hand, attachment, front/far arm occlusion and original asymmetry. Shared reflected profile may be used only with anatomical accessories restored locally.
Outer contour fine definite navy/brown about1.5–2.5px at512px cell, finer colored internal lines. Match jaw/sleeve/foot contour weight, shadow edges and material highlights to the frozen reference. No thick sticker border or almost lineless watercolor edge. Costume construction, material and original silhouette remain; simplify only for SD legibility.
Actual transparency, complete figures, margins, no scenery/ground shadow/text/guides. Readable64/96px. Original and baseline are references, not files to overwrite.
Required review contract after generation (all remain mandatory): ${policy.checks.map(c=>c.id).join(', ')}.
${brief.edit?'REGIONAL EDIT ON A NEW PAINTING: '+brief.edit.reason+' Use the new edit-base and mask. Preserve the protected head/identity; change only the permitted region. The model output will be code-composited within the allowed mask and every visual gate will be reviewed again. Do not use the old game pixels as the edited base.':''}
${brief.extraPrompt||''}`;
 const generationInputs=customInputs.length?[...customInputs,...inputs.references.filter(r=>['ref:edit-base','ref:edit-mask'].includes(r.role))]:inputs.references.filter(r=>!r.role.startsWith('ref:peer:'));
 const actualPrompt=brief.generationPrompt?brief.generationPrompt+'\nAll cumulative post-generation checks remain required: '+policy.checks.map(c=>c.id).join(', ')+'.':prompt;
 const job={tool:'image_gen',policySha256:policyHash(policy),preparedAt:new Date().toISOString(),prompt:actualPrompt,transparent_background:true,referencePaths:generationInputs.map(r=>r.file),inputs:generationInputs,qaPeers:inputs.references.filter(r=>r.role.startsWith('ref:peer:')),outputRole:'new-four-view-painting'};
 await writeFile(path.join(run,'job.json'),json(job));await setArtifact(state,'job',path.join(run,'job.json'));
 if(mode==='audit')await receipt(state,'inputs',{detail:{kind:'historical-import',preGenerationApproval:false}});
 event(state,'created',{mode});return state;
}
export async function inspectInputs(run,state,report){
 assert.equal(state.mode,'production','Historical audit imports are not pre-generation inspection');
 assert.equal(report.policySha256,policyHash(policy));
 assert.ok(report.reviewer&&report.observations);
 for(const key of state.referenceKeys){
  assert.equal(report.inputHashes?.[key],state.artifacts[key].sha256,'Input review bound to old/missing reference '+key);
  assert.ok(typeof report.observations[key]==='string'&&report.observations[key].length>=8,'Record what was actually seen: '+key);
  assert.equal((await ref(state.artifacts[key].file)).sha256,state.artifacts[key].sha256,'Changed input '+key);
 }
 const inputs=JSON.parse(await readFile(state.artifacts.inputs.file,'utf8'));inputs.observations=report;
 assert.equal(inputs.policySha256,policyHash(policy),'Input/job policy changed; create a new run instead of retroactively approving old instructions');
 assert.equal(JSON.parse(await readFile(state.artifacts.job.file,'utf8')).policySha256,policyHash(policy),'Prepared job is for an older policy');
 await writeFile(state.artifacts.inputs.file,json(inputs));await setArtifact(state,'inputs',state.artifacts.inputs.file);
 await receipt(state,'inputs',{detail:{kind:'operator-vision-review',reviewer:report.reviewer}});
}
export async function ingest(run,state,source,record){
 await requirePrevious(state,'generation');
 assert.equal(state.revision,0,'A new generation/refinement gets a NEW run with the same cumulative policy. Do not overwrite the previous run or its reviews.');
 const sourceRef=await ref(source),meta=await sharp(source).metadata();
 assert.ok(meta.width===meta.height&&meta.width>=1024&&meta.channels===4,'Transparent square four-view source required');
 assert.equal(record.rawSha256,sourceRef.sha256,'Source log does not identify actual raw pixels');
 assert.ok(record.tool==='image_gen'&&record.toolOutput,'Actual built-in tool output identifier required');
 let compositionRecord=null;
 if(state.mode==='production'){
  assert.equal(record.jobSha256,state.artifacts.job.sha256,'Generation must use the frozen job');
  assert.equal(record.policySha256,policyHash(policy),'Generation policy is stale');
  const job=JSON.parse(await readFile(state.artifacts.job.file,'utf8'));
  assert.equal(job.policySha256,policyHash(policy),'Prepared generation job is stale');
  assert.deepEqual(record.referenceHashes,job.inputs.map(k=>k.sha256),'Actual generation references differ from prepared job');
  assert.ok(!record.historical,'A historical import is not a new controlled generation');
  assert.ok(record.toolOutputPath&&path.isAbsolute(record.toolOutputPath),'Actual native tool-output file required');
  if(record.method==='protected-regional-edit'){
   const spec=JSON.parse(await readFile(state.artifacts.brief.file,'utf8')).edit;assert.ok(spec,'No frozen edit specification');
   assert.ok(record.compositeProof,'A claimed protected edit needs the actual composition proof');
   const proof=JSON.parse(await readFile(record.compositeProof,'utf8'));
   assert.equal(proof.outputSha256,sourceRef.sha256);
   assert.equal(proof.candidateOriginal.sha256,(await ref(record.toolOutputPath)).sha256);
   assert.equal(proof.baseSha256,state.artifacts['ref:edit-base'].sha256);
   assert.equal(proof.maskSha256,state.artifacts['ref:edit-mask'].sha256);
   assert.deepEqual(proof.protectedRects,spec.protectedRects);assert.equal(proof.outsideMaskChanges,0);
   const reproduced=await composeCandidate(spec,record.toolOutputPath);assert.equal(sha(reproduced.png),sourceRef.sha256,'Protected composition is not reproducible from the frozen base/mask/candidate');
   const {png,...canonicalProof}=reproduced;compositionRecord=canonicalProof;
  }else assert.equal((await ref(record.toolOutputPath)).sha256,sourceRef.sha256,'Ingested source is not the actual tool output');
 }
 assert.ok(['fresh-four-view','whole-body-refinement','protected-regional-edit'].includes(record.method));
 state.revision++;const dest=path.join(run,'source','r'+state.revision+'.png');await mkdir(path.dirname(dest),{recursive:true});
 await copyFile(source,dest);await setArtifact(state,'raw',dest);
 if(state.mode==='production'){
  const native=path.join(run,'source','r'+state.revision+'-native.png');await copyFile(record.toolOutputPath,native);await setArtifact(state,'nativeOutput',native);
  if(compositionRecord){const proof=path.join(run,'source','r'+state.revision+'-composition.json');await writeFile(proof,json(compositionRecord));await setArtifact(state,'compositeProof',proof);}
 }
 const log=path.join(run,'source','r'+state.revision+'-generation.json');await writeFile(log,json({...record,source:sourceRef,dimensions:[meta.width,meta.height],revision:state.revision}));await setArtifact(state,'generation',log);
 await receipt(state,'generation',{detail:{method:record.method,historical:state.mode==='audit'}});
}

export async function composeCandidate(spec,candidateFile){
 const b=await sharp(spec.baseFile).metadata(),c=await sharp(candidateFile).metadata();let alignedFile=candidateFile,aligned=null;
 if(b.width!==c.width||b.height!==c.height){
  assert.ok(spec.allowIsotropicCanvasResample&&b.width===b.height&&c.width===c.height,'Explicit square-canvas resample permission required; no silent fitting');
  aligned=await sharp(candidateFile).resize(b.width,b.height).png().toBuffer();
  // The helper accepts image buffers as well as paths. This rescales the whole
  // atlas canvas, never a head, limb or accessory bounding box separately.
  alignedFile=aligned;
 }
 const result=await protectedComposite(spec.baseFile,alignedFile,spec.maskFile,spec.protectedRects);
 return{...result,candidateOriginal:await ref(candidateFile),canvasResample:aligned?{from:[c.width,c.height],to:[b.width,b.height],method:'isotropic whole square canvas'}:null,outputSha256:sha(result.png)};
}
export async function attachAnatomy(run,state,record){
 await requirePrevious(state,'anatomy');
 assert.equal(record.rawSha256,state.artifacts.raw.sha256,'Landmarks refer to a different generated image');
 assert.equal(record.coordinateSpace,'unwarped-512-cell','Do not use warped target points as observed anatomy');
 assert.ok(record.measuredBy&&record.uncertainty&&record.exclusions==='hair-hats-ears-horns-ornaments-equipment');
 assert.equal(record.views.length,4);
 for(const [i,v]of record.views.entries()){
  assert.equal(v.skullEllipse.length,5);assert.ok(v.skullEllipse.every(Number.isFinite));
  assert.ok(v.skullEllipse[2]>0&&v.skullEllipse[3]>0);
  for(const k of ['chin','shoulders','hips','sole'])assert.ok(v[k]?.length===2&&v[k].every(Number.isFinite),'Missing actual/inferred '+k+' in view '+i);
  if(i!==1)assert.ok(v.eyeLeft||v.eyeRight,'Visible eye measurement required');
 }
 const dest=path.join(run,'source','r'+state.revision+'-anatomy-'+sha(json(record)).slice(0,10)+'.json');await writeFile(dest,json(record));await setArtifact(state,'anatomy',dest);await receipt(state,'anatomy',{detail:{inferred:true,independentProof:false}});
}
export async function normalize(run,state){
 await requirePrevious(state,'pack');
 const brief=JSON.parse(await readFile(state.artifacts.brief.file,'utf8'));
 const anatomy=JSON.parse(await readFile(state.artifacts.anatomy.file,'utf8'));
 assert.equal(anatomy.rawSha256,state.artifacts.raw.sha256);
 const seg=await segment(state.artifacts.raw.file),front=anatomy.views[0].skullEllipse;
 const wanted=Math.sqrt(policy.frame.frontSkull[0]*policy.frame.frontSkull[1]/(front[2]*front[3])),pixels=Math.round(512*wanted),scale=pixels/512;
 assert.ok(scale>.65&&scale<1.5,'Extreme inferred skull scale; remeasure or redraw');
 const tag='r'+state.revision+'-'+state.artifacts.anatomy.sha256.slice(0,8)+'-'+policyHash(policy).slice(0,8),out=path.join(run,'work',tag);await mkdir(out,{recursive:true});
 const frames=[],views=[];
 for(let i=0;i<4;i++){
  const cell={left:i%2*512,top:Math.floor(i/2)*512,width:512,height:512};
  const base=await sharp(seg.pixels[i],{raw:seg.info}).resize(1024,1024).extract(cell).png().toBuffer();
  const source=await sharp(base).resize(pixels,pixels).ensureAlpha().raw().toBuffer(),v=anatomy.views[i];
  const shift=[256-Math.round(v.sole[0]*scale),480-Math.round(v.sole[1]*scale)],{dest,clipped}=placeFrameRGBA(source,pixels,shift);
  assert.equal(clipped,0,state.id+' '+dirs[i]+' clipped alpha32 pixels. No accessory auto-fit fallback.');
  const project=([x,y])=>[+(x*scale+shift[0]).toFixed(2),+(y*scale+shift[1]).toFixed(2)];
  const marks=Object.fromEntries(Object.entries(v).filter(([k])=>k!=='skullEllipse').map(([k,p])=>[k,project(p)]));
  const e=v.skullEllipse,skull=[...project(e),+(e[2]*scale).toFixed(2),+(e[3]*scale).toFixed(2),e[4]],h=skull[3];
  views.push({direction:dirs[i],marks,skullEllipse:skull,headBody:(480-marks.chin[1])/h,torso:(marks.hips[1]-marks.shoulders[1])/h,legs:(480-marks.hips[1])/h,shift,clipped});
  frames.push(await sharp(dest,{raw:{width:512,height:512,channels:4}}).png().toBuffer());
 }
 const atlas=await sharp({create:{width:1024,height:1024,channels:4,background:'#00000000'}}).composite(frames.map((input,i)=>({input,left:i%2*512,top:Math.floor(i/2)*512}))).png().toBuffer();
 const webp=await sharp(atlas).webp({lossless:true,effort:6}).toBuffer();
 const a=await sharp(atlas).ensureAlpha().raw().toBuffer(),b=await sharp(webp).ensureAlpha().raw().toBuffer();let pixelChanges=0;
 for(let k=0;k<a.length;k+=4)if(a[k+3]!==b[k+3]||(a[k+3]>0&&!a.subarray(k,k+4).equals(b.subarray(k,k+4))))pixelChanges++;
 assert.equal(pixelChanges,0);
 for(const [key,bytes]of [['atlas',atlas],['webp',webp],...frames.map((f,i)=>[dirs[i],f])]){
  const file=path.join(out,key+(key==='webp'?'.webp':'.png'));await writeFile(file,bytes);await setArtifact(state,key,file);
 }
 const m=views[0].marks,eyes=[m.eyeLeft,m.eyeRight].filter(Boolean),eyeX=eyes.reduce((s,p)=>s+p[0],0)/eyes.length,eyeY=eyes.reduce((s,p)=>s+p[1],0)/eyes.length;
 const size=brief.portraitSize||250,center=[Math.round((eyeX+m.chin[0])/2),Math.round(eyeY-size*.125)];
 const crop={left:Math.round(center[0]-size/2),top:Math.round(center[1]-size/2),width:size,height:size};
 const portrait=await sharp(atlas).extract(crop).resize(240,240).webp({lossless:true,effort:6}).toBuffer();
 const portraitFile=path.join(out,'portrait.webp');await writeFile(portraitFile,portrait);await setArtifact(state,'portrait',portraitFile);
 const record={rawSha256:state.artifacts.raw.sha256,anatomySha256:state.artifacts.anatomy.sha256,policySha256:policyHash(policy),commonScale:scale,nonRigidWarp:false,perDirectionScale:false,alphaThreshold:policy.clippingAlpha,visibleWebpChanges:pixelChanges,views,portrait:{crop,center,size:240},normalizationIsIndependentProof:false};
 const pf=path.join(out,'packing.json');await writeFile(pf,json(record));await setArtifact(state,'packing',pf);await receipt(state,'pack',{detail:{alphaThreshold:32,commonScale:scale,visibleWebpChanges:pixelChanges}});
 return record;
}

export async function protectedComposite(baseFile,candidateFile,maskFile,protectedRects=[]){
 const baseImage=await sharp(baseFile).ensureAlpha().raw().toBuffer({resolveWithObject:true}),{width,height}=baseImage.info;
 const ci=await sharp(candidateFile).metadata(),mi=await sharp(maskFile).metadata();
 assert.deepEqual([ci.width,ci.height],[width,height],'Candidate coordinates differ; do not silently resize an edit');
 assert.deepEqual([mi.width,mi.height],[width,height]);
 const base=baseImage.data,candidate=await sharp(candidateFile).ensureAlpha().raw().toBuffer(),mask=await sharp(maskFile).removeAlpha().greyscale().raw().toBuffer(),out=Buffer.from(base);
 let changed=0,allowed=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*width+x,k=i*4,protectedPixel=protectedRects.some(([px,py,pw,ph])=>x>=px&&x<px+pw&&y>=py&&y<py+ph);
  const m=protectedPixel?0:mask[i]/255;if(!m)continue;allowed++;
  const a0=base[k+3]/255,a1=candidate[k+3]/255,a=a0*(1-m)+a1*m;
  for(let c=0;c<3;c++)out[k+c]=a?Math.round((base[k+c]*a0*(1-m)+candidate[k+c]*a1*m)/a):0;
  out[k+3]=Math.round(a*255);if(!out.subarray(k,k+4).equals(base.subarray(k,k+4)))changed++;
 }
 assert.ok(allowed>0,'Empty allowed region');
 let outsideMaskChanges=0;for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*width+x,k=i*4,locked=!mask[i]||protectedRects.some(([px,py,pw,ph])=>x>=px&&x<px+pw&&y>=py&&y<py+ph);
  if(locked&&!out.subarray(k,k+4).equals(base.subarray(k,k+4)))outsideMaskChanges++;
 }
 assert.equal(outsideMaskChanges,0);
 return{png:await sharp(out,{raw:{width,height,channels:4}}).png().toBuffer(),baseSha256:sha(await readFile(baseFile)),candidateSha256:sha(Buffer.isBuffer(candidateFile)?candidateFile:await readFile(candidateFile)),maskSha256:sha(await readFile(maskFile)),protectedRects,allowed,changed,outsideMaskChanges,meaning:'Code preserves protected pixels; neck/hair/hand seams still require a fresh visual decision.'};
}
