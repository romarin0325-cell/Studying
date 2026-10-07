// Star Garden owns these definitions. They were copied once when the prototype
// branched from Confluence; all future balance and art changes are local.
export const VERSION = 2;

export const GRID = 5;

export const MAX_RANK = 6;

export const HEROES = [
  {
    "id": "zeke",
    "name": "지크",
    "title": "불굴의 용기사",
    "color": "#ff995c",
    "art": {
      "atlas": "unit-zeke",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 256,
        "y": 209,
        "size": 250
      }
    },
    "damage": 25,
    "interval": 1.2,
    "attack": "slash",
    "trait": {
      "type": "burn",
      "text": "전방 90°를 베어 화상. 선두가 경로의 마지막 25%에 들어오면 공격 속도 +40%."
    },
    "skill": {
      "name": "용의 맹세",
      "cost": 70,
      "type": "inferno",
      "text": "전장 전체에 위력 7배의 화염검과 화상. 코어 생명력이 절반 미만이면 14배."
    },
    "heightGroup": "tall",
    "role": "선봉 · 부채꼴",
    "shape": "cleave",
    "range": 345,
    "radius": 90
  },
  {
    "id": "rumi",
    "name": "루미",
    "title": "꿈을 짓는 마법사",
    "color": "#7dddf1",
    "art": {
      "atlas": "unit-rumi",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 256,
        "y": 232,
        "size": 250
      }
    },
    "damage": 10,
    "interval": 1.05,
    "attack": "star",
    "trait": {
      "type": "wild",
      "text": "일직선 관통. 같은 등급의 모든 동료와 합성합니다."
    },
    "skill": {
      "name": "꿈의 메아리",
      "cost": 60,
      "type": "echo",
      "text": "8초 동안 모든 영웅의 공격에 65% 위력의 추가 공격이 따라갑니다."
    },
    "heightGroup": "medium",
    "role": "합성 · 관통 별",
    "shape": "beam",
    "range": 440,
    "radius": 24
  },
  {
    "id": "luna",
    "name": "루나",
    "title": "달그늘의 암살자",
    "color": "#c5a0ff",
    "art": {
      "atlas": "unit-luna",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 256,
        "y": 211,
        "size": 250
      }
    },
    "damage": 55,
    "interval": 1.25,
    "attack": "blade",
    "trait": {
      "type": "execute",
      "text": "보스 우선 · 보스 피해 +35%. 체력 35% 이하(보스 40%)면 기본 공격 두 배."
    },
    "skill": {
      "name": "제노사이드 스텝",
      "cost": 80,
      "type": "execute",
      "text": "보스 우선 최대 5명에게 위력 16배. 체력 35% 이하(보스 40%)면 30배. 처형으로 쓰러뜨리면 다음 적에게 이어집니다(최대 5회)."
    },
    "heightGroup": "medium",
    "role": "보스 처형 · 단일",
    "shape": "single",
    "range": 340,
    "radius": 0,
    "bossDamage": 1.35
  },
  {
    "id": "cinderella",
    "name": "신데렐라",
    "title": "한밤의 기적",
    "color": "#f7a5cc",
    "art": {
      "atlas": "unit-cinderella",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 252,
        "y": 190,
        "size": 250
      }
    },
    "damage": 26,
    "interval": 1.05,
    "attack": "star",
    "trait": {
      "type": "miracle",
      "text": "세 번째 공격은 위력 1.8배. 가장 높은 성급의 신데렐라 한 명만 위력 +50%."
    },
    "skill": {
      "name": "자정의 기적",
      "cost": 65,
      "type": "glassfall",
      "text": "전장 전체에 위력 6배의 유리 별비. 10초 동안 수혜 신데렐라의 기본 공격이 주변 적까지 맞힙니다."
    },
    "heightGroup": "medium",
    "role": "기적 연타 · 별탄",
    "shape": "single",
    "range": 480,
    "radius": 0
  },
  {
    "id": "snow_rabbit",
    "name": "눈토끼",
    "title": "겨울의 작은 발자국",
    "color": "#9bdfef",
    "art": {
      "atlas": "unit-snow_rabbit",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 256,
        "y": 228,
        "size": 250
      }
    },
    "damage": 10,
    "interval": 0.95,
    "attack": "ice",
    "trait": {
      "type": "slow",
      "text": "작은 눈보라가 주변 적을 40% 감속합니다."
    },
    "skill": {
      "name": "하얀 숨결",
      "cost": 65,
      "type": "freeze",
      "text": "모든 적에게 위력 3배 피해와 2초 빙결, 6초 동안 50% 감속."
    },
    "heightGroup": "short",
    "role": "감속 · 작은 폭발",
    "shape": "splash",
    "range": 450,
    "radius": 48
  },
  {
    "id": "avalanche_maid",
    "name": "아발란체메이드",
    "title": "잠든 눈사태",
    "color": "#9fc5f7",
    "art": {
      "atlas": "unit-avalanche_maid",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 256,
        "y": 217,
        "size": 250
      }
    },
    "damage": 32,
    "interval": 1.65,
    "attack": "ice",
    "trait": {
      "type": "shatter",
      "text": "무작위 적에게 넓은 얼음 파편. 감속 중인 적에게 피해 +75%. 목표 변경 불가."
    },
    "skill": {
      "name": "백야의 눈사태",
      "cost": 85,
      "type": "avalanche",
      "text": "넓은 범위에 위력 4배 얼음 폭발. 기절·빙결 중인 적에게는 12배."
    },
    "heightGroup": "medium",
    "role": "빙결 연계 · 포격",
    "shape": "splash",
    "range": 560,
    "radius": 100
  },
  {
    "id": "night_rabbit",
    "name": "밤토끼",
    "title": "별 없는 밤의 도약",
    "color": "#bd91e3",
    "art": {
      "atlas": "unit-night_rabbit",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 256,
        "y": 221,
        "size": 250
      }
    },
    "damage": 29,
    "interval": 0.7,
    "attack": "blade",
    "trait": {
      "type": "rabbit",
      "text": "두 적 사이를 튑니다. 전장의 다른 토끼 종류마다 밤토끼 공격속도 +20%."
    },
    "skill": {
      "name": "달그림자 도약",
      "cost": 65,
      "type": "flurry",
      "text": "선두 9체에 위력 9배 연속 타격. 밤토끼 이외의 토끼 종류당 표적 +2(눈·은토끼 모두 편성 시 13체). 같은 종류의 여러 기는 한 번만 셉니다."
    },
    "heightGroup": "short",
    "role": "토끼 연계 · 도탄",
    "shape": "bounce",
    "range": 390,
    "radius": 135
  },
  {
    "id": "guardian",
    "name": "가디언",
    "title": "대륙을 옮긴 손",
    "color": "#e2ba75",
    "art": {
      "atlas": "unit-guardian",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 256,
        "y": 210,
        "size": 250
      }
    },
    "damage": 58,
    "interval": 1.8,
    "attack": "stone",
    "trait": {
      "type": "stun",
      "text": "자신의 칸 주변 230 범위를 전부 타격. 세 번째 공격은 기절."
    },
    "skill": {
      "name": "대륙의 맥동",
      "cost": 75,
      "type": "quake",
      "text": "모든 적에게 위력 3배 피해, 뒤로 밀치고 1.5초 기절. 경로 마지막 3분의 1에 있는 적은 두 배로 밀리고 3초 기절."
    },
    "heightGroup": "short",
    "role": "근접 방벽 · 타일 충격",
    "shape": "pulse",
    "range": 230,
    "radius": 230
  },
  {
    "id": "storm_sage",
    "name": "폭풍의현자",
    "title": "흐름을 읽는 자",
    "color": "#8dd2c4",
    "art": {
      "atlas": "unit-storm_sage",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 256,
        "y": 195,
        "size": 250
      }
    },
    "damage": 30,
    "interval": 0.85,
    "attack": "wind",
    "trait": {
      "type": "gust",
      "text": "바람길을 관통하고 인근 적에 연쇄. 일반 공격에 맞은 일반 적마다 1% 확률로 즉사."
    },
    "skill": {
      "name": "태풍의 눈",
      "cost": 75,
      "type": "vortex",
      "text": "적을 전방의 한곳으로 모아 타격하고 느리게 합니다."
    },
    "heightGroup": "tall",
    "role": "관통 · 바람길",
    "shape": "beam",
    "range": 560,
    "radius": 42
  },
  {
    "id": "lightning_sage",
    "name": "번개의현자",
    "title": "찰나의 섬광",
    "color": "#f2db84",
    "art": {
      "atlas": "unit-lightning_sage",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 256,
        "y": 204,
        "size": 250
      }
    },
    "damage": 39,
    "interval": 1.2,
    "attack": "lightning",
    "trait": {
      "type": "chain",
      "text": "가까운 적에게 번개가 이어집니다. 같은 동료가 상하좌우로 연결될수록 위력·체인 강화(필살기에도 적용)."
    },
    "skill": {
      "name": "천둥의 연쇄",
      "cost": 80,
      "type": "thunder",
      "text": "모든 적에게 위력 7배 연쇄 타격과 1.2초 기절."
    },
    "heightGroup": "tall",
    "role": "연쇄 · 번개",
    "shape": "chain",
    "range": 470,
    "radius": 190
  },
  {
    "id": "red_dragon",
    "name": "레드드래곤",
    "title": "진홍의 포효",
    "color": "#ff805c",
    "art": {
      "atlas": "unit-red_dragon",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 256,
        "y": 199,
        "size": 250
      }
    },
    "damage": 36,
    "interval": 1.75,
    "attack": "fire",
    "trait": {
      "type": "splash",
      "text": "멀리서 넓게 폭발. 불타는 적에게 피해 +40%."
    },
    "skill": {
      "name": "용의 숨결",
      "cost": 90,
      "type": "dragon",
      "text": "적이 가장 밀집한 곳(반경 180)에 위력 14배 화염 폭발과 강한 화상."
    },
    "heightGroup": "tall",
    "role": "화상 연계 · 폭격",
    "shape": "splash",
    "range": 590,
    "radius": 88
  },
  {
    "id": "flame_sage",
    "name": "화염의현자",
    "title": "꺼지지 않는 잔불",
    "color": "#edab55",
    "art": {
      "atlas": "unit-flame_sage",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 256,
        "y": 207,
        "size": 250
      }
    },
    "damage": 38,
    "interval": 1.1,
    "attack": "fire",
    "trait": {
      "type": "burn",
      "text": "맵의 무작위 위치에 강화된 불바닥을 3.9초 남깁니다. 목표 변경 불가."
    },
    "skill": {
      "name": "작열의 문장",
      "cost": 75,
      "type": "combust",
      "text": "모든 적에게 위력 4배. 이미 불타는 적에게는 10배 폭발. 이후 강한 화상."
    },
    "heightGroup": "tall",
    "role": "지속 화력 · 불바닥",
    "shape": "zone",
    "range": 430,
    "radius": 64
  },
  {
    "id": "mushroom_king",
    "name": "머쉬룸킹",
    "title": "독의 왕관",
    "color": "#baaf66",
    "art": {
      "atlas": "unit-mushroom_king",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 256,
        "y": 263,
        "size": 250
      }
    },
    "damage": 6,
    "interval": 0.95,
    "attack": "spore",
    "trait": {
      "type": "poison",
      "text": "포자밭으로 독 1중첩(7초). 합성하면 모든 적에게 독 2중첩."
    },
    "skill": {
      "name": "왕의 마지막 포자",
      "cost": 70,
      "type": "plague",
      "text": "모든 적에게 독 8중첩(12초)과 위력 3배. 이미 독 20중첩 이상인 적은 남은 독 피해의 30%를 즉시 받습니다. 독은 최대 40중첩입니다."
    },
    "heightGroup": "medium",
    "role": "독 · 포자밭",
    "shape": "zone",
    "range": 370,
    "radius": 66
  },
  {
    "id": "great_detective",
    "name": "명탐정",
    "title": "진실을 비추는 빛",
    "color": "#f2d8a0",
    "art": {
      "atlas": "unit-great_detective",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 256,
        "y": 214,
        "size": 250
      }
    },
    "damage": 20,
    "interval": 1.6,
    "attack": "light",
    "trait": {
      "type": "expose",
      "text": "보스 우선. 직격 후 4초간 받는 피해 +20%(보스 +30%). 훈련마다 +2%p, 성급이 오를수록 강화."
    },
    "skill": {
      "name": "완벽한 추리",
      "cost": 60,
      "type": "expose",
      "text": "전장 전체에 위력 3배 피해를 준 뒤, 10초간 받는 피해 +60%의 노출을 적용합니다."
    },
    "heightGroup": "medium",
    "role": "보스 약화 · 저격",
    "shape": "single",
    "range": 900,
    "radius": 0,
    "bossPriority": true
  },
  {
    "id": "siren",
    "name": "세이렌",
    "title": "물결의 노래",
    "color": "#91d8f7",
    "art": {
      "atlas": "unit-siren",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 256,
        "y": 229,
        "size": 250
      }
    },
    "damage": 7,
    "interval": 1.25,
    "attack": "water",
    "trait": {
      "type": "hasteAura",
      "text": "상하좌우 동료 공격속도 +22%. 훈련마다 +3%p, 성급이 오를수록 강화."
    },
    "skill": {
      "name": "공명의 아리아",
      "cost": 65,
      "type": "haste",
      "text": "8초 동안 모든 영웅의 공격속도를 65% 높입니다."
    },
    "heightGroup": "medium",
    "role": "인접 지원 · 물결",
    "shape": "splash",
    "range": 400,
    "radius": 58
  },
  {
    "id": "phantom",
    "name": "팬텀",
    "title": "곰인형 속 악몽",
    "color": "#c9a0cb",
    "art": {
      "atlas": "unit-phantom",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 256,
        "y": 231,
        "size": 250
      }
    },
    "damage": 19,
    "interval": 1.3,
    "attack": "shadow",
    "trait": {
      "type": "fear",
      "text": "3초의 덫을 남겨 감속. 세 번째 직격은 적을 뒤로 밀칩니다."
    },
    "skill": {
      "name": "깨어나지 않는 밤",
      "cost": 75,
      "type": "nightmare",
      "text": "모든 적에게 위력 4배 피해와 밀치기, 6초간 받는 피해 +25% 노출, 독 4중첩을 12초간 부여합니다. 더 강한 노출은 출처별 만료 시각까지 유지됩니다."
    },
    "heightGroup": "short",
    "role": "견제 · 악몽 덫",
    "shape": "zone",
    "range": 460,
    "radius": 60
  },
  {
    "id": "queen",
    "name": "여왕",
    "title": "장미의 통치자",
    "color": "#e9a5bb",
    "art": {
      "atlas": "unit-queen",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 256,
        "y": 211,
        "size": 250
      }
    },
    "damage": 10,
    "interval": 1.35,
    "attack": "rose",
    "trait": {
      "type": "dividend",
      "text": "물결 종료 시 1성 5G · 2성 7G 배당. 4·7·10물결부터 +1G씩, 강화마다 +3G. 여왕 전체 합계 최대 45G."
    },
    "skill": {
      "name": "장미의 세금",
      "cost": 60,
      "type": "dividend",
      "text": "장미가 전장 전체에 위력 3배. 즉시 20골드를 얻고 8초 동안 처치 골드 3배."
    },
    "heightGroup": "medium",
    "role": "물결 경제 · 장미",
    "shape": "single",
    "range": 440,
    "radius": 0
  },
  {
    "id": "galaxy_whale",
    "name": "은하고래",
    "title": "별바다의 주인",
    "color": "#90a9ec",
    "art": {
      "atlas": "unit-galaxy_whale",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 256,
        "y": 203,
        "size": 250
      }
    },
    "damage": 18,
    "interval": 2,
    "attack": "cosmos",
    "trait": {
      "type": "gravity",
      "text": "중력장으로 피해·40% 감속. 중력장 피해는 성광 중첩당 +30%."
    },
    "skill": {
      "name": "별바다의 중심",
      "cost": 100,
      "type": "singularity",
      "text": "적을 끌어당긴 뒤 위력 8배 폭발. 성광을 모두 거둬 중첩당 피해 +50%."
    },
    "heightGroup": "medium",
    "role": "성광 수확 · 중력장",
    "shape": "zone",
    "range": 550,
    "radius": 98
  },
  {
    "id": "silver_rabbit",
    "name": "은토끼",
    "title": "새벽을 잇는 발자국",
    "color": "#c4e5df",
    "art": {
      "atlas": "unit-silver_rabbit",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 256,
        "y": 249,
        "size": 250
      }
    },
    "damage": 24,
    "interval": 0.9,
    "attack": "light",
    "trait": {
      "type": "battery",
      "text": "관통 공격에 맞은 적 모두에게 성광 1중첩."
    },
    "skill": {
      "name": "은빛 행진",
      "cost": 55,
      "type": "march",
      "text": "6초 동안 모든 동료의 공격이 성광을 1중첩 부여하고 공격속도 +20%."
    },
    "heightGroup": "short",
    "role": "성광 부여 · 관통광",
    "shape": "beam",
    "range": 500,
    "radius": 22
  },
  {
    "id": "ancient_dragon",
    "name": "에인션트드래곤",
    "title": "오랜 별의 지혜",
    "color": "#e1c486",
    "art": {
      "atlas": "unit-ancient_dragon",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 256,
        "y": 185,
        "size": 250
      }
    },
    "damage": 22,
    "interval": 1.6,
    "attack": "light",
    "trait": {
      "type": "powerAura",
      "text": "자신의 행·열을 관통. 상하좌우 동료 공격력 +25%. 훈련마다 +3%p, 성급이 오를수록 강화."
    },
    "skill": {
      "name": "태고의 약속",
      "cost": 85,
      "type": "awaken",
      "text": "10초 동안 모든 영웅의 공격력을 70% 높입니다."
    },
    "heightGroup": "tall",
    "role": "인접 지원 · 십자화염",
    "shape": "cross",
    "range": 620,
    "radius": 55
  },
  {
    "id": "time_ruler",
    "name": "시간의지배자",
    "title": "멈춘 시계의 여왕",
    "color": "#c4bcf4",
    "art": {
      "atlas": "unit-time_ruler",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 256,
        "y": 208,
        "size": 250
      }
    },
    "damage": 26,
    "interval": 1.1,
    "attack": "time",
    "trait": {
      "type": "chrono",
      "text": "시간장으로 25% 감속. 등장 웨이브 75%, 다음 100%, 이후 125% 위력. 합성 시 초기화."
    },
    "skill": {
      "name": "아직 오지 않은 순간",
      "cost": 90,
      "type": "rewind",
      "text": "모든 적을 이동 거리 6초분만큼 되감고(빠른 적일수록 멀리) 2초 동안 멈춥니다. 위력 3배."
    },
    "heightGroup": "medium",
    "role": "시간 제어 · 시계장",
    "shape": "zone",
    "range": 490,
    "radius": 72
  },
  {
    "id": "doom",
    "name": "둠",
    "title": "웃음 뒤의 계약",
    "color": "#ad97da",
    "art": {
      "atlas": "unit-doom",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 251,
        "y": 237,
        "size": 250
      }
    },
    "damage": 16,
    "interval": 1.2,
    "attack": "shadow",
    "trait": {
      "type": "sacrifice",
      "text": "둠 합성 시 재료 성급 × 18G 환급. 강화마다 등급당 +4G. 루미와 어느 방향으로 합성해도 발동."
    },
    "skill": {
      "name": "왕궁의 암거래",
      "cost": 60,
      "goldCost": 25,
      "type": "fortune",
      "text": "25골드를 소모해 전장 전체에 위력 10배의 암흑검."
    },
    "heightGroup": "medium",
    "role": "합성 경제 · 관통검",
    "shape": "beam",
    "range": 450,
    "radius": 22
  },
  {
    "id": "santa",
    "name": "산타",
    "title": "성야의 배달부",
    "color": "#f7b994",
    "art": {
      "atlas": "unit-santa",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 256,
        "y": 223,
        "size": 250
      }
    },
    "damage": 13,
    "interval": 1.05,
    "attack": "gift",
    "trait": {
      "type": "gift",
      "text": "네 번째 공격은 선물 폭탄: 범위·위력 2배. 선물 폭탄으로 쓰러뜨리면 골드 +1."
    },
    "skill": {
      "name": "한밤의 선물",
      "cost": 75,
      "type": "gift",
      "text": "편성 동료 한 명이 2성으로 합류하고 6초간 모든 동료의 공격속도 +30%."
    },
    "heightGroup": "medium",
    "role": "선물 · 포격",
    "shape": "splash",
    "range": 510,
    "radius": 56
  },
  {
    "id": "jasmine",
    "name": "자스민",
    "title": "빛을 모으는 왕녀",
    "color": "#ffe6a5",
    "art": {
      "atlas": "unit-jasmine",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 253,
        "y": 198,
        "size": 250
      }
    },
    "damage": 20,
    "interval": 1.15,
    "attack": "light",
    "trait": {
      "type": "divine",
      "text": "공격마다 성광 1중첩(6초, 최대 3). 성광 3중첩 대상에게 주는 피해 +65%. 체리프린스와 연계."
    },
    "skill": {
      "name": "여신강림",
      "cost": 80,
      "type": "goddess",
      "text": "전장 전체 위력 5배. 8초간 모든 동료 위력 +50%, 봉인·행동불능을 풀고 막아 줍니다."
    },
    "heightGroup": "medium",
    "role": "성광 연계 · 빛의 파동",
    "shape": "splash",
    "range": 510,
    "radius": 60
  },
  {
    "id": "star_boy",
    "name": "별똥별소년",
    "title": "소원을 가르는 유성",
    "color": "#7eddfa",
    "art": {
      "atlas": "unit-star_boy",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 248,
        "y": 229,
        "size": 250
      }
    },
    "damage": 25,
    "interval": 0.65,
    "attack": "comet",
    "trait": {
      "type": "starfall",
      "text": "등장 웨이브 150%, 다음 100%, 이후 75% 위력. 합성 시 초기화. 다섯 번째 공격은 2.2배."
    },
    "skill": {
      "name": "소원을 담은 별",
      "cost": 60,
      "type": "starfall",
      "text": "별빛을 전부 담아 최대 체력이 가장 높은 적에게 유성을 떨어뜨립니다. 별빛 1당 위력 0.4배(60이면 24배, 120이면 48배)."
    },
    "heightGroup": "medium",
    "role": "강적 추적 · 유성탄",
    "shape": "single",
    "range": 650,
    "radius": 0
  },
  {
    "id": "time_magician",
    "name": "시간의마술사",
    "title": "부서진 동화의 주인",
    "color": "#e093df",
    "art": {
      "atlas": "unit-time_magician",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 255,
        "y": 194,
        "size": 250
      }
    },
    "damage": 26,
    "interval": 1.35,
    "attack": "time",
    "trait": {
      "type": "accelerate",
      "text": "세 번째 관통마다 상하좌우 동료가 즉시 한 번 더 공격(위력 60%). 필살기 중 트라우마로 변신."
    },
    "skill": {
      "name": "트라우마 · 어둠의 신데렐라",
      "cost": 80,
      "type": "trauma",
      "text": "전장 전체 위력 4배 피해. 배치된 시간의마술사들이 10초간 트라우마로 변신: 위력 +110%, 공속 +35%."
    },
    "heightGroup": "medium",
    "role": "시간 연계 · 관통침",
    "shape": "beam",
    "range": 520,
    "radius": 28
  },
  {
    "id": "cherry_prince",
    "name": "체리프린스",
    "title": "붉은 약속의 왕자",
    "color": "#ffacc4",
    "art": {
      "atlas": "unit-cherry_prince",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 257,
        "y": 223,
        "size": 250
      }
    },
    "damage": 54,
    "interval": 1.5,
    "attack": "blade",
    "trait": {
      "type": "regal",
      "text": "보스 피해 +25%. 화상 또는 성광 3중첩 대상에게 위력 +60%."
    },
    "skill": {
      "name": "체리 블로섬 · 왕자의 일격",
      "cost": 85,
      "type": "royal",
      "text": "최대 체력이 가장 높은 적 한 명에게 위력 24배 검격. 화상·성광 3중첩이면 두 배."
    },
    "heightGroup": "tall",
    "role": "강적 결전 · 검광",
    "shape": "single",
    "range": 590,
    "radius": 0,
    "bossDamage": 1.25
  },
  {
    "id": "frost_witch",
    "name": "혹한의마녀",
    "title": "영겁의 빙관",
    "color": "#a8e4fa",
    "art": {
      "atlas": "unit-frost_witch",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 251,
        "y": 211,
        "size": 250
      }
    },
    "damage": 38,
    "interval": 1.5,
    "attack": "ice",
    "trait": {
      "type": "permafrost",
      "text": "관통 직격은 40% 감속. 이미 감속 중인 적은 0.6초 빙결(같은 적은 3초 뒤 다시). 빙결된 적이 쓰러지면 주변에 감속이 퍼집니다."
    },
    "skill": {
      "name": "빙궁의 칙령",
      "cost": 80,
      "type": "ice_court",
      "text": "전장 전체 위력 6배. 6초 동안 겨울 왕국: 모든 적 50% 감속, 쓰러진 적이 주변 적을 0.8초 빙결합니다."
    },
    "heightGroup": "tall",
    "role": "냉기 확산 · 얼음창",
    "shape": "beam",
    "range": 550,
    "radius": 32
  },
  {
    "id": "harmonious",
    "name": "하모니어스",
    "title": "달콤한 조화의 수호신",
    "color": "#9ce3c5",
    "art": {
      "atlas": "unit-harmonious",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 254,
        "y": 225,
        "size": 250
      }
    },
    "damage": 10,
    "interval": 1.3,
    "attack": "sugar",
    "trait": {
      "type": "harmonyAura",
      "text": "상하좌우의 서로 다른 동료마다 인접 동료 위력 +5%, 공속 +4%. 같은 종류는 한 번, 하모니어스는 제외."
    },
    "skill": {
      "name": "디저트 앙상블",
      "cost": 70,
      "type": "harmony",
      "text": "8초 동안 조화 오라가 전장 전체로 퍼집니다. 전장의 서로 다른 동료마다 모든 동료 위력 +5%·공속 +4%."
    },
    "heightGroup": "short",
    "role": "다양성 지원 · 조화",
    "shape": "single",
    "range": 460,
    "radius": 0
  },
  {
    "id": "aurora",
    "name": "아우로라",
    "title": "거울 너머의 미소",
    "color": "#d6befa",
    "art": {
      "atlas": "unit-aurora",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 256,
        "y": 219,
        "size": 250
      }
    },
    "damage": 30,
    "interval": 1.3,
    "attack": "mirror",
    "trait": {
      "type": "refraction",
      "text": "직격 후 위력 75% 환영탄. 환영탄은 성광 1중첩. 필드의 아우로라가 짝수이면 위력 +50%."
    },
    "skill": {
      "name": "천면경",
      "cost": 80,
      "type": "mirror",
      "text": "강적의 피해를 3초 기록해 위력 10배 + 기록 피해 45%(추가 최대 30배) 반사. 천면경 폭발은 기록에서 제외."
    },
    "heightGroup": "medium",
    "role": "지연 반사 · 환영탄",
    "shape": "single",
    "range": 540,
    "radius": 0
  }
];

