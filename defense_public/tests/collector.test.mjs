import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker,{collect} from '../deploy/cloudflare/worker.mjs';

// Execute the production SQL against SQLite; batch emulates D1's atomic transaction.
function fixture(){
  const db=new DatabaseSync(':memory:');
  db.exec(fs.readFileSync(new URL('../deploy/cloudflare/migrations/0001_counts.sql',import.meta.url),'utf8'));
  const prepare=(sql,values=[])=>({bind(...args){return prepare(sql,args);},first(){return db.prepare(sql).get(...values);},execute(){const statement=db.prepare(sql);return {results:statement.columns().length?statement.all(...values):(statement.run(...values),[])};}});
  const env={ANALYTICS_ENABLED:'true',EVENT_LIMITER:{limit:async({key})=>{assert.equal(key,'public-events');return {success:true};}},DB:{prepare,batch:async statements=>{db.exec('BEGIN');try{const result=statements.map(s=>s.execute());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}}};
  return {db,env};
}
const boot={event:'game_boot',fields:{}};
const request=(body={events:[boot]},headers={},url='https://game.example/api/event')=>new Request(url,{method:'POST',headers:{origin:'https://game.example','content-type':'application/json',...headers},body:JSON.stringify(body)});
test('collector rejects unapproved fields, cross-origin, oversized and malformed input without writes',async()=>{
  const {db,env}=fixture();try{
    for(const body of [{events:[{...boot,fields:{ip:'1.2.3.4'}}]},{events:[boot],save:'secret'},{events:Array(9).fill(boot)},{events:[]},{events:[{event:'__proto__',fields:{}}]},{events:[{event:{toString:{}},fields:{}}]},null])assert.equal((await collect(request(body),env)).status,400);
    assert.equal((await collect(request({events:[boot]},{origin:'https://evil.example'}),env)).status,403);
    assert.equal((await collect(request({events:[boot]},{'sec-fetch-site':'cross-site'}),env)).status,403);
    assert.equal((await collect(request({events:[boot]},{},'https://game.example/api/event?user=abc'),env)).status,403);
    assert.equal((await collect(request({events:[boot]},{'content-type':'text/plain'}),env)).status,415);
    assert.equal((await collect(request({events:[boot],extra:'x'.repeat(8192)}),env)).status,400);
    assert.equal((await collect(new Request('https://game.example/api/event'),env)).status,405);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM daily_counts').get().n,0);
  }finally{db.close();}
});
test('only daily aggregate counts survive; concurrent requests obey the atomic cap',async()=>{
  const {db,env}=fixture();try{
    for(let i=0;i<2;i++)assert.equal((await collect(request({events:[boot,boot]}),env)).status,204);
    const rows=db.prepare('SELECT * FROM daily_counts').all();assert.equal(rows.length,1);
    assert.deepEqual({...rows[0]},{day:new Date().toISOString().slice(0,10),event:'game_boot',bucket:'{}',hits:4});
    // Force both callers past the read guard to exercise the transaction's real cap.
    db.exec('UPDATE daily_budget SET used=9999');
    const original=env.DB.prepare;env.DB.prepare=sql=>sql.startsWith('SELECT used')?{bind:()=>({first:async()=>null})}:original(sql);
    const responses=await Promise.all([collect(request(),env),collect(request(),env)]);
    assert.deepEqual(responses.map(r=>r.status).sort(),[204,429]);
    assert.equal(db.prepare('SELECT used FROM daily_budget').get().used,10000);
    assert.equal(db.prepare('SELECT hits FROM daily_counts').get().hits,5);
    env.DB.batch=async()=>{throw Error('DB down');};assert.equal((await collect(request(),env)).status,503);
  }finally{db.close();}
});
test('disabled or rate-limited collector is fail-closed; retention keeps 30 UTC dates',async()=>{
  const {db,env}=fixture();try{
    assert.equal((await collect(request(),{...env,ANALYTICS_ENABLED:'false'})).status,204);
    assert.equal((await collect(request(),{...env,EVENT_LIMITER:{limit:async()=>({success:false})}})).status,429);
    assert.equal((await collect(request(),{...env,EVENT_LIMITER:null})).status,429);
    db.exec("INSERT INTO daily_counts VALUES(date('now','-30 days'),'game_boot','{}',1),(date('now','-29 days'),'game_boot','{}',1)");
    db.exec("INSERT INTO daily_budget VALUES(date('now','-30 days'),1,1),(date('now','-29 days'),1,1)");
    await worker.scheduled({},env);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM daily_counts').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM daily_budget').get().n,1);
  }finally{db.close();}
});
