(function () {
    function getModal(id) {
        return document.getElementById(id);
    }

    function setModalActive(id, active) {
        const modal = getModal(id);
        if (!modal) return null;
        modal.classList.toggle('active', !!active);
        return modal;
    }

    function syncTicketUi(rpg) {
        const ticketEl = document.getElementById('ui-tickets');
        if (ticketEl) ticketEl.innerText = rpg.state.tickets;
    }

    function syncBlessingUi(id, value) {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    }

    function getImageSrc(rpg, name) {
        if (typeof rpg.getCharacterImageSrc === 'function') {
            return rpg.getCharacterImageSrc(name);
        }
        return `${name}.png`;
    }

    function getToeicTypeLabel(rpg, type) {
        if (typeof rpg.getToeicTypeLabel === 'function') {
            return rpg.getToeicTypeLabel(type);
        }
        const labels = typeof RPGConfig !== 'undefined' && RPGConfig.TOEIC_TYPE_LABELS
            ? RPGConfig.TOEIC_TYPE_LABELS
            : {};
        return labels[type] || labels.default || '문제';
    }

    function setToeicExitEnabled(enabled) {
        const exitBtn = document.getElementById('toeic-exit-btn');
        if (!exitBtn) return;
        exitBtn.disabled = !enabled;
        exitBtn.style.opacity = enabled ? '1' : '0.4';
        exitBtn.style.pointerEvents = enabled ? 'auto' : 'none';
    }

    function showLectureRetryConfirm(rpg, lectureId, onSkip) {
        rpg.showConfirm(
            `오답입니다... 관련 문법 강좌(${lectureId}강)를 확인하시겠습니까?`,
            () => {
                rpg.showLecture(lectureId, () => {
                    onSkip();
                });
            },
            () => {
                onSkip();
            }
        );
    }

    function handleQuizReward(rpg, startQuiz, rewardAmount, successMessage, failMessage) {
        startQuiz((success) => {
            if (success) {
                rpg.state.tickets += rewardAmount;
                syncTicketUi(rpg);
                rpg.showAlert(successMessage);
            } else {
                rpg.showAlert(failMessage);
            }
            rpg.toMenu();
        });
    }

    function handleCreatorGodGrammarReward(rpg, onSuccess, onFailure) {
        const q = rpg.getRandomGrammarQuiz();
        if (!q) {
            rpg.toMenu();
            return;
        }

        rpg.startGrammarQuiz(
            q,
            onSuccess,
            () => {
                showLectureRetryConfirm(rpg, q.lecture_id, onFailure);
            }
        );
    }

    const RPGFlowMethods = {
        startTutoringQuiz() {
            if (!this.currentTutoringItem) return;

            const item = this.currentTutoringItem;
            const data = item.data;

            const onCorrect = () => {
                if (!this.state.tutoredItems) this.state.tutoredItems = [];
                const itemId = item.type === 'collocation' ? data.id : data.word;
                this.state.tutoredItems.push(itemId);
                if (this.state.tutoredItems.length > 3) {
                    this.state.tutoredItems.shift();
                }

                if (item.type === 'collocation') {
                    this.state.wrongCollocations = this.state.wrongCollocations.filter(id => id !== data.id);
                    Storage.save(Storage.keys.COLLOCATION, this.state.wrongCollocations);
                } else {
                    this.state.wrongWords = this.state.wrongWords.filter(word => word !== data.word);
                    Storage.save(Storage.keys.VOCAB, this.state.wrongWords);
                }

                setModalActive('modal-tutoring', false);
                this.toMenu();

                this.state.rumiGiftCount = this.state.rumiGiftCount || 0;
                if (this.state.rumiGiftCount < 3 && Math.random() < 0.3) {
                    this.state.rumiGiftCount++;
                    this.state.tickets = (this.state.tickets || 0) + 1;
                    syncTicketUi(this);

                    this.openInfoModal(
                        "루미의 깜짝 선물!",
                        `<div style="text-align:center;">
                                <div class="portrait" style="width:120px; height:160px; margin:0 auto 10px auto; border-color:#448af f;">
                                    <img src="${getImageSrc(this, '루미')}" onerror="this.src=''" alt="Rumi" style="width:100%; height:100%; object-fit:contain;">
                                </div>
                                형아! 공부하느라 고생했어! (헤헤)<br>이거 줄게, 받아!<br><br>
                                <b style="color:#ffd700; font-size:1.2rem;">[티켓 1장 획득]</b><br>
                                <span style="font-size:0.8rem; color:#aaa;">(오답노트에서도 삭제되었습니다)</span>
                            </div>`,
                        () => {
                            this.toMenu();
                        }
                    );
                } else {
                    this.showAlert("학습 완료! 오답노트에서 삭제되었습니다.");
                }
            };

            const config = QuizEngine.buildTutoringQuiz(item, onCorrect, () => { });
            config.correctDelay = 1500;
            config.wrongDelay = 2000;
            QuizEngine.show(config);
        },

        activateChaos(type) {
            if (type === 'great_sage') {
                if (this.state.greatSageBlessingUses <= 0) {
                    return this.showAlert("대현자의 축복 기회를 모두 소진했습니다. (새로하기 시 리셋)");
                }

                setModalActive('modal-chaos', false);
                const q = this.getRandomGrammarQuiz();
                if (!q) {
                    return this.showAlert("문법 퀴즈 데이터가 없습니다.");
                }

                this.showConfirm(
                    `이 문제는 ${q.lecture_id}강의 내용이야. 강의를 확인하고 풀래?`,
                    () => {
                        this.showLecture(q.lecture_id, () => {
                            this.startGrammarQuiz(q);
                        });
                    },
                    () => {
                        this.startGrammarQuiz(q);
                    }
                );
                return;
            }

            if (this.state.chaosBlessingUses <= 0) {
                return this.showAlert("이번 전투 구간의 축복 기회를 모두 소진했습니다.");
            }

            setModalActive('modal-chaos', false);

            let bonus = 0;
            if (this.state.mode === 'suffering') bonus = 2;
            if (this.state.mode === 'overdrive') bonus = 1;

            if (type === 'normal') {
                this.applyChaosBlessing(3 + bonus);
                return;
            }

            if (type === 'challenge') {
                this.startChaosQuiz((success) => {
                    if (success) {
                        this.applyChaosBlessing(5 + bonus);
                    } else {
                        this.state.chaosBlessingUses--;
                        syncBlessingUi('chaos-uses', this.state.chaosBlessingUses);
                        this.showAlert("오답입니다... 기회 1회가 차감되었습니다.");
                    }
                });
            }
        },

        applyGreatSageBlessing() {
            this.state.greatSageBlessingUses--;
            syncBlessingUi('sage-uses', this.state.greatSageBlessingUses);

            this.state.tickets += GAME_CONSTANTS.BONUS_REWARDS.SAGE_BLESSING;
            syncTicketUi(this);

            const pool = GameUtils.buildCardPool(this.global, {
                excludeTranscendence: true,
                excludeEvent: true,
                activeBonusPoolIds: this.state.activeBonusPoolIds,
                specialCardSelections: this.state.activeSpecialCardSelections,
                maxGrade: GameUtils.getMaxGradeForMode(this.state.mode)
            });

            const picks = this.pickUniqueRandomCards(pool, GAME_CONSTANTS.SAGE_BLESSING_PICK_COUNT);
            this.state.activeChaosBlessing = [];

            let newBuffs = picks.map(card => {
                let mult = 0;
                if (card.grade === 'normal') mult = 0.4;
                else if (card.grade === 'rare') mult = 0.3;
                else if (card.grade === 'epic') mult = 0.2;
                else if (card.grade === 'legend') mult = 0.1;
                return { id: card.id, name: card.name, grade: card.grade, multiplier: mult, isSage: true };
            });

            newBuffs = this.sortBlessingsByGrade(newBuffs);
            this.state.activeSageBlessing = newBuffs;
            this.updateMergedBlessings();

            let msg = "<b>대현자의 축복 성공!</b><br>12명의 동료에게 축복이 내려졌습니다.<br>드로우 티켓 1장 획득!<br><br><b>[새로 적용된 축복]</b><br>";
            newBuffs.forEach(buff => {
                msg += `[${buff.name}] 올스탯 +${Math.round(buff.multiplier * 100)}%, 치명타/회피율 증가<br>`;
            });
            msg += `<br><b>(현재 총 활성화된 축복: ${this.state.chaosBuffs.length}개)</b>`;

            this.openInfoModal("축복 성공", msg);
        },

        reshuffleChaosPool() {
            if (this.state.tickets < GAME_CONSTANTS.COSTS.CHAOS_SHUFFLE) {
                return this.showAlert("셔플할 티켓이 부족합니다.");
            }

            this.showDoubleConfirm(
                `현재 보유한 모든 카드와 덱 구성이 사라집니다.<br>
            티켓 1장을 사용하여 새로운 15장을 받으시겠습니까?`,
                `정말 셔플하시겠습니까?<br>현재 덱과 인벤토리가 모두 초기화됩니다.`,
                () => {
                    this.state.tickets -= GAME_CONSTANTS.COSTS.CHAOS_SHUFFLE;
                    syncTicketUi(this);

                    const allCards = GameUtils.buildCardPool(this.global, {
                        includeTranscendence: true,
                        activeTranscendenceCards: this.state.activeTranscendenceCards,
                        activeBonusPoolIds: this.state.activeBonusPoolIds,
                        specialCardSelections: this.state.activeSpecialCardSelections,
                        activeEventCards: this.state.activeEventCards
                    });

                    const newPicks = this.buildChaosPoolCardIds(allCards);
                    this.state.chaosPool = newPicks;
                    this.state.inventory = [...newPicks];
                    this.state.deck = [null, null, null];
                    this.saveGame();

                    let legendCnt = 0;
                    let epicCnt = 0;
                    newPicks.forEach(id => {
                        const card = this.getCardData(id);
                        if (!card) return;
                        if (card.grade === 'legend') legendCnt++;
                        if (card.grade === 'epic') epicCnt++;
                    });

                    this.showAlert(
                        `<b>카오스 셔플 완료!</b><br><br>
                    새로운 15장이 지급되었습니다.<br>
                    (전설: ${legendCnt}, 에픽: ${epicCnt})<br><br>
                    * 덱이 초기화되었으니 다시 구성해주세요.`
                    );
                }
            );
        },

        openGacha() {
            if (this.state.tickets < GAME_CONSTANTS.COSTS.GACHA_SINGLE) {
                return this.showAlert("티켓이 부족합니다.");
            }
            this.state.tickets -= GAME_CONSTANTS.COSTS.GACHA_SINGLE;
            this.runGacha(false);
        },

        openChallengeGacha() {
            if (this.state.tickets < GAME_CONSTANTS.COSTS.GACHA_SINGLE) {
                return this.showAlert("티켓이 부족합니다.");
            }

            this.state.tickets -= GAME_CONSTANTS.COSTS.GACHA_SINGLE;
            syncTicketUi(this);

            this.startQuiz((success) => {
                if (success) {
                    this.runGacha(true);
                } else {
                    this.showAlert("오답입니다! (티켓은 반환되지 않습니다)");
                }
            });
        },

        runGacha(isChallenge) {
            syncTicketUi(this);
            const mode = this.state.mode;

            let grade = GameUtils.resolveGachaGrade(mode, isChallenge);
            let pool = GameUtils.buildCardPool(this.global, {
                activeBonusPoolIds: this.state.activeBonusPoolIds,
                specialCardSelections: this.state.activeSpecialCardSelections
            }).filter(card => card.grade === grade);

            if (pool.length === 0) {
                console.error("Empty pool for grade: " + grade);
                grade = 'normal';
                pool = GameUtils.buildCardPool(this.global, {
                    activeBonusPoolIds: this.state.activeBonusPoolIds,
                    specialCardSelections: this.state.activeSpecialCardSelections
                }).filter(card => card.grade === 'normal');
            }

            const pick = pool[Math.floor(Math.random() * pool.length)];
            if (!pick) {
                return this.showAlert("뽑기 가능한 카드가 없습니다.");
            }

            this.state.inventory.push(pick.id);

            const modal = getModal('modal-gacha');
            const content = getModal('gacha-result');
            let color = '#bdbdbd';
            let title = "획득!";
            if (pick.grade === 'transcendence') {
                color = '#ffd700';
                title = "🌟 초월 카드 강림! 🌟";
            } else if (grade === 'legend') {
                color = '#ff5252';
                title = "🎉 대박! 전설 카드! 🎉";
            } else if (grade === 'epic') {
                color = '#e040fb';
                title = "✨ 에픽 카드! ✨";
            }

            let msgTitle = isChallenge ? "도전 뽑기 성공!" : "획득!";
            if (pick.grade === 'transcendence') msgTitle = title;
            getModal('gacha-title').innerText = msgTitle;
            content.innerHTML = `<div style="color:${color}; font-size:1.2rem; font-weight:bold; margin-bottom:10px;">[${pick.grade.toUpperCase()}] ${pick.name}</div>
            <div class="portrait" style="width:120px; height:160px; margin:0 auto;"><img src="${getImageSrc(this, pick.name)}" onerror="this.style.display='none'"></div><p>새로운 동료를 얻었습니다!</p>`;
            if (modal) modal.classList.add('active');
        },

        finishWinBattle(deadMsg, gameClear, quizResult) {
            let msg = "승리!<br>보상을 획득했습니다.";

            if (quizResult !== null) {
                const correct = this.state.quiz_stats.correct;
                const total = this.state.quiz_stats.total;
                const rate = total > 0 ? ((correct / total) * 100).toFixed(1) : "0.0";
                const resultMsg = quizResult
                    ? "<span style='color:#4caf50'>정답!</span>"
                    : "<span style='color:#ef5350'>오답...</span>";
                msg = `[퀴즈 결과] ${resultMsg}<br>현황: ${correct}/${total} (${rate}%)<hr>` + msg;
            }

            if (this.state.mode === 'chaos') msg += "<br><br>카오스 모드: 덱과 인벤토리가 초기화되었습니다.";
            if (this.state.mode === 'draft') msg += "<br><br>드래프트 모드: 덱과 인벤토리가 초기화되었습니다.";
            if (deadMsg) msg += "<br><br>" + deadMsg;

            if (gameClear) {
                if (this.state.mode === 'archive') {
                    const rate = this.state.quiz_stats.total > 0
                        ? (this.state.quiz_stats.correct / this.state.quiz_stats.total)
                        : 0;
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

                if (this.state.gameType === 'challenge' && this.checkAllBonusUnlocked()) {
                    this.global.chaosTickets = (this.global.chaosTickets || 0) + 1;
                    this.saveGlobalData();
                    this.log("<b>[보너스]</b> 카오스 티켓 1장 획득!");
                }

                if (!this.global.unlocked_modes.includes(this.state.mode)) {
                    this.global.unlocked_modes.push(this.state.mode);
                }
                this.global.achievements[this.state.mode] = true;

                let newCard = null;
                const lockedBonus = this.getStandardBonusCards()
                    .filter(card => !this.global.unlocked_bonus_cards.includes(card.id));
                if (lockedBonus.length > 0) {
                    const pick = lockedBonus[Math.floor(Math.random() * lockedBonus.length)];
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
                if (this.state.mode === 'archive') {
                    if (quizResult === false && this.state.lastArchiveQuizLectureId) {
                        showLectureRetryConfirm(this, this.state.lastArchiveQuizLectureId, () => {
                            this.toMenu();
                        });
                    } else {
                        this.toMenu();
                    }
                    return;
                }

                if (this.state.mode === 'chaos' || this.state.mode === 'draft') {
                    this.showConfirm(
                        "추가 보상을 위한 콜로케이션 퀴즈에 도전하시겠습니까?\n(성공 시 드로우권 1장 획득)",
                        () => {
                            handleQuizReward(
                                this,
                                callback => this.startCollocationQuiz(callback),
                                GAME_CONSTANTS.BONUS_REWARDS.QUIZ,
                                "정답! 드로우권 1장을 추가로 획득했습니다.",
                                "오답입니다... 보상 없음."
                            );
                        },
                        () => {
                            this.toMenu();
                        }
                    );
                    return;
                }

                if (this.battle.enemy.id === 'creator_god' && this.state.mode === 'artifact' && (this.state.artifacts || []).length < GAME_CONSTANTS.MAX_ARTIFACTS) {
                    this.showConfirm(
                        "창조신 격파 보너스! 문법 퀴즈에 도전하시겠습니까?\n(성공 시 아티팩트 획득 기회)",
                        () => {
                            handleCreatorGodGrammarReward(
                                this,
                                () => {
                                    this.openArtifactSelect();
                                },
                                () => {
                                    this.toMenu();
                                }
                            );
                        },
                        () => {
                            this.toMenu();
                        }
                    );
                    return;
                }

                if (this.battle.enemy.id === 'creator_god') {
                    this.showConfirm(
                        "창조신 격파 보너스! 문법 퀴즈에 도전하시겠습니까?\n(성공 시 뽑기권 3장 획득)",
                        () => {
                            handleCreatorGodGrammarReward(
                                this,
                                () => {
                                    this.state.tickets += GAME_CONSTANTS.BONUS_REWARDS.CREATOR_GOD_QUIZ;
                                    syncTicketUi(this);
                                    this.showAlert("정답! 뽑기권 3장을 추가로 획득했습니다.");
                                    this.toMenu();
                                },
                                () => {
                                    this.toMenu();
                                }
                            );
                        },
                        () => {
                            this.toMenu();
                        }
                    );
                    return;
                }

                this.showConfirm(
                    "추가 보상을 위한 퀴즈에 도전하시겠습니까?\n(성공 시 드로우권 1장 획득)",
                    () => {
                        handleQuizReward(
                            this,
                            callback => this.startQuiz(callback),
                            GAME_CONSTANTS.BONUS_REWARDS.QUIZ,
                            "정답! 드로우권 1장을 추가로 획득했습니다.",
                            "오답입니다... 보상 없음."
                        );
                    },
                    () => {
                        this.toMenu();
                    }
                );
            });
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
                set.questions &&
                set.questions.length > 0
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
            const expandedQuestions = [];
            const expandedShuffled = [];

            set.questions.forEach(question => {
                expandedQuestions.push(question);
                expandedShuffled.push(GameUtils.shuffle(question.options || []));
            });

            this.state.currentToeicSession = {
                set,
                qIndex: 0,
                expandedQuestions,
                shuffledOptions: expandedShuffled,
                results: [],
                viewState: 'hub',
                options: practiceOptions
            };

            setToeicExitEnabled(!practiceOptions.lockExit);
            setModalActive('modal-toeic-menu', false);
            const modal = setModalActive('modal-toeic-practice', true);
            if (modal) {
                modal.classList.remove('is-review');
                modal.classList.remove('is-explanation');
            }

            this.renderToeicQuestion();

            if (hiddenUnlocked) {
                setTimeout(() => {
                    this.showAlert("엔드리스 히든 모드 '꿈의회랑'이 출현했습니다.");
                }, 150);
            }
        },

        checkToeicAnswer(btn, selected, correct) {
            const session = this.state.currentToeicSession;
            const sessionOptions = session.options || {};
            const options = document.getElementById('toeic-options').children;
            for (const option of options) option.disabled = true;

            const backBtn = document.getElementById('toeic-q-back-btn');
            if (backBtn) backBtn.style.pointerEvents = 'none';

            session.isAnswering = true;

            const feedback = document.getElementById('toeic-feedback');
            const question = session.expandedQuestions[session.qIndex];
            const isCorrect = selected === correct;

            session.results.push({
                id: question.id,
                question: question.question,
                isCorrect,
                userAnswer: selected,
                correctAnswer: correct
            });

            if (isCorrect) {
                btn.classList.add('correct');
                feedback.innerHTML = "<span style='color:#4caf50'>정답!</span>";
            } else {
                btn.classList.add('wrong');
                feedback.innerHTML = `<span style='color:#ef5350'>오답... 정답: ${correct}</span>`;
                for (const option of options) {
                    if (option.innerText === correct) option.classList.add('correct');
                }
            }

            if (!isCorrect && typeof sessionOptions.onFailure === 'function') {
                setTimeout(() => {
                    session.isAnswering = false;
                    if (backBtn) backBtn.style.pointerEvents = 'auto';
                    setModalActive('modal-toeic-practice', false);
                    setModalActive('modal-toeic-result', false);
                    const onFailure = sessionOptions.onFailure;
                    this.state.currentToeicSession = null;
                    onFailure();
                }, 800);
                return;
            }

            setTimeout(() => {
                session.isAnswering = false;
                if (backBtn) backBtn.style.pointerEvents = 'auto';

                session.qIndex++;
                const totalQ = session.expandedQuestions.length;

                if (session.qIndex >= totalQ) {
                    this.finishToeicSession();
                } else if (session.set.type === 'part5') {
                    this._renderToeicQuestionContent();
                    document.getElementById('toeic-title').innerText =
                        `${getToeicTypeLabel(this, session.set.type)} (${session.qIndex + 1}/${totalQ})`;
                } else {
                    this.backToToeicHub();
                }
            }, 2000);
        },

        finishToeicSession() {
            const session = this.state.currentToeicSession;
            const set = session.set;
            const sessionOptions = session.options || {};

            if (!this.state.completedToeicSets.includes(set.id)) {
                this.state.completedToeicSets.push(set.id);
            }

            if (!sessionOptions.ignoreSessionLimit) {
                this.state.toeicPracticeDone = true;
            }

            const bonusUses = (typeof GAME_CONSTANTS !== 'undefined' && GAME_CONSTANTS.DEFAULT_BLESSING_USES)
                ? GAME_CONSTANTS.DEFAULT_BLESSING_USES
                : 3;
            this.state.greatSageBlessingUses = (this.state.greatSageBlessingUses || 0) + bonusUses;
            syncBlessingUi('sage-uses', this.state.greatSageBlessingUses);

            setToeicExitEnabled(false);
            this.saveGame(false);
            setModalActive('modal-toeic-practice', false);

            const results = session.results || [];
            const correctCount = results.filter(result => result.isCorrect).length;
            const total = results.length;
            const wrongList = results.filter(result => !result.isCorrect);

            if (sessionOptions.suppressDate) {
                setToeicExitEnabled(true);
                const onComplete = sessionOptions.onComplete;
                this.state.currentToeicSession = null;
                if (typeof onComplete === 'function') {
                    onComplete({ correctCount, total, wrongList });
                }
                return;
            }

            let msg = `수고하셨습니다!<br>'${set.title}' 학습을 완료했습니다.<br><br>`;
            msg += `정답률: ${correctCount}/${total} (${total > 0 ? ((correctCount / total) * 100).toFixed(0) : 0}%)<br><br>`;

            if (wrongList.length > 0) {
                msg += `<b>[틀린 문제]</b><br>`;
                wrongList.forEach(item => {
                    msg += `- ${item.question.substring(0, 30)}... (정답: ${item.correctAnswer})<br>`;
                });
                msg += `<br>`;
            }

            msg += `<b style="color:#00e676">대현자의 축복 횟수가 3회 추가되었습니다! (현재 ${this.state.greatSageBlessingUses}회)</b>`;

            document.getElementById('toeic-result-content').innerHTML = msg;
            setModalActive('modal-toeic-result', true);
        },

        async startDate() {
            if (this.isApiLoading) {
                return this.showAlert("이전 요청 처리 중입니다...");
            }

            const key = this.ensureApiKey('데이트를 시작하려면');
            if (!key) {
                return this.showAlert("API 키가 없어 데이트를 시작할 수 없습니다.");
            }

            this.clearToeicLumiQuestionSession({ abort: true, clearCurrentToeic: true });

            const dateParams = this._getDateParams();
            const now = new Date();
            const lastDateStr = this.global.lastDateTimestamp;
            let daysSinceLastDate = 0;
            if (lastDateStr) {
                const lastDate = new Date(lastDateStr);
                daysSinceLastDate = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
            }
            dateParams.daysSinceLastDate = daysSinceLastDate;
            this._currentDateParams = dateParams;

            setModalActive('modal-date', true);
            const contentBox = document.getElementById('date-content');
            contentBox.innerHTML = `<div style="text-align:center; color:#ff80ab;">💕 루미가 데이트를 준비하고 있어요...<br>(잠시만 기다려주세요)<br><br><span style="font-size:0.8rem; color:#aaa;">테마: ${dateParams.theme} | 의상: ${dateParams.outfit}<br>날씨: ${dateParams.weather} | 키워드: ${dateParams.keyword}</span></div>`;

            this.isApiLoading = true;

            try {
                const text = await GameAPI.getDateContent(key, dateParams);
                const dateModal = getModal('modal-date');
                if (!dateModal || !dateModal.classList.contains('active')) return;

                contentBox.innerHTML = this.formatSafeRichText(text);
            } catch (error) {
                console.error(error);
                const msg = error.message || "";
                let displayMsg = "알 수 없는 오류가 발생했습니다.";
                if (msg.includes('key') || msg.includes('valid') || msg.includes('400') || msg.includes('403')) {
                    displayMsg = "API 키가 올바르지 않거나 설정되지 않았습니다.";
                } else if (msg.includes('quota') || msg.includes('429')) {
                    displayMsg = "API 사용량이 초과되었습니다.";
                } else if (msg.includes('safety') || msg.includes('blocked')) {
                    displayMsg = "안전 필터에 의해 차단되었습니다.";
                } else {
                    displayMsg = "오류: " + msg;
                }
                contentBox.innerHTML = `<div style="color:#ef5350; font-weight:bold;">${this.escapeHtml(displayMsg)}</div>`;
            } finally {
                this.isApiLoading = false;
            }
        }
    };

    window.RPGFlowModules = {
        install(rpg) {
            Object.assign(rpg, RPGFlowMethods);
        },
        methods: RPGFlowMethods
    };
})();
