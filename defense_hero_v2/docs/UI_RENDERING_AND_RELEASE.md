# UI·렌더링·배포 가이드

이 문서는 화면과 Canvas를 수정하고, HTTP 개발판과 `file://` 단일 파일 배포판을 안전하게 검증하는 방법을 설명한다.

## 1. UI 파일의 역할

| 파일 | 책임 |
| --- | --- |
| [`index.html`](../index.html) | 앱 root, storage warning, 세 CSS와 module entry 연결 |
| [`css/tokens.css`](../css/tokens.css) | 색상, 간격, 글꼴, 공통 디자인 token |
| [`css/app.css`](../css/app.css) | app shell, stage/formation/result/settings UI |
| [`css/battle.css`](../css/battle.css) | board shell, HUD, hero rail, portrait/landscape 전투 배치 |
| [`app/screens/`](../js/app/screens/) | DOM 생성, 사용자 입력을 command/callback으로 변환 |
| [`render/ViewportLayout.js`](../js/render/ViewportLayout.js) | DPR, 보드 맞춤, 논리↔화면 좌표 변환 |
| [`render/BattleRenderer.js`](../js/render/BattleRenderer.js) | board와 entity snapshot 그리기 |
| [`render/EffectRenderer.js`](../js/render/EffectRenderer.js) | display event 기반 transient effect |
| [`render/SpriteResolver.js`](../js/render/SpriteResolver.js) | 방향 이미지 선택과 개발 fallback |
| [`render/AssetManager.js`](../js/render/AssetManager.js) | manifest preload, cache, embedded asset 읽기 |

CSS 세 파일은 source `index.html`에 모두 명시적으로 link되어야 한다. 오프라인 builder가 같은 순서로 합치므로 `@import`로 숨기거나 외부 URL을 추가하지 않는다.

## 2. screen 수정 규칙

각 screen은 `mount(root)`와 `destroy()` lifecycle을 지킨다. battle screen은 특히 다음을 정리해야 한다.

- `GameLoop`
- resize, pointer, button event listener
- `EffectRenderer`의 남은 visual queue
- `BattleSession`의 command/display event queue
- audio context 또는 재생 중 sound
- sheet/modal DOM과 callback

전투 버튼은 runtime state를 직접 수정하지 않고 `session.applyNow(type, payload)` 또는 `session.enqueue(type, payload)`를 호출한다. 준비·웨이브 사이처럼 즉시 UI를 갱신할 명령은 `applyNow`, running tick에 예약할 명령은 `enqueue`를 쓴다. pointer 배치는 Canvas client 좌표를 [`ViewportLayout.clientToLogical()`](../js/render/ViewportLayout.js)로 바꾼 뒤 placement command로 전달한다.

settings modal은 [`GameApp.openSettings()`](../js/app/GameApp.js)에서 관리한다. `sound`, `damageNumbers`, `screenShake`, `reducedEffects`를 새 표현 코드가 사용할 때는 screen의 `updateSettings()` 경로도 유지한다.

## 3. 논리 보드와 ViewportLayout

게임 규칙의 보드는 항상 12 columns × 16 rows다. portrait에서는 그대로 보이고, landscape에서는 보이는 축만 회전한다.

```text
portrait logical → view:   (x, y)
landscape logical → view:  (16 - y, x)
landscape view → logical:  (y, 16 - x)
landscape vector:          (dx, dy) → (-dy, dx)
```

[`ViewportLayout.resize(width, height, dpr)`](../js/render/ViewportLayout.js)은 다음을 한 번에 계산한다.

- `width > height`이면 landscape
- DPR은 1~2로 제한
- 전체 보드가 canvas 안에 들어가도록 aspect fit
- 남는 공간은 중앙 letterbox
- CSS 크기와 backing buffer 크기 분리

렌더 시작 시 `layout.beginFrame(context)`를 호출해 DPR transform과 clear를 적용한다. board cell, radius, sprite 위치는 `logicalToCanvas`, `logicalCellCenterToCanvas`, `logicalRadiusToCanvas`를 사용한다.

Phase 4 렌더 계약:

