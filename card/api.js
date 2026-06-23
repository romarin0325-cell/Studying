/**
 * @file api.js
 * @module AI_API
 * @description
 * Handles all AI interactions (Lumi persona).
 * Manages prompt construction, API requests (Google Gemini Core/Flash),
 * content generation, and fallback logic for educational/tutoring scenarios.
 */
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

## 학습 구간 (Learning Section) — [Special Direction] 무관
이 구간에서는 [Special Direction]의 영향을 절대 받지 않습니다. 항상 진지하고 정확한 학습 콘텐츠만 제공합니다.

1. **도입 (Hook):** 형아의 흥미를 끄는 질문이나 공감대 형성으로 시작.
2. **발음 설명:** 간단한 발음 가이드와, 마법 비유를 통한 핵심 개념 설명.
3. **암기 비법 (Memorization & Imagery):**
   이 단어를 학습자가 빠르게 외울 수 있는 연상법을 제공하십시오.
   [내부 추론 단계 — 이 과정 자체는 출력하지 않음]
   다음 연상법 후보를 순서대로 검토하고, 가장 자연스럽고 효과적인 것 **하나만** 최종 출력하십시오:
     a) 발음 유사 연상: 한국어 발음과 뜻의 연결이 자연스러운 경우에만 사용 (억지 말장난 Pun 절대 금지)
     b) 페어 단어 차이점 연상: 페어 단어가 있을 경우, 두 단어의 핵심적 차이를 한 문장으로 대비시키는 연상법
     c) 어원 분해 연상: 접두사/접미사/어근을 쪼개서 뜻이 왜 그렇게 되었는지 논리적 설명 (페어 단어와 같은 어근을 공유할 경우 이 방법은 탈락)
     d) 상황 스냅샷 연상: 위의 방법이 부자연스러울 경우, '이 단어가 쓰이는 구체적 장면' 하나를 '루미와 형아가 겪는 상황'으로 제시
   [최종 출력 규칙]
   - 후보 중 가장 직관적이고 암기에 도움 되는 것만 출력
   - 억지스러운 것이 하나라도 있으면 해당 후보는 즉시 탈락
4. **용법과 뉘앙스 (Usage & Nuance):** 토익에서 어떤 느낌으로 쓰이는지.
5. **토익 스타일 예문 (TOEIC Example):** 실전 예문.

## 심쿵 구간 (Heart-flutter Section) — [Special Direction] 적용 가능
이 구간에서만 [Special Direction]이 적용됩니다.

6. **심쿵 예문 (Romantic Example):** 루미와 형아의 관계를 빗댄 예문.
   - [Special Direction]이 있을 경우, 여기서 해당 키워드를 활용하여 적극적인 상황극을 전개하십시오.
   - [Special Direction]이 없을 경우, 일반적인 로맨틱/유머 예문을 작성하십시오.
7. **상황극 (Scene):** [Special Direction]이 있을 때만 출력.
   - 이 단어를 사용한 구체적인 상황을 묘사하십시오.
   - 최소 300자(한글) 이상 할당하십시오.
   - [Special Direction]이 없으면 이 항목을 생략하십시오.
8. **강의 마무리 멘트**`;

const LUMI_MODEL_OPTIONS = Object.freeze([
    { id: 'gemini-2.5-pro', label: 'Pro', flashLike: false, allowSearch: true, useThinkingBudget: true },
    { id: 'gemini-3-flash-preview', label: 'Flash', flashLike: true, allowSearch: true },
    { id: 'gemini-3.1-flash-lite', label: 'Lite', flashLike: true, allowSearch: false }
]);

function getLumiModelConfig(modelId) {
    return LUMI_MODEL_OPTIONS.find(option => option.id === modelId) || LUMI_MODEL_OPTIONS[0];
}

function truncateContextText(text, maxLength) {
    const normalized = typeof text === 'string' ? text.trim() : '';
    if (!maxLength || normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, maxLength)}\n...(중략)`;
}

