// Simulation time stays independent of the display refresh rate. Carry the
// remainder so a slightly late 60Hz callback cannot halve the render rate.
export class RenderClock{
  constructor(){this.reset();}
  reset(){this.last=0;this.rendered=0;this.credit=0;}
  next(time,resting=false){
    const interval=1000/(resting?12:60),elapsed=this.last?Math.max(0,time-this.last):interval;this.last=time;this.credit+=elapsed;
    if(this.credit+.2<interval)return null;
    this.credit=Math.max(0,this.credit-interval*Math.max(1,Math.floor((this.credit+.2)/interval)));
    const dt=this.rendered?Math.min(.1,(time-this.rendered)/1000):0;this.rendered=time;return dt;
  }
}

// Only one idle job may own a pending checkpoint. The latest live run is
// serialized inside that job; command transactions keep their atomic writes.
export class RunSaveQueue{
  constructor(write,{request,cancel,failed,now=()=>performance.now(),interval=8000}){
    this.write=write;this.request=request;this.cancel=cancel;this.failed=failed;this.now=now;this.interval=interval;
    this.pending=null;this.dirty=false;this.last=now();this.writes=0;this.failures=0;
  }
  mark(){this.dirty=true;}
  schedule(){
    if(!this.dirty||this.pending!==null||this.now()-this.last<this.interval)return;
    this.pending=this.request(()=>{this.pending=null;this.flush();});
  }
  flush(){
    if(this.pending!==null){this.cancel(this.pending);this.pending=null;}
    if(!this.dirty)return true;
    if(!this.write()){this.failures++;this.failed();return false;}
    this.writes++;this.last=this.now();this.dirty=false;return true;
  }
  reset(){if(this.pending!==null)this.cancel(this.pending);this.pending=null;this.dirty=false;this.last=this.now();}
}
