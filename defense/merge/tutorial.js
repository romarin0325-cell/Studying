import {HERO} from './content.js';
import {newRun,move,summon,cast,step} from './engine.js';

const lessons=[
  ['동료 확인','동료를 한 번 눌러 능력을 확인하세요. 탭만으로는 이동하거나 합성되지 않습니다.','전장에서도 탭으로 능력과 공격 범위를 확인할 수 있습니다.'],
  ['이동과 합성','왼쪽 지크를 오른쪽 지크 위로 드래그하세요. 같은 동료·같은 등급이면 한 단계 성장합니다.','빈칸으로 드래그하면 이동, 다른 동료 위로 드래그하면 교환합니다. 루미는 같은 등급의 모든 동료와 합성할 수 있습니다.'],
  ['소환','빈칸을 누른 뒤 소환 버튼을 눌러 보세요. 선택한 칸에 편성한 6명 중 한 명이 무작위로 합류합니다.','처음 3회는 무료입니다. 이후 10G부터 2G씩 계속 비싸집니다. 같은 동료가 연속으로 나올 수 있습니다. 빈칸을 선택하지 않으면 자동 배치됩니다.'],
  ['필살기와 원정','지크의 얼굴을 눌러 필살기를 사용하세요. 별빛은 편성한 여섯 동료가 함께 사용합니다.','물결 종료 후 축복 3개 중 하나를 고릅니다. 유물은 출발 전 최대 3개. 4·8·12물결은 보스전입니다. 행 봉인은 표시된 칸에서 이동해 피하고, 회복 시전 중 최대 체력의 6%를 깎으면 치유를 끊습니다. 해일은 감속·기절로 막습니다.'],
];
const slots=[6,8,12];

export function tutorialPage(lesson,portrait){
  const state=newRun({seed:546});state.events=[];
  // A disposable real rules state. Never serialize, step or mutate the live run.
  // The guided merge lesson needs a declared pair; real opening draws remain random.
  for(const i of [6,8]){state.board[i].hero='zeke';state.board[i].priority='first';}
  state.board[12]=null;
  if(lesson===2)state.board[8]=null;
  if(lesson===3){state.queue=[{kind:'boss',hp:8000}];state.spawnIn=0;step(state,.01);state.gauge=100;}
  const [title,instruction,note]=lessons[lesson];
  const tiles=()=>slots.map(i=>{const u=state.board[i];return `<button class="practice-cell" data-practice-cell="${i}" aria-label="연습 ${slots.indexOf(i)+1}번 ${u?HERO[u.hero].name+' '+u.rank+'성':'빈칸'}">${u?portrait(u.hero)+`<span>${'✦'.repeat(u.rank)}</span>`:'<span class="practice-empty">＋</span>'}</button>`;}).join('');
  const html=`<div class="practice" data-lesson="${lesson}"><nav class="practice-steps" aria-label="연습 단계">${lessons.map((l,i)=>`<button data-lesson-nav="${i}" ${lesson===i?'aria-current="step"':''}>${i+1}<span>${l[0]}</span></button>`).join('')}</nav><h3>${title}</h3><p class="practice-instruction">${instruction}</p><div class="practice-board">${tiles()}</div><div class="practice-controls">${lesson===1?'<button class="text-button" data-practice-merge>키보드로 합성 연습</button>':''}${lesson===2?'<button class="secondary-button" data-practice-summon>동료 소환 · 무료</button>':''}${lesson===3?`<span data-practice-gauge>별빛 100 / 100</span><button class="practice-skill" data-practice-skill aria-label="지크 필살기 연습">${portrait('zeke')}<span>용의 맹세 · 70✦</span></button>`:''}</div><p class="practice-result" role="status">연습 준비</p><p class="practice-note">${note}</p></div><div class="modal-actions practice-footer"><button class="secondary-button" data-lesson-nav="${lesson}">다시 연습</button>${lesson<3?`<button class="primary-button" data-lesson-nav="${lesson+1}">다음</button>`:'<button class="primary-button" data-action="close-modal">연습 마치기</button>'}</div>`;
  return {html,state,lesson,tiles};
}

export function mountTutorial(root,{state,lesson,tiles},navigate){
  const board=root.querySelector('.practice-board'),status=root.querySelector('.practice-result');
  let pointer=null,preferred=12,completed=false;
  const result=message=>{status.textContent=message;status.classList.add('success');};
  const merge=(from,to)=>{const r=move(state,from,to);board.innerHTML=tiles();if(r.merged){completed=true;result('합성 완료 · 지크 2성. 두 번 탭하는 것과 드래그는 다릅니다.');}else if(r.ok)result('이동 완료');};
  const inspect=index=>{
    const u=state.board[index];
    if(lesson===0&&u)result(`${HERO[u.hero].name} · ${u.rank}성 · ${HERO[u.hero].trait.text}`);
    if(lesson===2&&!u){preferred=index;board.querySelectorAll('button').forEach(b=>b.classList.toggle('chosen',Number(b.dataset.practiceCell)===index));result('소환 위치 선택됨');}
    if(lesson===1&&!completed)status.textContent='동료 선택 · 합성하려면 다른 지크 위로 드래그하세요.';
  };
  board.addEventListener('pointerdown',e=>{
    const cell=e.target.closest('[data-practice-cell]');if(!cell||e.button!==0||pointer)return;
    pointer={id:e.pointerId,index:Number(cell.dataset.practiceCell),x:e.clientX,y:e.clientY,dragged:false};
    try{board.setPointerCapture(e.pointerId);}catch{}
  });
  board.addEventListener('pointermove',e=>{if(pointer?.id!==e.pointerId)return;if(Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>10){pointer.dragged=true;board.classList.add('dragging');}});
  board.addEventListener('pointerup',e=>{
    if(pointer?.id!==e.pointerId)return;const p=pointer;pointer=null;board.classList.remove('dragging');
    if(p.dragged&&lesson===1&&!completed){const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-practice-cell]');if(target&&board.contains(target))merge(p.index,Number(target.dataset.practiceCell));}
    else if(!p.dragged)inspect(p.index);
  });
  board.addEventListener('pointercancel',()=>{pointer=null;board.classList.remove('dragging');});
  board.addEventListener('click',e=>{
    const cell=e.target.closest('[data-practice-cell]');if(cell&&e.detail===0)inspect(Number(cell.dataset.practiceCell));
  });
  // Bind to newly-created modal nodes only. Closing the modal releases the
  // practice state and all listeners without touching the gameplay pointer.
  root.querySelectorAll('[data-lesson-nav]').forEach(b=>b.addEventListener('click',()=>navigate(Number(b.dataset.lessonNav))));
  root.querySelector('[data-practice-merge]')?.addEventListener('click',()=>{if(!completed)merge(6,8);});
  root.querySelector('[data-practice-summon]')?.addEventListener('click',e=>{if(completed)return;const r=summon(state,preferred);if(r.ok){completed=true;board.innerHTML=tiles();e.currentTarget.disabled=true;result(`${HERO[r.hero].name} 합류 · 골드 ${state.gold}G 그대로, 무료 소환 ${state.freeSummons}회 남음`);}});
  root.querySelector('[data-practice-skill]')?.addEventListener('click',e=>{if(completed)return;const r=cast(state,'zeke');if(r.ok){completed=true;e.currentTarget.disabled=true;board.classList.add('practice-cast');root.querySelector('[data-practice-gauge]').textContent=`별빛 ${state.gauge} / 100`;result('용의 맹세 발동 · 별빛 70 사용. 다른 동료도 남은 30을 공유합니다.');}});
}
