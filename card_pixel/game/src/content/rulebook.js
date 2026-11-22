// Player-facing review data. The game does not load this module.
import { ENTRY_FIRST_MAIN_ENEMY_HP } from './tempo.js';

export const RULEBOOK = [
  {
    id: 'boss-countdown', group: '전투 규칙 추가', name: 'A. 보스 카운트다운',
    rule: '전투 중 지금 발동할 기술 또는 최대 14턴 앞의 예정 기술까지 남은 턴을 표시합니다. 템포 v2에서는 문 밖에서도 첫 15턴의 고정 행동과 예고할 수 있는 분기를 봅니다.',
    where: 'card_pixel/game/src/engine/bridge.js:countdown', since: '2026-11-16'
  },
  {
    id: 'enemy-intent', group: '전투 규칙 추가', name: 'B. 적의 다음 행동 예고',
    rule: '플레이어가 행동하기 전에 이번 적 턴의 행동 1개를 뽑아 예고하고 같은 행동을 실행합니다. 예고 뒤 적이 기절하면 행동을 건너뛰며, 후퇴하면 다음 동료에게 들어올 피해 범위를 미리 봅니다.',
    where: 'card_pixel/game/src/engine/bridge.js:currentIntent', since: '2026-11-16'
  },
  {
    id: 'enemy-relay', group: '전투 규칙 추가', name: 'C. 적 릴레이',
    rule: '한 전투에서 적이 여럿이면 1명씩 상대합니다. 다음 적이 등장해도 아군 HP·MP와 필드 효과는 이어지며, 새 적은 등장한 턴을 보내고 다음 턴에 첫 행동을 합니다.',
    where: 'card_pixel/game/src/engine/bridge.js:nextEnemy', since: '2026-11-16'
  },
  {
    id: 'retreat', group: '전투 규칙 추가', name: 'D. 물러나기',
    rule: '뒤에 살아 있는 동료가 있을 때 전투당 1번 물러날 수 있습니다. 현 동료는 생존 처리되며 사망 특성과 유품 계승을 발동하지 않습니다. 이 행동으로 턴을 써서 다음 동료가 적의 행동을 받습니다.',
    where: 'card_pixel/game/src/engine/bridge.js:canRetreat', since: '2026-11-16'
  },
  {
    id: 'heirloom', group: '전투 규칙 추가', name: 'E. 유품',
    rule: '동료가 쓰러지면 뒤의 생존 동료 1명에게 가장 높은 티어의 공격 기술을 넘깁니다. 같은 티어에서는 위력이 높은 기술이 우선입니다. 기존 유품을 덮어쓰며, 위력 1.5배·MP 0으로 전투당 1번 쓸 수 있습니다. 받은 동료가 생존하면 원정에 남습니다.',
    where: 'card_pixel/game/src/engine/bridge.js:afterAllyDown', since: '2026-11-18'
  },
  {
    id: 'last-stand', group: '전투 규칙 추가', name: 'F. 최후의 일인',
    rule: '2명 이상 출전한 전투에서 사망이나 후퇴 뒤 전장에 1명만 남으면, 그 동료의 공격력·마법공격력이 1.5배, 치명타율이 25%p 오릅니다. 전투당 1번 발동합니다.',
    where: 'card_pixel/game/src/engine/bridge.js:checkLastStand', since: '2026-11-18'
  },
  {
    id: 'quirk-roll', group: '전투 규칙 추가', name: 'G. 꿈의 변덕 배정',
    rule: '본편 2층 위험 문에서 전투 전체에 적용될 변덕을 최대 1개 뽑습니다. 악몽 외에는 넘침을 제외한 변덕의 50%가 적 접두사 1개로 바뀝니다. 오늘의 균열 6층 위험 문에서도 날짜별로 변덕 또는 접두사 1개가 나옵니다.',
    where: 'card_pixel/game/src/engine/rooms.js:makeBattleDoor', since: '2026-11-18'
  },
  {
    id: 'affix-roll', group: '전투 규칙 추가', name: 'H. 적 접두사 배정',
    rule: '일반 위험 문은 변덕 대신 첫 적에게 접두사 1개를 받을 수 있습니다. 정예 문의 첫 적은 2개를 받고, 악몽은 첫 적에게 1개를 더합니다. 위험 문의 넘침은 위험 문 자체 접두사를 추가하지 않습니다.',
    where: 'card_pixel/game/src/engine/rooms.js:makeBattleDoor', since: '2026-11-18'
  },
  {
    id: 'region-triggers', group: '전투 규칙 추가', name: '지역 효과가 발동하는 때',
    rule: '잿불은 적 처치 후 다음 적에게 작열 최대 2스택을 넘깁니다. 종은 3·6·9턴 시작 시 디바인 2스택을 붙입니다. 별빛 하늘은 시작 필드 효과를 적용합니다. 조류는 적 기준 4턴 주기, 투기장은 일반 공격 2회 적중 후 공격 기술 피해 2배가 기준입니다.',
    where: 'card_pixel/game/src/engine/bridge.js:nextEnemy', since: '지역 규칙 도입'
  },
  {
    id: 'three-beat', group: '전투 규칙 추가', name: '세 박자 행동표',
    rule: '템포 v2 일반 몽마·그림자는 각자 등장 후 일반 공격 1배 → 첫 공격 기술의 위력 ×1.15 → 물리 약공 0.55배를 반복합니다. 2번째 행동을 강공으로 예고합니다. 심야의 조류에서는 4박자, 보스에서는 원본 행동표를 씁니다.',
    where: 'card_pixel/game/src/engine/bridge.js:patternActions', since: '템포 v2'
  },
  {
    id: 'start-mp', group: '전투 규칙 추가', name: '시작 MP 65',
    rule: '원본의 기본 시작 MP는 100입니다. 템포 v2 본편에서는 출전 동료가 MP 65로 시작합니다. 마나 폭주 문은 최대·시작 MP가 200입니다. 입문 대여전 선봉은 MP 0이고, 오늘의 균열은 기존 시작 MP를 씁니다.',
    where: 'card_pixel/game/src/engine/bridge.js:setupAllies', since: '템포 v2'
  },
  {
    id: 'reinforcement', group: '전투 규칙 추가', name: '무료 증원',
    rule: '템포 v2 본편 1·2·6층 전투에서 이기면 후보 중 1명을 결정 0개로 깨우거나 건너뜁니다. 신규 프로필의 첫 본편은 빈자리가 있을 때만 후보 1명을 제시합니다. 후보가 한 명이면 승리 결과판에서 바로 합류시키거나 보충 없이 다음 층으로 갑니다. 전체 증원이 열리면 최대 3개 후보가 나오며, 정원 6명에서 신규 합류를 고를 때만 기존 동료 1명을 보냅니다.',
    where: 'card_pixel/game/src/engine/run.js:setReinforcement', since: '템포 v2'
  },
  {
    id: 'roster-limit', group: '전투 규칙 추가', name: '동료 6명과 출전 3자리',
    rule: '현재 원정에서는 동료를 6명까지 보유하고 전투에 1~3명을 배치합니다. 새 ID가 나오면 합류하고, 정원 초과 시 보낼 동료를 고릅니다. 살아 있는 동료가 다시 나오면 강화됩니다. 쓰러지거나 보낸 동료가 나오면 기억이 되어 생존자 중 가장 먼저 합류한 동료를 강화합니다. 스택당 원래 공격력·마법공격력의 10%가 원정 동안 합산되며 축복과 별개입니다.',
    where: 'card_pixel/game/src/engine/awakenings.js:replacementCount', since: '템포 v2'
  },
  {
    id: 'battle-blessing', group: '전투 규칙 추가', name: '전투 축복',
    rule: '전투 축복이 열린 템포 v2 본편에서 전투마다 1명을 뽑고 노멀·레어를 우선합니다. 노멀 +60%, 레어 +45%, 에픽·이벤트 +30%, 전설·초월 +15%입니다. 원정 축복과 전투 축복 중 높은 수치를 쓰며, 예행 버전에는 같은 동료가 2번 연속 뽑히면 다음 추첨에서 다른 후보가 있는 한 제외합니다.',
    where: 'card_pixel/game/src/engine/rooms.js:battleBlessing', since: '템포 v2'
  },
  {
    id: 'first-main-assist', group: '전투 규칙 추가', name: '첫 본편 꿈결과 단순 규칙',
    rule: `신규 프로필의 첫 본편은 꿈결로 고정합니다. 지역 효과·추가 적·지역 배율, 위험·정예 문, 변덕, 접두사, 전투 축복, 제단, 내기와 유료 거래가 빠집니다. 사건은 5층부터 무료 즉시 선택만 나옵니다. 보스 예행·문지기·보스·보물·유물·◆1 깨우기와 단순 증원을 이용할 수 있습니다. 여정 첫 생환 전과 꿈결에서 적용하는 문지기·보스 완충을 포함해, 첫 본편에서는 일반 적·문지기·보스의 기존 HP 배율에 ×${ENTRY_FIRST_MAIN_ENEMY_HP}를 추가로 곱한 뒤 반올림합니다. 꿈결의 적 공격력·마법공격력은 기존 65% 보정을 적용합니다.`,
    where: 'card_pixel/game/src/engine/rooms.js:applyDoorTempo', since: '단계 해금 v1'
  },
  {
    id: 'lesson-transfer', group: '전투 규칙 추가', name: '보스 예행 넘기기',
    rule: '예행 v1 본편의 2·6층에서 보스 예행 행동을 먼저 겪습니다. 첫 적이 자기 2턴 예고 전에 쓰러지면 두 번째 적이 이어받습니다. 한 적이 2턴 예고에 도달하면 더 이상 넘기지 않습니다.',
    where: 'card_pixel/game/src/engine/bridge.js:teachesLesson', since: '예행 v1'
  },
  {
    id: 'wild-shadows', group: '전투 규칙 추가', name: '야생 문과 그림자',
    rule: '보통 몽마 문에는 적 1명, 잿불 계승 지역에는 2명이 나오고 넘침은 1명을 더합니다. 6층 이후 적마다 일반 문은 35%, 정예는 50% 확률로 그림자를 시도합니다. 그림자는 원래 동료의 공격 기술 하나를 가져오며 위력은 1.6~2.4배 범위로 맞춥니다.',
    where: 'card_pixel/game/src/engine/rooms.js:wildEnemies', since: '원정 기본'
  },
  {
    id: 'fall-and-wipe', group: '전투 규칙 추가', name: '전투 뒤 사망과 전멸',
    rule: '출전한 1~3명 중 쓰러진 동료는 남은 원정에서 빠지며 보유 축복과 유품을 잃습니다. 전투에서 패배하거나 최종전 전에 승리했어도 원정 동료가 0명이면 원정이 끝납니다. 첫 입문 생환 전 최종 문지기전 패배에는 재도전할 수 있습니다.',
    where: 'card_pixel/game/src/engine/run.js:settleBattle', since: '원정 기본'
  },
  {
    id: 'opening-awakening', group: '깨우기·제단', name: '원정 시작 깨우기',
    rule: '최대 3명씩 제안하여 2명을 고르고, 이후 3명을 무작위로 깨웁니다. 시작 동료 또는 입문에서 보존된 선봉이 먼저 합류하면 선택은 1번입니다. 출발 명단은 서로 다른 동료로 채우며, 고르지 않은 후보 1명은 문지기 그림자로 예약될 수 있습니다.',
    where: 'card_pixel/game/src/engine/run.js:completeStart', since: '원정 기본'
  },
  {
    id: 'awakening-rates', group: '깨우기·제단', name: '깨우기 비용과 등급 확률',
    rule: '샘에서 결정 1개를 쓰면 한 번 뽑고, 3개를 쓰면 제시된 최대 3칸 중 1칸을 고릅니다. 노멀·레어·에픽·전설군 순서로 ◆1은 40·30·20·10%, ◆3의 무작위 한 칸은 25·30·25·20%입니다. 지역 출현 명단에서 출현 제외만 빼고, 등급을 먼저 뽑은 뒤 그 등급 안에서 균등하게 뽑습니다. 빈 등급의 가중치는 빼고 다시 계산합니다. 전설군에는 전설·초월·이벤트가 포함됩니다.',
    where: 'card_pixel/game/src/engine/awakenings.js:ratesView', since: '뽑기 v2'
  },
  {
    id: 'spring-pick', group: '깨우기·제단', name: '샘 후보 미리보기와 확정',
    rule: '첫 본편 클리어 뒤 ◆3 제시가 열립니다. 제시는 열람이 무료이며 1칸을 확정할 때 결제합니다. 무작위 칸은 같은 동료가 여러 칸에 나올 수 있고, 첫 유료 선택의 유효한 초대 동료는 초대 칸에 나옵니다. 제시와 슬롯은 다시 열거나 저장을 불러와도 고정됩니다. 진행 중인 뽑기 v1 원정은 기존 중복 제외 규칙을 쓰며, 이미 결제한 제안은 추가 차감 없이 확정할 수 있습니다.',
    where: 'card_pixel/game/src/engine/run.js:commitSpringOffer', since: '뽑기 v2'
  },
  {
    id: 'altar-blessing', group: '깨우기·제단', name: '혼돈의 제단',
    rule: '결정 0개로 최대 3번 굴려 매번 동료 1명을 뽑습니다. 원정 축복은 노멀 40%, 레어 30%, 에픽·이벤트 20%, 전설·초월 10%이고, 15% 확률로 2.5배입니다. 마지막 결과를 확정하면 그 동료의 이전 원정 축복을 덮어씁니다.',
    where: 'card_pixel/game/src/engine/run.js:altarRoll', since: '원정 기본'
  },
  {
    id: 'recruit-after-clear', group: '영입·시작 동료·샘 초대·출현 제외', name: '생환 동료 영입',
    rule: '최종 승리 때 원정 명단에 살아서 남은 미영입 동료를 꿈결·여정에서 1명, 악몽에서 2명까지 영입합니다. 대기하거나 물러난 동료도 포함됩니다. 영입 후보에는 보스·문지기·일반 전투·대기 중 가장 높은 출전 이력이 붙습니다. 이미 영입한 동료의 인연 +1은 문지기 또는 보스전 출전 뒤 생존해야 적용됩니다. 정산 대기 중인 구저장은 당시 제시한 후보를 유지합니다.',
    where: 'card_pixel/game/src/engine/meta.js:applyRunEnd', since: '프로필 원정'
  },
  {
    id: 'failed-run-shard', group: '영입·시작 동료·샘 초대·출현 제외', name: '패배 뒤 조각',
    rule: '원정에서 패배하면 출전한 미영입 동료 1명을 조각으로 남길 수 있습니다. 다음 원정의 출현 풀에 추가되고 첫 깨우기에 우선 제안됩니다.',
    where: 'card_pixel/game/src/engine/run.js:runRewards', since: '프로필 원정'
  },
  {
    id: 'companions', group: '영입·시작 동료·샘 초대·출현 제외', name: '단계 해금과 출발 준비',
    rule: '신규 프로필의 입문 4층에는 보물방만 등장합니다. 입문을 클리어하면 홍련 화산과 황혼 성당이 열리고, 영입한 동료 1명이 본편 시작 동료가 됩니다. 첫 본편 클리어로 난이도 선택, 시작 동료·샘 초대·출현 제외 편집, 임무와 오늘의 균열이 열립니다. 샘 초대는 수첩 2·4·5장에서 각각 1·2·3칸을 얻으며, 초대 동료는 지역 출현 명단에도 추가됩니다.',
    where: 'card_pixel/game/src/engine/meta.js:prepView', since: '단계 해금 v1'
  },
  {
    id: 'seals', group: '영입·시작 동료·샘 초대·출현 제외', name: '던전별 출현 제외',
    rule: '여정 생환 후 해당 던전에서 동료 1명, 악몽 생환 후 최대 3명을 출현 명단에서 뺍니다. 시작 동료는 제외할 수 없으며, 던전 기본 명단의 등급군은 각각 1명 이상 남겨야 합니다.',
    where: 'card_pixel/game/src/engine/meta.js:setSeals', since: '프로필 원정'
  },
  {
    id: 'crystal-economy', group: '결정·보상', name: '꿈의 결정 수입',
    rule: '본편 원정은 결정 1개로 시작합니다. 일반 몽마 문 승리 +1, 2층 위험 문 +2, 본편 문지기와 정예 문 +3입니다. 보물 접두사 적은 처치 후 승리 시 1명마다 +2, 루터는 승리한 출전 생존자에 1명 이상 있으면 전투당 +1입니다.',
    where: 'card_pixel/game/src/engine/run.js:settleBattle', since: '원정 기본'
  },
  {
    id: 'gate-reward', group: '결정·보상', name: '문지기·정예 유물과 합류',
    rule: '본편 4층 문지기를 이기면 쓰러뜨린 그림자 중 합류 가능한 1명이나 제안 유물 1개를 고릅니다. 6층 정예전 승리와 보물방은 유물 1개를 줍니다. 보유 유물 4개가 찼으면 교체할 1개를 고릅니다.',
    where: 'card_pixel/game/src/engine/run.js:chooseGateReward', since: '원정 기본'
  },
  {
    id: 'event-next-battle', group: '결정·보상', name: '사건의 다음 전투 효과',
    rule: '사건의 디버프는 전투 첫 적 1명에게 적용합니다. 시작 필드 효과는 사건을 우선해 지역 효과와 합치고 중복을 빼며, 상한은 보통 3개·버프오버로드 보유 시 5개입니다. 임시 유물·내기는 다음 전투 정산에서 소진되며, 내기는 1개만 걸 수 있습니다.',
    where: 'card_pixel/game/src/engine/run-battle.js:battleStart', since: '원정 기본'
  },
  {
    id: 'save-recovery', group: '저장', name: '프로필·원정 저장과 복구',
    rule: '프로필과 본편 진행을 한 세션에 저장하고 균열 기록을 별도로 관리합니다. 단계 해금은 출발 시점의 규칙을 원정에 저장하고, 기존 진행 기록이 있는 구저장은 열린 기능을 유지합니다. 원정 데이터만 손상되면 프로필로 복구할 수 있습니다. 정산 뒤 마지막 정상 프로필 1개를 보존하며, v1 JSON 백업에는 본편 세션·균열·설정을 담고 검증을 통과하면 저장 슬롯을 교체합니다.',
    where: 'card_pixel/game/src/engine/save.js:createSaveStore', since: '백업 v1'
  }
];
