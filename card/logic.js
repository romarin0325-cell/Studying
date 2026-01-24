
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
            if (trait.type === 'cond_twinkle_all' && fieldBuffs.some(b => b.name === 'twinkle_party')) {
                // Multiplier handled below
            }
        }

        // Multipliers from Buffs/Traits
        let m = { atk: 1.0, matk: 1.0, def: 1.0, mdef: 1.0 };

        // Field Buffs (Only apply to Allies)
        if (isPlayer) {
            // Flood Mode: 2x effect
            let buffMult = (mode === 'flood') ? 2.0 : 1.0;

            fieldBuffs.forEach(fb => {
                if(fb.name === 'sun_bless') { m.atk += (0.3 * buffMult); m.matk += (0.3 * buffMult); }
                if(fb.name === 'moon_bless') { m.matk += (0.3 * buffMult); stats.evasion += (15 * buffMult); }
                if(fb.name === 'sanctuary') { m.matk += (0.3 * buffMult); m.mdef += (0.3 * buffMult); }
                if(fb.name === 'goddess_descent') { m.atk += (0.3 * buffMult); m.matk += (0.3 * buffMult); m.def += (0.3 * buffMult); m.mdef += (0.3 * buffMult); }
                if(fb.name === 'earth_bless') { m.atk += (0.25 * buffMult); m.matk += (0.25 * buffMult); }
                if(fb.name === 'twinkle_party') { m.atk += (0.2 * buffMult); stats.crit += (15 * buffMult); }
                if(fb.name === 'star_powder') { m.def += (0.3 * buffMult); m.mdef += (0.3 * buffMult); }
                if(fb.name === 'reaper_realm') { stats.crit += (40 * buffMult); }
            });
        }

        // Trait Multipliers (that affect base stats permanently for the turn)
        if (trait) {
             if (trait.type === 'cond_twinkle_all' && fieldBuffs.some(b => b.name === 'twinkle_party')) {
                 m.atk += 0.3; m.matk += 0.3;
             }
        }

        // Char Buffs/Debuffs
        // Curse Mode: 2x debuff effect
        let debuffMult = (mode === 'curse') ? 2.0 : 1.0;

        if (char.buffs['weak']) m.atk -= (0.2 * debuffMult);
        if (char.buffs['silence']) m.matk -= (0.2 * debuffMult);
        if (char.buffs['evasion']) stats.evasion += 50; // Evasion buff usually fixed? Or should double? Description says "Debuff stat reduction effect". Evasion buff is a Buff.
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
    calculateDamage: function(source, target, skill, fieldBuffs, activeTraits, logFn, mode) {
        if (!logFn) logFn = function() {};

        if(skill.type !== 'phy' && skill.type !== 'mag') return { dmg: 0, isCrit: false };

        const srcStats = this.calculateStats(source, fieldBuffs, mode);
        const tgtStats = this.calculateStats(target, fieldBuffs, mode);

        // 1. Critical
        let isCrit = Math.random() * 100 < srcStats.crit;
        if (skill.effects && skill.effects.some(e => e.type === 'force_crit')) isCrit = true;

        let critDmg = 1.5; // Base 150%
        // Sun Bless Crit Dmg boost only for Player
        if (source.proto && fieldBuffs.some(b => b.name === 'sun_bless')) critDmg += 0.6;
        // Reaper's Realm Crit Dmg boost
        if (source.proto && fieldBuffs.some(b => b.name === 'reaper_realm')) critDmg += 0.4;

        let val = (skill.type === 'phy') ? srcStats.atk : srcStats.matk;
        if (isCrit) val *= critDmg;

        // 2. Skill Multiplier & Bonuses
        let mult = skill.val || 1.0;
        let dmgBonus = 0.0;

        // Elemental
        if (source.proto && source.proto.element && target.element) {
             const elMult = this.getElementalMultiplier(source.proto.element, target.element);
             if (elMult > 1.0) {
                 val *= elMult;
                 logFn("상성 우위! 대미지 20% 증가.");
             }
        }

        // Skill Effects affecting Multiplier
        if(skill.effects) {
            skill.effects.forEach(eff => {
                if(eff.type === 'consume_field_all') {
                    let c = fieldBuffs.length;
                    if(c > 0) {
                        mult += (c * eff.multPerStack);
                        fieldBuffs.length = 0; // Modify in place as requested/implied by game logic
                        logFn(`필드 버프 ${c}개 제거! 위력 폭발!`);
                    }
                }
                else if(eff.type === 'consume_debuff_all') {
                    if(target.buffs[eff.debuff]) {
                        let c = target.buffs[eff.debuff];
                        mult += (c * eff.multPerStack);
                        delete target.buffs[eff.debuff];
                        logFn(`${this.getBuffName(eff.debuff)} ${c}스택 소모!`);
                    }
                }
                else if(eff.type === 'dmg_boost') {
                     if(eff.condition === 'target_debuff' && target.buffs[eff.debuff]) {
                         mult *= eff.mult;
                         logFn(`[특성] ${this.getBuffName(eff.debuff)} 대상 추가 피해! (배율 x${eff.mult})`);
                     }
                     else if(eff.condition === 'synergy_active' && activeTraits.includes(eff.trait)) {
                         mult *= eff.mult;
                         logFn(`[시너지] 조건 만족! 위력 ${eff.mult}배 증가!`);
                     }
                     else if(eff.condition === 'target_stack' && target.buffs[eff.debuff]) mult += (target.buffs[eff.debuff] * eff.multPerStack);
                     else if(eff.condition === 'target_debuff_count_scale') {
                         let bonus = (Object.keys(target.buffs).length * eff.multPerDebuff);
                         mult += bonus;
                         if(bonus > 0) logFn(`[특성] 디버프 대상 추가 피해! (배율 +${bonus.toFixed(1)})`);
                     }
                     else if(eff.condition === 'hp_below' && (source.hp/source.maxHp) <= eff.val) {
                         mult *= eff.mult;
                         if(skill.name === '라그나로크') logFn("라그나로크: 생명력 조건 만족! 대미지 증가!");
                     }
                     else if(eff.condition === 'hp_full' && source.hp === source.maxHp) {
                         mult *= eff.mult;
                         if(eff.log) logFn(eff.log);
                     }
                     else if(eff.condition === 'field_buff' && fieldBuffs.some(b=>b.name === eff.buff)) {
                         mult *= eff.mult;
                         if(source.id === 'behemoth' && skill.name === '대지분쇄') logFn("대지의 축복으로 인해 대지분쇄의 위력이 증가합니다!");
                     }
                }
                else if(eff.type === 'consume_burn_1_dmg') {
                     if(target.buffs['burn'] >= 1) {
                         mult *= eff.mult;
                     }
                }
                else if(eff.type === 'remove_field_buff_dmg') {
                     if(fieldBuffs.length > 0) {
                         mult *= eff.mult;
                     }
                }
                else if(eff.type === 'cond_target_debuff_3_dmg') {
                     if(Object.keys(target.buffs).length >= 3) {
                         mult *= eff.mult;
                         logFn("적 디버프 3개 이상! 위력 2배!");
                     }
                }
                else if(eff.type === 'random_mult') {
                    let max = eff.max;
                    if(activeTraits.includes('syn_water_3_ice_age')) max = 10.0;
                    mult = eff.min + Math.floor(Math.random() * (max - eff.min + 1));
                    logFn(`무작위 위력! x${mult.toFixed(1)}`);
                }
                else if(eff.type === 'random_mult_moon_boost') {
                     let min = eff.min;
                     let max = eff.max;
                     if (fieldBuffs.some(b => b.name === 'moon_bless')) {
                         max = eff.boostMax;
                         logFn("달의 축복으로 최대 배율 증가!");
                     }
                     mult = min + (Math.random() * (max - min)); // Continuous random? Or integer? User said "2~4배율 랜덤". Usually continuous in code unless floor used.
                     // Existing random_mult uses floor. Let's assume continuous for now or same logic.
                     // But wait, existing code for random_mult used floor for integers 1..5.
                     // The new desc "2~4배율". Maybe 2.0 to 4.0 float?
                     // I'll stick to float for this one as it seems implied by ranges like 2.5
                     // Actually, let's use 1 decimal place precision logic or just float.
                     // For consistency with existing random_mult which does integer steps if min/max are integers?
                     // Let's just do random float.
                     mult = min + Math.random() * (max - min);
                     logFn(`무작위 위력! x${mult.toFixed(1)}`);
                }
            });
        }

        // Trait Multipliers
        const t = source.proto ? source.proto.trait : null;
        if (t) {
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
            // New Traits
            if(t.type === 'cond_target_debuff_3_dmg' && Object.keys(target.buffs).length >= 3) {
                dmgBonus += (t.val - 1.0);
                logFn("[특성] 심해의 주인: 적 디버프 3개 이상! 위력 폭발!");
            }
        }

        // Defense
        let def = (skill.type === 'phy') ? tgtStats.def : tgtStats.mdef;

        // Gray Trait: Ignore Def
        if (t && t.type === 'crit_ignore_def_add' && isCrit) {
            let ignore = t.val; // 0.5
            def = Math.floor(def * (1 - ignore));
            logFn("[특성] 치명타! 적 방어력 50% 무시!");
        }

        // Final Calculation
        let finalMult = mult * (1.0 + dmgBonus);
        let finalDmg = Math.floor(val * finalMult * (100 / (100 + def)));

        return { dmg: finalDmg, isCrit: isCrit };
    },

    // 4. Initial Stats Calculation
    calculateInitialStats: function(playerProto, deck, allCards) {
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

        // Helper functions
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
             else if(t.type === 'syn_water_light_matk_mdef' && hasEl('water') && hasEl('light')) active = true;
             else if(t.type === 'syn_water_nature' && hasEl('water') && hasEl('nature')) active = true;
             else if(t.type === 'syn_nature_3_matk' && countEl('nature') >= 3) active = true;
             else if(t.type === 'syn_night_rabbit' && (deck.includes('night_rabbit') || deck.includes('silver_rabbit') || jokerInDeck)) active = true;
             else if(t.type === 'syn_snow_rabbit' && (deck.includes('snow_rabbit') || deck.includes('silver_rabbit') || jokerInDeck)) active = true;
             else if(t.type === 'syn_silver_rabbit' && (deck.includes('snow_rabbit') || deck.includes('night_rabbit') || jokerInDeck)) active = true;
             else if(t.type === 'syn_water_3_atk_matk' && countEl('water') >= 3) active = true;
             // New Traits
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
                if(t.type === 'syn_water_light_matk_mdef') { p.matk *= 1.3; p.mdef *= 1.3; }
                if(t.type === 'syn_night_rabbit') { p.matk *= 1.5; p.mdef *= 1.5; }
                if(t.type === 'syn_snow_rabbit') { p.atk *= 1.5; p.def *= 1.5; }
                if(t.type === 'syn_silver_rabbit') { p.atk *= 1.5; p.matk *= 1.5; }
                if(t.type === 'syn_water_3_atk_matk') { p.atk *= 1.5; p.matk *= 1.5; }
                // New Traits Apply
                if(t.type === 'syn_fire_3_crit_burn') p.baseCrit += t.val; // +50
                if(t.type === 'syn_dark_3_matk_boost') p.matk *= (1 + t.val/100); // +100%

                // Flooring
                p.atk = Math.floor(p.atk); p.matk = Math.floor(p.matk);
                p.def = Math.floor(p.def); p.mdef = Math.floor(p.mdef);
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

        // Fallback
        if(!skill && Math.random() < 0.3 && enemy.skills.length > 0) {
             const validSkills = enemy.skills.filter(s => s.rate > 0);
             if(validSkills.length > 0) {
                 skill = validSkills[Math.floor(Math.random() * validSkills.length)];
             }
        }
        return skill || { type: 'phy', val: 1.0, name: '일반 공격' };
    },

    // 6. Handle Death Traits
    handleDeathTraits: function(victim, killer, fieldBuffs, logFn) {
        if (!logFn) logFn = function() {};

        let result = { damageToKiller: 0, fieldBuffsToAdd: [], killerDebuffs: {} };
        const t = victim.proto.trait;

        if(t.type === 'death_dmg_mag') {
            let dummySkill = { name: '사망 반격', type: 'mag', val: t.val, effects: [] };
            let dmgResult = this.calculateDamage(victim, killer, dummySkill, fieldBuffs, [], logFn);
            if(dmgResult.dmg > 0) {
                result.damageToKiller += dmgResult.dmg;
                logFn(`[특성] 사망 반격! ${dmgResult.isCrit?'Critical! ':''}<span class="log-dmg">${dmgResult.dmg}</span> 피해.`);
            }
        }
        else if(t.type === 'death_dmg_debuff') {
            let cnt = Object.keys(killer.buffs).length;
            let dummySkill = { name: '저주 반격', type: 'mag', val: cnt * t.val, effects: [] };
            let dmgResult = this.calculateDamage(victim, killer, dummySkill, fieldBuffs, [], logFn);
            if(dmgResult.dmg > 0) {
                result.damageToKiller += dmgResult.dmg;
                logFn(`[특성] 저주 반격! ${dmgResult.isCrit?'Critical! ':''}<span class="log-dmg">${dmgResult.dmg}</span> 피해.`);
            }
        }
        else if(t.type === 'death_field_sun') {
            result.fieldBuffsToAdd.push('sun_bless');
        }
        else if(t.type === 'death_stun') {
             if (killer) {
                 result.killerDebuffs.stun = 1;
                 logFn(`[특성] 사망 시 스턴 발동! 적을 기절시킵니다.`);
             }
        }
        else if(t.type === 'death_darkness') {
             if (killer) {
                 result.killerDebuffs.darkness = 1;
                 logFn(`[특성] 사망 시 암흑 발동! 적에게 암흑을 부여합니다.`);
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
             let dmgResult = this.calculateDamage(victim, killer, dummySkill, fieldBuffs, [], logFn);
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

    // Helper
    getElementalMultiplier: function(atkEl, defEl) {
        if(atkEl === 'water' && defEl === 'fire') return 1.2;
        if(atkEl === 'fire' && defEl === 'nature') return 1.2;
        if(atkEl === 'nature' && defEl === 'water') return 1.2;
        if((atkEl === 'light' && defEl === 'dark') || (atkEl === 'dark' && defEl === 'light')) return 1.2;
        return 1.0;
    },

    getBuffName: function(key) {
        const names = {
            'darkness': '암흑', 'corrosion': '부식', 'silence': '침묵', 'curse': '저주', 'weak': '약화',
            'burn': '작열', 'divine': '디바인', 'stun': '기절', 'evasion': '회피', 'barrier': '배리어',
            'magic_guard': '매직가드', 'guard': '가드',
            'defProtocolPhy': '방어프로토콜(물리)', 'defProtocolMag': '방어프로토콜(마법)',
            'sun_bless': '태양의축복', 'moon_bless': '달의축복', 'sanctuary': '성역',
            'goddess_descent': '여신강림', 'earth_bless': '대지의축복', 'twinkle_party': '트윙클파티',
            'star_powder': '스타파우더',
            'reaper_realm': '사신의영역'
        };
        return names[key] || key;
    }
};
