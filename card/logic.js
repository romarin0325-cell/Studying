
const FIELD_BUFF_STATS = {
    'sun_bless': { atk: 0.3, matk: 0.3 },
    'moon_bless': { matk: 0.3, evasion: 15 },
    'sanctuary': { matk: 0.3, mdef: 0.3 },
    'goddess_descent': { atk: 0.3, matk: 0.3, def: 0.3, mdef: 0.3 },
    'earth_bless': { atk: 0.25, matk: 0.25 },
    'twinkle_party': { atk: 0.2, crit: 15 },
    'star_powder': { def: 0.4, mdef: 0.4 },
    'reaper_realm': { crit: 40 }
};

// Helper for Buff Names (Moved out to be accessible)
function getBuffName(key) {
    if (typeof BUFF_NAMES !== 'undefined') {
        return BUFF_NAMES[key] || key;
    }
    return key;
}

const DAMAGE_EFFECT_HANDLERS = {
    'consume_field_all': (ctx, eff) => {
        let c = ctx.fieldBuffs.length;
        if(c > 0) {
            ctx.mult += (c * eff.multPerStack);
            ctx.fieldBuffs.length = 0;
            ctx.logFn(`필드 버프 ${c}개 제거! 위력 폭발!`);
        }
    },
    'consume_debuff_all': (ctx, eff) => {
        if(ctx.target.buffs[eff.debuff]) {
            let c = ctx.target.buffs[eff.debuff];
            ctx.mult += (c * eff.multPerStack);
            delete ctx.target.buffs[eff.debuff];
            ctx.logFn(`${getBuffName(eff.debuff)} ${c}스택 소모!`);
        }
    },
    'dmg_boost': (ctx, eff) => {
        let matched = false;
        if(eff.condition === 'target_debuff' && ctx.target.buffs[eff.debuff]) {
            ctx.mult *= eff.mult;
            matched = true;
            if(!eff.customLog) ctx.logFn(`[특성] ${getBuffName(eff.debuff)} 대상 추가 피해! (배율 x${eff.mult})`);
        }
        else if(eff.condition === 'synergy_active' && ctx.activeTraits.includes(eff.trait)) {
            ctx.mult *= eff.mult;
            matched = true;
            if(!eff.customLog) ctx.logFn(`[시너지] 조건 만족! 위력 ${eff.mult}배 증가!`);
        }
        else if(eff.condition === 'target_stack' && ctx.target.buffs[eff.debuff]) {
             ctx.mult += (ctx.target.buffs[eff.debuff] * eff.multPerStack);
        }
        else if(eff.condition === 'target_debuff_count_scale') {
             let bonus = (Object.keys(ctx.target.buffs).length * eff.multPerDebuff);
             ctx.mult += bonus;
             if(bonus > 0 && !eff.customLog) ctx.logFn(`[특성] 디버프 대상 추가 피해! (배율 +${bonus.toFixed(1)})`);
        }
        else if(eff.condition === 'hp_below' && (ctx.source.hp/ctx.source.maxHp) <= eff.val) {
             ctx.mult *= eff.mult;
             matched = true;
             if(!eff.customLog && ctx.skill.name === '라그나로크') ctx.logFn("라그나로크: 생명력 조건 만족! 대미지 증가!");
        }
        else if(eff.condition === 'target_hp_below' && (ctx.target.hp / ctx.target.maxHp) <= eff.val) {
             ctx.mult *= eff.mult;
             matched = true;
             if(!eff.customLog) ctx.logFn(`[약점 포착] 적 체력 ${eff.val*100}% 이하! 위력 증가!`);
        }
        else if(eff.condition === 'hp_full' && ctx.source.hp === ctx.source.maxHp) {
             ctx.mult *= eff.mult;
             matched = true;
             if(eff.log) ctx.logFn(eff.log);
        }
        else if(eff.condition === 'field_buff' && ctx.fieldBuffs.some(b=>b.name === eff.buff)) {
             ctx.mult *= eff.mult;
             matched = true;
        }

        if(matched && eff.customLog) {
            ctx.logFn(eff.customLog);
        }
    },
    'consume_debuff_fixed': (ctx, eff) => {
         const debuff = eff.debuff;
         const count = eff.count || 1;
         if((ctx.target.buffs[debuff] || 0) >= count) {
             ctx.target.buffs[debuff] -= count;
             if(ctx.target.buffs[debuff] <= 0) delete ctx.target.buffs[debuff];
             ctx.mult *= eff.mult;

             if(eff.customLog) ctx.logFn(eff.customLog);
             else ctx.logFn(`${getBuffName(debuff)} ${count}스택 소모! 위력 ${eff.mult}배!`);
         }
    },
    'consume_divine_add_darkness': (ctx, eff) => {
         if((ctx.target.buffs['divine'] || 0) >= 1) {
             ctx.target.buffs['divine']--;
             if(ctx.target.buffs['divine'] <= 0) delete ctx.target.buffs['divine'];
             ctx.target.buffs['darkness'] = 1;
             ctx.logFn("신성력을 오염시켜 암흑을 부여합니다!");
         } else {
             ctx.logFn("소모할 디바인이 없어 효과가 발동하지 않았습니다.");
         }
    },
    'remove_field_buff_dmg': (ctx, eff) => {
         if(ctx.fieldBuffs.length > 0) {
             const rm = ctx.fieldBuffs.shift();
             ctx.mult *= eff.mult;
             ctx.logFn(`필드버프 [${getBuffName(rm.name)}] 제거! 대미지 ${eff.mult}배!`);
         }
    },
    'cond_target_debuff_3_dmg': (ctx, eff) => {
         if(Object.keys(ctx.target.buffs).length >= 3) {
             ctx.mult *= eff.mult;
             ctx.logFn("적 디버프 3개 이상! 위력 2배!");
         }
    },
    'random_mult': (ctx, eff) => {
        let max = eff.max;
        if(ctx.activeTraits.includes('syn_water_3_ice_age')) max = 10.0;
        ctx.mult = eff.min + Math.floor(Math.random() * (max - eff.min + 1));
        ctx.logFn(`무작위 위력! x${ctx.mult.toFixed(1)}`);
    },
    'random_mult_moon_boost': (ctx, eff) => {
         let min = eff.min;
         let max = eff.max;
         if (ctx.fieldBuffs.some(b => b.name === 'moon_bless')) {
             max = eff.boostMax;
             ctx.logFn("달의 축복으로 최대 배율 증가!");
         }
         ctx.mult = min + Math.floor(Math.random() * (max - min + 1));
         ctx.logFn(`무작위 위력! x${ctx.mult.toFixed(1)}`);
    },
    'delayed_random_attack': (ctx, eff) => {
         ctx.mult = eff.min + Math.floor(Math.random() * (eff.max - eff.min + 1));
         ctx.logFn(`무작위 위력! x${ctx.mult.toFixed(1)}`);
    },
    'field_buff_combo_dmg': (ctx, eff) => {
        let buffs = ctx.fieldBuffs.map(b => b.name);
        let hasSun = buffs.includes('sun_bless');
        let hasMoon = buffs.includes('moon_bless');

        if(hasSun) {
            let count = ctx.fieldBuffs.length;
            ctx.mult += count * 1.0;
            ctx.logFn(`태양의 축복: 필드버프 ${count}개! 배율 +${count.toFixed(1)}`);
        }
        if(hasMoon) {
            ctx.ignoreMdefRate = (ctx.ignoreMdefRate || 0) + 0.2;
            ctx.logFn("달의 축복: 마법방어력 20% 관통!");
        }
    },
    'count_deck_attr_dmg': (ctx, eff) => {
         // Need access to deck or active traits to count attributes?
         // Logic.calculateDamage receives activeTraits.
         // But deck content isn't directly passed.
         // However, `ctx.activeTraits` contains synergy strings, not deck info.
         // Logic.calculateDamage is called with `activeTraits`.
         // We might need to pass `deck` to calculateDamage or check `source.proto.element` etc.
         // Workaround: We can't easily count deck attributes inside Logic without deck data.
         // BUT, we can pass the count as a param when calling calculateDamage?
         // OR, we assume `activeTraits` or `fieldBuffs` implies something? No.
         // We should update `Logic.calculateDamage` to accept `deck` or `attrCount`.
         // OR, for now, use a hack: Look at `activeTraits` if it has specific markers? No.
         // Best approach: Add `deck` to the `calculateDamage` signature in the next step,
         // or handle this in index.html and pass the multiplier?
         // Index.html `calcDamage` calls `Logic.calculateDamage`.
         // I will update `Logic` to accept `deck` in the next step.
         // For now, I'll write the handler assuming `ctx.deck` exists.
         if(ctx.deck) {
             const cards = ctx.deck.map(id => id ? (CARDS.find(c=>c.id===id)||BONUS_CARDS.find(c=>c.id===id)||TRANSCENDENCE_CARDS.find(c=>c.id===id)) : null).filter(c=>c);
             let attrs = new Set();
             let hasJoker = false;
             cards.forEach(c => {
                 if(c.id === 'joker') hasJoker = true;
                 else attrs.add(c.element);
             });
             let count = hasJoker ? 5 : attrs.size;
             ctx.mult += count * 1.0;
             ctx.logFn(`덱 속성 ${count}종! 위력 +${count.toFixed(1)}배!`);
         }
    },
    'turn_modulo_dmg': (ctx, eff) => {
         // Need current turn. ctx does not have turn.
         // Add turn to ctx in calculateDamage.
         if(ctx.turn && ctx.turn % eff.mod === 0) {
             ctx.mult *= eff.mult;
             ctx.logFn(`4의 배수 턴(${ctx.turn})! 위력 ${eff.mult}배!`);
         }
    },
    'dmg_boost_turn_scale': (ctx, eff) => {
        if(ctx.turn) {
            let bonus = ctx.turn * eff.scale;
            ctx.mult += bonus;
            ctx.logFn(`인과역전: ${ctx.turn}턴 경과! 배율 +${bonus.toFixed(1)}`);
        }
    }
};

