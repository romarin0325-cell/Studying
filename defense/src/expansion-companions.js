// Sixteen companions adapted from the card game. Combat handlers are wired in the
// defense engine; this module owns their stable identities, numbers and copy.
const portraitCenters=Object.freeze({
  ancient_soul:[249,188],victoria:[250,183],deep_lord:[237,181],sakura:[249,207],
  dainichi_nyorai:[257,170],gumiho:[249,186],archangel:[266,194],sylphid:[245,197],
  succubus:[255,225],skull_dragon:[249,185],mad_scientist:[253,163],crystal_dancer:[256,191],
  blessing_tail:[241,229],marshmallow:[277,158],mimic:[253,203],silent_librarian:[253,195],
});

const art=id=>({
  atlas:'unit-'+id,row:0,columns:2,foot:.9375,scale:1,directional:true,
  portrait:{x:portraitCenters[id][0],y:portraitCenters[id][1],size:250},
});

export const EXPANSION_RARITIES=Object.freeze({
  UR:Object.freeze(['ancient_soul','victoria','deep_lord','sakura']),
  SR:Object.freeze(['dainichi_nyorai','gumiho','archangel','sylphid']),
  R:Object.freeze(['succubus','skull_dragon','mad_scientist','crystal_dancer']),
  C:Object.freeze(['blessing_tail','marshmallow','mimic','silent_librarian']),
});

export const EXPANSION_IDS=Object.freeze(Object.values(EXPANSION_RARITIES).flat());
// The memorial viewer uses this list to show its explicit "준비 중" state.
export const PENDING_MEMORIAL_IDS=Object.freeze([...EXPANSION_IDS]);

