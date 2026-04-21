/**
 * battle_runtime.js — Non-visual battle runtime for Card RPG.
 *
 * Keeps battle state transitions and skill/effect resolution outside index.html
 * while preserving the existing RPG method names and DOM entrypoints.
 */

function getStackCap(rpg, buffId) {
    if (buffId === 'burn') return rpg.hasArtifact('over_flame') ? 5 : 3;
    if (buffId === 'divine') return rpg.hasArtifact('over_divine') ? 5 : 3;
    return null;
}

function applyStackMap(rpg, target, buffMap) {
    if (!target || !target.buffs || !buffMap) return;

    Object.keys(buffMap).forEach(buffId => {
        const cap = getStackCap(rpg, buffId);
        const nextValue = (target.buffs[buffId] || 0) + buffMap[buffId];

        if (cap === null) {
            // Non-stack debuffs/buffs are represented as presence flags.
            target.buffs[buffId] = buffMap[buffId] > 0 ? 1 : 0;
            if (target.buffs[buffId] <= 0) delete target.buffs[buffId];
            return;
        }

        target.buffs[buffId] = Math.min(nextValue, cap);
    });
}

function applyQueuedAction(rpg, target, action) {
    if (!action || !target) return;

    switch (action.kind) {
        case 'clear_field_buffs':
            rpg.battle.fieldBuffs = [];
            break;
        case 'remove_target_stack': {
            const nextValue = (target.buffs[action.id] || 0) - (action.count || 0);
            if (nextValue > 0) target.buffs[action.id] = nextValue;
            else delete target.buffs[action.id];
            break;
        }
        case 'add_target_buff': {
            const value = action.value || 1;
            const stackCap = getStackCap(rpg, action.id);
            if (stackCap === null) {
                target.buffs[action.id] = value > 0 ? 1 : 0;
                if (target.buffs[action.id] <= 0) delete target.buffs[action.id];
            } else {
                target.buffs[action.id] = Math.min((target.buffs[action.id] || 0) + value, stackCap);
            }
            break;
        }
        case 'remove_field_buff_by_name': {
            const idx = rpg.battle.fieldBuffs.findIndex(buff => buff.name === action.id);
            if (idx !== -1) rpg.battle.fieldBuffs.splice(idx, 1);
            break;
        }
        case 'remove_first_field_buff':
            if (rpg.battle.fieldBuffs.length > 0) rpg.battle.fieldBuffs.shift();
            break;
        default:
            break;
    }

    if (action.log) rpg.log(action.log);
}

const TURN_BUFF_IDS = ['evasion', 'barrier', 'magic_guard', 'guard'];

function tickTurnBuffs(target, buffIds = TURN_BUFF_IDS) {
    if (!target || !target.buffs) return;

    buffIds.forEach(buffId => {
        const duration = target.buffs[buffId];
        if (!duration) return;

        if (duration > 1) target.buffs[buffId] = duration - 1;
        else delete target.buffs[buffId];
    });
}

function buildBattleEnemy(rpg) {
    const baseEnemy = rpg.getCurrentStageEnemyData
        ? rpg.getCurrentStageEnemyData()
        : ENEMIES[rpg.state.enemyScale % ENEMIES.length];
    const cycleLength = (typeof ENDLESS_ENEMY_ROTATION !== 'undefined' && ENDLESS_ENEMY_ROTATION.length)
        ? ENDLESS_ENEMY_ROTATION.length
        : ENEMIES.length;
    const cycle = Math.floor(rpg.state.enemyScale / cycleLength);
    let scale = 1.0 + (cycle * 0.2);
    if (rpg.state.mode === 'puzzle') {
        scale += (GAME_CONSTANTS.PUZZLE && GAME_CONSTANTS.PUZZLE.ENEMY_SCALE_BONUS) || 0.2;
    } else if ((rpg.state.gameType === 'challenge' || rpg.state.gameType === 'endless') && ['artifact', 'flood', 'curse'].includes(rpg.state.mode)) {
        scale = scale * 1.1;
    }
    const suppressBossRewards = rpg.state.mode === 'puzzle';
    const enemy = {
        id: baseEnemy.id,
        name: baseEnemy.name,
        maxHp: Math.floor(baseEnemy.stats.hp * scale),
        hp: Math.floor(baseEnemy.stats.hp * scale),
        atk: Math.floor(baseEnemy.stats.atk * scale),
        matk: Math.floor(baseEnemy.stats.matk * scale),
        baseAtk: Math.floor(baseEnemy.stats.atk * scale),
        baseMatk: Math.floor(baseEnemy.stats.matk * scale),
        def: Math.floor(baseEnemy.stats.def * scale),
        mdef: Math.floor(baseEnemy.stats.mdef * scale),
        baseDef: Math.floor(baseEnemy.stats.def * scale),
        baseMdef: Math.floor(baseEnemy.stats.mdef * scale),
        skills: baseEnemy.skills,
        buffs: {},
        element: baseEnemy.element,
        tookDamageThisTurn: false,
        lastHitType: null,
        isHiddenBoss: !!baseEnemy.hiddenBossFor,
        bonusRewardTickets: !suppressBossRewards && baseEnemy.hiddenBossFor ? 3 : 0,
        bonusTranscendenceReward: suppressBossRewards ? null : (baseEnemy.bonusTranscendenceReward || null)
    };

    if (baseEnemy.id === 'creator_god') {
        enemy.chargeTurn = 0;
    }

    return enemy;
}

