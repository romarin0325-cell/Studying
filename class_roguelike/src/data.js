'use strict';

const GAME_VERSION = 1;
const SAVE_KEY = 'trinityNocturneSaveV1';
const MAX_LEVEL = 30;
const CLASS_MILESTONES = [11, 21];
const TEST_XP_MULTIPLIER = 3;

const TIER_COLORS = {
  1: '#aab4c0',
  2: '#59d68b',
  3: '#5ba8ff',
  4: '#bd72ff',
  5: '#ffbf47'
};

const BASE_PLAYER_STATS = {
  maxHp: 300,
  atk: 50,
  matk: 50,
  def: 40,
  mdef: 40,
  critChance: 0.1,
  critDamage: 0.5,
  maxMana: 100,
  startingMana: 50,
  regen: 10,
  dreamCrystals: 2
};

function makeGameSkill(id, name, mp, unlock, type, power, text, params) {
  return Object.assign({
    id: id,
    name: name,
    mp: mp,
    unlock: unlock,
    type: type,
    power: power,
    effect: id,
    text: text
  }, params || {});
}

const CLASS_DATA = [
  {
    id: 'berserker',
    name: '버서커',
    glyph: '⚔',
    color: '#ef5b5b',
    roles: ['physical', 'burst', 'risk'],
    weaponRestrictions: [],
    armorRestrictions: [],
    trait: {
      effect: 'berserker_low_hp',
      text: '생명력 절반 아래에서 물리공격력, 물리방어력 30%상승'
    },
    comment: '무기와 방어구제한이 없어서 가장 높은 스테이터스를 가질 수 있다. 특성 증가량도 발동 상태 기준 클래스 중에서 가장 높다. 마나대비 대미지 효율이 우수하지만 생명력을 깍거나 위험을 담보로 해서 대미지를 내기 때문에 주의 필요. 자해조차도 대미지로 바꿀 수 있지만 운영에 주의가 필요하다.',
    skills: [
      makeGameSkill('heavy_impact', '헤비임팩트', 20, 2, 'physical', 120, '물리공격력 120%, 잃은 체력 비례 위력 증가 (최대 240%)', {
        maxPower: 240,
        missingHpScaling: true
      }),
      makeGameSkill('carnage', '카니지', 0, 5, 'physical', 150, '물리공격력 150%, 최대생명력의 10% 소모', {
        hpCostPercent: 10
      }),
      makeGameSkill('wild_thrash', '와일드쓰래쉬', 20, 7, 'physical', 300, '물리공격력 300%, 다음턴 자신 방어력/마법방어력 50% 감소', {
        defensePenaltyPercent: 50,
        penaltyDelay: 1,
        duration: 1
      }),
      makeGameSkill('ragnarok', '라그나로크', 50, 10, 'physical', 250, '물리공격력 250%, 잃은체력 비례 위력 증가 (최대 750%)', {
        maxPower: 750,
        missingHpScaling: true
      })
    ]
  },
  {
    id: 'magic_swordsman',
    name: '마검사',
    glyph: '♨',
    color: '#ff784e',
    roles: ['hybrid', 'debuffer', 'enchanter'],
    weaponRestrictions: ['staff'],
    armorRestrictions: [],
    trait: {
      effect: 'magic_swordsman_arcana',
      text: '마법공격력 10%증가, 마법방어력 20%증가, 마나20증가'
    },
    comment: '마나대비 상당히 우수한 마법배율을 자랑하는 하이브리드 어태커, 주요 플랜은 마법으로 적의 방어력을 감소시키고 인챈트를 건 이후에 물리공격을 통해서 하이브리드 딜을 구사하는 것. 이그니스스매시의 실효배율이 합계 330%까지 올라간다. 장비 제한이나 스킬 구성이 우수해서 다른 물리형 클래스와의 조합도 괜찬다.',
    skills: [
      makeGameSkill('flame_shot', '플레임샷', 10, 2, 'magic', 150, '마법공격력 150%, 3턴간 적 물리방어력 20% 감소', {
        targetDefense: 'def',
        reductionPercent: 20,
        duration: 3
      }),
      makeGameSkill('fire_enchant', '파이어인챈트', 30, 5, 'buff', 0, '5턴간 물리공격시 마법공격력의 80%의 추가타격 발생', {
        duration: 5,
        extraMagicPower: 80
      }),
      makeGameSkill('ignis_smash', '이그니스스매시', 30, 7, 'physical', 170, '물리공격력 170%, 파이어인챈트의 추가타격이 2배로 적용', {
        fireEnchantMultiplier: 2
      }),
      makeGameSkill('prominence', '프로미넌스', 40, 10, 'magic', 250, '마법공격력 250%, 3턴간 적 물리방어력 20% 감소', {
        targetDefense: 'def',
        reductionPercent: 20,
        duration: 3
      })
    ]
  },
  {
    id: 'paladin',
    name: '팔라딘',
    glyph: '♜',
    color: '#ffd36a',
    roles: ['tank', 'physical', 'scaling'],
    weaponRestrictions: [],
    armorRestrictions: [],
    trait: {
      effect: 'paladin_bulwark',
      text: '물리공격력 10% 증가, 물리방어력 20% 증가'
    },
    comment: '방어형 스킬에 특화되어있고 장비 제한이 없어서 어떤 클래스의 보조로도 어울린다. 버틸수록 강해지는 2개의 플랜을 가지고 있다. 기간틱캐슬은 마나대비 대미지가 낮은 마법공격이지만 사용턴 공방일체가 되고 많이 사용할수록 나중에 회수 가능하다. 디바인아머는 준수한 효율의 방어버프인 동시에, 전투가 길어져서 스택이 누적되면 디바인블레이드의 한방 폭발도 720%까지 강해진다. 언다잉은 단 한턴 사망을 막아주며, 버서커 계열의 스킬과 조합시 공격력 +100%를 포함해서 일격필살 콤보가 가능하다.',
    skills: [
      makeGameSkill('divine_armor', '디바인아머', 20, 2, 'buff', 0, '5턴간 방어.마방 30%증가, 피격시 디바인 1스택 획득', {
        duration: 5,
        defenseBonusPercent: 30,
        grantsOnHit: 'divine',
        stacksOnHit: 1
      }),
      makeGameSkill('undying', '언다잉', 30, 5, 'buff', 0, '이번턴 사망하지 않음, 발동 성공시 1턴간 공격력 +100%', {
        duration: 1,
        preventDeath: true,
        successAtkBonusPercent: 100
      }),
      makeGameSkill('divine_blade', '디바인블레이드', 40, 7, 'physical', 420, '물리공격력 420%, 발동을 위해서 1턴 차징 필요, 디바인스택 전부 폭발(스택당 +30%)', {
        chargeTurns: 1,
        consumesStatus: 'divine',
        stackBonusPower: 30
      }),
      makeGameSkill('gigantic_castle', '기간틱캐슬', 50, 10, 'magic', 150, '마법공격력 150%, 사용횟수당 위력 +150%(최대 750%), 사용턴 방어력 +100%', {
        powerPerUse: 150,
        maxPower: 750,
        turnDefenseBonusPercent: 100
      })
    ]
  },
  {
    id: 'aether_saber',
    name: '에테르세이버',
    glyph: '✦',
    color: '#7ee7ff',
    roles: ['physical', 'mana', 'support'],
    weaponRestrictions: ['greatsword', 'dagger'],
    armorRestrictions: ['heavy'],
    trait: {
      effect: 'aether_saber_flow',
      text: '물리공격력 10%증가, 마나30증가, 마나회복 2증가'
    },
    comment: '준수한 물리공격 구성을 가지지만, 물리계열 무기를 착용할 수 없다. 메디테이션은 물리 클래스에는 패널티가 없으면서 마나리젠을 극도로 높여주는 우수한 스킬. 마법 계열 클래스와 조합해서도 패널티 턴 동안 물리운영을 하는 방식으로 마나를 회복 가능하다.',
    skills: [
      makeGameSkill('holy_smite', '홀리스마이트', 10, 2, 'physical', 140, '물리공격력 140%'),
      makeGameSkill('judgment_road', '저지먼트로드', 20, 4, 'physical', 160, '물리공격력 160%, 3턴간 적 물리방어력 20%감소', {
        targetDefense: 'def',
        reductionPercent: 20,
        duration: 3
      }),
      makeGameSkill('aether_lance', '에테르랜스', 30, 6, 'physical', 180, '물리공격력 180%, 3턴간 적 마법방어력 20%감소', {
        targetDefense: 'mdef',
        reductionPercent: 20,
        duration: 3
      }),
      makeGameSkill('meditation', '메디테이션', 30, 8, 'buff', 0, '3턴간 마나리젠 +100% / 자신 마법공격력 50% 감소', {
        duration: 3,
        regenBonusPercent: 100,
        matkPenaltyPercent: 50
      }),
      makeGameSkill('mana_dress', '마나드레스', 50, 10, 'buff', 0, '4턴간 마나리젠 +10, 회피율 +10%', {
        duration: 4,
        regenBonus: 10,
        evasionBonusPercent: 10
      })
    ]
  },
  {
    id: 'priest',
    name: '프리스트',
    glyph: '✝',
    color: '#fff0a6',
    roles: ['magic', 'healer', 'buffer'],
    weaponRestrictions: ['greatsword'],
    armorRestrictions: ['heavy', 'light'],
    trait: {
      effect: 'priest_grace',
      text: '마법공격력 10%증가, 마나20증가, 마나회복 4증가'
    },
    comment: '생츄어리를 제외하면 마나대비 효율이 그렇게 높지는 않다. 여신강림은 3턴간능력이 크게 오른다. 현재 시점에서 최대마나 200을 달성하기 위해서는 마나를 추가로 주는 장비와 클래스를 총동원해야 한다. 추후 추가될 소모성 아티팩트 없이는 통상 사용 조건을 채우기 어렵다. 이론상 사용 조건을 달성한다면 최대마나 200을 채우는 싸이클동안 생명력 60%를 깍을 수 없는 적을 상대로 필승이 가능하다. 단, 실제로 마나리젠만 고려할게 안니라 방어스킬이나 버프스킬들을 활용하면서 버티면 최대마나 200을 채우는 싸이클의 필요 턴수는크게 증가한다.',
    skills: [
      makeGameSkill('holy_ball', '홀리볼', 30, 2, 'magic', 150, '마법공격력 150%'),
      makeGameSkill('holy_ray', '홀리레이', 60, 5, 'magic', 240, '마법공격력 240%'),
      makeGameSkill('sanctuary', '생츄어리', 70, 7, 'buff', 150, '4턴간 피격시 마법공격력 150% 반격', {
        duration: 4,
        counterPower: 150,
        counterScaling: 'matk'
      }),
      makeGameSkill('goddess_descent', '여신강림', 200, 10, 'buff', 0, '생명력 60%회복, 3턴간 공격력/방어력/마법공격력/마법방어력 +100%', {
        healPercent: 60,
        duration: 3,
        allStatsBonusPercent: 100
      })
    ]
  },
  {
    id: 'archmage',
    name: '아크메이지',
    glyph: '☀',
    color: '#ffa85e',
    roles: ['magic', 'burst', 'scaling'],
    weaponRestrictions: ['dagger'],
    armorRestrictions: ['heavy', 'light'],
    trait: {
      effect: 'archmage_overflow',
      text: '마법공격력 10%증가, 마나 30증가, 마나회복 2증가'
    },
    comment: '마나대비 효율이 좋지는 않지만, 마법쪽의 무기 제약은 없어서 실질 화력은나쁘지 않다. 마법쪽 클래스에서 보조로 사용하기엔 특성도 상당히 우수하다. 명중률을 포기하는 선파이어, 후반 딜을 노리는 앱솔루트라이트, 자해대미지의 선파이어 중 전략적 선택이 가능하고, 마나만 있으면 스택이나 셋업 없이 사용턴 600%의 공격을 더홀리도 피니셔로 나쁘지 않다. 여신강림 상태에서 추가대미지가 붙지만, 현재 시스템에서는 사실상 달성불가. 마나를 극한으로 확보해서 발동한다면, 여신강림으로 100%증가한 마법공겨력으로 800%의 대미지를 넣을 수 있다.',
    skills: [
      makeGameSkill('sunfire', '선파이어', 50, 2, 'magic', 300, '마법공격력 300%, 자신생명력 20%소모', {
        hpCostPercent: 20
      }),
      makeGameSkill('absolute_light', '앱솔루트라이트', 70, 5, 'magic', 150, '마법공격력 150%, 사용횟수당 위력+100%(최대 650%)', {
        powerPerUse: 100,
        maxPower: 650
      }),
      makeGameSkill('judgment', '저지먼트', 70, 7, 'magic', 360, '마법공격력 360%, 명중률 70%', {
        accuracyPercent: 70
      }),
      makeGameSkill('the_holy', '더홀리', 100, 10, 'magic', 600, '마법공격력 600%, 다음 턴 자신 기절 (여신강림 상태에서 추가로 +200%)', {
        selfStunDelay: 1,
        selfStunDuration: 1,
        goddessBonusPower: 200
      })
    ]
  },
  {
    id: 'witch',
    name: '위치',
    glyph: '☾',
    color: '#a777ef',
    roles: ['magic', 'debuffer', 'evasion'],
    weaponRestrictions: ['staff'],
    armorRestrictions: ['heavy'],
    trait: {
      effect: 'witch_black_luck',
      text: '마법공격력 10%증가, 치명타확률 10%증가'
    },
    comment: '스태프를 사용할 수 없으나 마나 대비 마법공격의 위력은 강함, 확정 암흑 부여로 물리계 직업과 상성이 좋음, 상대의 마법방어감소나 자신의 회피율 증가 등 고효율 서포트가 많음, 치명타확률 증가 특성이 있으므로 치명타 계열 클래스와도 상성 좋음.',
    skills: [
      makeGameSkill('shadow_ball', '섀도우볼', 20, 2, 'magic', 110, '마법공격력 110%, 암흑 부여', {
        appliesStatus: 'darkness',
        stacks: 1
      }),
      makeGameSkill('phantom_raid', '팬텀레이드', 20, 5, 'physical', 140, '물리공격력 140%, 3턴간 상대 마방 20%감소', {
        targetDefense: 'mdef',
        reductionPercent: 20,
        duration: 3
      }),
      makeGameSkill('veil_of_darkness', '베일오브다크니스', 30, 7, 'magic', 100, '마법공격력 100%, 3턴간 회피율 +40%', {
        duration: 3,
        evasionBonusPercent: 40
      }),
      makeGameSkill('dark_meteor', '다크메테오', 40, 10, 'magic', 380, '마법공격력 380%, 암흑 부여, 사용 후 자신 스턴', {
        appliesStatus: 'darkness',
        stacks: 1,
        selfStunDuration: 1
      })
    ]
  },
  {
    id: 'assassin',
    name: '어쌔신',
    glyph: '‡',
    color: '#9b8aff',
    roles: ['physical', 'critical', 'burst'],
    weaponRestrictions: ['greatsword'],
    armorRestrictions: ['heavy'],
    trait: {
      effect: 'assassin_precision',
      text: '물리공격력 10%증가, 치명타대미지 30%증가'
    },
    comment: '아드레날린, 이클립스, 특성 조합으로 극딜이 가능한 물리딜러, 생존관련 스킬이 없으면서 방어력감소가 있고 중갑옷이 금지되어서 다소 위험한편, 이클립스를 메인으로 쓰기엔 마나소비가 극단적이고, 암흑 부여시 어썌신네일을 메인웨폰으로 쓸 수 있으나, 유일한 암흑부여 스킬이 암흑 기댓값이 낮은 크로스컷뿐이라, 치명타 스킬을 가진 클래스 혹은 위치와 조합 필요.',
    skills: [
      makeGameSkill('cross_cut', '크로스컷', 20, 2, 'physical', 140, '물리공격력 140%, 치명타 발생시 암흑 3스택 부여', {
        onCriticalStatus: 'darkness',
        onCriticalStacks: 3
      }),
      makeGameSkill('assassin_nail', '어쌔신네일', 30, 5, 'physical', 160, '물리공격력 160%, 적에게 부여된 암흑 스택 하나당 치명타 확률 30% 증가', {
        critPerDarknessStack: 30
      }),
      makeGameSkill('adrenaline', '아드레날린', 20, 7, 'buff', 0, '4턴간 치명타피해 +100%, 자신 방어력/마법방어력 25%감소', {
        duration: 4,
        critDamageBonusPercent: 100,
        defensePenaltyPercent: 25
      }),
      makeGameSkill('eclipse', '이클립스', 50, 10, 'physical', 270, '물리공격력 270%, 반드시 치명타 발생', {
        guaranteedCritical: true
      })
    ]
  },
  {
    id: 'phantom',
    name: '팬텀',
    glyph: '◈',
    color: '#70c2d4',
    roles: ['physical', 'evasion', 'counter'],
    weaponRestrictions: ['greatsword'],
    armorRestrictions: ['heavy'],
    trait: {
      effect: 'phantom_reflex',
      text: '물리공격력 10%증가, 마법방어력 20%증가'
    },
    comment: '회피를 바탕으로 한 대기만성형 클래스, 준수한 대미지의 확정회피 루나블레이드를 가져서 운영이 유연하다. 회피를 많이 쌓은 후 댄싱대거로 딜플랜을 회수 가능하지만, 댄싱대거로 누른 턴엔 회피를 못 누르고, 완성하는 과정에서도 주는 대미지에 비해 버텨야 하는 리스크가 있기 때문에 생존에 신경써야 한다.',
    skills: [
      makeGameSkill('genocide_step', '제노사이드스탭', 10, 2, 'physical', 50, '물리공격력 50%, 이번턴 회피율 +50%', {
        turnEvasionBonusPercent: 50
      }),
      makeGameSkill('instinct', '인스팅트', 10, 5, 'buff', 0, '5턴간 회피 +25%, 자신 방어력/마법방어력 25%감소', {
        duration: 5,
        evasionBonusPercent: 25,
        defensePenaltyPercent: 25
      }),
      makeGameSkill('dancing_dagger', '댄싱대거', 30, 7, 'physical', 60, '물리공격력 60%, 이번턴 성공한 회피횟수만큼 추가타 (최대 +4)', {
        extraHitsPerEvade: 1,
        maxExtraHits: 4
      }),
      makeGameSkill('luna_blade', '루나블레이드', 50, 10, 'magic', 300, '마법공격력 300%, 이번턴 회피율 +100%', {
        turnEvasionBonusPercent: 100
      })
    ]
  },
  {
    id: 'moon_sage',
    name: '달의현자',
    glyph: '☽',
    color: '#8aa8ff',
    roles: ['magic', 'form', 'evasion'],
    weaponRestrictions: ['greatsword', 'dagger'],
    armorRestrictions: ['heavy', 'light'],
    trait: {
      effect: 'moon_sage_wisdom',
      text: '마법방어력 20%증가, 마나회복 4증가, 꿈의결정 1증가'
    },
    comment: '전투자원 중 꿈의결정을 사용해서 달의형태를 발동하는 클래스. 달의형태 자체가 독보적으로 우수한 마법클래스 보조버프이며, 특성과 생존관련 스킬들도 유용하다. 또한, 달의형태 상태에서는 스킬들도 강화된다. 현자 클래스를 1개 선택하면 꿈의결정이 1개지만, 3개를 전부 고르면 꿈의결정은 최대 5개가 된다. 초탄은 200%이지만, 후속은 바로 500%가 되며, 3개의 현자 클래스를 선택해서 5번째의 꿈의형태 발동시의 배율은 1400%가 된다.',
    skills: [
      makeGameSkill('moon_form', '달의형태', 10, 2, 'buff', 0, '꿈의결정을 소모하고 3턴간 마공 50%증가', {
        dreamCrystalCost: 1,
        form: 'moon',
        duration: 3,
        matkBonusPercent: 50
      }),
      makeGameSkill('moonlight_veil', '문라이트베일', 20, 4, 'magic', 130, '마법공격력 130%, 달의형태일시 3턴간 회피율 +40%', {
        requiredForm: 'moon',
        duration: 3,
        evasionBonusPercent: 40
      }),
      makeGameSkill('moon_force', '문포스', 20, 6, 'hybrid', 100, '물리공격력50% + 마법공격력50%, 치명타시 마나 40 회복', {
        physicalPower: 50,
        magicPower: 50,
        manaOnCritical: 40
      }),
      makeGameSkill('silent_serena', '사일런트세레나', 40, 8, 'magic', 200, '마법공격력 200%, 달의형태시 +40%', {
        requiredForm: 'moon',
        formBonusPower: 40
      }),
      makeGameSkill('dream_form', '꿈의형태', 50, 10, 'special', 200, '기본적으로 마법공격력 200% 형태를 해제하고 꿈의마법 발동', {
        consumesForm: true,
        starBonusPower: 200,
        starEvasionPercent: 100,
        moonPowerPerUse: 300,
        sunPowerPerCrystal: 150
      })
    ]
  },
  {
    id: 'star_sage',
    name: '별의현자',
    glyph: '★',
    color: '#d7b8ff',
    roles: ['tank', 'form', 'hybrid'],
    weaponRestrictions: ['greatsword', 'staff'],
    armorRestrictions: [],
    trait: {
      effect: 'star_sage_wisdom',
      text: '물리방어력 20%증가, 마법방어력 20%증가, 마나회복2증가, 꿈의결정 1증가'
    },
    comment: '전투자원 중 꿈의결정을 사용해서 별의형태를 발동하는 클래스. 구성이 팔라딘보다 더 수비적이며, 방어구 타입에 관계 없이 고효율 가드를 사용 가능하다. 특성, 별의형태, 밀크쉐이크가 각각 방어버프를 추가로 제공하며, 스타배리어와 꿈의형태도 대단히 수비적인 클래스. 꿈의형태는 별의형태를 소모할시 400%+회피를 발동하게 된다.',
    skills: [
      makeGameSkill('star_form', '별의형태', 10, 2, 'buff', 0, '꿈의결정을 소모하고 3턴간 방어/마법방어력 50%증가', {
        dreamCrystalCost: 1,
        form: 'star',
        duration: 3,
        defenseBonusPercent: 50
      }),
      makeGameSkill('star_barrier', '스타배리어', 10, 4, 'buff', 0, '피해60%감소, (별의형태시 80%감소)', {
        damageReductionPercent: 60,
        starDamageReductionPercent: 80,
        duration: 1
      }),
      makeGameSkill('star_powder_milkshake', '스타파우더밀크쉐이크', 100, 6, 'buff', 0, '생명력 30%회복, 별의형태일시 10턴간 방어/마법방어력 30%증가', {
        healPercent: 30,
        requiredForm: 'star',
        duration: 10,
        defenseBonusPercent: 30
      }),
      makeGameSkill('milky_way_ecstasy', '밀키웨이엑스터시', 40, 8, 'hybrid', 220, '물리공격력 110% + 마법공격력 110%, 1턴 차징 필요', {
        physicalPower: 110,
        magicPower: 110,
        chargeTurns: 1
      }),
      makeGameSkill('dream_form', '꿈의형태', 50, 10, 'special', 200, '마법공격력 200% 형태를 해제하고 꿈의마법 발동', {
        consumesForm: true,
        starBonusPower: 200,
        starEvasionPercent: 100,
        moonPowerPerUse: 300,
        sunPowerPerCrystal: 150
      })
    ]
  },
  {
    id: 'sun_sage',
    name: '태양의현자',
    glyph: '☼',
    color: '#ff9e4b',
    roles: ['physical', 'form', 'critical'],
    weaponRestrictions: ['greatsword'],
    armorRestrictions: ['heavy'],
    trait: {
      effect: 'sun_sage_wisdom',
      text: '치명타대미지 30%증가, 마나회복 2증가, 꿈의결정 1증가'
    },
    comment: '태양의형태는 꿈의결정뿐만이 아니라 마나 소모도 크고 패널티도 있지만, 사실상 후속 물리클래스의 배율을 전부 2배로 늘린다. 갓핸드도 실질 500%로 작동하며, 메테오스매시 역시 치명타 클래스와도 궁합이 좋고 자체도 우수한 편. 꿈의형태는 3개의 결정을 가진 상태에서 사용하면 태양의형태 발동 시점에서 2개가 남으므로 200+300%의 합 500% 대미지를 주며 갈수록 대미지가 낮아진다. 다른 현자 클래스와 다르게 형태를 해제하는 피니셔인 꿈의형태에 의존하기보다는 태양의형태의 직접강화효과를 유지하며 싸우는 편. 그래도 3개의 현자를 전부 고르고 5개의 꿈의결정을 가진 상태에서 4개를 남기고 사용하면 바로 200%+600% = 800%를 2턴째에 넣을 수 있어서 초반 압박력은 최정상급.',
    skills: [
      makeGameSkill('sun_form', '태양의형태', 50, 2, 'buff', 0, '꿈의결정을 소모하고 3턴간 물리공격력 100%증가, 자신 물리방어력 50%감소', {
        dreamCrystalCost: 1,
        form: 'sun',
        duration: 3,
        atkBonusPercent: 100,
        defPenaltyPercent: 50
      }),
      makeGameSkill('pang_pang_punch', '팡팡펀치', 10, 4, 'physical', 120, '물리공격력 120%, 3턴간 적의 마법방어력 20%감소', {
        targetDefense: 'mdef',
        reductionPercent: 20,
        duration: 3
      }),
      makeGameSkill('god_hand', '갓핸드', 30, 6, 'physical', 170, '물리공격력 170%, 태양의형태시 +80%', {
        requiredForm: 'sun',
        formBonusPower: 80
      }),
      makeGameSkill('meteor_smash', '메테오스매시', 40, 8, 'physical', 220, '물리공격력 220%, 태양의형태시 3턴간 자신 치명타율 +40%', {
        requiredForm: 'sun',
        duration: 3,
        critChanceBonusPercent: 40
      }),
      makeGameSkill('dream_form', '꿈의형태', 50, 10, 'special', 200, '마법공격력 200% 형태를 해제하고 꿈의마법 발동', {
        consumesForm: true,
        starBonusPower: 200,
        starEvasionPercent: 100,
        moonPowerPerUse: 300,
        sunPowerPerCrystal: 150
      })
    ]
  },
  {
    id: 'gardener',
    name: '가드너',
    glyph: '❀',
    color: '#ef729d',
    roles: ['hybrid', 'damage_over_time', 'control'],
    weaponRestrictions: [],
    armorRestrictions: [],
    trait: {
      effect: 'gardener_bloom',
      text: '물리공격력 10%증가, 마법공격력 10%증가'
    },
    comment: '물리 마법을 하이브리드로 운영하는 클래스, 장미를 키워서 적에게 지속대미지를 준다. 장미는 스택당 물리5%, 마법5%이므로 물리와 마법이 비슷하다는 가정하에 사실상 10%이고, 최대 15스택이 누적되므로 풀스택시 실질 매턴 150%가 된다. 풀스택을 쌓아야만 의미가 생기는게 아니고, 쌓는 과정에서도 지속적으로 대미지를 누적하기에 전투가 길어질수록 효율이 좋은편, 장미를 확정적으로 적극적으로 부여하는 스킬이 많고, 장미를 소모해서 기절을 부여하는 방어적 운용도 가능하다. 퀸즈도메인은 풀스택 장미 대미지가 150%씩이므로 3턴 합계가 최대 450%가 된다. 보기엔 화려하지 않지만 방어적 클래스와 조합시 비대칭적인 악몽이 될 수 있다. 장비 제한도 없기에 보조클래스로도 대단히 우수',
    skills: [
      makeGameSkill('rose_shot', '로즈샷', 10, 2, 'magic', 110, '마법공격력 110%, 적에게 장미스택 부여', {
        appliesStatus: 'rose',
        stacks: 1
      }),
      makeGameSkill('flower_dance', '플라워댄스', 20, 4, 'physical', 130, '물리공격력 130%, 3턴간 회피율 20%', {
        duration: 3,
        evasionBonusPercent: 20
      }),
      makeGameSkill('quick_grow', '퀵그로우', 20, 5, 'special', 0, '적에게 장미 3스택 부여', {
        appliesStatus: 'rose',
        stacks: 3
      }),
      makeGameSkill('rose_prison', '로즈프리즌', 20, 7, 'special', 0, '장미 3스택 소모후 적에게 기절 부여', {
        consumesStatus: 'rose',
        consumesStacks: 3,
        appliesStatus: 'stun',
        duration: 1
      }),
      makeGameSkill('wild_root', '와일드루트', 30, 8, 'magic', 320, '마법공격력 320%, 적에게 장미 2스택 부여 후 자신 다음턴 기절', {
        appliesStatus: 'rose',
        stacks: 2,
        selfStunDelay: 1,
        selfStunDuration: 1
      }),
      makeGameSkill('queens_domain', '퀸즈도메인', 50, 10, 'buff', 0, '3턴간장미스택 피해 2배', {
        duration: 3,
        roseDamageMultiplier: 2
      })
    ]
  },
  {
    id: 'breaker',
    name: '브레이커',
    glyph: '✤',
    color: '#d94f76',
    roles: ['hybrid', 'critical', 'rose'],
    weaponRestrictions: ['staff'],
    armorRestrictions: [],
    trait: {
      effect: 'breaker_thorns',
      text: '치명타확률 10%증가, 마법방어력 20%증가'
    },
    comment: '상당히 우수한 보조스킬인 로열블룸을 가지지만, 장미와 시너지가 좋지는 않다. 보조용 클래스로써의 기술. 전체적으로 공격적인 스킬 구성이지만, 치명타 계열 특성의 클래스나, 치명타계열 스킬을 조합하지 않는 이상, 하트피어스는 마나 대비 대미지와 장미효율이 둘 다 애매하다. 확정 바인휩으로 1스택씩 장미를 쌓는것도 대미지와 턴 양쪽에서 효율적이지 않다. 피날레는 400%의 단품으로도 마법스킬 치고 우수한편이지만, 스태프 착용이 제한된다는 단점이 있다. 장미스택을 쌓을수 있는 가드너와 조합하면, 장미도트대미지로 운영하다가 피니셔로 사용가능한데, 해당 조합에서 효율이 크게 오른다.',
    skills: [
      makeGameSkill('vine_whip', '바인휩', 10, 2, 'physical', 120, '물리공격력 120%,적에게 장미스택 부여', {
        appliesStatus: 'rose',
        stacks: 1
      }),
      makeGameSkill('cruel_thorn', '크루얼쏜', 30, 4, 'physical', 170, '물리공격력 170%, 4턴간 적 마법방어력 20%감소', {
        targetDefense: 'mdef',
        reductionPercent: 20,
        duration: 4
      }),
      makeGameSkill('royal_focus', '로열포커스', 20, 5, 'physical', 150, '물리공격력 150%, 3턴간 치명타율 +25%', {
        duration: 3,
        critChanceBonusPercent: 25
      }),
      makeGameSkill('royal_bloom', '로열블룸', 30, 7, 'buff', 0, '3턴간 물리공격력/마법공격력 30%증가, 3턴 후 모든 장미가 시든다.', {
        duration: 3,
        atkBonusPercent: 30,
        matkBonusPercent: 30,
        clearsRoseOnExpire: true
      }),
      makeGameSkill('heart_pierce', '하트피어스', 40, 8, 'physical', 220, '물리공격력 220%, 치명타시 장미 6스택 획득', {
        onCriticalStatus: 'rose',
        onCriticalStacks: 6
      }),
      makeGameSkill('finale', '피날레', 50, 10, 'magic', 400, '마법공격력 400%, 모든 장미스택을 폭발 (스택당 +40%)', {
        consumesStatus: 'rose',
        consumesAllStacks: true,
        stackBonusPower: 40
      })
    ]
  }
];

