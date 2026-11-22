import {cleanEvent} from './analytics-schema.js';
export function createAnalytics({enabled,adapter}){
  enabled=enabled===true;
  let queue=[],accepted=0,bytes=0,pending=null;
  return {
    enabled:enabled===true,
    track(event,fields){
      try{
        if(!enabled||queue.length>=24||accepted>=400)return false;
        const item=cleanEvent({event,fields});if(!item)return false;
        const size=JSON.stringify(item).length;if(bytes+size>64000)return false;
        bytes+=size;accepted++;queue.push(item);return true;
      }catch{return false;}
    },
    flush(){
      if(!enabled||pending||!queue.length)return Promise.resolve(false);
      const batch=queue.splice(0,8);
      // Drop failed batches: no persistent queue, identifiers, retries or unload beacon duplicates.
      pending=Promise.resolve().then(()=>adapter.send(batch)).catch(()=>false).finally(()=>{pending=null;});
      return pending;
    },
  };
}
export function localEventAdapter(send=globalThis.fetch){
  return {
    async send(events){
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
      try{
        const response=await send('/api/event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({events}),credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',cache:'no-store',keepalive:true,signal:controller.signal});
        return response.ok;
      }catch{return false;}
      finally{clearTimeout(timer);}
    },
  };
}
