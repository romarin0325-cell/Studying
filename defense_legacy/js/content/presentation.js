export const JOURNEYS = Object.freeze({
  ancient_ruins:{chapter:'01',title:'마도제국',subtitle:'별을 모방한 마음',note:'푸른 마력으로 움직이던 제국. 잠든 인조마신이 눈을 뜹니다.',art:0,color:'#729eb2'},
  crossroads:{chapter:'02',title:'빛의 신전',subtitle:'놓아주지 못한 사랑',note:'장미가 지키는 순백의 신전. 영원한 약속의 끝을 찾아갑니다.',art:1,color:'#c597ad'},
  long_boulevard:{chapter:'03',title:'어둠의 신전',subtitle:'일곱 빛깔의 저주',note:'달빛이 스민 성당. 깨진 무지개 너머로 저주가 번집니다.',art:2,color:'#9282b6'},
  fairy_forest:{chapter:'04',title:'요정의 숲',subtitle:'다시 피어나는 소원',note:'꽃잎이 이끄는 깊은 숲. 작은 소원들이 하나의 계절을 엽니다.',art:3,color:'#8da880'},
  sunken_temple:{chapter:'05',title:'해저 신전',subtitle:'깊은 바다의 심판',note:'물결 아래 남겨진 성전. 해신의 창이 고요를 가릅니다.',art:4,color:'#68a7b3'},
  chaos_rift:{chapter:'06',title:'혼돈의 틈',subtitle:'마지막 밤의 군주',note:'세상의 끝에 열린 틈. 꺼지지 않는 별빛으로 마지막 밤을 건넙니다.',art:5,color:'#9980ac'}
});
export const HERO_COPY = Object.freeze({
  galaxy_whale: ['별바다의 항해자', '신성 관통', '긴 빛의 항로를 열고 초신성으로 무리를 정리합니다. 빛의 동료와 공명합니다.'],
  silver_rabbit: ['세 번째 달의 토끼', '신성 연사', '암흑에 물든 적을 추격하고, 토끼 동료들과 치명타를 이어갑니다.'],
  ancient_dragon: ['태고의 숨결', '화염 · 약화', '가까운 적의 갑옷을 부식시키고 브레스로 작열을 남깁니다. 대지의축복과 공명합니다.'],
  time_ruler: ['마지막 시간을 세는 자', '광역 · 제어', '적의 시간을 늦추고 종언의 예고로 저주를 남겨 동료의 일격을 준비합니다.'],
  queen: ['장미 왕관의 주인', '정원 · 지원', '대지의축복으로 동료를 강화하고, 가시꽃으로 적의 걸음을 늦춥니다.'],
  red_dragon: ["작은 불꽃의 날개", "화염 산탄", "작열을 남기는 브레스. 태양의축복과 함께 강해집니다."],
  flame_sage: ["태양을 품은 현자", "화염 · 지원", "범위 4 태양의축복. 짧은 공격 사거리 대신 동료를 강화합니다."],
  mushroom_king: ["포자의 작은 왕", "중독 노바", "굽이에서 중독을 쌓고 지친 적을 마무리합니다."],
  great_detective: ["푸른 단서의 추적자", "신성 관통", "직선의 악마를 꿰뚫고 저주로 마법 동료를 돕습니다."],
  siren: ["달빛의 목소리", "물결 · 지원", "범위 4 달의축복. 물속성 동료와 치명타 이중창을 부릅니다."],
  phantom: ["잠들지 않는 소년", "암흑 저격", "오라를 받지 않습니다. 암흑과 저주를 이어 혼자서 길을 지킵니다."],
  rumi: ["꿈을 엮는 소년", "별빛 산탄", "세 갈래 별빛과 오라로 함께 강해져요."],
  luna: ["달그림자 암살자", "보스 사냥", "짧은 사거리 안에서 보스에게 치명적인 일격."],
  cinderella: ["기적의 마법사", "광역 · 제어", "몰려오는 적을 늦추고 신성한 빛으로 정화해요."],
  zeke: ["약속의 기사", "검격 · 화염", "검으로 길을 지키고 화염 스킬로 재생 적을 태워요."],
  snow_rabbit: ["설원의 작은 바람", "마법 연사", "빠른 얼음 화살로 중갑 적을 깎아내려요."],
  avalanche_maid: ["빙하성의 메이드", "원거리 저격", "먼 곳의 보스에게 무거운 얼음 한 방."],
  night_rabbit: ["밤을 건너는 토끼", "물리 저격", "암흑에 걸린 적을 노리는 긴 사거리."],
  guardian: ["숲의 우산지기", "근접 광역", "넓은 잎 아래에서 코어와 동료를 지켜요."],
  storm_sage: ["바람의 기록자", "대공 산탄", "흩어지는 바람으로 날개 달린 적을 붙잡아요."],
  lightning_sage: ["뇌광의 관측자", "대공 관통", "직선으로 늘어선 적을 번개로 꿰뚫어요."]
});
export const DEFENSE_LABELS = Object.freeze({ normal: "일반", air: "공중", heavy: "중갑", regeneration: "재생", demon: "악마", boss: "보스" });
export const COUNTERS = Object.freeze({ normal: "모든 공격이 유효해요", air: "대공 공격 2배", heavy: "마법 공격 2배", regeneration: "화염 공격 2배", demon: "신성 공격 2배", boss: "필살 공격 2배" });
export function assetUrl(path) {
  return globalThis.__HERO_DEFENSE_V2_EMBEDDED_ASSETS__?.[path] ?? path;
}
export function worldStyle(index = 0) {
  return `background-image:url('${assetUrl("./assets/moonlit/worlds.webp")}');background-size:300% 200%;background-position:${index%3*50}% ${index>=3?100:0}%`;
}