const SideEffects = {
    handlers: {
        'buff': (ctx, eff) => {
            ctx.source.buffs[eff.id] = (eff.duration || 1);
        },
        'debuff': (ctx, eff) => {
            let t = ctx.target;
            if(eff.stack) {
                t.buffs[eff.id] = (t.buffs[eff.id] || 0) + 1;
                if(t.buffs[eff.id] > 3) t.buffs[eff.id] = 3;
                ctx.logFn(`${t === ctx.source ? '자신' : '적'}에게 [${getBuffName(eff.id)}] ${t.buffs[eff.id]}스택.`);
            } else {
                t.buffs[eff.id] = 1;
                ctx.logFn(`${t === ctx.source ? '자신' : '적'}에게 [${getBuffName(eff.id)}] 부여.`);
            }
        },
        'self_debuff': (ctx, eff) => {
            let s = ctx.source;
            if(eff.stack) {
                s.buffs[eff.id] = (s.buffs[eff.id] || 0) + 1;
                if(s.buffs[eff.id] > 3) s.buffs[eff.id] = 3;
                ctx.logFn(`자신에게 [${getBuffName(eff.id)}] ${s.buffs[eff.id]}스택.`);
            } else {
                s.buffs[eff.id] = 1;
                ctx.logFn(`자신에게 [${getBuffName(eff.id)}] 부여.`);
            }
        },
        'field_buff': (ctx, eff) => {
            ctx.applyFieldBuff(eff.id);
        },
        'conditional_field_buff': (ctx, eff) => {
            if(eff.condition === 'target_has_debuff' && ctx.target.buffs[eff.debuff]) ctx.applyFieldBuff(eff.id);
        },
        'random_debuff': (ctx, eff) => {
            let pool = [...eff.pool].sort(() => 0.5 - Math.random());
            for(let i=0; i<eff.count; i++) {
                if(pool[i]) {
                     ctx.target.buffs[pool[i]] = 1;
                     ctx.logFn(`적에게 [${getBuffName(pool[i])}] 부여.`);
                }
            }
        },
        'conditional_debuff': (ctx, eff) => {
            if(eff.condition === 'target_debuff_count' && Object.keys(ctx.target.buffs).length >= eff.count) {
                ctx.target.buffs[eff.debuff] = 1;
                ctx.logFn(`조건 만족! 적에게 [${getBuffName(eff.debuff)}] 부여.`);
            }
        },
        'suicide': (ctx, eff) => {
            ctx.source.hp = 0;
        },
        'chance_debuff': (ctx, eff) => {
            if(Math.random() < eff.chance) {
                ctx.target.buffs[eff.id] = eff.duration || 1;
                ctx.logFn(`<b>성공!</b> ${ctx.target === ctx.source ? '자신' : '적'}에게 [${getBuffName(eff.id)}] 부여.`);
            } else {
                ctx.logFn(`[${getBuffName(eff.id)}] 부여 <b>실패</b>.`);
            }
        },
        'conditional_field_debuff': (ctx, eff) => {
             if(ctx.battle.fieldBuffs.some(b => b.name === eff.field)) {
                 eff.debuffs.forEach(d => {
                     ctx.target.buffs[d] = 1;
                     ctx.logFn(`조건 만족! [${getBuffName(d)}] 부여.`);
                 });
             }
        },
        'clear_target_debuffs': (ctx, eff) => {
             const count = Object.keys(ctx.target.buffs).length;
             ctx.target.buffs = {};
             if(count > 0) ctx.logFn(`적의 모든 디버프를 제거했습니다! (${count}개)`);
        },
        'consume_all_burn_cond_buff': (ctx, eff) => {
             if(ctx.target.buffs['burn']) {
                 delete ctx.target.buffs['burn'];
                 ctx.applyFieldBuff('sun_bless');
                 ctx.logFn("작열 스택을 모두 소모하여 태양의 축복을 불러옵니다!");
             } else {
                 ctx.applyFieldBuff('earth_bless');
                 ctx.logFn("소모할 작열이 없어 대지의 축복을 불러옵니다.");
             }
        },
        'check_divine_3_stun_else_add': (ctx, eff) => {
             if((ctx.target.buffs['divine'] || 0) >= 3) {
                 ctx.target.buffs['stun'] = 1;
                 ctx.logFn("디바인 3스택 확인! 적을 기절시킵니다!");
             } else {
                 ctx.target.buffs['divine'] = (ctx.target.buffs['divine'] || 0) + 1;
                 if(ctx.target.buffs['divine'] > 3) ctx.target.buffs['divine'] = 3;
                 ctx.logFn("디바인 스택 추가.");
             }
        },
        'random_debuff_consume_divine': (ctx, eff) => {
            let pool = ['curse', 'darkness', 'silence', 'weak', 'corrosion'];
            let count = 1;
            if(ctx.target.buffs['divine'] > 0) {
                ctx.target.buffs['divine']--;
                if(ctx.target.buffs['divine'] <= 0) delete ctx.target.buffs['divine'];
                count = 2;
                ctx.logFn("디바인을 소모하여 효과 강화! (디버프 2개 부여)");
            }

            pool.sort(() => 0.5 - Math.random());
            for(let i=0; i<count; i++) {
                ctx.target.buffs[pool[i]] = 1;
                ctx.logFn(`적에게 [${getBuffName(pool[i])}] 부여.`);
            }
        },
        'roulette_field': (ctx, eff) => {
             ctx.battle.fieldBuffs = [];
             ctx.logFn("모든 필드 버프가 제거되었습니다!");

             const buffs = ['sun_bless', 'moon_bless', 'sanctuary', 'goddess_descent', 'earth_bless', 'twinkle_party', 'star_powder'];
             const pick = buffs[Math.floor(Math.random() * buffs.length)];
             ctx.applyFieldBuff(pick);
        },
        'wild_card_debuff': (ctx, eff) => {
             const badBuffs = ['curse', 'darkness', 'silence', 'weak', 'corrosion', 'burn', 'divine', 'stun'];
             let cleansed = 0;
             badBuffs.forEach(b => {
                 if(ctx.target.buffs[b]) {
                     delete ctx.target.buffs[b];
                     cleansed++;
                 }
             });
             if(cleansed > 0) ctx.logFn(`적의 디버프를 모두 해제했습니다! (${cleansed}개)`);

             let pool = ['curse', 'darkness', 'silence', 'weak', 'corrosion', 'burn', 'divine'];
             pool.sort(() => 0.5 - Math.random());

             for(let i=0; i<2; i++) {
                 if(pool[i] === 'burn' || pool[i] === 'divine') {
                     ctx.target.buffs[pool[i]] = (ctx.target.buffs[pool[i]] || 0) + 1;
                     if(ctx.target.buffs[pool[i]] > 3) ctx.target.buffs[pool[i]] = 3;
                     ctx.logFn(`적에게 [${getBuffName(pool[i])}] 스택 추가.`);
                 } else {
                     ctx.target.buffs[pool[i]] = 1;
                     ctx.logFn(`적에게 [${getBuffName(pool[i])}] 부여.`);
                 }
             }
        },
        'delayed_attack_field': (ctx, eff) => {
            if (eff.field) ctx.applyFieldBuff(eff.field);
        },
        'delayed_turn_scale_attack': (ctx, eff) => {
            ctx.battle.delayedEffects.push({
                turn: ctx.battle.turn + eff.turns,
                source: ctx.source,
                skill: { ...ctx.skill, effects: [...(ctx.skill.effects||[]), {type: 'dmg_boost_turn_scale', scale: eff.scale, startTurn: ctx.battle.turn}] }
            });
            ctx.logFn(`인과역전! ${eff.turns}턴 후 발동합니다!`);
        },
        'delayed_attack_debuff_scale': (ctx, eff) => {
            ctx.battle.delayedEffects.push({
                turn: ctx.battle.turn + eff.turns,
                source: ctx.source,
                skill: { ...ctx.skill, effects: [...(ctx.skill.effects||[]), {type: 'dmg_boost', condition: 'target_debuff_count_scale', multPerDebuff: eff.multPerDebuff}] }
            });
            ctx.logFn(`제로그라비티! ${eff.turns}턴 후 발동합니다!`);
        },
        'random_skill_trigger_from_list': (ctx, eff) => {
            const skillMap = [
                { id: 'gold_dragon', skill: '얼티밋브레스' },
                { id: 'zeke', skill: '라그나로크' },
                { id: 'jasmine', skill: '여신강림' },
                { id: 'frozen_witch', skill: '블리자드' },
                { id: 'behemoth', skill: '어스퀘이크' },
                { id: 'gray', skill: '차원절단' },
                { id: 'rumi', skill: '밀키웨이엑스터시' },
                { id: 'phoenix', skill: '메테오임팩트' },
                { id: 'time_ruler', skill: '섀도우트위스트' }
            ];

            const pick = skillMap[Math.floor(Math.random() * skillMap.length)];
            const card = ctx.getCardData(pick.id);
            if(!card) return;
            const skill = card.skills.find(s => s.name === pick.skill);

            if (skill) {
                ctx.logFn(`[데스티니룰렛] ${card.name}의 ${skill.name} 발동!`);
                ctx.executeSkill(ctx.source, ctx.target, skill, true);
            }
        },
        'apply_lumi_guard': (ctx, eff) => {
            let buffs = ctx.battle.fieldBuffs.map(b => b.name);
            if(buffs.includes('star_powder')) {
                ctx.source.buffs['guard'] = 1;
                ctx.logFn("스타파우더: 가드 효과(버프) 적용!");
            }
        },
        'random_field_buff_lumi': (ctx, eff) => {
            const buffs = ['sun_bless', 'moon_bless', 'star_powder'];
            const pick = buffs[Math.floor(Math.random() * buffs.length)];
            ctx.applyFieldBuff(pick);
            ctx.logFn(`코스믹 하모니: [${getBuffName(pick)}] 생성!`);
        }
    },
    apply: function(ctx, eff) {
        const handler = this.handlers[eff.type];
        if (handler) handler(ctx, eff);
    }
};

