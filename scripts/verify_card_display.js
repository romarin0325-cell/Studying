'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const sandbox = {console, assert}; sandbox.window = sandbox;
vm.createContext(sandbox);
for (const file of ['data.js','logic.js','skill_display.js','battle_runtime.js','vocab_data.js','collocation_data.js','grammar_data.js','toeic_explanations.js','toeic.js','listening_data.js']) {
    vm.runInContext(fs.readFileSync(path.join(root,'card/game',file),'utf8'),sandbox,{filename:file});
}
const snapshot = JSON.parse(vm.runInContext(`JSON.stringify({combat:{cards:GameUtils.getAllCards(),forms:GameUtils.getBattleOnlyForms(),enemies:ENEMIES,artifacts:ARTIFACT_LIST,constants:GAME_CONSTANTS,storage:Storage.keys},learning:{vocab:VOCAB_DATA,collocations:COLLOCATION_DATA,grammar:GRAMMAR_DATA,toeic:TOEIC_DATA,explanations:TOEIC_EXPLANATIONS,listening:LISTENING_DATA}})`,sandbox));
function sorted(value, omitDesc = false) {
    if (Array.isArray(value)) return value.map(item => sorted(item,omitDesc));
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key => !omitDesc || key !== 'desc').map(key => [key,sorted(value[key],omitDesc)]));
    return value;
}
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const baseline = JSON.parse(fs.readFileSync(path.join(root,'card/tests/fixtures/skill-study-baseline.json'),'utf8'));
assert.equal(hash(sorted(snapshot.combat,true)),baseline.combatHash,'All combat fields, effect order, constants and storage keys must match the baseline');
assert.equal(hash(sorted(snapshot.learning)),baseline.learningHash,'Learning data may change only the three canonical resume spellings');
vm.runInContext(`
    const all = [...GameUtils.getAllCards(),...GameUtils.getBattleOnlyForms(),...ENEMIES];
    const effectsSeen = new Set();
    let skillsChecked = 0;
    for (const entity of all) for (const skill of entity.skills) {
        assert(!Object.hasOwn(skill,'desc'),'Stale skill prose: '+entity.id+' '+skill.name);
        const before = JSON.stringify(skill);
        const rng = Math.random;
        Math.random = () => { throw new Error('Display must not call RNG'); };
        let text;
        try { text = SkillDisplay.text(skill,{entity,enemy:ENEMIES.includes(entity)}); }
        finally { Math.random = rng; }
        assert.equal(JSON.stringify(skill),before,'Display mutated '+entity.id+' '+skill.name);
        assert(!/undefined|NaN|\\[object Object\\]|타입 미확인|\\(x[\\d.]|위력 0배|대미지|생명력|스턴|필드버프/.test(text),entity.id+' '+skill.name+' '+text);
        assert(SkillTypes.names[skill.type],entity.id+' '+skill.name);
        assert(SkillDisplay.body(skill,{entity,enemy:ENEMIES.includes(entity)}).length > 0,'Empty body');
        for (const effect of skill.effects || []) effectsSeen.add(effect.type+(effect.condition?':'+effect.condition:''));
        skillsChecked++;
    }
    assert.equal(skillsChecked,530);
    const card = id => GameUtils.getCardById(id);
    const skill = (id,name) => card(id).skills.find(s => s.name === name);
    assert.equal(SkillDisplay.text(skill('night_rabbit_valentine','딥키스')),'딥키스 · 마법 · MP 30 · 3티어\\n위력 2.5배.');
    assert.equal(SkillDisplay.body(skill('gold_dragon','드래곤크로')),'위력 2배. 자신의 HP가 100%이면 위력 4배.');
    assert.equal(SkillDisplay.body(skill('rumi','밀키웨이엑스터시')),'위력 3배. 필드 버프 ‘스타파우더’ 부여.');
    assert.equal(SkillDisplay.body(skill('rumi','매직가드')),'자신에게 매직가드 1턴 부여 (마법 피해 무효).');
    assert.equal(SkillDisplay.body(skill('zeke','이그니스스매시')),'위력 2배. 적의 작열을 모두 소모. 소모한 1스택당 배율 +2.');
    assert.equal(SkillDisplay.body(skill('luna','이클립스')),'위력 2.5배. 적이 암흑 상태이면 배율 ×2.');
    assert.equal(SkillDisplay.body(skill('time_ruler','종언의예고')),'3턴 후 위력 5배로 공격 예약. 발동 전에 시전자가 사망하면 예약 취소.');
    assert.equal(SkillDisplay.body(skill('grand_merchant','마나콜렉트')),'자신의 MP 30 회복.');
    assert.equal(SkillDisplay.body(skill('gold_dragon','가드')),'자신에게 가드 1턴 부여 (받는 피해 50% 감소).');
    const dream = SkillDisplay.body(skill('trans_lumi','꿈의형태'));
    for (const phrase of ['태양의축복이 있으면 배율 +2 및 확정 치명타','달의축복이 있으면 배율 +1 및 적의 기본 마법 방어력 30% 관통','스타파우더가 있으면 배율 +1 및 자신의 MP 30 회복','대지의축복이 있으면 배율 +2 및 자신의 HP 완전 회복','성역이 있으면 배율 +2 및 자신의 MP 20 회복','여신강림이 있으면 배율 +4 및 적에게 기절 부여','발렌타인이 있으면 배율 +5','운명의서약이 있으면 배율 +10','아레나가 있으면 배율 +4','사신강림이 있으면 배율 +1 및 적의 기본 마법 방어력 50% 관통','트윙클파티 또는 질풍이 있으면 각각 배율 +3']) assert(dream.includes(phrase),phrase);
    assert(SkillDisplay.body(skill('trans_ares','앱솔루트아머')).includes('반감 3턴'));
    const pharaoh = ENEMIES.find(e=>e.id==='pharaoh');
    assert.deepEqual(pharaoh.skills.map(s=>s.type),['mag','mag']);
    const curse = pharaoh.skills.find(s=>s.name==='고대의저주');
    assert.equal(SkillDisplay.text(curse,{entity:pharaoh,enemy:true}),'고대의저주 · 마법\\n위력 1배. 5턴마다 발동. 해당 턴에 자신이 피해를 받았으면 위력 3배.');
    const gray = ENEMIES.find(e=>e.id==='gray');
    assert.equal(SkillDisplay.body(gray.skills[0],{entity:gray,enemy:true}),'위력 2~4배. 4의 배수 턴에 차원절단과 무작위 선택 (14턴째 제외).');
    const soul = ENEMIES.find(e=>e.id==='iris_love').skills.find(s=>s.name==='소울드레인');
    assert.equal(SkillDisplay.heading(soul,{enemy:true}),'소울드레인 · 마법');
    assert.equal(SkillDisplay.body(soul,{entity:ENEMIES.find(e=>e.id==='iris_love'),enemy:true}),'적의 MP 100 제거. 7턴째 발동.');
    const zero = {name:'일반 공격',type:'phy',tier:1,cost:0,val:1,effects:[]};
    assert.equal(SkillDisplay.text(zero),'일반 공격 · 물리 · MP 0 · 1티어\\n위력 1배.');
    assert.equal(SkillDisplay.heading({...zero,cost:undefined,tier:undefined}),'일반 공격 · 물리');
    assert.equal(SkillDisplay.body({...zero,val:0}),'');
    assert.equal(SkillDisplay.body({...zero,val:undefined}),'');
    assert.equal(SkillDisplay.number(2.0),'2');
    assert.equal(SkillDisplay.number(2.5),'2.5');
    assert.equal(SkillDisplay.accessibleName({...zero,cost:30},10),'일반 공격 · 물리 · MP 30 · MP 부족');
    assert.throws(()=>SkillDisplay.body({...zero,effects:[{type:'unhandled_future_effect'}]}),/unsupported effect/);
    assert.throws(()=>SkillDisplay.body({...zero,effects:[{type:'dmg_boost',condition:'unhandled',mult:2}]}),/unsupported condition/);
    assert.equal(SkillDisplay.heading({...zero,type:'unknown'}).includes('타입 미확인'),true);
    const rpg={state:{mode:'origin',gameType:'endless',deck:[],enemyScale:0,artifacts:['support_boost']},battle:{players:[{proto:{trait:{type:'party_all_stats_mana_cost',costMult:2}}}]},hasArtifact:id=>id==='support_boost'};
    const original=skill('rumi','밀키웨이엑스터시');
    const adjusted=cloneSkillsWithCostModifiers(rpg,[original,skill('rumi','매직가드')]);
    assert.equal(SkillDisplay.heading(adjusted[0]),'밀키웨이엑스터시 · 마법 · MP 60 · 3티어');
    assert.equal(SkillDisplay.heading(adjusted[1]),'매직가드 · 보조 · MP 0 · 1티어');
    assert.equal(original.cost,30);
    for (const entity of all) for (const skill of entity.skills) {
        const delayed=findDelayedSkillEffect(skill);
        if (delayed) SkillDisplay.text(buildResolvedDelayedSkill(skill,delayed),{entity});
    }
    console.log('Card display contract: '+skillsChecked+' skills, '+effectsSeen.size+' effect/condition templates; combat and learning fingerprints unchanged.');
`,sandbox,{filename:'skill-display-expectations'});
const active = ['toeic.js','toeic_explanations.js','vocab_data.js','grammar_data.js','collocation_data.js','listening_data.js'].map(file=>fs.readFileSync(path.join(root,'card/game',file),'utf8')).join('\n');
assert.equal(/résumé|Résumé/.test(active),false);
assert(active.includes('café'));
const index=fs.readFileSync(path.join(root,'card/game/index.html'),'utf8');
assert.equal(/\$\{s\.desc\}|multText/.test(index),false,'All skill detail paths use the shared formatter');
console.log('Card spelling contract: resume retains both senses; café, IDs, answers, question structure and storage contracts preserved.');
