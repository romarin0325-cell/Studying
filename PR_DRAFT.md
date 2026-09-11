# Title
fix(card): 아티팩트 리저브 패배 시 비정상 세이브 제거 및 혼돈의 축복 보존 정합성 수정

## Summary

아티팩트 리저브 모드(`artifact_reserve`)에서 전투 패배 시 의도치 않게 세이브가 실행되어 아티팩트 사용 횟수와 리셋된 혼돈의 축복 상태가 디스크에 덮어써지던 버그를 수정했습니다.

### 1. 주요 원인 분석
- `loseBattle()` 실행 시 메모리(RAM) 상에서 혼돈의 축복을 3회 및 빈 버프 목록으로 리셋한 직후 `consumeArtifactReserveUsesForBattle()`를 호출했습니다.
- `consumeArtifactReserveUsesForBattle()` 내부에서 무조건 `this.saveGame(false)`를 호출함에 따라:
  1. **아티팩트 잔여 횟수 소모만 영구 저장**되고, 카드의 사망(`handlePermadeath`)은 저장되지 않는 기형적 비대칭 세이브가 발생했습니다.
  2. 전투 전 저장해 둔 **혼돈의 축복 당첨 버프(`chaosBuffs`) 및 잔여 횟수(`chaosBlessingUses`)가 리셋된 상태(3회/빈 목록)로 디스크에 덮어쓰기 저장**되었습니다.
- 이로 인해 다른 모드와 달리 아티팩트 리저브에서만 패배 후 이어하기 시 전투 전 저장했던 축복 및 아티팩트 상태가 소실되는 문제가 있었습니다.

### 2. 변경 내용
- **`consumeArtifactReserveUsesForBattle(autoSave = true)` 파라미터화**:
  - `card/game/rpg_features.js`의 `consumeArtifactReserveUsesForBattle`에 `autoSave` 매개변수를 추가(기본값 `true`).
  - `loseBattle()`에서는 `this.consumeArtifactReserveUsesForBattle(false)`로 호출하여 패배 시 일체의 디스크 저장이 발생하지 않도록 차단.
- **모드 간 세이브 정책 정합성 통일**:
  - 다른 일반/챌린지 모드와 동일하게 패배 시에는 디스크 저장을 하지 않음으로써, 패배 후 재로드 시 전투 전 세이브해 둔 혼돈의 축복 상태(버프 목록 및 잔여 횟수)와 아티팩트 잔여 횟수가 온전히 보존됩니다.
  - 승리 시(`winBattle`)에는 기존대로 아티팩트 소모와 진행 상황이 정상적으로 저장됩니다.

### 3. 검증 및 테스트 (`scripts/verify_card_combat_regressions.js`)
- `consumeArtifactReserveUsesForBattle(false)` 호출 시 `saveGame`이 호출되지 않음을 확인하는 단위 테스트 추가.
- `consumeArtifactReserveUsesForBattle(true)` 호출 시 `saveGame`이 정상 동작함을 확인하는 단위 테스트 추가.
- `loseBattle()` 실행 시 `artifact_reserve` 모드에서 세이브가 발생하지 않음을 보증하는 회귀 테스트 추가.

## Verification Results
- `npm run lint:card` 통과
- `npm run test:card:smoke` 통과
- `npm run test:card:browser` (Playwright 브라우저 통합 테스트) 통과
- 전투/모드/세이브 사이드이펙트 없음 확인

