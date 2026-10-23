// Renders every effect through the real Sound class into an OfflineAudioContext and reports peak / RMS / length.
//   node defense/scripts/sound/sfx-check.mjs — big moments loudest; frequent attacks and hits about a tenth of them.
import {build} from 'esbuild';
import {chromium} from 'playwright';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const G=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../src').split(path.sep).join('/')+'/';
const out=await build({stdin:{contents:`import {Sound} from '${G}combat/audio.js';window.Sound=Sound;`,resolveDir:G,loader:'js'},bundle:true,write:false,format:'iife'});
const browser=await chromium.launch();const page=await browser.newPage();await page.setContent('<!doctype html><title>sfx</title>');
await page.addScriptTag({content:out.outputFiles[0].text});
const rows=await page.evaluate(async()=>{
  const cases=[['attack blade',{type:'attack',hero:'zeke'}],['attack impact',{type:'attack',hero:'guardian'}],['attack magic',{type:'attack',hero:'rumi'}],['hit',{type:'hit'}],['kill',{type:'kill'}],['summon',{type:'summon'}],['merge',{type:'merge'}],['upgrade',{type:'upgrade'}],['income',{type:'income'}],['skill',{type:'skill'}],['skill support',{type:'skill',support:true}],['skill locked',{type:'skill',locked:true}],['crushPhase',{type:'crushPhase'}],['finisherImpact',{type:'finisherImpact',kind:'royal'}],['wave',{type:'wave'}],['boss',{type:'boss'}],['bossCast',{type:'bossCast'}],['warning',{type:'warning'}],['leak',{type:'leak'}],['clear',{type:'clear'}],['perfect',{type:'perfect'}],['defeat',{type:'defeat'}]];
  const res=[];
  const render=async fn=>{const c=new OfflineAudioContext(2,48000*3,48000),s=new window.Sound();s.build(c);s.enabled=true;s.volume=.2;s.master.gain.value=.2;fn(s);const b=await c.startRendering();const d=b.getChannelData(0);let pk=0,e=0,last=0;for(let i=0;i<d.length;i++){const v=Math.abs(d[i]);pk=Math.max(pk,v);e+=d[i]*d[i];if(v>.001)last=i;}return {peak:+pk.toFixed(3),rmsDb:+(10*Math.log10(e/d.length+1e-12)).toFixed(1),seconds:+(last/48000).toFixed(2),voices:s.voices};};
  for(const [name,e] of cases)res.push({name,...await render(s=>s.event(e))});
  res.push({name:'reveal UR',...await render(s=>{s.unlock=()=>{};s.reveal('UR');})});
  res.push({name:'click',...await render(s=>{s.unlock=()=>{};s.click();})});
  res.push({name:'gift up',...await render(s=>s.action('gift',{hearts:1}))});
  res.push({name:'reward',...await render(s=>s.action('daily',{}))});
  // A busy moment: 40 attacks + 40 hits in one frame must stay within the voice cap.
  res.push({name:'burst 80',...await render(s=>{for(let i=0;i<40;i++){s.lastAttack=-1;s.lastHit=-1;s.event({type:'attack',hero:'rumi'});s.event({type:'hit'});}})});
  return res;
});
for(const r of rows)console.log(r.name.padEnd(16),'peak',String(r.peak).padEnd(6),'rms dB',String(r.rmsDb).padEnd(6),'len',r.seconds+'s','voices',r.voices);
await browser.close();
