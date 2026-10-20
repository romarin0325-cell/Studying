# GPT Image SD 지시서: 애쉬·베놈·조커·언더독·해바라기·큐어마스터

2026-10-20 작성. 대상은 Manus의 GPT Image 2.5이다. 이 문서만 따르면 판단 없이 후보를 만들고 거를 수 있게 썼다. 프롬프트는 그대로 붙여 넣는다.

- **목적:** 위 여섯 동료는 나노바나나로 만들었다. 기존 캐스트 31명은 코덱스(GPT Image 2.0)로 만들었다. 같은 계열 모델로 다시 그려 세트를 통일한다.
- **기준:** 정체성(얼굴·표정·의상)은 사용자 원화를 따른다. 비율·화풍은 승인된 GPT 캐스트를 따른다. 지금의 나노바나나 SD는 참조로 주지 않는다. 그 선과 질감을 바꾸려는 작업이기 때문이다.
- **범위:** SD 4방향 시트만 다룬다. 메모리얼은 포함하지 않는다.
- **확인 상태:** 아래 프롬프트는 GPT Image 2.5로 실행해 보지 않았다. 1장의 시험본 측정과 `ASSET_PIPELINE.md`의 이전 결과를 근거로 썼다.

## 1. Manus 시험본(큐어마스터)에서 확인한 것

사용자가 준 `마누스큐어마스터.webp`(1920×1920)를 저장소 도구로 재 보았다.

