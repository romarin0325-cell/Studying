// Original adaptive score. Short scheduled phrases avoid drift and resume only
// after a gesture. No external audio request, autoplay loop or per-frame nodes.
export class Sound {
  constructor(){this.ctx=null;this.enabled=true;this.music=true;this.volume=.35;this.next=0;this.beat=0;this.timer=null;this.battle=false;this.boss=false;this.lastHit=0;}
  unlock(){
    if(!this.ctx){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;try{this.ctx=new Audio();this.master=this.ctx.createGain();this.master.gain.value=this.volume;this.master.connect(this.ctx.destination);this.timer=setInterval(()=>this.schedule(),120);}catch{return;}}
    if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});
  }
  tone(freq,time,duration,volume,type='sine',endFreq=null){if(!this.ctx||!this.enabled)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,time);if(endFreq)o.frequency.exponentialRampToValueAtTime(Math.max(1,endFreq),time+duration);g.gain.setValueAtTime(.0001,time);g.gain.exponentialRampToValueAtTime(Math.max(.001,volume),time+.008);g.gain.exponentialRampToValueAtTime(.0001,time+duration);o.connect(g);g.connect(this.master);o.start(time);o.stop(time+duration+.04);}
  noise(time,duration,volume,filter=1500){if(!this.ctx||!this.enabled)return;const c=this.ctx,b=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);const source=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();source.buffer=b;f.type='lowpass';f.frequency.value=filter;g.gain.setValueAtTime(volume,time);g.gain.exponentialRampToValueAtTime(.001,time+duration);source.connect(f);f.connect(g);g.connect(this.master);source.start(time);}
  schedule(){
    if(!this.ctx||!this.enabled||!this.music||document.hidden||this.ctx.state!=='running'){this.next=0;return;}
    const c=this.ctx,step=this.battle?.22:.32;if(this.next<c.currentTime)this.next=c.currentTime+.08;
    const chords=[[57,60,64,69],[53,57,60,65],[55,59,62,67],[52,55,59,64]];
    while(this.next<c.currentTime+.35){const n=this.beat,notes=chords[Math.floor(n/16)%4],note=notes[[0,2,1,3,2,1,3,2][n%8]],freq=440*Math.pow(2,(note-69)/12),t=this.next;
      this.tone(freq*2,t,.5,this.battle?.035:.043,'triangle');this.tone(freq*4,t+.012,.3,.006);
      if(n%4===0)this.tone(440*Math.pow(2,(notes[0]-24-69)/12),t,.75,.07,'sine');
      if(n%16===0)for(const k of notes)this.tone(440*Math.pow(2,(k-69)/12),t,step*14,.008,'sine');
      if(this.battle&&n%4===0){this.tone(this.boss?82:65,t,.18,.065,'sine',35);this.noise(t,.06,.012,700);}
      if(this.battle&&n%4===2)this.noise(t,.08,.018,this.boss?2300:1600);
      this.beat++;this.next+=step;
    }
  }
  event(e){if(!this.ctx||!this.enabled)return;const t=this.ctx.currentTime;
    if(e.type==='attack'){if(t-this.lastHit<.08)return;this.lastHit=t;this.tone(e.attackType==='slash'?180:420,t,.08,.025,'triangle',140);}
    if(e.type==='hit'){if(t-this.lastHit<.055)return;this.lastHit=t;this.noise(t,.045,.025,1200);}
    if(e.type==='summon'){[440,660,880].forEach((f,i)=>this.tone(f,t+i*.06,.22,.07,'sine'));}
    if(e.type==='merge'){[392,494,587,784,1175].forEach((f,i)=>this.tone(f,t+i*.055,.4,.07,'triangle'));this.noise(t,.17,.035,4000);}
    if(e.type==='skill'){this.tone(75,t,.5,.2,'sine',30);this.noise(t,.42,.1,3000);[523,659,784,1047].forEach((f,i)=>this.tone(f,t+.07*i,.7,.06,'triangle'));}
    if(e.type==='clear'){[523,659,784].forEach((f,i)=>this.tone(f,t+i*.1,.4,.06));}
    if(e.type==='leak'){this.tone(150,t,.3,.11,'sawtooth',55);}
    if(e.type==='warning'){this.tone(330,t,.2,.06);this.tone(330,t+.3,.2,.06);}
  }
  click(){this.unlock();if(this.ctx)this.tone(740,this.ctx.currentTime,.07,.05,'sine',600);}
  setVolume(n){this.volume=n;if(this.master)this.master.gain.setTargetAtTime(n,this.ctx.currentTime,.04);}
  suspend(){this.next=0;if(this.ctx?.state==='running')this.ctx.suspend().catch(()=>{});}
}