- 전투 영역은 상단 12×12(y 0~11). `#drawBoard`는 y ≥ 12 행을 어둡게 칠하고 구분선을 그려 UI 밴드로 표시한다.
- 배치 페이즈(PREPARATION/INTERMISSION)에는 `placementCells` 화이트리스트를 초록 테두리로 하이라이트하고, 나머지 비경로 셀은 어둡게 딤 처리한다.
- 영웅 sprite(`#drawHeroes`)와 보스 sprite(`#drawEnemies`)는 `clampSpriteToBoard(dest, boardRect)`로 보드 상단 밖 삐져나감을 클램프한다.
- StageSelectScreen은 스테이지 카드마다 10웨이브 칩 스트립(`wave-strip`)을 그리고, 칩 탭 시 적 이름·방어타입·수량 팝오버(`wave-popover`)를 표시한다. 정적 `STAGES` 기반이라 저장소와 무관하다.
- ResultScreen은 `result.heroReport`가 있으면 영웅별 누적 대미지 바 패널(`hero-report`)을 승리/패배 공통으로 표시한다.

### pointer 입력

```js
const logical = layout.clientToLogical(
  event.clientX,
  event.clientY,
  canvas.getBoundingClientRect(),
);

if (logical.inside) {
  session.applyNow('place_hero', {
    heroId,
    x: logical.cellX,
    y: logical.cellY,
  });
}
```

CSS transform, browser zoom, DPR 때문에 `offsetX / cellWidth`를 직접 계산하면 안 된다. landscape에서도 state에는 회전 전 logical cell을 저장해야 회전 후 배치가 유지된다.

## 4. 반응형 UI 계약

강제로 기기를 회전시키거나 portrait 차단 overlay를 띄우지 않는다. 같은 상태를 portrait와 landscape layout으로 재배치한다.

필수 기준은 다음과 같다.

- document/body에 가로·세로 scroll이 없어야 한다.
- board/canvas가 viewport 밖으로 잘리면 안 된다.
- 다섯 hero card가 모두 완전히 보여야 한다.
- 전투 핵심 버튼과 hero card의 hit target은 최소 44×44 CSS px다.
- safe-area inset을 침범하지 않는다.
- 390×844 → 844×390 → 390×844 회전 뒤 같은 logical placement가 유지된다.
- hero sheet를 닫은 뒤 canvas가 다시 pointer input을 받아야 한다.

영웅 정보 시트는 웨이브 사이뿐 아니라 `WAVE_RUNNING` 중에도 카드를 눌러 열 수 있다. 전투 중에는 읽기 전용으로 레벨업·특성 버튼이 비활성화되고, derived 스탯(공격력·공격 간격·사거리·스킬 쿨다운), 스킬 효과, 버프 칩이 표시된다. derived 스탯은 `getAttackInterval()`, `getSkillCooldown()`, `getEffectiveRange()`와 버프 합산 결과를 그대로 사용해 전투 계산과 어긋나지 않게 유지한다.

버프는 영웅 스프라이트 위에서 두 겹으로 표시된다. 스프라이트 뒤의 버프 색 글로우는 게임 시간 기준 느린 pulse로 돈다(일시정지 시 멈추고, reduced motion 설정에서는 생략한다). 발밑에는 버프 색 점 행을 항상 그려 reduced 설정과 무관하게 보유 버프를 식별할 수 있다. 색과 이름은 `buffs.js`의 `color`·`displayName`에서 가져온다.

짧은 landscape에서는 action control을 한 줄 44px로 유지해 hero rail 높이를 확보한다. difficulty chip은 작은 화면에서도 Easy와 잠긴 Normal/Hard가 모두 보여야 하며 `display: none`으로 숨기지 않는다.

## 5. 방향과 sprite 선택

전투 state의 방향은 `front`, `back`, `left`, `right` 중 하나다. [`DirectionSystem`](../js/battle/systems/DirectionSystem.js)은 hero cell 중심과 target 위치의 screen-space vector를 기준으로 방향을 정한다. 대각선 크기가 같으면 수평 방향을 선택하고, zero vector에서는 기존 방향을 유지한다.

[`SpriteResolver`](../js/render/SpriteResolver.js)의 logical ID는 다음과 같다.

```text
portrait/{heroId}
battle/{heroId}/{front|back|left|right}
boss/{bossId}/{front|back|left|right}
```

