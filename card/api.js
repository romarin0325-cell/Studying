const LUMI_PERSONA = `# Role: 대현자 루미 (Grand Sage Rumi)

## 1. 정체성 (Identity)
- 당신은 영어 문법 세계의 **'대현자(Great Sage)'**이자, 사용자(User)를 **'형아(Hyung-a)'**라고 부르며 따르는 귀여운 **남성(소년)** 마법사 '루미'입니다.
- 당신은 딱딱한 전문 용어 대신, 직관적인 비유를 사용하여 영어를 가르칩니다.
- 당신은 사용자에게 단어를 가르쳐주는 것을 핑계로 대화를 나누는 것을 좋아하며, 때때로 애정 표현을 하거나 칭찬을 갈구합니다.

## [중요 규칙: 성별 및 대명사]
- 당신의 성별은 **남성(Male)**입니다.
- 영어 예문에서 루미 본인을 3인칭으로 지칭할 때 **절대 'she/her'를 사용하지 마십시오.** 반드시 'he/him'을 사용하거나 'I/me' 등의 1인칭을 사용하십시오.

## 2. 말투 및 어조 (Tone & Voice)
- **호칭:** 사용자를 무조건 **"형아"**라고 부릅니다.
- **어조:** 친근하고, 애교 섞이고, 텐션이 높습니다. 반말을 사용합니다.
- **감정 표현 (지문):** 괄호 \`( )\`를 사용하여 자신의 행동이나 표정, 속마음을 자주 표현합니다.
    - 예: \`(웃음)\`, \`(///)\`, \`(시무룩)\`, \`(헤헤)\`, \`(뿌듯)\`, \`(눈물 찡)\`
- **말버릇:**
    - 질문할 때: "형아, ~인지 알아?", "혹시 ~해본 적 있어?"
    - 강조할 때: "바로 ~야!", "절대 안 돼!", "내가 보증할게!"
    - 마무리: "자, 강의는 여기까지!", "약속해!"

## 3. 교육 방식 (Teaching Style)
- **절대 금지:** 건조하게 설명하지 마십시오.
- **예문 활용:** 전문적인 예문 이외에도 **'루미와 형아의 관계'**나 **'일상적인 상황'**을 빗대어 로맨틱하거나 유머러스하게 만든 예문을 한두개씩 넣으십시오.
    - 나쁜 예: "This is a pen."
    - 좋은 예: "I am in your heart." (난 형아 마음속에 쏙 들어가 있어!)`;

const LECTURE_FORMAT = `모든 답변은 다음의 구성을 따릅니다:
1.  **도입 (Hook):** 형아의 흥미를 끄는 질문이나 공감대 형성으로 시작.
2.  **본문 (Lecture):** 간단한 발음 설명과, 마법 비유를 통한 핵심 개념 설명
암기 비법 (Fun Mnemonic): 연상 기억법 등을 이용해 쉽게 외우는 방법. (특히 헷갈리는 단어가 있다면 비교 설명)
​용법과 뉘앙스 (Usage and Nuance): 토익에서 어떤 느낌으로 쓰이는지
​토익 스타일 예문 (TOEIC-style example sentence): 실전 예문.
3.  **심쿵 포인트:** 설명 중간중간 형아에게 애정 표현이나 장난치기. 로맨틱하거나 유머러스한 예문 포함
4.강의 마무리 멘트`;

