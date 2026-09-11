import { HEROES, DUNGEONS, STAGES } from './content.js';
import { ARTIFACTS, DIFFICULTIES, weekKey, dailyHeroes, heroAvailable, unlockHero, drawArtifact } from './meta.js';
import { LIBRARY, makeQuestion, recordAnswer } from './learning.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = id => document.getElementById(id);
export class CampaignUI {
  constructor(options) { Object.assign(this,options); }
  relicImage(id){return `<img src="${this.art.urls.relics[ARTIFACTS.findIndex(a=>a.id===id)]}" alt="">`;}
  chooseHero(index,done) {
    if(heroAvailable(this.profile,index)) return done();
    this.quiz('grammar',`${HEROES[index].name}와 오늘의 계약`, correct=>{if(correct){unlockHero(this.profile,index);this.save();done();}else this.closeModal();});
  }
  quiz(kind,title,done,provided = null) {
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
  library(tab='vocab',term='') {
    const l=this.profile.learning;
    this.setModal(`<span class="small-caps">THE CELESTIAL LIBRARY</span><h2>별의 도서관</h2><p class="intro-copy">기억한 말들이 다음 비행의 힘이 돼요.<br>정답 ${Number(l.correct)||0} / ${Number(l.total)||0} · 읽은 강의 ${(l.read||[]).length}/35</p><nav class="library-tabs">${[['vocab','단어'],['collocation','숙어'],['grammar','문법'],['mistakes','오답']].map(([id,name])=>`<button data-tab="${id}" class="${id===tab?'selected':''}">${name}</button>`).join('')}</nav><input id="library-search" aria-label="학습 내용 검색" placeholder="단어 · 뜻 · 강의 검색" value="${esc(term)}"><div id="library-list"></div><button class="primary" id="practice">${tab==='mistakes'?'오답 다시 풀기':'연습 문제 풀기'}</button><button class="secondary" id="library-close">출격 준비로</button>`);
    document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>this.library(b.dataset.tab));
    const render=()=>{
      const query=$('library-search').value.trim().toLowerCase();
      const rows=(tab==='mistakes'?(l.mistakes||[]):LIBRARY[tab]).map((entry,i)=>({entry,i})).filter(({entry})=>JSON.stringify(entry).toLowerCase().includes(query));
      const list=$('library-list');list.innerHTML=`<p class="tiny-note">${rows.length}개 · ${rows.length>60?'검색으로 범위를 좁혀주세요':'천천히 읽고 기억해요'}</p>`+rows.slice(0,60).map(({entry:e,i})=>tab==='grammar'?`<button class="library-entry" data-lecture="${i}"><b>${esc(e.title)}</b><small>${(l.read||[]).includes(e.id)?'읽음':'강의 열기'} · ${(e.quizzes||[]).length}문제</small></button>`:`<div class="library-entry"><b>${esc(tab==='vocab'?e.w:tab==='collocation'?e.expression:e.prompt)}</b><small>${esc(tab==='vocab'?e.m:tab==='collocation'?e.meaning:e.answer)}</small>${tab==='vocab'?`<small>혼동 주의 · ${esc(e.tw)}: ${esc(e.tm)}</small>`:tab==='collocation'?`<p>${esc(e.question.replace(/_{2,}/g,e.answer))}</p>`:''}</div>`).join('');
      list.querySelectorAll('[data-lecture]').forEach(b=>b.onclick=()=>this.lecture(LIBRARY.grammar[Number(b.dataset.lecture)],()=>this.library('grammar',query)));
    };render();$('library-search').oninput=render;
    document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===tab)));
    $('library-close').onclick=this.closeModal;
    $('practice').disabled=tab==='mistakes'&&!(l.mistakes||[]).length;
    $('practice').onclick=()=>{const q=tab==='mistakes'?l.mistakes[0]:null;this.quiz(q?.kind||tab,'별빛 연습',()=>this.library(tab),q);};
  }
  equipment(refresh) {
    const p=this.profile;
    this.setModal(`<span class="small-caps">RELICS OF THE FOUR SKIES</span><h2>별의 유물함</h2><p class="intro-copy">소유한 유물 중 세 개까지 장착해요.<br>선택 ${p.equipped.length}/3 · 수집 ${p.owned.length}/15</p><div class="artifact-grid">${ARTIFACTS.map(a=>`<button class="artifact ${p.equipped.includes(a.id)?'selected':''} ${a.rarity}" data-artifact="${a.id}" ${p.owned.includes(a.id)?'':'disabled'} aria-pressed="${p.equipped.includes(a.id)}">${this.relicImage(a.id)}<b>${a.name}</b><small>${a.text}</small><em>${p.owned.includes(a.id)?a.rarity==='rare'?'RARE':'NORMAL':'미보유'}</em></button>`).join('')}</div><button class="primary" id="draw-ticket" ${p.tickets.length?'':'disabled'}>아티팩트 뽑기 · ${p.tickets.length}장</button><p class="tiny-note">레어 확률: 쉬움 10% · 중간 25% · 어려움 45%. 등급 안에서는 동일 확률이며 중복도 나와요. 주간 첫 클리어 난이도가 적용돼요.</p><button class="secondary" id="equipment-done">장착 완료</button>`);
    document.querySelectorAll('[data-artifact]').forEach(b=>b.onclick=()=>{const id=b.dataset.artifact;if(p.equipped.includes(id))p.equipped=p.equipped.filter(a=>a!==id);else if(p.equipped.length<3)p.equipped.push(id);else return this.toast('유물은 세 개까지 장착할 수 있어요');this.save();this.equipment(refresh);});
    $('equipment-done').onclick=()=>{this.closeModal();refresh();};
    $('draw-ticket').onclick=()=>{
      const result=drawArtifact(p);if(!result)return;this.save();const a=result.artifact;
      this.setModal(`<span class="small-caps">${a.rarity==='rare'?'RARE RELIC':'RELIC DISCOVERED'}</span><div class="relic-reveal ${a.rarity}">${this.relicImage(a.id)}</div><h2>${a.name}</h2><p class="intro-copy">${a.text}<br>${result.duplicate?'이미 소유한 유물이에요. 다음 주에 새로운 별을 찾아봐요.':'새로운 유물을 발견했어요. 유물함에서 장착할 수 있어요.'}</p><button class="primary" id="reveal-done">유물함으로</button>`);$('reveal-done').onclick=()=>this.equipment(refresh);
    };
  }
  dungeons(selected,mode,done) {
    const week=weekKey();
    this.setModal(`<span class="small-caps">CHOOSE YOUR EXPEDITION</span><h2>네 개의 하늘</h2><div class="dungeon-list">${DUNGEONS.map(d=>`<button class="dungeon-card ${selected===d.id?'selected':''}" data-dungeon="${d.id}" style="--dungeon-art:url('${this.art.urls.worlds[d.id]}')"><small>DUNGEON 0${d.id+1} · 3 STAGES</small><b>${d.name}</b><span>${STAGES[d.id].boss}</span><em>${this.profile.claims[`${week}:${d.id}`]?'이번 주 보상 수령':'주간 첫 클리어 · 뽑기권 1장'}</em></button>`).join('')}</div><p class="intro-copy">${DUNGEONS[selected].mechanic}</p><div class="difficulty-list">${DIFFICULTIES.map(d=>`<button data-difficulty="${d.id}" class="${d.id===mode?'selected':''}" aria-pressed="${d.id===mode}"><b>${d.name}</b><small>레어 ${Math.round(d.rare*100)}%</small></button>`).join('')}</div><p class="tiny-note">뒤쪽 던전일수록 적의 체력·탄속·패턴이 강해져요. 주간 보상은 월요일 0시 초기화, 난이도와 관계없이 던전당 한 번이에요.</p><button class="primary" id="dungeon-done">이 하늘로 출격 준비</button>`);
    document.querySelectorAll('[data-dungeon]').forEach(b=>b.onclick=()=>this.dungeons(Number(b.dataset.dungeon),mode,done));
    document.querySelectorAll('[data-difficulty]').forEach(b=>b.onclick=()=>this.dungeons(selected,b.dataset.difficulty,done));
    $('dungeon-done').onclick=()=>{this.closeModal();done(selected,mode);};
  }
  rotationLabel() { return dailyHeroes().length===6?'일요일 · 모든 수호자와 함께':`오늘의 수호자 · ${dailyHeroes().map(i=>HEROES[i].name).join(' · ')}`; }
}
