import {newState} from './state.js';
import {reduce} from './commands.js';
import {validateState,validateAndMigrate,exportSave} from './migrations.js';
const NAME='astralIdle:v1';
export class SaveStore{
 constructor(){this.mode='memory';this.state=null;this.db=null;this.queue=Promise.resolve();this.readOnly=false;this.previous=[];this.listeners=new Set();this.instance=globalThis.crypto?.randomUUID?.()||String(Math.random());}
 async open(){
  try{this.db=await new Promise((resolve,reject)=>{const req=indexedDB.open(NAME,1);req.onupgradeneeded=()=>req.result.createObjectStore('profile');req.onerror=()=>reject(req.error);req.onsuccess=()=>resolve(req.result);req.onblocked=()=>reject(Error('저장소가 다른 탭에 의해 잠겼습니다.'));});await this.idbProbe();this.mode='indexedDB';}catch{this.db?.close();this.db=null;try{localStorage.setItem(NAME+':probe','ok');if(localStorage.getItem(NAME+':probe')!=='ok')throw Error('probe');localStorage.removeItem(NAME+':probe');this.mode='localStorage';}catch{this.mode='memory';}}
  const record=await this.readRecord();if(record){try{this.state=validateState(record.state);this.previous=record.previous||[];}catch(error){this.loadError=error.message;for(const text of record.previous||[])try{this.state=validateAndMigrate(text);this.recovered=true;break;}catch{}if(!this.state)throw Error('저장을 읽을 수 없습니다. 원본을 보존했습니다. '+error.message);}}
  if(!this.state){this.state=newState();await this.writeInitial();}
  if(typeof BroadcastChannel!=='undefined'){this.channel=new BroadcastChannel(NAME);this.channel.onmessage=async({data})=>{if(data.instance===this.instance)return;if(this.mode==='localStorage'&&!navigator.locks){this.readOnly=true;if(data.type==='hello')this.channel.postMessage({type:'present',instance:this.instance});}if(data.type==='changed'){const current=await this.readRecord();if(current?.state)this.state=current.state;this.emit();}};this.channel.postMessage({type:'hello',instance:this.instance});}
  return this;
 }
 idbProbe(){return new Promise((resolve,reject)=>{const tx=this.db.transaction('profile','readwrite'),store=tx.objectStore('profile');store.put('ok','probe');const q=store.get('probe');q.onsuccess=()=>{if(q.result!=='ok')tx.abort();store.delete('probe');};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(Error('IndexedDB probe failed'));});}
 async readRecord(){if(this.mode==='indexedDB')return new Promise((resolve,reject)=>{const tx=this.db.transaction('profile','readonly'),q=tx.objectStore('profile').get('current');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});if(this.mode==='localStorage'){const text=localStorage.getItem(NAME);return text?JSON.parse(text):null;}return this.state?{state:this.state,previous:this.previous}:null;}
 async writeInitial(){const record={state:this.state,previous:[]};if(this.mode==='indexedDB')await new Promise((resolve,reject)=>{const tx=this.db.transaction('profile','readwrite'),store=tx.objectStore('profile'),read=store.get('current');read.onsuccess=()=>{if(read.result){this.state=read.result.state;this.previous=read.result.previous||[];}else store.put(record,'current');};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});else if(this.mode==='localStorage')localStorage.setItem(NAME,JSON.stringify(record));}
 emit(){for(const fn of this.listeners)fn(this.state);}
 dispatch(command){const run=()=>this.commit({...command,id:command.id||crypto.randomUUID(),expectedRevision:command.expectedRevision??this.state.revision});const promise=this.queue.then(run,run);this.queue=promise.catch(()=>{});return promise;}
 async commit(command){
  if(this.readOnly)throw Error('저장 호환 모드에서는 다른 탭을 닫고 새로고침해 주세요.');
  const apply=current=>{const output=reduce(current,command,{now:Date.now()});validateState(output.state);return output;};
  let output;
  if(this.mode==='indexedDB')await new Promise((resolve,reject)=>{
   const tx=this.db.transaction('profile','readwrite'),store=tx.objectStore('profile'),q=store.get('current');let problem;
   q.onsuccess=()=>{try{const record=q.result;output=apply(record.state);const previous=command.type==='tick'?record.previous:[exportSave(record.state),...(record.previous||[])].slice(0,2);store.put({state:output.state,previous},'current');}catch(error){problem=error;tx.abort();}};
   tx.oncomplete=resolve;tx.onerror=()=>reject(problem||tx.error);tx.onabort=()=>reject(problem||Error('저장하지 못했습니다. 보상을 지급하지 않았습니다.'));
  });else{
   const local=async()=>{const record=await this.readRecord(),current=record?.state||this.state;output=apply(current);const previous=command.type==='tick'?this.previous:[exportSave(current),...this.previous].slice(0,2);if(this.mode==='localStorage')localStorage.setItem(NAME,JSON.stringify({state:output.state,previous}));this.previous=previous;};
   if(this.mode==='localStorage'&&navigator.locks)await navigator.locks.request(NAME,local);else await local();
  }
  this.state=output.state;this.channel?.postMessage({type:'changed',instance:this.instance});this.emit();return output.result;
 }
 async restore(text){const imported=validateAndMigrate(text);const run=async()=>{
  if(this.readOnly)throw Error('읽기 전용 탭입니다.');
  const replace=current=>({...structuredClone(imported),revision:current.revision+1,commands:[]});
  if(this.mode==='indexedDB')await new Promise((resolve,reject)=>{const tx=this.db.transaction('profile','readwrite'),store=tx.objectStore('profile'),q=store.get('current');q.onsuccess=()=>{const r=q.result;this.restored=replace(r.state);store.put({state:this.restored,previous:[exportSave(r.state),...(r.previous||[])].slice(0,2)},'current');};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});else{const current=(await this.readRecord())?.state||this.state;this.restored=replace(current);const record={state:this.restored,previous:[exportSave(current),...this.previous].slice(0,2)};if(this.mode==='localStorage')localStorage.setItem(NAME,JSON.stringify(record));this.previous=record.previous;}
  this.state=this.restored;this.channel?.postMessage({type:'changed',instance:this.instance});this.emit();return this.state;
 };const locked=()=>this.mode==='localStorage'&&navigator.locks?navigator.locks.request(NAME,run):run();const promise=this.queue.then(locked,locked);this.queue=promise.catch(()=>{});return promise;}
 close(){this.db?.close();this.channel?.close();}
}