export const ARTIFACTS = [
  {
    "id": "hourglass",
    "name": "별모래 시계",
    "text": "합성할 때 별빛을 8 더 얻습니다.",
    "icon": 0,
    "atlas": "relics",
    "rarity": "common",
    "color": "#bbd5cc"
  },
  {
    "id": "ember",
    "name": "불씨의 심장",
    "text": "화상 피해 +60%. 불바닥 동행과 함께하세요.",
    "icon": 1,
    "atlas": "relics",
    "rarity": "common",
    "color": "#bbd5cc"
  },
  {
    "id": "frost",
    "name": "녹지 않는 꽃",
    "text": "감속 중인 적에게 주는 피해 +25%.",
    "icon": 2,
    "atlas": "relics",
    "rarity": "common",
    "color": "#bbd5cc"
  },
  {
    "id": "banner",
    "name": "홀로 선 깃발",
    "text": "상하좌우에 동료가 없으면 공격력 +40%.",
    "icon": 3,
    "atlas": "relics",
    "rarity": "common",
    "color": "#bbd5cc"
  },
  {
    "id": "chorus",
    "name": "쌍둥이 음표",
    "text": "같은 영웅이 2명 이상이면 공격속도 +15%.",
    "icon": 4,
    "atlas": "relics",
    "rarity": "common",
    "color": "#bbd5cc"
  },
  {
    "id": "lantern",
    "name": "꺼지지 않는 등불",
    "text": "필살기 사용 후 별빛을 15 돌려받습니다.",
    "icon": 5,
    "atlas": "relics",
    "rarity": "common",
    "color": "#bbd5cc"
  },
  {
    "id": "lens",
    "name": "예리한 달조각",
    "text": "보스에게 주는 피해 +30%.",
    "icon": 6,
    "atlas": "relics",
    "rarity": "common",
    "color": "#bbd5cc"
  },
  {
    "id": "seed",
    "name": "숨 쉬는 씨앗",
    "text": "공격·장판·합성·필살기의 독 부여량 +1중첩.",
    "icon": 7,
    "atlas": "relics",
    "rarity": "common",
    "color": "#bbd5cc"
  },
  {
    "id": "feather",
    "name": "첫새벽의 깃털",
    "text": "유료 소환 비용 -4G. 최소 8G.",
    "icon": 8,
    "atlas": "relics",
    "rarity": "common",
    "color": "#bbd5cc"
  },
  {
    "id": "crown",
    "name": "작은 왕관",
    "text": "3등급 이상 영웅 공격력 +25%.",
    "icon": 9,
    "atlas": "relics",
    "rarity": "common",
    "color": "#bbd5cc"
  },
  {
    "id": "meteor",
    "name": "떨어진 별",
    "text": "12번째 공격마다 명중 지점에 위력 180%의 운석.",
    "icon": 10,
    "atlas": "relics",
    "rarity": "rare",
    "color": "#86c8ee"
  },
  {
    "id": "prism",
    "name": "천 갈래 프리즘",
    "text": "연쇄·도탄·관통 바람의 추가 타격 +1명.",
    "icon": 11,
    "atlas": "relics",
    "rarity": "rare",
    "color": "#86c8ee"
  },
  {
    "id": "tide",
    "name": "파도의 소라",
    "text": "감속을 걸면 주변 80 범위에 위력 25% 물보라. 장판은 0.5초마다 발동.",
    "icon": 12,
    "atlas": "relics",
    "rarity": "rare",
    "color": "#86c8ee"
  },
  {
    "id": "roots",
    "name": "영원의 뿌리",
    "text": "불·독·악몽·중력·시간 장판 지속시간 +50%.",
    "icon": 13,
    "atlas": "relics",
    "rarity": "rare",
    "color": "#86c8ee"
  },
  {
    "id": "guild",
    "name": "동행의 악수",
    "text": "지원 오라를 받는 영웅의 공격력 +15%.",
    "icon": 14,
    "atlas": "relics",
    "rarity": "rare",
    "color": "#86c8ee"
  },
  {
    "id": "phoenix",
    "name": "돌아오는 새벽",
    "text": "원정에서 첫 결계 피해를 막고 체력 3 회복.",
    "icon": 15,
    "atlas": "relics",
    "rarity": "rare",
    "color": "#86c8ee"
  },
  {
    "id": "twin",
    "name": "쌍성의 거울",
    "text": "모든 영웅의 네 번째 공격에 위력 45%의 메아리.",
    "icon": 16,
    "atlas": "relics",
    "rarity": "epic",
    "color": "#c9a0f5"
  },
  {
    "id": "constellation",
    "name": "삼중 성좌",
    "text": "서로 다른 동료 3종 이상과 인접하면 공격력 +65%.",
    "icon": 17,
    "atlas": "relics",
    "rarity": "epic",
    "color": "#c9a0f5"
  },
  {
    "id": "alchemy",
    "name": "별빛 연금술",
    "text": "합성할 때 합성 결과 영웅 위력 150%로 모든 적 타격.",
    "icon": 18,
    "atlas": "relics",
    "rarity": "epic",
    "color": "#c9a0f5"
  },
  {
    "id": "orbit",
    "name": "별바다의 궤도",
    "text": "3등급 이상 공격마다 명중 지점에 2초 별장판. 0.5초마다 위력 15% 피해.",
    "icon": 19,
    "atlas": "relics",
    "rarity": "epic",
    "color": "#c9a0f5"
  },
  {
    "id": "tempo_bell",
    "name": "첫막의 종",
    "text": "매 물결의 첫 7초 동안 모든 동료 공격속도 +45%.",
    "icon": 0,
    "atlas": "relics-expansion",
    "rarity": "rare",
    "color": "#86c8ee"
  },
  {
    "id": "royal_seal",
    "name": "결전의 인장",
    "text": "최대 체력이 가장 높은 생존 적에게 주는 피해 +25%.",
    "icon": 1,
    "atlas": "relics-expansion",
    "rarity": "rare",
    "color": "#86c8ee"
  },
  {
    "id": "gift_ribbon",
    "name": "기적의 리본",
    "text": "매 4번째 유료 소환은 2성으로 등장. 무료 소환은 횟수에서 제외.",
    "icon": 2,
    "atlas": "relics-expansion",
    "rarity": "epic",
    "color": "#c9a0f5"
  },
  {
    "id": "broken_clock",
    "name": "깨진 시간의 보석",
    "text": "필살기의 동료 강화와 트라우마 변신 지속시간 +2초.",
    "icon": 3,
    "atlas": "relics-expansion",
    "rarity": "epic",
    "color": "#c9a0f5"
  }
];

