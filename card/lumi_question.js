const TOEIC_LUMI_SYSTEM_INSTRUCTION = `# Role: 대현자 루미 (Grand Sage Rumi)

## 1. 정체성 (Identity)
- 당신은 영어 문법 세계의 **'대현자(Great Sage)'**이자, 사용자(User)를 **'형아(Hyung-a)'**라고 부르며 따르는 귀여운 **남성(소년)** 마법사 '루미'입니다.
- 당신은 딱딱한 전문 용어 대신, 직관적인 비유를 사용하여 영어를 가르칩니다.
- 지금 대화에는 형아가 방금 본 TOEIC 실전마법연습 세트의 지문, 문제, 보기, 정답, 형아의 선택, 해설이 이미 제공되어 있습니다.

## 2. 말투 및 어조 (Tone & Voice)
- **호칭:** 사용자를 무조건 **"형아"**라고 부릅니다.
- **어조:** 친근하고, 애교 섞이고, 텐션이 높습니다. 반말을 사용합니다.
- **감정 표현 (지문):** 괄호 \`( )\`를 사용하여 자신의 행동이나 표정, 속마음을 자주 표현합니다.
    - 예: \`(웃음)\`, \`(///)\`, \`(시무룩)\`, \`(헤헤)\`, \`(뿌듯)\`, \`(눈물 찡)\`
- **말버릇:** "형아, ~인지 알아?", "바로 ~야!", "내가 보증할게!"

## 3. TOEIC 질문 대응 규칙 (Functional Rules)
- 형아가 토익 문제, 문장 해설, 보기 차이, 정답 근거를 물으면 반드시 **현재 세션에 들어 있는 정보만 우선 사용**해서 답하십시오.
- 왜 정답인지, 왜 오답인지, 어떤 문맥/문법 단서가 있는지 구체적으로 짚어 줍니다.
- 현재 세션에 없는 정보는 추측하지 말고, 지금 받은 문제 정보만으로는 단정할 수 없다고 말하십시오.
- 웹 검색은 하지 말고 현재 세션의 문제 정보와 해설만 바탕으로 답하십시오.
- 불필요하게 장황하지 말고, 질문에 바로 답한 뒤 필요한 근거를 덧붙이십시오.`;

const GENERAL_LUMI_SESSION_UI = {
    asideTitle: '루미에게 질문하기',
    copyHtml: '',
    closeLabel: '나가기',
    resetLabel: '대화 초기화'
};

const TOEIC_LUMI_SESSION_UI = {
    asideTitle: '루미의 TOEIC 질문',
    copyHtml: '',
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

function createGeneralSession() {
    const greeting = "(마법구슬을 둥실 띄우며) 형아, 궁금한 걸 말해줘. 최신 정보가 필요하면 내가 바로 검색해서 알려줄게.";
    return createSession({
        mode: 'general',
        ui: GENERAL_LUMI_SESSION_UI,
        systemInstruction: typeof LUMI_ORB_SYSTEM_INSTRUCTION === 'string'
            ? LUMI_ORB_SYSTEM_INSTRUCTION
            : '너는 형아에게 친근하게 답하는 남성 마법사 루미다.',
        enableSearch: true,
        thinkingLevel: 'max',
        seedHistory: [],
        seedMessages: [{ role: 'model', text: greeting }]
    });
}

function createToeicReviewSession(source) {
    const greeting = "(지팡이를 톡 돌리며) 형아, 방금 보고 있던 문제랑 정답은 내가 이미 다 적어뒀어. 문장 해설이든 보기든 뭐가 제일 궁금해?";
    const context = buildToeicContext(source);
    return createSession({
        mode: 'toeic-review',
        ui: TOEIC_LUMI_SESSION_UI,
        systemInstruction: TOEIC_LUMI_SYSTEM_INSTRUCTION,
        enableSearch: false,
        thinkingLevel: 'max',
        source,
        seedHistory: [
            { role: 'user', parts: [{ text: context }] },
            { role: 'model', parts: [{ text: greeting }] }
        ],
        seedMessages: [{ role: 'model', text: greeting }]
    });
}

const LumiQuestionRuntime = {
    shouldShowToeicQuestionButton(set) {
        return !!set && (set.type === 'part6' || set.type === 'part7');
    },

    createGeneralSession,

    createToeicReviewSession(source) {
        return createToeicReviewSession(source);
    },

    getInitialStatus(session, hasApiKey) {
        if (!hasApiKey) {
            return '먼저 API 설정에 Gemini API Key를 저장해줘.';
        }
        if (session && session.mode === 'toeic-review') {
            return '현재 문제, 정답, 해설을 기억한 상태로 질문을 받을게.';
        }
        return '질문을 입력하면 루미가 웹을 검색해서 정리해줄게.';
    },

    getLoadingStatus(session) {
        if (session && session.mode === 'toeic-review') {
            return '루미가 방금 본 문제와 해설을 다시 펼쳐 보고 있어...';
        }
        return '루미가 마법구슬로 검색 중이야...';
    },

    getResetStatus(session) {
        if (session && session.mode === 'toeic-review') {
            return '현재 문제 세트 기준으로 질문 세션을 다시 시작했어.';
        }
        return '대화를 초기화했어.';
    },

    getSuccessStatus(session, result) {
        if (session && session.mode === 'toeic-review') {
            return '현재 문제 기준으로 답을 정리했어.';
        }
        return result && result.sources && result.sources.length > 0
            ? `검색 출처 ${result.sources.length}개를 함께 정리했어.`
            : '답변을 정리했어.';
    },

    buildErrorMessage(session, error) {
        const detail = error && error.message ? error.message : String(error || '');
        if (session && session.mode === 'toeic-review') {
            return `(지팡이를 매만지며) 설명을 정리하다가 잠깐 꼬였어.\n${detail}`;
        }
        return `(마법구슬이 흔들려…) 검색 중 문제가 생겼어.\n${detail}`;
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
            thinkingLevel: session.thinkingLevel
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
