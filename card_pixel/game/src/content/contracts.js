export const CONTRACT_ESCROW = 1;
export const CONTRACT_PAYOUT = 3;
export const LEGACY_CONTRACT_RULE_VERSION = 1;
export const CONTRACT_RULE_VERSION = 2;

export const CONTRACTS = {
  rescue: {
    id: 'rescue', name: '살아서 넘긴 자리',
    rule: '4층이나 6층에서 쓰러질 예고를 받은 동료를 물러나게 하고, 그 동료를 살려 전투에서 이긴다.'
  },
  heirloom: {
    id: 'heirloom', name: '마지막 유품',
    rule: '4층 문지기전에서 유품 기술의 명중으로 적을 쓰러뜨리고 이긴다.'
  },
  elite: {
    id: 'elite', name: '둘이 돌아온 정예전',
    rule: '2층 위험 문을 지나 6층 정예를 고르고, 정예전에 나선 동료 둘 이상이 살아서 이긴다.'
  }
};
