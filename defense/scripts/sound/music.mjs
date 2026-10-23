// Lyria music generation through generateContent (lyria-3.5, lyria-3-pro-preview). See docs/ASSET_PIPELINE.md.
//   node defense/scripts/sound/music.mjs jobs.json [--key-file path]
// jobs: [{model, prompt, out}]. Lyria answers with MP3 (about 192 kbps, 60-70 s); loopify.mjs cuts and encodes it.
import fs from 'node:fs';
import path from 'node:path';
import {geminiKey,GEMINI_ROOT as ROOT} from '../art/gemini-key.mjs';
const key=geminiKey();
const jobs=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
async function run(job){
  const body={contents:[{role:'user',parts:[{text:job.prompt}]}],...(job.config?{generationConfig:job.config}:{})};
  for(let attempt=0;attempt<3;attempt++){
    const t=Date.now(),r=await fetch(`${ROOT}/models/${job.model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body)});
    const j=await r.json().catch(()=>({}));
    if(!r.ok){console.log(job.out,'HTTP',r.status,j.error?.message?.slice(0,300));if(r.status>=500||r.status===429){await new Promise(res=>setTimeout(res,5000*(attempt+1)));continue;}return;}
    const parts=j.candidates?.[0]?.content?.parts||[];
    const audio=parts.filter(p=>p.inlineData);
    const text=parts.filter(p=>p.text).map(p=>p.text).join(' ');
    if(!audio.length){console.log(job.out,'no audio',j.candidates?.[0]?.finishReason,text.slice(0,300));continue;}
    audio.forEach((a,i)=>{const m=a.inlineData.mimeType,ext=m.includes('wav')?'.wav':m.includes('mpeg')||m.includes('mp3')?'.mp3':m.includes('ogg')?'.ogg':m.includes('flac')?'.flac':'.bin';const out=job.out.replace(/\.\w+$/,'')+(i?'-'+i:'')+ext;fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,Buffer.from(a.inlineData.data,'base64'));console.log('ok',out,m,`${(Buffer.from(a.inlineData.data,'base64').length/1024).toFixed(0)} KiB`,`${((Date.now()-t)/1000).toFixed(0)}s`);});
    if(text)console.log('  text:',text.slice(0,400));
    return;
  }
}
await Promise.all(jobs.map(run));
