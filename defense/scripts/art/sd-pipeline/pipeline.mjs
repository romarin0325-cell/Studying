import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {policy} from './policy.mjs';
import {json,sha,ref,load,save,inspect,receipt,setArtifact,validateDecisions,requirePrevious,policyHash} from './core.mjs';
import {createRun,inspectInputs,ingest,attachAnatomy,normalize,composeCandidate} from './artifacts.mjs';
import {buildReview} from './review.mjs';
import {independentAudit} from './audit.mjs';

export async function template(state){
 await requirePrevious(state,'decision');
 const evidence=JSON.parse(await readFile(state.artifacts.reviewEvidence.file,'utf8'));
 return {reviewer:'',bindings:{policySha256:policyHash(policy),atlasSha256:state.artifacts.atlas.sha256,packingSha256:state.artifacts.packing.sha256,evidenceSha256:state.artifacts.reviewEvidence.sha256},checks:policy.checks.map(c=>({id:c.id,status:'unreviewed',note:'미검토: 실제 검수책의 해당 화면을 확인해야 합니다.',method:c.id==='anatomical-head'?'fixed-scale-visual-plus-landmarks':undefined,detectorInterpretation:c.id==='anatomical-head'?'미검토: 검출 경고와 실제 두개골·눈·볼의 차이를 해석해야 합니다.':undefined,evidence:c.evidence,viewedScreenshotHashes:c.evidence.flatMap(tag=>evidence.groups[tag].screenshots.map(s=>s.sha256))}))};
}
export async function decide(run,state,record){
 await requirePrevious(state,'decision');
 assert.deepEqual(record.bindings,{policySha256:policyHash(policy),atlasSha256:state.artifacts.atlas.sha256,packingSha256:state.artifacts.packing.sha256,evidenceSha256:state.artifacts.reviewEvidence.sha256},'Decision belongs to older pixels or an older policy/review');
 const evidence=JSON.parse(await readFile(state.artifacts.reviewEvidence.file,'utf8'));
 const audit=JSON.parse(await readFile(state.artifacts.auditReport.file,'utf8'));
 for(const r of record.checks){
  const c=policy.checks.find(c=>c.id===r.id);assert.ok(c,'Unknown check '+r.id);
  if(c.automatic)continue;
  if(r.id==='anatomical-head'&&r.status==='pass'&&audit.files[0].review_reasons.length)assert.ok(r.detectorInterpretation&&r.detectorInterpretation.length>=20&&!r.detectorInterpretation.includes('미검토'),'Interpret detector flags against actual anatomy before passing the head');
  if(r.status==='pass')for(const tag of c.evidence){
   const group=evidence.groups[tag];assert.ok(group);
   for(const shot of group.screenshots){
    assert.ok(r.viewedScreenshotHashes?.includes(shot.sha256),'Pass lacks actual fixed-scale screen record: '+r.id+' / '+tag);
    assert.equal((await ref(shot.file)).sha256,shot.sha256,'Changed review screenshot');
   }
  }
 }
 // These two passes come from the execution chain, never from manual optimism.
 for(const r of record.checks){
  if(r.id==='source-integrity')Object.assign(r,{status:state.mode==='production'?'pass':'caution',note:state.mode==='production'?'입력·job·실제 도구 출력의 해시 연결과 단계 순서를 확인했습니다.':'과거 생성 기록을 가져온 감사본입니다. 당시 사전 검수 절차가 실행됐다고 소급 인증하지 않습니다.',evidence:['provenance']});
  if(r.id==='package-integrity')Object.assign(r,{status:'pass',note:'전신 공통 등방 배율·알파32 잘림0·방향 추출·보이는 WebP 픽셀 손실0을 코드로 확인했습니다.',evidence:['package']});
  if(r.id==='independent-detector')Object.assign(r,{status:'pass',note:'현재 아틀라스와 검사 코드·패키지가 일치하는 실제 imgutils/ONNX 측정 및 원시 경고를 연결했습니다. 이 통과는 실행 검증이며 얼굴 크기 합격을 뜻하지 않습니다.',evidence:['independent-audit']});
 }
 const result=validateDecisions(record),file=path.join(path.dirname(state.artifacts.packing.file),'decision-'+sha(json(record)).slice(0,10)+'.json');
 await writeFile(file,json(record));await setArtifact(state,'decision',file);
 await receipt(state,'decision',{outcome:result.pass?'pass':'blocked',reasons:result.problems,detail:{checks:record.checks.length,reviewer:record.reviewer,allMandatoryChecksPresent:true}});
 return result;
}
export async function exportRun(run,state){
 await requirePrevious(state,'release');assert.equal(state.mode,'production','Historical audit runs cannot be exported as controlled new production');
 const d=JSON.parse(await readFile(state.artifacts.decision.file,'utf8'));assert.ok(validateDecisions(d).pass);
 const out=path.join(run,'export',state.artifacts.atlas.sha256.slice(0,12));await mkdir(out,{recursive:true});const files=[];
 for(const key of ['atlas','webp','down','up','left','right','portrait']){
  const src=state.artifacts[key],dest=path.join(out,path.basename(src.file));await copyFile(src.file,dest);files.push({role:key,...await ref(dest)});
 }
 const manifest={kind:'reviewed-art-package-not-game-install',policySha256:policyHash(policy),decision:state.artifacts.decision,files};
 const file=path.join(out,'manifest.json');await writeFile(file,json(manifest));await setArtifact(state,'releaseManifest',file);
 // Exported files remain part of the currentness check, not only their manifest.
 for(const f of files)await setArtifact(state,'export:'+f.role,f.file);
 await receipt(state,'release',{detail:{gameApplied:false,prUpdated:false,files:files.length}});return manifest;
}
export async function statusOutput(state){
 const status=await inspect(state);let decisions=null;
 if(state.artifacts.decision){try{decisions=JSON.parse(await readFile(state.artifacts.decision.file,'utf8'));}catch{}}
 const ds=status.stages.find(s=>s.id==='decision');
 return{run:state.id,name:state.name,...status,checks:policy.checks.map(c=>{const r=decisions?.checks.find(r=>r.id===c.id);return{id:c.id,title:c.title,status:r?(ds.status==='stale'?'stale':r.status):'unreviewed',note:r?.note||'아직 판정하지 않았습니다.'};})};
}
async function main(){
 const [command,runArg,fileArg,recordArg]=process.argv.slice(2);
 if(!command||!runArg)throw new Error('Usage: node pipeline.mjs <create|status|next|inspect-inputs|compose|ingest|measure|pack|audit|review|decisions-template|decide|export> <run-directory> [file] [record]');
 const run=path.resolve(runArg);let state;
 if(command==='create')state=await createRun(run,JSON.parse(await readFile(fileArg,'utf8')));
 else state=await load(run);
 let result;
 switch(command){
  case'create':result={created:run,next:'inputs',job:state.artifacts.job.file};break;
  case'status':console.log(json(await statusOutput(state)));return;
  case'next':{const s=await statusOutput(state),step=policy.stages.find(p=>p.id===s.next);console.log(json({next:step||'all stages complete',stageSequence:s.stages.map(({id,status})=>({id,status})),requiredChecks:s.checks.map(({id,title,status})=>({id,title,status})),blockingFindings:s.checks.filter(c=>!['pass','unreviewed'].includes(c.status)),mode:s.mode,eligibleToExport:s.eligibleToExport,ready:s.ready}));return;}
  case'inspect-inputs':await inspectInputs(run,state,JSON.parse(await readFile(fileArg,'utf8')));break;
  case'ingest':await ingest(run,state,fileArg,JSON.parse(await readFile(recordArg,'utf8')));break;
  case'compose':{
   const brief=JSON.parse(await readFile(state.artifacts.brief.file,'utf8'));assert.ok(brief.edit,'No edit base/mask in frozen brief');
   await requirePrevious(state,'generation');
   const composition=await composeCandidate(brief.edit,fileArg),out=path.join(run,'composition');await mkdir(out,{recursive:true});
   const file=path.join(out,composition.outputSha256.slice(0,12)+'.png'),proof=file.replace('.png','.json');await writeFile(file,composition.png);
   const {png,...record}=composition;await writeFile(proof,json(record));result={composite:file,proof,meaning:'Use the native candidate path plus this proof when ingesting a protected edit; visual seams are not auto-approved.'};break;
  }
  case'measure':await attachAnatomy(run,state,JSON.parse(await readFile(fileArg,'utf8')));break;
  case'pack':result=await normalize(run,state);break;
  case'audit':result=await independentAudit(run,state);break;
  case'review':result=await buildReview(run,state);break;
  case'decisions-template':console.log(json(await template(state)));return;
  case'decide':result=await decide(run,state,JSON.parse(await readFile(fileArg,'utf8')));break;
  case'export':result=await exportRun(run,state);break;
  default:throw new Error('Unknown command '+command);
 }
 await save(run,state);console.log(json({command,run,next:(await inspect(state)).next,result}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main().catch(e=>{console.error(e.message);process.exitCode=1;});
