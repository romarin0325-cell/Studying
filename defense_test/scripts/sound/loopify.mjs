// Turns a generated MP3 into a seamless Ogg Opus loop (in headless Chrome: decode, tempo, loop search, crossfade, WebCodecs Opus).
//   node defense_test/scripts/sound/loopify.mjs <in.mp3> <out.ogg> <bpmHint> <minSeconds> <maxSeconds> [bitrate=48000] [targetRms=0.1]
// Loop search is tempo-agnostic: every length between min and max seconds on a 10.7 ms grid, starts every 0.25 s,
// scored by band-energy and onset correlation across the seam; the end is refined sample-exactly and crossfaded 0.15 s.
// Prints loopStart/loopEnd for src/audio-tracks.js and a seam check (flux jump at the seam vs the track's own range).
// Output file holds [M s of loop tail][loop body][M s of loop head]; loopStart=M, loopEnd=M+L, so any small decoder offset still loops cleanly.
import fs from 'node:fs';
import http from 'node:http';
import {chromium} from 'playwright';
const [inp,out,bpmHint,minBars,maxBars,bitrate='48000',targetRms='0.1']=process.argv.slice(2);
// WebCodecs AudioEncoder needs a secure context, so a blank page is served on localhost.
const server=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html'});r.end('<!doctype html><title>loopify</title>');}).listen(0,'127.0.0.1');
await new Promise(ok=>server.once('listening',ok));
const browser=await chromium.launch({channel:'chrome'}).catch(()=>chromium.launch());const page=await browser.newPage();
await page.goto('http://127.0.0.1:'+server.address().port+'/');
const b64=fs.readFileSync(inp).toString('base64');
const res=await page.evaluate(async({b64,bpmHint,minBars,maxBars,bitrate,targetRms})=>{
  const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  const ctx=new OfflineAudioContext(2,48000,48000);
  const buf=await ctx.decodeAudioData(bytes.buffer);
  const SR=48000,N=buf.length,L0=buf.getChannelData(0),R0=buf.numberOfChannels>1?buf.getChannelData(1):buf.getChannelData(0);
  const mono=new Float32Array(N);for(let i=0;i<N;i++)mono[i]=(L0[i]+R0[i])/2;
  // Frame features: hop 512, band energies from a 1024 FFT.
  const H=512,F=1024,frames=Math.floor((N-F)/H);
  function fft(re,im){const n=re.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}for(let len=2;len<=n;len<<=1){const a=-2*Math.PI/len;for(let i=0;i<n;i+=len)for(let k=0;k<len/2;k++){const wr=Math.cos(a*k),wi=Math.sin(a*k),xr=re[i+k+len/2]*wr-im[i+k+len/2]*wi,xi=re[i+k+len/2]*wi+im[i+k+len/2]*wr;re[i+k+len/2]=re[i+k]-xr;im[i+k+len/2]=im[i+k]-xi;re[i+k]+=xr;im[i+k]+=xi;}}}
  const B=24,edges=Array.from({length:B+1},(_,b)=>Math.round(2*Math.pow(F/2/2,b/B)));
  const bands=new Float32Array(frames*B),rms=new Float32Array(frames),win=Float32Array.from({length:F},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/F));
  for(let f=0;f<frames;f++){const re=new Float32Array(F),im=new Float32Array(F);let e=0;for(let i=0;i<F;i++){const v=mono[f*H+i];re[i]=v*win[i];e+=v*v;}rms[f]=Math.sqrt(e/F);fft(re,im);
    for(let b=0;b<B;b++){let s=0;for(let k=edges[b];k<Math.max(edges[b]+1,edges[b+1]);k++)s+=re[k]*re[k]+im[k]*im[k];bands[f*B+b]=Math.log(1e-9+s);}}
  // Onset envelope = positive spectral flux.
  const onset=new Float32Array(frames);for(let f=1;f<frames;f++){let s=0;for(let b=0;b<B;b++){const d=bands[f*B+b]-bands[(f-1)*B+b];if(d>0)s+=d;}onset[f]=s;}
  const mean=onset.reduce((a,b)=>a+b,0)/frames;for(let f=0;f<frames;f++)onset[f]-=mean;
  // Tempo by autocorrelation near the hint (0.5x..2x allowed but weighted toward the hint).
  const fps=SR/H;let best=null;
  for(let bpm=60;bpm<=200;bpm+=.25){const lag=fps*60/bpm;let s=0;for(let f=0;f+lag*4<frames;f++){const g=lag;const i1=Math.round(f+g),i2=Math.round(f+2*g),i4=Math.round(f+4*g);s+=onset[f]*(onset[i1]+.5*onset[i2]+.25*onset[i4]);}const w=Math.exp(-Math.pow(Math.log2(bpm/Number(bpmHint)),2)/.08);s*=w;if(!best||s>best.s)best={bpm,s};}
  const bpm=best.bpm,beat=SR*60/bpm,bar=beat*4;
  // Loop search, tempo-agnostic: every length in [minBars..maxBars] seconds range (args are seconds now) on the 10.7 ms grid,
  // starts every 0.25 s; score = Pearson correlation of mean-removed log bands + onset envelope over 3 s centred on both points.
  const fa0=f=>f*B;const span=3,n=Math.round(span*fps),half=Math.round(n/2);
  const z=new Float32Array(frames*B);for(let f=0;f<frames;f++){let m=0;for(let x=0;x<B;x++)m+=bands[f*B+x];m/=B;for(let x=0;x<B;x++)z[f*B+x]=bands[f*B+x]-m;}
  function corr(fa,fb){let s=0,na=0,nb=0,o=0,oa=0,ob=0;for(let k=-half;k<half;k++){const ia=(fa+k)*B,ib=(fb+k)*B;for(let x=0;x<B;x++){const p=z[ia+x],q=z[ib+x];s+=p*q;na+=p*p;nb+=q*q;}const p=onset[fa+k],q=onset[fb+k];o+=p*q;oa+=p*p;ob+=q*q;}return .6*s/Math.sqrt(na*nb+1e-9)+.4*o/Math.sqrt(oa*ob+1e-9);}
  let pick=null;const minF=Math.round(Number(minBars)*fps),maxF=Math.round(Number(maxBars)*fps),startF=Math.round(2*fps),stepS=Math.round(.25*fps);
  for(let Lf=minF;Lf<=maxF;Lf++)for(let sf=startF;sf+Lf+half+Math.round(1.5*fps)<frames;sf+=stepS){const sc=corr(sf,sf+Lf),score=sc+.0005*Lf/fps;if(!pick||score>pick.score)pick={score,sc,S:sf*H,L:Lf*H,bars:+(Lf/fps/(240/bpm)).toFixed(2)};}
  // Sample-level refine of the loop end (±beat/8) by waveform correlation over 60 ms.
  let {S,L}=pick;S=Math.round(S);let Lr=Math.round(L),bestC=-1;const w=Math.round(.06*SR);
  for(let d=-Math.round(beat/8);d<=Math.round(beat/8);d++){let c=0,na=0,nb=0;for(let i=-w;i<w;i++){const p=mono[S+i],q=mono[S+Lr+d+i];c+=p*q;na+=p*p;nb+=q*q;}c/=Math.sqrt(na*nb+1e-12);if(c>bestC){bestC=c;pick.d=d;}}
  Lr+=pick.d;
  // Build body with equal-power crossfade: last XF of body blended with the material just before S.
  const XF=Math.round(.15*SR),M=Math.round(.3*SR),ch=[L0,R0],body=ch.map(c=>c.slice(S,S+Lr));
  for(let c=0;c<2;c++)for(let i=0;i<XF;i++){const t=(i+.5)/XF,a=Math.cos(t*Math.PI/2),b=Math.sin(t*Math.PI/2);const k=Lr-XF+i;body[c][k]=body[c][k]*a+ch[c][S-XF+i]*b;}
  // Loudness: RMS normalise, then a gentle peak limit at -1 dBFS.
  let e=0;for(let c=0;c<2;c++)for(let i=0;i<Lr;i++)e+=body[c][i]*body[c][i];const r=Math.sqrt(e/(2*Lr)),gain=Number(targetRms)/r;let peak=0;
  for(let c=0;c<2;c++)for(let i=0;i<Lr;i++){let v=body[c][i]*gain;const lim=.89;if(Math.abs(v)>lim*.8){const s=Math.sign(v),x=(Math.abs(v)-lim*.8)/(lim*.2);v=s*(lim*.8+lim*.2*Math.tanh(x));}body[c][i]=v;peak=Math.max(peak,Math.abs(v));}
  const total=Lr+2*M,outCh=[new Float32Array(total),new Float32Array(total)];
  for(let c=0;c<2;c++){outCh[c].set(body[c].subarray(Lr-M),0);outCh[c].set(body[c],M);outCh[c].set(body[c].subarray(0,M),M+Lr);}
  // Opus encode (20 ms frames).
  const packets=[];let desc=null;
  const enc=new AudioEncoder({output:(chunk,meta)=>{const d=new Uint8Array(chunk.byteLength);chunk.copyTo(d);packets.push({data:Array.from(d),duration:chunk.duration});if(meta?.decoderConfig?.description&&!desc)desc=Array.from(new Uint8Array(meta.decoderConfig.description));},error:e=>{throw e;}});
  enc.configure({codec:'opus',sampleRate:SR,numberOfChannels:2,bitrate:Number(bitrate),opus:{frameDuration:20000,application:'audio',complexity:10}});
  const FR=960;for(let i=0;i<total;i+=FR){const n=Math.min(FR,total-i),data=new Float32Array(n*2);data.set(outCh[0].subarray(i,i+n),0);data.set(outCh[1].subarray(i,i+n),n);enc.encode(new AudioData({format:'f32-planar',sampleRate:SR,numberOfFrames:n,numberOfChannels:2,timestamp:Math.round(i/SR*1e6),data}));}
  await enc.flush();enc.close();
  return {duration:N/SR,bpm,pick:{...pick,S:S/SR,L:Lr/SR,refineCorr:bestC},gain,peak,total,M,packets,desc};
},{b64,bpmHint,minBars,maxBars,bitrate,targetRms});
// Ogg Opus mux.
const crcTable=new Uint32Array(256).map((_,i)=>{let r=i<<24;for(let k=0;k<8;k++)r=r&0x80000000?(r<<1)^0x04c11db7:r<<1;return r>>>0;});
const crc=b=>{let c=0;for(const x of b)c=((c<<8)^crcTable[((c>>>24)^x)&255])>>>0;return c;};
const serial=0x5347414d;let seq=0;const pages=[];
function oggPage(packets,granule,flags){const segs=[];for(const p of packets){let n=p.length;while(n>=255){segs.push(255);n-=255;}segs.push(n);}
  const h=Buffer.alloc(27+segs.length);h.write('OggS',0);h[4]=0;h[5]=flags;h.writeBigInt64LE(BigInt(granule),6);h.writeUInt32LE(serial,14);h.writeUInt32LE(seq++,18);h[26]=segs.length;segs.forEach((s,i)=>h[27+i]=s);
  const pg=Buffer.concat([h,...packets.map(p=>Buffer.from(p))]);pg.writeUInt32LE(crc(pg),22);pages.push(pg);}
