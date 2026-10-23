# 일반 공격 화염 에셋 제작 기록

제작일: 2026-10-05. 도구: 내장 `image_gen.imagegen`, 투명 배경, 로컬 참조 이미지 편집. 입력으로 기존 `assets/merge/ancient-cross.webp`와 `effects.webp`를 실제 열어 확인했다. 타사 게임의 그림을 게임 에셋으로 복사하지 않았다.

## 에인션트드래곤

기존 황금·청록빛 십자를 붉은 용의 불꽃으로 바꿨다. 중심과 네 방향의 십자 형태를 유지한다. 출력은 `assets/merge/ancient-cross.webp`; 1024×1024, WebP q90, alphaQuality100이다. 원본 생성 PNG는 저장소 밖 생성 이미지 폴더에 남긴다.

실제 생성 프롬프트:

> Create one transparent-background combat sprite, a FIRE CROSS for Ancient Dragon in a polished 2D chibi fantasy mobile defense game. Edit the first reference's exact upright cardinal cross silhouette into dragon FIRE, using the second reference's first orange crescent slash and orange dragon emblem as style references. Preserve a centered four-arm plus (+), not X, equal four arm lengths, narrow tapered arms, crisp painted contours and restrained compact glow. Replace holy gold/cyan/star rays with deep vermilion red, ember orange and pale yellow flame core, several short tapering flame tongues along each arm, a compact small central ignition. No religious ornament, no cyan, no broad hazy glow, no gold-light theme. Match the flat polished painted gradients and sharp edges of the existing orange slash on second reference; avoid photorealistic smoke. Keep arms thin and substantial transparent space in four quadrants, minimal tiny embers only immediately beside cross. Sprite centered and symmetric, all flames fully within canvas with 7% transparent margin, true transparent alpha, no background, no text, no grid. One cross only, 1024 square composition.

렌더 폭·높이는 기존 `2×사거리`에서 `1.6×사거리`로 20% 축소했다. 실제320·390px 전투 검토에서 첫 후보의14% 축소·불투명도.44가 전장 대부분을 밝히는 문제가 있어 실패로 판정하고 최대 불투명도를.26으로 다시 낮췄다. 적중 판정의 사거리620·십자 폭은 그대로다. 캐릭터와 적·체력 막대보다 아래에 그리는 레이어를 유지한다.

## 지크

네 대안을 비교한 근거는 [메모리얼·부채꼴 조사](MEMORIAL_AND_CONE_RESEARCH.md)에 있다. 전용 화염 원호와 네 개의 얇은 가지를 선택해 원래 초승달의 붓결·색을 확장했다. 출력은 `assets/merge/zeke-cone.webp`; 1024×1024, WebP q90, alphaQuality100이다.

실제 생성 프롬프트:

> Create ONE polished 2D fantasy mobile-game FIRE CRESCENT CONE attack sprite with true transparent background, matching the orange crescent slash in row1 column1 of the supplied reference sheet. Only use the sheet as style reference, do not recreate its other cells or grid. A thin crisp ember-orange curved blade sweeps through a 90-degree cone pointing RIGHT. Composition square1024: cone emission vertex at x12%, y50%; outer arc radius64% of canvas width, angles minus45 to plus45 degrees, so rightmost tip reaches x76%, top endpoint y5%, bottomendpoint y95%. Paint a narrow brilliant curved outer flame rim with compact pale-gold core, red-orange flame tongues curling inward. Exactly four THIN tapering flame rays fan outward from the vertex through the cone, leaving most interior fully transparent. Rays near angles -35,-12,+12,+35 degrees, narrow at vertex, slight crescent curl at ends, do not fill solid sector. Keep the vertex glow tiny; outer arc must remain continuous and clearly readable. Restrained glow, no haze or smoke, no big opaque fireball, no flat polygon, no UI or text, no background. Match existing sharp hand-painted chibi combat effects with smooth orange gradients. Hero portraits and enemy health bars must remain visible through empty interior. One right-facing attack only, leave no painted pixels outside the intended90degreecone.

런타임에서는 원점 기준 ±45°·반경345의 정확한 원형 섹터로 클립한다. 새 에셋의 투명한 내부와 최대 불투명도 .42가 캐릭터와 위험 예고의 가림을 줄인다. 첫 후보.52는 동시 십자 화염 검토 후 밝기를 낮췄다. 아주 약한 실제 사거리 원호를 보완하며 효과 수명 .36초와 기존 공격 주기는 유지한다. 일반 공격용 에셋을 궁극기의 큰 래스터와 분리했다.

## 혼잡한 전장 재작업

두 영웅 장면을 통과한 뒤20기·정지 표적8개로320/390px 각각20초를 돌렸다. 모두 실제310회 공격했지만, 동시에20개 효과가 켜진 장면은 격자를 붉게 덮고 같은 표적의 일반 명중 효과가 작은 적을 가려 FAIL로 처리했다. 따라서 지크·에인션트드래곤의 평타 범위 효과에는 `min(1, 2/현재 화염 평타 효과 수)`의 밝기 보정을 적용한다. 두 개까지는 원래 표현을 유지하고, 그 이상은 각 공격의 모양을 남기며 총 대비를 낮춘다. 효과 수명과 전투 계산은 바뀌지 않는다.

일반 명중은24px 논리 좌표 버킷의 동시 명중 수로 불투명도를 나눈다. 궁극기·보스 예고·처형 표시는 이 보정 대상이 아니다. 에인션트드래곤의 일반 명중에 남아 있던 황금빛 아틀라스 대신 새 화염 십자의 작은58% 크기·70% 밝기를 사용해 색을 맞추고 적 실루엣을 보호한다. 이는 피해·타격 횟수를 줄이는 밸런스 보정이 아니라 실제 동시 화면의 대비 조정이다. 최종 혼잡 장면 판정은 통합 보고서에 따로 기록한다.

## 판단 기준

- 지크의 바깥 픽셀이 실제 90°·345 판정 밖에 그려지면 실패다.
- 에인션트드래곤의 실루엣이 십자가 아니거나 청록·빛 계열로 읽히면 실패다.
- 작은 모바일 화면에서 얼굴·성급·보스 체력바를 효과가 덮으면 실패다.
- 기존 화염 초승달·용 아이콘과 색·윤곽·그라데이션이 어울리지 않으면 다시 제작한다.

원본 생성 이미지의 검토와 인게임 캡처의 검토는 구분한다. 최종 인게임 판정과 캡처는 [통합 검증 보고서](MEMORIAL_RELEASE.md)에 기록한다.