// A class is useful as soon as it is selected. Later skills retain their
// original mastery gates, while the first skill is granted at mastery 1.
CLASS_DATA.forEach((entry) => {
  if (entry.skills[0]) entry.skills[0].unlock = 1;
});

const DUMMY_ENEMY = {
  id: 'demon_king_dummy',
  name: '마왕의 허상',
  glyph: '♛',
  sprite: '마왕.png',
  stats: {
    maxHp: 300,
    atk: 50,
    matk: 50,
    def: 40,
    mdef: 40
  },
  actions: [
    {
      id: 'enemy_normal_attack',
      name: '마왕의 일격',
      chance: 70,
      type: 'physical',
      power: 100
    },
    {
      id: 'enemy_arcane_blast',
      name: '심연 마법',
      chance: 30,
      type: 'magic',
      power: 200
    }
  ]
};

const PLAYER_SPRITE = '루미.png';

const DUNGEONS = [
  {
    id: 'dungeon_1',
    order: 1,
    name: '망각의 회랑',
    glyph: 'Ⅰ',
    unlockLevel: 1,
    levelRange: [1, 3],
    recommendedLevel: 1,
    enemyLevel: 1,
    tier: 1,
    enemyId: 'demon_king_dummy',
    encounters: 1,
    encounterNames: ['회랑의 감시자'],
    enemyScale: 0.9,
    xp: 38,
    dropRate: 0.26,
    lootTierWeights: { 1: 88, 2: 10, 3: 2 },
    description: '기억을 잃은 석상들이 푸른 안개 속에서 여행자를 지켜본다.'
  },
  {
    id: 'dungeon_2',
    order: 2,
    name: '안개 낀 묘원',
    glyph: 'Ⅱ',
    unlockLevel: 4,
    levelRange: [4, 6],
    recommendedLevel: 4,
    enemyLevel: 4,
    tier: 1,
    enemyId: 'demon_king_dummy',
    encounters: 1,
    encounterNames: ['묘원의 파수꾼'],
    enemyScale: 1.18,
    xp: 72,
    dropRate: 0.29,
    lootTierWeights: { 1: 82, 2: 15, 3: 3 },
    description: '이름 없는 묘비마다 밤이 되면 희미한 불꽃이 피어난다.'
  },
  {
    id: 'dungeon_3',
    order: 3,
    name: '녹슨 시계탑',
    glyph: 'Ⅲ',
    unlockLevel: 7,
    levelRange: [7, 9],
    recommendedLevel: 7,
    enemyLevel: 7,
    tier: 2,
    enemyId: 'demon_king_dummy',
    encounters: 1,
    encounterNames: ['태엽 망령'],
    enemyScale: 1.52,
    xp: 125,
    dropRate: 0.32,
    lootTierWeights: { 1: 12, 2: 76, 3: 10, 4: 2 },
    description: '멈춘 톱니 사이로 과거의 전투가 자정마다 되풀이된다.'
  },
  {
    id: 'dungeon_4',
    order: 4,
    name: '가시나무 정원',
    glyph: 'Ⅳ',
    unlockLevel: 10,
    levelRange: [10, 12],
    recommendedLevel: 10,
    enemyLevel: 10,
    tier: 2,
    enemyId: 'demon_king_dummy',
    encounters: 2,
    encounterNames: ['가시 시종', '장미의 문지기'],
    enemyScale: 1.95,
    xp: 205,
    dropRate: 0.35,
    lootTierWeights: { 1: 8, 2: 74, 3: 15, 4: 3 },
    description: '검붉은 장미가 침입자의 발자국을 따라 조용히 고개를 든다.'
  },
  {
    id: 'dungeon_5',
    order: 5,
    name: '침묵의 수도원',
    glyph: 'Ⅴ',
    unlockLevel: 13,
    levelRange: [13, 15],
    recommendedLevel: 13,
    enemyLevel: 13,
    tier: 3,
    enemyId: 'demon_king_dummy',
    encounters: 2,
    encounterNames: ['침묵의 사제', '타락한 수도원장'],
    enemyScale: 2.48,
    xp: 315,
    dropRate: 0.38,
    lootTierWeights: { 2: 12, 3: 74, 4: 11, 5: 3 },
    description: '종은 사라졌지만 그 울림만은 빈 예배당을 떠돌고 있다.'
  },
  {
    id: 'dungeon_6',
    order: 6,
    name: '유리 사막',
    glyph: 'Ⅵ',
    unlockLevel: 16,
    levelRange: [16, 18],
    recommendedLevel: 16,
    enemyLevel: 16,
    tier: 3,
    enemyId: 'demon_king_dummy',
    encounters: 2,
    encounterNames: ['유리 사냥꾼', '사막의 마도왕'],
    enemyScale: 3.12,
    xp: 455,
    dropRate: 0.41,
    lootTierWeights: { 2: 8, 3: 72, 4: 15, 5: 5 },
    description: '별빛에 녹은 모래가 칼날 같은 지평선을 만든다.'
  },
  {
    id: 'dungeon_7',
    order: 7,
    name: '별이 잠든 수로',
    glyph: 'Ⅶ',
    unlockLevel: 19,
    levelRange: [19, 21],
    recommendedLevel: 19,
    enemyLevel: 19,
    tier: 4,
    enemyId: 'demon_king_dummy',
    encounters: 2,
    encounterNames: ['수로의 별먹이', '잠든 성좌수'],
    enemyScale: 3.9,
    xp: 630,
    dropRate: 0.44,
    lootTierWeights: { 3: 13, 4: 79, 5: 8 },
    description: '검은 물결 아래 잠든 별들이 오래된 주문을 속삭인다.'
  },
  {
    id: 'dungeon_8',
    order: 8,
    name: '붉은 월식 성채',
    glyph: 'Ⅷ',
    unlockLevel: 22,
    levelRange: [22, 24],
    recommendedLevel: 22,
    enemyLevel: 22,
    tier: 4,
    enemyId: 'demon_king_dummy',
    encounters: 3,
    encounterNames: ['월식 보초', '붉은 기사', '성채의 폭군'],
    enemyScale: 4.82,
    xp: 845,
    dropRate: 0.47,
    lootTierWeights: { 3: 9, 4: 78, 5: 13 },
    description: '월식이 끝나지 않는 성벽에 붉은 깃발만이 펄럭인다.'
  },
  {
    id: 'dungeon_9',
    order: 9,
    name: '무저갱의 왕좌',
    glyph: 'Ⅸ',
    unlockLevel: 25,
    levelRange: [25, 27],
    recommendedLevel: 25,
    enemyLevel: 25,
    tier: 5,
    enemyId: 'demon_king_dummy',
    encounters: 3,
    encounterNames: ['심연의 전령', '왕좌의 집행자', '무저갱의 군주'],
    enemyScale: 5.9,
    xp: 1100,
    dropRate: 0.5,
    lootTierWeights: { 4: 18, 5: 82 },
    description: '끝없는 계단 아래 누구도 앉지 않은 왕좌가 도전자를 기다린다.'
  },
  {
    id: 'dungeon_10',
    order: 10,
    name: '종언의 천문궁',
    glyph: 'Ⅹ',
    unlockLevel: 28,
    levelRange: [28, 30],
    recommendedLevel: 28,
    enemyLevel: 28,
    tier: 5,
    enemyId: 'demon_king_dummy',
    encounters: 3,
    encounterNames: ['종말 관측자', '천궁의 대마도사', '마왕의 진체'],
    enemyScale: 7.15,
    xp: 1420,
    dropRate: 0.54,
    lootTierWeights: { 4: 12, 5: 88 },
    description: '부서진 천구의가 마지막 밤의 운명을 천천히 계산한다.'
  }
];

