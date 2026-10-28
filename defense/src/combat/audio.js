// Star Garden sound. Music: three generated loops (lobby, battle, boss; Ogg Opus with sample-exact loop points,
// decoded lazily after the first gesture, one buffer kept) crossfaded by scene; if the browser cannot decode them
// the original procedural score plays instead. Effects: synthesized voices through one mix bus (compressor and a
// short generated reverb), a shared noise buffer instead of per-hit allocation, and a voice cap so busy waves stay
// cheap. No external request, no autoplay before a gesture.
import {FX_PROFILES} from './effects.js';
import {MUSIC} from '../audio-tracks.js';
const midi=n=>440*Math.pow(2,(n-69)/12),RANK=['C','R','SR','UR'],MAX_VOICES=28;
// Attack families by motion: blades swish, impacts thud, everything else is a light magic chime.
const BLADE=new Set(['crescent','daggers','claws','needle','royal_blade','leap','ice_lance']),IMPACT=new Set(['quake','dragon','planet','cross','present','contract']);
export class Sound {
  constructor(){this.ctx=null;this.enabled=true;this.music=true;this.volume=.35;this.next=0;this.beat=0;this.timer=null;this.battle=false;this.boss=false;this.lastHit=-1;this.lastAttack=-1;this.lastKill=-1;this.voices=0;this.tracks={};this.playing=null;this.failed=false;}
  unlock(){
    if(!this.ctx){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;try{this.build(new Audio());this.timer=setInterval(()=>this.schedule(),120);}catch{this.ctx=null;return;}}
    if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});
  }
  build(c){
    this.ctx=c;this.master=c.createGain();this.master.gain.value=this.volume;
    const comp=c.createDynamicsCompressor();comp.threshold.value=-16;comp.knee.value=12;comp.ratio.value=3.5;comp.attack.value=.004;comp.release.value=.18;
    this.master.connect(comp);comp.connect(c.destination);
    this.sfx=c.createGain();this.sfx.gain.value=1;this.sfx.connect(this.master);
    this.musicBus=c.createGain();this.musicBus.gain.value=.4;this.musicBus.connect(this.master);
    // 1.4 s stereo room: decaying filtered noise, built once.
    const len=Math.floor(c.sampleRate*1.4),ir=c.createBuffer(2,len,c.sampleRate);
    for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);let lp=0;for(let i=0;i<len;i++){lp=lp*.55+(Math.random()*2-1)*.45;d[i]=lp*Math.pow(1-i/len,3.2);}}
    this.verb=c.createConvolver();this.verb.buffer=ir;this.send=c.createGain();this.send.gain.value=.28;this.send.connect(this.verb);this.verb.connect(this.master);
    const nb=c.createBuffer(1,c.sampleRate,c.sampleRate),nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;this.noiseBuffer=nb;
  }
  // One enveloped oscillator. wet sends part of it to the room.
  tone(freq,time,duration,volume,type='sine',endFreq=null,wet=0,attack=.008){if(!this.ctx||!this.enabled||this.voices>=MAX_VOICES)return;const c=this.ctx,o=c.createOscillator(),g=c.createGain();this.voices++;
    o.type=type;o.frequency.setValueAtTime(freq,time);if(endFreq)o.frequency.exponentialRampToValueAtTime(Math.max(1,endFreq),time+duration);
    g.gain.setValueAtTime(.0001,time);g.gain.exponentialRampToValueAtTime(Math.max(.001,volume),time+attack);g.gain.exponentialRampToValueAtTime(.0001,time+duration);
    o.connect(g);g.connect(this.sfx);if(wet){const w=c.createGain();w.gain.value=wet;g.connect(w);w.connect(this.send);}
    o.onended=()=>{this.voices--;g.disconnect();};o.start(time);o.stop(time+duration+.05);}
  // Filtered slice of the shared noise buffer; sweep moves the filter (whooshes, cracks).
  noise(time,duration,volume,filter=1500,type='lowpass',sweep=null,q=.8,wet=0){if(!this.ctx||!this.enabled||this.voices>=MAX_VOICES)return;const c=this.ctx,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();this.voices++;
    s.buffer=this.noiseBuffer;f.type=type;f.Q.value=q;f.frequency.setValueAtTime(filter,time);if(sweep)f.frequency.exponentialRampToValueAtTime(sweep,time+duration);
    g.gain.setValueAtTime(.0001,time);g.gain.exponentialRampToValueAtTime(Math.max(.001,volume),time+Math.min(.012,duration/3));g.gain.exponentialRampToValueAtTime(.0001,time+duration);
    s.connect(f);f.connect(g);g.connect(this.sfx);if(wet){const w=c.createGain();w.gain.value=wet;g.connect(w);w.connect(this.send);}
    s.onended=()=>{this.voices--;g.disconnect();};s.start(time,Math.random()*.5,duration+.05);}
  chord(notes,time,duration,volume,type='triangle',spread=0,wet=.3){notes.forEach((n,i)=>this.tone(midi(n),time+i*spread,duration,volume,type,null,wet));}
  scene(){return !this.battle?'lobby':this.boss?'boss':'battle';}
  schedule(){
    if(!this.ctx||document.hidden||this.ctx.state!=='running'){this.next=0;return;}
    if(!this.enabled||!this.music){this.next=0;if(this.playing)this.stopMusic(.6);return;}
    if(!this.failed){this.loop(this.scene());return;}
    this.procedural();
  }
  // Generated loops: decode on demand, keep only the playing buffer, crossfade on scene change.
  async decode(id){
    if(this.tracks[id])return this.tracks[id];
    const src=window.__GARDEN_AUDIO__?.[id]||MUSIC[id].path,bytes=await(await fetch(src)).arrayBuffer();
    this.tracks[id]=await new Promise((ok,no)=>{const p=this.ctx.decodeAudioData(bytes,ok,no);if(p&&p.then)p.then(ok,no);});
    return this.tracks[id];
  }
  loop(id){
    if(this.playing?.id===id||this.loading===id)return;this.loading=id;
    this.decode(id).then(buffer=>{
      this.loading=null;if(!this.enabled||!this.music||this.scene()!==id||this.playing?.id===id)return;
      const c=this.ctx,t=c.currentTime,s=c.createBufferSource(),g=c.createGain(),m=MUSIC[id];
      s.buffer=buffer;s.loop=true;s.loopStart=m.loopStart;s.loopEnd=m.loopEnd;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(m.gain,t+1.1);
      s.connect(g);g.connect(this.musicBus);
      // Lobby resumes where it was; battle themes start at the top of their loop.
      const at=id==='lobby'&&this.lobbyAt?this.lobbyAt:m.loopStart;s.start(t,Math.min(at,m.loopEnd-.05));
      this.stopMusic(1.1);this.playing={id,source:s,gain:g,started:t-at};
      for(const k of Object.keys(this.tracks))if(k!==id&&k!=='lobby')delete this.tracks[k];
    }).catch(()=>{this.loading=null;this.failed=true;});
  }
  stopMusic(fade){const p=this.playing;if(!p)return;this.playing=null;const t=this.ctx.currentTime,m=MUSIC[p.id];
    if(p.id==='lobby'){const span=m.loopEnd-m.loopStart,pos=t-p.started;this.lobbyAt=pos<m.loopEnd?pos:m.loopStart+(pos-m.loopStart)%span;}
    p.gain.gain.cancelScheduledValues(t);p.gain.gain.setValueAtTime(Math.max(.0001,p.gain.gain.value),t);p.gain.gain.exponentialRampToValueAtTime(.0001,t+fade);p.source.stop(t+fade+.05);}
  // Fallback score (the original adaptive phrases) for browsers without Ogg Opus decoding.
  procedural(){
    const c=this.ctx,step=this.battle?.22:.32;if(this.next<c.currentTime)this.next=c.currentTime+.08;
    const chords=[[57,60,64,69],[53,57,60,65],[55,59,62,67],[52,55,59,64]];
    while(this.next<c.currentTime+.35){const n=this.beat,notes=chords[Math.floor(n/16)%4],note=notes[[0,2,1,3,2,1,3,2][n%8]],freq=midi(note),t=this.next;
      this.tone(freq*2,t,.5,this.battle?.035:.043,'triangle');this.tone(freq*4,t+.012,.3,.006);
      if(n%4===0)this.tone(midi(notes[0]-24),t,.75,.07,'sine');
      if(n%16===0)for(const k of notes)this.tone(midi(k),t,step*14,.008,'sine');
      if(this.battle&&n%4===0){this.tone(this.boss?82:65,t,.18,.065,'sine',35);this.noise(t,.06,.012,700);}
      if(this.battle&&n%4===2)this.noise(t,.08,.018,this.boss?2300:1600);
      this.beat++;this.next+=step;
    }
  }
  // Battle events from the engine.
  event(e){if(!this.ctx||!this.enabled)return;const t=this.ctx.currentTime,j=1+(Math.random()-.5)*.08;
    switch(e.type){
      case 'attack':{if(t-this.lastAttack<.07)return;this.lastAttack=t;const f=FX_PROFILES[e.hero],m=f?.motion,k=(f?.frame||0)%8;
        if(BLADE.has(m)){this.noise(t,.09,.15,2600*j,'bandpass',6500,1.2);this.tone(900*j+k*30,t+.01,.06,.03,'triangle',600);}
        else if(IMPACT.has(m)){this.tone(120*j,t,.12,.11,'sine',55);this.noise(t,.07,.06,900,'lowpass');}
        else{this.tone((700+k*60)*j,t,.12,.05,'triangle',(1000+k*70)*j,.25);this.tone((1400+k*90)*j,t+.03,.09,.016,'sine',null,.3);}
        return;}
      case 'hit':if(t-this.lastHit<.06)return;this.lastHit=t;this.noise(t,.045,.1,1800*j,'bandpass',900,1.2);return;
      case 'kill':if(t-this.lastKill<.09)return;this.lastKill=t;this.tone(1250*j,t,.08,.026,'triangle',1900);this.noise(t,.05,.025,5200,'highpass');return;
      case 'summon':[72,76,79,84].forEach((n,i)=>this.tone(midi(n),t+i*.045,.32,.05,'triangle',null,.35));this.noise(t,.3,.025,1800,'bandpass',7000,.9,.3);return;
      case 'merge':{this.noise(t,.22,.04,500,'bandpass',5000,1.1);[67,71,74,79,83,86].forEach((n,i)=>this.tone(midi(n),t+.05+i*.04,.45,.055,'triangle',null,.4));this.tone(midi(91),t+.32,.6,.02,'sine',null,.6);return;}
      case 'upgrade':[76,79,83].forEach((n,i)=>this.tone(midi(n),t+i*.05,.28,.05,'square',null,.2));this.noise(t,.12,.02,6000,'highpass');return;
      case 'move':this.tone(520,t,.06,.025,'sine',380);return;
      case 'sell':this.tone(1320,t,.08,.03,'triangle',990);this.tone(990,t+.06,.1,.025,'triangle',700);return;
      case 'income':this.tone(1568,t,.07,.02,'square',null,.1);this.tone(2093,t+.05,.12,.018,'triangle',null,.2);return;
      case 'skill':{if(e.kind==='ultimate_breath'){
        this.chord([60,67,74],t,.9,.032,'sine',.04,.35);this.noise(t,.55,.018,450,'bandpass',1800,.8);return;}
        if(e.kind==='bigshow'){
        // The fist falls (rising whoosh), lands (deep thump plus a crack of stone), and the board rings.
        this.noise(t,.26,.07,300,'bandpass',3200,1.1);this.tone(52,t+.3,.9,.34,'sine',24);this.noise(t+.3,.6,.22,2200,'lowpass',180,.9,.3);
        this.tone(130,t+.3,.35,.12,'square',60);this.chord([55,62,69],t+.32,.8,.05,'sawtooth',.01,.5);return;}
        if(e.locked){[69,76,81].forEach((n,i)=>this.tone(midi(n),t+i*.1,.3,.04,'sine',null,.4));this.noise(t,.5,.02,800,'bandpass',4000,.8,.3);return;}
        // Wind-up, impact, then a bright chord: every ultimate lands like a moment.
        this.noise(t,.3,.05,300,'bandpass',4200,1.2);this.tone(70,t+.26,.6,.22,'sine',32);this.noise(t+.26,.45,.12,2800,'lowpass',400,.7,.25);
        this.chord(e.support?[72,76,79,84]:[69,73,76,81],t+.3,.9,.045,'sawtooth',.012,.45);this.chord([84,88,91],t+.34,.7,.02,'triangle',.02,.5);return;}
      case 'goldBreathRelease':this.tone(400,t,.32,.07,'sine',1900,.35);this.noise(t,.3,.055,800,'bandpass',6500,1.2);return;
      case 'goldBreathImpact':this.tone(64,t,.7,.22,'sine',28);this.noise(t,.5,.15,2600,'lowpass',260,.8,.25);this.chord([60,67,74,79],t+.04,.75,.035,'triangle',.012,.45);return;
      case 'crushPhase':this.tone(58*j,t,.6,.4,'sine',30);this.tone(116*j,t,.25,.12,'triangle',50);this.noise(t,.55,.24,1400,'lowpass',180,.9,.2);for(let i=0;i<4;i++)this.noise(t+.04+i*.05,.07,.08,3000+i*600,'bandpass',null,2);return;
      case 'dreamPhase':this.chord([e.phase%2?74:72,79,86],t,.5,.03,'sine',.03,.6);this.noise(t,.35,.03,2000,'bandpass',8000,.8,.5);return;
      case 'finisherImpact':this.tone(e.kind==='royal'?110:62,t,.5,.32,'sine',30);this.noise(t,e.kind==='royal'?.2:.34,.18,e.kind==='royal'?5200:1900,'lowpass',300);this.tone(e.kind==='royal'?1320:880,t,.45,.06,'triangle',440,.5);return;
      case 'finisherFizzle':this.tone(440,t,.3,.03,'sine',220);return;
      case 'meteor':this.noise(t,.4,.06,600,'bandpass',3000,1);this.tone(90,t+.35,.4,.16,'sine',40);return;
      case 'reduce':this.tone(300,t,.5,.06,'sine',900);this.chord([392,523,659],t+.05,.5,.03,'triangle',.02,.5);return;
      case 'armageddonBlast':this.tone(60,t,.8,.3,'sine',28);this.noise(t,.7,.2,1800,'lowpass',200,.9);this.chord([65,98,131],t+.02,.7,.04,'sawtooth',.01,.6);return;
      case 'ward':this.tone(1180,t,.12,.045,'sine');this.tone(1570,t+.06,.16,.035,'sine');return;
      case 'requiem':this.tone(140,t,.9,.09,'sine',70);this.noise(t,.5,.06,5200,'highpass',1800,.7);this.chord([392,494,587,740],t+.05,.9,.035,'triangle',.02,.6);return;
      case 'sunCharge':this.chord([523,659,784],t,.5,.035,'sine',.02,.5);this.tone(1568,t+.12,.2,.03,'sine');return;
      case 'sunSpend':this.tone(220,t,.7,.1,'sawtooth',880);this.noise(t,.5,.07,3000,'highpass',900,.6);this.chord([523,659,784,1047],t+.1,.7,.04,'triangle',.02,.5);return;
      case 'jokerColor':for(let i=0;i<5;i++)this.tone(600+i*110,t+i*.045,.06,.05,'square');this.tone(1320,t+.26,.2,.05,'triangle');return;
      case 'bombSet':this.tone(520,t,.14,.07,'triangle',760);this.tone(1040,t+.05,.1,.04,'sine',null,.4);return;
      case 'bombBlast':this.tone(80,t,.5,.26,'sine',32);this.noise(t,.45,.16,1500,'lowpass',260,.8);this.chord([72,76,79],t+.02,.4,.03,'triangle',.01,.4);return;
      case 'impact':this.tone(95,t,.25,.1,'sine',45);this.noise(t,.18,.05,1500,'lowpass');return;
      case 'chain':this.noise(t,.12,.03,4000,'bandpass',7000,3);return;
      case 'frostBreak':[96,100,103].forEach((n,i)=>this.tone(midi(n),t+i*.03,.18,.012,'sine',null,.5));this.noise(t,.15,.03,7000,'highpass');return;
      case 'phoenix':this.chord([69,76,81,88],t,1.1,.04,'triangle',.06,.6);this.noise(t,.8,.04,900,'bandpass',6000,.8,.4);return;
      case 'blessing':[76,81,88].forEach((n,i)=>this.tone(midi(n),t+i*.06,.4,.04,'triangle',null,.5));return;
      case 'ribbon':[83,88,93].forEach((n,i)=>this.tone(midi(n),t+.1+i*.07,.2,.04,'triangle',null,.4));return;
      case 'wave':this.chord([64,71,76],t,.5,.05,'triangle',.06,.4);this.noise(t,.4,.02,1200,'bandpass',4000,.8);return;
      case 'warning':case 'bossApproach':this.tone(330,t,.22,.07,'square');this.tone(330,t+.3,.22,.07,'square');this.tone(80,t,.5,.06,'sawtooth',60);return;
      case 'boss':this.tone(55,t,1.2,.2,'sawtooth',41);this.noise(t,1,.06,300,'lowpass',90);this.chord([50,53,57],t+.1,1.2,.05,'sawtooth',.0,.5);return;
      case 'bossCast':case 'judgement':case 'seal':case 'curse':case 'drain':this.tone(165,t,.5,.12,'sawtooth',110);this.tone(82,t,.5,.1,'sine',55);this.noise(t,.45,.08,700,'bandpass',200,1.5,.3);return;
      case 'interrupt':this.tone(980,t,.12,.05,'square',1470);this.noise(t,.1,.04,6000,'highpass');return;
      case 'leak':this.tone(150,t,.34,.2,'sawtooth',55);this.tone(75,t,.3,.14,'sine',40);this.noise(t,.22,.1,500,'lowpass');return;
      case 'clear':this.fanfare(t);return;
      case 'perfect':this.perfect();return;
      case 'defeat':[64,60,57,52].forEach((n,i)=>this.tone(midi(n),t+i*.22,.6,.05,'triangle',null,.4));return;
    }
  }
  // Clear fanfare: brassy chord steps. Perfect adds a rising sparkle and a final shine on the result.
  fanfare(t){this.chord([60,64,67],t,.28,.05,'sawtooth',0,.35);this.chord([65,69,72],t+.18,.28,.05,'sawtooth',0,.35);this.chord([67,71,74,79],t+.36,.9,.055,'sawtooth',.01,.45);
    this.tone(midi(36),t+.36,.9,.12,'sine');this.noise(t+.36,.5,.04,6000,'highpass',null,.7,.4);
}
  perfect(){if(!this.ctx||!this.enabled)return;const t=this.ctx.currentTime+.2;[84,88,91,96,100,103].forEach((n,i)=>this.tone(midi(n),t+i*.055,.5,.03,'triangle',null,.6));this.chord([72,76,79,84,88],t+.4,1.4,.035,'triangle',.015,.6);this.tone(midi(48),t+.4,1.2,.08,'sine');}
  // Lobby actions (profile commands that succeeded).
  action(name,result={}){if(!this.ctx||!this.enabled)return;const t=this.ctx.currentTime;
    if(name==='gift'||name==='pet'){const up=result.hearts>0||result.gained>0;[79,83,86].forEach((n,i)=>this.tone(midi(n),t+i*.06,.35,.04,'sine',null,.5));if(up)this.chord([84,88,91,96],t+.22,1,.035,'triangle',.05,.6);}
    else if(['daily','idle','claimDispatch','claimMonthly','pityClaim','basket','libraryStar'].includes(name)){for(let i=0;i<5;i++)this.tone(midi(88+[0,4,7,12,16][i]),t+i*.05,.25,.03,'square',null,.25);this.noise(t,.3,.02,7000,'highpass',null,.7,.3);}
    else if(name==='enhance'||name==='bed'){[72,76,79,84].forEach((n,i)=>this.tone(midi(n),t+i*.05,.3,.045,'triangle',null,.35));this.noise(t,.2,.03,1000,'bandpass',6000,1);}
    else if(name==='answer'){if(result.correct)[79,84].forEach((n,i)=>this.tone(midi(n),t+i*.08,.3,.05,'triangle',null,.3));else this.tone(220,t,.25,.05,'triangle',180);}}
  // Summon reveal: a rising sweep, the impact, then an arpeggio and shimmer that grow with rarity.
  reveal(top){this.unlock();if(!this.ctx||!this.enabled)return;const t=this.ctx.currentTime,rank=Math.max(0,RANK.indexOf(top));
    this.noise(t,.6,.05,300,'bandpass',5000,1.1);this.tone(220,t,.6,.04,'sine',880);this.tone(66,t+.58,.5,.18,'sine',35);this.noise(t+.58,.35,.07,3600,'lowpass',500);
    [72,76,79,84,88,91].slice(0,3+rank).forEach((n,i)=>this.tone(midi(n),t+.64+i*.07,.7,.05,'triangle',null,.45));
    if(rank>=2)this.chord([84,88,91,96],t+1.08,1.6,.03,'sine',.05,.7);
    if(rank>=3){this.chord([60,64,67,72],t+1.08,1.6,.05,'sawtooth',.01,.5);this.noise(t+1.08,1.2,.03,8000,'highpass',null,.7,.6);}}
  click(){this.unlock();if(this.ctx&&this.enabled){const t=this.ctx.currentTime;this.tone(880,t,.05,.035,'sine',660);this.noise(t,.02,.01,5000,'highpass');}}
  setVolume(n){this.volume=n;if(this.master)this.master.gain.setTargetAtTime(n,this.ctx.currentTime,.04);}
  suspend(){this.next=0;if(this.ctx?.state==='running')this.ctx.suspend().catch(()=>{});}
}
