import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnalytics,localEventAdapter} from '../src/analytics.js';
import {validEvent,cleanEvent,timeBucket,waveBucket} from '../src/analytics-schema.js';
import {createProfile,ProfileStore} from '../src/profile.js';
import {observeProfileStorage,tutorialStepForGuide} from '../src/public-session.js';

test('ordinary command refusals and conflicting saves do not count as unavailable storage',()=>{
  let raw=null,failures=0;
  const storage=observeProfileStorage({getItem:()=>raw,setItem:(_key,value)=>{raw=value;}},()=>failures++);
  const store=new ProfileStore(storage);
  assert.equal(store.transact('begin',{mode:'main',stage:108}).ok,false);
  raw=JSON.stringify(createProfile());
  assert.equal(store.transact('begin',{mode:'main',stage:1}).ok,false);
  assert.ok(store.conflict);
  assert.equal(failures,0);
});

test('coach variants enqueue only the allowed logical shown step',async()=>{
  const batches=[];
  const analytics=createAnalytics({enabled:true,adapter:{send:batch=>batches.push(batch)}});
  const variants=[
    ['merge:0:1','merge'],['merge-more','merge'],['cast:star_boy','cast'],
    ['ten','firstTen'],['ten-go','firstTen'],['ten-nav','firstTen'],
    ['team-auto','formation'],['team-save','formation'],
  ];
  for(const [id] of variants){
    assert.ok(analytics.track('tutorial_step',{step:tutorialStepForGuide(id),status:'shown'}),id);
  }
  await analytics.flush();
  assert.deepEqual(batches.flat().map(e=>e.fields),variants.map(([,step])=>({step,status:'shown'})));
  for(const id of ['dodge','tour:hero:1:n','next'])assert.equal(tutorialStepForGuide(id),null);
});

test('disabled config never sends; enabled capture accepts only exact, non-identifying fields',async()=>{
  for(const enabled of [false,undefined,'true']){
    const a=createAnalytics({enabled,adapter:{send:()=>assert.fail('network')}});
    assert.equal(a.track('game_boot',{}),false);assert.equal(await a.flush(),false);
  }
  const batches=[],a=createAnalytics({enabled:true,adapter:{send:async b=>batches.push(b)}});
  assert.equal(a.track('game_boot',{}),true);
  for(const field of ['email','api_key','save','url','stack','query','message','user_id','session_id','device_id','timestamp','ip'])assert.equal(a.track('game_boot',{[field]:'private'}),false);
  assert.equal(a.track('game_boot',createProfile()),false);
  assert.equal(a.track('screen_view',{screen:'https://example.com/?secret'}),false);
  assert.equal(validEvent('game_error',{code:'arbitrary stack'}),false);
  assert.equal(validEvent('__proto__',{}),false);
  assert.equal(cleanEvent({event:'game_boot',fields:{},id:'extra'}),null);
  await a.flush();assert.deepEqual(batches,[[{event:'game_boot',fields:{}}]]);
  assert.equal(timeBucket(284),'1_5m');assert.equal(waveBucket(8),'7_9');
});
test('memory queue and page count are bounded; network failures are dropped without retries',async()=>{
  let attempts=0,accepted=0;
  const a=createAnalytics({enabled:true,adapter:{send:async()=>{attempts++;throw Error('offline');}}});
  for(let i=0;i<1000;i++)if(a.track('game_boot',{}))accepted++;
  assert.equal(accepted,24);
  for(let i=0;i<10;i++)await a.flush();assert.equal(attempts,3);
  for(let i=0;i<1000;i++){if(a.track('game_boot',{}))accepted++;await a.flush();}
  assert.equal(accepted,400);
  const before=attempts;await a.flush();assert.equal(attempts,before);
});
test('adapter uses one relative endpoint, no cookies/referrer and no redirects or retries',async()=>{
  let captured;const a=localEventAdapter(async(url,options)=>{captured={url,options};return {ok:false};});
  assert.equal(await a.send([{event:'game_boot',fields:{}}]),false);
  assert.equal(captured.url,'/api/event');assert.equal(captured.options.credentials,'omit');
  assert.equal(captured.options.referrerPolicy,'no-referrer');assert.equal(captured.options.redirect,'error');
  assert.equal(captured.options.cache,'no-store');
  assert.deepEqual(JSON.parse(captured.options.body),{events:[{event:'game_boot',fields:{}}]});
  assert.equal(await localEventAdapter(()=>{throw Error('offline');}).send([]),false);
});
