import test from 'node:test';
import assert from 'node:assert/strict';
import { AssetManager } from '../../js/render/AssetManager.js';
import { formatElapsedTime } from '../../js/app/screens/ResultScreen.js';
import { roundedRect } from '../../js/render/CanvasShapes.js';
import { BattleRenderer } from '../../js/render/BattleRenderer.js';
import { removeBackground } from '../../../scripts/prepare_defense_art.mjs';

test('result time carries rounded seconds into minutes',()=>{
  for(const [value,expected] of [[179.49,'2분 59초'],[179.5,'3분 0초'],[59.99,'1분 0초'],[0,'0분 0초'],[NaN,'0분 0초']])
    assert.equal(formatElapsedTime(value),expected);
});
test('missing roundRect constructs a closed four-corner path',()=>{
  const calls=[];
  const ctx=new Proxy({}, {get:(_,key)=>key==='roundRect'?undefined:(...args)=>calls.push([key,...args])});
  roundedRect(ctx,1,2,20,10,4);
  assert.equal(calls.filter(c=>c[0]==='quadraticCurveTo').length,4);
  assert.equal(calls.at(-1)[0],'closePath');
});
test('hung and failed media settle, deduplicate, and never replace fallback with late resources',async()=>{
  let late, calls=0;
  const manager=new AssetManager({manifest:[
    {id:'a',type:'image',path:'hang'}, {id:'alias',type:'image',path:'hang'},
    {id:'b',type:'image',path:'reject'},
  ], timeoutMs:20,logger:{warn(){}},imageLoader:p=>{
    calls++;return p==='hang'?new Promise(resolve=>late=resolve):Promise.reject(new Error('offline'));
  }});
  assert.deepEqual((await manager.preload()).failed,['a','alias','b']);
  late({width:10,height:10});await Promise.resolve();
  assert.equal(manager.getImage('a'),null);
  assert.deepEqual((await manager.preload()).failed,['a','alias','b']);
  assert.equal(calls,2);
  assert.equal(manager.pendingByRequest.size,0);
});
test('missing creature atlas paints ordinary enemy bodies and both objectives',()=>{
  const labels=[], queries=[];
  const ctx=new Proxy({}, {get:(_,key)=>key==='roundRect'?undefined:(...args)=>{if(key==='fillText')labels.push(args[0]);},set:()=>true});
  const canvas={getContext:()=>ctx,style:{}};
  const manager={getImage:id=>{queries.push(id);return null;},getEntry:()=>null};
  const renderer=new BattleRenderer({canvas,assetManager:manager});
  renderer.layout.resize(390,600,1);
  renderer.drawProp(ctx,'core',{x:30,y:30},35);
  renderer.drawProp(ctx,'portal',{x:60,y:30},35);
  renderer.drawEntity(ctx,{id:'e1',enemyId:'ruin_scarab',name:'유적딱정벌레',defenseType:'normal',element:'nature',hp:10,maxHp:10,x:2,y:2,progress:0},{phase:'WAVE_RUNNING'});
  assert.deepEqual(labels,['✦','→','유']);
  assert.equal(queries.some(id=>id.startsWith('boss/ruin_scarab/')),false);
});
test('offline alpha preparation preserves enclosed white costume details',()=>{
  const width=5,height=5,data=Buffer.alloc(width*height*4,255);
  for(let y=1;y<=3;y++)for(let x=1;x<=3;x++)if(x!==2||y!==2){
    const i=(y*width+x)*4;data[i]=20;data[i+1]=50;data[i+2]=80;
  }
  removeBackground(data,width,height,true);
  assert.equal(data[3],0);
  assert.equal(data[(2*width+2)*4+3],255);
  assert.equal(data[(1*width+1)*4+3],255);
});
