import { dayKey } from './meta.js';
import { pickReviewMistake, claimReviewReward } from './learning.js';
import { LumiTutorClient, TUTOR_MODELS, offlineTutorLesson, tutorErrorMessage } from './tutoring.js';

const tutorEsc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tutorElement=id=>document.getElementById(id);
// Escape every model-provided character before applying this small text-only format.
const lessonMarkup=text=>text.split(/\n/).map(line=>/^#{1,3}\s/.test(line)?`<h3>${tutorEsc(line.replace(/^#{1,3}\s+/,''))}</h3>`:`<p>${tutorEsc(line).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')||'&nbsp;'}</p>`).join('');
export class TutoringUI {
  constructor(ui) {this.ui=ui;this.client=new LumiTutorClient();this.controller=null;this.session=0;}
  cancel() {this.controller?.abort();this.controller=null;this.session++;}
  exit() {this.cancel();this.ui.library('mistakes');}
  open() {
    this.cancel();this.question=pickReviewMistake(this.ui.profile,Math.random,this.question?.id);this.rewarded=false;
    if(!this.question){this.ui.toast('저장된 오답이 없어요. 문제를 풀고 다시 찾아와 주세요.');return;}
    if(!this.client.apiKey)return this.connect();
    this.show();this.load();
  }
  modelChoices() {
    return `<div class="tutor-models" role="group" aria-label="개인과외 모델">${TUTOR_MODELS.map(m=>`<button data-tutor-model="${m.id}" aria-pressed="${this.client.model===m.id}" title="${m.detail}">${m.label}</button>`).join('')}</div>`;
  }
  bindModels(reload=false) {
    document.querySelectorAll('[data-tutor-model]').forEach(b=>b.onclick=()=>{
      if(this.client.model===b.dataset.tutorModel)return;
      this.client.selectModel(b.dataset.tutorModel);
      document.querySelectorAll('[data-tutor-model]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.tutorModel===this.client.model)));
      if(reload){this.cancel();this.show();if(this.client.apiKey)this.load();}
    });
  }
  connect(message='') {
    this.cancel();
    this.ui.menu({kind:'tutor-connect',title:'루미와 연결하기',subtitle:'별빛 도서관 · 개인과외',closeId:'tutor-connect-close',onClose:()=>this.exit(),compact:true,
      body:`<div class="tutor-connect-copy"><div class="tutor-connect-portrait"><img src="${this.ui.art.urls.heroes[0]}" alt="개인과외 선생님 루미"></div><p>형아, Gemini API 키를 연결하면<br>이 오답을 더 자세히 설명해 줄게.</p></div><form id="tutor-key-form" class="tutor-key-form"><label for="tutor-api-key">Gemini API 키</label><div class="tutor-key-field"><input type="password" id="tutor-api-key" placeholder="API 키 붙여넣기" autocomplete="off" spellcheck="false" required><button type="button" id="tutor-key-reveal" aria-label="API 키 표시" aria-pressed="false">보기</button></div><label class="tutor-remember"><input type="checkbox" id="tutor-key-remember"> 이 기기에 키 기억하기</label><p class="tutor-key-note">입력한 키는 Gemini 요청에만 사용해요. 저장하지 않으면 파일을 닫을 때 지워져요. API 사용량은 해당 키의 계정에 적용돼요.</p>${this.modelChoices()}<p id="tutor-key-message" role="status">${tutorEsc(message)}</p><button class="primary" type="submit">연결하고 과외 시작</button></form>`,
      footer:'<button class="secondary" id="tutor-basic">기본 해설로 복습하기</button>'});
    this.bindModels();
    tutorElement('tutor-key-reveal').onclick=()=>{const input=tutorElement('tutor-api-key'),visible=input.type==='password';input.type=visible?'text':'password';tutorElement('tutor-key-reveal').textContent=visible?'숨기기':'보기';tutorElement('tutor-key-reveal').setAttribute('aria-pressed',String(visible));tutorElement('tutor-key-reveal').setAttribute('aria-label',visible?'API 키 숨기기':'API 키 표시');};
    tutorElement('tutor-basic').onclick=()=>this.show();
    tutorElement('tutor-key-form').onsubmit=e=>{
      e.preventDefault();const key=tutorElement('tutor-api-key').value.trim();
      if(!key){tutorElement('tutor-key-message').textContent='API 키를 입력해 주세요.';return;}
      const remembered=this.client.configure(key,tutorElement('tutor-key-remember').checked);
      this.show();if(!remembered)this.ui.toast('이 기기에 저장할 수 없어 이번 실행에서만 키를 사용해요.');this.load();
    };
  }
  show() {
    const {ui,question:q}=this;
    const granted=claimReviewReward(ui.profile,q);
    if(granted){this.rewarded=true;ui.save();}
    const claimed=ui.profile.learning.reviewRewardDate===dayKey();
    ui.menu({kind:'tutor',title:'루미의 개인과외',subtitle:'한 번 틀린 문제, 오래 기억할 한 가지',closeId:'tutor-close',onClose:()=>this.exit(),
      body:`<div class="tutor-layout"><aside class="tutor-mentor"><div class="tutor-orbit" aria-hidden="true"></div><img src="${ui.art.urls.heroes[0]}" alt="지팡이를 들고 강의하는 루미"><div class="tutor-mentor-caption"><small>YOUR STARLIGHT MENTOR</small><h3>대현자 루미</h3><p>형아, 헷갈렸던 부분부터<br>나랑 천천히 풀어 보자.</p></div></aside><div class="tutor-reading menu-scroll" tabindex="0" aria-label="오답과 개인과외 해설"><div class="tutor-question"><span class="tutor-subject">${q.kind==='grammar'?'문법 노트':q.kind==='vocab'?'단어 노트':'숙어 노트'} <i>✧</i> 무작위 오답</span><h3>${tutorEsc(q.prompt)}</h3><div class="tutor-options">${q.options.map(o=>`<span class="${o===q.answer?'answer':o===q.selectedAnswer?'selected':''}">${tutorEsc(o)}${o===q.answer?'<small>정답</small>':o===q.selectedAnswer?'<small>내 선택</small>':''}</span>`).join('')}</div></div><div class="tutor-lesson-heading"><span id="tutor-source">루미의 기본 노트</span><span id="tutor-reward" class="${this.rewarded?'awarded':''}">${this.rewarded?'✧ 오늘의 복습 · 꿈의결정 +1':claimed?'✓ 오늘의 복습 보상 완료':'하루 첫 복습 · 꿈의결정 1개'}</span></div><p id="tutor-status" class="tutor-status" role="status">${this.client.apiKey?'AI 설명을 요청할 수 있어요.':'저장된 해설로 함께 복습해요. AI 설명을 원하면 연결해 주세요.'}</p><article id="tutor-lesson" class="tutor-lesson">${lessonMarkup(offlineTutorLesson(q))}</article></div></div><div class="tutor-controls"><span>설명 모델</span>${this.modelChoices()}<button class="text-button" id="tutor-connection">${this.client.apiKey?'연결 해제':'AI 연결'}</button></div>`,
      footer:'<button class="secondary" id="tutor-retry">'+(this.client.apiKey?'다시 설명받기':'AI 설명받기')+'</button><button class="primary" id="tutor-next">다른 오답 배우기</button>'});
    this.bindModels(true);
    tutorElement('tutor-retry').onclick=()=>{if(!this.client.apiKey)this.connect();else this.load();};
    tutorElement('tutor-next').onclick=()=>this.open();
    tutorElement('tutor-connection').onclick=()=>{if(!this.client.apiKey)this.connect();else {this.cancel();this.client.disconnect();this.show();}};
  }
  async load() {
    this.cancel();const session=this.session;this.controller=new AbortController();
    const active=()=>session===this.session && Boolean(tutorElement('tutor-lesson'));
    const status=tutorElement('tutor-status'),button=tutorElement('tutor-retry');
    button.disabled=true;status.classList.remove('fallback');status.classList.add('loading');status.textContent='루미가 문제의 단서를 엮고 있어요…';
    tutorElement('tutor-lesson').setAttribute('aria-busy','true');
    try {
      if(globalThis.navigator?.onLine===false)throw new Error('Offline');
      const result=await this.client.request(this.question,{signal:this.controller.signal,onFallback:model=>{
        if(active())status.textContent=`잠시 연결이 어려워 ${TUTOR_MODELS.find(m=>m.id===model)?.label||'다른 모델'}로 설명을 이어가고 있어요…`;
      }});
      if(!active())return;
      tutorElement('tutor-lesson').innerHTML=lessonMarkup(result.text);
      tutorElement('tutor-source').textContent=`루미의 AI 과외 · ${TUTOR_MODELS.find(m=>m.id===result.model)?.label}${result.cached?' · 저장된 설명':''}`;
      status.textContent=result.model!==this.client.model?'연결 가능한 모델로 설명했어요.':'형아, 이 부분만 기억하면 다음에는 자신 있게 고를 수 있어.';
    }catch(error) {
      if(!active()||error.name==='AbortError')return;
      status.textContent=tutorErrorMessage(error);status.classList.add('fallback');
      if(!this.client.apiKey){button.textContent='API 키 다시 연결';tutorElement('tutor-connection').textContent='AI 연결';}
    }finally {
      if(active()){button.disabled=false;status.classList.remove('loading');tutorElement('tutor-lesson').removeAttribute('aria-busy');}
    }
  }
}
