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
        "x": 247,
        "y": 194,
        "size": 250
      }
    },
    "damage": 25,
    "interval": 1.2,
    "attack": "slash",
    "trait": {
      "type": "burn",
      "text": "앞쪽 부채꼴 범위를 베고, 맞은 적을 3초간 불태웁니다. 적이 코어 가까이(경로 마지막 4분의 1) 오면 공격 속도가 40% 빨라집니다."
    },
    "skill": {
      "name": "용의 맹세",
      "cost": 70,
      "type": "inferno",
      "text": "적 전체에게 위력 7배 피해를 주고 5초간 강하게 불태웁니다. 코어 생명력이 절반 아래로 내려가면 강화되어 위력 14배가 됩니다."
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
        "x": 261,
        "y": 205,
        "size": 250
      }
    },
    "damage": 10,
    "interval": 1.05,
    "attack": "star",
    "trait": {
      "type": "wild",
      "text": "일직선으로 관통합니다. 성급만 같으면 어떤 동료와도 합성할 수 있고, 합성하면 상대 동료가 한 단계 오릅니다."
    },
    "skill": {
      "name": "꿈의 메아리",
      "cost": 60,
      "type": "echo",
      "text": "8초 동안 모든 동료의 공격마다 위력 65%의 추가 공격이 한 번 더 나갑니다."
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
        "x": 242,
        "y": 220,
        "size": 250
      }
    },
    "damage": 55,
    "interval": 1.25,
    "attack": "blade",
    "trait": {
      "type": "execute",
      "text": "보스를 먼저 노리고, 보스에게 피해 +35%. 체력이 40% 이하인 적에게는 피해가 두 배입니다."
    },
    "skill": {
      "name": "제노사이드 스텝",
      "cost": 80,
      "type": "execute",
      "text": "보스부터 최대 5명에게 위력 16배 피해를 줍니다. 체력 40% 이하인 적은 30배로 처형하고, 처형으로 쓰러뜨릴 때마다 다음 적에게 이어집니다(최대 5회)."
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
        "x": 253,
        "y": 204,
        "size": 250
      }
    },
    "damage": 26,
    "interval": 1,
    "attack": "star",
    "trait": {
      "type": "miracle",
      "text": "성급이 가장 높은 신데렐라 1명이 진짜 신데렐라가 되어 위력 +50%. 공격할 때마다 시계가 한 칸 가고, 12번째 공격은 자정의 종입니다: 보스(없으면 대상)에게 위력 10배, 주변 적에게 3배."
    },
    "skill": {
      "name": "자정의 기적",
      "cost": 65,
      "type": "glassfall",
      "text": "적 전체에게 위력 3배 피해를 줍니다. 10초 동안 진짜 신데렐라의 공격 속도가 50% 오르고, 4번째 공격마다 자정의 종이 울립니다."
    },
    "heightGroup": "medium",
    "role": "자정의 종 · 보스 저격",
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
        "x": 240,
        "y": 234,
        "size": 250
      }
    },
    "damage": 10,
    "interval": 0.95,
    "attack": "ice",
    "trait": {
      "type": "slow",
      "text": "작은 눈보라로 맞은 적들을 40% 느리게 합니다."
    },
    "skill": {
      "name": "하얀 숨결",
      "cost": 65,
      "type": "freeze",
      "text": "적 전체에게 위력 3배 피해를 주고 2초 동안 얼리며, 6초간 50% 느리게 합니다."
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
        "x": 247,
        "y": 215,
        "size": 250
      }
    },
    "damage": 32,
    "interval": 1.65,
    "attack": "ice",
    "trait": {
      "type": "shatter",
      "text": "사거리 안의 무작위 적에게 넓은 얼음 파편을 떨어뜨립니다. 느려진 적에게는 피해 +75%. 목표를 바꿀 수 없습니다."
    },
    "skill": {
      "name": "백야의 눈사태",
      "cost": 85,
      "type": "avalanche",
      "text": "넓은 범위에 위력 4배 피해를 줍니다. 기절하거나 얼어 있는 적에게는 12배. 눈토끼·가디언의 필살기 직후에 쓰면 강합니다."
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
        "x": 257,
        "y": 224,
        "size": 250
      }
    },
    "damage": 29,
    "interval": 0.7,
    "attack": "blade",
    "trait": {
      "type": "rabbit",
      "text": "두 적 사이를 튀며 공격합니다. 전장에 다른 종류의 토끼(눈토끼·은토끼)가 있으면 한 종류당 공격 속도 +20%."
    },
    "skill": {
      "name": "달그림자 도약",
      "cost": 65,
      "type": "flurry",
      "text": "가장 앞선 적 9명에게 위력 9배 연속 공격을 합니다. 다른 토끼 종류가 있으면 한 종류당 2명을 더 맞힙니다."
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
        "x": 249,
        "y": 236,
        "size": 250
      }
    },
    "damage": 60,
    "interval": 1.8,
    "attack": "stone",
    "trait": {
      "type": "stun",
      "text": "자기 칸 주변(반경 230)의 적을 모두 칩니다. 세 번째 공격마다 맞은 적을 0.7초 기절시킵니다. 사거리가 짧아 길 가까이에 두어야 합니다."
    },
    "skill": {
      "name": "대륙의 맥동",
      "cost": 75,
      "type": "quake",
      "text": "적 전체에게 위력 2.4배 피해를 주고 밀어내며 1.5초 기절시킵니다. 코어 가까이(경로 마지막 3분의 1) 온 적에게는 강화되어 두 배로 밀어내고 3초 기절시킵니다."
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
        "x": 258,
        "y": 214,
        "size": 250
      }
    },
    "damage": 34,
    "interval": 0.85,
    "attack": "wind",
    "trait": {
      "type": "gust",
      "text": "바람이 일직선으로 관통한 뒤 근처 적에게 한 번 더 튑니다. 일반 적은 맞을 때마다 1% 확률로 즉사합니다."
    },
    "skill": {
      "name": "태풍의 눈",
      "cost": 75,
      "type": "vortex",
      "text": "적들을 앞쪽 한곳으로 끌어모아 위력 5배 피해를 주고, 1.5초 기절과 4초간 60% 감속을 겁니다."
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
        "x": 234,
        "y": 227,
        "size": 250
      }
    },
    "damage": 39,
    "interval": 1.2,
    "attack": "lightning",
    "trait": {
      "type": "chain",
      "text": "가까운 적 2명에게 번개가 이어집니다. 상하좌우로 붙어 있는 번개의현자가 많을수록 강해집니다(2기 +20%, 3기 +40%, 4기 이상 +60%)."
    },
    "skill": {
      "name": "천둥의 연쇄",
      "cost": 80,
      "type": "thunder",
      "text": "적 전체에게 위력 7배 번개를 떨어뜨리고 1.2초 기절시킵니다."
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
        "x": 268,
        "y": 204,
        "size": 250
      }
    },
    "damage": 36,
    "interval": 1.75,
    "attack": "fire",
    "trait": {
      "type": "splash",
      "text": "멀리서 넓은 폭발로 공격합니다. 불타는 적에게는 피해 +40%."
    },
    "skill": {
      "name": "용의 숨결",
      "cost": 90,
      "type": "dragon",
      "text": "적이 가장 많이 모인 곳(반경 180)에 위력 14배 화염을 뿜고 5초간 강하게 불태웁니다."
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
        "x": 249,
        "y": 217,
        "size": 250
      }
    },
    "damage": 38,
    "interval": 1.1,
    "attack": "fire",
    "trait": {
      "type": "burn",
      "text": "적이 지나는 길 위 무작위 위치에 3.9초 동안 타는 불바닥을 깔아, 지나가는 적을 불태웁니다. 목표를 바꿀 수 없습니다."
    },
    "skill": {
      "name": "작열의 문장",
      "cost": 75,
      "type": "combust",
      "text": "적 전체에게 위력 4배 피해를 줍니다. 이미 불타는 적은 10배로 폭발합니다. 이후 6초간 강하게 불태웁니다."
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
        "x": 266,
        "y": 224,
        "size": 250
      }
    },
    "damage": 6,
    "interval": 0.95,
    "attack": "spore",
    "trait": {
      "type": "poison",
      "text": "포자밭을 깔아 적에게 독을 쌓습니다. 독은 최대 40중첩까지 쌓이며 시간이 지날수록 피해를 줍니다. 합성할 때 모든 적에게 독 2중첩."
    },
    "skill": {
      "name": "왕의 마지막 포자",
      "cost": 70,
      "type": "plague",
      "text": "적 전체에게 위력 3배 피해와 독 8중첩(12초)을 줍니다. 이미 독이 20중첩 이상인 적은 남은 독 피해의 30%를 즉시 받습니다."
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
        "x": 263,
        "y": 229,
        "size": 250
      }
    },
    "damage": 20,
    "interval": 1.6,
    "attack": "light",
    "trait": {
      "type": "expose",
      "text": "보스를 먼저 저격합니다. 맞은 적은 4초간 받는 피해가 8% 늘어납니다(보스 15%)."
    },
    "skill": {
      "name": "완벽한 추리",
      "cost": 70,
      "type": "expose",
      "text": "적 전체에게 위력 3배 피해를 준 뒤, 10초간 모든 적이 받는 피해를 35% 늘립니다. 큰 필살기 직전에 쓰면 좋습니다."
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
        "x": 246,
        "y": 226,
        "size": 250
      }
    },
    "damage": 7,
    "interval": 1.25,
    "attack": "water",
    "trait": {
      "type": "hasteAura",
      "text": "상하좌우에 있는 동료의 공격 속도를 15% 올립니다."
    },
    "skill": {
      "name": "공명의 아리아",
      "cost": 65,
      "type": "haste",
      "text": "10초 동안 모든 동료의 공격 속도를 30% 올립니다."
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
        "x": 242,
        "y": 221,
        "size": 250
      }
    },
    "damage": 19,
    "interval": 1.3,
    "attack": "shadow",
    "trait": {
      "type": "fear",
      "text": "적이 지나가는 바닥에 덫을 깔아 25% 느리게 합니다."
    },
    "skill": {
      "name": "깨어나지 않는 밤",
      "cost": 75,
      "type": "nightmare",
      "text": "적 전체에게 위력 4배 피해를 주고 뒤로 밀칩니다. 6초간 받는 피해 +25%, 12초간 독 4중첩을 겁니다."
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
        "x": 253,
        "y": 223,
        "size": 250
      }
    },
    "damage": 26,
    "interval": 1.35,
    "attack": "rose",
    "trait": {
      "type": "dividend",
      "text": "웨이브가 끝날 때마다 골드를 받습니다. 1성은 12G이고 성급이 오를 때마다 +6G, 4·7·10웨이브부터 1G씩 늘어납니다. 여왕 전체 합계는 웨이브당 최대 90G입니다."
    },
    "skill": {
      "name": "장미의 세금",
      "cost": 60,
      "type": "dividend",
      "text": "적 전체에 위력 4배 피해를 주고 즉시 20G를 받습니다. 이번 웨이브를 마칠 때 웨이브 수입이 50% 늘어납니다. 늘어나는 수입은 웨이브당 한 번만 적용됩니다."
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
        "x": 277,
        "y": 217,
        "size": 250
      }
    },
    "damage": 18,
    "interval": 2,
    "attack": "cosmos",
    "trait": {
      "type": "gravity",
      "text": "중력장을 깔아 피해를 주고 40% 느리게 합니다. 성광이 쌓인 적일수록 중력장 피해가 커집니다(중첩당 +30%)."
    },
    "skill": {
      "name": "별바다의 중심",
      "cost": 80,
      "type": "singularity",
      "text": "적들을 한곳으로 끌어당긴 뒤 위력 8배로 폭발합니다. 적에게 쌓인 성광을 모두 거둬 중첩당 피해 +100%(3중첩이면 32배)."
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
        "x": 247,
        "y": 240,
        "size": 250
      }
    },
    "damage": 26,
    "interval": 0.9,
    "attack": "light",
    "trait": {
      "type": "battery",
      "text": "일직선으로 관통하며, 맞은 적 모두에게 성광을 1중첩 남깁니다. 성광이 쌓인 적이 쓰러지면 별빛(필살기 게이지)이 더 찹니다."
    },
    "skill": {
      "name": "은빛 행진",
      "cost": 60,
      "type": "march",
      "text": "8초 동안 모든 동료의 공격이 성광을 남기고, 공격 속도가 20% 오릅니다."
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
        "x": 252,
        "y": 215,
        "size": 250
      }
    },
    "damage": 22,
    "interval": 1.6,
    "attack": "light",
    "trait": {
      "type": "powerAura",
      "text": "자기 행과 열 전체를 관통합니다. 상하좌우 동료의 위력을 20% 올립니다."
    },
    "skill": {
      "name": "태고의 약속",
      "cost": 75,
      "type": "awaken",
      "text": "10초 동안 모든 동료의 위력을 35% 올립니다."
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
        "y": 204,
        "size": 250
      }
    },
    "damage": 26,
    "interval": 1.1,
    "attack": "time",
    "trait": {
      "type": "chrono",
      "text": "시간장을 깔아 적을 25% 느리게 합니다. 오래 남을수록 강해집니다: 등장한 웨이브 75%, 다음 웨이브 100%, 그 이후 125%. 합성하면 처음부터 다시 셉니다."
    },
    "skill": {
      "name": "아직 오지 않은 순간",
      "cost": 90,
      "type": "rewind",
      "text": "모든 적을 6초 전 위치로 되돌리고(빠른 적일수록 멀리) 2초 동안 멈춥니다. 위력 3배 피해도 줍니다."
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
        "x": 253,
        "y": 199,
        "size": 250
      }
    },
    "damage": 34,
    "interval": 1.1,
    "attack": "shadow",
    "trait": {
      "type": "sacrifice",
      "text": "일직선으로 관통합니다. 둠끼리 합성하면 재료 성급 × 40G를 즉시 돌려받습니다."
    },
    "skill": {
      "name": "왕궁의 암거래",
      "cost": 60,
      "goldCost": 40,
      "type": "fortune",
      "text": "골드 40을 내고 적 전체에게 위력 7배 피해를 줍니다. 내고 남은 골드 40마다 +1배(최대 +5배). 훈련할 때마다 기본 배율이 1배씩 오릅니다."
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
        "x": 253,
        "y": 210,
        "size": 250
      }
    },
    "damage": 13,
    "interval": 1.05,
    "attack": "gift",
    "trait": {
      "type": "gift",
      "text": "네 번째 공격마다 선물 폭탄을 던집니다. 범위와 위력이 두 배이고, 선물 폭탄으로 쓰러뜨린 적은 골드를 1 더 줍니다."
    },
    "skill": {
      "name": "한밤의 선물",
      "cost": 80,
      "type": "gift",
      "text": "편성된 동료 한 명이 1성으로 합류하고, 8초 동안 모든 동료의 공격 속도가 20% 오릅니다."
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
        "x": 257,
        "y": 221,
        "size": 250
      }
    },
    "damage": 20,
    "interval": 1.15,
    "attack": "light",
    "trait": {
      "type": "divine",
      "text": "공격할 때마다 성광을 1중첩 남깁니다(6초, 최대 3중첩). 성광이 3중첩인 적에게는 피해 +65%."
    },
    "skill": {
      "name": "여신강림",
      "cost": 80,
      "type": "goddess",
      "text": "적 전체에게 위력 5배 피해를 줍니다. 기절과 저주를 한 번 풀고, 8초 동안 모든 동료의 위력이 50% 오릅니다."
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
        "x": 246,
        "y": 226,
        "size": 250
      }
    },
    "damage": 25,
    "interval": 0.65,
    "attack": "comet",
    "trait": {
      "type": "starfall",
      "text": "사거리가 매우 긴 단일 공격수입니다. 다섯 번째 공격은 2.2배. 소환·합성된 웨이브에 가장 강하고(150%), 다음 웨이브 100%, 그 이후 75%로 약해집니다."
    },
    "skill": {
      "name": "소원을 담은 별",
      "cost": 60,
      "type": "starfall",
      "text": "모아 둔 별빛을 전부 써서 체력이 가장 높은 적에게 유성을 떨어뜨립니다. 별빛 1당 위력 0.4배(60이면 24배, 120이면 48배)."
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
        "x": 248,
        "y": 207,
        "size": 250
      }
    },
    "damage": 26,
    "interval": 1.35,
    "attack": "time",
    "trait": {
      "type": "accelerate",
      "text": "일직선으로 관통합니다. 세 번째 공격마다 상하좌우 동료가 즉시 한 번 더 공격합니다(위력 60%)."
    },
    "skill": {
      "name": "트라우마 · 어둠의 신데렐라",
      "cost": 80,
      "type": "trauma",
      "text": "적 전체에게 위력 4배 피해를 줍니다. 전장의 시간의마술사가 10초 동안 트라우마로 변신해 위력 +110%, 공격 속도 +35%."
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
        "x": 250,
        "y": 206,
        "size": 250
      }
    },
    "damage": 54,
    "interval": 1.5,
    "attack": "blade",
    "trait": {
      "type": "regal",
      "text": "보스에게 피해 +25%. 불타거나 성광이 3중첩인 적에게는 위력 +60%."
    },
    "skill": {
      "name": "체리 블로섬 · 왕자의 일격",
      "cost": 85,
      "type": "royal",
      "text": "체력이 가장 높은 적 한 명에게 위력 24배 검격을 날립니다. 대상이 불타거나 성광 3중첩이면 강화되어 위력 48배가 됩니다."
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
        "x": 241,
        "y": 208,
        "size": 250
      }
    },
    "damage": 38,
    "interval": 1.5,
    "attack": "ice",
    "trait": {
      "type": "permafrost",
      "text": "얼음창이 일직선으로 관통하며 40% 느리게 합니다. 이미 느려진 적은 0.6초 얼립니다(같은 적은 3초 뒤 다시). 얼어 있던 적이 쓰러지면 주변 적도 느려집니다."
    },
    "skill": {
      "name": "빙궁의 칙령",
      "cost": 80,
      "type": "ice_court",
      "text": "적 전체에게 위력 9배 피해를 줍니다. 6초 동안 겨울 왕국이 되어 모든 적이 50% 느려지고 받는 피해가 15% 늘어나며, 쓰러진 적이 주변 적을 0.8초 얼립니다."
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
        "x": 255,
        "y": 225,
        "size": 250
      }
    },
    "damage": 14,
    "interval": 1.3,
    "attack": "sugar",
    "trait": {
      "type": "harmonyAura",
      "text": "상하좌우에 서로 다른 동료가 많을수록, 그 동료들의 위력(종류당 +6%)과 공격 속도(종류당 +5%)가 오릅니다."
    },
    "skill": {
      "name": "디저트 앙상블",
      "cost": 70,
      "type": "harmony",
      "text": "10초 동안 모든 동료의 위력과 공격 속도가 22% 오릅니다."
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
        "x": 258,
        "y": 224,
        "size": 250
      }
    },
    "damage": 30,
    "interval": 1.3,
    "attack": "mirror",
    "trait": {
      "type": "refraction",
      "text": "적 1명을 공격한 뒤 위력 75%의 환영탄이 한 번 더 날아가 성광을 남깁니다. 전장의 아우로라가 짝수(2·4기)면 위력 +50%."
    },
    "skill": {
      "name": "천면경",
      "cost": 75,
      "type": "mirror",
      "text": "가장 강한 적에게 5초 동안 거울을 겁니다. 그동안 그 적이 받은 피해의 50%를 모아 위력 12배와 함께 터뜨립니다. 다른 필살기와 함께 쓰면 더 많이 모입니다."
    },
    "heightGroup": "medium",
    "role": "지연 반사 · 환영탄",
    "shape": "single",
    "range": 540,
    "radius": 0
  },
  {
    "id": "behemoth",
    "name": "베히모스",
    "title": "대지를 쪼갠 주먹",
    "color": "#b9dd6a",
    "art": {
      "atlas": "unit-behemoth",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 257,
        "y": 222,
        "size": 250
      }
    },
    "damage": 42,
    "interval": 2,
    "attack": "stone",
    "trait": {
      "type": "auraDouble",
      "text": "자기 칸 주변(반경 210)의 적을 모두 칩니다. 상하좌우 동료의 오라 효과를 두 배로 받습니다."
    },
    "skill": {
      "name": "대지분쇄",
      "cost": 70,
      "type": "crush",
      "text": "무작위 적을 노려 주변에 위력 6배 충격을 0.5초 간격으로 3번 줍니다. 훈련마다 범위 +5%."
    },
    "heightGroup": "tall",
    "role": "오라 증폭 · 대지 분쇄",
    "shape": "pulse",
    "range": 210,
    "radius": 210
  },
  {
    "id": "underdog",
    "name": "언더독",
    "title": "마력 없는 주먹",
    "color": "#9fb2e0",
    "art": {
      "atlas": "unit-underdog",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 259,
        "y": 226,
        "size": 250
      }
    },
    "damage": 22,
    "interval": 0.9,
    "attack": "stone",
    "trait": {
      "type": "underdog",
      "text": "덱이 전부 노멀이면 위력이 80% 오릅니다."
    },
    "skill": {
      "name": "빅쇼",
      "cost": 80,
      "type": "bigshow",
      "text": "적 전체에게 위력 10배 피해를 주고, 아군 전체가 2초 기절합니다."
    },
    "heightGroup": "tall",
    "role": "노멀 덱 · 단일",
    "shape": "single",
    "range": 560,
    "radius": 0
  },
  {
    "id": "toffee_apple",
    "name": "토피애플",
    "title": "달콤한 함정",
    "color": "#e5604a",
    "art": {
      "atlas": "unit-toffee_apple",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 254,
        "y": 227,
        "size": 250
      }
    },
    "damage": 36,
    "interval": 1.4,
    "attack": "sugar",
    "trait": {
      "type": "toffee",
      "text": "폭탄을 설치하면 가장 높은 성급의 토피애플이 3초 기절합니다."
    },
    "skill": {
      "name": "애플봄",
      "cost": 95,
      "type": "applebomb",
      "text": "경로 앞쪽에 폭탄을 설치합니다(최대 5개). 적이 가까이 오면 바로 터져 적 전체에게 위력 9배 피해를 줍니다."
    },
    "heightGroup": "medium",
    "role": "저축 폭탄 · 관통",
    "shape": "beam",
    "range": 520,
    "radius": 24
  },
  {
    "id": "joker",
    "name": "조커",
    "title": "색이 바뀌는 광대",
    "color": "#f06aa8",
    "art": {
      "atlas": "unit-joker",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 237,
        "y": 215,
        "size": 250
      }
    },
    "damage": 22,
    "interval": 1,
    "attack": "cards",
    "trait": {
      "type": "joker",
      "text": "필살기를 쓸 때마다 색이 무작위로 바뀌고, 색에 따라 일반 공격이 상태 이상을 겁니다. 빨강 화상, 파랑 감속 20%, 초록 중독, 하양 성광, 검정 노출."
    },
    "skill": {
      "name": "레인보우 룰렛",
      "cost": 50,
      "type": "roulette",
      "text": "적 전체에게 위력 3배 피해를 주고 색을 지금과 다른 무작위 색으로 바꿉니다."
    },
    "heightGroup": "medium",
    "role": "상태 부여 · 범위",
    "shape": "splash",
    "range": 430,
    "radius": 56
  },
  {
    "id": "sunflower",
    "name": "해바라기",
    "title": "느긋한 광합성",
    "color": "#f2c230",
    "art": {
      "atlas": "unit-sunflower",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 255,
        "y": 230,
        "size": 250
      }
    },
    "damage": 36,
    "interval": 1,
    "attack": "sun",
    "trait": {
      "type": "sunlight",
      "text": "웨이브를 마칠 때마다 햇빛이 쌓입니다(최대 3, 모든 해바라기가 함께 씀). 햇빛 1·2·3개일 때 일반 공격이 반경 30·60·90으로 터집니다."
    },
    "skill": {
      "name": "솔라플레어",
      "cost": 90,
      "type": "solarflare",
      "text": "햇빛을 모두 써서 적 전체에게 위력 2배 + 햇빛당 4배 피해를 줍니다(3개면 14배)."
    },
    "heightGroup": "medium",
    "role": "햇빛 저축 · 단일",
    "shape": "single",
    "range": 500,
    "radius": 0
  },
  {
    "id": "antropy",
    "name": "앤트로피",
    "title": "디버프를 삼키는 빛",
    "color": "#c9b4f0",
    "art": {
      "atlas": "unit-antropy",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 246,
        "y": 219,
        "size": 250
      }
    },
    "damage": 24,
    "interval": 1.4,
    "attack": "halo",
    "trait": {
      "type": "antropy",
      "text": "적과 아군이 거는 기절과 저주를 무효화합니다. 소멸은 막지 못합니다."
    },
    "skill": {
      "name": "노바레퀴엠",
      "cost": 50,
      "type": "requiem",
      "text": "적의 모든 디버프를 지우고 전체 7배 피해를 줍니다."
    },
    "heightGroup": "short",
    "role": "디버프 무효 · 범위",
    "shape": "splash",
    "range": 480,
    "radius": 70
  },
  {
    "id": "cure_master",
    "name": "큐어마스터",
    "title": "굿나잇 큐어",
    "color": "#ff8fc1",
    "art": {
      "atlas": "unit-cure_master",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 255,
        "y": 213,
        "size": 250
      }
    },
    "damage": 22,
    "interval": 1.3,
    "attack": "syringe",
    "trait": {
      "type": "cure",
      "text": "상하좌우 아군에게 무적 오라를 줍니다. 무적은 기절과 저주, 천벌을 막습니다."
    },
    "skill": {
      "name": "레모네이드",
      "cost": 50,
      "type": "lemonade",
      "text": "아군 전체의 기절과 저주를 풀고 4초 동안 무적으로 만듭니다."
    },
    "heightGroup": "medium",
    "role": "보호 · 장판",
    "shape": "zone",
    "range": 460,
    "radius": 60
  },
  {
    "id": "ash",
    "name": "애쉬",
    "title": "재가 된 계약",
    "color": "#ff7048",
    "art": {
      "atlas": "unit-ash",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 261,
        "y": 198,
        "size": 250
      }
    },
    "damage": 31,
    "interval": 1.4,
    "attack": "fire",
    "trait": {
      "type": "burn",
      "text": "일반 공격에 화상을 겁니다."
    },
    "skill": {
      "name": "아마겟돈",
      "cost": 70,
      "type": "armageddon",
      "text": "가장 성급이 낮은 동료 한 명을 불태워 소멸시키고(무적이면 소멸하지 않습니다), 가장 밀집한 반경 180의 적에게 위력 18배 피해를 줍니다."
    },
    "heightGroup": "medium",
    "role": "화상 · 범위",
    "shape": "splash",
    "range": 470,
    "radius": 64
  },
  {
    "id": "venom",
    "name": "베놈",
    "title": "침묵하는 재앙",
    "color": "#6bc45a",
    "art": {
      "atlas": "unit-venom",
      "row": 0,
      "columns": 2,
      "foot": 0.9375,
      "scale": 1,
      "directional": true,
      "portrait": {
        "x": 251,
        "y": 228,
        "size": 250
      }
    },
    "damage": 34,
    "interval": 1.2,
    "attack": "poison",
    "trait": {
      "type": "venom",
      "text": "일반 공격에 중독과 화상을 함께 겁니다."
    },
    "skill": {
      "name": "플래이그",
      "cost": 80,
      "type": "venomplague",
      "text": "적 전체에게 위력 3배 피해와 중독 3중첩을 주고, 10초 동안 적이 받는 화상·중독 피해가 2배가 됩니다."
    },
    "heightGroup": "medium",
    "role": "지속 피해 · 단일",
    "shape": "single",
    "range": 520,
    "radius": 0
  }
];