export const BLESSINGS = [
  {
    "id": "arrival",
    "name": "빛나는 초대장",
    "category": "즉시",
    "text": "편성 동료 한 명이 2등급으로 합류. 빈칸이 없으면 자리가 날 때 합류합니다.",
    "icon": 0
  },
  {
    "id": "surge",
    "name": "내일의 새벽검",
    "category": "다음 물결",
    "text": "다음 한 물결 동안 모든 공격력 +25%.",
    "icon": 1
  },
  {
    "id": "training",
    "name": "동행의 지혜",
    "category": "성장",
    "text": "이 원정의 동행 강화 비용 -10%p. 최대 50% 할인.",
    "icon": 2
  },
  {
    "id": "oath",
    "name": "별들의 약속",
    "category": "영구",
    "text": "이번 원정의 모든 공격력 +6%p.",
    "icon": 3
  },
  {
    "id": "purse",
    "name": "여행자의 보급",
    "category": "즉시",
    "text": "35골드를 즉시 얻습니다.",
    "icon": 4
  },
  {
    "id": "mend",
    "name": "다시 피는 꽃",
    "category": "회복",
    "text": "결계 체력 3 회복, 별빛 20 충전.",
    "icon": 5
  }
];

export const BOSSES = {
  "artificial_demon": {
    "name": "인조마신",
    "color": "#8ee8ee",
    "pattern": "seal",
    "warning": "마력 봉인 · 한 행 3.2초 봉인",
    "frame": 0
  },
  "love_iris": {
    "name": "사랑의 여신 아이리스",
    "color": "#f7b6d4",
    "pattern": "heal",
    "warning": "치유의 기도 · 체력 14% 회복",
    "frame": 1
  },
  "curse_iris": {
    "name": "저주의 여신 아이리스",
    "color": "#bc8be0",
    "pattern": "drain",
    "warning": "별빛 침식 · 별빛 −25",
    "frame": 2
  },
  "flora": {
    "name": "꽃의 여신 플로라",
    "color": "#c9dd8d",
    "pattern": "heal",
    "warning": "생명의 개화 · 체력 14% 회복",
    "frame": 3
  },
  "poseidon": {
    "name": "해신 포세이돈",
    "color": "#77c9e3",
    "pattern": "rush",
    "warning": "밀려오는 해일 · 적 전진",
    "frame": 4
  },
  "beelzebub": {
    "name": "마신 벨제뷔트",
    "color": "#dfa590",
    "pattern": "seal",
    "warning": "붕괴의 문장 · 한 행 3.2초 봉인",
    "frame": 5
  },
  "thor": {
    "name": "뇌신 토르",
    "color": "#a9dcff",
    "pattern": "storm",
    "warning": "신벌의 낙뢰 · 빛나는 3칸에서 이동하세요",
    "atlas": "bosses-expansion",
    "frame": 0
  },
  "ares": {
    "name": "투신 아레스",
    "color": "#ffa88b",
    "pattern": "duel",
    "warning": "투신의 도전 · 2.6초 안에 최대 체력 6% 피해로 저지",
    "atlas": "bosses-expansion",
    "frame": 1
  },
  "astea": {
    "name": "창조신 아스테아",
    "color": "#e8d3ff",
    "pattern": "creation",
    "warning": "창세의 노래 · 2.6초 안에 최대 체력 6% 피해로 창조 저지",
    "atlas": "bosses-expansion",
    "frame": 2
  }
};