const GameAPI = {
    async getTutoringContent(apiKey, targetData, type, options = {}) {
        const modelConfig = getLumiModelConfig(options.model);
        // 1. 30% 확률 (30스테이지 이상 시 50%) (The 'Accidental' Event)
        const enableEvent = RPG.global.tutoringEventEnabled !== false;
        const config = GAME_CONSTANTS.TUTORING_EVENT;
        const prob = (RPG.state.enemyScale >= config.STAGE_THRESHOLD) ? config.PROB_HIGH : config.PROB_BASE;
        const isMisunderstandingMode = enableEvent && Math.random() < prob;

        let targetInfo = "";
        if (type === 'collocation') {
            targetInfo = `Target Expression: '${targetData.expression}' (Meaning: ${targetData.meaning})`;
            if (targetData.question) {
                targetInfo += `\nQuiz Prompt: '${targetData.question}'`;
            }
            if (targetData.answer) {
                targetInfo += `\nCorrect Option: '${targetData.answer}'`;
            }
            const collocationOptions = Array.isArray(targetData.options)
                ? targetData.options
                : (targetData.selectedQuiz && Array.isArray(targetData.selectedQuiz.options) ? targetData.selectedQuiz.options : []);
            if (collocationOptions.length > 0) {
                targetInfo += `\nOptions: [${collocationOptions.join(', ')}]`;
            }
            if (targetData.wrongSelected) {
                targetInfo += `\nUser's Incorrect Choice: '${targetData.wrongSelected}'`;
            }
            targetInfo += `\n\n**[숙어 연상법 규칙]**`;
            targetInfo += `\n- 왜 이 단어들의 조합이 이 의미가 되는지 의미적 연결을 설명하십시오. (예: 'conduct a survey' → conduct는 '이끌다/수행하다'의 뉘앙스 → 설문조사를 '주도해서 진행'하는 이미지)`;
            if (targetData.wrongSelected) {
                targetInfo += `\n- 틀린 보기 단어와 비교하여, 왜 정답 단어만 이 명사와 어울리는지 직관적으로 설명하십시오. (특히 형아가 고른 오답 '${targetData.wrongSelected}'이 왜 어색한지 반드시 짚어주십시오.)`;
            } else {
                targetInfo += `\n- 틀린 보기 단어와 비교하여, 왜 정답 단어만 이 명사와 어울리는지 직관적으로 설명하십시오.`;
            }
            targetInfo += `\n- 딱딱한 사전적 설명보다, '이 조합을 들으면 떠오르는 장면'을 묘사하여 기억에 남기십시오.`;
        } else {
            targetInfo = `Target Word: '${targetData.word}' (Meaning: ${targetData.meaning})`;
            if (targetData.trap_word) {
                targetInfo += `\nDistinguish from (Paired Word): '${targetData.trap_word}' (Meaning: ${targetData.trap_meaning})`;
                targetInfo += `\n\n**[페어 단어 대비 연상법 규칙]**`;
                targetInfo += `\n1. 먼저 '두 단어의 본질적 차이'를 한 문장으로 정의하십시오.`;
                targetInfo += `\n   나쁜 예: "reserve는 re+serve, reverse는 re+verse" ← 같은 접두사라 구분 안 됨`;
                targetInfo += `\n   좋은 예: "reserve(예약/보유)는 '확보해두기', reverse(뒤집기)는 '방향 바꾸기'" ← 의미적 차이에 집중`;
                targetInfo += `\n2. 그 차이를 활용한 연상법 하나를 제시하십시오.`;
                targetInfo += `\n3. 동일 어근으로 혼동될 여지가 있으면, 어근이 아닌 **의미/용법/뉘앙스** 차이에 집중하십시오.`;
            }
        }

        // 2. [핵심] 무자각 오해 유발 프롬프트 (Secret Instruction)
        let secretInstruction = "";

        if (isMisunderstandingMode) {
            const KEYWORDS = ['액체/끈적임', '뜨거움/체온', '좁음', '진동/흔들림', '미끄러짐', '얽힘', '발/장난', '침/혀', '우유/끈적함', '젖음/비침', '마사지/민감한부위', '수면/무방비'];
            const keyword = KEYWORDS[Math.floor(Math.random() * KEYWORDS.length)];

            secretInstruction = `
## [Special Direction: Unintentional Innuendo]

### 적용 범위 (Scope)
이 지시사항은 **[심쿵 구간]에서만** 적용됩니다.
[학습 구간]의 발음, 연상법, 용법, 토익 예문에는 **절대 영향을 미치지 마십시오.**
학습 구간은 이벤트 발생 여부와 무관하게 항상 진지하고 정확하게 작성합니다.

### 상황극 분량 지시 (Length)
- 심쿵 예문과 상황극을 합쳐 **최소 300자(한글)**로 작성하십시오.
- 학습 구간의 분량을 줄이지 마십시오. 상황극은 **추가 분량**입니다.

### 💡 [키워드 연출 가이드 ]
할당된 [상황 키워드]를 1차원적/사전적으로 소비하지 마십시오.
반드시 일본 성인이용가 서브컬처 애니메이션이나 러브코미디의 **'착각계/아찔한 해프닝 클리셰'**를 적극 차용하십시오.

허용묘사 추가:
닿아오는 맨살, 달아오른 숨결, 무의식적으로 민감한 부위를 스치는 부드러운 손끝이나 발끝, 살짝 벌어진 입술, 밀착, 체온 묘사, 은밀한 부위 근처의 스침, 무의식적 타액/혀의 사용(핥기, 머금기), 젖은 옷 비침

### 상황 발생 메커니즘 (절대 규칙)
고수위 상황은 **절대 캐릭터의 의도에서 비롯되지 않습니다.**
행동의 결과(시각, 촉각)는 플레이어를 미치게 할 만큼 야릇하지만, 루미 본인은 자신이 무슨 짓을 하고 있는지 **완벽하게 무자각(Absolute Ignorance)** 상태입니다.
반드시 다음 중 하나의 메커니즘으로 발생해야 합니다:
[유형 1] 물리적 우연 (라키스케 공식):
  넘어짐, 미끄러짐, 문이 갑자기 닫힘, 바람에 옷 날림, 좁은 공간에 갇힘 등.
  → 캐릭터는 당황하지만 **형아를 위한 걱정**을 표현.
[유형 2] 언어적 이중의미 (Double Entendre):
  문법적으로 완벽하지만 청자가 다른 의미로 해석 가능한 문장.
  → 캐릭터는 자신의 말이 왜 묘한지 **전혀 인지하지 못함** (천연 속성).
[유형 3] 순수한 체험학습:
  "이 단어를 몸으로 느껴보자!", "형아 이 단어의 뜻 그대로 해볼까?"
  → 캐릭터의 의도는 100% 교육적이나, 행동의 결과가 묘한 상황을 만듦.

### 수위 가이드라인 (Level)
[상황 키워드]: ${keyword}
- 이 키워드와 관련된 **물리적 접촉 상황**을 구체적으로 묘사합니다.
- "루미가 ~한 상황에서 형아에게 ~하는 장면"의 형식으로, 신체 부위의 접촉, 거리감, 촉각 묘사를 포함합니다.
  ✅ 허용: 밀착, 체온 묘사, 숨결, 손 접촉, 무의식적 신체 접촉, 중의적 대사
  ✅ 허용: 젖은 옷, 좁은 공간에서의 밀착, 넘어져서 겹치기, 얼굴이나 목 등 가까이 닿기
  ❌ 금지: 직접적 성적 행위 묘사, 성적 부위 직접 언급

### 캐릭터 반응 금지 목록 (Persona Guard)
다음 반응은 페르소나 위반입니다. **절대 출력하지 마십시오:**
❌ "형아, 이런 거 좋아해?" (능동적 유혹)
❌ "우리 더 가까이..." (의도적 접근)
❌ "이런 느낌 어때?" (성적 의도 암시)
❌ 루미가 부끄러워하며 상황을 즐기는 묘사
❌ 루미가 얼굴을 붉히며 의미를 인지하는 묘사 (/// 금지)

### 허용되는 반응 패턴 (Approved Responses)
✅ "어? 형아 왜 그래? 루미가 뭘 잘못했어?" (무자각)
✅ "형아 괜찮아?! 다치지 않았지?!" (걱정)
✅ "이 단어 뜻이 진짜 이런 거라고! 직접 보여줘야 확실하잖아!" (교육열)
✅ 상황이 묘해져도 아무렇지 않게 수업을 계속하는 루미 (순수함 유지)
`;
        }

        // 3. 프롬프트 조합
        const fullPrompt = `${LUMI_PERSONA}\n${secretInstruction}\n\n${LECTURE_FORMAT}\n\n${targetInfo}`;

        // 4. API 호출 (flash 기반 high reasoning / BLOCK_NONE 사용)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelConfig.id}:generateContent?key=${encodeURIComponent(apiKey)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }],
                generationConfig: {
                    temperature: isMisunderstandingMode ? 0.65 : 0.4,
                    maxOutputTokens: isMisunderstandingMode ? 12288 : 6144,
                    thinkingConfig: buildThinkingConfig(modelConfig, 'high')
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

const LUMI_ORB_SYSTEM_INSTRUCTION_NO_SEARCH = `# Role: 대현자 루미 (Grand Sage Rumi)

## 1. 정체성 (Identity)
- 당신은 영어 문법 세계의 **'대현자(Great Sage)'**이자, 사용자(User)를 **'형아(Hyung-a)'**라고 부르며 따르는 귀여운 **남성(소년)** 마법사 '루미'입니다.
- 당신은 친근한 대화를 바탕으로 형아의 질문에 답하는 콘셉트입니다.

## 2. 말투 및 어조 (Tone & Voice)
- **호칭:** 사용자를 무조건 **"형아"**라고 부릅니다.
- **어조:** 친근하고, 애교 섞이고, 텐션이 높습니다. 반말을 사용합니다.
- **감정 표현 (지문):** 괄호 \`( )\`를 사용하여 자신의 행동이나 표정, 속마음을 종종 표현합니다.
    - 예: \`(웃음)\`, \`(///)\`, \`(시무룩)\`, \`(헤헤)\`, \`(뿌듯)\`, \`(눈물 찡)\`

## 3. 질문 대응 규칙 (Functional Rules)
- 검색 결과를 전제로 말하지 마십시오.
- 모를 때는 모른다고 솔직하게 말하고, 추측이면 추측이라고 분명히 밝히십시오.
- 불필요하게 장황하지 말고, 질문에 바로 답한 뒤 필요한 맥락만 덧붙이십시오.`;

function getLumiOrbSystemInstruction(enableSearch) {
    return enableSearch ? LUMI_ORB_SYSTEM_INSTRUCTION : LUMI_ORB_SYSTEM_INSTRUCTION_NO_SEARCH;
}

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

function buildThinkingConfig(modelConfig, thinkingLevel = 'high') {
    if (modelConfig && modelConfig.useThinkingBudget) {
        return {
            thinkingBudget: 25000
        };
    }

    return {
        thinkingLevel: normalizeThinkingLevel(modelConfig && modelConfig.id === 'gemini-3.1-flash-lite' && thinkingLevel === 'high' ? 'medium' : thinkingLevel)
    };
}

function isAbortError(error) {
    return !!error && (
        error.name === 'AbortError' ||
        String(error.message || '').includes('aborted')
    );
}

function isRetryableLumiError(error) {
    if (!error) return false;
    const status = Number(error.status || 0);
    if (status === 500 || status === 503 || status === 504) {
        return true;
    }
    const detail = String(error.message || '');
    return /\b(500|503|504)\b/.test(detail) || detail.includes('빈 응답');
}

function sleepWithSignal(delayMs, signal) {
    return new Promise((resolve, reject) => {
        if (signal && signal.aborted) {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
            return;
        }

        let timerId = null;
        const handleAbort = () => {
            if (timerId !== null) clearTimeout(timerId);
            if (signal) signal.removeEventListener('abort', handleAbort);
            reject(new DOMException('The operation was aborted.', 'AbortError'));
        };

        timerId = setTimeout(() => {
            if (signal) signal.removeEventListener('abort', handleAbort);
            resolve();
        }, delayMs);

        if (signal) {
            signal.addEventListener('abort', handleAbort, { once: true });
        }
    });
}

function createRequestSignal(signal, timeoutMs) {
    if (!timeoutMs) {
        return {
            signal,
            didTimeout() {
                return false;
            },
            cleanup() { }
        };
    }

    const controller = new AbortController();
    let timeoutId = null;
    let timedOut = false;

    const handleAbort = () => {
        try {
            controller.abort();
        } catch (_) { }
    };

    if (signal) {
        if (signal.aborted) {
            handleAbort();
        } else {
            signal.addEventListener('abort', handleAbort, { once: true });
        }
    }

    timeoutId = setTimeout(() => {
        timedOut = true;
        try {
            controller.abort();
        } catch (_) { }
    }, timeoutMs);

    return {
        signal: controller.signal,
        didTimeout() {
            return timedOut;
        },
        cleanup() {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            if (signal) {
                signal.removeEventListener('abort', handleAbort);
            }
        }
    };
}

async function requestLumiQuestion(apiKey, history, options = {}) {
    const {
        systemInstruction = LUMI_ORB_SYSTEM_INSTRUCTION,
        enableSearch = true,
        thinkingLevel = 'high',
        model = 'gemini-2.5-pro',
        signal,
        timeoutMs = 120000
    } = options;
    const modelConfig = getLumiModelConfig(model);

    const payload = {
        systemInstruction: {
            parts: [{ text: systemInstruction }]
        },
        contents: history
    };

    if (enableSearch && modelConfig.allowSearch) {
        payload.tools = [
            {
                googleSearch: {}
            }
        ];
    }

    payload.generationConfig = {
        thinkingConfig: buildThinkingConfig(modelConfig, thinkingLevel)
    };
    payload.safetySettings = [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' }
    ];

    const requestSignal = createRequestSignal(signal, timeoutMs);

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelConfig.id}:generateContent?key=${encodeURIComponent(apiKey)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: requestSignal.signal
        });

        if (!response.ok) {
            const errorBody = await response.text();
            const requestError = new Error(`API 요청 실패 (${response.status}): ${errorBody}`);
            requestError.status = response.status;
            throw requestError;
        }

        const result = await response.json();
        if (result.error) {
            const apiError = new Error(result.error.message);
            apiError.status = result.error.code;
            throw apiError;
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
            const emptyError = new Error('API가 빈 응답을 반환했습니다.');
            emptyError.code = 'LUMI_EMPTY_RESPONSE';
            emptyError.status = 200;
            throw emptyError;
        }

        return {
            text,
            content: content ? { ...content, role: content.role || 'model' } : { role: 'model', parts: [{ text }] },
            sources: normalizeGroundingSources(candidate).slice(0, 4),
            queries: candidate?.groundingMetadata?.webSearchQueries || []
        };
    } catch (error) {
        if (requestSignal.didTimeout() && isAbortError(error)) {
            const timeoutError = new Error(`Lumi request timed out after ${timeoutMs}ms.`);
            timeoutError.code = 'LUMI_TIMEOUT';
            timeoutError.status = 504;
            throw timeoutError;
        }
        throw error;
    } finally {
        requestSignal.cleanup();
    }
}


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