const EQUIPMENT_CATALOG = [
  {
    id: 'greatsword_t1',
    name: '무딘 철제 대검',
    slot: 'weapon',
    type: 'greatsword',
    tier: 1,
    stats: { atk: 20, matk: 8 },
    armorSkills: [],
    text: '물리공격력 매우 높음. 마법공격력 보통.',
    flavor: '수많은 흠집이 남았지만 묵직한 날은 아직 믿을 만하다.'
  },
  {
    id: 'greatsword_t2',
    name: '월광 강철 대검',
    slot: 'weapon',
    type: 'greatsword',
    tier: 2,
    stats: { atk: 40, matk: 12 },
    armorSkills: [],
    text: '물리공격력 매우 높음. 마법공격력 보통.',
    flavor: '달빛을 머금은 강철이 휘두를 때마다 낮은 울음을 낸다.'
  },
  {
    id: 'greatsword_t3',
    name: '마룡척추 대검',
    slot: 'weapon',
    type: 'greatsword',
    tier: 3,
    stats: { atk: 60, matk: 16 },
    armorSkills: [],
    text: '물리공격력 매우 높음. 마법공격력 보통.',
    flavor: '마룡의 척추를 통째로 벼려 만든 난폭한 무기.'
  },
  {
    id: 'greatsword_t4',
    name: '붉은 월식의 대검',
    slot: 'weapon',
    type: 'greatsword',
    tier: 4,
    stats: { atk: 80, matk: 20 },
    armorSkills: [],
    text: '물리공격력 매우 높음. 마법공격력 보통.',
    flavor: '붉은 빛이 칼날을 따라 흐르며 주변의 그림자를 삼킨다.'
  },
  {
    id: 'greatsword_t5',
    name: '종언검 라그니르',
    slot: 'weapon',
    type: 'greatsword',
    tier: 5,
    stats: { atk: 100, matk: 24 },
    armorSkills: [],
    text: '물리공격력 매우 높음. 마법공격력 보통.',
    flavor: '한 시대의 끝을 알렸다고 전해지는 전설의 대검.'
  },
  {
    id: 'dagger_t1',
    name: '사냥꾼의 단검',
    slot: 'weapon',
    type: 'dagger',
    tier: 1,
    stats: { atk: 10, matk: 8, critChance: 0.1 },
    armorSkills: [],
    text: '물리공격력 보통. 마법공격력 보통. 치명타확률 10%증가.',
    flavor: '손에 익기 쉬워 빈틈을 노리는 데 알맞다.'
  },
  {
    id: 'dagger_t2',
    name: '안개걸음 단검',
    slot: 'weapon',
    type: 'dagger',
    tier: 2,
    stats: { atk: 20, matk: 16, critChance: 0.1 },
    armorSkills: [],
    text: '물리공격력 보통. 마법공격력 보통. 치명타확률 10%증가.',
    flavor: '희뿌연 날이 움직임의 잔상을 흐린다.'
  },
  {
    id: 'dagger_t3',
    name: '밤까마귀 송곳니',
    slot: 'weapon',
    type: 'dagger',
    tier: 3,
    stats: { atk: 30, matk: 24, critChance: 0.1 },
    armorSkills: [],
    text: '물리공격력 보통. 마법공격력 보통. 치명타확률 10%증가.',
    flavor: '그림자 속 급소를 찾아 스스로 방향을 트는 기묘한 칼날.'
  },
  {
    id: 'dagger_t4',
    name: '허무의 쌍월도',
    slot: 'weapon',
    type: 'dagger',
    tier: 4,
    stats: { atk: 40, matk: 32, critChance: 0.1 },
    armorSkills: [],
    text: '물리공격력 보통. 마법공격력 보통. 치명타확률 10%증가.',
    flavor: '초승달을 닮은 날이 두 겹의 상처를 남긴다.'
  },
  {
    id: 'dagger_t5',
    name: '운명절단 네메시스',
    slot: 'weapon',
    type: 'dagger',
    tier: 5,
    stats: { atk: 50, matk: 40, critChance: 0.1 },
    armorSkills: [],
    text: '물리공격력 보통. 마법공격력 보통. 치명타확률 10%증가.',
    flavor: '보이지 않는 운명의 실마저 끊는다는 전설의 단검.'
  },
  {
    id: 'staff_t1',
    name: '견습생의 스태프',
    slot: 'weapon',
    type: 'staff',
    tier: 1,
    stats: { atk: 5, matk: 30, maxMana: 30 },
    armorSkills: [],
    text: '마법공격력 높음. 물리공격력 낮음. 마나 30증가.',
    flavor: '작은 마나석이 주문의 첫 문장을 또렷하게 잡아준다.'
  },
  {
    id: 'staff_t2',
    name: '푸른 별의 스태프',
    slot: 'weapon',
    type: 'staff',
    tier: 2,
    stats: { atk: 10, matk: 50, maxMana: 30 },
    armorSkills: [],
    text: '마법공격력 높음. 물리공격력 낮음. 마나 30증가.',
    flavor: '끝에 박힌 청금석에서 서늘한 별빛이 맴돈다.'
  },
  {
    id: 'staff_t3',
    name: '유리 사막의 지팡이',
    slot: 'weapon',
    type: 'staff',
    tier: 3,
    stats: { atk: 15, matk: 70, maxMana: 30 },
    armorSkills: [],
    text: '마법공격력 높음. 물리공격력 낮음. 마나 30증가.',
    flavor: '응결된 마력이 투명한 몸체 속에서 모래처럼 흐른다.'
  },
  {
    id: 'staff_t4',
    name: '천문궁의 성좌봉',
    slot: 'weapon',
    type: 'staff',
    tier: 4,
    stats: { atk: 20, matk: 90, maxMana: 30 },
    armorSkills: [],
    text: '마법공격력 높음. 물리공격력 낮음. 마나 30증가.',
    flavor: '별자리의 움직임에 따라 주문의 궤도가 바뀐다.'
  },
  {
    id: 'staff_t5',
    name: '무한성좌 아스트라',
    slot: 'weapon',
    type: 'staff',
    tier: 5,
    stats: { atk: 25, matk: 110, maxMana: 30 },
    armorSkills: [],
    text: '마법공격력 높음. 물리공격력 낮음. 마나 30증가.',
    flavor: '사라진 별들의 이름을 모두 기억하는 전설의 스태프.'
  },
  {
    id: 'orb_t1',
    name: '흐린 유리 오브',
    slot: 'weapon',
    type: 'orb',
    tier: 1,
    stats: { atk: 2, matk: 20, regen: 4 },
    armorSkills: [],
    text: '마법공격력 보통. 물리공격력 낮음. 마나회복 4증가.',
    flavor: '희미한 마력이 숨 쉬듯 밝아졌다 어두워진다.'
  },
  {
    id: 'orb_t2',
    name: '속삭이는 청옥',
    slot: 'weapon',
    type: 'orb',
    tier: 2,
    stats: { atk: 4, matk: 40, regen: 4 },
    armorSkills: [],
    text: '마법공격력 보통. 물리공격력 낮음. 마나회복 4증가.',
    flavor: '집중하면 오래된 주문의 속삭임이 들린다.'
  },
  {
    id: 'orb_t3',
    name: '월해의 진주',
    slot: 'weapon',
    type: 'orb',
    tier: 3,
    stats: { atk: 6, matk: 60, regen: 4 },
    armorSkills: [],
    text: '마법공격력 보통. 물리공격력 낮음. 마나회복 4증가.',
    flavor: '검푸른 표면 안쪽에서 작은 달이 차오르고 기운다.'
  },
  {
    id: 'orb_t4',
    name: '심연의 검은 태양',
    slot: 'weapon',
    type: 'orb',
    tier: 4,
    stats: { atk: 8, matk: 80, regen: 4 },
    armorSkills: [],
    text: '마법공격력 보통. 물리공격력 낮음. 마나회복 4증가.',
    flavor: '빛을 삼킨 만큼 짙은 마력을 되돌려준다.'
  },
  {
    id: 'orb_t5',
    name: '영겁핵 이클리시아',
    slot: 'weapon',
    type: 'orb',
    tier: 5,
    stats: { atk: 10, matk: 100, regen: 4 },
    armorSkills: [],
    text: '마법공격력 보통. 물리공격력 낮음. 마나회복 4증가.',
    flavor: '멈춘 시간의 핵을 봉인한 전설의 오브.'
  },
  {
    id: 'heavy_armor_t1',
    name: '용병의 중갑옷',
    slot: 'armor',
    type: 'heavy',
    tier: 1,
    stats: { def: 30, mdef: 20 },
    armorSkills: ['guard'],
    text: '물리방어 매우높음. 마법방어 높음. 메인스킬 가드.',
    flavor: '투박하지만 정면의 일격을 묵묵히 받아낸다.'
  },
  {
    id: 'heavy_armor_t2',
    name: '은빛 성벽 갑주',
    slot: 'armor',
    type: 'heavy',
    tier: 2,
    stats: { def: 60, mdef: 40 },
    armorSkills: ['guard'],
    text: '물리방어 매우높음. 마법방어 높음. 메인스킬 가드.',
    flavor: '촘촘히 겹친 판금이 작은 성벽처럼 몸을 감싼다.'
  },
  {
    id: 'heavy_armor_t3',
    name: '마룡비늘 판금',
    slot: 'armor',
    type: 'heavy',
    tier: 3,
    stats: { def: 90, mdef: 60 },
    armorSkills: ['guard'],
    text: '물리방어 매우높음. 마법방어 높음. 메인스킬 가드.',
    flavor: '불길과 저주를 견딘 비늘이 갑주의 이음새를 지킨다.'
  },
  {
    id: 'heavy_armor_t4',
    name: '월식 수호자의 갑주',
    slot: 'armor',
    type: 'heavy',
    tier: 4,
    stats: { def: 120, mdef: 80 },
    armorSkills: ['guard'],
    text: '물리방어 매우높음. 마법방어 높음. 메인스킬 가드.',
    flavor: '붉은 월광이 피격 순간 방패 모양으로 번진다.'
  },
  {
    id: 'heavy_armor_t5',
    name: '불락성 아발론',
    slot: 'armor',
    type: 'heavy',
    tier: 5,
    stats: { def: 150, mdef: 100 },
    armorSkills: ['guard'],
    text: '물리방어 매우높음. 마법방어 높음. 메인스킬 가드.',
    flavor: '무너진 왕국의 마지막 성벽을 벼려 만든 전설의 갑주.'
  },
  {
    id: 'light_armor_t1',
    name: '순찰자의 경갑옷',
    slot: 'armor',
    type: 'light',
    tier: 1,
    stats: { def: 22, mdef: 14 },
    armorSkills: ['dodge_stance'],
    text: '물리방어 높음. 마법방어 보통. 메인스킬 회피태세.',
    flavor: '움직임을 막지 않도록 가죽과 얇은 철판을 엮었다.'
  },
  {
    id: 'light_armor_t2',
    name: '안개추적자 외투',
    slot: 'armor',
    type: 'light',
    tier: 2,
    stats: { def: 44, mdef: 22 },
    armorSkills: ['dodge_stance'],
    text: '물리방어 높음. 마법방어 보통. 메인스킬 회피태세.',
    flavor: '빠르게 몸을 틀면 잿빛 잔상이 뒤에 남는다.'
  },
  {
    id: 'light_armor_t3',
    name: '밤까마귀 전투복',
    slot: 'armor',
    type: 'light',
    tier: 3,
    stats: { def: 66, mdef: 30 },
    armorSkills: ['dodge_stance'],
    text: '물리방어 높음. 마법방어 보통. 메인스킬 회피태세.',
    flavor: '발소리와 옷깃의 마찰음까지 그림자 속에 감춘다.'
  },
  {
    id: 'light_armor_t4',
    name: '유성의 비늘옷',
    slot: 'armor',
    type: 'light',
    tier: 4,
    stats: { def: 88, mdef: 38 },
    armorSkills: ['dodge_stance'],
    text: '물리방어 높음. 마법방어 보통. 메인스킬 회피태세.',
    flavor: '유성 조각을 얇게 펴 만든 비늘이 몸의 흐름을 따른다.'
  },
  {
    id: 'light_armor_t5',
    name: '찰나의 날개 녹턴',
    slot: 'armor',
    type: 'light',
    tier: 5,
    stats: { def: 110, mdef: 46 },
    armorSkills: ['dodge_stance'],
    text: '물리방어 높음. 마법방어 보통. 메인스킬 회피태세.',
    flavor: '치명적인 순간마다 착용자를 반 박자 먼저 움직이는 전설의 경갑.'
  },
  {
    id: 'cloth_armor_t1',
    name: '수습 마도사의 천옷',
    slot: 'armor',
    type: 'cloth',
    tier: 1,
    stats: { def: 8, mdef: 20, maxMana: 20 },
    armorSkills: ['barrier', 'magic_guard'],
    text: '물리방어 낮음. 마법방어 보통. 마나 20증가. 메인스킬 배리어, 매직가드.',
    flavor: '기초 방호 주문이 옷자락을 따라 은은히 빛난다.'
  },
  {
    id: 'cloth_armor_t2',
    name: '달무리 예복',
    slot: 'armor',
    type: 'cloth',
    tier: 2,
    stats: { def: 16, mdef: 30, maxMana: 20 },
    armorSkills: ['barrier', 'magic_guard'],
    text: '물리방어 낮음. 마법방어 보통. 마나 20증가. 메인스킬 배리어, 매직가드.',
    flavor: '달빛으로 수놓은 문양이 마력을 고르게 순환시킨다.'
  },
  {
    id: 'cloth_armor_t3',
    name: '성운의 장포',
    slot: 'armor',
    type: 'cloth',
    tier: 3,
    stats: { def: 24, mdef: 40, maxMana: 20 },
    armorSkills: ['barrier', 'magic_guard'],
    text: '물리방어 낮음. 마법방어 보통. 마나 20증가. 메인스킬 배리어, 매직가드.',
    flavor: '깊은 밤을 닮은 천 위로 작은 성운이 천천히 흐른다.'
  },
  {
    id: 'cloth_armor_t4',
    name: '천문궁 대현자의 로브',
    slot: 'armor',
    type: 'cloth',
    tier: 4,
    stats: { def: 32, mdef: 50, maxMana: 20 },
    armorSkills: ['barrier', 'magic_guard'],
    text: '물리방어 낮음. 마법방어 보통. 마나 20증가. 메인스킬 배리어, 매직가드.',
    flavor: '별의 배열로 짠 결계가 강력한 주문을 흘려보낸다.'
  },
  {
    id: 'cloth_armor_t5',
    name: '영원의 밤 아르카나',
    slot: 'armor',
    type: 'cloth',
    tier: 5,
    stats: { def: 40, mdef: 60, maxMana: 20 },
    armorSkills: ['barrier', 'magic_guard'],
    text: '물리방어 낮음. 마법방어 보통. 마나 20증가. 메인스킬 배리어, 매직가드.',
    flavor: '세계가 처음 맞이한 밤의 조각으로 지었다는 전설의 로브.'
  }
];

