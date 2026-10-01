// Original pentatonic nocturne, generated locally. No audio files or network.
export class AudioDirector {
  constructor(settings){this.settings=settings;this.ctx=null;this.next=0;this.beat=0;this.last=0;this.playing=false;this.boss=false;this.paused=false;this.timer=null;}
  unlock(){try{if(!this.ctx){const A=globalThis.AudioContext||globalThis.webkitAudioContext;if(!A)return;this.ctx=new A();this.master=this.ctx.createGain();this.master.connect(this.ctx.destination);this.setVolume(this.settings.volume);this.timer=setInterval(()=>this.schedule(),130);}if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});}catch{}}
  setVolume(v){this.settings.volume=v;if(this.master)this.master.gain.setTargetAtTime(v*.55,this.ctx.currentTime,.1);}
  tone(f,t,d,v,type='sine',end){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(end)o.frequency.exponentialRampToValueAtTime(Math.max(1,end),t+d);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.001,v),t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+d+.03);}
  schedule(){if(!this.ctx||!this.settings.music||document.hidden||this.paused||this.ctx.state!=='running'){this.next=0;return;}const c=this.ctx;if(this.next<c.currentTime)this.next=c.currentTime+.06;
    const chords=[[57,60,64,69],[53,57,60,65],[55,59,62,67],[52,55,59,64]],pattern=[0,2,3,2,1,3,2,1],step=this.boss?.19:this.playing?.25:.36;
    while(this.next<c.currentTime+.32){const n=this.beat,chord=chords[Math.floor(n/16)%4],note=chord[pattern[n%8]],hz=440*2**((note-69)/12);this.tone(hz*2,this.next,.48,.035,'triangle');if(n%4===0)this.tone(440*2**((chord[0]-24-69)/12),this.next,.8,.06);if(n%16===0)for(const pitch of chord)this.tone(440*2**((pitch-69)/12),this.next,step*13,.006);if(this.playing&&n%4===0)this.tone(this.boss?80:60,this.next,.16,.045,'sine',30);this.beat++;this.next+=step;}}
  click(){this.unlock();if(this.ctx&&this.settings.sound)this.tone(720,this.ctx.currentTime,.09,.055,'sine',520);}
  event(e){if(!this.ctx||!this.settings.sound||this.paused)return;const t=this.ctx.currentTime;
    if(e.type==='hit'){if(t-this.last<.09||e.periodic)return;this.last=t;this.tone(e.crit?920:420,t,.055,.016,'triangle',180);}
    if(e.type==='hurt')this.tone(170,t,.22,.1,'triangle',55);
    if(e.type==='dash')this.tone(300,t,.16,.04,'triangle',650);
    if(['level','treasure','evolution','skill','finish'].includes(e.type)){const pitches=e.type==='evolution'?[392,494,587,784,1175]:e.type==='skill'?[261,392,523,784]:[523,659,784];pitches.forEach((f,i)=>this.tone(f,t+i*.065,.5,.065,'triangle'));}
    if(e.type==='boss'){this.tone(80,t,.65,.1,'sine',40);this.tone(165,t+.2,.4,.035,'triangle');}
  }
  suspend(){this.paused=true;this.next=0;if(this.ctx?.state==='running')this.ctx.suspend().catch(()=>{});}
}