function buildBattlePlayer(rpg, cardId, idx, allCards) {
    if (!cardId) return null;

    const proto = rpg.getCardData(cardId);
    const init = Logic.calculateInitialStats(proto, rpg.state.deck, allCards, idx);

    if (init.activeTrait) {
        rpg.battle.activeTraits.push(init.activeTrait);
        rpg.log(`[시너지] ${proto.trait.desc} 발동!`);
    }
    if (proto.trait.type === 'instant_delayed_skills') {
        rpg.battle.activeTraits.push(proto.trait.type);
    }

    const player = {
        id: proto.id,
        proto: proto,
        name: proto.name,
        ...init.stats,
        buffs: {},
        pos: idx,
        isDead: false,
        skills: JSON.parse(JSON.stringify(proto.skills))
    };

    const blessing = (rpg.state.chaosBuffs || []).find(buff => buff.id === player.id);
    if (blessing) {
        player.baseStatsWithoutBlessing = {
            atk: player.atk,
            matk: player.matk,
            def: player.def,
            mdef: player.mdef
        };

        player.maxHp = Math.floor(player.maxHp * (1 + blessing.multiplier));
        player.hp = player.maxHp;
        player.blessing = blessing;

        const mult = 1.0 + blessing.multiplier;
        player.atk = Math.floor(player.atk * mult);
        player.matk = Math.floor(player.matk * mult);
        player.def = Math.floor(player.def * mult);
        player.mdef = Math.floor(player.mdef * mult);
    }

    if (proto.trait.type.startsWith('pos_')) {
        const trait = proto.trait;
        const active =
            (trait.type.includes('van') && idx === 0) ||
            (trait.type.includes('mid') && idx === 1) ||
            (trait.type.includes('rear') && idx === 2);
        if (active) {
            if (trait.type.includes('_atk')) player.atk = Math.floor(player.atk * (1 + trait.val / 100));
            if (trait.type.includes('_matk')) player.matk = Math.floor(player.matk * (1 + trait.val / 100));
            if (trait.type.includes('_def')) player.def = Math.floor(player.def * (1 + trait.val / 100));
            if (trait.type.includes('_mdef')) player.mdef = Math.floor(player.mdef * (1 + trait.val / 100));
        }
    }

    return player;
}

