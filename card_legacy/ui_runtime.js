(function () {
    'use strict';

    const MODE_LABELS = {
        origin: '오리진',
        restriction: '제약의 시련',
        balance: '균형의 도전',
        suffering: '고난의 여정',
        puzzle: '퍼즐',
        archive: '아카이브',
        curse: '저주의 증폭',
        flood: '축복의 범람',
        chaos: '카오스',
        artifact_chaos: '아티팩트 카오스',
        draft: '드래프트',
        factory: '팩토리',
        artifact: '아티팩트',
        artifact_reserve: '아티팩트 리저브',
        overdrive: '오버드라이브',
        dream_corridor: '꿈의회랑'
    };
    const TYPE_LABELS = {
        standard: '일반',
        challenge: '챌린지',
        endless: '엔드리스'
    };
    const PARTICLE_POSITIONS = [
        [12, 70], [22, 58], [31, 76], [40, 64],
        [50, 72], [60, 60], [69, 77], [78, 57],
        [88, 69], [18, 44], [50, 48], [82, 42],
        [34, 36], [66, 34], [26, 84], [74, 86]
    ];

    const byId = id => document.getElementById(id);
    const clampRatio = (value, max) => {
        if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
        return Math.max(0, Math.min(1, value / max));
    };
    const integer = value => Math.max(0, Math.floor(Number(value) || 0));
    const prefersReducedMotion = () => (
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
    const actorSide = side => side === 'enemy' ? 'enemy' : 'player';

    function actorElement(side) {
        return byId(actorSide(side) === 'enemy' ? 'enemy-actor-box' : 'player-actor-box');
    }

    function animateOnce(element, keyframes, options, onFinish) {
        if (!element) return null;
        if (typeof element.animate !== 'function') {
            if (onFinish) window.setTimeout(onFinish, Number(options.duration) || 250);
            return null;
        }
        const frames = prefersReducedMotion()
            ? [{ opacity: 0.55 }, { opacity: 1 }]
            : keyframes;
        const animation = element.animate(frames, options);
        if (onFinish) animation.onfinish = onFinish;
        return animation;
    }

    function getBuffSnapshot(buffs) {
        const source = buffs && typeof buffs === 'object' ? buffs : {};
        return Object.keys(source).sort().reduce((result, id) => {
            result[id] = source[id];
            return result;
        }, {});
    }

    function changedBuffIds(previous, current) {
        const ids = new Set([
            ...Object.keys(previous || {}),
            ...Object.keys(current || {})
        ]);
        return new Set([...ids].filter(id => String(previous && previous[id]) !== String(current && current[id])));
    }

    const CardUI = {
        state: {
            rpg: null,
            logExpanded: false,
            battleIdentity: null,
            previousBattle: null,
            fxLayer: null,
            textPool: [],
            particlePool: []
        },

        install(rpg) {
            this.state.rpg = rpg;
            const log = byId('battle-log');
            if (log) log.setAttribute('aria-live', 'polite');
            this.ensureEffectPools();
            this.applyLogState();
            this.renderHub(rpg);
        },

        ensureEffectPools() {
            const layer = byId('battle-fx-layer');
            if (!layer) return;
            if (this.state.fxLayer === layer && this.state.textPool.length === 12 && this.state.particlePool.length === 16) {
                return;
            }

            layer.replaceChildren();
            const fragment = document.createDocumentFragment();
            this.state.textPool = Array.from({ length: 12 }, () => {
                const node = document.createElement('div');
                node.className = 'ui-fx-text';
                node.setAttribute('aria-hidden', 'true');
                fragment.appendChild(node);
                return node;
            });
            this.state.particlePool = Array.from({ length: 16 }, (_, index) => {
                const node = document.createElement('i');
                node.className = 'ui-fx-particle';
                node.setAttribute('aria-hidden', 'true');
                node.dataset.poolIndex = String(index);
                fragment.appendChild(node);
                return node;
            });
            layer.appendChild(fragment);
            this.state.fxLayer = layer;
        },

        acquireNode(pool) {
            const node = pool.find(candidate => candidate.dataset.active !== 'true') || pool[0];
            if (!node) return null;
            if (node.getAnimations) node.getAnimations().forEach(animation => animation.cancel());
            node.dataset.active = 'true';
            return node;
        },

        releaseNode(node) {
            if (!node) return;
            node.dataset.active = 'false';
            node.style.cssText = '';
            node.style.display = 'none';
            if (node.classList.contains('ui-fx-text')) node.className = 'ui-fx-text';
            else node.className = 'ui-fx-particle';
            node.textContent = '';
        },

        renderHub(rpg) {
            if (!rpg || !rpg.state) return;
            const state = rpg.state;
            const stage = integer(state.enemyScale) + 1;
            const type = TYPE_LABELS[state.gameType] || '일반';
            const hard = state.hardMode ? ' · 하드' : '';
            const mode = MODE_LABELS[state.mode] || state.mode || '오리진';
            const modeName = byId('hub-mode-name');
            const runMeta = byId('hub-run-meta');
            const stageText = byId('hub-stage-text');
            const ticketText = byId('ui-tickets');
            if (modeName) modeName.textContent = mode;
            if (runMeta) runMeta.textContent = `${type}${hard} · Stage ${stage}`;
            if (stageText) stageText.textContent = `Stage ${stage}`;
            if (ticketText) ticketText.textContent = integer(state.tickets);

            const roles = ['선봉', '중견', '대장'];
            roles.forEach((role, index) => {
                const slot = byId(`hub-party-slot-${index}`);
                if (!slot) return;
                const cardId = Array.isArray(state.deck) ? state.deck[index] : null;
                const card = cardId && typeof rpg.getCardData === 'function' ? rpg.getCardData(cardId) : null;
                const name = slot.querySelector('.hub-party-name');
                slot.classList.toggle('is-empty', !card);
                slot.dataset.role = role;
                slot.dataset.fallback = card && card.name ? card.name.charAt(0) : '-';
                if (name) name.textContent = card ? card.name : '비어 있음';
            });
        },

        renderStatusChips(container, buffs, changedIds) {
            if (!container) return;
            const source = buffs && typeof buffs === 'object' ? buffs : {};
            const fragment = document.createDocumentFragment();
            Object.keys(source).forEach(id => {
                const value = source[id];
                const chip = document.createElement('span');
                let negative = false;
                try {
                    negative = typeof StatusRules !== 'undefined' && StatusRules.isNegative(id);
                } catch (error) {
                    negative = false;
                }
                chip.className = `status-chip ${negative ? 'negative' : 'positive'}`;
                chip.dataset.statusId = id;
                const name = document.createElement('span');
                name.textContent = (typeof BUFF_NAMES !== 'undefined' && BUFF_NAMES[id]) || id;
                chip.appendChild(name);
                if (typeof value === 'number' && value > 1) {
                    const badge = document.createElement('b');
                    badge.className = 'status-value';
                    badge.textContent = String(value);
                    chip.appendChild(badge);
                }
                fragment.appendChild(chip);
            });
            container.replaceChildren(fragment);
            if (changedIds && changedIds.size > 0) {
                container.querySelectorAll('.status-chip').forEach(chip => {
                    if (!changedIds.has(chip.dataset.statusId)) return;
                    animateOnce(chip, [
                        { transform: 'scale(0.92)', opacity: 0.65 },
                        { transform: 'scale(1.08)', opacity: 1 },
                        { transform: 'scale(1)', opacity: 1 }
                    ], { duration: 240, easing: 'ease-out' });
                });
            }
        },

        renderFieldBuffs(rpg, previousSignature) {
            const container = byId('field-buff-box');
            if (!container || !rpg.battle) return;
            const fragment = document.createDocumentFragment();
            (rpg.battle.fieldBuffs || []).forEach(buff => {
                const chip = document.createElement('span');
                chip.className = 'field-buff-chip';
                chip.dataset.buffId = buff.name;
                const name = (typeof BUFF_NAMES !== 'undefined' && BUFF_NAMES[buff.name]) || buff.name;
                const remaining = Number.isFinite(buff.expiresAtTurn)
                    ? Math.max(0, buff.expiresAtTurn - rpg.battle.turn)
                    : null;
                chip.textContent = remaining === null ? name : `${name} · ${remaining}`;
                fragment.appendChild(chip);
            });
            container.replaceChildren(fragment);
            const signature = JSON.stringify((rpg.battle.fieldBuffs || []).map(buff => [buff.name, buff.expiresAtTurn || null]));
            if (previousSignature && previousSignature !== signature) {
                animateOnce(container, [
                    { opacity: 0.55 },
                    { opacity: 1 }
                ], { duration: 180, easing: 'ease-out' });
            }
            return signature;
        },

        renderBattleParty(rpg) {
            const players = (rpg.battle && rpg.battle.players) || [];
            const roles = ['선봉', '중견', '대장'];
            roles.forEach((role, index) => {
                const slot = byId(`battle-party-slot-${index}`);
                if (!slot) return;
                const player = players[index];
                const label = slot.querySelector('span');
                slot.classList.toggle('current', !!player && index === rpg.battle.currentPlayerIdx && !player.isDead);
                slot.classList.toggle('dead', !!player && !!player.isDead);
                slot.classList.toggle('is-empty', !player);
                slot.dataset.fallback = player && player.name ? player.name.charAt(0) : '-';
                if (label) label.textContent = player ? player.name : role;
            });
        },

        renderBattleState(rpg) {
            if (!rpg || !rpg.battle) return;
            const battle = rpg.battle;
            const enemy = battle.enemy;
            const player = (battle.players || [])[battle.currentPlayerIdx];
            const identity = enemy ? `${integer(rpg.state.enemyScale)}:${enemy.id || enemy.name}` : null;
            if (identity !== this.state.battleIdentity) {
                this.state.battleIdentity = identity;
                this.state.previousBattle = null;
            }
            const previous = this.state.previousBattle;

            const stageText = byId('battle-stage-text');
            const turnText = byId('bt-turn');
            const modeText = byId('battle-mode-text');
            if (stageText) stageText.textContent = `Stage ${integer(rpg.state.enemyScale) + 1}`;
            if (turnText) turnText.textContent = integer(battle.turn);
            if (modeText) modeText.textContent = MODE_LABELS[rpg.state.mode] || rpg.state.mode || '오리진';

            const playerBox = byId('player-actor-box');
            const enemyBox = byId('enemy-actor-box');
            if (playerBox) {
                playerBox.classList.toggle('dead', !player || !!player.isDead);
                playerBox.style.opacity = player && !player.isDead ? '1' : '0.35';
                const portrait = playerBox.querySelector('.portrait');
                if (portrait) portrait.dataset.fallback = player && player.name ? player.name.charAt(0) : 'P';
            }
            if (enemyBox) {
                enemyBox.classList.toggle('dead', !!enemy && enemy.hp <= 0);
                const portrait = enemyBox.querySelector('.portrait');
                if (portrait) portrait.dataset.fallback = enemy && enemy.name ? enemy.name.charAt(0) : 'E';
            }

            const pMaxMp = player ? (player.maxMp || (typeof GAME_CONSTANTS !== 'undefined' ? GAME_CONSTANTS.MAX_MP : 100)) : 1;
            const values = [
                ['p-hp-bar', player && player.hp, player && player.maxHp],
                ['p-mp-bar', player && player.mp, pMaxMp],
                ['e-hp-bar', enemy && enemy.hp, enemy && enemy.maxHp]
            ];
            values.forEach(([id, value, max]) => {
                const bar = byId(id);
                if (bar) bar.style.setProperty('--bar-scale', String(clampRatio(value, max)));
            });
            const pHpText = byId('p-hp-text');
            const pMpText = byId('p-mp-text');
            const eHpText = byId('e-hp-text');
            if (pHpText) pHpText.textContent = player ? `${integer(player.hp)} / ${integer(player.maxHp)}` : '—';
            if (pMpText) pMpText.textContent = player ? `${integer(player.mp)} / ${integer(pMaxMp)}` : '—';
            if (eHpText) eHpText.textContent = enemy ? `${integer(enemy.hp)} / ${integer(enemy.maxHp)}` : '—';

            const currentPlayerBuffs = getBuffSnapshot(player && player.buffs);
            const currentEnemyBuffs = getBuffSnapshot(enemy && enemy.buffs);
            this.renderStatusChips(
                byId('p-buffs'),
                currentPlayerBuffs,
                changedBuffIds(previous && previous.playerBuffs, currentPlayerBuffs)
            );
            this.renderStatusChips(
                byId('e-buffs'),
                currentEnemyBuffs,
                changedBuffIds(previous && previous.enemyBuffs, currentEnemyBuffs)
            );
            const fieldSignature = this.renderFieldBuffs(rpg, previous && previous.fieldSignature);
            this.renderBattleParty(rpg);

            if (previous && player && previous.playerId === player.id) {
                if (integer(player.hp) > previous.playerHp) {
                    this.emit({ type: 'heal', target: 'player', amount: integer(player.hp) - previous.playerHp }, rpg);
                }
                if (integer(player.mp) !== previous.playerMp) {
                    animateOnce(byId('p-mp-bar'), [
                        { filter: 'brightness(1)' },
                        { filter: 'brightness(1.8)' },
                        { filter: 'brightness(1)' }
                    ], { duration: 220, easing: 'ease-out' });
                }
            }
            if (previous && enemy && previous.enemyId === enemy.id && integer(enemy.hp) > previous.enemyHp) {
                this.emit({ type: 'heal', target: 'enemy', amount: integer(enemy.hp) - previous.enemyHp }, rpg);
            }

            this.state.previousBattle = {
                playerId: player && player.id,
                playerHp: integer(player && player.hp),
                playerMp: integer(player && player.mp),
                enemyId: enemy && enemy.id,
                enemyHp: integer(enemy && enemy.hp),
                playerBuffs: currentPlayerBuffs,
                enemyBuffs: currentEnemyBuffs,
                fieldSignature
            };
        },

        renderControls(rpg, player) {
            const panel = byId('battle-controls');
            if (!panel || !player) return;
            panel.querySelectorAll('.skill-btn').forEach(button => {
                button.setAttribute('aria-disabled', button.disabled ? 'true' : 'false');
            });
        },

        onScreenChange(screenId) {
            const screen = byId(screenId);
            if (!screen) return;
            screen.classList.remove('ui-screen-enter');
            void screen.offsetWidth;
            screen.classList.add('ui-screen-enter');
            const rpg = this.state.rpg;
            if (screenId === 'screen-menu') this.renderHub(rpg);
            if (screenId === 'screen-battle' && rpg && rpg.battle && rpg.battle.enemy) this.renderBattleState(rpg);
        },

        applyLogState() {
            const shell = document.querySelector('.battle-log-shell');
            const toggle = byId('battle-log-toggle');
            if (!shell || !toggle) return;
            shell.classList.toggle('expanded', this.state.logExpanded);
            toggle.setAttribute('aria-expanded', this.state.logExpanded ? 'true' : 'false');
            toggle.textContent = this.state.logExpanded ? '전투 로그 접기' : '전투 로그 펼치기';
        },

        toggleBattleLog() {
            this.state.logExpanded = !this.state.logExpanded;
            this.applyLogState();
        },

        announce(text) {
            const node = byId('battle-announcer');
            if (!node) return;
            node.textContent = text;
            animateOnce(node, [
                { opacity: 0, transform: 'translate(-50%, -4px)' },
                { opacity: 1, transform: 'translate(-50%, 0)', offset: 0.25 },
                { opacity: 1, transform: 'translate(-50%, 0)', offset: 0.72 },
                { opacity: 0, transform: 'translate(-50%, -2px)' }
            ], { duration: 620, easing: 'ease-out' });
        },

        floatText(side, text, kind) {
            this.ensureEffectPools();
            const node = this.acquireNode(this.state.textPool);
            if (!node) return;
            const target = actorSide(side);
            node.className = `ui-fx-text ${kind || ''}`;
            node.textContent = text;
            node.style.display = 'block';
            node.style.left = target === 'enemy' ? '77%' : '23%';
            node.style.top = '36%';
            const scale = kind === 'critical' ? 1.25 : 1;
            animateOnce(node, [
                { opacity: 0, transform: `translate(-50%, 4px) scale(${scale * 0.9})` },
                { opacity: 1, transform: `translate(-50%, -3px) scale(${scale})`, offset: 0.2 },
                { opacity: 0, transform: `translate(-50%, -24px) scale(${scale})` }
            ], { duration: 620, easing: 'cubic-bezier(.2,.8,.2,1)' }, () => this.releaseNode(node));
        },

        strikeEffect(source, target, skillType) {
            const sourceNode = actorElement(source);
            const targetNode = actorElement(target);
            if (skillType === 'phy') {
                const direction = actorSide(source) === 'enemy' ? -8 : 8;
                animateOnce(sourceNode, [
                    { transform: 'translateX(0)' },
                    { transform: `translateX(${direction}px)` },
                    { transform: 'translateX(0)' }
                ], { duration: 250, easing: 'ease-out' });
                const slash = this.acquireNode(this.state.particlePool);
                if (slash) {
                    const targetPosition = actorSide(target) === 'enemy' ? 77 : 23;
                    slash.style.display = 'block';
                    slash.style.left = `${targetPosition}%`;
                    slash.style.top = '38%';
                    slash.style.width = '3px';
                    slash.style.height = '46px';
                    slash.style.background = 'var(--physical)';
                    animateOnce(slash, [
                        { opacity: 0, transform: 'rotate(42deg) scaleY(0.2)' },
                        { opacity: 1, transform: 'rotate(42deg) scaleY(1)', offset: 0.35 },
                        { opacity: 0, transform: 'rotate(42deg) scaleY(1)' }
                    ], { duration: 280, easing: 'ease-out' }, () => this.releaseNode(slash));
                }
            } else if (skillType === 'mag') {
                animateOnce(sourceNode, [
                    { filter: 'brightness(1)', transform: 'scale(1)' },
                    { filter: 'brightness(1.55)', transform: 'scale(1.035)' },
                    { filter: 'brightness(1)', transform: 'scale(1)' }
                ], { duration: 340, easing: 'ease-out' });
                animateOnce(targetNode, [
                    { boxShadow: '0 0 0 rgba(114,184,255,0)' },
                    { boxShadow: '0 0 24px rgba(114,184,255,.55)' },
                    { boxShadow: '0 0 0 rgba(114,184,255,0)' }
                ], { duration: 340, easing: 'ease-out' });
            } else {
                animateOnce(sourceNode, [
                    { boxShadow: 'inset 0 0 0 rgba(112,224,176,0)' },
                    { boxShadow: 'inset 0 0 18px rgba(112,224,176,.42)' },
                    { boxShadow: 'inset 0 0 0 rgba(112,224,176,0)' }
                ], { duration: 320, easing: 'ease-out' });
            }
        },

        emit(event, rpg) {
            try {
                if (!event || !event.type) return;
                switch (event.type) {
                    case 'battle-start':
                        this.state.previousBattle = null;
                        this.state.battleIdentity = null;
                        this.ensureEffectPools();
                        this.announce('BATTLE START');
                        break;
                    case 'turn-start':
                        this.announce(`TURN ${integer(event.turn)}`);
                        break;
                    case 'skill-cast':
                        this.strikeEffect(event.source, event.target, event.skillType);
                        break;
                    case 'damage': {
                        const target = actorElement(event.target);
                        animateOnce(target, [
                            { transform: 'translateX(0)', filter: 'brightness(1)' },
                            { transform: 'translateX(-5px)', filter: 'brightness(1.55)' },
                            { transform: 'translateX(5px)', filter: 'brightness(1.15)' },
                            { transform: 'translateX(0)', filter: 'brightness(1)' }
                        ], { duration: 250, easing: 'ease-out' });
                        this.floatText(event.target, `-${integer(event.amount)}`, event.critical ? 'critical' : 'damage');
                        if (event.critical) this.announce('CRITICAL');
                        break;
                    }
                    case 'heal':
                        this.floatText(event.target || event.source, `+${integer(event.amount)}`, 'heal');
                        animateOnce(byId(actorSide(event.target || event.source) === 'enemy' ? 'e-hp-bar' : 'p-hp-bar'), [
                            { filter: 'brightness(1)' },
                            { filter: 'brightness(1.8)' },
                            { filter: 'brightness(1)' }
                        ], { duration: 260, easing: 'ease-out' });
                        break;
                    case 'evade':
                        animateOnce(actorElement(event.target), [
                            { transform: 'translateX(0)', opacity: 1 },
                            { transform: 'translateX(10px)', opacity: 0.48 },
                            { transform: 'translateX(0)', opacity: 1 }
                        ], { duration: 260, easing: 'ease-out' });
                        this.floatText(event.target, 'EVADE', 'evade');
                        break;
                    case 'guard':
                    case 'block':
                        animateOnce(actorElement(event.target), [
                            { boxShadow: '0 0 0 0 rgba(111,216,255,0)' },
                            { boxShadow: '0 0 0 9px rgba(111,216,255,.32)' },
                            { boxShadow: '0 0 0 14px rgba(111,216,255,0)' }
                        ], { duration: 300, easing: 'ease-out' });
                        this.floatText(event.target, event.type.toUpperCase(), event.type);
                        break;
                    case 'field-buff-add':
                    case 'field-buff-refresh':
                        this.announce('FIELD EFFECT');
                        break;
                    case 'actor-death':
                        if (actorElement(event.target)) actorElement(event.target).classList.add('dead');
                        this.announce('KNOCK OUT');
                        break;
                    case 'battle-end':
                        this.celebrate(event.result === 'win' ? 'win' : 'lose');
                        break;
                    default:
                        break;
                }
            } catch (error) {
                console.warn('[CardUI] event rendering failed:', error);
            }
        },

        syncBattleState(rpg) {
            this.renderBattleState(rpg || this.state.rpg);
        },

        celebrate(kind) {
            this.ensureEffectPools();
            const stage = document.querySelector('.visual-stage');
            if (kind !== 'win') {
                animateOnce(stage, [
                    { filter: 'saturate(1) brightness(1)' },
                    { filter: 'saturate(.35) brightness(.62)' },
                    { filter: 'saturate(1) brightness(1)' }
                ], { duration: 250, easing: 'ease-out' });
                return;
            }

            this.state.particlePool.forEach((particle, index) => {
                const position = PARTICLE_POSITIONS[index];
                particle.dataset.active = 'true';
                particle.style.display = 'block';
                particle.style.left = `${position[0]}%`;
                particle.style.top = `${position[1]}%`;
                particle.style.color = index % 3 === 0 ? 'var(--cyan)' : 'var(--gold)';
                particle.style.background = 'currentColor';
                animateOnce(particle, [
                    { opacity: 0, transform: 'translateY(8px) scaleY(.4)' },
                    { opacity: 1, transform: 'translateY(-5px) scaleY(1)', offset: 0.3 },
                    { opacity: 0, transform: 'translateY(-30px) scaleY(.65)' }
                ], { duration: 520 + (index % 4) * 45, easing: 'ease-out' }, () => this.releaseNode(particle));
            });
            this.announce('VICTORY');
        }
    };

    window.CardUI = CardUI;
}());