export const ARTIFACTS = [
  {
    "id": "hourglass",
    "name": "별모래 시계",
    "text": "합성할 때마다 별빛을 10 더 얻습니다. 최대치를 넘친 별빛은 60까지 모아 두었다가 다음 필살기를 쓰면 돌려받습니다.",
    "scale": ["10"],
    "icon": 0,
    "atlas": "relics",
    "rarity": "common",
    "color": "#bbd5cc"
  },
  {
    "id": "ember",
    "name": "불씨의 심장",
    "text": "화상 피해가 70% 늘어납니다. 불타는 적이 쓰러지면 반경 90 안의 적에게 화상이 옮겨 붙습니다.",
    "scale": ["70%"],
    "icon": 1,
    "atlas": "relics",
    "rarity": "common",
    "color": "#bbd5cc"
  },
  {
    "id": "frost",
    "name": "녹지 않는 꽃",
    "text": "감속 중인 적에게 주는 피해가 22% 늘어납니다.",
    "scale": ["22%"],
    "icon": 2,
    "atlas": "relics",
    "rarity": "common",
    "color": "#bbd5cc"
  },
  {
    "id": "banner",
    "name": "홀로 선 깃발",
    "text": "상하좌우에 다른 동료가 없는 동료의 위력이 21% 오릅니다.",
    "scale": ["21%"],
    "icon": 3,
    "atlas": "relics",
    "rarity": "common",
    "color": "#bbd5cc"
  },
  {
    "id": "chorus",
    "name": "쌍둥이 음표",
    "text": "같은 동료가 전장에 3명 이상이면 그 동료들의 공격 속도가 35% 오릅니다.",
    "scale": ["35%"],
    "icon": 4,
    "atlas": "relics",
    "rarity": "common",
    "color": "#bbd5cc"
  },
  {
    "id": "lantern",
    "name": "꺼지지 않는 등불",
    "text": "필살기를 쓰면 쓴 별빛의 20%를 돌려받습니다.",
    "scale": ["20%"],
    "icon": 5,
    "atlas": "relics",
    "rarity": "common",
    "color": "#bbd5cc"
  },
  {
    "id": "lens",
    "name": "예리한 달조각",
    "text": "보스에게 주는 피해가 30% 늘어납니다.",
    "scale": ["30%"],
    "icon": 6,
    "atlas": "relics",
    "rarity": "common",
    "color": "#bbd5cc"
  },
  {
    "id": "seed",
    "name": "숨 쉬는 씨앗",
    "text": "독 피해가 40% 늘어납니다.",
    "scale": ["40%"],
    "icon": 7,
    "atlas": "relics",
    "rarity": "common",
    "color": "#bbd5cc"
  },
  {
    "id": "feather",
    "name": "첫새벽의 깃털",
    "text": "웨이브를 마칠 때마다 골드를 받습니다. 첫 웨이브 9G부터 웨이브마다 3G씩 늘어나 최대 60G입니다.",
    "scale": [{"t":"9G", "int":true}, {"t":"3G", "int":true}, {"t":"60G", "int":true}],
    "icon": 8,
    "atlas": "relics",
    "rarity": "common",
    "color": "#bbd5cc"
  },
  {
    "id": "crown",
    "name": "작은 왕관",
    "text": "3성 이상 동료의 위력이 16% 오릅니다.",
    "scale": ["16%"],
    "icon": 9,
    "atlas": "relics",
    "rarity": "common",
    "color": "#bbd5cc"
  },
  {
    "id": "sprout",
    "name": "풋내기 훈장",
    "text": "1·2성 동료의 위력이 20% 오르고, 동료 소환 비용이 2G 줄어듭니다.",
    "scale": ["20%"],
    "icon": 0,
    "atlas": "relics-new",
    "rarity": "common",
    "color": "#bbd5cc"
  },
  {
    "id": "amulet",
    "name": "수호자의 부적",
    "text": "코어 가까이(경로 마지막 3분의 1) 온 적에게 주는 피해가 35% 늘어납니다. 코어가 피해를 입으면 별빛을 15 얻습니다(웨이브마다 한 번).",
    "scale": ["35%", "15"],
    "icon": 1,
    "atlas": "relics-new",
    "rarity": "common",
    "color": "#bbd5cc"
  },
  {
    "id": "meteor",
    "name": "떨어진 별",
    "text": "동료의 12번째 공격마다 명중 지점에 운석이 떨어져, 반경 100 안의 적에게 그 공격 피해의 110%를 줍니다.",
    "scale": ["110%"],
    "icon": 10,
    "atlas": "relics",
    "rarity": "rare",
    "color": "#86c8ee"
  },
  {
    "id": "prism",
    "name": "천 갈래 프리즘",
    "text": "번개의현자·밤토끼·폭풍의현자의 공격이 다른 적에게 튈 때, 튄 공격의 피해가 70% 늘어납니다.",
    "scale": ["70%"],
    "icon": 11,
    "atlas": "relics",
    "rarity": "rare",
    "color": "#86c8ee"
  },
  {
    "id": "tide",
    "name": "파도의 소라",
    "text": "감속을 거는 공격이 맞으면 반경 80 안의 적에게 그 공격 피해의 22%를 주는 물보라가 일어납니다. 장판은 0.5초마다 일어납니다.",
    "scale": ["22%"],
    "icon": 12,
    "atlas": "relics",
    "rarity": "rare",
    "color": "#86c8ee"
  },
  {
    "id": "roots",
    "name": "영원의 뿌리",
    "text": "장판의 지속 시간이 15%, 범위가 6% 늘어납니다.",
    "scale": ["15%", "6%"],
    "icon": 13,
    "atlas": "relics",
    "rarity": "rare",
    "color": "#86c8ee"
  },
  {
    "id": "guild",
    "name": "동행의 악수",
    "text": "지원 오라를 받는 동료의 위력이 25% 오릅니다.",
    "scale": ["25%"],
    "icon": 14,
    "atlas": "relics",
    "rarity": "rare",
    "color": "#86c8ee"
  },
  {
    "id": "phoenix",
    "name": "돌아오는 새벽",
    "text": "원정마다 한 번, 코어에 닿은 보스를 경로 절반 지점으로 되돌리고, 그 보스가 받는 피해를 20% 늘립니다.",
    "scale": ["20%"],
    "icon": 15,
    "atlas": "relics",
    "rarity": "rare",
    "color": "#86c8ee"
  },
  {
    "id": "twin",
    "name": "쌍성의 거울",
    "text": "필살기 피해가 적중하고 1.5초 뒤 100%로 한 번 더 들어갑니다. 버프와 소환은 반복되지 않습니다.",
    "scale": ["100%"],
    "icon": 16,
    "atlas": "relics",
    "rarity": "epic",
    "color": "#c9a0f5"
  },
  {
    "id": "constellation",
    "name": "삼중 성좌",
    "text": "상하좌우에 서로 다른 동료가 3종 있으면 위력이 32%, 4종이면 50% 오릅니다.",
    "scale": ["32%", "50%"],
    "icon": 17,
    "atlas": "relics",
    "rarity": "epic",
    "color": "#c9a0f5"
  },
  {
    "id": "alchemy",
    "name": "별빛 연금술",
    "text": "합성으로 생긴 동료는 그 웨이브부터 3웨이브 동안 위력이 50% 오릅니다.",
    "scale": ["50%"],
    "icon": 18,
    "atlas": "relics",
    "rarity": "epic",
    "color": "#c9a0f5"
  },
  {
    "id": "orbit",
    "name": "별바다의 궤도",
    "text": "3성 이상 동료의 공격이 명중 지점에 2초 동안 별장판을 남깁니다. 별장판은 0.5초마다 그 공격 피해의 5%를 줍니다.",
    "scale": ["5%"],
    "icon": 19,
    "atlas": "relics",
    "rarity": "epic",
    "color": "#c9a0f5"
  },
  {
    "id": "tempo_bell",
    "name": "이어지는 종",
    "text": "웨이브를 넘길 때마다 모든 동료의 공격 속도가 4% 오릅니다(최대 36%).",
    "scale": ["4%", "36%"],
    "icon": 0,
    "atlas": "relics-expansion",
    "rarity": "rare",
    "color": "#86c8ee"
  },
  {
    "id": "chalice",
    "name": "독화의 성배",
    "text": "불타면서 독이 5중첩 이상 쌓인 적이 받는 피해가 60% 늘어납니다.",
    "scale": ["60%"],
    "icon": 2,
    "atlas": "relics-new",
    "rarity": "epic",
    "color": "#c9a0f5"
  },
  {
    "id": "royal_seal",
    "name": "결전의 인장",
    "text": "보스가 나타날 때마다 별빛을 30 얻고, 보스에게 주는 피해가 40% 늘어납니다.",
    "scale": ["30", "40%"],
    "icon": 1,
    "atlas": "relics-expansion",
    "rarity": "rare",
    "color": "#86c8ee"
  },
  {
    "id": "gift_ribbon",
    "name": "기적의 리본",
    "text": "동료를 소환하면 25% 확률로 리본을 단 2성으로 나옵니다.",
    "scale": ["25%"],
    "icon": 2,
    "atlas": "relics-expansion",
    "rarity": "epic",
    "color": "#c9a0f5"
  },
  {
    "id": "broken_clock",
    "name": "깨진 시간의 보석",
    "text": "버프 필살기와 트라우마 변신의 지속 시간이 100% 늘어납니다.",
    "scale": ["100%"],
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
    "warning": "마력 봉인 · 빛나는 한 행 2.4초 기절",
    "exposeScale": 2,
    "trait": "받는 노출 효과 2배",
    "frame": 0
  },
  "love_iris": {
    "name": "사랑의 여신 아이리스",
    "color": "#f7b6d4",
    "pattern": "starlust",
    "warning": "사랑의 시험 · 별빛이 가득 차 있으면 별빛 −60",
    "trait": "별빛을 가득 채워 두면 빼앗습니다",
    "frame": 1
  },
  "curse_iris": {
    "name": "저주의 여신 아이리스",
    "color": "#bc8be0",
    "pattern": "curse",
    "warning": "저주 · 동료 한 명이 합성 전까지 봉인됩니다",
    "trait": "예고 없는 저주 (등장마다 1회) · 합성·회수·자스민으로 해제",
    "frame": 2
  },
  "flora": {
    "name": "꽃의 여신 플로라",
    "color": "#c9dd8d",
    "pattern": "stun1",
    "warning": "꽃가루 폭풍 · 빛나는 1칸 2초 기절",
    "immune": "poison",
    "dotScale": {"burn":2},
    "trait": "중독 무효 · 화상 피해 2배",
    "frame": 3
  },
  "poseidon": {
    "name": "해신 포세이돈",
    "color": "#77c9e3",
    "pattern": "stun1",
    "warning": "해일의 일격 · 빛나는 1칸 2초 기절",
    "immune": "burn",
    "dotScale": {"poison":2},
    "trait": "화상 무효 · 중독 피해 2배",
    "frame": 4
  },
  "beelzebub": {
    "name": "마신 벨제뷔트",
    "color": "#dfa590",
    "pattern": ["warp","seal"],
    "warning": "공간 붕괴 · 감속·기절·빙결이 아닌 적이 앞으로 순간이동",
    "warnings": {"warp":"공간 붕괴 · 감속·기절·빙결이 아닌 적이 앞으로 순간이동","seal":"붕괴의 문장 · 빛나는 한 행 2.4초 기절"},
    "trait": "제어되지 않은 적을 앞당김 · 행 기절",
    "frame": 5
  },
  "thor": {
    "name": "뇌신 토르",
    "color": "#a9dcff",
    "pattern": "storm",
    "warning": "신벌의 낙뢰 · 빛나는 3칸에서 이동하세요",
    "judgement": "천둥 기둥 · 빛나는 세로 3줄이 3초 기절합니다. 토르를 기절시키면 취소됩니다",
    "trait": "낙뢰 3칸 · 길 중간에서 세로 3줄 기절 1회 · 기절로 취소",
    "atlas": "bosses-expansion",
    "frame": 0
  },
  "ares": {
    "name": "투신 아레스",
    "color": "#ffa88b",
    "pattern": "shuffle",
    "warning": "투신의 난무 · 2.6초 뒤 모든 동료의 자리가 뒤섞입니다",
    "trait": "등장마다 최대 2회 전체 재배치",
    "atlas": "bosses-expansion",
    "frame": 1
  },
  "astea": {
    "name": "창조신 아스테아",
    "color": "#e8d3ff",
    "pattern": "judgement",
    "warning": "천벌 · 빛나는 칸의 동료가 사라집니다. 옮기세요",
    "basicScale": 0.5,
    "trait": "일반 공격 피해 절반 · 예고된 칸에 천벌",
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
      "x": 252,
      "y": 204,
      "size": 250
    }
  }
};