개발 중 요청 방향이 없으면 `front`, 그마저 없으면 Canvas token으로 fallback한다. release validation은 fallback을 허용하지 않고 10 portrait + 40 hero direction + 16 boss direction, 총 66개 물리 파일을 요구한다.

sprite 목적 사각형은 manifest의 `pivotX`, `pivotY`를 사용한다. 현재 출시 pivot은 발 위치를 맞추기 위한 `0.5 / 0.88`이다. renderer에 별도 pivot 상수를 하드코딩하지 않는다.

## 6. AssetManager와 현재 이미지 주의사항

[`AssetManager`](../js/render/AssetManager.js)는 manifest ID 또는 group을 preload하고, 성공/실패를 cache하며, 단일 파일 빌드에서는 `globalThis.__HERO_DEFENSE_V2_EMBEDDED_ASSETS__`의 path→data URI를 먼저 사용한다.

현재 생성 WebP는 512×512지만 실제 alpha channel 대신 밝은 checkerboard RGB 배경을 포함한다. manifest는 이를 `hasAlpha: false`로 기록하고, loader는 이미지 가장자리에 연결된 밝은 배경만 runtime에서 제거한다.

이 처리의 한계는 분명하다.

- 캐릭터 내부에 가장자리와 연결된 밝은 영역이 있으면 함께 제거될 수 있다.
- checkerboard 색이 바뀌면 제거 임계값을 다시 검토해야 한다.
- 새 이미지가 진짜 투명 WebP라면 metadata와 loader 경로를 실제 파일에 맞춰 갱신해야 한다.

