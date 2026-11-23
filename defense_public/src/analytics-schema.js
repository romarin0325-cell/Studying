// Shared by the browser and collector. No identity, timestamp, URL or free text.
const bool=v=>typeof v==='boolean',integer=max=>v=>Number.isInteger(v)&&v>=0&&v<=max;
const oneOf=(...values)=>v=>values.includes(v);
const screen=oneOf('home','collection','adventure','summon','garden','library','battle','draft','settings');
const mode=oneOf('main','challenge','weekly','monthly','oath','twin'),tier=oneOf('none','easy','hard','abyss');
export const SCHEMA=Object.freeze({
  game_boot:{},
  screen_view:{screen},
  tutorial_step:{step:oneOf('lobby','prepare','summon','merge','cast','auto','firstTen','formation','all'),status:oneOf('shown','completed','skipped')},
  battle_start:{mode,stage:integer(108),tier,entry:oneOf('new','resume'),auto:bool},
  battle_end:{mode,stage:integer(108),tier,result:oneOf('win','loss','leave'),wave:oneOf('0','1_3','4_6','7_9','10_plus'),duration:oneOf('under_1m','1_5m','5_15m','15_60m','over_60m'),auto:bool},
  progress:{screen,stage:integer(108)},
  backup_action:{action:oneOf('export','import'),outcome:oneOf('success','failure')},
  game_error:{code:oneOf('save_unavailable','assets_failed','uncaught','unhandled')},
});
export const timeBucket=seconds=>seconds<60?'under_1m':seconds<300?'1_5m':seconds<900?'5_15m':seconds<3600?'15_60m':'over_60m';
export const waveBucket=wave=>wave<=0?'0':wave<=3?'1_3':wave<=6?'4_6':wave<=9?'7_9':'10_plus';
export function validEvent(name,fields){
  const schema=typeof name==='string'&&Object.hasOwn(SCHEMA,name)?SCHEMA[name]:null;
  return !!schema&&fields!==null&&typeof fields==='object'&&!Array.isArray(fields)&&Object.keys(fields).length===Object.keys(schema).length&&Object.entries(schema).every(([key,check])=>Object.hasOwn(fields,key)&&check(fields[key]));
}
export function cleanEvent(event){
  if(!event||Object.keys(event).sort().join(',')!=='event,fields'||!validEvent(event.event,event.fields))return null;
  return {event:event.event,fields:Object.fromEntries(Object.keys(SCHEMA[event.event]).sort().map(k=>[k,event.fields[k]]))};
}
