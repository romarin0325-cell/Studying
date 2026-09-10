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
             * Weighted selection for quiz generation.
             * Favors items in RPG.state.tutoredItems with caller-specific weight.
             */
            pickWeighted(data, getItemId, reviewedWeight = 10) {
                const tutored = (RPG.state && RPG.state.tutoredItems) ? RPG.state.tutoredItems : [];

                // If no data or no tutored items relevant to this dataset, pick random
                if (!data || data.length === 0) return null;

                // Optimization: if no tutored items at all, skip logic
                if (tutored.length === 0) return data[Math.floor(Math.random() * data.length)];

                // Check if any tutored item exists in this data
                const candidates = data.filter(d => tutored.includes(getItemId(d)));
                if (candidates.length === 0) return data[Math.floor(Math.random() * data.length)];

                // Calculate weights
                // Candidates: reviewedWeight, Others: 1
                const weightC = candidates.length * reviewedWeight;
                const weightN = (data.length - candidates.length) * 1;
                const totalWeight = weightC + weightN;

                let r = Math.random() * totalWeight;

                if (r < weightC) {
                    // Pick from candidates
                    return candidates[Math.floor(Math.random() * candidates.length)];
                } else {
                    // Pick from others (Rejection sampling for efficiency)
                    // Since candidates are very few (max 3), rejection probability is very low.
                    let pick;
                    let safety = 0;
                    do {
                        pick = data[Math.floor(Math.random() * data.length)];
                        safety++;
                    } while (tutored.includes(getItemId(pick)) && safety < 50);
                    return pick;
                }
            },

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

                const q = this.pickWeighted(VOCAB_DATA, v => v.word, 30);

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

                const q = this.pickWeighted(VOCAB_DATA, v => v.word);

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

                const q = this.pickWeighted(allQuizzes, item => item.parentId, 20);

                return {
                    question: q.question,
                    desc: q.translation,
                    options: [...q.options],
                    answer: q.answer,
                    onCorrect: () => callback(true),
                    onWrong: (chosenText) => {
                        if (!RPG.state.wrongCollocations) RPG.state.wrongCollocations = [];
                        if (!RPG.state.wrongCollocationDetails) RPG.state.wrongCollocationDetails = {};

                        RPG.state.wrongCollocationDetails[q.parentId] = {
                            question: q.question,
                            options: q.options,
                            answer: q.answer,
                            translation: q.translation,
                            wrongSelected: chosenText,
                            timestamp: Date.now()
                        };
                        Storage.save(Storage.keys.COLLOCATION_DETAILS, RPG.state.wrongCollocationDetails);

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

            resolveCollocationTutoringQuiz(data) {
                if (data && data.selectedQuiz) return data.selectedQuiz;
                if (!data) return null;

                const quizList = (Array.isArray(data.quizzes) && data.quizzes.length > 0)
                    ? data.quizzes
                    : [{ question: data.question, options: data.options || [], answer: data.answer, translation: data.translation }];
                if (quizList.length === 0) return null;
                return quizList[Math.floor(Math.random() * quizList.length)];
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
                    const q = this.resolveCollocationTutoringQuiz(data) || {
                        question: data.question,
                        options: data.options || [],
                        answer: data.answer,
                        translation: data.translation
                    };

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

        const getDefaultBlessingUses = () =>
            (typeof GAME_CONSTANTS !== 'undefined' && GAME_CONSTANTS.DEFAULT_BLESSING_USES)
                ? GAME_CONSTANTS.DEFAULT_BLESSING_USES
                : 3;

        /**
         * Main-page image model.
         *
         * Image source selection and browser load/error handling intentionally
         * stay in index.html. Data and battle modules pass entities only; they do
         * not know how image files are named or displayed.
         */
        class ImageAssetManager {
            constructor() {
                this.requestIds = new WeakMap();
                this.sources = new WeakMap();
            }

            getEntitySource(entity) {
                if (typeof entity === 'string') return entity;
                if (!entity) return '';
                return entity.imageFile || `${entity.name}.png`;
            }

            load(img, entity, options = {}) {
                if (!img) return;

                const source = this.getEntitySource(entity);
                const parent = options.parent || null;
                img.alt = options.alt || (entity && entity.name) || '';
                if (this.sources.get(img) === source && !options.force) return;

                const requestId = (this.requestIds.get(img) || 0) + 1;
                this.requestIds.set(img, requestId);
                this.sources.set(img, source);

                if (!source) {
                    img.removeAttribute('src');
                    img.style.display = 'none';
                    if (parent && options.toggleParent) parent.style.display = 'none';
                    return;
                }

                // Load the real element once while hidden so failures never flash a broken icon.
                img.removeAttribute('src');
                img.style.display = 'none';
                if (parent && options.toggleParent) parent.style.display = 'none';
                img.onload = () => {
                    if (this.requestIds.get(img) !== requestId) return;
                    img.onload = null;
                    img.onerror = null;
                    img.style.display = 'block';
                    if (parent && options.toggleParent) parent.style.display = '';
                };
                img.onerror = () => {
                    if (this.requestIds.get(img) !== requestId) return;
                    img.onload = null;
                    img.onerror = null;
                    img.removeAttribute('src');
                    img.style.display = 'none';
                    if (parent && options.toggleParent) parent.style.display = 'none';
                };
                img.src = source;
            }

            createImage(entity, options = {}) {
                const img = document.createElement('img');
                if (options.className) img.className = options.className;
                if (options.style) img.style.cssText = options.style;
                this.load(img, entity, options);
                return img;
            }

            createPortrait(entity, options = {}) {
                const portrait = document.createElement(options.wrapperTag || 'div');
                portrait.className = options.wrapperClass || 'portrait';
                if (options.wrapperStyle) portrait.style.cssText = options.wrapperStyle;
                portrait.appendChild(this.createImage(entity, {
                    alt: options.alt,
                    style: options.imageStyle
                }));
                return portrait;
            }

            hydrate(root = document) {
                root.querySelectorAll('img[data-image-src]').forEach(img => {
                    const source = img.dataset.imageSrc;
                    if (img.dataset.loadedImageSrc === source) return;
                    img.dataset.loadedImageSrc = source;
                    this.load(img, source, { alt: img.alt });
                });
            }
        }

        /**
         * DOM-only renderer for monthly, weekly, and special missions.
         * Mission state is prepared by RPG; this class never mutates save data.
         */
        class MissionView {
            getElement(id) {
                return document.getElementById(id);
            }

            setReward(button, label, reward, onShowCard, emptyLabel = '보상이 없습니다') {
                label.textContent = reward ? reward.name : emptyLabel;
                button.disabled = !reward;
                button.style.opacity = reward ? '1' : '0.5';
                button.onclick = reward ? (() => onShowCard(reward.id)) : null;
            }

            renderMissionItems(container, missions, palette) {
                container.innerHTML = '';
                Object.values(missions || {}).forEach(mission => {
                    const cleared = (mission.progress || 0) >= mission.target;
                    const item = document.createElement('div');
                    item.style.padding = '10px';
                    item.style.marginBottom = '8px';
                    item.style.border = `1px solid ${cleared ? palette.border : '#555'}`;
                    item.style.borderRadius = '8px';
                    item.style.background = cleared ? palette.background : '#2a2a2a';

                    const title = document.createElement('div');
                    title.style.fontWeight = 'bold';
                    title.style.color = cleared ? palette.text : '#fff';
                    title.textContent = `${cleared ? '완료' : '진행'} · ${mission.label}`;

                    const progress = document.createElement('div');
                    progress.style.fontSize = '0.85rem';
                    progress.style.color = '#b0bec5';
                    progress.style.marginTop = '4px';
                    progress.textContent = `${mission.progress}/${mission.target}`;

                    item.appendChild(title);
                    item.appendChild(progress);
                    container.appendChild(item);
                });
            }

            renderLockedSpecial(container) {
                container.innerHTML = '';
                const message = document.createElement('div');
                message.style.cssText = 'padding:12px; border:1px solid #444; border-radius:8px; background:#2a2a2a; color:#aaa; font-size:0.85rem;';
                message.textContent = '꿈의회랑에서 창조신 아스테아를 돌파하면 확률적으로 스페셜 미션이 해금됩니다.';
                container.appendChild(message);
            }

            render(model) {
                const {
                    viewType,
                    monthly,
                    weekly,
                    special,
                    season,
                    reward,
                    specialReward,
                    weeklyRewardAmount,
                    monthlyAllClear,
                    weeklyAllClear,
                    specialAllClear,
                    onShowCard
                } = model;

                const title = this.getElement('mission-modal-title');
                const monthlySection = this.getElement('monthly-mission-section');
                const weeklySection = this.getElement('weekly-mission-section');
                const specialSection = this.getElement('special-mission-section');
                const monthlyList = this.getElement('monthly-mission-list');
                const weeklyList = this.getElement('weekly-mission-list');
                const specialList = this.getElement('special-mission-list');
                const monthlyClaim = this.getElement('btn-claim-monthly-mission');
                const weeklyClaim = this.getElement('btn-claim-weekly-mission');
                const specialClaim = this.getElement('btn-claim-special-mission');

                title.textContent = viewType === 'weekly'
                    ? '주간 미션'
                    : viewType === 'special' ? season.title : '월간 미션';
                monthlySection.style.display = viewType === 'monthly' ? 'block' : 'none';
                weeklySection.style.display = viewType === 'weekly' ? 'block' : 'none';
                specialSection.style.display = viewType === 'special' ? 'block' : 'none';

                this.getElement('monthly-mission-status').textContent = `${monthly.monthKey} 월 미션`;
                this.getElement('weekly-mission-status').textContent = `${weekly.weekLabel} 주간 미션`;
                this.getElement('special-mission-status').textContent = special.unlocked
                    ? `${season.title} · 시즌 보상 진행`
                    : `${season.title} · 아직 해금되지 않았습니다`;
                this.getElement('weekly-mission-reward-name').textContent = `카오스 티켓 ${weeklyRewardAmount}장`;

                this.setReward(
                    this.getElement('btn-monthly-mission-reward'),
                    this.getElement('monthly-mission-reward-name'),
                    reward,
                    onShowCard
                );
                this.setReward(
                    this.getElement('btn-special-mission-reward'),
                    this.getElement('special-mission-reward-name'),
                    specialReward,
                    onShowCard,
                    '해금된 스페셜 미션이 없습니다'
                );

                this.renderMissionItems(monthlyList, monthly.missions, {
                    border: '#66bb6a',
                    background: 'rgba(102, 187, 106, 0.12)',
                    text: '#a5d6a7'
                });
                this.renderMissionItems(weeklyList, weekly.missions, {
                    border: '#7e57c2',
                    background: 'rgba(126, 87, 194, 0.16)',
                    text: '#d1c4e9'
                });
                if (special.unlocked) {
                    this.renderMissionItems(specialList, special.missions, {
                        border: '#ffb74d',
                        background: 'rgba(255, 183, 77, 0.16)',
                        text: '#ffe0b2'
                    });
                } else {
                    this.renderLockedSpecial(specialList);
                }

                monthlyClaim.disabled = !monthlyAllClear || monthly.claimed || !reward;
                monthlyClaim.style.opacity = monthlyClaim.disabled ? '0.5' : '1';
                monthlyClaim.textContent = monthly.claimed ? '보상 수령 완료' : '보상받기';
                weeklyClaim.disabled = !weeklyAllClear || weekly.claimed;
                weeklyClaim.style.opacity = weeklyClaim.disabled ? '0.5' : '1';
                weeklyClaim.textContent = weekly.claimed ? '보상 수령 완료' : '보상받기';
                specialClaim.disabled = !special.unlocked || !specialAllClear || !specialReward;
                specialClaim.style.opacity = specialClaim.disabled ? '0.5' : '1';
                specialClaim.textContent = special.unlocked ? '보상받기' : '해금 전';
            }
        }

        const ImageAssets = new ImageAssetManager();
        const MissionScreen = new MissionView();

        /**
         * RPG composition root and browser UI entrypoint.
         * Pure calculations live in Logic; turn processing lives in BattleRuntime.
         */
        const RPG = {
            global: {
                unlocked_modes: ['origin'],
                unlocked_bonus_cards: [],
                unlocked_bonus_transcendence_cards: [],
                unlocked_divine_artifacts: [],
                achievements: { origin: false },
                chaosTickets: 0,
                chaosTicketVersion: 0,
                lastAttendanceDate: null,
                pendingTranscendenceCards: [],
                bonusPoolPresets: [null, null, null],
                activeBonusPoolPresetIndex: 0,
                tutoringEventEnabled: true,
                hiddenStudyReady: false,
                hiddenStudyPracticeCount: 0,
                monthlyMission: null,
                weeklyMission: null,
                specialMission: null,
                unlocked_special_cards: [],
                activeSpecialCardSelections: {},
                lumiSearchEnabled: true
            },

            // Run state persisted by SaveDataMigrator through saveGame().
            state: {
                mode: 'origin',
                tickets: 20,
                inventory: [],
                deck: [null, null, null],
                enemyScale: 0,
                chaosBlessingUses: getDefaultBlessingUses(),
                greatSageBlessingUses: getDefaultBlessingUses(),
                chaosBuffs: [], // Array of { id: cardId, multiplier: float } (Merged)
                activeChaosBlessing: [], // Specific buffs from Chaos Blessing
                activeSageBlessing: [],   // Specific buffs from Great Sage Blessing
                activeBonusPoolIds: [],
                activeSpecialCardSelections: {},
                quiz_stats: { correct: 0, total: 0 },
                pendingEnemyId: null,
                pendingEnemyStage: null,
                puzzlePiecesClaimed: false
            },

            // Battle State (Transient)
            battle: {
                turn: 1,
                players: [],
                enemy: null,
                fieldBuffs: [],
                currentPlayerIdx: 0,
                phase: 'start', // start, player-resolving, player-ready, enemy-pending, enemy-resolving
                delayedEffects: [],
                activeTraits: [], // List of active deck synergy traits
                isNewTurn: true
            },

            // UI Helper Variables
            selectedSlot: -1,
            tempOnClose: null,
            isApiLoading: false,
            pendingActiveBonusPoolIds: [],
            selectedSpecialCardGroup: null,
            lumiChatSessions: { general: null },
            activeLumiChatSessionKey: 'general',
            isLumiChatLoading: false,
            _featuresInstalled: false,

            // Constants
            NORMAL_ATTACK: { name: '일반 공격', type: 'phy', tier: 1, cost: 0, val: 1.0, desc: '기본 물리 공격', effects: [] },


            hydrateModules() {
                if (this._featuresInstalled) return;
                if (typeof RPGFeatureModules === 'undefined') return;
                RPGFeatureModules.install(this);
                this._featuresInstalled = true;
            },

            // --- Core Functions ---

            log(msg, type = 'info') {
                const box = document.getElementById('battle-log');
                const div = document.createElement('div');
                div.className = `log-line log-${type}`;
                div.innerHTML = msg;
                box.appendChild(div);
                box.scrollTop = box.scrollHeight;
            },

            getCardData(id) {
                return GameUtils.getCardById(id);
            },

            openMissionHub() {
                // Load from disk only if not yet loaded (title screen entry point)
                if (!this._globalLoaded && !this.loadGlobalData()) return;
                if (this._globalStorageBroken) return;
                this.ensureMonthlyMissionState();
                this.ensureWeeklyMissionState();
                this.ensureSpecialMissionState();
                this.renderMissionHub();
                document.getElementById('modal-mission-hub').classList.add('active');
            },

            closeMissionHub() {
                document.getElementById('modal-mission-hub').classList.remove('active');
            },

            renderMissionHub() {
                const list = document.getElementById('mission-hub-list');
                const season = this.getCurrentSpecialSeason();
                const buttons = [
                    {
                        title: '월간 미션',
                        desc: '월간 보너스 카드 보상을 확인합니다.',
                        style: 'border-color:#ffb74d; color:#ffcc80;',
                        handler: () => this.openMonthlyMission()
                    },
                    {
                        title: '주간 미션',
                        desc: '주간 카오스 티켓 보상을 확인합니다.',
                        style: 'border-color:#9575cd; color:#d1c4e9;',
                        handler: () => this.openWeeklyMission()
                    }
                ];

                if (this.isSpecialMissionVisible()) {
                    buttons.push({
                        title: season.title,
                        desc: `${season.bossName} 격파와 시즌 보상을 확인합니다.`,
                        style: 'border-color:#ff9800; color:#ffe0b2;',
                        handler: () => this.openSpecialMission()
                    });
                }

                list.innerHTML = '';
                buttons.forEach(item => {
                    const btn = document.createElement('button');
                    btn.className = 'menu-btn';
                    btn.style.cssText = `padding:12px; margin-bottom:0; ${item.style}`;
                    btn.innerHTML = `${item.title}<br><span style="font-size:0.8rem; color:#cfd8dc;">${item.desc}</span>`;
                    btn.onclick = item.handler;
                    list.appendChild(btn);
                });
            },

            openMonthlyMission() {
                this.closeMissionHub();
                this.missionViewType = 'monthly';
                this.renderMissionView();
                document.getElementById('modal-monthly-mission').classList.add('active');
            },

            openWeeklyMission() {
                this.closeMissionHub();
                this.missionViewType = 'weekly';
                this.renderMissionView();
                document.getElementById('modal-monthly-mission').classList.add('active');
            },

            openSpecialMission() {
                this.closeMissionHub();
                if (!this.isSpecialMissionVisible()) return this.showAlert("해금된 스페셜 미션이 없습니다.");
                this.missionViewType = 'special';
                this.renderMissionView();
                document.getElementById('modal-monthly-mission').classList.add('active');
            },

            closeMissionView() {
                document.getElementById('modal-monthly-mission').classList.remove('active');
            },

            renderMissionView() {
                const monthly = this.ensureMonthlyMissionState();
                const weekly = this.ensureWeeklyMissionState();
                const special = this.ensureSpecialMissionState();
                const season = this.getCurrentSpecialSeason();
                const reward = monthly.rewardCardId ? this.getCardData(monthly.rewardCardId) : null;
                const specialReward = special.rewardCardId ? this.getCardData(special.rewardCardId) : null;
                MissionScreen.render({
                    viewType: this.missionViewType || 'monthly',
                    monthly,
                    weekly,
                    special,
                    season,
                    reward,
                    specialReward,
                    weeklyRewardAmount: this.getWeeklyChaosTicketRewardAmount(),
                    monthlyAllClear: this.areAllMonthlyMissionsCleared(),
                    weeklyAllClear: this.areAllWeeklyMissionsCleared(),
                    specialAllClear: this.areAllSpecialMissionsCleared(),
                    onShowCard: id => this.showCardInfo(id)
                });
            },

            renderBonusPoolPresetButtons() {
                const container = document.getElementById('bonus-pool-preset-list');
                if (!container) return;

                this.ensureBonusPoolPresetState();
                const activeIndex = this.getActiveBonusPoolPresetIndex();
                const total = this.getUnlockedBonusCards().length;
                container.innerHTML = '';

                this.global.bonusPoolPresets.forEach((preset, index) => {
                    const btn = document.createElement('button');
                    const activeCount = this.getBonusPoolPresetIds(index).length;
                    btn.type = 'button';
                    btn.className = `bonus-preset-btn${index === activeIndex ? ' is-active' : ''}`;
                    btn.innerHTML = `세팅 ${index + 1}<span>${activeCount}/${total}</span>`;
                    btn.onclick = () => this.selectBonusPoolPreset(index);
                    container.appendChild(btn);
                });
            },

            closeBonusPoolEditor() {
                document.getElementById('modal-bonus-pool-editor').classList.remove('active');
                this.updateBonusPoolEditorButton();
            },

            updateBonusPoolEditorButton() {
                const btn = document.getElementById('btn-bonus-pool-editor');
                if (!btn) return;

                this.ensureBonusPoolPresetState();
                const total = this.getUnlockedBonusCards().length;
                const active = this.getBonusPoolPresetIds().length;
                const presetNo = this.getActiveBonusPoolPresetIndex() + 1;
                const subText = total > 0
                    ? `세팅 ${presetNo} 적용중 · 활성 ${active}/${total}`
                    : '해금된 보너스 카드가 없습니다';

                btn.innerHTML = `덱 편집<br><span style="font-size:0.8rem; color:#b3e5fc;">${subText}</span>`;
            },

            updateSpecialCardEditorButton() {
                const btn = document.getElementById('btn-special-card-editor');
                if (!btn) return;
                const hasSpecial = this.hasUnlockedSpecialCards && this.hasUnlockedSpecialCards();
                btn.style.display = hasSpecial ? 'block' : 'none';
            },

            openSpecialCardEditor() {
                this.updateSpecialCardEditorButton();
                if (!this.hasUnlockedSpecialCards()) {
                    return this.showAlert("획득한 스페셜 카드가 없습니다.");
                }

                const groups = this.getSpecialCardGroups();
                if (!this.selectedSpecialCardGroup || !groups.some(group => group.baseId === this.selectedSpecialCardGroup)) {
                    const firstOwnedGroup = this.getUnlockedSpecialCards()
                        .map(card => card.specialBaseId)
                        .find(baseId => groups.some(group => group.baseId === baseId));
                    this.selectedSpecialCardGroup = firstOwnedGroup || (groups[0] ? groups[0].baseId : null);
                }

                this.renderSpecialCardEditor();
                document.getElementById('modal-special-card-editor').classList.add('active');
            },

            closeSpecialCardEditor() {
                document.getElementById('modal-special-card-editor').classList.remove('active');
            },

            renderSpecialCardEditor() {
                const summary = document.getElementById('special-card-editor-summary');
                const groupList = document.getElementById('special-card-group-list');
                const list = document.getElementById('special-card-editor-list');
                const groups = this.getSpecialCardGroups();
                const ownedSpecialCards = this.getUnlockedSpecialCards();

                if (!this.selectedSpecialCardGroup && groups.length > 0) {
                    this.selectedSpecialCardGroup = groups[0].baseId;
                }

                groupList.innerHTML = '';
                groups.forEach(group => {
                    const ownedCount = ownedSpecialCards.filter(card => card.specialBaseId === group.baseId).length;
                    const btn = document.createElement('button');
                    btn.className = 'menu-btn';
                    btn.style.marginBottom = '0';
                    btn.style.padding = '10px';
                    btn.style.borderColor = group.baseId === this.selectedSpecialCardGroup ? '#ffd54f' : '#555';
                    btn.style.color = group.baseId === this.selectedSpecialCardGroup ? '#ffe082' : '#eee';
                    btn.innerHTML = `${group.label}<br><span style="font-size:0.75rem; color:#b0bec5;">스페셜 ${ownedCount}장</span>`;
                    btn.onclick = () => {
                        this.selectedSpecialCardGroup = group.baseId;
                        this.renderSpecialCardEditor();
                    };
                    groupList.appendChild(btn);
                });

                const activeGroup = groups.find(group => group.baseId === this.selectedSpecialCardGroup) || groups[0];
                if (!activeGroup) return;

                summary.innerText = `${activeGroup.label} · 기본 버전 또는 획득한 스페셜 버전 중 하나만 다음 런에 적용됩니다.`;
                const baseCard = this.getCardData(activeGroup.baseId);
                const specialCards = ownedSpecialCards
                    .filter(card => card.specialBaseId === activeGroup.baseId)
                    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
                const cards = [baseCard, ...specialCards].filter(Boolean);
                const selections = this.getActiveSpecialCardSelections('global');
                const activeCardId = selections[activeGroup.baseId] || activeGroup.baseId;

                list.innerHTML = '';
                cards.forEach(card => {
                    const isActive = activeCardId === card.id;
                    const item = document.createElement('div');
                    item.style.padding = '12px';
                    item.style.border = `1px solid ${isActive ? '#ffd54f' : '#555'}`;
                    item.style.borderRadius = '8px';
                    item.style.background = isActive ? 'rgba(255, 213, 79, 0.12)' : '#2a2a2a';
                    item.style.marginBottom = '8px';
                    item.innerHTML = `
                        <div style="font-weight:bold; color:${isActive ? '#ffe082' : '#fff'};">${card.name}</div>
                        <div style="font-size:0.78rem; color:#b0bec5; margin:4px 0 8px 0;">${card.grade.toUpperCase()} / ${card.role} / ${card.element}</div>
                    `;

                    const actionRow = document.createElement('div');
                    actionRow.style.display = 'flex';
                    actionRow.style.gap = '6px';

                    const useBtn = document.createElement('button');
                    useBtn.className = 'menu-btn';
                    useBtn.style.flex = '1';
                    useBtn.style.marginBottom = '0';
                    useBtn.style.padding = '8px';
                    useBtn.style.borderColor = isActive ? '#ffd54f' : '#66bb6a';
                    useBtn.style.color = isActive ? '#ffe082' : '#a5d6a7';
                    useBtn.innerText = isActive ? '사용중' : '사용';
                    useBtn.disabled = isActive;
                    useBtn.onclick = () => this.activateSpecialCardVersion(activeGroup.baseId, card.id);

                    const infoBtn = document.createElement('button');
                    infoBtn.className = 'menu-btn';
                    infoBtn.style.flex = '1';
                    infoBtn.style.marginBottom = '0';
                    infoBtn.style.padding = '8px';
                    infoBtn.innerText = '상세';
                    infoBtn.onclick = () => this.showCardInfo(card.id);

                    actionRow.appendChild(useBtn);
                    actionRow.appendChild(infoBtn);
                    item.appendChild(actionRow);
                    list.appendChild(item);
                });
            },

            activateSpecialCardVersion(baseId, cardId) {
                const nextSelections = { ...this.getActiveSpecialCardSelections('global') };

                if (cardId === baseId) {
                    delete nextSelections[baseId];
                } else {
                    const card = this.getCardData(cardId);
                    if (!card || !card.specialCard || card.specialBaseId !== baseId) {
                        return this.showAlert("잘못된 스페셜 카드 선택입니다.");
                    }
                    if (!(this.global.unlocked_special_cards || []).includes(cardId)) {
                        return this.showAlert("아직 획득하지 않은 스페셜 카드입니다.");
                    }
                    nextSelections[baseId] = cardId;
                }

                this.global.activeSpecialCardSelections = this.normalizeSpecialCardSelections(nextSelections);
                this.saveGlobalData();
                this.renderSpecialCardEditor();
            },

            openBonusPoolEditor() {
                this.syncPendingActiveBonusPoolIds();
                this.renderBonusPoolEditor();
                document.getElementById('modal-bonus-pool-editor').classList.add('active');
            },

            renderBonusPoolEditor() {
                const list = document.getElementById('bonus-pool-editor-list');
                const summary = document.getElementById('bonus-pool-editor-summary');
                const presetStatus = document.getElementById('bonus-pool-preset-status');
                const cards = this.sortCardDataByGrade(this.getUnlockedBonusCards());
                const activeIds = new Set(this.normalizeActiveBonusPoolIds(this.pendingActiveBonusPoolIds));
                const activePresetIndex = this.getActiveBonusPoolPresetIndex();

                this.pendingActiveBonusPoolIds = [...activeIds];
                this.renderBonusPoolPresetButtons();
                list.innerHTML = "";

                if (presetStatus) {
                    presetStatus.innerText = `다음 런 적용 세팅: ${activePresetIndex + 1}`;
                }

                if (cards.length === 0) {
                    summary.innerText = '해금된 보너스 카드가 없습니다.';
                    list.innerHTML = '<div style="padding:12px; border:1px solid #444; border-radius:8px; background:#2a2a2a; color:#aaa; font-size:0.85rem;">아직 해금된 보너스 카드가 없습니다.</div>';
                    return;
                }

                const maxActive = GAME_CONSTANTS.MAX_BONUS_POOL_ACTIVE || 15;
                summary.innerText = `세팅 ${activePresetIndex + 1} · 활성 ${activeIds.size} / ${cards.length} (최대 ${maxActive})`;

                const grid = document.createElement('div');
                grid.className = 'bonus-pool-grid';

                cards.forEach(card => {
                    const isActive = activeIds.has(card.id);
                    const item = document.createElement('label');
                    item.className = `bonus-pool-item${isActive ? '' : ' is-disabled'}`;
                    item.innerHTML = `
                        <div class="bonus-pool-name">${card.name}</div>
                        <div class="bonus-pool-grade">${card.grade.toUpperCase()} / ${card.role}</div>
                        <div class="bonus-pool-toggle">
                            <input type="checkbox" ${isActive ? 'checked' : ''}>
                            <span>사용</span>
                        </div>
                    `;
                    item.insertBefore(ImageAssets.createPortrait(card), item.firstChild);

                    const checkbox = item.querySelector('input');
                    checkbox.addEventListener('change', () => {
                        this.setPendingBonusCardActive(card.id, checkbox.checked);
                    });

                    grid.appendChild(item);
                });

                list.appendChild(grid);
            },

            setPendingBonusCardActive(cardId, isActive) {
                let ids = this.normalizeActiveBonusPoolIds(this.pendingActiveBonusPoolIds);
                const maxActive = GAME_CONSTANTS.MAX_BONUS_POOL_ACTIVE || 15;
                if (isActive) {
                    if (ids.length >= maxActive) {
                        this.showAlert(`보너스 카드는 최대 ${maxActive}장까지만 활성화할 수 있습니다.`);
                        this.renderBonusPoolEditor();
                        return;
                    }
                    if (!ids.includes(cardId)) ids.push(cardId);
                } else {
                    ids = ids.filter(id => id !== cardId);
                }
                this.pendingActiveBonusPoolIds = ids;
                this.persistPendingActiveBonusPoolIds();
                this.renderBonusPoolEditor();
                this.updateBonusPoolEditorButton();
            },

            resetBonusPoolSelection() {
                this.pendingActiveBonusPoolIds = [];
                this.persistPendingActiveBonusPoolIds();
                this.renderBonusPoolEditor();
                this.updateBonusPoolEditorButton();
            },

            randomizeBonusPoolSelection() {
                const unlockedCards = this.getUnlockedBonusCards();
                if (!unlockedCards || unlockedCards.length === 0) return;

                const maxActive = GAME_CONSTANTS.MAX_BONUS_POOL_ACTIVE || 15;
                const limit = Math.min(unlockedCards.length, maxActive);

                const shuffled = [...unlockedCards].sort(() => 0.5 - Math.random());
                const selectedIds = shuffled.slice(0, limit).map(card => card.id);

                this.pendingActiveBonusPoolIds = selectedIds;
                this.persistPendingActiveBonusPoolIds();
                this.renderBonusPoolEditor();
                this.updateBonusPoolEditorButton();
            },

            getMissingRequiredData() {
                const requiredData = [
                    { name: 'CARDS', ref: typeof CARDS !== 'undefined' ? CARDS : null },
                    { name: 'ENEMIES', ref: typeof ENEMIES !== 'undefined' ? ENEMIES : null },
                    { name: 'BONUS_CARDS', ref: typeof BONUS_CARDS !== 'undefined' ? BONUS_CARDS : null },
                    { name: 'TRANSCENDENCE_CARDS', ref: typeof TRANSCENDENCE_CARDS !== 'undefined' ? TRANSCENDENCE_CARDS : null },
                    { name: 'BONUS_TRANSCENDENCE_CARDS', ref: typeof BONUS_TRANSCENDENCE_CARDS !== 'undefined' ? BONUS_TRANSCENDENCE_CARDS : null },
                    { name: 'VOCAB_DATA', ref: typeof VOCAB_DATA !== 'undefined' ? VOCAB_DATA : null },
                    { name: 'COLLOCATION_DATA', ref: typeof COLLOCATION_DATA !== 'undefined' ? COLLOCATION_DATA : null },
                    { name: 'GRAMMAR_DATA', ref: typeof GRAMMAR_DATA !== 'undefined' ? GRAMMAR_DATA : null },
                    { name: 'Logic', ref: typeof Logic !== 'undefined' ? Logic : null },
                    { name: 'SideEffects', ref: typeof SideEffects !== 'undefined' ? SideEffects : null },
                    { name: 'GameUtils', ref: typeof GameUtils !== 'undefined' ? GameUtils : null },
                    { name: 'SaveDataMigrator', ref: typeof SaveDataMigrator !== 'undefined' ? SaveDataMigrator : null },
                    { name: 'BattleRuntime', ref: typeof BattleRuntime !== 'undefined' ? BattleRuntime : null },
                    { name: 'QuizEngine', ref: typeof QuizEngine !== 'undefined' ? QuizEngine : null },
                    { name: 'TOEIC_DATA', ref: typeof TOEIC_DATA !== 'undefined' ? TOEIC_DATA : null },
                    { name: 'GameAPI', ref: typeof GameAPI !== 'undefined' ? GameAPI : null },
                    { name: 'RPGFeatureModules', ref: typeof RPGFeatureModules !== 'undefined' ? RPGFeatureModules : null },
                    { name: 'LISTENING_DATA', ref: typeof LISTENING_DATA !== 'undefined' ? LISTENING_DATA : null },
                    { name: 'FortuneCookie', ref: typeof FortuneCookie !== 'undefined' ? FortuneCookie : null },
                    { name: 'MusicPlayer', ref: typeof MusicPlayer !== 'undefined' ? MusicPlayer : null }
                ];
                return requiredData.filter(d => !d.ref || (Array.isArray(d.ref) && d.ref.length === 0));
            },

            showInitialLoadFailure(message, detail) {
                const loading = document.getElementById('title-loading');
                if (!loading) return;

                loading.classList.remove('hidden');
                loading.innerHTML = '';

                const title = document.createElement('div');
                title.textContent = `⚠️ ${message}`;
                loading.appendChild(title);

                const hint = document.createElement('div');
                hint.style.cssText = 'font-size:0.8rem; color:#aaa; margin-top:4px;';
                hint.textContent = detail;
                loading.appendChild(hint);

                const retry = document.createElement('button');
                retry.textContent = '새로고침';
                retry.style.cssText = 'margin-top:8px; padding:8px 16px; border-radius:4px; border:1px solid #ff5252; background:#b71c1c; color:#fff; cursor:pointer; font-size:0.9rem;';
                retry.onclick = () => location.reload();
                loading.appendChild(retry);
            },

            setStartButtonsEnabled(enabled) {
                const btnNew = document.getElementById('btn-start-new');
                const btnLoad = document.getElementById('btn-start-load');
                const btnQuestion = document.getElementById('btn-title-question');
                const btnMission = document.getElementById('btn-title-mission');
                const btnFortune = document.getElementById('btn-fortune-cookie');
                const btnMusic = document.getElementById('btn-title-music');
                if (btnNew) btnNew.disabled = !enabled;
                if (btnLoad) btnLoad.disabled = !enabled;
                if (btnQuestion) btnQuestion.disabled = !enabled;
                if (btnMission) btnMission.disabled = !enabled;
                if (btnFortune) btnFortune.disabled = !enabled;
                if (btnMusic) btnMusic.disabled = !enabled;

                const loading = document.getElementById('title-loading');
                if (loading) {
                    if (enabled) {
                        loading.innerText = '⏳ 데이터 로딩 중... 잠시만 기다려주세요.';
                        loading.classList.add('hidden');
                    } else {
                        loading.classList.remove('hidden');
                    }
                }
            },

            waitForInitialDataLoad() {
                let attempts = 0;
                const loadingConfig = (typeof GAME_CONSTANTS !== 'undefined' && GAME_CONSTANTS.LOADING)
                    ? GAME_CONSTANTS.LOADING
                    : { MAX_ATTEMPTS: 200, POLLING_MS: 150 };
                const maxAttempts = loadingConfig.MAX_ATTEMPTS;
                const pollingMs = loadingConfig.POLLING_MS;

                const checkReady = () => {
                    // Do not declare success or failure until the sequential loader finishes.
                    if (!window._scriptLoadComplete) {
                        setTimeout(checkReady, pollingMs);
                        return;
                    }

                    if (window._scriptLoadErrors && window._scriptLoadErrors.length > 0) {
                        this.showInitialLoadFailure(
                            `스크립트 로드 실패: ${window._scriptLoadErrors.join(', ')}`,
                            '파일이 index.html과 같은 폴더에 있는지 확인해주세요.'
                        );
                        return;
                    }

                    const missing = this.getMissingRequiredData();
                    if (missing.length === 0) {
                        try {
                            this.hydrateModules();
                            if (!this._featuresInstalled) throw new Error('RPG 기능 설치가 완료되지 않았습니다.');
                            this.setStartButtonsEnabled(true);
                        } catch (error) {
                            console.error('[RPG] Initial module installation failed:', error);
                            this.showInitialLoadFailure(
                                '게임 초기화 실패',
                                error && error.message ? error.message : 'RPG 기능 모듈을 설치하지 못했습니다.'
                            );
                        }
                        return;
                    }

                    attempts++;
                    if (attempts >= maxAttempts) {
                        this.showInitialLoadFailure(
                            `로딩 시간 초과: ${missing.map(d => d.name).join(', ')}`,
                            '모든 .js 파일이 index.html과 같은 폴더에 있는지 확인해주세요.'
                        );
                        return;
                    }

                    // Update loading text with progress every 50 attempts
                    if (attempts % 50 === 0) {
                        const loading = document.getElementById('title-loading');
                        if (loading) {
                            const missing = this.getMissingRequiredData();
                            loading.innerText = `⏳ 데이터 로딩 중... (${missing.map(d => d.name).join(', ')} 대기)`;
                        }
                    }

                    setTimeout(checkReady, pollingMs);
                };

                this.setStartButtonsEnabled(false);
                checkReady();
            },

            openTypeSelect() {
                this.selectedModeId = null;
                this.resetPendingActiveBonusPoolIds();
                 this.updateSpecialCardEditorButton();
                document.getElementById('modal-type-select').classList.add('active');
            },

            backFromTypeSelect() {
                document.getElementById('modal-type-select').classList.remove('active');
                document.getElementById('modal-mode-select').classList.remove('active');
                document.getElementById('modal-bonus-pool-editor').classList.remove('active');
                document.getElementById('modal-special-card-editor').classList.remove('active');
                document.getElementById('modal-monthly-mission').classList.remove('active');
                this.toTitle();
            },

            selectGameType(type) {
                this.tempGameType = type;
                this.pendingActiveBonusPoolIds = this.normalizeActiveBonusPoolIds(this.pendingActiveBonusPoolIds);
                document.getElementById('modal-type-select').classList.remove('active');
                this.openModeSelect();
            },

            toggleHardMode() {
                this.hardModeActive = !this.hardModeActive;
                const hardBtn = document.getElementById('btn-hard-mode');
                if (hardBtn) {
                    if (this.hardModeActive) {
                        hardBtn.innerText = '하드모드 ON';
                        hardBtn.style.color = '#ffd700';
                        hardBtn.style.borderColor = '#ffd700';
                    } else {
                        hardBtn.innerText = '하드모드 OFF';
                        hardBtn.style.color = '#ff5252';
                        hardBtn.style.borderColor = '#ff5252';
                    }
                }
                if (this.selectedModeId) {
                    const btn = document.getElementById(`mode-btn-${this.selectedModeId}`);
                    if (btn) btn.click();
                }
            },

            openModeSelect() {
                this.selectedModeId = null;
                this.hardModeActive = false;
                const modal = document.getElementById('modal-mode-select');
                const list = document.getElementById('mode-list');
                const desc = document.getElementById('mode-desc');
                list.innerHTML = "";
                desc.innerText = "모드를 선택해주세요.";

                const chaosBtn = document.getElementById('btn-chaos-roulette');
                const hardBtn = document.getElementById('btn-hard-mode');
                if (chaosBtn) {
                    if (this.tempGameType === 'endless') {
                        chaosBtn.style.display = 'block';
                        if (hardBtn) hardBtn.style.display = 'none';
                    } else if (this.tempGameType === 'challenge') {
                        chaosBtn.style.display = 'none';
                        if (hardBtn) {
                            this.hardModeActive = false;
                            hardBtn.innerText = '하드모드 OFF';
                            hardBtn.style.color = '#ff5252';
                            hardBtn.style.borderColor = '#ff5252';
                            hardBtn.style.display = 'block';
                        }
                    } else {
                        chaosBtn.style.display = 'none';
                        if (hardBtn) hardBtn.style.display = 'none';
                    }
                }

                let MODES = [
                    { id: 'origin', name: '오리진', desc: '기본 모드.\n(성공조건: 없음 / 무한)' },
                    { id: 'restriction', name: '제약의 시련', desc: '뽑기/축복에서 레어 등급 이하만 등장.\n(성공조건: 18 스테이지)' },
                    { id: 'balance', name: '균형의 도전', desc: '뽑기/축복에서 에픽 등급 이하만 등장.\n(성공조건: 18 스테이지)' },
                    { id: 'suffering', name: '고난의 여정', desc: '초기 10장, 클리어 보상 없음, 축복 카드 +2장.\n(성공조건: 24 스테이지)' },
                    { id: 'puzzle', name: '퍼즐', desc: '시작 퀴즈로 정해진 카드 36장을 확보해 진행. 사용한 카드는 소멸, 크게 강화된 적 출현.\n(성공조건: 12 스테이지)' },
                    { id: 'archive', name: '아카이브', desc: '매 스테이지 종료 후 문법 퀴즈. 정답률 80% 이상 필요.\n(성공조건: 18 스테이지)' },
                    { id: 'curse', name: '저주의 증폭', desc: '디버프의 스탯 감소 효과 2배. 강화된 적 출현.\n(성공조건: 24 스테이지)' },
                    { id: 'flood', name: '축복의 범람', desc: '필드 버프의 강화 효과 2배. 강화된 적 출현.\n(성공조건: 24 스테이지)' },
                    { id: 'chaos', name: '카오스', desc: '매 전투 덱/인벤토리 초기화. 무작위 15장 풀에서 뽑기 진행.\n(성공조건: 24 스테이지 / 패배 시 데이터 삭제)' },
                    { id: 'artifact_chaos', name: '아티팩트카오스', desc: '카오스 기반 + 매 스테이지 랜덤 아티팩트 4개 추가 획득. 셔플 시 아티팩트도 초기화. 크게 강화된 적 출현.\n(성공조건: 24 스테이지 / 패배 시 데이터 삭제)' },
                    { id: 'draft', name: '드래프트', desc: '뽑기 대신 덱 빌딩(드래프트)으로 3명을 선발하여 전투.\n(성공조건: 24 스테이지 / 패배 시 데이터 삭제)' },
                    { id: 'factory', name: '팩토리', desc: '시작 시 40장의 카드를 번들 단위로 드래프트하여 덱 풀 구성.\n(성공조건: 24 스테이지 / 패배 시 데이터 삭제)' },
                    { id: 'artifact', name: '아티팩트', desc: '매 보스(창조신) 클리어 시 아티팩트 획득 (최대 4개). 아티팩트 효과로 전투를 유리하게! 강화된 적 출현.\n(성공조건: 30 스테이지)' },
                    { id: 'artifact_reserve', name: '아티팩트리저브', desc: '아티팩트 세트 선택 4회 반복으로 12개 풀 구성. 각 아티팩트는 2회 사용 가능, 전투 전 최대 4개 수동 활성화. 강화된 적 출현.\n(성공조건: 24 스테이지)' },
                    { id: 'perfect_plan', name: '퍼펙트플랜', desc: '해금된 전설/에픽/레어/노말에서 각 10장씩 골라 40장 전용 풀을 만든 뒤 오리진과 같이 진행. 강화된 적 출현(1.1배).\n(성공조건: 없음 / 무한)' }
                ];

                if (this.tempGameType === 'endless') {
                    MODES = MODES.filter(m => ['origin', 'draft', 'chaos', 'artifact', 'artifact_reserve', 'perfect_plan'].includes(m.id));
                    MODES.forEach(m => {
                        if (m.id === 'chaos') m.desc = '매 전투 덱/인벤토리 초기화. 무작위 15장 풀에서 뽑기 진행.\n(성공조건: 없음 / 무한 / 패배 시 데이터 삭제)';
                        if (m.id === 'draft') m.desc = '뽑기 대신 덱 빌딩(드래프트)으로 3명을 선발하여 전투.\n(성공조건: 없음 / 무한 / 패배 시 데이터 삭제)';
                        if (m.id === 'artifact') m.desc = '매 보스(창조신) 클리어 시 아티팩트 획득 (최대 4개). 아티팩트 효과로 전투를 유리하게! 강화된 적 출현.\n(성공조건: 없음 / 무한)';
                        if (m.id === 'artifact_reserve') m.desc = '아티팩트 세트 선택 4회 반복으로 12개 풀 구성. 각 아티팩트는 2회 사용 가능, 전투 전 최대 4개 수동 활성화. 강화된 적 출현.\n(성공조건: 없음 / 무한)';
                    });
                    if (this.global.hiddenStudyReady) {
                        MODES.push({
                            id: 'dream_corridor',
                            name: '꿈의회랑',
                            desc: '학습용 히든 엔드리스 모드. 전투 종료 후 퀴즈 자동 진행, 오답 3회까지 유예. (3회 오답 시 런 실패 / 오답 즉시 저장)\n(실전마법연습 3회로 출현)'
                        });
                    }
                } else if (this.tempGameType === 'challenge') {
                    MODES = MODES.filter(m => !['origin', 'archive'].includes(m.id) && m.id !== 'perfect_plan');
                } else {
                    // 신규 아티팩트 변형은 챌린지 전용이며, 리저브만 엔드리스에도 제공한다.
                    MODES = MODES.filter(m => !['artifact_chaos', 'artifact_reserve'].includes(m.id) && m.id !== 'perfect_plan');
                }

                MODES.forEach(m => {
                    const btn = document.createElement('button');
                    btn.className = "menu-btn";
                    btn.style.padding = "8px";
                    btn.style.fontSize = "0.8rem";
                    btn.innerText = m.name;
                    btn.id = `mode-btn-${m.id}`;

                    const isUnlocked = m.id === 'dream_corridor' || m.id === 'perfect_plan' || this.global.unlocked_modes.includes(m.id);
                    if (isUnlocked) {
                        const hardCleared = this.global.hardChallengeCleared && this.global.hardChallengeCleared[m.id];
                        if (this.tempGameType === 'challenge' && hardCleared) {
                            btn.style.color = "#ff5252";
                        } else {
                            btn.style.color = "#e040fb"; // Purple for unlocked
                        }
                    }

                    btn.onclick = () => {
                        this.selectedModeId = m.id;
                        let descText = m.desc;
                        
                        if (this.tempGameType === 'challenge') {
                            let steps = 0;
                            if (m.id === 'puzzle' || m.id === 'artifact_chaos') {
                                steps = 2;
                            } else if (['artifact', 'artifact_reserve', 'flood', 'curse'].includes(m.id)) {
                                steps = 1;
                            }
                            if (this.hardModeActive) {
                                steps += 2;
                            }
                            
                            let enhanceText = "";
                            if (steps === 1) enhanceText = "강화된 적 출현";
                            else if (steps === 2) enhanceText = "크게 강화된 적 출현";
                            else if (steps === 3) enhanceText = "대폭 강화된 적 출현";
                            else if (steps === 4) enhanceText = "최고로 강화된 적 출현";
                            
                            if (enhanceText) {
                                if (descText.includes("강화된 적 출현")) {
                                    descText = descText.replace(/(크게 |대폭 |최고로 )?강화된 적 출현\.?/g, enhanceText);
                                } else {
                                    descText = descText.replace(/\n\(성공조건:/, `\n(${enhanceText})\n(성공조건:`);
                                }
                            }
                        }

                        desc.innerText = `[${m.name}]\n${descText}`;

                        // Visual Update
                        list.querySelectorAll('.menu-btn').forEach(b => b.style.borderColor = '#555');
                        btn.style.borderColor = '#ffd700';
                    };
                    list.appendChild(btn);
                });

                // Enter Button Logic
                const enterBtn = document.getElementById('btn-enter-mode');
                enterBtn.onclick = () => {
                    if (!this.selectedModeId) return this.showAlert("모드를 선택해주세요.");
                    const mName = MODES.find(m => m.id === this.selectedModeId).name;
                    this.showDoubleConfirm(
                        `${mName} 모드로 시작하시겠습니까?`,
                        `정말 시작하시겠습니까?<br>현재 진행 중인 엔드리스 게임 데이터는 초기화됩니다.<br>(게임 시작 시 자동 저장됩니다)`,
                        () => {
                            this.initNewGame(this.selectedModeId);
                            modal.classList.remove('active');
                            if (!['factory', 'artifact_reserve', 'perfect_plan'].includes(this.selectedModeId)) {
                                this.toMenu();
                            }
                        }
                    );
                };

                modal.classList.add('active');
            },

            toMenu() {
                if (this.state.mode === 'perfect_plan' && this.state.perfectPlanDraft && this.state.perfectPlanDraft.active) {
                    return this.openPerfectPlanDraft();
                }
                this.clearToeicLumiQuestionSession({ abort: true, clearCurrentToeic: true });
                this.showScreen('screen-menu');
                document.getElementById('ui-tickets').innerText = this.state.tickets;
                this.ensureMonthlyMissionState();
                const nextEnemy = this.getCurrentStageEnemyData();
                document.getElementById('next-enemy-text').innerText = `${nextEnemy.name} [Stage ${this.state.enemyScale + 1}]`;
                const imgEl = document.getElementById('next-enemy-img');
                // image loaded dynamically or not at all depending on options
                imgEl.style.display = 'none';
                imgEl.parentElement.style.display = 'none';

                // Mode Specific Menu Areas
                const gachaArea = document.getElementById('menu-gacha-area');
                const draftArea = document.getElementById('menu-draft-area');
                const chaosArea = document.getElementById('menu-chaos-area');
                const menuArtifactBtn = document.getElementById('btn-menu-artifact-check');
                const normalGachaBtn = document.getElementById('btn-normal-gacha');
                const challengeGachaBtn = document.getElementById('btn-challenge-gacha');

                if (normalGachaBtn) {
                    normalGachaBtn.innerText = '일반 뽑기 (1장)';
                    normalGachaBtn.onclick = () => this.openGacha();
                }
                if (challengeGachaBtn) {
                    challengeGachaBtn.innerText = '도전 뽑기';
                    challengeGachaBtn.onclick = () => this.openChallengeGacha();
                }
                // Hide all first
                gachaArea.style.display = 'none';
                draftArea.style.display = 'none';
                if (chaosArea) chaosArea.style.display = 'none';
                if (menuArtifactBtn) menuArtifactBtn.style.display = 'none';

                if (this.state.mode === 'draft') {
                    draftArea.style.display = 'block';
                }
                else if (['chaos', 'artifact_chaos'].includes(this.state.mode)) {
                    if (chaosArea) chaosArea.style.display = 'flex';
                    if (menuArtifactBtn && this.state.mode === 'artifact_chaos') {
                        menuArtifactBtn.style.display = 'block';
                    }
                }
                else if (this.state.mode === 'puzzle') {
                    if (normalGachaBtn) {
                        normalGachaBtn.innerText = '퍼즐조각획득';
                        normalGachaBtn.onclick = () => this.openPuzzlePieces();
                    }
                    gachaArea.style.display = 'flex';
                }
                else {
                    gachaArea.style.display = 'flex';
                }

            },
            toTitle() {
                // Merely changing screens must not write or reinterpret run records.
                this.showScreen('screen-title');
            },
            showScreen(id) { document.querySelectorAll('.screen').forEach(el => el.classList.remove('active')); document.getElementById(id).classList.add('active'); },
            showBattleScreen() {
                this.showScreen('screen-battle');
                const artifactBtn = document.getElementById('btn-battle-artifact-check');
                const isArtifactMode = ['artifact', 'artifact_chaos', 'artifact_reserve'].includes(this.state.mode);
                if (artifactBtn) artifactBtn.style.display = isArtifactMode ? 'inline-block' : 'none';
            },
            clearBattleLog() { document.getElementById('battle-log').innerHTML = ""; },
            renderBattleView() { this.renderBattlefield(); },
            renderBattleControls(player) { this.setupControls(player); },

            openSystemMenu() {
                this.updateSystemMenuUI();
                document.getElementById('modal-menu').classList.add('active');
            },

            getGameFullscreenElement() {
                return document.fullscreenElement || null;
            },

            canUseGameFullscreen() {
                const root = document.documentElement;
                return !!(document.fullscreenEnabled && root && typeof root.requestFullscreen === 'function');
            },

            syncGameFullscreenButton() {
                const btn = document.getElementById('btn-game-fullscreen');
                if (!btn) return;
                if (!this.canUseGameFullscreen()) {
                    btn.disabled = true;
                    btn.textContent = '⛶ 전체화면 미지원';
                    btn.setAttribute('aria-pressed', 'false');
                    return;
                }
                const active = !!this.getGameFullscreenElement();
                btn.disabled = false;
                btn.textContent = active ? '⛶ 전체화면 종료' : '⛶ 전체화면';
                btn.setAttribute('aria-pressed', active ? 'true' : 'false');
            },

            async toggleGameFullscreen() {
                try {
                    if (this.getGameFullscreenElement()) {
                        if (typeof document.exitFullscreen === 'function') {
                            await document.exitFullscreen();
                        }
                        return;
                    }
                    const root = document.documentElement;
                    if (!this.canUseGameFullscreen()) {
                        console.warn('Fullscreen toggle failed: API unavailable');
                        this.syncGameFullscreenButton();
                        return;
                    }
                    try {
                        await root.requestFullscreen({ navigationUI: 'hide' });
                    } catch (error) {
                        await root.requestFullscreen();
                    }
                } catch (error) {
                    console.warn('Fullscreen toggle failed:', error);
                }
            },

            bindGameFullscreen() {
                if (this._fullscreenBound) return;
                this._fullscreenBound = true;
                document.addEventListener('fullscreenchange', () => this.syncGameFullscreenButton());
                this.syncGameFullscreenButton();
            },

            updateSystemMenuUI() {
                const btn = document.getElementById('btn-toggle-tutoring');
                if (btn) {
                    const isOn = this.global.tutoringEventEnabled !== false;
                    btn.innerText = `개인과외 이벤트: ${isOn ? 'ON' : 'OFF'}`;
                    btn.style.borderColor = isOn ? '#4caf50' : '#555';
                    btn.style.color = isOn ? '#fff' : '#aaa';
                }
            },

            openCardPoolViewer() {
                const mode = this.state.mode;
                let pool;

                if (GameUtils.usesLimitedCardPool(mode) && this.state.factoryPool && this.state.factoryPool.length > 0) {
                    // 팩토리/퍼펙트플랜: 드래프트된 40장 한정
                    pool = GameUtils.buildCardPool(this.global, {
                        factoryPool: this.state.factoryPool,
                        specialCardSelections: this.state.activeSpecialCardSelections
                    });
                } else if (['chaos', 'artifact_chaos'].includes(mode)) {
                    // 카오스: state.chaosPool (초월 포함 가능)
                    const ids = this.state.chaosPool || [];
                    pool = ids.map(id => this.getCardData(id)).filter(Boolean);
                } else {
                    // 통상/드래프트/아티팩트 등
                    const includeT = (mode === 'draft');
                    pool = GameUtils.buildCardPool(this.global, {
                        includeTranscendence: includeT,
                        activeTranscendenceCards: includeT ? this.state.activeTranscendenceCards : [],
                        activeBonusPoolIds: this.state.activeBonusPoolIds,
                        specialCardSelections: this.state.activeSpecialCardSelections,
                        activeEventCards: this.state.activeEventCards,
                        maxGrade: GameUtils.getMaxGradeForMode(mode)
                    });
                }

                // 등급 내림차순 정렬 (transcendence → legend → epic → rare → event → normal)
                const gradeDesc = { transcendence: 0, legend: 1, epic: 2, rare: 3, event: 4, normal: 5 };
                pool.sort((a, b) => {
                    const gd = (gradeDesc[a.grade] ?? 99) - (gradeDesc[b.grade] ?? 99);
                    return gd !== 0 ? gd : a.name.localeCompare(b.name, 'ko');
                });

                // Info text
                const modeLabel = { origin: '오리진', restriction: '제약의 시련', balance: '균형의 도전',
                    suffering: '고난의 여정', puzzle: '퍼즐', archive: '아카이브',
                    curse: '저주의 증폭', flood: '축복의 범람', chaos: '카오스', artifact_chaos: '아티팩트카오스',
                    draft: '드래프트', factory: '팩토리', artifact: '아티팩트', artifact_reserve: '아티팩트리저브',
                    overdrive: '오버드라이브', dream_corridor: '꿈의회랑', perfect_plan: '퍼펙트플랜' };
                const label = modeLabel[mode] || mode;
                document.getElementById('card-pool-info').innerText =
                    `현재 모드: ${label} | 풀 카드 수: ${pool.length}장`;

                // Render cards (pool viewer shows unique cards)
                const grid = document.getElementById('card-pool-grid');
                grid.innerHTML = '';
                for (const card of pool) {
                    const el = document.createElement('div');
                    el.className = `card-item ${card.grade}`;
                    el.appendChild(ImageAssets.createPortrait(card));
                    const label = document.createElement('div');
                    label.textContent = card.name;
                    el.appendChild(label);
                    el.onclick = () => this.showCardInfo(card.id);
                    grid.appendChild(el);
                }

                document.getElementById('modal-menu').classList.remove('active');
                document.getElementById('modal-card-pool').classList.add('active');
            },

            // --- Chaos Roulette ---
            openChaosRoulette() {
                // Only one full-screen chooser may intercept input at a time.
                document.getElementById('modal-mode-select').classList.remove('active');

                this.showScreen('screen-chaos-roulette');
                document.getElementById('ui-chaos-tickets').innerText = this.global.chaosTickets || 0;
            },

            spinChaosRoulette() {
                if ((this.global.chaosTickets || 0) < 1) return this.showAlert("티켓이 부족합니다.");

                let pool = this.buildChaosRoulettePool();

                if (pool.length === 0) return this.showAlert("이미 모든 초월 카드를 보유하고 있습니다. (다음 오리진 게임에서 사용하세요)");

                this.global.chaosTickets--;
                const pick = pool[Math.floor(Math.random() * pool.length)];
                this.global.pendingTranscendenceCards.push(pick.id);
                this.saveGlobalData();

                document.getElementById('ui-chaos-tickets').innerText = this.global.chaosTickets;

                const modal = document.getElementById('modal-gacha');
                const content = document.getElementById('gacha-result');
                document.getElementById('gacha-title').innerText = "초월 소환 성공!";
                content.innerHTML = `<div class="card-item transcendence" style="border:2px solid #ffd700; color:#ffd700; font-size:1.2rem; font-weight:bold; margin-bottom:10px; animation: glow-gold 2s infinite;">[초월] ${pick.name}</div>`;
                content.appendChild(ImageAssets.createPortrait(pick, {
                    wrapperStyle: 'width:120px; height:160px; margin:0 auto; border-color:#ffd700;'
                }));
                const resultMessage = document.createElement('p');
                resultMessage.textContent = '다음 오리진 게임 전설 풀에 추가되었습니다!';
                content.appendChild(resultMessage);
                modal.classList.add('active');
            },

            openTranscendenceCheck() {
                this.showScreen('screen-transcendence-check');
                this.renderCardList('transcendence-grid', this.global.pendingTranscendenceCards, (id) => this.showCardInfo(id));
            },

            // --- Chaos Blessing ---
            openChaosBlessing() {
                if (this.state.greatSageBlessingUses === undefined) this.state.greatSageBlessingUses = 3;
                document.getElementById('chaos-uses').innerText = this.state.chaosBlessingUses;
                document.getElementById('sage-uses').innerText = this.state.greatSageBlessingUses;

                const chaosModal = document.getElementById('modal-chaos');
                const isArtifactMode = ['artifact', 'artifact_chaos', 'artifact_reserve'].includes(this.state.mode);
                const isArtifactMobileLayout = isArtifactMode &&
                    (this.state.gameType === 'challenge' || this.state.gameType === 'endless');
                chaosModal.classList.toggle('artifact-mobile-compact', isArtifactMobileLayout);

                // Artifact variants expose their current artifact state here.
                const artBtn = document.getElementById('btn-artifact-check');
                const modal = document.getElementById('modal-chaos');
                const sageDesc = document.getElementById('great-sage-desc');
                if (artBtn) {
                    artBtn.style.display = isArtifactMode ? 'block' : 'none';
                    if (this.state.mode === 'artifact_chaos') {
                        artBtn.innerText = `현재 활성 아티팩트 (${(this.state.artifacts || []).length}/${GAME_CONSTANTS.MAX_ARTIFACTS})`;
                        artBtn.onclick = () => this.openArtifactCheck();
                    } else if (this.state.mode === 'artifact_reserve') {
                        if (this.state.artifactReserveDraft && this.state.artifactReserveDraft.active) {
                            artBtn.innerText = `아티팩트 리저브 선택 계속 (${this.state.artifactReserveDraft.round}/${this.state.artifactReserveDraft.maxRounds})`;
                            artBtn.onclick = () => {
                                document.getElementById('modal-chaos').classList.remove('active');
                                this.showScreen('screen-artifact-reserve-draft');
                                this.renderArtifactReserveDraftScreen();
                            };
                        } else {
                            artBtn.innerText = `아티팩트 풀 관리 (${(this.state.artifacts || []).length}/${GAME_CONSTANTS.MAX_ARTIFACTS} 활성)`;
                            artBtn.onclick = () => this.openArtifactCheck();
                        }
                    } else {
                        artBtn.innerText = '아티팩트 확인';
                        artBtn.onclick = () => this.openArtifactCheck();
                    }
                }
                if (sageDesc) {
                    sageDesc.innerText = this.state.mode === 'puzzle'
                        ? '문법 퀴즈 성공 시 12명에게 축복'
                        : '문법 퀴즈 성공 시 12명에게 축복 + 티켓 1장';
                }

                if (isArtifactMode) {
                    modal.classList.add('artifact-mode');
                } else {
                    modal.classList.remove('artifact-mode');
                }

                modal.classList.add('active');
                chaosModal.classList.add('active');
            },
            activateChaos(type) {
                if (type === 'great_sage') {
                    if (this.state.greatSageBlessingUses <= 0) {
                        return this.showAlert("대현자의 축복 기회를 모두 소진했습니다. (새로하기 시 리셋)");
                    }
                    document.getElementById('modal-chaos').classList.remove('active');

                    // Pick random quiz
                    let allQuizzes = [];
                    GRAMMAR_DATA.forEach(lec => {
                        allQuizzes = allQuizzes.concat(lec.quizzes);
                    });
                    let q = allQuizzes[Math.floor(Math.random() * allQuizzes.length)];

                    this.showConfirm(`이 문제는 ${q.lecture_id}강의 내용이야. 강의를 확인하고 풀래?`,
                        () => { // Yes
                            this.showLecture(q.lecture_id, () => {
                                this.startGrammarQuiz(q);
                            });
                        },
                        () => { // No
                            this.startGrammarQuiz(q);
                        }
                    );
                    return;
                }

                if (this.state.chaosBlessingUses <= 0) {
                    return this.showAlert("이번 전투 구간의 축복 기회를 모두 소진했습니다.");
                }
                document.getElementById('modal-chaos').classList.remove('active');

                // Mode Bonus
                let bonus = 0;
                if (this.state.mode === 'suffering') bonus = 2;
                if (this.state.mode === 'overdrive') bonus = 1;

                if (type === 'normal') {
                    this.applyChaosBlessing(3 + bonus);
                } else if (type === 'challenge') {
                    this.startChaosQuiz((success) => {
                        if (success) {
                            this.applyChaosBlessing(5 + bonus);
                        } else {
                            this.state.chaosBlessingUses--;
                            document.getElementById('chaos-uses').innerText = this.state.chaosBlessingUses;
                            this.showAlert("퀴즈 실패... 기회가 1회 차감되었습니다.");
                        }
                    });
                }
            },

            applyGreatSageBlessing() {
                this.state.greatSageBlessingUses--;
                // Update UI immediately
                document.getElementById('sage-uses').innerText = this.state.greatSageBlessingUses;

                const grantsTicket = this.state.mode !== 'puzzle';
                if (grantsTicket) {
                    this.state.tickets += GAME_CONSTANTS.BONUS_REWARDS.SAGE_BLESSING;
                    if (document.getElementById('ui-tickets')) document.getElementById('ui-tickets').innerText = this.state.tickets;
                }

                // Apply to 12 random cards
                let pool = GameUtils.buildCardPool(this.global, {
                    excludeTranscendence: true,
                    excludeEvent: true,
                    factoryPool: GameUtils.usesLimitedCardPool(this.state.mode) ? this.state.factoryPool : null,
                    activeBonusPoolIds: this.state.activeBonusPoolIds,
                    specialCardSelections: this.state.activeSpecialCardSelections,
                    maxGrade: GameUtils.getMaxGradeForMode(this.state.mode)
                });

                let picks = this.pickUniqueRandomCards(pool, GAME_CONSTANTS.SAGE_BLESSING_PICK_COUNT);

                this.state.activeChaosBlessing = []; // Clear Chaos Blessing

                let newBuffs = picks.map(c => {
                    let mult = 0;
                    if (c.grade === 'normal') mult = 0.4;
                    else if (c.grade === 'rare') mult = 0.3;
                    else if (c.grade === 'epic') mult = 0.2;
                    else if (c.grade === 'legend') mult = 0.1;
                    return { id: c.id, name: c.name, grade: c.grade, multiplier: mult, isSage: true };
                });
                newBuffs = this.sortBlessingsByGrade(newBuffs);

                // Set to activeSageBlessing (Replacing previous)
                this.state.activeSageBlessing = newBuffs;
                this.updateMergedBlessings();

                let msg = "<b>대현자의 축복 성공!</b><br>12명의 동료에게 축복이 내려졌습니다.<br>";
                if (grantsTicket) {
                    msg += "드로우 티켓 1장 획득!<br>";
                }
                msg += "<br><b>[새로 적용된 축복]</b><br>";
                newBuffs.forEach(b => {
                    msg += `[${b.name}] 올스탯 +${Math.round(b.multiplier * 100)}% 치명타/회피↑<br>`;
                });
                msg += `<br><b>(현재 총 활성화된 축복: ${this.state.chaosBuffs.length}개)</b>`;

                setTimeout(() => {
                    this.openInfoModal("축복 성공", msg);
                }, 200);
            },

            reshuffleChaosPool() {
                if (this.state.tickets < GAME_CONSTANTS.COSTS.CHAOS_SHUFFLE) {
                    return this.showAlert("셔플할 티켓이 부족합니다.");
                }

                const isArtifactChaos = this.state.mode === 'artifact_chaos';

                this.showDoubleConfirm(
                    `현재 보유한 모든 카드와 덱 구성${isArtifactChaos ? ', 활성 아티팩트' : ''}이 사라집니다.<br>
            티켓 1장을 사용하여 새로운 15장을 받으시겠습니까?`,
                    `정말 셔플하시겠습니까?<br>현재 덱과 인벤토리${isArtifactChaos ? ', 아티팩트' : ''}가 모두 초기화됩니다.`,
                    () => {
                        this.state.tickets -= GAME_CONSTANTS.COSTS.CHAOS_SHUFFLE;
                        document.getElementById('ui-tickets').innerText = this.state.tickets;

                        const artifactIds = isArtifactChaos
                            ? this.resetArtifactChaosRound()
                            : (() => {
                                this.state.deck = [null, null, null];
                                this.resetChaosRunPool();
                                return [];
                            })();
                        const newPicks = this.state.chaosPool || [];

                        this.saveGame(false);

                        let legendCnt = 0, epicCnt = 0;
                        newPicks.forEach(id => {
                            const c = this.getCardData(id);
                            if (c.grade === 'legend') legendCnt++;
                            if (c.grade === 'epic') epicCnt++;
                        });

                        const artifactText = artifactIds.length > 0
                            ? `<br><br><b>새 아티팩트 (${artifactIds.length}개)</b><br>${artifactIds.map(id => {
                                const artifact = GameUtils.getArtifactById(id);
                                return artifact ? `${artifact.name}: ${artifact.desc}` : id;
                            }).join('<br>')}`
                            : '';
                        this.showAlert(
                            `<b>${isArtifactChaos ? '아티팩트카오스' : '카오스'} 셔플 완료!</b><br><br>
                    새로운 15장이 지급되었습니다.<br>
                    (전설: ${legendCnt}, 에픽: ${epicCnt})${artifactText}<br><br>
                    * 덱이 초기화되었으니 다시 구성해주세요.`
                        );
                    }
                );
            },

            openPuzzlePieces() {
                if (this.state.mode !== 'puzzle') return this.openGacha();
                if (this.state.puzzlePiecesClaimed) {
                    return this.showAlert("이미 퍼즐조각을 획득했습니다. 현재 카드풀로 스테이지를 진행해주세요.");
                }
                this.startPuzzlePieceQuiz();
            },

            startPuzzlePieceQuiz() {
                const puzzleConfig = GAME_CONSTANTS.PUZZLE || {};
                const total = puzzleConfig.QUIZ_COUNT || 10;
                let answered = 0;
                let correct = 0;

                const askNext = () => {
                    if (answered >= total) {
                        this.grantPuzzlePieceCards(correct, total);
                        return;
                    }

                    const config = QuizEngine.buildVocabQuiz((success) => {
                        answered++;
                        if (success) correct++;
                        askNext();
                    });
                    if (!config) return this.showAlert("단어 퀴즈 데이터가 없습니다.");

                    config.question = `[퍼즐조각 ${answered + 1}/${total}] ${config.question}`;
                    config.correctDelay = 500;
                    config.wrongDelay = 700;
                    QuizEngine.show(config);
                };

                askNext();
            },

            drawPuzzlePieceCards(useChallengeRates) {
                const puzzleConfig = GAME_CONSTANTS.PUZZLE || {};
                const count = puzzleConfig.PIECE_COUNT || 36;
                const pool = GameUtils.buildCardPool(this.global, {
                    factoryPool: GameUtils.usesLimitedCardPool(this.state.mode) ? this.state.factoryPool : null,
                    activeBonusPoolIds: this.state.activeBonusPoolIds,
                    specialCardSelections: this.state.activeSpecialCardSelections
                });
                if (pool.length === 0) return [];

                const picks = [];
                for (let i = 0; i < count; i++) {
                    const grade = GameUtils.resolveGachaGrade('puzzle', useChallengeRates);
                    let gradePool = pool.filter(card => card.grade === grade);
                    if (gradePool.length === 0) gradePool = pool.filter(card => card.grade === 'normal');
                    if (gradePool.length === 0) gradePool = pool;
                    const pick = gradePool[Math.floor(Math.random() * gradePool.length)];
                    picks.push(pick.id);
                }
                return picks;
            },

            grantPuzzlePieceCards(correct, total) {
                const puzzleConfig = GAME_CONSTANTS.PUZZLE || {};
                const threshold = puzzleConfig.CHALLENGE_RATE_THRESHOLD || 0.7;
                const rate = total > 0 ? correct / total : 0;
                const useChallengeRates = rate >= threshold;
                const picks = this.drawPuzzlePieceCards(useChallengeRates);
                if (picks.length === 0) return this.showAlert("획득 가능한 카드풀이 없습니다.");

                this.state.puzzlePiecesClaimed = true;
                this.state.chaosPool = [...picks];
                this.state.inventory = [...picks];
                this.state.deck = [null, null, null];
                this.saveGame(false);

                const summary = { normal: 0, rare: 0, epic: 0, legend: 0 };
                picks.forEach(id => {
                    const card = this.getCardData(id);
                    if (card && summary[card.grade] !== undefined) summary[card.grade]++;
                });

                const rateText = (rate * 100).toFixed(0);
                const rateName = useChallengeRates ? '도전뽑기 확률' : '일반뽑기 확률';
                this.openInfoModal(
                    "퍼즐조각획득",
                    `단어 퀴즈 결과: ${correct}/${total} (${rateText}%)<br>` +
                    `${rateName}로 카드 36장을 획득했습니다.<br><br>` +
                    `NORMAL ${summary.normal} / RARE ${summary.rare} / EPIC ${summary.epic} / LEGEND ${summary.legend}<br><br>` +
                    `덱 3장을 모두 채워 전투에 입장하세요.`,
                    () => this.toMenu()
                );
            },

            openGacha() {
                if (this.state.mode === 'puzzle') return this.openPuzzlePieces();
                if (this.state.tickets < GAME_CONSTANTS.COSTS.GACHA_SINGLE) return this.showAlert("티켓이 부족합니다.");
                this.state.tickets -= GAME_CONSTANTS.COSTS.GACHA_SINGLE;
                this.runGacha(false);
            },

            openChallengeGacha() {
                if (this.state.tickets < GAME_CONSTANTS.COSTS.GACHA_SINGLE) return this.showAlert("티켓이 부족합니다.");

                // 티켓 선차감
                this.state.tickets -= GAME_CONSTANTS.COSTS.GACHA_SINGLE;
                document.getElementById('ui-tickets').innerText = this.state.tickets;

                this.startQuiz((success) => {
                    if (success) {
                        this.runGacha(true);
                    } else {
                        this.showAlert("퀴즈 실패! (티켓이 소모되었습니다)");
                    }
                });
            },

            runGacha(isChallenge) {
                document.getElementById('ui-tickets').innerText = this.state.tickets;
                const mode = this.state.mode;

                // Determine Grade (data-driven via GACHA_RATES)
                let grade = GameUtils.resolveGachaGrade(mode, isChallenge);

                // Build Pool
                let pool = GameUtils.buildCardPool(this.global, {
                    factoryPool: GameUtils.usesLimitedCardPool(this.state.mode) ? this.state.factoryPool : null,
                    activeBonusPoolIds: this.state.activeBonusPoolIds,
                    specialCardSelections: this.state.activeSpecialCardSelections
                }).filter(card => card.grade === grade);


                if (pool.length === 0) {
                    // Fallback if pool is empty (e.g. no cards of that grade? Should not happen with standard set)
                    // But if Restriction mode and we rolled something else? Logic guarantees valid grade.
                    // If somehow empty, fallback to normal
                    console.error("Empty pool for grade: " + grade);
                    grade = 'normal';
                    pool = GameUtils.buildCardPool(this.global, {
                        factoryPool: GameUtils.usesLimitedCardPool(this.state.mode) ? this.state.factoryPool : null,
                        activeBonusPoolIds: this.state.activeBonusPoolIds,
                        specialCardSelections: this.state.activeSpecialCardSelections
                    }).filter(card => card.grade === 'normal');
                }

                const pick = pool[Math.floor(Math.random() * pool.length)];
                this.state.inventory.push(pick.id);

                const modal = document.getElementById('modal-gacha');
                const content = document.getElementById('gacha-result');
                let color = '#bdbdbd', title = "획득!";
                if (pick.grade === 'transcendence') { color = '#ffd700'; title = "🌟 초월 카드 강림! 🌟"; }
                else if (grade === 'legend') { color = '#ff5252'; title = "🎉 대박! 전설 카드! 🎉"; }
                else if (grade === 'epic') { color = '#e040fb'; title = "✨ 에픽 카드! ✨"; }

                let msgTitle = isChallenge ? "도전 뽑기 성공!" : "획득!";
                if (pick.grade === 'transcendence') msgTitle = title;
                document.getElementById('gacha-title').innerText = msgTitle;
                content.innerHTML = `<div style="color:${color}; font-size:1.2rem; font-weight:bold; margin-bottom:10px;">[${pick.grade.toUpperCase()}] ${pick.name}</div>`;
                content.appendChild(ImageAssets.createPortrait(pick, {
                    wrapperStyle: 'width:120px; height:160px; margin:0 auto;'
                }));
                const resultMessage = document.createElement('p');
                resultMessage.textContent = '새로운 동료를 얻었습니다!';
                content.appendChild(resultMessage);
                modal.classList.add('active');
            },

            // --- Library & Lecture ---
            openLibrary() {
                document.getElementById('modal-library').classList.add('active');
            },
            openMagicClass() {
                document.getElementById('modal-library').classList.remove('active');
                const list = document.getElementById('lecture-list');
                list.innerHTML = "";
                GRAMMAR_DATA.forEach(lec => {
                    const btn = document.createElement('button');
                    btn.className = "menu-btn";
                    btn.innerText = `${lec.id}강. ${lec.title}`;
                    btn.onclick = () => this.showLecture(lec.id);
                    list.appendChild(btn);
                });
                document.getElementById('modal-magic-class').classList.add('active');
            },
            showLecture(id, onCloseCallback) {
                const lec = GRAMMAR_DATA.find(l => l.id === id);
                if (!lec) return;
                document.getElementById('lecture-title').innerText = `${lec.id}강. ${lec.title}`;
                document.getElementById('lecture-content').innerText = lec.content;

                // Setup close button to handle callback if provided (for quiz flow)
                // We override the onclick of the close button inside modal-lecture-view dynamically if needed,
                // or just use a temporary callback variable.
                const modal = document.getElementById('modal-lecture-view');

                // This is a bit hacky for the callback, but simplest given the structure.
                // We will store the callback in RPG.tempLectureClose
                this.tempLectureClose = onCloseCallback;

                modal.classList.add('active');
            },
            closeLectureView() {
                document.getElementById('modal-lecture-view').classList.remove('active');
                const cb = this.tempLectureClose;
                this.tempLectureClose = null;
                if (cb) {
                    cb();
                }
            },

            // --- Wordbook & Quiz ---
            openWordbook() {
                document.getElementById('modal-library').classList.remove('active');
                if (['chaos', 'artifact_chaos', 'draft'].includes(this.state.mode)) {
                    this.openCollocationBook();
                    return;
                }

                document.querySelector('#modal-wordbook h3').innerText = "단어장"; // Reset title
                if (!this.state.wrongWords) this.state.wrongWords = [];
                const list = document.getElementById('wordbook-list');
                list.innerHTML = "";

                const onlyWrong = document.getElementById('wordbook-filter-wrong').checked;

                VOCAB_DATA.forEach(v => {
                    const isWrong = this.state.wrongWords.includes(v.word);

                    // Filter logic
                    if (onlyWrong && !isWrong) return;

                    const div = document.createElement('div');
                    div.style.marginBottom = "10px";
                    div.style.borderBottom = "1px solid #444";
                    div.style.paddingBottom = "5px";

                    // Apply red color if wrong
                    const wordColor = isWrong ? '#ef5350' : '#81d4fa';

                    div.innerHTML = `<b style="color:${wordColor}; font-size:1.1rem;">${v.word}</b><br>
                             <span style="color:#eee;">${v.meaning}</span>`;
                    list.appendChild(div);
                });
                document.getElementById('modal-wordbook').classList.add('active');
            },

            resetWrongWords() {
                if (['chaos', 'artifact_chaos', 'draft'].includes(this.state.mode)) {
                    this.state.wrongCollocations = [];
                    Storage.remove(Storage.keys.COLLOCATION);
                    this.showAlert("숙어/구동사 복습 상태가 초기화되었습니다.");
                    this.openCollocationBook();
                    return;
                }

                this.state.wrongWords = [];
                Storage.remove(Storage.keys.VOCAB);
                this.showAlert("복습 상태가 초기화되었습니다.");
                this.openWordbook(); // Re-render
            },

            openCollocationBook() {
                if (!this.state.wrongCollocations) this.state.wrongCollocations = [];
                const list = document.getElementById('wordbook-list');
                list.innerHTML = "";

                const onlyWrong = document.getElementById('wordbook-filter-wrong').checked;

                COLLOCATION_DATA.forEach(v => {
                    const isWrong = this.state.wrongCollocations.includes(v.id);

                    if (onlyWrong && !isWrong) return;

                    const div = document.createElement('div');
                    div.style.marginBottom = "10px";
                    div.style.borderBottom = "1px solid #444";
                    div.style.paddingBottom = "5px";

                    const color = isWrong ? '#ef5350' : '#81d4fa';

                    div.innerHTML = `<b style="color:${color}; font-size:1.1rem;">${v.expression}</b><br>
                             <span style="color:#eee;">${v.meaning}</span>`;
                    list.appendChild(div);
                });

                document.querySelector('#modal-wordbook h3').innerText = "숙어/구동사 단어장";
                document.getElementById('modal-wordbook').classList.add('active');
            },

            closeGachaModal() { document.getElementById('modal-gacha').classList.remove('active'); },

            openCollection() { this.showScreen('screen-collection'); this.renderCardList('collection-grid', this.state.inventory, (id) => this.showCardInfo(id)); },

            renderCardList(containerId, list, clickHandler) {
                const box = document.getElementById(containerId);
                box.innerHTML = "";
                const counts = {};
                list.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
                const sortedIds = this.sortCardIdsByGrade(Object.keys(counts));
                for (const id of sortedIds) {
                    const data = this.getCardData(id);
                    if (!data) continue;
                    const el = document.createElement('div');
                    el.className = `card-item ${data.grade}`;
                    el.appendChild(ImageAssets.createPortrait(data));
                    const label = document.createElement('div');
                    label.textContent = `${data.name} (x${counts[id]})`;
                    el.appendChild(label);
                    el.onclick = () => clickHandler(id);
                    box.appendChild(el);
                }
            },

            showCardInfo(id) {
                const data = this.getCardData(id);
                if (!data) return;
                document.getElementById('md-name').innerText = data.name;
                ImageAssets.load(document.getElementById('md-img'), data);
                document.getElementById('md-grade').className = data.grade;
                document.getElementById('md-grade').innerText = `${data.grade.toUpperCase()} / ${data.role} / ${data.element}`;
                document.getElementById('md-stats').innerHTML = `HP:${data.stats.hp} ATK:${data.stats.atk} MATK:${data.stats.matk}<br>DEF:${data.stats.def} MDEF:${data.stats.mdef}`;
                let skills = `<p style="color:#ffd700; margin:5px 0;">[특성] ${data.trait.desc}</p>`;
                skills += `<p style="margin:2px 0;">[일반 공격] (Tier 1) 기본 물리 공격</p>`;
                data.skills.forEach(s => {
                    let multText = s.val ? ` (x${s.val})` : '';
                    skills += `<p style="margin:2px 0;">[${s.name}] (Tier ${s.tier}, MP:${s.cost}) ${s.desc}${multText}</p>`;
                });
                document.getElementById('md-skills').innerHTML = skills;
                document.getElementById('modal-card').classList.add('active');
            },
            closeModal() { document.getElementById('modal-card').classList.remove('active'); },

            openDeck() {
                this.showScreen('screen-deck');
                this.updateDeckSlots();
                this.selectedSlot = -1;
                this.renderCardList('deck-card-list', this.state.inventory, (id) => {
                    if (this.selectedSlot === -1) this.selectedSlot = this.state.deck.indexOf(null);
                    if (this.selectedSlot === -1) return this.showAlert("슬롯을 먼저 선택하거나 빈 슬롯이 없습니다.");
                    let total = this.state.inventory.filter(x => x === id).length;
                    let used = this.state.deck.filter(x => x === id).length;
                    if (this.state.deck[this.selectedSlot] === id) used--;
                    if (total - used <= 0) return this.showAlert("보유 수량이 부족합니다.");
                    this.state.deck[this.selectedSlot] = id;
                    this.updateDeckSlots();
                });
            },
            selectDeckSlot(idx) { this.selectedSlot = idx; document.querySelectorAll('.deck-slot').forEach((el, i) => { el.style.borderColor = i === idx ? '#ffd700' : '#555'; }); },
            updateDeckSlots() {
                ['선봉', '중견', '대장'].forEach((role, i) => {
                    const id = this.state.deck[i];
                    const el = document.getElementById(`slot-${i}`);
                    if (id) { const c = this.getCardData(id); el.innerText = `${role}: ${c.name}`; el.classList.add('filled'); }
                    else { el.innerText = `${role} (비어있음)`; el.classList.remove('filled'); }
                });
            },
            confirmDeck() {
                if (this.state.mode === 'puzzle' && this.state.deck.some(x => x === null)) {
                    return this.showAlert("퍼즐 모드는 덱 3장을 모두 채워야 합니다.");
                }
                if (this.state.deck.every(x => x === null)) return this.showAlert("최소 1장의 카드는 선택해야 합니다.");
                this.toMenu();
            },

            // --- Battle compatibility adapters ---
            // Keep existing HTML/console entrypoints stable; add new battle rules in BattleRuntime.

            startBattleInit() {
                return BattleRuntime.startBattleInit(this);
            },

            // --- Turn Manager ---
            TurnManager: {
                startPlayerTurn() {
                    return BattleRuntime.TurnManager.startPlayerTurn(RPG);
                },

                endPlayerTurn() {
                    return BattleRuntime.TurnManager.endPlayerTurn(RPG);
                },

                startEnemyTurn() {
                    return BattleRuntime.TurnManager.startEnemyTurn(RPG);
                },

                endEnemyTurn() {
                    return BattleRuntime.TurnManager.endEnemyTurn(RPG);
                }
            },

            handleDeathTraits(victim, killer) {
                return BattleRuntime.handleDeathTraits(this, victim, killer);
            },

            handleOnHitTraits(victim, attacker) {
                return BattleRuntime.handleOnHitTraits(this, victim, attacker);
            },

            maybeTriggerDeathRoulette(source, skill, isDelayed = false) {
                return BattleRuntime.maybeTriggerDeathRoulette(this, source, skill, isDelayed);
            },

            resolveSourceDeath(source, target) {
                return BattleRuntime.resolveSourceDeath(this, source, target);
            },

            hasActiveTrait(id) {
                return BattleRuntime.hasActiveTrait(this, id);
            },

            // --- Player Skill Execution ---

            executeSkill(source, target, skill, isDelayed = false) {
                return BattleRuntime.executeSkill(this, source, target, skill, isDelayed);
            },

            calcDamage(source, target, skill) {
                return BattleRuntime.calcDamage(this, source, target, skill);
            },

            applySkillEffects(source, target, skill) {
                return BattleRuntime.applySkillEffects(this, source, target, skill);
            },

            expireFieldBuffs(turn) {
                return BattleRuntime.expireFieldBuffs(this, turn);
            },

            applyFieldBuff(id, options = {}) {
                return BattleRuntime.applyFieldBuff(this, id, options);
            },

            // --- Setup & UI ---

            setupControls(p) {
                const panel = document.getElementById('battle-controls');
                panel.innerHTML = "";
                const executePlayerSkill = skill => {
                    panel.querySelectorAll('button').forEach(button => { button.disabled = true; });
                    RPG.executeSkill(p, RPG.battle.enemy, skill);
                };

                // Normal Attack
                const btn = document.createElement('button');
                btn.className = 'skill-btn phy';
                btn.innerHTML = `<span>일반공격</span><span style="color:#aaa">MP 0</span>`;
                btn.onclick = () => executePlayerSkill(RPG.NORMAL_ATTACK);
                panel.appendChild(btn);

                // Skills
                (p.skills || p.proto.skills).forEach(s => {
                    const btn = document.createElement('button');
                    btn.className = `skill-btn ${s.type}`;
                    btn.innerHTML = `<span>${s.name}</span><span style="color:#aaa">MP ${s.cost}</span>`;
                    if (p.mp < s.cost) btn.disabled = true;
                    else btn.onclick = () => executePlayerSkill(s);
                    panel.appendChild(btn);
                });
            },

            renderBattlefield() {
                const p = this.battle.players[this.battle.currentPlayerIdx];

                if (p && !p.isDead) {
                    document.getElementById('p-name').innerText = p.name;
                    const pImg = document.getElementById('p-img');
                    ImageAssets.load(pImg, p);

                    let hpPct = (p.hp / p.maxHp) * 100;
                    document.getElementById('p-hp-bar').style.width = `${Math.max(0, hpPct)}%`;
                    let mpPct = (p.mp / (p.maxMp || GAME_CONSTANTS.MAX_MP)) * 100;
                    document.getElementById('p-mp-bar').style.width = `${Math.max(0, mpPct)}%`;

                    let buffTxt = Object.keys(p.buffs).map(k => BUFF_NAMES[k] || k).join(',');
                    document.getElementById('p-buffs').innerText = buffTxt;
                    document.getElementById('player-actor-box').style.opacity = 1;
                } else {
                    document.getElementById('player-actor-box').style.opacity = 0;
                }

                const e = this.battle.enemy;
                let eHpPct = (e.hp / e.maxHp) * 100;
                document.getElementById('e-hp-bar').style.width = `${Math.max(0, eHpPct)}%`;
                document.getElementById('e-name').innerText = e.name;
                const eImg = document.getElementById('e-img');
                ImageAssets.load(eImg, e);

                let eBuffTxt = Object.keys(e.buffs).map(k => `${BUFF_NAMES[k] || k}${e.buffs[k] > 1 ? e.buffs[k] : ''}`).join(' ');
                document.getElementById('e-buffs').innerText = eBuffTxt;

                document.getElementById('bt-turn').innerText = this.battle.turn;
                document.getElementById('field-buff-box').innerHTML = this.battle.fieldBuffs.map(b => `[${BUFF_NAMES[b.name] || b.name}]`).join(" ");
            },

            renderFactoryDraftScreen() {
                const d = this.state.factoryDraft;
                document.getElementById('factory-round-text').innerText = `${d.round}/${d.maxRounds} 라운드`;

                const bundle0Container = document.getElementById('factory-bundle-0-cards');
                const bundle1Container = document.getElementById('factory-bundle-1-cards');
                bundle0Container.innerHTML = '';
                bundle1Container.innerHTML = '';

                const renderBundle = (bundle, container) => {
                    bundle.forEach(id => {
                        const card = this.getCardData(id);
                        if (!card) return;
                        const el = document.createElement('div');
                        el.className = 'card-item ' + card.grade;
                        el.style.display = 'flex';
                        el.style.alignItems = 'center';
                        el.style.gap = '5px';
                        el.style.padding = '3px';
                        el.style.fontSize = '0.85rem';
                        el.innerHTML = `
                            <div>
                                <div style="font-weight:bold;">${card.name}</div>
                                <div style="font-size:0.75rem; color:#ccc;">${card.role} / ${card.element}</div>
                            </div>
                        `;
                        el.insertBefore(ImageAssets.createImage(card, {
                            style: 'width:30px; height:40px; object-fit:cover; border:1px solid #777; border-radius:3px;'
                        }), el.firstChild);
                        container.appendChild(el);
                    });
                };

                if (d.currentBundles && d.currentBundles.length === 2) {
                    renderBundle(d.currentBundles[0], bundle0Container);
                    renderBundle(d.currentBundles[1], bundle1Container);
                }
            },

            renderArtifactReserveDraftScreen() {
                const draft = this.state.artifactReserveDraft;
                if (!draft) return;

                document.getElementById('artifact-reserve-round-text').innerText = `${draft.round}/${draft.maxRounds} 선택`;
                const containers = [
                    document.getElementById('artifact-reserve-bundle-0-items'),
                    document.getElementById('artifact-reserve-bundle-1-items')
                ];

                containers.forEach((container, index) => {
                    container.innerHTML = '';
                    const bundle = (draft.currentBundles || [])[index] || [];
                    bundle.forEach(id => {
                        const artifact = GameUtils.getArtifactById(id);
                        if (!artifact) return;
                        const entry = document.createElement('div');
                        entry.style.cssText = 'padding:7px; background:#302d1f; border:1px solid #6a5d18; border-radius:5px; text-align:left;';
                        entry.innerHTML = `<b style="color:#ffd700; font-size:0.83rem;">${artifact.name}</b><br><span style="color:#ddd; font-size:0.75rem; line-height:1.35;">${artifact.desc}</span>`;
                        container.appendChild(entry);
                    });
                });
            },

            openFactoryViewDeck() {
                const pool = this.state.factoryDraft.pool;
                document.getElementById('screen-factory-draft').classList.remove('active');
                this.showScreen('screen-collection');
                
                // Override back button behavior temporarily
                const collectionScreen = document.getElementById('screen-collection');
                const backBtn = collectionScreen.querySelector('button');
                const originalOnclick = backBtn.onclick;
                
                // Change title temporarily
                const titleEl = collectionScreen.querySelector('h3');
                const originalTitle = titleEl.innerText;
                titleEl.innerText = `현재 구성 중인 덱 (${pool.length}장)`;

                backBtn.onclick = () => {
                    this.showScreen('screen-factory-draft');
                    backBtn.onclick = originalOnclick;
                    titleEl.innerText = originalTitle;
                };

                this.renderCardList('collection-grid', pool, (id) => this.showCardInfo(id));
            },

            // --- Perfect Plan Draft Logic ---
            openPerfectPlanDraft() {
                this.showScreen('screen-perfect-plan-draft');
                this.renderPerfectPlanDraft();
            },

            renderPerfectPlanDraft() {
                const draft = this.state.perfectPlanDraft;
                if (!draft) return;
                const grades = (typeof GAME_CONSTANTS !== 'undefined' && GAME_CONSTANTS.PERFECT_PLAN)
                    ? GAME_CONSTANTS.PERFECT_PLAN.GRADES
                    : ['legend', 'epic', 'rare', 'normal'];
                const gradeNames = { legend: '전설', epic: '에픽', rare: '레어', normal: '노말' };
                const currentGrade = grades[draft.step] || 'legend';
                const gradeName = gradeNames[currentGrade] || currentGrade;
                const pool = this.getPerfectPlanGradePool(currentGrade);
                const required = this.getPerfectPlanRequiredCount(currentGrade);

                const stepText = document.getElementById('perfect-plan-step-text');
                const helpText = document.getElementById('perfect-plan-help');
                const grid = document.getElementById('perfect-plan-grid');
                const prevBtn = document.getElementById('btn-perfect-plan-prev');
                const nextBtn = document.getElementById('btn-perfect-plan-next');

                if (stepText) {
                    stepText.innerText = `${gradeName} ${draft.currentGradeSelected.length}/${required}`;
                }
                if (helpText) {
                    if (draft.step === grades.length - 1 && draft.currentGradeSelected.length === required) {
                        helpText.innerText = '다음을 누르면 모험이 시작됩니다.';
                    } else {
                        helpText.innerText = `해금된 ${gradeName} 카드에서 ${required}장을 선택하세요.`;
                    }
                }
                if (prevBtn) {
                    prevBtn.style.display = draft.step > 0 ? 'inline-block' : 'none';
                }
                if (nextBtn) {
                    nextBtn.innerText = draft.step === grades.length - 1 ? '시작' : '다음';
                }

                if (!grid) return;
                grid.innerHTML = '';

                const selectedSet = new Set(draft.currentGradeSelected);

                pool.forEach(card => {
                    const isChecked = selectedSet.has(card.id);
                    const item = document.createElement('label');
                    item.className = `bonus-pool-item${isChecked ? '' : ' is-disabled'}`;
                    item.innerHTML = `
                        <div class="bonus-pool-name">${card.name}</div>
                        <div class="bonus-pool-grade">${card.grade.toUpperCase()} / ${card.role}</div>
                        <div class="bonus-pool-toggle">
                            <input type="checkbox" ${isChecked ? 'checked' : ''}>
                            <span>선택</span>
                        </div>
                    `;
                    item.insertBefore(ImageAssets.createPortrait(card), item.firstChild);

                    const checkbox = item.querySelector('input');
                    checkbox.addEventListener('change', () => {
                        this.togglePerfectPlanCard(card.id, checkbox.checked);
                    });

                    grid.appendChild(item);
                });
            },

            togglePerfectPlanCard(cardId, isChecked) {
                const draft = this.state.perfectPlanDraft;
                if (!draft) return;
                const grades = (typeof GAME_CONSTANTS !== 'undefined' && GAME_CONSTANTS.PERFECT_PLAN)
                    ? GAME_CONSTANTS.PERFECT_PLAN.GRADES
                    : ['legend', 'epic', 'rare', 'normal'];
                const currentGrade = grades[draft.step] || 'legend';
                const required = this.getPerfectPlanRequiredCount(currentGrade);

                if (isChecked) {
                    if (draft.currentGradeSelected.length >= required) {
                        this.showAlert(`이 등급은 ${required}장까지 선택할 수 있습니다.`);
                        this.renderPerfectPlanDraft();
                        return;
                    }
                    if (!draft.currentGradeSelected.includes(cardId)) {
                        draft.currentGradeSelected.push(cardId);
                    }
                } else {
                    draft.currentGradeSelected = draft.currentGradeSelected.filter(id => id !== cardId);
                }
                this.saveGame(false);
                this.renderPerfectPlanDraft();
            },

            resetPerfectPlanCurrentGrade() {
                const draft = this.state.perfectPlanDraft;
                if (!draft) return;
                draft.currentGradeSelected = [];
                this.saveGame(false);
                this.renderPerfectPlanDraft();
            },

            confirmPerfectPlanCurrentGrade() {
                const draft = this.state.perfectPlanDraft;
                if (!draft) return;
                const grades = (typeof GAME_CONSTANTS !== 'undefined' && GAME_CONSTANTS.PERFECT_PLAN)
                    ? GAME_CONSTANTS.PERFECT_PLAN.GRADES
                    : ['legend', 'epic', 'rare', 'normal'];
                const currentGrade = grades[draft.step] || 'legend';
                const required = this.getPerfectPlanRequiredCount(currentGrade);

                if (draft.currentGradeSelected.length !== required) {
                    return this.showAlert(`정확히 ${required}장을 선택해야 합니다. (현재: ${draft.currentGradeSelected.length}장)`);
                }

                draft.selected.push(...draft.currentGradeSelected);
                draft.currentGradeSelected = [];
                draft.step++;

                if (draft.step >= grades.length) {
                    this.finishPerfectPlanDraft();
                } else {
                    this.saveGame(false);
                    this.renderPerfectPlanDraft();
                }
            },

            goPerfectPlanPrevStep() {
                const draft = this.state.perfectPlanDraft;
                if (!draft || draft.step <= 0) return;
                const grades = (typeof GAME_CONSTANTS !== 'undefined' && GAME_CONSTANTS.PERFECT_PLAN)
                    ? GAME_CONSTANTS.PERFECT_PLAN.GRADES
                    : ['legend', 'epic', 'rare', 'normal'];

                draft.step--;
                const prevGrade = grades[draft.step];
                const prevRequired = this.getPerfectPlanRequiredCount(prevGrade);

                draft.currentGradeSelected = draft.selected.slice(-prevRequired);
                draft.selected = draft.selected.slice(0, -prevRequired);
                this.saveGame(false);
                this.renderPerfectPlanDraft();
            },

            finishPerfectPlanDraft() {
                this.state.perfectPlanDraft.active = false;
                this.state.factoryPool = [...this.state.perfectPlanDraft.selected];
                this.state.inventory = [...(this.state.activeTranscendenceCards || [])];
                this.state.deck = [null, null, null];
                this.saveGame(false);

                let msg = '퍼펙트플랜 구성이 완료되었습니다!<br>방금 고른 40장의 전용 풀을 바탕으로 모험을 시작합니다.';
                if (this.state.activeTranscendenceCards && this.state.activeTranscendenceCards.length > 0) {
                    msg += `<br><br>초월 카드 ${this.state.activeTranscendenceCards.length}장이 인벤토리에 합류했습니다!`;
                }
                this.showAlert(msg);
                this.toMenu();
            },

            // --- Draft Logic ---
            renderDraftScreen() {
                const d = this.state.draft;
                const roles = ['선봉', '중견', '대장'];
                let roundText = roles[d.round] + ` (${d.round + 1}/3)`;
                document.getElementById('draft-round-text').innerText = roundText;
                document.getElementById('draft-reroll-cnt').innerText = d.rerolls;

                if (!d.currentOptions || d.currentOptions.length === 0) {
                    this.generateDraftOptions();
                }

                const grid = document.getElementById('draft-grid');
                grid.innerHTML = "";

                d.currentOptions.forEach(id => {
                    const card = this.getCardData(id);
                    const el = document.createElement('div');
                    let color = '#bdbdbd';
                    if (card.grade === 'legend') color = '#ff5252';
                    else if (card.grade === 'epic') color = '#e040fb';
                    else if (card.grade === 'rare') color = '#448aff';

                    el.className = `card-item ${card.grade}`;
                    el.style.height = "160px";
                    el.style.display = "flex";
                    el.style.flexDirection = "column";
                    el.style.borderColor = color;

                    el.innerHTML = `
                <div style="font-size:0.9rem; font-weight:bold; margin-bottom:5px; color:${color}">${card.name}</div>
                <div style="display:flex; gap:2px; width:100%;">
                    <button onclick="event.stopPropagation(); RPG.showCardInfo('${card.id}')" style="flex:1; font-size:0.7rem; padding:3px; background:#444; color:#fff; border:1px solid #666;">상세</button>
                    <button onclick="event.stopPropagation(); RPG.selectDraftCard('${card.id}')" style="flex:2; font-size:0.7rem; padding:3px; background:#1b5e20; color:#fff; border:1px solid #4caf50;">선택</button>
                </div>
            `;
                    el.insertBefore(ImageAssets.createPortrait(card, {
                        wrapperStyle: 'flex:1; margin-bottom:5px; width:100%;'
                    }), el.children[1]);
                    grid.appendChild(el);
                });
            },

            rerollDraft() {
                if (this.state.draft.rerolls > 0) {
                    this.state.draft.rerolls--;
                    this.state.draft.currentOptions = [];
                    this.renderDraftScreen();
                } else {
                    if (this.state.tickets >= GAME_CONSTANTS.COSTS.DRAFT_REROLL_WITH_TICKET) {
                        this.showConfirm(`무료 리롤 횟수가 없습니다.<br>티켓 ${GAME_CONSTANTS.COSTS.DRAFT_REROLL_WITH_TICKET}장을 사용하여 리롤하시겠습니까?<br>(보유 티켓: ${this.state.tickets})`, () => {
                            this.state.tickets -= GAME_CONSTANTS.COSTS.DRAFT_REROLL_WITH_TICKET;
                            document.getElementById('ui-tickets').innerText = this.state.tickets;
                            this.state.draft.currentOptions = [];
                            this.renderDraftScreen();
                        });
                    } else {
                        this.showAlert("리롤 횟수와 티켓이 모두 부족합니다.");
                    }
                }
            },

            finishWinBattle(deadMsg, gameClear, quizResult) {
                let msg = "승리!<br>보상을 획득했습니다.";

                if (quizResult !== null) {
                    let correct = this.state.quiz_stats.correct;
                    let total = this.state.quiz_stats.total;
                    let rate = (total > 0) ? ((correct / total) * 100).toFixed(1) : "0.0";
                    let resultMsg = quizResult ? "<span style='color:#4caf50'>정답!</span>" : "<span style='color:#ef5350'>오답...</span>";
                    msg = `[퀴즈 결과] ${resultMsg}<br>현황: ${correct}/${total} (${rate}%)<hr>` + msg;
                }

                if (this.state.mode === 'chaos') msg += "<br><br>카오스 모드: 덱과 인벤토리가 초기화되었습니다.";
                if (this.state.mode === 'artifact_chaos') msg += "<br><br>아티팩트카오스 모드: 덱과 인벤토리, 아티팩트가 초기화되었습니다.";
                if (this.state.mode === 'draft') msg += "<br><br>드래프트 모드: 덱과 인벤토리가 초기화되었습니다.";

                if (deadMsg) msg += "<br><br>" + deadMsg;

                if (gameClear) {
                    // Check Archive Condition
                    if (this.state.mode === 'archive') {
                        let rate = (this.state.quiz_stats.total > 0) ? (this.state.quiz_stats.correct / this.state.quiz_stats.total) : 0;
                        if (rate < 0.8) {
                            this.showAlert(`[실패] 아카이브 모드 클리어 실패!<br>정답률: ${(rate * 100).toFixed(1)}% (목표: 80% 이상)`);
                            this.toTitle();
                            return;
                        }
                    }

                    if (this.state.gameType === 'challenge') {
                        this.incrementMonthlyMissionProgress('challenge3', 1);
                        this.incrementWeeklyMissionProgress('challenge1', 1);
                        this.incrementSpecialMissionProgress('challenge3', 1);
                    }

                    // Transcendence Ticket Logic (On Clear)
                    if (this.state.gameType === 'challenge' && this.checkAllBonusUnlocked()) {
                        this.global.chaosTickets = (this.global.chaosTickets || 0) + 1;
                        this.saveGlobalData();
                        this.log("<b>[보너스]</b> 카오스 티켓 1장 획득!");
                    }

                    // Unlock Mode
                    if (!this.global.unlocked_modes.includes(this.state.mode)) {
                        this.global.unlocked_modes.push(this.state.mode);
                    }
                    this.global.achievements[this.state.mode] = true;

                    if (this.state.hardMode && this.state.gameType === 'challenge') {
                        if (!this.global.hardChallengeCleared) this.global.hardChallengeCleared = {};
                        this.global.hardChallengeCleared[this.state.mode] = true;
                    }

                    // Unlock Bonus Card
                    let newCard = null;
                    let lockedBonus = this.getStandardBonusCards().filter(c => !this.global.unlocked_bonus_cards.includes(c.id));
                    if (lockedBonus.length > 0) {
                        let pick = lockedBonus[Math.floor(Math.random() * lockedBonus.length)];
                        this.global.unlocked_bonus_cards.push(pick.id);
                        newCard = pick;
                    }

                    this.saveGlobalData();

                    msg = `🎉 <b>${this.state.mode.toUpperCase()} 모드 클리어!</b> 🎉<br><br>`;
                    if (newCard) msg += `[보상] 새로운 동료 해금: ${newCard.name}!<br>`;
                    else msg += `(이미 모든 보너스 카드를 획득했습니다)<br>`;

                    this.openInfoModal("게임 클리어", msg, () => {
                        this.toTitle();
                    });
                    return;
                }

                this.openInfoModal("전투 결과", msg, () => {
                    if (this.state.mode !== 'archive') {
                        if (this.state.mode === 'puzzle') {
                            this.showConfirm("추가 퀴즈에 도전하시겠습니까?\n(성공 시 다음 전투 혼돈의 축복 5회)",
                                () => {
                                    this.startQuiz((success) => {
                                        if (success) {
                                            const bonusUses = (GAME_CONSTANTS.PUZZLE && GAME_CONSTANTS.PUZZLE.BONUS_BLESSING_USES) || 5;
                                            this.state.chaosBlessingUses = bonusUses;
                                            this.showAlert(`정답! 다음 전투의 혼돈의 축복이 ${bonusUses}회로 증가합니다.`);
                                        } else {
                                            this.showAlert("오답입니다... 추가 효과는 없습니다.");
                                        }
                                        this.toMenu();
                                    });
                                },
                                () => {
                                    this.toMenu();
                                }
                            );
                        }
                        else if (['chaos', 'artifact_chaos', 'draft'].includes(this.state.mode)) {
                            this.showConfirm("추가 보상을 위한 콜로케이션 퀴즈에 도전하시겠습니까?\n(성공 시 드로우권 1장 획득)",
                                () => {
                                    this.startCollocationQuiz((success) => {
                                        if (success) {
                                            this.state.tickets += GAME_CONSTANTS.BONUS_REWARDS.QUIZ;
                                            document.getElementById('ui-tickets').innerText = this.state.tickets;
                                            this.showAlert("정답! 드로우권 1장을 추가로 획득했습니다.");
                                        } else {
                                            this.showAlert("오답입니다... 보상 없음.");
                                        }
                                        this.toMenu();
                                    });
                                },
                                () => {
                                    this.toMenu();
                                }
                            );
                        }
                        else if (this.battle.enemy.id === 'creator_god' && this.state.mode === 'artifact' && (this.state.artifacts || []).length < GAME_CONSTANTS.MAX_ARTIFACTS) {
                            // Artifact Mode: Quiz → Artifact Selection
                            this.showConfirm("창조신 격파 보너스! 문법 퀴즈에 도전하시겠습니까?\n(성공 시 아티팩트 획득 기회)",
                                () => { // Yes
                                    const q = this.getRandomGrammarQuiz();
                                    if (!q) {
                                        this.toMenu();
                                        return;
                                    }

                                    this.startGrammarQuiz(q,
                                        () => { // Success - Show artifact selection
                                            this.openArtifactSelect();
                                        },
                                        () => { // Fail
                                            this.showConfirm(`오답입니다... 관련 문법 강좌(${q.lecture_id}강)를 확인하시겠습니까?`,
                                                () => { // Yes
                                                    this.showLecture(q.lecture_id, () => {
                                                        this.toMenu();
                                                    });
                                                },
                                                () => { // No
                                                    this.toMenu();
                                                }
                                            );
                                        }
                                    );
                                },
                                () => { // No
                                    this.toMenu();
                                }
                            );
                        }
                        else if (this.battle.enemy.id === 'creator_god') {
                            this.showConfirm("창조신 격파 보너스! 문법 퀴즈에 도전하시겠습니까?\n(성공 시 뽑기권 3장 획득)",
                                () => { // Yes
                                    const q = this.getRandomGrammarQuiz();
                                    if (!q) {
                                        this.toMenu();
                                        return;
                                    }

                                    this.startGrammarQuiz(q,
                                        () => { // Success
                                            if (this.state.mode === 'puzzle') {
                                                const currentUses = Number.isFinite(this.state.greatSageBlessingUses)
                                                    ? this.state.greatSageBlessingUses
                                                    : GAME_CONSTANTS.DEFAULT_BLESSING_USES;
                                                this.state.greatSageBlessingUses = currentUses + 1;
                                                this.showAlert("정답! 대현자의 축복 상한이 1회 증가했습니다.");
                                            } else {
                                                this.state.tickets += GAME_CONSTANTS.BONUS_REWARDS.CREATOR_GOD_QUIZ;
                                                document.getElementById('ui-tickets').innerText = this.state.tickets;
                                                this.showAlert("정답! 드로우권 3장을 추가로 획득했습니다.");
                                            }
                                            this.toMenu();
                                        },
                                        () => { // Fail
                                            this.showConfirm(`오답입니다... 관련 문법 강좌(${q.lecture_id}강)를 확인하시겠습니까?`,
                                                () => { // Yes
                                                    this.showLecture(q.lecture_id, () => {
                                                        this.toMenu();
                                                    });
                                                },
                                                () => { // No
                                                    this.toMenu();
                                                }
                                            );
                                        }
                                    );
                                },
                                () => { // No
                                    this.toMenu();
                                }
                            );
                        } else {
                            this.showConfirm("추가 보상을 위한 퀴즈에 도전하시겠습니까?\n(성공 시 드로우권 1장 획득)",
                                () => {
                                    this.startQuiz((success) => {
                                        if (success) {
                                            this.state.tickets += GAME_CONSTANTS.BONUS_REWARDS.QUIZ;
                                            document.getElementById('ui-tickets').innerText = this.state.tickets;
                                            this.showAlert("정답! 드로우권 1장을 추가로 획득했습니다.");
                                        } else {
                                            this.showAlert("오답입니다... 보상 없음.");
                                        }
                                        this.toMenu();
                                    });
                                },
                                () => {
                                    this.toMenu();
                                }
                            );
                        }
                    } else {
                        if (quizResult === false && this.state.lastArchiveQuizLectureId) {
                            const lectureId = this.state.lastArchiveQuizLectureId;
                            this.showConfirm(`오답입니다... 관련 문법 강좌(${lectureId}강)를 확인하시겠습니까?`,
                                () => {
                                    this.showLecture(lectureId, () => {
                                        this.toMenu();
                                    });
                                },
                                () => {
                                    this.toMenu();
                                }
                            );
                        } else {
                            this.toMenu();
                        }
                    }
                });
            },

            showBattleStat(side, idx) {
                let char;
                if (side === 'player') char = this.battle.players[idx];
                else char = this.battle.enemy;
                if (!char) return;

                let buffs = Object.keys(char.buffs).map(k => {
                    let name = BUFF_NAMES[k] || k;
                    let val = char.buffs[k];
                    if (val === true) return name;
                    return `${name}(${val})`;
                }).join(', ') || '없음';

                const eff = Logic.calculateStats(char, this.battle.fieldBuffs, this.state.mode, this.state.artifacts || [], this.battle.turn || 1);

                // Use baseStatsWithoutBlessing if available to show Green for blessed stats
                const getBase = (key, fallback) => {
                    if (char.baseStatsWithoutBlessing && char.baseStatsWithoutBlessing[key] !== undefined) return char.baseStatsWithoutBlessing[key];
                    return fallback;
                };

                const colorize = (val, base) => {
                    if (val > base) return `<span style="color:#69f0ae">${val}</span>`;
                    if (val < base) return `<span style="color:#ff5252">${val}</span>`;
                    return `<span style="color:#eee">${val}</span>`;
                };

                let content = `<b>[${char.name}]</b><br>HP: ${char.hp}/${char.maxHp}<br>`;
                if (side === 'player') content += `MP: ${char.mp}/${char.maxMp || GAME_CONSTANTS.MAX_MP}<br>`;
                content += `ATK: ${colorize(eff.atk, getBase('atk', char.atk))} / MATK: ${colorize(eff.matk, getBase('matk', char.matk))}<br>`;
                content += `DEF: ${colorize(eff.def, getBase('def', char.def))} / MDEF: ${colorize(eff.mdef, getBase('mdef', char.mdef))}<br>`;
                content += `치명타율: ${colorize(eff.crit, (char.baseCrit || 10))}% / 회피율: ${colorize(eff.evasion, (char.baseEva || 0) + 5)}%<br>`;
                content += `상태: ${buffs}<br><br>`;

                if (side === 'player') {
                    content += `<b>[스킬]</b><br>`;
                    (char.skills || char.proto.skills).forEach(s => {
                        let multText = s.val ? ` (x${s.val})` : '';
                        content += `- ${s.name}: ${s.desc}${multText}<br>`;
                    });
                } else {
                    content += `<b>[스킬]</b><br>`;
                    char.skills.forEach(s => {
                        let multText = s.val ? ` (x${s.val})` : '';
                        content += `- ${s.name}: ${s.desc}${multText}<br>`;
                    });
                }
                this.openInfoModal(char.name, content);
            },

            showFieldBuffInfo() {
                if (this.battle.fieldBuffs.length === 0) return this.showAlert("활성화된 필드 버프가 없습니다.");
                const buffInfo = {
                    'sun_bless': '물공/마공 +30%, 치명타대미지 +60%',
                    'moon_bless': '마공 +30%, 회피율 +15%',
                    'sanctuary': '마공 +30%, 마방 +30%',
                    'goddess_descent': '물공/마공 +30%, 방어/마방 +30%',
                    'destiny_oath': '물공/마공 +30%, 방어/마방 +30%',
                    'earth_bless': '물공/마공 +25%',
                    'twinkle_party': '물공 +20%, 치명타율 +15%',
                    'star_powder': '방어/마방 +40%',
                    'valentine': '방어/마방 +50%',
                    'gale': '치명타율 +20%, 회피율 +20%',
                    'reaper_realm': '치명타율 +40%, 치명타대미지 +40%'
                };
                let msg = "";
                this.battle.fieldBuffs.forEach(b => {
                    msg += `<b>[${BUFF_NAMES[b.name]}]</b><br>${buffInfo[b.name] || ''}<br><br>`;
                });
                this.openInfoModal("필드 버프", msg);
            },

            openInfoModal(title, content, onClose = null) {
                document.getElementById('info-title').innerText = title;
                const infoContent = document.getElementById('info-content');
                infoContent.innerHTML = content;
                ImageAssets.hydrate(infoContent);
                document.getElementById('modal-info').classList.add('active');
                this.tempOnClose = onClose;
            },
            closeInfoModal() {
                document.getElementById('modal-info').classList.remove('active');
                const cb = this.tempOnClose;
                this.tempOnClose = null;
                if (cb) {
                    cb();
                }
            },

            showConfirm(msg, onYes, onNo) {
                const confirmMessage = document.getElementById('confirm-msg');
                confirmMessage.innerHTML = msg;
                ImageAssets.hydrate(confirmMessage);
                const modal = document.getElementById('modal-confirm');
                const btnYes = document.getElementById('confirm-yes');
                const btnNo = document.getElementById('confirm-no');
                const btnContainer = document.getElementById('confirm-btn-container');

                // Reset button order
                btnContainer.style.flexDirection = 'row';

                btnYes.onclick = () => {
                    modal.classList.remove('active');
                    if (onYes) onYes();
                };
                btnNo.onclick = () => {
                    modal.classList.remove('active');
                    if (onNo) onNo();
                };

                modal.classList.add('active');
            },

            showDoubleConfirm(msg1, msg2, onYes) {
                this.showConfirm(msg1, () => {
                    // Step 1 Yes -> Open Step 2
                    setTimeout(() => {
                        const confirmMessage = document.getElementById('confirm-msg');
                        confirmMessage.innerHTML = msg2;
                        ImageAssets.hydrate(confirmMessage);
                        const modal = document.getElementById('modal-confirm');
                        const btnYes = document.getElementById('confirm-yes');
                        const btnNo = document.getElementById('confirm-no');
                        const btnContainer = document.getElementById('confirm-btn-container');

                        // Swap buttons for safety
                        btnContainer.style.flexDirection = 'row-reverse';

                        btnYes.onclick = () => {
                            modal.classList.remove('active');
                            btnContainer.style.flexDirection = 'row'; // Reset
                            if (onYes) onYes();
                        };
                        btnNo.onclick = () => {
                            modal.classList.remove('active');
                            btnContainer.style.flexDirection = 'row'; // Reset
                        };

                        modal.classList.add('active');
                    }, 100);
                });
            },

            // --- Lumi Question Chat ---
            ensureApiKey(reason = '이 기능을 사용하려면') {
                let key = this.getStoredApiKey();
                if (key) return key;

                const entered = window.prompt(`${reason} Gemini API Key가 필요해.\n입력한 키는 이 브라우저에 저장돼.`, '');
                if (!entered) return '';

                key = entered.trim();
                if (!key) return '';

                Storage.setRaw(Storage.keys.API_KEY, key);
                return key;
            },

            configureLumiChatSessionUi(session) {
                if (!session) return;
                const ui = session.ui || {};
                const asideTitle = document.getElementById('lumi-chat-aside-title');
                const closeBtn = document.getElementById('lumi-chat-close-btn');
                const resetBtn = document.getElementById('lumi-chat-reset-btn');
                const input = document.getElementById('lumi-chat-input');
                const modelBtn = document.getElementById('lumi-chat-model-btn');
                const cancelBtn = document.getElementById('lumi-chat-cancel-btn');

                if (asideTitle) asideTitle.innerText = ui.asideTitle || '루미의 질문하기';
                if (closeBtn) closeBtn.innerText = ui.closeLabel || '나가기';
                if (resetBtn) resetBtn.innerText = ui.resetLabel || '대화 초기화';
                if (modelBtn) modelBtn.innerText = LumiQuestionRuntime.getSelectedModelLabel();
                this.syncLumiSearchRuntime();
                this.updateLumiSearchButtons(session);
                if (cancelBtn) cancelBtn.disabled = !(session && session.inFlight);
                if (input) {
                    input.placeholder = session.mode === 'toeic-review'
                        ? '해설에서 궁금한 점을 입력하세요.'
                        : '질문을 입력하세요.';
                }
            },

            updateLumiModelButtons() {
                const label = LumiQuestionRuntime.getSelectedModelLabel();
                const chatBtn = document.getElementById('lumi-chat-model-btn');
                const tutoringBtn = document.getElementById('tutoring-model-btn');
                if (chatBtn) chatBtn.innerText = label;
                if (tutoringBtn) tutoringBtn.innerText = label;
            },

            syncLumiSearchRuntime() {
                const enabled = this.global.lumiSearchEnabled !== false;
                LumiQuestionRuntime.setSearchEnabled(enabled);
                return enabled;
            },

            updateLumiSearchButtons(session = this.getActiveLumiChatSession()) {
                const forcedOff = !!(session && session.enableSearch === false);
                const label = LumiQuestionRuntime.getSearchButtonLabel(session);
                const chatBtn = document.getElementById('lumi-chat-search-btn');
                if (chatBtn) {
                    // TOEIC 질문 모드에서는 검색이 항상 OFF이므로 버튼 자체를 숨김
                    if (forcedOff) {
                        chatBtn.style.display = 'none';
                    } else {
                        chatBtn.style.display = '';
                        chatBtn.innerText = label;
                    }
                }
            },

            openLumiChatSession(session, sessionKey) {
                if (!session) return;
                this.activeLumiChatSessionKey = sessionKey;
                this.configureLumiChatSessionUi(session);
                this.updateLumiModelButtons();
                this.renderLumiChatMessages();
                this.setLumiChatStatus(LumiQuestionRuntime.getInitialStatus(session, !!this.getStoredApiKey()));
                document.getElementById('modal-lumi-question').classList.add('active');
                const input = document.getElementById('lumi-chat-input');
                if (input) input.focus();
            },

            openLumiQuestion() {
                const session = LumiQuestionRuntime.ensureGeneralSession(this.lumiChatSessions);
                this.openLumiChatSession(session, LumiQuestionRuntime.SESSION_KEYS.GENERAL);
            },

            openToeicLumiQuestion() {
                const toeicSession = this.state.currentToeicSession;
                if (!toeicSession || !toeicSession.set || !LumiQuestionRuntime.shouldShowToeicQuestionButton(toeicSession.set)) {
                    return;
                }

                const session = LumiQuestionRuntime.ensureToeicReviewSession(
                    toeicSession,
                    this.getToeicExplanationText(toeicSession.set)
                );
                if (!session) return;

                document.getElementById('modal-toeic-practice').classList.remove('active');
                this.openLumiChatSession(session, LumiQuestionRuntime.SESSION_KEYS.TOEIC);
            },

            closeLumiQuestion() {
                const activeSession = this.getActiveLumiChatSession();
                if (activeSession && activeSession.inFlight) {
                    LumiQuestionRuntime.cancelPending(activeSession, 'close_modal');
                }
                document.getElementById('modal-lumi-question').classList.remove('active');
                this.setLumiChatStatus('');
                const input = document.getElementById('lumi-chat-input');
                if (input) input.value = '';

                if (activeSession && activeSession.mode === 'toeic-review') {
                    this.restoreToeicReviewAfterLumiQuestion();
                    return;
                }

                this.activeLumiChatSessionKey = LumiQuestionRuntime.SESSION_KEYS.GENERAL;
            },

            restoreToeicReviewAfterLumiQuestion() {
                this.activeLumiChatSessionKey = LumiQuestionRuntime.SESSION_KEYS.GENERAL;
                if (!this.state.currentToeicSession) return;
                document.getElementById('modal-toeic-practice').classList.add('active');
                this.showToeicExplanation();
            },

            clearToeicLumiQuestionSession(options = {}) {
                const toeicSession = this.state.currentToeicSession;
                if (toeicSession && toeicSession.lumiQuestionSession) {
                    if (options.abort !== false) {
                        LumiQuestionRuntime.cancelPending(toeicSession.lumiQuestionSession, 'dispose_toeic_session');
                    }
                    delete toeicSession.lumiQuestionSession;
                }
                if (this.activeLumiChatSessionKey === LumiQuestionRuntime.SESSION_KEYS.TOEIC) {
                    this.activeLumiChatSessionKey = LumiQuestionRuntime.SESSION_KEYS.GENERAL;
                }
                document.getElementById('modal-lumi-question').classList.remove('active');
                this.setLumiChatStatus('');
                const input = document.getElementById('lumi-chat-input');
                if (input) input.value = '';
                if (options.clearCurrentToeic) {
                    this.state.currentToeicSession = null;
                }
            },

            setLumiChatStatus(message = '') {
                const status = document.getElementById('lumi-chat-status');
                if (status) status.innerText = message;
            },

            renderLumiChatMessages() {
                const log = document.getElementById('lumi-chat-log');
                const session = this.getActiveLumiChatSession();
                if (!log) return;

                log.innerHTML = '';
                const messages = session ? session.messages || [] : [];

                messages.forEach(message => {
                    const bubble = document.createElement('div');
                    bubble.className = `lumi-chat-bubble ${message.role === 'user' ? 'user' : 'model'}`;
                    if (message.state) bubble.classList.add(`is-${message.state}`);

                    const body = document.createElement('div');
                    body.textContent = message.text;
                    bubble.appendChild(body);

                    if (message.model) {
                        const modelMeta = document.createElement('span');
                        modelMeta.className = 'lumi-chat-meta';
                        modelMeta.textContent = LumiQuestionRuntime.getModelLabel(message.model);
                        bubble.appendChild(modelMeta);
                    }

                    if (message.queries && message.queries.length > 0) {
                        const meta = document.createElement('span');
                        meta.className = 'lumi-chat-meta';
                        meta.textContent = `검색어: ${message.queries.join(' / ')}`;
                        bubble.appendChild(meta);
                    }

                    if (message.sources && message.sources.length > 0) {
                        const sourceWrap = document.createElement('div');
                        sourceWrap.className = 'lumi-chat-sources';
                        message.sources.forEach((source, index) => {
                            const link = document.createElement('a');
                            link.className = 'lumi-chat-source';
                            link.href = source.uri;
                            link.target = '_blank';
                            link.rel = 'noopener noreferrer';
                            link.textContent = `[${index + 1}] ${source.title || source.uri}`;
                            sourceWrap.appendChild(link);
                        });
                        bubble.appendChild(sourceWrap);
                    }

                    if (message.retryable && message.role === 'model') {
                        const actionWrap = document.createElement('div');
                        actionWrap.style.display = 'flex';
                        actionWrap.style.gap = '8px';
                        actionWrap.style.marginTop = '8px';

                        const retryBtn = document.createElement('button');
                        retryBtn.textContent = '다시 시도';
                        retryBtn.onclick = () => this.retryLastLumiQuestion(message.userText, message.model);
                        actionWrap.appendChild(retryBtn);

                        bubble.appendChild(actionWrap);
                    }

                    log.appendChild(bubble);
                });

                log.scrollTop = log.scrollHeight;
                const cancelBtn = document.getElementById('lumi-chat-cancel-btn');
                if (cancelBtn) cancelBtn.disabled = !(session && session.inFlight);
            },

            clearLumiQuestionHistory() {
                const currentSession = this.getActiveLumiChatSession();
                if (!currentSession) return;

                LumiQuestionRuntime.cancelPending(currentSession, 'reset_session');
                const resetSession = LumiQuestionRuntime.resetSession(currentSession);
                LumiQuestionRuntime.storeSession(this.lumiChatSessions, this.state.currentToeicSession, resetSession);

                this.configureLumiChatSessionUi(resetSession);
                this.renderLumiChatMessages();
                this.setLumiChatStatus(LumiQuestionRuntime.getResetStatus(resetSession));
                const input = document.getElementById('lumi-chat-input');
                if (input) {
                    input.value = '';
                    input.focus();
                }
            },

            toggleLumiChatModel() {
                LumiQuestionRuntime.cycleSelectedModel();
                this.updateLumiModelButtons();
            },

            toggleLumiSearch() {
                const session = this.getActiveLumiChatSession();
                if (session && session.enableSearch === false) {
                    this.updateLumiSearchButtons(session);
                    this.setLumiChatStatus('TOEIC 질문에서는 검색을 사용할 수 없어.');
                    return;
                }

                // Search preference belongs to global save data, so load it before mutation.
                if (!this._globalLoaded && !this.loadGlobalData()) return;
                if (this._globalStorageBroken) return;

                const nextEnabled = !(this.global.lumiSearchEnabled !== false);
                this.global.lumiSearchEnabled = nextEnabled;
                LumiQuestionRuntime.setSearchEnabled(nextEnabled);
                this.updateLumiSearchButtons();
                this.saveGlobalData();

                if (session && session.inFlight) {
                    this.setLumiChatStatus('검색 설정 변경은 다음 질문부터 적용돼.');
                } else {
                    this.setLumiChatStatus(nextEnabled ? '검색 도구 호출을 켰어.' : '검색 도구 호출을 껐어.');
                }
            },

            cancelLumiQuestion() {
                const session = this.getActiveLumiChatSession();
                if (!session) return;
                if (!LumiQuestionRuntime.cancelPending(session, 'user_cancel')) return;
                this.setLumiChatStatus(LumiQuestionRuntime.getCanceledStatus());
                this.renderLumiChatMessages();
            },

            async retryLastLumiQuestion(messageText, modelOverride = null) {
                if (this.isLumiChatLoading) return;
                if (typeof messageText !== 'string' || !messageText.trim()) return;

                if (modelOverride) {
                    LumiQuestionRuntime.setSelectedModel(modelOverride);
                    this.updateLumiModelButtons();
                }

                const input = document.getElementById('lumi-chat-input');
                if (input) input.value = messageText;
                await this.sendLumiQuestion();
            },

            handleLumiQuestionKey(event) {
                if (event.isComposing) return;
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    this.sendLumiQuestion();
                }
            },

            async sendLumiQuestion() {
                if (this.isLumiChatLoading) return;

                const session = this.getActiveLumiChatSession();
                if (!session) return;

                const input = document.getElementById('lumi-chat-input');
                const message = input ? input.value.trim() : '';
                if (!message) {
                    this.setLumiChatStatus('질문을 먼저 적어줘.');
                    if (input) input.focus();
                    return;
                }

                const key = this.ensureApiKey('루미에게 질문하려면');
                if (!key) {
                    this.setLumiChatStatus('API 키가 없어 답변을 시작하지 못했어.');
                    return;
                }

                if (input) input.value = '';
                this.isLumiChatLoading = true;
                this.setLumiChatStatus(LumiQuestionRuntime.getLoadingStatus(session, LumiQuestionRuntime.selectedModel));

                try {
                    const pendingReply = LumiQuestionRuntime.sendMessage(key, session, message);
                    this.renderLumiChatMessages();
                    const result = await pendingReply;
                    if (!result || result.stale) return;
                    this.setLumiChatStatus(LumiQuestionRuntime.getSuccessStatus(session, result));
                } catch (error) {
                    if (!error || error.stale) return;
                    if (error.canceled) {
                        this.setLumiChatStatus(LumiQuestionRuntime.getCanceledStatus());
                    } else if (error.retryable) {
                        this.setLumiChatStatus('응답이 흔들렸어. 다시 시도해줘.');
                    } else {
                        this.setLumiChatStatus('답변 요청에 실패했어.');
                    }
                } finally {
                    this.isLumiChatLoading = false;
                    this.renderLumiChatMessages();
                    if (input) input.focus();
                }
            },

            // --- Private Tutoring ---
            closePrivateTutoring() {
                document.getElementById('modal-tutoring').classList.remove('active');
                document.getElementById('modal-library').classList.add('active');
            },

            closeMagicClass() {
                document.getElementById('modal-magic-class').classList.remove('active');
                document.getElementById('modal-library').classList.add('active');
            },

            closeWordbook() {
                document.getElementById('modal-wordbook').classList.remove('active');
                document.getElementById('modal-library').classList.add('active');
            },

            openPrivateTutoring() {
                const mode = this.state.mode;
                let list = (['chaos', 'artifact_chaos', 'draft'].includes(mode)) ? this.state.wrongCollocations : this.state.wrongWords;

                if (!list || list.length === 0) {
                    let msg = (['chaos', 'artifact_chaos', 'draft'].includes(mode)) ? "오답노트에 등록된 숙어/구동사가 없습니다." : "오답노트에 등록된 단어가 없습니다.";
                    return this.showAlert(msg);
                }

                document.getElementById('modal-library').classList.remove('active');
                document.getElementById('modal-tutoring').classList.add('active');

                // Reset UI
                document.getElementById('tutoring-content').innerText = "수업을 시작하려면 '수업 시작' 버튼을 눌러주세요.";
                document.getElementById('btn-tutoring-quiz').style.display = 'none';
                this.currentTutoringItem = null;
                this.updateLumiModelButtons();
            },

            async startTutoringSession() {
                if (this.isApiLoading) return this.showAlert("이전 요청 처리 중입니다...");

                const key = this.ensureApiKey('개인과외를 시작하려면');
                if (!key) return this.showAlert("API 키가 없어 개인과외를 시작할 수 없습니다.");

                const mode = this.state.mode;
                const isCollocation = ['chaos', 'artifact_chaos', 'draft'].includes(mode);
                let list = isCollocation ? this.state.wrongCollocations : this.state.wrongWords;

                if (!list || list.length === 0) return this.showAlert("학습할 오답 내용이 없습니다.");

                // Pick Random
                const targetId = list[Math.floor(Math.random() * list.length)];
                let targetData = null;

                if (isCollocation) {
                    targetData = COLLOCATION_DATA.find(c => c.id === targetId);
                } else {
                    targetData = VOCAB_DATA.find(v => v.word === targetId);
                }

                if (!targetData) {
                    // Cleanup invalid data
                    if (isCollocation) {
                        this.state.wrongCollocations = this.state.wrongCollocations.filter(id => id !== targetId);
                        Storage.save(Storage.keys.COLLOCATION, this.state.wrongCollocations);
                        if (this.state.wrongCollocationDetails && this.state.wrongCollocationDetails[targetId]) {
                            delete this.state.wrongCollocationDetails[targetId];
                            Storage.save(Storage.keys.COLLOCATION_DETAILS, this.state.wrongCollocationDetails);
                        }
                    } else {
                        this.state.wrongWords = this.state.wrongWords.filter(w => w !== targetId);
                        Storage.save(Storage.keys.VOCAB, this.state.wrongWords);
                    }
                    return this.startTutoringSession(); // Retry
                }

                let tutoringData = targetData;
                if (isCollocation) {
                    let selectedQuiz = null;
                    if (this.state.wrongCollocationDetails && this.state.wrongCollocationDetails[targetData.id]) {
                        selectedQuiz = this.state.wrongCollocationDetails[targetData.id];
                    } else {
                        selectedQuiz = QuizEngine.resolveCollocationTutoringQuiz(targetData);
                    }
                    const selectedOptions = selectedQuiz && Array.isArray(selectedQuiz.options) ? [...selectedQuiz.options] : [];
                    tutoringData = {
                        ...targetData,
                        question: selectedQuiz ? selectedQuiz.question : targetData.question,
                        options: selectedOptions,
                        answer: selectedQuiz ? selectedQuiz.answer : targetData.answer,
                        translation: selectedQuiz ? selectedQuiz.translation : targetData.translation,
                        wrongSelected: selectedQuiz ? selectedQuiz.wrongSelected : null,
                        selectedQuiz: selectedQuiz ? { ...selectedQuiz, options: selectedOptions } : null
                    };
                }

                this.currentTutoringItem = { data: tutoringData, type: isCollocation ? 'collocation' : 'vocab' };

                // UI Loading
                this.isApiLoading = true;
                const contentBox = document.getElementById('tutoring-content');
                contentBox.innerHTML = "루미 선생님이 강의를 준비하고 있어요...<br>(잠시만 기다려주세요)";

                try {
                    const text = await GameAPI.getTutoringContent(
                        key,
                        tutoringData,
                        isCollocation ? 'collocation' : 'vocab',
                        { model: LumiQuestionRuntime.selectedModel }
                    );

                    // ✅ 응답 도착 후: 모달이 아직 열려있는지 확인
                    const tutoringModal = document.getElementById('modal-tutoring');
                    if (!tutoringModal.classList.contains('active')) {
                        console.warn("과외 모달이 닫혀있어 결과를 무시합니다.");
                        return; // 이미 닫혔으면 아무것도 하지 않음
                    }

                    // Format simple markdown to HTML tags
                    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
                    contentBox.innerHTML = formatted;

                    // Show Quiz Button
                    document.getElementById('btn-tutoring-quiz').style.display = 'block';

                } catch (e) {
                    console.error(e);
                    let msg = e.message || "";
                    let displayMsg = "알 수 없는 오류가 발생했습니다.";
                    if (msg.includes('key') || msg.includes('valid') || msg.includes('400') || msg.includes('403')) {
                        displayMsg = "API 키가 올바르지 않거나 설정되지 않았습니다. 설정을 확인해주세요.";
                    } else if (msg.includes('quota') || msg.includes('429')) {
                        displayMsg = "API 사용량이 초과되었습니다. 잠시 후 다시 시도하거나 키를 확인해주세요.";
                    } else if (msg.includes('safety') || msg.includes('blocked')) {
                        displayMsg = "안전 필터에 의해 생성이 차단되었습니다. 다른 단어로 시도해주세요.";
                    } else {
                        displayMsg = "알 수 없는 오류가 발생했습니다.";
                    }
                    contentBox.innerHTML = `<div style="color:#ef5350; font-weight:bold;">${displayMsg}</div>`;
                } finally {
                    this.isApiLoading = false;
                }
            },

            startTutoringQuiz() {
                if (!this.currentTutoringItem) return;

                const item = this.currentTutoringItem;
                const data = item.data;

                const onCorrect = () => {
                    // Add to tutored items list (Max 3, FIFO)
                    if (!this.state.tutoredItems) this.state.tutoredItems = [];
                    const itemId = item.type === 'collocation' ? data.id : data.word;
                    this.state.tutoredItems.push(itemId);
                    if (this.state.tutoredItems.length > 3) {
                        this.state.tutoredItems.shift();
                    }

                    if (item.type === 'collocation') {
                        this.state.wrongCollocations = this.state.wrongCollocations.filter(id => id !== data.id);
                        Storage.save(Storage.keys.COLLOCATION, this.state.wrongCollocations);
                        if (this.state.wrongCollocationDetails && this.state.wrongCollocationDetails[data.id]) {
                            delete this.state.wrongCollocationDetails[data.id];
                            Storage.save(Storage.keys.COLLOCATION_DETAILS, this.state.wrongCollocationDetails);
                        }
                    } else {
                        this.state.wrongWords = this.state.wrongWords.filter(w => w !== data.word);
                        Storage.save(Storage.keys.VOCAB, this.state.wrongWords);
                    }
                    document.getElementById('modal-tutoring').classList.remove('active');
                    this.toMenu();

                    // Rumi Surprise Gift Logic
                    const allowTicketGift = this.state.mode !== 'puzzle';
                    this.state.rumiGiftCount = this.state.rumiGiftCount || 0;
                    if (allowTicketGift && this.state.rumiGiftCount < 3 && Math.random() < 0.3) {
                        this.state.rumiGiftCount++;
                        this.state.tickets = (this.state.tickets || 0) + 1;
                        if (document.getElementById('ui-tickets')) document.getElementById('ui-tickets').innerText = this.state.tickets;

                        this.openInfoModal("루미의 깜짝 선물!",
                            `<div style="text-align:center;">
                                <div class="portrait" style="width:120px; height:160px; margin:0 auto 10px auto; border-color:#448aff;">
                                    <img data-image-src="루미.png" alt="Rumi" style="width:100%; height:100%; object-fit:contain;">
                                </div>
                                형아! 공부하느라 고생했어! (헤헤)<br>이거 줄게, 받아!<br><br>
                                <b style="color:#ffd700; font-size:1.2rem;">[티켓 1장 획득]</b><br>
                                <span style="font-size:0.8rem; color:#aaa;">(오답노트에서도 삭제되었습니다)</span>
                            </div>`,
                            () => { this.toMenu(); }
                        );
                    } else {
                        this.showAlert("학습 완료! 오답노트에서 삭제되었습니다.");
                    }
                };

                const onWrong = () => {
                    // Stay on tutoring modal, user can retry
                };

                const config = QuizEngine.buildTutoringQuiz(item, onCorrect, onWrong);
                config.correctDelay = 1500;
                config.wrongDelay = 2000;
                QuizEngine.show(config);
            },

            // --- Artifact Helpers ---

            openArtifactSelect() {
                const owned = this.state.artifacts || [];
                const artifactPool = (typeof GameUtils !== 'undefined' && typeof GameUtils.getArtifactSelectionPool === 'function')
                    ? GameUtils.getArtifactSelectionPool(this.global)
                    : ARTIFACT_LIST;
                const available = artifactPool.filter(artifact => {
                    if (owned.includes(artifact.id)) return false;
                    if (artifact.replaces && owned.includes(artifact.replaces)) return false;
                    return true;
                });
                if (available.length === 0) {
                    this.showAlert("획득 가능한 아티팩트가 없습니다.");
                    this.toMenu();
                    return;
                }

                // Pick 3 random artifacts
                const shuffled = available.sort(() => Math.random() - 0.5);
                const choices = shuffled.slice(0, Math.min(3, shuffled.length));

                const list = document.getElementById('artifact-select-list');
                list.innerHTML = "";

                choices.forEach(art => {
                    const btn = document.createElement('button');
                    btn.className = 'menu-btn';
                    btn.style.borderColor = '#ffd700';
                    btn.style.color = '#ffd700';
                    btn.style.textAlign = 'left';
                    btn.style.padding = '15px';
                    btn.innerHTML = `<b>${art.name}</b><br><span style="font-size:0.8rem; color:#ccc; font-weight:normal;">${art.desc}</span>`;
                    btn.onclick = () => {
                        this.state.artifacts.push(art.id);
                        document.getElementById('modal-artifact-select').classList.remove('active');
                        this.showAlert(`아티팩트 획득: ${art.name}!\n${art.desc}`);
                        this.saveGame();
                        this.toMenu();
                    };
                    list.appendChild(btn);
                });

                document.getElementById('modal-artifact-select').classList.add('active');
            },

            openArtifactCheck() {
                const owned = this.state.artifacts || [];
                const list = document.getElementById('artifact-check-list');
                const title = document.getElementById('artifact-check-title');

                if (this.state.mode === 'artifact_reserve') {
                    const inBattle = this.battle && !this.battle.isFinished;
                    if (inBattle) {
                        if (title) title.innerText = '현재 활성 아티팩트';
                        if (owned.length === 0) {
                            list.innerHTML = '<div style="color:#aaa; text-align:center;">활성화된 아티팩트가 없습니다.</div>';
                        } else {
                            list.innerHTML = owned.map(id => {
                                const art = GameUtils.getArtifactById(id);
                                if (!art) return '';
                                return `<div style="margin-bottom:8px; padding:8px; background:#333; border-radius:5px; border-left: 3px solid #ffd700;">
                                    <b style="color:#ffd700;">${art.name}</b><br>
                                    <span style="color:#ccc;">${art.desc}</span>
                                </div>`;
                            }).join('');
                        }
                        document.getElementById('modal-artifact-check').classList.add('active');
                        return;
                    }

                    const reservePool = this.state.artifactReservePool || [];
                    const activeCount = owned.length;
                    if (title) title.innerText = `아티팩트 풀 (${activeCount}/${GAME_CONSTANTS.MAX_ARTIFACTS} 활성)`;
                    list.innerHTML = '';

                    reservePool.forEach(entry => {
                        const artifact = GameUtils.getArtifactById(entry.id);
                        if (!artifact) return;
                        const isActive = owned.includes(entry.id);
                        const remainingUses = Math.max(0, entry.remainingUses || 0);
                        const button = document.createElement('button');
                        button.className = 'menu-btn';
                        button.disabled = remainingUses <= 0;
                        button.style.cssText = `margin:0 0 8px; padding:9px; text-align:left; border-color:${isActive ? '#4caf50' : '#6a5d18'}; color:${remainingUses > 0 ? '#f5df78' : '#777'}; background:${isActive ? '#263a29' : '#333'};`;
                        button.innerHTML = `<div style="display:flex; justify-content:space-between; gap:8px;"><b>${artifact.name}</b><span style="white-space:nowrap; color:${isActive ? '#81c784' : '#ffd700'};">${isActive ? '활성' : '비활성'} · ${remainingUses}회</span></div><span style="display:block; margin-top:3px; color:#ccc; font-size:0.78rem; font-weight:normal;">${artifact.desc}</span>`;
                        button.onclick = () => {
                            if (this.toggleArtifactReserveArtifact(entry.id)) this.openArtifactCheck();
                        };
                        list.appendChild(button);
                    });

                    if (reservePool.length === 0) {
                        list.innerHTML = '<div style="color:#aaa; text-align:center;">아티팩트 풀이 아직 완성되지 않았습니다.</div>';
                    }
                    document.getElementById('modal-artifact-check').classList.add('active');
                    return;
                }

                if (title) title.innerText = this.state.mode === 'artifact_chaos' ? '현재 활성 아티팩트' : '보유 아티팩트';
                if (owned.length === 0) {
                    list.innerHTML = '<div style="color:#aaa; text-align:center;">보유한 아티팩트가 없습니다.</div>';
                } else {
                    list.innerHTML = owned.map(id => {
                        const art = GameUtils.getArtifactById(id);
                        if (!art) return '';
                        return `<div style="margin-bottom:8px; padding:8px; background:#333; border-radius:5px; border-left: 3px solid #ffd700;">
                            <b style="color:#ffd700;">${art.name}</b><br>
                            <span style="color:#ccc;">${art.desc}</span>
                        </div>`;
                    }).join('');
                }
                document.getElementById('modal-artifact-check').classList.add('active');
            },

            showAlert(msg) {
                this.openInfoModal("알림", msg);
            },

            // --- TOEIC Practice ---
            openToeicMenu() {
                document.getElementById('modal-library').classList.remove('active');
                document.getElementById('modal-toeic-menu').classList.add('active');
            },

            closeToeicPractice() {
                const session = this.state.currentToeicSession;
                if (session && session.options && session.options.lockExit) {
                    return;
                }
                this.clearToeicLumiQuestionSession({ abort: true, clearCurrentToeic: true });
                document.getElementById('modal-toeic-practice').classList.remove('active');
            },

            startToeicPractice(options = {}) {
                const practiceOptions = {
                    ignoreSessionLimit: false,
                    suppressDate: false,
                    lockExit: false,
                    countHiddenUnlock: true,
                    countMonthly: true,
                    onComplete: null,
                    onFailure: null,
                    ...options
                };

                this.clearToeicLumiQuestionSession({ abort: true, clearCurrentToeic: true });

                if (!practiceOptions.ignoreSessionLimit && this.state.toeicPracticeDone) {
                    return this.showAlert("이번 세션에서는 이미 실전 연습을 완료했습니다.\n다음 세션에서 다시 도전해주세요.");
                }
                if (!this.state.completedToeicSets) this.state.completedToeicSets = [];

                let available = TOEIC_DATA.filter(set =>
                    !this.state.completedToeicSets.includes(set.id) &&
                    set.questions && set.questions.length > 0
                );

                if (available.length === 0) {
                    if (practiceOptions.lockExit || practiceOptions.ignoreSessionLimit) {
                        this.resetToeicProgress({ silent: true });
                        available = TOEIC_DATA.filter(set => set.questions && set.questions.length > 0);
                    } else {
                        this.showConfirm(
                            "모든 문제를 학습했습니다!<br>기록을 초기화하고 다시 학습하시겠습니까?",
                            () => this.resetToeicProgress(),
                            () => { }
                        );
                        return;
                    }
                }

                if (available.length === 0) {
                    return this.showAlert("실전 연습 데이터를 불러오지 못했습니다.");
                }

                const hiddenUnlocked = this.registerToeicPracticeAttempt(practiceOptions);
                const set = available[Math.floor(Math.random() * available.length)];

                let expandedQuestions = [];
                let expandedShuffled = [];
                set.questions.forEach(q => {
                    expandedQuestions.push(q);
                    const opts = [...q.options];
                    opts.sort(() => Math.random() - 0.5);
                    expandedShuffled.push(opts);
                });

                this.state.currentToeicSession = {
                    set: set,
                    qIndex: 0,
                    expandedQuestions: expandedQuestions,
                    shuffledOptions: expandedShuffled,
                    results: [],
                    viewState: 'hub',
                    options: practiceOptions
                };

                const exitBtn = document.getElementById('toeic-exit-btn');
                if (exitBtn) {
                    exitBtn.disabled = !!practiceOptions.lockExit;
                    exitBtn.style.opacity = practiceOptions.lockExit ? '0.4' : '1';
                    exitBtn.style.pointerEvents = practiceOptions.lockExit ? 'none' : 'auto';
                }

                document.getElementById('modal-toeic-menu').classList.remove('active');
                document.getElementById('modal-toeic-practice').classList.add('active');
                document.getElementById('modal-toeic-practice').classList.remove('is-review');
                document.getElementById('modal-toeic-practice').classList.remove('is-explanation');

                this.renderToeicQuestion();

                if (hiddenUnlocked) {
                    setTimeout(() => {
                        this.showAlert("엔드리스 히든 모드 '꿈의회랑'이 출현했습니다.");
                    }, 150);
                }
            },

            renderToeicQuestion() {
                const session = this.state.currentToeicSession;
                if (session.isAnswering) return;

                const set = session.set;
                const totalQ = session.expandedQuestions.length;
                const modalEl = document.getElementById('modal-toeic-practice');

                // Update title
                let typeName = "문제";
                if (set.type === 'part5') typeName = "파트5 문제";
                else if (set.type === 'part6') typeName = "파트6 문제";
                else if (set.type === 'part7') typeName = "파트7 문제";

                document.getElementById('toeic-title').innerText = `${typeName} (${session.qIndex + 1}/${totalQ})`;

                // Hide all views first
                document.getElementById('toeic-hub').style.display = 'none';
                document.getElementById('toeic-passage-view').style.display = 'none';
                document.getElementById('toeic-question-view').style.display = 'none';
                document.getElementById('toeic-review-hub').style.display = 'none';
                document.getElementById('toeic-explanation-view').style.display = 'none';

                if (set.type === 'part5') {
                    // Part 5: show questions directly (standard quiz layout)
                    modalEl.classList.remove('is-part67');
                    modalEl.classList.add('is-part5');
                    document.getElementById('toeic-q-back-btn').style.display = 'none';
                    this._renderToeicQuestionContent();
                    document.getElementById('toeic-question-view').style.display = 'flex';
                } else {
                    // Part 6/7: show hub
                    modalEl.classList.remove('is-part5');
                    modalEl.classList.add('is-part67');

                    // Fill passage content
                    document.getElementById('toeic-passage-scroll').innerHTML =
                        set.passage ? set.passage.replace(/\n/g, '<br>') : '';

                    // Show hub
                    document.getElementById('toeic-hub').style.display = 'flex';
                }
            },

            _renderToeicQuestionContent() {
                const session = this.state.currentToeicSession;
                const q = session.expandedQuestions[session.qIndex];
                const opts = session.shuffledOptions[session.qIndex];

                document.getElementById('toeic-q-text').innerHTML = q.question.replace(/\n/g, '<br>');
                document.getElementById('toeic-feedback').innerText = "";

                const optContainer = document.getElementById('toeic-options');
                optContainer.innerHTML = "";

                opts.forEach(optText => {
                    const btn = document.createElement('button');
                    btn.className = 'menu-btn';
                    btn.style.textAlign = 'left';
                    btn.style.fontSize = '0.95rem';
                    btn.style.marginBottom = '0';
                    btn.style.padding = '14px';
                    btn.style.width = '100%';
                    btn.innerText = optText;
                    btn.onclick = () => this.checkToeicAnswer(btn, optText, q.answer);
                    optContainer.appendChild(btn);
                });
            },

            showToeicPassage() {
                const session = this.state.currentToeicSession;
                if (!session) return;

                // Check if we are in review mode
                if (['review_hub', 'review_q', 'review_passage', 'review_explanation'].includes(session.viewState)) {
                    session.viewState = 'review_passage';
                } else {
                    session.viewState = 'passage';
                }

                document.getElementById('toeic-hub').style.display = 'none';
                document.getElementById('toeic-review-hub').style.display = 'none'; // Ensure review hub is hidden
                document.getElementById('toeic-question-view').style.display = 'none';
                document.getElementById('toeic-passage-view').style.display = 'flex';

                // Scroll to top
                document.getElementById('toeic-passage-scroll').scrollTop = 0;
            },

            showToeicQuestions() {
                const session = this.state.currentToeicSession;
                if (!session) return;

                session.viewState = 'question';

                document.getElementById('toeic-hub').style.display = 'none';
                document.getElementById('toeic-passage-view').style.display = 'none';

                // Show back button for Part 6/7
                document.getElementById('toeic-q-back-btn').style.display = 'block';

                // Render current question content (preserves progress)
                this._renderToeicQuestionContent();
                document.getElementById('toeic-question-view').style.display = 'flex';
            },

            backToToeicHub() {
                const session = this.state.currentToeicSession;
                if (!session) return;

                document.getElementById('modal-toeic-practice').classList.remove('is-explanation');

                // Handle Review Mode Back
                if (['review_hub', 'review_q', 'review_passage', 'review_explanation'].includes(session.viewState)) {
                    session.viewState = 'review_hub';
                    this.renderToeicReviewHub();
                    return;
                }

                // Normal Practice Mode Back
                session.viewState = 'hub';

                document.getElementById('toeic-passage-view').style.display = 'none';
                document.getElementById('toeic-question-view').style.display = 'none';
                document.getElementById('toeic-explanation-view').style.display = 'none';
                document.getElementById('toeic-hub').style.display = 'flex';

                // Update title to reflect current progress
                const totalQ = session.expandedQuestions.length;
                let typeName = "문제";
                if (session.set.type === 'part5') typeName = "파트5 문제";
                else if (session.set.type === 'part6') typeName = "파트6 문제";
                else if (session.set.type === 'part7') typeName = "파트7 문제";
                document.getElementById('toeic-title').innerText = `${typeName} (${session.qIndex + 1}/${totalQ})`;
            },

            checkToeicAnswer(btn, selected, correct) {
                const session = this.state.currentToeicSession;
                const sessionOptions = session.options || {};
                const opts = document.getElementById('toeic-options').children;
                for (let c of opts) c.disabled = true;

                // Disable back button during answer animation
                const backBtn = document.getElementById('toeic-q-back-btn');
                if (backBtn) backBtn.style.pointerEvents = 'none';

                session.isAnswering = true;

                const feedback = document.getElementById('toeic-feedback');
                const q = session.expandedQuestions[session.qIndex];

                const isCorrect = (selected === correct);
                session.results.push({
                    id: q.id,
                    question: q.question,
                    isCorrect: isCorrect,
                    userAnswer: selected,
                    correctAnswer: correct
                });

                if (isCorrect) {
                    btn.classList.add('correct');
                    feedback.innerHTML = "<span style='color:#4caf50'>정답!</span>";
                } else {
                    btn.classList.add('wrong');
                    feedback.innerHTML = `<span style='color:#ef5350'>오답... 정답: ${correct}</span>`;
                    for (let c of opts) {
                        if (c.innerText === correct) c.classList.add('correct');
                    }
                }

                if (!isCorrect && typeof sessionOptions.onFailure === 'function') {
                    setTimeout(() => {
                        session.isAnswering = false;
                        if (backBtn) backBtn.style.pointerEvents = 'auto';
                        document.getElementById('modal-toeic-practice').classList.remove('active');
                        document.getElementById('modal-toeic-result').classList.remove('active');
                        const onFailure = sessionOptions.onFailure;
                        this.state.currentToeicSession = null;
                        onFailure();
                    }, 800);
                    return;
                }

                setTimeout(() => {
                    session.isAnswering = false;

                    // Re-enable back button
                    if (backBtn) backBtn.style.pointerEvents = 'auto';

                    session.qIndex++;
                    const totalQ = session.expandedQuestions.length;

                    if (session.qIndex >= totalQ) {
                        this.finishToeicSession();
                    } else if (session.set.type === 'part5') {
                        // Part 5: go directly to next question
                        this._renderToeicQuestionContent();
                        document.getElementById('toeic-title').innerText =
                            `파트5 문제 (${session.qIndex + 1}/${totalQ})`;
                    } else {
                        // Part 6/7: go back to hub for next question
                        this.backToToeicHub();
                    }
                }, 2000);
            },

            finishToeicSession() {
                const session = this.state.currentToeicSession;
                const set = session.set;
                const sessionOptions = session.options || {};

                // Mark complete
                if (!this.state.completedToeicSets.includes(set.id)) {
                    this.state.completedToeicSets.push(set.id);
                }

                // Mark session done (1 time per session limit)
                if (!sessionOptions.ignoreSessionLimit) {
                    this.state.toeicPracticeDone = true;
                }

                // Add Sage Blessing uses instead of fully resetting them.
                this.state.greatSageBlessingUses = (this.state.greatSageBlessingUses || 0) + getDefaultBlessingUses();
                if (document.getElementById('sage-uses')) document.getElementById('sage-uses').innerText = this.state.greatSageBlessingUses;

                // Disable exit button during results/commentary
                const exitBtn = document.getElementById('toeic-exit-btn');
                if (exitBtn) {
                    exitBtn.disabled = true;
                    exitBtn.style.opacity = '0.4';
                    exitBtn.style.pointerEvents = 'none';
                }

                this.saveGame(false);

                document.getElementById('modal-toeic-practice').classList.remove('active');

                const results = session.results || [];
                const correctCount = results.filter(r => r.isCorrect).length;
                const total = results.length;
                const wrongList = results.filter(r => !r.isCorrect);

                if (sessionOptions.suppressDate) {
                    if (exitBtn) {
                        exitBtn.disabled = false;
                        exitBtn.style.opacity = '1';
                        exitBtn.style.pointerEvents = 'auto';
                    }
                    const onComplete = sessionOptions.onComplete;
                    this.state.currentToeicSession = null;
                    if (typeof onComplete === 'function') {
                        onComplete({
                            correctCount,
                            total,
                            wrongList
                        });
                    }
                    return;
                }

                let msg = `수고하셨습니다!<br>'${set.title}' 학습을 완료했습니다.<br><br>`;
                msg += `정답률: ${correctCount}/${total} (${total > 0 ? ((correctCount / total) * 100).toFixed(0) : 0}%)<br><br>`;

                if (wrongList.length > 0) {
                    msg += `<b>[틀린 문제]</b><br>`;
                    wrongList.forEach(w => {
                        msg += `- ${w.question.substring(0, 30)}... (정답: ${w.correctAnswer})<br>`;
                    });
                    msg += `<br>`;
                }

                msg += `<b style="color:#00e676">대현자의 축복 횟수가 3회 추가되었습니다! (현재 ${this.state.greatSageBlessingUses}회)</b>`;

                // Open Result Modal
                document.getElementById('toeic-result-content').innerHTML = msg;
                document.getElementById('modal-toeic-result').classList.add('active');
            },

            openToeicReview() {
                document.getElementById('modal-toeic-result').classList.remove('active');
                const session = this.state.currentToeicSession;
                session.viewState = 'review_hub'; // New state

                document.getElementById('modal-toeic-practice').classList.add('active');
                document.getElementById('modal-toeic-practice').classList.add('is-review');
                this.renderToeicReviewHub();
            },

            renderToeicReviewHub() {
                const session = this.state.currentToeicSession;
                const set = session.set;

                document.getElementById('modal-toeic-practice').classList.remove('is-explanation');

                // Hide other views
                document.getElementById('toeic-hub').style.display = 'none';
                document.getElementById('toeic-passage-view').style.display = 'none';
                document.getElementById('toeic-question-view').style.display = 'none';
                document.getElementById('toeic-explanation-view').style.display = 'none';

                // Show Review Hub
                const hub = document.getElementById('toeic-review-hub');
                hub.innerHTML = '';
                hub.style.display = 'flex';
                hub.style.flexDirection = 'column'; // Part 5 renders one question button per row.

                // Update Title
                let typeName = "문제";
                if (set.type === 'part5') typeName = "파트5 문제";
                else if (set.type === 'part6') typeName = "파트6 문제";
                else if (set.type === 'part7') typeName = "파트7 문제";
                // Keep the review title shorter than the in-progress practice title.
                document.getElementById('toeic-title').innerText = `${typeName} (리뷰)`;

                // 1. Passage Button (Part 6/7 only)
                if (set.type !== 'part5' && set.passage) {
                    const btn = document.createElement('button');
                    btn.className = 'toeic-hub-btn';
                    btn.innerText = '지문 보기';
                    btn.onclick = () => this.showToeicPassage(); // Reuses existing logic, viewState handles back button
                    hub.appendChild(btn);
                }

                // 2. Question Buttons
                session.expandedQuestions.forEach((q, idx) => {
                    const btn = document.createElement('button');
                    btn.className = 'toeic-hub-btn';
                    btn.innerText = `문제 ${idx + 1}`;

                    // Mark if wrong
                    const res = session.results.find(r => r.id === q.id);
                    if (res && !res.isCorrect) {
                        btn.style.borderColor = '#ef5350';
                        btn.style.color = '#ef5350';
                        btn.innerText += ' (오답)';
                    }

                    btn.onclick = () => this.showToeicReviewQuestion(idx);
                    hub.appendChild(btn);
                });

                // 3. Explanation Button
                const expBtn = document.createElement('button');
                expBtn.className = 'toeic-hub-btn';
                expBtn.style.borderColor = '#ffd700';
                expBtn.style.color = '#ffd700';
                expBtn.innerText = '해설';
                expBtn.onclick = () => this.showToeicExplanation();
                hub.appendChild(expBtn);

                // 4. Close Button
                const closeBtn = document.createElement('button');
                closeBtn.className = 'toeic-hub-btn';
                closeBtn.style.background = '#444';
                closeBtn.style.borderColor = '#666';
                closeBtn.style.color = '#fff';
                closeBtn.innerText = '닫기';
                closeBtn.onclick = () => {
                    document.getElementById('modal-toeic-practice').classList.remove('active');
                    // Re-enable exit button
                    const exitBtn = document.getElementById('toeic-exit-btn');
                    if (exitBtn) { exitBtn.disabled = false; exitBtn.style.opacity = '1'; exitBtn.style.pointerEvents = 'auto'; }
                    this.offerDate();
                };
                hub.appendChild(closeBtn);
            },

            showToeicReviewQuestion(idx) {
                const session = this.state.currentToeicSession;
                session.viewState = 'review_q';

                document.getElementById('toeic-review-hub').style.display = 'none';

                const q = session.expandedQuestions[idx];
                const res = session.results.find(r => r.id === q.id);

                // Render Question (Read Only)
                document.getElementById('toeic-q-text').innerHTML = q.question.replace(/\n/g, '<br>');
                const feedback = document.getElementById('toeic-feedback');

                if (res && res.isCorrect) {
                    feedback.innerHTML = "<span style='color:#4caf50'>정답!</span>";
                } else {
                    feedback.innerHTML = `<span style='color:#ef5350'>오답... (선택: ${res ? res.userAnswer : '없음'})</span>`;
                }

                const optContainer = document.getElementById('toeic-options');
                optContainer.innerHTML = "";

                // In review, we might want to show options in original order or stored shuffled order?
                // Stored shuffled order is better to match user experience.
                const opts = session.shuffledOptions[idx];

                opts.forEach(optText => {
                    const btn = document.createElement('button');
                    btn.className = 'menu-btn';
                    btn.style.textAlign = 'left';
                    btn.style.fontSize = '0.95rem';
                    btn.style.marginBottom = '0';
                    btn.style.padding = '14px';
                    btn.style.width = '100%';
                    btn.innerText = optText;
                    btn.disabled = true; // Read only

                    if (optText === q.answer) {
                        btn.classList.add('correct');
                    } else if (res && res.userAnswer === optText && !res.isCorrect) {
                        btn.classList.add('wrong');
                    }

                    optContainer.appendChild(btn);
                });

                // Show Back Button
                const backBtn = document.getElementById('toeic-q-back-btn');
                backBtn.style.display = 'block';
                backBtn.style.pointerEvents = 'auto';

                document.getElementById('toeic-question-view').style.display = 'flex';
            },

            showToeicExplanation() {
                const session = this.state.currentToeicSession;
                session.viewState = 'review_explanation';

                document.getElementById('modal-toeic-practice').classList.add('is-explanation');
                document.getElementById('toeic-review-hub').style.display = 'none';

                const set = session.set;
                const expText = this.getToeicExplanationText(set);
                const questionActions = document.getElementById('toeic-explanation-actions');
                if (questionActions) {
                    questionActions.style.display = LumiQuestionRuntime.shouldShowToeicQuestionButton(set) ? 'flex' : 'none';
                }

                document.getElementById('toeic-explanation-scroll').innerHTML = expText.replace(/\n/g, '<br>');
                document.getElementById('toeic-explanation-view').style.display = 'flex';
            },

            // --- Lumi Date System ---

            offerDate() {
                // Re-enable exit button first
                const exitBtn = document.getElementById('toeic-exit-btn');
                if (exitBtn) { exitBtn.disabled = false; exitBtn.style.opacity = '1'; exitBtn.style.pointerEvents = 'auto'; }

                this.showConfirm(
                    `<div style="text-align:center;">
                        <div class="portrait" style="width:80px; height:106px; margin:0 auto 10px auto; border-color:#ff80ab;">
                            <img data-image-src="루미.png" alt="Rumi" style="width:100%; height:100%; object-fit:contain;">
                        </div>
                        <b style="color:#ff80ab;">루미의 보너스 데이트 신청!</b><br><br>
                        (헤헤) 형아~ 퀴즈 열심히 푸느라 고생했어!<br>
                        오늘 특별히... 나랑 데이트 할래? (///)<br><br>
                    </div>`,
                    () => this.startDate(),
                    () => this.toMenu()
                );
            },

            updateDateRetryButton(options = {}) {
                const retryBtn = document.getElementById('date-retry-btn');
                if (!retryBtn) return;

                const visible = options.visible === true;
                const disabled = options.disabled === true;
                retryBtn.textContent = '다시 시도';
                retryBtn.style.display = visible ? 'block' : 'none';
                retryBtn.disabled = disabled;
                retryBtn.style.opacity = disabled ? '0.55' : '1';
                retryBtn.style.cursor = disabled ? 'default' : 'pointer';
            },

            setDateLoadingState(dateParams, modelId) {
                const contentBox = document.getElementById('date-content');
                if (!contentBox || !dateParams) return;

                const isFallback = modelId === DATE_FALLBACK_MODEL_ID;
                const modelNote = isFallback
                    ? `<br><span style="font-size:0.8rem; color:#81d4fa;">${LumiQuestionRuntime.getModelLabel(modelId)} 모델로 다시 시도 중...</span>`
                    : '';
                contentBox.innerHTML = `<div style="text-align:center; color:#ff80ab;">💕 루미가 데이트를 준비하고 있어요...<br>(잠시만 기다려주세요)${modelNote}<br><br><span style="font-size:0.8rem; color:#aaa;">테마: ${dateParams.theme} | 의상: ${dateParams.outfit}<br>날씨: ${dateParams.weather} | 키워드: ${dateParams.keyword}</span></div>`;
            },

            buildDateErrorMessage(error) {
                const msg = error && error.message ? error.message : '';
                let displayMsg = '데이트 생성 중 오류가 발생했어.';
                if (msg.includes('key') || msg.includes('valid') || msg.includes('400') || msg.includes('403')) {
                    displayMsg = 'API 키를 다시 확인해줘.';
                } else if (msg.includes('quota') || msg.includes('429')) {
                    displayMsg = 'API 사용량 한도에 도달했어.';
                } else if (msg.includes('safety') || msg.includes('blocked')) {
                    displayMsg = '안전 필터로 인해 데이트 내용을 만들지 못했어.';
                } else {
                    displayMsg = '알 수 없는 오류가 발생했어.';
                }
                return displayMsg;
            },

            async loadDateContent(apiKey, dateParams, modelId) {
                const contentBox = document.getElementById('date-content');
                if (!contentBox || !dateParams) return false;

                const isFallback = modelId === DATE_FALLBACK_MODEL_ID;
                this.isApiLoading = true;
                this.updateDateRetryButton({ visible: isFallback, disabled: true });
                this.setDateLoadingState(dateParams, modelId);

                try {
                    const text = await GameAPI.getDateContent(apiKey, dateParams, { model: modelId });
                    const dateModal = document.getElementById('modal-date');
                    if (!dateModal.classList.contains('active')) return false;

                    const formatted = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
                    contentBox.innerHTML = formatted;
                    this.updateDateRetryButton({ visible: false, disabled: true });
                    return true;
                } catch (error) {
                    console.error(error);
                    const dateModal = document.getElementById('modal-date');
                    if (!dateModal.classList.contains('active')) return false;

                    contentBox.innerHTML = `<div style="color:#ef5350; font-weight:bold;">${this.buildDateErrorMessage(error)}</div>`;
                    this.updateDateRetryButton({ visible: true, disabled: false });
                    return false;
                } finally {
                    this.isApiLoading = false;
                }
            },

            async startDate() {
                if (this.isApiLoading) return this.showAlert("이전 요청 처리 중입니다...");

                const key = this.ensureApiKey('데이트를 시작하려면');
                if (!key) return this.showAlert("API 키가 없어 데이트를 시작할 수 없습니다.");
                this.clearToeicLumiQuestionSession({ abort: true, clearCurrentToeic: true });

                const dateParams = this._getDateParams();

                // Calculate days since last date for loneliness
                const now = new Date();
                const lastDateStr = this.global.lastDateTimestamp;
                let daysSinceLastDate = 0;
                if (lastDateStr) {
                    const lastDate = new Date(lastDateStr);
                    daysSinceLastDate = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
                }
                dateParams.daysSinceLastDate = daysSinceLastDate;

                // Save current date params for later use
                this._currentDateParams = dateParams;

                // Show date modal
                document.getElementById('modal-date').classList.add('active');
                this.updateDateRetryButton({ visible: false, disabled: true });
                await this.loadDateContent(key, dateParams, DATE_PRIMARY_MODEL_ID);
            },

            async retryDateWithFallback() {
                if (this.isApiLoading) return;

                const dateParams = this._currentDateParams;
                if (!dateParams) return;

                const key = this.ensureApiKey('데이트를 다시 시도하려면');
                if (!key) return this.showAlert("API 키가 없어 데이트를 다시 시도할 수 없습니다.");

                await this.loadDateContent(key, dateParams, DATE_FALLBACK_MODEL_ID);
            },

            finishDate() {
                const dateParams = this._currentDateParams;
                const isSecret = dateParams && dateParams.secret;

                document.getElementById('modal-date').classList.remove('active');
                this.updateDateRetryButton({ visible: false, disabled: true });

                // Update last date timestamp in global
                this.global.lastDateTimestamp = new Date().toISOString();

                if (isSecret) {
                    const cardId = dateParams.cardId;
                    const cardName = dateParams.cardName;

                    const isPoolMode = ['chaos', 'artifact_chaos', 'draft'].includes(this.state.mode);
                    let rewardDetail = "";

                    if (isPoolMode) {
                        // [목적] 카오스/드래프트 모드에서는 인벤토리에 즉시 추가하지 않고, 해당 런의 랜덤 풀에 추가하여 랜덤하게 등장하게 함 (해당 런 전용)
                        if (!this.state.activeEventCards) this.state.activeEventCards = [];
                        if (!this.state.activeEventCards.includes(cardId)) {
                            this.state.activeEventCards.push(cardId);
                            rewardDetail = "(해당 런의 카드 풀에 추가되었습니다. 앞으로 랜덤하게 등장합니다!)";
                        } else {
                            rewardDetail = "(이미 카드 풀에 포함되어 있습니다)";
                        }
                    } else {
                        // [목적] 일반 모드에서는 기존 방식대로 인벤토리에 즉시 추가
                        const alreadyOwned = this.state.inventory.includes(cardId);
                        if (!alreadyOwned) {
                            this.state.inventory.push(cardId);
                            rewardDetail = "(카드가 인벤토리에 추가되었습니다)";
                        } else {
                            rewardDetail = "(이미 보유 중이라 추가 지급은 없습니다)";
                        }
                    }

                    this.global.secretDateFlag = false;
                    this.saveGlobalData();
                    this.saveGame();

                    this.openInfoModal("💕 비밀 데이트 종료",
                        `<div style="text-align:center;">
                            <div class="portrait" style="width:120px; height:160px; margin:0 auto 10px auto; border-color:#ff80ab;">
                                <img data-image-src="루미.png" alt="Rumi" style="width:100%; height:100%; object-fit:contain;">
                            </div>
                            루미와의 특별한 비밀 데이트가 끝났어요!<br><br>
                            <b style="color:#ffd700; font-size:1.2rem;">🎴 이벤트 카드 획득: ${cardName}</b><br>
                            <span style="font-size:0.8rem; color:#aaa;">${rewardDetail}</span>
                        </div>`
                    );
                } else {
                    const prob = (this.state.enemyScale >= 30) ? 0.3 : 0.1;
                    const triggerSecret = Math.random() < prob;

                    this.saveGlobalData();
                    this.saveGame();

                    if (triggerSecret) {
                        this.global.secretDateFlag = true;
                        this.saveGlobalData();

                        this.openInfoModal("💕 데이트 종료",
                            `<div style="text-align:center;">
                                <div class="portrait" style="width:120px; height:160px; margin:0 auto 10px auto; border-color:#ff80ab;">
                                    <img data-image-src="루미.png" alt="Rumi" style="width:100%; height:100%; object-fit:contain;">
                                </div>
                                루미와의 즐거운 데이트가 끝났어요!<br><br>
                                <span style="color:#ff80ab;">(헤헤) 형아... 다음에는 특별한 데이트를 준비해둘게!</span><br>
                                <span style="color:#ffd700;">기대해도 좋아! 약속해!</span><br><br>
                                <b style="color:#ffd700;">🌟 비밀 데이트가 예약되었습니다!</b><br>
                                <span style="font-size:0.8rem; color:#aaa;">(게임이 자동 저장되었습니다)</span>
                            </div>`
                        );
                    } else {
                        this.openInfoModal("💕 데이트 종료",
                            `<div style="text-align:center;">
                                <div class="portrait" style="width:120px; height:160px; margin:0 auto 10px auto; border-color:#ff80ab;">
                                    <img data-image-src="루미.png" alt="Rumi" style="width:100%; height:100%; object-fit:contain;">
                                </div>
                                루미와의 즐거운 데이트가 끝났어요!<br><br>
                                <span style="color:#ff80ab;">(뿌듯) 형아, 오늘 너무 재밌었어! 또 데이트하자!</span><br><br>
                                <span style="font-size:0.8rem; color:#aaa;">(게임이 자동 저장되었습니다)</span>
                            </div>`
                        );
                    }
                }
            },
        };

        // DOMContentLoaded is not blocked by missing images. The sequential
        // script loader may still be running, so waitForInitialDataLoad also
        // waits for window._scriptLoadComplete before enabling any button.
        document.addEventListener('DOMContentLoaded', () => {
            ImageAssets.hydrate(document);
            RPG.bindGameFullscreen();
            RPG.waitForInitialDataLoad();
        });