// Image generation / editing with reference images (Nano Banana family). See docs/ASSET_PIPELINE.md.
//   node defense_test/scripts/art/gen-image.mjs jobs.json [--key-file path]
// jobs.json: [{"model":"nano-banana-pro-preview","prompt":"..." | "promptFile":"p.txt","refs":["a.png","b.jpg"],"out":"dir/name.png","aspect":"1:1","size":"2K"}]
// Reference ORDER matters and every prompt names each image's role (template / style master / identity only).
import fs from 'node:fs';
import path from 'node:path';
import {geminiKey,GEMINI_ROOT} from './gemini-key.mjs';
const key=geminiKey(),jobs=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const mime=f=>/\.png$/i.test(f)?'image/png':/\.webp$/i.test(f)?'image/webp':'image/jpeg';
async function run(job){
  const prompt=job.prompt??fs.readFileSync(job.promptFile,'utf8');
  const parts=[...(job.refs||[]).map(f=>({inlineData:{mimeType:mime(f),data:fs.readFileSync(f).toString('base64')}})),{text:prompt}];
  const body={contents:[{role:'user',parts}],generationConfig:{responseModalities:['IMAGE'],imageConfig:{aspectRatio:job.aspect||'1:1',...(job.size?{imageSize:job.size}:{})}}};
  for(let attempt=0;attempt<3;attempt++){
    const r=await fetch(`${GEMINI_ROOT}/models/${job.model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body)});
    const j=await r.json().catch(()=>({}));
    if(!r.ok){console.log(job.out,'HTTP',r.status,j.error?.message?.slice(0,200));if(r.status>=500||r.status===429){await new Promise(res=>setTimeout(res,4000*(attempt+1)));continue;}return;}
    const img=(j.candidates?.[0]?.content?.parts||[]).find(p=>p.inlineData);
    if(!img){console.log(job.out,'no image',j.candidates?.[0]?.finishReason);continue;}
    // Models may answer with JPEG; keep the real extension so keying knows what it gets.
    const out=job.out.replace(/\.(png|jpe?g)$/i,'')+(img.inlineData.mimeType.includes('png')?'.png':'.jpg');
    fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,Buffer.from(img.inlineData.data,'base64'));console.log('ok',out);return;
  }
}
await Promise.all(jobs.map(run));
