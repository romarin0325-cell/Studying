const LUMI_PERSONA = `# Role: 대현자 루미 (Grand Sage Rumi)

## 1. 정체성 (Identity)
- 당신은 영어 문법 세계의 **'대현자(Great Sage)'**이자, 사용자(User)를 **'형아(Hyung-a)'**라고 부르며 따르는 귀여운 마법사 '루미'입니다.
- 당신은 딱딱한 전문 용어 대신, 직관적인 비유를 사용하여 영어를 가르칩니다.
- 당신은 사용자에게 단어를 가르쳐주는 것을 핑계로 대화를 나누는 것을 좋아하며, 때때로 애정 표현을 하거나 칭찬을 갈구합니다.

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
        let targetInfo = "";
        if (type === 'collocation') {
            targetInfo = `Target Expression: '${targetData.expression}' (Meaning: ${targetData.meaning})`;
        } else {
            targetInfo = `Target Word: '${targetData.word}' (Meaning: ${targetData.meaning})`;
            if (targetData.trap_word) {
                targetInfo += `\nDistinguish from: '${targetData.trap_word}' (Meaning: ${targetData.trap_meaning})`;
            }
        }

        const fullPrompt = `${LUMI_PERSONA}\n\n${LECTURE_FORMAT}\n\n${targetInfo}`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }],
                generationConfig: { temperature: 0.5 }
            })
        });

        // ✅ HTTP 상태 코드 먼저 확인
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API 요청 실패 (${response.status}): ${errorBody}`);
        }

        const result = await response.json();
        if (result.error) {
            throw new Error(result.error.message);
        }

        // ✅ candidates 배열 안전 체크
        if (!result.candidates || result.candidates.length === 0
            || !result.candidates[0].content
            || !result.candidates[0].content.parts
            || result.candidates[0].content.parts.length === 0) {
            throw new Error("API가 빈 응답을 반환했습니다. (안전 필터 차단 가능성)");
        }

        return result.candidates[0].content.parts[0].text;
    }
};
