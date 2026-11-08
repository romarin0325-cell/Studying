import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {root,gameRoot,here} from './runtime.mjs';
import {policy} from './policy.mjs';
import {json} from './core.mjs';
const out=path.join(gameRoot,'docs/art/sd-pipeline'),selection=JSON.parse(await readFile(path.join(out,'../selected-cast-20261108/selection.json'),'utf8')),old=JSON.parse(await readFile(path.join(out,'../sol-cast-v2/manifest.json'),'utf8'));
const relative=file=>path.relative(out,path.join(root,file)).replaceAll('\\','/'),characters=[];
for(const a of selection.assets){const job=JSON.parse(await readFile(path.join(out,'../selected-cast-20261108',a.id,'generation-job.json'),'utf8'));characters.push({id:a.id,name:{luna:'루나',siren:'세이렌',cherry_prince:'체리프린스',doom:'둠',red_dragon:'레드드래곤'}[a.id],version:a.version,previous:relative(old.assets.find(e=>e.id===a.id).sourcePng.file),current:relative(a.sourcePng.file),review:a.review.status,warning:a.review.warning||a.review.limits||null,prompt:job.prompt,inputs:(job.inputs||job.referencePaths?.map(file=>({file})))||[],notes:'실제 선택본의 과거 실행 기록입니다. 새 캐릭터의 지시서로 그대로 재사용하지 않습니다.'});}
const data={stages:policy.stages,checks:policy.checks,frame:policy.frame,characters,masters:['feminine','neutral','masculine'].flatMap(type=>['short','medium','tall'].map(height=>({id:type+'-'+height,src:'../sol-cast-v2/structure-masters/'+type+'-'+height+'.png'}))),style:'../sol-cast-v2/structure-masters/style-siren.webp'};
const client=await readFile(path.join(here,'guide-client.js'),'utf8'),template=await readFile(path.join(here,'guide.html'),'utf8');await writeFile(path.join(out,'index.html'),template.replace('/*GUIDE_DATA*/',JSON.stringify(data).replaceAll('<','\\u003c')).replace('/*GUIDE_CLIENT*/',client));console.log(json({guide:path.join(out,'index.html'),stages:data.stages.length,checks:data.checks.length,masters:data.masters.length,selections:characters.length}));
