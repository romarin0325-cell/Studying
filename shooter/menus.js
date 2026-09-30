import { HEROES, DUNGEONS, STAGES } from './content.js';
import { artifactText, ARTIFACTS, DIFFICULTIES, COSTUMES, COSTUME_TIERS, weekKey, weeklyEvent, dailyHeroes, heroAvailable, unlockHero, drawArtifact, purchaseCostume, equipCostume, achievementProgress, purchaseShopItem, useRandomResetTicket, randomRemaining, RANDOM_DAILY_LIMIT } from './meta.js';
import { LIBRARY, makeQuestion, recordAnswer } from './learning.js';
import { MANUAL_TABS, renderManual } from './manual.js';
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
  menu({kind, title, subtitle='', closeId, onClose, tools='', body='', footer='', compact=false}) {
    this.setModal('<header class="menu-header"><div class="menu-heading"><h2 id="menu-title">'+title+'</h2>'+(subtitle?'<p>'+subtitle+'</p>':'')+'</div><div class="menu-header-actions">'+tools+'<button class="menu-close" id="'+closeId+'" data-dismiss aria-label="닫기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div></header>'+body+(footer?'<footer class="menu-footer">'+footer+'</footer>':''), {menuKind:kind,compact});
    const panel=document.querySelector('.panel');
    panel.setAttribute('aria-labelledby','menu-title');$(closeId).onclick=onClose;
  }
  costumeArt(costume) { return this.art.urls.costumes[COSTUMES.findIndex(item=>item.id===costume.id)]; }
  manual(back=this.closeModal) {
    this.menu({kind:'manual',title:'비행 매뉴얼',subtitle:'플레이 안내 · 전투 수치 · 밸런스 기준',closeId:'manual-close',onClose:back,
      body:'<nav class="menu-tabs manual-tabs" aria-label="매뉴얼 분류">'+MANUAL_TABS.map(([id,name])=>'<button data-manual-tab="'+id+'" aria-pressed="'+(id==='guide')+'" class="'+(id==='guide'?'selected':'')+'">'+name+'</button>').join('')+'</nav><article class="menu-scroll manual-content" id="manual-body">'+renderManual()+'</article>',
      footer:'<button class="primary" id="manual-done">돌아가기</button>'});
    document.querySelectorAll('[data-manual-tab]').forEach(button=>button.onclick=()=>{
      document.querySelectorAll('[data-manual-tab]').forEach(b=>{const selected=b===button;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
      $('manual-body').innerHTML=renderManual(button.dataset.manualTab);$('manual-body').scrollTop=0;
    });
    $('manual-done').onclick=back;
  }
  lecture(lecture,back,label='도서관으로') {
    const read=this.profile.learning.read=Array.isArray(this.profile.learning.read)?this.profile.learning.read:[];
    if(!read.includes(lecture.id)){read.push(lecture.id);this.save();}
    this.menu({kind:'lecture',title:'루미의 문법 노트',subtitle:'강의 '+lecture.id,closeId:'lecture-close',onClose:back,
      body:'<div class="lecture-mentor"><div class="mentor-portrait"><img src="'+this.art.urls.heroes[0]+'" alt="루미"></div><div><small>별을 엮듯, 문장을 엮어요</small><h3>'+esc(lecture.title)+'</h3></div></div><article class="menu-scroll lecture-copy">'+esc(lecture.content)+'</article>',
      footer:'<button class="primary" id="lecture-back">'+esc(label)+'</button>'});
    $('lecture-back').onclick=back;
  }
  library(tab='vocab',term='',page=0) {
    const l=this.profile.learning;
    this.menu({kind:'library',title:'별빛 도서관',subtitle:'읽은 강의 '+(l.read||[]).length+'/35',closeId:'library-close',onClose:this.closeModal,
      body:'<nav class="menu-tabs library-tabs" aria-label="학습 분류">'+[['vocab','단어'],['collocation','숙어'],['grammar','문법'],['mistakes','오답']].map(([id,name])=>'<button data-tab="'+id+'" class="'+(id===tab?'selected':'')+'" aria-pressed="'+(id===tab)+'">'+name+'</button>').join('')+'</nav><div class="library-toolbar"><span id="library-count"></span><label class="search-field" '+(term?'':'hidden')+'><input id="library-search" aria-label="학습 내용 검색" placeholder="단어 또는 뜻 검색" value="'+esc(term)+'"></label><button class="icon-button" id="library-search-toggle" aria-label="검색 열기" aria-expanded="'+Boolean(term)+'"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg></button>'+(tab==='mistakes'?'<button class="text-button" id="mistakes-reset">전체 삭제</button>':'')+'</div><div class="menu-scroll" id="library-list"></div>',
      footer:'<nav class="library-pager" aria-label="목록 페이지"><button class="icon-button" id="library-prev" aria-label="이전 페이지">‹</button><span id="library-page" aria-live="polite"></span><button class="icon-button" id="library-next" aria-label="다음 페이지">›</button></nav><button class="primary" id="practice">'+(tab==='mistakes'?'오답 다시 풀기':'연습하기')+'</button>'});
    document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>this.library(b.dataset.tab));
    const render=()=>{
      const query=$('library-search').value.trim().toLowerCase();
      const rows=(tab==='mistakes'?(l.mistakes||[]):LIBRARY[tab]).map((entry,i)=>({entry,i})).filter(({entry:e})=>{
        const fields=tab==='vocab'?[e.w,e.m,e.tw,e.tm]:tab==='collocation'?[e.expression,e.meaning]:tab==='grammar'?[e.title,e.content]:[e.prompt,e.answer];
        return fields.some(value=>String(value||'').toLowerCase().includes(query));
      });
      const size=30,pages=Math.max(1,Math.ceil(rows.length/size));page=Math.max(0,Math.min(page,pages-1));
      $('library-count').textContent=rows.length.toLocaleString()+'개';
      const list=$('library-list');list.innerHTML=rows.length?rows.slice(page*size,(page+1)*size).map(({entry:e,i})=>tab==='grammar'
        ? '<button class="library-entry grammar-entry" data-lecture="'+i+'"><span class="entry-number">'+String(i+1).padStart(2,'0')+'</span><span><b>'+esc(e.title)+'</b><small>'+((l.read||[]).includes(e.id)?'읽음':'강의 열기')+' · '+(e.quizzes||[]).length+'문제</small></span><span class="entry-arrow">›</span></button>'
        : '<div class="library-entry"><b>'+esc(tab==='vocab'?e.w:tab==='collocation'?e.expression:e.prompt)+'</b><small>'+esc(tab==='vocab'?e.m:tab==='collocation'?e.meaning:e.answer)+'</small>'+(tab==='vocab'&&e.tw?'<small class="word-comparison">'+esc(e.tw)+' — '+esc(e.tm)+'</small>':tab==='mistakes'?'<button class="mistake-delete" data-delete="'+i+'" aria-label="'+esc(e.prompt)+' 오답 삭제">삭제</button>':'')+'</div>').join(''):'<div class="menu-empty"><span>✧</span><b>'+(query?'검색 결과가 없어요':'아직 저장된 항목이 없어요')+'</b><p>'+(query?'다른 단어나 뜻으로 찾아보세요.':'연습하면서 나만의 기록을 채워 보세요.')+'</p></div>';
      $('library-page').textContent=(page+1)+' / '+pages;$('library-prev').disabled=page===0;$('library-next').disabled=page===pages-1;
      list.scrollTop=0;
      list.querySelectorAll('[data-lecture]').forEach(b=>b.onclick=()=>this.lecture(LIBRARY.grammar[Number(b.dataset.lecture)],()=>this.library('grammar',query,page)));
      list.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{l.mistakes.splice(Number(b.dataset.delete),1);this.save();render();});
      $('practice').disabled=tab==='mistakes'&&!(l.mistakes||[]).length;
      if($('mistakes-reset'))$('mistakes-reset').disabled=!(l.mistakes||[]).length;
    };
    render();$('library-search').oninput=()=>{page=0;render();};
    $('library-search-toggle').onclick=()=>{
      const field=document.querySelector('.search-field'),open=field.hidden;field.hidden=!open;
      $('library-count').hidden=open;$('library-search-toggle').setAttribute('aria-expanded',String(open));$('library-search-toggle').setAttribute('aria-label',open?'검색 닫기':'검색 열기');
      if(open)$('library-search').focus();else{$('library-search').value='';page=0;render();}
    };
    if(term)$('library-count').hidden=true;
    $('library-prev').onclick=()=>{page--;render();};$('library-next').onclick=()=>{page++;render();};
    if($('mistakes-reset'))$('mistakes-reset').onclick=()=>{
      const query=$('library-search').value;
      this.menu({kind:'confirm',title:'오답을 모두 지울까요?',closeId:'reset-cancel',onClose:()=>this.library('mistakes',query,page),compact:true,
        body:'<div class="confirmation-copy"><p>저장된 오답 '+(l.mistakes||[]).length+'개를 삭제해요.</p><small>정답 기록과 읽은 강의는 유지돼요.</small></div>',footer:'<button class="primary" id="reset-confirm">오답 모두 삭제</button>'});
      $('reset-confirm').onclick=()=>{l.mistakes=[];this.save();this.library('mistakes');};
    };
    $('practice').onclick=()=>{const q=tab==='mistakes'?l.mistakes[0]:null;this.quiz(q?.kind||tab,'연습',()=>this.library(tab),q);};
  }
  equipment(refresh) {
    const p=this.profile,scroll=document.querySelector('.equipment-list')?.scrollTop||0;
    const exit=()=>{this.closeModal();refresh();};
    this.menu({kind:'equipment',title:'별의 유물함',subtitle:'장착 '+p.equipped.length+'/3 · 수집 '+p.owned.length+'/'+ARTIFACTS.length,closeId:'equipment-close',onClose:exit,
      body:'<div class="menu-scroll equipment-list">'+['normal','rare','epic'].map(rarity=>'<section class="relic-section" aria-label="'+(rarity==='epic'?'에픽':rarity==='rare'?'레어':'일반')+' 아티팩트"><h3><span>'+(rarity==='epic'?'에픽':rarity==='rare'?'레어':'일반')+'</span><i></i></h3><div class="artifact-grid">'+ARTIFACTS.filter(a=>a.rarity===rarity).map(a=>'<button class="artifact '+(p.equipped.includes(a.id)?'selected ':'')+a.rarity+'" data-artifact="'+a.id+'" '+(p.owned.includes(a.id)?'':'disabled')+' aria-pressed="'+p.equipped.includes(a.id)+'">'+this.relicImage(a.id)+'<b>'+a.name+'</b><small>'+a.text+'</small><em>'+(p.equipped.includes(a.id)?'착용 중':p.owned.includes(a.id)?'보유':'미보유')+'</em></button>').join('')+'</div></section>').join('')+'</div>',
      footer:'<button class="secondary" id="draw-ticket" '+(p.tickets.length?'':'disabled')+'>유물 뽑기 <span>'+p.tickets.length+'장</span></button><button class="primary" id="equipment-done">장착 완료</button>'});
    document.querySelector('.equipment-list').scrollTop=scroll;
    document.querySelectorAll('[data-artifact]').forEach(b=>b.onclick=()=>{
      const id=b.dataset.artifact;
      if(p.equipped.includes(id))p.equipped=p.equipped.filter(a=>a!==id);
      else if(p.equipped.length<3)p.equipped.push(id);
      else return this.toast('유물은 세 개까지 장착할 수 있어요');
      this.save();
      const selected=p.equipped.includes(id);
      b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));
      b.querySelector('em').textContent=selected?'착용 중':'보유';
      document.querySelector('.equipment-panel .menu-heading p').textContent='장착 '+p.equipped.length+'/3 · 수집 '+p.owned.length+'/'+ARTIFACTS.length;
    });
    $('equipment-done').onclick=exit;
    $('draw-ticket').onclick=()=>{
      if(!p.tickets.length)return;
      let resolved=false;
      const draw=correct=>{
        if(resolved)return;resolved=true;
        const snap=economySnapshot(p),result=drawArtifact(p,Math.random,correct);if(!result)return this.equipment(refresh);
        if(!this.save()){restoreEconomy(p,snap);this.toast('저장하지 못해서 뽑기를 취소했어요.');return this.equipment(refresh);}
        const a=result.artifact,done=()=>this.equipment(refresh);
        this.menu({kind:'reveal',title:result.duplicate?'다시 만난 유물':'새로운 유물',subtitle:a.rarity==='epic'?'에픽':a.rarity==='rare'?'레어':'일반',closeId:'reveal-close',onClose:done,
          body:'<div class="reveal-body"><div class="reveal-stage relic-reveal '+a.rarity+'">'+this.relicImage(a.id)+'</div><div class="reveal-caption"><h3>'+a.name+'</h3><p>'+a.text+'</p><div class="reward-note">'+(result.duplicate?'꿈의결정 <b>+'+result.shardsAwarded+'</b>':'유물함에서 장착할 수 있어요')+'</div></div></div>',footer:'<button class="primary" id="reveal-done">유물함으로</button>'});
        $('reveal-done').onclick=done;
      };
      this.offerQuiz('유물 뽑기', '단어나 숙어 퀴즈를 맞히면 이번 뽑기에서 레어·에픽 유물을 만날 기회가 높아져요.',
        ()=>this.quiz(Math.random()<.5?'vocab':'collocation','',draw),()=>draw(false));
      $('quiz-decline').textContent='바로 뽑기';
    };
  }
  costumeReveal(result,done) {
    const c=result.costume;
    this.menu({kind:'reveal',title:result.duplicate?'이미 만난 의상':'새로운 의상',subtitle:HEROES[c.hero].name,closeId:'costume-reveal-close',onClose:done,
      body:'<div class="reveal-body"><div class="reveal-stage costume-reveal"><img src="'+this.costumeArt(c)+'" alt="'+esc(c.name)+'"></div><div class="reveal-caption"><h3>'+esc(c.name)+'</h3><p>'+HEROES[c.hero].name+'에게 착용했어요</p><div class="reward-note">'+(result.duplicate?'중복 의상 · 꿈의결정 <b>+'+result.shardsAwarded+'</b>':'메인 화면과 전투에 적용돼요')+'</div></div></div>',
      footer:'<button class="primary" id="costume-reveal-done">확인</button>'});
    $('costume-reveal-done').onclick=done;
  }
  shop(refresh,tab='costumes') {
    const p=this.profile,exit=()=>{this.closeModal();refresh();};
    let busy=false;
    const descriptions={daily:'포근한 하루의 옷장',fantasy:'또 다른 세계의 수호자',special:'특별한 순간을 함께',miracle:'마음에 드는 한 벌을 직접'};
    const render=()=>{
      const shards=p.dreamShards,remaining=randomRemaining(p),crystal=this.art.urls.shopItems[0];
      this.menu({kind:'shop',title:'별빛 상점',subtitle:'작은 결정으로 만나는 새로운 모습',closeId:'shop-close',onClose:exit,
        tools:'<button class="icon-button shop-lineup-trigger" id="shop-lineup" aria-label="코스튬 티켓 상세 라인업">!</button>',
        body:'<div class="shop-balance"><span><img src="'+crystal+'" alt="">꿈의결정</span><strong>'+shards+'</strong></div><nav class="menu-tabs" aria-label="상점 분류"><button data-shop-tab="costumes" class="'+(tab==='costumes'?'selected':'')+'">코스튬</button><button data-shop-tab="supplies" class="'+(tab==='supplies'?'selected':'')+'">모험 준비</button></nav><div class="menu-scroll shop-content"><div class="shop-goods" '+(tab==='costumes'?'':'hidden')+'>'+COSTUME_TIERS.map((tier,index)=>'<article class="shop-product costume-product '+tier.id+'"><div class="shop-product-art"><img src="'+this.art.urls.costumeTickets[index]+'" alt=""></div><h3>'+tier.name+'</h3><p>'+descriptions[tier.id]+'</p><button class="purchase-button" id="buy-costume-'+tier.id+'" '+(shards>=tier.cost||p.costumeTickets[tier.id]?'':'disabled')+'>'+(p.costumeTickets[tier.id]?'보유 티켓 사용 <b>'+p.costumeTickets[tier.id]+'장</b>':'<img src="'+crystal+'" alt=""><b>'+tier.cost+'</b><span>'+(tier.id==='miracle'?'선택하기':'획득하기')+'</span>')+'</button></article>').join('')+'</div><div class="shop-supplies" '+(tab==='supplies'?'':'hidden')+'>'+[['artifact','아티팩트 뽑기권',5,1,'보유 뽑기권 '+p.tickets.length+'장','buy-ticket'],['reset','랜덤 횟수 리셋권',1,2,'보유 리셋권 '+p.randomResetTickets+'장','buy-reset']].map(([id,name,cost,index,stock,button])=>'<article class="shop-product supply-product"><img src="'+this.art.urls.shopItems[index]+'" alt=""><div><h3>'+name+'</h3><p>'+stock+'</p></div><button class="purchase-button" id="'+button+'" '+(shards>=cost?'':'disabled')+' aria-label="'+name+' 꿈의결정 '+cost+'개로 구매"><img src="'+crystal+'" alt=""><b>'+cost+'</b><span>구매</span></button></article>').join('')+'<div class="shop-reset"><div><small>오늘의 랜덤 출격</small><strong>'+remaining+' <span>/ '+RANDOM_DAILY_LIMIT+'</span></strong></div><button class="secondary" id="use-reset" '+(p.randomResetTickets>0&&remaining===0?'':'disabled')+'>리셋권 사용</button></div><p class="shop-note" id="reset-note">'+(remaining>0?'기본 횟수를 모두 사용한 뒤 리셋할 수 있어요.':'리셋하면 오늘 기본 출격 횟수가 3회로 돌아와요.')+'</p></div></div>',
        footer:'<p class="shop-note">'+(tab==='costumes'?'획득 즉시 착용 · 중복 의상은 꿈의결정 3개 환급':'유물 뽑기권은 유물함에서 사용할 수 있어요')+'</p><button class="text-button" id="shop-back">출격 준비로</button>'});
      $('shop-back').onclick=exit;
      document.querySelectorAll('[data-shop-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.shopTab;render();});
      COSTUME_TIERS.forEach(tier=>$('buy-costume-'+tier.id).onclick=()=>tier.id==='miracle'?chooseMiracle():settleCostume(tier.id));
      $('buy-ticket').onclick=()=>confirmBuy('artifact','아티팩트 뽑기권',5);
      $('buy-reset').onclick=()=>confirmBuy('reset','랜덤 횟수 리셋권',1);
      $('use-reset').onclick=confirmReset;
      $('shop-lineup').onclick=()=>{
        this.menu({kind:'lineup',title:'코스튬 컬렉션',subtitle:'일상·판타지·스페셜은 네 의상 중 하나',closeId:'lineup-close',onClose:render,
          body:'<div class="menu-scroll ticket-lineup">'+COSTUME_TIERS.map((tier,index)=>'<section><header><img src="'+this.art.urls.costumeTickets[index]+'" alt=""><h3>'+tier.name+'</h3><small>'+tier.cost+' 결정</small></header><p>'+(tier.id==='miracle'?'전체 12벌 중 원하는 의상을 선택해요.':tier.lineup.map(c=>'<span><b>'+esc(c.name)+'</b><small>'+HEROES[c.hero].name+'</small></span>').join(''))+'</p></section>').join('')+'</div>',
          footer:'<button class="primary" id="shop-lineup-back">상점으로</button>'});
        $('shop-lineup-back').onclick=render;
      };
    };
    const settleCostume=(tier,choice=null)=>{
      if(busy)return;busy=true;
      const snap=economySnapshot(p),result=purchaseCostume(p,tier,Math.random,choice);
      if(!result.ok){busy=false;this.toast(result.reason==='balance'?'꿈의결정이 부족해요.':'의상을 선택해 주세요.');return render();}
      if(!this.save()){restoreEconomy(p,snap);busy=false;this.toast('저장하지 못해서 구매를 취소했어요.');return render();}
      this.costumeReveal(result,()=>{busy=false;render();});
    };
    const chooseMiracle=()=>{
      let selected=null;
      this.menu({kind:'miracle',title:'당신을 위한 한 벌',subtitle:p.costumeTickets.miracle?'보유 미라클 티켓 1장 사용':'미라클 · 꿈의결정 30개',closeId:'miracle-back',onClose:render,
        body:'<div class="menu-scroll miracle-choice">'+COSTUMES.map(c=>'<button data-miracle="'+c.id+'" aria-pressed="false"><img src="'+this.costumeArt(c)+'" alt=""><b>'+esc(c.name)+'</b><small>'+HEROES[c.hero].name+(p.costumesOwned.includes(c.id)?' · 보유':'')+'</small></button>').join('')+'</div>',
        footer:'<p class="selection-note" id="miracle-selection">원하는 의상을 선택해 주세요</p><button class="primary" id="miracle-confirm" disabled>선택한 의상 획득</button>'});
      document.querySelectorAll('[data-miracle]').forEach(b=>b.onclick=()=>{
        selected=COSTUMES.find(c=>c.id===b.dataset.miracle);
        document.querySelectorAll('[data-miracle]').forEach(item=>{item.classList.toggle('selected',item===b);item.setAttribute('aria-pressed',String(item===b));});
        $('miracle-selection').textContent=HEROES[selected.hero].name+' · '+selected.name+(p.costumesOwned.includes(selected.id)?' — 중복 시 3개 환급':'');
        $('miracle-confirm').disabled=false;
      });
      $('miracle-confirm').onclick=()=>{if(selected)settleCostume('miracle',selected.id);};
    };
    const confirmBuy=(item,name,cost)=>{
      this.menu({kind:'confirm',title:name,closeId:'shop-cancel',onClose:render,compact:true,
        body:'<div class="confirmation-copy"><p>꿈의결정 <b>'+cost+'개</b>로 구매해요.</p><small>보유 꿈의결정 '+p.dreamShards+'개</small></div>',footer:'<button class="primary" id="shop-confirm">구매</button>'});
      let done=false;
      $('shop-confirm').onclick=()=>{
        if(done||busy)return;done=true;const snap=economySnapshot(p),result=purchaseShopItem(p,item);
        if(!result.ok){this.toast('꿈의결정이 부족해요.');return render();}
        if(!this.save()){restoreEconomy(p,snap);this.toast('저장하지 못해서 구매를 취소했어요.');return render();}
        this.toast('구매했어요.');render();
      };
    };
    const confirmReset=()=>{
      this.menu({kind:'confirm',title:'다시 새로운 만남으로',closeId:'shop-cancel',onClose:render,compact:true,
        body:'<div class="confirmation-copy"><p>리셋권 1장으로 오늘의 랜덤 출격을<br><b>3회</b>로 되돌려요.</p></div>',footer:'<button class="primary" id="shop-confirm">리셋권 사용</button>'});
      let done=false;
      $('shop-confirm').onclick=()=>{
        if(done||busy)return;done=true;const snap=economySnapshot(p),result=useRandomResetTicket(p);
        if(!result.ok){this.toast('지금은 리셋권을 사용할 수 없어요.');return render();}
        if(!this.save()){restoreEconomy(p,snap);this.toast('저장하지 못해서 사용을 취소했어요.');return render();}
        this.toast('오늘의 랜덤 출격이 3회로 돌아왔어요.');render();
      };
    };
    render();
  }
  wardrobe(refresh,selectedHero=0) {
    const p=this.profile,heroes=[0,1,2,3,4,6],exit=()=>{this.closeModal();refresh();};
    if(!heroes.includes(selectedHero))selectedHero=0;
    let previewId=p.costumesEquipped[selectedHero]||null;
    const variantsFor=hero=>[{id:null,name:'기본 의상',hero},...COSTUMES.filter(c=>c.hero===hero)];
    const currentPreview=()=>variantsFor(selectedHero).find(c=>c.id===previewId)||variantsFor(selectedHero)[0];
    this.menu({kind:'wardrobe',title:'의상실',subtitle:'컬렉션 '+p.costumesOwned.length+'/'+COSTUMES.length,closeId:'wardrobe-close',onClose:exit,
      body:'<nav class="wardrobe-heroes" aria-label="의상 변경 캐릭터">'+heroes.map(index=>'<button data-wardrobe-hero="'+index+'">'+HEROES[index].name+'</button>').join('')+'</nav><div class="wardrobe-scene"><div class="wardrobe-orbit" aria-hidden="true"></div><div class="wardrobe-preview"><img class="anchored-art" alt=""></div><div class="wardrobe-caption" aria-live="polite" aria-atomic="true"><small></small><h3></h3><span></span></div></div><div class="wardrobe-variants" aria-label="의상 선택">'+variantsFor(selectedHero).map((c,i)=>'<button data-preview="'+(c.id||'')+'"><small>0'+(i+1)+'</small><b></b><span></span></button>').join('')+'</div>',
      footer:'<button class="secondary" id="wardrobe-back">돌아가기</button><button class="primary" id="wardrobe-equip"></button>'});
    const render=(hero=selectedHero)=>{
      if(hero!==selectedHero){selectedHero=hero;previewId=p.costumesEquipped[hero]||null;}
      const variants=variantsFor(hero),preview=currentPreview(),owned=!preview.id||p.costumesOwned.includes(preview.id),equipped=(p.costumesEquipped[hero]||null)===preview.id;
      const image=document.querySelector('.wardrobe-preview img'),src=preview.id?this.costumeArt(preview):this.art.urls.heroes[hero];
      if(image.getAttribute('src')!==src)image.src=src;
      image.alt=HEROES[hero].name+' '+preview.name;
      document.querySelector('.wardrobe-caption small').textContent=HEROES[hero].name;
      document.querySelector('.wardrobe-caption h3').textContent=preview.name;
      document.querySelector('.wardrobe-caption span').textContent=equipped?'현재 착용 중':owned?'보유한 의상':'아직 만나지 못한 의상';
      document.querySelectorAll('[data-wardrobe-hero]').forEach(b=>{const active=Number(b.dataset.wardrobeHero)===hero;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
      document.querySelectorAll('[data-preview]').forEach((b,i)=>{
        const c=variants[i],active=preview.id===c.id;
        b.dataset.preview=c.id||'';b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
        b.querySelector('b').textContent=c.name;
        b.querySelector('span').textContent=(p.costumesEquipped[hero]||null)===c.id?'착용 중':!c.id||p.costumesOwned.includes(c.id)?'보유':'미보유';
      });
      $('wardrobe-equip').disabled=equipped;
      $('wardrobe-equip').textContent=equipped?'착용 중':owned?'이 의상 착용':'상점에서 만나기';
    };
    document.querySelectorAll('[data-wardrobe-hero]').forEach(b=>b.onclick=()=>render(Number(b.dataset.wardrobeHero)));
    document.querySelectorAll('[data-preview]').forEach(b=>b.onclick=()=>{previewId=b.dataset.preview||null;render();});
    $('wardrobe-back').onclick=exit;
    $('wardrobe-equip').onclick=()=>{
      const preview=currentPreview();
      if(preview.id&&!p.costumesOwned.includes(preview.id))return this.shop(refresh);
      const snap=economySnapshot(p);if(!equipCostume(p,selectedHero,preview.id))return;
      if(!this.save()){restoreEconomy(p,snap);this.toast('저장하지 못해서 의상 변경을 취소했어요.');}
      render();
    };
    render();
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
