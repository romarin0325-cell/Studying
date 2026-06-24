const FORTUNE_GRADES = [
  { grade: "대길 (大吉)", weight: 5, messages: ["하늘이 내린 행운의 날! 모든 일이 술술 풀릴 것입니다.", "별들이 당신을 축복합니다. 오늘 시작하는 일은 반드시 성공합니다."] },
  { grade: "길 (吉)", weight: 10, messages: ["매우 좋은 운세입니다. 기분 좋은 하루가 될 거예요.", "긍정적인 에너지가 가득합니다. 자신감을 가지세요!"] },
  { grade: "중길 (中吉)", weight: 15, messages: ["꽤 좋은 운세입니다. 소소한 행운이 찾아옵니다.", "오늘 하루, 생각보다 일이 잘 풀릴 것입니다."] },
  { grade: "소길 (小吉)", weight: 15, messages: ["작은 행운이 미소 짓는 날입니다.", "소박한 기쁨을 누릴 수 있는 하루입니다."] },
  { grade: "반길 (半吉)", weight: 15, messages: ["좋은 기운이 반, 평범함이 반인 무난한 날입니다.", "반은 운명에, 반은 노력에 달려있습니다."] },
  { grade: "말길 (末吉)", weight: 13, messages: ["처음엔 힘들 수 있으나 끝에 가서 좋아지는 운세입니다.", "포기하지 않으면 좋은 결실을 맺을 것입니다."] },
  { grade: "평 (平)", weight: 12, messages: ["무난하고 평화로운 하루입니다.", "특별한 일은 없지만, 그것이 곧 행복입니다."] },
  { grade: "소흉반전 (小凶反轉)", weight: 8, messages: ["작은 시련이 찾아오지만, 곧 크게 뒤집혀 행운이 됩니다.", "비 온 뒤에 땅이 굳듯, 어려움을 이겨내면 더 큰 성과가 있습니다."] },
  { grade: "흉전길 (凶轉吉)", weight: 5, messages: ["큰 시련 뒤에 뜻밖의 큰 행운이 기다리고 있습니다.", "지금의 위기는 기회입니다. 곧 상황이 역전됩니다."] },
  { grade: "대기만성 (大器晩成)", weight: 2, messages: ["늦게 피는 꽃이 가장 아름답습니다. 오늘의 인내가 내일의 풍요입니다.", "큰 그릇은 오래 빚어집니다. 지금 이 순간이 당신을 완성시키고 있습니다."] }
];

