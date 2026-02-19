/**
 * QuizEngine — Unified quiz rendering system for Card RPG.
 *
 * Replaces 5 separate quiz functions with a single configurable engine:
 *   - startQuiz (vocab, Korean meaning → pick correct meaning)
 *   - startChaosQuiz (vocab, Korean meaning → pick correct English word)
 *   - startCollocationQuiz (collocation quiz)
 *   - startGrammarQuiz (grammar quiz)
 *   - startTutoringQuiz (tutoring review quiz)
 *
 * Usage:
 *   QuizEngine.show({
 *       question: 'What is ...?',
 *       desc: 'optional description',        // falsy → hidden
 *       options: ['A', 'B', 'C', 'D'],       // will be shuffled
 *       answer: 'B',                          // correct option text
 *       onCorrect: () => { ... },
 *       onWrong: (chosen) => { ... },
 *       correctDelay: 1000,                   // ms before closing on correct
 *       wrongDelay: 1500                      // ms before closing on wrong
 *   });
 */
const QuizEngine = {
    /**
     * Show a quiz modal with the given configuration.
     * @param {Object} config
     * @param {string}   config.question      - The question text
     * @param {string}   [config.desc]        - Optional description/translation (hidden if falsy)
     * @param {string[]} config.options       - Array of option strings (will be shuffled)
     * @param {string}   config.answer        - The correct answer string (must match one of options)
     * @param {Function} [config.onCorrect]   - Callback when correct answer is chosen
     * @param {Function} [config.onWrong]     - Callback when wrong answer is chosen, receives (chosenText)
     * @param {number}   [config.correctDelay=1000] - Delay in ms before closing modal on correct
     * @param {number}   [config.wrongDelay=1500]   - Delay in ms before closing modal on wrong
     */
    show(config) {
        const modal = document.getElementById('modal-quiz');
        const qDiv = document.getElementById('quiz-question');
        const descDiv = document.getElementById('quiz-desc');
        const oDiv = document.getElementById('quiz-options');
        const fDiv = document.getElementById('quiz-feedback');

        // Reset modal state
        modal.classList.remove('active');
        oDiv.innerHTML = '';
        if (fDiv) fDiv.innerText = '';

        // Question
        qDiv.innerText = config.question;

        // Description
        if (config.desc) {
            descDiv.innerText = config.desc;
            descDiv.style.display = 'block';
        } else {
            descDiv.style.display = 'none';
        }

        // Shuffle options
        const shuffled = [...config.options].sort(() => Math.random() - 0.5);
        const correctDelay = config.correctDelay || 1000;
        const wrongDelay = config.wrongDelay || 1500;

        shuffled.forEach(optText => {
            const btn = document.createElement('button');
            btn.className = 'menu-btn';
            btn.style.padding = '10px';
            btn.style.fontSize = '0.9rem';
            btn.innerText = optText;

            btn.onclick = () => {
                // Immediately disable all buttons
                btn.disabled = true;
                Array.from(oDiv.children).forEach(c => { c.onclick = null; });

                if (optText === config.answer) {
                    btn.classList.add('correct');
                    if (fDiv) { fDiv.innerText = '정답!'; fDiv.style.color = '#4caf50'; }
                    setTimeout(() => {
                        modal.classList.remove('active');
                        if (config.onCorrect) config.onCorrect();
                    }, correctDelay);
                } else {
                    btn.classList.add('wrong');
                    // Highlight correct answer
                    Array.from(oDiv.children).forEach(c => {
                        if (c.innerText === config.answer) c.classList.add('correct');
                    });
                    if (fDiv) { fDiv.innerText = '오답...'; fDiv.style.color = '#ef5350'; }
                    setTimeout(() => {
                        modal.classList.remove('active');
                        if (config.onWrong) config.onWrong(optText);
                    }, wrongDelay);
                }
            };
            oDiv.appendChild(btn);
        });

        modal.classList.add('active');
    },

    // ─── Convenience builders ───────────────────────────────────────────

    /**
     * Build config for a standard vocab quiz (word → meaning).
     * @param {Function} callback - (success: boolean) => void
     * @returns {Object|null} config or null if data unavailable
     */
    buildVocabQuiz(callback) {
        if (!VOCAB_DATA || VOCAB_DATA.length === 0) return null;

        const q = VOCAB_DATA[Math.floor(Math.random() * VOCAB_DATA.length)];

        let options = [{ text: q.meaning, correct: true }];
        options.push({ text: q.trap_meaning, correct: false });

        let safety = 0;
        while (options.length < 4 && safety < 100) {
            safety++;
            const r = VOCAB_DATA[Math.floor(Math.random() * VOCAB_DATA.length)];
            if (r.word !== q.word && r.word !== q.trap_word && !options.some(o => o.text === r.meaning)) {
                options.push({ text: r.meaning, correct: false });
            }
        }

        return {
            question: q.word,
            desc: null,
            options: options.map(o => o.text),
            answer: q.meaning,
            onCorrect: () => callback(true),
            onWrong: () => {
                // Record wrong word
                if (!RPG.state.wrongWords) RPG.state.wrongWords = [];
                if (!RPG.state.wrongWords.includes(q.word)) {
                    RPG.state.wrongWords.push(q.word);
                    Storage.save(Storage.keys.VOCAB, RPG.state.wrongWords);
                }
                callback(false);
            }
        };
    },

    /**
     * Build config for a chaos quiz (meaning → word, reverse direction).
     * @param {Function} callback - (success: boolean) => void
     * @returns {Object|null} config or null if data unavailable
     */
    buildChaosQuiz(callback) {
        if (!VOCAB_DATA || VOCAB_DATA.length === 0) return null;

        const q = VOCAB_DATA[Math.floor(Math.random() * VOCAB_DATA.length)];

        let options = [{ text: q.word, correct: true }];
        let safety = 0;
        while (options.length < 4 && safety < 100) {
            safety++;
            const r = VOCAB_DATA[Math.floor(Math.random() * VOCAB_DATA.length)];
            if (r.word !== q.word && !options.some(o => o.text === r.word)) {
                options.push({ text: r.word, correct: false });
            }
        }

        return {
            question: q.meaning,
            desc: null,
            options: options.map(o => o.text),
            answer: q.word,
            onCorrect: () => callback(true),
            onWrong: () => callback(false)
        };
    },

    /**
     * Build config for a collocation quiz.
     * @param {Function} callback - (success: boolean) => void
     * @returns {Object|null} config or null if data unavailable
     */
    buildCollocationQuiz(callback) {
        if (!COLLOCATION_DATA || COLLOCATION_DATA.length === 0) return null;

        let allQuizzes = [];
        COLLOCATION_DATA.forEach(item => {
            if (item.quizzes) {
                item.quizzes.forEach(q => { allQuizzes.push({ ...q, parentId: item.id }); });
            } else {
                allQuizzes.push({ ...item, parentId: item.id });
            }
        });
        if (allQuizzes.length === 0) return null;

        const q = allQuizzes[Math.floor(Math.random() * allQuizzes.length)];

        return {
            question: q.question,
            desc: q.translation,
            options: [...q.options],
            answer: q.answer,
            onCorrect: () => callback(true),
            onWrong: () => {
                if (!RPG.state.wrongCollocations) RPG.state.wrongCollocations = [];
                if (!RPG.state.wrongCollocations.includes(q.parentId)) {
                    RPG.state.wrongCollocations.push(q.parentId);
                    Storage.save(Storage.keys.COLLOCATION, RPG.state.wrongCollocations);
                }
                callback(false);
            }
        };
    },

    /**
     * Build config for a grammar quiz.
     * @param {Object}   q               - Quiz object from GRAMMAR_DATA
     * @param {Function} [onCorrect]     - Callback on correct
     * @param {Function} [onWrong]       - Callback on wrong
     * @returns {Object} config
     */
    buildGrammarQuiz(q, onCorrect, onWrong) {
        let cleanDesc = q.desc.replace(/\s*\(.*?\)/g, '').trim();

        return {
            question: q.question,
            desc: cleanDesc,
            options: [...q.options],
            answer: q.answer,
            onCorrect: onCorrect || null,
            onWrong: onWrong || null
        };
    },

    /**
     * Build config for a tutoring review quiz (vocab or collocation).
     * @param {Object}   item           - { data, type: 'vocab'|'collocation' }
     * @param {Function} onCorrect      - Callback on correct
     * @param {Function} onWrong        - Callback on wrong
     * @returns {Object} config
     */
    buildTutoringQuiz(item, onCorrect, onWrong) {
        const data = item.data;

        if (item.type === 'collocation') {
            let quizList = data.quizzes || [{ question: data.question, options: data.options, answer: data.answer, translation: data.translation }];
            let q = quizList[Math.floor(Math.random() * quizList.length)];

            return {
                question: q.question,
                desc: q.translation || '',
                options: [...q.options],
                answer: q.answer,
                onCorrect: onCorrect,
                onWrong: onWrong
            };
        } else {
            // Vocab tutoring quiz
            let options = [{ text: data.meaning, correct: true }];
            options.push({ text: data.trap_meaning, correct: false });

            let safety = 0;
            while (options.length < 4 && safety < 100) {
                safety++;
                const r = VOCAB_DATA[Math.floor(Math.random() * VOCAB_DATA.length)];
                if (r.word !== data.word && r.word !== data.trap_word && !options.some(o => o.text === r.meaning)) {
                    options.push({ text: r.meaning, correct: false });
                }
            }

            return {
                question: data.word,
                desc: null,
                options: options.map(o => o.text),
                answer: data.meaning,
                onCorrect: onCorrect,
                onWrong: onWrong
            };
        }
    }
};
