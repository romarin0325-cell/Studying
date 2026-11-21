// Player-facing review data. The game does not load this module.
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
    rule: '템포 v2 본편 1·2·6층 전투에서 이기면 최대 3명 중 1명을 결정 0개로 깨우거나 건너뜁니다. 동료가 이미 6명이면 1명을 보내고 새 동료를 받습니다.',
    where: 'card_pixel/game/src/engine/run.js:setReinforcement', since: '템포 v2'
  },
  {
    id: 'roster-limit', group: '전투 규칙 추가', name: '동료 6명과 출전 3자리',
    rule: '템포 v2 원정 동료는 6명까지이며 전투에는 1~3명을 배치합니다. 합류로 한도를 넘기면 초과 인원만큼 동료를 보내야 합니다. 전투에서 쓰러지거나 원정에서 보낸 동료는 그 원정의 깨우기 풀에 다시 나오지 않습니다.',
    where: 'card_pixel/game/src/engine/awakenings.js:replacementCount', since: '템포 v2'
  },
  {
    id: 'battle-blessing', group: '전투 규칙 추가', name: '전투 축복',
    rule: '템포 v2 본편에서 전투마다 1명을 뽑고 노멀·레어를 우선합니다. 노멀 +60%, 레어 +45%, 에픽·이벤트 +30%, 전설·초월 +15%입니다. 원정 축복과 전투 축복 중 높은 수치를 쓰며, 예행 버전에는 같은 동료가 2번 연속 뽑히면 다음 추첨에서 다른 후보가 있는 한 제외합니다.',
    where: 'card_pixel/game/src/engine/rooms.js:battleBlessing', since: '템포 v2'
  },
  {
    id: 'first-main-assist', group: '전투 규칙 추가', name: '첫 본편 완충과 쉬움',
    rule: '템포 v2 일반 본편 생환 전과 쉬움 난이도에서는 문지기 HP ×0.97·공격력 ×2.85, 보스 HP ×0.6·공격력 ×1.6을 층 보정 뒤 적용합니다. 화산 보스는 ×0.56·×1.55, 성당 보스는 ×0.53·×1.46입니다. 쉬움은 추가로 적 공·마공을 65%로 낮춥니다.',
    where: 'card_pixel/game/src/engine/run.js:createRun', since: '템포 v2'
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
    rule: '최대 3명씩 제안하여 2명을 고르고, 이후 3명을 무작위로 깨웁니다. 대표 또는 입문에서 보존된 선봉이 먼저 합류하면 선택은 1번입니다. 고르지 않은 후보 1명은 문지기 그림자로 예약될 수 있습니다.',
    where: 'card_pixel/game/src/engine/run.js:completeStart', since: '원정 기본'
  },
  {
    id: 'awakening-rates', group: '깨우기·제단', name: '깨우기 비용과 등급 확률',
    rule: '샘에서 결정 1개를 쓰면 무작위 1명, 3개로는 최대 3명의 후보 중 1명을 고릅니다. 노멀·레어·에픽·전설 순으로 무작위는 40·30·20·10%, 선택 후보 추첨은 25·30·25·20%입니다. 이 두 비율은 원본 기본 모드의 일반·도전 소환과 같습니다. 후보가 없는 등급을 빼고 비율을 다시 계산하며, 이벤트·초월은 전설 묶음입니다.',
    where: 'card_pixel/game/src/engine/awakenings.js:drawFrom', since: '원정 기본'
  },
  {
    id: 'spring-pick', group: '깨우기·제단', name: '샘 후보 미리보기와 확정',
    rule: '예행 v1에서는 결정 3개짜리 후보를 먼저 보고 1명을 확정할 때만 비용을 냅니다. 먼저 무작위 깨우기로 후보 1명을 얻으면 그 자리를 새 후보로 채웁니다. 기존 방식으로 이미 비용을 낸 제안을 불러오면 다시 지불하지 않습니다.',
    where: 'card_pixel/game/src/engine/run.js:commitSpringOffer', since: '예행 v1'
  },
  {
    id: 'altar-blessing', group: '깨우기·제단', name: '혼돈의 제단',
    rule: '결정 0개로 최대 3번 굴려 매번 동료 1명을 뽑습니다. 원정 축복은 노멀 40%, 레어 30%, 에픽·이벤트 20%, 전설·초월 10%이고, 15% 확률로 2.5배입니다. 마지막 결과를 확정하면 그 동료의 이전 원정 축복을 덮어씁니다.',
    where: 'card_pixel/game/src/engine/run.js:altarRoll', since: '원정 기본'
  },
  {
    id: 'recruit-after-clear', group: '영입·동행·봉인', name: '생환 동료 영입',
    rule: '원정에서 생환하면 문지기 또는 최종전 출전 생존자 중 원정 끝까지 남은 미영입 동료를 1명까지 영입합니다. 악몽은 최대 2명입니다. 이미 영입한 대상이 조건을 충족하면 인연이 1 오릅니다.',
    where: 'card_pixel/game/src/engine/meta.js:applyRunEnd', since: '프로필 원정'
  },
  {
    id: 'failed-run-shard', group: '영입·동행·봉인', name: '패배 뒤 조각',
    rule: '원정에서 패배하면 출전한 미영입 동료 1명을 조각으로 남길 수 있습니다. 다음 원정의 출현 풀에 추가되고 첫 깨우기에 우선 제안됩니다.',
    where: 'card_pixel/game/src/engine/run.js:runRewards', since: '프로필 원정'
  },
  {
    id: 'companions', group: '영입·동행·봉인', name: '대표와 동행',
    rule: '새벽의 숲을 처음 생환하면 영입 동료 중 대표 1명을 정해 본편에 데려갑니다. 동행은 수첩 2·4·5장에서 각각 1·2·3칸 열려 출현 풀에 들어가고, 첫 유료 선택 깨우기에서 가능한 동행 1명이 우선 후보에 듭니다. 대표 인연 1 이상이면 그 우선 동행을 지정할 수 있습니다.',
    where: 'card_pixel/game/src/engine/meta.js:startView', since: '프로필 원정'
  },
  {
    id: 'seals', group: '영입·동행·봉인', name: '던전별 봉인',
    rule: '일반 생환 후 해당 던전에서 동료 1명, 악몽 생환 후 최대 3명을 출현 풀에서 뺍니다. 던전 기본 풀에 있던 등급 묶음은 각각 1명 이상 남겨야 합니다.',
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
    rule: '프로필과 본편 진행을 한 세션에 저장하고 균열 기록을 별도로 관리합니다. 원정 데이터만 손상되면 프로필로 복구할 수 있습니다. 정산 뒤 마지막 정상 프로필 1개를 보존하며, v1 JSON 백업에는 본편 세션·균열·설정을 담고 검증을 통과하면 저장 슬롯을 교체합니다.',
    where: 'card_pixel/game/src/engine/save.js:createSaveStore', since: '백업 v1'
  }
];