export const TRANSFORM_ART = {
  "trauma": {
    "atlas": "unit-trauma",
    "row": 0,
    "columns": 2,
    "foot": 0.9375,
    "scale": 1,
    "directional": true,
    "portrait": {
      "x": 250,
      "y": 212,
      "size": 250
    }
  }
};

export const ASSET_PATHS = {
  "unit-zeke": "./assets/merge/units/zeke.webp",
  "unit-rumi": "./assets/merge/units/rumi.webp",
  "unit-luna": "./assets/merge/units/luna.webp",
  "unit-cinderella": "./assets/merge/units/cinderella.webp",
  "unit-snow_rabbit": "./assets/merge/units/snow_rabbit.webp",
  "unit-avalanche_maid": "./assets/merge/units/avalanche_maid.webp",
  "unit-night_rabbit": "./assets/merge/units/night_rabbit.webp",
  "unit-guardian": "./assets/merge/units/guardian.webp",
  "unit-storm_sage": "./assets/merge/units/storm_sage.webp",
  "unit-lightning_sage": "./assets/merge/units/lightning_sage.webp",
  "unit-red_dragon": "./assets/merge/units/red_dragon.webp",
  "unit-flame_sage": "./assets/merge/units/flame_sage.webp",
  "unit-mushroom_king": "./assets/merge/units/mushroom_king.webp",
  "unit-great_detective": "./assets/merge/units/great_detective.webp",
  "unit-siren": "./assets/merge/units/siren.webp",
  "unit-phantom": "./assets/merge/units/phantom.webp",
  "unit-queen": "./assets/merge/units/queen.webp",
  "unit-galaxy_whale": "./assets/merge/units/galaxy_whale.webp",
  "unit-silver_rabbit": "./assets/merge/units/silver_rabbit.webp",
  "unit-ancient_dragon": "./assets/merge/units/ancient_dragon.webp",
  "unit-time_ruler": "./assets/merge/units/time_ruler.webp",
  "unit-doom": "./assets/merge/units/doom.webp",
  "unit-santa": "./assets/merge/units/santa.webp",
  "unit-jasmine": "./assets/merge/units/jasmine.webp",
  "unit-star_boy": "./assets/merge/units/star_boy.webp",
  "unit-time_magician": "./assets/merge/units/time_magician.webp",
  "unit-cherry_prince": "./assets/merge/units/cherry_prince.webp",
  "unit-frost_witch": "./assets/merge/units/frost_witch.webp",
  "unit-harmonious": "./assets/merge/units/harmonious.webp",
  "unit-aurora": "./assets/merge/units/aurora.webp",
  "garden": "./assets/merge/garden.webp",
  "bosses": "./assets/moonlit/realm-bosses.webp",
  "creatures": "./assets/moonlit/creatures.webp",
  "relics": "./assets/merge/relics.webp",
  "blessings": "./assets/merge/blessings.webp",
  "effects": "./assets/merge/effects.webp",
  "unit-trauma": "./assets/merge/units/trauma.webp",
  "effects-expansion": "./assets/merge/effects-expansion.webp",
  "finishers": "./assets/merge/finishers.webp",
  "relics-expansion": "./assets/merge/relics-expansion.webp",
  "bosses-expansion": "./assets/merge/bosses-expansion.webp",
  "realms-expansion": "./assets/merge/realms-expansion.webp",
  "effects-trio": "./assets/merge/effects-trio.webp",
  "ultimates": "./assets/merge/ultimates.webp",
  "ancient-cross": "./assets/merge/ancient-cross.webp",
  "zeke-cone": "./assets/merge/zeke-cone.webp"
};

export const STAGE_THEMES = [
  {
    "name": "달빛 정원",
    "color": "#7dbac1",
    "world": 0
  },
  {
    "name": "잠든 숲의 노래",
    "color": "#a9bd80",
    "world": 3
  },
  {
    "name": "푸른 심연",
    "color": "#82aec7",
    "world": 4
  },
  {
    "name": "황혼의 왕좌",
    "color": "#c799ba",
    "world": 5
  },
  {
    "name": "뇌명의 첨탑",
    "color": "#96c9f3",
    "world": 6,
    "background": 0
  },
  {
    "name": "전쟁신의 성채",
    "color": "#edab94",
    "world": 7,
    "background": 1
  },
  {
    "name": "창세의 성원",
    "color": "#dbc5fc",
    "world": 8,
    "background": 2
  }
];

export const HERO=Object.fromEntries(HEROES.map(hero=>[hero.id,hero]));
export const BLESSING=Object.fromEntries(BLESSINGS.map(blessing=>[blessing.id,blessing]));
