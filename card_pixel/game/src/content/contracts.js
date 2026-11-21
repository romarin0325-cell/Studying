export const CONTRACT_ESCROW = 1;
export const CONTRACT_PAYOUT = 3;
export const LEGACY_CONTRACT_RULE_VERSION = 1;
export const CONTRACT_RULE_VERSION = 2;

export function gateEscrow(floor, type) {
  return floor === 4 && type === 'gate' ? CONTRACT_ESCROW : 0;
}

export const CONTRACTS = {
  rescue: {
    id: 'rescue', name: '살아서 넘긴 자리',
    rule: '4층이나 6층에서 쓰러질 예고를 받은 동료를 후퇴시키고, 그 동료를 살려 전투에서 승리'
  },
  heirloom: {
    id: 'heirloom', name: '마지막 유품',
    rule: '4층 문지기전에서 유품 스킬로 적을 처치하고 승리'
  },
  elite: {
    id: 'elite', name: '둘이 돌아온 정예전',
    rule: '2층 위험 문을 거쳐 6층 정예를 선택하고, 정예전에 출전한 동료 2명 이상 생존하여 승리'
  }
};