const Logic = {
    // 1. Stats Calculation
    calculateStats: function(char, fieldBuffs, mode) {
        // Base stats
        let stats = {
            atk: char.atk,
            matk: char.matk,
            def: char.def,
            mdef: char.mdef,
            crit: (char.baseCrit || 10),
            evasion: (char.baseEva || 0) + 5
        };

        // Blessings
        if (char.blessing) {
            stats.crit += 10;
            stats.evasion += 5;
        }

        // Check if character is Player (has proto)
        const isPlayer = !!char.proto;

        // Traits
        const trait = char.proto ? char.proto.trait : null;
        if (trait) {
            if (trait.type === 'cond_no_field_buff_eva_crit' && fieldBuffs.length === 0) {
                stats.evasion += trait.val;
                stats.crit += trait.val;
            }
            if (trait.type === 'luna_jasmine_trait' && fieldBuffs.some(b => b.name === 'goddess_descent')) {
                 stats.evasion += 25;
                 stats.crit += 25;
            }
        }

        // Multipliers
        let m = { atk: 1.0, matk: 1.0, def: 1.0, mdef: 1.0 };

        // Handle Mushroom King here properly
        if(trait && trait.type === 'cond_earth_def_mdef' && fieldBuffs.some(b => b.name === 'earth_bless')) {
            m.def += 0.5;
            m.mdef += 0.5;
        }

        // Field Buffs (Only apply to Allies)
        if (isPlayer) {
            let buffMult = (mode === 'flood') ? 2.0 : 1.0;
            fieldBuffs.forEach(fb => {
                const bonus = FIELD_BUFF_STATS[fb.name];
                if(bonus) {
                    if(bonus.atk) m.atk += (bonus.atk * buffMult);
                    if(bonus.matk) m.matk += (bonus.matk * buffMult);
                    if(bonus.def) m.def += (bonus.def * buffMult);
                    if(bonus.mdef) m.mdef += (bonus.mdef * buffMult);
                    if(bonus.crit) stats.crit += (bonus.crit * buffMult);
                    if(bonus.evasion) stats.evasion += (bonus.evasion * buffMult);
                }
            });
        }

        // Trait Multipliers
        if (trait) {
             if (trait.type === 'cond_twinkle_all' && fieldBuffs.some(b => b.name === 'twinkle_party')) {
                 m.atk += 0.3; m.matk += 0.3;
             }
        }

        // Char Buffs/Debuffs
        let debuffMult = (mode === 'curse') ? 2.0 : 1.0;

        if (char.buffs['weak']) m.atk -= (0.2 * debuffMult);
        if (char.buffs['silence']) m.matk -= (0.2 * debuffMult);
        if (char.buffs['evasion']) stats.evasion += 50;
        if (char.buffs['curse']) m.mdef -= (0.2 * debuffMult);

        let defRed = 0.0;
        if (char.buffs['darkness'] && char.buffs['corrosion']) defRed = 0.4;
        else if (char.buffs['darkness'] || char.buffs['corrosion']) defRed = 0.2;
        m.def -= (defRed * debuffMult);

        // Apply Multipliers
        stats.atk = Math.floor(stats.atk * Math.max(0, m.atk));
        stats.matk = Math.floor(stats.matk * Math.max(0, m.matk));
        stats.def = Math.floor(stats.def * Math.max(0, m.def));
        stats.mdef = Math.floor(stats.mdef * Math.max(0, m.mdef));

        return stats;
    },

    // 2. Evasion Check
    checkEvasion: function(target, skillType, fieldBuffs, mode) {
        const stats = this.calculateStats(target, fieldBuffs, mode);
        return Math.random() * 100 < stats.evasion;
    },

    // 3. Damage Calculation
    calculateDamage: function(source, target, skill, fieldBuffs, activeTraits, logFn, mode, deck, turn) {
        if (!logFn) logFn = function() {};

        if(skill.type !== 'phy' && skill.type !== 'mag') return { dmg: 0, isCrit: false };

        const srcStats = this.calculateStats(source, fieldBuffs, mode);
        const tgtStats = this.calculateStats(target, fieldBuffs, mode);

        // 1. Critical
        let isCrit = Math.random() * 100 < srcStats.crit;
        if (skill.effects && skill.effects.some(e => e.type === 'force_crit')) isCrit = true;
        // Check force_crit_chance
        const forceCritChance = skill.effects ? skill.effects.find(e => e.type === 'force_crit_chance') : null;
        if (forceCritChance && Math.random() * 100 < forceCritChance.val) isCrit = true;

        let critDmg = 1.5;
        if (source.proto && fieldBuffs.some(b => b.name === 'sun_bless')) critDmg += 0.6;
        if (source.proto && fieldBuffs.some(b => b.name === 'reaper_realm')) critDmg += 0.4;

        let val = (skill.type === 'phy') ? srcStats.atk : srcStats.matk;
        if (isCrit) val *= critDmg;

        // 2. Skill Multiplier & Bonuses

        // Context for Handlers
        let ctx = {
            source: source,
            target: target,
            skill: skill,
            fieldBuffs: fieldBuffs, // handlers may modify this array
            activeTraits: activeTraits,
            logFn: logFn,
            mode: mode,
            deck: deck,
            turn: turn,
            mult: skill.val || 1.0,
            ignoreMdefRate: 0
        };

        // Elemental
        if (source.proto && source.proto.element && target.element) {
             let elMult = this.getElementalMultiplier(source.proto.element, target.element);
             if (source.proto.trait && source.proto.trait.type === 'all_advantage') elMult = 1.2;

             if (elMult > 1.0) {
                 val *= elMult;
                 logFn("상성 우위! 대미지 20% 증가.");
             }
        }

        // Skill Effects affecting Multiplier
        if(skill.effects) {
            skill.effects.forEach(eff => {
                const handler = DAMAGE_EFFECT_HANDLERS[eff.type];
                if (handler) {
                    handler(ctx, eff);
                } else {
                    // Fallback for types not in DAMAGE_EFFECT_HANDLERS (side effects)
                    // Do nothing here, handled in RPG.applySkillEffects
                }
            });
        }

        let mult = ctx.mult;
        let dmgBonus = 0.0;

        // Trait Multipliers
        const t = source.proto ? source.proto.trait : null;
        if (t) {
            if(t.type === 'cond_darkness_dmg' && target.buffs.darkness) {
                dmgBonus += (t.val - 1.0);
                logFn(`[특성] 타천사: 암흑 속에서 힘이 솟구칩니다!`);
            }
            if(t.type === 'cond_silence_dmg' && target.buffs.silence) {
                dmgBonus += (t.val - 1.0);
                logFn(`[특성] ${source.name}: 침묵 대상 추가 피해!`);
            }
            if(t.type === 'cond_corrosion_dmg' && target.buffs.corrosion) {
                dmgBonus += (t.val - 1.0);
                logFn(`[특성] ${source.name}: 부식 대상 추가 피해!`);
            }
            if(t.type === 'cond_debuff_3_dmg' && Object.keys(target.buffs).length >= 3) {
                dmgBonus += (t.val - 1.0);
                logFn("[특성] 디버프 3개 이상 대상 추가 피해!");
            }
            if(t.type === 'cond_divine_3_dmg' && (target.buffs.divine || 0) >= 3) {
                dmgBonus += (t.val - 1.0);
                logFn("[특성] 디바인 3스택 이상 대상 추가 피해!");
            }
            if(t.type === 'behemoth_trait' && Object.keys(target.buffs).length >= 3) {
                dmgBonus += (t.val - 1.0);
                logFn("[특성] 베히모스: 디버프 3개 이상 대상 파괴적 일격!");
            }
            if(t.type === 'cond_target_debuff_3_dmg' && Object.keys(target.buffs).length >= 3) {
                dmgBonus += (t.val - 1.0);
                logFn("[특성] 심해의 주인: 적 디버프 3개 이상! 위력 폭발!");
            }
            if(t.type === 'luna_jasmine_trait' && (target.buffs['divine'] || 0) >= 3) {
                dmgBonus += (t.val - 1.0);
                logFn("[특성] 루나&자스민: 디바인 3스택 이상! 위력 2배!");
            }
            if(t.type === 'behemoth_liberated_trait' && Object.keys(target.buffs).length >= 3) {
                dmgBonus += (t.val - 1.0);
                logFn("[특성] 해방된 베히모스: 디버프 3개 이상! 파괴적 일격!");
            }
        }

        // Defense
        let def = (skill.type === 'phy') ? tgtStats.def : tgtStats.mdef;

        if (ctx.ignoreMdefRate > 0 && skill.type === 'mag') {
             let ignore = Math.floor(tgtStats.mdef * ctx.ignoreMdefRate);
             def = Math.max(0, def - ignore);
             logFn(`[효과] 마법방어력 ${Math.round(ctx.ignoreMdefRate*100)}% 관통!`);
        }

        // [추가] 신데렐라: 스택 비례 방어 무시
        if (t && t.type === 'ignore_def_mdef_by_stack') {
            let ignoreRate = 0;
            if (skill.type === 'phy' && target.buffs['burn']) {
                ignoreRate = target.buffs['burn'] * t.val;
                logFn(`[특성] 유리구두: 작열 ${target.buffs['burn']}스택! 방어력 ${Math.round(ignoreRate*100)}% 무시!`);
            }
            else if (skill.type === 'mag' && target.buffs['divine']) {
                ignoreRate = target.buffs['divine'] * t.val;
                logFn(`[특성] 유리구두: 디바인 ${target.buffs['divine']}스택! 마법방어력 ${Math.round(ignoreRate*100)}% 무시!`);
            }

            if (ignoreRate > 0) {
                let baseDef = (skill.type === 'phy') ? target.def : target.mdef;
                def = Math.max(0, def - Math.floor(baseDef * ignoreRate));
            }
        }

        // Gray Trait: Ignore Def
        if (t && t.type === 'crit_ignore_def_add' && isCrit) {
            let ignore = t.val;
            let baseDef = (skill.type === 'phy') ? target.def : target.mdef;
            def = Math.max(0, def - Math.floor(baseDef * ignore));
            logFn("[특성] 치명타! 적 방어력 50% 추가 무시!");
        }

        // [초월 루미: 꿈의형태 리워크 로직]
        if (skill.name === '꿈의형태' && fieldBuffs.length > 0) {
            let logMsg = [];

            // 1. 효과 적립
            fieldBuffs.forEach(b => {
                switch (b.name) {
                    case 'sun_bless': // 태양: 2배율 + 확정 치명타
                        mult += 2.0;
                        isCrit = true;
                        logMsg.push("태양(2.0배/치명)");
                        break;
                    case 'moon_bless': // 달: 마방 30% 관통
                        {
                            let ignore = Math.floor(tgtStats.mdef * 0.3);
                            def = Math.max(0, def - ignore);
                            logMsg.push(`달(관통 ${ignore})`);
                        }
                        break;
                    case 'star_powder': // 스타파우더: 마나 30 회복
                        source.mp = Math.min(100, source.mp + 30);
                        logMsg.push("스타(MP+30)");
                        break;
                    case 'earth_bless': // 대지: 2배율 + 체력 풀회복
                        mult += 2.0;
                        source.hp = source.maxHp;
                        logMsg.push("대지(2.0배/완전회복)");
                        break;
                    case 'sanctuary': // 성역: 2배율 + 마나 20 회복
                        mult += 2.0;
                        source.mp = Math.min(100, source.mp + 20);
                        logMsg.push("성역(2.0배/MP+20)");
                        break;
                    case 'goddess_descent': // 여신강림: 4배율 + 스턴
                        mult += 4.0;
                        target.buffs['stun'] = 1;
                        logMsg.push("여신(4.0배/기절)");
                        break;
                    case 'reaper_realm': // 사신강림: 마방 50% 관통
                        {
                            let ignore = Math.floor(tgtStats.mdef * 0.5);
                            def = Math.max(0, def - ignore);
                            logMsg.push(`사신(관통 ${ignore})`);
                        }
                        break;
                    case 'twinkle_party': // 트윙클: 3배율
                        mult += 3.0;
                        logMsg.push("트윙클(3.0배)");
                        break;
                }
            });

            // 2. 로그 출력 및 버프 소모
            logFn(`[꿈의형태] 필드 버프 ${fieldBuffs.length}개 융합! (${logMsg.join(', ')})`);
            fieldBuffs.length = 0; // 모든 필드 버프 제거 (Array Clear)
        }

        // Final Calculation
        let finalMult = mult * (1.0 + dmgBonus);
        let finalDmg = Math.floor(val * finalMult * (100 / (100 + def)));

        return { dmg: finalDmg, isCrit: isCrit };
    },

    // 4. Initial Stats Calculation
    calculateInitialStats: function(playerProto, deck, allCards, idx) {
        // Base stats copy
        let p = {
            maxHp: playerProto.stats.hp, hp: playerProto.stats.hp, mp: 100,
            atk: playerProto.stats.atk, matk: playerProto.stats.matk,
            def: playerProto.stats.def, mdef: playerProto.stats.mdef,
            baseCrit: 10, baseEva: 0
        };

        // Filter active cards
        const activeCards = deck.map(id => id ? allCards.find(c => c.id === id) : null).filter(c => c);
        const jokerInDeck = deck.includes('joker');

        const countEl = (el) => activeCards.filter(c => c.element === el || c.id === 'joker').length;
        const hasEl = (el) => activeCards.some(c => c.element === el || c.id === 'joker');

        // Traits
        const t = playerProto.trait;
        let active = false;

        // Synergy Traits
        if(t.type.startsWith('syn_')) {
             if(t.type === 'syn_nature_3_all' && countEl('nature') >= 3) active = true;
             else if(t.type === 'syn_nature_3_golem' && countEl('nature') >= 3) active = true;
             else if(t.type === 'syn_water_3_ice_age' && countEl('water') >= 3) active = true;
             else if(t.type === 'syn_fire_3_crit' && countEl('fire') >= 3) active = true;
             else if(t.type === 'syn_dark_3_matk' && countEl('dark') >= 3) active = true;
             else if(t.type === 'syn_light_fire_atk' && hasEl('light') && hasEl('fire')) active = true;
             else if(t.type === 'syn_light_dark_matk_mdef' && hasEl('light') && hasEl('dark')) active = true;
             else if(t.type === 'syn_water_nature' && hasEl('water') && hasEl('nature')) active = true;
             else if(t.type === 'syn_nature_3_matk' && countEl('nature') >= 3) active = true;
             else if(t.type === 'syn_night_rabbit' && (deck.includes('night_rabbit') || deck.includes('silver_rabbit') || jokerInDeck)) active = true;
             else if(t.type === 'syn_snow_rabbit' && (deck.includes('snow_rabbit') || deck.includes('silver_rabbit') || jokerInDeck)) active = true;
             else if(t.type === 'syn_silver_rabbit' && (deck.includes('snow_rabbit') || deck.includes('night_rabbit') || jokerInDeck)) active = true;
             else if(t.type === 'syn_water_3_atk_matk' && countEl('water') >= 3) active = true;
             else if(t.type === 'syn_fire_3_crit_burn' && countEl('fire') >= 3) active = true;
             else if(t.type === 'syn_dark_3_matk_boost' && countEl('dark') >= 3) active = true;
             else if(t.type === 'syn_water_2_moon_twinkle' && countEl('water') >= 2) active = true;

             if(active) {
                if(t.type === 'syn_nature_3_all') { p.atk *= 1.3; p.matk *= 1.3; p.def *= 1.3; p.mdef *= 1.3; }
                if(t.type === 'syn_nature_3_golem') { p.atk *= 1.3; p.def *= 1.3; }
                if(t.type === 'syn_nature_3_matk') p.matk *= 1.5;
                if(t.type === 'syn_fire_3_crit') p.baseCrit += 30;
                if(t.type === 'syn_dark_3_matk') p.matk *= 1.5;
                if(t.type === 'syn_light_fire_atk') p.atk *= 1.3;
                if(t.type === 'syn_light_dark_matk_mdef') { p.matk *= 1.3; p.mdef *= 1.3; }
                if(t.type === 'syn_night_rabbit') { p.matk *= 1.5; p.mdef *= 1.5; }
                if(t.type === 'syn_snow_rabbit') { p.atk *= 1.5; p.def *= 1.5; }
                if(t.type === 'syn_silver_rabbit') { p.atk *= 1.5; p.matk *= 1.5; }
                if(t.type === 'syn_water_3_atk_matk') { p.atk *= 1.5; p.matk *= 1.5; }
                if(t.type === 'syn_fire_3_crit_burn') p.baseCrit += t.val;
                if(t.type === 'syn_dark_3_matk_boost') p.matk *= (1 + t.val/100);

                p.atk = Math.floor(p.atk); p.matk = Math.floor(p.matk);
                p.def = Math.floor(p.def); p.mdef = Math.floor(p.mdef);
             }
        }

        // Positional Traits (Generalized)
        if(t.type === 'pos_stat_boost' && idx !== undefined) {
            if(t.pos === idx) {
                let stats = Array.isArray(t.stat) ? t.stat : [t.stat];
                stats.forEach(s => {
                    if(s === 'atk') p.atk *= (1 + t.val/100);
                    if(s === 'matk') p.matk *= (1 + t.val/100);
                    if(s === 'def') p.def *= (1 + t.val/100);
                    if(s === 'mdef') p.mdef *= (1 + t.val/100);
                });
                p.atk = Math.floor(p.atk); p.matk = Math.floor(p.matk);
                p.def = Math.floor(p.def); p.mdef = Math.floor(p.mdef);
            }
        }

        if(t.type === 'rabbit_synergy_boost') {
             const rabbits = ['night_rabbit', 'snow_rabbit', 'silver_rabbit', 'trans_yeon_rabbit', 'joker'];
             let count = 0;
             deck.forEach(id => { if (id && rabbits.includes(id)) count++; });
             if (count > 0) {
                 let boost = count * (t.val / 100);
                 p.atk = Math.floor(p.atk * (1 + boost));
                 p.matk = Math.floor(p.matk * (1 + boost));
             }
        }

        return { stats: p, activeTrait: active ? t.type : null };
    },

    // 5. Enemy AI
    decideEnemyAction: function(enemy, turn) {
        let skill = null;
        let r = Math.random();

        if(enemy.id === 'artificial_demon_god') {
            if(turn === 10) skill = enemy.skills.find(s => s.name === '파괴의형태');
            else if(r < 0.3) skill = enemy.skills.find(s => s.name === '아이스빔');
        }
        else if(enemy.id === 'iris_love') {
            if(turn === 7) skill = enemy.skills.find(s => s.name === '소울드레인');
            else if(r < 0.1) skill = enemy.skills.find(s => s.name === '더홀리');
            else if(r < 0.4) skill = enemy.skills.find(s => s.name === '홀리레이');
        }
        else if(enemy.id === 'iris_curse') {
            if(turn === 10) skill = enemy.skills.find(s => s.name === '아포칼립스');
            else if(r < 0.3) skill = enemy.skills.find(s => s.name === '프레임샷');
        }
        else if(enemy.id === 'pharaoh') {
            if(turn % 5 === 0) skill = enemy.skills.find(s => s.name === '고대의저주');
            else if(r < 0.3) skill = enemy.skills.find(s => s.name === '고대의힘');
        }
        else if(enemy.id === 'demon_god') {
            if(turn === 7 || turn === 14) skill = enemy.skills.find(s => s.name === '제노사이드');
            else if(r < 0.2) skill = enemy.skills.find(s => s.name === '다크니스');
        }
        else if(enemy.id === 'creator_god') {
            if(enemy.isCharging) {
                const chargedSkill = enemy.skills.find(s => s.name === '디바인블레이드');
                return { ...chargedSkill, chargeReset: true };
            }
            else if(turn === 1) {
                return { type: 'phy', val: 1.0, name: '일반 공격' };
            }
            else if(turn === 2) {
                skill = enemy.skills.find(s => s.name === '저지먼트');
            }
            else {
                if(r < 0.3) {
                     if(turn > 15) skill = enemy.skills.find(s => s.name === '저지먼트');
                     else skill = enemy.skills.find(s => s.name === '홀리레이');
                }
                else if(r < 0.5) {
                    return { type: 'phy', val: 0, name: '차지', isChargeStart: true };
                }
                else {
                    return { type: 'phy', val: 1.0, name: '일반 공격' };
                }
            }
        }

        if(!skill && Math.random() < 0.3 && enemy.skills.length > 0) {
             const validSkills = enemy.skills.filter(s => s.rate > 0);
             if(validSkills.length > 0) {
                 skill = validSkills[Math.floor(Math.random() * validSkills.length)];
             }
        }
        return skill || { type: 'phy', val: 1.0, name: '일반 공격' };
    },

    // 6. Handle Death Traits
    handleDeathTraits: function(victim, killer, fieldBuffs, logFn, deck, turn) {
        if (!logFn) logFn = function() {};

        let result = { damageToKiller: 0, fieldBuffsToAdd: [], killerDebuffs: {} };
        const t = victim.proto.trait;

        if(t.type === 'death_dmg_mag') {
            let dummySkill = { name: '사망 반격', type: 'mag', val: t.val, effects: [] };
            let dmgResult = this.calculateDamage(victim, killer, dummySkill, fieldBuffs, [], logFn, null, deck, turn);
            if(dmgResult.dmg > 0) {
                result.damageToKiller += dmgResult.dmg;
                logFn(`[특성] 사망 반격! ${dmgResult.isCrit?'Critical! ':''}<span class="log-dmg">${dmgResult.dmg}</span> 피해.`);
            }
        }
        else if(t.type === 'death_dmg_debuff') {
            let cnt = Object.keys(killer.buffs).length;
            let dummySkill = { name: '저주 반격', type: 'mag', val: cnt * t.val, effects: [] };
            let dmgResult = this.calculateDamage(victim, killer, dummySkill, fieldBuffs, [], logFn, null, deck, turn);
            if(dmgResult.dmg > 0) {
                result.damageToKiller += dmgResult.dmg;
                logFn(`[특성] 저주 반격! ${dmgResult.isCrit?'Critical! ':''}<span class="log-dmg">${dmgResult.dmg}</span> 피해.`);
            }
        }
        else if(t.type === 'death_field_sun') {
            result.fieldBuffsToAdd.push('sun_bless');
        }
        else if(t.type === 'death_debuff') {
             if (killer) {
                 result.killerDebuffs[t.debuff] = 1;
                 logFn(`[특성] 사망 효과 발동! 적에게 [${getBuffName(t.debuff)}] 부여.`);
             }
        }
        else if(t.type === 'death_sun_bless_chance') {
             if(Math.random() < t.val) {
                 result.fieldBuffsToAdd.push('sun_bless');
                 logFn(`[특성] 마시멜로가 녹으며 태양의 축복을 남깁니다!`);
             } else {
                 logFn(`[특성] 마시멜로가 흔적도 없이 사라졌습니다... (축복 실패)`);
             }
        }
        else if(t.type === 'death_field_buff_count_dmg') {
             let count = fieldBuffs.length;
             let dummySkill = { name: '사망 반격', type: 'mag', val: count * t.val, effects: [] };
             let dmgResult = this.calculateDamage(victim, killer, dummySkill, fieldBuffs, [], logFn, null, deck, turn);
             if(dmgResult.dmg > 0) {
                 result.damageToKiller += dmgResult.dmg;
                 logFn(`[특성] 사망 반격! (필드버프 ${count}개) ${dmgResult.isCrit?'Critical! ':''}<span class="log-dmg">${dmgResult.dmg}</span> 피해.`);
             }
        }
        else if(t.type === 'death_twinkle') {
            result.fieldBuffsToAdd.push('twinkle_party');
            logFn(`[특성] 헬하운드 사망! 트윙클 파티 발동!`);
        }

        return result;
    },

    getElementalMultiplier: function(atkEl, defEl) {
        if(atkEl === 'water' && defEl === 'fire') return 1.2;
        if(atkEl === 'fire' && defEl === 'nature') return 1.2;
        if(atkEl === 'nature' && defEl === 'water') return 1.2;
        if((atkEl === 'light' && defEl === 'dark') || (atkEl === 'dark' && defEl === 'light')) return 1.2;
        return 1.0;
    },

    getBuffName: getBuffName
};