export const ASSET_PATHS = {
  "effects-sol-sweet": "./assets/merge/effects-sol-sweet.webp",
  "effects-sol-twilight": "./assets/merge/effects-sol-twilight.webp",
  "unit-zeke": "./assets/cast-v2/zeke.webp",
  "unit-rumi": "./assets/cast-v2/rumi.webp",
  "unit-luna": "./assets/cast-v2/luna.webp",
  "unit-cinderella": "./assets/cast-v2/cinderella.webp",
  "unit-snow_rabbit": "./assets/cast-v2/snow_rabbit.webp",
  "unit-avalanche_maid": "./assets/cast-v2/avalanche_maid.webp",
  "unit-night_rabbit": "./assets/cast-v2/night_rabbit.webp",
  "unit-guardian": "./assets/cast-v2/guardian.webp",
  "unit-storm_sage": "./assets/cast-v2/storm_sage.webp",
  "unit-lightning_sage": "./assets/cast-v2/lightning_sage.webp",
  "unit-red_dragon": "./assets/cast-v2/red_dragon.webp",
  "unit-flame_sage": "./assets/cast-v2/flame_sage.webp",
  "unit-mushroom_king": "./assets/cast-v2/mushroom_king.webp",
  "unit-great_detective": "./assets/cast-v2/great_detective.webp",
  "unit-siren": "./assets/cast-v2/siren.webp",
  "unit-phantom": "./assets/cast-v2/phantom.webp",
  "unit-queen": "./assets/cast-v2/queen.webp",
  "unit-galaxy_whale": "./assets/cast-v2/galaxy_whale.webp",
  "unit-silver_rabbit": "./assets/cast-v2/silver_rabbit.webp",
  "unit-ancient_dragon": "./assets/cast-v2/ancient_dragon.webp",
  "unit-time_ruler": "./assets/cast-v2/time_ruler.webp",
  "unit-doom": "./assets/cast-v2/doom.webp",
  "unit-santa": "./assets/cast-v2/santa.webp",
  "unit-jasmine": "./assets/cast-v2/jasmine.webp",
  "unit-star_boy": "./assets/cast-v2/star_boy.webp",
  "unit-time_magician": "./assets/cast-v2/time_magician.webp",
  "unit-cherry_prince": "./assets/cast-v2/cherry_prince.webp",
  "unit-frost_witch": "./assets/cast-v2/frost_witch.webp",
  "unit-harmonious": "./assets/cast-v2/harmonious.webp",
  "unit-aurora": "./assets/cast-v2/aurora.webp",
  "unit-behemoth": "./assets/cast-v2/behemoth.webp",
  "unit-underdog": "./assets/cast-v2/underdog.webp",
  "unit-toffee_apple": "./assets/cast-v2/toffee_apple.webp",
  "unit-joker": "./assets/cast-v2/joker.webp",
  "unit-sunflower": "./assets/cast-v2/sunflower.webp",
  "unit-antropy": "./assets/cast-v2/antropy.webp",
  "unit-cure_master": "./assets/cast-v2/cure_master.webp",
  "unit-ash": "./assets/cast-v2/ash.webp",
  "unit-venom": "./assets/cast-v2/venom.webp",
  "garden": "./assets/merge/garden.webp",
  "summon-altar": "./assets/merge/summon-altar.webp",
  "greenhouse": "./assets/merge/greenhouse.webp",
  "greenhouse-beds": "./assets/merge/greenhouse-beds.webp",
  "greenhouse-dawn": "./assets/merge/greenhouse-dawn.webp",
  "greenhouse-beds-dawn": "./assets/merge/greenhouse-beds-dawn.webp",
  "gifts": "./assets/merge/gifts.webp",
  "fx-emblems": "./assets/merge/fx-emblems.webp",
  "bosses": "./assets/moonlit/realm-bosses.webp",
  "creatures": "./assets/moonlit/creatures.webp",
  "relics": "./assets/merge/relics.webp",
  "blessings": "./assets/merge/blessings.webp",
  "effects": "./assets/merge/effects.webp",
  "unit-trauma": "./assets/cast-v2/trauma.webp",
  "effects-expansion": "./assets/merge/effects-expansion.webp",
  "finishers": "./assets/merge/finishers.webp",
  "relics-expansion": "./assets/merge/relics-expansion.webp",
  "bosses-expansion": "./assets/merge/bosses-expansion.webp",
  "realms-expansion": "./assets/merge/realms-expansion.webp",
  "effects-trio": "./assets/merge/effects-trio.webp",
  "effects-behemoth": "./assets/merge/effects-behemoth.webp",
  "effects-applebomb": "./assets/merge/effects-applebomb.webp",
  "effects-bigshow": "./assets/merge/effects-bigshow.webp",
  "ultimates": "./assets/merge/ultimates.webp",
  "ancient-cross": "./assets/merge/ancient-cross.webp",
  "zeke-cone": "./assets/merge/zeke-cone.webp",
  "zeke-slash": "./assets/merge/zeke-slash.webp",
  "orbit-zone": "./assets/merge/orbit-zone.webp",
  "relics-new": "./assets/merge/relics-new.webp"
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
