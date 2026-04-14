(function () {
    const SPECIAL_CARD_GROUPS = [
        { baseId: 'jasmine', label: '자스민' },
        { baseId: 'rumi', label: '루미' },
        { baseId: 'luna', label: '루나' },
        { baseId: 'zeke', label: '지크' },
        { baseId: 'cherry_prince', label: '체리프린스' }
    ];

    const SPECIAL_MISSION_SEASONS = {
        valentine: {
            id: 'valentine',
            title: '스페셜미션(발렌타인)',
            bossId: 'flora_valentine',
            bossName: '플로라(발렌타인)',
            rewardCardIds: ['luna_valentine', 'jasmine_valentine', 'rumi_valentine']
        },
        beach: {
            id: 'beach',
            title: '스페셜미션(해변)',
            bossId: 'thor_swimsuit',
            bossName: '토르(수영복)',
            rewardCardIds: ['jasmine_swimsuit', 'rumi_swimsuit', 'zeke_swimsuit']
        },
        halloween: {
            id: 'halloween',
            title: '스페셜미션(할로윈)',
            bossId: 'ares_halloween',
            bossName: '아레스(할로윈)',
            rewardCardIds: ['luna_halloween', 'zeke_halloween', 'rumi_halloween']
        },
        christmas: {
            id: 'christmas',
            title: '스페셜미션(크리스마스)',
            bossId: 'astea_christmas',
            bossName: '아스테아(크리스마스)',
            rewardCardIds: ['luna_christmas', 'jasmine_christmas', 'rumi_christmas']
        }
    };

    const RPGFeatureMethods = {
    loadStudyProgress() {
        const vocab = Storage.load(Storage.keys.VOCAB);
        if (vocab) this.state.wrongWords = vocab;

        const col = Storage.load(Storage.keys.COLLOCATION);
        if (col) this.state.wrongCollocations = col;
    },


    saveStudyProgress() {
        Storage.save(Storage.keys.VOCAB, this.state.wrongWords || []);
        if (this.state.wrongCollocations) {
            Storage.save(Storage.keys.COLLOCATION, this.state.wrongCollocations);
        }
    },


    getRandomGrammarQuiz() {
        const allQuizzes = GameUtils.getAllGrammarQuizzes();
        if (allQuizzes.length === 0) return null;
        return allQuizzes[Math.floor(Math.random() * allQuizzes.length)];
    },

    // --- Global Data ---

    loadGlobalData() {
        const data = Storage.load(Storage.keys.GLOBAL);
        if (data) {
            this.global = { ...this.global, ...data };
        }
        const changedBonusCards = this.ensureDefaultUnlockedBonusCards();
        const changedDivineArtifacts = this.ensureDivineArtifactState();
        const changedTicketState = this.ensureChaosTicketState();
        const changedSpecialData = this.ensureSpecialDataState();
        const changed = changedBonusCards || changedDivineArtifacts || changedTicketState || changedSpecialData;
        this.ensureBonusPoolPresetState();
        if (changed) this.saveGlobalData();
    },

    saveGlobalData() {
        Storage.save(Storage.keys.GLOBAL, this.global);
    },


    ensureDefaultUnlockedBonusCards() {
        if (!Array.isArray(this.global.unlocked_bonus_cards)) {
            this.global.unlocked_bonus_cards = [];
        }

        const defaults = (typeof GameUtils !== 'undefined' && typeof GameUtils.getDefaultUnlockedBonusCardIds === 'function')
            ? GameUtils.getDefaultUnlockedBonusCardIds()
            : [];

        let changed = false;
        defaults.forEach(id => {
            if (!this.global.unlocked_bonus_cards.includes(id)) {
                this.global.unlocked_bonus_cards.push(id);
                changed = true;
            }
        });
        return changed;
    },


    ensureDivineArtifactState() {
        if (!Array.isArray(this.global.unlocked_divine_artifacts)) {
            this.global.unlocked_divine_artifacts = [];
            return true;
        }

        const normalized = typeof GameUtils !== 'undefined' && typeof GameUtils.getUnlockedDivineArtifactIds === 'function'
            ? GameUtils.getUnlockedDivineArtifactIds(this.global)
            : this.global.unlocked_divine_artifacts;
        if (JSON.stringify(normalized) === JSON.stringify(this.global.unlocked_divine_artifacts)) {
            return false;
        }

        this.global.unlocked_divine_artifacts = normalized;
        return true;
    },


    ensureChaosTicketState() {
        let changed = false;
        if (!Number.isFinite(this.global.chaosTickets)) {
            this.global.chaosTickets = 0;
            changed = true;
        }
        if (this.global.chaosTicketVersion !== GAME_CONSTANTS.CHAOS_TICKET_VERSION) {
            this.global.chaosTickets = 0;
            this.global.chaosTicketVersion = GAME_CONSTANTS.CHAOS_TICKET_VERSION;
            changed = true;
        }
        return changed;
    },


    ensureSpecialDataState() {
        let changed = false;

        if (!Array.isArray(this.global.unlocked_special_cards)) {
            this.global.unlocked_special_cards = [];
            changed = true;
        }

        const normalizedSelections = this.normalizeSpecialCardSelections(this.global.activeSpecialCardSelections);
        const currentSelections = this.global.activeSpecialCardSelections || {};
        const sameSelection =
            JSON.stringify(normalizedSelections) === JSON.stringify(currentSelections);
        if (!sameSelection) {
            this.global.activeSpecialCardSelections = normalizedSelections;
            changed = true;
        } else if (!this.global.activeSpecialCardSelections) {
            this.global.activeSpecialCardSelections = normalizedSelections;
            changed = true;
        }

        const season = this.getCurrentSpecialSeason();
        const mission = this.global.specialMission;
        if (!mission || mission.seasonId !== season.id) {
            const keepUnlocked = !!(mission && mission.unlocked && this.getRemainingSpecialRewardCards(season.id).length > 0);
            this.global.specialMission = this.createSpecialMissionState({ season, unlocked: keepUnlocked });
            changed = true;
        } else if (
            (mission.unlocked && this.getRemainingSpecialRewardCards(season.id).length === 0) ||
            (mission.unlocked && !mission.rewardCardId)
        ) {
            this.global.specialMission = this.createSpecialMissionState({ season, unlocked: false });
            changed = true;
        }

        return changed;
    },


    getSpecialCardGroups() {
        return SPECIAL_CARD_GROUPS.map(group => ({ ...group }));
    },


    getCurrentSpecialSeason(date = new Date()) {
        const month = date.getMonth() + 1;
        if (month >= 3 && month <= 5) return SPECIAL_MISSION_SEASONS.valentine;
        if (month >= 6 && month <= 8) return SPECIAL_MISSION_SEASONS.beach;
        if (month >= 9 && month <= 11) return SPECIAL_MISSION_SEASONS.halloween;
        return SPECIAL_MISSION_SEASONS.christmas;
    },


    getSpecialMissionUnlockChance(stageNumber) {
        if (stageNumber >= 36) return 0.30;
        if (stageNumber >= 30) return 0.25;
        if (stageNumber >= 24) return 0.20;
        if (stageNumber >= 18) return 0.15;
        if (stageNumber >= 12) return 0.10;
        if (stageNumber >= 6) return 0.05;
        return 0;
    },


    getRemainingSpecialRewardCards(seasonId = this.getCurrentSpecialSeason().id) {
        const season = SPECIAL_MISSION_SEASONS[seasonId];
        if (!season) return [];

        const unlocked = new Set(this.global.unlocked_special_cards || []);
        return season.rewardCardIds
            .filter(id => !unlocked.has(id))
            .map(id => this.getCardData(id))
            .filter(Boolean);
    },


    normalizeSpecialCardSelections(selections) {
        const owned = new Set(this.global.unlocked_special_cards || []);
        const normalized = {};
        if (!selections || typeof selections !== 'object') return normalized;

        Object.entries(selections).forEach(([baseId, specialId]) => {
            const card = this.getCardData(specialId);
            if (!card || !card.specialCard || card.specialBaseId !== baseId || !owned.has(specialId)) return;
            normalized[baseId] = specialId;
        });

        return normalized;
    },


    getActiveSpecialCardSelections(source = 'global') {
        if (source === 'state' && this.state && this.state.activeSpecialCardSelections) {
            return this.normalizeSpecialCardSelections(this.state.activeSpecialCardSelections);
        }
        return this.normalizeSpecialCardSelections(this.global.activeSpecialCardSelections);
    },


    hasUnlockedSpecialCards() {
        return Array.isArray(this.global.unlocked_special_cards) && this.global.unlocked_special_cards.length > 0;
    },


    getUnlockedSpecialCards() {
        const unlocked = new Set(this.global.unlocked_special_cards || []);
        return (typeof SPECIAL_CARDS !== 'undefined' ? SPECIAL_CARDS : []).filter(card => unlocked.has(card.id));
    },


    createSpecialMissionState(options = {}) {
        const season = options.season || this.getCurrentSpecialSeason();
        const rewardPool = this.getRemainingSpecialRewardCards(season.id);
        const unlocked = !!options.unlocked && rewardPool.length > 0;
        const rewardCard = unlocked
            ? rewardPool[Math.floor(Math.random() * rewardPool.length)] || null
            : null;

        return {
            seasonId: season.id,
            seasonTitle: season.title,
            unlocked,
            rewardCardId: rewardCard ? rewardCard.id : null,
            missions: {
                boss: { label: `엔드리스 모드에서 ${season.bossName} 격파`, progress: 0, target: 1 },
                toeic3: { label: '실전마법연습 3회 플레이', progress: 0, target: 3 },
                challenge3: { label: '챌린지모드 클리어 3회', progress: 0, target: 3 }
            }
        };
    },


    ensureSpecialMissionState() {
        const season = this.getCurrentSpecialSeason();
        const remainingRewards = this.getRemainingSpecialRewardCards(season.id);
        if (!this.global.specialMission || this.global.specialMission.seasonId !== season.id) {
            const keepUnlocked = !!(this.global.specialMission && this.global.specialMission.unlocked && remainingRewards.length > 0);
            this.global.specialMission = this.createSpecialMissionState({ season, unlocked: keepUnlocked });
            this.saveGlobalData();
        } else if (
            (this.global.specialMission.unlocked && remainingRewards.length === 0) ||
            (this.global.specialMission.unlocked && !this.global.specialMission.rewardCardId)
        ) {
            this.global.specialMission = this.createSpecialMissionState({ season, unlocked: false });
            this.saveGlobalData();
        }
        return this.global.specialMission;
    },


    isSpecialMissionVisible() {
        const special = this.ensureSpecialMissionState();
        return !!(special && special.unlocked && special.rewardCardId);
    },


    incrementSpecialMissionProgress(id, amount = 1) {
        const special = this.ensureSpecialMissionState();
        if (!special.unlocked) return;
        const mission = special.missions ? special.missions[id] : null;
        if (!mission) return;
        mission.progress = Math.min(mission.target, (mission.progress || 0) + amount);
        this.saveGlobalData();
    },


    areAllSpecialMissionsCleared() {
        const special = this.ensureSpecialMissionState();
        if (!special.unlocked) return false;
        return Object.values(special.missions || {}).every(mission => (mission.progress || 0) >= mission.target);
    },


    claimSpecialMissionReward() {
        const special = this.ensureSpecialMissionState();
        if (!special.unlocked || !special.rewardCardId) {
            return this.showAlert('해금된 스페셜 미션이 없습니다.');
        }
        if (!this.areAllSpecialMissionsCleared()) {
            return this.showAlert('모든 스페셜 미션을 완료해야 보상을 받을 수 있습니다.');
        }

        const reward = this.getCardData(special.rewardCardId);
        if (!reward) return this.showAlert('이번 시즌 보상 카드가 없습니다.');

        if (!this.global.unlocked_special_cards.includes(reward.id)) {
            this.global.unlocked_special_cards.push(reward.id);
        }

        const season = this.getCurrentSpecialSeason();
        this.global.activeSpecialCardSelections = this.normalizeSpecialCardSelections(this.global.activeSpecialCardSelections);
        this.global.specialMission = this.createSpecialMissionState({ season, unlocked: false });
        this.saveGlobalData();

        if (typeof this.updateSpecialCardEditorButton === 'function') this.updateSpecialCardEditorButton();
        if (typeof this.renderMonthlyMission === 'function') this.renderMonthlyMission();
        if (typeof this.renderMissionHub === 'function') this.renderMissionHub();
        if (typeof this.closeMonthlyMission === 'function') this.closeMonthlyMission();

        this.openInfoModal('스페셜 미션 보상', `<b>${reward.name}</b> 스페셜 카드를 획득했습니다!`);
    },


    tryUnlockSpecialMissionFromDreamCorridor(stageNumber) {
        const special = this.ensureSpecialMissionState();
        if (special.unlocked) return '';

        const season = this.getCurrentSpecialSeason();
        if (this.getRemainingSpecialRewardCards(season.id).length === 0) return '';

        const chance = this.getSpecialMissionUnlockChance(stageNumber);
        if (chance <= 0 || Math.random() >= chance) return '';

        this.global.specialMission = this.createSpecialMissionState({ season, unlocked: true });
        this.saveGlobalData();

        const percent = Math.round(chance * 100);
        return `<b>스페셜 미션 해금!</b><br>${season.title}이 열렸습니다. (해금 확률 ${percent}%)`;
    },


    getStandardBonusCards() {
        if (typeof GameUtils !== 'undefined' && typeof GameUtils.getBonusCards === 'function') {
            return GameUtils.getBonusCards().filter(card => card.unlockSource !== 'hidden');
        }
        return BONUS_CARDS.filter(card => card.unlockSource !== 'hidden');
    },


    getHiddenBonusCards() {
        if (typeof GameUtils !== 'undefined' && typeof GameUtils.getBonusCards === 'function') {
            return GameUtils.getBonusCards().filter(card => card.unlockSource === 'hidden');
        }
        return BONUS_CARDS.filter(card => card.unlockSource === 'hidden');
    },


    getGradeSortValue(grade) {
        const gradeOrder = {
            transcendence: 0,
            legend: 1,
            epic: 2,
            rare: 3,
            normal: 4,
            event: 5
        };
        return gradeOrder[grade] ?? 99;
    },


    sortCardDataByGrade(cards) {
        return [...cards].sort((a, b) => {
            const gradeDiff = this.getGradeSortValue(a.grade) - this.getGradeSortValue(b.grade);
            if (gradeDiff !== 0) return gradeDiff;
            return a.name.localeCompare(b.name, 'ko');
        });
    },


    sortCardIdsByGrade(ids) {
        return [...ids].sort((a, b) => {
            const cardA = this.getCardData(a);
            const cardB = this.getCardData(b);
            if (!cardA && !cardB) return 0;
            if (!cardA) return 1;
            if (!cardB) return -1;
            const gradeDiff = this.getGradeSortValue(cardA.grade) - this.getGradeSortValue(cardB.grade);
            if (gradeDiff !== 0) return gradeDiff;
            return cardA.name.localeCompare(cardB.name, 'ko');
        });
    },


    sortBlessingsByGrade(blessings) {
        return [...blessings].sort((a, b) => {
            const gradeDiff = this.getGradeSortValue(a.grade) - this.getGradeSortValue(b.grade);
            if (gradeDiff !== 0) return gradeDiff;
            return a.name.localeCompare(b.name, 'ko');
        });
    },


    getCurrentMonthKey() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    },


    getCurrentDateKey(date = new Date()) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    },


    getCurrentWeekInfo(date = new Date()) {
        const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const diffToMonday = (localDate.getDay() + 6) % 7;
        const start = new Date(localDate);
        start.setDate(localDate.getDate() - diffToMonday);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        const format = value => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

        return {
            key: format(start),
            label: `${format(start)} ~ ${format(end)}`,
            todayKey: format(localDate)
        };
    },


    createMonthlyMissionState() {
        const hiddenCards = this.getHiddenBonusCards();
        const lockedHidden = hiddenCards.filter(card => !(this.global.unlocked_bonus_cards || []).includes(card.id));
        const rewardPool = lockedHidden.length > 0 ? lockedHidden : hiddenCards;
        const rewardCard = rewardPool[Math.floor(Math.random() * rewardPool.length)] || null;
        return {
            monthKey: this.getCurrentMonthKey(),
            rewardCardId: rewardCard ? rewardCard.id : null,
            claimed: false,
            missions: {
                endless40: { label: '무한 모드 40 스테이지 돌파', progress: 0, target: 1 },
                challenge3: { label: '챌린지 모드 클리어 3회', progress: 0, target: 3 },
                toeic3: { label: '실전마법연습 3회 플레이', progress: 0, target: 3 }
            }
        };
    },


    createWeeklyMissionState() {
        const weekInfo = this.getCurrentWeekInfo();
        return {
            weekKey: weekInfo.key,
            weekLabel: weekInfo.label,
            claimed: false,
            attendanceDays: [],
            missions: {
                challenge1: { label: '챌린지 모드 클리어 1회', progress: 0, target: 1 },
                toeic1: { label: '실전마법연습 1회 플레이', progress: 0, target: 1 },
                attendance3: { label: '3일 출석', progress: 0, target: 3 }
            }
        };
    },


    ensureMonthlyMissionState() {
        const currentKey = this.getCurrentMonthKey();
        if (!this.global.monthlyMission || this.global.monthlyMission.monthKey !== currentKey) {
            this.global.monthlyMission = this.createMonthlyMissionState();
            this.saveGlobalData();
        }
        return this.global.monthlyMission;
    },


    ensureWeeklyMissionState() {
        const weekInfo = this.getCurrentWeekInfo();
        if (!this.global.weeklyMission || this.global.weeklyMission.weekKey !== weekInfo.key) {
            this.global.weeklyMission = this.createWeeklyMissionState();
            this.saveGlobalData();
        } else if (this.global.weeklyMission.weekLabel !== weekInfo.label) {
            this.global.weeklyMission.weekLabel = weekInfo.label;
            this.saveGlobalData();
        }
        return this.global.weeklyMission;
    },


    incrementMonthlyMissionProgress(id, amount = 1) {
        const monthly = this.ensureMonthlyMissionState();
        const mission = monthly.missions ? monthly.missions[id] : null;
        if (!mission) return;
        mission.progress = Math.min(mission.target, (mission.progress || 0) + amount);
        this.saveGlobalData();
    },


    incrementWeeklyMissionProgress(id, amount = 1) {
        const weekly = this.ensureWeeklyMissionState();
        const mission = weekly.missions ? weekly.missions[id] : null;
        if (!mission) return;
        mission.progress = Math.min(mission.target, (mission.progress || 0) + amount);
        this.saveGlobalData();
    },


    areAllMonthlyMissionsCleared() {
        const monthly = this.ensureMonthlyMissionState();
        return Object.values(monthly.missions || {}).every(mission => (mission.progress || 0) >= mission.target);
    },


    areAllWeeklyMissionsCleared() {
        const weekly = this.ensureWeeklyMissionState();
        return Object.values(weekly.missions || {}).every(mission => (mission.progress || 0) >= mission.target);
    },


    getWeeklyChaosTicketRewardAmount() {
        const reward = GAME_CONSTANTS && Number.isFinite(GAME_CONSTANTS.WEEKLY_CHAOS_TICKET_REWARD)
            ? GAME_CONSTANTS.WEEKLY_CHAOS_TICKET_REWARD
            : 3;
        return reward;
    },


    claimMonthlyMissionReward() {
        const monthly = this.ensureMonthlyMissionState();
        if (monthly.claimed) return this.showAlert('이번 달 보상은 이미 수령했습니다.');
        if (!this.areAllMonthlyMissionsCleared()) return this.showAlert('모든 월간 미션을 완료해야 보상을 받을 수 있습니다.');
        const reward = monthly.rewardCardId ? this.getCardData(monthly.rewardCardId) : null;
        if (!reward) return this.showAlert('이번 달 보상 카드가 없습니다.');

        if (!this.global.unlocked_bonus_cards.includes(reward.id)) {
            this.global.unlocked_bonus_cards.push(reward.id);
        }
        monthly.claimed = true;
        this.saveGlobalData();
        this.updateBonusPoolEditorButton();
        this.renderMonthlyMission();
        this.openInfoModal('월간 미션 보상', `<b>${reward.name}</b> 이(가) 보너스 카드로 해금되었습니다!`);
    },


    claimWeeklyMissionReward() {
        const weekly = this.ensureWeeklyMissionState();
        if (weekly.claimed) return this.showAlert('이번 주 보상은 이미 수령했습니다.');
        if (!this.areAllWeeklyMissionsCleared()) return this.showAlert('모든 주간 미션을 완료해야 보상을 받을 수 있습니다.');

        const rewardAmount = this.getWeeklyChaosTicketRewardAmount();
        weekly.claimed = true;
        this.global.chaosTickets = (this.global.chaosTickets || 0) + rewardAmount;
        this.saveGlobalData();
        this.renderMonthlyMission();
        this.openInfoModal('주간 미션 보상', `카오스 티켓 ${rewardAmount}장을 획득했습니다!`);
    },


    registerToeicPracticeAttempt(options = {}) {
        if (options.countMonthly !== false) {
            this.incrementMonthlyMissionProgress('toeic3', 1);
        }
        if (options.countWeekly !== false) {
            this.incrementWeeklyMissionProgress('toeic1', 1);
        }
        if (options.countSpecial !== false) {
            this.incrementSpecialMissionProgress('toeic3', 1);
        }

        if (options.countHiddenUnlock === false || this.state.mode === 'dream_corridor') {
            return false;
        }

        let unlocked = false;
        if (this.global.tutoringEventEnabled === false) {
            this.global.hiddenStudyPracticeCount = (this.global.hiddenStudyPracticeCount || 0) + 1;
            if (!this.global.hiddenStudyReady && this.global.hiddenStudyPracticeCount >= 5) {
                this.global.hiddenStudyReady = true;
                unlocked = true;
            }
        } else {
            this.global.hiddenStudyPracticeCount = 0;
        }
        this.saveGlobalData();
        return unlocked;
    },


    clearPendingEnemySelection() {
        this.state.pendingEnemyId = null;
        this.state.pendingEnemyStage = null;
    },


    getEnemyDataById(id) {
        return ENEMIES.find(enemy => enemy.id === id) || ENEMIES[0];
    },


    getCurrentStageEnemyData() {
        if (this.state.pendingEnemyStage === this.state.enemyScale && this.state.pendingEnemyId) {
            return this.getEnemyDataById(this.state.pendingEnemyId);
        }

        const rotation = (typeof ENDLESS_ENEMY_ROTATION !== 'undefined' && ENDLESS_ENEMY_ROTATION.length > 0)
            ? ENDLESS_ENEMY_ROTATION
            : ENEMIES.slice(0, 6).map(enemy => enemy.id);
        const baseId = rotation[this.state.enemyScale % rotation.length];
        const stageNumber = this.state.enemyScale + 1;
        const hiddenBossMap = {
            artificial_demon_god: 'flora',
            iris_love: 'gray',
            iris_curse: 'thor',
            pharaoh: 'poseidon',
            demon_god: 'ares'
        };

        let enemyId = baseId;
        if (
            this.state.gameType === 'endless' &&
            this.state.mode !== 'dream_corridor' &&
            baseId === 'creator_god' &&
            this.isSpecialMissionVisible() &&
            Math.random() < this.getSpecialMissionUnlockChance(stageNumber)
        ) {
            enemyId = this.getCurrentSpecialSeason().bossId;
        }
        if (this.state.gameType === 'endless' && stageNumber > 36 && hiddenBossMap[baseId] && Math.random() < 0.3) {
            enemyId = hiddenBossMap[baseId];
        }

        this.state.pendingEnemyStage = this.state.enemyScale;
        this.state.pendingEnemyId = enemyId;
        return this.getEnemyDataById(enemyId);
    },


    trackDailyAttendance() {
        const weekly = this.ensureWeeklyMissionState();
        const weekInfo = this.getCurrentWeekInfo();
        if (this.global.lastAttendanceDate === weekInfo.todayKey) return;

        this.global.lastAttendanceDate = weekInfo.todayKey;
        if (!Array.isArray(weekly.attendanceDays)) {
            weekly.attendanceDays = [];
        }
        if (!weekly.attendanceDays.includes(weekInfo.todayKey)) {
            weekly.attendanceDays.push(weekInfo.todayKey);
            const mission = weekly.missions ? weekly.missions.attendance3 : null;
            if (mission) {
                mission.progress = Math.min(mission.target, weekly.attendanceDays.length);
            }
        }
        this.saveGlobalData();
    },


    checkAllBonusUnlocked() {
        if (!this.global.unlocked_bonus_cards) return false;
        return this.getStandardBonusCards().every(c => this.global.unlocked_bonus_cards.includes(c.id));
    },


    getUnlockedBonusCards() {
        const unlocked = new Set(this.global.unlocked_bonus_cards || []);
        return this.getStandardBonusCards()
            .concat(this.getHiddenBonusCards())
            .filter(card => unlocked.has(card.id));
    },


    getUnlockedBonusTranscendenceCards() {
        const unlocked = new Set(this.global.unlocked_bonus_transcendence_cards || []);
        const bonusTranscendenceCards = typeof BONUS_TRANSCENDENCE_CARDS !== 'undefined'
            ? BONUS_TRANSCENDENCE_CARDS
            : [];
        return bonusTranscendenceCards.filter(card => unlocked.has(card.id));
    },


    getUnlockedBonusCardCount() {
        return Array.isArray(this.global.unlocked_bonus_cards)
            ? this.global.unlocked_bonus_cards.length
            : 0;
    },


    needsChallengeSafety() {
        return this.state.gameType === 'challenge' && this.getUnlockedBonusCardCount() < 5;
    },


    applyBeginnerChallengeSafety(mode) {
        if (!this.needsChallengeSafety()) return;

        if (mode === 'chaos' || mode === 'draft') {
            this.state.tickets = Math.max(this.state.tickets, 5);
            return;
        }

        if (!this.state.inventory.includes('rumi')) {
            this.state.inventory.push('rumi');
        }
    },


    normalizeActiveBonusPoolIds(ids) {
        const unlockedIds = this.getUnlockedBonusCards().map(card => card.id);
        if (unlockedIds.length === 0) return [];
        if (!Array.isArray(ids)) return [...unlockedIds];

        const allowed = new Set(unlockedIds);
        const normalized = [];
        ids.forEach(id => {
            if (allowed.has(id) && !normalized.includes(id)) normalized.push(id);
        });
        return normalized;
    },


    ensureBonusPoolPresetState() {
        const maxPresets = GAME_CONSTANTS.MAX_BONUS_POOL_PRESETS || 3;
        const presets = Array.isArray(this.global.bonusPoolPresets)
            ? this.global.bonusPoolPresets.slice(0, maxPresets)
            : [];

        while (presets.length < maxPresets) {
            presets.push(null);
        }

        this.global.bonusPoolPresets = presets.map(preset => {
            if (!Array.isArray(preset)) return null;
            const deduped = [];
            preset.forEach(id => {
                if (!deduped.includes(id)) deduped.push(id);
            });
            return deduped;
        });

        const activeIndex = Number.isInteger(this.global.activeBonusPoolPresetIndex)
            ? this.global.activeBonusPoolPresetIndex
            : 0;
        this.global.activeBonusPoolPresetIndex = Math.min(maxPresets - 1, Math.max(0, activeIndex));

        if (!Array.isArray(this.global.unlocked_bonus_transcendence_cards)) {
            this.global.unlocked_bonus_transcendence_cards = [];
        }
    },


    getActiveBonusPoolPresetIndex() {
        this.ensureBonusPoolPresetState();
        return this.global.activeBonusPoolPresetIndex;
    },


    getBonusPoolPresetIds(index = this.getActiveBonusPoolPresetIndex()) {
        this.ensureBonusPoolPresetState();
        return this.normalizeActiveBonusPoolIds(this.global.bonusPoolPresets[index]);
    },


    syncPendingActiveBonusPoolIds() {
        this.pendingActiveBonusPoolIds = [...this.getBonusPoolPresetIds()];
    },


    persistPendingActiveBonusPoolIds() {
        this.ensureBonusPoolPresetState();
        const activeIndex = this.getActiveBonusPoolPresetIndex();
        const normalizedIds = this.normalizeActiveBonusPoolIds(this.pendingActiveBonusPoolIds);
        this.global.bonusPoolPresets[activeIndex] = [...normalizedIds];
        this.pendingActiveBonusPoolIds = [...normalizedIds];
        this.saveGlobalData();
    },


    selectBonusPoolPreset(index) {
        this.ensureBonusPoolPresetState();
        if (index < 0 || index >= this.global.bonusPoolPresets.length) return;

        this.global.activeBonusPoolPresetIndex = index;
        this.syncPendingActiveBonusPoolIds();
        this.saveGlobalData();
        this.renderBonusPoolEditor();
        this.updateBonusPoolEditorButton();
    },


    buildChaosRoulettePool() {
        return GameUtils.buildTranscendencePool(this.global, {
            excludeIds: this.global.pendingTranscendenceCards || []
        });
    },


    tryUnlockBonusTranscendence() {
        const enemy = this.battle ? this.battle.enemy : null;
        const rewardId = enemy ? enemy.bonusTranscendenceReward : null;
        if (!rewardId) return '';

        this.ensureBonusPoolPresetState();
        if (this.global.unlocked_bonus_transcendence_cards.includes(rewardId)) return '';
        if (Math.random() >= 0.1) return '';

        this.global.unlocked_bonus_transcendence_cards.push(rewardId);
        this.saveGlobalData();

        const unlockedCard = this.getCardData(rewardId);
        if (!unlockedCard) return '<b>[보너스초월]</b> 새로운 초월 카드가 카오스 룰렛에 추가되었습니다!';
        return `<b>[보너스초월]</b> ${unlockedCard.name}이(가) 카오스 룰렛에 해금되었습니다!`;
    },


    tryUnlockDivineArtifact(enemyId, stageNumber) {
        if (this.state.gameType !== 'endless' || stageNumber <= 36) return '';

        const unlock = typeof GameUtils !== 'undefined' && typeof GameUtils.getDivineArtifactUnlockByBossId === 'function'
            ? GameUtils.getDivineArtifactUnlockByBossId(enemyId)
            : null;
        if (!unlock) return '';

        this.ensureDivineArtifactState();
        if (this.global.unlocked_divine_artifacts.includes(unlock.id)) return '';
        if (Math.random() >= unlock.unlockChance) return '';

        this.global.unlocked_divine_artifacts.push(unlock.id);
        this.saveGlobalData();

        const chancePercent = unlock.unlockChance >= 0.01 ? '1%' : '0.1%';
        return `<b>[신기 해금]</b> ${unlock.name}이(가) 아티팩트 모드에 해금되었습니다! (해금 확률 ${chancePercent})`;
    },


    isGradeBalancedRunMode() {
        return ['chaos', 'draft'].includes(this.state.mode);
    },


    drawRunPoolCards(pool, count, options = {}) {
        if (!Array.isArray(pool) || pool.length === 0 || count <= 0) return [];

        if (this.isGradeBalancedRunMode()) {
            const allowDuplicates = !!options.allowDuplicates;
            const source = allowDuplicates ? [...pool] : [...pool];
            const picks = [];
            const grades = ['normal', 'rare', 'epic', 'legend'];

            while (picks.length < count && source.length > 0) {
                const bucketMap = grades.reduce((acc, grade) => {
                    acc[grade] = source.filter(card => GameUtils.getRunPoolGradeBucket(card) === grade);
                    return acc;
                }, {});
                const availableGrades = grades.filter(grade => bucketMap[grade].length > 0);
                if (availableGrades.length === 0) break;

                let selectedGrade = grades[Math.min(grades.length - 1, Math.floor(Math.random() * grades.length))];
                if (bucketMap[selectedGrade].length === 0) {
                    selectedGrade = availableGrades[Math.floor(Math.random() * availableGrades.length)];
                }

                const pick = GameUtils.drawWeightedCards(
                    bucketMap[selectedGrade],
                    1,
                    card => (card.grade === 'transcendence' ? 0.5 : 1.0),
                    { allowDuplicates: false }
                )[0];
                if (!pick) break;

                picks.push(pick);
                if (!allowDuplicates) {
                    const pickedIndex = source.findIndex(card => card.id === pick.id);
                    if (pickedIndex > -1) source.splice(pickedIndex, 1);
                }
            }

            return picks;
        }

        if (options.allowDuplicates) {
            const picks = [];
            for (let i = 0; i < count; i++) {
                picks.push(pool[Math.floor(Math.random() * pool.length)]);
            }
            return picks;
        }

        return GameUtils.shuffle(pool).slice(0, count);
    },


    buildChaosPoolCardIds(pool) {
        return this.drawRunPoolCards(pool, GAME_CONSTANTS.CHAOS_POOL_SIZE).map(card => card.id);
    },


    resetPendingActiveBonusPoolIds() {
        this.syncPendingActiveBonusPoolIds();
        this.updateBonusPoolEditorButton();
    },


    startGame(mode, retryCount = 0) {
        this.hydrateModules();
        const missing = this.getMissingRequiredData();

        if (missing.length > 0) {
            if (retryCount < GAME_CONSTANTS.LOADING.START_RETRY_LIMIT) {
                setTimeout(() => this.startGame(mode, retryCount + 1), GAME_CONSTANTS.LOADING.START_RETRY_DELAY_MS);
                return;
            }
            const names = missing.map(d => d.name).join(', ');
            this.showAlert(`게임 데이터 로드 실패: ${names}<br><br>파일이 같은 폴더에 있는지 확인하고 게임을 새로고침 해주세요.`);
            return; // 게임 진입 차단
        }

        this.loadGlobalData();
        this.ensureMonthlyMissionState();
        this.ensureWeeklyMissionState();
        this.ensureSpecialMissionState();
        this.trackDailyAttendance();

        if (mode === 'load') {
            const save = Storage.load(Storage.keys.SAVE);
            if (save) {
                this.state = { ...this.state, ...save };
                if (this.state.chaosBlessingUses === undefined) this.state.chaosBlessingUses = GAME_CONSTANTS.DEFAULT_BLESSING_USES;
                if (this.state.greatSageBlessingUses === undefined) this.state.greatSageBlessingUses = GAME_CONSTANTS.DEFAULT_BLESSING_USES;
                if (!this.state.chaosBuffs) this.state.chaosBuffs = [];
                if (!this.state.activeChaosBlessing) this.state.activeChaosBlessing = [];
                if (!this.state.activeSageBlessing) this.state.activeSageBlessing = [];
                if (!this.state.tutoredItems) this.state.tutoredItems = [];
                if (!this.state.mode) this.state.mode = 'origin';
                if (!this.state.quiz_stats) this.state.quiz_stats = { correct: 0, total: 0 };
                if (!this.state.artifacts) this.state.artifacts = [];
                if (this.state.pendingEnemyId === undefined) this.state.pendingEnemyId = null;
                if (this.state.pendingEnemyStage === undefined) this.state.pendingEnemyStage = null;
                this.state.activeBonusPoolIds = this.normalizeActiveBonusPoolIds(this.state.activeBonusPoolIds);
                this.state.activeSpecialCardSelections = this.normalizeSpecialCardSelections(this.state.activeSpecialCardSelections || this.global.activeSpecialCardSelections);
                this.loadStudyProgress();

                this.showAlert("불러오기 완료");
                this.toMenu();
            } else { this.showAlert("저장된 데이터가 없습니다. 새로 시작합니다."); this.openTypeSelect(); }
        } else {
            // New Game Logic: Show Type Select
            this.openTypeSelect();
        }
    },


    initNewGame(mode = 'origin') {
        // Record saving logic (Only for Origin mode as per request "Record check only for Origin")
        // Check previous state
        if (this.state.mode === 'origin' && this.state.enemyScale > 0) {
            this.saveRecord();
        }

        let initTickets = GameUtils.getInitialTickets(mode);

        this.state = {
            mode: mode,
            gameType: this.tempGameType || 'challenge',
            tickets: initTickets,
            inventory: [],
            deck: [null, null, null],
            enemyScale: 0,
            chaosBlessingUses: GAME_CONSTANTS.DEFAULT_BLESSING_USES,
            greatSageBlessingUses: GAME_CONSTANTS.DEFAULT_BLESSING_USES,
            chaosBuffs: [],
            activeChaosBlessing: [],
            activeSageBlessing: [],
            activeBonusPoolIds: this.normalizeActiveBonusPoolIds(this.pendingActiveBonusPoolIds),
            activeSpecialCardSelections: this.getActiveSpecialCardSelections('global'),
            tutoredItems: [],
            wrongWords: [],
            quiz_stats: { correct: 0, total: 0 },
            chaosPool: [],
            draft: { active: false, round: 0, rerolls: GAME_CONSTANTS.DRAFT.INITIAL_REROLLS, currentOptions: [] },
            artifacts: [],
            pendingEnemyId: null,
            pendingEnemyStage: null,
            // [목적] 카오스/드래프트 모드에서 해당 런에서만 유효한 이벤트 카드 목록을 초기화
            activeEventCards: []
        };

        if (mode === 'dream_corridor') {
            this.global.hiddenStudyReady = false;
            this.global.hiddenStudyPracticeCount = 0;
            this.saveGlobalData();
        }

        // Transfer Pending Transcendence to Active State (Endless Only)
        if (this.state.gameType === 'endless') {
            this.state.activeTranscendenceCards = [...(this.global.pendingTranscendenceCards || [])];
            this.global.pendingTranscendenceCards = [];
            this.saveGlobalData();
        } else {
            this.state.activeTranscendenceCards = [];
        }

        this.applyBeginnerChallengeSafety(mode);

        if (mode === 'chaos') {
            let allCards = GameUtils.buildCardPool(this.global, {
                includeTranscendence: true,
                activeTranscendenceCards: this.state.activeTranscendenceCards,
                activeBonusPoolIds: this.state.activeBonusPoolIds,
                specialCardSelections: this.state.activeSpecialCardSelections,
                // [목적] 해당 런에서 획득한 이벤트 카드를 카오스 모드 시작 풀에 포함
                activeEventCards: this.state.activeEventCards
            });

            const picks = this.buildChaosPoolCardIds(allCards);

            this.state.chaosPool = picks;
            this.state.inventory = [...picks];
        }

        // Origin Mode: Add Transcendence Cards directly to Inventory
        if (mode !== 'chaos' && mode !== 'draft' && this.state.activeTranscendenceCards.length > 0) {
            this.state.inventory.push(...this.state.activeTranscendenceCards);
            setTimeout(() => this.showAlert(`초월 카드 ${this.state.activeTranscendenceCards.length}장이 인벤토리에 합류했습니다!`), 500);
        }

        this.loadStudyProgress();
        this.saveGame();
    },


    saveGame(showMessage = true) {
        const saveState = { ...this.state };
        delete saveState.currentToeicSession;
        Storage.save(Storage.keys.SAVE, saveState);
        this.saveStudyProgress();
        this.saveGlobalData(); // Also save global just in case
        if (showMessage) this.showAlert("저장되었습니다.");
    },


    saveRecord(score = null) {
        let history = Storage.load(Storage.keys.RECORDS) || [];
        let currentStage = score !== null ? score : (this.state.enemyScale + 1);

        let stages = history.map(h => {
            let m = h.match(/최대 스테이지: (\d+)/);
            return m ? parseInt(m[1]) : 0;
        });

        stages.push(currentStage);
        stages.sort((a, b) => b - a);
        stages = stages.slice(0, GAME_CONSTANTS.MAX_RECORDS);

        history = stages.map(s => `최대 스테이지: ${s}`);
        Storage.save(Storage.keys.RECORDS, history);
    },


    showRecords() {
        let history = Storage.load(Storage.keys.RECORDS) || [];
        if (history.length === 0) return this.showAlert("기록이 없습니다.");
        let msg = history.map((h, i) => `${i + 1}위. ${h}`).join("<br>");
        this.openInfoModal("최대 스테이지 기록 (Top 5)", msg);
    },

    // --- Screen Navigation ---

    toggleTutoringEvent() {
        if (this.global.tutoringEventEnabled === undefined) this.global.tutoringEventEnabled = true;
        this.global.tutoringEventEnabled = !this.global.tutoringEventEnabled;
        if (this.global.tutoringEventEnabled) {
            this.global.hiddenStudyPracticeCount = 0;
        }
        this.saveGlobalData();
        this.updateSystemMenuUI();
    },


    checkActiveChaosBlessings() {
        if (!this.state.chaosBuffs || this.state.chaosBuffs.length === 0) {
            return this.showAlert("현재 적용된 축복이 없습니다.");
        }
        let msg = "<b>현재 적용된 축복</b><br><br>";
        this.sortBlessingsByGrade(this.state.chaosBuffs).forEach(b => {
            msg += `[${b.name}] 올스탯 +${Math.round(b.multiplier * 100)}%, 치명타/회피율 증가`;
            msg += "<br>";
        });
        msg += "<br>(전투 시작 시 해당 카드의 체력이 모두 회복됩니다.)";
        this.openInfoModal("축복 상태", msg);
    },

    startGrammarQuiz(q, successCallback = null, failCallback = null) {
        const onCorrect = successCallback
            ? successCallback
            : () => this.applyGreatSageBlessing();
        const onWrong = failCallback
            ? failCallback
            : () => {
                this.state.greatSageBlessingUses--;
                this.showAlert(`틀렸어... 남은 기회: ${this.state.greatSageBlessingUses}회`);
            };
        const config = QuizEngine.buildGrammarQuiz(q, onCorrect, onWrong);
        QuizEngine.show(config);
    },


    updateMergedBlessings() {
        this.state.chaosBuffs = [];

        const addBuffs = (list) => {
            list.forEach(nb => {
                let existing = this.state.chaosBuffs.find(b => b.id === nb.id);
                if (existing) {
                    existing.multiplier += nb.multiplier;
                } else {
                    this.state.chaosBuffs.push({ ...nb });
                }
            });
        };

        if (this.state.activeChaosBlessing) addBuffs(this.state.activeChaosBlessing);
        if (this.state.activeSageBlessing) addBuffs(this.state.activeSageBlessing);
        this.state.chaosBuffs = this.sortBlessingsByGrade(this.state.chaosBuffs);
    },

    pickUniqueRandomCards(pool, count) {
        return GameUtils.shuffle(pool).slice(0, count);
    },


    applyChaosBlessing(count) {
        this.state.chaosBlessingUses--;

        // 1. Build Pool
        let pool = GameUtils.buildCardPool(this.global, {
            excludeTranscendence: true,
            excludeEvent: true,
            activeBonusPoolIds: this.state.activeBonusPoolIds,
            specialCardSelections: this.state.activeSpecialCardSelections,
            maxGrade: GameUtils.getMaxGradeForMode(this.state.mode)
        });

        // 2. Shuffle and Pick (Fisher-Yates: uniform)
        let picks = this.pickUniqueRandomCards(pool, count);

        this.state.activeSageBlessing = []; // Clear Sage Blessing

        let newBuffs = picks.map(c => {
            let mult = 0;
            if (c.grade === 'normal') mult = 0.4;
            else if (c.grade === 'rare') mult = 0.3;
            else if (c.grade === 'epic') mult = 0.2;
            else if (c.grade === 'legend') mult = 0.1;
            return { id: c.id, name: c.name, grade: c.grade, multiplier: mult };
        });
        newBuffs = this.sortBlessingsByGrade(newBuffs);

        // Set to activeChaosBlessing (Replacing previous)
        this.state.activeChaosBlessing = newBuffs;
        this.updateMergedBlessings();

        let msg = "<b>혼돈의 축복 적용!</b><br>새로운 축복이 부여되었습니다.<br><br><b>[새로 적용된 축복]</b><br>";
        newBuffs.forEach(b => {
            msg += `[${b.name}] 올스탯 +${Math.round(b.multiplier * 100)}%, 치명타/회피율 증가<br>`;
        });
        msg += `<br><b>(현재 총 활성화된 축복: ${this.state.chaosBuffs.length}개)</b><br>(전투 시작 시 해당 카드의 체력이 모두 회복됩니다.)`;
        setTimeout(() => {
            this.openInfoModal("축복 성공", msg);
        }, 200);
    },

    // --- Gacha & Deck UI ---

    startCollocationQuiz(callback) {
        const config = QuizEngine.buildCollocationQuiz(callback);
        if (!config) return this.showAlert("데이터 로드 오류: Collocation 데이터가 없습니다.");
        QuizEngine.show(config);
    },


    startQuiz(callback) {
        const config = QuizEngine.buildVocabQuiz(callback);
        if (!config) return this.showAlert("데이터 로드 오류: 단어 데이터가 없습니다.");
        QuizEngine.show(config);
    },


    startChaosQuiz(callback) {
        const config = QuizEngine.buildChaosQuiz(callback);
        if (!config) return this.showAlert("데이터 로드 오류: 단어 데이터가 없습니다.");
        QuizEngine.show(config);
    },

    startDraft() {
        if (this.state.deck.every(x => x !== null)) {
            return this.showAlert("이미 덱이 완성되어 있습니다. 전투에 진입하세요.");
        }

        if (!this.state.draft) this.state.draft = { active: true, round: 0, rerolls: 3, currentOptions: [] };

        // Find first empty slot
        this.state.draft.round = this.state.deck.indexOf(null);
        if (this.state.draft.round === -1) {
            this.state.draft.round = 0;
        }

        this.showScreen('screen-draft');
        this.renderDraftScreen();
    },


    generateDraftOptions() {
        let pool = GameUtils.buildCardPool(this.global, {
            includeTranscendence: true,
            activeTranscendenceCards: this.state.activeTranscendenceCards,
            activeBonusPoolIds: this.state.activeBonusPoolIds,
            specialCardSelections: this.state.activeSpecialCardSelections,
            // [목적] 드래프트 선택지에 획득한 이벤트 카드가 등장하도록 함
            activeEventCards: this.state.activeEventCards
        });

        const options = this.drawRunPoolCards(pool, 4, { allowDuplicates: true }).map(card => card.id);
        this.state.draft.currentOptions = options;
    },


    selectDraftCard(id) {
        this.state.inventory.push(id);
        this.state.deck[this.state.draft.round] = id;

        // Clear options for next round
        this.state.draft.currentOptions = [];

        if (this.state.deck.indexOf(null) === -1) {
            this.showAlert("덱 구성 완료!");
            this.toMenu();
        } else {
            this.startDraft();
        }
    },


    resetDraftState() {
        // Called when initializing new draft cycle
        this.state.inventory = [];
        this.state.deck = [null, null, null];
        this.state.draft = { active: true, round: 0, rerolls: GAME_CONSTANTS.DRAFT.INITIAL_REROLLS, currentOptions: [] };
    },


    cleanupTranscendenceCards() {
        if (['draft', 'chaos'].includes(this.state.mode)) return "";

        let removedNames = [];
        this.battle.players.forEach((p, idx) => {
            if (p && p.proto.grade === 'transcendence') {
                // Remove from Inventory
                const invIdx = this.state.inventory.indexOf(p.id);
                if (invIdx > -1) {
                    this.state.inventory.splice(invIdx, 1);
                }
                // Remove from Deck
                if (this.state.deck[idx] === p.id) {
                    this.state.deck[idx] = null;
                }
                removedNames.push(p.name);
            }
        });

        if (removedNames.length > 0) {
            const msg = `초월 카드 소멸: ${removedNames.join(', ')}`;
            this.log(`<span style="color:#ffd700">[시스템] ${msg}</span>`);
            return `<br><span style="color:#ffd700">${msg}</span>`;
        }
        return "";
    },


    handlePermadeath(players) {
        let deadNames = [];
        players.forEach(p => {
            if (p && p.isDead) {
                let idx = this.state.inventory.indexOf(p.id);
                if (idx > -1) this.state.inventory.splice(idx, 1);
                if (p.pos !== undefined) this.state.deck[p.pos] = null;
                deadNames.push(p.name);
            }
        });
        if (deadNames.length > 0) return `전사자 발생: ${deadNames.join(', ')}<br>(카드가 소멸했습니다)`;
        return "";
    },


    winBattle() {
        let transMsg = this.cleanupTranscendenceCards();
        let deadMsg = this.handlePermadeath(this.battle.players);
        if (transMsg) deadMsg += transMsg;
        const defeatedEnemyId = this.battle.enemy ? this.battle.enemy.id : null;
        const defeatedStageNumber = this.state.enemyScale + 1;
        const mode = this.state.mode;
        let reward = GAME_CONSTANTS.MODE_REWARDS[this.state.mode] !== undefined
            ? GAME_CONSTANTS.MODE_REWARDS[this.state.mode]
            : GAME_CONSTANTS.MODE_REWARDS.default;

        if (this.battle.players.some(p => p && p.proto.trait.type === 'looter')) {
            reward += GAME_CONSTANTS.BONUS_REWARDS.LOOTER;
        }
        if (this.state.mode === 'overdrive') {
            reward += GAME_CONSTANTS.BONUS_REWARDS.OVERDRIVE;
        }
        if (this.battle.enemy && this.battle.enemy.bonusRewardTickets) {
            reward += this.battle.enemy.bonusRewardTickets;
        }

        this.state.tickets += reward;
        this.state.enemyScale++;
        this.clearPendingEnemySelection();
        const divineArtifactUnlockMsg = this.tryUnlockDivineArtifact(defeatedEnemyId, defeatedStageNumber);
        if (divineArtifactUnlockMsg) {
            deadMsg = deadMsg ? `${deadMsg}<br>${divineArtifactUnlockMsg}` : divineArtifactUnlockMsg;
        }
        const bonusTransUnlockMsg = this.tryUnlockBonusTranscendence();
        if (bonusTransUnlockMsg) {
            deadMsg = deadMsg ? `${deadMsg}<br>${bonusTransUnlockMsg}` : bonusTransUnlockMsg;
        }
        const currentSeason = this.getCurrentSpecialSeason();
        if (defeatedEnemyId === currentSeason.bossId) {
            this.incrementSpecialMissionProgress('boss', 1);
        }
        if (mode === 'dream_corridor' && defeatedEnemyId === 'creator_god') {
            const specialUnlockMsg = this.tryUnlockSpecialMissionFromDreamCorridor(defeatedStageNumber);
            if (specialUnlockMsg) {
                deadMsg = deadMsg ? `${deadMsg}<br>${specialUnlockMsg}` : specialUnlockMsg;
            }
        }

        // Reset Chaos Blessing
        this.state.chaosBlessingUses = GAME_CONSTANTS.DEFAULT_BLESSING_USES;
        this.state.chaosBuffs = [];
        this.state.activeChaosBlessing = [];
        this.state.activeSageBlessing = [];

        this.log(`승리 보상: 뽑기권 ${reward}장 획득.`);

        // Victory Condition Check
        const stage = this.state.enemyScale; // current stage (already incremented)
        const clearStage = GameUtils.getClearStage(mode, this.state.gameType);
        const gameClear = stage >= clearStage;

        if (this.state.gameType === 'endless' && stage >= 40) {
            this.incrementMonthlyMissionProgress('endless40', 1);
        }

        // Chaos/Draft: Reset Deck/Inventory
        if (mode === 'chaos') {
            this.state.inventory = [];
            this.state.deck = [null, null, null];

            let allCards = GameUtils.buildCardPool(this.global, {
                includeTranscendence: true,
                activeTranscendenceCards: this.state.activeTranscendenceCards,
                activeBonusPoolIds: this.state.activeBonusPoolIds,
                specialCardSelections: this.state.activeSpecialCardSelections,
                // [목적] 전투 승리 후 카오스 풀 초기화 시 획득한 이벤트 카드를 포함
                activeEventCards: this.state.activeEventCards
            });
            const nextPicks = this.buildChaosPoolCardIds(allCards);
            this.state.chaosPool = nextPicks;
            this.state.inventory = [...nextPicks];
        }

        if (mode === 'draft') {
            this.resetDraftState();
        }

        // Archive Mode: Mandatory Quiz (Direct to finishWinBattle via callback)
        if (mode === 'archive') {
            const q = this.getRandomGrammarQuiz();
            if (!q) {
                this.finishWinBattle(deadMsg, gameClear, null);
                return;
            }
            this.state.lastArchiveQuizLectureId = q.lecture_id;

            this.startGrammarQuiz(q,
                () => { // Success
                    this.state.quiz_stats.correct++;
                    this.state.quiz_stats.total++;
                    this.state.tickets += GAME_CONSTANTS.BONUS_REWARDS.QUIZ;
                    setTimeout(() => this.finishWinBattle(deadMsg, gameClear, true), 200);
                },
                () => { // Fail
                    this.state.quiz_stats.total++;
                    setTimeout(() => this.finishWinBattle(deadMsg, gameClear, false), 200);
                }
            );
            return;
        }

        if (mode === 'dream_corridor') {
            this.finishDreamCorridorBattle(deadMsg);
            return;
        }

        this.finishWinBattle(deadMsg, gameClear, null);
    },


    finishDreamCorridorBattle(deadMsg) {
        const stage = this.state.enemyScale;
        const stepIndex = (stage - 1) % 6;
        const steps = ['word', 'collocation', 'word', 'grammar', 'word', 'toeic'];
        const step = steps[stepIndex];

        const finishSuccess = (label) => {
            let msg = `승리!<br>${label} 성공.`;
            if (deadMsg) msg += `<br><br>${deadMsg}`;
            this.openInfoModal('꿈의회랑', msg, () => this.toMenu());
        };

        const fail = (label) => this.failDreamCorridorRun(`${label}에서 오답이 발생해 꿈의회랑이 종료되었습니다.`);

        if (step === 'word') {
            this.startQuiz(success => {
                if (success) finishSuccess('단어 퀴즈');
                else fail('단어 퀴즈');
            });
            return;
        }

        if (step === 'collocation') {
            this.startCollocationQuiz(success => {
                if (success) finishSuccess('숙어 퀴즈');
                else fail('숙어 퀴즈');
            });
            return;
        }

        if (step === 'grammar') {
            const q = this.getRandomGrammarQuiz();
            if (!q) {
                finishSuccess('문법 퀴즈');
                return;
            }
            this.startGrammarQuiz(q,
                () => finishSuccess('문법 퀴즈'),
                () => fail('문법 퀴즈')
            );
            return;
        }

        this.startToeicPractice({
            ignoreSessionLimit: true,
            suppressDate: true,
            lockExit: true,
            countHiddenUnlock: false,
            countMonthly: false,
            countSpecial: false,
            onComplete: () => finishSuccess('실전마법연습'),
            onFailure: () => fail('실전마법연습')
        });
    },


    failDreamCorridorRun(message) {
        this.global.hiddenStudyReady = false;
        this.global.hiddenStudyPracticeCount = 0;
        this.saveStudyProgress();
        this.saveGlobalData();
        Storage.remove(Storage.keys.SAVE);
        this.openInfoModal('꿈의회랑 종료', message, () => this.toTitle());
    },


    loseBattle() {
        let transMsg = this.cleanupTranscendenceCards();
        // No saveRecord here (User request: only on New Game)

        if (['chaos', 'draft'].includes(this.state.mode)) {
            this.saveRecord();
        }

        if (this.state.mode === 'origin') {
            this.global.pendingTranscendenceCards = [];
            this.saveGlobalData();
        }

        if (['chaos', 'draft'].includes(this.state.mode)) {
            Storage.remove(Storage.keys.SAVE);

            let msg = "패배했습니다...<br>이 모드는 패배 시 데이터가 초기화됩니다.";
            this.openInfoModal("Game Over", msg, () => {
                this.toTitle();
            });
            return;
        }

        // Reset Chaos Blessing
        this.state.chaosBlessingUses = 3;
        this.state.chaosBuffs = [];
        this.state.activeChaosBlessing = [];
        this.state.activeSageBlessing = [];

        let deadMsg = this.handlePermadeath(this.battle.players);
        if (this.state.mode === 'dream_corridor') {
            let msg = "전투에서 패배해 꿈의회랑 런이 종료되었습니다.";
            if (deadMsg) msg += `<br><br>${deadMsg}`;
            if (transMsg) msg += transMsg;
            this.failDreamCorridorRun(msg);
            return;
        }

        let msg = "패배...";
        if (deadMsg) msg += "<br><br>" + deadMsg;
        if (transMsg) msg += transMsg;
        this.openInfoModal("전투 결과", msg, () => this.toMenu());
    },


    getEffectiveStats(char, fieldBuffs) {
        return Logic.calculateStats(char, fieldBuffs, this.state.mode, this.state.artifacts || [], this.battle.turn || 1);
    },


    getToeicExplanationText(set) {
        if (!set) return "해설 데이터가 없습니다.";
        return (typeof TOEIC_EXPLANATIONS !== 'undefined' && TOEIC_EXPLANATIONS[set.id])
            ? TOEIC_EXPLANATIONS[set.id]
            : "해설 데이터가 없습니다.";
    },


    getStoredApiKey() {
        return (Storage.getRaw(Storage.keys.API_KEY) || '').trim();
    },


    getActiveLumiChatSession() {
        return LumiQuestionRuntime.getActiveSession(
            this.activeLumiChatSessionKey,
            this.lumiChatSessions,
            this.state.currentToeicSession
        );
    },


    hasArtifact(id) {
        return (this.state.artifacts || []).includes(id);
    },


    resetToeicProgress(options = {}) {
        const reset = () => {
            if (typeof this.clearToeicLumiQuestionSession === 'function') {
                this.clearToeicLumiQuestionSession({ abort: true, clearCurrentToeic: true });
            }
            this.state.completedToeicSets = [];
            this.saveGame(false);
            if (!options.silent) {
                this.showAlert("초기화되었습니다.");
            }
        };

        if (options.silent) {
            reset();
            return;
        }

        this.showDoubleConfirm(
            "모든 실전 연습 기록을 초기화하시겠습니까?",
            "정말 초기화하시겠습니까?<br>완료한 문제 세트가 다시 등장하게 됩니다.",
            reset
        );
    },


    _getDateParams() {
        // Check secret date flag first
        if (this.global.secretDateFlag) {
            const secretSet = SECRET_DATE_SETS[Math.floor(Math.random() * SECRET_DATE_SETS.length)];
            const weather = (secretSet.location === 'outdoor')
                ? DATE_WEATHER_OUTDOOR[Math.floor(Math.random() * DATE_WEATHER_OUTDOOR.length)]
                : '실내';
            return {
                theme: secretSet.theme,
                outfit: secretSet.outfit,
                weather: weather,
                keyword: secretSet.keyword,
                word: secretSet.word,
                secret: true,
                cardId: secretSet.cardId,
                cardName: secretSet.cardName
            };
        }

        // Normal date: random theme
        const themeData = DATE_THEMES[Math.floor(Math.random() * DATE_THEMES.length)];

        // Weather
        let weather;
        if (themeData.location === 'indoor') {
            weather = '실내';
        } else {
            weather = DATE_WEATHER_OUTDOOR[Math.floor(Math.random() * DATE_WEATHER_OUTDOOR.length)];
        }

        // Keyword
        const keyword = DATE_KEYWORDS[Math.floor(Math.random() * DATE_KEYWORDS.length)];

        // Random word from wordbook
        let word = 'love'; // fallback
        if (typeof VOCAB_DATA !== 'undefined' && VOCAB_DATA.length > 0) {
            const vocab = VOCAB_DATA[Math.floor(Math.random() * VOCAB_DATA.length)];
            word = vocab.word;
        }

        return {
            theme: themeData.theme,
            outfit: themeData.outfit,
            weather: weather,
            keyword: keyword,
            word: word,
            secret: false
        };
    },

    };

    window.RPGFeatureModules = {
        install(rpg) {
            Object.assign(rpg, RPGFeatureMethods);
        }
    };
})();
