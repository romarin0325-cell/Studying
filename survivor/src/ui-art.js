import {WEAPONS,WEAPON,RELICS,RELIC,SECRET} from './content.js';

export function itemArt(kind,id,extra=''){
  if(kind==='secret'||kind==='encounter'){const index=kind==='secret'?SECRET[id]?.art:Number(id),label=kind==='secret'?SECRET[id]?.name:'';return `<span class="item-art secrets-art ${extra}" style="--sprite-x:${index%4/3*100}%;--sprite-y:${Math.floor(index/4)*100}%" ${label?`role="img" aria-label="${label}"`:'aria-hidden="true"'}></span>`;}
  const list=kind==='weapon'?WEAPONS:RELICS;
  let index=list.findIndex(item=>item.id===id);
  if(kind==='prop')index={chest:10,open:11,heart:12,magnet:13,coin:14,shrine:15}[id];
  if(kind==='special')index={evolution:14,xp:15}[id];
  const atlas=kind==='weapon'||kind==='special'?'weapons':'relics';
  const label=kind==='weapon'?WEAPON[id]?.name:kind==='relic'?RELIC[id]?.name:'';
  return `<span class="item-art ${atlas}-art ${extra}" style="--sprite-x:${index%4/3*100}%;--sprite-y:${Math.floor(index/4)/3*100}%" ${label?`role="img" aria-label="${label}"`:'aria-hidden="true"'}></span>`;
}

const paths={
  fullscreen:'M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5',
  settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
  book:'M12 5v16M12 5C9 2 4 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-2-1-7-2-10 1',
  pause:'M8 4v16M16 4v16',
  dash:'M3 13h13M11 6l7 7-7 7M3 6h4M2 20h4',
  arrow:'M4 12h15M13 5l7 7-7 7',
  star:'m12 2 2.8 6.4L22 10l-5.2 4.8.8 7.2-5.6-3.8L6.4 22l.8-7.2L2 10l7.2-1.6Z',
  moon:'M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12',
  history:'M3 10a9 9 0 1 1 1 7M3 3v7h7M12 7v6l4 2',
  infinity:'M12 12c-3-5-8-5-9-1-1 6 5 7 9 1 4-6 10-5 9 1-1 4-6 4-9-1',
  leaf:'M4 20C2 9 8 3 21 3c0 13-6 19-17 17Zm0 0L16 8'
};
export const uiIcon=name=>`<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.star}"/></svg>`;

export function menuArt(name){
  const index={home:0,book:1,memory:2,records:3,resume:4,save:5,settings:6,finish:7}[name]??0;
  return `<span class="menu-art" style="--sprite-x:${index%4/3*100}%;--sprite-y:${Math.floor(index/4)*100}%" aria-hidden="true"></span>`;
}

export function bindFullscreen(toast,onChange){
  const root=document.documentElement;
  const active=()=>document.fullscreenElement||document.webkitFullscreenElement;
  const sync=()=>{for(const button of document.querySelectorAll('[data-action="fullscreen"]')){button.setAttribute('aria-pressed',String(!!active()));button.setAttribute('aria-label',active()?'전체화면 나가기':'전체화면');button.title=active()?'전체화면 나가기':'전체화면';}requestAnimationFrame(onChange);};
  const toggle=async()=>{try{
    if(active()){const exit=document.exitFullscreen||document.webkitExitFullscreen;if(exit)await exit.call(document);}
    else if(root.requestFullscreen){try{await root.requestFullscreen({navigationUI:'hide'});}catch{await root.requestFullscreen();}}
    else if(root.webkitRequestFullscreen)await root.webkitRequestFullscreen();
    else toast('이 브라우저에서는 전체화면을 지원하지 않아요. Safari는 홈 화면에 추가해 실행할 수 있어요.');
  }catch{toast('전체화면으로 전환하지 못했어요. 현재 화면에서 계속 플레이할 수 있어요.');}sync();};
  document.addEventListener('fullscreenchange',sync);document.addEventListener('webkitfullscreenchange',sync);
  return {toggle,sync};
}
