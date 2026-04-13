(function () {
    function deepFreeze(value) {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
        Object.freeze(value);
        Object.keys(value).forEach(key => deepFreeze(value[key]));
        return value;
    }

    const COLOR_TOKENS = {
        gold: '#ffd700',
        danger: '#ef5350',
        accent: '#ff80ab',
        unlockedMode: '#e040fb',
        pendingBorder: '#555',
        pendingBackground: '#2a2a2a',
        pendingText: '#fff',
        mutedText: '#b0bec5'
    };

    const MISSION_THEME = {
        monthly: {
            clearedBorder: '#66bb6a',
            clearedBackground: 'rgba(102, 187, 106, 0.12)',
            clearedText: '#a5d6a7'
        },
        weekly: {
            clearedBorder: '#7e57c2',
            clearedBackground: 'rgba(126, 87, 194, 0.16)',
            clearedText: '#d1c4e9'
        },
        special: {
            clearedBorder: '#ffb74d',
            clearedBackground: 'rgba(255, 183, 77, 0.16)',
            clearedText: '#ffe0b2'
        }
    };

    const TOEIC_TYPE_LABELS = {
        default: '문제',
        part5: '파트5 문제',
        part6: '파트6 문제',
        part7: '파트7 문제'
    };

    const FIELD_BUFF_INFO = {
        sun_bless: '물공/마공 +30%, 치명타대미지 +60%',
        moon_bless: '마공 +30%, 회피율 +15%',
        sanctuary: '마공 +30%, 마방 +30%',
        goddess_descent: '물공/마공 +30%, 방어/마방 +30%',
        destiny_oath: '물공/마공 +30%, 방어/마방 +30%',
        earth_bless: '물공/마공 +25%',
        twinkle_party: '물공 +20%, 치명타율 +15%',
        star_powder: '방어/마방 +40%',
        valentine: '방어/마방 +50%',
        gale: '치명타율 +20%, 회피율 +20%',
        arena: '일반 공격 대미지 2배',
        reaper_realm: '치명타율 +40%, 치명타대미지 +40%'
    };

    const MODE_META = {
        origin: {
            id: 'origin',
            name: '오리진',
            allowedGameTypes: ['endless'],
            menuArea: 'gacha',
            desc: {
                endless: '기본 모드입니다.\n(성공조건: 없음 / 무한)'
            }
        },
        restriction: {
            id: 'restriction',
            name: '제약의 시련',
            allowedGameTypes: ['challenge'],
            menuArea: 'gacha',
            desc: {
                challenge: '뽑기/축복에서 레어 등급 이하만 등장합니다.\n(성공조건: 18 스테이지)'
            }
        },
        balance: {
            id: 'balance',
            name: '균형의 도전',
            allowedGameTypes: ['challenge'],
            menuArea: 'gacha',
            desc: {
                challenge: '뽑기/축복에서 에픽 등급 이하만 등장합니다.\n(성공조건: 18 스테이지)'
            }
        },
        suffering: {
            id: 'suffering',
            name: '고난의 여정',
            allowedGameTypes: ['challenge'],
            menuArea: 'gacha',
            desc: {
                challenge: '초기 10장, 클리어 보상 없음, 축복 카드 +2장.\n(성공조건: 24 스테이지)'
            }
        },
        overdrive: {
            id: 'overdrive',
            name: '오버드라이브',
            allowedGameTypes: ['challenge'],
            menuArea: 'gacha',
            desc: {
                challenge: '초기 10장, 클리어 보상 +1장, 축복 카드 +1장.\n(성공조건: 30 스테이지)'
            }
        },
        archive: {
            id: 'archive',
            name: '아카이브',
            allowedGameTypes: ['challenge'],
            menuArea: 'gacha',
            desc: {
                challenge: '매 스테이지 종료 후 문법 퀴즈. 정답률 80% 이상 필요.\n(성공조건: 18 스테이지)'
            }
        },
        curse: {
            id: 'curse',
            name: '저주의 증폭',
            allowedGameTypes: ['challenge'],
            menuArea: 'gacha',
            desc: {
                challenge: '디버프의 스탯 감소 효과 2배.\n(성공조건: 30 스테이지)'
            }
        },
        flood: {
            id: 'flood',
            name: '축복의 범람',
            allowedGameTypes: ['challenge'],
            menuArea: 'gacha',
            desc: {
                challenge: '필드 버프의 강화 효과 2배.\n(성공조건: 30 스테이지)'
            }
        },
        chaos: {
            id: 'chaos',
            name: '카오스',
            allowedGameTypes: ['challenge', 'endless'],
            menuArea: 'chaos',
            desc: {
                challenge: '매 전투 덱/인벤토리 초기화. 무작위 15장 풀에서 뽑기 진행.\n(성공조건: 24 스테이지 / 패배 시 데이터 삭제)',
                endless: '매 전투 덱/인벤토리 초기화. 무작위 15장 풀에서 뽑기 진행.\n(성공조건: 없음 / 무한 / 패배 시 데이터 삭제)'
            }
        },
        draft: {
            id: 'draft',
            name: '드래프트',
            allowedGameTypes: ['challenge', 'endless'],
            menuArea: 'draft',
            desc: {
                challenge: '뽑기 대신 덱 빌딩(드래프트)으로 3명을 선발하여 전투.\n(성공조건: 24 스테이지 / 패배 시 데이터 삭제)',
                endless: '뽑기 대신 덱 빌딩(드래프트)으로 3명을 선발하여 전투.\n(성공조건: 없음 / 무한 / 패배 시 데이터 삭제)'
            }
        },
        artifact: {
            id: 'artifact',
            name: '아티팩트',
            allowedGameTypes: ['challenge', 'endless'],
            menuArea: 'gacha',
            desc: {
                challenge: '매 보스(창조신) 클리어 시 아티팩트 획득 (최대 4개).\n고유한 아티팩트 효과로 전투를 유리하게!\n(성공조건: 36 스테이지)',
                endless: '매 보스(창조신) 클리어 시 아티팩트 획득 (최대 4개).\n고유한 아티팩트 효과로 전투를 유리하게!\n(성공조건: 없음 / 무한)'
            }
        },
        dream_corridor: {
            id: 'dream_corridor',
            name: '꿈의회랑',
            allowedGameTypes: ['endless'],
            menuArea: 'gacha',
            requiresHiddenStudyReady: true,
            desc: {
                endless: '학습용 히든 엔드리스 모드. 전투 종료 후 퀴즈가 자동 진행되며, 오답이 나오면 해당 런이 종료됩니다.\n(개인과외 이벤트 OFF 상태의 실전마법연습 5회로 출현)'
            }
        }
    };

    const BOOT_MODULES = [
        {
            src: 'data.js',
            label: '카드/적 데이터',
            requiredGlobal: ['CARDS', 'ENEMIES', 'BONUS_CARDS', 'TRANSCENDENCE_CARDS', 'BONUS_TRANSCENDENCE_CARDS']
        },
        {
            src: 'vocab_data.js',
            label: '단어 데이터',
            requiredGlobal: ['VOCAB_DATA']
        },
        {
            src: 'collocation_data.js',
            label: '연어 데이터',
            requiredGlobal: ['COLLOCATION_DATA']
        },
        {
            src: 'grammar_data.js',
            label: '문법 데이터',
            requiredGlobal: ['GRAMMAR_DATA']
        },
        {
            src: 'toeic.js',
            label: '토익 데이터',
            requiredGlobal: ['TOEIC_DATA']
        },
        {
            src: 'toeic_explanations.js',
            label: '토익 해설',
            requiredGlobal: ['TOEIC_EXPLANATIONS']
        },
        {
            src: 'api.js',
            label: 'API 모듈',
            requiredGlobal: ['GameAPI']
        },
        {
            src: 'logic.js',
            label: '게임 로직',
            requiredGlobal: ['GAME_CONSTANTS', 'Logic', 'SideEffects', 'GameUtils']
        },
        {
            src: 'battle_runtime.js',
            label: '전투 런타임',
            requiredGlobal: ['BattleRuntime']
        },
        {
            src: 'rpg_features.js',
            label: 'RPG Feature Modules',
            requiredGlobal: ['RPGFeatureModules']
        },
        {
            src: 'rpg_flow_modules.js',
            label: 'RPG Flow Modules',
            requiredGlobal: ['RPGFlowModules']
        }
    ];

    window.RPGConfig = deepFreeze({
        COLOR_TOKENS,
        MISSION_THEME,
        TOEIC_TYPE_LABELS,
        FIELD_BUFF_INFO,
        MODE_META,
        BOOT_MODULES
    });
})();
