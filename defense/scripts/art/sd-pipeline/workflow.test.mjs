import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,realpath} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {policy,inheritedCheckIds,validatePolicy} from './policy.mjs';
import {sha,json,ref,inspect,receipt,setArtifact,validateDecisions,policyHash,STAGES,inputsFor} from './core.mjs';
import {decide,exportRun,statusOutput} from './pipeline.mjs';
import {placeFrameRGBA,protectedComposite,composeCandidate,createRun,inspectInputs,ingest} from './artifacts.mjs';
import {buildReview} from './review.mjs';
import {enforcePolicyHistory} from './history.mjs';
import {sharp} from './runtime.mjs';

// Synthetic fixtures below test workflow control and pixel operations. They are
// not generated character art, aesthetic passes, or a claimed image-tool trial.
const clone=x=>structuredClone(x);
function cleanup(t,run){
 t.after(async()=>{const target=await realpath(run),temp=await realpath(os.tmpdir());assert.equal(path.dirname(target).toLowerCase(),temp.toLowerCase());assert.match(path.basename(target),/^sd-(pipeline-test|pixels|input-control|compose-control)-/);await rm(target,{recursive:true,force:true});});
}
function passDecision(){return{reviewer:'unit-test-fixture',checks:policy.checks.map(c=>({id:c.id,status:'pass',note:'Synthetic control-test judgment; not an artistic review.',method:c.id==='anatomical-head'?'fixed-scale-visual-plus-landmarks':undefined,evidence:c.evidence,viewedScreenshotHashes:[]}))};}
async function fixture(t,mode='production',through='review'){
 const run=await mkdtemp(path.join(os.tmpdir(),'sd-pipeline-test-'));cleanup(t,run);
 const s={id:'fixture',name:'synthetic control fixture',mode,referenceKeys:['ref:original','ref:style','ref:structure','ref:baseline','ref:peer:1'],revision:1,artifacts:{},stages:{},events:[]};
 const write=async(key,content='synthetic fixture '+key)=>{const f=path.join(run,key.replaceAll(':','-')+'.txt');await writeFile(f,content);await setArtifact(s,key,f);return f;};
 for(const k of s.referenceKeys)await write(k);
 for(const id of STAGES){
  for(const k of inputsFor[id](s))if(!s.artifacts[k])await write(k,k==='decision'?json(passDecision()):['brief','anatomy','packing'].includes(k)?'{}':'synthetic fixture '+k);
  await receipt(s,id);if(id===through)break;
 }
 return{run,s,write};
}
test('all inherited checks are mandatory; deleting any single one fails',()=>{
 assert.equal(inheritedCheckIds.length,17);
 for(const id of inheritedCheckIds){const p=clone(policy);p.checks=p.checks.filter(c=>c.id!==id);assert.throws(()=>validatePolicy(p),new RegExp(id));}
});
test('disabling any inherited check also fails',()=>{
 for(const id of inheritedCheckIds){const p=clone(policy);p.checks.find(c=>c.id===id).required=false;assert.throws(()=>validatePolicy(p));}
});
test('new request adds a check without dropping A/B; missing new judgment fails',()=>{
 const p=clone(policy);p.checks.push({id:'future-addition',title:'new request',task:'Additional request',evidence:['head'],required:true});
 assert.ok(validatePolicy(p));assert.throws(()=>validateDecisions(passDecision(),p),/complete cumulative/);
 const d=passDecision();d.checks.push({id:'future-addition',status:'unreviewed',note:'Not performed yet; previous head and body checks remain.',evidence:[]});
 assert.equal(validateDecisions(d,p).pass,false);assert.ok(d.checks.some(c=>c.id==='anatomical-head'));
});
test('performing only the latest body instruction cannot complete a review',()=>{
 const d=passDecision();d.checks=d.checks.filter(c=>c.id==='body-proportions');assert.throws(()=>validateDecisions(d),/complete cumulative/);
});
test('normalization cannot be presented as independent anatomical-head approval',()=>{
 const d=passDecision();d.checks.find(c=>c.id==='anatomical-head').method='same-normalized-area';assert.throws(()=>validateDecisions(d),/Normalization/);
});
test('face detector boxes alone cannot approve anatomical-head',()=>{
 const d=passDecision();d.checks.find(c=>c.id==='anatomical-head').method='face-detector';assert.throws(()=>validateDecisions(d),/Normalization/);
});
test('a pass without every required evidence group is rejected',()=>{
 const d=passDecision();d.checks.find(c=>c.id==='anatomical-head').evidence=['measurements'];assert.throws(()=>validateDecisions(d),/Missing required evidence/);
});
test('unreviewed and caution are blockers, not implicit pass',()=>{
 for(const status of ['unreviewed','caution','fail']){const d=passDecision();d.checks.find(c=>c.id==='outline-weight').status=status;assert.equal(validateDecisions(d).pass,false);}
});
test('A to G stage order prevents jumping directly to packing',async t=>{
 const {s}=await fixture(t,'production','inputs');await assert.rejects(()=>receipt(s,'pack'),/Stage order/);
});
test('missing artifacts cannot be stamped as completed',async t=>{
 const {s}=await fixture(t,'production','inputs');await assert.rejects(()=>receipt(s,'generation'),/artifacts missing/);
});
test('unchanged hashes preserve completed checks without another generation',async t=>{
 const {s}=await fixture(t);const a=await inspect(s),b=await inspect(s);assert.equal(a.stages[4].status,'pass');assert.deepEqual(a.stages,b.stages);
});
test('whole-body regeneration invalidates prior HEAD, body and style decisions',async t=>{
 const {s,write}=await fixture(t,'production','decision');
 assert.equal((await statusOutput(s)).checks.find(c=>c.id==='anatomical-head').status,'pass');
 await write('raw','new whole-body generated pixels');
 const info=await statusOutput(s);assert.equal(info.stages[1].status,'stale');
 for(const id of ['anatomical-head','body-proportions','outline-weight'])assert.equal(info.checks.find(c=>c.id===id).status,'stale');
 assert.equal(info.eligibleToExport,false);
});
test('changing a frozen style input invalidates all downstream work',async t=>{
 const {s}=await fixture(t);await writeFile(s.artifacts['ref:style'].file,'changed style');const info=await inspect(s);
 assert.ok(info.stages.every(c=>c.status==='stale'||c.status==='pending'));assert.equal(info.stages[0].status,'stale');
});
test('policy change reopens previous head/body/style reviews',async t=>{
 const {s}=await fixture(t,'production','decision'),p=clone(policy);p.warningLimits.eyeY=7;
 const info=await inspect(s,p);assert.equal(info.stages[0].status,'stale');assert.equal(info.stages[5].status,'stale');
});
test('manual landmark edits invalidate pack and every later visual decision',async t=>{
 const {s}=await fixture(t,'production','decision');await writeFile(s.artifacts.anatomy.file,'remeasured anatomy');
 const info=await inspect(s);assert.equal(info.stages[2].status,'stale');assert.equal(info.stages[5].status,'stale');
});
test('editing a final portrait also reopens final review conservatively',async t=>{
 const {s}=await fixture(t,'production','decision');await writeFile(s.artifacts.portrait.file,'changed crop');const info=await inspect(s);
 assert.equal(info.stages[3].status,'stale');assert.equal(info.stages[5].status,'stale');
});
test('a changed screenshot invalidates the review and its later decisions',async t=>{
 const {s,write}=await fixture(t,'production','pack');await write('auditReport');await write('checkerSource');await write('reviewHtml');await write('reviewEvidence');await write('capture:head');
 await receipt(s,'review');await write('decision',json(passDecision()));await receipt(s,'decision');
 await writeFile(s.artifacts['capture:head'].file,'changed image');const info=await inspect(s);
 assert.equal(info.stages[4].status,'stale');assert.equal(info.stages[5].status,'stale');
});
test('an older image/policy binding cannot sign the new candidate',async t=>{
 const {run,s}=await fixture(t);const d=passDecision();d.bindings={policySha256:'old'};
 await assert.rejects(()=>decide(run,s,d),/older pixels/);
});
test('quality block prevents export, even with all earlier processing passed',async t=>{
 const {run,s,write}=await fixture(t);await write('decision',json(passDecision()));await receipt(s,'decision',{outcome:'blocked',reasons:['anatomical-head: caution']});
 await assert.rejects(()=>exportRun(run,s),/requires decision to pass/);
});
test('historical audit specimens cannot be exported as controlled production',async t=>{
 const {run,s}=await fixture(t,'audit','decision');await assert.rejects(()=>exportRun(run,s),/Historical audit/);assert.equal((await inspect(s)).eligibleToExport,false);
});
test('a controlled all-pass fixture exports and copied-file changes revoke readiness',async t=>{
 const {run,s}=await fixture(t,'production','decision');const out=await exportRun(run,s);assert.equal((await inspect(s)).ready,true);
 await writeFile(out.files[0].file,'changed export');assert.equal((await inspect(s)).stages[6].status,'stale');assert.equal((await inspect(s)).ready,false);
});
test('alpha32 clipping regression:32 is rejected,31 remains permitted noise',()=>{
 const p=Buffer.alloc(4);p[3]=32;assert.equal(placeFrameRGBA(p,1,[-1,0]).clipped,1);p[3]=31;assert.equal(placeFrameRGBA(p,1,[-1,0]).clipped,0);
});
test('increasing clipping threshold to40 cannot weaken inherited alpha32 gate',()=>{
 const p=clone(policy);p.clippingAlpha=40;assert.throws(()=>validatePolicy(p),/alpha32/);
});
test('protected regional composition preserves HEAD and all pixels outside mask',async t=>{
 const run=await mkdtemp(path.join(os.tmpdir(),'sd-pixels-'));cleanup(t,run);
 const base=path.join(run,'base.png'),candidate=path.join(run,'candidate.png'),mask=path.join(run,'mask.png');
 await sharp({create:{width:16,height:16,channels:4,background:'#112233ff'}}).png().toFile(base);
 await sharp({create:{width:16,height:16,channels:4,background:'#ff7733ff'}}).png().toFile(candidate);
 const m=Buffer.alloc(256);for(let y=0;y<12;y++)for(let x=0;x<12;x++)m[y*16+x]=255;
 await sharp(m,{raw:{width:16,height:16,channels:1}}).png().toFile(mask);
 const result=await protectedComposite(base,candidate,mask,[[0,0,8,8]]),a=await sharp(base).raw().toBuffer(),b=await sharp(result.png).raw().toBuffer();
 for(let y=0;y<16;y++)for(let x=0;x<16;x++){const k=(y*16+x)*4;if(x<8&&y<8||x>=12||y>=12)assert.deepEqual(a.subarray(k,k+4),b.subarray(k,k+4));}
 assert.ok(result.changed>0);assert.equal(result.outsideMaskChanges,0);
});
test('the declared pipeline contains an independent head check AND body/style checks',()=>{
 const head=policy.checks.find(c=>c.id==='anatomical-head');assert.ok(head.task.includes('정규화 수치만으로 합격시키지'));
 for(const id of ['body-proportions','outline-weight','shading-material','cast-consistency'])assert.ok(policy.checks.find(c=>c.id===id).required);
});
async function productionInputFixture(t){
 const run=await mkdtemp(path.join(os.tmpdir(),'sd-input-control-'));cleanup(t,run);
 const file=path.join(run,'reference-fixture.png');await sharp({create:{width:16,height:16,channels:4,background:'#778899ff'}}).png().toFile(file);
 const s=await createRun(path.join(run,'case'),{id:'control-fixture',name:'Synthetic input control',heightClass:'medium',original:file,style:file,structure:file,baseline:file,identityNotes:'Synthetic references test file binding, not original character quality.',equipmentNotes:'Synthetic example with no equipment.',peers:[1,2,3].map(id=>({id:'peer'+id,file,name:'Synthetic peer'}))});
 const report={reviewer:'synthetic-test',policySha256:policyHash(policy),inputHashes:Object.fromEntries(s.referenceKeys.map(k=>[k,s.artifacts[k].sha256])),observations:Object.fromEntries(s.referenceKeys.map(k=>[k,'Synthetic observed input for workflow-control test only.']))};
 return{run:path.join(run,'case'),s,report,file};
}
test('the actual prepared job includes every inherited requirement and explicit SD ratio',async t=>{
 const {s}=await productionInputFixture(t),job=JSON.parse(await readFile(s.artifacts.job.file,'utf8'));
 assert.ok(job.prompt.includes('TWO-HEAD-TALL'));
 for(const id of inheritedCheckIds)assert.ok(job.prompt.includes(id));
 assert.equal((await inspect(s)).stages[0].status,'pending');
});
test('generation cannot be ingested before the source pictures were inspected',async t=>{
 const {run,s,file}=await productionInputFixture(t);await assert.rejects(()=>ingest(run,s,file,{}),/Stage order/);
});
test('an input observation missing one role cannot complete A',async t=>{
 const {run,s,report}=await productionInputFixture(t);delete report.observations['ref:structure'];
 await assert.rejects(()=>inspectInputs(run,s,report),/actually seen/);
});
test('changing an inspected source invalidates A before another generation',async t=>{
 const {run,s,report,file}=await productionInputFixture(t);await inspectInputs(run,s,report);await writeFile(file,'changed reference');
 await assert.rejects(()=>ingest(run,s,file,{}),/requires inputs to pass/);
});
test('wrong native tool output cannot be substituted for the generated source',async t=>{
 const {run,s,report,file}=await productionInputFixture(t);await inspectInputs(run,s,report);
 const raw=path.join(run,'not-a-character-test-atlas.png');await sharp({create:{width:1024,height:1024,channels:4,background:'#22334400'}}).png().toFile(raw);
 const job=JSON.parse(await readFile(s.artifacts.job.file,'utf8'));
 await assert.rejects(async()=>ingest(run,s,raw,{tool:'image_gen',toolOutput:'synthetic-control-only',toolOutputPath:file,rawSha256:(await ref(raw)).sha256,jobSha256:s.artifacts.job.sha256,policySha256:policyHash(policy),referenceHashes:job.inputs.map(k=>k.sha256),method:'fresh-four-view'}),/not the actual tool output/);
 assert.equal(s.revision,0);
});
test('the independent checker cannot disappear when a new review book is added',async t=>{
 const {run,s}=await fixture(t,'production','pack');await assert.rejects(()=>buildReview(run,s),/Independent imgutils\/ONNX audit is required/);
});
test('a second generated image gets a new run rather than inheriting old reviews',async t=>{
 const {run,s,file,report}=await productionInputFixture(t);
 // Complete the exact current input review, then emulate an already collected
 // first source. The second source is rejected before it can overwrite it.
 await inspectInputs(run,s,report);s.revision=1;await assert.rejects(()=>ingest(run,s,file,{}),/NEW run/);
});
test('regional composition requires explicit canvas resampling and preserves the protected head',async t=>{
 const run=await mkdtemp(path.join(os.tmpdir(),'sd-compose-control-'));cleanup(t,run);
 const base=path.join(run,'base.png'),candidate=path.join(run,'candidate.png'),mask=path.join(run,'mask.png');
 await sharp({create:{width:16,height:16,channels:4,background:'#334455ff'}}).png().toFile(base);
 await sharp({create:{width:32,height:32,channels:4,background:'#ee5522ff'}}).png().toFile(candidate);
 await sharp(Buffer.alloc(256,255),{raw:{width:16,height:16,channels:1}}).png().toFile(mask);
 const spec={baseFile:base,maskFile:mask,protectedRects:[[0,0,16,8]]};
 await assert.rejects(()=>composeCandidate(spec,candidate),/Explicit square-canvas/);
 const result=await composeCandidate({...spec,allowIsotropicCanvasResample:true},candidate);
 assert.equal(result.outsideMaskChanges,0);assert.ok(result.changed>0);assert.equal(result.outputSha256,sha(result.png));
 const pixels=await sharp(result.png).raw().toBuffer(),original=await sharp(base).raw().toBuffer();assert.deepEqual(pixels.subarray(0,16*8*4),original.subarray(0,16*8*4));
});
test('a controlled protected edit must reproduce its proof before collection',async t=>{
 const parent=await mkdtemp(path.join(os.tmpdir(),'sd-compose-control-'));cleanup(t,parent);
 const base=path.join(parent,'new-painting-fixture.png'),candidate=path.join(parent,'native-candidate-fixture.png'),mask=path.join(parent,'mask.png');
 await sharp({create:{width:1024,height:1024,channels:4,background:'#112233ff'}}).png().toFile(base);
 await sharp({create:{width:1024,height:1024,channels:4,background:'#dd4422ff'}}).png().toFile(candidate);
 await sharp(Buffer.alloc(1024*1024,255),{raw:{width:1024,height:1024,channels:1}}).png().toFile(mask);
 const edit={baseFile:base,maskFile:mask,protectedRects:[[0,0,1024,250]],reason:'Synthetic control fixture tests an actual protected composite, not character image quality.'},run=path.join(parent,'case');
 const s=await createRun(run,{id:'synthetic-protected',name:'Synthetic protected workflow',heightClass:'medium',original:base,style:base,structure:base,baseline:base,identityNotes:'Synthetic source provenance fixture for testing only.',equipmentNotes:'No actual equipment design.',peers:[1,2,3].map(i=>({id:'peer'+i,name:'Fixture peer',file:base})),edit});
 const report={reviewer:'synthetic-test',policySha256:policyHash(policy),inputHashes:Object.fromEntries(s.referenceKeys.map(k=>[k,s.artifacts[k].sha256])),observations:Object.fromEntries(s.referenceKeys.map(k=>[k,'Synthetic inspection of the bound input fixture.']))};
 await inspectInputs(run,s,report);
 const result=await composeCandidate(edit,candidate),image=path.join(parent,'composite.png'),proof=path.join(parent,'proof.json');await writeFile(image,result.png);
 const {png,...metadata}=result;await writeFile(proof,json({...metadata,outsideMaskChanges:1}));
 const job=JSON.parse(await readFile(s.artifacts.job.file,'utf8')),record={tool:'image_gen',toolOutput:'SYNTHETIC-CONTROL-FIXTURE-NO-API-CALL',toolOutputPath:candidate,rawSha256:sha(result.png),jobSha256:s.artifacts.job.sha256,policySha256:policyHash(policy),referenceHashes:job.inputs.map(i=>i.sha256),method:'protected-regional-edit',compositeProof:proof};
 await assert.rejects(()=>ingest(run,s,image,record));assert.equal(s.revision,0);
 await writeFile(proof,json(metadata));await ingest(run,s,image,record);
 assert.equal((await inspect(s)).stages[1].status,'pass');assert.equal(s.artifacts.nativeOutput.sha256,(await ref(candidate)).sha256);assert.ok(s.artifacts.compositeProof);
 await writeFile(s.artifacts.compositeProof.file,'modified proof');assert.equal((await inspect(s)).stages[1].status,'stale');
});
test('a later request cannot lose a check added AFTER the initial baseline',async t=>{
 const run=await mkdtemp(path.join(os.tmpdir(),'sd-pipeline-test-'));cleanup(t,run);const directory=path.join(run,'history');
 await enforcePolicyHistory(directory,policy,{record:true});
 const newer=clone(policy);newer.checks.push({id:'future-neck-check',title:'future requirement',task:'Inspect a newly requested neck requirement',evidence:['head'],required:true});
 await enforcePolicyHistory(directory,newer,{record:true});
 await assert.rejects(()=>enforcePolicyHistory(directory,policy),/previously adopted.*future-neck-check/);
 const newest=clone(newer);newest.checks.push({id:'future-second-check',title:'another requirement',task:'Another cumulative requested check',evidence:['head'],required:true});
 await enforcePolicyHistory(directory,newest,{record:true});assert.ok(newest.checks.some(c=>c.id==='anatomical-head'));
});
