import test from 'node:test';
import assert from 'node:assert/strict';
import {RenderClock,RunSaveQueue} from '../src/runtime.js';

test('60, 90 and 120Hz delivery keeps a 60Hz render ceiling without interval drift; pause uses 12Hz',()=>{
  for(const hz of [60,90,120]){const clock=new RenderClock();let draws=0;for(let i=0;i<hz*10;i++)if(clock.next(100+i*1000/hz)!==null)draws++;assert.ok(draws>=598&&draws<=601,`${hz}: ${draws}`);}
  const clock=new RenderClock();let draws=0;for(let i=0;i<1200;i++)if(clock.next(100+i*1000/120,true)!==null)draws++;assert.ok(draws>=119&&draws<=121);
  clock.reset();assert.equal(clock.next(50000),0,'a resumed window has no hidden-time catch-up');
});

test('one deferred checkpoint writes the latest state, and explicit flush cancels its pending idle job',()=>{
  let time=0,id=0,state='old',written=[],failed=0;const jobs=new Map();
  const queue=new RunSaveQueue(()=>{written.push(state);return true;},{now:()=>time,request:cb=>{jobs.set(++id,cb);return id;},cancel:id=>jobs.delete(id),failed:()=>failed++});
  queue.mark();time=7999;queue.schedule();assert.equal(jobs.size,0);time=8000;queue.schedule();queue.schedule();assert.equal(jobs.size,1);
  state='latest';const job=jobs.values().next().value;jobs.clear();job();assert.deepEqual(written,['latest']);assert.equal(queue.dirty,false);
  queue.mark();time=16000;queue.schedule();assert.equal(jobs.size,1);assert.equal(queue.flush(),true);assert.equal(jobs.size,0);assert.equal(queue.writes,2);assert.equal(failed,0);
  queue.mark();queue.reset();assert.equal(queue.dirty,false);assert.equal(jobs.size,0);
});

test('failed checkpoints retain dirty state and call the pause handler without losing a successful save',()=>{
  let failed=0;const queue=new RunSaveQueue(()=>false,{now:()=>0,request:()=>1,cancel:()=>{},failed:()=>failed++});
  queue.mark();assert.equal(queue.flush(),false);assert.ok(queue.dirty);assert.equal(failed,1);assert.equal(queue.writes,0);
  queue.write=()=>true;assert.equal(queue.flush(),true);assert.equal(queue.failures,1);assert.equal(queue.writes,1);
});
