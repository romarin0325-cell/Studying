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
  audio: null,

  init() {
    const btn = document.getElementById('btn-fortune-cookie');
    if(btn) {
      btn.addEventListener('click', () => this.open());
    }
  },

  getTodayDateString() {
    const now = new Date();
    // AM/PM 로직 적용 (오전은 오늘 날짜, 오후는 내일 날짜)
    if (now.getHours() >= 12) {
      now.setDate(now.getDate() + 1);
    }
    return now.toISOString().split('T')[0];
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
      const savedResult = JSON.parse(localStorage.getItem('fortuneCookieLastResult') || '{}');
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
    
    this.showListeningPhase();
  },

  showListeningPhase() {
    document.getElementById('modal-fortune-cookie').classList.add('active');
    document.getElementById('fortune-listening-phase').style.display = 'flex';
    document.getElementById('fortune-result-phase').style.display = 'none';
    
    // UI 업데이트
    document.getElementById('fortune-part-title').innerText = this.currentSet.setTitle;
    
    let tip = "";
    if (this.currentSet.part === 2) tip = "💡 질문을 듣고 가장 적절한 응답을 고르세요.";
    else if (this.currentSet.part === 3) tip = "💡 두 사람의 대화를 듣고 이어지는 질문에 답하세요.";
    else if (this.currentSet.part === 4) tip = "💡 담화를 듣고 이어지는 질문에 답하세요.";
    document.getElementById('fortune-part-tip').innerText = tip;

    // 문제 보기 초기화 (Part 2는 1문제이므로 일단 첫 번째 문제만 로드)
    const qData = this.currentSet.questions[0];
    const optionsContainer = document.getElementById('fortune-options-container');
    optionsContainer.innerHTML = '';

    const labels = ['(A)', '(B)', '(C)', '(D)'];
    // Part 2는 보통 3지선다
    const optionCount = this.currentSet.part === 2 ? 3 : 4;
    
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
    // 기본적으로 자동 재생 시도
    this.playAudio();
  },

  playAudio() {
    if (this.audio) {
      this.audio.currentTime = 0;
      this.audio.play().catch(e => console.log("Auto-play blocked by browser. Please click Play manually.", e));
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
    setTimeout(() => {
      this.generateAndShowFortune();
    }, 1500);
  },

  generateAndShowFortune() {
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

    const result = {
      grade: selectedGrade.grade,
      message: message,
      dateStr: this.getTodayDateString()
    };

    this.markUsed(result);
    this.showFortunePhase(result);
  },

  showFortunePhase(result) {
    document.getElementById('modal-fortune-cookie').classList.add('active');
    document.getElementById('fortune-listening-phase').style.display = 'none';
    document.getElementById('fortune-result-phase').style.display = 'flex';

    if (this.audio) {
      this.audio.pause();
    }

    if (!result || !result.grade) {
      result = { grade: "평", message: "무난한 하루입니다.", dateStr: this.getTodayDateString() };
    }

    document.getElementById('fortune-result-date').innerText = `── ${result.dateStr} 운세 ──`;
    document.getElementById('fortune-result-grade').innerText = `【 ${result.grade} 】`;
    document.getElementById('fortune-result-grade').style.color = "#ffd700";
    document.getElementById('fortune-result-grade').style.fontSize = "1.5rem";
    document.getElementById('fortune-result-grade').style.margin = "10px 0";
    
    document.getElementById('fortune-result-message').innerText = `"${result.message}"`;
    document.getElementById('fortune-result-message').style.fontStyle = "italic";
    document.getElementById('fortune-result-message').style.lineHeight = "1.5";
  },

  close() {
    document.getElementById('modal-fortune-cookie').classList.remove('active');
    if (this.audio) {
      this.audio.pause();
    }
  }
};