export const EXPANSION_HEROES=Object.freeze([
  {
    id:'ancient_soul',name:'에인션트소울',title:'성염을 품은 오래된 혼',color:'#f2b15f',art:art('ancient_soul'),
    damage:40,interval:1.15,range:520,radius:62,shape:'splash',attack:'fire',heightGroup:'medium',role:'화상·성광 · 영혼 수확',
    trait:{type:'burn_divine',text:'기본 공격이 7초간 화상과 성광을 부여합니다. 두 효과가 모두 있는 적에게 기본 공격 피해가 40% 증가합니다.'},
    skill:{name:'영혼수확',cost:80,type:'soul_harvest',text:'적 전체에 공격력 2배 피해를 주고, 각 적의 디버프 종류 1개당 피해가 +1.5배씩 증가합니다. 화상·성광·중독·감속·기절·노출·빙결은 유지됩니다.'},
  },
  {
    id:'victoria',name:'빅토리아',title:'기적을 지휘하는 금장',color:'#f1d26f',art:art('victoria'),
    damage:24,interval:1.2,range:550,radius:24,shape:'beam',attack:'light',heightGroup:'medium',role:'대열 지휘 · 전체 강화',
    trait:{type:'formation_command',text:'같은 행과 열의 다른 동료는 공격력이 12%, 공격 속도가 10% 증가합니다. 여러 빅토리아의 효과는 중첩되지 않습니다.'},
    skill:{name:'기적의증명',cost:80,type:'miracle_proof',text:'8초간 모든 동료의 공격력을 35%, 공격 속도를 20% 증가시킵니다. 현재 기절을 해제하고, 각자가 다음 기절 1회를 무시합니다.'},
  },
  {
    id:'deep_lord',name:'심해의주인',title:'월광 해류의 군주',color:'#55bfc2',art:art('deep_lord'),
    damage:44,interval:1.55,range:510,radius:96,shape:'splash',attack:'water',heightGroup:'medium',role:'디버프 사냥 · 심해 포옹',
    trait:{type:'debuff_hunter',text:'디버프가 3종 이상인 적에게 주는 피해가 75% 증가합니다. 해당 적은 심해의 인장으로 표시됩니다.'},
    skill:{name:'심연의포옹',cost:75,type:'abyss_embrace',text:'적 전체에 공격력 3배 피해를 줍니다. 디버프가 3종 이상인 적에게는 9배 피해를 주고 경로 뒤로 밀친 뒤 1.2초간 기절시킵니다. 디버프는 유지됩니다.'},
  },
  {
    id:'sakura',name:'사쿠라',title:'불꽃 부적의 무녀',color:'#ef8ea0',art:art('sakura'),
    damage:32,interval:.85,range:560,radius:0,shape:'single',attack:'fire',heightGroup:'medium',role:'봉인 부적 · 빠른 단일',
    trait:{type:'sakura_seal',text:'4번째 기본 공격마다 분홍 부적이 터져 대상과 반경 90의 적에게 7초간 화상과 성광을 함께 부여합니다.'},
    skill:{name:'폭염부',cost:70,type:'blazing_seal',text:'적이 가장 밀집한 반경 150 범위에 공격력 6배 피해를 주고 화상을 부여합니다. 이미 화상과 성광이 모두 있는 적은 1.5초간 기절하며 기존 디버프는 유지됩니다.'},
  },
  {
    id:'dainichi_nyorai',name:'대일여래',title:'연화 광배의 현신',color:'#e8c86f',art:art('dainichi_nyorai'),
    damage:31,interval:1.45,range:260,radius:260,shape:'pulse',attack:'light',heightGroup:'tall',role:'강화 공명 · 대지의 축복',
    trait:{type:'field_resonance',text:'현재 적용 중인 아군 강화 종류 1개당 공격력이 8% 증가합니다(최대 40%). 범위 공격이 성광이 있는 적에게 25% 추가 피해를 줍니다.'},
    skill:{name:'파쇄륜',cost:80,type:'vajra_wheel',text:'적 전체에 공격력 3배, 현재 아군 강화 종류 1개당 +1.5배 피해를 줍니다. 이어 모든 임시 아군 강화를 10초의 대지의 축복(공격력 +25%, 공격 속도 +15%)으로 압축합니다.'},
  },
  {
    id:'gumiho',name:'구미호',title:'물결을 놀리는 아홉 꼬리',color:'#8fd0e7',art:art('gumiho'),
    damage:38,interval:1.15,range:500,radius:145,shape:'bounce',attack:'fire',heightGroup:'medium',role:'동급 편성 · 여우불',
    trait:{type:'same_rarity',text:'편성한 5명의 등급이 모두 같으면 구미호의 공격력이 100% 증가합니다. 소환된 임시 동료는 편성 조건을 바꾸지 않습니다.'},
    skill:{name:'요화천벌',cost:75,type:'fox_judgment',text:'가장 앞선 적과 주변 4명에게 공격력 6배 피해를 줍니다. 화상 또는 성광이 있으면 9배, 둘 다 있으면 12배 피해를 주며 효과는 유지됩니다.'},
  },
  {
    id:'archangel',name:'대천사',title:'별빛 성역의 지휘자',color:'#f4dd83',art:art('archangel'),
    damage:25,interval:1.1,range:540,radius:24,shape:'beam',attack:'light',heightGroup:'medium',role:'성광 · 성역 지원',
    trait:{type:'holy_balance',text:'기본 공격이 관통하며 명중한 적에게 6초간 성광을 부여합니다. 인접한 동료는 기절에서 회복하는 속도가 50% 빠릅니다.'},
    skill:{name:'성역전개',cost:70,type:'sanctuary',text:'적 전체에 공격력 2.5배 피해와 성광을 부여합니다. 8초간 모든 동료의 공격력을 20% 증가시키고 다음 기절 1회를 무시하는 성역을 펼칩니다.'},
  },
  {
    id:'sylphid',name:'실피드',title:'질풍을 가르는 러너',color:'#9bdf62',art:art('sylphid'),
    damage:34,interval:.72,range:600,radius:0,shape:'single',attack:'wind',heightGroup:'medium',role:'개전 속공 · 질풍',
    trait:{type:'opening_gale',text:'매 웨이브 시작 후 10초간 공격력이 70%, 공격 속도가 30% 증가합니다. 이 동안 처치한 적 1명당 개전 효과가 0.5초 연장됩니다(최대 4초).'},
    skill:{name:'템페스트크로',cost:75,type:'tempest_claw',text:'12초간 실피드에게 질풍(공격력 +35%, 공격 속도 +40%)을 부여합니다. 발동 즉시 적 전체에 공격력 3배 피해를 주고 5초간 30% 감속시킵니다.'},
  },
  {
    id:'succubus',name:'서큐버스',title:'초승달빛 달콤한 꿈',color:'#e889bd',art:art('succubus'),
    damage:26,interval:.95,range:500,radius:0,shape:'single',attack:'shadow',heightGroup:'short',role:'유혹 · 밀쳐내기',
    trait:{type:'fatal_charm',text:'4번째 기본 공격마다 대상을 경로 뒤로 약간 밀치고 3초간 35% 감속시킵니다. 보스는 밀쳐내기 거리가 절반입니다.'},
    skill:{name:'다크판타지',cost:75,type:'dark_fantasy',text:'적이 가장 밀집한 반경 160 범위에 공격력 4배 피해를 주고 6초간 노출과 40% 감속을 부여합니다. 이미 감속 중인 적은 추가로 1.2초간 기절합니다.'},
  },
  {
    id:'skull_dragon',name:'스컬드래곤',title:'보라 불씨의 독룡',color:'#8560b8',art:art('skull_dragon'),
    damage:45,interval:1.75,range:480,radius:92,shape:'splash',attack:'shadow',heightGroup:'tall',role:'독거 · 위험한 브레스',
    trait:{type:'solitary_dragon',text:'상하좌우 인접한 칸에 동료가 하나도 없으면 공격력이 80%, 범위가 25% 증가합니다. 하나라도 생기면 즉시 해제됩니다.'},
    skill:{name:'스컬브레스',cost:85,type:'skull_breath',text:'적이 가장 밀집한 반경 190 범위에 공격력 14배 피해를 줍니다. 발동 후 반동으로 스컬드래곤은 3초간 기절합니다.'},
  },
  {
    id:'mad_scientist',name:'매드사이언티스트',title:'한계를 두 배로 시험하는 연구자',color:'#58bea9',art:art('mad_scientist'),
    damage:22,interval:1.3,range:470,radius:58,shape:'splash',attack:'syringe',heightGroup:'medium',role:'인접 촉매 · 고비용 실험',
    trait:{type:'mad_aura',text:'상하좌우 인접한 다른 동료의 공격력이 15%, 공격 속도가 10% 증가합니다. 여러 매드사이언티스트의 효과는 중첩되지 않습니다.'},
    skill:{name:'익스페리먼트',cost:100,type:'experiment',text:'적이 가장 밀집한 반경 150 범위에 공격력 7배 피해를 주고 10초간 중독과 7초간 노출을 부여합니다. 기절 또는 감속 중인 적에게는 12배 피해를 줍니다.'},
  },
  {
    id:'crystal_dancer',name:'수정의무희',title:'물빛 단검의 무인',color:'#76cde0',art:art('crystal_dancer'),
    damage:31,interval:.85,range:460,radius:120,shape:'bounce',attack:'ice',heightGroup:'medium',role:'반격 회피 · 연속 단검',
    trait:{type:'crystal_riposte',text:'보스의 기절 공격을 10초마다 1회 회피하고, 공격한 보스에게 공격력 4배 피해와 1초 기절을 되돌려줍니다.'},
    skill:{name:'하트브레이커',cost:75,type:'heartbreaker',text:'가장 앞선 적부터 최대 5명에게 공격력 6배 피해를 줍니다. 기절 중인 적에게는 12배 피해를 주고 기절을 1초 연장합니다.'},
  },
  {
    id:'blessing_tail',name:'블레싱테일',title:'별 축복을 담은 흰 꼬리',color:'#f1d478',art:art('blessing_tail'),
    damage:14,interval:1.05,range:520,radius:22,shape:'beam',attack:'light',heightGroup:'medium',role:'성광 · 합성 축복',
    trait:{type:'blessing_tail',text:'기본 공격이 관통하며 적에게 5초간 성광을 부여합니다. 합성 재료 또는 결과가 될 때 가장 앞선 적과 주변 적에게 8초간 성광을 부여합니다.'},
    skill:{name:'스타폭스테일',cost:60,type:'blessing_beam',text:'별빛 꼬리가 경로를 훑어 적 전체에 공격력 3배 피해를 주고 8초간 성광을 부여합니다. 성광이 있는 적은 4.5배 피해를 받습니다.'},
  },
  {
    id:'marshmallow',name:'마시멜로',title:'녹아도 달콤한 구름',color:'#f39bc1',art:art('marshmallow'),
    damage:20,interval:.9,range:430,radius:62,shape:'splash',attack:'sugar',heightGroup:'medium',role:'화상 · 태양의 축복',
    trait:{type:'melting_blessing',text:'기본 공격이 6초간 화상을 부여합니다. 합성 재료가 될 때 50% 확률로 8초간 모든 동료의 공격 속도를 20% 높이는 태양의 축복을 남깁니다.'},
    skill:{name:'멜팅허그',cost:60,type:'marshmallow_bomb',text:'적이 가장 밀집한 반경 150 범위에 공격력 5배 피해를 주고 7초간 화상과 4초간 30% 감속을 부여합니다.'},
  },
  {
    id:'mimic',name:'미믹',title:'웃는 자물쇠의 미끼',color:'#9b68be',art:art('mimic'),
    damage:28,interval:1.5,range:440,radius:76,shape:'splash',attack:'cards',heightGroup:'medium',role:'골드 약탈 · 보물상자',
    trait:{type:'mimic_loot',text:'미믹의 공격으로 적을 처치하면 1G를 추가로 얻습니다. 이 효과로 얻는 골드는 웨이브당 10G로 제한됩니다.'},
    skill:{name:'서프라이즈체스트',cost:65,type:'treasure_bite',text:'적이 가장 밀집한 반경 170 범위에 공격력 7배 피해를 줍니다. 이 공격으로 적을 처치하면 웨이브 추가 골드 제한과 무관하게 적당 2G를 얻습니다.'},
  },
  {
    id:'silent_librarian',name:'침묵의사서',title:'한 줄의 소음도 놓치지 않는 사서',color:'#799eb0',art:art('silent_librarian'),
    damage:18,interval:1.15,range:570,radius:0,shape:'single',attack:'cards',heightGroup:'medium',role:'노출 · 합성 파동',
    trait:{type:'silent_tome',text:'5번째 기본 공격마다 대상에게 7초간 노출을 부여합니다. 합성 재료 또는 결과가 될 때 자기 주변 반경 180의 적에게 공격력 3배 피해를 줍니다.'},
    skill:{name:'사일런스',cost:55,type:'silent_archive',text:'적 전체에 공격력 2배 피해를 주고 6초간 노출과 0.8초 기절을 부여합니다. 노출이 있던 적은 대신 1.4초간 기절합니다.'},
  },
]);

export const EXPANSION_VFX_ASSET_PATHS=Object.freeze({
  'effects-card-expansion-ur':'./assets/merge/effects-card-expansion-ur.webp',
  'effects-card-expansion-sr':'./assets/merge/effects-card-expansion-sr.webp',
  'effects-card-expansion-r':'./assets/merge/effects-card-expansion-r.webp',
  'effects-card-expansion-c':'./assets/merge/effects-card-expansion-c.webp',
});

export const EXPANSION_ASSET_PATHS=Object.freeze({
  ...Object.fromEntries(EXPANSION_IDS.map(id=>['unit-'+id,'./assets/cast-v2/'+id+'.webp'])),
  ...EXPANSION_VFX_ASSET_PATHS,
});