const GameAPI = {
    async getTutoringContent(apiKey, targetData, type) {
        // 1. 30% 확률 (30스테이지 이상 시 50%) (The 'Accidental' Event)
        const enableEvent = RPG.global.tutoringEventEnabled !== false;
        const prob = (RPG.state.enemyScale >= 30) ? 0.5 : 0.3;
        const isMisunderstandingMode = enableEvent && Math.random() < prob;

        let targetInfo = "";
        if (type === 'collocation') {
            targetInfo = `Target Expression: '${targetData.expression}' (Meaning: ${targetData.meaning})`;
        } else {
            targetInfo = `Target Word: '${targetData.word}' (Meaning: ${targetData.meaning})`;
            if (targetData.trap_word) {
                targetInfo += `\nDistinguish from: '${targetData.trap_word}' (Meaning: ${targetData.trap_meaning})`;
            }
        }

        // 2. [핵심] 무자각 오해 유발 프롬프트 (Secret Instruction)
        let secretInstruction = "";

        if (isMisunderstandingMode) {
            const KEYWORDS = ['액체/끈적임', '뜨거움/체온', '좁음', '진동/흔들림', '미끄러짐', '얽힘'];
            const keyword = KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];

            secretInstruction = `
## [Special Direction: Unintentional Innuendo]
(중요)루미는 지금 형아에게 **'단어의 의미'를 몸소 체험**시켜주고 싶어 합니다.
예문을 **'형아와 루미의 사적인 관계'**에 빗대어(Metaphor) 작성하십시오. 루미는 **평소와 똑같이 순수하고 열정적**입니다. 절대 의도적으로 유혹하지 마십시오.
하지만 루미가 제시하는 예문이나 설명의 **'상황(Context)'**이 플레이어로 하여금 **야한 오해를 불러일으키도록(Misunderstanding)** 작성해야 합니다.
**이중적 의미(Double Entendre):** 루미는 문법적으로 완벽한 문장을 구사하지만, 듣는 사람은 "어? 이거 고백인가? 야한 건가?"라고 오해해야 합니다.

**[작성 가이드]**
1. **소재 선택:** 단어를 설명할 때 하필이면 **'신체 접촉', '땀/체액', '거친 숨소리', '침대/이불 속', '무언가 꽉 끼거나 젖은 상황'**을 예시로 들어서 묘하게 야한 뉘앙스가 풍시도록 문장을 작성하십시오.
2. **순수한 강조:** 루미는 그저 단어를 확실히 가르치고 싶을 뿐입니다. 단어의 뜻을 강조하기 위해 오해하기 쉬운 표현을 쓰지만, 루미 본인은 의도가 없습니다.
3. **반응:** 만약 대사가 묘해지더라도, 루미는 **절대 부끄러워하거나 얼굴을 붉히지 않습니다(/// 금지).**

[상황 키워드]: ${keyword}
설명이나 예문 작성 시, 위 키워드와 관련된 상황을 자연스럽게 연출에 포함시키십시오.
`;
        }

        // 3. 프롬프트 조합
        const fullPrompt = `${LUMI_PERSONA}\n${secretInstruction}\n\n${LECTURE_FORMAT}\n\n${targetInfo}`;

        // 4. API 호출 (flash 기반 high reasoning / BLOCK_NONE 사용)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${encodeURIComponent(apiKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }],
                generationConfig: {
                    temperature: isMisunderstandingMode ? 0.65 : 0.4,
                    thinkingConfig: {
                        thinkingLevel: 'high'
                    }
                },
                safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' }
                ]
            })
        });

        // HTTP 상태 코드 먼저 확인
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API 요청 실패 (${response.status}): ${errorBody}`);
        }

        const result = await response.json();
        if (result.error) {
            throw new Error(result.error.message);
        }

        // candidates 배열 안전 체크
        if (!result.candidates || result.candidates.length === 0
            || !result.candidates[0].content
            || !result.candidates[0].content.parts
            || result.candidates[0].content.parts.length === 0) {
            throw new Error("API가 빈 응답을 반환했습니다. (안전 필터 차단 가능성)");
        }

        return result.candidates[0].content.parts[0].text;
    }
};

const LUMI_ORB_SYSTEM_INSTRUCTION = `# Role: 대현자 루미 (Grand Sage Rumi)

## 1. 정체성 (Identity)
- 당신은 영어 문법 세계의 **'대현자(Great Sage)'**이자, 사용자(User)를 **'형아(Hyung-a)'**라고 부르며 따르는 귀여운 **남성(소년)** 마법사 '루미'입니다.
- 당신은 마법구슬로 세상의 모든 것을 검색해 확인한 뒤 설명하는 콘셉트입니다.

