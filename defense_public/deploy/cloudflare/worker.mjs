import {cleanEvent} from '../../src/analytics-schema.js';

const MAX_BYTES=8192,DAILY_CAP=10000;
const response=status=>new Response(null,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
async function readLimited(request){
  if(Number(request.headers.get('content-length'))>MAX_BYTES)throw new Error('size');
  if(!request.body)throw new Error('body');
  const reader=request.body.getReader();let size=0,text='';const decoder=new TextDecoder();
  try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES)throw new Error('size');text+=decoder.decode(value,{stream:true});}return JSON.parse(text+decoder.decode());}
  finally{await reader.cancel().catch(()=>{});}
}
export async function collect(request,env){
  if(request.method!=='POST')return response(405);
  if(env.ANALYTICS_ENABLED!=='true')return response(204);
  const url=new URL(request.url);
  if(url.search||request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')&&request.headers.get('sec-fetch-site')!=='same-origin')return response(403);
  if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return response(415);
  try{
    // Shared route limit, never keyed by IP, cookies, a person or a device.
    if(!env.EVENT_LIMITER||!(await env.EVENT_LIMITER.limit({key:'public-events'})).success)return response(429);
    let input;try{input=await readLimited(request);}catch{return response(400);}
    if(!input||Object.keys(input).join(',')!=='events'||!Array.isArray(input.events)||input.events.length<1||input.events.length>8)return response(400);
    const events=input.events.map(cleanEvent);if(events.some(e=>!e))return response(400);
    const day=new Date().toISOString().slice(0,10);
    const budget=await env.DB.prepare('SELECT used FROM daily_budget WHERE day = ?').bind(day).first();
    if(budget&&budget.used+events.length>DAILY_CAP)return response(429);
    const grouped=new Map();
    for(const event of events){const bucket=JSON.stringify(event.fields),key=event.event+'|'+bucket;const item=grouped.get(key)||{event:event.event,bucket,count:0};item.count++;grouped.set(key,item);}
    // The admission flag and increments share one atomic D1 batch transaction.
    // No request ID or raw event row is needed, including for concurrent requests.
    const statements=[env.DB.prepare(`INSERT INTO daily_budget(day,used,admitted) VALUES(?,?,1)
      ON CONFLICT(day) DO UPDATE SET admitted = CASE WHEN used + excluded.used <= ? THEN 1 ELSE 0 END,
      used = CASE WHEN used + excluded.used <= ? THEN used + excluded.used ELSE used END RETURNING admitted`).bind(day,events.length,DAILY_CAP,DAILY_CAP)];
    for(const item of grouped.values())statements.push(env.DB.prepare(`INSERT INTO daily_counts(day,event,bucket,hits)
      SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM daily_budget WHERE day = ? AND admitted = 1)
      ON CONFLICT(day,event,bucket) DO UPDATE SET hits = hits + excluded.hits`).bind(day,item.event,item.bucket,item.count,day));
    const results=await env.DB.batch(statements);
    return response(results[0].results[0]?.admitted===1?204:429);
  }catch{return response(503);}
}
export default {
  async fetch(request,env){
    const pathname=new URL(request.url).pathname;
    if(pathname==='/api/event')return collect(request,env);
    if(pathname.startsWith('/api/'))return response(404);
    return env.ASSETS.fetch(request);
  },
  async scheduled(_event,env){
    await env.DB.batch([
      env.DB.prepare("DELETE FROM daily_counts WHERE day < date('now','-29 days')"),
      env.DB.prepare("DELETE FROM daily_budget WHERE day < date('now','-29 days')"),
    ]);
  },
};
