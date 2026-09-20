export const JOURNEYS = Object.freeze({
  ancient_ruins: { chapter: "01", title: "새벽의 정원", subtitle: "구름 위에 잠든 첫 번째 별", note: "세 번 굽이치는 수로를 따라 첫 여정이 시작됩니다.", counter: "중갑에는 마법 · 공중에는 대공", art: 0, color: "#6c9787" },
  chaos_rift: { chapter: "02", title: "달그림자 숲", subtitle: "달빛마저 삼켜버린 깊은 틈", note: "서로 등을 맞댄 긴 길 사이로 달그림자가 번집니다.", counter: "악마에는 신성 · 공중에는 대공", art: 1, color: "#837fbd" },
  crossroads: { chapter: "03", title: "별의 관측소", subtitle: "잊힌 왕국에 남겨진 약속", note: "외곽을 크게 돌아 안쪽으로 파고드는 길입니다.", counter: "중갑에는 마법 · 보스에는 필살", art: 2, color: "#698b9c" },
  long_boulevard: { chapter: "04", title: "황금빛 귀환로", subtitle: "끝나지 않은 이야기의 다음 장", note: "긴 회랑 끝에서 마지막 별이 귀환을 기다립니다.", counter: "재생에는 화염 · 중갑에는 마법", art: 3, color: "#b39b63" }
});
export const HERO_COPY = Object.freeze({
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
  return `background-image:url('${assetUrl("./assets/moonlit/worlds.webp")}');background-position:${index % 2 ? "100%" : "0%"} ${index > 1 ? "100%" : "0%"}`;
}
