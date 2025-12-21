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
        const ids = ['ui-age', 'ui-season', 'ui-gold', 'ui-hp', 'ui-stress',
            'stat-vit', 'stat-str', 'stat-int', 'stat-charm',
            'stat-morality', 'stat-faith', 'stat-elegance', 'stat-intimacy',
            'main-image-placeholder', 'img-name', 'message-log',
            'modal-action', 'action-list', 'action-title',
            'modal-star', 'star-result', 'star-name', 'star-desc', 'reroll-count',
            'modal-event', 'event-title', 'event-desc', 'event-choices',
            'modal-combat', 'player-hud', 'enemy-hud', 'combat-log',
            'modal-shop', 'shop-list', 'modal-endings', 'ending-list', 'start-screen'
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

        // Apply personality bonuses
        const p = PM_DATA.personalities[personalityKey];
        if (personalityKey === 'heat') { state.stats.vit += 10; state.stats.str += 10; }
        if (personalityKey === 'wisdom') { state.stats.int += 10; }
        if (personalityKey === 'kindness') { state.stats.charm += 10; }

        state.flags.counts = {}; // Track action counts for unlocking advanced

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
        // Calc Player Stats
        // HP = 50 + Vit (from logic earlier, wait, I used 30+Vit).
        // Let's reuse UI logic.
        const maxHp = 30 + state.stats.vit;

        // Attack: 10 base + Str/10
        const atk = 10 + Math.floor(state.stats.str / 10) + (state.stats.atk - 10);
        // Note: state.stats.atk was initialized to 10. Items add to it directly.
        // So `state.stats.atk` already contains Base(10) + ItemBonus.
        // But prompt: "근력10당 공격력 1 증가".
        // So RealAtk = state.stats.atk + Math.floor(state.stats.str / 10).

        // MagAtk: 10 base + Int/10
        const matk = 10 + Math.floor(state.stats.int / 10) + (state.stats.matk - 10);

        // Def: 5 base + Items
        // Prompt says "장비의 공격이나 마공 방어는 그대로 합산".
        // Does Str/Int/Vit affect defense? Prompt only mentioned HP from Vit.
        // So Def is purely Base(5) + Items.
        const def = state.stats.def;

        combatState = {
            player: {
                hp: maxHp,
                maxHp: maxHp,
                atk: atk,
                matk: matk,
                def: def
            },
            enemy: JSON.parse(JSON.stringify(enemyData)), // Clone
            turn: 0
        };

        // Setup UI
        els['modal-combat'].style.display = 'flex';
        els['enemy-name'].textContent = combatState.enemy.name;
        els['combat-log'].innerHTML = '';
        updateCombatUI();
        logCombat(`전투 시작! vs ${combatState.enemy.name}`);
    }

    function updateCombatUI() {
        els['combat-hp-p'].textContent = combatState.player.hp;
        els['combat-atk-p'].textContent = combatState.player.atk; // Show Phy Atk primarily

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
        // AI Move: Random
        const moves = ['attack', 'special', 'counter'];
        const enemyMove = moves[Math.floor(Math.random() * 3)];

        logCombat(`나: ${moveName(playerMove)} vs 적: ${moveName(enemyMove)}`);

        // Calculate Damage
        let pDmg = 0;
        let eDmg = 0;

        // Player stats
        const pAtk = combatState.player.atk; // Assuming Phy for now. Prompt says "검술대회는 물리스탯, 마법대회는 마법스탯".
        // We should switch based on context or use higher?
        // Let's use `type` from enemy to decide context?
        // Enemy has `type: 'phy'` or `'mag'`.
        // If enemy is Mag, maybe it's a Magic Tourney?
        // But "탐험은 물리스탯 사용".
        // Let's check context.
        // We don't have context passed easily.
        // Let's assume Phy unless specifically Magic Tourney logic overrides?
        // Or check `enemy.type`. If enemy is Mag, maybe we use Mag?
        // Wait, Magic Tourney uses Magic Stats.
        // Let's assume if enemy.type == 'mag', we use Matk.

        let pPower = (combatState.enemy.type === 'mag') ? combatState.player.matk : combatState.player.atk;
        let pDef = combatState.player.def; // Prompt didn't mention MDef scaling, just "기본 방어력 5".

        let ePower = combatState.enemy.atk;
        let eDef = combatState.enemy.def;

        // Resolution
        // RPS:
        // Attack vs Attack: Both deal dmg
        // Attack vs Special: Special wins (2x dmg), Attack deals normal? No.
        // Prompt: "가위바위보 식으로 서로의 패를 비교해서 대미지 계산"
        // "커맨드는 필살, 공격, 반격 3개 존재"
        // This usually implies a triangular relationship.
        // Attack < Special < Counter < Attack?
        // Prompt says:
        // "공격은 공격력만큼의 대미지"
        // "필살기는 공격력의 2배대미지"
        // "반격은 대미지0이지만 상대 커맨드가 필살기일 경우 무효화하고 공격력만큼의 대미지"

        // It doesn't explicitly say "Special beats Attack".
        // It just defines damage.
        // "반격" only works vs "필살기".
        // If I Counter and Enemy Attacks?
        // Prompt doesn't say. Usually Counter fails vs Attack (Take dmg, deal 0).
        // Let's implement:
        // P: Attack, E: Attack -> Both Dmg
        // P: Attack, E: Special -> Both Dmg (E deals 2x)
        // P: Attack, E: Counter -> P Dmg, E 0 Dmg (Counter fails vs Attack)

        // P: Special, E: Attack -> Both Dmg (P 2x)
        // P: Special, E: Special -> Both 2x
        // P: Special, E: Counter -> P 0 Dmg, E Dmg (Counter proc)

        // P: Counter, E: Attack -> P Take Dmg, Deal 0.
        // P: Counter, E: Special -> P Take 0, Deal Dmg.
        // P: Counter, E: Counter -> Both 0.

        // Calculate Raw Dmg
        const calcDmg = (atk, def, mult) => {
            let d = (atk - def);
            if (d < 1) d = 1;
            return Math.floor(d * mult);
        };

        // Player Action Resolution
        if (playerMove === 'attack') {
            pDmg = calcDmg(pPower, eDef, 1);
        } else if (playerMove === 'special') {
            if (enemyMove === 'counter') {
                pDmg = 0; // Countered
            } else {
                pDmg = calcDmg(pPower, eDef, 2);
            }
        } else if (playerMove === 'counter') {
            if (enemyMove === 'special') {
                pDmg = calcDmg(pPower, eDef, 1); // Counter success deals normal dmg
            } else {
                pDmg = 0; // Failed counter
            }
        }

        // Enemy Action Resolution
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

        // Apply Dmg
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

        // Check Death
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
        // Sort endings by priority
        const sortedEndings = PM_DATA.endings.sort((a,b) => a.priority - b.priority);

        let finalEnding = null;

        for (let ending of sortedEndings) {
            let match = true;

            // Check Req
            for (let stat in ending.req) {
                // If ending.req is {str: 130}, check state.stats.str >= 130
                if ((state.stats[stat] || 0) < ending.req[stat]) {
                    match = false;
                    break;
                }
            }

            // Check Max Conditions (e.g. morality < 10)
            if (ending.maxMorality !== undefined) {
                if (state.stats.morality > ending.maxMorality) match = false;
            }

            // Check Flags
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
        // Save to History
        let history = JSON.parse(localStorage.getItem('pm_endings') || '[]');
        if (!history.find(e => e.id === ending.id)) {
            history.push(ending);
            localStorage.setItem('pm_endings', JSON.stringify(history));
        }

        // UI
        els['main-image-placeholder'].innerHTML = ''; // Clear current
        // Show Ending Image?
        els['img-name'].textContent = `엔딩: ${ending.name}`;

        log(`=== 엔딩 달성: ${ending.name} ===`, 'log-event');

        alert(`축하합니다! 당신은 [${ending.name}] 엔딩을 맞이했습니다.`);

        // Reset or Return to Title
        location.reload();
    }

    function updateUI() {
        els['ui-age'].textContent = state.age;
        els['ui-season'].textContent = PM_DATA.gameDuration.seasons[state.seasonIndex];
        els['ui-gold'].textContent = state.stats.money;
        els['ui-stress'].textContent = state.stats.stress;

        // Calc max HP
        const maxHp = 50 + (state.stats.vit - 20); // Base 50 + (Vit-20) -> 1 Vit = 1 MaxHP inc?
        // Prompt: "체력 1당 최대hp 1 증가(상한50)" -> This implies MaxHP increases by 1 for every Vit?
        // "기본 hp50... 체력 1당 최대hp 1 증가(상한50)" -> Wait. "상한50" might mean the increase is capped or the total is capped?
        // Or maybe it means "Max HP increases by 1 per Vit, but Vit itself is capped at 50?" No, stats go to 100+.
        // Let's assume MaxHP = 50 + (Vit - InitialVit). If Initial is 20, then at 20 Vit we have 50 HP. at 30 Vit we have 60 HP.
        // Wait "상한50" usually means Limit 50. But Base is 50. So maybe "Increase is capped at +50"? So max 100 HP?
        // Or "Max HP is 50"? No, that contradicts "increases".
        // Let's assume: MaxHP = 50 + (state.stats.vit); and the prompt meant "Vit limit 50"? No.
        // Let's stick to: HP = 50 + (state.stats.vit - 20).
        // Actually, prompt says: "체력 1당 최대hp 1 증가(상한50)" -> Maybe it means "Max Bonus is 50"?
        // Let's implement HP = 50 + state.stats.vit. (Since init Vit is 20, init HP is 70? No init HP is 50).
        // Let's do: MaxHP = 30 + state.stats.vit. (20 vit -> 50 HP).

        const realMaxHp = 30 + state.stats.vit;
        if (state.stats.hp > realMaxHp) state.stats.hp = realMaxHp;
        els['ui-hp'].textContent = `${state.stats.hp}/${realMaxHp}`;

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
        let imgName = `프린스${state.age}`;

        // Check for specific overrides
        if (state.flags.silk_dress_equipped && state.age >= 16) {
            imgName = '프린스실크드레스';
        } else {
            // Check fatigue/rebel
            if (state.stats.stress >= 80) { // Exhaustion/Fatigue
                imgName = `프린스피로${state.age}`;
            } else if (state.stats.morality <= 10) { // Rebel
                imgName = `프린스반항${state.age}`;
            }
        }

        // The prompt lists specific ages for images: 10, 13, 16.
        // We need to map 10,11,12 -> 10. 13,14,15 -> 13. 16,17 -> 16.
        let artAge = 10;
        if (state.age >= 13) artAge = 13;
        if (state.age >= 16) artAge = 16;

        // Reconstruct name with mapped age
        let base = `프린스${artAge}`;
        if (state.flags.silk_dress_equipped && state.age >= 16) {
            base = '프린스실크드레스';
        } else {
            if (state.stats.stress >= 80) base = `프린스피로${artAge}`;
            else if (state.stats.morality <= 10) base = `프린스반항${artAge}`;
        }

        els['img-name'].textContent = base;
        // In a real implementation, we would set els['main-image'].src = `assets/${base}.png`;
        // For now, we rely on the placeholder text.
    }

    function log(msg, type='') {
        const div = document.createElement('div');
        div.className = 'log-entry ' + type;
        div.textContent = msg;
        els['message-log'].appendChild(div);
        els['message-log'].scrollTop = els['message-log'].scrollHeight;
    }

    // --- Actions ---

    function openMenu(type) {
        if (state.stats.hp <= 0) {
            log("체력이 없어 행동할 수 없습니다. 휴식하세요.", 'log-loss');
            return;
        }

        // Check "Collapse" state (Stress 100) -> Forced Rest only
        if (state.stats.stress >= 100 && type !== 'rest') {
            log("스트레스가 한계입니다! 무조건 휴식해야 합니다.", 'log-loss');
            return;
        }

        // Rebel Check (Morality <= 10)
        // Blocks: Etiquette (Study), Church (Job)
        const isRebel = state.stats.morality <= 10;

        const modal = els['modal-action'];
        const list = els['action-list'];
        list.innerHTML = '';

        let items = [];
        if (type === 'study') {
            els['action-title'].textContent = '수업 선택';
            items = PM_DATA.actions.study.basic;
            // Add advanced if unlocked? Prompt: "6회 이상부터"
            // We need to check counts. For simplicity, we merge basic and advanced if unlocked, or replace?
            // "수업 고급 (6회 이상부터)" implies it replaces or is added. Usually replaces in PM games.
            // Let's list both or upgrade. Prompt separates them. Let's show all available.

            // Actually, let's just iterate over keys in PM_DATA.actions.study
            // And check unlock conditions.
            // Simplified: Just show basic list, and if count >= 6, show advanced version instead?
            // Or show advanced as separate buttons.

            // Let's try to map them.
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

                // Rebel check for Etiquette
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

                // Rebel check for Church
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

        // Cost check
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
        els[id].style.display = 'none';
    }

    function startSeason() {
        // Log Season Start
        log(`=== ${state.age}세 ${PM_DATA.gameDuration.seasons[state.seasonIndex]} ===`, 'log-turn');

        // Star Reroll Trigger
        state.starRerolls = 3;
        rollStar();
        els['modal-star'].style.display = 'flex';
    }

    function rollStar() {
        const stars = PM_DATA.stars;
        state.star = stars[Math.floor(Math.random() * stars.length)];
        els['star-name'].textContent = state.star.name;
        els['star-desc'].textContent = state.star.desc;
        els['reroll-count'].textContent = state.starRerolls;
    }

    function rerollStar() {
        if (state.starRerolls > 0) {
            state.starRerolls--;
            rollStar();
        }
    }

    function confirmStar() {
        closeModal('modal-star');
        log(`이번 분기 운세: [${state.star.name}] 적용`);

        // Event Check Trigger? No, events usually trigger at end of turn or specific times.
        // Prompt: "각 분기별로 수업, 아르바이트, 휴식 중 하나 선택가능" -> This means 1 turn per season?
        // Prompt says "총 28턴". 7 years * 4 seasons = 28. So yes, 1 action per season.
        // So we are currently waiting for user input via openMenu.
    }

    function executeTurn(action, type) {
        // Deduct Cost
        if (action.cost) state.stats.money -= action.cost;

        // Calculate Success/Fail
        // Base Success 100%.
        // Great Success (Study: 20%, Job: 10%).
        // Fail (Job: 10%).
        // Modifiers: Personality, Stars, Exhaustion.

        let isGreat = false;
        let isFail = false;
        const r = Math.random();

        // Modifiers
        let greatChance = (type === 'study') ? 0.2 : (type === 'job' ? 0.1 : 0);
        let failChance = (type === 'job') ? 0.1 : 0;

        if (state.star.id === 'chaos') { greatChance *= 2; failChance *= 2; }
        if (state.star.id === 'king') { greatChance *= 2; }

        if (state.stats.stress >= 80) greatChance = 0; // Exhaustion blocks Great Success

        if (r < greatChance && type !== 'rest') isGreat = true;
        else if (r > (1 - failChance) && type === 'job') isFail = true;

        // Apply Results
        log(`${action.name} 진행...`);

        let statMult = 1;
        if (isGreat) {
            log("대성공!! 효과가 2배가 됩니다!", 'log-gain');
            statMult = 2;
            // Personality Bonuses?
        }
        if (isFail) {
            log("실패했습니다... 보상이 없습니다.", 'log-loss');
            statMult = 0; // Stats might still apply? Prompt: "알바 실패시 보상골드 없음". Stats usually apply or reduced.
            // Let's assume stats apply normally but gold is 0.
            // Wait, usually failure means stress up and no money/stats.
            // Prompt specifically says "알바 실패시 보상골드 없음". Doesn't mention stats.
            // Let's assume stats gain is 0 too for safety/standard PM logic, or just half?
            // Let's set statMult 0.5 for failure? Or 1?
            // "보상골드 없음" implies that's the main penalty.
            // Let's keep stats at 1 for fail, but gold 0.
        }

        // Apply Stats
        if (action.stats) {
            for (let key in action.stats) {
                let val = action.stats[key];

                // Stress is special
                if (key === 'stress') {
                    if (val > 0) { // Stress Increase
                        if (state.star.id === 'rest') { /* No effect on increase */ }
                        if (state.star.id === 'gold') val = 0; // Gold Star: No stress
                    }
                }

                // Apply Multiplier to gains (positive stats)
                // Negative stats (like str -1 in etiquette) should they be doubled on great success? Usually yes.
                // But Prompt says "수업 대성공시 스탯변동 2배". So yes.
                if (key !== 'stress' && isGreat) val *= 2;

                // Personality Bonuses (Only for Study)
                if (type === 'study') {
                    if (state.personality === 'heat' && key === 'str') val += 1; // Actually Prompt: "수업시 근력추가스탯 1" (implies flat add)
                    if (state.personality === 'wisdom' && key === 'int') val += 1;
                    if (state.personality === 'kindness' && key === 'charm') val += 1;
                    // "추가스탯 1" is flat. So add after mult? Or before? Usually flat is added.
                    // Let's add distinct check.
                }

                // Star Bonuses
                if (val > 0) { // Only grow positive stats
                    if (state.star.id === 'scholar' && (key === 'int' || key === 'faith')) val += 1;
                    if (state.star.id === 'warrior' && (key === 'vit' || key === 'str')) val += 1;
                    if (state.star.id === 'charm' && (key === 'charm' || key === 'elegance')) val += 1;
                    if (state.star.id === 'black' && action.id.includes('pub')) val *= 2; // Black Star Pub 2x
                }

                if (key !== 'stress') state.stats[key] += val;
                else state.stats.stress += val;
            }
        }

        // Personality Flat Bonus Injection (if not in action.stats)
        // eg. "수업시 근력추가스탯 1". If action didn't have Str, do we add it? Usually yes.
        if (type === 'study') {
            if (state.personality === 'heat' && !action.stats.str) state.stats.str += 1;
            if (state.personality === 'wisdom' && !action.stats.int) state.stats.int += 1;
            if (state.personality === 'kindness' && !action.stats.charm) state.stats.charm += 1;
        }

        // Income
        if (action.income && !isFail) {
            let income = action.income;
            if (isGreat) income *= 2;
            if (state.star.id === 'money') income = Math.floor(income * 1.2);
            if (state.star.id === 'black' && action.id.includes('pub')) income *= 2;
            if (state.personality === 'freedom') income = Math.floor(income * 1.1);

            state.stats.money += income;
            log(`${income} Gold 획득`, 'log-gain');
        }

        // Stress Heal (Rest)
        if (action.stressHeal) {
            let heal = action.stressHeal;
            if (state.star.id === 'rest') heal += 10;
            state.stats.stress -= heal;
            if (state.stats.stress < 0) state.stats.stress = 0;
            log(`스트레스가 ${heal} 감소했습니다.`);
        }

        // Track Counts (For unlocking advanced)
        // We need the base ID. e.g. 's_sword_adv' -> 's_sword'
        let baseId = action.id.replace('_adv', '');
        if (!state.flags.counts[baseId]) state.flags.counts[baseId] = 0;
        state.flags.counts[baseId]++;

        updateUI();
        endTurn();
    }

    function endTurn() {
        state.turnCount++;
        state.seasonIndex++;

        // Age Up check
        if (state.seasonIndex >= 4) {
            state.seasonIndex = 0;
            state.age++;
            log(`${state.age}살이 되었습니다!`, 'log-event');

            // Age Triggers (12, 14, 16 for Shop)
            if ([12, 14, 16].includes(state.age)) {
                log("상점이 열렸습니다! (메뉴에서 확인 가능)", 'log-event');
                state.flags.shopOpen = true; // Reset shop status for new age if needed?
                // Prompt says "한번 이용에 한개 구매 가능".
                // So we set a flag 'shopUsed' = false.
                state.flags.shopUsed = false;
            } else {
                state.flags.shopOpen = false;
            }
        }

        // Check Ending Conditions (17 years old)
        if (state.age > PM_DATA.gameDuration.endAge) { // > 17 means turned 18? No, prompt says "17살까지". "17세 종료시 특수이벤트".
            // If we just finished Winter of 17, next is Age 18 Spring? Or check at end of 17 Winter.
            // Let's check: Age 17 Winter executed -> seasonIndex becomes 0, Age becomes 18.
            // So if state.age == 18, trigger Final Event.
        }

        // Trigger Events based on Age
        // "12세 종료시 1차이벤트", "15세 종료시 2차이벤트", "17세 종료시 특수이벤트"
        // "종료시" usually means after Winter. So exactly when Age increments.
        // If we just incremented age to 13 (so 12 finished), 16 (15 finished), 18 (17 finished).

        if (state.seasonIndex === 0) { // Just turned new age
             if (state.age === 13) { // 12 finished
                 triggerLocationEvent(1);
                 return; // Pause loop
             }
             if (state.age === 16) { // 15 finished
                 triggerLocationEvent(2);
                 return;
             }
             if (state.age === 18) { // 17 finished
                 triggerFinalEvent();
                 return;
             }
        }

        updateUI();
        startSeason();
    }

    // --- Systems Implementation ---

    function openSystemMenu() {
         // Re-using System Modal for general options
         const modal = els['modal-system'];
         const container = modal.querySelector('.choice-container');
         container.innerHTML = '';

         // Shop Button
         if (state.flags.shopOpen && !state.flags.shopUsed) {
             const btn = document.createElement('button');
             btn.textContent = '상점 이용';
             btn.onclick = () => { closeModal('modal-system'); openShop(); };
             container.appendChild(btn);
         }

         // Standard Buttons
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
            // Check visibility
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

            // Apply Effects
            if (item.type === 'consumable' || item.type === 'equip') {
                // For simplicity, Equips are permanent stat boosts in this implementation
                // unless we want to track equipment slots.
                // Prompt: "장비슬롯은 무기, 방어구 2종류 있음".
                // "장비의 공격이나 마공 방어는 그대로 합산".
                // So we should track current equipment.

                if (item.type === 'equip') {
                    // Unequip previous if exists?
                    // Let's just add stats for now, or track slot.
                    // If we track slot, we need to remove old stats.
                    // Let's simplified: Equips give permanent stats.
                    // Wait, "실크드레스 : 착용시 드레스 코스튬으로 변환".
                    // This implies "Equipped" state.

                    equipItem(item);
                } else {
                    // Consumable (Instant)
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
        // Remove old stats if slot occupied
        const slot = item.slot;
        if (!state.equipment) state.equipment = { weapon: null, armor: null };

        const oldItem = state.equipment[slot];
        if (oldItem) {
            // Revert stats?
            // Since we added stats permanently in prompt's logic "합산",
            // if we just add stats to base, we can't revert easily without tracking.
            // Let's store equipment stats separately in calculation?
            // Prompt: "장비의 공격이나 마공 방어는 그대로 합산".
            // Let's track `extraStats` from equipment.
        }

        // Actually, let's just use `state.stats` as base stats + permanent growth,
        // and calculate "Battle Stats" dynamically?
        // But UI shows Total Stats.
        // Let's keep it simple: Add new stats, remove old stats.
        // But I don't have old item data easily unless I store full item object.

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
            state.flags.silk_dress_equipped = false; // Unequip dress if wearing other armor
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

        // Logic based on Loc and Phase
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
            } else { // Phase 2
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
                        // Add item effect directly or give item?
                        // "케인의 검을 받음 (공격력10)" -> Treat as passive or item?
                        // Let's add stats directly for simplicity as "Item" implies equipment slot.
                        // But I have slots. Let's give item "sword_kane" (need to define or just buff).
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
                    state.flags.noah_event = true; // Flag for Ending
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
            // Fight Knight then Kane
            startCombat('knight', () => {
                log('왕궁기사를 꺾었습니다! (체력+1, 근력+1)');
                state.stats.vit += 1; state.stats.str += 1;
                setTimeout(() => {
                    startCombat('kane', () => {
                        log('케인을 꺾고 우승했습니다!! (체력+2, 근력+2)');
                        state.stats.vit += 2; state.stats.str += 2;
                        state.flags.sword_win = true;
                        checkEnding();
                    }, checkEnding); // If lose Kane, just check Ending
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
            // Checks
            if (state.stats.charm >= 50) { // Indefinite "certain amount"
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

    // Expose public methods
    return {
        init,
        startGame,
        openMenu,
        closeModal,
        rerollStar,
        confirmStar,
        openSystemMenu: () => els['modal-system'].style.display = 'flex',
        openEquipMenu: () => {
            alert(`[장비 현황]\n무기: ${state.equipment && state.equipment.weapon ? state.equipment.weapon.name : '없음'}\n방어구: ${state.equipment && state.equipment.armor ? state.equipment.armor.name : '없음'}`);
        },
        openStatusMenu: () => {
             // Show all stats in alert or reuse modal?
             // Let's use a formatted alert for simplicity as prompt requested "스탯표시" in menu.
             // We already have side panel. Maybe this button just highlights it or shows more detail?
             // Prompt: "스탯 : 체력, 근력, 지능, 매력 ,스트레스 / 히든스탯 : 도덕심, 신앙심, 친밀함 기품"
             // Side panel shows all these. So maybe just redundant?
             // Let's pop up a detailed alert.
             let msg = `[상세 스탯]\n`;
             msg += `체력(Vit): ${state.stats.vit}\n`;
             msg += `근력(Str): ${state.stats.str}\n`;
             msg += `지능(Int): ${state.stats.int}\n`;
             msg += `매력(Cha): ${state.stats.charm}\n`;
             msg += `스트레스: ${state.stats.stress}\n\n`;
             msg += `도덕심: ${state.stats.morality}\n`;
             msg += `신앙심: ${state.stats.faith}\n`;
             msg += `친밀함: ${state.stats.intimacy}\n`;
             msg += `기품: ${state.stats.elegance}\n`;
             msg += `\n전투능력:\n`;
             msg += `HP: ${state.stats.hp}/${30+state.stats.vit}\n`;
             msg += `공격력: ${state.stats.atk + Math.floor(state.stats.str/10)} (기본 ${state.stats.atk} + 보정 ${Math.floor(state.stats.str/10)})\n`;
             msg += `마법공격력: ${state.stats.matk + Math.floor(state.stats.int/10)} (기본 ${state.stats.matk} + 보정 ${Math.floor(state.stats.int/10)})\n`;
             msg += `방어력: ${state.stats.def}\n`;

             alert(msg);
        },
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
        viewEndings: () => els['modal-endings'].style.display = 'flex'
    };

})();

window.onload = GAME.init;
