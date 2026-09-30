/** Pure presentation of structured skills. Never reads desc, rolls RNG or changes combat data. */
const SkillDisplay = Object.freeze({
    number(value) {
        if (!Number.isFinite(value)) throw new Error('Skill display: invalid number');
        return String(Number(value.toFixed(6)));
    },
    status(id) {
        if (!BUFF_NAMES[id]) throw new Error(`Skill display: unknown status ${id}`);
        return BUFF_NAMES[id];
    },
    list(ids) { return ids.map(id => this.status(id)).join('·'); },
    pool(ids, count) { return `‘${this.list(ids)}’ 중 무작위 ${this.number(count)}종`; },
    field(id) { return `필드 버프 ‘${this.status(id)}’`; },
    heading(skill, { enemy = false, tier = true } = {}) {
        const parts = [skill.name, SkillTypes.label(skill.type)];
        if (!enemy && Number.isFinite(skill.cost)) parts.push(`MP ${this.number(skill.cost)}`);
        if (!enemy && tier && Number.isFinite(skill.tier)) parts.push(`${this.number(skill.tier)}티어`);
        return parts.join(' · ');
    },
    accessibleName(skill, mp) {
        return this.heading(skill, {tier:false}) + (Number.isFinite(skill.cost) && mp < skill.cost ? ' · MP 부족' : '');
    },
    power(skill, entity) {
        if (skill.isChargeStart) return '힘을 모은다. 다음 행동에서 차지한 스킬 발동.';
        const effects = skill.effects || [];
        const delayed = !skill.isActualDelayedTrigger && effects.find(e => DELAYED_SKILL_EFFECT_TYPES.includes(e.type));
        const random = effects.find(e => ['random_mult', 'random_mult_moon_boost', 'delayed_random_attack'].includes(e.type));
        const n = v => this.number(v);
        let power = random ? `${n(random.min)}~${n(random.max)}` : (Number.isFinite(skill.val) && skill.val > 0 ? n(skill.val) : '');
        if (skill.type === 'sup' || !power) return '';
        if (!delayed) return power ? `위력 ${power}배.` : '';
        if (['delayed_field_buffs', 'delayed_random_unique_field_buffs'].includes(delayed.type)) return '';
        if (['multi_delayed_attack', 'phantom_nightmare'].includes(delayed.type)) {
            return `사용 후 ${delayed.turns.map(n).join('·')}턴에 각각 위력 ${power}배로 공격 예약.`;
        }
        return `${n(delayed.turns)}턴 후 위력 ${power}배로 공격 예약.`;
    },
    boost(effect, skill) {
        const n = v => this.number(v);
        const status = id => this.status(id);
        const multiply = `배율 ×${n(effect.mult || 1)}`;
        switch (effect.condition) {
            case 'hp_full': return `자신의 HP가 100%이면 위력 ${n(skill.val * effect.mult)}배`;
            case 'hp_below': return `자신의 HP가 ${n(effect.val * 100)}% 이하이면 ${multiply}`;
            case 'target_hp_below': return `적의 HP가 ${n(effect.val * 100)}% 이하이면 ${multiply}`;
            case 'target_debuff': return `적이 ${status(effect.debuff)} 상태이면 ${multiply}`;
            case 'target_stack_at_least': return `적의 ${status(effect.debuff)}이 ${n(effect.count || 1)}스택 이상이면 ${multiply}`;
            case 'source_trait_active': return `자신의 특성이 발동 중이면 ${multiply}`;
            case 'field_buff': return `${this.field(effect.buff)}가 있으면 ${multiply}`;
            case 'target_stack': return `공격 전 적의 ${status(effect.debuff)} 1스택당 배율 +${n(effect.multPerStack)}`;
            case 'target_debuff_count_scale': return `공격 전 적의 디버프 1종당 배율 +${n(effect.multPerDebuff)}`;
            case 'field_buff_kind_count': return `현재 필드 버프 1종당 배율 +${n(effect.addPerBuff || 2)}`;
            case 'target_element': {
                const names = (effect.elements || [effect.element]).map(id => DISPLAY_NAMES.element[id]);
                if (names.some(name => !name)) throw new Error('Skill display: unknown element');
                return `적이 ${names.join('·')} 속성이면 ${multiply}`;
            }
            default: throw new Error(`Skill display: unsupported condition ${effect.condition}`);
        }
    },
    effect(effect, skill, entity) {
        const n = v => this.number(v);
        const name = id => this.status(id);
        const field = id => this.field(id);
        const pool = (ids, count) => this.pool(ids, count);
        const trigger = skill.isActualDelayedTrigger ? '발동 시' : '예약 발동 시';
        switch (effect.type) {
            case 'buff': {
                const descriptions = {barrier:'물리 피해 무효',magic_guard:'마법 피해 무효',guard:'받는 피해 50% 감소',damage_half:'받는 피해 50% 감소',evasion:'회피율 +50%p'};
                if (!descriptions[effect.id]) throw new Error(`Skill display: unsupported buff ${effect.id}`);
                return `자신에게 ${name(effect.id)} ${n(effect.duration)}턴 부여 (${descriptions[effect.id]})`;
            }
            case 'debuff': return `적에게 ${name(effect.id)}${['burn','divine'].includes(effect.id) ? ` ${n(effect.stack || 1)}스택` : ''} 부여`;
            case 'self_debuff': return `자신에게 ${name(effect.id)} 부여${effect.id === 'stun' ? ' (다음 턴 행동 불가)' : ''}`;
            case 'field_buff': return `${field(effect.id)}${effect.durationTurns ? ` ${n(effect.durationTurns)}턴` : ''} 부여`;
            case 'dmg_boost': return this.boost(effect, skill);
            case 'cond_target_debuff_3_dmg': return `공격 전 적의 디버프가 3종 이상이면 배율 ×${n(effect.mult)}`;
            case 'consume_field_all': return `필드 버프를 모두 소모. 소모한 1개당 배율 +${n(effect.multPerStack)}`;
            case 'consume_debuff_all': return `적의 ${name(effect.debuff)}을 모두 소모. 소모한 1스택당 배율 +${n(effect.multPerStack)}`;
            case 'consume_debuff_fixed': return `적의 ${name(effect.debuff)}이 ${n(effect.count || 1)}스택 이상이면 ${n(effect.count || 1)}스택 소모${effect.mult === 1 ? '' : `하고 배율 ×${n(effect.mult)}`}`;
            case 'consume_random_debuff_fixed_mult': return `적에게 ‘${this.list(effect.pool)}’ 중 ${n(effect.count || 1)}스택 이상인 디버프가 있으면 그중 무작위 1종의 ${n(effect.count || 1)}스택을 소모하고 배율 ×${n(effect.mult)}`;
            case 'consume_field_buff_dmg': return `${field(effect.buff)}가 있으면 1개 소모하고 배율 ×${n(effect.mult)}`;
            case 'remove_field_buff_dmg': return `필드 버프가 있으면 먼저 부여된 1개 해제하고 배율 ×${n(effect.mult)}`;
            case 'self_hp_cost_ratio': return `자신의 현재 HP ${n((effect.ratio || effect.val) * 100)}% 소모 (최소 1 HP)`;
            case 'suicide': return '사용 후 자신이 사망';
            case 'random_debuff': return `적에게 ${pool(effect.pool,effect.count)} 부여`;
            case 'conditional_debuff':
                if (effect.condition !== 'target_debuff_count') throw new Error('Skill display: unsupported debuff condition');
                return `적의 디버프가 ${n(effect.count)}종 이상이면 적에게 ${name(effect.debuff)} 부여`;
            case 'conditional_field_debuff': return `${field(effect.field)}가 있으면 적에게 ${this.list(effect.debuffs)} 부여`;
            case 'conditional_field_buff':
                if (effect.condition !== 'target_has_debuff') throw new Error('Skill display: unsupported field condition');
                return `적에게 ${name(effect.debuff)}이 있으면 ${field(effect.id)} 부여`;
            case 'conditional_debuff_on_synergy':
                if (effect.condition !== 'source_trait_active') throw new Error('Skill display: unsupported synergy');
                return `자신의 특성이 발동 중이면 적에게 ${this.list(effect.debuffs)} 부여`;
            case 'chance_debuff': return `${n(effect.chance * 100)}% 확률로 적에게 ${name(effect.id)} 부여`;
            case 'check_divine_3_stun_else_add': return '적의 디바인이 3스택 이상이면 적에게 기절 부여. 미만이면 적에게 디바인 1스택 부여';
            case 'random_debuff_consume_divine': return `적에게 디바인이 있으면 1스택 소모하고 적에게 ${pool(['curse','darkness','silence','weak','corrosion'],2)} 부여. 없으면 ${pool(['curse','darkness','silence','weak','corrosion'],1)} 부여`;
            case 'consume_debuff_then_random_debuff': return `적의 ${name(effect.debuff)}이 ${n(effect.count || 1)}스택 이상이면 ${n(effect.count || 1)}스택 소모하고 적에게 ${pool(effect.pool,effect.randomCount || effect.count || 1)} 부여`;
            case 'consume_divine_add_darkness': return '적에게 디바인이 있으면 1스택 소모하고 적에게 암흑 부여';
            case 'consume_all_burn_cond_buff': return '적에게 작열이 있으면 전부 소모하고 필드 버프 ‘태양의축복’ 부여. 없으면 필드 버프 ‘대지의축복’ 부여';
            case 'clear_target_debuffs': return '공격 후 적의 모든 디버프 해제';
            case 'clear_self_debuffs': return '자신의 모든 디버프 해제';
            case 'turn_modulo_dmg': return `${n(effect.mod)}의 배수 턴이면 배율 ×${n(effect.mult)}`;
            case 'dmg_boost_turn_limit': return `${n(effect.maxTurn || effect.turn)}턴째까지 배율 ×${n(effect.mult)}`;
            case 'dmg_boost_turn_scale': return `발동 시 턴 번호 ×${n(effect.scale)}만큼 배율 가산`;
            case 'turn_modulo_debuffs': return `${n(effect.mod)}의 배수 턴이면 적에게 ${this.list(effect.debuffs)} 부여`;
            case 'force_crit': return '반드시 치명타로 적중';
            case 'force_crit_chance': return `이 공격의 치명타율 +${n(effect.val)}%p`;
            case 'random_mult': return entity && entity.trait && entity.trait.type === 'syn_water_3_ice_age' ? '자신의 특성이 발동 중이면 위력 1~10배' : '';
            case 'random_mult_moon_boost': return `${field('moon_bless')}가 있으면 위력 ${n(effect.min)}~${n(effect.boostMax)}배`;
            case 'delayed_attack': case 'delayed_random_attack': return '';
            case 'delayed_attack_field':
                if (skill.type === 'sup' && !skill.isActualDelayedTrigger) return `${n(effect.turns)}턴 후 ${field(effect.field)} 부여 예약`;
                return `${trigger} ${field(effect.field)} 부여`;
            case 'delayed_attack_random_field': return `${trigger} 무작위 필드 버프 1종 부여 (${this.list(['sun_bless','moon_bless','sanctuary','goddess_descent','earth_bless','twinkle_party','star_powder','arena'])})`;
            case 'delayed_attack_debuffs': return `${trigger} 적에게 ${this.list(effect.debuffs)} 부여`;
            case 'delayed_attack_debuff_scale': return `${trigger} 적의 디버프 1종당 배율 +${n(effect.multPerDebuff)}`;
            case 'delayed_turn_scale_attack': return `${trigger} 턴 번호 ×${n(effect.scale)}만큼 배율 가산`;
            case 'phantom_nightmare': return `${skill.isActualDelayedTrigger ? '발동 시' : '각 예약 발동 시'} 적이 암흑 상태이면 배율 ×${n(effect.darknessMult || 2)}`;
            case 'multi_delayed_attack': return '';
            case 'delayed_field_buffs': return `${skill.isActualDelayedTrigger ? '발동 시' : `${n(effect.turns)}턴 후`} 필드에 ${this.list(effect.buffs)} 부여${skill.isActualDelayedTrigger ? '' : ' 예약'}`;
            case 'delayed_random_unique_field_buffs': return `${skill.isActualDelayedTrigger ? '발동 시' : `${n(effect.turns)}턴 후`} 현재 없는 필드 버프를 ${pool(effect.pool,effect.count)} 부여${skill.isActualDelayedTrigger ? '' : ' 예약'} (후보가 부족하면 가능한 수만 부여)`;
            case 'mana_restore': return `자신의 MP ${n(effect.val || effect.amount)} 회복`;
            case 'mana_burn': return '적의 현재 MP 전부 제거';
            case 'swap_self_stats': return '사용 후 자신의 물리 공격력과 마법 공격력 교환. 물리 방어력과 마법 방어력도 교환';
            case 'remove_random_field_buff': return '필드 버프 무작위 1개 해제';
            case 'random_field_buff': return `필드에 ${pool(effect.pool || ['sun_bless','moon_bless','sanctuary','goddess_descent','earth_bless','twinkle_party','star_powder','arena'],1)} 부여`;
            case 'random_field_buff_lumi': return `필드에 ${pool(['sun_bless','moon_bless','star_powder'],1)} 부여`;
            case 'roulette_field': return `모든 필드 버프 해제 후 필드에 ${pool(['sun_bless','moon_bless','sanctuary','goddess_descent','earth_bless','twinkle_party','star_powder'],1)} 부여`;
            case 'prism_shuffle_field': return '현재 필드 버프 수를 유지하며 무작위로 교체';
            case 'moon_to_sun': return '필드 버프 ‘달의축복’이 있으면 1개 소모하고 ‘태양의축복’ 부여. 없으면 ‘달의축복’ 부여';
            case 'wild_card_debuff': return `적의 모든 디버프 해제 후 적에게 ${pool(['curse','darkness','silence','weak','corrosion','burn','divine','temptation'],2)} 부여`;
            case 'count_deck_attr_dmg': return '덱에 포함된 속성 1종당 배율 +1 (조커는 5속성으로 취급)';
            case 'random_skill_trigger_from_list': return '데스티니룰렛의 스킬 풀에서 무작위 스킬 1개 발동 (지연 스킬은 예약)';
            case 'transform': return `${GameUtils.getCardById(effect.formId).name}으로 변신`;
            case 'transform_choice': return `${effect.forms.map(id => GameUtils.getCardById(id).name).join(' 또는 ')}으로 변신`;
            // The Dream Form fusion switch lives in calculateDamage, not effects.
            // These explicit clauses mirror that switch and its post-hit SideEffects.
            case 'dream_form_execute': return '필드 버프별 효과를 합산한 뒤 모든 필드 버프 소모. 태양의축복이 있으면 배율 +2 및 확정 치명타. 달의축복이 있으면 배율 +1 및 적의 기본 마법 방어력 30% 관통. 스타파우더가 있으면 배율 +1 및 자신의 MP 30 회복. 대지의축복이 있으면 배율 +2 및 자신의 HP 완전 회복. 성역이 있으면 배율 +2 및 자신의 MP 20 회복. 여신강림이 있으면 배율 +4 및 적에게 기절 부여. 발렌타인이 있으면 배율 +5. 운명의서약이 있으면 배율 +10. 아레나가 있으면 배율 +4. 사신강림이 있으면 배율 +1 및 적의 기본 마법 방어력 50% 관통. 트윙클파티 또는 질풍이 있으면 각각 배율 +3';
            default: throw new Error(`Skill display: unsupported effect ${effect.type}`);
        }
    },
    enemyRule(entity, skill) {
        if (!entity || skill.isChargeStart || skill.chargeReset) return '';
        const id = entity.id;
        const rules = {
            artificial_demon_god: {'파괴의형태':'10턴째 발동'},
            iris_love: {'소울드레인':'7턴째 발동'},
            iris_curse: {'아포칼립스':'10턴째 발동'},
            pharaoh: {'고대의저주':'5턴마다 발동. 해당 턴에 자신이 피해를 받았으면 위력 3배'},
            demon_god: {'제노사이드':'7턴째·14턴째 발동'},
            flora: {'제네시스블룸':'5턴째·10턴째 발동'},
            gray: {'영혼절단':'4의 배수 턴에 차원절단과 무작위 선택 (14턴째 제외)','차원절단':'4의 배수 턴에 영혼절단과 무작위 선택 (14턴째 제외)','디멘션제로':'14턴째 발동'},
            thor: {'썬더러쉬':'10턴째 발동'},
            poseidon: {'어비스블레싱':'5턴째 발동','어비스프레셔':'10턴째 발동','디바우러':'15턴째 발동'},
            ares: {'테라소드':'3턴째·8턴째에 마그마이럽션과 무작위 선택하여 차지. 다음 행동에서 발동','마그마이럽션':'3턴째·8턴째에 테라소드와 무작위 선택하여 차지. 다음 행동에서 발동'},
            creator_god: {'저지먼트':'2턴째 발동. 16턴째부터는 행동 선택에 따라 추가 발동','디바인블레이드':'차지한 다음 행동에서 발동'}
        };
        const baseId = {flora_valentine:'flora',thor_swimsuit:'thor',ares_halloween:'ares',astea_christmas:'creator_god'}[id] || id;
        return (rules[baseId] || {})[skill.name] || '';
    },
    body(skill, { entity = null, enemy = false } = {}) {
        const parts = [this.power(skill, entity)];
        const reservation = !skill.isActualDelayedTrigger && findDelayedSkillEffect(skill);
        const repeated = reservation && ['multi_delayed_attack','phantom_nightmare'].includes(reservation.type);
        if (!skill.isChargeStart) {
            for (const effect of skill.effects || []) {
                const text = this.effect(effect, skill, entity);
                // Ordinary effects are retained in the resolved skill, so they run
                // with the reserved hit (and once per hit for repeated reservations).
                const timing = reservation && !DELAYED_SKILL_EFFECT_TYPES.includes(effect.type)
                    ? (repeated ? '각 예약 발동 시 ' : '예약 발동 시 ') : '';
                if (text) parts.push(timing + text + '.');
            }
        }
        if (enemy) {
            const rule = this.enemyRule(entity, skill);
            if (rule) parts.push(rule + '.');
        }
        if (!skill.isActualDelayedTrigger && (skill.effects || []).some(e => DELAYED_SKILL_EFFECT_TYPES.includes(e.type))) parts.push('발동 전에 시전자가 사망하면 예약 취소.');
        return parts.filter(Boolean).join(' ');
    },
    text(skill, options = {}) { return this.heading(skill, options) + '\n' + this.body(skill, options); },
    html(skill, options = {}) {
        const escape = value => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        return `<div class="skill-detail"><b class="skill-detail-heading">${escape(this.heading(skill, options))}</b><div class="skill-detail-body">${escape(this.body(skill, options))}</div></div>`;
    }
});