| 항목 | 결과 | 판정 |
|---|---|---|
| 배경 | 실제 투명(알파 0) | 좋음. 패킹 전에 자홍(#FF00FF)으로 합성한다(§6-1) |
| 비율 | 앞모습 두개골 추정 [400,254,648,485]. 머리를 캐스트 크기(160×150)로 맞추면 턱 아래 몸이 약 327px. 보통 키 범위는 143~218(평균 185)이다 | **약 1.75배 길다.** `pack-sd.mjs`가 "painted pixels exceed frame"으로 거부했다. 지금 상태로는 설치할 수 없다 |
| 칸 경계 | 윗줄 발이 960px 경계를 넘어 아랫칸으로 내려간다. 앞모습 너비가 칸의 85%다 | 2×2 같은 크기 칸에 여백을 두라는 지시가 필요하다 |
| 외곽선 | 가장자리 평균 RGB (45,12,41), 어두운 자주 | 캐스트 중앙값 (35,33,53) 남색과 다르다 |
| 빠진 것 | 천사 날개, 주사기의 레몬 조각, 앞머리의 흰 하트 표식 | 원화와 승인 SD에 있는 정체성 요소다 |
| 맞은 것 | 윙크 방향, 네 방향 모두 같은 손의 주사기, 뒷모습에 얼굴 없음, 좌우 방향, 분홍→연보라 머리, 얼굴 인상 | 유지한다 |

결론: GPT Image 2.5는 그림 품질과 방향 지시는 잘 따른다. 그러나 기본 비율이 3등신에 가까운 치비다. 이 게임 캐스트는 약 2.3등신이다. 그래서 아래 프롬프트는 비율을 세 가지로 겹쳐 지시한다. Image 1을 틀로 쓰게 하고, 셀 안의 높이 비율을 숫자로 주고, 흔한 실수("3등신")를 직접 금지한다.

### 1-1. 실제 적용 결과 (2026-10-21)

- **큐어마스터 (설치함):** 이 지시서로 8장을 뽑았고, 몸 길이 보정 문장을 한 번 덧붙여 1장이 통과했다(머리 160.7×149.3, 턱 아래 206, 외곽선 남색). 다만 바깥 외곽선이 3px로 캐스트(대부분 4px)보다 얇았다. 그래서 `thicken-outline.mjs`로 바깥 윤곽만 1px 보강했다. 그 뒤 프롬프트의 외곽선 굵기 문장을 아래처럼 고쳤다.
- **조커 (보류):** 지시서 없이 만든 시트(`joker_outfit_edit_v1.png`)는 머리를 캐스트 크기에 맞추면 턱 아래 몸이 약 293px(머리 높이의 약 1.97배)였다. 보통 키 범위 143~218을 크게 넘고, 모자와 지팡이가 셀 밖으로 나갔다. 나노바나나2·프로로 "머리는 그대로, 몸만 짧게"를 세 방식(편집, 발 높이 가이드, 승인 동료를 틀로 쓰는 마네킹)으로 17장 시도했다. 모두 몸 길이가 거의 그대로였다. 조커는 반드시 §5-3 프롬프트로 다시 뽑는다. 몸이 길면 §5-7의 첫 문장을 붙인다.

## 2. 작업 순서

1. 이 문서와 `ASSET_PIPELINE.md` §0·§2·§3을 읽는다.
2. 사용자가 원화 한 장을 첨부하면, §3의 명령으로 그 캐릭터의 **참조 보드 한 장**을 만든다. 기준 시트는 저장소에서 읽고, 얼굴은 표의 좌표로 원화에서 자른다. 보드의 왼쪽·가운데·오른쪽 칸이 프롬프트의 Image 1·2·3이다. 생성할 때는 이 보드 한 장만 넣는다.
3. §5의 프롬프트를 고치지 않고 붙여 넣어 **4장을 각각 새로 생성**한다. 한 장을 대화로 고쳐 가지 않는다(편집은 고치라고 한 곳 밖도 바꾼다).
4. §4로 거른다. 눈으로 보는 항목을 먼저 보고, 남은 후보는 §6의 1~5단계로 잰다. 탈락 사유가 같으면 §5-7의 문장을 프롬프트 끝에 덧붙여 4장을 다시 뽑는다. 두 번 해도 통과가 없으면 멈추고 사용자에게 후보를 보여 준다.
5. 통과한 후보 중 §4-2 순서로 한 장을 고른다. 고른 원본 PNG와 탈락 후보는 저장소 밖에 둔다.
6. 패킹·검수·설치(§6)는 Manus가 해도 되고, 고른 시트를 Claude에게 넘겨도 된다.

## 3. 참조 이미지

| 캐릭터 (id) | 프롬프트 | Image 1: 기준 시트 (저장소) | Image 2: 원화 (사용자 첨부) | Image 3: 얼굴 좌표 (원화 대비 x,y,w,h) |
|---|---|---|---|---|
| 큐어마스터 (`cure_master`) | §5-6 | `avalanche_maid` | `큐어마스터.png` | `0.188,0.113,0.650,0.315` |
| 애쉬 (`ash`) | §5-1 | `avalanche_maid` | `애쉬.png` | `0.320,0.067,0.416,0.208` |
| 베놈 (`venom`) | §5-2 | `time_ruler` | `베놈.png` | `0.559,0.094,0.391,0.195` |
| 조커 (`joker`) | §5-3 | `star_boy` | `조커.png` | `0.247,0.156,0.559,0.258` |
| 언더독 (`underdog`) | §5-4 | `zeke` | `언더독.png` | `0.338,0.023,0.547,0.258` |
| 해바라기 (`sunflower`) | §5-5 | `siren` | `해바라기.jpg` | `0.275,0.164,0.478,0.230` |

- **참조 보드:** Manus에는 한 번에 이미지 한 장만 첨부할 수 있다. 그래서 세 장을 가로로 붙인 보드 한 장을 만들어 생성에 넣는다(왼쪽 Image 1, 가운데 Image 2, 오른쪽 Image 3). 칸마다 높이 1024px이고, 흰 바탕과 흰 간격 위에 둔다. 글자는 넣지 않는다(프롬프트가 칸을 위치로 부른다). 프롬프트의 REFERENCE BOARD 문단이 보드를 세 장으로 읽게 하고, 보드 배치를 따라 그리지 않게 한다.
- **보드 만들기:** 저장소 루트에서 `npm ci` 후 아래를 실행한다. 인자는 위 표의 기준 시트 id, 첨부된 원화 경로, 얼굴 좌표, 출력 경로다. 기준 시트는 `defense_test/assets/merge/units/<id>.webp`를 읽어 자홍 바탕에 놓는다.

  ```bash
  node defense_test/scripts/art/ref-board.mjs avalanche_maid 큐어마스터.png 0.188,0.113,0.650,0.315 board-cure_master.png
  ```

- **얼굴 좌표:** 이전에 쓰던 얼굴 확대본을 원화와 대조해 찾은 값이다. 원화의 크기가 바뀌어도 비율이라 그대로 맞는다. 원화를 자르거나 다른 판을 첨부하면 맞지 않는다.
- **확인:** 보드 오른쪽 칸에 그 캐릭터의 얼굴이 크게 보여야 한다. 아니면 생성하지 말고 멈춘다.
- **마스터를 고른 이유:** 마스터는 모두 GPT로 만든 승인 캐스트이고, 같은 체형과 키 그룹이다.
  - 애쉬·큐어마스터: 아발란체메이드는 여성형 보통 키(턱 아래 1.30H)다. 트윈테일·짧은 치마·스타킹·구두 구성이 같다.
  - 베놈: 시간의지배자는 여성형 보통 키(1.31H)다. 캐스트에서 검은 드레스를 가장 잘 읽히게 칠했다.
  - 조커: 별똥별소년은 가는 소년형 보통 키(1.18H)다. 반바지·부츠·짧은 흰머리 구성이 같다.
  - 언더독: 지크는 남성형 큰 키(1.27H)이고 파이프라인의 승인 기준이다.
  - 해바라기: 세이렌은 여성형 보통 키(1.17H)다. 가는 다리가 드러나 체형을 읽기 쉽다.
- 다른 새 캐릭터(토피애플·앤트로피·베히모스 등 나노바나나 제작)는 마스터로 쓰지 않는다(`ASSET_PIPELINE.md` §0-5).

## 4. 후보 거르기

### 4-1. 하나라도 해당하면 탈락

1. 배경이 투명이나 균일한 자홍이 아니다(흰색, 그린 체커보드, 그라데이션, 바닥 그림자).
2. 정사각형이 아니거나, 2×2 네 칸에 한 명씩이 아니다. 칸끼리 그림이 겹치거나 칸 밖으로 잘렸다.
3. 왼쪽 아래가 왼쪽을, 오른쪽 아래가 오른쪽을 보지 않는다(코끝 방향으로 판단한다).
4. 뒷모습(오른쪽 위)에 얼굴이나 눈이 보인다.
5. 네 칸의 자세·소품 손·표정이 서로 다르다.
6. **비율:** §6의 1~5단계(상자 읽기 → 패킹 → 검수)로 잰다. 패킹이 "painted pixels exceed frame"으로 거부되거나, `body`·`headW`·`headH`가 §6-5 범위 밖이면 탈락이다. 머리카락과 모자 부피가 캐릭터마다 달라서 눈대중 규칙으로는 가를 수 없다(시험본도 눈으로는 그럴듯해 보였다).
7. 캐릭터별 MUST HAVE 중 하나라도 없거나 MUST NOT 중 하나라도 있다.
8. 글자, 라벨, 칸 선, 이펙트(빛, 불꽃, 반짝이)가 있다.
9. 외곽선이 갈색·자주·검정이다. 굵기는 탈락 사유가 아니다(§6-5에서 재고 보강한다).

### 4-2. 남은 후보 고르는 순서

1. 얼굴과 표정이 Image 3과 같은가
2. 머리색·의상·소품이 Image 2와 같은가
3. 네 방향이 서로 같은 캐릭터인가(머리 길이, 장식 좌우, 손)
4. 선·채색·눈이 Image 1과 같은 세트로 보이는가
5. 셀 안 위치(발바닥 94%, 턱 높이)가 지시와 가까운가

## 5. 프롬프트

모든 프롬프트는 같은 뼈대다: 참조 역할 → 시트 배치 → 비율 → 화풍 → 캐릭터 → 필수·금지 → 마지막 확인. 캐릭터마다 숫자와 손이 다르므로 섞어 쓰지 않는다.

### 5-1. 애쉬 (ash, 여성, 보통 키)

```text
Create ONE finished production sprite sheet: a four-view turnaround of the chibi game character ASH for a mobile tower-defense game. It must look drawn by the same artist, in the same session, as Image 1.

REFERENCE BOARD: the one attached image has three panels side by side on white. Read it as three separate images: LEFT panel = Image 1, MIDDLE panel = Image 2, RIGHT panel = Image 3. Do not reproduce the board, its white gaps or its three-panel layout; the output is only the 2x2 sheet described below.

REFERENCE IMAGES (each has exactly one job)
- Image 1 = AVALANCHE MAID, an approved character from the same game. Use it as the TEMPLATE for: the 2x2 sheet layout, the camera, the size and height of the head in each cell, the chin height, the foot line, the short super-deformed body, the line art, the cel shading and the eye rendering. Do NOT copy her face, light-blue hair, spiral eyes, maid costume or colours.
- Image 2 = ASH's original illustration. Use it ONLY for identity: hair, colours, costume, wings and accessories. Do NOT copy its pose, its tall realistic body, the low camera, the fire in her hand, the flame ribbons, the burning hall, the red moon or the floating feathers.
- Image 3 = close-up of ASH's face. Copy the eye shape, eye colour, eyebrows, mouth and expression exactly.

SHEET LAYOUT
- Square image at the largest square size available. Transparent background (real alpha). If transparency is unavailable, one completely flat solid magenta #FF00FF. Never white, never a drawn checkerboard. No floor, no cast shadow, no gradient, no grid lines, no borders, no text, no labels.
- Four equal square cells, 2 columns x 2 rows, one full-body figure per cell, centred horizontally in its cell:
  TOP-LEFT = FRONT: body and face toward the viewer, eyes on the viewer.
  TOP-RIGHT = BACK: facing away; we see the back of the head and body; no face, no eyes.
  BOTTOM-LEFT = LEFT: the figure faces the LEFT edge of the picture (the nose points left).
  BOTTOM-RIGHT = RIGHT: the figure faces the RIGHT edge of the picture (the nose points right).
- Side views turn like Image 1's side views: body in profile, the near eye fully visible, the far eye hidden.
- All four figures: the SAME neutral idle standing pose (not attacking, walking, jumping or leaning), the same scale, a straight eye-level camera, the soles on the same line. The front face looks straight at the viewer with no sideways head tilt.

PROPORTIONS (ultra super-deformed, exactly like Image 1; a taller 3-head chibi is WRONG)
- The whole figure is about 2.3 heads tall. The head with its hair is as tall as everything below the chin.
- H = skull height (chin to top of the skull, ignoring hair volume and ornaments). Chin to soles, including legs and shoes = 1.27 H, the same as Image 1.
- In every cell, measured from the top edge of the cell: soles at 94%, chin at 57%, top of the skull at 28%. Skull width about 31% of the cell width. This is the same placement as Image 1.
- Everything (hair, twin tails, wings) stays inside its cell with at least 5% empty margin on every side. Total figure width at most 70% of the cell width.
- FEMALE-FORM chibi body like Image 1: slim, short, straight legs standing close together with the feet almost touching, small hands and feet, narrow shoulders, slim waist. Not the sturdy wide-stance body of a male chibi.

STYLE (match Image 1)
- Clean, even, dark navy-indigo outline (about #23213A) around the whole figure and on inner lines, with the OUTER silhouette line clearly bolder than the inner lines: about 0.8% of the cell width (about 8 px on a 960 px cell), the same weight as the outer line of Image 1. Not black, not brown, not maroon.
- Cel shading: base colour + one shadow tone + a soft gradient on the hair; light from the upper left; one glossy highlight band on the hair.
- Eyes rendered with Image 1's finish (large, glossy, layered iris colour, two small white catchlights) but NOT Image 1's spiral pupils. Tiny nose, small mouth, soft blush.
- Her black hair, dress, wings and shoes are painted as deep charcoal-indigo with clearly visible blue-grey highlights and fold lines, like the dark navy parts of Image 1, so every shape reads at small size. No large flat pure-black areas.
- Simplify for a 40-pixel game token: few large, clear shapes.
- No effects: no fire, glow, aura, sparkles, floating feathers or motion lines.

CHARACTER: ASH
A haughty, arrogant young archdemon girl whose fire burns everything; utterly sure of herself and looking down on everyone. Never shy, never angry, never scared.
FACE (the most important part; identical in every view that shows the face): sharp crimson-red eyes with the upper lids lowered into a contemptuous half-lidded look, thick dark upper lashes, small pupils with one highlight; one eyebrow slightly raised; pink blush; a smug closed-mouth cat smile shaped like a small "ω" (corners up, no teeth). Her chin is raised a little so she looks down at the viewer.
HAIR: long black hair (charcoal with blue-grey shine) whose lower third fades to deep crimson; two high twin tails, each tied with a black ribbon topped by a small black feather ornament that stands up like a little wing; bangs falling between the eyes and thin side locks.
COSTUME: off-shoulder glossy black gothic mini dress; black criss-cross lacing down the front of the bodice; long bell sleeves ending in black ruffles; a black choker with a small silver cross charm; a teal-lined underskirt peeking below the black skirt hem; sheer dark-brown thigh-high stockings with lace tops; black high-heeled Mary Jane shoes with ankle straps and small black bows. The chest is covered; no garter straps.
WINGS: a pair of SMALL folded black feathered demon wings on her back, tips angled up behind the shoulders, total wingspan at most 1.6 times the skull width. FRONT view: the wing tips peek out behind the shoulders. BACK view: both wings fully visible. Side views: one folded wing behind the back.
POSE AND HANDS (the same in all four views): her LEFT hand rests on her hip; her RIGHT arm hangs relaxed with long dark-red nails.
- FRONT view: the hand on the hip is on the viewer's RIGHT.
- BACK view: the hand on the hip is on the viewer's LEFT.
- LEFT view: the hand on the hip is on the near side, in front.
- RIGHT view: the hand on the hip is on the far side, mostly hidden.

MUST HAVE: half-lidded red eyes and the ω smirk; black twin tails with crimson ends and feather ornaments; small folded black wings; choker with a cross; teal underskirt; brown thigh-high stockings; black heels; left hand on the hip.
MUST NOT: fire or flames, a fireball, horns, a halo, a tail, large or spread wings, an open mouth or teeth, an angry or shy face, a bare chest, garter straps, a white background.

FINAL CHECK before output: four figures in a 2x2 grid; bottom-left faces left and bottom-right faces right; the back view shows no face; head size, chin height and foot line match Image 1; dark navy outline; transparent or flat magenta background; everything inside its own cell.
```

### 5-2. 베놈 (venom, 여성, 보통 키의 가장 큰 쪽)

```text
Create ONE finished production sprite sheet: a four-view turnaround of the chibi game character VENOM for a mobile tower-defense game. It must look drawn by the same artist, in the same session, as Image 1.

REFERENCE BOARD: the one attached image has three panels side by side on white. Read it as three separate images: LEFT panel = Image 1, MIDDLE panel = Image 2, RIGHT panel = Image 3. Do not reproduce the board, its white gaps or its three-panel layout; the output is only the 2x2 sheet described below.

REFERENCE IMAGES (each has exactly one job)
- Image 1 = TIME RULER, an approved character from the same game. Use it as the TEMPLATE for: the 2x2 sheet layout, the camera, the size of the head, the foot line, the super-deformed construction, the line art, the cel shading, the eye rendering and the way her black dress is painted. Do NOT copy her face, silver hair, red eyes, earrings or dress design.
- Image 2 = VENOM's original illustration. Use it ONLY for identity: hair, colours, crown, gown, vine and spider lily. Do NOT copy its pose (hands on the chest, flying), its tall realistic body, the low camera, the aurora sky, the black sun, the forest, the green fire, the glowing butterflies or the roots covering the ground.
- Image 3 = close-up of VENOM's face. Copy the eye colour, the pale porcelain skin, the crack lines and the blank expression. Do NOT copy the round wide-open eyes or the upward gaze.

SHEET LAYOUT
- Square image at the largest square size available. Transparent background (real alpha). If transparency is unavailable, one completely flat solid magenta #FF00FF. Never white, never a drawn checkerboard. No floor, no cast shadow, no gradient, no grid lines, no borders, no text, no labels.
- Four equal square cells, 2 columns x 2 rows, one full-body figure per cell, centred horizontally in its cell:
  TOP-LEFT = FRONT: body and face toward the viewer, eyes on the viewer.
  TOP-RIGHT = BACK: facing away; we see the back of the head and body; no face, no eyes.
  BOTTOM-LEFT = LEFT: the figure faces the LEFT edge of the picture (the nose points left).
  BOTTOM-RIGHT = RIGHT: the figure faces the RIGHT edge of the picture (the nose points right).
- Side views turn like Image 1's side views: body in profile, the near eye fully visible, the far eye hidden.
- All four figures: the SAME neutral idle standing pose (not attacking, walking, floating or leaning), the same scale, a straight eye-level camera, the soles on the same line. The front face looks straight at the viewer with no sideways head tilt.

PROPORTIONS (super-deformed like Image 1 but at the TALL, slender end of the group; a 3-head or 4-head chibi is WRONG)
- The whole figure without the crown is about 2.5 heads tall.
- H = skull height (chin to top of the skull, ignoring hair volume and the crown). Chin to soles = 1.42 H: clearly longer than Image 1 (1.31 H), achieved by a longer neck, a slimmer longer torso and a longer gown.
- In every cell, measured from the top edge of the cell: soles at 94%, chin at 52%, top of the skull at 23%. Skull width about 31% of the cell width. The head is exactly as big as Image 1's head; because her body is longer, her head sits about 4% of the cell higher than Image 1's head.
- The top of the crown is at least 5% below the top edge of the cell. Everything stays inside its cell with at least 5% empty margin. Total figure width at most 70% of the cell width.
- FEMALE-FORM, slender: narrow shoulders, long neck, long slim arms, small hands; the legs are hidden inside a narrow column gown; tiny pointed black shoes just visible at the hem.

STYLE (match Image 1)
- Clean, even, dark navy-indigo outline (about #23213A) around the whole figure and on inner lines, with the OUTER silhouette line clearly bolder than the inner lines: about 0.8% of the cell width (about 8 px on a 960 px cell), the same weight as the outer line of Image 1. Not black, not brown, not maroon.
- Cel shading: base colour + one shadow tone + a soft gradient on the hair; light from the upper left; one glossy highlight band on the hair.
- Paint her black hair and black gown exactly like Image 1's black dress: deep charcoal-indigo with clearly visible blue-grey highlights and fold lines, so the shapes read at small size. No large flat pure-black areas.
- Simplify for a 40-pixel game token: few large, clear shapes.
- No effects: no glow, aura, green fire, sparkles, butterflies, floating petals or motion lines.

CHARACTER: VENOM
The witch who brings plague to the continent. Nobody ever stands near her. She must look MYSTERIOUS, TALL, ELEGANT and OVERWHELMING: a beautiful catastrophe from a dark fairy tale, a slender young witch of about twenty. Never plump, never motherly, never a cute doll.
FACE (identical in every view that shows the face): completely expressionless and cold; no smile, no frown, no blush. Narrow, long, half-lidded eyes with long dark lashes; bright pale-green irises with tiny pupils and one small highlight; she looks straight at the viewer from slightly above (chin slightly raised). Thin straight dark eyebrows. Very pale porcelain skin. A tiny closed neutral mouth. Thin black crack lines like cracked porcelain on her LEFT cheek (the viewer's right in the front view), running down that side of the neck to the collarbone.
HAIR: very long glossy black hair reaching the hips, parted in the centre, smooth with soft waves; the lower third fades to bright toxic green. Long face-framing side locks; short soft bangs partly cover the forehead so the forehead is not a large bare area.
CROWN: thin black thorn branches rising straight up from the top of the head like slim antlers, carrying five round pale-green rose buds. Narrow: no wider than the hair. At most 0.5 H tall above the hair.
COSTUME: a long, tight, strapless black gown shaped like a narrow column, with a high slit at the front hem that shows only the shin; thin green vein lines painted in the cloth (painted, not glowing); the hem dissolves into a few short black root tendrils on the ground, spreading no wider than 1.2 times the skull width. Bare shoulders and arms, a thin black choker, a thin bright-green vine coiled twice around her LEFT forearm, long pointed black nails.
PROP: her RIGHT hand holds one tall black spider lily upright by its long green stem at her side; the flower head (black-purple petals, faint red centre) is level with the top of her head. Her left hand hangs relaxed.
- FRONT view: the lily is on the viewer's LEFT.
- BACK view: the lily is on the viewer's RIGHT.
- RIGHT view: the lily is on the near side, in front of the body.
- LEFT view: the lily is on the far side; its flower head shows above and behind her shoulder.

MUST HAVE: cold half-lidded green eyes; pale skin with crack lines; centre-parted black hair with green ends; thorn crown with five green buds; strapless black column gown with a slit and root-tendril hem; spider lily in the right hand; vine around the left forearm.
MUST NOT: a smile or blush, round doll eyes, a large bare forehead, a wide A-line or bell skirt, butterflies, green fire, glow, aura, floating objects, roots spreading across the floor, a white background.

FINAL CHECK before output: four figures in a 2x2 grid; bottom-left faces left and bottom-right faces right; the back view shows no face; the head is the same size as Image 1's and the body is longer; dark navy outline; transparent or flat magenta background; everything inside its own cell.
```

### 5-3. 조커 (joker, 성별 불명·소년형, 보통 키)

```text
Create ONE finished production sprite sheet: a four-view turnaround of the chibi game character JOKER for a mobile tower-defense game. It must look drawn by the same artist, in the same session, as Image 1.

REFERENCE BOARD: the one attached image has three panels side by side on white. Read it as three separate images: LEFT panel = Image 1, MIDDLE panel = Image 2, RIGHT panel = Image 3. Do not reproduce the board, its white gaps or its three-panel layout; the output is only the 2x2 sheet described below.

REFERENCE IMAGES (each has exactly one job)
- Image 1 = STAR BOY, an approved character from the same game. Use it as the TEMPLATE for: the 2x2 sheet layout, the camera, the size and height of the head in each cell, the chin height, the foot line, the short slim super-deformed body, the line art, the cel shading and the eye rendering. Do NOT copy his face, spiky white-and-yellow hair, blue outfit or colours.
- Image 2 = JOKER's original illustration. Use it ONLY for identity: hair, colours, jester hat, outfit and staff. Do NOT copy its jumping pose, its realistic body, the bare chest and belly, the cosmic purple background, the sparkles or the floating ribbons.
- Image 3 = close-up of JOKER's face. Copy the eye shape, the diamond pupils, the eyebrows, the blush, the grin and the expression exactly.

SHEET LAYOUT
- Square image at the largest square size available. Transparent background (real alpha). If transparency is unavailable, one completely flat solid magenta #FF00FF. Never white, never a drawn checkerboard. No floor, no cast shadow, no gradient, no grid lines, no borders, no text, no labels.
- Four equal square cells, 2 columns x 2 rows, one full-body figure per cell, centred horizontally in its cell:
  TOP-LEFT = FRONT: body and face toward the viewer, eyes on the viewer.
  TOP-RIGHT = BACK: facing away; we see the back of the head, the hat and the body; no face, no eyes.
  BOTTOM-LEFT = LEFT: the figure faces the LEFT edge of the picture (the nose points left).
  BOTTOM-RIGHT = RIGHT: the figure faces the RIGHT edge of the picture (the nose points right).
- Side views turn like Image 1's side views: body in profile, the near eye fully visible, the far eye hidden.
- All four figures: the SAME neutral idle standing pose (not attacking, walking, jumping or leaning), the same scale, a straight eye-level camera, the soles on the same line. The front face looks straight at the viewer with no sideways head tilt.

PROPORTIONS (ultra super-deformed, exactly like Image 1; a taller 3-head chibi is WRONG)
- The whole figure without the hat is about 2.2 heads tall. The head with its hair is as tall as everything below the chin.
- H = skull height (chin to top of the skull, ignoring hair volume, circlet and hat). Chin to soles, including legs and boots = 1.20 H, about the same as Image 1.
- In every cell, measured from the top edge of the cell: soles at 94%, chin at 58%, top of the skull at 29%. Skull width about 31% of the cell width. This is the same placement as Image 1.
- Everything (hat, staff, cape, ribbons) stays inside its cell with at least 5% empty margin on every side. Total figure width including the staff at most 70% of the cell width.
- Slim youthful boyish chibi body like Image 1: narrow shoulders, slim short straight legs, feet slightly apart like Image 1, small hands.

STYLE (match Image 1)
- Clean, even, dark navy-indigo outline (about #23213A) around the whole figure and on inner lines, with the OUTER silhouette line clearly bolder than the inner lines: about 0.8% of the cell width (about 8 px on a 960 px cell), the same weight as the outer line of Image 1. Not black, not brown, not maroon.
- Cel shading: base colour + one shadow tone + a soft gradient on the hair; light from the upper left; one glossy highlight band on the hair.
- Eyes rendered like Image 1: large and glossy, two small white catchlights. Tiny nose, soft blush.
- His black clothes are painted as deep charcoal-indigo with clearly visible blue-grey highlights and fold lines so the shapes read at small size. No large flat pure-black areas.
- All pinks are a clear rose pink, never magenta.
- Simplify for a 40-pixel game token: few large, clear shapes; only a few studs.
- No effects: no glow, aura, sparkles, floating cards, stars or motion lines.

CHARACTER: JOKER
An ageless, genderless being said to have existed before the creator made the world. It appears as a slim young jester boy in bizarre clothes. It always smiles, and the smile is a little too wide: cheerful on the surface, faintly uncanny underneath. Never a villain snarl, never angry, never horror.
FACE (the most important part; identical in every view that shows the face): very bright blue eyes opened a little too wide; each pupil is a pale vertical diamond-shaped glint; heavy dark upper lash lines; eyebrows raised; pink blush with fine diagonal hatching on the cheeks; a huge open grin showing one straight row of white upper teeth, the corners of the mouth pulled high. Two small black upward-pointing triangle marks at the centre of the bangs. In the side views the grin still shows the teeth.
HAIR: a short, messy, silvery-white bob with one ahoge tuft; the lower third of the hair fades to lime yellow-green.
HEADWEAR: a gold circlet across the forehead with a small gold pyramid stud at the centre. On top, a JESTER HAT with two floppy horns curving out to the sides, striped rose pink and black, a gold ball on each horn tip and a small gold ring on top between the horns. Hat width at most 1.7 times the skull width.
COSTUME: a black cropped jacket with puffed shoulders, gold trim and a few small gold spikes on the shoulders; a gold high collar with a blue diamond gem brooch at the throat; a black star-shaped emblem on the chest; under the jacket a black high-neck bodysuit that covers the whole chest and belly; long black gloves with gold cuffs; glossy black short shorts; glossy black thigh-high boots with a few gold diamond studs and gold toe caps; a short black cape with blue-violet lining hanging from the shoulders to the knees; two short black ribbon tails with gold four-point-star tips hanging from the back of the jacket.
PROP: the RIGHT hand holds a tall slim gold staff upright beside the body, as tall as the whole figure, topped by a gold ring with small spikes holding a pink crystal orb with a white four-point star inside. The staff stays close to the body. The left hand hangs relaxed.
- FRONT view: the staff is on the viewer's LEFT.
- BACK view: the staff is on the viewer's RIGHT.
- RIGHT view: the staff is on the near side, in front of the body.
- LEFT view: the staff is on the far side; the orb shows above and behind the shoulder.

MUST HAVE: too-wide toothy grin; blue eyes with diamond pupils; hatched blush; two triangle marks on the bangs; white bob with lime-green ends; gold circlet with a pyramid stud; pink-and-black two-horn jester hat with gold balls; blue gem collar; black star emblem; covered torso; thigh-high boots; gold staff with a pink star orb in the right hand.
MUST NOT: a bare chest or belly, an angry or evil face, horror features, a closed mouth, a cosmic background, sparkles, floating cards, a white background.

FINAL CHECK before output: four figures in a 2x2 grid; bottom-left faces left and bottom-right faces right; the back view shows no face; head size, chin height and foot line match Image 1; dark navy outline; transparent or flat magenta background; everything inside its own cell.
```

### 5-4. 언더독 (underdog, 남성, 큰 키)

```text
Create ONE finished production sprite sheet: a four-view turnaround of the chibi game character UNDERDOG for a mobile tower-defense game. It must look drawn by the same artist, in the same session, as Image 1.

REFERENCE BOARD: the one attached image has three panels side by side on white. Read it as three separate images: LEFT panel = Image 1, MIDDLE panel = Image 2, RIGHT panel = Image 3. Do not reproduce the board, its white gaps or its three-panel layout; the output is only the 2x2 sheet described below.

REFERENCE IMAGES (each has exactly one job)
- Image 1 = ZEKE, an approved character from the same game. Use it as the TEMPLATE for: the 2x2 sheet layout, the camera, the size of the head, the foot line, the super-deformed male construction, the line art, the cel shading and the eye rendering. Do NOT copy his face, flame hair, armour, sword, red coat or colours.
- Image 2 = UNDERDOG's original illustration. Use it ONLY for identity: face, hair, skin tone, tattoo, coat, chain belt and build. Do NOT copy its hands-behind-the-head pose, the hood pulled over the head, its realistic proportions, the low camera, the purple stage lights or the fog.
- Image 3 = close-up of UNDERDOG's face. Copy the brows, the narrow eyes, the jaw, the grin, the hair and the earring exactly.

SHEET LAYOUT
- Square image at the largest square size available. Transparent background (real alpha). If transparency is unavailable, one completely flat solid magenta #FF00FF. Never white, never a drawn checkerboard. No floor, no cast shadow, no gradient, no grid lines, no borders, no text, no labels.
- Four equal square cells, 2 columns x 2 rows, one full-body figure per cell, centred horizontally in its cell:
  TOP-LEFT = FRONT: body and face toward the viewer, eyes on the viewer.
  TOP-RIGHT = BACK: facing away; we see the back of the head, the lowered hood and the body; no face, no eyes.
  BOTTOM-LEFT = LEFT: the figure faces the LEFT edge of the picture (the nose points left).
  BOTTOM-RIGHT = RIGHT: the figure faces the RIGHT edge of the picture (the nose points right).
- Side views turn like Image 1's side views: body in profile, the near eye fully visible, the far eye hidden.
- All four figures: the SAME neutral idle standing pose (not punching, walking or leaning), the same scale, a straight eye-level camera, the soles on the same line. The front face looks straight at the viewer with no sideways head tilt.

PROPORTIONS (super-deformed like Image 1; a 3-head or 4-head chibi is WRONG)
- The whole figure is about 2.3 heads tall. The head with its hair is almost as tall as everything below the chin.
- H = skull height (chin to top of the skull, ignoring hair volume). Chin to soles, including legs and boots = 1.33 H, slightly longer than Image 1 (1.27 H).
- In every cell, measured from the top edge of the cell: soles at 94%, chin at 55%, top of the skull at 25%. Skull width about 31% of the cell width. The head is exactly as big as Image 1's head.
- Everything stays inside its cell with at least 5% empty margin on every side. Total figure width at most 70% of the cell width.
- MALE-FORM, heavily muscular chibi: shoulders about 1.6 times the skull width, thick trapezius and a bull neck, thick short arms, big fists (each about a third of the skull height) hanging relaxed at the sides; sturdy short legs, feet about one skull width apart.

STYLE (match Image 1)
- Clean, even, dark navy-indigo outline (about #23213A) around the whole figure and on inner lines, with the OUTER silhouette line clearly bolder than the inner lines: about 0.8% of the cell width (about 8 px on a 960 px cell), the same weight as the outer line of Image 1. Not black, not brown, not purple.
- Cel shading: base colour + one shadow tone + a soft gradient on the hair; light from the upper left; one glossy highlight band on the hair; simple muscle shading.
- His black coat, trousers and boots are painted as deep charcoal-indigo with clearly visible blue-grey highlights and fold lines so the shapes read at small size. No large flat pure-black areas.
- Simplify for a 40-pixel game token: few large, clear shapes; only a few studs; the tattoo as a bold simple pattern.
- No effects: no glow, aura, fog, sparks or motion lines.

CHARACTER: UNDERDOG
An ordinary human with no magic and no training, a rough street brawler in his late twenties. Nobles' sons once used him as a "human sandbag"; one day he knocked every one of them down and walked out. He throws broken stones at eyes and hits before a spell can finish. Cocky and unafraid.
FACE (the most important part; it must read as a hardened adult man even in chibi form; identical in every view that shows the face): a squarer jaw and chin than Image 1, less round cheeks; heavy, thick, dark, straight eyebrows angled down toward the nose; narrow half-lidded dark-brown eyes with smaller irises than Image 1 and one small highlight; a wild, confident, toothy grin with the upper teeth showing and one corner of the mouth higher. Light warm skin as in Image 2 (not tanned, not bronze). Messy dark-brown hair falling forward over the forehead in uneven strands, short at the back and sides. Small silver stud earrings.
TATTOO: a bold dark tribal pattern on the right side of his neck (the viewer's left in the front view), continuing down across the upper chest.
COSTUME: a glossy black short-sleeved long robe-coat worn open in a deep V down to the sternum, showing the tattoo and the chest muscles (not open to the navel); a few small silver studs along the front edges and the sleeve hems; a black hood lying down, bunched behind the neck; a thick silver chain-rope belt with a loop knot at the waist; coat skirts reaching the shins with a side slit; black trousers; plain black boots. Empty hands. No weapons, no armour, no gloves.

MUST HAVE: hard adult face with heavy brows, narrow eyes and a toothy grin; messy dark-brown hair; neck and chest tattoo; open black studded robe-coat; hood down behind the neck; silver chain-rope belt; broad muscular build with big relaxed fists.
MUST NOT: a clean-cut pretty boy, a gentle smile, round soft cheeks, big sparkly eyes, tanned or bronze skin, the hood on the head, weapons, fog, glow, a white background.

FINAL CHECK before output: four figures in a 2x2 grid; bottom-left faces left and bottom-right faces right; the back view shows no face; the head is the same size as Image 1's; chin at 55% and soles at 94% of each cell; dark navy outline; transparent or flat magenta background; everything inside its own cell.
```

### 5-5. 해바라기 (sunflower, 성별 미정·여성형 체형, 보통 키)

```text
Create ONE finished production sprite sheet: a four-view turnaround of the chibi game character SUNFLOWER for a mobile tower-defense game. It must look drawn by the same artist, in the same session, as Image 1.

REFERENCE BOARD: the one attached image has three panels side by side on white. Read it as three separate images: LEFT panel = Image 1, MIDDLE panel = Image 2, RIGHT panel = Image 3. Do not reproduce the board, its white gaps or its three-panel layout; the output is only the 2x2 sheet described below.

REFERENCE IMAGES (each has exactly one job)
- Image 1 = SIREN, an approved character from the same game. Use it as the TEMPLATE for: the 2x2 sheet layout, the camera, the size of the head, the foot line, the short slim super-deformed body, the line art, the cel shading and the eye rendering. Do NOT copy her face, long blue hair, headphones, outfit or colours.
- Image 2 = SUNFLOWER's original illustration. Use it ONLY for identity: hair, flowers, vines, dress, arm warmers and boots. Do NOT copy its kneeling pose, the look back over the shoulder, its realistic body, the bed, the window room or the sunflower field.
- Image 3 = close-up of SUNFLOWER's face. Copy the eye shape, eye colour, lashes, mole, nose bandage, smirk and expression exactly.

SHEET LAYOUT
- Square image at the largest square size available. Transparent background (real alpha). If transparency is unavailable, one completely flat solid magenta #FF00FF. Never white, never a drawn checkerboard. No floor, no cast shadow, no gradient, no grid lines, no borders, no text, no labels.
- Four equal square cells, 2 columns x 2 rows, one full-body figure per cell, centred horizontally in its cell:
  TOP-LEFT = FRONT: body and face toward the viewer, eyes on the viewer.
  TOP-RIGHT = BACK: facing away; we see the back of the head and body; no face, no eyes.
  BOTTOM-LEFT = LEFT: the figure faces the LEFT edge of the picture (the nose points left).
  BOTTOM-RIGHT = RIGHT: the figure faces the RIGHT edge of the picture (the nose points right).
- Side views turn like Image 1's side views: body in profile, the near eye fully visible, the far eye hidden.
- All four figures: the SAME neutral idle standing pose (not attacking, walking, kneeling or leaning), the same scale, a straight eye-level camera, the soles on the same line. The front face looks straight at the viewer with no sideways head tilt.

PROPORTIONS (ultra super-deformed like Image 1; a taller 3-head chibi is WRONG)
- The whole figure is about 2.3 heads tall. The head with its hair is as tall as everything below the chin.
- H = skull height (chin to top of the skull, ignoring hair volume, flowers and vine antennae). Chin to soles, including legs and boots = 1.25 H, slightly longer than Image 1 (1.17 H): slim calves visible above the boots.
- In every cell, measured from the top edge of the cell: soles at 94%, chin at 57%, top of the skull at 28%. Skull width about 31% of the cell width. The head is exactly as big as Image 1's head.
- Everything (flowers, antennae) stays inside its cell with at least 5% empty margin on every side. Total figure width at most 70% of the cell width.
- FEMALE-FORM chibi body like Image 1: slim, short, straight legs standing close together with the feet almost touching, small hands and feet, narrow shoulders, slim waist.

STYLE (match Image 1)
- Clean, even, dark navy-indigo outline (about #23213A) around the whole figure and on inner lines, with the OUTER silhouette line clearly bolder than the inner lines: about 0.8% of the cell width (about 8 px on a 960 px cell), the same weight as the outer line of Image 1. Not black, not brown, not olive.
- Cel shading: base colour + one shadow tone + a soft gradient on the hair; light from the upper left; one glossy highlight band on the hair.
- Eyes rendered like Image 1: large and glossy, layered iris colour, catchlights; but with the relaxed half-lidded shape of Image 3.
- Simplify for a 40-pixel game token: only a few flower dots on the dress, no tiny thorns or tiny flowers on the vines.
- No effects: no glow, aura, sunbeams, sparkles, floating petals or motion lines.

CHARACTER: SUNFLOWER
A laid-back, sly, sun-warmed young plant spirit of unstated gender, slim and androgynous. Lazy, confident and a little smug: "I'm photosynthesising, don't talk to me... fine, you can." Never angry, never shy.
FACE (the most important part; identical in every view that shows the face): relaxed half-lidded eyes with bright yellow-green irises and a darker green rim, thick dark-brown upper lash lines; calm, knowing and slightly sleepy (not wide, not sparkling). A small dark mole under the outer corner of the LEFT eye (the viewer's right in the front view). A small white bandage strip across the bridge of the nose. A lopsided closed smirk with one small fang visible at a corner of the mouth. Relaxed eyebrows. Warm peach skin.
HAIR: a short, messy, dark olive-green bob with side locks; the tips (lower quarter) turn bright sunflower yellow like petals.
HEAD FLOWERS: two thin green vine antennae with a curl at the tip rise from the top of the head, each about 0.4 H tall. One BIG sunflower, about 0.55 H across, is attached at the side of the head over the RIGHT ear (the viewer's left in the front view); it sits beside the face and covers no part of the face or eyes. One smaller sunflower, about 0.35 H across, sits tilted on the top-left of the head (the viewer's right in the front view).
- RIGHT view: the big sunflower is on the near side at the ear, behind the face.
- LEFT view: the big sunflower is on the far side; only its petals peek out behind the head.
COSTUME: a thin green thorny vine choker; a sleeveless yellow mini dress printed with a few small sunflowers and leaves; thin orange criss-cross straps over the open back; long orange fingerless arm warmers up to the upper arms; a green vine curling around the RIGHT forearm; knee-high mustard-gold lace-up boots with black laces and chunky soles. Empty hands relaxed at the sides; no props.

MUST HAVE: half-lidded yellow-green eyes; mole under the left eye; nose bandage; smirk with one fang; olive hair with yellow tips; two vine antennae; big sunflower over the right ear and a small one on top; vine choker; sunflower-print yellow dress; orange arm warmers; mustard lace-up boots.
MUST NOT: a flower covering the face, wide sparkling eyes, an open-mouth smile, floating petals, sunbeams, props in the hands, a white background.

FINAL CHECK before output: four figures in a 2x2 grid; bottom-left faces left and bottom-right faces right; the back view shows no face; the head is the same size as Image 1's; chin at 57% and soles at 94% of each cell; dark navy outline; transparent or flat magenta background; everything inside its own cell.
```

### 5-6. 큐어마스터 (cure_master, 여성, 보통 키)

```text
Create ONE finished production sprite sheet: a four-view turnaround of the chibi game character CURE MASTER for a mobile tower-defense game. It must look drawn by the same artist, in the same session, as Image 1.

REFERENCE BOARD: the one attached image has three panels side by side on white. Read it as three separate images: LEFT panel = Image 1, MIDDLE panel = Image 2, RIGHT panel = Image 3. Do not reproduce the board, its white gaps or its three-panel layout; the output is only the 2x2 sheet described below.

REFERENCE IMAGES (each has exactly one job)
- Image 1 = AVALANCHE MAID, an approved character from the same game. Use it as the TEMPLATE for: the 2x2 sheet layout, the camera, the size and height of the head in each cell, the chin height, the foot line, the short super-deformed body, the line art, the cel shading and the eye rendering. Do NOT copy her face, spiral eyes, light-blue twin tails, maid costume or colours.
- Image 2 = CURE MASTER's original illustration. Use it ONLY for identity: hair, colours, nurse costume, wings and syringe. Do NOT copy its bending pose, its realistic body, the sky, the ocean, the bubbles, the floating hearts, the floating lemonade glass or the water splash.
- Image 3 = close-up of CURE MASTER's face. Copy the wink, the open eye, the heart mark on the bangs, the blush and the smile exactly.

SHEET LAYOUT
- Square image at the largest square size available. Transparent background (real alpha). If transparency is unavailable, one completely flat solid magenta #FF00FF. Never white, never a drawn checkerboard. No floor, no cast shadow, no gradient, no grid lines, no borders, no text, no labels.
- Four equal square cells, 2 columns x 2 rows, one full-body figure per cell, centred horizontally in its cell:
  TOP-LEFT = FRONT: body and face toward the viewer.
  TOP-RIGHT = BACK: facing away; we see the back of the head, the buns, the wings and the body; no face, no eyes.
  BOTTOM-LEFT = LEFT: the figure faces the LEFT edge of the picture (the nose points left).
  BOTTOM-RIGHT = RIGHT: the figure faces the RIGHT edge of the picture (the nose points right).
- Side views turn like Image 1's side views: body in profile, the near eye fully visible, the far eye hidden.
- All four figures: the SAME neutral idle standing pose (not attacking, walking, bending or leaning), the same scale, a straight eye-level camera, the soles on the same line. The front face looks straight at the viewer with no sideways head tilt.

PROPORTIONS (ultra super-deformed, exactly like Image 1; a taller 3-head chibi is WRONG)
- The whole figure without the cap is about 2.3 heads tall. The head with its hair is as tall as everything below the chin.
- H = skull height (chin to top of the skull, ignoring hair volume, buns and the cap). Chin to soles, including legs and shoes = 1.28 H, the same as Image 1.
- In every cell, measured from the top edge of the cell: soles at 94%, chin at 57%, top of the skull at 28%. Skull width about 31% of the cell width. This is the same placement as Image 1.
- Everything (cap, buns, long hair, wings, syringe) stays inside its cell with at least 5% empty margin on every side. Total figure width at most 70% of the cell width: keep the long hair falling close to the body.
- FEMALE-FORM chibi body like Image 1: slim, short, straight legs standing close together with the feet almost touching, small hands and feet, narrow shoulders, slim waist.

STYLE (match Image 1)
- Clean, even, dark navy-indigo outline (about #23213A) around the whole figure and on inner lines, with the OUTER silhouette line clearly bolder than the inner lines: about 0.8% of the cell width (about 8 px on a 960 px cell), the same weight as the outer line of Image 1. Not black, not brown, not maroon, not pink.
- Cel shading: base colour + one shadow tone + a soft gradient on the hair; light from the upper left; one glossy highlight band on the hair.
- Eyes rendered with Image 1's finish (large, glossy, layered iris colour, catchlights) but NOT Image 1's spiral pupils. Tiny nose, small mouth, soft blush.
- All pinks are clear rose or bubblegum pink, never magenta.
- Simplify for a 40-pixel game token: few large, clear shapes.
- No effects: no glow, aura, sparkles, bubbles, floating hearts or motion lines.

CHARACTER: CURE MASTER
An angelic magical-girl nurse witch who offers you lemonade; a master of protective blessings and healing. Her smile is a little too perfect: adorable on the surface, with a hint that something is off underneath. Never a villain.
FACE (the most important part): in the FRONT view her RIGHT eye (the viewer's left) is closed in a happy wink arc and her LEFT eye (the viewer's right) is open: big, bright blue, with a large white highlight. Pink blush on both cheeks, a small closed content smile, and a white heart-shaped highlight mark on the bangs at the centre of the forehead. In both side views the visible eye is open; the wink is only in the front view.
HAIR: bubblegum-pink hair with thick blunt bangs; two high round buns, each held by a pink heart-shaped clip with a light-blue ribbon bow; long hair behind the back falling to the waist and fading to lavender at the tips. A small white nurse cap with a pink heart sits on top between the buns. Small gold heart earrings.
COSTUME: a pale-blue-and-white apron bodice with a big pink heart on the chest; a pink neck scarf tied in a bow with a small heart brooch; short pink puffed sleeves with white cuffs; a ruffled pink skirt with white frill trim; a pastel bead bracelet with a heart charm on her LEFT wrist; white thigh-high stockings with a small pink heart at the top; pink Mary Jane shoes with a heart on the strap.
WINGS: a pair of small white feathered angel wings on her back, each about 0.5 H tall. FRONT view: the wing tips peek out behind the shoulders. BACK view: both wings fully visible. Side views: one wing behind the back.
PROP: her RIGHT hand holds a big cartoon syringe upright at her side like a staff, as tall as from her soles to her shoulders: a clear barrel full of bright yellow lemonade, a pink plunger handle at the BOTTOM resting near the ground, a silver needle pointing UP, and a lemon slice stuck on the barrel near the top. Her left hand hangs relaxed.
- FRONT view: the syringe is on the viewer's LEFT.
- BACK view: the syringe is on the viewer's RIGHT.
- RIGHT view: the syringe is on the near side, in front of the body.
- LEFT view: the syringe is on the far side; the needle and the lemon show above and behind the shoulder.

MUST HAVE: the wink in the front view; the white heart mark on the bangs; the nurse cap with a heart; two buns with heart clips and blue ribbons; pink hair fading to lavender; small white angel wings; the lemonade syringe with a lemon slice, needle up, in the right hand; apron with a pink heart; white thigh-highs; pink Mary Jane shoes.
MUST NOT: blood or anything medical and scary, the needle pointing at the viewer, a sinister face, sparkles, bubbles, floating hearts, magenta clothing, a white background.

FINAL CHECK before output: four figures in a 2x2 grid; bottom-left faces left and bottom-right faces right; the back view shows no face; head size, chin height and foot line match Image 1; dark navy outline; transparent or flat magenta background; everything inside its own cell.
```

### 5-7. 다시 뽑을 때 덧붙일 문장

탈락 사유가 같은 후보가 4장 중 3장 이상이면, 해당 문장을 프롬프트 맨 끝에 붙여 4장을 다시 뽑는다. `{K}`, `{CHIN}`은 그 캐릭터 프롬프트의 숫자로 바꾼다.

| 탈락 사유 | 덧붙일 문장 |
|---|---|
| 몸이 길다(3등신) | `CORRECTION: the previous result had a body that was far too long. Make the head bigger and the body shorter: chin to soles is only {K} times the skull height, the chin is at {CHIN}% of the cell height, and the head is as big as Image 1's head.` |
| 머리가 너무 크다 | `CORRECTION: the head was too big. The skull must be exactly as wide as Image 1's skull, about 31% of the cell width.` |
| 좌우 방향이 틀렸다 | `CORRECTION: in the BOTTOM-LEFT cell the nose must point to the LEFT edge of the picture; in the BOTTOM-RIGHT cell the nose must point to the RIGHT edge. The two side views are mirror images of each other.` |
| 뒷모습에 얼굴 | `CORRECTION: the TOP-RIGHT cell is seen from directly behind. Only the back of the head and hair are visible; no eyes, no mouth, no face.` |
| 외곽선이 갈색·자주·검정 | `CORRECTION: every outline must be dark navy-indigo, about #23213A, exactly like Image 1. No brown, maroon or pure black lines.` |
| 바깥 외곽선이 가늘다 | `CORRECTION: the outer silhouette line was too thin. Make the line around the whole figure as bold as Image 1's: about 0.8% of the cell width, clearly bolder than the inner lines.` |
| 보드 배치를 따라 그렸다(세 칸, 원화 장면 등) | `CORRECTION: the attached board is only reference material. Do not draw three panels or copy the original illustration's scene. Output exactly one 2x2 sheet of four chibi views.` |
| 흰 배경·체커보드 | `CORRECTION: the background must be real transparency, or one flat solid magenta #FF00FF. Not white, not a painted checkerboard.` |
| 소품 손이 바뀐다 | `CORRECTION: the prop stays in the character's RIGHT hand in every view: viewer's left in the front view, viewer's right in the back view, near side in the RIGHT view, far side in the LEFT view.` |
| 얼굴이 원화와 다르다 | `CORRECTION: the face drifted from Image 3. Copy Image 3's eye shape, eye colour, eyebrows and mouth exactly; keep only the line and shading style of Image 1.` |
| 검은 옷이 뭉갠다 | `CORRECTION: the black clothes merged into one dark blob. Paint them as charcoal-indigo with clear blue-grey highlights and fold lines, like the dark parts of Image 1.` |
| 필수 요소 누락 | `CORRECTION: the previous result was missing: <빠진 요소를 MUST HAVE 문구 그대로>. Draw it in every view where it is visible.` |
| 언더독이 미소년이 됐다 | `CORRECTION: he looked like a pretty young boy. Make the jaw square, the brows heavy and low, the eyes narrow with small irises, and the grin rough with teeth showing. He is a hardened man in his late twenties.` |
| 베놈이 작고 귀엽다 | `CORRECTION: she looked short and cute. Make her slender and tall: longer neck, longer narrow gown, chin at 52% of the cell, cold narrow half-lidded eyes.` |

## 6. 패킹·검수·설치

모든 명령은 저장소 루트에서 실행한다(`node_modules`에 `sharp`가 필요하다). `<id>`는 `ash`, `venom`, `joker`, `underdog`, `sunflower`, `cure_master` 중 하나다.

1. **배경 맞추기.** 투명 PNG면 자홍으로 합성한다. 자홍 배경이면 그대로 쓴다.

   ```bash
   node -e "require('sharp')('picked.png').flatten({background:'#ff00ff'}).png().toFile('sheet.png')"
   ```

2. **두개골 상자 읽기.** 앞모습 칸에 격자를 씌운다. `<half>`는 시트 너비의 절반이다.

   ```bash
   node defense_test/scripts/art/grid.mjs sheet.png work/grid-front.png 0 0 <half> <half> 20
   ```

   - `chin`: 턱선의 가장 낮은 점의 y. 목이나 옷깃이 아니다.
   - `left`, `right`: 눈 높이에서 얼굴 피부 윤곽이 머리카락과 만나는 x. 머리카락 바깥 끝이 아니다. 귀가 보이면 귀 안쪽 끝이다.
   - `top = chin − round(0.93 × (right − left))`. 캐스트 상자의 세로/가로 비가 약 0.93이다.
   - 확인: 두 눈의 중심이 상자 위에서 55~75% 높이에 있어야 한다. 벗어나면 chin과 뺨을 다시 읽는다.
   - 꽃·뿔·모자·머리 부피는 상자에 넣지 않는다(해바라기의 꽃, 베놈의 관, 조커의 모자).

3. **이전 보정 지우기.** `defense/docs/art/HEAD_PROFILE.json`의 `headOverrides`에 그 `<id>` 항목이 있으면 지운다(애쉬·큐어마스터·해바라기·언더독). 나노바나나 그림이 작아 보여 넣은 보정이라 새 그림에는 맞지 않는다.

4. **패킹.**

   ```bash
   node defense_test/scripts/art/pack-sd.mjs sheet.png work/<id> <id> <left>,<top>,<right>,<chin>
   ```

   - 출력 JSON의 `packedSkull`, `bodyBelowChin`, `portrait`를 적어 둔다.
   - "painted pixels exceed frame"이 나오면 그 후보는 몸이나 장식이 너무 크다. 그림을 줄이지 말고 다른 후보로 간다.

5. **검수.** `<class>`는 언더독만 `tall`, 나머지는 `medium`이다.

   ```bash
   node defense_test/scripts/art/review-sd.mjs work/<id>/<id>.webp <id> <packedSkull> <class>
   ```

   통과 기준(`ASSET_PIPELINE.md` §3)은 다음과 같다.

   | 항목 | 기준 |
   |---|---|
   | headW / headH | 150~168 / 143~156 |
   | body | 보통 143~218, 큰 키 189~211 |
   | outline rgb | 세 값 모두 90 이하이고 파랑(B)이 빨강(R)보다 크다(남색). 캐스트 중앙값은 (35,33,53)이다 |
   | 바깥 외곽선 굵기 | 4px 이상(아발란체메이드·세이렌 4, 지크 6, 별똥별소년 3). 아래 명령의 `before` 값으로 잰다 |
   | 그림 | `<id>-heads.png`에서 얼굴 크기가 이웃 캐스트와 같다. `<id>-lineup-96.png`에서 튀지 않는다 |

   바깥 외곽선이 3px 이하이면 바깥 윤곽만 1px 보강한다. 얼굴·내부 선·색은 바뀌지 않는다. 결과를 원본·캐스트와 1:1로 나란히 보고, 보강이 두드러져 보이면 원본을 쓴다.

   ```bash
   node defense_test/scripts/art/thicken-outline.mjs work/<id>/<id>.webp work/<id>/<id>-outline.webp 1 --measure
   ```

6. **설치.**

   ```bash
   node defense_test/scripts/art/pack-sd.mjs sheet.png work/<id> <id> <left>,<top>,<right>,<chin> --install
   ```

   - 5단계에서 외곽선을 보강했다면 `work/<id>/<id>-outline.webp`를 `defense_test/assets/merge/units/<id>.webp`에 덮어쓴다.
   - `defense_test/src/data.js`에서 그 동료의 `art.portrait`를 출력된 `portrait` 값으로 바꾼다(`size` 250).
   - `node defense_test/scripts/art/check-facing.mjs`를 실행한다. 출력에 `<id>`가 있으면 `--fix <id>`(좌우 칸 맞바꿈)로 고치고 다시 실행한다. 베놈은 `CHECKED_BY_EYE`에 있으므로 눈으로 본다.
   - `node defense_test/scripts/art/consistency-report.mjs`를 실행한다. 그 동료의 `bboxH`가 같은 키 그룹 중앙값의 95~105%면 끝이다. 95% 미만이면 `headOverrides`에 `scale = min(1.08, 중앙값 ÷ bboxH)`를 넣고(이유 문장 포함) 4번부터 다시 한다.
   - `node defense_test/scripts/generated-reports.mjs`, `cd defense_test && npm test`, `node defense_test/scripts/build.mjs`를 실행한다.

7. **화면 확인.** 390×844에서 홈 파트너, 동료 카드·정보, 전투 4방향, 컷인, 결과 MVP, 소환 연출을 캡처한다. 밤·맑음 두 테마 모두 본다.
8. **기록.** `ASSET_PIPELINE.md`에 4-x 절을 더한다. 내용: 모델, 후보 수, 고른 후보 파일명, 탈락 사유, 측정값. 고른 원본 PNG는 저장소 밖에 둔다.

## 7. Manus에 보내는 메시지

한 대화에서 캐릭터 한 명씩 진행한다. 메시지마다 그 캐릭터의 원화 한 장만 첨부한다. 순서는 §3 표 순서다(큐어마스터 → 애쉬 → 베놈 → 조커 → 언더독 → 해바라기).

**첫 메시지** (첨부: `큐어마스터.png`)

```text
저장소 https://github.com/romarin0325-cell/Studying (main 브랜치)의 defense_test/docs/GPT_IMAGE_SD_BRIEF.md 를 끝까지 읽고, 그 지시서대로 게임 캐릭터의 SD 4방향 시트를 만들어 줘. 같은 문서가 가리키는 defense_test/docs/ASSET_PIPELINE.md 의 §0, §2, §3도 읽어.

이 대화에서 캐릭터 6명을 한 명씩 진행할 거야. 나는 메시지마다 그 캐릭터의 원화 한 장만 첨부해. 기준 시트(Image 1)는 저장소에 있고, 얼굴 확대(Image 3)는 지시서 §3의 좌표로 원화에서 잘라. 이번 첨부는 큐어마스터 원화야.

반드시 지킬 것
- 이미지 생성 도구에는 지시서 §5의 그 캐릭터 코드 블록 전체를 한 글자도 바꾸지 말고 그대로 넣어. 요약, 번역, 다듬기, 합치기 모두 금지야.
- 생성할 때 넣는 이미지는 §3의 명령으로 만든 참조 보드 한 장뿐이야. 원화를 따로 넣지 마.
- 한 번에 캐릭터 한 명, 시트 한 장만 생성해. 후보는 매번 새로 생성하고, 나온 이미지를 대화로 고쳐 가지 마.
- 출력은 정사각형, 가능한 가장 큰 크기, 투명 배경 PNG. 투명이 안 되면 단색 자홍 #FF00FF 배경.
- 저장소 파일은 바꾸지 마. 커밋, 푸시, PR도 하지 마. 지시서 §6의 6~8단계(설치)는 하지 마.
- 지시서대로 할 수 없는 상황(보드를 못 만듦, 프롬프트가 잘림, 이미지를 넣을 수 없음)이면 임의로 바꾸지 말고 멈춘 뒤 알려 줘.

캐릭터 한 명마다 할 일
1. 저장소 루트에서 npm ci 를 한 번 실행해. 그다음 §3 표의 그 캐릭터 줄로 참조 보드를 만들고, 오른쪽 칸에 그 캐릭터의 얼굴이 크게 보이는지 확인해.
2. §3 표의 프롬프트 절(§5-x)과 보드로 후보 4장을 각각 생성해.
3. §4-1 규칙 1~5, 7, 8로 4장을 하나씩 확인하고, 탈락이면 규칙 번호를 적어.
4. 4장 중 3장 이상이 같은 이유로 탈락하면 §5-7의 해당 문장을 프롬프트 끝에 붙여 4장을 다시 생성해. 한 번만 해.
5. 남은 후보에 §6의 1~5단계를 실행해 비율을 재고(§4-1의 6번), §4-2 순서로 한 장을 골라. 3단계의 HEAD_PROFILE.json 수정은 네 작업 복사본에서만 해. 2단계의 두개골 상자 값이 애매하면 읽은 값과 grid 이미지를 함께 보고해.
6. 결과를 보고하고 멈춰. 다음 원화를 첨부하면 다음 캐릭터를 진행해.

결과물: 캐릭터마다 <id>.zip 하나
- candidates/: 생성한 후보 전부(<id>-r<회차>-c<번호>.png)
- picked.png: 고른 시트, 생성된 그대로
- board.png: 쓴 참조 보드
- measure/: grid-front.png, pack-sd 출력 JSON, review-sd 출력 텍스트, heads.png, lineup-96.png
- report.md: 쓴 프롬프트 절과 덧붙인 문장, 후보별 통과/탈락과 규칙 번호, 고른 후보와 이유 한 줄, 두개골 상자 값(left, top, right, chin), review-sd 결과(headW, headH, body, outline rgb, 범위 안/밖), 지시서대로 하지 못한 점
```

**다음 메시지들** (첨부: 그 캐릭터의 원화 한 장. `<이름>`과 `<id>`만 바꾼다)

```text
다음은 <이름>(<id>)이야. 첨부한 원화로 같은 순서를 진행해. 지시서 §3 표의 <이름> 줄(기준 시트, 얼굴 좌표)과 그 줄의 프롬프트 절을 써. 끝나면 <id>.zip을 주고 멈춰.
```

## 8. 이전 프롬프트(나노바나나)와 달라진 점

| 항목 | 이전 | 이번 |
|---|---|---|
| Image 1 | 일부가 다른 새 캐릭터(토피애플)였고, 키 그룹이 다른 동료(하모니어스는 작은 키)도 있었다 | 모두 GPT 제작 승인 캐스트, 같은 체형·키 그룹 |
| 비율 | "몸 1.2배" 한 줄 | 틀(Image 1) + 셀 안 위치(%) + "3등신 금지" 세 겹. GPT 2.5 시험본이 1.75배 길었기 때문이다 |
| 배경 | 자홍만 | 투명 우선, 자홍 대체 |
| 검은 옷 | 지시 없음 | 남색 하이라이트로 형태를 살린다. 애쉬·베놈·언더독의 어두운 비율 이탈(ASSET_CONSISTENCY §3.4) 대응 |
| 손·방향 | "오른손(앞모습에서 화면 왼쪽)" | 네 칸마다 소품이 어느 쪽에 오는지 적었다. 좌우 칸 뒤바뀜(§4-6) 대응 |
| 필수·금지 | 문장 속에 섞여 있었다 | MUST HAVE·MUST NOT 목록. Manus 시험본에서 빠진 날개·레몬·하트 표식을 넣었다 |
| 언더독 피부 | 따뜻한 피부(결과가 구릿빛) | 원화처럼 밝은 피부. 지금 승인 SD와 다르므로 사용자 확인이 필요하다 |
| 큐어마스터 바늘 | 아래 | 위(원화와 지금 승인 SD가 모두 위) |