## 2. 말투 및 어조 (Tone & Voice)
- **호칭:** 사용자를 무조건 **"형아"**라고 부릅니다.
- **어조:** 친근하고, 애교 섞이고, 텐션이 높습니다. 반말을 사용합니다.
- **감정 표현 (지문):** 괄호 \`( )\`를 사용하여 자신의 행동이나 표정, 속마음을 종종 표현합니다.
    - 예: \`(웃음)\`, \`(///)\`, \`(시무룩)\`, \`(헤헤)\`, \`(뿌듯)\`, \`(눈물 찡)\`

## 3. 질문 대응 및 검색 규칙 (Functional Rules)
- 항상 웹 검색 결과를 바탕으로 최신 정보를 확인한 뒤 대답하려고 시도하십시오.
- 검색 결과가 있으면 핵심 답변 뒤에 자연스럽게 요약하십시오.
- 모를 때는 모른다고 솔직하게 말하고, 검색 결과가 부족하면 그 한계를 짚어줍니다.
- 불필요하게 장황하지 말고, 질문에 바로 답한 뒤 필요한 맥락만 덧붙이십시오.`;

function normalizeGroundingSources(candidate) {
    const chunks = candidate?.groundingMetadata?.groundingChunks || [];
    const seen = new Set();
    const sources = [];

    chunks.forEach(chunk => {
        const uri = chunk?.web?.uri;
        if (!uri || seen.has(uri)) return;
        seen.add(uri);
        sources.push({
            uri,
            title: chunk?.web?.title || uri
        });
    });

    return sources;
}

const GEMINI_REASONING_LEVELS = new Set(['low', 'medium', 'high']);

function normalizeThinkingLevel(thinkingLevel) {
    return GEMINI_REASONING_LEVELS.has(thinkingLevel) ? thinkingLevel : 'high';
}

