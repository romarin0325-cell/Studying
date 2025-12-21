const GAME = (function() {
    let state = {
        age: 10,
        seasonIndex: 0, // 0: Spring, 1: Summer, 2: Autumn, 3: Winter
        stats: {}, // Clone of PM_DATA.initialStats
        personality: '',
        flags: {}, // Unlocked items, event triggers, etc.
        turnCount: 0,
        star: null, // Current seasonal star
        starRerolls: 3,
        history: [], // Log history
        endings: [] // Unlocked endings
    };

    // DOM Elements
    const els = {};

    function init() {
        // Cache DOM elements
        const ids = ['ui-age', 'ui-season', 'ui-gold', 'ui-stress',
            'stat-vit', 'stat-str', 'stat-int', 'stat-charm',
            'stat-morality', 'stat-faith', 'stat-elegance', 'stat-intimacy',
            'main-image', 'img-name', 'message-log',
            'modal-action', 'action-list', 'action-title',
            'modal-star', 'star-result', 'star-name', 'star-desc', 'reroll-count',
            'modal-event', 'event-title', 'event-desc', 'event-choices',
            'modal-combat', 'player-hud', 'enemy-hud', 'combat-log',
            'modal-shop', 'shop-list', 'modal-endings', 'ending-list', 'start-screen',
            'modal-system', 'modal-status', 'status-content', 'modal-equip', 'equip-content'
        ];
        ids.forEach(id => els[id] = document.getElementById(id));

        // Load endings from localstorage
        const savedEndings = localStorage.getItem('pm_endings');
        if (savedEndings) {
            state.endings = JSON.parse(savedEndings);
        }

        if (localStorage.getItem('pm_save')) {
            document.getElementById('load-btn').style.display = 'inline-block';
        } else {
            document.getElementById('load-btn').style.display = 'none';
        }
    }

    function startGame(personalityKey) {
        state.stats = JSON.parse(JSON.stringify(PM_DATA.initialStats));
        state.age = PM_DATA.gameDuration.startAge;
        state.seasonIndex = 0;
        state.turnCount = 0;
        state.flags = {};
        state.personality = personalityKey;
        state.star = null;

        // Apply personality bonuses
        const p = PM_DATA.personalities[personalityKey];
        if (personalityKey === 'heat') { state.stats.vit += 10; state.stats.str += 10; }
        if (personalityKey === 'wisdom') { state.stats.int += 10; }
        if (personalityKey === 'kindness') { state.stats.charm += 10; }

        state.flags.counts = {};

        els['start-screen'].style.display = 'none';
        log(`게임 시작! 성향: ${p.name}`);
        updateUI();
        startSeason();
    }

    // --- Combat Implementation ---
    let combatState = null;
    let onCombatWin = null;
    let onCombatEnd = null;

    function startCombat(enemyId, winCallback, endCallback) {
        onCombatWin = winCallback;
        onCombatEnd = endCallback;

        const enemyData = PM_DATA.enemies[enemyId];
        const maxHp = 30 + state.stats.vit;
        const atk = 10 + Math.floor(state.stats.str / 10) + (state.stats.atk - 10);
        const matk = 10 + Math.floor(state.stats.int / 10) + (state.stats.matk - 10);
        const def = state.stats.def;

        combatState = {
            player: {
                hp: maxHp,
                maxHp: maxHp,
                atk: atk,
                matk: matk,
                def: def
            },
            enemy: JSON.parse(JSON.stringify(enemyData)),
            turn: 0
        };

        els['modal-combat'].style.display = 'flex';
        els['enemy-name'].textContent = combatState.enemy.name;
        els['combat-log'].innerHTML = '';
        updateCombatUI();
        logCombat(`전투 시작! vs ${combatState.enemy.name}`);
    }

    function updateCombatUI() {
        els['combat-hp-p'].textContent = combatState.player.hp;
        els['combat-atk-p'].textContent = combatState.player.atk;

        els['combat-hp-e'].textContent = combatState.enemy.hp;
        els['combat-atk-e'].textContent = combatState.enemy.atk;
    }

    function logCombat(msg) {
        const div = document.createElement('div');
        div.textContent = msg;
        els['combat-log'].appendChild(div);
        els['combat-log'].scrollTop = els['combat-log'].scrollHeight;
    }

    function combatAction(playerMove) {
        const moves = ['attack', 'special', 'counter'];
        const enemyMove = moves[Math.floor(Math.random() * 3)];

        logCombat(`나: ${moveName(playerMove)} vs 적: ${moveName(enemyMove)}`);

        let pDmg = 0;
        let eDmg = 0;

        let pPower = (combatState.enemy.type === 'mag') ? combatState.player.matk : combatState.player.atk;
        let pDef = combatState.player.def;
        let ePower = combatState.enemy.atk;
        let eDef = combatState.enemy.def;

        const calcDmg = (atk, def, mult) => {
            let d = (atk - def);
            if (d < 1) d = 1;
            return Math.floor(d * mult);
        };

        if (playerMove === 'attack') {
            pDmg = calcDmg(pPower, eDef, 1);
        } else if (playerMove === 'special') {
            if (enemyMove === 'counter') {
                pDmg = 0;
            } else {
                pDmg = calcDmg(pPower, eDef, 2);
            }
        } else if (playerMove === 'counter') {
            if (enemyMove === 'special') {
                pDmg = calcDmg(pPower, eDef, 1);
            } else {
                pDmg = 0;
            }
        }

        if (enemyMove === 'attack') {
            eDmg = calcDmg(ePower, pDef, 1);
        } else if (enemyMove === 'special') {
            if (playerMove === 'counter') {
                eDmg = 0;
            } else {
                eDmg = calcDmg(ePower, pDef, 2);
            }
        } else if (enemyMove === 'counter') {
            if (playerMove === 'special') {
                eDmg = calcDmg(ePower, pDef, 1);
            } else {
                eDmg = 0;
            }
        }

        if (pDmg > 0) {
            combatState.enemy.hp -= pDmg;
            logCombat(`적에게 ${pDmg} 피해!`);
        } else {
             if (playerMove === 'counter' && enemyMove === 'special') logCombat("반격 성공!");
             else if (playerMove === 'special' && enemyMove === 'counter') logCombat("필살기가 반격당했습니다!");
             else if (playerMove === 'counter') logCombat("반격 실패...");
        }

        if (eDmg > 0) {
            combatState.player.hp -= eDmg;
            logCombat(`나에게 ${eDmg} 피해!`);
        }

        updateCombatUI();

        if (combatState.player.hp <= 0 || combatState.enemy.hp <= 0) {
            endCombat();
        }
    }

    function moveName(m) {
        if(m==='attack') return '공격';
        if(m==='special') return '필살';
        if(m==='counter') return '반격';
        return m;
    }

    function endCombat() {
        if (combatState.player.hp <= 0) {
            logCombat("패배했습니다...");
            setTimeout(() => {
                els['modal-combat'].style.display = 'none';
                if (onCombatEnd) onCombatEnd(false);
            }, 1500);
        } else {
            logCombat("승리했습니다!");
            setTimeout(() => {
                els['modal-combat'].style.display = 'none';
                if (onCombatWin) onCombatWin();
                else if (onCombatEnd) onCombatEnd(true);
            }, 1500);
        }
    }

    // --- Ending Logic ---
    function checkEnding() {
        // Prepare flags for special endings
        if (state.flags.black_star_seen && state.flags.pub_success) {
            state.flags.night_toy_cond = true;
        }

        const sortedEndings = PM_DATA.endings.sort((a,b) => a.priority - b.priority);

        let finalEnding = null;

        for (let ending of sortedEndings) {
            let match = true;

            for (let stat in ending.req) {
                if ((state.stats[stat] || 0) < ending.req[stat]) {
                    match = false;
                    break;
                }
            }

            if (ending.maxMorality !== undefined) {
                if (state.stats.morality > ending.maxMorality) match = false;
            }

            // Millionaire Money Check
            if (ending.minMoney !== undefined) {
                if (state.stats.money < ending.minMoney) match = false;
            }

            if (ending.flag) {
                if (!state.flags[ending.flag]) match = false;
            }

            if (match) {
                finalEnding = ending;
                break;
            }
        }

        if (!finalEnding) finalEnding = PM_DATA.endings.find(e => e.id === 'jobless');

        showEnding(finalEnding);
    }

    function showEnding(ending) {
        let history = JSON.parse(localStorage.getItem('pm_endings') || '[]');
        if (!history.find(e => e.id === ending.id)) {
            history.push(ending);
            localStorage.setItem('pm_endings', JSON.stringify(history));
        }

        els['main-image-placeholder'].innerHTML = '';
        els['img-name'].textContent = `엔딩: ${ending.name}`;

        log(`=== 엔딩 달성: ${ending.name} ===`, 'log-event');
        alert(`축하합니다! 당신은 [${ending.name}] 엔딩을 맞이했습니다.\n(성공적 마무리! 왕자는 훌륭하게 자랐습니다.)`);

        location.reload();
    }

    function updateUI() {
        els['ui-age'].textContent = state.age;
        els['ui-season'].textContent = PM_DATA.gameDuration.seasons[state.seasonIndex];
        els['ui-gold'].textContent = state.stats.money;
        els['ui-stress'].textContent = state.stats.stress;

        const realMaxHp = 30 + state.stats.vit;
        if (state.stats.hp > realMaxHp) state.stats.hp = realMaxHp;

        els['stat-vit'].textContent = state.stats.vit;
        els['stat-str'].textContent = state.stats.str;
        els['stat-int'].textContent = state.stats.int;
        els['stat-charm'].textContent = state.stats.charm;

        els['stat-morality'].textContent = state.stats.morality;
        els['stat-faith'].textContent = state.stats.faith;
        els['stat-elegance'].textContent = state.stats.elegance;
        els['stat-intimacy'].textContent = state.stats.intimacy;

        updateImage();
    }

    function updateImage() {
        let artAge = 10;
        if (state.age >= 13) artAge = 13;
        if (state.age >= 16) artAge = 16;

        let base = `프린스${artAge}`;
        if (state.flags.silk_dress_equipped && state.age >= 16) {
            base = '프린스실크드레스';
        } else {
            if (state.stats.stress >= 80) base = `프린스피로${artAge}`;
            else if (state.stats.morality <= 10) base = `프린스반항${artAge}`;
        }

        els['img-name'].textContent = base;

        // Image loading logic
        if (els['main-image']) {
            els['main-image'].style.display = 'block';
            els['img-name'].style.display = 'none';
            els['main-image'].src = encodeURIComponent(base) + '.png';
        }
    }

    function log(msg, type='') {
        const div = document.createElement('div');
        div.className = 'log-entry ' + type;
        div.textContent = msg;
        els['message-log'].appendChild(div);
        els['message-log'].scrollTop = els['message-log'].scrollHeight;
    }

    function getFlavorText(type, isGreat, isFail) {
        // Prince personality: Cute, energetic, kind
        const failTexts = [
            "으앙, 너무 어려워요...",
            "실수해버렸어요. 다음엔 잘할게요!",
            "죄송해요, 조금 졸았나봐요..."
        ];
        const greatTexts = [
            "완벽해요! 저, 꽤 잘하죠?",
            "신난다! 칭찬해주세요!",
            "이정도 쯤이야 식은 죽 먹기죠!"
        ];
        const normalTexts = [
            "열심히 했어요!",
            "오늘도 무사히 마쳤습니다.",
            "조금 힘들지만 보람차네요."
        ];

        let list = normalTexts;
        if (isFail) list = failTexts;
        if (isGreat) list = greatTexts;

        return list[Math.floor(Math.random() * list.length)];
    }

    // --- Actions ---

    function openMenu(type) {
        if (state.stats.hp <= 0) {
            log("체력이 없어 행동할 수 없습니다. 휴식하세요.", 'log-loss');
            return;
        }

        if (state.stats.stress >= 100 && type !== 'rest') {
            log("스트레스가 한계입니다! 무조건 휴식해야 합니다.", 'log-loss');
            return;
        }

        const isRebel = state.stats.morality <= 10;

        const modal = els['modal-action'];
        const list = els['action-list'];
        list.innerHTML = '';

        let items = [];
        if (type === 'study') {
            els['action-title'].textContent = '수업 선택';
            items = PM_DATA.actions.study.basic;

            ['s_sword', 's_magic', 's_etiquette'].forEach(baseId => {
                const count = state.flags.counts[baseId] || 0;
                let action = PM_DATA.actions.study.basic.find(a => a.id === baseId);
                let isAdv = false;
                if (count >= 6) {
                    const advId = baseId + '_adv';
                    const advAction = PM_DATA.actions.study.advanced.find(a => a.id === advId);
                    if (advAction) {
                        action = advAction;
                        isAdv = true;
                    }
                }
                if (isRebel && baseId === 's_etiquette') return;
                createActionBtn(action, type, isAdv);
            });

        } else if (type === 'job') {
            els['action-title'].textContent = '아르바이트 선택';
            ['j_church', 'j_smithy', 'j_scribe', 'j_pub'].forEach(baseId => {
                const count = state.flags.counts[baseId] || 0;
                let action = PM_DATA.actions.job.basic.find(a => a.id === baseId);
                let isAdv = false;
                if (count >= 6) {
                    const advId = baseId + '_adv';
                    const advAction = PM_DATA.actions.job.advanced.find(a => a.id === advId);
                    if (advAction) {
                        action = advAction;
                        isAdv = true;
                    }
                }
                if (isRebel && baseId === 'j_church') return;
                createActionBtn(action, type, isAdv);
            });
        } else if (type === 'rest') {
            els['action-title'].textContent = '휴식 선택';
            PM_DATA.actions.rest.forEach(action => {
                createActionBtn(action, type, false);
            });
        }

        modal.style.display = 'flex';
    }

    function createActionBtn(action, type, isAdv) {
        const btn = document.createElement('button');
        let txt = `${action.name} `;
        if (action.cost) txt += `(-${action.cost}G) `;
        if (action.income) txt += `(+${action.income}G) `;
        btn.textContent = txt;

        if (action.cost && state.stats.money < action.cost) {
            btn.disabled = true;
        }

        btn.onclick = () => {
            closeModal('modal-action');
            executeTurn(action, type);
        };
        els['action-list'].appendChild(btn);
    }

    function closeModal(id) {
        if(els[id]) els[id].style.display = 'none';
    }

    function startSeason() {
        log(`=== ${state.age}세 ${PM_DATA.gameDuration.seasons[state.seasonIndex]} ===`, 'log-turn');
        state.star = null; // Reset star
        state.starRerolls = 3; // Reset rerolls
        // No auto-roll. User must click 'Fortune'.
    }

    function openFortuneMenu() {
        // state.starRerolls = 3; // REMOVED: Do not reset rerolls here
        rollStar();
        els['modal-star'].style.display = 'flex';
    }

    function rollStar() {
        const stars = PM_DATA.stars;
        let star = stars[Math.floor(Math.random() * stars.length)];
        // Temporary holding
        state.pendingStar = star;
        els['star-name'].textContent = star.name;
        els['star-desc'].textContent = star.desc;
        els['reroll-count'].textContent = state.starRerolls;
    }

    function rerollStar() {
        if (state.starRerolls > 0) {
            state.starRerolls--;
            rollStar();
        }
    }

    function confirmStar() {
        state.star = state.pendingStar;
        if (state.star.id === 'black') state.flags.black_star_seen = true;
        closeModal('modal-star');
        log(`이번 분기 운세: [${state.star.name}] 적용`);
    }

    function executeTurn(action, type) {
        if (action.cost) {
            state.stats.money -= action.cost;
            log(`${action.cost} Gold 소모`, 'log-loss');
        }

        let isGreat = false;
        let isFail = false;
        const r = Math.random();

        let greatChance = (type === 'study') ? 0.2 : (type === 'job' ? 0.1 : 0);
        let failChance = (type === 'job') ? 0.1 : 0;

        // Apply Star effects if star exists
        if (state.star) {
            if (state.star.id === 'chaos') { greatChance *= 2; failChance *= 2; }
            if (state.star.id === 'king') { greatChance *= 2; }
            if (state.star.id === 'gold' && type==='rest') { /* handled in stats */ }
        }

        if (state.stats.stress >= 80) greatChance = 0;

        if (r < greatChance && type !== 'rest') isGreat = true;
        else if (r > (1 - failChance) && type === 'job') isFail = true;

        log(`${action.name} 진행...`);
        // Flavor Text
        log(`"${getFlavorText(type, isGreat, isFail)}"`);

        if (isGreat) log("대성공!! 효과가 2배가 됩니다!", 'log-gain');
        if (isFail) log("실패했습니다... 보상이 없습니다.", 'log-loss');

        // Track pub success
        if (type === 'job' && action.id.includes('pub') && !isFail) {
            state.flags.pub_success = true;
        }

        let statChanges = {};

        if (action.stats) {
            for (let key in action.stats) {
                let val = action.stats[key];

                if (key === 'stress') {
                    if (val > 0) {
                        if (state.star && state.star.id === 'rest') {}
                        if (state.star && state.star.id === 'gold') val = 0;
                    }
                }

                if (key !== 'stress' && isGreat) val *= 2;

                if (type === 'study') {
                    if (state.personality === 'heat' && key === 'str') val += 1;
                    if (state.personality === 'wisdom' && key === 'int') val += 1;
                    if (state.personality === 'kindness' && key === 'charm') val += 1;
                }

                if (val > 0 && state.star) {
                    if (state.star.id === 'scholar' && (key === 'int' || key === 'faith')) val += 1;
                    if (state.star.id === 'warrior' && (key === 'vit' || key === 'str')) val += 1;
                    if (state.star.id === 'charm' && (key === 'charm' || key === 'elegance')) val += 1;
                    if (state.star.id === 'black' && action.id.includes('pub')) val *= 2;
                }

                if (key !== 'stress') {
                    state.stats[key] += val;
                    statChanges[key] = (statChanges[key] || 0) + val;
                }
                else {
                    state.stats.stress += val;
                    statChanges['stress'] = (statChanges['stress'] || 0) + val;
                }
            }
        }

        if (type === 'study') {
            if (state.personality === 'heat' && !action.stats.str) { state.stats.str += 1; statChanges['str'] = (statChanges['str'] || 0) + 1; }
            if (state.personality === 'wisdom' && !action.stats.int) { state.stats.int += 1; statChanges['int'] = (statChanges['int'] || 0) + 1; }
            if (state.personality === 'kindness' && !action.stats.charm) { state.stats.charm += 1; statChanges['charm'] = (statChanges['charm'] || 0) + 1; }
        }

        // Log stat changes
        let changeStrs = [];
        const statNames = {
            vit:'체력', str:'근력', int:'지능', charm:'매력',
            morality:'도덕', faith:'신앙', elegance:'기품', intimacy:'친밀', stress:'스트레스'
        };

        for(let k in statChanges) {
             let v = statChanges[k];
             if(v !== 0) {
                 let name = statNames[k] || k;
                 let sign = v > 0 ? '+' : '';
                 changeStrs.push(`${name} ${sign}${v}`);
             }
        }
        if(changeStrs.length > 0) log(changeStrs.join(', '));

        if (action.income && !isFail) {
            let income = action.income;
            if (isGreat) income *= 2;
            if (state.star && state.star.id === 'money') income = Math.floor(income * 1.2);
            if (state.star && state.star.id === 'black' && action.id.includes('pub')) income *= 2;
            if (state.personality === 'freedom') income = Math.floor(income * 1.1);

            state.stats.money += income;
            log(`${income} Gold 획득`, 'log-gain');
        }

        if (action.stressHeal) {
            let heal = action.stressHeal;
            if (state.star && state.star.id === 'rest') heal += 10;
            state.stats.stress -= heal;
            if (state.stats.stress < 0) state.stats.stress = 0;
            log(`스트레스가 ${heal} 감소했습니다.`);
        }

        let baseId = action.id.replace('_adv', '');
        if (!state.flags.counts[baseId]) state.flags.counts[baseId] = 0;
        state.flags.counts[baseId]++;

        updateUI();
        endTurn();
    }

    function endTurn() {
        state.turnCount++;
        state.seasonIndex++;

        if (state.seasonIndex >= 4) {
            state.seasonIndex = 0;
            state.age++;
            log(`${state.age}살이 되었습니다!`, 'log-event');

            if ([12, 14, 16].includes(state.age)) {
                log("상점이 열렸습니다! (메뉴에서 확인 가능)", 'log-event');
                state.flags.shopOpen = true;
                state.flags.shopUsed = false;
            } else {
                state.flags.shopOpen = false;
            }
        }

        if (state.seasonIndex === 0) {
             if (state.age === 13) {
                 triggerLocationEvent(1);
                 return;
             }
             if (state.age === 16) {
                 triggerLocationEvent(2);
                 return;
             }
             if (state.age === 18) {
                 triggerFinalEvent();
                 return;
             }
        }

        updateUI();
        startSeason();
    }

    // --- Systems Implementation ---

    function openSystemMenu() {
         const modal = els['modal-system'];
         const container = modal.querySelector('.choice-container');
         container.innerHTML = '';

         if (state.flags.shopOpen && !state.flags.shopUsed) {
             const btn = document.createElement('button');
             btn.textContent = '상점 이용';
             btn.onclick = () => { closeModal('modal-system'); openShop(); };
             container.appendChild(btn);
         }

         const btnFortune = document.createElement('button');
         btnFortune.textContent = '운세 뽑기';
         btnFortune.onclick = () => { closeModal('modal-system'); openFortuneMenu(); };
         container.appendChild(btnFortune);

         const btnSave = document.createElement('button');
         btnSave.textContent = '저장';
         btnSave.onclick = GAME.saveGame;
         container.appendChild(btnSave);

         const btnEnd = document.createElement('button');
         btnEnd.textContent = '엔딩 목록';
         btnEnd.onclick = GAME.viewEndings;
         container.appendChild(btnEnd);

         const btnClose = document.createElement('button');
         btnClose.textContent = '닫기';
         btnClose.onclick = () => closeModal('modal-system');
         container.appendChild(btnClose);

         modal.style.display = 'flex';
    }

    function openShop() {
        const modal = els['modal-shop'];
        const list = els['shop-list'];
        list.innerHTML = '';

        PM_DATA.shop.items.forEach(item => {
            if (item.id === 'dress_silk' && state.age < 16) return;

            const div = document.createElement('div');
            div.className = 'shop-item';

            const info = document.createElement('div');
            info.innerHTML = `<b>${item.name}</b><br>${item.cost}G`;

            const btn = document.createElement('button');
            btn.textContent = '구매';
            if (state.stats.money < item.cost) btn.disabled = true;

            btn.onclick = () => {
                if (state.stats.money >= item.cost) {
                    buyItem(item);
                }
            };

            div.appendChild(info);
            div.appendChild(btn);
            list.appendChild(div);
        });

        modal.style.display = 'flex';
    }

    function buyItem(item) {
        if (confirm(`${item.name}을(를) 구매하시겠습니까?`)) {
            state.stats.money -= item.cost;
            state.flags.shopUsed = true;
            log(`${item.name} 구매 완료!`, 'log-gain');
            if (item.type === 'consumable' || item.type === 'equip') {
                if (item.type === 'equip') {
                    equipItem(item);
                } else {
                    if (item.effect) {
                        for (let k in item.effect) {
                            if (k === 'stress') state.stats.stress += item.effect[k];
                            else state.stats[k] += item.effect[k];
                        }
                        if (state.stats.stress < 0) state.stats.stress = 0;
                    }
                    if (item.id === 'indulgence') {
                        log('면죄부를 사용하여 도덕심이 올랐습니다.');
                    }
                }
            }
            updateUI();
            closeModal('modal-shop');
        }
    }

    function equipItem(item) {
        const slot = item.slot;
        if (!state.equipment) state.equipment = { weapon: null, armor: null };

        const oldItem = state.equipment[slot];
        if (oldItem) {
             for (let k in oldItem.stats) {
                 state.stats[k] -= oldItem.stats[k];
             }
        }

        state.equipment[slot] = item;
        for (let k in item.stats) {
            state.stats[k] = (state.stats[k] || 0) + item.stats[k];
        }

        if (item.id === 'dress_silk') {
            state.flags.silk_dress_equipped = true;
        } else if (slot === 'armor') {
            state.flags.silk_dress_equipped = false;
        }

        log(`${item.name} 장착!`);
    }

    function triggerLocationEvent(phase) {
        log(`== ${phase}차 이벤트 발생 ==`, 'log-event');
        const modal = els['modal-event'];
        els['event-title'].textContent = '장소 선택';
        els['event-desc'].textContent = '방문할 장소를 선택하세요 (턴 소모 없음)';
        els['event-choices'].innerHTML = '';

        PM_DATA.events.locations.forEach(loc => {
            const btn = document.createElement('button');
            btn.textContent = loc.name;
            btn.onclick = () => {
                showEventDialogue(loc.id, phase);
            };
            els['event-choices'].appendChild(btn);
        });
        modal.style.display = 'flex';
    }

    function showEventDialogue(locId, phase) {
        const modal = els['modal-event'];
        els['event-choices'].innerHTML = '';

        let title = '';
        let desc = '';
        let choices = [];

        if (locId === 'arena') {
            title = '대련장 (케인)';
            if (phase === 1) {
                desc = '대련장에서 케인을 발견했습니다.';
                choices.push({ txt: '싸움을 건다', action: () => {
                    closeModal('modal-event');
                    startCombat('kane', () => {
                        state.stats.vit += 2; state.stats.str += 2;
                        log('케인에게 승리하여 체력+2, 근력+2 획득!', 'log-gain');
                        startSeason();
                    });
                }});
                choices.push({ txt: '말을 건다', action: () => {
                    log('케인과 대화했습니다. 호감도가 올랐습니다.');
                    state.flags.kane_affinity = (state.flags.kane_affinity || 0) + 1;
                    closeEvent();
                }});
            } else {
                desc = '케인이 검술대회에 대해 이야기합니다.';
                choices.push({ txt: '참가한다고 말한다', action: () => {
                    log('응원을 받았습니다. 체력+2, 근력+2');
                    state.stats.vit += 2; state.stats.str += 2;
                    closeEvent();
                }});
                choices.push({ txt: '불참한다고 말한다', action: () => {
                    log('케인이 아쉬워합니다.');
                    closeEvent();
                }});
                if (state.flags.kane_affinity > 0) {
                    choices.push({ txt: '강해지고 싶다고 한다', action: () => {
                        log('케인에게서 검을 받았습니다! (공격력+10)', 'log-gain');
                        state.stats.atk += 10;
                        closeEvent();
                    }});
                }
            }
        } else if (locId === 'lake') {
            title = '호수 (노아)';
            if (phase === 1) {
                desc = '노아의 노래가 들려옵니다.';
                choices.push({ txt: '가만히 듣는다', action: () => {
                    state.stats.stress -= 20; if(state.stats.stress<0) state.stats.stress=0;
                    log('스트레스가 20 감소했습니다.');
                    closeEvent();
                }});
                choices.push({ txt: '의미를 묻는다', action: () => {
                    state.stats.faith += 2; state.stats.elegance += 2;
                    log('신앙심+2, 기품+2');
                    closeEvent();
                }});
            } else {
                desc = '다친 새를 발견했습니다.';
                choices.push({ txt: '새를 도와준다', action: () => {
                    state.stats.morality += 2; state.stats.faith += 2; state.stats.stress += 10;
                    state.flags.noah_event = true;
                    log('도덕+2, 신앙+2, 스트레스+10. 노아 호감도 증가.');
                    closeEvent();
                }});
                choices.push({ txt: '노래를 들으러 간다', action: () => {
                    state.stats.stress -= 20; if(state.stats.stress<0) state.stats.stress=0;
                    log('스트레스가 20 감소했습니다.');
                    closeEvent();
                }});
            }
        } else if (locId === 'bar') {
            title = '바:블랙래빗 (마담 로즈)';
            if (phase === 1) {
                desc = '마담 로즈가 도박을 제안합니다.';
                choices.push({ txt: '받아들인다', action: () => {
                    if (Math.random() > 0.5) {
                        state.stats.money += 500;
                        log('도박 성공! 500골드 획득!', 'log-gain');
                    } else {
                        log('도박 실패... 아무일도 없었다.');
                    }
                    closeEvent();
                }});
                choices.push({ txt: '하지 않는다', action: () => {
                    state.stats.elegance += 1; state.stats.charm += 1;
                    log('기품+1, 매력+1');
                    closeEvent();
                }});
            } else {
                desc = '귀족의 약점이 담긴 장부를 판다고 합니다 (500G).';
                choices.push({ txt: '구매한다', action: () => {
                    if (state.stats.money >= 500) {
                        state.stats.money -= 500;
                        state.flags.noble_ledger = true;
                        log('귀족의 약점 장부를 획득했습니다.', 'log-gain');
                    } else {
                        log('돈이 부족합니다...', 'log-loss');
                    }
                    closeEvent();
                }});
                choices.push({ txt: '하지 않는다', action: () => {
                    state.stats.elegance += 1; state.stats.charm += 1;
                    log('기품+1, 매력+1');
                    closeEvent();
                }});
            }
        } else if (locId === 'tower') {
            title = '마녀의 탑 (엘라라)';
            if (phase === 1) {
                desc = '특제 포션을 마셔보라고 합니다.';
                choices.push({ txt: '마신다', action: () => {
                    if (Math.random() > 0.5) {
                        state.stats.int += 2; log('지능이 2 올랐습니다!');
                    } else {
                        state.stats.int -= 2; log('지능이 2 떨어졌습니다...', 'log-loss');
                    }
                    state.flags.ellara_affinity = true;
                    closeEvent();
                }});
                choices.push({ txt: '거절한다', action: () => {
                    state.stats.int += 1; log('지능이 1 올랐습니다.');
                    closeEvent();
                }});
            } else {
                desc = '고대 마법 완성을 도와달라고 합니다.';
                choices.push({ txt: '도와준다', action: () => {
                    state.stats.stress += 10; state.stats.int += 2;
                    log('스트레스+10, 지능+2');
                    if (state.flags.ellara_affinity) {
                        log('고대마법서를 획득했습니다! (마공+10)', 'log-gain');
                        state.stats.matk += 10;
                    }
                    closeEvent();
                }});
                choices.push({ txt: '지켜본다', action: () => {
                    state.stats.int += 1;
                    log('지능+1');
                    closeEvent();
                }});
            }
        }

        els['event-title'].textContent = title;
        els['event-desc'].textContent = desc;

        choices.forEach(c => {
            const btn = document.createElement('button');
            btn.textContent = c.txt;
            btn.onclick = c.action;
            els['event-choices'].appendChild(btn);
        });
    }

    function closeEvent() {
        closeModal('modal-event');
        startSeason();
    }

    function triggerFinalEvent() {
         const modal = els['modal-event'];
         els['event-title'].textContent = '17세 - 운명의 선택';
         els['event-desc'].textContent = '마지막 활동을 선택하세요.';
         els['event-choices'].innerHTML = '';

         const opts = [
             { name: '검술대회', id: 'sword' },
             { name: '마법대회', id: 'magic' },
             { name: '탐험', id: 'explore' },
             { name: '무도회', id: 'ball' }
         ];

         opts.forEach(opt => {
             const btn = document.createElement('button');
             btn.textContent = opt.name;
             btn.onclick = () => {
                 closeModal('modal-event');
                 handleFinalEvent(opt.id);
             };
             els['event-choices'].appendChild(btn);
         });
         modal.style.display = 'flex';
    }

    function handleFinalEvent(id) {
        if (id === 'sword') {
            log('검술대회에 참가했습니다.');
            startCombat('knight', () => {
                log('왕궁기사를 꺾었습니다! (체력+1, 근력+1)');
                state.stats.vit += 1; state.stats.str += 1;
                setTimeout(() => {
                    startCombat('kane', () => {
                        log('케인을 꺾고 우승했습니다!! (체력+2, 근력+2)');
                        state.stats.vit += 2; state.stats.str += 2;
                        state.flags.sword_win = true;
                        checkEnding();
                    }, checkEnding);
                }, 1000);
            }, checkEnding);
        } else if (id === 'magic') {
            log('마법대회에 참가했습니다.');
            startCombat('apprentice', () => {
                log('견습마법사를 꺾었습니다! (지능+1)');
                state.stats.int += 1;
                setTimeout(() => {
                    startCombat('royalmage', () => {
                        log('왕궁마법사를 꺾고 우승했습니다!! (지능+2)');
                        state.stats.int += 2;
                        state.flags.magic_win = true;
                        checkEnding();
                    }, checkEnding);
                }, 1000);
            }, checkEnding);
        } else if (id === 'explore') {
            log('탐험을 떠납니다.');
            startCombat('slime', () => {
                state.stats.money += 100; state.stats.vit += 1;
                setTimeout(() => {
                    startCombat('goblin', () => {
                        state.stats.money += 100; state.stats.vit += 1;
                        setTimeout(() => {
                            startCombat('demonking', () => {
                                state.stats.money += 100; state.stats.vit += 1;
                                state.flags.demon_king_dead = true;
                                log('마왕을 물리쳤습니다!!!');
                                checkEnding();
                            }, checkEnding);
                        }, 1000);
                    }, checkEnding);
                }, 1000);
            }, checkEnding);
        } else if (id === 'ball') {
            log('무도회에 참석했습니다.');
            if (state.stats.charm >= 50) {
                log('사람들에게 인정을 받았습니다. (매력+2)');
                state.stats.charm += 2;
            } else {
                log('무시를 당했습니다... (매력-1)');
                state.stats.charm -= 1;
            }

            if (state.flags.noble_ledger) {
                log('장부 덕분에 귀족들이 꼼짝 못합니다. (기품+2)');
                state.stats.elegance += 2;
            }

            if (state.flags.noah_event) {
                log('노아가 사실 궁정 음악가였다는 사실을 알게 됩니다! (매력+1)');
                state.stats.charm += 1;
            }

            setTimeout(checkEnding, 2000);
        }
    }

    // New Modals
    function openStatusModal() {
        if(els['modal-status']) {
            const content = els['status-content'];
            content.innerHTML = `
                <div class="stat-grid">
                    <div>체력(Vit): ${state.stats.vit}</div>
                    <div>근력(Str): ${state.stats.str}</div>
                    <div>지능(Int): ${state.stats.int}</div>
                    <div>매력(Cha): ${state.stats.charm}</div>
                    <div>스트레스: ${state.stats.stress}</div>
                    <div>도덕심: ${state.stats.morality}</div>
                    <div>신앙심: ${state.stats.faith}</div>
                    <div>친밀함: ${state.stats.intimacy}</div>
                    <div>기품: ${state.stats.elegance}</div>
                    <div style="grid-column: span 2; margin-top:10px;"><b>전투능력</b></div>
                    <div>HP: ${state.stats.hp}/${30+state.stats.vit}</div>
                    <div>공격력: ${state.stats.atk + Math.floor(state.stats.str/10)}</div>
                    <div>마법공격력: ${state.stats.matk + Math.floor(state.stats.int/10)}</div>
                    <div>방어력: ${state.stats.def}</div>
                </div>
            `;
            els['modal-status'].style.display = 'flex';
        } else {
             alert('Status modal not found');
        }
    }

    function openEquipModal() {
        if(els['modal-equip']) {
             const content = els['equip-content'];
             content.innerHTML = `
                <div class="equip-slot">
                    <b>무기:</b> ${state.equipment && state.equipment.weapon ? state.equipment.weapon.name : '없음'}
                </div>
                <div class="equip-slot">
                    <b>방어구:</b> ${state.equipment && state.equipment.armor ? state.equipment.armor.name : '없음'}
                </div>
             `;
             els['modal-equip'].style.display = 'flex';
        } else {
             alert('Equip modal not found');
        }
    }

    return {
        init,
        startGame,
        openMenu,
        closeModal,
        rerollStar,
        confirmStar,
        openSystemMenu: openSystemMenu,
        openEquipMenu: openEquipModal,
        openStatusMenu: openStatusModal,
        openFortuneMenu: openFortuneMenu,
        saveGame: () => {
            localStorage.setItem('pm_save', JSON.stringify(state));
            alert('저장되었습니다.');
        },
        loadGame: () => {
            const save = localStorage.getItem('pm_save');
            if (save) {
                state = JSON.parse(save);
                els['start-screen'].style.display = 'none';
                updateUI();
                startSeason();
            }
        },
        viewEndings: () => els['modal-endings'].style.display = 'flex',
        combatAction
    };

})();

window.onload = GAME.init;
