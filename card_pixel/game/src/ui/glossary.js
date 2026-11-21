export const TERMS = {
  crystal: { short: '결정', firstUse: '결정 ◆ · 이번 원정에서 쓰는 재화', detail: '소환의 샘과 원정 중 거래에 사용합니다.', scope: '원정' },
  join: { short: '합류', firstUse: '이번 원정 합류', detail: '이번 원정에 함께할 동료가 됩니다.', scope: '원정' },
  recruit: { short: '영입', firstUse: '돌아온 동료를 관측소에 맞이', detail: '영입한 동료는 다음 원정에도 함께할 수 있습니다.', scope: '관측소' },
  returned: { short: '생환' },
  relayOrder: { short: '싸우는 순서', current: '지금', next: '다음' },
  awakening: {
    picked: '직접 고름', random: '무작위 합류',
    detail: (remaining, draws, hasChoices) => (hasChoices
      ? remaining === 1 ? '고른 한 명이 합류하고, ' : '고른 동료가 합류하고, 선택을 마치면 '
      : '') + '무작위로 ' + draws + '명이 더 합류해.'
  },
  startCompanion: { short: '시작 동료', firstUse: '원정 시작부터 함께할 동료', detail: '시작 동료를 한 명 정할 수 있습니다.', scope: '준비' },
  springInvite: { short: '샘 초대', firstUse: '샘 초대: 이번 원정에서 처음 후보 3칸을 열면, 초대한 동료 중 한 명이 보여요.',
    detail: '영입한 동료를 이 지역 출현 명단에 추가하고 첫 샘 후보로 초대합니다.', scope: '준비' },
  exclude: { short: '출현 제외', firstUse: '이 지역의 뽑기 후보에서 제외', detail: '등급마다 한 명은 출현 명단에 남겨야 합니다.', scope: '준비' },
  bond: { short: '인연', firstUse: '영입 후 문지기나 보스에 출전해 살아 돌아온 횟수', detail: '출전하고 돌아온 동료의 인연이 오릅니다.', scope: '기록' },
  boost: { short: '강화', firstUse: '이미 함께 · 강화', detail: '공격·마공 +10%', scope: '원정' },
  memory: { short: '기억', firstUse: '동료의 기억', detail: '쓰러지거나 보낸 동료가 다시 나오면 가장 먼저 합류한 생존 동료에게 공격·마공 +10%를 줍니다.', scope: '원정' },
  heirloom: { short: '유품', firstUse: '쓰러진 동료가 남긴 기술', detail: '다음 동료가 물려받습니다. 위력 ×1.5 · MP 0 · 전투당 1회', use: 'MP 0 · 1회', scope: '원정' },
  relic: { short: '유물', firstUse: '이번 원정에 장착한 물건', detail: '전투에 효과를 주며 최대 4개를 장착합니다.', scope: '원정' },
  retreat: { short: '물러나기', firstUse: '이번 전투에서 살아서 빠짐', detail: '다음 동료가 이번 공격을 받음', scope: '전투' },
  wild: { short: '전투 · 몽마', firstUse: '일반 적', detail: '적을 물리치고 다음 층으로 갑니다.', scope: '층' },
  elite: { short: '강한 적 · 정예', firstUse: '강한 적', detail: '강한 적이 기다리는 전투입니다.', scope: '층' },
  gate: { short: '중간 보스 · 문지기', firstUse: '중간 보스', detail: '문지기를 쓰러뜨리고 다음 길을 엽니다.', scope: '층' },
  boss: { short: '보스 · 꿈의 주인', firstUse: '마지막 보스', detail: '마지막 적이 기다리는 전투입니다.', scope: '층' },
  spring: { short: '소환의 샘', firstUse: '결정으로 동료를 뽑는 곳', detail: '결정 1개로 한 번 뽑기 · 새 동료, 강화 또는 기억', scope: '층' },
  treasure: { short: '보물방', firstUse: '유물을 얻는 곳', detail: '유물을 장착할 수 있습니다.', scope: '층' },
  event: { short: '사건', firstUse: '선택에 따라 보상이 달라지는 만남', detail: '선택의 조건과 효과를 확인할 수 있습니다.', scope: '층' },
  legend: { short: '전설군', firstUse: '전설군 · 전설·초월·이벤트 포함', detail: '전설·초월·이벤트 포함', scope: '뽑기' }
};
