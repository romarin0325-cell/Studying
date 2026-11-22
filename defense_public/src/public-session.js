import {createAnalytics,localEventAdapter} from './analytics.js';
import {timeBucket,waveBucket} from './analytics-schema.js';

// Only the logical tutorial step leaves the page, never a cell or hero ID.
export function tutorialStepForGuide(id){
  switch(id){
    case 'lobby': case 'prepare': case 'summon': case 'auto': return id;
    case 'merge-more': return 'merge';
    case 'ten': case 'ten-go': case 'ten-nav': return 'firstTen';
    case 'team-auto': case 'team-save': return 'formation';
    default:
      if(id.startsWith('merge:'))return 'merge';
      if(id.startsWith('cast:'))return 'cast';
      return null;
  }
}

// Count a page affected by unavailable storage once, even if saving is retried.
// Re-throw the original exception so the normal save/recovery behavior applies.
export function observeProfileStorage(storage,onUnavailable){
  let reported=false;
  function report(error){
    if(!reported){
      reported=true;
      onUnavailable();
    }
    throw error;
  }
  return {
    getItem(key){
      try{return storage.getItem(key);}catch(error){report(error);}
    },
    setItem(key,value){
      try{return storage.setItem(key,value);}catch(error){report(error);}
    },
  };
}

export function publicSession({snapshot}){
  const config=window.__GARDEN_RELEASE__,analytics=createAnalytics({enabled:config?.analytics?.enabled,adapter:localEventAdapter()});
  let lastScreen=null;const shown=new Set(),completed=new Set();
  const safe=fn=>(...args)=>{try{return fn(...args);}catch{return undefined;}};
  const view=safe(screen=>{if(screen!==lastScreen&&analytics.track('screen_view',{screen}))lastScreen=screen;});
  const progress=safe(()=>{const state=snapshot();analytics.track('progress',{screen:state.screen,stage:state.checkpoint});});
  const timer=analytics.enabled?setInterval(()=>{void analytics.flush();},10000):null;
  const heartbeat=analytics.enabled?setInterval(()=>{if(!document.hidden){progress();void analytics.flush();}},60000):null;
  document.addEventListener('visibilitychange',()=>{if(document.hidden){progress();void analytics.flush();}});
  addEventListener('pagehide',()=>{void analytics.flush();});
  addEventListener('error',()=>analytics.track('game_error',{code:'uncaught'}));
  addEventListener('unhandledrejection',()=>analytics.track('game_error',{code:'unhandled'}));
  analytics.track('game_boot',{});
  return {
    markup(){
      const text=analytics.enabled?'게임 개선을 위해 진행 단계·전투 결과·소요 시간 구간을 날짜별 건수로 합산합니다. 사용자·기기·세션 ID, IP, 쿠키, 세이브 원문, 자유 입력, 화면 녹화는 수집 기록에 저장하지 않습니다.':'이번 빌드는 플레이 로그를 수집하지 않습니다.';
      return `<section class="analytics-settings"><h3>플레이 통계</h3><p class="fineprint">${text}</p><p class="fineprint">버전 ${config?.buildId||''}</p></section>`;
    },
    view,progress,
    tutorial:safe((step,status)=>{const set=status==='shown'?shown:completed,key=step+':'+status;if(!set.has(key)&&analytics.track('tutorial_step',{step,status}))set.add(key);}),
    battleStart:safe((mode,stage,tier,resumed,auto)=>analytics.track('battle_start',{mode,stage,tier:tier||'none',entry:resumed?'resume':'new',auto})),
    battleEnd:safe((mode,stage,tier,result,wave,seconds,auto)=>{analytics.track('battle_end',{mode,stage,tier:tier||'none',result,wave:waveBucket(wave),duration:timeBucket(seconds),auto});progress();void analytics.flush();}),
    backup:safe((action,outcome)=>analytics.track('backup_action',{action,outcome})),
    error:safe(code=>analytics.track('game_error',{code})),
    dispose(){clearInterval(timer);clearInterval(heartbeat);},
  };
}