const BattleRuntime = {
    startBattleInit(rpg) {
        if (rpg.state.mode === 'puzzle') {
            if (!rpg.state.puzzlePiecesClaimed) {
                return rpg.showAlert("퍼즐 모드는 먼저 퍼즐조각획득을 완료해야 합니다.");
            }
            if (rpg.state.deck.some(cardId => cardId === null)) {
                return rpg.showAlert("퍼즐 모드는 덱 3장을 모두 채워야 전투에 입장할 수 있습니다.");
            }
        }

        if (rpg.state.deck.every(cardId => cardId === null)) {
            return rpg.showAlert("덱을 완성해주세요.");
        }

        rpg.showBattleScreen();
        rpg.battle.enemy = buildBattleEnemy(rpg);
        rpg.battle.activeTraits = [];

        const allCards = GameUtils.getAllCards();
        rpg.battle.players = rpg.state.deck.map((cardId, idx) => buildBattlePlayer(rpg, cardId, idx, allCards));
        const hasAttackSwap = rpg.battle.players.some(player => player && player.proto && player.proto.trait.type === 'reverse_atk_matk_party');
        const normalAttackTrait = rpg.battle.players.find(player => player && player.proto && player.proto.trait.type === 'party_normal_attack_dmg');
        if (hasAttackSwap || normalAttackTrait) {
            rpg.battle.players.forEach(player => {
                if (!player) return;
                if (hasAttackSwap) player.swapAtkMatk = true;
                if (normalAttackTrait) player.normalAttackPartyMult = normalAttackTrait.proto.trait.val || 1.0;
            });
        }
        rpg.battle.fieldBuffs = [];
        rpg.battle.delayedEffects = [];
        rpg.battle.turn = 1;
        rpg.battle.currentPlayerIdx = 0;
        rpg.battle.isNewTurn = true;

        while (
            rpg.battle.currentPlayerIdx < GAME_CONSTANTS.DECK_SIZE &&
            rpg.battle.players[rpg.battle.currentPlayerIdx] === null
        ) {
            rpg.battle.currentPlayerIdx++;
        }

        rpg.clearBattleLog();
        rpg.log(`전투 개시! 적: ${rpg.battle.enemy.name}`);
        if (rpg.battle.activeTraits.includes('instant_delayed_skills')) {
            rpg.log('[특성] 시간의마술사: 덱의 지연 스킬이 즉시 발동합니다!');
        }

        if (rpg.hasArtifact('gale_storm')) {
            BattleRuntime.applyFieldBuff(rpg, 'gale', {
                expiresAtTurn: 4,
                expireLog: '[아티팩트] 질풍노도 효과 종료. (질풍 제거)'
            });
            rpg.log('[아티팩트] 질풍노도: 전투 시작 시 질풍 발동!');
        }

        if (rpg.hasArtifact('support_boost')) {
            rpg.battle.players.forEach(player => {
                if (!player || !player.skills) return;
                player.skills.forEach(skill => {
                    if (skill.type === 'sup') skill.cost = 0;
                });
            });
            rpg.log('[아티팩트] 서포트부스트: 모든 보조스킬 마나 소비 0!');
        }

        rpg.renderBattleView();
        BattleRuntime.TurnManager.startPlayerTurn(rpg);
    },

    TurnManager: {
        startPlayerTurn(rpg) {
            const battle = rpg.battle;
            if (battle.currentPlayerIdx >= GAME_CONSTANTS.DECK_SIZE) {
                rpg.loseBattle();
                return;
            }

            if (battle.isNewTurn) {
                battle.isNewTurn = false;
                rpg.log(`=== ${battle.turn}턴 ===`, 'info');
                BattleRuntime.expireFieldBuffs(rpg, battle.turn);

                if (rpg.hasArtifact('kaleidoscope')) {
                    const count = battle.fieldBuffs.length;
                    if (count > 0) {
                        battle.fieldBuffs = [];
                        rpg.log('[아티팩트] 만화경: 필드 버프 재구성!');

                        const allBuffs = Object.keys(GAME_CONSTANTS.FIELD_BUFF_STATS)
                            .filter(buffId => buffId !== 'destiny_oath');
                        const pool = [...allBuffs].sort(() => 0.5 - Math.random());
                        const picks = pool.slice(0, Math.min(count, pool.length));
                        picks.forEach(buffId => BattleRuntime.applyFieldBuff(rpg, buffId));
                    }
                }

                if (battle.enemy && battle.enemy.id === 'demon_god') {
                    battle.enemy.def = battle.enemy.baseDef;
                    battle.enemy.mdef = battle.enemy.baseMdef;
                    if (battle.turn % 2 === 0) {
                        battle.enemy.def = Math.floor(battle.enemy.def * 1.5);
                        rpg.log("마신의 권능: 짝수 턴 물리방어력 50% 증가.");
                    } else {
                        battle.enemy.mdef = Math.floor(battle.enemy.mdef * 1.5);
                        rpg.log("마신의 권능: 홀수 턴 마법방어력 50% 증가.");
                    }
                }
            }

            if (battle.enemy) battle.enemy.lastHitType = null;

            const player = battle.players[battle.currentPlayerIdx];
            if (!player || player.isDead) {
                battle.currentPlayerIdx++;
                BattleRuntime.TurnManager.startPlayerTurn(rpg);
                return;
            }

            const dueEffects = battle.delayedEffects.filter(effect => effect.turn === battle.turn);
            if (dueEffects.length > 0) {
                battle.delayedEffects = battle.delayedEffects.filter(effect => effect.turn !== battle.turn);
                for (const effect of dueEffects) {
                    if (effect.source.isDead) {
                        rpg.log(`${effect.skill.name} 발동 실패... (시전자 사망)`);
                        continue;
                    }

                    rpg.log(effect.announce || `${effect.skill.name} 발동!`);
                    BattleRuntime.executeSkill(rpg, effect.source, battle.enemy, effect.skill, true);
                    if (battle.enemy && battle.enemy.hp <= 0) return;
                }
            }

            tickTurnBuffs(player);

            rpg.renderBattleView();

            if (player.buffs.stun) {
                rpg.log(`${player.name} 기절로 인해 행동 불가.`);
                delete player.buffs.stun;
                BattleRuntime.TurnManager.endPlayerTurn(rpg);
                return;
            }

            rpg.renderBattleControls(player);
        },

        endPlayerTurn(rpg) {
            setTimeout(() => BattleRuntime.TurnManager.startEnemyTurn(rpg), 500);
        },

        startEnemyTurn(rpg) {
            const battle = rpg.battle;
            const enemy = battle.enemy;
            if (enemy.hp <= 0) {
                rpg.winBattle();
                return;
            }

            rpg.log("--- 적 턴 ---");
            enemy.def = enemy.baseDef;
            enemy.mdef = enemy.baseMdef;
            tickTurnBuffs(enemy);

            if (enemy.id === 'artificial_demon_god') {
                delete enemy.buffs.defProtocolPhy;
                delete enemy.buffs.defProtocolMag;
                if (enemy.lastHitType === 'phy') {
                    enemy.buffs.defProtocolPhy = 1;
                    rpg.log("방어 프로토콜: 물리 피격 감지 (다음 턴 물리방어력 증가).");
                }
                if (enemy.lastHitType === 'mag') {
                    enemy.buffs.defProtocolMag = 1;
                    rpg.log("방어 프로토콜: 마법 피격 감지 (다음 턴 마법방어력 증가).");
                }
                if (enemy.buffs.defProtocolPhy) enemy.def = Math.floor(enemy.def * 1.5);
                if (enemy.buffs.defProtocolMag) enemy.mdef = Math.floor(enemy.mdef * 1.5);
            }
            if (enemy.id === 'demon_god') {
                if (battle.turn % 2 === 0) enemy.def = Math.floor(enemy.def * 1.5);
                else enemy.mdef = Math.floor(enemy.mdef * 1.5);
            }

            if (enemy.buffs.stun) {
                rpg.log(`${enemy.name} 기절하여 행동 불가.`);
                delete enemy.buffs.stun;
                BattleRuntime.TurnManager.endEnemyTurn(rpg);
                return;
            }

            let target = battle.players[battle.currentPlayerIdx];
            if (!target || target.isDead) {
                const validIdx = battle.players.findIndex(player => player && !player.isDead);
                if (validIdx === -1) {
                    rpg.loseBattle();
                    return;
                }
                battle.currentPlayerIdx = validIdx;
                target = battle.players[validIdx];
            }

            const skillInfo = Logic.decideEnemyAction(enemy, battle.turn);

            if (skillInfo.chargeReset) {
                enemy.isCharging = false;
                enemy.chargeSkillId = null;
            }
            if (skillInfo.isChargeStart) {
                enemy.isCharging = true;
                rpg.log(skillInfo.chargeMessage || "창조신이 힘을 모으고 있습니다... (공격 없음)");
                BattleRuntime.TurnManager.endEnemyTurn(rpg);
                return;
            }

            const skill = skillInfo;
            if (skill.type !== 'phy' && skill.type !== 'mag') {
                rpg.log(`${enemy.name}・・${skill.name}!`);
                BattleRuntime.applySkillEffects(rpg, enemy, target, skill);
                BattleRuntime.TurnManager.endEnemyTurn(rpg);
                return;
            }
            let val = skill.type === 'phy' ? enemy.atk : enemy.matk;
            let mult = skill.val || 1.0;

            if (enemy.id === 'pharaoh' && skill.name === '고대의저주' && enemy.tookDamageThisTurn) {
                mult = 3.0;
                rpg.log("고대의 저주: 턴 내 피격 감지! 대미지 3배로 반격!");
            }

            if (enemy.buffs.weak && skill.type === 'phy') val *= 0.8;
            if (enemy.buffs.silence && skill.type === 'mag') val *= 0.8;

            const tgtStats = Logic.calculateStats(
                target,
                battle.fieldBuffs,
                rpg.state.mode,
                rpg.state.artifacts || [],
                battle.turn
            );
            const def = skill.type === 'phy' ? tgtStats.def : tgtStats.mdef;

            if (Logic.checkEvasion(target, skill.type, battle.fieldBuffs, rpg.state.mode, rpg.state.artifacts || [], battle.turn)) {
                rpg.log(`${target.name} 회피 성공! (${skill.name} 회피)`);
                if (rpg.hasArtifact('lucky_vicky')) {
                    target.mp = Math.min(GAME_CONSTANTS.MAX_MP, target.mp + 10);
                    rpg.log('[아티팩트] 럭키비키: 회피 성공! 마나 10 회복!');
                }
                if (target.proto && target.proto.trait && target.proto.trait.type === 'on_evasion_stun') {
                    enemy.buffs.stun = 1;
                    rpg.log(`[특성] ${target.name}: 회피 반격! 적에게 [기절] 부여.`);
                }
                BattleRuntime.TurnManager.endEnemyTurn(rpg);
                return;
            }
            if (target.buffs.barrier && skill.type === 'phy') {
                rpg.log(`${target.name} 배리어로 방어!`);
                BattleRuntime.TurnManager.endEnemyTurn(rpg);
                return;
            }
            if (target.buffs.magic_guard && skill.type === 'mag') {
                rpg.log(`${target.name} 매직가드로 방어!`);
                BattleRuntime.TurnManager.endEnemyTurn(rpg);
                return;
            }

            const guardSucceeded = !!target.buffs.guard;
            let dmg = val * mult * (100 / (100 + def));
            if (guardSucceeded) {
                dmg *= 0.5;
                rpg.log(`${target.name} 가드 성공! 피해 반감.`);
            }
            dmg = Math.floor(dmg);
            target.hp -= dmg;
            if (dmg > 0) {
                target.tookDamageThisTurn = true;
                BattleRuntime.handleOnHitTraits(rpg, target, enemy);
            }
            rpg.log(`${enemy.name}의 ${skill.name}! <span class="log-dmg">${dmg}</span> 피해.`);
            BattleRuntime.applySkillEffects(rpg, enemy, target, skill);

            if (skill.effects) {
                skill.effects.forEach(effect => {
                    if (effect.type === 'mana_burn') {
                        target.mp = 0;
                        rpg.log("플레이어 마나 소멸!");
                    }
                });
            }

            if (target.hp <= 0) {
                target.isDead = true;
                target.hp = 0;
                rpg.log(`${target.name} 쓰러짐!`);
                BattleRuntime.handleDeathTraits(rpg, target, enemy);

                battle.currentPlayerIdx++;
                while (battle.currentPlayerIdx < GAME_CONSTANTS.DECK_SIZE) {
                    const nextPlayer = battle.players[battle.currentPlayerIdx];
                    if (nextPlayer && !nextPlayer.isDead) break;
                    battle.currentPlayerIdx++;
                }
                if (battle.currentPlayerIdx >= GAME_CONSTANTS.DECK_SIZE && battle.players.every(player => !player || player.isDead)) {
                    rpg.loseBattle();
                    return;
                }
            } else if (
                guardSucceeded &&
                target.proto &&
                target.proto.trait &&
                target.proto.trait.type === 'guard_stun_double_dmg' &&
                !enemy.buffs.stun
            ) {
                enemy.buffs.stun = 1;
                rpg.log(`[특성] ${target.name}: 가드 성공! 적에게 [기절] 부여.`);
            }

            if (enemy.hp <= 0) rpg.winBattle();
            else BattleRuntime.TurnManager.endEnemyTurn(rpg);
        },

        endEnemyTurn(rpg) {
            rpg.battle.turn++;
            rpg.battle.enemy.tookDamageThisTurn = false;
            rpg.battle.isNewTurn = true;
            BattleRuntime.TurnManager.startPlayerTurn(rpg);
        }
    },

    handleDeathTraits(rpg, victim, killer) {
        const result = Logic.handleDeathTraits(
            victim,
            killer,
            rpg.battle.fieldBuffs,
            msg => rpg.log(msg),
            rpg.state.deck,
            rpg.battle.turn,
            rpg.state.artifacts || []
        );

        if (result.damageToKiller > 0 && killer) {
            killer.hp -= result.damageToKiller;
            killer.tookDamageThisTurn = true;
        }

        if (result.fieldBuffsToAdd && result.fieldBuffsToAdd.length > 0) {
            result.fieldBuffsToAdd.forEach(buffId => BattleRuntime.applyFieldBuff(rpg, buffId));
        }

        applyStackMap(rpg, killer, result.killerDebuffs);
    },

    handleOnHitTraits(rpg, victim, attacker) {
        const result = Logic.handleOnHitTraits(
            victim,
            attacker,
            msg => rpg.log(msg)
        );

        applyStackMap(rpg, attacker, result.attackerDebuffs);
    },

    maybeTriggerDeathRoulette(rpg, source, skill, isDelayed = false) {
        if (!rpg.hasArtifact('death_roulette') || isDelayed || skill.name === rpg.NORMAL_ATTACK.name) {
            return false;
        }
        if (Math.random() >= 0.3) return false;

        source.hp = 0;
        rpg.log('<span style="color:#ff5252">[아티팩트] 데스룰렛: 죽음의 룰렛에 당첨...</span>');
        return true;
    },

    resolveSourceDeath(rpg, source, target) {
        if (source.hp > 0 || source.isDead) return;

        source.isDead = true;
        rpg.log(`${source.name} 사망!`);
        BattleRuntime.handleDeathTraits(rpg, source, target);
    },

    hasActiveTrait(rpg, id) {
        return (rpg.battle.activeTraits || []).includes(id);
    },

    executeSkill(rpg, source, target, skill, isDelayed = false) {
        if (!isDelayed && !skill.isDelayed) {
            if (rpg.hasArtifact('blue_moon') && Math.random() < 0.3) {
                rpg.log('[아티팩트] 블루문: 마나 소비 없이 스킬 사용!');
            } else {
                source.mp -= skill.cost;
            }
        }

        let modifiedSkill = skill;
        if (rpg.hasArtifact('double_attack') && skill.name === rpg.NORMAL_ATTACK.name) {
            modifiedSkill = { ...skill, val: (skill.val || 1.0) * 2.0 };
        }

        rpg.log(`<b>${source.name}</b>의 <b>${skill.name}</b>!`);

        if (skill.name === rpg.NORMAL_ATTACK.name && source.proto && source.proto.trait && source.proto.trait.type === 'normal_attack_burn_divine') {
            const burnAdd = rpg.hasArtifact('over_flame') ? 2 : 1;
            const divineAdd = rpg.hasArtifact('over_divine') ? 2 : 1;
            target.buffs.burn = Math.min((target.buffs.burn || 0) + burnAdd, getStackCap(rpg, 'burn'));
            target.buffs.divine = Math.min((target.buffs.divine || 0) + divineAdd, getStackCap(rpg, 'divine'));
            rpg.log("[특성] 일반 공격 추가 효과: 작열, 디바인 부여!");
        }

        if (
            skill.name === rpg.NORMAL_ATTACK.name &&
            source.proto &&
            source.proto.trait &&
            source.proto.trait.type === 'cure_master_trait' &&
            Math.random() < ((source.proto.trait.val || 0) / 100)
        ) {
            target.buffs.stun = 1;
            rpg.log("[특성] 큐어마스터: 마법 구슬이 반응해 적에게 [기절] 부여!");
        }

        if (
            skill.name === rpg.NORMAL_ATTACK.name &&
            source.proto &&
            source.proto.trait &&
            source.proto.trait.type === 'syn_fire_3_crit_burn'
        ) {
            const burnAdd = rpg.hasArtifact('over_flame') ? 2 : 1;
            target.buffs.burn = Math.min((target.buffs.burn || 0) + burnAdd, getStackCap(rpg, 'burn'));
            rpg.log("[특성] 피닉스: 일반 공격 시 작열 부여!");
        }

        if (source.proto && source.proto.trait && source.proto.trait.type === 'behemoth_trait' && Math.random() < 0.2) {
            target.buffs.stun = 1;
            rpg.log("[특성] 베히모스의 위압감! 적을 기절시킵니다!");
        }

        if (source.proto && source.proto.trait && source.proto.trait.type === 'behemoth_liberated_trait' && Math.random() < 0.2) {
            target.buffs.stun = 1;
            rpg.log("[특성] 해방된 베히모스: 20% 확률로 적을 기절시킵니다!");
        }

        const delayedEff = typeof findDelayedSkillEffect === 'function'
            ? findDelayedSkillEffect(modifiedSkill)
            : null;

        if (delayedEff && !isDelayed) {
            const resolvedDelayedSkill = typeof buildResolvedDelayedSkill === 'function'
                ? buildResolvedDelayedSkill(modifiedSkill, delayedEff, rpg.battle.turn)
                : modifiedSkill;

            if (delayedEff.type === 'phantom_nightmare') {
                const nightmareTurns = Array.isArray(delayedEff.turns)
                    ? delayedEff.turns
                    : [1, 2, 3, 4, 5];
                const nightmareMessages = Array.isArray(delayedEff.messages) && delayedEff.messages.length === nightmareTurns.length
                    ? delayedEff.messages
                    : [
                        '첫번째 악몽이 시작된다.',
                        '두번째 악몽이 시작된다.',
                        '세번째 악몽이 시작된다.',
                        '네번째 악몽이 시작된다.',
                        '마지막 악몽이 시작된다.'
                    ];

                if (BattleRuntime.hasActiveTrait(rpg, 'instant_delayed_skills')) {
                    rpg.log('[특성] 시간의마술사: 지연 스킬 즉시 발동!');
                    nightmareMessages.forEach(message => {
                        if (target.hp <= 0 || source.isDead) return;
                        rpg.log(message);
                        BattleRuntime.executeSkill(rpg, source, target, resolvedDelayedSkill, true);
                    });
                    BattleRuntime.maybeTriggerDeathRoulette(rpg, source, modifiedSkill, isDelayed);
                    BattleRuntime.resolveSourceDeath(rpg, source, target);
                    if (target.hp <= 0) {
                        rpg.winBattle();
                        return;
                    }
                    BattleRuntime.TurnManager.endPlayerTurn(rpg);
                    return;
                }

                nightmareTurns.forEach((turns, index) => {
                    rpg.battle.delayedEffects.push({
                        turn: rpg.battle.turn + turns,
                        source: source,
                        skill: resolvedDelayedSkill,
                        announce: nightmareMessages[index] || `${resolvedDelayedSkill.name} 발동!`
                    });
                });
                rpg.log(`${skill.name} 준비... (1~5턴 뒤 연속 발동)`);
                BattleRuntime.maybeTriggerDeathRoulette(rpg, source, modifiedSkill, isDelayed);
                BattleRuntime.resolveSourceDeath(rpg, source, target);
                if (target.hp <= 0) {
                    rpg.winBattle();
                    return;
                }
                BattleRuntime.TurnManager.endPlayerTurn(rpg);
                return;
            }

            if (BattleRuntime.hasActiveTrait(rpg, 'instant_delayed_skills')) {
                rpg.log('[특성] 시간의마술사: 지연 스킬 즉시 발동!');
                modifiedSkill = resolvedDelayedSkill;
            } else {
                rpg.log(`${skill.name} 준비... (${delayedEff.turns}턴 뒤 발동)`);
                rpg.battle.delayedEffects.push({
                    turn: rpg.battle.turn + delayedEff.turns,
                    source: source,
                    skill: resolvedDelayedSkill
                });
                BattleRuntime.maybeTriggerDeathRoulette(rpg, source, modifiedSkill, isDelayed);
                BattleRuntime.resolveSourceDeath(rpg, source, target);
                if (target.hp <= 0) {
                    rpg.winBattle();
                    return;
                }
                BattleRuntime.TurnManager.endPlayerTurn(rpg);
                return;
            }
        }

        const dmgResult = BattleRuntime.calcDamage(rpg, source, target, modifiedSkill);

        if (dmgResult.dmg > 0) {
            target.hp -= dmgResult.dmg;
            target.tookDamageThisTurn = true;
            rpg.log(`${dmgResult.isCrit ? 'Critical! ' : ''}적에게 <span class="log-dmg">${dmgResult.dmg}</span> 피해.`);
        }

        if (dmgResult.luckyVicky) {
            source.mp = Math.min(GAME_CONSTANTS.MAX_MP, source.mp + 10);
            rpg.log('[아티팩트] 럭키비키: 치명타 발생! 마나 10 회복!');
        }

        BattleRuntime.applyQueuedStateChanges(rpg, target, dmgResult.postActions);
        BattleRuntime.applySkillEffects(rpg, source, target, modifiedSkill);
        if (dmgResult.dmg > 0) {
            BattleRuntime.handleOnHitTraits(rpg, target, source);
        }
        BattleRuntime.maybeTriggerDeathRoulette(rpg, source, modifiedSkill, isDelayed);
        BattleRuntime.resolveSourceDeath(rpg, source, target);

        if (target.hp <= 0) {
            rpg.winBattle();
            return;
        }

        if (!isDelayed) BattleRuntime.TurnManager.endPlayerTurn(rpg);
    },

    calcDamage(rpg, source, target, skill) {
        if (skill.type !== 'phy' && skill.type !== 'mag') return { dmg: 0 };

        const result = Logic.calculateDamage(
            source,
            target,
            skill,
            rpg.battle.fieldBuffs,
            rpg.battle.activeTraits,
            msg => rpg.log(msg),
            rpg.state.mode,
            rpg.state.deck,
            rpg.battle.turn,
            rpg.state.artifacts || []
        );

        if (target.id === 'demon_god') {
            const battle = rpg.battle;
            if ((battle.turn % 2 === 0 && skill.type === 'phy') || (battle.turn % 2 !== 0 && skill.type === 'mag')) {
                rpg.log("(마신의 권능: 방어력 상승 적용중)");
            }
        }

        target.lastHitType = skill.type;

        return result;
    },

    applyQueuedStateChanges(rpg, target, actions) {
        if (!Array.isArray(actions) || actions.length === 0) return;
        actions.forEach(action => applyQueuedAction(rpg, target, action));
    },

    applySkillEffects(rpg, source, target, skill) {
        if (!skill.effects) return;

        const ctx = {
            source: source,
            target: target,
            skill: skill,
            activeTraits: rpg.battle.activeTraits,
            logFn: msg => rpg.log(msg),
            getBuffName: id => (BUFF_NAMES[id] || id),
            applyFieldBuff: (id, options) => BattleRuntime.applyFieldBuff(rpg, id, options),
            battle: rpg.battle,
            executeSkill: (nextSource, nextTarget, nextSkill, delayed) =>
                BattleRuntime.executeSkill(rpg, nextSource, nextTarget, nextSkill, delayed),
            getCardData: id => rpg.getCardData(id)
        };

        skill.effects.forEach(effect => {
            if (typeof SideEffects !== 'undefined') {
                SideEffects.apply(ctx, effect);
            }
        });

        if (rpg.battle.activeTraits.includes('syn_water_nature') && skill.name === '문라이트세레나') {
            rpg.log("루미의 특성 발동! 트윙클파티 추가!");
            BattleRuntime.applyFieldBuff(rpg, 'twinkle_party');
        }

        if (rpg.battle.activeTraits.includes('syn_water_2_moon_twinkle') && skill.name === '실버문베일') {
            rpg.log("[특성] 세이렌의 노래! 트윙클파티 추가!");
            BattleRuntime.applyFieldBuff(rpg, 'twinkle_party');
        }
    },

    expireFieldBuffs(rpg, turn) {
        const expiredBuffs = rpg.battle.fieldBuffs.filter(buff => buff.expiresAtTurn && buff.expiresAtTurn <= turn);
        if (expiredBuffs.length === 0) return;

        rpg.battle.fieldBuffs = rpg.battle.fieldBuffs.filter(buff => !(buff.expiresAtTurn && buff.expiresAtTurn <= turn));
        expiredBuffs.forEach(buff => {
            rpg.log(buff.expireLog || `필드버프 [${BUFF_NAMES[buff.name]}] 소멸.`);
        });
    },

    applyFieldBuff(rpg, id, options = {}) {
        if (rpg.battle.fieldBuffs.some(buff => buff.name === id)) {
            return rpg.log(`필드버프 [${BUFF_NAMES[id]}] 이미 존재.`);
        }

        const maxBuffs = rpg.hasArtifact('buff_overload') ? 5 : GAME_CONSTANTS.MAX_FIELD_BUFFS;
        if (rpg.battle.fieldBuffs.length >= maxBuffs) {
            const removed = rpg.battle.fieldBuffs.shift();
            rpg.log(`필드버프 [${BUFF_NAMES[removed.name]}] 소멸.`);
        }

        rpg.battle.fieldBuffs.push({ name: id, ...options });
        rpg.log(`필드버프 [${BUFF_NAMES[id]}] 발동!`);
    }
};
