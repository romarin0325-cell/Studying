import test from 'node:test';
import assert from 'node:assert/strict';
import { createProfile } from '../meta.js';
import { makeQuestion, recordAnswer, pickReviewMistake, claimReviewReward } from '../learning.js';
import { LumiTutorClient, TUTOR_MODELS, buildTutorPrompt, offlineTutorLesson } from '../tutoring.js';

const question=()=>({...makeQuestion('grammar',()=>0),selectedAnswer:'a wrong choice'});
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k),values};};
const ok=text=>({ok:true,json:async()=>({candidates:[{content:{parts:[{thought:true,text:'PRIVATE THOUGHT'},{text}]}}]})});
const failure=(status,body={})=>({ok:false,status,json:async()=>body});

test('mistakes retain the actual selected answer and cloned options without changing quiz rewards',()=>{
  const p=createProfile(),q=question(),wrong=q.options.find(o=>o!==q.answer);
  recordAnswer(p,q,wrong);q.options.push('changed');
  assert.equal(p.learning.mistakes[0].selectedAnswer,wrong);assert.ok(!p.learning.mistakes[0].options.includes('changed'));assert.equal(p.dreamShards,0);
  assert.equal(createProfile(JSON.parse(JSON.stringify(p))).learning.mistakes[0].selectedAnswer,wrong);
});
test('random lessons cover stored valid mistakes and preserve legacy entries without a selection',()=>{
  const p=createProfile(),a=question(),b=makeQuestion('vocab',()=>.5);
  p.learning.mistakes=[a,b,{id:'broken'},null];
  assert.equal(pickReviewMistake(p,()=>0).id,a.id);assert.equal(pickReviewMistake(p,()=>.999).id,b.id);
  assert.equal(pickReviewMistake(p,()=>0,a.id).id,b.id);
  p.learning.mistakes=[a];assert.equal(pickReviewMistake(p,()=>0,a.id).id,a.id);
  assert.notEqual(pickReviewMistake(p,()=>0).options,a.options);
  assert.match(offlineTutorLesson(b),/선택한|고른/);assert.match(buildTutorPrompt(b),/추측하지 마/);
});
test('daily review grants exactly one shard across retry, reload, and clock rollback; next local day grants again',()=>{
  let p=createProfile(),q=question();p.learning.mistakes=[q];
  const date=new Date(2026,9,2,23,59);
  assert.equal(claimReviewReward(p,q,date),true);assert.equal(p.dreamShards,1);
  p=createProfile(JSON.parse(JSON.stringify(p)));
  assert.equal(claimReviewReward(p,q,date),false);assert.equal(claimReviewReward(p,q,new Date(2026,9,1)),false);
  assert.equal(claimReviewReward(p,q,new Date(2026,9,3,0,1)),true);assert.equal(p.dreamShards,2);
});
test('empty and mismatched mistakes cannot earn rewards; full balances cannot overflow',()=>{
  const p=createProfile(),q=question();assert.equal(claimReviewReward(p,q),false);
  p.learning.mistakes=[q];assert.equal(claimReviewReward(p,{...q,answer:'invented'}),false);
  p.dreamShards=Number.MAX_SAFE_INTEGER;assert.equal(claimReviewReward(p,q),false);assert.equal(p.learning.reviewRewardDate,undefined);
});
test('lesson prompt includes the full question, selected wrong option and associated grammar source',()=>{
  const q=question();q.lectureId=q.lecture.id;
  const context=JSON.parse(buildTutorPrompt(q).split('문제 자료: ')[1]);assert.equal(context.question,q.prompt);assert.equal(context.correctAnswer,q.answer);assert.equal(context.selectedAnswer,q.selectedAnswer);assert.equal(context.lecture.title,q.lecture.title);
});
test('API key stays outside campaign storage, persistence is opt-in, and disconnect removes it',()=>{
  const s=storage(),c=new LumiTutorClient({storage:s});
  c.configure('  test-key  ');assert.equal(s.values.size,0);assert.equal(c.apiKey,'test-key');
  c.configure('test-key',true);assert.equal(new LumiTutorClient({storage:s}).apiKey,'test-key');
  c.disconnect();assert.equal(s.getItem('astral-bloom-tutor-key'),null);
});
test('storage-blocked connections and model selection stay usable in the session',()=>{
  const c=new LumiTutorClient({storage:{getItem(){throw Error('blocked');}}});
  assert.equal(c.configure('test-key',true),false);assert.equal(c.apiKey,'test-key');c.selectModel(TUTOR_MODELS[0].id);assert.equal(c.model,TUTOR_MODELS[0].id);
});
test('selected model and header authentication are used; thought parts are hidden; same lesson is cached',async()=>{
  const calls=[],c=new LumiTutorClient({storage:null,fetcher:async(url,options)=>{calls.push({url,options});return ok('### 핵심\n좋은 설명');}});
  c.configure('test-key');c.selectModel(TUTOR_MODELS[0].id);const q=question();
  const result=await c.request(q);assert.equal(result.text,'### 핵심\n좋은 설명');assert.equal(calls.length,1);
  assert.match(calls[0].url,/gemini-2.5-pro/);assert.ok(!calls[0].url.includes('test-key'));assert.equal(calls[0].options.headers['x-goog-api-key'],'test-key');
  assert.equal((await c.request(q)).cached,true);assert.equal(calls.length,1);
  assert.equal(JSON.parse(calls[0].options.body).generationConfig.thinkingConfig.thinkingBudget,1024);
});
test('unavailable, overloaded and quota-limited models fall through a bounded chain',async()=>{
  const urls=[],fallbacks=[],c=new LumiTutorClient({storage:null,fetcher:async url=>{urls.push(url);return urls.length===1?failure(404):urls.length===2?failure(429):ok('fallback lesson');}});
  c.configure('test-key');c.selectModel(TUTOR_MODELS[0].id);
  const result=await c.request(question(),{onFallback:m=>fallbacks.push(m)});
  assert.equal(result.model,TUTOR_MODELS[2].id);assert.equal(urls.length,3);assert.equal(fallbacks.length,2);assert.equal(c.model,TUTOR_MODELS[0].id);
});
test('exhausted quota ends after two default-model calls and retains the usable key',async()=>{
  let calls=0;const c=new LumiTutorClient({storage:null,fetcher:async()=>{calls++;return failure(429);}});c.configure('test-key');
  await assert.rejects(c.request(question()),e=>e.status===429);assert.equal(calls,2);assert.equal(c.apiKey,'test-key');
});
test('invalid credentials never retry other models and disconnect remembered keys',async()=>{
  for(const [status,body] of [[403,{}],[400,{error:{message:'API key not valid'}}]]) {
    let calls=0;const s=storage(),c=new LumiTutorClient({storage:s,fetcher:async()=>{calls++;return failure(status,body);}});c.configure('test-key',true);
    await assert.rejects(c.request(question()));assert.equal(calls,1);assert.equal(c.apiKey,'');assert.equal(s.getItem('astral-bloom-tutor-key'),null);
  }
});
test('missing key never sends a request',async()=>{
  const c=new LumiTutorClient({storage:null,fetcher:()=>{assert.fail('must not fetch');}});
  await assert.rejects(c.request(question()),e=>e.code==='KEY_INVALID');
});
test('closing a pending request aborts it without triggering fallback',async()=>{
  let calls=0;const c=new LumiTutorClient({storage:null,fetcher:async(url,{signal})=>{calls++;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Canceled','AbortError')),{once:true}));}});c.configure('test-key');
  const controller=new AbortController(),pending=c.request(question(),{signal:controller.signal});controller.abort();
  await assert.rejects(pending,e=>e.name==='AbortError');assert.equal(calls,1);
});
test('timeouts terminate each request and empty responses also use bounded fallback',async()=>{
  const c=new LumiTutorClient({storage:null,timeoutMs:5,fetcher:async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Timeout','AbortError')),{once:true}))});c.configure('test-key');
  await assert.rejects(c.request(question()),e=>e.code==='TIMEOUT');
  let calls=0;const empty=new LumiTutorClient({storage:null,fetcher:async()=>{calls++;return ok('');}});empty.configure('test-key');
  await assert.rejects(empty.request(question()),e=>e.code==='EMPTY');assert.equal(calls,2);
});
