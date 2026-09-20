# 주간 이벤트 이미지 제작 기록

제작 모드: **내장 imagegen**, style-transfer(보스), stylized-concept(배경). 외부 API/CLI는 사용하지 않았다.
원화는 사용자가 제공한 디자인 참고이고, 실제 게임에는 새로 시각화한 전신 스프라이트를 사용한다.

## 최종 파일

| 보스 | 게임용 스프라이트 | 전장 배경 |
|---|---|---|
| 아스테아 | `assets/astea.png` | 기존 `assets/celestial-world.png` 유지 |
| 하모니어스 | `assets/harmonious.png` | `assets/harmonious-world.png` |
| 골드드래곤 | `assets/gold-dragon.png` | `assets/gold-dragon-world.png` |
| 에인션트소울 | `assets/ancient-soul.png` | `assets/ancient-soul-world.png` |
| 베히모스 | `assets/behemoth.png` | `assets/behemoth-world.png` |
| 시간의지배자 | `assets/time-ruler.png` | `assets/time-ruler-world.png` |

생성 결과는 원래 생성 폴더에 남겨두고 채택본만 위 경로로 복사했다. 아스테아 교체 전 원본은 이 브랜치의 기반 커밋 `3f7bd70`에서 복구할 수 있다.

## 참조 역할

- Image 1: `assets/bosses.png` — 기존 게임의 선·비율·명암 기준. 2×2 아틀라스지만 결과는 한 캐릭터만 생성.
- Image 2: 아스테아는 기존 `assets/astea.png`, 신규 보스는 사용자 제공 동명의 PNG — 정체성·복장·색·고유 장식만 보존하는 디자인 참고.
- 배경 생성 Image 1: `assets/worlds.jpg` — 기존 전장의 회화적 건축·깊이·빈 중앙 통로 기준. 결과는 각각 독립된 세로 배경.

초기 투명 시안은 체크 무늬와 과도한 디테일/길쭉한 몸 비율 때문에 채택하지 않았다. 최종 보스는 기존 자산과 같은 단색 그린 키로 제작했다. 실제 게임에는 로딩 단계에서 배경을 제거한 투명 캐시가 들어간다.

## 최종 보스 프롬프트 세트

아스테아·골드드래곤·베히모스·시간의지배자는 아래 공통문과 캐릭터별 문장을 합쳐 별도 요청했다.

```text
Use case: style-transfer. Production sprite for the SAME 2D cute anime bullet-hell game as image 1. Image 1 is the MASTER STYLE reference atlas, NOT a composition to reproduce. Draw ONE character only, with EXACTLY the compact stylized proportions, thick readable clean colored outlines, simplified soft cel-shaded color blocks, limited highlights and detail density of the upper-right white goddess in image 1. NOT a polished tall key illustration. Enlarge head and shorten torso/limbs like the actual reference sprite. The crown of hair to chin is about one fourth of crown to soles; keep anatomy adult/stylized. Large readable head, compact body, floating frontal full-body silhouette. NO fine painterly texture, no photorealistic glossy skin, no extra costume redesign. Head must remain legible at 160px gameplay scale. Background solid PURE bright green #00ff00 for existing game's chromakey pipeline, entirely flat no shadow/checkerboard/gradient. One isolated full body centered with margin. Main silhouette and face more important than flashy surrounding effects. Hands anatomically correct, exactly 5 digits per hand (one thumb and four fingers); no duplicate fingers or limbs. Match the reference's linework and shading above all.
```

### 아스테아

```text
Edit target image2: creator goddess Astea. Preserve golden hair, red eyes, white flowing gold-trim gown, detached draped sleeves, white/gold feathered wings, concentric golden celestial halo, white strappy sandals. Recompose to a compact game sprite in image1's style. Correct ALL malformed hands; right hand gently closed holding a small fold of fabric, left hand simple naturally open with ONE thumb and FOUR fingers, clearly separable. Both arms may move for correct anatomy. Wings should frame figure without shrinking face. Simplify long flowing cloth and shorten stretched torso/legs; larger head like goddess in image1, NOT original 6-head illustration.
```

### 골드드래곤

```text
Image2 is identity/costume reference: adult golden dragon woman, long white curled hair, golden eyes, four golden horns, large gold membrane wings, gold scaled tail, gold outfit with long side drapes, teal gems and gold footwear. Preserve all key identity traits; turn into SAME compact stylized boss sprite as image1, not the tall seductive portrait. Floating composed regal pose, arms open, no treasure pile/scene. Modest readable body silhouette, no emphasis on breasts/hips. Restrained gold cel highlights, broad shapes and readable face.
```

### 베히모스

```text
Image2 identity/costume reference: adult MALE Behemoth, muscular dark brown skin, dark green hair and green eyes, large broken stone horns, broken gold chains, leather harness, glowing green sun on chest and fissures, dark shorts and wrapped greaves. Preserve masculine powerful build and face, no feminization. Compact broad floating stance, feet visible, fists closed, broken chains to sides. About 4.5 heads tall, comparatively larger body than goddess but similar head size, not giant head or tiny realistic head. No cavern background. Muscle shading simple broad cel blocks like masculine water boss game sprite, not photoreal anatomy.
```