const EQUIPMENT_GLYPHS = {
  greatsword: '†',
  dagger: '‡',
  staff: '⌁',
  orb: '◉',
  heavy: '▣',
  light: '◈',
  cloth: '✦'
};

EQUIPMENT_CATALOG.forEach(function assignEquipmentGlyph(item) {
  item.glyph = EQUIPMENT_GLYPHS[item.type];
});

const ARMOR_SKILLS = {
  guard: {
    id: 'guard',
    name: '가드',
    mp: 10,
    unlock: 0,
    type: 'buff',
    power: 0,
    effect: 'guard',
    text: '받는 대미지 반감',
    duration: 1,
    damageReductionPercent: 50,
    source: 'heavy'
  },
  dodge_stance: {
    id: 'dodge_stance',
    name: '회피태세',
    mp: 10,
    unlock: 0,
    type: 'buff',
    power: 0,
    effect: 'dodge_stance',
    text: '회피율 50%',
    duration: 1,
    evasionPercent: 50,
    source: 'light'
  },
  barrier: {
    id: 'barrier',
    name: '배리어',
    mp: 20,
    unlock: 0,
    type: 'buff',
    power: 0,
    effect: 'barrier',
    text: '물리공격 무효화',
    duration: 1,
    nullifies: 'physical',
    source: 'cloth'
  },
  magic_guard: {
    id: 'magic_guard',
    name: '매직가드',
    mp: 20,
    unlock: 0,
    type: 'buff',
    power: 0,
    effect: 'magic_guard',
    text: '마법공격 무효화',
    duration: 1,
    nullifies: 'magic',
    source: 'cloth'
  }
};