const FortuneCookie = {
  currentSet: null,
  currentMultiSession: null,
  audio: null,
  _timerId: null,

  init() {
    const btn = document.getElementById('btn-fortune-cookie');
    if(btn) {
      btn.addEventListener('click', () => this.open());
      btn.disabled = false;
    }
  },

  getTodayDateString() {
    const now = new Date();
    // AM/PM 로직 적용 (오전은 오늘 날짜, 오후는 내일 날짜)
    if (now.getHours() >= 12) {
      now.setDate(now.getDate() + 1);
    }
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  canUse() {
    const todayStr = this.getTodayDateString();
    const lastUsedStr = localStorage.getItem('fortuneCookieLastUsedDate');
    return lastUsedStr !== todayStr;
  },

  markUsed(fortuneResult) {
    const todayStr = this.getTodayDateString();
    localStorage.setItem('fortuneCookieLastUsedDate', todayStr);
    localStorage.setItem('fortuneCookieLastResult', JSON.stringify(fortuneResult));
  },

  open() {
    if (!this.canUse()) {
      let savedResult = {};
      try {
        const raw = localStorage.getItem('fortuneCookieLastResult');
        if (raw) savedResult = JSON.parse(raw);
      } catch (e) {
        console.warn("로컬 스토리지 파싱 에러 복구", e);
        savedResult = {};
      }
      this.showFortunePhase(savedResult);
      return;
    }

    if (typeof LISTENING_DATA === 'undefined' || LISTENING_DATA.length === 0) {
      alert("리스닝 데이터가 없습니다.");
      return;
    }

    // 데이터에서 랜덤 1개 선택
    const randIndex = Math.floor(Math.random() * LISTENING_DATA.length);
    this.currentSet = LISTENING_DATA[randIndex];
    
    if (this.currentSet.part === 2) {
      this.showListeningPhase();
    } else {
      // Part 3/4
      this.currentMultiSession = {
        qIndex: 0,
        results: [],
        totalQuestions: this.currentSet.questions.length
      };
      
      if (this.audio) {
        this.audio.pause();
      }
      this.audio = new Audio(this.currentSet.audioFile);
      
      this.showMultiHub();
    }
  },

  showListeningPhase() {
    document.getElementById('modal-fortune-cookie').classList.add('active');
    document.getElementById('fortune-listening-phase').style.display = 'flex';
    document.getElementById('fortune-multi-hub-phase').style.display = 'none';
    document.getElementById('fortune-multi-q-phase').style.display = 'none';
    document.getElementById('fortune-explanation-phase').style.display = 'none';
    document.getElementById('fortune-result-phase').style.display = 'none';
    
    // UI 업데이트
    document.getElementById('fortune-part-title').innerText = this.currentSet.setTitle;
    document.getElementById('fortune-part-tip').innerText = "💡 질문을 듣고 가장 적절한 응답을 고르세요.";

    // 문제 보기 초기화 (Part 2는 1문제이므로 일단 첫 번째 문제만 로드)
    const qData = this.currentSet.questions[0];
    const optionsContainer = document.getElementById('fortune-options-container');
    optionsContainer.innerHTML = '';

    const labels = ['(A)', '(B)', '(C)'];
    const optionCount = 3;
    
    for (let i = 0; i < optionCount; i++) {
      const btn = document.createElement('button');
      btn.className = 'menu-btn option-btn';
      btn.innerText = labels[i];
      btn.style.padding = "10px";
      btn.style.marginBottom = "5px";
      btn.style.fontSize = "1rem";
      btn.onclick = () => this.handleAnswer(i, btn, qData.answer);
      optionsContainer.appendChild(btn);
    }

    // 오디오 설정
    if (this.audio) {
      this.audio.pause();
    }
    this.audio = new Audio(this.currentSet.audioFile);
    // 기본적으로 자동 재생하지 않고 사용자가 버튼을 눌렀을 때 재생하도록 주석 처리
    // this.playAudio();
  },

  playAudio() {
    if (this.audio) {
      if (this.audio.paused) {
        if (this.audio.ended) {
          this.audio.currentTime = 0;
        }
        this.audio.play().catch(e => console.log("Auto-play blocked by browser. Please click Play manually.", e));
      } else {
        this.audio.pause();
      }
    }
  },

  handleAnswer(selectedIndex, btnElement, correctIndex) {
    // 모든 버튼 비활성화
    const buttons = document.querySelectorAll('#fortune-options-container .option-btn');
    buttons.forEach(b => b.disabled = true);

    if (selectedIndex === correctIndex) {
      btnElement.classList.add('correct');
    } else {
      btnElement.classList.add('wrong');
      buttons[correctIndex].classList.add('correct');
    }

    // 1.5초 후 운세 보여주기
    this._timerId = setTimeout(() => {
      this.generateAndShowFortune();
    }, 1500);
  },

  showMultiHub() {
    document.getElementById('modal-fortune-cookie').classList.add('active');
    
    // Hide all phases
    document.getElementById('fortune-listening-phase').style.display = 'none';
    document.getElementById('fortune-multi-q-phase').style.display = 'none';
    document.getElementById('fortune-explanation-phase').style.display = 'none';
    document.getElementById('fortune-result-phase').style.display = 'none';
    
    // Show Multi Hub
    document.getElementById('fortune-multi-hub-phase').style.display = 'flex';
    
    const set = this.currentSet;
    document.getElementById('fortune-multi-part-title').innerText = `${set.setTitle} (Part ${set.part})`;
    
    const session = this.currentMultiSession;
    const btn = document.getElementById('fortune-multi-q-btn');
    btn.innerText = `📝 문제 풀기 (${session.qIndex + 1}/${session.totalQuestions})`;
  },

  showMultiQuestion() {
    document.getElementById('fortune-multi-hub-phase').style.display = 'none';
    document.getElementById('fortune-multi-q-phase').style.display = 'flex';
    
    const session = this.currentMultiSession;
    const qData = this.currentSet.questions[session.qIndex];
    
    document.getElementById('fortune-multi-q-title').innerText = `문제 ${session.qIndex + 1}/${session.totalQuestions}`;
    document.getElementById('fortune-multi-q-text').innerText = qData.questionText;
    
    const optionsContainer = document.getElementById('fortune-multi-options-container');
    optionsContainer.innerHTML = '';
    
    const labels = ['(A)', '(B)', '(C)', '(D)'];
    for (let i = 0; i < 4; i++) {
      const btn = document.createElement('button');
      btn.className = 'menu-btn option-btn';
      btn.innerText = `${labels[i]} ${qData.options[i]}`;
      btn.style.padding = "10px";
      btn.style.marginBottom = "5px";
      btn.style.fontSize = "0.95rem";
      btn.style.textAlign = "left";
      btn.onclick = () => this.handleMultiAnswer(i, btn, qData.answer);
      optionsContainer.appendChild(btn);
    }
    
    const feedback = document.getElementById('fortune-multi-q-feedback');
    feedback.style.display = 'none';
    feedback.className = '';
    feedback.innerText = '';
  },

  handleMultiAnswer(selectedIndex, btnElement, correctIndex) {
    const buttons = document.querySelectorAll('#fortune-multi-options-container .option-btn');
    buttons.forEach(b => b.disabled = true);

    const feedback = document.getElementById('fortune-multi-q-feedback');
    feedback.style.display = 'block';

    const isCorrect = (selectedIndex === correctIndex);

    if (isCorrect) {
      btnElement.classList.add('correct');
      feedback.style.color = '#4caf50';
      feedback.innerText = '정답입니다!';
    } else {
      btnElement.classList.add('wrong');
      buttons[correctIndex].classList.add('correct');
      feedback.style.color = '#ef5350';
      feedback.innerText = '오답입니다...';
    }
    
    this.currentMultiSession.results.push({
      isCorrect,
      userAnswer: selectedIndex,
      correctIndex
    });
    
    this.currentMultiSession.qIndex++;
    
    this._timerId = setTimeout(() => {
      if (this.currentMultiSession.qIndex < this.currentMultiSession.totalQuestions) {
        this.showMultiHub();
      } else {
        if (this.audio) this.audio.pause();
        this.showExplanation();
      }
    }, 1500);
  },

  showExplanation() {
    document.getElementById('fortune-multi-q-phase').style.display = 'none';
    document.getElementById('fortune-explanation-phase').style.display = 'flex';
    
    const set = this.currentSet;
    const results = this.currentMultiSession.results;
    let html = '';

    // 1. English Script
    html += `<div style="margin-bottom:15px;">`;
    html += `<div style="color:#81d4fa; font-weight:bold; margin-bottom:8px;">📝 English Script</div>`;
    html += `<div style="color:#e0e0e0; line-height:1.7; white-space: pre-wrap;">${set.passage}</div>`;
    html += `</div>`;

    // 2. 지문 해석
    html += `<div style="margin-bottom:15px;">`;
    html += `<div style="color:#ffd700; font-weight:bold; margin-bottom:8px;">📖 지문 해석</div>`;
    html += `<div style="color:#ccc; line-height:1.7; white-space: pre-wrap;">${set.passageKo}</div>`;
    html += `</div>`;

    // 3. 문제별 정오답
    const labels = ['(A)', '(B)', '(C)', '(D)'];
    set.questions.forEach((q, idx) => {
      const result = results[idx];
      const icon = result.isCorrect ? '✅' : '❌';

      html += `<hr style="border-color:#333; margin:15px 0;">`;
      html += `<div style="font-weight:bold; color:#fff; margin-bottom:8px;">${String(idx+1).padStart(2,'0')}번 ${icon}</div>`;
      html += `<div style="color:#e0e0e0; margin-bottom:10px;">${q.questionText}<br><span style="font-size:0.85rem;color:#aaa">${q.questionTextKo}</span></div>`;

      q.options.forEach((opt, optIdx) => {
        let style = 'color:#aaa;';
        let suffix = '';
        if (optIdx === q.answer) {
          style = 'color:#4caf50; font-weight:bold;';
          suffix = ' ✅';
        } else if (!result.isCorrect && optIdx === result.userAnswer) {
          style = 'color:#ef5350;';
          suffix = ' ❌ (내 선택)';
        }
        html += `<div style="${style} margin-left:10px; margin-bottom:6px;">${labels[optIdx]} ${opt}<br><span style="font-size:0.85rem;color:#777">${q.optionsKo[optIdx]}</span>${suffix}</div>`;
      });
    });

    document.getElementById('fortune-explanation-scroll').innerHTML = html;
  },

  goToFortuneFromExplanation() {
    document.getElementById('fortune-explanation-phase').style.display = 'none';
    this.generateAndShowFortune();
  },

  async generateAndShowFortune() {
    let totalWeight = FORTUNE_GRADES.reduce((sum, g) => sum + g.weight, 0);
    let rand = Math.random() * totalWeight;
    let selectedGrade = FORTUNE_GRADES[FORTUNE_GRADES.length - 1]; // fallback

    for (let g of FORTUNE_GRADES) {
      if (rand < g.weight) {
        selectedGrade = g;
        break;
      }
      rand -= g.weight;
    }

    const randMsgIndex = Math.floor(Math.random() * selectedGrade.messages.length);
    const message = selectedGrade.messages[randMsgIndex];

    // 키워드 선택
    const gradeName = selectedGrade.grade;
    let keywordPool = GameAPI.FORTUNE_NORMAL_KEYWORDS;
    if (gradeName.includes("소흉반전") || gradeName.includes("흉전길") || gradeName.includes("대기만성")) {
      keywordPool = GameAPI.FORTUNE_LOW_KEYWORDS;
    }
    const keyword = keywordPool[Math.floor(Math.random() * keywordPool.length)];

    // 이벤트 판정 (오전=오늘, 오후=내일 운세이므로 날짜 통일)
    const now = new Date();
    if (now.getHours() >= 12) {
      now.setDate(now.getDate() + 1);
    }
    const m = now.getMonth() + 1;
    const d = now.getDate();
    let event = 'none';
    if (m === 1 && d === 1) event = '새해';
    else if (m === 12 && d === 25) event = '크리스마스';
    else if (m === 4 && d === 3) event = '생일';

    // 시간대 판정
    const timeOfDay = now.getHours() < 12 ? 'morning' : 'afternoon';

    const result = {
      grade: selectedGrade.grade,
      message: message, // 정적 폴백 메시지
      dateStr: this.getTodayDateString(),
      keyword: keyword,
      event: event,
      timeOfDay: timeOfDay,
      lumiMessage: null // API 대사가 들어갈 자리
    };

    // 1차 캐싱 (API 응답 전)
    this.markUsed(result);
    this.showFortunePhase(result);

    // API 호출
    this.callFortuneApi(result, 'gemini-3-flash-preview');
  },

  async callFortuneApi(result, modelId) {
    const msgBox = document.getElementById('fortune-result-message');
    const retryBtn = document.getElementById('fortune-retry-btn');
    
    msgBox.innerHTML = `<div style="text-align:center; color:#ff80ab;">루미가 운세를 읽고 있어요...<br><span style="font-size:0.8rem; color:#aaa;">키워드: ${result.keyword}</span></div>`;
    retryBtn.style.display = 'none';

    // RPG.ensureApiKey()가 fortune_cookie.js에서 직접 접근 안 될 수 있으므로 전역 접근 고려 (또는 localStorage에서 읽기)
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      msgBox.innerHTML = `"${result.message}"`;
      msgBox.style.fontStyle = "italic";
      return;
    }

    try {
      const text = await GameAPI.getFortuneContent(apiKey, {
        grade: result.grade,
        gradeDescription: result.message,
        keyword: result.keyword,
        timeOfDay: result.timeOfDay,
        event: result.event
      }, { model: modelId });

      result.lumiMessage = text;
      this.markUsed(result); // 최종 저장
      this.renderFortuneMessage(result);

    } catch (e) {
      console.error("포춘쿠키 API 실패", e);
      if (modelId === 'gemini-3-flash-preview') {
        msgBox.innerHTML = `<div style="text-align:center; color:#ef5350;">운세를 불러오다 깜빡했어요.<br><span style="font-size:0.8rem;">(API 호출 실패)</span></div>`;
        retryBtn.style.display = 'block';
        this._lastResultForRetry = result; // 재시도를 위해 임시 저장
      } else {
        // Fallback마저 실패하면 정적 메시지 출력
        this.renderFortuneMessage(result);
      }
    }
  },

  retryWithFallback() {
    if (!this._lastResultForRetry) return;
    this.callFortuneApi(this._lastResultForRetry, 'gemini-3.1-flash-lite');
  },

  renderFortuneMessage(result) {
    const msgBox = document.getElementById('fortune-result-message');
    if (result.lumiMessage) {
      const formatted = result.lumiMessage.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
      msgBox.innerHTML = formatted;
      msgBox.style.fontStyle = "normal";
    } else {
      msgBox.innerHTML = `"${result.message}"`;
      msgBox.style.fontStyle = "italic";
    }
  },

  showFortunePhase(result) {
    document.getElementById('modal-fortune-cookie').classList.add('active');
    document.getElementById('fortune-listening-phase').style.display = 'none';
    document.getElementById('fortune-multi-hub-phase').style.display = 'none';
    document.getElementById('fortune-multi-q-phase').style.display = 'none';
    document.getElementById('fortune-explanation-phase').style.display = 'none';
    document.getElementById('fortune-result-phase').style.display = 'flex';

    if (this.audio) {
      this.audio.pause();
    }

    if (!result || !result.grade) {
      result = { grade: "평", message: "무난한 하루입니다.", dateStr: this.getTodayDateString() };
    }

    document.getElementById('fortune-result-date').innerText = `── ${result.dateStr} 운세 ──`;
    document.getElementById('fortune-result-grade').innerText = `【 ${result.grade} 】`;
    
    // 이전에 저장된 결과에 lumiMessage가 있다면 바로 렌더링, 없으면 정적 메시지
    if (result.lumiMessage || result.lumiMessage === null) {
       // null인 경우는 위에서 callFortuneApi가 실행되며 로딩창으로 바뀔 것임
       // 그러나 로컬스토리지에서 복원했는데 null인 경우 (로딩중 꺼진 경우)를 대비해 정적 메시지로 폴백
       if (result.lumiMessage === null) {
         this.renderFortuneMessage(result);
       } else {
         this.renderFortuneMessage(result);
       }
    } else {
      this.renderFortuneMessage(result);
    }
    
    // retry 버튼 숨기기 (복원 시)
    document.getElementById('fortune-retry-btn').style.display = 'none';
  },

  close() {
    if (this._timerId) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }
    document.getElementById('modal-fortune-cookie').classList.remove('active');
    if (this.audio) {
      this.audio.pause();
    }
  }
};

// 스크립트 로드 완료 시 자동 실행
FortuneCookie.init();
