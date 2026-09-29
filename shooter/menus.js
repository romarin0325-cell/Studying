import { HEROES, DUNGEONS, STAGES } from './content.js';
import { artifactText, ARTIFACTS, DIFFICULTIES, COSTUMES, COSTUME_TIERS, weekKey, weeklyEvent, dailyHeroes, heroAvailable, unlockHero, drawArtifact, drawCostumeTicket, equipCostume, achievementProgress, purchaseShopItem, useRandomResetTicket, randomRemaining, RANDOM_DAILY_LIMIT } from './meta.js';
import { LIBRARY, makeQuestion, recordAnswer } from './learning.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function economySnapshot(profile) {
  return { dreamShards: profile.dreamShards, randomResetTickets: profile.randomResetTickets, randomDraws: { ...profile.randomDraws }, owned: [...profile.owned], tickets: profile.tickets.map(ticket => ({ ...ticket })), costumesOwned:[...profile.costumesOwned], costumesEquipped:{...profile.costumesEquipped}, costumeTickets:{...profile.costumeTickets} };
}
function restoreEconomy(profile, snap) {
  profile.dreamShards = snap.dreamShards; profile.randomResetTickets = snap.randomResetTickets; profile.randomDraws = { ...snap.randomDraws };
  profile.owned.splice(0, profile.owned.length, ...snap.owned); profile.tickets.splice(0, profile.tickets.length, ...snap.tickets.map(ticket => ({ ...ticket })));
  profile.costumesOwned=snap.costumesOwned;profile.costumesEquipped=snap.costumesEquipped;profile.costumeTickets=snap.costumeTickets;
}
const $ = id => document.getElementById(id);
export class CampaignUI {
  constructor(options) { Object.assign(this,options); }
  relicImage(id){return `<img src="${this.art.urls.relics[ARTIFACTS.findIndex(a=>a.id===id)]}" alt="">`;}
  offerQuiz(title,copy,yes,no) {
    this.setModal(`<h2>${esc(title)}</h2><p class="intro-copy">${esc(copy)}</p><button class="primary" id="quiz-accept">예 · 퀴즈 도전</button><button class="secondary" id="quiz-decline">아니오</button>`);
    $('quiz-accept').onclick=yes; $('quiz-decline').onclick=()=>{this.closeModal();no();};
  }
  chooseHero(index,done,failed=()=>this.closeModal()) {
    if(HEROES[index]?.hidden) return failed();
    if(heroAvailable(this.profile,index)) return done();
    this.offerQuiz(`${HEROES[index].name} 선택`, '해당 캐릭터는 현재 잠겨 있어요. 문법 퀴즈를 맞히면 오늘 사용할 수 있어요. 퀴즈에 도전할까요?',
      ()=>this.quiz('grammar','문법 퀴즈', correct=>{if(correct){unlockHero(this.profile,index);this.save();done();}else failed();}),failed);
  }
  quiz(kind,title,done,provided = null) {
    title=kind==='grammar'?'문법 퀴즈':kind==='vocab'?'단어 퀴즈':'숙어 퀴즈';
    const q=provided || makeQuestion(kind), lecture=q.lecture || LIBRARY.grammar.find(l=>l.id===q.lectureId);
    let resolved=false;
    const answerScreen=()=>{
      this.setModal(`<span class="small-caps">${kind==='grammar'?'GRAMMAR':kind==='vocab'?'VOCABULARY':'COLLOCATION'}</span><h2>${esc(title)}</h2><p class="quiz-prompt">${esc(q.prompt)}</p><div id="answers">${q.options.map((o,i)=>`<button class="secondary quiz-answer" data-answer="${i}">${esc(o)}</button>`).join('')}</div><p class="tiny-note">한 번 선택하면 정답과 해설을 확인할 수 있어요.</p>`);
      document.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{
        if(resolved)return;resolved=true;
        const correct=recordAnswer(this.profile,q,q.options[Number(b.dataset.answer)]);this.save();
        this.setModal(`<span class="small-caps">${correct?'CORRECT':'KEEP THIS WORD'}</span><h2>${correct?'정답이에요':'다음에는 기억해요'}</h2><p class="quiz-prompt">${esc(q.prompt)}</p><p class="answer-key">${esc(q.answer)}</p><p class="lecture-copy">${esc(q.explanation)}</p>${lecture?'<button class="secondary" id="explain-lecture">관련 강의 읽기</button>':''}<button class="primary" id="quiz-continue">계속</button>`);
        const next=()=>{this.closeModal();done(correct);};
        $('quiz-continue').onclick=next;
        if(lecture)$('explain-lecture').onclick=()=>this.lecture(lecture,next,'계속');
      });
    };
    if(!lecture) return answerScreen();
    this.setModal(`<span class="small-caps">A PAGE BEFORE THE FLIGHT</span><h2>${esc(title)}</h2><p class="intro-copy">문제에 연결된 강의를 먼저 읽을까요?<br>${esc(lecture.title)}</p><button class="primary" id="read-first">강의 먼저 읽기</button><button class="secondary" id="quiz-now">바로 문제 풀기</button>`);
    $('read-first').onclick=()=>this.lecture(lecture,answerScreen,'문제 풀기');$('quiz-now').onclick=answerScreen;
  }
  lecture(lecture,back,label='도서관으로') {
    const read=this.profile.learning.read=Array.isArray(this.profile.learning.read)?this.profile.learning.read:[];
    if(!read.includes(lecture.id)){read.push(lecture.id);this.save();}
    this.setModal(`<span class="small-caps">LECTURE ${lecture.id}</span><h2>${esc(lecture.title)}</h2><div class="lecture-copy">${esc(lecture.content)}</div><button class="primary" id="lecture-back">${label}</button>`);$('lecture-back').onclick=back;
  }
  library(tab='vocab',term='',page=0) {
    const l=this.profile.learning;
    this.setModal(`<span class="small-caps">LIBRARY</span><h2>도서관</h2><p class="intro-copy">정답 ${Number(l.correct)||0} / ${Number(l.total)||0} · 읽은 강의 ${(l.read||[]).length}/35</p><nav class="library-tabs">${[['vocab','단어'],['collocation','숙어'],['grammar','문법'],['mistakes','오답']].map(([id,name])=>`<button data-tab="${id}" class="${id===tab?'selected':''}" aria-pressed="${id===tab}">${name}</button>`).join('')}</nav><input id="library-search" aria-label="학습 내용 검색" placeholder="단어 · 뜻 · 강의 검색" value="${esc(term)}"><div class="library-tools">${tab==='vocab'?'<button id="library-all">전체 단어 보기</button>':''}${tab==='mistakes'?'<button id="mistakes-reset">오답 전체 초기화</button>':''}</div><div id="library-list"></div><nav class="library-pager" aria-label="목록 페이지"><button id="library-prev">이전</button><span id="library-page" aria-live="polite"></span><button id="library-next">다음</button></nav><button class="primary" id="practice">${tab==='mistakes'?'오답 다시 풀기':'연습 문제 풀기'}</button><button class="secondary" id="library-close">출격 준비로</button>`);
    document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>this.library(b.dataset.tab));
    const render=()=>{
      const query=$('library-search').value.trim().toLowerCase();
      const rows=(tab==='mistakes'?(l.mistakes||[]):LIBRARY[tab]).map((entry,i)=>({entry,i})).filter(({entry})=>JSON.stringify(entry).toLowerCase().includes(query));
      const size=30,pages=Math.max(1,Math.ceil(rows.length/size));page=Math.max(0,Math.min(page,pages-1));
      const list=$('library-list');list.innerHTML=`<p class="tiny-note">${rows.length.toLocaleString()}개${rows.length?` · ${page*size+1}–${Math.min(rows.length,(page+1)*size)}`:' · 저장된 항목이 없어요'}</p>`+rows.slice(page*size,(page+1)*size).map(({entry:e,i})=>tab==='grammar'?`<button class="library-entry" data-lecture="${i}"><b>${esc(e.title)}</b><small>${(l.read||[]).includes(e.id)?'읽음':'강의 열기'} · ${(e.quizzes||[]).length}문제</small></button>`:`<div class="library-entry"><b>${esc(tab==='vocab'?e.w:tab==='collocation'?e.expression:e.prompt)}</b><small>${esc(tab==='vocab'?e.m:tab==='collocation'?e.meaning:e.answer)}</small>${tab==='vocab'&&e.tw?`<small>비교 · ${esc(e.tw)}: ${esc(e.tm)}</small>`:tab==='collocation'?`<p>${esc(e.question.replace(/_{2,}/g,e.answer))}</p>`:tab==='mistakes'?`<button class="mistake-delete" data-delete="${i}" aria-label="${esc(e.prompt)} 오답 삭제">삭제</button>`:''}</div>`).join('');
      $('library-page').textContent=`${page+1} / ${pages}`;$('library-prev').disabled=page===0;$('library-next').disabled=page===pages-1;
      list.scrollTop=0;
      list.querySelectorAll('[data-lecture]').forEach(b=>b.onclick=()=>this.lecture(LIBRARY.grammar[Number(b.dataset.lecture)],()=>this.library('grammar',query,page)));
      list.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{l.mistakes.splice(Number(b.dataset.delete),1);this.save();render();});
      $('practice').disabled=tab==='mistakes'&&!(l.mistakes||[]).length;
      if($('mistakes-reset'))$('mistakes-reset').disabled=!(l.mistakes||[]).length;
    };
    render();$('library-search').oninput=()=>{page=0;render();};
    $('library-prev').onclick=()=>{page--;render();};$('library-next').onclick=()=>{page++;render();};
    if($('library-all'))$('library-all').onclick=()=>{$('library-search').value='';page=0;render();};
    if($('mistakes-reset'))$('mistakes-reset').onclick=()=>{
      const query=$('library-search').value;
      this.setModal(`<h2>오답을 모두 지울까요?</h2><p class="intro-copy">저장된 오답 ${(l.mistakes||[]).length}개를 삭제해요. 정답 기록과 읽은 강의는 유지돼요.</p><button class="primary" id="reset-confirm">오답 모두 삭제</button><button class="secondary" id="reset-cancel">취소</button>`);
      $('reset-confirm').onclick=()=>{l.mistakes=[];this.save();this.library('mistakes');};$('reset-cancel').onclick=()=>this.library('mistakes',query,page);
    };
    $('library-close').onclick=this.closeModal;
    $('practice').onclick=()=>{const q=tab==='mistakes'?l.mistakes[0]:null;this.quiz(q?.kind||tab,'연습',()=>this.library(tab),q);};
  }
  equipment(refresh) {
    const p=this.profile;
    const scroll=document.querySelector('.equipment-list')?.scrollTop||0;
    this.setModal(`<div class="equipment-head"><h2>별의 유물함</h2><p class="intro-copy">선택 ${p.equipped.length}/3 · 수집 ${p.owned.length}/${ARTIFACTS.length}</p></div><div class="equipment-list">${['normal','rare','epic'].map(rarity=>`<section class="relic-section" aria-label="${rarity==='epic'?'에픽':rarity==='rare'?'레어':'일반'} 아티팩트"><h3>${rarity==='epic'?'에픽':rarity==='rare'?'레어':'일반'} 아티팩트</h3><div class="artifact-grid">${ARTIFACTS.filter(a=>a.rarity===rarity).map(a=>`<button class="artifact ${p.equipped.includes(a.id)?'selected':''} ${a.rarity}" data-artifact="${a.id}" ${p.owned.includes(a.id)?'':'disabled'} aria-pressed="${p.equipped.includes(a.id)}">${this.relicImage(a.id)}<b>${a.name}</b><small>${a.text}</small><em>${p.owned.includes(a.id)?a.rarity.toUpperCase():'미보유'}</em></button>`).join('')}</div></section>`).join('')}</div><footer class="equipment-footer"><button class="primary" id="draw-ticket" ${p.tickets.length?'':'disabled'}><b>유물 뽑기</b><small>뽑기권 ${p.tickets.length}장</small></button><button class="secondary" id="equipment-done"><b>장착 저장</b><small>출격 준비로</small></button></footer>`);
    document.querySelector('.panel').classList.add('equipment-panel');document.querySelector('.equipment-list').scrollTop=scroll;
    document.querySelectorAll('[data-artifact]').forEach(b=>b.onclick=()=>{const id=b.dataset.artifact;if(p.equipped.includes(id))p.equipped=p.equipped.filter(a=>a!==id);else if(p.equipped.length<3)p.equipped.push(id);else return this.toast('유물은 세 개까지 장착할 수 있어요');this.save();this.equipment(refresh);});
    $('equipment-done').onclick=()=>{this.closeModal();refresh();};
    $('draw-ticket').onclick=()=>{
      if(!p.tickets.length)return;
      let resolved=false;
      const draw=correct=>{
        if(resolved)return;resolved=true;
        const snap=economySnapshot(p);
        const result=drawArtifact(p,Math.random,correct);if(!result)return this.equipment(refresh);
        if(!this.save()){restoreEconomy(p,snap);this.toast('저장하지 못해서 뽑기를 취소했어요.');return this.equipment(refresh);}
        const a=result.artifact;
        const shardNote = result.duplicate ? `이미 보유한 유물이에요. 꿈의결정 ${result.shardsAwarded}개를 받았어요. 보유 꿈의결정 ${p.dreamShards}개.` : '새로운 유물을 발견했어요. 유물함에서 장착할 수 있어요.';
        this.setModal(`<span class="small-caps">${a.rarity==='epic'?'EPIC RELIC':a.rarity==='rare'?'RARE RELIC':'RELIC DISCOVERED'}</span><div class="relic-reveal ${a.rarity}">${this.relicImage(a.id)}</div><h2>${a.name}</h2><p class="intro-copy">${a.text}<br>${shardNote}</p><button class="primary" id="reveal-done">유물함으로</button>`);$('reveal-done').onclick=()=>this.equipment(refresh);
      };
      this.offerQuiz('유물 뽑기', '뽑기 전에 퀴즈에 도전할까요? 단어나 숙어 문제를 맞히면 이번 뽑기에서 레어·에픽 유물을 만날 기회가 높아져요.',
        ()=>this.quiz(Math.random()<.5?'vocab':'collocation','',draw),()=>draw(false));
      $('quiz-decline').textContent='아니오 · 바로 뽑기';
    };
  }
  shop(refresh) {
    const p=this.profile;
    let busy=false;
    const render=()=>{
      const remaining=randomRemaining(p), resets=p.randomResetTickets, shards=p.dreamShards;
      const shopTickets=p.tickets.filter(ticket=>ticket.source==='shop' && ticket.kind==='artifact').length;
      const crystal=this.art.urls.shopItems[0], ticket=this.art.urls.shopItems[1], reset=this.art.urls.shopItems[2];
      this.setModal(`<button class="shop-close" id="shop-close" aria-label="상점 닫기">×</button><span class="small-caps">DREAM CRYSTAL SHOP</span><button class="shop-lineup-trigger" id="shop-lineup" aria-label="코스튬 티켓 상세 라인업">!</button><h2>별빛 상점</h2>
        <div class="shop-balance"><img src="${crystal}" alt=""><span><small>보유 꿈의결정</small><strong>${shards}</strong></span></div>
        <div class="shop-goods">
          <article class="shop-product"><div class="shop-product-head"><img src="${ticket}" alt=""><div><small>ARTIFACT DRAW</small><h3>아티팩트 뽑기권</h3></div></div><p class="shop-stock">보유 뽑기권 ${p.tickets.length}장 <small>상점 구매 ${shopTickets}장</small></p><div class="shop-price"><img src="${crystal}" alt=""><span>꿈의결정 <b>5개</b></span></div><button class="primary" id="buy-ticket" ${shards>=5&&!busy?'':'disabled'}>뽑기권 구매</button></article>
          <article class="shop-product"><div class="shop-product-head"><img src="${reset}" alt=""><div><small>RANDOM RESET</small><h3>랜덤 횟수 리셋권</h3></div></div><p class="shop-stock">보유 리셋권 ${resets}장</p><div class="shop-price"><img src="${crystal}" alt=""><span>꿈의결정 <b>1개</b></span></div><button class="primary" id="buy-reset" ${shards>=1&&!busy?'':'disabled'}>리셋권 구매</button></article>
          ${COSTUME_TIERS.map((tier,index)=>`<article class="shop-product costume-product ${tier.id}"><div class="shop-product-head"><img src="${this.art.urls.costumeTickets[index]}" alt=""><div><small>COSTUME ${tier.id.toUpperCase()}</small><h3>코스튬티켓 (${tier.name})</h3></div></div><p class="shop-stock">보유 티켓 ${p.costumeTickets[tier.id]}장 <small>의상실에서 사용</small></p><div class="shop-price"><img src="${crystal}" alt=""><span>꿈의결정 <b>${tier.cost}개</b></span></div><button class="primary" id="buy-costume-${tier.id}" ${shards>=tier.cost&&!busy?'':'disabled'}>티켓 구매</button></article>`).join('')}
        </div><div class="shop-reset"><div><small>오늘 남은 기본 랜덤 횟수</small><strong>${remaining} <span>/ ${RANDOM_DAILY_LIMIT}</span></strong></div><button class="secondary" id="use-reset" ${resets>0&&remaining===0&&!busy?'':'disabled'}>리셋권 사용</button></div>
        <p class="tiny-note" id="reset-note">${remaining>0?'기본 횟수를 모두 사용한 뒤 사용할 수 있어요.':'리셋권은 기본 횟수를 3회로 되돌려요. 캐릭터는 바로 뽑지 않아요.'}</p><button class="secondary" id="shop-back">돌아가기</button>`);
      document.querySelector('.panel').classList.add('shop-panel');
      $('shop-back').onclick=()=>{this.closeModal();refresh();};
      $('shop-close').onclick=$('shop-back').onclick;
      $('buy-ticket').onclick=()=>confirmBuy('artifact','아티팩트 뽑기권 1장을 꿈의결정 5개로 살까요?');
      $('buy-reset').onclick=()=>confirmBuy('reset','랜덤 횟수 리셋권 1장을 꿈의결정 1개로 살까요?');
      COSTUME_TIERS.forEach(tier=>$(`buy-costume-${tier.id}`).onclick=()=>confirmBuy(tier.id,`코스튬티켓 (${tier.name}) 1장을 꿈의결정 ${tier.cost}개로 살까요?`));
      $('shop-lineup').onclick=()=>{
        this.setModal(`<span class="small-caps">COSTUME TICKET LINEUP</span><h2>티켓 상세 라인업</h2><p class="intro-copy">일상·판타지·스페셜은 표시된 네 의상 중 하나를 같은 확률로 얻어요. 미라클은 원하는 의상을 선택해요.</p><div class="ticket-lineup">${COSTUME_TIERS.map((tier,index)=>`<section><img src="${this.art.urls.costumeTickets[index]}" alt=""><div><h3>${tier.name} <small>꿈의결정 ${tier.cost}개</small></h3><p>${tier.id==='miracle'?'전체 12벌 중 원하는 의상 선택':tier.lineup.map(costume=>`${HEROES[costume.hero].name} · ${costume.name}`).join(' / ')}</p></div></section>`).join('')}</div><p class="tiny-note">이미 가진 의상을 다시 얻으면 꿈의결정 3개를 돌려받아요.</p><button class="secondary" id="shop-lineup-back">상점으로</button>`);
        document.querySelector('.panel').classList.add('lineup-panel');$('shop-lineup-back').onclick=render;
      };
      $('use-reset').onclick=()=>confirmReset();
    };
    const confirmBuy=(item,copy)=>{
      if(busy)return;
      this.setModal(`<h2>구매할까요?</h2><p class="intro-copy">${copy}</p><button class="primary" id="shop-confirm">구매</button><button class="secondary" id="shop-cancel">취소</button>`);
      let done=false;
      $('shop-cancel').onclick=()=>{if(!done)render();};
      $('shop-confirm').onclick=()=>{
        if(done||busy)return;done=true;busy=true;
        const snap=economySnapshot(p);
        const result=purchaseShopItem(p,item);
        if(!result.ok){busy=false;this.toast(result.reason==='balance'?'꿈의결정이 부족해요.':'구매하지 못했어요.');return render();}
        if(!this.save()){restoreEconomy(p,snap);busy=false;this.toast('저장하지 못해서 구매를 취소했어요.');return render();}
        busy=false;this.toast('구매했어요.');render();
      };
    };
    const confirmReset=()=>{
      if(busy)return;
      this.setModal(`<h2>리셋권을 사용할까요?</h2><p class="intro-copy">남은 기본 횟수가 0일 때만 사용할 수 있어요. 사용하면 오늘 기본 ${RANDOM_DAILY_LIMIT}회로 돌아가요.</p><button class="primary" id="shop-confirm">사용</button><button class="secondary" id="shop-cancel">취소</button>`);
      let done=false;
      $('shop-cancel').onclick=()=>{if(!done)render();};
      $('shop-confirm').onclick=()=>{
        if(done||busy)return;done=true;busy=true;
        const now=new Date(), snap=economySnapshot(p);
        const result=useRandomResetTicket(p,now);
        if(!result.ok){busy=false;this.toast(result.reason==='remaining'?'기본 횟수를 모두 사용한 뒤 사용할 수 있어요.':'사용할 리셋권이 없어요.');return render();}
        if(!this.save()){restoreEconomy(p,snap);busy=false;this.toast('저장하지 못해서 사용을 취소했어요.');return render();}
        busy=false;this.toast(`오늘 기본 횟수가 ${result.remaining}회로 돌아왔어요.`);render();
      };
    };
    render();
  }
  wardrobe(refresh, selectedHero=0) {
    const p=this.profile, heroes=[0,1,2,3,4,6];
    if(!heroes.includes(selectedHero))selectedHero=0;
    const artFor=costume=>this.art.urls.costumes[COSTUMES.findIndex(item=>item.id===costume.id)];
    const reveal=result=>{
      const costume=result.costume;
      this.setModal(`<span class="small-caps">${result.duplicate?'DUPLICATE COSTUME':'NEW COSTUME'}</span><div class="costume-reveal"><img src="${artFor(costume)}" alt="${esc(costume.name)}"></div><h2>${HEROES[costume.hero].name} · ${esc(costume.name)}</h2><p class="intro-copy">${result.duplicate?`이미 보유한 의상이에요. 꿈의결정 ${result.shardsAwarded}개를 돌려받았어요.`:'새로운 의상을 얻었어요. 의상실에서 선택할 수 있어요.'}</p><button class="primary" id="costume-reveal-done">의상실로</button>`);
      document.querySelector('.panel').classList.add('wardrobe-panel');
      $('costume-reveal-done').onclick=()=>render(costume.hero);
    };
    const draw=(tier,choice=null)=>{
      const snapshot=economySnapshot(p),result=drawCostumeTicket(p,tier,Math.random,choice);
      if(!result.ok){this.toast('사용할 티켓이 없어요.');return render(selectedHero);}
      if(!this.save()){restoreEconomy(p,snapshot);this.toast('저장하지 못해서 티켓 사용을 취소했어요.');return render(selectedHero);}
      reveal(result);
    };
    const miracle=()=>{
      this.setModal(`<span class="small-caps">MIRACLE TICKET</span><h2>원하는 의상을 골라요</h2><p class="intro-copy">미라클 티켓 1장을 사용해 선택한 의상을 얻어요.</p><div class="miracle-choice">${COSTUMES.map(costume=>`<button data-miracle="${costume.id}"><img src="${artFor(costume)}" alt=""><span><b>${HEROES[costume.hero].name}</b><small>${esc(costume.name)}${p.costumesOwned.includes(costume.id)?' · 보유 중':''}</small></span></button>`).join('')}</div><button class="secondary" id="miracle-back">의상실로</button>`);
      document.querySelector('.panel').classList.add('wardrobe-panel','miracle-panel');
      document.querySelectorAll('[data-miracle]').forEach(button=>button.onclick=()=>{
        const costume=COSTUMES.find(item=>item.id===button.dataset.miracle);
        this.setModal(`<span class="small-caps">MIRACLE TICKET</span><div class="costume-reveal"><img src="${artFor(costume)}" alt=""></div><h2>${HEROES[costume.hero].name} · ${esc(costume.name)}</h2><p class="intro-copy">${p.costumesOwned.includes(costume.id)?'이미 보유한 의상이에요. 선택하면 꿈의결정 3개를 돌려받아요.':'이 의상을 선택해 미라클 티켓을 사용할까요?'}</p><button class="primary" id="miracle-confirm">이 의상 획득</button><button class="secondary" id="miracle-cancel">다시 선택</button>`);
        document.querySelector('.panel').classList.add('wardrobe-panel');
        $('miracle-confirm').onclick=()=>draw('miracle',costume.id);
        $('miracle-cancel').onclick=miracle;
      });
      $('miracle-back').onclick=()=>render(selectedHero);
    };
    const render=(hero=selectedHero)=>{
      selectedHero=hero;
      const heroCostumes=COSTUMES.filter(costume=>costume.hero===hero);
      const equipped=p.costumesEquipped[hero]||null;
      const preview=heroCostumes.find(costume=>costume.id===equipped);
      this.setModal(`<button class="wardrobe-close" id="wardrobe-close" aria-label="의상실 닫기">×</button><span class="small-caps">ASTRAL WARDROBE</span><h2>의상실</h2><p class="intro-copy">수집 ${p.costumesOwned.length}/${COSTUMES.length} · 수호자의 모습을 골라 주세요.</p>
        <div class="wardrobe-tickets">${COSTUME_TIERS.map((tier,index)=>`<button data-costume-draw="${tier.id}" ${p.costumeTickets[tier.id]?'':'disabled'}><img src="${this.art.urls.costumeTickets[index]}" alt=""><b>${tier.name}</b><small>${p.costumeTickets[tier.id]}장</small></button>`).join('')}</div>
        <nav class="wardrobe-heroes" aria-label="의상 변경 캐릭터">${heroes.map(index=>`<button data-wardrobe-hero="${index}" class="${index===hero?'active':''}" aria-pressed="${index===hero}"><img src="${this.art.urls.heroes[index]}" alt=""><span>${HEROES[index].name}</span></button>`).join('')}</nav>
        <div class="wardrobe-preview"><img src="${preview?artFor(preview):this.art.urls.heroes[hero]}" alt="${HEROES[hero].name}"><span><small>${HEROES[hero].name}</small><b>${preview?esc(preview.name):'기본 의상'}</b></span></div>
        <div class="wardrobe-variants"><button data-equip="" class="${equipped?'':'active'}"><img src="${this.art.urls.heroes[hero]}" alt=""><b>기본 의상</b><small>${equipped?'선택하기':'착용 중'}</small></button>${heroCostumes.map(costume=>`<button data-equip="${costume.id}" class="${equipped===costume.id?'active':''}" ${p.costumesOwned.includes(costume.id)?'':'disabled'}><img src="${artFor(costume)}" alt=""><b>${esc(costume.name)}</b><small>${equipped===costume.id?'착용 중':p.costumesOwned.includes(costume.id)?'선택하기':'미보유'}</small></button>`).join('')}</div><button class="secondary" id="wardrobe-back">출격 준비로</button>`);
      document.querySelector('.panel').classList.add('wardrobe-panel');
      document.querySelectorAll('[data-wardrobe-hero]').forEach(button=>button.onclick=()=>render(Number(button.dataset.wardrobeHero)));
      document.querySelectorAll('[data-equip]').forEach(button=>button.onclick=()=>{
        const snapshot=economySnapshot(p),id=button.dataset.equip||null;
        if(!equipCostume(p,hero,id))return;
        if(!this.save()){restoreEconomy(p,snapshot);this.toast('저장하지 못해서 의상 변경을 취소했어요.');}
        render(hero);
      });
      document.querySelectorAll('[data-costume-draw]').forEach(button=>button.onclick=()=>button.dataset.costumeDraw==='miracle'?miracle():draw(button.dataset.costumeDraw));
      $('wardrobe-back').onclick=()=>{this.closeModal();refresh();};
      $('wardrobe-close').onclick=$('wardrobe-back').onclick;
    };
    render(selectedHero);
  }
  achievements() {
    const rows=achievementProgress(this.profile),complete=rows.filter(row=>row.complete).length;
    this.setModal(`<span class="small-caps">ABYSS ACHIEVEMENTS</span><h2>심연의 발자취</h2><p class="intro-copy">달성 ${complete}/${rows.length} · 던전별 첫 심연 클리어에 꿈의결정 3개</p><div class="achievement-list">${rows.map(row=>`<div class="achievement ${row.complete?'complete':''}"><i>${row.complete?'✓':'◇'}</i><span><b>${esc(row.name)}</b><small>${esc(row.text)}</small></span><em>${row.progress}/1</em></div>`).join('')}</div><button class="primary" id="achievements-close">출격 준비로</button>`);
    $('achievements-close').onclick=this.closeModal;
  }
  dungeons(selected,mode,done,scroll=0,panelScroll=0) {
    const week=weekKey(), event=weeklyEvent(), choices=[...DUNGEONS.slice(0,7),event];
    if(DUNGEONS[selected]?.event)selected=event.id;
    this.setModal(`<span class="small-caps">CHOOSE YOUR EXPEDITION</span><h2>새로운 하늘로</h2><div class="dungeon-list">${choices.map(d=>`<button class="dungeon-card ${d.event?'event-card':d.challengeOnly?'challenge-card':''} ${selected===d.id?'selected':''}" ${d.challengeOnly?'id="challenge-mode"':`data-dungeon="${d.id}"`} aria-pressed="${selected===d.id}" style="--dungeon-art:url('${this.art.urls.worlds[d.id]}')"><small>${d.event?'WEEKLY EVENT':d.challengeOnly?'CHALLENGE':`DUNGEON 0${d.id+1}`} · ${d.challengeOnly?21:3} STAGES</small><b>${d.challengeOnly?'챌린지':d.name}</b><span>${d.challengeOnly?'천계의 계단':d.boss||STAGES[d.id].boss}</span><em>${this.profile.claims[`${week}:${d.event?7:d.id}`]?'이번 주 보상 수령':`첫 클리어 · 뽑기권 ${DIFFICULTIES.find(d=>d.id===mode).tickets}장`}</em></button>`).join('')}</div><p class="intro-copy dungeon-description">${DUNGEONS[selected].mechanic}</p><div class="difficulty-list">${DIFFICULTIES.map(d=>`<button data-difficulty="${d.id}" class="${d.id===mode?'selected':''}" aria-pressed="${d.id===mode}"><b>${d.name}</b><small>뽑기권 ${d.tickets}장</small></button>`).join('')}</div><p class="tiny-note weekly-note">이벤트는 매주 5개 중 하나가 열려요. 월요일 0시 갱신 · 주간 첫 보상은 일반 6던전, 챌린지, 이벤트에서 각각 한 번 받아요. 난이도를 바꿔도 중복 수령할 수 없어요.</p><button class="primary" id="dungeon-done">${selected===6?'챌린지':'이 하늘로'} 출격 준비</button>`);
    document.querySelector('.panel').classList.add('dungeon-panel');
    document.querySelector('.dungeon-list').scrollTop=scroll;document.querySelector('.panel').scrollTop=panelScroll;
    const positions=()=>[document.querySelector('.dungeon-list').scrollTop,document.querySelector('.panel').scrollTop];
    document.querySelectorAll('[data-dungeon]').forEach(b=>b.onclick=()=>this.dungeons(Number(b.dataset.dungeon),mode,done,...positions()));
    document.querySelectorAll('[data-difficulty]').forEach(b=>b.onclick=()=>this.dungeons(selected,b.dataset.difficulty,done,...positions()));
    $('challenge-mode').onclick=()=>{
      this.setModal(`<span class="small-caps">SEVEN SKIES · CHALLENGE</span><h2>끝없이 이어지는 하늘</h2><p class="intro-copy">마도제국부터 혼돈의 틈을 넘어 천계의 계단까지, 일곱 던전의 21스테이지를 이어가요.</p><div class="lecture-copy">장착한 유물로 출발해 보스 퀴즈를 맞힐 때마다 새로운 유물을 골라요. 최대 9개까지 함께할 수 있어요.<br>부활 기회는 여행 전체에서 한 번이에요.</div><button class="primary" id="challenge-done">챌린지 출격 준비 · ${DIFFICULTIES.find(d=>d.id===mode).name}</button><button class="secondary" id="challenge-back">던전 선택으로</button>`);
      $('challenge-done').onclick=()=>{this.closeModal();done(0,mode,true);};$('challenge-back').onclick=()=>this.dungeons(selected,mode,done,scroll,panelScroll);
    };
    $('dungeon-done').onclick=()=>{this.closeModal();done(selected===6?0:selected,mode,selected===6);};
  }
  runArtifacts(game,back) {
    this.setModal(`<h2>함께하는 유물</h2><p class="intro-copy">${game.artifacts.size}/9 · 생명 ${game.player.lives}/${game.maxLife} · 봄 ${game.bombs}/${game.maxBombs}</p><div class="run-artifact-list">${[...game.artifacts].map(id=>{const a=ARTIFACTS.find(a=>a.id===id);return `<div class="run-artifact ${a.rarity}">${this.relicImage(id)}<span><b>${a.name}</b><small>${artifactText(a,true)}</small></span></div>`;}).join('')||'<p class="intro-copy">아직 함께하는 유물이 없어요.</p>'}</div><button class="primary" id="run-artifacts-back">돌아가기</button>`);
    $('run-artifacts-back').onclick=back;
  }
  challengeReward(game,done) {
    const ids=game.challengeChoices();
    if(!ids.length){game.completeQuiz();done();return;}
    this.setModal(`<span class="small-caps">A GIFT FOR THE JOURNEY</span><h2>다음 하늘의 동행</h2><p class="intro-copy">이번 챌린지에 함께할 유물 하나를 선택하세요.</p><div class="challenge-choices">${ids.map(id=>{const a=ARTIFACTS.find(a=>a.id===id);return `<button class="run-artifact ${a.rarity}" data-challenge-artifact="${id}">${this.relicImage(id)}<span><b>${a.name}</b><small>${artifactText(a,true)}</small></span></button>`;}).join('')}</div><button class="secondary" id="choice-equipped">현재 적용 유물 · ${game.artifacts.size}/9</button>`);
    document.querySelectorAll('[data-challenge-artifact]').forEach(b=>b.onclick=()=>{if(game.chooseChallengeArtifact(b.dataset.challengeArtifact))done();});
    $('choice-equipped').onclick=()=>this.runArtifacts(game,()=>this.challengeReward(game,done));
  }
  rotationLabel() { return dailyHeroes().length===6?'일요일 · 모든 수호자와 함께':`오늘의 수호자 · ${dailyHeroes().map(i=>HEROES[i].name).join(' · ')}`; }
}