### 시간의지배자

```text
Image2 identity/costume reference: adult silver-haired woman, red eyes, black high-neck long gown with collar cutout, detached sheer black sleeves, blue gemstone at collar and earrings, ankle-strap black heels. Keep dignified elegant adult identity. Change seated pose into floating full-body boss pose with gently bent knees, one hand holding blue time orb and other gracefully lowered. A compact clock halo behind upper body only, no bookshelf or chair. Same compact chibi-adjacent stylization and face/head size as white goddess in image1; not original realistic long legs and tiny head. Soft restrained gray highlights, no shiny latex look.
```

하모니어스와 에인션트소울은 첫 시안의 장식 밀도를 줄이는 아래 공통문으로 다시 생성했다.

```text
Use case: style-transfer. Draw ONE full-body character game sprite in the SAME game style as reference image1 (an atlas of existing bosses, NOT a requested sheet). Match upper-right white goddess and lower-left dark goddess: compact stylized anime proportions with large readable head, short body, broad cel-shaded color shapes, thin clean colored contour, simple controlled gloss, limited decoration. Crown-to-chin should be 24% of crown-to-soles height, about FOUR heads tall, not tall 6-head key art. No miniature face. Recompose original photo/illustration reference image2 into floating frontal compact sprite. Character identity, outfit colors, signature objects must stay conservative. Full silhouette with margins, ONE sprite on pure #00ff00 uniform flat chromakey background no texture/no shadow/no checkerboard. Only small theme effects framing character, no surrounding scene. Correct hands exactly5digits, no extra limbs. Reduce tiny ornament detail to same density as reference1.
```

### 하모니어스

```text
Harmonious: cheerful mint twin tails with yellow ends and yellow forelock, green eyes, strawberry hair bows, cotton candy staff in one hand, white puff-sleeve crop blouse with red neckbow and bell, pink/white short fruit-patterned layered skirt, green ankle ribbons and sandals. Preserve cheerful magical dessert girl. Nonsexual cute pose with both feet visible and lightly bent knees. One hand naturally closed around cotton candy staff, other relaxed by skirt. Do not add gold embroidery, do not change signature outfit. Only TWO tiny macarons, no huge sweeping hair circles or dense decorative particles. Big face and compact hair silhouette like existing bosses.
```

### 에인션트소울

```text
Ancient Soul: adult MALE, androgynous beautiful slender man with flat chest and slim hips, long golden hair with curled ends, gold eyes, elf ears, paired flame horns, gold forehead diamond and collar, white/gold long split robe with chest star cutout, gold bracelets, small flame hovering above one hand. No breasts, do not feminize body, no exaggerated curves. Compact FOUR-head-tall stylized adult same as game's existing gods. Relaxed floating pose, one hand near flame, other with fingers loosely curled. Hair and robe two or three broad readable ribbons only; no dense gold filigree, no embellished long sleeves not in original. Small flame motif behind shoulders, not overwhelming rings.
```

## 배경 프롬프트 세트

각각 아래 공통문에서 `{scene}`을 교체해 5회 생성했다.

```text
Use case: stylized-concept. ONE portrait vertical scrolling 2D shooter background. Image1 is existing game's FOUR-column background atlas: match its elegant soft-painted anime fantasy architecture and fine atmospheric detail, but output ONE landscape scene in tall portrait aspect ratio, not columns or an atlas. New location: {scene}. Looking forward/down through aerial depth. Architecture confined mostly to left and right edges, dim uncluttered central flight corridor for readable bullets, distant skyline at top. Portrait 1:2.5 aspect, continuous space with no repeating seams. No characters, no UI, no text, no numbers, no rendered labels. Cool quiet low contrast lower center, luminous distant top. Same game as reference.
```

- 디저트킹덤: `a floating dessert kingdom: distant strawberry-pink castle spires, ivory cake terraces and mint bridges, tiny macaron floating islands. Tasteful fantasy architecture, not a food advertisement`
- 용의둥지: `a gold dragon nesting sanctuary: mountainous cliffs, ancient golden arches, sparse treasure terraces, warm amber clouds and a distant sun`
- 속삭임의동굴: `an ancient whispering cavern: huge violet-blue cave, ancient stone arches along the sides, small golden soul flames over deep mist, mysterious quiet ruins`
- 봉인된대지: `sealed earth: enormous cracked floating stone land and ancient broken chain pillars, deep jade-green mist, faint lime glowing fissures, dark weathered ruins`
- 시간의도서관: `a library suspended in time: tall dark blue endless bookcases and ivory clockwork arches along the sides, silver-blue mist, distant single moonlike clock, floating stone reading terraces`

## 최종 채택 판단

프롬프트의 4등신 지정 자체가 성공을 증명하지는 않는다. 최종본의 실제 머리 폭·체형·색면을 게임 크기에서 비교하고, 캐릭터별 전체 배율을 보정했다. 기준과 재검사 절차는 [BOSS_ART_GUIDE.md](BOSS_ART_GUIDE.md), 실제 비교는 `artifacts/boss-style-comparison.png`에 있다.