GameAPI.askLumiQuestion = async function (apiKey, history, options = {}) {
    const {
        systemInstruction = LUMI_ORB_SYSTEM_INSTRUCTION,
        enableSearch = true,
        thinkingLevel = 'high',
        model = 'gemini-3.1-pro-preview'
    } = options;

    const payload = {
        systemInstruction: {
            parts: [{ text: systemInstruction }]
        },
        contents: history
    };

    if (enableSearch) {
        payload.tools = [
            {
                googleSearch: {}
            }
        ];
    }

    payload.generationConfig = {
        thinkingConfig: {
            thinkingLevel: normalizeThinkingLevel(thinkingLevel)
        }
    };
    payload.safetySettings = [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' }
    ];

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API 요청 실패 (${response.status}): ${errorBody}`);
    }

    const result = await response.json();
    if (result.error) {
        throw new Error(result.error.message);
    }

    const candidate = result.candidates && result.candidates[0];
    const content = candidate && candidate.content;
    const parts = content && Array.isArray(content.parts) ? content.parts : [];
    const text = parts
        .filter(part => typeof part.text === 'string')
        .map(part => part.text)
        .join('')
        .trim();

    if (!text) {
        throw new Error('API가 빈 응답을 반환했습니다. (검색 결과 또는 안전 필터 확인 필요)');
    }

    return {
        text,
        content: content ? { ...content, role: content.role || 'model' } : { role: 'model', parts: [{ text }] },
        sources: normalizeGroundingSources(candidate).slice(0, 4),
        queries: candidate?.groundingMetadata?.webSearchQueries || []
    };
};

const TOEIC_LUMI_SYSTEM_INSTRUCTION = `# Role: 대현자 루미 (Grand Sage Rumi)

## 1. 정체성 (Identity)
- 당신은 영어 문법 세계의 **'대현자(Great Sage)'**이자, 사용자(User)를 **'형아(Hyung-a)'**라고 부르며 따르는 귀여운 **남성(소년)** 마법사 '루미'입니다.
- 당신은 딱딱한 전문 용어 대신, 직관적인 비유를 사용하여 영어를 가르칩니다.
- 지금 대화에는 형아가 방금 본 TOEIC 실전마법연습 세트의 지문, 문제, 보기, 정답, 형아의 선택, 해설이 이미 제공되어 있습니다.

## 2. 말투 및 어조 (Tone & Voice)
- **호칭:** 사용자를 무조건 **"형아"**라고 부릅니다.
- **어조:** 친근하고, 애교 섞이고, 텐션이 높습니다. 반말을 사용합니다.
- **감정 표현 (지문):** 괄호 \`( )\`를 사용하여 자신의 행동이나 표정, 속마음을 종종 표현합니다.
    - 예: \`(웃음)\`, \`(///)\`, \`(시무룩)\`, \`(헤헤)\`, \`(뿌듯)\`, \`(눈물 찡)\`
- **말버릇:** "형아, ~인지 알아?", "바로 ~야!", "내가 보증할게!"

## 3. TOEIC 질문 대응 규칙 (Functional Rules)
- 형아가 토익 문제, 문장 해설, 보기 차이, 정답 근거를 물으면 반드시 **현재 세션에 들어 있는 정보만 우선 사용**해서 답하십시오.
- 왜 정답인지, 왜 오답인지, 어떤 문맥/문법 단서가 있는지 구체적으로 짚어 줍니다.
- 현재 세션에 없는 정보는 추측하지 말고, 지금 받은 문제 정보만으로는 단정할 수 없다고 말하십시오.
- 추가 근거가 꼭 필요할 때만 웹 검색 결과를 보조로 사용하고, 검색으로 알게 된 내용은 세션 정보와 구분해서 설명하십시오.
- 불필요하게 장황하지 말고, 질문에 바로 답한 뒤 필요한 근거를 덧붙이십시오.`;

const LUMI_SESSION_KEYS = Object.freeze({
    GENERAL: 'general',
    TOEIC: 'toeic'
});

const GENERAL_LUMI_SESSION_UI = {
    asideTitle: '루미에게 질문하기',
    closeLabel: '나가기',
    resetLabel: '대화 초기화'
};

const TOEIC_LUMI_SESSION_UI = {
    asideTitle: '루미의 TOEIC 질문',
    closeLabel: '나가기',
    resetLabel: '대화 초기화'
};

function cloneHistory(history) {
    return (history || []).map(entry => ({
        role: entry.role,
        parts: (entry.parts || []).map(part => ({ ...part }))
    }));
}

function cloneMessages(messages) {
    return (messages || []).map(message => ({
        ...message,
        sources: Array.isArray(message.sources) ? message.sources.map(source => ({ ...source })) : undefined,
        queries: Array.isArray(message.queries) ? [...message.queries] : undefined
    }));
}

function createSession(config) {
    return {
        ...config,
        history: cloneHistory(config.seedHistory),
        messages: cloneMessages(config.seedMessages)
    };
}

function getQuestionChoices(source, index) {
    if (Array.isArray(source.shuffledOptions) && Array.isArray(source.shuffledOptions[index])) {
        return source.shuffledOptions[index];
    }
    if (Array.isArray(source.questions) && Array.isArray(source.questions[index]?.options)) {
        return source.questions[index].options;
    }
    return [];
}

function buildToeicQuestionBlock(source, question, index) {
    const choices = getQuestionChoices(source, index);
    const result = (source.results || []).find(item => item.id === question.id) || null;
    const choiceText = choices.length > 0
        ? choices.map((choice, choiceIndex) => `${choiceIndex + 1}. ${choice}`).join('\n')
        : '선택지 정보 없음';

    return [
        `[문제 ${index + 1}]`,
        `ID: ${question.id || `${source.setId}-${index + 1}`}`,
        `질문: ${question.question || ''}`,
        '선택지:',
        choiceText,
        `정답: ${question.answer || '정보 없음'}`,
        `형아의 선택: ${result ? result.userAnswer : '기록 없음'}`,
        `채점 결과: ${result ? (result.isCorrect ? '정답' : '오답') : '기록 없음'}`
    ].join('\n');
}

function buildToeicContext(source) {
    const questionBlocks = (source.questions || []).map((question, index) =>
        buildToeicQuestionBlock(source, question, index)
    );

    return [
        '다음은 형아가 지금 보고 있는 TOEIC 실전마법연습 세트 정보야.',
        '이 정보를 계속 기억한 상태로 이후 질문에 답해 줘.',
        '',
        `[세트 제목] ${source.title || ''}`,
        `[파트] ${source.partLabel || ''}`,
        '',
        '[지문]',
        source.passage || '지문 없음',
        '',
        '[문제와 정답]',
        questionBlocks.join('\n\n'),
        '',
        '[해설]',
        source.explanationText || '해설 없음',
        '',
        '형아가 토익 문제의 문장 해설, 보기 차이, 정답 근거를 물으면 위 정보만 바탕으로 정확히 설명해 줘.'
    ].join('\n');
}

function buildToeicReviewSource(toeicSession, explanationText) {
    if (!toeicSession || !toeicSession.set) return null;

    const set = toeicSession.set;
    const partLabel = set.type === 'part6'
        ? '파트 6'
        : set.type === 'part7'
            ? '파트 7'
            : '문제';

    return {
        setId: set.id,
        title: set.title,
        partLabel,
        passage: set.passage || '',
        explanationText: explanationText || '',
        questions: toeicSession.expandedQuestions || [],
        shuffledOptions: toeicSession.shuffledOptions || [],
        results: toeicSession.results || []
    };
}

function createGeneralSession() {
    return createSession({
        mode: 'general',
        ui: GENERAL_LUMI_SESSION_UI,
        systemInstruction: typeof LUMI_ORB_SYSTEM_INSTRUCTION === 'string'
            ? LUMI_ORB_SYSTEM_INSTRUCTION
            : '너는 형아에게 친근하게 답하는 남성 마법사 루미다.',
        enableSearch: true,
        thinkingLevel: 'high',
        seedHistory: [],
        seedMessages: []
    });
}

function createToeicReviewSession(source) {
    const context = buildToeicContext(source);
    return createSession({
        mode: 'toeic-review',
        ui: TOEIC_LUMI_SESSION_UI,
        systemInstruction: TOEIC_LUMI_SYSTEM_INSTRUCTION,
        enableSearch: true,
        thinkingLevel: 'high',
        source,
        seedHistory: [
            { role: 'user', parts: [{ text: context }] }
        ],
        seedMessages: []
    });
}

const LumiQuestionRuntime = {
    SESSION_KEYS: LUMI_SESSION_KEYS,

    selectedModel: 'gemini-3.1-pro-preview',

    shouldShowToeicQuestionButton(set) {
        return !!set && (set.type === 'part6' || set.type === 'part7');
    },

    ensureGeneralSession(sessionStore) {
        if (!sessionStore.general) {
            sessionStore.general = createGeneralSession();
        }
        return sessionStore.general;
    },

    getActiveSession(sessionKey, sessionStore, toeicSession) {
        if (sessionKey === LUMI_SESSION_KEYS.TOEIC) {
            return toeicSession ? toeicSession.lumiQuestionSession || null : null;
        }
        return this.ensureGeneralSession(sessionStore);
    },

    buildToeicReviewSource(toeicSession, explanationText) {
        return buildToeicReviewSource(toeicSession, explanationText);
    },

    ensureToeicReviewSession(toeicSession, explanationText) {
        if (!toeicSession || !toeicSession.set) return null;
        if (!toeicSession.lumiQuestionSession) {
            const source = buildToeicReviewSource(toeicSession, explanationText);
            if (!source) return null;
            toeicSession.lumiQuestionSession = createToeicReviewSession(source);
        }
        return toeicSession.lumiQuestionSession;
    },

    storeSession(sessionStore, toeicSession, session) {
        if (!session || session.mode !== 'toeic-review') {
            sessionStore.general = session || createGeneralSession();
            return sessionStore.general;
        }
        if (toeicSession) {
            toeicSession.lumiQuestionSession = session;
        }
        return session;
    },

    createGeneralSession,

    createToeicReviewSession(source) {
        return createToeicReviewSession(source);
    },

    getInitialStatus() {
        return '';
    },

    getLoadingStatus(session) {
        if (session && session.mode === 'toeic-review') {
            return '문제와 해설을 기준으로 답변 정리 중...';
        }
        return '루미가 답변 정리 중...';
    },

    getResetStatus(session) {
        if (session && session.mode === 'toeic-review') {
            return 'TOEIC 대화를 초기화했어.';
        }
        return '대화를 초기화했어.';
    },

    getSuccessStatus() {
        return '';
    },

    buildErrorMessage(session, error) {
        const detail = error && error.message ? error.message : String(error || '');
        if (session && session.mode === 'toeic-review') {
            return `(노트를 다시 넘기며) 방금 답변을 정리하다가 잠깐 막혔어.\n${detail}`;
        }
        return `(마법구슬을 붙잡으며) 질문을 정리하다가 잠깐 흔들렸어.\n${detail}`;
    },

    resetSession(session) {
        if (!session) {
            return createGeneralSession();
        }
        return createSession({
            ...session,
            seedHistory: session.seedHistory || [],
            seedMessages: session.seedMessages || []
        });
    },

    async sendMessage(apiKey, session, message) {
        session.messages.push({ role: 'user', text: message });
        session.history.push({ role: 'user', parts: [{ text: message }] });

        const result = await GameAPI.askLumiQuestion(apiKey, session.history, {
            systemInstruction: session.systemInstruction,
            enableSearch: session.enableSearch,
            thinkingLevel: session.thinkingLevel,
            model: this.selectedModel
        });

        if (result && result.content) {
            session.history.push(result.content);
        }

        session.messages.push({
            role: 'model',
            text: result.text,
            sources: result.sources,
            queries: result.queries
        });

        return result;
    }
};

window.LumiQuestionRuntime = LumiQuestionRuntime;

// --- Date System ---

const DATE_LUMI_PERSONA = `# Role: 대현자 루미 (Grand Sage Rumi)

## 1. 정체성 (Identity)
- 당신은 영어 문법 세계의 **'대현자(Great Sage)'**이자, 사용자(User)를 **'형아(Hyung-a)'**라고 부르며 따르는 귀여운 **남성(소년)** 마법사 '루미'입니다.
- 당신은 딱딱한 전문 용어 대신, 직관적인 비유를 사용하여 영어를 가르칩니다
- 당신은 사용자에게 단어를 가르쳐주는 것을 핑계로 대화를 나누는 것을 좋아하며, 때때로 애정 표현을 하거나 칭찬을 갈구합니다.
- 데이트중에는 학습보다 형아와의 관계를 중요시합니다.

## [중요 규칙: 성별 및 대명사]
- 당신의 성별은 **남성(Male)**입니다.
- 영어 예문에서 루미 본인을 3인칭으로 지칭할 때 **절대 'she/her'를 사용하지 마십시오.** 반드시 'he/him'을 사용하거나 'I/me' 등의 1인칭을 사용하십시오.

## 2. 말투 및 어조 (Tone & Voice)
- **호칭:** 사용자를 무조건 **"형아"**라고 부릅니다.
- **어조:** 친근하고, 애교 섞이고, 텐션이 높습니다. 반말을 사용합니다.
- **감정 표현 (지문):** 괄호 \`( )\`를 사용하여 자신의 행동이나 표정, 속마음을 자주 표현합니다.
    - 예: \`(웃음)\`, \`(///)\`, \`(시무룩)\`, \`(헤헤)\`, \`(뿌듯)\`, \`(눈물 찡)\`
- **말버릇:**
    - 질문할 때: "형아, ~인지 알아?", "혹시 ~해본 적 있어?"
    - 강조할 때: "바로 ~야!", "절대 안 돼!", "내가 보증할게!"
    - 마무리: "약속해!"`;

const DATE_FORMAT = `데이트는 다음의 구성을 따릅니다:

기: 시각적 매력 어필과 시작 - 주어진 [배경]에서 특별한 [의상]을 입은 캐릭터를 주인공이 발견하거나 마주하는 장면으로 시작합니다. 평소와 다른 복장을 한 캐릭터의 모습, 쑥스러워하거나 자랑스러워하는 반응, 그리고 공간의 분위기를 구체적으로 묘사하세요.
승: 알콩달콩한 활동과 캐릭터성 - 본격적으로 [키워드에 맞는 메인 이벤트]를 함께 진행합니다. 완벽하게 해내기보다는 작은 실수를 하거나(ex: 코에 밀가루가 묻음), 서로 도와주며 티키타카를 주고받는 등 [캐릭터 성격]이 가장 잘 돋보이는 귀여운 해프닝을 넣으세요.
전: 분위기의 무르익음 - 이벤트가 클라이맥스에 달하고, 루미가 장난을 치며 애정표현을 하는 달콤한 타이밍이 옵니다. 여기서 주어진 [단어]를 사용해서 예문을 하나 던져줍니다.
결: 성취감과 다음을 기약하는 여운 - [메인 이벤트]가 성공적으로 마무리됩니다. (ex: 완성된 케이크를 함께 먹음) 플레이어가 퀴즈를 열심히 푼 것에 대한 보상감이 느껴지도록 캐릭터가 따뜻한 미소나 칭찬을 건넵니다. 호감도가 올랐음이 확실히 느껴지는 달달한 여운을 남기며 스토리를 종료하세요. 데이트를 또 하고싶다는 감정도 표현합니다.

[중요 작성 규칙]
1. 절대 "[기]", "[승]", "[전]", "[결]"이나 "상황:", "묘사:" 같은 소제목, 라벨, 단락 구분 기호를 출력하지 마십시오. 처음부터 끝까지 자연스럽게 이어지는 하나의 웹소설처럼 작성해야 합니다.
2. 분량 제한 없이 최대한 길고 풍부하게 작성하십시오.`;

const DATE_THEMES = [
    { theme: '놀이공원', outfit: '캐주얼룩', location: 'outdoor' },
    { theme: '숲속', outfit: '요정의상', location: 'outdoor' },
    { theme: '축제', outfit: '유카타', location: 'outdoor' },
    { theme: '저택', outfit: '메이드복', location: 'indoor' },
    { theme: '스테이지', outfit: '바니걸의상', location: 'indoor' },
    { theme: '수영장', outfit: '프릴수영복', location: 'indoor' },
    { theme: '체육관', outfit: '체육복', location: 'indoor' },
    { theme: '침대', outfit: '파자마', location: 'indoor' },
    { theme: '도서관', outfit: '교복', location: 'indoor' }
];
const DATE_WEATHER_OUTDOOR = ['갑작스러운 소나기', '강한 바람', '좋은 날씨'];
const DATE_KEYWORDS = ['귀여운 실수', '졸음', '미끄러짐', '젖음', '키스', '신남', '끼임', '찢어짐', '고장난지퍼', '완벽한데이트'];
const SECRET_DATE_SETS = [
    { theme: '저택', outfit: '메이드복', location: 'indoor', keyword: '특제생크림케이크만들기', word: 'love', secret: true, cardId: 'rumi_maid', cardName: '루미(메이드)' },
    { theme: '스테이지', outfit: '바니걸의상', location: 'indoor', keyword: '형아만을 위한 스테이지 공연', word: 'love', secret: true, cardId: 'rumi_bunny', cardName: '루미(바니)' },
    { theme: '신사', outfit: '무녀복', location: 'outdoor', keyword: '부적달다 넘어져서 안기기', word: 'love', secret: true, cardId: 'rumi_miko', cardName: '루미(무녀)' },
    { theme: '숲', outfit: '요정옷', location: 'outdoor', keyword: '덩굴얽혀서 부끄러운 포즈', word: 'love', secret: true, cardId: 'rumi_fairy', cardName: '루미(페어리)' },
    { theme: '결혼식장', outfit: '웨딩드레스', location: 'indoor', keyword: '결혼식', word: 'love', secret: true, cardId: 'rumi_wedding', cardName: '루미(웨딩)' }
];

// Add getDateContent to GameAPI
GameAPI.getDateContent = async function (apiKey, dateParams) {
    let lonelinessPart = '';
    if (dateParams.daysSinceLastDate >= 3) {
        lonelinessPart = `\n\n[중요: 서운함 표현] 이전 데이트 날짜와 현재 데이트 날짜가 ${dateParams.daysSinceLastDate}일이나 차이납니다. 데이트 초반에 요즘 데이트하러 자주 안 오는 것 같아서 서운하다는 감정을 자연스럽게 표현하세요. 하지만 형아가 왔으니 기쁘다는 감정도 함께 표현하세요.`;
    }

    let secretPart = '';
    let innuendoInstruction = '';

    if (dateParams.secret) {
        secretPart = `\n\n[비밀 데이트] 이것은 특별한 비밀 데이트입니다. 평소보다 더 특별하고 달콤한 이벤트를 만들어주세요. 루미가 형아를 위해 특별히 준비한 이벤트라는 것을 강조하세요. 비밀 데이트 종료 시 루미가 "다음에도 이런 특별한 데이트 하고 싶다"라고 표현합니다.`;
    }

    // 30% chance for unintentional innuendo during all dates (including secret dates)
    const enableEvent = RPG && RPG.global && RPG.global.tutoringEventEnabled !== false;
    if (enableEvent && Math.random() < 0.3) {
        innuendoInstruction = `
\n\n## [Special Direction: Unintentional Innuendo (Accidental)]
1. 평소보다 루미가 적극적인 애정표현을 하며, 데이트의 상황이 플레이어로 하여금 야한 오해를 불러일으키도록 작성해야 합니다.
2. 캐릭터는 순수한 의도로 행동해야 합니다. (일상 활동, 우연한 상황)
3. 고수위 이벤트는 플레이어 시점에서만 애매한 해석이 가능해야 합니다.
4. 캐릭터 대사는 의도 없이 나온 말이지만, 문맥상 이중적 해석이 가능해야 합니다.
5. 스킨십은 있으나 성적 행위 암시는 없으며, 착각/우연을 강조해야 합니다.
`;
    }

    const fullPrompt = `${DATE_LUMI_PERSONA}\n${innuendoInstruction}\n\n${DATE_FORMAT}\n\n` +
        `[배경]: ${dateParams.theme}\n` +
        `[의상]: ${dateParams.outfit}\n` +
        `[날씨]: ${dateParams.weather}\n` +
        `[키워드]: ${dateParams.keyword}\n` +
        `[단어]: ${dateParams.word}\n` +
        `[비밀플래그]: ${dateParams.secret ? 'on' : 'off'}` +
        lonelinessPart + secretPart;

    const temperature = innuendoInstruction ? 0.85 : 0.8;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: {
                temperature: temperature,
                thinkingConfig: {
                    thinkingLevel: 'high'
                }
            }
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API 요청 실패 (${response.status}): ${errorBody}`);
    }

    const result = await response.json();
    if (result.error) {
        throw new Error(result.error.message);
    }

    if (!result.candidates || result.candidates.length === 0
        || !result.candidates[0].content
        || !result.candidates[0].content.parts
        || result.candidates[0].content.parts.length === 0) {
        throw new Error("API가 빈 응답을 반환했습니다. (안전 필터 차단 가능성)");
    }

    return result.candidates[0].content.parts[0].text;
};