const STATUS_INFO = {
  darkness: {
    id: 'darkness',
    name: '암흑',
    kind: 'debuff',
    glyph: '◐',
    color: '#8d6ad8',
    maxStacks: 5,
    text: '적의 방어력 10%감소, 최대 5스택',
    defReductionPerStackPercent: 10
  },
  rose: {
    id: 'rose',
    name: '장미',
    kind: 'debuff',
    glyph: '✿',
    color: '#ef4770',
    maxStacks: 15,
    text: '스택당 매턴 물리공격력5%+마법공격력5%에 해당하는 마법피해를 입힌다. 최대 15스택',
    atkPowerPerStack: 5,
    matkPowerPerStack: 5,
    damageType: 'magic'
  },
  divine: {
    id: 'divine',
    name: '디바인',
    kind: 'buff',
    glyph: '✧',
    color: '#ffd96d',
    maxStacks: 10,
    text: '스택당 물리방어력/마법방어력 2%증가, 최대 10스택',
    defenseBonusPerStackPercent: 2
  },
  stun: {
    id: 'stun',
    name: '기절',
    kind: 'debuff',
    glyph: '✹',
    color: '#ffb65c',
    maxStacks: 1,
    text: '행동할 수 없음'
  },
  fire_enchant: {
    id: 'fire_enchant',
    name: '파이어인챈트',
    kind: 'buff',
    glyph: '♨',
    color: '#ff784e',
    maxStacks: 1,
    text: '물리공격시 마법공격력의 80% 추가타격'
  },
  divine_armor: {
    id: 'divine_armor',
    name: '디바인아머',
    kind: 'buff',
    glyph: '♜',
    color: '#ffd36a',
    maxStacks: 1,
    text: '방어력/마법방어력 30%증가, 피격시 디바인 획득'
  },
  meditation: {
    id: 'meditation',
    name: '메디테이션',
    kind: 'buff',
    glyph: '✦',
    color: '#7ee7ff',
    maxStacks: 1,
    text: '마나리젠 100%증가, 마법공격력 50%감소'
  },
  adrenaline: {
    id: 'adrenaline',
    name: '아드레날린',
    kind: 'buff',
    glyph: '‡',
    color: '#ef5b5b',
    maxStacks: 1,
    text: '치명타피해 100%증가, 방어력/마법방어력 25%감소'
  },
  instinct: {
    id: 'instinct',
    name: '인스팅트',
    kind: 'buff',
    glyph: '◈',
    color: '#70c2d4',
    maxStacks: 1,
    text: '회피율 25%증가, 방어력/마법방어력 25%감소'
  },
  moon_form: {
    id: 'moon_form',
    name: '달의형태',
    kind: 'form',
    glyph: '☽',
    color: '#8aa8ff',
    maxStacks: 1,
    text: '마법공격력 50%증가'
  },
  star_form: {
    id: 'star_form',
    name: '별의형태',
    kind: 'form',
    glyph: '★',
    color: '#d7b8ff',
    maxStacks: 1,
    text: '물리방어력/마법방어력 50%증가'
  },
  sun_form: {
    id: 'sun_form',
    name: '태양의형태',
    kind: 'form',
    glyph: '☼',
    color: '#ff9e4b',
    maxStacks: 1,
    text: '물리공격력 100%증가, 물리방어력 50%감소'
  },
  queens_domain: {
    id: 'queens_domain',
    name: '퀸즈도메인',
    kind: 'buff',
    glyph: '❀',
    color: '#ef729d',
    maxStacks: 1,
    text: '장미스택 피해 2배'
  },
  royal_bloom: {
    id: 'royal_bloom',
    name: '로열블룸',
    kind: 'buff',
    glyph: '✤',
    color: '#d94f76',
    maxStacks: 1,
    text: '물리공격력/마법공격력 30%증가, 종료시 모든 장미 제거'
  }
};