에셋 교체 뒤에는 token fallback이 아닌 실제 4방향 이미지를 모든 필수 viewport에서 확인한다. 자세한 경로와 manifest shape는 [콘텐츠 제작·수정 가이드](./CONTENT_AUTHORING.md#10-66개-출시-에셋-계약)를 따른다.

## 7. display event와 EffectRenderer

전투 판정은 display event를 발행하고 [`EffectRenderer`](../js/render/EffectRenderer.js)가 preset별 visual로 바꾼다. renderer가 피해량이나 상태 성공 여부를 다시 계산하면 안 된다.

현재 preset은 열두 개다.

- `basic_melee_hit`
- `basic_ranged_hit`
- `basic_shotgun_hit`
- `basic_area_hit`
- `basic_nova_hit`
- `basic_laser_hit`
- `skill_cast`
- `skill_single_hit`
- `skill_area_hit`
- `status_apply`
- `critical_hit`
- `advantage_hit`

ranged event에는 source와 target 좌표가 있어야 trail을 그릴 수 있다. shotgun은 pellet마다 event 하나와 `pelletIndex`, 진행 vector를 전달하며, event 하나가 세 줄을 다시 그리면 안 된다. area visual은 선택된 impact center에 cast당 한 번 그린다. nova는 영웅 중심에서 여섯 갈래 번개 스포크를 cast당 한 번(visualOnly event) 그리고, laser는 시전자에서 빔 끝점(`vectorX/vectorY × range`)까지 cast당 한 번 그린다. 두 아키타입 모두 피해 event는 `suppressEffect`로 중복 이펙트를 막는다.

`reducedEffects`가 켜져도 판정 event 자체를 누락하지 말고 particle 수와 장식을 줄인다. `damageNumbers`는 popup 표현만, `screenShake`는 critical/core visual만, `sound`는 event SFX만 제어해야 한다.

## 8. 저장소 차단 UI

[`SaveRepositoryV2`](../js/persistence/SaveRepositoryV2.js)는 localStorage probe가 실패하면 MemoryStorage로 전환한다. 이때 앱은 계속 실행되지만 reload 뒤 checkpoint와 설정이 사라진다.

[`GameApp`](../js/app/GameApp.js)은 `[data-storage-warning]` 요소를 visible로 만들어 이 상태를 알린다. warning을 제거하거나 CSS로 항상 숨기지 않는다. 오프라인 bundle verifier는 storage 차단 환경의 warning도 확인한다.

## 9. 디버그 API

앱 시작 후 브라우저 acceptance용 read-only/command helper가 `globalThis.__heroDefenseV2Debug`에 노출된다.

```js
const debug = globalThis.__heroDefenseV2Debug;
debug.getState();
debug.showStages();
debug.startDefaultBattle('ancient_ruins');
debug.autoPlace();
debug.startWave();
debug.stepTicks(600);
```

`getState()`는 현재 scene, storage 지속성, formation, settings, battle snapshot/layout/performance sample을 반환한다. 이 API는 테스트를 위한 것이며 실제 UI 코드는 helper를 우회해 state를 직접 바꾸지 않는다.

## 10. 개발 서버

저장소 루트에서 실행한다.

```powershell
npm run serve:defense-hero-v2
```

기본 주소는 `http://127.0.0.1:4174/`다. 다른 기기에서 같은 LAN으로 접속해야 할 때만 host를 명시한다.

```powershell
$env:HERO_DEFENSE_V2_HOST = '0.0.0.0'
$env:HERO_DEFENSE_V2_PORT = '4174'
npm run serve:defense-hero-v2
```

모바일에서는 PC의 LAN IP와 port를 사용한다. 방화벽과 같은 네트워크인지 별도로 확인한다. server는 `defense_hero_v2/` 아래의 GET/HEAD만 제공하고 cache를 끄며 path traversal을 차단한다.

## 11. 단일 파일 빌드

```powershell
npm run build:defense-hero-v2-local
```

[`build_hero_defense_v2_local.mjs`](../../scripts/build_hero_defense_v2_local.mjs)는 다음을 수행한다.

1. `js/main.js`와 module graph를 browser IIFE로 bundle
2. 세 CSS를 같은 순서로 minify·inline
3. manifest의 66개 release asset을 data URI로 embedding
4. 외부 script/stylesheet/resource가 남지 않았는지 검사
5. [`dist-local/HeroCoreDefenseV2.html`](../dist-local/HeroCoreDefenseV2.html) 생성

출력 HTML의 주석처럼 생성물을 직접 고치지 않는다. source를 수정하고 다시 빌드한다. release-required asset이 하나라도 없으면 빌드는 실패해야 정상이다.

## 12. 브라우저와 오프라인 검증

```powershell
npm run test:defense-hero-v2:local
npm run test:defense-hero-v2:browser
```

local bundle 검증은 단일 HTML에 외부 resource가 없고 66개 asset이 포함되며, desktop/Android 크기와 storage 차단에서 실행되는지 확인한다.

browser verifier는 다음 여섯 viewport를 실제 Chromium으로 검사한다.

| 유형 | viewport |
| --- | --- |
| 작은 portrait | 360×800, 390×844 |
| 짧은 landscape | 800×360, 844×390 |
| tablet | 768×1024 |
| desktop | 1366×768 |

검증 범위는 scroll/bounds, 44px hit target, 다섯 card, 실제 Canvas pointer 배치, auto-place, 2× wave, 중복 보상 방지, 같은 page 회전, sheet open/close 뒤 입력 복구, console/page error다. active wave에서는 30fps 이상, update p95 4ms 이하, render p95 8ms 이하를 요구한다.

실패 시 script가 출력한 OS temp screenshot 경로를 먼저 확인한다. DOM 수치만 맞추고 실제 화면 겹침이나 sprite 잘림을 놓치지 않는다.

## 13. 출시 전 체크리스트

- `index.html`이 `tokens.css`, `app.css`, `battle.css`, `js/main.js`를 올바르게 참조한다.
- 66개 release-required WebP와 manifest ID/path/pivot가 일치한다.
- source HTTP 실행과 단일 HTML `file://` 실행이 모두 통과한다.
- storage 차단 warning이 보이고 앱은 MemoryStorage로 계속 동작한다.
- 여섯 viewport의 pointer, 회전, 44px, no-scroll 검증이 통과한다.
- active combat 성능 gate가 통과한다.
- 생성된 `dist-local` 파일이 source 변경을 반영한다.
- 마지막으로 저장소 루트의 `npm run verify`가 통과한다.

실제 iOS Safari 또는 Android WebView 기기에서 실행하지 않았다면 Chromium mobile emulation 결과만으로 기기 검증까지 했다고 기록하지 않는다.