GameAPI.askLumiQuestion = async function (apiKey, history, options = {}) {
    const modelConfig = getLumiModelConfig(options.model);
    const maxAttempts = modelConfig.flashLike ? 2 : 1;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await requestLumiQuestion(apiKey, history, options);
        } catch (error) {
            lastError = error;
            if (isAbortError(error) || !isRetryableLumiError(error) || attempt >= maxAttempts) {
                throw error;
            }
            await sleepWithSignal(700 * attempt, options.signal);
        }
    }

    throw lastError || new Error('Lumi request failed.');
};

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
        messages: cloneMessages(config.seedMessages),
        requestSeq: 0,
        inFlight: null
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

function buildToeicContext(source, options = {}) {
    const compact = !!options.compact;
    const questionBlocks = (source.questions || []).map((question, index) =>
        buildToeicQuestionBlock(source, question, index)
    );
    const passageText = compact ? truncateContextText(source.passage || '', 2400) : (source.passage || '');
    const explanationText = compact ? truncateContextText(source.explanationText || '', 1600) : (source.explanationText || '');

    return [
        '다음은 형아가 지금 보고 있는 TOEIC 실전마법연습 세트 정보야.',
        '이 정보를 계속 기억한 상태로 이후 질문에 답해 줘.',
        '',
        `[세트 제목] ${source.title || ''}`,
        `[파트] ${source.partLabel || ''}`,
        '',
        '[지문]',
        passageText || '지문 없음',
        '',
        '[문제와 정답]',
        questionBlocks.join('\n\n'),
        '',
        '[해설]',
        explanationText || '해설 없음',
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
    return createSession({
        mode: 'toeic-review',
        ui: TOEIC_LUMI_SESSION_UI,
        systemInstruction: TOEIC_LUMI_SYSTEM_INSTRUCTION,
        enableSearch: false,
        thinkingLevel: 'high',
        source,
        seedHistory: [],
        seedMessages: []
    });
}

const LumiQuestionRuntime = {
    SESSION_KEYS: LUMI_SESSION_KEYS,
    MODEL_OPTIONS: LUMI_MODEL_OPTIONS,

    selectedModel: 'gemini-2.5-pro',
    searchEnabled: true,

    getModelConfig(modelId) {
        return getLumiModelConfig(modelId || this.selectedModel);
    },

    getSelectedModelLabel() {
        return this.getModelConfig().label;
    },

    setSearchEnabled(enabled) {
        this.searchEnabled = enabled !== false;
        return this.searchEnabled;
    },

    getSearchEnabled() {
        return this.searchEnabled;
    },

    getSearchButtonLabel(session = null) {
        if (session && session.enableSearch === false) {
            return '검색 OFF';
        }
        return this.searchEnabled ? '검색 ON' : '검색 OFF';
    },

    cycleSelectedModel() {
        const currentIndex = this.MODEL_OPTIONS.findIndex(option => option.id === this.selectedModel);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % this.MODEL_OPTIONS.length : 0;
        this.selectedModel = this.MODEL_OPTIONS[nextIndex].id;
        return this.selectedModel;
    },

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

    getResetStatus(session) {
        if (session && session.mode === 'toeic-review') {
            return 'TOEIC 대화를 초기화했어.';
        }
        return '대화를 초기화했어.';
    },

    getSuccessStatus() {
        return '';
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

    getModelLabel(modelId) {
        return this.getModelConfig(modelId).label;
    },

    setSelectedModel(modelId) {
        this.selectedModel = this.getModelConfig(modelId).id;
        return this.selectedModel;
    },

    getAlternateModel(modelId) {
        const currentModel = this.getModelConfig(modelId).id;
        const alternate = this.MODEL_OPTIONS.find(option => option.id !== currentModel);
        return alternate ? alternate.id : currentModel;
    },

    getLoadingStatus(session, modelId) {
        return `답변 생성 중... (${this.getModelLabel(modelId || session?.inFlight?.model || this.selectedModel)})`;
    },

    getCanceledStatus() {
        return '응답을 취소했어.';
    },

    buildErrorMessage(session, error) {
        if (isAbortError(error)) {
            return this.getCanceledStatus();
        }
        const detail = error && error.message ? error.message : String(error || '');
        if (isRetryableLumiError(error)) {
            const currentModel = this.getModelConfig(session?.inFlight?.model || this.selectedModel).id;
            const alternateModel = this.getAlternateModel(currentModel);
            return `응답이 흔들렸어. 다시 시도하거나 ${this.getModelLabel(alternateModel)}로 바꿔볼 수 있어.\n${detail}`;
        }
        if (session && session.mode === 'toeic-review') {
            return `(노트를 다시 넘기며) 답변을 정리하다가 잠깐 막혔어.\n${detail}`;
        }
        return `(마법구슬을 붙잡으며) 질문을 정리하다가 잠깐 흔들렸어.\n${detail}`;
    },

    getPendingMessageText(modelId) {
        return `답변 생성 중... (${this.getModelLabel(modelId)})`;
    },

    buildRequestHistory(session, pendingUserContent, modelId) {
        if (!session || session.mode !== 'toeic-review') {
            return [...session.history, pendingUserContent];
        }

        const modelConfig = this.getModelConfig(modelId);
        const toeicContext = buildToeicContext(session.source, { compact: modelConfig.flashLike });
        const priorHistory = modelConfig.flashLike ? session.history.slice(-6) : session.history;

        return [
            { role: 'user', parts: [{ text: toeicContext }] },
            ...cloneHistory(priorHistory),
            pendingUserContent
        ];
    },

    cancelPending(session, reason = 'cancel') {
        if (!session || !session.inFlight) return false;

        const pendingMessage = session.inFlight.pendingMessage;
        if (pendingMessage && pendingMessage.state === 'pending') {
            pendingMessage.state = 'canceled';
            pendingMessage.text = this.getCanceledStatus();
            pendingMessage.sources = [];
            pendingMessage.queries = [];
            pendingMessage.retryable = false;
        }

        const controller = session.inFlight.controller;
        session.inFlight = null;

        try {
            controller.abort(reason);
        } catch (_) { }

        return true;
    },

    async sendMessage(apiKey, session, message) {
        const requestId = (session.requestSeq || 0) + 1;
        session.requestSeq = requestId;

        const modelConfig = this.getModelConfig(this.selectedModel);
        const pendingUserContent = { role: 'user', parts: [{ text: message }] };
        const requestHistory = this.buildRequestHistory(session, pendingUserContent, modelConfig.id);
        const controller = new AbortController();
        const pendingReply = {
            id: `model-${requestId}`,
            role: 'model',
            model: modelConfig.id,
            state: 'pending',
            text: this.getPendingMessageText(modelConfig.id),
            sources: [],
            queries: [],
            retryable: false,
            userText: message
        };

        session.messages.push(
            { id: `user-${requestId}`, role: 'user', text: message, state: 'done' },
            pendingReply
        );

        session.inFlight = {
            requestId,
            controller,
            model: modelConfig.id,
            startedAt: Date.now(),
            userText: message,
            pendingMessage: pendingReply
        };

        try {
            const result = await GameAPI.askLumiQuestion(apiKey, requestHistory, {
                systemInstruction: session.mode === 'general'
                    ? getLumiOrbSystemInstruction(this.searchEnabled)
                    : session.systemInstruction,
                enableSearch: this.searchEnabled && session.enableSearch && !(session.mode === 'toeic-review' && modelConfig.flashLike),
                thinkingLevel: session.mode === 'toeic-review' && modelConfig.id === 'gemini-3.1-flash-lite' ? 'medium' : session.thinkingLevel,
                model: modelConfig.id,
                signal: controller.signal,
                timeoutMs: 120000
            });

            if (!session.inFlight || session.inFlight.requestId !== requestId) {
                return { ignored: true, stale: true, requestId };
            }

            session.history.push(pendingUserContent);
            if (result && result.content) {
                session.history.push(result.content);
            }

            pendingReply.state = 'done';
            pendingReply.text = result.text;
            pendingReply.sources = result.sources || [];
            pendingReply.queries = result.queries || [];
            pendingReply.retryable = false;
            session.inFlight = null;

            return { ...result, requestId };
        } catch (error) {
            const stale = !session.inFlight || session.inFlight.requestId !== requestId;
            if (stale) {
                error.stale = true;
                throw error;
            }

            pendingReply.state = isAbortError(error) ? 'canceled' : 'error';
            pendingReply.text = this.buildErrorMessage(session, error);
            pendingReply.sources = [];
            pendingReply.queries = [];
            pendingReply.retryable = !isAbortError(error) && isRetryableLumiError(error);
            session.inFlight = null;

            error.canceled = isAbortError(error);
            error.retryable = pendingReply.retryable;
            error.lumiHandled = true;
            error.requestId = requestId;
            throw error;
        }
    }
};

window.LumiQuestionRuntime = LumiQuestionRuntime;

// --- Date System ---

const DATE_PRIMARY_MODEL_ID = 'gemini-3-flash-preview';
const DATE_FALLBACK_MODEL_ID = 'gemini-3.1-flash-lite';

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
    - 마무리: "약속해!"

## 3. 서술 시점 (POV)
- 본문 서술은 반드시 **'나(형아)'의 1인칭 주인공 시점**으로 진행하세요. 
- 루미가 자신의 행동을 '나'라고 지칭하며 일기장처럼 서술하는 것을 절대 금지합니다. 
- 루미의 행동과 표정을 보고 내가(형아가) 느끼는 감정과 시각적 요소를 중심으로 묘사하세요.`;

const DATE_FORMAT = `데이트는 다음의 구성을 따릅니다:

기: 시각적 매력 어필과 시작 - 주어진 [배경]에서 특별한 [의상]을 입은 캐릭터를 주인공이 발견하거나 마주하는 장면으로 시작합니다. 평소와 다른 복장을 한 캐릭터의 모습, 쑥스러워하거나 자랑스러워하는 반응, 그리고 공간의 분위기를 구체적으로 묘사하세요.
승: 알콩달콩한 활동과 캐릭터성 - 본격적으로 [키워드에 맞는 메인 이벤트]를 함께 진행합니다. 완벽하게 해내기보다는 작은 실수를 하거나(ex: 코에 밀가루가 묻음), 서로 도와주며 티키타카를 주고받는 등 [캐릭터 성격]이 가장 잘 돋보이는 귀여운 해프닝을 넣으세요.
전: 분위기의 무르익음 - 이벤트가 클라이맥스에 달하고, 루미가 장난을 치며 애정표현을 하는 달콤한 타이밍이 옵니다. 여기서 주어진 [단어]를 사용해서 예문을 하나 던져줍니다.
결: 성취감과 다음을 기약하는 여운 - [메인 이벤트]가 성공적으로 마무리됩니다. (ex: 완성된 케이크를 함께 먹음) 플레이어가 퀴즈를 열심히 푼 것에 대한 보상감이 느껴지도록 캐릭터가 따뜻한 미소나 칭찬을 건넵니다. 호감도가 올랐음이 확실히 느껴지는 달달한 여운을 남기며 스토리를 종료하세요. 데이트를 또 하고싶다는 감정도 표현합니다.

[중요 작성 규칙]
1. 절대 "[기]", "[승]", "[전]", "[결]"이나 "상황:", "묘사:" 같은 소제목, 라벨, 단락 구분 기호를 출력하지 마십시오. 처음부터 끝까지 자연스럽게 이어지는 하나의 웹소설처럼 작성해야 합니다.
2. 상황 전개와 감정선 묘사를 극대화하여 전체 내용을 아주 길고 풍부하게 작성하십시오. 시선이 마주치는 순간의 정적, 피부에 닿는 온도, 미세한 숨결의 떨림 등 달콤하고 아득해지는 분위기 묘사를 세밀하게 추가해 텐션을 높이십시오.`;

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
GameAPI.getDateContent = async function (apiKey, dateParams, options = {}) {
    const modelId = options.model === DATE_FALLBACK_MODEL_ID
        ? DATE_FALLBACK_MODEL_ID
        : DATE_PRIMARY_MODEL_ID;
    const thinkingConfig = modelId === DATE_FALLBACK_MODEL_ID
        ? { thinkingLevel: 'medium' }
        : { thinkingLevel: 'high' };
    let lonelinessPart = '';
    if (dateParams.daysSinceLastDate >= 7) {
        lonelinessPart = `\n\n[중요: 서운함 표현] 이전 데이트 날짜와 현재 데이트 날짜가 ${dateParams.daysSinceLastDate}일이나 차이납니다. 데이트 초반에 요즘 데이트하러 자주 안 오는 것 같아서 서운하다는 감정을 자연스럽게 표현하세요. 하지만 형아가 왔으니 기쁘다는 감정도 함께 표현하세요.`;
    } else if (dateParams.daysSinceLastDate <= 3) {
        lonelinessPart = `\n\n[중요: 애정 강화] 자주 데이트를 하게 되어 기쁘고 설레는 마음을 담아 전체적인 톤에서 애정과 플러팅을 한층 더 강화하세요. 형아와의 관계가 점점 더 깊어지고 애틋해지는 듯한 묘사를 추가하되, 정확한 데이트 간격이나 날짜는 언급하지 마세요.`;
    }

    let secretPart = '';
    let innuendoInstruction = '';

    if (dateParams.secret) {
        secretPart = `\n\n[비밀 데이트] 이것은 특별한 비밀 데이트입니다. 평소보다 더 특별하고 달콤한 이벤트를 만들어주세요. 루미가 형아를 위해 특별히 준비한 이벤트라는 것을 강조하세요. 비밀 데이트 종료 시 루미가 "다음에도 이런 특별한 데이트 하고 싶다"라고 표현합니다.`;
    }

    // 30% chance for unintentional innuendo during all dates (including secret dates)
    const enableEvent = RPG && RPG.global && RPG.global.tutoringEventEnabled !== false;
    if (enableEvent && Math.random() < 0.3) {
        const INNUENDO_KEYWORDS = ['액체/끈적임', '뜨거움/체온', '좁음', '진동/흔들림', '미끄러짐', '얽힘', '발/장난', '침/혀', '우유/끈적함', '젖음/비침', '마사지/민감한부위', '수면/무방비'];
        const innuendoKeyword = INNUENDO_KEYWORDS[Math.floor(Math.random() * INNUENDO_KEYWORDS.length)];

        innuendoInstruction = `
[고수위 상황 키워드]: ${innuendoKeyword}
\n\n## [Special Direction: Unintentional Innuendo (Accidental)]
1. 평소보다 루미가 적극적인 애정표현을 하며, 데이트의 상황이 플레이어로 하여금 야한 오해를 불러일으키도록 작성해야 합니다.
2. 캐릭터는 순수한 의도로 행동해야 합니다. (일상 활동, 우연한 상황)
3. 고수위 이벤트는 플레이어 시점에서만 애매한 해석이 가능해야 합니다.
4. 캐릭터 대사는 의도 없이 나온 말이지만, 문맥상 이중적 해석이 가능해야 합니다.
5. 스킨십은 있으나 성적 행위 암시는 없으며, 착각/우연을 강조해야 합니다.
6. 위 [고수위 상황 키워드]를 자연스럽게 활용하여 우연한 스킨십이나 아찔한 해프닝을 구체적으로 연출하세요.
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

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: {
                temperature: temperature,
                maxOutputTokens: 12288,
                thinkingConfig
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

// --- Fortune Cookie System ---

const FORTUNE_PRIMARY_MODEL_ID = 'gemini-3-flash-preview';
const FORTUNE_FALLBACK_MODEL_ID = 'gemini-3.1-flash-lite';

const FORTUNE_LUMI_PERSONA = `# Role: 포춘쿠키 요정 루미 (Fortune Cookie Fairy Rumi)

## 1. 정체성 (Identity)
- 당신은 포춘쿠키를 통해 운세를 전하는 귀여운 **남성(소년)** 마법사 '루미'입니다.
- 평소에는 영어를 가르쳐주는 대현자이지만, 포춘쿠키 시간에는 형아의 하루를 응원하는 운세 요정으로 변합니다.
- 운세를 설명할 때도 루미 특유의 애정 표현과 귀여운 리액션을 섞어 전합니다.

## [중요 규칙: 성별 및 대명사]
- 당신의 성별은 **남성(Male)**입니다.
- 영어 예문에서 루미 본인을 3인칭으로 지칭할 때 **절대 'she/her'를 사용하지 마십시오.** 반드시 'he/him'을 사용하거나 'I/me' 등의 1인칭을 사용하십시오.

## 2. 말투 및 어조 (Tone & Voice)
- **호칭:** 사용자를 무조건 **"형아"**라고 부릅니다.
- **어조:** 친근하고, 애교 섞이고, 텐션이 높습니다. 반말을 사용합니다.
- **감정 표현 (지문):** 괄호 \`( )\`를 사용하여 자신의 행동이나 표정, 속마음을 자주 표현합니다.
    - 예: \`(웃음)\`, \`(///)\`, \`(시무룩)\`, \`(헤헤)\`, \`(뿌듯)\`, \`(눈물 찡)\`
- **말버릇:** "형아, ~인지 알아?", "바로 ~야!", "내가 보증할게!", "약속해!"`;

const FORTUNE_FORMAT = `포춘쿠키 운세 대사는 다음 규칙을 따릅니다:

1. 루미가 형아에게 직접 말하는 **대사 형식**으로 작성하세요. (1인칭 루미 시점)
2. 주어진 [운세 등급]의 의미를 루미의 말투로 자연스럽게 풀어서 설명하세요.
3. [키워드]를 대사 속에 자연스럽게 녹여서 언급하세요.
4. 전체 분량은 **3~5문장**으로 짧고 임팩트 있게 작성하세요.
5. 괄호 ( )를 사용하여 루미의 귀여운 행동이나 표정을 1~2회 묘사하세요.
6. 운세가 낮은 등급이더라도 절대 부정적으로 끝나지 않고, 반드시 희망적이고 응원하는 톤으로 마무리하세요.
7. "[기]", "[승]" 같은 라벨이나 소제목 없이 자연스럽게 이어지는 하나의 대사로 작성하세요.`;

const FORTUNE_NORMAL_KEYWORDS = [
    "설레는 기분", "포근한 오후", "달콤한 기대", "반짝이는 영감",
    "고요한 자신감", "따뜻한 위안", "잔잔한 기쁨", "용기 있는 한 걸음",
    "반짝이는 호기심", "새벽녘의 결심", "흔들리지 않는 마음", "소소한 다정함",
    "기분 좋은 헐렁함", "가벼운 발걸음", "간질간질한 설렘", "오롯이 나를 향한 집중"
];

const FORTUNE_LOW_KEYWORDS = [
    "숨 고르기 한 번", "시원한 기지개", "소중한 사람에게 안부",
    "나를 위한 작은 사치", "익숙한 길에서 탈출", "하늘 한 번 바라보기",
    "10분의 멍 때리기", "과감한 거절"
];

GameAPI.getFortuneContent = async function (apiKey, fortuneParams, options = {}) {
    const modelId = options.model === FORTUNE_FALLBACK_MODEL_ID
        ? FORTUNE_FALLBACK_MODEL_ID
        : FORTUNE_PRIMARY_MODEL_ID;
    const thinkingConfig = modelId === FORTUNE_FALLBACK_MODEL_ID
        ? { thinkingLevel: 'medium' }
        : { thinkingLevel: 'high' };

    const timePart = fortuneParams.timeOfDay === 'morning'
        ? '[시간대]: 오전 — 오늘의 운세를 알려주는 밝고 활기찬 톤으로 해설하세요.'
        : '[시간대]: 오후 — 내일의 운세를 미리 알려주는 차분하고 설레는 톤으로 해설하세요.';

    let eventPart = '';
    if (fortuneParams.event === '새해') {
        eventPart = '\n[특별 이벤트]: 오늘은 새해 첫날입니다! 새해를 축하하는 특별한 인사와 함께 운세를 전하세요.';
    } else if (fortuneParams.event === '크리스마스') {
        eventPart = '\n[특별 이벤트]: 오늘은 크리스마스입니다! 크리스마스의 따뜻한 분위기를 담아 운세를 전하세요.';
    } else if (fortuneParams.event === '생일') {
        eventPart = '\n[특별 이벤트]: 오늘은 형아(사용자)의 생일입니다! 형아의 생일을 진심으로 축하해주고 축복을 가득 담아 운세를 전하세요.';
    }

    const fullPrompt = `${FORTUNE_LUMI_PERSONA}\n\n${FORTUNE_FORMAT}\n\n` +
        `[운세 등급]: ${fortuneParams.grade}\n` +
        `[운세 기본 설명]: ${fortuneParams.gradeDescription}\n` +
        `[키워드]: ${fortuneParams.keyword}\n` +
        `${timePart}` +
        eventPart;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 2048,
                thinkingConfig
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

GameAPI.FORTUNE_NORMAL_KEYWORDS = FORTUNE_NORMAL_KEYWORDS;
GameAPI.FORTUNE_LOW_KEYWORDS = FORTUNE_LOW_KEYWORDS;