let preSkip=312;if(res.desc&&res.desc.length>=19&&Buffer.from(res.desc.slice(0,8)).toString()==='OpusHead')preSkip=res.desc[10]|res.desc[11]<<8;
const head=Buffer.alloc(19);head.write('OpusHead',0);head[8]=1;head[9]=2;head.writeUInt16LE(preSkip,10);head.writeUInt32LE(48000,12);head.writeInt16LE(0,16);head[18]=0;
const vendor=Buffer.from('StarGarden');const tags=Buffer.alloc(8+4+vendor.length+4);tags.write('OpusTags',0);tags.writeUInt32LE(vendor.length,8);vendor.copy(tags,12);tags.writeUInt32LE(0,12+vendor.length);
oggPage([head],0,2);oggPage([tags],0,0);
let samples=0,batch=[];const total=res.total;
res.packets.forEach((p,i)=>{batch.push(p.data);samples+=Math.round(p.duration*48000/1e6);const last=i===res.packets.length-1;if(batch.length>=50||last){oggPage(batch,last?total+preSkip:Math.min(samples,total)+preSkip,last?4:0);batch=[];}});
const ogg=Buffer.concat(pages);fs.writeFileSync(out,ogg);
// Verify: decode the Ogg back and measure continuity across the loop seam.
const check=await page.evaluate(async({b64,M,L})=>{const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const ctx=new OfflineAudioContext(2,48000,48000);const buf=await ctx.decodeAudioData(bytes.buffer);
  const x=buf.getChannelData(0),s=Math.round(M*48000),e=Math.round((M+L)*48000);let d=0,n=0;for(let i=-240;i<240;i++){d+=Math.abs(x[e+i]-x[s+i]);n+=Math.abs(x[s+i]);}
  const H=512,B=24,F=1024;const seg=new Float32Array(48000);seg.set(x.subarray(e-24000,e),0);seg.set(x.subarray(s,s+24000),24000);function en(arr,i){let r=0;for(let k=0;k<F;k++)r+=arr[i+k]*arr[i+k];return Math.sqrt(r/F);}const fl=[];for(let i=0;i+F+H<seg.length;i+=H){fl.push(Math.abs(Math.log(1e-6+en(seg,i+H))-Math.log(1e-6+en(seg,i))));}const j=Math.round((24000-F/2)/H);const sorted=[...fl].sort((a,b)=>a-b);return {decodedSeconds:buf.length/48000,seamJump:+(Math.max(fl[j-1],fl[j],fl[j+1])/(sorted[Math.floor(sorted.length/2)]+1e-6)).toFixed(2),seamJumpP90:+(sorted[Math.floor(sorted.length*.9)]/(sorted[Math.floor(sorted.length/2)]+1e-6)).toFixed(2)};},{b64:ogg.toString('base64'),M:res.M/48000,L:res.pick.L});
console.log(JSON.stringify({in:inp.split('/').pop(),srcSeconds:+res.duration.toFixed(2),bpm:res.bpm,loopStartInSource:+res.pick.S.toFixed(3),loopSeconds:+res.pick.L.toFixed(3),bars:res.pick.bars,similarity:+res.pick.sc.toFixed(3),refineCorr:+res.pick.refineCorr.toFixed(3),gain:+res.gain.toFixed(2),peak:+res.peak.toFixed(3),preSkip,oggKiB:+(ogg.length/1024).toFixed(1),loopStart:+(res.M/48000).toFixed(4),loopEnd:+(res.M/48000+res.pick.L).toFixed(4),...check}));
await browser.close();server.close();
