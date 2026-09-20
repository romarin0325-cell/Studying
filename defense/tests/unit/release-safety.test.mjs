import test from 'node:test';
import assert from 'node:assert/strict';
import { AssetManager } from '../../js/render/AssetManager.js';
import { formatElapsedTime } from '../../js/app/screens/ResultScreen.js';
import { roundedRect } from '../../js/render/CanvasShapes.js';
import { BattleRenderer } from '../../js/render/BattleRenderer.js';
import { keySpritePixels } from '../../../scripts/import_defense_sprite.mjs';

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
test('offline hue key preserves even edge-connected white hair and pale costumes',()=>{
  const data=Buffer.from([255,255,255,255, 255,0,255,255, 140,0,140,255, 200,235,255,255, 240,190,210,255]);
  keySpritePixels(data,5,1);
  assert.deepEqual([data[3],data[7],data[11],data[15],data[19]],[255,0,0,255,255]);
  assert.deepEqual([...data.subarray(0,3)],[255,255,255]);
});
